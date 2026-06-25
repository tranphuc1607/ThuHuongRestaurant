package com.example.inventoryservice.service;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.StockDeduction;
import com.example.inventoryservice.entity.dto.req.OrderDeductionRequest;
import com.example.inventoryservice.entity.dto.req.StockAdjustmentRequest;
import com.example.inventoryservice.entity.dto.req.StockCheckRequest;
import com.example.inventoryservice.entity.dto.req.StockDeductionManualRequest;
import com.example.inventoryservice.entity.dto.res.StockDeductionResponse;
import com.example.inventoryservice.entity.enums.DeductionReason;
import com.example.inventoryservice.entity.enums.ManagementType;
import com.example.inventoryservice.repository.IngredientRepository;
import com.example.inventoryservice.repository.RecipeRepository;
import com.example.inventoryservice.repository.StockDeductionRepository;
import com.example.inventoryservice.repository.UnitConversionRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StockDeductionService {

    private final StockDeductionRepository deductionRepository;
    private final IngredientRepository ingredientRepository;
    private final RecipeRepository recipeRepository;
    private final UnitConversionRepository unitConversionRepository;

    @Transactional
    public StockDeductionResponse deductManual(StockDeductionManualRequest req, String deductedBy) throws MessageException {
        if (req.getReason() == DeductionReason.ORDER || req.getReason() == DeductionReason.ADJUSTMENT) {
            throw new MessageException("Lý do không hợp lệ cho xuất kho thủ công. Dùng MANUAL hoặc WASTE");
        }

        Ingredient ingredient = ingredientRepository.findById(req.getIngredientId())
                .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + req.getIngredientId()));

        if (ingredient.getCurrentQty() < req.getQtyDeducted()) {
            throw new MessageException(String.format(
                    "Tồn kho không đủ. %s còn %.4f, cần %.4f",
                    ingredient.getName(), ingredient.getCurrentQty(), req.getQtyDeducted()));
        }

        ingredient.setCurrentQty(ingredient.getCurrentQty() - req.getQtyDeducted());
        ingredientRepository.save(ingredient);

        StockDeduction deduction = StockDeduction.builder()
                .ingredient(ingredient)
                .qtyDeducted(req.getQtyDeducted())
                .reason(req.getReason())
                .deductedBy(deductedBy)
                .note(req.getNote())
                .build();

        return StockDeductionResponse.from(deductionRepository.save(deduction));
    }

    @Transactional
    public StockDeductionResponse adjust(StockAdjustmentRequest req, String deductedBy) throws MessageException {
        Ingredient ingredient = ingredientRepository.findById(req.getIngredientId())
                .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + req.getIngredientId()));

        double newQty = ingredient.getCurrentQty() + req.getAdjustmentQty();
        if (newQty < 0) {
            throw new MessageException(String.format(
                    "Điều chỉnh làm kho âm. %s hiện có %.4f, điều chỉnh %.4f",
                    ingredient.getName(), ingredient.getCurrentQty(), req.getAdjustmentQty()));
        }

        ingredient.setCurrentQty(newQty);
        ingredientRepository.save(ingredient);

        // qtyDeducted âm khi adjustmentQty dương (tăng kho = "xuất ngược")
        StockDeduction deduction = StockDeduction.builder()
                .ingredient(ingredient)
                .qtyDeducted(-req.getAdjustmentQty())
                .reason(DeductionReason.ADJUSTMENT)
                .deductedBy(deductedBy)
                .note(req.getNote())
                .build();

        return StockDeductionResponse.from(deductionRepository.save(deduction));
    }

    @Transactional
    public List<StockDeductionResponse> deductForOrder(OrderDeductionRequest req, String deductedBy) throws MessageException {
        List<StockDeduction> deductions = new ArrayList<>();

        for (OrderDeductionRequest.OrderItem item : req.getItems()) {
            var recipes = recipeRepository.findByProductId(item.getProductId());
            if (recipes.isEmpty()) continue;

            for (var recipe : recipes) {
                Ingredient ingredient = recipe.getIngredient();

                if (ingredient.getManagementType() == ManagementType.PERIODIC) continue;

                double deductQty;
                if (ingredient.getManagementType() == ManagementType.AUTO) {
                    var conversion = unitConversionRepository
                            .findByIngredientAndSaleUnit(ingredient, item.getSaleUnit())
                            .orElseThrow(() -> new MessageException(String.format(
                                    "Không có quy đổi đơn vị %s cho nguyên liệu '%s'",
                                    item.getSaleUnit(), ingredient.getName())));
                    deductQty = item.getQuantity() * conversion.getBaseQtyPerSaleUnit();
                } else {
                    deductQty = recipe.getAmountRequired() * item.getQuantity();
                }

                if (ingredient.getCurrentQty() < deductQty) {
                    throw new MessageException(String.format(
                            "Không đủ '%s': cần %.4f, còn %.4f",
                            ingredient.getName(), deductQty, ingredient.getCurrentQty()));
                }

                ingredient.setCurrentQty(ingredient.getCurrentQty() - deductQty);

                deductions.add(StockDeduction.builder()
                        .ingredient(ingredient)
                        .qtyDeducted(deductQty)
                        .reason(DeductionReason.ORDER)
                        .referenceId(req.getOrderId())
                        .deductedBy(deductedBy)
                        .note(ingredient.getManagementType().name() + " deduction")
                        .build());
            }
        }

        return deductionRepository.saveAll(deductions)
                .stream().map(StockDeductionResponse::from).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> stockCheck(StockCheckRequest req) throws MessageException {
        List<Map<String, Object>> warnings = new ArrayList<>();

        for (StockCheckRequest.Item item : req.getItems()) {
            var recipes = recipeRepository.findByProductId(item.getProductId());
            if (recipes.isEmpty()) continue;

            for (var recipe : recipes) {
                Ingredient ingredient = recipe.getIngredient();
                if (ingredient.getManagementType() == ManagementType.PERIODIC) continue;

                double needed;
                if (ingredient.getManagementType() == ManagementType.AUTO) {
                    var conversion = unitConversionRepository
                            .findByIngredientAndSaleUnit(ingredient, item.getSaleUnit())
                            .orElse(null);
                    if (conversion == null) continue;
                    needed = item.getQuantity() * conversion.getBaseQtyPerSaleUnit();
                } else {
                    needed = recipe.getAmountRequired() * item.getQuantity();
                }

                if (ingredient.getCurrentQty() < needed) {
                    warnings.add(Map.of(
                            "ingredientName", ingredient.getName(),
                            "required", needed,
                            "available", ingredient.getCurrentQty(),
                            "sufficient", false
                    ));
                }
            }
        }

        return warnings;
    }

    @Transactional
    public List<StockDeductionResponse> restoreForBooking(OrderDeductionRequest req, String restoredBy) throws MessageException {
        List<StockDeduction> restorations = new ArrayList<>();

        for (OrderDeductionRequest.OrderItem item : req.getItems()) {
            var recipes = recipeRepository.findByProductId(item.getProductId());
            if (recipes.isEmpty()) continue;

            for (var recipe : recipes) {
                Ingredient ingredient = recipe.getIngredient();
                if (ingredient.getManagementType() == ManagementType.PERIODIC) continue;

                double restoreQty;
                if (ingredient.getManagementType() == ManagementType.AUTO) {
                    var conversion = unitConversionRepository
                            .findByIngredientAndSaleUnit(ingredient, item.getSaleUnit())
                            .orElse(null);
                    if (conversion == null) continue;
                    restoreQty = item.getQuantity() * conversion.getBaseQtyPerSaleUnit();
                } else {
                    restoreQty = recipe.getAmountRequired() * item.getQuantity();
                }

                ingredient.setCurrentQty(ingredient.getCurrentQty() + restoreQty);

                restorations.add(StockDeduction.builder()
                        .ingredient(ingredient)
                        .qtyDeducted(-restoreQty)
                        .reason(DeductionReason.BOOKING_RESTORE)
                        .referenceId(req.getOrderId())
                        .deductedBy(restoredBy)
                        .note("Hoàn kho do hủy đặt trước")
                        .build());
            }
        }

        return deductionRepository.saveAll(restorations)
                .stream().map(StockDeductionResponse::from).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<StockDeductionResponse> getAll(int page, int size, Long ingredientId, DeductionReason reason) throws MessageException {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        if (ingredientId != null && reason != null) {
            Ingredient ingredient = ingredientRepository.findById(ingredientId)
                    .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + ingredientId));
            return deductionRepository.findByIngredientAndReason(ingredient, reason, pageable)
                    .map(StockDeductionResponse::from);
        }

        if (ingredientId != null) {
            Ingredient ingredient = ingredientRepository.findById(ingredientId)
                    .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + ingredientId));
            return deductionRepository.findByIngredient(ingredient, pageable)
                    .map(StockDeductionResponse::from);
        }

        if (reason != null) {
            return deductionRepository.findByReason(reason, pageable)
                    .map(StockDeductionResponse::from);
        }

        return deductionRepository.findAll(pageable).map(StockDeductionResponse::from);
    }
}
