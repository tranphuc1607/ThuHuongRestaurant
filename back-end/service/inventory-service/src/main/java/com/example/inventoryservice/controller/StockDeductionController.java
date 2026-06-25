package com.example.inventoryservice.controller;

import com.example.inventoryservice.entity.dto.req.OrderDeductionRequest;
import com.example.inventoryservice.entity.dto.req.StockAdjustmentRequest;
import com.example.inventoryservice.entity.dto.req.StockCheckRequest;
import com.example.inventoryservice.entity.dto.req.StockDeductionManualRequest;
import com.example.inventoryservice.entity.dto.res.StockDeductionResponse;
import com.example.inventoryservice.entity.enums.DeductionReason;
import com.example.inventoryservice.service.StockDeductionService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/inventory/deductions")
@RequiredArgsConstructor
public class StockDeductionController {

    private final StockDeductionService stockDeductionService;

    @PostMapping("/manual")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<StockDeductionResponse> deductManual(
            @RequestBody @Valid StockDeductionManualRequest req,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(stockDeductionService.deductManual(req, jwt.getSubject()));
    }

    @PostMapping("/adjust")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<StockDeductionResponse> adjust(
            @RequestBody @Valid StockAdjustmentRequest req,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(stockDeductionService.adjust(req, jwt.getSubject()));
    }

    @PostMapping("/order")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<StockDeductionResponse>> deductForOrder(
            @RequestBody @Valid OrderDeductionRequest req,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(stockDeductionService.deductForOrder(req, jwt.getSubject()));
    }

    @PostMapping("/stock-check")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> stockCheck(
            @RequestBody @Valid StockCheckRequest req) throws MessageException {
        return ResponseEntity.ok(stockDeductionService.stockCheck(req));
    }

    @PostMapping("/booking-restore")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<StockDeductionResponse>> restoreForBooking(
            @RequestBody @Valid OrderDeductionRequest req,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(stockDeductionService.restoreForBooking(req, jwt.getSubject()));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Page<StockDeductionResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long ingredientId,
            @RequestParam(required = false) DeductionReason reason) throws MessageException {
        return ResponseEntity.ok(stockDeductionService.getAll(page, size, ingredientId, reason));
    }
}
