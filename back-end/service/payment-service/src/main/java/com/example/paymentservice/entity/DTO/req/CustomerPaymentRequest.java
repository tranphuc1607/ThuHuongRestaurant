package com.example.paymentservice.entity.DTO.req;

import com.example.paymentservice.entity.enums.PaymentMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CustomerPaymentRequest {
    @NotBlank(message = "QR token không hợp lệ")
    private String qrToken;

    @NotNull(message = "Vui lòng chọn phương thức thanh toán")
    private PaymentMethod paymentMethod; // CASH hoặc BANK_TRANSFER
}
