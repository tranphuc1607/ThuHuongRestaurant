package com.example.inventoryservice.repository;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.enums.IngredientCategory;
import com.example.inventoryservice.entity.enums.ManagementType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface IngredientRepository extends JpaRepository<Ingredient, UUID> {

    @Query("SELECT i FROM Ingredient i WHERE " +
           "(:category IS NULL OR i.category = :category) AND " +
           "(:managementType IS NULL OR i.managementType = :managementType) AND " +
           "(:keyword IS NULL OR LOWER(i.name) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<Ingredient> findFiltered(
            @Param("category") IngredientCategory category,
            @Param("managementType") ManagementType managementType,
            @Param("keyword") String keyword,
            Pageable pageable);

    // Cảnh báo tồn kho thấp: currentQty <= minThreshold (chỉ AUTO và RECIPE)
    @Query("SELECT i FROM Ingredient i WHERE i.currentQty <= i.minThreshold AND i.managementType <> :excludedType")
    List<Ingredient> findLowStockIngredients(@Param("excludedType") ManagementType excludedType);

    // Native query để bypass @SQLRestriction khi activate lại ingredient đã deactivate
    @Modifying
    @Query(value = "UPDATE ingredients SET is_active = true WHERE id = :id", nativeQuery = true)
    int activateById(@Param("id") UUID id);
}
