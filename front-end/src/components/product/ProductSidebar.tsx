import Image from "next/image";
import Link from "next/link";
import { Category, Product } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

function SidebarProductItem({ product }: { product: Product }) {
  const imgSrc = product.imageUrl || "/images/no-image.svg";

  return (
    <Link
      href={`/san-pham/${product.id}`}
      className="flex gap-2 py-2 border-b border-hairline hover:bg-surface-soft group last:border-0"
    >
      <div className="relative w-14 h-14 flex-shrink-0 bg-canvas overflow-hidden">
        <Image
          src={imgSrc}
          alt={product.name}
          fill
          className="object-cover"
          sizes="56px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {product.name}
        </p>
        <div className="mt-1">
          {product.originalPrice ? (
            <div>
              <span className="text-sale text-xs font-semibold">{formatPrice(product.price)}</span>
              <span className="text-muted-soft text-[10px] line-through ml-1">{formatPrice(product.originalPrice)}</span>
            </div>
          ) : (
            <span className="text-primary text-xs font-semibold">{formatPrice(product.price)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

type Props = {
  categories: Category[];
  products: Product[];
};

export default function ProductSidebar({ categories, products }: Props) {
  const bestSellers = products.filter((p) => p.isBestSeller).slice(0, 4);

  return (
    <aside className="w-[260px] flex-shrink-0">
      {/* Categories */}
      <div className="mb-6">
        <div className="bg-primary text-white text-xs font-bold uppercase px-3 py-2 mb-1 tracking-wide">
          DANH MỤC SẢN PHẨM
        </div>
        <ul>
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link
                href={`/san-pham?category=${cat.slug}`}
                className="flex items-center justify-between py-2 px-2 text-sm text-gray-600 border-b border-hairline hover:text-primary hover:pl-3 transition-all"
              >
                <span>{cat.name}</span>
                <span className="text-muted-soft text-xs">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Best sellers */}
      <div className="mb-6">
        <div className="bg-primary-dark text-white text-xs font-bold uppercase px-3 py-2 mb-1 tracking-wide">
          SẢN PHẨM BÁN CHẠY
        </div>
        {bestSellers.map((p) => (
          <SidebarProductItem key={p.id} product={p} />
        ))}
      </div>

      {/* Đặt bàn CTA */}
      <div className="bg-primary-dark text-white p-4">
        <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Dễ dàng &amp; nhanh chóng</div>
        <h3 className="font-bold text-base leading-snug mb-2">Đặt Bàn Trực Tuyến</h3>
        <p className="text-xs opacity-80 leading-relaxed mb-3">
          Mở cửa <strong>08:00 – 22:00</strong> mỗi ngày.<br />
          Đặt trước ít nhất 1 tiếng để được phục vụ tốt nhất.
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
  );
}
