package com.example.paymentservice.client;

import com.example.paymentservice.client.fallback.OrderServiceFallback;
import com.example.paymentservice.config.FeignConfig;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;
import java.util.UUID;

@FeignClient(name = "order-service", configuration = FeignConfig.class, fallbackFactory = OrderServiceFallback.class)
public interface OrderServiceClient {

    @GetMapping("/api/v1/orders/{orderId}")
    Map<String, Object> getOrder(@PathVariable UUID orderId);

    @PostMapping("/api/v1/orders/{orderId}/checkout-internal")
    Map<String, Object> checkoutInternal(@PathVariable UUID orderId, @RequestBody Map<String, String> body);

    @PostMapping("/api/v1/bookings/confirm-by-code/{bookingCode}")
    Map<String, Object> confirmBookingByCode(@PathVariable String bookingCode);

    @GetMapping("/api/v1/orders/table/{qrToken}")
    Map<String, Object> getOrderByQrToken(@PathVariable String qrToken);
}
