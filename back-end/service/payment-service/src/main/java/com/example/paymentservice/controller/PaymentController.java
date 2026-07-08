package com.example.paymentservice.controller;

import com.example.paymentservice.entity.DTO.req.ChangePaymentMethodRequest;
import com.example.paymentservice.entity.DTO.req.CreatePaymentRequest;
import com.example.paymentservice.entity.DTO.req.CustomerPaymentRequest;
import com.example.paymentservice.entity.DTO.req.SepayWebhookPayload;
import com.example.paymentservice.entity.DTO.res.PaymentResponse;
import com.example.paymentservice.entity.DTO.res.RevenueResponse;
import com.example.paymentservice.entity.DTO.res.RevenuePeriodDto;
import com.example.paymentservice.entity.enums.PaymentMethod;
import com.example.paymentservice.entity.enums.PaymentStatus;
import com.example.paymentservice.service.PaymentService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @Value("${sepay.webhook.allowed-ips:*}")
    private String allowedIps;

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<PaymentResponse> createPayment(
            @RequestBody @Valid CreatePaymentRequest req,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(paymentService.createPayment(req, jwt.getSubject()));
    }

    @PatchMapping("/{id}/change-method")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<PaymentResponse> changePaymentMethod(
            @PathVariable Long id,
            @RequestBody @Valid ChangePaymentMethodRequest req) throws MessageException {
        return ResponseEntity.ok(paymentService.changePaymentMethod(id, req.getNewMethod()));
    }

    @PatchMapping("/{id}/confirm")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<PaymentResponse> confirmPayment(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(paymentService.confirmPayment(id, jwt.getSubject()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<PaymentResponse> getById(@PathVariable Long id) throws MessageException {
        return ResponseEntity.ok(paymentService.getById(id));
    }

    @GetMapping("/orders/{orderId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<PaymentResponse> getByOrderId(@PathVariable Long orderId) throws MessageException {
        return ResponseEntity.ok(paymentService.getByOrderId(orderId));
    }

    @GetMapping("/orders/{orderId}/all")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<PaymentResponse>> getAllByOrderId(@PathVariable Long orderId) {
        return ResponseEntity.ok(paymentService.getAllByOrderId(orderId));
    }

    @PostMapping("/orders/{orderId}/refund")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<PaymentResponse> processRefund(
            @PathVariable Long orderId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        Double amount = body != null && body.get("amount") instanceof Number n ? n.doubleValue() : null;
        String note = body != null && body.get("note") instanceof String s ? s : null;
        return ResponseEntity.ok(paymentService.processRefund(orderId, amount, note, jwt.getSubject()));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Page<PaymentResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) PaymentMethod method) {
        return ResponseEntity.ok(paymentService.getAll(page, size, status, method));
    }

    @GetMapping("/today")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Page<PaymentResponse>> getToday(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) PaymentStatus status) {
        return ResponseEntity.ok(paymentService.getToday(page, size, status));
    }

    @GetMapping("/revenue")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<RevenueResponse> getRevenue(
            @RequestParam Instant from,
            @RequestParam Instant to) {
        return ResponseEntity.ok(paymentService.getRevenue(from, to));
    }

    @GetMapping("/revenue/series")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<RevenuePeriodDto>> getRevenueSeries(
            @RequestParam(defaultValue = "DAY") String groupBy,
            @RequestParam(defaultValue = "30") int limit) throws MessageException {
        return ResponseEntity.ok(paymentService.getRevenueSeries(groupBy, limit));
    }

    // ── Public endpoints (không cần JWT) — dành cho khách quét QR ──

    @PostMapping("/customer-request")
    public ResponseEntity<PaymentResponse> customerPaymentRequest(
            @RequestBody CustomerPaymentRequest req) throws MessageException {
        return ResponseEntity.ok(paymentService.createPaymentByToken(req));
    }

    @GetMapping("/customer-status/{paymentId}")
    public ResponseEntity<Map<String, String>> getCustomerStatus(
            @PathVariable Long paymentId) throws MessageException {
        return ResponseEntity.ok(paymentService.getPaymentStatus(paymentId));
    }

    @PostMapping("/webhook/sepay")
    public ResponseEntity<Map<String, Object>> handleSepayWebhook(
            @RequestBody SepayWebhookPayload payload,
            HttpServletRequest request) {
        // IP check — trả 403 để Sepay biết đây là lỗi cấu hình, không retry
        if (!"*".equals(allowedIps)) {
            String callerIp = getClientIp(request);
            boolean allowed = false;
            for (String ip : allowedIps.split(",")) {
                if (ip.trim().equals(callerIp)) { allowed = true; break; }
            }
            if (!allowed) {
                log.warn("[Sepay] Webhook bị từ chối từ IP: {}", callerIp);
                return ResponseEntity.status(403).body(Map.of("success", false, "message", "IP không được phép"));
            }
        }

        try {
            String authHeader = request.getHeader("Authorization");
            paymentService.handleSepayWebhook(payload, authHeader);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            // Trả 200 để Sepay không retry; lỗi đã được log để điều tra
            log.error("[Sepay Webhook] Lỗi xử lý giao dịch id={}: {}", payload.getId(), e.getMessage(), e);
            return ResponseEntity.ok(Map.of("success", false, "message", e.getMessage()));
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
