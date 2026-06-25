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
        validateScheduledTime(req.getScheduledTime());

        DiningTable table = null;
        if (req.getTableId() != null) {
            table = tableRepository.findById(req.getTableId())
                    .orElseThrow(() -> new MessageException("Không tìm thấy bàn với id: " + req.getTableId()));
        }

        List<BookingItem> items = buildItems(req);
        double total = items.stream().mapToDouble(BookingItem::getItemTotal).sum();

        String code = generateBookingCode();

        Booking booking = Booking.builder()
                .bookingCode(code)
                .customerName(req.getCustomerName())
                .customerPhone(req.getCustomerPhone())
                .customerBankAccount(req.getCustomerBankAccount())
                .diningTable(table)
                .scheduledTime(req.getScheduledTime())
                .totalAmount(total)
                .note(req.getNote())
                .build();

        booking = bookingRepository.save(booking);

        for (BookingItem item : items) {
            item.setBooking(booking);
        }
        bookingItemRepository.saveAll(items);
        booking.setItems(items);

        PaymentInfoResponse paymentInfo = buildPaymentInfo(code, total);
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

        try {
            inventoryServiceClient.deductForOrder(OrderDeductionPayload.builder()
                    .orderId(booking.getBookingCode())
                    .items(deductionItems)
                    .build());
        } catch (Exception e) {
            throw new MessageException("Lỗi trừ kho: " + extractErrorMessage(e));
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentMethod(BookingPaymentMethod.CASH);
        booking.setCreatedBy(confirmedBy);
        bookingRepository.save(booking);

        bookingAdminBot.notifyConfirmed(booking, confirmedBy);
        return BookingResponse.from(booking);
    }

    @Transactional
    public BookingResponse completeBooking(Long id) throws MessageException {
        Booking booking = findById(id);

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new MessageException("Chỉ có thể hoàn thành booking ở trạng thái CONFIRMED");
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
                                        Instant from, Instant to) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("scheduledTime").ascending());

        if (status != null && from != null && to != null) {
            return bookingRepository.findByStatus(status, pageable).map(BookingResponse::from);
        }
        if (from != null && to != null) {
            return bookingRepository.findByScheduledTimeBetween(from, to, pageable).map(BookingResponse::from);
        }
        if (status != null) {
            return bookingRepository.findByStatus(status, pageable).map(BookingResponse::from);
        }
        return bookingRepository.findAll(pageable).map(BookingResponse::from);
    }

    public Page<BookingResponse> getBookingsByPhone(String phone, int page, int size) {
        return bookingRepository.findByCustomerPhoneOrderByCreatedAtDesc(
                phone, PageRequest.of(page, size))
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
        DiningTable table;
        if (overrideTableId != null) {
            table = tableRepository.findById(overrideTableId)
                    .orElseThrow(() -> new MessageException("Không tìm thấy bàn với id: " + overrideTableId));
        } else {
            table = booking.getDiningTable();
            if (table == null) {
                throw new MessageException("Vui lòng chỉ định bàn cho booking này");
            }
        }

        String note = "Từ booking " + booking.getBookingCode()
                + (booking.getNote() != null ? " - " + booking.getNote() : "");

        boolean isCash = BookingPaymentMethod.CASH.equals(booking.getPaymentMethod());
        // BANK_TRANSFER: khách đã trả trước → totalAmount=0, prepaid=booking.total
        // CASH: chưa trả → totalAmount=booking.total, prepaid=0 (thu tiền khi ăn)
        Order order = Order.builder()
                .diningTable(table)
                .totalAmount(isCash ? booking.getTotalAmount() : 0.0)
                .prepaidAmount(isCash ? 0.0 : booking.getTotalAmount())
                .note(note)
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

        table.setStatus(TableStatus.OCCUPIED);
        tableRepository.save(table);

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
        List<BookingItem> items = new ArrayList<>();
        for (var itemReq : req.getItems()) {
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
    public BookingStatsResponse getStats() {
        ZoneId vn = ZoneId.of("Asia/Ho_Chi_Minh");
        Instant now = Instant.now();
        Instant todayStart = LocalDate.now(vn).atStartOfDay(vn).toInstant();
        Instant todayEnd   = LocalDate.now(vn).plusDays(1).atStartOfDay(vn).toInstant();
        Instant in2Hours   = now.plus(2, ChronoUnit.HOURS);

        return BookingStatsResponse.builder()
                .pendingPayment(bookingRepository.countPendingPayment())
                .confirmedToday(bookingRepository.countConfirmedInRange(todayStart, todayEnd))
                .upcomingIn2Hours(bookingRepository.countUpcomingConfirmed(now, in2Hours))
                .build();
    }

}
