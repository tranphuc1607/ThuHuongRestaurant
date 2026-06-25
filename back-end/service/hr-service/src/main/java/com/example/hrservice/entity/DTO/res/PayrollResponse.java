package com.example.hrservice.entity.DTO.res;

import com.example.hrservice.entity.enums.EmployeeType;
import com.example.hrservice.entity.enums.SalaryType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PayrollResponse {

    private Long employeeId;
    private String employeeName;
    private EmployeeType employeeType;
    private SalaryType salaryType;
    private Double baseValue;
    private Integer targetDays;

    private int month;
    private int year;

    private long actualWorkDays;
    private Double totalHours;
    private Double totalPunishment;
    private Double gross;
    private Double net;
}
