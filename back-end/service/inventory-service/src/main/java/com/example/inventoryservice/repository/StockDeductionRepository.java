package com.example.inventoryservice.repository;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.StockDeduction;
import com.example.inventoryservice.entity.enums.DeductionReason;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface StockDeductionRepository extends JpaRepository<StockDeduction, UUID> {

    Page<StockDeduction> findByIngredient(Ingredient ingredient, Pageable pageable);

    Page<StockDeduction> findByReason(DeductionReason reason, Pageable pageable);

    List<StockDeduction> findByReferenceId(String referenceId);

    Page<StockDeduction> findByCreatedAtBetween(Instant from, Instant to, Pageable pageable);

    Page<StockDeduction> findByIngredientAndReason(Ingredient ingredient, DeductionReason reason, Pageable pageable);

    @Query("SELECT d FROM StockDeduction d WHERE " +
            "(:ingredientId IS NULL OR d.ingredient.id = :ingredientId) AND " +
            "(:reason IS NULL OR d.reason = :reason) AND " +
            "(:from IS NULL OR d.createdAt >= :from) AND " +
            "(:to IS NULL OR d.createdAt < :to)")
    Page<StockDeduction> findWithFilters(
            @Param("ingredientId") UUID ingredientId,
            @Param("reason") DeductionReason reason,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);
}
