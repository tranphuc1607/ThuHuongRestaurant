package com.example.inventoryservice.entity;

import com.example.inventoryservice.entity.enums.SaleUnit;
import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.DynamicUpdate;

@Entity
@Table(name = "unit_conversions", indexes = {
        @Index(name = "idx_uc_ingredient_id", columnList = "ingredient_id"),
        @Index(name = "idx_uc_ingredient_sale_unit", columnList = "ingredient_id, sale_unit", unique = true)
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@DynamicUpdate
public class UnitConversion extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Enumerated(EnumType.STRING)
    @Column(name = "sale_unit", nullable = false, length = 20)
    private SaleUnit saleUnit;

    @Column(name = "base_qty_per_sale_unit", nullable = false)
    private Double baseQtyPerSaleUnit;

    @Column(length = 500)
    private String note;
}
