package com.example.hrservice.controller;

import com.example.hrservice.entity.DTO.req.PunishRequest;
import com.example.hrservice.entity.DTO.req.UpdateAttendanceRequest;
import com.example.hrservice.entity.DTO.res.AttendanceResponse;
import com.example.hrservice.service.AttendanceService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/hr/attendance")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AttendanceController {

    private final AttendanceService attendanceService;

    @GetMapping
    public ResponseEntity<Page<AttendanceResponse>> getAll(
            @RequestParam(required = false) Long employeeId,
            @RequestParam(defaultValue = "0") int month,
            @RequestParam(defaultValue = "0") int year,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        // Mặc định tháng + năm hiện tại nếu không truyền
        YearMonth ym = (month <= 0 || year <= 0)
                ? YearMonth.now()
                : YearMonth.of(year, month);
        return ResponseEntity.ok(attendanceService.getAll(employeeId, ym.getMonthValue(), ym.getYear(), page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AttendanceResponse> getById(@PathVariable Long id) throws MessageException {
        return ResponseEntity.ok(attendanceService.getById(id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<AttendanceResponse> update(@PathVariable Long id,
                                                      @RequestBody @Valid UpdateAttendanceRequest req,
                                                      @AuthenticationPrincipal Jwt jwt) throws MessageException {
        return ResponseEntity.ok(attendanceService.update(id, req, jwt.getSubject()));
    }

    @PostMapping("/{id}/punish")
    public ResponseEntity<AttendanceResponse> punish(@PathVariable Long id,
                                                      @RequestBody @Valid PunishRequest req) throws MessageException {
        return ResponseEntity.ok(attendanceService.punish(id, req));
    }

    @DeleteMapping("/{id}/punish")
    public ResponseEntity<AttendanceResponse> removePunishment(@PathVariable Long id) throws MessageException {
        return ResponseEntity.ok(attendanceService.removePunishment(id));
    }
}
