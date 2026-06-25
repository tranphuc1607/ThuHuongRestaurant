package com.example.inventoryservice.entity;

import com.example.inventoryservice.entity.enums.SaleUnit;
import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "inventory_imports", indexes = {
        @Index(name = "idx_import_ingredient_id", columnList = "ingredient_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InventoryImport extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    // Số lượng theo đơn vị cơ sở (sau quy đổi) — dùng để cộng vào currentQty
    @Column(name = "quantity_imported", nullable = false)
    private Double quantityImported;

    // Đơn vị nhập thực tế (null = nhập theo đơn vị cơ sở)
    @Enumerated(EnumType.STRING)
    @Column(name = "sale_unit", length = 20)
    private SaleUnit saleUnit;

    // Số lượng theo đơn vị nhập thực tế (để hiển thị lịch sử)
    @Column(name = "sale_qty_imported")
    private Double saleQtyImported;

    @Column(name = "unit_cost", nullable = false)
    private Double unitCost;

    @Column(name = "total_cost", nullable = false)
    private Double totalCost;

    @Column(name = "purchase_note", length = 500)
    private String purchaseNote;

    @Column(name = "imported_by", length = 100)
    private String importedBy;

    @Column(length = 500)
    private String note;
}
