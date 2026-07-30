package com.example.hrservice.entity.DTO.req;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class FaceCheckinRequest {

    @NotNull(message = "Thiếu employeeId")
    private UUID employeeId;
}
