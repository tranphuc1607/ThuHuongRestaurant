package com.example.hrservice.controller;

import com.example.hrservice.entity.DTO.res.PayrollResponse;
import com.example.hrservice.service.PayrollService;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.List;

@RestController
@RequestMapping("/api/v1/hr/payroll")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class PayrollController {

    private final PayrollService payrollService;

    @GetMapping
    public ResponseEntity<List<PayrollResponse>> calculateAll(
            @RequestParam(defaultValue = "0") int month,
            @RequestParam(defaultValue = "0") int year) {
        YearMonth ym = (month <= 0 || year <= 0) ? YearMonth.now() : YearMonth.of(year, month);
        return ResponseEntity.ok(payrollService.calculateAll(ym.getMonthValue(), ym.getYear()));
    }

    @GetMapping("/{employeeId}")
    public ResponseEntity<PayrollResponse> calculateOne(@PathVariable Long employeeId,
                                                         @RequestParam(defaultValue = "0") int month,
                                                         @RequestParam(defaultValue = "0") int year) throws MessageException {
        YearMonth ym = (month <= 0 || year <= 0) ? YearMonth.now() : YearMonth.of(year, month);
        return ResponseEntity.ok(payrollService.calculateOne(employeeId, ym.getMonthValue(), ym.getYear()));
    }
}
