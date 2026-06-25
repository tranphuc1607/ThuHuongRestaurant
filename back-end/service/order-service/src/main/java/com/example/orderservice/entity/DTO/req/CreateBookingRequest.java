package com.example.orderservice.entity.DTO.req;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
public class CreateBookingRequest {

    @NotBlank(message = "Vui lòng nhập họ tên")
    private String customerName;

    @NotBlank(message = "Vui lòng nhập số điện thoại")
    private String customerPhone;

    private String customerBankAccount;

    private Long tableId;

    @NotNull(message = "Vui lòng chọn giờ đến")
    private Instant scheduledTime;

    @NotEmpty(message = "Vui lòng chọn ít nhất 1 món")
    @Valid
    private List<CreateBookingItemRequest> items;

    private String note;
}
