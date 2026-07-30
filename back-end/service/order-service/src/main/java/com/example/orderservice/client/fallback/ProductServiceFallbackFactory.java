package com.example.orderservice.client.fallback;

import com.example.orderservice.client.ProductServiceClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.openfeign.FallbackFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ProductServiceFallbackFactory implements FallbackFactory<ProductServiceClient> {

    private final ObjectMapper objectMapper;

    @Override
    public ProductServiceClient create(Throwable cause) {
        return new ProductServiceClient() {
            @Override
            public Map<String, Object> getProduct(java.util.UUID id) {
                if (cause instanceof FeignException fe) {
                    String extracted = extractMessage(fe);
                    log.error("product-service HTTP {} khi lấy sản phẩm id={}: {}", fe.status(), id, extracted);
                    throw new RuntimeException(extracted);
                }
                log.error("product-service không phản hồi khi lấy sản phẩm id={}: {}", id, cause.getMessage());
                throw new RuntimeException("Product service tạm thời không khả dụng — vui lòng thử lại sau");
            }

            @Override
            public Map<String, Object> getAvailableProducts(String status, int size) {
                if (cause instanceof FeignException fe) {
                    log.error("product-service HTTP {} khi tải danh sách sản phẩm: {}", fe.status(), extractMessage(fe));
                } else {
                    log.error("product-service không phản hồi khi tải danh sách sản phẩm: {}", cause.getMessage());
                }
                throw new RuntimeException("Không thể tải danh sách sản phẩm — vui lòng thử lại sau");
            }
        };
    }

    private String extractMessage(FeignException fe) {
        try {
            String body = fe.contentUTF8();
            if (body == null || body.isBlank()) return fe.getMessage();
            Map<?, ?> map = objectMapper.readValue(body, Map.class);
            Object error = map.get("error");
            if (error != null) return error.toString();
            Object msg = map.get("message");
            return msg != null ? msg.toString() : fe.getMessage();
        } catch (Exception ex) {
            return fe.getMessage();
        }
    }
}
