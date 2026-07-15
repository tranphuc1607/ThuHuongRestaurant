import Link from "next/link";
import HeroSlider from "@/components/home/HeroSlider";
import CategoryBanner from "@/components/home/CategoryBanner";
import FeatureSection from "@/components/home/FeatureSection";
import BookingCTA from "@/components/home/BookingCTA";
import BookingLookup from "@/components/home/BookingLookup";
import QrScannerSection from "@/components/home/QrScannerSection";
import CartNudgeBanner from "@/components/home/CartNudgeBanner";
import ProductSidebar from "@/components/product/ProductSidebar";
import ProductCard from "@/components/product/ProductCard";
import { mockProducts, mockCategories } from "@/lib/mockData";
import { productsApi, BackendProduct } from "@/lib/api";
import { Product } from "@/lib/types";

const PAGE_SIZE = 12;

function resolveImage(imageUrl: string | null, id: number): string {
  if (!imageUrl) return `/images/no-image.svg`;
  if (imageUrl.startsWith("/")) return imageUrl;
  try {
    const { hostname } = new URL(imageUrl);
    const BLOCKED = ["restaurant.com", "localhost", "example.com", "placehold.co"];
    if (BLOCKED.includes(hostname)) return `/images/no-image.svg`;
  } catch {
    return `/images/no-image.svg`;
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

function pageRange(total: number, current: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const range: (number | "…")[] = [0];
  if (current > 2) range.push("…");
  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) range.push(i);
  if (current < total - 3) range.push("…");
  range.push(total - 1);
  return range;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10));

  const apiData = await productsApi.list(
    { page, size: PAGE_SIZE, status: "AVAILABLE" },
    { cache: "no-store" }
  );

  let products: Product[];
  let totalPages = 0;
  let totalElements = 0;

  if (apiData && apiData.totalElements > 0) {
    products = apiData.content
      .filter((p) => !p.name.toLowerCase().includes("bia cốc"))
      .map(mapBackendProduct);
    totalPages = apiData.totalPages;
    totalElements = apiData.totalElements;
  } else {
    products = page === 0 ? mockProducts : [];
    totalPages = page === 0 ? 1 : 0;
    totalElements = mockProducts.length;
  }

  const categories = mockCategories;

  return (
    <>
      <CartNudgeBanner />
      <HeroSlider />
      <CategoryBanner />

      <div className="max-w-[1200px] mx-auto px-4 py-8 flex gap-6 items-start">
        <div className="hidden lg:block flex-shrink-0">
          <ProductSidebar categories={categories} products={products} />
        </div>

        <div className="flex-1 min-w-0 w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-ink uppercase tracking-wide">
              Thực Đơn
            </h2>
            <span className="text-xs text-muted-soft">{totalElements} món</span>
          </div>

          {/* Grid */}
          {products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-soft">
              <div className="text-5xl mb-4">🍽️</div>
              <p className="text-sm">Chưa có sản phẩm nào</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex justify-center items-center gap-1">
              {page > 0 ? (
                <Link
                  href={page - 1 === 0 ? "/" : `/?page=${page - 1}`}
                  className="px-3 py-2 text-sm border border-hairline text-gray-600 hover:border-primary hover:text-primary transition-colors"
                >
                  ‹
                </Link>
              ) : (
                <span className="px-3 py-2 text-sm border border-hairline text-gray-300 cursor-not-allowed">‹</span>
              )}

              {pageRange(totalPages, page).map((p2, i) =>
                p2 === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-muted-soft">…</span>
                ) : (
                  <Link
                    key={p2}
                    href={(p2 as number) === 0 ? "/" : `/?page=${p2}`}
                    className={`w-9 h-9 flex items-center justify-center text-sm border transition-colors ${
                      p2 === page
                        ? "bg-primary text-white border-primary font-semibold"
                        : "border-hairline text-gray-600 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {(p2 as number) + 1}
                  </Link>
                )
              )}

              {page < totalPages - 1 ? (
                <Link
                  href={`/?page=${page + 1}`}
                  className="px-3 py-2 text-sm border border-hairline text-gray-600 hover:border-primary hover:text-primary transition-colors"
                >
                  ›
                </Link>
              ) : (
                <span className="px-3 py-2 text-sm border border-hairline text-gray-300 cursor-not-allowed">›</span>
              )}
            </div>
          )}
        </div>
      </div>

      <FeatureSection />
      <QrScannerSection />

      {/* Google Map */}
      <section className="bg-surface-soft py-12">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="text-center mb-6">
            <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-2">Vị trí</p>
            <h2 className="text-2xl font-bold text-ink" style={{ fontFamily: "Georgia, serif" }}>
              Tìm Chúng Tôi
            </h2>
            <div className="w-12 h-0.5 bg-primary mx-auto mt-3" />
          </div>
          <div className="overflow-hidden shadow-md">
            <iframe
              src="https://maps.google.com/maps?q=21.0680346,105.7055247&z=17&hl=vi&output=embed"
              width="100%"
              height="320"
              style={{ border: 0, display: "block" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Bản đồ Nhà hàng Thu Hương"
            />
          </div>
          <div className="flex justify-center mt-3">
            <a
              href="https://maps.app.goo.gl/aMv4omRjy2BG4rU1A"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
              </svg>
              Mở trên Google Maps
            </a>
          </div>
        </div>
      </section>

      <BookingCTA />
      <BookingLookup />
    </>
  );
}
