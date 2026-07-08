package com.example.productservice.config;

import com.example.productservice.entity.Product;
import com.example.productservice.entity.enums.ProductCategory;
import com.example.productservice.entity.enums.ProductStatus;
import com.example.productservice.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final ProductRepository productRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (productRepository.count() > 0) return;

        List<Product> products = List.of(
            // === GÀ ===
            product("Gà nướng sa tế", 85_000.0, ProductCategory.CHICKEN,
                "Gà ta nướng than hoa, ướp sa tế đặc biệt, thơm cay nồng nàn",
                "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400"),
            product("Gà chiên nước mắm", 80_000.0, ProductCategory.CHICKEN,
                "Gà ta chiên giòn, rim nước mắm đường mật ong, hành phi thơm lừng",
                "https://images.unsplash.com/photo-1562802378-063ec186a863?w=400"),
            product("Cánh gà chiên sốt tỏi ớt", 65_000.0, ProductCategory.CHICKEN,
                "Cánh gà chiên giòn tẩm sốt tỏi ớt chua ngọt đặc trưng",
                "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400"),

            // === HEO ===
            product("Sườn heo nướng BBQ", 95_000.0, ProductCategory.PORK,
                "Sườn heo non ướp sốt BBQ nướng trên than hồng, mềm ngọt thấm đều",
                "https://images.unsplash.com/photo-1544025162-d76694265947?w=400"),
            product("Thịt ba chỉ chiên mắm", 75_000.0, ProductCategory.PORK,
                "Ba chỉ heo chiên vàng giòn, rim mắm ngọt đậm đà ăn kèm cơm trắng",
                "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400"),

            // === BÒ ===
            product("Bò nướng lá lốt", 110_000.0, ProductCategory.BEEF,
                "Thịt bò bằm trộn sả ớt cuộn lá lốt nướng than, chấm mắm nêm",
                "https://images.unsplash.com/photo-1558030006-450675393462?w=400"),
            product("Bò tái chanh", 120_000.0, ProductCategory.BEEF,
                "Thịt bò tươi thái mỏng trộn chanh, sả, tỏi ớt, rau thơm tươi mát",
                null),

            // === CÁ / HẢI SẢN ===
            product("Cá lóc nướng trui", 130_000.0, ProductCategory.FISH,
                "Cá lóc đồng tươi nướng trui nguyên con, ăn kèm bánh tráng rau sống",
                "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400"),
            product("Tôm nướng muối ớt", 145_000.0, ProductCategory.FISH,
                "Tôm sú tươi nướng muối ớt, chấm muối tiêu chanh",
                null),

            // === RAU ===
            product("Rau muống xào tỏi", 35_000.0, ProductCategory.VEGETABLE,
                "Rau muống non xào tỏi phi thơm, giòn ngọt",
                null),
            product("Đĩa rau sống", 25_000.0, ProductCategory.VEGETABLE,
                "Rau sống các loại: xà lách, húng quế, rau thơm, dưa leo",
                null),

            // === ĂN KÈM ===
            product("Cơm trắng", 10_000.0, ProductCategory.DRINK_FOOD,
                "Cơm gạo thơm nấu mềm", null),
            product("Bánh mì nướng bơ tỏi", 20_000.0, ProductCategory.DRINK_FOOD,
                "Bánh mì nướng giòn với bơ và tỏi phi thơm", null),

            // === ĐỒ UỐNG ===
            product("Bia Tiger lon", 25_000.0, ProductCategory.DRINK,
                "Bia Tiger lon 330ml, lạnh sảng khoái",
                "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400"),
            product("Nước ngọt Pepsi", 15_000.0, ProductCategory.DRINK,
                "Pepsi lon 330ml", null),
            product("Nước suối", 10_000.0, ProductCategory.DRINK,
                "Nước suối chai 500ml", null),
            product("Trà đá", 10_000.0, ProductCategory.DRINK,
                "Trà đá tươi mát pha theo kiểu miền Nam", null)
        );

        productRepository.saveAll(products);
        log.info("[Seed] Đã tạo {} sản phẩm mẫu", products.size());
    }

    private Product product(String name, Double price, ProductCategory category,
                             String description, String imageUrl) {
        return Product.builder()
                .name(name)
                .price(price)
                .category(category)
                .description(description)
                .imageUrl(imageUrl)
                .status(ProductStatus.AVAILABLE)
                .saleUnit("PORTION")
                .isDeleted(false)
                .build();
    }
}
