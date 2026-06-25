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
    public ResponseEntity<ShiftResponse> getById(@PathVariable Long id) throws MessageException {
        return ResponseEntity.ok(shiftService.getById(id));
    }

    @PostMapping
    public ResponseEntity<ShiftResponse> create(@RequestBody @Valid CreateShiftRequest req) {
        return ResponseEntity.ok(shiftService.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ShiftResponse> update(@PathVariable Long id,
                                                 @RequestBody @Valid CreateShiftRequest req) throws MessageException {
        return ResponseEntity.ok(shiftService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deactivate(@PathVariable Long id) throws MessageException {
        shiftService.deactivate(id);
        return ResponseEntity.ok(Map.of("message", "Đã vô hiệu hóa ca làm"));
    }

    @PostMapping("/assign")
    public ResponseEntity<List<ShiftAssignmentResponse>> assignShift(@RequestBody @Valid AssignShiftRequest req) throws MessageException {
        return ResponseEntity.ok(shiftService.assignShift(req));
    }

    @GetMapping("/assignments")
    public ResponseEntity<List<ShiftAssignmentResponse>> getAssignments(@RequestParam Long employeeId) {
        return ResponseEntity.ok(shiftService.getAssignments(employeeId));
    }

    @GetMapping("/schedule")
    public ResponseEntity<List<ShiftAssignmentResponse>> getSchedule(
            @RequestParam(defaultValue = "0") int weekOffset) {
        return ResponseEntity.ok(shiftService.getWeekSchedule(weekOffset));
    }
}
