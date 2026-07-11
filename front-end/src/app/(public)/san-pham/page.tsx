import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/product/ProductCard";
import SearchBar from "./SearchBar";
import { productsApi, BackendProduct } from "@/lib/api";
import { Product } from "@/lib/types";
import { mockProducts } from "@/lib/mockData";
import { formatPrice } from "@/lib/utils";

// Backend enum → tên hiển thị tiếng Việt
const CATEGORIES = [
  { value: "CHICKEN", label: "Món Gà" },
  { value: "PORK", label: "Món Heo" },
  { value: "BEEF", label: "Món Bò" },
  { value: "FISH", label: "Hải Sản" },
  { value: "VEGETABLE", label: "Đồ Chay" },
  { value: "DRINK_FOOD", label: "Món Nhậu" },
  { value: "DRINK", label: "Đồ Uống" },
  { value: "OTHER", label: "Món Khác" },
];

const PAGE_SIZE = 12;

function resolveImage(imageUrl: string | null, id: number): string {
  if (!imageUrl) return `/images/no-image.svg`;
  if (imageUrl.startsWith("/")) return imageUrl;
  try {
    const { hostname } = new URL(imageUrl);
    if (["restaurant.com", "localhost", "example.com", "placehold.co"].includes(hostname)) {
      return `/images/no-image.svg`;
    }
  } catch {
    return `/images/no-image.svg`;
  }
  return imageUrl;
}

function mapProduct(p: BackendProduct, index: number): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: resolveImage(p.imageUrl, p.id),
    category: p.category,
    isFeatured: index < 6,
    isBestSeller: index < 3,
    isNew: index % 4 === 1,
  };
}

// Xây URL giữ nguyên các param khác khi thay đổi 1 param
function href(params: { category?: string; keyword?: string; page?: number }) {
  const q = new URLSearchParams();
  if (params.category) q.set("category", params.category);
  if (params.keyword) q.set("keyword", params.keyword);
  if (params.page && params.page > 0) q.set("page", String(params.page));
  const qs = q.toString();
  return `/san-pham${qs ? `?${qs}` : ""}`;
}

type SearchParams = { category?: string; page?: string; keyword?: string };

