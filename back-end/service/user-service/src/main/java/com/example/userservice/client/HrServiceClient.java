package com.example.userservice.client;

import com.example.userservice.client.dto.CreateHrEmployeeRequest;
import com.example.userservice.config.FeignConfig;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "hr-service", configuration = FeignConfig.class)
public interface HrServiceClient {

    @PostMapping("/api/v1/hr/employees")
    Object createEmployee(@RequestBody CreateHrEmployeeRequest req);
}
