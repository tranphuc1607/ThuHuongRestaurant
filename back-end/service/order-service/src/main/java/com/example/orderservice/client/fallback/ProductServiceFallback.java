package com.example.orderservice.client.fallback;

import com.example.orderservice.client.ProductServiceClient;

import java.util.Map;
import java.util.UUID;

// Replaced by ProductServiceFallbackFactory — kept for reference only
public class ProductServiceFallback implements ProductServiceClient {

    @Override
    public Map<String, Object> getProduct(UUID id) {
        throw new RuntimeException("Product service không khả dụng");
    }

    @Override
    public Map<String, Object> getAvailableProducts(String status, int size) {
        throw new RuntimeException("Product service không khả dụng");
    }
}
