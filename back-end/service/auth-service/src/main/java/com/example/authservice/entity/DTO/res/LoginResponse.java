package com.example.authservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LoginResponse {
    private String accessToken;
    private String refreshToken;
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