package com.example.inventoryservice.entity.dto.req;

import com.example.inventoryservice.entity.enums.BaseUnit;
import com.example.inventoryservice.entity.enums.IngredientCategory;
import com.example.inventoryservice.entity.enums.ManagementType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class IngredientCreateRequest {

    @NotBlank(message = "Tên nguyên liệu không được để trống")
    @Size(max = 200)
    private String name;

    @NotNull(message = "Đơn vị lưu kho không được để trống")
    private BaseUnit baseUnit;

    @NotNull(message = "Danh mục không được để trống")
    private IngredientCategory category;

    @NotNull(message = "Cách quản lý không được để trống")
    private ManagementType managementType;

    @Min(value = 0, message = "Ngưỡng tồn kho tối thiểu không được âm")
    private Double minThreshold = 0.0;
}
