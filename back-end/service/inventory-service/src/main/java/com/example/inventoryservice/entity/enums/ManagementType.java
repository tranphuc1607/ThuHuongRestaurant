package com.example.inventoryservice.entity.enums;

public enum ManagementType {
    AUTO,       // Đồ uống: tự trừ kho qua UnitConversion khi bán
    RECIPE,     // Đồ ăn: trừ kho theo công thức Recipe
    PERIODIC    // Gia vị: chỉ kiểm kê định kỳ, không trừ tự động
}
