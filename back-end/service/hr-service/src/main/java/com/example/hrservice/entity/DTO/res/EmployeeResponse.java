package com.example.hrservice.entity.DTO.res;

import com.example.hrservice.entity.Employee;
import com.example.hrservice.entity.enums.EmployeeType;
import com.example.hrservice.entity.enums.SalaryType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class EmployeeResponse {

    private UUID id;
    private UUID userId;
    private Long telegramId;
    private String name;
    private String phone;
    private EmployeeType type;
    private SalaryType salaryType;
    private Double baseValue;
    private Integer targetDays;
    private boolean active;
    private boolean hasFace;
    private Instant createdAt;

    public static EmployeeResponse from(Employee e) {
        return EmployeeResponse.builder()
                .id(e.getId())
                .userId(e.getUserId())
                .telegramId(e.getTelegramId())
                .name(e.getName())
                .phone(e.getPhone())
                .type(e.getType())
                .salaryType(e.getSalaryType())
                .baseValue(e.getBaseValue())
                .targetDays(e.getTargetDays())
                .active(e.isActive())
                .hasFace(e.getFaceDescriptor() != null && !e.getFaceDescriptor().isBlank())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
