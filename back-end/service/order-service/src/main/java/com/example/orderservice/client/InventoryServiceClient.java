package com.example.orderservice.client;

import com.example.orderservice.client.dto.OrderDeductionPayload;
import com.example.orderservice.client.dto.StockCheckPayload;
import com.example.orderservice.client.fallback.InventoryServiceFallbackFactory;
import com.example.orderservice.config.FeignConfig;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;
import java.util.Map;

@FeignClient(name = "inventory-service", configuration = FeignConfig.class, fallbackFactory = InventoryServiceFallbackFactory.class)
public interface InventoryServiceClient {

    @PostMapping("/api/v1/inventory/deductions/order")
    Map<String, Object> deductForOrder(@RequestBody OrderDeductionPayload payload);

    @PostMapping("/api/v1/inventory/deductions/stock-check")
    List<Map<String, Object>> stockCheck(@RequestBody StockCheckPayload payload);

    @PostMapping("/api/v1/inventory/deductions/booking-restore")
    Map<String, Object> restoreForBooking(@RequestBody OrderDeductionPayload payload);
}
