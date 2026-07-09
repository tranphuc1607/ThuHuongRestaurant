package com.example.orderservice.service;

import com.example.orderservice.client.InventoryServiceClient;
import com.example.orderservice.client.ProductServiceClient;
import com.example.orderservice.client.dto.OrderDeductionPayload;

import com.example.orderservice.entity.DiningTable;
import com.example.orderservice.entity.Order;
import com.example.orderservice.entity.OrderItem;
import com.example.orderservice.entity.OrderSurcharge;
import com.example.orderservice.entity.DTO.req.AddOrderItemRequest;
import com.example.orderservice.entity.DTO.req.AddSurchargeRequest;
import com.example.orderservice.entity.DTO.req.CreateOrderRequest;
import com.example.orderservice.entity.DTO.res.OrderResponse;
import com.example.orderservice.entity.DTO.res.OrderStatsResponse;
import com.example.orderservice.entity.DTO.res.TopProductItem;
import com.example.orderservice.entity.enums.OrderStatus;
import com.example.orderservice.entity.enums.TableStatus;
import com.example.orderservice.repository.DiningTableRepository;
import com.example.orderservice.repository.OrderItemRepository;
import com.example.orderservice.repository.OrderRepository;
import com.example.orderservice.repository.OrderSurchargeRepository;
import com.example.restaurant_common.util.exception.MessageException;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderSurchargeRepository surchargeRepository;
    private final DiningTableRepository tableRepository;
    private final ProductServiceClient productServiceClient;
    private final InventoryServiceClient inventoryServiceClient;
    private final ObjectMapper objectMapper;

    @Transactional
    public OrderResponse createOrder(CreateOrderRequest req, String createdBy) throws MessageException {
        DiningTable table = tableRepository.findById(req.getTableId())
                .orElseThrow(() -> new MessageException("Không tìm thấy bàn với id: " + req.getTableId()));

        if (orderRepository.existsByDiningTableAndStatusIn(table, List.of(OrderStatus.OPEN))) {
            throw new MessageException("Bàn " + table.getName() + " đang có đơn hàng chưa thanh toán");
        }

        Order order = Order.builder()
                .diningTable(table)
                .note(req.getNote())
                .guestCount(req.getGuestCount())
                .build();
        order.setCreatedBy(createdBy);

        table.setStatus(TableStatus.OCCUPIED);
        table.setQrToken(UUID.randomUUID().toString());
        tableRepository.save(table);

        order = orderRepository.save(order);

        return buildOrderResponse(order);
    }

    @Transactional
    public OrderResponse addItem(Long orderId, AddOrderItemRequest req) throws MessageException {
        Order order = orderRepository.findByIdWithItemsAndTable(orderId)
                .orElseThrow(() -> new MessageException("Không tìm thấy đơn hàng với id: " + orderId));

        if (order.getStatus() != OrderStatus.OPEN) {
            throw new MessageException("Chỉ có thể thêm món vào đơn hàng đang ở trạng thái OPEN");
        }

        Map<String, Object> productResponse;
        try {
            productResponse = productServiceClient.getProduct(req.getProductId());
        } catch (Exception e) {
            throw new MessageException(extractErrorMessage(e));
        }
        Map<String, Object> productData = extractData(productResponse);

        String productStatus = String.valueOf(productData.get("status"));
        if (!"AVAILABLE".equals(productStatus)) {
            throw new MessageException("Sản phẩm không có sẵn để đặt hàng");
        }

        String productName = String.valueOf(productData.get("name"));
        Double productPrice = parseDouble(productData.get("price"));
        String productCategory = String.valueOf(productData.get("category"));
        boolean isDrink = "DRINK".equals(productCategory);

        // Đồ uống (bia): mỗi lần gọi là 1 đợt riêng — KHÔNG gộp số lượng vào dòng cũ
        // để giữ lịch sử từng đợt gọi cho đến lúc thanh toán
        if (!isDrink) {
            // Nếu đã có item cùng sản phẩm + đơn vị bán → tăng số lượng thay vì tạo dòng mới
            OrderItem existing = order.getItems().stream()
                    .filter(i -> i.getProductId().equals(req.getProductId())
                              && i.getSaleUnit().equals(req.getSaleUnit())
                              && !i.isFromBooking())   // không gộp vào món từ đặt bàn
                    .findFirst()
                    .orElse(null);

            if (existing != null) {
                return updateItemQty(orderId, existing.getId(), existing.getQuantity() + req.getQuantity());
            }
        }

        // Trừ kho ngay lập tức — nếu không đủ hàng thì reject addItem
        try {
            inventoryServiceClient.deductForOrder(OrderDeductionPayload.builder()
                    .orderId(orderId.toString())
                    .items(List.of(OrderDeductionPayload.OrderItem.builder()
                            .productId(req.getProductId())
                            .quantity(req.getQuantity())
                            .saleUnit(req.getSaleUnit())
                            .build()))
                    .build());
        } catch (Exception e) {
            throw new MessageException(extractErrorMessage(e));
        }

        OrderItem item = OrderItem.builder()
                .order(order)
                .productId(req.getProductId())
                .productName(productName)
                .productPrice(productPrice)
                .quantity(req.getQuantity())
                .saleUnit(req.getSaleUnit())
                .itemTotal(productPrice * req.getQuantity())
                .inventoryDeducted(true)
                .category(productCategory)
                .build();

        orderItemRepository.save(item);

        order.getItems().add(item);
        order.setTotalAmount(recalcTotal(order));
        orderRepository.save(order);

        return buildOrderResponse(order);
    }

    @Transactional
    public OrderResponse updateItemQty(Long orderId, Long itemId, int newQty) throws MessageException {
        Order order = orderRepository.findByIdWithItemsAndTable(orderId)
                .orElseThrow(() -> new MessageException("Không tìm thấy đơn hàng với id: " + orderId));

        if (order.getStatus() != OrderStatus.OPEN) {
            throw new MessageException("Chỉ có thể cập nhật đơn hàng đang ở trạng thái OPEN");
        }

        OrderItem item = order.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new MessageException("Không tìm thấy món với id: " + itemId));

        int delta = newQty - item.getQuantity();

        // Nếu kho đã bị trừ thực tế → điều chỉnh lại phần chênh lệch
        if (delta != 0 && item.isInventoryDeducted()) {
            OrderDeductionPayload deltaPayload = OrderDeductionPayload.builder()
                    .orderId(orderId.toString())
                    .items(List.of(OrderDeductionPayload.OrderItem.builder()
                            .productId(item.getProductId())
                            .quantity(Math.abs(delta))
                            .saleUnit(item.getSaleUnit())
                            .build()))
                    .build();
            try {
                if (delta > 0) {
                    inventoryServiceClient.deductForOrder(deltaPayload);
                } else {
                    inventoryServiceClient.restoreForBooking(deltaPayload);
                }
            } catch (Exception e) {
                throw new MessageException("Không thể điều chỉnh kho: " + extractErrorMessage(e));
            }
        }

        item.setQuantity(newQty);
        item.setItemTotal(item.getProductPrice() * newQty);
        orderItemRepository.save(item);

        order.setTotalAmount(recalcTotal(order));
        orderRepository.save(order);

        return buildOrderResponse(order);
    }

    @Transactional
    public OrderResponse removeItem(Long orderId, Long itemId) throws MessageException {
        Order order = orderRepository.findByIdWithItemsAndTable(orderId)
                .orElseThrow(() -> new MessageException("Không tìm thấy đơn hàng với id: " + orderId));

        if (order.getStatus() != OrderStatus.OPEN) {
            throw new MessageException("Chỉ có thể xóa món khi đơn hàng đang ở trạng thái OPEN");
        }

        OrderItem item = order.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new MessageException("Không tìm thấy món với id: " + itemId));

        // Luôn hoàn kho khi xóa món — trừ kho đã xảy ra ngay lúc thêm
        try {
            inventoryServiceClient.restoreForBooking(OrderDeductionPayload.builder()
                    .orderId(order.getId().toString())
                    .items(List.of(OrderDeductionPayload.OrderItem.builder()
                            .productId(item.getProductId())
                            .quantity(item.getQuantity())
                            .saleUnit(item.getSaleUnit())
                            .build()))
                    .build());
        } catch (Exception e) {
            log.warn("Không thể hoàn kho khi xóa món {}: {}", item.getProductId(), e.getMessage());
        }

        order.getItems().remove(item);
        orderItemRepository.delete(item);

        order.setTotalAmount(recalcTotal(order));
        orderRepository.save(order);

        return buildOrderResponse(order);
    }

    @Transactional
    public OrderResponse checkout(Long orderId, String paidBy) throws MessageException {
        Order order = orderRepository.findByIdWithItemsAndTable(orderId)
                .orElseThrow(() -> new MessageException("Không tìm thấy đơn hàng với id: " + orderId));

        if (order.getStatus() == OrderStatus.PAID || order.getStatus() == OrderStatus.CANCELLED) {
            throw new MessageException("Đơn hàng đã hoàn thành hoặc đã huỷ");
        }

        if (order.getItems().isEmpty()) {
            throw new MessageException("Đơn hàng không có món nào");
        }

        order.setStatus(OrderStatus.PAID);
        order.setPaidBy(paidBy);

        DiningTable table = order.getDiningTable();
        if (table != null) {
            table.setStatus(TableStatus.AVAILABLE);
            table.setQrToken(UUID.randomUUID().toString());
            tableRepository.save(table);
        }

        orderRepository.save(order);

        return buildOrderResponse(order);
    }

    @Transactional
    public OrderResponse cancelOrder(Long orderId, String reason) throws MessageException {
        Order order = orderRepository.findByIdWithItemsAndTable(orderId)
                .orElseThrow(() -> new MessageException("Không tìm thấy đơn hàng với id: " + orderId));

        if (order.getStatus() == OrderStatus.PAID || order.getStatus() == OrderStatus.CANCELLED) {
            throw new MessageException("Chỉ có thể hủy đơn hàng đang ở trạng thái OPEN");
        }

        boolean hasBookingItems = order.getItems().stream().anyMatch(i -> i.isFromBooking());
        if (hasBookingItems) {
            throw new MessageException("Không thể hủy đơn hàng chuyển từ đặt bàn");
        }

        // Hoàn kho tất cả items — kho đã trừ ngay khi thêm
        List<OrderDeductionPayload.OrderItem> restoreItems = order.getItems().stream()
                .map(i -> OrderDeductionPayload.OrderItem.builder()
                        .productId(i.getProductId())
                        .quantity(i.getQuantity())
                        .saleUnit(i.getSaleUnit())
                        .build())
                .collect(Collectors.toList());

        if (!restoreItems.isEmpty()) {
            OrderDeductionPayload restorePayload = OrderDeductionPayload.builder()
                    .orderId(order.getId().toString())
                    .items(restoreItems)
                    .build();
            try {
                inventoryServiceClient.restoreForBooking(restorePayload);
            } catch (Exception e) {
                log.warn("Không thể hoàn kho khi hủy đơn {}: {}", orderId, e.getMessage());
            }
        }

        DiningTable table = order.getDiningTable();
        if (table != null) {
            table.setStatus(TableStatus.AVAILABLE);
            table.setQrToken(UUID.randomUUID().toString());
            tableRepository.save(table);
        }

        if (order.getItems().isEmpty()) {
            order.getSurcharges().size(); // force-init trước khi physicalDeleteById clear session
            orderRepository.physicalDeleteById(order.getId());
            order.setStatus(OrderStatus.CANCELLED);
            return buildOrderResponse(order);
        }

        order.setStatus(OrderStatus.CANCELLED);
        if (reason != null && !reason.isBlank()) {
            order.setCancelReason(reason);
        }
        orderRepository.save(order);
        return buildOrderResponse(order);
    }

    @Transactional(readOnly = true)
    public OrderResponse getById(Long orderId) throws MessageException {
        Order order = orderRepository.findByIdWithItemsAndTable(orderId)
                .orElseThrow(() -> new MessageException("Không tìm thấy đơn hàng với id: " + orderId));
        return buildOrderResponse(order);
    }

    @Transactional(readOnly = true)
    public Object getCurrentOrderByQrToken(String qrToken) throws MessageException {
        DiningTable table = tableRepository.findByQrToken(qrToken)
                .orElseThrow(() -> new MessageException("Mã QR không hợp lệ"));

        return orderRepository
                .findByDiningTableAndStatusIn(table, List.of(OrderStatus.OPEN))
                .map(order -> (Object) buildOrderResponse(order))
                .orElse(Map.of("message", "Bàn " + table.getName() + " chưa có đơn hàng đang mở"));
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> getAll(int page, int size, Long tableId, OrderStatus status) throws MessageException {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        if (tableId != null && status != null) {
            DiningTable table = tableRepository.findById(tableId)
                    .orElseThrow(() -> new MessageException("Không tìm thấy bàn với id: " + tableId));
            return orderRepository.findByDiningTableAndStatus(table, status, pageable)
                    .map(this::buildOrderResponse);
        }

        if (tableId != null) {
            DiningTable table = tableRepository.findById(tableId)
                    .orElseThrow(() -> new MessageException("Không tìm thấy bàn với id: " + tableId));
            return orderRepository.findByDiningTable(table, pageable)
                    .map(this::buildOrderResponse);
        }

        if (status != null) {
            return orderRepository.findByStatus(status, pageable)
                    .map(this::buildOrderResponse);
        }

        return orderRepository.findAll(pageable).map(this::buildOrderResponse);
    }

    @Transactional
    public OrderResponse addSurcharge(Long orderId, AddSurchargeRequest req) throws MessageException {
        Order order = orderRepository.findByIdWithItemsAndTable(orderId)
                .orElseThrow(() -> new MessageException("Không tìm thấy đơn hàng với id: " + orderId));

        if (order.getStatus() != OrderStatus.OPEN) {
            throw new MessageException("Chỉ có thể thêm phụ thu khi đơn hàng đang ở trạng thái OPEN");
        }

        OrderSurcharge surcharge = OrderSurcharge.builder()
                .order(order)
                .name(req.getName().trim())
                .unitPrice(req.getUnitPrice())
                .quantity(req.getQuantity())
                .amount(req.getUnitPrice() * req.getQuantity())
                .reason(req.getReason() != null ? req.getReason().trim() : null)
                .build();

        surchargeRepository.save(surcharge);
        order.getSurcharges().add(surcharge);
        order.setTotalAmount(recalcTotal(order));
        orderRepository.save(order);

        return buildOrderResponse(order);
    }

    @Transactional
    public OrderResponse removeSurcharge(Long orderId, Long surchargeId) throws MessageException {
        Order order = orderRepository.findByIdWithItemsAndTable(orderId)
                .orElseThrow(() -> new MessageException("Không tìm thấy đơn hàng với id: " + orderId));

        if (order.getStatus() != OrderStatus.OPEN) {
            throw new MessageException("Chỉ có thể xóa phụ thu khi đơn hàng đang ở trạng thái OPEN");
        }

        OrderSurcharge surcharge = surchargeRepository.findById(surchargeId)
                .orElseThrow(() -> new MessageException("Không tìm thấy phụ thu với id: " + surchargeId));

        order.getSurcharges().remove(surcharge);
        surchargeRepository.delete(surcharge);
        order.setTotalAmount(recalcTotal(order));
        orderRepository.save(order);

        return buildOrderResponse(order);
    }

    private double recalcTotal(Order order) {
        double itemsTotal = order.getItems().stream().mapToDouble(OrderItem::getItemTotal).sum();
        double surchargesTotal = order.getSurcharges().stream().mapToDouble(OrderSurcharge::getAmount).sum();
        return itemsTotal + surchargesTotal;
    }

    private OrderResponse buildOrderResponse(Order order) {
        return OrderResponse.from(order);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractData(Map<String, Object> response) throws MessageException {
        Object data = response.get("data");
        if (data instanceof Map) {
            return (Map<String, Object>) data;
        }
        throw new MessageException("Không lấy được thông tin sản phẩm");
    }

    private Double parseDouble(Object value) throws MessageException {
        if (value == null) throw new MessageException("Không lấy được giá sản phẩm từ product-service");
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            throw new MessageException("Giá sản phẩm không hợp lệ: " + value);
        }
    }

    private String extractFeignErrorMessage(FeignException e) {
        try {
            String body = e.contentUTF8();
            Map<?, ?> map = objectMapper.readValue(body, Map.class);
            Object msg = map.get("message");
            return msg != null ? msg.toString() : e.getMessage();
        } catch (Exception ex) {
            return e.getMessage();
        }
    }

    private String extractErrorMessage(Exception e) {
        if (e instanceof FeignException fe) return extractFeignErrorMessage(fe);
        return e.getMessage() != null ? e.getMessage() : "Lỗi không xác định";
    }

    @Transactional(readOnly = true)
    public OrderStatsResponse getStats(LocalDate dateParam) {
        ZoneId vn = ZoneId.of("Asia/Ho_Chi_Minh");
        Instant now = Instant.now();
        LocalDate date = dateParam != null ? dateParam : LocalDate.now(vn);
        boolean isToday = date.equals(LocalDate.now(vn));

        Instant dayStart = date.atStartOfDay(vn).toInstant();
        Instant dayEnd   = isToday ? now : date.plusDays(1).atStartOfDay(vn).toInstant();

        long open = 0, paid = 0, cancelled = 0;
        for (Object[] row : orderRepository.countByStatusBetween(dayStart, dayEnd)) {
            OrderStatus s = (OrderStatus) row[0];
            long count = ((Number) row[1]).longValue();
            switch (s) {
                case OPEN      -> open      = count;
                case PAID      -> paid      = count;
                case CANCELLED -> cancelled = count;
            }
        }

        long occupiedTables = isToday ? orderRepository.countOccupiedTables(List.of(OrderStatus.OPEN)) : 0L;

        List<TopProductItem> topProducts = orderItemRepository
                .findTopProducts(dayStart, dayEnd, PageRequest.of(0, 5))
                .stream()
                .map(row -> TopProductItem.builder()
                        .productName((String) row[0])
                        .quantity(((Number) row[1]).longValue())
                        .build())
                .toList();

        return OrderStatsResponse.builder()
                .open(open).paid(paid).cancelled(cancelled)
                .occupiedTables(occupiedTables)
                .topProducts(topProducts)
                .build();
    }

}
