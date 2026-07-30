package com.example.inventoryservice.service;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.Recipe;
import com.example.inventoryservice.entity.dto.req.RecipeCreateRequest;
import com.example.inventoryservice.entity.dto.res.RecipeResponse;
import com.example.inventoryservice.repository.IngredientRepository;
import com.example.inventoryservice.repository.RecipeRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecipeService {

    private final RecipeRepository recipeRepository;
    private final IngredientRepository ingredientRepository;

    @Transactional
    public RecipeResponse create(RecipeCreateRequest req) throws MessageException {
        if (recipeRepository.existsByProductIdAndIngredientId(req.getProductId(), req.getIngredientId())) {
            throw new MessageException("Công thức cho sản phẩm này với nguyên liệu đã tồn tại");
        }

        Ingredient ingredient = ingredientRepository.findById(req.getIngredientId())
                .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + req.getIngredientId()));

        Recipe recipe = Recipe.builder()
                .productId(req.getProductId())
                .ingredient(ingredient)
                .amountRequired(req.getAmountRequired())
                .note(req.getNote())
                .build();

        return RecipeResponse.from(recipeRepository.save(recipe));
    }

    @Transactional(readOnly = true)
    public List<RecipeResponse> getByProductId(UUID productId) {
        return recipeRepository.findByProductId(productId)
                .stream().map(RecipeResponse::from).collect(Collectors.toList());
    }

    // Kiểm tra sản phẩm có đủ nguyên liệu để làm không
    @Transactional(readOnly = true)
    public boolean isProductAvailable(UUID productId) {
        List<Recipe> recipes = recipeRepository.findByProductId(productId);
        if (recipes.isEmpty()) return true;

        return recipes.stream().allMatch(recipe ->
            recipe.getIngredient().getCurrentQty() >= recipe.getAmountRequired()
        );
    }

    @Transactional
    public void delete(UUID id) throws MessageException {
        if (!recipeRepository.existsById(id)) {
            throw new MessageException("Không tìm thấy công thức với id: " + id);
        }
        recipeRepository.deleteById(id);
    }

    @Transactional
    public void deleteByProductId(UUID productId) {
        recipeRepository.deleteByProductId(productId);
    }
}
