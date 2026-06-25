package com.example.paymentservice.service;

import com.example.paymentservice.client.OrderServiceClient;
import com.example.paymentservice.entity.Payment;
import com.example.paymentservice.entity.DTO.req.CreatePaymentRequest;
import com.example.paymentservice.entity.DTO.req.SepayWebhookPayload;
import com.example.paymentservice.entity.DTO.res.PaymentResponse;
import com.example.paymentservice.entity.DTO.res.RevenueResponse;
import com.example.paymentservice.entity.enums.PaymentMethod;
import com.example.paymentservice.entity.enums.PaymentStatus;
import com.example.paymentservice.repository.PaymentRepository;
import com.example.restaurant_common.util.exception.MessageException;
import feign.FeignException;
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
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final Pattern PAYMENT_CODE_PATTERN = Pattern.compile("TH(\\d+)");
    // Khớp cả "BK-20260623-018" và "BK20260623018" (ngân hàng/Sepay có thể strip dấu gạch)
    private static final Pattern BOOKING_CODE_PATTERN = Pattern.compile("BOOKING\\s*(BK[- ]?\\d{8}[- ]?\\d+)", Pattern.CASE_INSENSITIVE);

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

        boolean hasActivePayment = paymentRepository
                .findByOrderIdAndStatusIn(req.getOrderId(), List.of(PaymentStatus.PENDING, PaymentStatus.COMPLETED))
                .isPresent();
        if (hasActivePayment) {
            throw new MessageException("Đơn hàng này đã có giao dịch thanh toán đang xử lý hoặc đã hoàn thành");
        }

        Double amount = parseDouble(orderData.get("totalAmount"));
        String tableName = String.valueOf(orderData.getOrDefault("tableName", ""));
        Integer tableNumber = orderData.get("tableNumber") instanceof Number n ? n.intValue() : null;

        Payment payment = Payment.builder()
                .orderId(req.getOrderId())
                .amount(amount)
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
            callCheckoutInternal(req.getOrderId(), createdBy);
        } else if (req.getPaymentMethod() == PaymentMethod.CASH) {
            // CASH: để PENDING, admin phải xác nhận đã thu tiền thực tế
            payment = paymentRepository.save(payment);
            telegramService.notify(buildCashPendingMessage(payment));
        } else {
            // BANK_TRANSFER: lưu trước để lấy ID, sau đó sinh VietQR URL
            payment = paymentRepository.save(payment);
            String vietQrUrl = buildVietQrUrl(payment.getId(), amount);
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

        Long paymentId = Long.parseLong(matcher.group(1));
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

        try {
            callCheckoutInternal(payment.getOrderId(), "sepay-webhook");
        } catch (MessageException e) {
            log.error("[Sepay] Lỗi checkout đơn hàng {}: {}", payment.getOrderId(), e.getMessage());
            return Map.of("success", true);
        }

        payment.setStatus(PaymentStatus.COMPLETED);
        payment.setPaidAt(Instant.now());
        payment.setPaidBy("sepay-webhook");
        payment.setReferenceCode(payload.getReferenceCode());
        paymentRepository.save(payment);

        telegramService.notify(buildPaymentCompletedMessage(payment, payload.getTransferAmount()));
        log.info("[Sepay] Payment id={}, orderId={} xác nhận thành công. Số tiền: {}", paymentId, payment.getOrderId(), payload.getTransferAmount());
        return Map.of("success", true);
    }

    @Transactional
    public PaymentResponse confirmPayment(Long paymentId, String confirmedBy) throws MessageException {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new MessageException("Không tìm thấy giao dịch với id: " + paymentId));

        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new MessageException("Chỉ có thể xác nhận giao dịch ở trạng thái PENDING");
        }

        callCheckoutInternal(payment.getOrderId(), confirmedBy);

        payment.setStatus(PaymentStatus.COMPLETED);
        payment.setPaidAt(Instant.now());
        payment.setPaidBy(confirmedBy);
        paymentRepository.save(payment);

        telegramService.notify(buildPaymentCompletedMessage(payment, payment.getAmount()));
        return PaymentResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getById(Long paymentId) throws MessageException {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new MessageException("Không tìm thấy giao dịch với id: " + paymentId));
        return PaymentResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getByOrderId(Long orderId) throws MessageException {
        Payment payment = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new MessageException("Không tìm thấy giao dịch cho đơn hàng id: " + orderId));
        return PaymentResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public Page<PaymentResponse> getAll(int page, int size, PaymentStatus status, PaymentMethod method) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
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

    // ── private helpers ──────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchOrderData(Long orderId) throws MessageException {
        try {
            Map<String, Object> response = orderServiceClient.getOrder(orderId);
            Object data = response.get("data");
            if (data instanceof Map) {
                return (Map<String, Object>) data;
            }
            throw new MessageException("Không lấy được thông tin đơn hàng id: " + orderId);
        } catch (FeignException e) {
            throw new MessageException("Không tìm thấy đơn hàng id: " + orderId);
        }
    }

    private void callCheckoutInternal(Long orderId, String paidBy) throws MessageException {
        try {
            orderServiceClient.checkoutInternal(orderId, Map.of("paidBy", paidBy));
        } catch (FeignException e) {
            throw new MessageException("Lỗi khi thanh toán đơn hàng: " + extractFeignMessage(e));
        }
    }

    private String buildVietQrUrl(Long paymentId, Double amount) {
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

    private String extractFeignMessage(FeignException e) {
        return e.getMessage() != null ? e.getMessage() : "Lỗi kết nối";
    }

    private String buildCashPendingMessage(Payment p) {
        return String.format(
                "🔔 <b>%s</b> — Yêu cầu thanh toán tiền mặt\n💰 Số tiền: <b>%s đ</b>\n📋 Mã giao dịch: #%d\n\n⚠️ Admin cần xác nhận sau khi thu tiền!\n👉 PATCH /api/v1/payments/%d/confirm",
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
}
