package com.example.userservice.entity.DTO.req;

import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UpdateProfileRequest {

    private String fullName;

    private String phone;

    @Email(message = "Email không hợp lệ")
    private String email;
}
