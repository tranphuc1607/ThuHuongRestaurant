"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getDishes,
  updateQuantity,
  removeDish,
  clearDishes,
  getTotalCount,
  CART_EVENT,
  DishItem,
} from "@/lib/dishCart";
import { formatPrice } from "@/lib/utils";

export default function DishCartFloat() {
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setDishes(getDishes());
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, []);

  const count = getTotalCount(dishes);
  const totalPrice = dishes.reduce((s, d) => s + d.price * d.quantity, 0);

  if (count === 0 && !open) return null;

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-[300]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Floating button (hiện khi có món và drawer chưa mở) */}
      {count > 0 && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[300] bg-primary text-white shadow-2xl px-5 py-3 flex items-center gap-2.5 hover:bg-primary-dark transition-colors group"
          style={{ borderRadius: 0 }}
        >
          <span className="text-lg">🛒</span>
          <div className="text-left">
            <div className="text-xs font-bold leading-tight">{count} phần đã chọn</div>
            <div className="text-[10px] opacity-75 leading-tight">{formatPrice(totalPrice)}</div>
          </div>
          <span className="ml-1 bg-white text-primary text-xs font-black w-6 h-6 flex items-center justify-center flex-shrink-0">
            {dishes.length}
          </span>
        </button>
      )}

      {/* Drawer panel */}
      {open && (
        <div className="fixed bottom-0 right-0 w-full sm:w-[420px] max-h-[85vh] bg-canvas border border-hairline-2xl z-[400] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-hairline bg-primary-dark text-white flex-shrink-0">
            <div>
              <h3 className="font-bold text-sm" style={{ fontFamily: "Georgia, serif" }}>
                Món yêu cầu đặt trước
              </h3>
              <p className="text-[11px] opacity-70 mt-0.5">
                {count} phần · {dishes.length} loại món
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white w-11 h-11 flex items-center justify-center text-lg transition-colors flex-shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Danh sách món */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {dishes.length === 0 ? (
              <p className="text-sm text-muted-soft text-center py-10">Chưa có món nào</p>
            ) : (
              dishes.map((d) => (
                <div key={d.id} className="flex items-center gap-3 border border-hairline p-3 bg-canvas hover:border-primary/30 transition-colors">
                  <img
                    src={d.imageUrl || `/images/no-image.svg`}
                    alt={d.name}
                    className="w-12 h-12 object-cover flex-shrink-0 rounded"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = `/images/no-image.svg`; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{d.name}</p>
                    <p className="text-xs text-primary font-bold mt-0.5">{formatPrice(d.price)}</p>
                  </div>

                  {/* Qty control */}
                  <div className="flex items-center border border-hairline flex-shrink-0">
                    <button
                      onClick={() => updateQuantity(d.id, d.quantity - 1)}
                      className="w-9 h-9 flex items-center justify-center hover:bg-surface-soft text-muted font-bold"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-ink">
                      {d.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(d.id, d.quantity + 1)}
                      className="w-9 h-9 flex items-center justify-center hover:bg-surface-soft text-muted font-bold"
                    >
                      +
                    </button>
                  </div>

                  {/* Xóa */}
                  <button
                    onClick={() => removeDish(d.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors w-6 h-6 flex items-center justify-center flex-shrink-0 text-base"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {dishes.length > 0 && (
            <div className="flex-shrink-0 border-t border-hairline p-4 bg-surface-soft">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted">Tổng tham khảo</span>
                <span className="text-base font-black text-primary">{formatPrice(totalPrice)}</span>
              </div>
              <p className="text-[10px] text-muted-soft mb-3 leading-relaxed">
                * Giá trên chỉ để tham khảo. Thực đơn và giá chính thức tính tại quán.
              </p>
              <Link
                href="/dat-ban"
                onClick={() => setOpen(false)}
                className="block w-full bg-primary text-white text-center py-3 text-sm font-bold uppercase tracking-wide hover:bg-primary-dark transition-colors"
              >
                Đặt Bàn Ngay ({count} phần)
              </Link>
              <button
                onClick={clearDishes}
                className="block w-full text-center text-xs text-muted-soft hover:text-red-400 transition-colors mt-2 py-1.5"
              >
                Xóa tất cả món
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
