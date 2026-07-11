package com.example.userservice.entity.DTO.req;

import lombok.Data;

@Data
public class ProvisionUserRequest {
    private String username;
    private String role;
}
