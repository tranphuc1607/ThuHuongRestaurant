package com.example.userservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserStatsResponse {
    private long activeAdmin;
    private long activeEmployee;
    private long totalActive;
}
