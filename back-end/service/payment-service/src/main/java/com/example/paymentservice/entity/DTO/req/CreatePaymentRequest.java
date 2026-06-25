package com.example.paymentservice.entity.DTO.req;

import com.example.paymentservice.entity.enums.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreatePaymentRequest {

    @NotNull(message = "Vui lòng chọn đơn hàng")
    private Long orderId;

    @NotNull(message = "Vui lòng chọn phương thức thanh toán")
    private PaymentMethod paymentMethod;

    private String note;
}
