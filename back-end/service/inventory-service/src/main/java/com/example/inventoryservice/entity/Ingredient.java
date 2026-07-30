package com.example.inventoryservice.entity;

import com.example.inventoryservice.entity.enums.BaseUnit;
import com.example.inventoryservice.entity.enums.IngredientCategory;
import com.example.inventoryservice.entity.enums.ManagementType;
import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.util.UUID;

@Entity
@Table(name = "ingredients", indexes = {
    @Index(name = "idx_ingredient_category", columnList = "category"),
    @Index(name = "idx_ingredient_management_type", columnList = "management_type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@DynamicUpdate
@SQLDelete(sql = "UPDATE ingredients SET is_active = false WHERE id = ?")
@SQLRestriction("is_active = true")
public class Ingredient extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String name;

    // Đơn vị lưu kho chuẩn (LIT, KG, CHAI...)
    @Enumerated(EnumType.STRING)
    @Column(name = "base_unit", nullable = false, length = 20)
    private BaseUnit baseUnit;

    // Số lượng tồn kho hiện tại (theo baseUnit)
    @Builder.Default
    @Column(name = "current_qty", nullable = false)
    private Double currentQty = 0.0;

    // Giá vốn bình quân gia quyền (VND / baseUnit)
    @Builder.Default
    @Column(name = "average_cost", nullable = false)
    private Double averageCost = 0.0;

    // Ngưỡng cảnh báo tồn kho tối thiểu
    @Builder.Default
    @Column(name = "min_threshold", nullable = false)
    private Double minThreshold = 0.0;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 50)
    private IngredientCategory category;

    // Cách quản lý: AUTO (đồ uống), RECIPE (đồ ăn), PERIODIC (gia vị)
    @Enumerated(EnumType.STRING)
    @Column(name = "management_type", nullable = false, length = 20)
    private ManagementType managementType;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;
}
