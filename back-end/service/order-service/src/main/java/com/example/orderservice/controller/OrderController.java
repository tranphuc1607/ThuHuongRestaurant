package com.example.orderservice.controller;

import com.example.orderservice.entity.DTO.req.AddOrderItemRequest;
import com.example.orderservice.entity.DTO.req.AddSurchargeRequest;
import com.example.orderservice.entity.DTO.req.CreateOrderRequest;
import com.example.orderservice.entity.DTO.req.UpdateItemQtyRequest;
import com.example.orderservice.entity.DTO.res.OrderResponse;
import com.example.orderservice.entity.DTO.res.OrderStatsResponse;
import com.example.orderservice.entity.enums.OrderStatus;
import com.example.orderservice.service.OrderService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;
import java.util.Map;
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
            @RequestParam(required = false) Long tableId,
            @RequestParam(required = false) OrderStatus status) throws MessageException {
        return ResponseEntity.ok(orderService.getAll(page, size, tableId, status));
    }

    @GetMapping("/table/{qrToken}")
    public ResponseEntity<Object> getCurrentOrderByQrToken(
            @PathVariable String qrToken) throws MessageException {
        return ResponseEntity.ok(orderService.getCurrentOrderByQrToken(qrToken));
    }

    @GetMapping("/{orderId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> getById(@PathVariable Long orderId) throws MessageException {
        return ResponseEntity.ok(orderService.getById(orderId));
    }

    @PostMapping("/{orderId}/items")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> addItem(
            @PathVariable Long orderId,
            @RequestBody @Valid AddOrderItemRequest req) throws MessageException {
        return ResponseEntity.ok(orderService.addItem(orderId, req));
    }

    @PatchMapping("/{orderId}/items/{itemId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> updateItemQty(
            @PathVariable Long orderId,
            @PathVariable Long itemId,
            @RequestBody @Valid UpdateItemQtyRequest req) throws MessageException {
        return ResponseEntity.ok(orderService.updateItemQty(orderId, itemId, req.getQuantity()));
    }

    @DeleteMapping("/{orderId}/items/{itemId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> removeItem(
            @PathVariable Long orderId,
            @PathVariable Long itemId) throws MessageException {
        return ResponseEntity.ok(orderService.removeItem(orderId, itemId));
    }

    @PostMapping("/{orderId}/checkout")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> checkout(
            @PathVariable Long orderId,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(orderService.checkout(orderId, jwt.getSubject()));
    }

    @PostMapping("/{orderId}/cancel")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> cancelOrder(
            @PathVariable Long orderId,
            @RequestBody(required = false) Map<String, String> body) throws MessageException {
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(orderService.cancelOrder(orderId, reason));
    }

    @PostMapping("/{orderId}/surcharges")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> addSurcharge(
            @PathVariable Long orderId,
            @RequestBody @Valid AddSurchargeRequest req) throws MessageException {
        return ResponseEntity.ok(orderService.addSurcharge(orderId, req));
    }

    @DeleteMapping("/{orderId}/surcharges/{surchargeId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<OrderResponse> removeSurcharge(
            @PathVariable Long orderId,
            @PathVariable Long surchargeId) throws MessageException {
        return ResponseEntity.ok(orderService.removeSurcharge(orderId, surchargeId));
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
            @PathVariable Long orderId,
            @RequestBody Map<String, String> body) throws MessageException {
        String paidBy = body.getOrDefault("paidBy", "payment-service");
        return ResponseEntity.ok(orderService.checkout(orderId, paidBy));
    }
}
