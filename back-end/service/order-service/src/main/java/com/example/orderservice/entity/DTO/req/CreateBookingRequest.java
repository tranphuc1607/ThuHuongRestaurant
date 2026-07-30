package com.example.orderservice.entity.DTO.req;

import com.example.orderservice.entity.enums.BookingPaymentMethod;
import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class CreateBookingRequest {

    @NotBlank(message = "Vui lòng nhập họ tên")
    private String customerName;

    @JsonAlias("phone")
    @NotBlank(message = "Vui lòng nhập số điện thoại")
    private String customerPhone;

    private String customerBankAccount;

    private UUID tableId;

    @NotNull(message = "Vui lòng chọn giờ đến")
    private Instant scheduledTime;

    @Valid
    private List<CreateBookingItemRequest> items = new ArrayList<>();

    @JsonAlias("notes")
    private String note;

    private Integer guestCount;

    @NotNull(message = "Vui lòng chọn phương thức thanh toán")
    private BookingPaymentMethod paymentMethod;
}
