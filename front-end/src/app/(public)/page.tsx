import HeroSlider from "@/components/home/HeroSlider";
import CategoryBanner from "@/components/home/CategoryBanner";
import ProductSection from "@/components/home/ProductSection";
import FeatureSection from "@/components/home/FeatureSection";
import BookingCTA from "@/components/home/BookingCTA";
import BookingLookup from "@/components/home/BookingLookup";
import CartNudgeBanner from "@/components/home/CartNudgeBanner";
import ProductSidebar from "@/components/product/ProductSidebar";
import { mockProducts, mockCategories } from "@/lib/mockData";
import { productsApi, BackendProduct } from "@/lib/api";
import { Product } from "@/lib/types";

function resolveImage(imageUrl: string | null, id: number): string {
  if (!imageUrl) return `https://picsum.photos/seed/product-${id}/400/300`;
  // Nếu URL dùng hostname nội bộ hoặc không accessible → dùng picsum
  try {
    const { hostname } = new URL(imageUrl);
    const BLOCKED = ["restaurant.com", "localhost", "example.com", "placehold.co"];
    if (BLOCKED.includes(hostname)) {
      return `https://picsum.photos/seed/product-${id}/400/300`;
    }
  } catch {
    return `https://picsum.photos/seed/product-${id}/400/300`;
  }
  return imageUrl;
}

function mapBackendProduct(p: BackendProduct, index: number): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: resolveImage(p.imageUrl, p.id),
    category: p.category,
    isFeatured: index < 6,
    isNew: index % 2 === 1,
    isBestSeller: index >= 8,
  };
}

export default async function HomePage() {
  // Fetch từ real API, fallback mock data nếu backend chưa chạy
  const [page1, page2] = await Promise.all([
    productsApi.list({ page: 0, size: 12 }),
    productsApi.list({ page: 1, size: 6 }),
  ]);

  let allProducts: Product[];

  if (page1 && page1.content.length > 0) {
    const raw = [
      ...page1.content,
      ...(page2?.content ?? []),
    ];
    allProducts = raw.map(mapBackendProduct);
  } else {
    // Backend chưa chạy → dùng mock data
    allProducts = mockProducts;
  }

  const featured = allProducts.filter((p) => p.isFeatured).slice(0, 6);
  const newest = allProducts.filter((p) => p.isNew).slice(0, 6);
  const bestSellers = allProducts.filter((p) => p.isBestSeller).slice(0, 3);

  // Sidebar: dùng categories thực nếu có, không thì mock
  const categories = mockCategories;

  return (
    <>
      {/* Cart nudge — hiện khi có món trong giỏ */}
      <CartNudgeBanner />

      {/* 1. Hero Slider */}
      <HeroSlider />

      {/* 2. Category banner */}
      <CategoryBanner />

      {/* 3. Sidebar + Main product sections */}
      <div className="max-w-[1200px] mx-auto px-4 py-8 flex gap-6 items-start">
        <div className="hidden lg:block flex-shrink-0">
          <ProductSidebar categories={categories} products={allProducts} />
        </div>

        <div className="flex-1 min-w-0 w-full">
          <ProductSection
            title="SẢN PHẨM NỔI BẬT"
            products={featured}
            showArrows
          />

          <ProductSection
            title="MÓN ĂN MỚI"
            products={newest}
            showArrows
          />

          <ProductSection
            title="BÁN CHẠY NHẤT TUẦN"
            products={bestSellers}
          />
        </div>
      </div>

      {/* 4. Feature cards — sau sản phẩm */}
      <FeatureSection />

      {/* 5. Booking CTA */}
      <BookingCTA />

      {/* 6. Tra cứu đặt bàn */}
      <BookingLookup />
    </>
  );
}
