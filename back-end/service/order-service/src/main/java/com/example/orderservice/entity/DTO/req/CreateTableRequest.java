package com.example.orderservice.entity.DTO.req;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateTableRequest {

    @NotNull(message = "Số bàn không được để trống")
    @Min(value = 1, message = "Số bàn phải lớn hơn 0")
    private Integer tableNumber;

    @NotBlank(message = "Tên bàn không được để trống")
    private String name;

    private String note;
}
