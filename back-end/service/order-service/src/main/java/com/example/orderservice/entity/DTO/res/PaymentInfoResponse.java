package com.example.orderservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PaymentInfoResponse {

    private String bankName;
    private String accountNumber;
    private String accountHolder;
    private Double amount;
    private String transferContent;
    private String vietQrUrl;
}
