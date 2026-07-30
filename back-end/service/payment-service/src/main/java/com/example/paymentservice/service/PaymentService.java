package com.example.paymentservice.service;

import com.example.paymentservice.client.OrderServiceClient;
import com.example.paymentservice.entity.Payment;
import com.example.paymentservice.entity.DTO.req.CreatePaymentRequest;
import com.example.paymentservice.entity.DTO.req.CustomerPaymentRequest;
import com.example.paymentservice.entity.DTO.req.SepayWebhookPayload;
import com.example.paymentservice.entity.DTO.res.PaymentResponse;
import com.example.paymentservice.entity.DTO.res.RevenueResponse;
import com.example.paymentservice.entity.DTO.res.RevenuePeriodDto;
import com.example.paymentservice.entity.enums.PaymentMethod;
import com.example.paymentservice.entity.enums.PaymentStatus;
import com.example.paymentservice.repository.PaymentRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final Pattern PAYMENT_CODE_PATTERN = Pattern.compile("TH([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})");
    // Khớp "BOOKING BK-20260623-018", "BOOKING BK20260623018", hoặc chỉ "BK-20260623-018" (không có prefix)
    private static final Pattern BOOKING_CODE_PATTERN = Pattern.compile("(?:BOOKING\\s+)?(BK[- ]?\\d{8}[- ]?\\d+)", Pattern.CASE_INSENSITIVE);

    private final PaymentRepository paymentRepository;
    private final OrderServiceClient orderServiceClient;
    private final TelegramNotificationService telegramService;

    @Value("${app.payment.bank-id:VCB}")
    private String bankId;

    @Value("${app.payment.account-number:0000000000}")
    private String accountNumber;

    @Value("${app.payment.account-holder:CHUA CAU HINH}")
    private String accountHolder;

    @Value("${sepay.webhook.apikey:not-set}")
    private String sepayApiKey;

    @Transactional
    public PaymentResponse createPayment(CreatePaymentRequest req, String createdBy) throws MessageException {
        Map<String, Object> orderData = fetchOrderData(req.getOrderId());

        String orderStatus = String.valueOf(orderData.get("status"));
        if (!"OPEN".equals(orderStatus)) {
            throw new MessageException("Đơn hàng không ở trạng thái hợp lệ để thanh toán (hiện tại: " + orderStatus + ")");
        }

        Double totalAmount = parseDouble(orderData.get("totalAmount"));
        double prepaid     = orderData.get("prepaidAmount") instanceof Number n ? n.doubleValue() : 0.0;
        double sumCompleted = paymentRepository.sumCompletedByOrderId(req.getOrderId());
        double sumPending   = paymentRepository.sumPendingByOrderId(req.getOrderId());
        double remaining    = totalAmount - prepaid - sumCompleted - sumPending;

        if (remaining <= 0.5) {
            throw new MessageException("Đơn hàng đã được thanh toán đủ");
        }

        double payAmount;
        if (req.getAmount() != null && req.getAmount() > 0) {
            if (req.getAmount() > remaining + 0.5) {
                throw new MessageException(String.format("Số tiền vượt quá phần còn lại (%.0fđ)", remaining));
            }
            payAmount = req.getAmount();
        } else {
            payAmount = remaining;
        }

        String tableName   = String.valueOf(orderData.getOrDefault("tableName", ""));
        Integer tableNumber = orderData.get("tableNumber") instanceof Number n ? n.intValue() : null;

        Payment payment = Payment.builder()
                .orderId(req.getOrderId())
                .amount(payAmount)
                .paymentMethod(req.getPaymentMethod())
                .tableName(tableName)
                .tableNumber(tableNumber)
                .note(req.getNote())
                .build();
        payment.setCreatedBy(createdBy);

        if (req.getPaymentMethod() == PaymentMethod.CARD) {
            // CARD: xác nhận qua POS, auto-complete ngay
            payment.setStatus(PaymentStatus.COMPLETED);
            payment.setPaidBy(createdBy);
            payment.setPaidAt(Instant.now());
            payment = paymentRepository.save(payment);
            double totalPaidNow = paymentRepository.sumCompletedByOrderId(req.getOrderId());
            if (totalPaidNow >= totalAmount - prepaid - 0.5) {
                callCheckoutInternal(req.getOrderId(), createdBy);
            }
        } else if (req.getPaymentMethod() == PaymentMethod.CASH) {
            // CASH: để PENDING, admin phải xác nhận đã thu tiền thực tế
            payment = paymentRepository.save(payment);
            telegramService.notify(buildCashPendingMessage(payment));
        } else {
            // BANK_TRANSFER: lưu trước để lấy ID, sau đó sinh VietQR URL
            payment = paymentRepository.save(payment);
            String vietQrUrl = buildVietQrUrl(payment.getId(), payAmount);
            payment.setVietQrUrl(vietQrUrl);
            payment = paymentRepository.save(payment);
            telegramService.notify(buildBankTransferMessage(payment));
        }

        return PaymentResponse.from(payment);
    }

    @Transactional
    public Map<String, Boolean> handleSepayWebhook(SepayWebhookPayload payload, String authHeader) throws MessageException {
        if (!("Apikey " + sepayApiKey).equals(authHeader)) {
            throw new MessageException("Webhook không hợp lệ");
        }

        if (!"in".equals(payload.getTransferType())) {
            return Map.of("success", true);
        }

        String content = payload.getContent() != null ? payload.getContent().toUpperCase() : "";

        // Ưu tiên kiểm tra booking trước (BOOKING BK-xxxxxxxx-xxx hoặc BOOKING BK20260623018)
        Matcher bookingMatcher = BOOKING_CODE_PATTERN.matcher(content);
        if (bookingMatcher.find()) {
            // Normalize về format chuẩn: BK20260623018 → BK-20260623-018
            String rawCode = bookingMatcher.group(1).toUpperCase().replaceAll("\\s", "");
            String bookingCode = rawCode.replaceAll("^BK-?(\\d{8})-?(\\d+)$", "BK-$1-$2");
            try {
                orderServiceClient.confirmBookingByCode(bookingCode);
                log.info("[Sepay] Booking {} đã được xác nhận tự động qua chuyển khoản", bookingCode);
            } catch (Exception e) {
                log.error("[Sepay] Lỗi xác nhận booking {}: {}", bookingCode, e.getMessage());
            }
            return Map.of("success", true);
        }

        Matcher matcher = PAYMENT_CODE_PATTERN.matcher(content);
        if (!matcher.find()) {
            log.warn("[Sepay] Không tìm được mã thanh toán trong nội dung: '{}'", payload.getContent());
            return Map.of("success", true);
        }

        UUID paymentId = UUID.fromString(matcher.group(1));
        Payment payment = paymentRepository.findById(paymentId)
                .orElseGet(() -> {
                    log.warn("[Sepay] Không tìm thấy payment id={}", paymentId);
                    return null;
                });

        if (payment == null || payment.getStatus() != PaymentStatus.PENDING) {
            log.warn("[Sepay] Payment id={} không ở trạng thái PENDING hoặc không tồn tại", paymentId);
            return Map.of("success", true);
        }

        if (payload.getReferenceCode() != null && paymentRepository.existsByReferenceCode(payload.getReferenceCode())) {
            log.warn("[Sepay] referenceCode='{}' đã được xử lý trước đó, bỏ qua", payload.getReferenceCode());
            return Map.of("success", true);
        }

        double diff = Math.abs(payment.getAmount() - (payload.getTransferAmount() != null ? payload.getTransferAmount() : 0.0));
        if (diff > 1000) {
            log.warn("[Sepay] Số tiền không khớp: payment.amount={}, transferAmount={}", payment.getAmount(), payload.getTransferAmount());
            return Map.of("success", true);
        }

        payment.setStatus(PaymentStatus.COMPLETED);
        payment.setPaidAt(Instant.now());
        payment.setPaidBy("sepay-webhook");
        payment.setReferenceCode(payload.getReferenceCode());
        paymentRepository.save(payment);

        // Chỉ checkout order khi đã đủ tiền (hỗ trợ split payment)
        double totalPaidNow = paymentRepository.sumCompletedByOrderId(payment.getOrderId());
        try {
            Map<String, Object> orderData = fetchOrderData(payment.getOrderId());
            double totalAmount = parseDouble(orderData.get("totalAmount"));
            double prepaid = orderData.get("prepaidAmount") instanceof Number n ? n.doubleValue() : 0.0;
            if (totalPaidNow >= totalAmount - prepaid - 0.5) {
                callCheckoutInternal(payment.getOrderId(), "sepay-webhook");
            }
        } catch (Exception e) {
            log.error("[Sepay] Lỗi checkout đơn hàng {}: {}", payment.getOrderId(), e.getMessage());
        }

        telegramService.notify(buildPaymentCompletedMessage(payment, payload.getTransferAmount()));
        log.info("[Sepay] Payment id={}, orderId={} xác nhận thành công. Số tiền: {}", paymentId, payment.getOrderId(), payload.getTransferAmount());
        return Map.of("success", true);
    }

    @Transactional
    public PaymentResponse confirmPayment(UUID paymentId, String confirmedBy) throws MessageException {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new MessageException("Không tìm thấy giao dịch với id: " + paymentId));

        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new MessageException("Chỉ có thể xác nhận giao dịch ở trạng thái PENDING");
        }

        payment.setStatus(PaymentStatus.COMPLETED);
        payment.setPaidAt(Instant.now());
        payment.setPaidBy(confirmedBy);
        paymentRepository.save(payment);

        // Chỉ checkout order khi tổng đã thanh toán đủ (hỗ trợ split payment)
        double totalPaidNow = paymentRepository.sumCompletedByOrderId(payment.getOrderId());
        try {
            Map<String, Object> orderData = fetchOrderData(payment.getOrderId());
            double totalAmount = parseDouble(orderData.get("totalAmount"));
            double prepaid = orderData.get("prepaidAmount") instanceof Number n ? n.doubleValue() : 0.0;
            if (totalPaidNow >= totalAmount - prepaid - 0.5) {
                callCheckoutInternal(payment.getOrderId(), confirmedBy);
            }
        } catch (Exception e) {
            log.warn("[confirmPayment] Không lấy được thông tin đơn hàng {} để kiểm tra: {}", payment.getOrderId(), e.getMessage());
        }

        telegramService.notify(buildPaymentCompletedMessage(payment, payment.getAmount()));
        return PaymentResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getById(UUID paymentId) throws MessageException {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new MessageException("Không tìm thấy giao dịch với id: " + paymentId));
        return PaymentResponse.from(payment);
    }

    @Transactional
    public PaymentResponse processRefund(UUID orderId, Double amount, String note, String refundedBy) throws MessageException {
        Map<String, Object> orderData = fetchOrderData(orderId);

        String orderStatus = String.valueOf(orderData.get("status"));
        if (!"OPEN".equals(orderStatus)) {
            throw new MessageException("Đơn hàng không ở trạng thái OPEN (hiện tại: " + orderStatus + ")");
        }

        double totalAmount = parseDouble(orderData.get("totalAmount"));
        double prepaid = orderData.get("prepaidAmount") instanceof Number n ? n.doubleValue() : 0.0;
        double maxRefund = prepaid - totalAmount;
        if (maxRefund <= 0) {
            throw new MessageException("Đơn hàng này không có khoản cần hoàn tiền");
        }
        double refundAmount = amount != null ? amount : maxRefund;
        if (refundAmount > maxRefund + 1.0) {
            throw new MessageException("Số tiền hoàn vượt quá mức cần hoàn (" + String.format("%.0f", maxRefund) + "đ)");
        }

        String tableName = String.valueOf(orderData.getOrDefault("tableName", ""));
        Integer tableNumber = orderData.get("tableNumber") instanceof Number n ? n.intValue() : null;

        Payment refundPayment = Payment.builder()
                .orderId(orderId)
                .amount(refundAmount)
                .paymentMethod(PaymentMethod.REFUND)
                .status(PaymentStatus.COMPLETED)
                .paidBy(refundedBy)
                .paidAt(Instant.now())
                .tableName(tableName)
                .tableNumber(tableNumber)
                .note(note != null && !note.isBlank() ? note : "Hoàn tiền cọc booking")
                .build();
        refundPayment.setCreatedBy(refundedBy);
        refundPayment = paymentRepository.save(refundPayment);

        // Nếu không còn khoản nào cần thu (totalAmount <= prepaid - refundAmount), checkout luôn
        double remaining = totalAmount - (prepaid - refundAmount);
        if (remaining <= 0) {
            try {
                callCheckoutInternal(orderId, refundedBy);
            } catch (Exception e) {
                log.warn("[processRefund] Checkout đơn {} sau hoàn tiền thất bại: {}", orderId, e.getMessage());
            }
        }

        String msg = String.format("💰 Đã hoàn %,.0fđ cho khách — Đơn #%s%s (NV: %s)",
                refundAmount, orderId,
                tableNumber != null ? " · Bàn " + tableNumber : "",
                refundedBy);
        telegramService.notify(msg);

        return PaymentResponse.from(refundPayment);
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> getAllByOrderId(UUID orderId) {
        return paymentRepository.findAllByOrderIdOrderByCreatedAtDesc(orderId)
                .stream().map(PaymentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PaymentResponse getByOrderId(UUID orderId) throws MessageException {
        // Ưu tiên trả payment không phải REFUND (giao dịch thu tiền chính)
        // Nếu chỉ có REFUND payment, trả về REFUND
        List<Payment> all = paymentRepository.findAllByOrderIdOrderByCreatedAtDesc(orderId);
        Payment payment = all.stream()
                .filter(p -> p.getPaymentMethod() != PaymentMethod.REFUND)
                .findFirst()
                .orElse(all.isEmpty() ? null : all.get(0));
        if (payment == null) {
            throw new MessageException("Không tìm thấy giao dịch cho đơn hàng id: " + orderId);
        }
        return PaymentResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public Page<PaymentResponse> getAll(int page, int size, PaymentStatus status, PaymentMethod method, Instant from, Instant to) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        if (from != null && to != null) {
            if (status != null && method != null) {
                return paymentRepository.findByStatusAndPaymentMethodAndCreatedAtBetween(status, method, from, to, pageable).map(PaymentResponse::from);
            }
            if (status != null) {
                return paymentRepository.findByStatusAndCreatedAtBetween(status, from, to, pageable).map(PaymentResponse::from);
            }
            if (method != null) {
                return paymentRepository.findByPaymentMethodAndCreatedAtBetween(method, from, to, pageable).map(PaymentResponse::from);
            }
            return paymentRepository.findByCreatedAtBetween(from, to, pageable).map(PaymentResponse::from);
        }
        if (status != null && method != null) {
            return paymentRepository.findByStatusAndPaymentMethod(status, method, pageable).map(PaymentResponse::from);
        }
        if (status != null) {
            return paymentRepository.findByStatus(status, pageable).map(PaymentResponse::from);
        }
        if (method != null) {
            return paymentRepository.findByPaymentMethod(method, pageable).map(PaymentResponse::from);
        }
        return paymentRepository.findAll(pageable).map(PaymentResponse::from);
    }

    @Transactional
    public PaymentResponse updateAmount(UUID paymentId, Double newAmount) throws MessageException {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new MessageException("Không tìm thấy giao dịch #" + paymentId));

        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new MessageException("Chỉ có thể cập nhật giá khi giao dịch đang chờ xác nhận");
        }

        if (newAmount == null || newAmount < 0) {
            throw new MessageException("Số tiền không hợp lệ");
        }

        payment.setAmount(newAmount);
        if (payment.getPaymentMethod() == PaymentMethod.BANK_TRANSFER) {
            payment.setVietQrUrl(buildVietQrUrl(payment.getId(), newAmount));
        }

        return PaymentResponse.from(paymentRepository.save(payment));
    }

    @Transactional
    public PaymentResponse changePaymentMethod(UUID paymentId, PaymentMethod newMethod) throws MessageException {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new MessageException("Không tìm thấy giao dịch #" + paymentId));

        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new MessageException("Chỉ có thể đổi phương thức khi giao dịch đang chờ xác nhận");
        }

        if (payment.getPaymentMethod() == newMethod) {
            throw new MessageException("Phương thức thanh toán đã là " + newMethod);
        }

        if (newMethod == PaymentMethod.CARD) {
            throw new MessageException("Không hỗ trợ đổi sang thanh toán thẻ");
        }

        payment.setPaymentMethod(newMethod);

        if (newMethod == PaymentMethod.BANK_TRANSFER) {
            String vietQrUrl = buildVietQrUrl(payment.getId(), payment.getAmount());
            payment.setVietQrUrl(vietQrUrl);
            payment = paymentRepository.save(payment);
            telegramService.notify(buildBankTransferMessage(payment));
        } else {
            // Đổi sang CASH: xóa QR cũ
            payment.setVietQrUrl(null);
            payment = paymentRepository.save(payment);
            telegramService.notify(buildCashPendingMessage(payment));
        }

        return PaymentResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public Page<PaymentResponse> getToday(int page, int size, PaymentStatus status) {
        ZoneId vnZone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(vnZone);
        Instant from = today.atStartOfDay(vnZone).toInstant();
        Instant to = today.plusDays(1).atStartOfDay(vnZone).toInstant();
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        if (status != null) {
            return paymentRepository.findByStatusAndCreatedAtBetween(status, from, to, pageable).map(PaymentResponse::from);
        }
        return paymentRepository.findByCreatedAtBetween(from, to, pageable).map(PaymentResponse::from);
    }

    @Transactional(readOnly = true)
    public RevenueResponse getRevenue(Instant from, Instant to) {
        List<Object[]> rows = paymentRepository.findRevenueGroupedByMethod(PaymentStatus.COMPLETED, from, to);
        Map<String, Double> byMethod = new HashMap<>();
        double total = 0.0;
        long count = 0;
        for (Object[] row : rows) {
            String method = row[0].toString();
            double sum = ((Number) row[1]).doubleValue();
            long cnt = ((Number) row[2]).longValue();
            byMethod.put(method, sum);
            total += sum;
            count += cnt;
        }
        return RevenueResponse.builder()
                .totalRevenue(total)
                .totalTransactions(count)
                .revenueByMethod(byMethod)
                .from(from)
                .to(to)
                .build();
    }

    @Transactional(readOnly = true)
    public List<RevenuePeriodDto> getRevenueSeries(String groupBy, int limit) throws MessageException {
        ZoneId vn = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(vn);
        Instant to = Instant.now();

        String upper = groupBy.toUpperCase();
        if (!upper.equals("DAY") && !upper.equals("WEEK") && !upper.equals("MONTH") && !upper.equals("YEAR")) {
            throw new MessageException("groupBy phải là DAY, WEEK, MONTH hoặc YEAR");
        }

        String pattern = switch (upper) {
            case "DAY"   -> "%Y-%m-%d";
            case "WEEK"  -> "%x-W%v";
            case "MONTH" -> "%Y-%m";
            default      -> "%Y";
        };

        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        Instant from = switch (upper) {
            case "DAY"   -> today.minusDays(limit - 1).atStartOfDay(vn).toInstant();
            case "WEEK"  -> monday.minusWeeks(limit - 1).atStartOfDay(vn).toInstant();
            case "MONTH" -> today.withDayOfMonth(1).minusMonths(limit - 1).atStartOfDay(vn).toInstant();
            default      -> today.withDayOfYear(1).minusYears(limit - 1).atStartOfDay(vn).toInstant();
        };

        // Rows: [period, method, revenue, count] — group by period, accumulate method map
        Map<String, Map<String, Double>> byMethodMap = new LinkedHashMap<>();
        Map<String, long[]> countMap = new LinkedHashMap<>();

        for (Object[] row : paymentRepository.findRevenueSeriesByPeriod(pattern, from, to)) {
            String period = String.valueOf(row[0]);
            String method = String.valueOf(row[1]);
            double amount  = row[2] != null ? ((Number) row[2]).doubleValue() : 0.0;
            long   cnt     = row[3] != null ? ((Number) row[3]).longValue()   : 0L;

            byMethodMap.computeIfAbsent(period, k -> new LinkedHashMap<>()).put(method, amount);
            countMap.computeIfAbsent(period, k -> new long[]{0L})[0] += cnt;
        }

        // Luôn trả đủ `limit` kỳ, kỳ không có giao dịch → revenue=0
        List<String> allPeriods = generatePeriodKeys(upper, limit, vn, today);
        return allPeriods.stream()
                .map(p -> {
                    Map<String, Double> methods = byMethodMap.getOrDefault(p, Map.of());
                    double total = methods.values().stream().mapToDouble(Double::doubleValue).sum();
                    long   count = countMap.getOrDefault(p, new long[]{0L})[0];
                    return RevenuePeriodDto.builder()
                            .period(p)
                            .revenue(total)
                            .transactions(count)
                            .byMethod(methods)
                            .build();
                })
                .toList();
    }

    private List<String> generatePeriodKeys(String upper, int limit, ZoneId vn, LocalDate today) {
        List<String> periods = new ArrayList<>();
        switch (upper) {
            case "DAY" -> {
                DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
                for (int i = 0; i < limit; i++)
                    periods.add(today.minusDays(i).format(fmt));
            }
            case "WEEK" -> {
                LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                for (int i = 0; i < limit; i++) {
                    LocalDate w = monday.minusWeeks(i);
                    int weekYear = w.get(WeekFields.ISO.weekBasedYear());
                    int weekNum  = w.get(WeekFields.ISO.weekOfWeekBasedYear());
                    periods.add(String.format("%d-W%02d", weekYear, weekNum));
                }
            }
            case "MONTH" -> {
                DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM");
                LocalDate first = today.withDayOfMonth(1);
                for (int i = 0; i < limit; i++)
                    periods.add(first.minusMonths(i).format(fmt));
            }
            default -> { // YEAR
                for (int i = 0; i < limit; i++)
                    periods.add(String.valueOf(today.getYear() - i));
            }
        }
        return periods;
    }

    @Transactional
    public PaymentResponse createPaymentByToken(CustomerPaymentRequest req) throws MessageException {
        if (req.getPaymentMethod() == PaymentMethod.CARD) {
            throw new MessageException("Không hỗ trợ thanh toán thẻ qua QR");
        }

        Map<String, Object> orderData = fetchOrderDataByQrToken(req.getQrToken());
        String orderStatus = String.valueOf(orderData.get("status"));
        if (!"OPEN".equals(orderStatus)) {
            throw new MessageException("Đơn hàng không ở trạng thái hợp lệ để thanh toán");
        }

        UUID orderId = orderData.get("id") instanceof String s ? UUID.fromString(s) : null;
        if (orderId == null) throw new MessageException("Không lấy được ID đơn hàng");

        boolean hasActivePayment = paymentRepository
                .findActiveNonRefundPayment(orderId, List.of(PaymentStatus.PENDING, PaymentStatus.COMPLETED))
                .isPresent();
        if (hasActivePayment) {
            throw new MessageException("Đơn hàng đã có giao dịch thanh toán đang xử lý");
        }

        Double totalAmount = parseDouble(orderData.get("totalAmount"));
        double prepaid = orderData.get("prepaidAmount") instanceof Number n ? n.doubleValue() : 0.0;
        Double amount = Math.max(0.0, totalAmount - prepaid);
        String tableName = String.valueOf(orderData.getOrDefault("tableName", "Bàn"));
        Integer tableNumber = orderData.get("tableNumber") instanceof Number n ? n.intValue() : null;

        Payment payment = Payment.builder()
                .orderId(orderId)
                .amount(amount)
                .paymentMethod(req.getPaymentMethod())
                .tableName(tableName)
                .tableNumber(tableNumber)
                .build();
        payment.setCreatedBy("customer");

        if (req.getPaymentMethod() == PaymentMethod.CASH) {
            payment = paymentRepository.save(payment);
            telegramService.notify(buildCustomerCashMessage(payment));
        } else {
            payment = paymentRepository.save(payment);
            String vietQrUrl = buildVietQrUrl(payment.getId(), amount);
            payment.setVietQrUrl(vietQrUrl);
            payment = paymentRepository.save(payment);
            telegramService.notify(buildCustomerBankTransferMessage(payment));
        }

        return PaymentResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public Map<String, String> getPaymentStatus(UUID paymentId) throws MessageException {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new MessageException("Không tìm thấy giao dịch"));
        return Map.of("status", payment.getStatus().name());
    }

    // ── private helpers ──────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchOrderData(UUID orderId) throws MessageException {
        Map<String, Object> response;
        try {
            response = orderServiceClient.getOrder(orderId);
        } catch (Exception e) {
            throw new MessageException("Không tìm thấy đơn hàng id: " + orderId);
        }
        Object data = response.get("data");
        if (data instanceof Map) {
            return (Map<String, Object>) data;
        }
        throw new MessageException("Không lấy được thông tin đơn hàng id: " + orderId);
    }

    private void callCheckoutInternal(UUID orderId, String paidBy) throws MessageException {
        try {
            orderServiceClient.checkoutInternal(orderId, Map.of("paidBy", paidBy));
        } catch (Exception e) {
            throw new MessageException("Lỗi khi thanh toán: " + e.getMessage());
        }
    }

    private String buildVietQrUrl(UUID paymentId, Double amount) {
        String content = "TH" + paymentId;
        return String.format(
                "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%d&addInfo=%s&accountName=%s",
                bankId, accountNumber, amount.longValue(),
                URLEncoder.encode(content, StandardCharsets.UTF_8),
                URLEncoder.encode(accountHolder, StandardCharsets.UTF_8));
    }

    private Double parseDouble(Object value) throws MessageException {
        if (value == null) throw new MessageException("Không lấy được tổng tiền đơn hàng");
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            throw new MessageException("Tổng tiền không hợp lệ: " + value);
        }
    }

    private String buildCashPendingMessage(Payment p) {
        return String.format(
                "🔔 <b>%s</b> — Yêu cầu thanh toán tiền mặt\n💰 Số tiền: <b>%s đ</b>\n📋 Mã giao dịch: #%s\n\n⚠️ Admin cần xác nhận sau khi thu tiền!\n👉 PATCH /api/v1/payments/%s/confirm",
                p.getTableName(), formatAmount(p.getAmount()), p.getId(), p.getId());
    }

    private String buildBankTransferMessage(Payment p) {
        return String.format(
                "💳 <b>%s</b> — Đang chờ chuyển khoản\n💰 Số tiền: <b>%s đ</b>\n🔗 QR: %s\n\nNhân viên đợi khách chuyển khoản.",
                p.getTableName(), formatAmount(p.getAmount()), p.getVietQrUrl());
    }

    private String buildPaymentCompletedMessage(Payment p, Double transferAmount) {
        String method = p.getPaymentMethod() == PaymentMethod.CASH
                ? "Đã thanh toán tiền mặt thành công"
                : "Đã nhận chuyển khoản thành công";
        return String.format(
                "✅ <b>%s</b> — %s\n💰 <b>%s đ</b>",
                p.getTableName(), method, formatAmount(transferAmount));
    }

    private String formatAmount(Double amount) {
        return String.format("%,.0f", amount);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchOrderDataByQrToken(String qrToken) throws MessageException {
        Map<String, Object> response;
        try {
            response = orderServiceClient.getOrderByQrToken(qrToken);
        } catch (Exception e) {
            throw new MessageException("Không tìm thấy đơn hàng cho bàn này");
        }
        Object data = response.get("data");
        if (data instanceof Map) {
            return (Map<String, Object>) data;
        }
        throw new MessageException("Bàn chưa có đơn hàng");
    }

    private String buildCustomerCashMessage(Payment p) {
        return String.format(
                "🔔 <b>%s</b> — Khách gọi thu tiền mặt!\n💰 Số tiền: <b>%s đ</b>\n\n⚠️ Ra bàn thu tiền rồi xác nhận!\n👉 PATCH /api/v1/payments/%s/confirm",
                p.getTableName(), formatAmount(p.getAmount()), p.getId());
    }

    private String buildCustomerBankTransferMessage(Payment p) {
        return String.format(
                "💳 <b>%s</b> — Khách đang chuyển khoản\n💰 Số tiền: <b>%s đ</b>\n\nTheo dõi — hệ thống tự xác nhận khi nhận tiền ✅",
                p.getTableName(), formatAmount(p.getAmount()));
    }
}
