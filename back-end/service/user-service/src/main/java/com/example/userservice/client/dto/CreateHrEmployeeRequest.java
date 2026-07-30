package com.example.userservice.client.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class CreateHrEmployeeRequest {
    private String name;
    private String phone;
    private UUID userId;
    private String type;
    private String salaryType;
    private Double baseValue;
}
