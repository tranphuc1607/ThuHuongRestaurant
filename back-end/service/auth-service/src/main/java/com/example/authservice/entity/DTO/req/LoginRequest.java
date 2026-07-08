package com.example.authservice.entity.DTO.req;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {

    @NotBlank(message = "Username không được để trống")
    @Size(max = 100, message = "Username không hợp lệ")
    private String username;

    @NotBlank(message = "Password không được để trống")
    @Size(max = 128, message = "Password không hợp lệ")
    private String password;
}