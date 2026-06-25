package com.example.paymentservice.entity.DTO.req;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class SepayWebhookPayload {

    private Long id;
    private String gateway;
    private String transactionDate;
    private String accountNumber;
    private String content;       // "TH42 thanh toan" — field để parse paymentId
    private String transferType;  // "in" hoặc "out"
    private Double transferAmount;
    private Double accumulated;
    private String referenceCode; // mã giao dịch ngân hàng
    private String subAccount;
}
