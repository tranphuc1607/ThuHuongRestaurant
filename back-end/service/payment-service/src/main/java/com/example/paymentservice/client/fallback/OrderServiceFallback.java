package com.example.paymentservice.client.fallback;

import com.example.paymentservice.client.OrderServiceClient;
import com.fasterxml.jackson.databind.JsonNode;
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
public class OrderServiceFallback implements FallbackFactory<OrderServiceClient> {

    private final ObjectMapper objectMapper;

    @Override
    public OrderServiceClient create(Throwable cause) {
        return new OrderServiceClient() {

            @Override
            public Map<String, Object> getOrder(Long orderId) {
                if (cause instanceof FeignException.NotFound) {
                    throw new RuntimeException("Không tìm thấy đơn hàng id=" + orderId);
                }
                log.error("order-service không phản hồi khi lấy đơn hàng id={}: {}", orderId, cause.getMessage());
                throw new RuntimeException("Order service tạm thời không khả dụng — vui lòng thử lại sau");
            }

            @Override
            public Map<String, Object> checkoutInternal(Long orderId, Map<String, String> body) {
                String msg = extractMessage(cause,
                        "Không thể thanh toán đơn hàng id=" + orderId + " — vui lòng thử lại");
                log.error("order-service checkout thất bại orderId={}: {}", orderId, cause.getMessage());
                throw new RuntimeException(msg);
            }

            @Override
            public Map<String, Object> confirmBookingByCode(String bookingCode) {
                log.error("order-service không phản hồi khi confirm booking {}: {}", bookingCode, cause.getMessage());
                throw new RuntimeException("Không thể xác nhận booking " + bookingCode + " — vui lòng thử lại");
            }

            @Override
            public Map<String, Object> getOrderByQrToken(String qrToken) {
                log.error("order-service không phản hồi khi lấy order qrToken={}: {}", qrToken, cause.getMessage());
                throw new RuntimeException("Không tìm thấy đơn hàng cho bàn này — vui lòng thử lại");
            }
        };
    }

    private String extractMessage(Throwable cause, String defaultMsg) {
        if (cause instanceof FeignException feignEx) {
            try {
                String body = feignEx.contentUTF8();
                if (body != null && !body.isBlank()) {
                    JsonNode root = objectMapper.readTree(body);
                    JsonNode msgNode = root.get("message");
                    if (msgNode != null && msgNode.isTextual()) {
                        String text = msgNode.asText();
                        if (!text.isBlank() && !text.equals("call api success")) {
                            return text;
                        }
                    }
                }
            } catch (Exception ignored) { }
        }
        return defaultMsg;
    }
}
