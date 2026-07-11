import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import AddDishButton from "@/components/menu/AddDishButton";

const FALLBACK = "/images/no-image.svg";

export default function ProductCard({ product }: { product: Product }) {
  const imgSrc = product.imageUrl || FALLBACK;

  return (
    <div className="bg-canvas border border-hairline rounded-xl overflow-hidden flex flex-col group hover:border-primary/50 hover:shadow-md transition-all duration-300">
      {/* Image */}
      <Link href={`/san-pham/${product.id}`} className="block relative aspect-square overflow-hidden bg-surface-soft">
        <Image
          src={imgSrc}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-[1.04] transition-transform duration-500"
          sizes="(max-width: 768px) 50vw, 25vw"
        />

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="bg-primary text-white text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide">
              Mới
            </span>
          )}
          {product.originalPrice && (
            <span className="bg-error text-white text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide">
              Sale
            </span>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        {/* Name */}
        <Link
          href={`/san-pham/${product.id}`}
          className="text-sm font-medium text-ink line-clamp-2 leading-snug hover:text-primary transition-colors flex-1"
        >
          {product.name}
        </Link>

        {/* Price row */}
        <div className="flex items-center gap-2">
          <span className="text-primary font-bold text-base">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-muted-soft text-xs line-through">{formatPrice(product.originalPrice)}</span>
          )}
        </div>

        {/* Add button */}
        <AddDishButton dish={{ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl }} />
      </div>
    </div>
  );
}
