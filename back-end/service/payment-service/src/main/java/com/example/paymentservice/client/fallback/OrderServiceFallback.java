package com.example.paymentservice.client.fallback;

import com.example.paymentservice.client.OrderServiceClient;
import feign.FeignException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.openfeign.FallbackFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
public class OrderServiceFallback implements FallbackFactory<OrderServiceClient> {

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
                log.error("order-service không phản hồi khi checkout đơn hàng id={}: {}", orderId, cause.getMessage());
                throw new RuntimeException("Không thể xác nhận thanh toán cho đơn hàng id=" + orderId + " — vui lòng thử lại");
            }

            @Override
            public Map<String, Object> confirmBookingByCode(String bookingCode) {
                log.error("order-service không phản hồi khi confirm booking {}: {}", bookingCode, cause.getMessage());
                throw new RuntimeException("Không thể xác nhận booking " + bookingCode + " — vui lòng thử lại");
            }
        };
    }
}
