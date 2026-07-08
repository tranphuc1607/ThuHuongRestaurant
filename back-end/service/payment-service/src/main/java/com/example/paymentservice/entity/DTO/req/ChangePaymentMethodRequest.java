package com.example.paymentservice.entity.DTO.req;

import com.example.paymentservice.entity.enums.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ChangePaymentMethodRequest {

    @NotNull(message = "Vui lòng chọn phương thức thanh toán mới")
    private PaymentMethod newMethod;
}
