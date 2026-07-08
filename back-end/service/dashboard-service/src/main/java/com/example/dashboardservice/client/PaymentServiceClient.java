package com.example.dashboardservice.client;

import com.example.dashboardservice.client.dto.RevenueDto;
import com.example.dashboardservice.client.dto.RevenuePeriodDto;
import com.example.dashboardservice.config.FeignConfig;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.Instant;
import java.util.List;

@FeignClient(name = "payment-service", configuration = FeignConfig.class)
public interface PaymentServiceClient {

    @GetMapping("/api/v1/payments/revenue")
    RevenueDto getRevenue(@RequestParam Instant from, @RequestParam Instant to);

    @GetMapping("/api/v1/payments/revenue/series")
    List<RevenuePeriodDto> getRevenueSeries(@RequestParam String groupBy, @RequestParam int limit);
}
