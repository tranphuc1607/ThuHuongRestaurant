package com.example.paymentservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
public class RevenueResponse {

    private Double totalRevenue;
    private Long totalTransactions;
    private Map<String, Double> revenueByMethod;
    private Instant from;
    private Instant to;
}
