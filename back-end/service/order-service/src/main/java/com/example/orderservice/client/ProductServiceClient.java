package com.example.orderservice.client;

import com.example.orderservice.client.fallback.ProductServiceFallbackFactory;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Map;
import java.util.UUID;

@FeignClient(name = "product-service", configuration = com.example.orderservice.config.FeignConfig.class, fallbackFactory = ProductServiceFallbackFactory.class)
public interface ProductServiceClient {

    @GetMapping("/api/v1/products/{id}")
    Map<String, Object> getProduct(@PathVariable UUID id);

    // Danh mục sản phẩm AVAILABLE — dùng để build prompt cho AI quét hóa đơn
    @GetMapping("/api/v1/products")
    Map<String, Object> getAvailableProducts(@RequestParam("status") String status, @RequestParam("size") int size);
}
