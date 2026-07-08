package com.example.orderservice.service;

import com.example.orderservice.bot.BookingAdminBot;
import com.example.orderservice.client.InventoryServiceClient;
import com.example.orderservice.client.ProductServiceClient;
import com.example.orderservice.client.dto.OrderDeductionPayload;
import com.example.orderservice.entity.Booking;
import com.example.orderservice.entity.BookingItem;
import com.example.orderservice.entity.DiningTable;
import com.example.orderservice.entity.Order;
import com.example.orderservice.entity.OrderItem;
import com.example.orderservice.entity.DTO.req.CreateBookingRequest;
import com.example.orderservice.entity.DTO.res.BookingResponse;
import com.example.orderservice.entity.DTO.res.BookingStatsResponse;
import com.example.orderservice.entity.DTO.res.OrderResponse;
import com.example.orderservice.entity.DTO.res.PaymentInfoResponse;
import com.example.orderservice.entity.enums.BookingPaymentMethod;
import com.example.orderservice.entity.enums.BookingStatus;
import com.example.orderservice.entity.enums.OrderStatus;
import com.example.orderservice.entity.enums.TableStatus;
import com.example.orderservice.repository.BookingItemRepository;
import com.example.orderservice.repository.BookingRepository;
import com.example.orderservice.repository.DiningTableRepository;
import com.example.orderservice.repository.OrderItemRepository;
import com.example.orderservice.repository.OrderRepository;
import com.example.restaurant_common.util.exception.MessageException;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.util.concurrent.CompletableFuture;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final BookingRepository bookingRepository;
    private final BookingItemRepository bookingItemRepository;
    private final DiningTableRepository tableRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductServiceClient productServiceClient;
    private final InventoryServiceClient inventoryServiceClient;
    private final ObjectMapper objectMapper;
    private final BookingAdminBot bookingAdminBot;

    @Value("${app.payment.bank-id:VCB}")
    private String bankId;

    @Value("${app.payment.account-number:0000000000}")
    private String accountNumber;

    @Value("${app.payment.account-holder:CHUA CAU HINH}")
    private String accountHolder;

    @Value("${app.payment.bank-name:Vietcombank}")
    private String bankName;

    @Transactional
    public BookingResponse createBooking(CreateBookingRequest req) throws MessageException {
        return createBooking(req, null);
    }

    @Transactional
    public BookingResponse createBooking(CreateBookingRequest req, String ownerUsername) throws MessageException {
        validateScheduledTime(req.getScheduledTime());

        DiningTable table = null;
        if (req.getTableId() != null) {
            table = tableRepository.findById(req.getTableId())
                    .orElseThrow(() -> new MessageException("Không tìm thấy bàn với id: " + req.getTableId()));
            checkTableConflict(req.getTableId(), req.getScheduledTime());
        }

        List<BookingItem> items = buildItems(req);
        double total = items.stream().mapToDouble(BookingItem::getItemTotal).sum();

        if (total <= 0) {
            throw new MessageException("Vui lòng chọn ít nhất một món để đặt bàn");
        }

        String code = generateBookingCode();

        // Cả CASH và BANK_TRANSFER đều bắt đầu PENDING_PAYMENT — admin xác nhận thủ công
        Booking booking = Booking.builder()
                .bookingCode(code)
                .customerName(req.getCustomerName())
                .customerPhone(req.getCustomerPhone())
                .customerBankAccount(req.getCustomerBankAccount())
                .diningTable(table)
                .scheduledTime(req.getScheduledTime())
                .totalAmount(total)
                .note(req.getNote())
                .guestCount(req.getGuestCount())
                .paymentMethod(req.getPaymentMethod())
                .status(BookingStatus.PENDING_PAYMENT)
                .ownerUsername(ownerUsername)
                .build();

        booking = bookingRepository.save(booking);

        for (BookingItem item : items) {
            item.setBooking(booking);
        }
        bookingItemRepository.saveAll(items);
        booking.setItems(items);

        // Notify admin qua Telegram (async, không block response)
        final Booking savedBooking = booking;
        CompletableFuture.runAsync(() -> {
            try { bookingAdminBot.notifyNewBooking(savedBooking); }
            catch (Exception e) { log.warn("[createBooking] Telegram notify thất bại: {}", e.getMessage()); }
        });

        boolean isCash = req.getPaymentMethod() == BookingPaymentMethod.CASH;
        PaymentInfoResponse paymentInfo = isCash ? null : buildPaymentInfo(code, total);
        return BookingResponse.fromWithPayment(booking, paymentInfo);
    }

    @Transactional
    public BookingResponse confirmBooking(Long id, String confirmedBy) throws MessageException {
        Booking booking = findWithItems(id);

        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            throw new MessageException("Chỉ có thể xác nhận booking ở trạng thái PENDING_PAYMENT");
        }

        List<OrderDeductionPayload.OrderItem> deductionItems = booking.getItems().stream()
                .map(item -> OrderDeductionPayload.OrderItem.builder()
                        .productId(item.getProductId())
                        .quantity(item.getQuantity())
                        .saleUnit(item.getSaleUnit())
                        .build())
                .collect(Collectors.toList());

        OrderDeductionPayload payload = OrderDeductionPayload.builder()
                .orderId(booking.getBookingCode())
                .items(deductionItems)
                .build();

        try {
            inventoryServiceClient.deductForOrder(payload);
        } catch (Exception e) {
            throw new MessageException("Lỗi trừ kho: " + extractErrorMessage(e));
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentMethod(BookingPaymentMethod.BANK_TRANSFER);
        booking.setPaidAmount(booking.getTotalAmount()); // ghi nhận số tiền đã nhận
        booking.setCreatedBy(confirmedBy);
        bookingRepository.save(booking);

        bookingAdminBot.notifyConfirmed(booking, confirmedBy);
        return BookingResponse.from(booking);
    }

    @Transactional
    public BookingResponse confirmCashBooking(Long id, String confirmedBy) throws MessageException {
        Booking booking = findWithItems(id);

        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            throw new MessageException("Chỉ có thể xác nhận booking ở trạng thái PENDING_PAYMENT");
        }

        List<OrderDeductionPayload.OrderItem> deductionItems = booking.getItems().stream()
                .map(item -> OrderDeductionPayload.OrderItem.builder()
                        .productId(item.getProductId())
                        .quantity(item.getQuantity())
                        .saleUnit(item.getSaleUnit())
                        .build())
                .collect(Collectors.toList());

        String stockWarning = null;
        try {
            inventoryServiceClient.deductForOrder(OrderDeductionPayload.builder()
                    .orderId(booking.getBookingCode())
                    .items(deductionItems)
                    .build());
        } catch (Exception e) {
            // CASH booking: cảnh báo nhưng vẫn confirm (khách chưa thanh toán, admin quyết định)
            stockWarning = "Cảnh báo kho: " + extractErrorMessage(e);
            log.warn("[confirmCashBooking] Trừ kho thất bại cho booking {}: {}", booking.getBookingCode(), stockWarning);
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentMethod(BookingPaymentMethod.CASH);
        booking.setPaidAmount(0.0); // CASH = chưa trả tiền trước
        booking.setCreatedBy(confirmedBy);
        if (stockWarning != null) booking.setStockWarning(stockWarning);
        bookingRepository.save(booking);

        bookingAdminBot.notifyConfirmed(booking, confirmedBy);
        return BookingResponse.from(booking);
    }

    @Transactional
    public BookingResponse completeBooking(Long id) throws MessageException {
        Booking booking = findById(id);

        if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.CHECKED_IN) {
            throw new MessageException("Chỉ có thể hoàn thành booking ở trạng thái CONFIRMED hoặc CHECKED_IN");
        }

        booking.setStatus(BookingStatus.COMPLETED);
        bookingRepository.save(booking);
        return BookingResponse.from(booking);
    }

    @Transactional
    public BookingResponse cancelBooking(Long id, String cancelledBy, String cancelReason) throws MessageException {
        Booking booking = findWithItems(id);

        if (booking.getStatus() == BookingStatus.COMPLETED
                || booking.getStatus() == BookingStatus.CANCELLED
                || booking.getStatus() == BookingStatus.EXPIRED) {
            throw new MessageException("Không thể hủy booking ở trạng thái: " + booking.getStatus());
        }

        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            List<OrderDeductionPayload.OrderItem> restoreItems = booking.getItems().stream()
                    .map(item -> OrderDeductionPayload.OrderItem.builder()
                            .productId(item.getProductId())
                            .quantity(item.getQuantity())
                            .saleUnit(item.getSaleUnit())
                            .build())
                    .collect(Collectors.toList());

            OrderDeductionPayload payload = OrderDeductionPayload.builder()
                    .orderId(booking.getBookingCode())
                    .items(restoreItems)
                    .build();

            try {
                inventoryServiceClient.restoreForBooking(payload);
            } catch (Exception e) {
                log.warn("Không thể hoàn kho khi hủy booking {}: {}", booking.getBookingCode(), e.getMessage());
            }
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledBy(cancelledBy);
        booking.setCancelReason(cancelReason);
        bookingRepository.save(booking);
        return BookingResponse.from(booking);
    }

    @Transactional
    public BookingResponse removeBookingItem(Long bookingId, Long itemId) throws MessageException {
        Booking booking = findWithItems(bookingId);

        if (booking.getStatus() == BookingStatus.COMPLETED
                || booking.getStatus() == BookingStatus.CANCELLED
                || booking.getStatus() == BookingStatus.EXPIRED
                || booking.getStatus() == BookingStatus.CHECKED_IN) {
            throw new MessageException("Không thể xóa món ở trạng thái: " + booking.getStatus());
        }

        BookingItem item = booking.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new MessageException("Không tìm thấy món với id: " + itemId));

        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            OrderDeductionPayload restorePayload = OrderDeductionPayload.builder()
                    .orderId(booking.getBookingCode())
                    .items(List.of(OrderDeductionPayload.OrderItem.builder()
                            .productId(item.getProductId())
                            .quantity(item.getQuantity())
                            .saleUnit(item.getSaleUnit())
                            .build()))
                    .build();
            try {
                inventoryServiceClient.restoreForBooking(restorePayload);
            } catch (Exception e) {
                log.warn("Không thể hoàn kho khi xóa món {} khỏi booking {}: {}", item.getProductName(), booking.getBookingCode(), e.getMessage());
            }
        }

        booking.getItems().remove(item);
        bookingItemRepository.delete(item);

        double newTotal = booking.getItems().stream().mapToDouble(BookingItem::getItemTotal).sum();
        booking.setTotalAmount(newTotal);
        bookingRepository.save(booking);

        return BookingResponse.from(booking);
    }

    @Transactional
    public BookingResponse updateBookingItemQty(Long bookingId, Long itemId, int newQty) throws MessageException {
        Booking booking = findWithItems(bookingId);

        if (booking.getStatus() == BookingStatus.COMPLETED
                || booking.getStatus() == BookingStatus.CANCELLED
                || booking.getStatus() == BookingStatus.EXPIRED
                || booking.getStatus() == BookingStatus.CHECKED_IN) {
            throw new MessageException("Không thể chỉnh sửa món ở trạng thái: " + booking.getStatus());
        }

        BookingItem item = booking.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new MessageException("Không tìm thấy món với id: " + itemId));

        int oldQty = item.getQuantity();
        int delta = newQty - oldQty;

        if (delta != 0 && booking.getStatus() == BookingStatus.CONFIRMED) {
            OrderDeductionPayload.OrderItem deltaItem = OrderDeductionPayload.OrderItem.builder()
                    .productId(item.getProductId())
                    .quantity(Math.abs(delta))
                    .saleUnit(item.getSaleUnit())
                    .build();
            OrderDeductionPayload payload = OrderDeductionPayload.builder()
                    .orderId(booking.getBookingCode())
                    .items(List.of(deltaItem))
                    .build();
            try {
                if (delta > 0) {
                    inventoryServiceClient.deductForOrder(payload);
                } else {
                    inventoryServiceClient.restoreForBooking(payload);
                }
            } catch (Exception e) {
                throw new MessageException("Lỗi cập nhật kho: " + extractErrorMessage(e));
            }
        }

        item.setQuantity(newQty);
        item.setItemTotal(item.getProductPrice() * newQty);
        bookingItemRepository.save(item);

        double newTotal = booking.getItems().stream().mapToDouble(BookingItem::getItemTotal).sum();
        booking.setTotalAmount(newTotal);
        bookingRepository.save(booking);

        return BookingResponse.from(booking);
    }

    @Transactional(readOnly = true)
    public BookingResponse getByCode(String bookingCode) throws MessageException {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new MessageException("Không tìm thấy booking với mã: " + bookingCode));
        return BookingResponse.from(booking);
    }

    @Transactional(readOnly = true)
    public BookingResponse getById(Long id) throws MessageException {
        return BookingResponse.from(findWithItems(id));
    }

    @Transactional(readOnly = true)
    public Page<BookingResponse> getAll(int page, int size, BookingStatus status,
                                        Instant from, Instant to, boolean excludePending) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        if (status != null && from != null && to != null) {
            return bookingRepository.findByStatusAndScheduledTimeBetween(status, from, to, pageable).map(BookingResponse::from);
        }
        if (from != null && to != null) {
            return bookingRepository.findByScheduledTimeBetween(from, to, pageable).map(BookingResponse::from);
        }
        if (status != null) {
            return bookingRepository.findByStatus(status, pageable).map(BookingResponse::from);
        }
        if (excludePending) {
            return bookingRepository.findByStatusNotIn(
                    List.of(BookingStatus.PENDING_PAYMENT, BookingStatus.EXPIRED), pageable)
                    .map(BookingResponse::from);
        }
        return bookingRepository.findAll(pageable).map(BookingResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<BookingResponse> getBookingsByPhone(String phone, int page, int size) {
        return bookingRepository.findByCustomerPhoneOrderByCreatedAtDesc(
                phone, PageRequest.of(page, size))
                .map(BookingResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<BookingResponse> getMyBookings(String username, int page, int size) {
        return bookingRepository.findByOwnerUsernameOrderByCreatedAtDesc(
                username, PageRequest.of(page, size))
                .map(BookingResponse::from);
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    @Transactional
    public void autoExpireUnpaidBookings() {
        try {
            Instant cutoff = Instant.now().minus(30, ChronoUnit.MINUTES);
            int expired = bookingRepository.expireUnpaidBookings(cutoff);
            if (expired > 0) {
                log.info("Auto-expired {} unpaid booking(s)", expired);
            }
        } catch (Exception e) {
            log.error("[Scheduler] Lỗi auto-expire bookings: {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelay = 900_000, initialDelay = 60_000)
    @Transactional
    public void logUpcomingBookings() {
        try {
            Instant now = Instant.now();
            Instant soon = now.plus(60, ChronoUnit.MINUTES);
            List<Booking> upcoming = bookingRepository.findUpcoming(now, soon);
            List<Booking> toUpdate = new ArrayList<>();
            for (Booking b : upcoming) {
                log.info("[REMINDER] Booking {} - {} sắp đến lúc {}", b.getBookingCode(), b.getCustomerName(), b.getScheduledTime());
                bookingAdminBot.notifyReminder(b);
                b.setReminderSent(true);
                toUpdate.add(b);
            }
            if (!toUpdate.isEmpty()) bookingRepository.saveAll(toUpdate);
        } catch (Exception e) {
            log.error("[Scheduler] Lỗi logUpcomingBookings: {}", e.getMessage());
        }
    }

    @Transactional
    public OrderResponse checkoutToOrder(Long bookingId, Long overrideTableId, String createdBy) throws MessageException {
        Booking booking = findWithItems(bookingId);

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new MessageException("Chỉ có thể chuyển booking ở trạng thái CONFIRMED thành đơn hàng");
        }

        // Ưu tiên bàn staff chọn lúc check-in, nếu không dùng bàn đã đặt trước
        DiningTable table = null;
        if (overrideTableId != null) {
            table = tableRepository.findById(overrideTableId)
                    .orElseThrow(() -> new MessageException("Không tìm thấy bàn với id: " + overrideTableId));
        } else if (booking.getDiningTable() != null) {
            table = booking.getDiningTable();
        }
        // table == null → order không gắn bàn, staff assign bàn sau

        String note = "Từ booking " + booking.getBookingCode()
                + (booking.getNote() != null ? " - " + booking.getNote() : "");

        boolean isCash = BookingPaymentMethod.CASH.equals(booking.getPaymentMethod());
        // totalAmount = tổng món hiện tại (có thể admin đã giảm sau khi confirm)
        // prepaidAmount = số tiền THỰC SỰ đã nhận (paidAmount, không đổi dù xóa món)
        double paid = booking.getPaidAmount() != null ? booking.getPaidAmount() : 0.0;
        Order order = Order.builder()
                .diningTable(table)
                .totalAmount(booking.getTotalAmount())
                .prepaidAmount(isCash ? 0.0 : paid)
                .note(note)
                .guestCount(booking.getGuestCount())
                .build();
        order.setCreatedBy(createdBy);
        order = orderRepository.save(order);

        final Order savedOrder = order;
        // inventoryDeducted=true: kho đã trừ khi admin confirm booking
        // deductScheduledAt=null: không cho scheduler đụng vào
        List<OrderItem> orderItems = booking.getItems().stream()
                .map(bi -> OrderItem.builder()
                        .order(savedOrder)
                        .productId(bi.getProductId())
                        .productName(bi.getProductName())
                        .productPrice(bi.getProductPrice())
                        .quantity(bi.getQuantity())
                        .saleUnit(bi.getSaleUnit())
                        .itemTotal(bi.getItemTotal())
                        .fromBooking(true)
                        .inventoryDeducted(true)
                        .build())
                .collect(Collectors.toList());
        orderItemRepository.saveAll(orderItems);
        order.setItems(orderItems);

        // Luôn để OPEN — nhân viên thêm món khách gọi thêm hoặc xử lý hoàn tiền rồi checkout
        if (table != null) {
            table.setStatus(TableStatus.OCCUPIED);
            tableRepository.save(table);
        }
        booking.setStatus(BookingStatus.CHECKED_IN);
        bookingRepository.save(booking);

        return OrderResponse.from(order);
    }

    @Transactional
    public void confirmBookingByCode(String bookingCode) throws MessageException {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new MessageException("Không tìm thấy booking: " + bookingCode));

        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            log.info("[Sepay] Booking {} đã ở trạng thái {}, bỏ qua", bookingCode, booking.getStatus());
            return;
        }

        List<OrderDeductionPayload.OrderItem> deductionItems = booking.getItems().stream()
                .map(item -> OrderDeductionPayload.OrderItem.builder()
                        .productId(item.getProductId())
                        .quantity(item.getQuantity())
                        .saleUnit(item.getSaleUnit())
                        .build())
                .collect(Collectors.toList());

        OrderDeductionPayload payload = OrderDeductionPayload.builder()
                .orderId(booking.getBookingCode())
                .items(deductionItems)
                .build();

        try {
            inventoryServiceClient.deductForOrder(payload);
        } catch (Exception e) {
            log.warn("[Sepay] Trừ kho booking {} thất bại: {}", bookingCode, e.getMessage());
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentMethod(BookingPaymentMethod.BANK_TRANSFER);
        booking.setPaidAmount(booking.getTotalAmount()); // ghi nhận số tiền đã nhận qua Sepay
        booking.setCreatedBy("BANK_TRANSFER");
        bookingRepository.save(booking);

        bookingAdminBot.notifyAutoConfirmed(booking);
        log.info("[Sepay] Booking {} đã được xác nhận tự động qua chuyển khoản", bookingCode);
    }

    @Transactional
    public BookingResponse customerCancelBooking(String bookingCode, String customerPhone, String cancelReason) throws MessageException {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new MessageException("Không tìm thấy booking với mã: " + bookingCode));

        if (!booking.getCustomerPhone().equals(customerPhone)) {
            throw new MessageException("Số điện thoại không khớp với booking này.");
        }
        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            throw new MessageException("Booking đã được xác nhận. Vui lòng liên hệ nhà hàng qua điện thoại để hủy.");
        }
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            throw new MessageException("Không thể hủy booking ở trạng thái: " + booking.getStatus());
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledBy("customer");
        booking.setCancelReason(cancelReason != null ? cancelReason : "Khách tự hủy");
        bookingRepository.save(booking);
        return BookingResponse.from(booking);
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private void validateScheduledTime(Instant scheduledTime) throws MessageException {
        if (scheduledTime.isBefore(Instant.now().plus(1, ChronoUnit.HOURS))) {
            throw new MessageException("Vui lòng đặt bàn trước giờ đến dự kiến ít nhất 1 giờ");
        }
        ZonedDateTime zdt = scheduledTime.atZone(VN_ZONE);
        int hour = zdt.getHour();
        if (hour < 8 || hour >= 22) {
            throw new MessageException("Quán chỉ phục vụ từ 08:00 đến 22:00");
        }
    }

    private void checkTableConflict(Long tableId, Instant scheduledTime) throws MessageException {
        Instant from = scheduledTime.minus(2, ChronoUnit.HOURS);
        Instant to = scheduledTime.plus(2, ChronoUnit.HOURS);
        List<Booking> conflicts = bookingRepository.findConflictingBookings(tableId, from, to);
        if (!conflicts.isEmpty()) {
            throw new MessageException("Bàn đã được đặt trong khung giờ này. Vui lòng chọn bàn khác hoặc giờ khác");
        }
    }

    @SuppressWarnings("unchecked")
    private List<BookingItem> buildItems(CreateBookingRequest req) throws MessageException {
        if (req.getItems() == null || req.getItems().isEmpty()) return new ArrayList<>();
        return buildItemsFromList(req.getItems());
    }

    private List<BookingItem> buildItemsFromList(List<com.example.orderservice.entity.DTO.req.CreateBookingItemRequest> itemReqs) throws MessageException {
        List<BookingItem> items = new ArrayList<>();
        if (itemReqs == null || itemReqs.isEmpty()) return items;
        for (var itemReq : itemReqs) {
            Map<String, Object> productResponse;
            try {
                productResponse = productServiceClient.getProduct(itemReq.getProductId());
            } catch (Exception e) {
                throw new MessageException(extractErrorMessage(e));
            }
            Object data = productResponse.get("data");
            if (!(data instanceof Map)) {
                throw new MessageException("Không lấy được thông tin sản phẩm id: " + itemReq.getProductId());
            }
            Map<String, Object> productData = (Map<String, Object>) data;

            if (!"AVAILABLE".equals(String.valueOf(productData.get("status")))) {
                throw new MessageException("Sản phẩm '" + productData.get("name") + "' hiện không có sẵn");
            }

            double price = parseDouble(productData.get("price"), itemReq.getProductId());
            items.add(BookingItem.builder()
                    .productId(itemReq.getProductId())
                    .productName(String.valueOf(productData.get("name")))
                    .productPrice(price)
                    .quantity(itemReq.getQuantity())
                    .saleUnit(itemReq.getSaleUnit())
                    .itemTotal(price * itemReq.getQuantity())
                    .build());
        }
        return items;
    }

    @Transactional
    public BookingResponse updateItems(String bookingCode, List<com.example.orderservice.entity.DTO.req.CreateBookingItemRequest> newItems) throws MessageException {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new MessageException("Không tìm thấy đặt bàn: " + bookingCode));

        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new MessageException("Không thể chỉnh sửa món khi đặt bàn ở trạng thái: " + booking.getStatus());
        }

        boolean isConfirmed = booking.getStatus() == BookingStatus.CONFIRMED;

        // Hoàn kho các món cũ — CHỈ khi CONFIRMED (kho đã bị trừ ở bước confirm)
        // PENDING_PAYMENT: kho chưa bị trừ lần nào → không được gọi restore
        List<BookingItem> oldItems = booking.getItems();
        if (!oldItems.isEmpty()) {
            if (isConfirmed) {
                try {
                    inventoryServiceClient.restoreForBooking(OrderDeductionPayload.builder()
                            .orderId(bookingCode)
                            .items(oldItems.stream().map(i -> OrderDeductionPayload.OrderItem.builder()
                                    .productId(i.getProductId())
                                    .quantity(i.getQuantity())
                                    .saleUnit(i.getSaleUnit())
                                    .build()).collect(Collectors.toList()))
                            .build());
                } catch (Exception e) {
                    log.warn("[updateItems] Không thể hoàn kho cũ {}: {}", bookingCode, e.getMessage());
                }
            }
            bookingItemRepository.deleteAll(oldItems);
            booking.getItems().clear();
        }

        // Build & lưu items mới
        List<BookingItem> items = buildItemsFromList(newItems);
        // Chỉ trừ kho nếu CONFIRMED — PENDING_PAYMENT sẽ trừ khi admin confirm
        if (!items.isEmpty() && isConfirmed) {
            try {
                inventoryServiceClient.deductForOrder(OrderDeductionPayload.builder()
                        .orderId(bookingCode)
                        .items(items.stream().map(i -> OrderDeductionPayload.OrderItem.builder()
                                .productId(i.getProductId())
                                .quantity(i.getQuantity())
                                .saleUnit(i.getSaleUnit())
                                .build()).collect(Collectors.toList()))
                        .build());
            } catch (Exception e) {
                throw new MessageException(extractErrorMessage(e));
            }
        }

        for (BookingItem item : items) item.setBooking(booking);
        bookingItemRepository.saveAll(items);
        booking.setItems(items);

        double total = items.stream().mapToDouble(BookingItem::getItemTotal).sum();
        booking.setTotalAmount(total);
        bookingRepository.save(booking);

        PaymentInfoResponse paymentInfo = (booking.getPaymentMethod() == BookingPaymentMethod.BANK_TRANSFER && total > 0)
                ? buildPaymentInfo(bookingCode, total) : null;
        return BookingResponse.fromWithPayment(booking, paymentInfo);
    }

    @Transactional
    public BookingResponse switchPaymentMethod(String bookingCode, com.example.orderservice.entity.DTO.req.SwitchPaymentRequest req) throws MessageException {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new MessageException("Không tìm thấy đặt bàn"));
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            throw new MessageException("Chỉ có thể đổi phương thức khi đặt bàn đang chờ thanh toán");
        }
        if (booking.getPaymentMethod() == req.getPaymentMethod()) {
            PaymentInfoResponse paymentInfo = (req.getPaymentMethod() == BookingPaymentMethod.BANK_TRANSFER && booking.getTotalAmount() > 0)
                    ? buildPaymentInfo(bookingCode, booking.getTotalAmount()) : null;
            return BookingResponse.fromWithPayment(booking, paymentInfo);
        }
        booking.setPaymentMethod(req.getPaymentMethod());
        bookingRepository.save(booking);
        CompletableFuture.runAsync(() -> {
            try { bookingAdminBot.notifyPaymentMethodChanged(booking); } catch (Exception ignored) {}
        });
        PaymentInfoResponse paymentInfo = (req.getPaymentMethod() == BookingPaymentMethod.BANK_TRANSFER && booking.getTotalAmount() > 0)
                ? buildPaymentInfo(bookingCode, booking.getTotalAmount()) : null;
        return BookingResponse.fromWithPayment(booking, paymentInfo);
    }

    private synchronized String generateBookingCode() {
        String today = LocalDate.now(VN_ZONE).toString().replace("-", "");
        String prefix = "BK-" + today + "-";
        long count = bookingRepository.countByBookingCodeStartingWith(prefix) + 1;
        return String.format("%s%03d", prefix, count);
    }

    private PaymentInfoResponse buildPaymentInfo(String bookingCode, double amount) {
        String content = "BOOKING " + bookingCode;
        String encodedContent = URLEncoder.encode(content, StandardCharsets.UTF_8);
        String vietQrUrl = String.format(
                "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%d&addInfo=%s&accountName=%s",
                bankId, accountNumber, (long) amount, encodedContent,
                URLEncoder.encode(accountHolder, StandardCharsets.UTF_8));
        return PaymentInfoResponse.builder()
                .bankName(bankName)
                .accountNumber(accountNumber)
                .accountHolder(accountHolder)
                .amount(amount)
                .transferContent(content)
                .vietQrUrl(vietQrUrl)
                .build();
    }

    private double parseDouble(Object value, Long productId) throws MessageException {
        if (value == null) throw new MessageException("Không lấy được giá sản phẩm id: " + productId);
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            throw new MessageException("Giá sản phẩm không hợp lệ: " + value);
        }
    }

    private String extractFeignErrorMessage(FeignException e) {
        try {
            Map<?, ?> map = objectMapper.readValue(e.contentUTF8(), Map.class);
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

    private Booking findById(Long id) throws MessageException {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy booking với id: " + id));
    }

    private Booking findWithItems(Long id) throws MessageException {
        Booking b = bookingRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy booking với id: " + id));
        b.getItems().size(); // trigger lazy load trong transaction
        return b;
    }

    @Transactional(readOnly = true)
    public BookingStatsResponse getStats(LocalDate dateParam) {
        ZoneId vn = ZoneId.of("Asia/Ho_Chi_Minh");
        Instant now = Instant.now();
        LocalDate date = dateParam != null ? dateParam : LocalDate.now(vn);
        boolean isToday = date.equals(LocalDate.now(vn));

        Instant dayStart = date.atStartOfDay(vn).toInstant();
        Instant dayEnd   = date.plusDays(1).atStartOfDay(vn).toInstant();
        Instant in2Hours = now.plus(2, ChronoUnit.HOURS);

        long pendingPayment = isToday
                ? bookingRepository.countPendingPayment()
                : bookingRepository.countPendingInRange(dayStart, dayEnd);
        long confirmedCount = bookingRepository.countConfirmedInRange(dayStart, dayEnd);
        long upcomingIn2Hours = isToday
                ? bookingRepository.countUpcomingConfirmed(now, in2Hours)
                : bookingRepository.countActiveInRange(dayStart, dayEnd);

        return BookingStatsResponse.builder()
                .pendingPayment(pendingPayment)
                .confirmedToday(confirmedCount)
                .upcomingIn2Hours(upcomingIn2Hours)
                .build();
    }

}
