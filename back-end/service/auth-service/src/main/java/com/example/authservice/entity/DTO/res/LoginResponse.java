package com.example.authservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class LoginResponse {
    private String accessToken;
    private String tokenType;
    private Long expiresIn;

    private UserInfo user;

    @Data
    @Builder 
    public static class UserInfo {
        private UUID id;
        private String username;
        private String role;
    }
}