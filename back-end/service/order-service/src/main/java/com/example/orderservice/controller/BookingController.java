package com.example.orderservice.controller;

import com.example.orderservice.entity.DTO.req.CreateBookingRequest;
import com.example.orderservice.entity.DTO.res.BookingResponse;
import com.example.orderservice.entity.DTO.res.BookingStatsResponse;
import com.example.orderservice.entity.DTO.res.OrderResponse;
import com.example.orderservice.entity.enums.BookingStatus;
import com.example.orderservice.service.BookingService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            @RequestBody @Valid CreateBookingRequest req) throws MessageException {
        return ResponseEntity.ok(bookingService.createBooking(req));
    }

    @GetMapping("/history")
    public ResponseEntity<Page<BookingResponse>> getHistoryByPhone(
            @RequestParam String phone,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(bookingService.getBookingsByPhone(phone, page, size));
    }

    @GetMapping("/{bookingCode}")
    public ResponseEntity<BookingResponse> getByCode(@PathVariable String bookingCode) throws MessageException {
        return ResponseEntity.ok(bookingService.getByCode(bookingCode));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Page<BookingResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to) {
        return ResponseEntity.ok(bookingService.getAll(page, size, status, from, to));
    }

    @PatchMapping("/{id}/confirm")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<BookingResponse> confirmBooking(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(bookingService.confirmBooking(id, jwt.getSubject()));
    }

    @PatchMapping("/{id}/confirm-cash")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<BookingResponse> confirmCashBooking(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(bookingService.confirmCashBooking(id, jwt.getSubject()));
    }

    @PatchMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('ROLE_EMPLOYEE')")
    public ResponseEntity<BookingResponse> completeBooking(@PathVariable Long id) throws MessageException {
        return ResponseEntity.ok(bookingService.completeBooking(id));
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<BookingResponse> cancelBooking(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        String reason = body.getOrDefault("cancelReason", "");
        return ResponseEntity.ok(bookingService.cancelBooking(id, jwt.getSubject(), reason));
    }

    @PostMapping("/{id}/checkout-to-order")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('ROLE_EMPLOYEE')")
    public ResponseEntity<OrderResponse> checkoutToOrder(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        Long tableId = null;
        if (body != null && body.get("tableId") instanceof Number n) {
            tableId = n.longValue();
        }
        return ResponseEntity.ok(bookingService.checkoutToOrder(id, tableId, jwt.getSubject()));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<BookingStatsResponse> getStats() {
        return ResponseEntity.ok(bookingService.getStats());
    }

    @PostMapping("/confirm-by-code/{bookingCode}")
    public ResponseEntity<?> confirmBookingByCode(@PathVariable String bookingCode) throws MessageException {
        bookingService.confirmBookingByCode(bookingCode);
        return ResponseEntity.ok(Map.of("message", "Booking đã được xác nhận"));
    }

    @PatchMapping("/cancel/{bookingCode}")
    public ResponseEntity<BookingResponse> customerCancelBooking(
            @PathVariable String bookingCode,
            @RequestBody Map<String, String> body) throws MessageException {
        String phone = body.getOrDefault("customerPhone", "");
        if (phone.isBlank()) throw new com.example.restaurant_common.util.exception.MessageException("Vui lòng nhập số điện thoại để xác minh.");
        String reason = body.getOrDefault("cancelReason", "Khách tự hủy");
        return ResponseEntity.ok(bookingService.customerCancelBooking(bookingCode, phone, reason));
    }
}
