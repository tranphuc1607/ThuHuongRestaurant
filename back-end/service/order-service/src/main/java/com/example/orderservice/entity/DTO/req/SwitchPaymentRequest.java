package com.example.orderservice.entity.DTO.req;

import com.example.orderservice.entity.enums.BookingPaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SwitchPaymentRequest {
    @NotNull(message = "Phương thức thanh toán không được để trống")
    private BookingPaymentMethod paymentMethod;
}
