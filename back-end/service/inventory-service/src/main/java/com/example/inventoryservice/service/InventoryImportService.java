package com.example.inventoryservice.service;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.InventoryImport;
import com.example.inventoryservice.entity.UnitConversion;
import com.example.inventoryservice.entity.dto.req.InventoryImportRequest;
import com.example.inventoryservice.entity.dto.res.InventoryImportResponse;
import com.example.inventoryservice.repository.IngredientRepository;
import com.example.inventoryservice.repository.InventoryImportRepository;
import com.example.inventoryservice.repository.UnitConversionRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class InventoryImportService {

    private final InventoryImportRepository importRepository;
    private final IngredientRepository ingredientRepository;
    private final UnitConversionRepository unitConversionRepository;

    @Transactional
    public InventoryImportResponse importStock(InventoryImportRequest req, String importedBy) throws MessageException {
        Ingredient ingredient = ingredientRepository.findById(req.getIngredientId())
                .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + req.getIngredientId()));

        double saleQty = req.getQuantityImported();
        double costPerSaleUnit = req.getUnitCost();

        // Quy đổi sang đơn vị cơ sở nếu có saleUnit
        double conversionFactor = 1.0;
        if (req.getSaleUnit() != null) {
            UnitConversion uc = unitConversionRepository
                    .findByIngredientAndSaleUnit(ingredient, req.getSaleUnit())
                    .orElseThrow(() -> new MessageException(
                            "Không tìm thấy quy đổi đơn vị '" + req.getSaleUnit() + "' cho nguyên liệu này. " +
                            "Vui lòng tạo quy đổi trước khi nhập kho theo đơn vị này."));
            conversionFactor = uc.getBaseQtyPerSaleUnit();
        }

        double baseQty = saleQty * conversionFactor;              // số lượng theo đơn vị cơ sở
        double costPerBaseUnit = costPerSaleUnit / conversionFactor; // giá theo đơn vị cơ sở
        double totalCost = saleQty * costPerSaleUnit;

        // Tính giá vốn bình quân gia quyền theo đơn vị cơ sở
        double currentQty = ingredient.getCurrentQty();
        double currentAvgCost = ingredient.getAverageCost();
        double newQty = currentQty + baseQty;
        double newAvgCost = (currentQty == 0)
                ? costPerBaseUnit
                : (currentQty * currentAvgCost + baseQty * costPerBaseUnit) / newQty;

        ingredient.setCurrentQty(newQty);
        ingredient.setAverageCost(newAvgCost);
        ingredientRepository.save(ingredient);

        InventoryImport record = InventoryImport.builder()
                .ingredient(ingredient)
                .quantityImported(baseQty)        // lưu theo đơn vị cơ sở
                .saleUnit(req.getSaleUnit())       // đơn vị nhập thực tế
                .saleQtyImported(saleQty)          // số lượng theo đơn vị nhập
                .unitCost(costPerSaleUnit)         // đơn giá theo đơn vị nhập
                .totalCost(totalCost)
                .purchaseNote(req.getPurchaseNote())
                .importedBy(importedBy)
                .note(req.getNote())
                .build();

        return InventoryImportResponse.from(importRepository.save(record));
    }

    @Transactional(readOnly = true)
    public Page<InventoryImportResponse> getAll(int page, int size, Long ingredientId, Instant from, Instant to) throws MessageException {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        if (ingredientId != null && from != null && to != null) {
            Ingredient ingredient = ingredientRepository.findById(ingredientId)
                    .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + ingredientId));
            return importRepository.findByIngredientAndCreatedAtBetween(ingredient, from, to, pageable)
                    .map(InventoryImportResponse::from);
        }

        if (ingredientId != null) {
            Ingredient ingredient = ingredientRepository.findById(ingredientId)
                    .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + ingredientId));
            return importRepository.findByIngredient(ingredient, pageable)
                    .map(InventoryImportResponse::from);
        }

        if (from != null && to != null) {
            return importRepository.findByCreatedAtBetween(from, to, pageable)
                    .map(InventoryImportResponse::from);
        }

        return importRepository.findAll(pageable).map(InventoryImportResponse::from);
    }
}
