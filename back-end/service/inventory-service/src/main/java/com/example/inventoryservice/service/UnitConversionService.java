package com.example.inventoryservice.service;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.UnitConversion;
import com.example.inventoryservice.entity.dto.req.UnitConversionCreateRequest;
import com.example.inventoryservice.entity.dto.req.UnitConversionUpdateRequest;
import com.example.inventoryservice.entity.dto.res.UnitConversionResponse;
import com.example.inventoryservice.repository.IngredientRepository;
import com.example.inventoryservice.repository.UnitConversionRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UnitConversionService {

    private final UnitConversionRepository unitConversionRepository;
    private final IngredientRepository ingredientRepository;

    @Transactional(readOnly = true)
    public List<UnitConversionResponse> getByIngredientId(Long ingredientId) throws MessageException {
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + ingredientId));
        return unitConversionRepository.findByIngredient(ingredient)
                .stream().map(UnitConversionResponse::from).collect(Collectors.toList());
    }

    @Transactional
    public UnitConversionResponse create(UnitConversionCreateRequest req) throws MessageException {
        Ingredient ingredient = ingredientRepository.findById(req.getIngredientId())
                .orElseThrow(() -> new MessageException("Không tìm thấy nguyên liệu với id: " + req.getIngredientId()));

        if (unitConversionRepository.existsByIngredientAndSaleUnit(ingredient, req.getSaleUnit())) {
            throw new MessageException("Quy đổi cho đơn vị " + req.getSaleUnit() + " của nguyên liệu này đã tồn tại");
        }

        UnitConversion uc = UnitConversion.builder()
                .ingredient(ingredient)
                .saleUnit(req.getSaleUnit())
                .baseQtyPerSaleUnit(req.getBaseQtyPerSaleUnit())
                .note(req.getNote())
                .build();

        return UnitConversionResponse.from(unitConversionRepository.save(uc));
    }

    @Transactional
    public UnitConversionResponse update(Long id, UnitConversionUpdateRequest req) throws MessageException {
        UnitConversion uc = unitConversionRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy quy đổi với id: " + id));

        if (req.getBaseQtyPerSaleUnit() != null) uc.setBaseQtyPerSaleUnit(req.getBaseQtyPerSaleUnit());
        if (req.getNote() != null) uc.setNote(req.getNote());

        return UnitConversionResponse.from(unitConversionRepository.save(uc));
    }

    @Transactional
    public void delete(Long id) throws MessageException {
        if (!unitConversionRepository.existsById(id)) {
            throw new MessageException("Không tìm thấy quy đổi với id: " + id);
        }
        unitConversionRepository.deleteById(id);
    }
}
