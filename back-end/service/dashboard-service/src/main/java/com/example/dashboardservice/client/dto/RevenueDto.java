package com.example.dashboardservice.client.dto;

import lombok.Data;

import java.util.Map;

@Data
public class RevenueDto {
    private Double totalRevenue;
    private Long totalTransactions;
    private Map<String, Double> revenueByMethod;
}
