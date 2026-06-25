package com.example.orderservice.client.fallback;

import com.example.orderservice.client.InventoryServiceClient;
import com.example.orderservice.client.dto.OrderDeductionPayload;
import com.example.orderservice.client.dto.StockCheckPayload;
import java.util.Collections;
import java.util.List;
import java.util.Map;

// Replaced by InventoryServiceFallbackFactory — kept for reference only
public class InventoryServiceFallback implements InventoryServiceClient {

    @Override
    public Map<String, Object> deductForOrder(OrderDeductionPayload payload) {
        throw new RuntimeException("Inventory service không khả dụng");
    }

    @Override
    public List<Map<String, Object>> stockCheck(StockCheckPayload payload) {
        return Collections.emptyList();
    }

    @Override
    public Map<String, Object> restoreForBooking(OrderDeductionPayload payload) {
        throw new RuntimeException("Inventory service không khả dụng");
    }
}
