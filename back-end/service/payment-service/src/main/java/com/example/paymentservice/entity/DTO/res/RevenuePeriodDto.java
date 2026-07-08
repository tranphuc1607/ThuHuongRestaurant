package com.example.paymentservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class RevenuePeriodDto {
    private String period;
    private double revenue;
    private long transactions;
    private Map<String, Double> byMethod;
}
