package com.example.orderservice.client;

import com.example.orderservice.client.fallback.ProductServiceFallbackFactory;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

@FeignClient(name = "product-service", fallbackFactory = ProductServiceFallbackFactory.class)
public interface ProductServiceClient {

    @GetMapping("/api/v1/products/{id}")
    Map<String, Object> getProduct(@PathVariable Long id);
}
