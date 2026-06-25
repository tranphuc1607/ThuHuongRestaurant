package com.example.inventoryservice.repository;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.enums.IngredientCategory;
import com.example.inventoryservice.entity.enums.ManagementType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IngredientRepository extends JpaRepository<Ingredient, Long> {

    Page<Ingredient> findByCategory(IngredientCategory category, Pageable pageable);

    Page<Ingredient> findByManagementType(ManagementType managementType, Pageable pageable);

    Page<Ingredient> findByNameContainingIgnoreCase(String name, Pageable pageable);

    // Cảnh báo tồn kho thấp: currentQty <= minThreshold (chỉ AUTO và RECIPE)
    @Query("SELECT i FROM Ingredient i WHERE i.currentQty <= i.minThreshold AND i.managementType <> :excludedType")
    List<Ingredient> findLowStockIngredients(@Param("excludedType") ManagementType excludedType);
}
