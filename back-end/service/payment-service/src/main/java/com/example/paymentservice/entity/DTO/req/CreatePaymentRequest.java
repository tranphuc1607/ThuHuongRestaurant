package com.example.paymentservice.entity.DTO.req;

import com.example.paymentservice.entity.enums.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreatePaymentRequest {

    @NotNull(message = "Vui lòng chọn đơn hàng")
    private UUID orderId;

    @NotNull(message = "Vui lòng chọn phương thức thanh toán")
    private PaymentMethod paymentMethod;

    private String note;

    private Double amount; // null = tự động tính phần còn lại
}
