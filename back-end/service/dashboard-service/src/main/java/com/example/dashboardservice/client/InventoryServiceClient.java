package com.example.dashboardservice.client;

import com.example.dashboardservice.client.dto.IngredientDto;
import com.example.dashboardservice.config.FeignConfig;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

@FeignClient(name = "inventory-service", configuration = FeignConfig.class)
public interface InventoryServiceClient {

    @GetMapping("/api/v1/inventory/ingredients/low-stock")
    List<IngredientDto> getLowStock();
}
