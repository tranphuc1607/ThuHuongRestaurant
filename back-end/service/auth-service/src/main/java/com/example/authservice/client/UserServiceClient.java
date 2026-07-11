package com.example.authservice.client;

import com.example.authservice.client.dto.ProvisionUserRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "user-service")
public interface UserServiceClient {

    @PostMapping("/api/v1/users/provision")
    void provision(@RequestBody ProvisionUserRequest request);
}
