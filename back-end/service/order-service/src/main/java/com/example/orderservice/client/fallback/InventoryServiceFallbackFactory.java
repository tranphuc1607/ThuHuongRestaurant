package com.example.orderservice.client.fallback;

import com.example.orderservice.client.InventoryServiceClient;
import com.example.orderservice.client.dto.OrderDeductionPayload;
import com.example.orderservice.client.dto.StockCheckPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.openfeign.FallbackFactory;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class InventoryServiceFallbackFactory implements FallbackFactory<InventoryServiceClient> {

    private final ObjectMapper objectMapper;

    @Override
    public InventoryServiceClient create(Throwable cause) {
        return new InventoryServiceClient() {

            @Override
            public Map<String, Object> deductForOrder(OrderDeductionPayload payload) {
                String msg = extractMessage(cause);
                log.error("inventory-service lỗi khi trừ kho đơn {}: {}", payload.getOrderId(), msg);
                throw new RuntimeException(msg);
            }

            @Override
            public List<Map<String, Object>> stockCheck(StockCheckPayload payload) {
                log.warn("inventory-service không phản hồi khi kiểm tra tồn kho, bỏ qua cảnh báo");
                return Collections.emptyList();
            }

            @Override
            public Map<String, Object> restoreForBooking(OrderDeductionPayload payload) {
                String msg = extractMessage(cause);
                log.warn("inventory-service lỗi khi hoàn kho {}: {}", payload.getOrderId(), msg);
                throw new RuntimeException(msg);
            }

            private String extractMessage(Throwable t) {
                if (t instanceof FeignException fe) {
                    try {
                        String body = fe.contentUTF8();
                        if (body != null && !body.isBlank()) {
                            Map<?, ?> map = objectMapper.readValue(body, Map.class);
                            String msg = map.get("message") != null ? map.get("message").toString() : null;
                            String err = map.get("error") != null ? map.get("error").toString() : null;
                            // GlobalExceptionHandler đặt lỗi cụ thể vào "error", "message" là chuỗi generic
                            if (msg != null && !isGenericMsg(msg)) return msg;
                            if (err != null && !isGenericMsg(err)) return err;
                            if (msg != null) return msg;
                        }
                    } catch (Exception ignored) {}
                    return "inventory-service trả về lỗi HTTP " + fe.status();
                }
                return "inventory-service tạm thời không khả dụng — vui lòng thử lại sau";
            }

            private boolean isGenericMsg(String s) {
                return s.contains("Exception") || s.equals("Bad Request") || s.equals("OK")
                        || s.equals("Unauthorized") || s.equals("Forbidden") || s.equals("Not Found")
                        || s.equals("Internal Server Error");
            }
        };
    }
}
