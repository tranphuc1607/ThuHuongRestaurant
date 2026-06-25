package com.example.dashboardservice.client;

import com.example.dashboardservice.client.dto.OrderStatsDto;
import com.example.dashboardservice.client.dto.BookingStatsDto;
import com.example.dashboardservice.config.FeignConfig;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "order-service", configuration = FeignConfig.class)
public interface OrderServiceClient {

    @GetMapping("/api/v1/orders/stats")
    OrderStatsDto getOrderStats();

    @GetMapping("/api/v1/bookings/stats")
    BookingStatsDto getBookingStats();
}
