import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productsApi, BackendProduct } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import AddDishButton from "@/components/menu/AddDishButton";

const CATEGORY_LABEL: Record<string, string> = {
  CHICKEN: "Món Gà",
  PORK: "Món Heo",
  BEEF: "Món Bò",
  FISH: "Hải Sản",
  VEGETABLE: "Đồ Chay",
  DRINK_FOOD: "Món Nhậu",
  DRINK: "Đồ Uống",
  OTHER: "Món Khác",
};

function resolveImage(imageUrl: string | null, id: number): string {
  if (!imageUrl) return `https://picsum.photos/seed/product-${id}/600/450`;
  if (imageUrl.startsWith("/uploads/")) return imageUrl;
  try {
    const { hostname } = new URL(imageUrl);
    if (["restaurant.com", "localhost", "example.com", "placehold.co"].includes(hostname)) {
      return `https://picsum.photos/seed/product-${id}/600/450`;
    }
  } catch {
    return `https://picsum.photos/seed/product-${id}/600/450`;
  }
  return imageUrl;
}

async function fetchRelated(category: string, excludeId: number): Promise<BackendProduct[]> {
  const data = await productsApi.list({ category, page: 0, size: 5 });
  return (data?.content ?? []).filter((p) => p.id !== excludeId).slice(0, 4);
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await productsApi.get(Number(id));

  if (!product) notFound();

  const imageUrl = resolveImage(product.imageUrl, product.id);
  const categoryLabel = CATEGORY_LABEL[product.category] ?? product.category;
  const related = await fetchRelated(product.category, product.id);

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-surface-soft border-b border-hairline py-2">
        <div className="max-w-[1200px] mx-auto px-4 text-xs text-muted-soft flex gap-2 flex-wrap">
          <Link href="/" className="hover:text-primary">Trang chủ</Link>
          <span>›</span>
          <Link href="/san-pham" className="hover:text-primary">Thực đơn</Link>
          <span>›</span>
          <Link
            href={`/san-pham?category=${product.category}`}
            className="hover:text-primary"
          >
            {categoryLabel}
          </Link>
          <span>›</span>
          <span className="text-gray-600 line-clamp-1">{product.name}</span>
        </div>
      </div>

      {/* Detail */}
      <div className="max-w-[1200px] mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-10">

          {/* Ảnh */}
          <div>
            <div className="relative aspect-[4/3] overflow-hidden bg-surface-soft">
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
              {product.status === "OUT_OF_STOCK" && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-gray-800 text-white text-sm font-bold px-4 py-2">
                    Tạm hết món
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* Info */}
          <div>
            {/* Category tag */}
            <Link
              href={`/san-pham?category=${product.category}`}
              className="inline-block text-[10px] uppercase tracking-widest font-semibold text-primary border border-primary px-2 py-0.5 mb-3 hover:bg-primary hover:text-white transition-colors"
            >
              {categoryLabel}
            </Link>

            <h1
              className="text-2xl md:text-3xl font-bold text-ink mb-4 leading-snug"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-5">
              <span className="text-3xl font-black text-primary">
                {formatPrice(product.price)}
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 mb-6">
              {product.status === "AVAILABLE" ? (
                <span className="flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Đang phục vụ
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  Tạm hết món
                </span>
              )}
            </div>

            {/* Mô tả */}
            {product.description && (
              <div className="border-t border-hairline pt-5 mb-6">
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted mb-2">
                  Mô tả
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Đặt bàn CTA */}
            <div className="bg-cream p-5 mb-5">
              <p className="text-xs text-muted mb-3">
                Thêm món vào danh sách yêu cầu, sau đó đặt bàn để nhà hàng chuẩn bị trước.
              </p>
              {/* Nút thêm vào giỏ yêu cầu */}
              <div className="mb-3">
                <AddDishButton
                  dish={{ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl ?? undefined }}
                  size="lg"
                />
              </div>
              <div className="flex gap-3">
                <Link
                  href="/dat-ban"
                  className="flex-1 border border-primary text-primary text-center py-2.5 text-sm font-semibold hover:bg-primary/5 transition-colors"
                >
                  Đặt Bàn Ngay
                </Link>
                <a
                  href="tel:0123456789"
                  className="border border-primary text-primary text-sm font-semibold px-4 py-2.5 hover:bg-primary/5 transition-colors"
                >
                  📞
                </a>
              </div>
            </div>

            {/* Meta nhỏ */}
            <div className="text-xs text-muted-soft space-y-1">
              <div>Mã sản phẩm: <span className="font-mono text-muted">#{product.id}</span></div>
              <div>Danh mục: <span className="text-gray-600">{categoryLabel}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section className="bg-cream py-12">
          <div className="max-w-[1200px] mx-auto px-4">
            <div className="text-center mb-8">
              <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-2">
                Cùng danh mục
              </p>
              <h2
                className="text-2xl font-bold text-ink"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Món Ăn Liên Quan
              </h2>
              <div className="w-12 h-0.5 bg-primary mx-auto mt-3" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((p) => (
                <Link key={p.id} href={`/san-pham/${p.id}`} className="group block">
                  <div className="bg-canvas border border-hairline hover:shadow-md transition-shadow overflow-hidden">
                    <div className="relative aspect-square overflow-hidden bg-surface-soft">
                      <Image
                        src={resolveImage(p.imageUrl, p.id)}
                        alt={p.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    </div>
                    <div className="p-3 text-center">
                      <span className="text-primary font-bold text-sm block mb-1">
                        {formatPrice(p.price)}
                      </span>
                      <p className="text-xs text-ink line-clamp-2 leading-snug">
                        {p.name}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="text-center mt-8">
              <Link
                href={`/san-pham?category=${product.category}`}
                className="inline-block border border-primary text-primary text-sm font-bold px-8 py-2.5 hover:bg-primary hover:text-white transition-colors"
              >
                Xem thêm {categoryLabel} →
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}