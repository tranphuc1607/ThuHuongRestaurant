package com.example.productservice.entity.dto.req;

import com.example.productservice.entity.enums.ProductCategory;
import com.example.productservice.entity.enums.ProductStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductCreateRequest {

    @NotBlank(message = "Tên sản phẩm không được để trống")
    @Size(max = 200, message = "Tên sản phẩm không được vượt quá 200 ký tự")
    private String name;

    @NotNull(message = "Giá sản phẩm không được để trống")
    @Min(value = 0, message = "Giá sản phẩm không được nhỏ hơn 0")
    private Double price;

    private String description;

    private String imageUrl;

    @NotNull(message = "Danh mục sản phẩm là bắt buộc")
    private ProductCategory category;

    @Builder.Default
    private ProductStatus status = ProductStatus.AVAILABLE;

    @Builder.Default
    private String saleUnit = "PORTION";
}