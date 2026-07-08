package com.example.orderservice.entity.DTO.req;

import jakarta.validation.Valid;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class UpdateBookingItemsRequest {
    @Valid
    private List<CreateBookingItemRequest> items = new ArrayList<>();
}
