package com.example.hrservice.entity.DTO.res;

import com.example.hrservice.entity.Employee;
import com.example.hrservice.entity.enums.EmployeeType;
import com.example.hrservice.entity.enums.SalaryType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class EmployeeResponse {

    private Long id;
    private Long userId;
    private Long telegramId;
    private String name;
    private String phone;
    private EmployeeType type;
    private SalaryType salaryType;
    private Double baseValue;
    private Integer targetDays;
    private boolean active;
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
                .createdAt(e.getCreatedAt())
                .build();
    }
}
