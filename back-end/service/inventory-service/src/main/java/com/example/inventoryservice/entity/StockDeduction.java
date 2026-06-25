package com.example.inventoryservice.entity;

import com.example.inventoryservice.entity.enums.DeductionReason;
import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "stock_deductions", indexes = {
        @Index(name = "idx_deduction_ingredient_id", columnList = "ingredient_id"),
        @Index(name = "idx_deduction_reference_id", columnList = "reference_id"),
        @Index(name = "idx_deduction_reason", columnList = "reason")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StockDeduction extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    // dương = xuất kho, âm = điều chỉnh tăng kho (ADJUSTMENT reason)
    @Column(name = "qty_deducted", nullable = false)
    private Double qtyDeducted;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeductionReason reason;

    @Column(name = "reference_id", length = 100)
    private String referenceId;

    @Column(name = "deducted_by", length = 100)
    private String deductedBy;

    @Column(length = 500)
    private String note;
}
