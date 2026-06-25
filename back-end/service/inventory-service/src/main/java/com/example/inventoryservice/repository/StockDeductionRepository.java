package com.example.inventoryservice.repository;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.StockDeduction;
import com.example.inventoryservice.entity.enums.DeductionReason;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface StockDeductionRepository extends JpaRepository<StockDeduction, Long> {

    Page<StockDeduction> findByIngredient(Ingredient ingredient, Pageable pageable);

    Page<StockDeduction> findByReason(DeductionReason reason, Pageable pageable);

    List<StockDeduction> findByReferenceId(String referenceId);

    Page<StockDeduction> findByCreatedAtBetween(Instant from, Instant to, Pageable pageable);

    Page<StockDeduction> findByIngredientAndReason(Ingredient ingredient, DeductionReason reason, Pageable pageable);
}
