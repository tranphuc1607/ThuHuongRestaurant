package com.example.hrservice.controller;

import com.example.hrservice.entity.DTO.req.AssignShiftRequest;
import com.example.hrservice.entity.DTO.req.CreateShiftRequest;
import com.example.hrservice.entity.DTO.res.ShiftAssignmentResponse;
import com.example.hrservice.entity.DTO.res.ShiftResponse;
import com.example.hrservice.service.ShiftService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/hr/shifts")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class ShiftController {

    private final ShiftService shiftService;

    @GetMapping
    public ResponseEntity<List<ShiftResponse>> getAll() {
        return ResponseEntity.ok(shiftService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ShiftResponse> getById(@PathVariable UUID id) throws MessageException {
        return ResponseEntity.ok(shiftService.getById(id));
    }

    @PostMapping
    public ResponseEntity<ShiftResponse> create(@RequestBody @Valid CreateShiftRequest req) {
        return ResponseEntity.ok(shiftService.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ShiftResponse> update(@PathVariable UUID id,
                                                 @RequestBody @Valid CreateShiftRequest req) throws MessageException {
        return ResponseEntity.ok(shiftService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deactivate(@PathVariable UUID id) throws MessageException {
        shiftService.deactivate(id);
        return ResponseEntity.ok(Map.of("message", "Đã vô hiệu hóa ca làm"));
    }

    @PostMapping("/assign")
    public ResponseEntity<List<ShiftAssignmentResponse>> assignShift(@RequestBody @Valid AssignShiftRequest req) throws MessageException {
        return ResponseEntity.ok(shiftService.assignShift(req));
    }

    @GetMapping("/assignments")
    public ResponseEntity<List<ShiftAssignmentResponse>> getAssignments(@RequestParam UUID employeeId) {
        return ResponseEntity.ok(shiftService.getAssignments(employeeId));
    }

    @GetMapping("/schedule")
    public ResponseEntity<List<ShiftAssignmentResponse>> getSchedule(
            @RequestParam(defaultValue = "0") int weekOffset) {
        return ResponseEntity.ok(shiftService.getWeekSchedule(weekOffset));
    }

    @DeleteMapping("/assignments/{assignmentId}")
    public ResponseEntity<Map<String, String>> cancelAssignment(@PathVariable UUID assignmentId) throws MessageException {
        shiftService.cancelAssignment(assignmentId);
        return ResponseEntity.ok(Map.of("message", "Đã hủy phân ca"));
    }

    @DeleteMapping("/assignments/employee/{employeeId}")
    public ResponseEntity<Map<String, Object>> clearEmployeeAssignments(@PathVariable UUID employeeId) throws MessageException {
        int count = shiftService.clearAllAssignments(employeeId);
        return ResponseEntity.ok(Map.of("message", "Đã xóa toàn bộ lịch làm", "count", count));
    }

    @DeleteMapping("/assignments/employee/{employeeId}/week")
    public ResponseEntity<Map<String, Object>> clearEmployeeWeekAssignments(
            @PathVariable UUID employeeId,
            @RequestParam(defaultValue = "0") int weekOffset) throws MessageException {
        int count = shiftService.clearWeekAssignments(employeeId, weekOffset);
        return ResponseEntity.ok(Map.of("message", "Đã xóa lịch tuần", "count", count));
    }
}
