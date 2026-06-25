package com.example.orderservice.service;

import com.example.orderservice.client.InventoryServiceClient;
import com.example.orderservice.client.ProductServiceClient;
import com.example.orderservice.client.dto.OrderDeductionPayload;
import com.example.orderservice.entity.DiningTable;
import com.example.orderservice.entity.Order;
import com.example.orderservice.entity.OrderItem;
import com.example.orderservice.entity.DTO.req.AddOrderItemRequest;
import com.example.orderservice.entity.DTO.req.CreateOrderRequest;
import com.example.orderservice.entity.DTO.res.OrderResponse;
import com.example.orderservice.entity.DTO.res.OrderStatsResponse;
import com.example.orderservice.entity.DTO.res.TopProductItem;
import com.example.orderservice.entity.enums.OrderStatus;
import com.example.orderservice.entity.enums.TableStatus;
import com.example.orderservice.repository.DiningTableRepository;
import com.example.orderservice.repository.OrderItemRepository;
import com.example.orderservice.repository.OrderRepository;
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
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
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
                .build();
        order.setCreatedBy(createdBy);

        table.setStatus(TableStatus.OCCUPIED);
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
        double itemTotal = productPrice * req.getQuantity();

        OrderItem item = OrderItem.builder()
                .order(order)
                .productId(req.getProductId())
                .productName(productName)
                .productPrice(productPrice)
                .quantity(req.getQuantity())
                .saleUnit(req.getSaleUnit())
                .itemTotal(itemTotal)
                .build();

        item.setDeductScheduledAt(Instant.now().plus(3, ChronoUnit.MINUTES));
        orderItemRepository.save(item);
        order.getItems().add(item);

        double newTotal = order.getItems().stream()
                .mapToDouble(OrderItem::getItemTotal).sum();
        order.setTotalAmount(newTotal);
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

        // Chỉ hoàn kho nếu đã trừ; nếu còn trong 3 phút chờ thì xóa thẳng
        if (item.isInventoryDeducted()) {
            OrderDeductionPayload restorePayload = OrderDeductionPayload.builder()
                    .orderId(order.getId().toString())
                    .items(List.of(OrderDeductionPayload.OrderItem.builder()
                            .productId(item.getProductId())
                            .quantity(item.getQuantity())
                            .saleUnit(item.getSaleUnit())
                            .build()))
                    .build();
            try {
                inventoryServiceClient.restoreForBooking(restorePayload);
            } catch (Exception e) {
                log.warn("Không thể hoàn kho khi xóa món {}: {}", item.getProductId(), e.getMessage());
            }
        }

        order.getItems().remove(item);
        orderItemRepository.delete(item);

        double newTotal = order.getItems().stream()
                .mapToDouble(OrderItem::getItemTotal).sum();
        order.setTotalAmount(newTotal);
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

        // Force-deduct các món còn trong window 3 phút chưa kịp trừ kho
        List<OrderItem> notYetDeducted = order.getItems().stream()
                .filter(i -> !i.isInventoryDeducted() && i.getDeductScheduledAt() != null)
                .toList();
        if (!notYetDeducted.isEmpty()) {
            List<OrderDeductionPayload.OrderItem> deductItems = notYetDeducted.stream()
                    .map(i -> OrderDeductionPayload.OrderItem.builder()
                            .productId(i.getProductId())
                            .quantity(i.getQuantity())
                            .saleUnit(i.getSaleUnit())
                            .build())
                    .toList();
            try {
                inventoryServiceClient.deductForOrder(OrderDeductionPayload.builder()
                        .orderId(orderId.toString())
                        .items(deductItems)
                        .build());
                notYetDeducted.forEach(i -> i.setInventoryDeducted(true));
                orderItemRepository.saveAll(notYetDeducted);
            } catch (Exception e) {
                throw new MessageException("Lỗi trừ kho khi thanh toán: " + extractErrorMessage(e));
            }
        }

        order.setStatus(OrderStatus.PAID);
        order.setPaidBy(paidBy);

        DiningTable table = order.getDiningTable();
        table.setStatus(TableStatus.AVAILABLE);
        tableRepository.save(table);

        orderRepository.save(order);

        return buildOrderResponse(order);
    }

    @Transactional
    public OrderResponse cancelOrder(Long orderId) throws MessageException {
        Order order = orderRepository.findByIdWithItemsAndTable(orderId)
                .orElseThrow(() -> new MessageException("Không tìm thấy đơn hàng với id: " + orderId));

        if (order.getStatus() != OrderStatus.OPEN) {
            throw new MessageException("Chỉ có thể hủy đơn hàng đang ở trạng thái OPEN");
        }

        // Chỉ hoàn kho những món đã thực sự bị trừ
        List<OrderDeductionPayload.OrderItem> restoreItems = order.getItems().stream()
                .filter(OrderItem::isInventoryDeducted)
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

        order.setStatus(OrderStatus.CANCELLED);

        DiningTable table = order.getDiningTable();
        table.setStatus(TableStatus.AVAILABLE);
        tableRepository.save(table);

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
    public OrderStatsResponse getStats() {
        ZoneId vn = ZoneId.of("Asia/Ho_Chi_Minh");
        Instant now = Instant.now();
        Instant todayStart = LocalDate.now(vn).atStartOfDay(vn).toInstant();
        Instant monthStart = LocalDate.now(vn).withDayOfMonth(1).atStartOfDay(vn).toInstant();

        // Count by status for today
        long open = 0, paid = 0, cancelled = 0;
        for (Object[] row : orderRepository.countByStatusBetween(todayStart, now)) {
            OrderStatus s = (OrderStatus) row[0];
            long count = ((Number) row[1]).longValue();
            switch (s) {
                case OPEN      -> open      = count;
                case PAID      -> paid      = count;
                case CANCELLED -> cancelled = count;
            }
        }

        long occupiedTables = orderRepository.countOccupiedTables(List.of(OrderStatus.OPEN));

        List<TopProductItem> topProducts = orderItemRepository
                .findTopProducts(monthStart, now, PageRequest.of(0, 5))
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
