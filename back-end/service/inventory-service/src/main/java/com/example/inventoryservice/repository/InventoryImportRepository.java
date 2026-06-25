package com.example.inventoryservice.repository;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.InventoryImport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public interface InventoryImportRepository extends JpaRepository<InventoryImport, Long> {

    Page<InventoryImport> findByIngredient(Ingredient ingredient, Pageable pageable);

    Page<InventoryImport> findByCreatedAtBetween(Instant from, Instant to, Pageable pageable);

    Page<InventoryImport> findByIngredientAndCreatedAtBetween(Ingredient ingredient, Instant from, Instant to, Pageable pageable);
}
