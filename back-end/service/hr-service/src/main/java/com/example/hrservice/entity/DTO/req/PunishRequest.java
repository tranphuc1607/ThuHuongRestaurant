package com.example.hrservice.entity.DTO.req;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class PunishRequest {

    @Positive(message = "Số tiền phạt phải lớn hơn 0")
    private Double amount;

    @NotBlank(message = "Lý do phạt không được để trống")
    private String reason;
}
