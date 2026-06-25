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

    @Cacheable(value = "products", key = "'all:' + #page + ':' + #size")
    public Page<ProductResponse> getAllProducts(int page, int size) {
        return productRepository.findAll(PageRequest.of(page, size, Sort.by("id").ascending()))
                .map(ProductResponse::from);
    }

    @Cacheable(value = "products", key = "'cat:' + #category + ':' + #page + ':' + #size")
    public Page<ProductResponse> getProductsByCategory(ProductCategory category, int page, int size) {
        return productRepository.findByCategory(category, PageRequest.of(page, size, Sort.by("id").ascending()))
                .map(ProductResponse::from);
    }

    @Cacheable(value = "products", key = "'status:' + #status + ':' + #page + ':' + #size")
    public Page<ProductResponse> getProductsByStatus(ProductStatus status, int page, int size) {
        return productRepository.findByStatus(status, PageRequest.of(page, size, Sort.by("id").ascending()))
                .map(ProductResponse::from);
    }

    @Cacheable(value = "products", key = "'search:' + #keyword + ':' + #page + ':' + #size")
    public Page<ProductResponse> searchProducts(String keyword, int page, int size) {
        return productRepository.findByNameContainingIgnoreCase(keyword, PageRequest.of(page, size, Sort.by("id").ascending()))
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