export default async function SanPhamPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const category = sp.category;
  const keyword = sp.keyword;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10));

  // Fetch từ API — search hoặc list
  let apiData = null;
  if (keyword) {
    apiData = await productsApi.search(keyword, page, PAGE_SIZE);
  } else {
    apiData = await productsApi.list({ page, size: PAGE_SIZE, category });
  }

  const products: Product[] = (
    apiData && apiData.content.length > 0
      ? apiData.content.map(mapProduct)
      : !category && !keyword
      ? mockProducts
      : []
  ).filter((p) => !p.name.toLowerCase().includes("bia cốc"));

  const totalPages = apiData?.totalPages ?? (products.length > 0 ? 1 : 0);
  const totalElements = apiData?.totalElements ?? products.length;

  const bestSellers = products.slice(0, 4);
  const activeCatLabel = CATEGORIES.find((c) => c.value === category)?.label;

  // Trang hiển thị trong pagination (max 5 trang liền kề)
  function pageRange(total: number, current: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);
    const range: (number | "…")[] = [0];
    if (current > 2) range.push("…");
    for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) {
      range.push(i);
    }
    if (current < total - 3) range.push("…");
    range.push(total - 1);
    return range;
  }

  return (
    <>
      {/* Hero compact */}
      <div
        className="py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #a9583e 0%, #cc785c 100%)" }}
      >
        <p className="text-xs uppercase tracking-[4px] opacity-70 mb-2">Nhà hàng Thu Hương</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
          Thực Đơn
        </h1>
        <p className="text-white/70 text-sm mt-1">Hơn 50 món đặc sắc từ ba miền Việt Nam</p>
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface-soft border-b border-hairline py-2">
        <div className="max-w-[1200px] mx-auto px-4 text-xs text-muted-soft flex gap-2">
          <Link href="/" className="hover:text-primary">Trang chủ</Link>
          <span>›</span>
          {activeCatLabel ? (
            <>
              <Link href="/san-pham" className="hover:text-primary">Thực đơn</Link>
              <span>›</span>
              <span className="text-gray-600">{activeCatLabel}</span>
            </>
          ) : keyword ? (
            <>
              <Link href="/san-pham" className="hover:text-primary">Thực đơn</Link>
              <span>›</span>
              <span className="text-gray-600">Tìm: &ldquo;{keyword}&rdquo;</span>
            </>
          ) : (
            <span className="text-gray-600">Thực đơn</span>
          )}
        </div>
      </div>

      {/* Category pills + Search */}
      <div className="bg-canvas border-b border-hairline sticky top-16 z-10 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex gap-4 items-center">
          {/* Pills (scroll horizontal on mobile) */}
          <div className="flex gap-2 overflow-x-auto flex-1 pb-1 scrollbar-none">
            <Link
              href="/san-pham"
              className={`flex-shrink-0 px-4 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap ${
                !category && !keyword
                  ? "bg-primary text-white border-primary"
                  : "bg-canvas text-gray-600 border-hairline hover:border-primary hover:text-primary"
              }`}
            >
              Tất cả
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.value}
                href={href({ category: cat.value })}
                className={`flex-shrink-0 px-4 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap ${
                  category === cat.value
                    ? "bg-primary text-white border-primary"
                    : "bg-canvas text-gray-600 border-hairline hover:border-primary hover:text-primary"
                }`}
              >
                {cat.label}
              </Link>
            ))}
          </div>

          {/* Search bar */}
          <div className="flex-shrink-0 hidden sm:block">
            <SearchBar defaultValue={keyword ?? ""} />
          </div>
        </div>
        {/* Search bar on mobile */}
        <div className="sm:hidden px-4 pb-3">
          <SearchBar defaultValue={keyword ?? ""} />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1200px] mx-auto px-4 py-8 flex gap-6 items-start">

        {/* Sidebar */}
        <aside className="w-[220px] flex-shrink-0 hidden lg:block">
          {/* Category list */}
          <div className="mb-5">
            <div className="bg-primary text-white text-xs font-bold uppercase px-3 py-2 tracking-wide mb-0.5">
              Danh Mục
            </div>
            <ul>
              <li>
                <Link
                  href="/san-pham"
                  className={`flex items-center justify-between py-2 px-3 text-sm border-b border-hairline transition-colors ${
                    !category ? "text-primary font-semibold bg-primary/5" : "text-gray-600 hover:text-primary hover:pl-4"
                  }`}
                >
                  <span>Tất cả món</span>
                  <span className="text-xs text-gray-300">›</span>
                </Link>
              </li>
              {CATEGORIES.map((cat) => (
                <li key={cat.value}>
                  <Link
                    href={href({ category: cat.value })}
                    className={`flex items-center justify-between py-2 px-3 text-sm border-b border-hairline transition-all ${
                      category === cat.value
                        ? "text-primary font-semibold bg-primary/5"
                        : "text-gray-600 hover:text-primary hover:pl-4"
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-xs text-gray-300">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Best sellers */}
          {bestSellers.length > 0 && (
            <div className="mb-5">
              <div className="bg-primary-dark text-white text-xs font-bold uppercase px-3 py-2 tracking-wide mb-0.5">
                Bán Chạy Nhất
              </div>
              {bestSellers.map((p) => (
                <Link
                  key={p.id}
                  href={`/san-pham/${p.id}`}
                  className="flex gap-2 py-2 border-b border-hairline hover:bg-surface-soft group last:border-0"
                >
                  <div className="relative w-12 h-12 flex-shrink-0 bg-canvas overflow-hidden">
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {p.name}
                    </p>
                    <span className="text-primary text-xs font-semibold">
                      {formatPrice(p.price)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Đặt bàn CTA */}
          <div className="bg-primary-dark text-white p-4">
            <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Nhanh chóng</div>
            <h3 className="font-bold text-sm leading-snug mb-2">Đặt Bàn Trực Tuyến</h3>
            <p className="text-xs opacity-80 leading-relaxed mb-3">
              Mở cửa <strong>08:00 – 22:00</strong>.<br />
              Đặt trước ít nhất 1 tiếng.
            </p>
            <Link
              href="/dat-ban"
              className="block text-center bg-primary text-white text-xs font-bold py-2 hover:bg-primary/80 transition-colors uppercase tracking-wide mb-2"
            >
              Đặt Bàn Ngay
            </Link>
            <a
              href="tel:0123456789"
              className="block text-center border border-white/40 text-white text-xs py-2 hover:bg-white/10 transition-colors"
            >
              📞 0123 456 789
            </a>
          </div>
        </aside>

        {/* Product area */}
        <div className="flex-1 min-w-0">
          {/* Result meta */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <p className="text-sm text-muted">
              {keyword ? (
                <>
                  Kết quả tìm kiếm cho{" "}
                  <strong className="text-ink">&ldquo;{keyword}&rdquo;</strong>
                  {" — "}
                  <span>{totalElements} món</span>
                </>
              ) : activeCatLabel ? (
                <>
                  <strong className="text-ink">{activeCatLabel}</strong>
                  {" — "}
                  <span>{totalElements} món</span>
                </>
              ) : (
                <>Tất cả món — <span>{totalElements} món</span></>
              )}
            </p>
            {(category || keyword) && (
              <Link href="/san-pham" className="text-xs text-primary hover:underline">
                ✕ Xóa bộ lọc
              </Link>
            )}
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
              <p className="text-sm font-medium">
                {keyword
                  ? `Không tìm thấy món nào khớp với "${keyword}"`
                  : "Chưa có món ăn trong danh mục này"}
              </p>
              <Link href="/san-pham" className="inline-block mt-4 text-xs text-primary hover:underline">
                Xem tất cả thực đơn →
              </Link>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex justify-center items-center gap-1">
              {/* Prev */}
              {page > 0 ? (
                <Link
                  href={href({ category, keyword, page: page - 1 })}
                  className="px-3 py-2 text-sm border border-hairline text-gray-600 hover:border-primary hover:text-primary transition-colors"
                >
                  ‹
                </Link>
              ) : (
                <span className="px-3 py-2 text-sm border border-hairline text-gray-300 cursor-not-allowed">
                  ‹
                </span>
              )}

              {pageRange(totalPages, page).map((p2, i) =>
                p2 === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-muted-soft">
                    …
                  </span>
                ) : (
                  <Link
                    key={p2}
                    href={href({ category, keyword, page: p2 as number })}
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

              {/* Next */}
              {page < totalPages - 1 ? (
                <Link
                  href={href({ category, keyword, page: page + 1 })}
                  className="px-3 py-2 text-sm border border-hairline text-gray-600 hover:border-primary hover:text-primary transition-colors"
                >
                  ›
                </Link>
              ) : (
                <span className="px-3 py-2 text-sm border border-hairline text-gray-300 cursor-not-allowed">
                  ›
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
