package com.example.inventoryservice.repository;

import com.example.inventoryservice.entity.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    @Query("SELECT r FROM Recipe r JOIN FETCH r.ingredient WHERE r.productId = :productId")
    List<Recipe> findByProductId(@Param("productId") Long productId);

    boolean existsByProductIdAndIngredientId(Long productId, Long ingredientId);

    void deleteByProductId(Long productId);
}
