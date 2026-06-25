package com.example.dashboardservice.client;

import com.example.dashboardservice.client.dto.UserStatsDto;
import com.example.dashboardservice.config.FeignConfig;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "user-service", configuration = FeignConfig.class)
public interface UserServiceClient {

    @GetMapping("/api/v1/users/stats")
    UserStatsDto getUserStats();
}
