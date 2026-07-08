package com.example.authservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LoginResponse {
    private String accessToken;
    // refreshToken được gửi qua HttpOnly cookie, không trả trong body để tránh JS đọc được
    private String tokenType;
    private Long expiresIn;

    private UserInfo user;

    @Data
    @Builder 
    public static class UserInfo {
        private Long id;
        private String username;
        private String role;
    }
}