package com.example.paymentservice.entity.DTO.req;

import com.example.paymentservice.entity.enums.PaymentMethod;
import lombok.Data;

@Data
public class CustomerPaymentRequest {
    private String qrToken;
    private PaymentMethod paymentMethod; // CASH hoặc BANK_TRANSFER
}
