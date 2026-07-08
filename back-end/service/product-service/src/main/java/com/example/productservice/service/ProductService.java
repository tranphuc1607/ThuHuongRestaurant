package com.example.productservice.service;

import com.example.productservice.entity.Product;
import com.example.productservice.entity.dto.req.ProductCreateRequest;
import com.example.productservice.entity.dto.req.ProductUpdateRequest;
import com.example.productservice.entity.dto.res.ProductResponse;
import com.example.productservice.entity.enums.ProductCategory;
import com.example.productservice.entity.enums.ProductStatus;
import com.example.productservice.repository.ProductRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    // Endpoint chính: hỗ trợ filter category + status + keyword kết hợp tùy ý
    public Page<ProductResponse> getFiltered(ProductCategory category, ProductStatus status,
                                             String keyword, int page, int size) {
        String kw = (keyword == null || keyword.isBlank()) ? null : keyword.trim();
        return productRepository.findFiltered(category, status, kw,
                PageRequest.of(page, size, Sort.by("id").ascending()))
                .map(ProductResponse::from);
    }

    @Cacheable(value = "product", key = "#id")
    public ProductResponse getProductById(Long id) throws MessageException {
        return productRepository.findByIdAndIsDeletedFalse(id)
                .map(ProductResponse::from)
                .orElseThrow(() -> new MessageException("Không tìm thấy sản phẩm với id: " + id));
    }

    @CacheEvict(value = "products", allEntries = true)
    @Transactional
    public ProductResponse createProduct(ProductCreateRequest request) {
        Product product = Product.builder()
                .name(request.getName())
                .price(request.getPrice())
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .category(request.getCategory())
                .status(request.getStatus() != null ? request.getStatus() : ProductStatus.AVAILABLE)
                .saleUnit(request.getSaleUnit() != null && !request.getSaleUnit().isBlank() ? request.getSaleUnit() : "PORTION")
                .build();
        return ProductResponse.from(productRepository.save(product));
    }

    @Caching(evict = {
            @CacheEvict(value = "products", allEntries = true),
            @CacheEvict(value = "product", key = "#id")
    })
    @Transactional
    public ProductResponse updateProduct(Long id, ProductUpdateRequest request) throws MessageException {
        Product product = productRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy sản phẩm với id: " + id));

        if (request.getName() != null) product.setName(request.getName());
        if (request.getPrice() != null) product.setPrice(request.getPrice());
        if (request.getDescription() != null) product.setDescription(request.getDescription());
        if (request.getImageUrl() != null) product.setImageUrl(request.getImageUrl());
        if (request.getCategory() != null) product.setCategory(request.getCategory());
        if (request.getStatus() != null) product.setStatus(request.getStatus());
        if (request.getSaleUnit() != null && !request.getSaleUnit().isBlank()) product.setSaleUnit(request.getSaleUnit());

        return ProductResponse.from(productRepository.save(product));
    }

    @Caching(evict = {
            @CacheEvict(value = "products", allEntries = true),
            @CacheEvict(value = "product", key = "#id")
    })
    @Transactional
    public ProductResponse updateStatus(Long id, ProductStatus status) throws MessageException {
        Product product = productRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy sản phẩm với id: " + id));
        product.setStatus(status);
        return ProductResponse.from(productRepository.save(product));
    }

    @Caching(evict = {
            @CacheEvict(value = "products", allEntries = true),
            @CacheEvict(value = "product", key = "#id")
    })
    @Transactional
    public void deleteProduct(Long id) throws MessageException {
        Product product = productRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy sản phẩm với id: " + id));
        productRepository.delete(product);
    }
}
