"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getDishes, getTotalCount, CART_EVENT, DishItem } from "@/lib/dishCart";
import { formatPrice } from "@/lib/utils";

export default function CartNudgeBanner() {
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const sync = () => setDishes(getDishes());
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, []);

  if (dishes.length === 0 || dismissed) return null;

  const total = dishes.reduce((s, d) => s + d.price * d.quantity, 0);
  const count = getTotalCount(dishes);

  return (
    <div className="sticky top-16 z-40 bg-primary text-white shadow-md">
      <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center gap-4">
        <span className="text-base">🍽️</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold">
            Bạn đang có <strong>{count} món</strong> trong giỏ
          </span>
          <span className="text-white/70 text-xs ml-2 hidden sm:inline">
            · Ước tính {formatPrice(total)}
          </span>
        </div>
        <Link
          href="/dat-ban"
          className="flex-shrink-0 bg-white text-primary text-xs font-bold px-4 py-1.5 hover:bg-orange-50 transition-colors">
          Đặt bàn ngay →
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/60 hover:text-white text-lg leading-none flex-shrink-0">
          ×
        </button>
      </div>
    </div>
  );
}
