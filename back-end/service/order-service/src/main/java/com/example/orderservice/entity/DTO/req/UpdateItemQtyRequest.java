package com.example.orderservice.entity.DTO.req;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class UpdateItemQtyRequest {
    @Min(value = 1, message = "Số lượng phải lớn hơn 0")
    private int quantity;
}
