package com.example.inventoryservice.service;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.dto.req.IngredientCreateRequest;
import com.example.inventoryservice.entity.dto.req.IngredientUpdateRequest;
import com.example.inventoryservice.entity.dto.res.IngredientResponse;
import com.example.inventoryservice.entity.enums.IngredientCategory;
import com.example.inventoryservice.entity.enums.ManagementType;
import com.example.inventoryservice.repository.IngredientRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IngredientService {

    private final IngredientRepository ingredientRepository;

    public Page<IngredientResponse> getFiltered(IngredientCategory category, ManagementType managementType,
                                                String keyword, int page, int size) {
        String kw = (keyword == null || keyword.isBlank()) ? null : keyword.trim();
        return ingredientRepository.findFiltered(category, managementType, kw,
                PageRequest.of(page, size, Sort.by("id").ascending()))
                .map(IngredientResponse::from);
    }

    public List<IngredientResponse> getLowStockIngredients() {
        return ingredientRepository.findLowStockIngredients(ManagementType.PERIODIC)
                .stream().map(IngredientResponse::from).collect(Collectors.toList());
    }

    public IngredientResponse getById(UUID id) throws MessageException {
        return ingredientRepository.findById(id)
                .map(IngredientResponse::from)
                .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + id));
    }

    @Transactional
    public IngredientResponse create(IngredientCreateRequest req) {
        Ingredient ingredient = Ingredient.builder()
                .name(req.getName())
                .baseUnit(req.getBaseUnit())
                .category(req.getCategory())
                .managementType(req.getManagementType())
                .minThreshold(req.getMinThreshold() != null ? req.getMinThreshold() : 0.0)
                .build();
        return IngredientResponse.from(ingredientRepository.save(ingredient));
    }

    @Transactional
    public IngredientResponse update(UUID id, IngredientUpdateRequest req) throws MessageException {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + id));

        if (req.getName() != null) ingredient.setName(req.getName());
        if (req.getBaseUnit() != null) ingredient.setBaseUnit(req.getBaseUnit());
        if (req.getCategory() != null) ingredient.setCategory(req.getCategory());
        if (req.getManagementType() != null) ingredient.setManagementType(req.getManagementType());
        if (req.getMinThreshold() != null) ingredient.setMinThreshold(req.getMinThreshold());

        return IngredientResponse.from(ingredientRepository.save(ingredient));
    }

    @Transactional
    public void deactivate(UUID id) throws MessageException {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + id));
        ingredientRepository.delete(ingredient); // @SQLDelete sẽ set is_active = false
    }

    @Transactional
    public void activate(UUID id) throws MessageException {
        int updated = ingredientRepository.activateById(id);
        if (updated == 0) throw new MessageException("Không tìm thấy nguyên liệu với id: " + id);
    }
}
