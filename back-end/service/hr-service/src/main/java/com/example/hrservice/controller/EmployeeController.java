package com.example.hrservice.controller;

import com.example.hrservice.entity.DTO.req.CreateEmployeeRequest;
import com.example.hrservice.entity.DTO.res.EmployeeResponse;
import com.example.hrservice.service.EmployeeService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/hr/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Page<EmployeeResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(employeeService.getAll(page, size, search));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<EmployeeResponse> getById(@PathVariable Long id) throws MessageException {
        return ResponseEntity.ok(employeeService.getById(id));
    }

    @GetMapping("/by-user/{userId}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<EmployeeResponse> getByUserId(@PathVariable Long userId) throws MessageException {
        return ResponseEntity.ok(employeeService.findByUserId(userId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<EmployeeResponse> create(@RequestBody @Valid CreateEmployeeRequest req) throws MessageException {
        return ResponseEntity.ok(employeeService.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<EmployeeResponse> update(@PathVariable Long id,
                                                    @RequestBody @Valid CreateEmployeeRequest req) throws MessageException {
        return ResponseEntity.ok(employeeService.update(id, req));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<EmployeeResponse> deactivate(@PathVariable Long id) throws MessageException {
        return ResponseEntity.ok(employeeService.deactivate(id));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<EmployeeResponse> activate(@PathVariable Long id) throws MessageException {
        return ResponseEntity.ok(employeeService.activate(id));
    }

    // Admin tự link telegramId cho nhân viên (thay vì dùng bot)
    @PatchMapping("/{id}/link-telegram")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<EmployeeResponse> linkTelegramById(@PathVariable Long id,
                                                              @RequestBody Map<String, Long> body) throws MessageException {
        Long telegramId = body.get("telegramId");
        if (telegramId == null) throw new MessageException("Vui lòng cung cấp telegramId");
        return ResponseEntity.ok(employeeService.linkTelegramById(id, telegramId));
    }
}
