package com.example.orderservice.controller;

import com.example.orderservice.entity.DTO.req.CreateTableRequest;
import com.example.orderservice.entity.DTO.req.UpdateTableRequest;
import com.example.orderservice.entity.DTO.res.TableResponse;
import com.example.orderservice.entity.enums.TableStatus;
import com.example.orderservice.service.DiningTableService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/orders/tables")
@RequiredArgsConstructor
public class DiningTableController {

    private final DiningTableService diningTableService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<TableResponse>> getAll(
            @RequestParam(required = false) TableStatus status) {
        if (status != null) {
            return ResponseEntity.ok(diningTableService.getByStatus(status));
        }
        return ResponseEntity.ok(diningTableService.getAll());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<TableResponse> getById(@PathVariable Long id) throws MessageException {
        return ResponseEntity.ok(diningTableService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<TableResponse> create(
            @RequestBody @Valid CreateTableRequest req) throws MessageException {
        return ResponseEntity.ok(diningTableService.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<TableResponse> update(
            @PathVariable Long id,
            @RequestBody @Valid UpdateTableRequest req) throws MessageException {
        return ResponseEntity.ok(diningTableService.update(id, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Object> delete(@PathVariable Long id) throws MessageException {
        diningTableService.delete(id);
        return ResponseEntity.ok(java.util.Map.of("message", "Xóa bàn thành công"));
    }
}
