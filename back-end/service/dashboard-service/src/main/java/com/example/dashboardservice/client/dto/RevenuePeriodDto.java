package com.example.dashboardservice.client.dto;

import lombok.Data;

import java.util.Map;

@Data
public class RevenuePeriodDto {
    private String period;
    private double revenue;
    private long transactions;
    private Map<String, Double> byMethod;
}
