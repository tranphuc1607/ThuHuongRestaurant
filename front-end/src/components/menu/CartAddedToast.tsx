"use client";
import { useState, useEffect, useRef } from "react";
import { CART_ADDED_EVENT } from "@/lib/dishCart";

export default function CartAddedToast() {
  const [dishName, setDishName] = useState("");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      const name = (e as CustomEvent<{ name: string }>).detail?.name ?? "";
      setDishName(name);
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 2200);
    }
    window.addEventListener(CART_ADDED_EVENT, handler);
    return () => {
      window.removeEventListener(CART_ADDED_EVENT, handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[500] pointer-events-none
        transition-all duration-300 ease-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
    >
      <div className="flex items-center gap-2.5 bg-gray-900/90 backdrop-blur-sm text-white
        px-4 py-2.5 rounded-full shadow-xl text-sm whitespace-nowrap">
        <span className="text-green-400 text-base leading-none">✓</span>
        <span>
          Đã thêm <strong className="text-primary">{dishName}</strong> vào yêu cầu
        </span>
      </div>
    </div>
  );
}
