import ProductCard from "@/components/product/ProductCard";
import SectionHeader from "@/components/ui/SectionHeader";
import { Product } from "@/lib/types";

type Props = {
  title: string;
  products: Product[];
  showArrows?: boolean;
};

export default function ProductSection({ title, products, showArrows }: Props) {
  return (
    <div className="mb-8">
      <SectionHeader title={title} showArrows={showArrows} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
