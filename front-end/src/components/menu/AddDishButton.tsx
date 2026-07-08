"use client";
import { useState, useEffect, useRef } from "react";
import { addDish, updateQuantity, getDishes, CART_EVENT } from "@/lib/dishCart";

type Dish = { id: number; name: string; price: number; imageUrl?: string };

export default function AddDishButton({
  dish,
  size = "sm",
}: {
  dish: Dish;
  size?: "sm" | "lg";
}) {
  const [qty, setQty] = useState(0);
  // Ref để track touch đã xử lý → ngăn onClick double-fire
  const touchFired = useRef(false);

  useEffect(() => {
    const sync = () => {
      const items = getDishes();
      setQty(items.find((i) => i.id === dish.id)?.quantity ?? 0);
    };
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, [dish.id]);

  function handlers(fn: () => void) {
    return {
      onPointerDown(e: React.PointerEvent) {
        if (e.pointerType === "touch") {
          touchFired.current = true;
          e.preventDefault();
          e.stopPropagation();
          fn();
        }
      },
      onClick(e: React.MouseEvent) {
        e.stopPropagation();
        if (touchFired.current) {
          touchFired.current = false;
          return; // touch đã xử lý rồi, bỏ qua click
        }
        fn(); // desktop mouse click
      },
    };
  }

  if (qty === 0) {
    return (
      <button
        {...handlers(() => addDish(dish))}
        className={`w-full border border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors ${
          size === "lg"
            ? "py-3 text-sm tracking-wide"
            : "py-1.5 text-xs"
        }`}
      >
        + Thêm vào yêu cầu
      </button>
    );
  }

  return (
    <div className={`flex items-center border border-primary ${size === "lg" ? "h-11" : "h-10"}`}>
      <button
        {...handlers(() => updateQuantity(dish.id, qty - 1))}
        className="flex-shrink-0 w-10 h-full flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors font-bold text-base"
      >
        −
      </button>
      <span className="flex-1 text-center font-bold text-primary text-sm">
        {qty} phần
      </span>
      <button
        {...handlers(() => updateQuantity(dish.id, qty + 1))}
        className="flex-shrink-0 w-10 h-full flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors font-bold text-base"
      >
        +
      </button>
    </div>
  );
}
