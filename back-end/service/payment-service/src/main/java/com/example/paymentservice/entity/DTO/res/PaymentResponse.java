package com.example.paymentservice.entity.DTO.res;

import com.example.paymentservice.entity.Payment;
import com.example.paymentservice.entity.enums.PaymentMethod;
import com.example.paymentservice.entity.enums.PaymentStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class PaymentResponse {

    private UUID id;
    private UUID orderId;
    private Double amount;
    private PaymentMethod paymentMethod;
    private PaymentStatus status;
    private String referenceCode;
    private String paidBy;
    private Instant paidAt;
    private String vietQrUrl;
    private String tableName;
    private Integer tableNumber;
    private String note;
    private Instant createdAt;

    public static PaymentResponse from(Payment p) {
        return PaymentResponse.builder()
                .id(p.getId())
                .orderId(p.getOrderId())
                .amount(p.getAmount())
                .paymentMethod(p.getPaymentMethod())
                .status(p.getStatus())
                .referenceCode(p.getReferenceCode())
                .paidBy(p.getPaidBy())
                .paidAt(p.getPaidAt())
                .vietQrUrl(p.getVietQrUrl())
                .tableName(p.getTableName())
                .tableNumber(p.getTableNumber())
                .note(p.getNote())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
