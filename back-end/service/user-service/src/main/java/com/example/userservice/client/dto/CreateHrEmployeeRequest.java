package com.example.userservice.client.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class CreateHrEmployeeRequest {
    private String name;
    private String phone;
    private Long userId;
    private String type;
    private String salaryType;
    private Double baseValue;
}
