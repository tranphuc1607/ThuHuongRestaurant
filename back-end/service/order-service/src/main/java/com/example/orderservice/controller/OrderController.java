package com.example.orderservice.controller;

import com.example.orderservice.entity.DTO.req.AddOrderItemRequest;
import com.example.orderservice.entity.DTO.req.AddSurchargeRequest;
import com.example.orderservice.entity.DTO.req.CreateOrderRequest;
import com.example.orderservice.entity.DTO.req.ScanFeedbackRequest;
import com.example.orderservice.entity.DTO.req.ScanReceiptRequest;
import com.example.orderservice.entity.DTO.req.UpdateItemQtyRequest;
import com.example.orderservice.entity.DTO.res.OrderResponse;
import com.example.orderservice.entity.DTO.res.OrderStatsResponse;
import com.example.orderservice.entity.DTO.res.ReceiptScanResponse;
import com.example.orderservice.entity.enums.OrderStatus;
import com.example.orderservice.service.OrderService;
import com.example.orderservice.service.ReceiptScanService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final ReceiptScanService receiptScanService;

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> createOrder(
            @RequestBody @Valid CreateOrderRequest req,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(orderService.createOrder(req, jwt.getSubject()));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Page<OrderResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID tableId,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) throws MessageException {
        Instant fromInstant = from != null && !from.isBlank() ? Instant.parse(from) : null;
        Instant toInstant   = to   != null && !to.isBlank()   ? Instant.parse(to)   : null;
        return ResponseEntity.ok(orderService.getAll(page, size, tableId, status, fromInstant, toInstant));
    }

    @GetMapping("/table/{qrToken}")
    public ResponseEntity<Object> getCurrentOrderByQrToken(
            @PathVariable String qrToken) throws MessageException {
        return ResponseEntity.ok(orderService.getCurrentOrderByQrToken(qrToken));
    }

    @GetMapping("/{orderId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> getById(@PathVariable UUID orderId) throws MessageException {
        return ResponseEntity.ok(orderService.getById(orderId));
    }

    @PostMapping("/{orderId}/items")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> addItem(
            @PathVariable UUID orderId,
            @RequestBody @Valid AddOrderItemRequest req) throws MessageException {
        return ResponseEntity.ok(orderService.addItem(orderId, req));
    }

    @PatchMapping("/{orderId}/items/{itemId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> updateItemQty(
            @PathVariable UUID orderId,
            @PathVariable UUID itemId,
            @RequestBody @Valid UpdateItemQtyRequest req) throws MessageException {
        return ResponseEntity.ok(orderService.updateItemQty(orderId, itemId, req.getQuantity()));
    }

    @DeleteMapping("/{orderId}/items/{itemId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> removeItem(
            @PathVariable UUID orderId,
            @PathVariable UUID itemId) throws MessageException {
        return ResponseEntity.ok(orderService.removeItem(orderId, itemId));
    }

    @PostMapping("/{orderId}/checkout")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> checkout(
            @PathVariable UUID orderId,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(orderService.checkout(orderId, jwt.getSubject()));
    }

    @PostMapping("/{orderId}/cancel")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> cancelOrder(
            @PathVariable UUID orderId,
            @RequestBody(required = false) Map<String, String> body) throws MessageException {
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(orderService.cancelOrder(orderId, reason));
    }

    @PostMapping("/{orderId}/surcharges")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> addSurcharge(
            @PathVariable UUID orderId,
            @RequestBody @Valid AddSurchargeRequest req) throws MessageException {
        return ResponseEntity.ok(orderService.addSurcharge(orderId, req));
    }

    @DeleteMapping("/{orderId}/surcharges/{surchargeId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> removeSurcharge(
            @PathVariable UUID orderId,
            @PathVariable UUID surchargeId) throws MessageException {
        return ResponseEntity.ok(orderService.removeSurcharge(orderId, surchargeId));
    }

    // Quét hóa đơn: đọc ảnh bằng AI vision, khớp với sản phẩm thật — chỉ phân tích, không tạo order/item
    @PostMapping("/scan-receipt")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<ReceiptScanResponse> scanReceipt(
            @RequestBody @Valid ScanReceiptRequest req) throws MessageException {
        return ResponseEntity.ok(receiptScanService.scan(req));
    }

    // Học từ nhân viên: ghi lại chữ viết tay này ứng với món nào để lần sau quét chính xác hơn
    @PostMapping("/scan-receipt/feedback")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Map<String, Object>> scanFeedback(
            @RequestBody @Valid ScanFeedbackRequest req) {
        int saved = receiptScanService.recordFeedback(req);
        return ResponseEntity.ok(Map.of("saved", saved));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderStatsResponse> getStats(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(orderService.getStats(date));
    }

    // Endpoint nội bộ: chỉ được gọi từ payment-service qua Feign, không qua API gateway
    @PostMapping("/{orderId}/checkout-internal")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> checkoutInternal(
            @PathVariable UUID orderId,
            @RequestBody Map<String, String> body) throws MessageException {
        String paidBy = body.getOrDefault("paidBy", "payment-service");
        return ResponseEntity.ok(orderService.checkout(orderId, paidBy));
    }
}
