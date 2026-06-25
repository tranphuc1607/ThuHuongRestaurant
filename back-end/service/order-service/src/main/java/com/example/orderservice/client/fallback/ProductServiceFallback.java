package com.example.orderservice.client.fallback;

import com.example.orderservice.client.ProductServiceClient;

import java.util.Map;

// Replaced by ProductServiceFallbackFactory — kept for reference only
public class ProductServiceFallback implements ProductServiceClient {

    @Override
    public Map<String, Object> getProduct(Long id) {
        throw new RuntimeException("Product service không khả dụng");
    }
}
