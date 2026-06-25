package com.example.inventoryservice.repository;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.UnitConversion;
import com.example.inventoryservice.entity.enums.SaleUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UnitConversionRepository extends JpaRepository<UnitConversion, Long> {

    List<UnitConversion> findByIngredient(Ingredient ingredient);

    Optional<UnitConversion> findByIngredientAndSaleUnit(Ingredient ingredient, SaleUnit saleUnit);

    boolean existsByIngredientAndSaleUnit(Ingredient ingredient, SaleUnit saleUnit);
}
