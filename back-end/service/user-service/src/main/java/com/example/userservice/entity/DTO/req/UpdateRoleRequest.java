package com.example.userservice.entity.DTO.req;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateRoleRequest {

    @NotBlank(message = "Role không được để trống")
    private String role;
}
