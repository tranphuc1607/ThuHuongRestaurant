"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

type BookingItem = {
  id: number;
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  saleUnit: string;
  itemTotal: number;
};

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  status: string;
};

type CartItem = {
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  saleUnit: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function formatPrice(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

const CATEGORY_LABEL: Record<string, string> = {
  CHICKEN: "Gà",
  PORK: "Heo",
  BEEF: "Bò",
  FISH: "Cá",
  VEGETABLE: "Rau",
  DRINK_FOOD: "Đồ uống có đồ ăn",
  DRINK: "Đồ uống",
  OTHER: "Khác",
};

export default function BookingItemsEditor({
  bookingCode,
  initialItems,
  products,
  editable,
}: {
  bookingCode: string;
  initialItems: BookingItem[];
  products: Product[];
  editable: boolean;
}) {
  const [cart, setCart] = useState<CartItem[]>(
    initialItems.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      productPrice: i.productPrice,
      quantity: i.quantity,
      saleUnit: i.saleUnit,
    }))
  );
  const storageKey = `booking-picker-${bookingCode}`;

  const [showPicker, setShowPicker] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(storageKey + "-open") === "1";
  });
  const [search, setSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  function togglePicker() {
    const next = !showPicker;
    setShowPicker(next);
    sessionStorage.setItem(storageKey + "-open", next ? "1" : "0");
  }

  // Ref để skip auto-save lần đầu mount
  const isFirstRender = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = cart.reduce((s, i) => s + i.productPrice * i.quantity, 0);

  // Auto-save khi cart thay đổi (debounce 900ms)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!editable) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSaveStatus("saving");

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE_URL}/bookings/by-code/${bookingCode}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              saleUnit: i.saleUnit,
            })),
          }),
        });
        const json = await res.json();
        if (json.statusCode === 200) {
          setSaveStatus("saved");
          router.refresh();
        } else {
          setSaveStatus("error");
          setErrorMsg(json.message || json.error || "Cập nhật thất bại");
        }
      } catch {
        setSaveStatus("error");
        setErrorMsg("Không kết nối được máy chủ");
      }
    }, 900);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [cart]);

  function changeQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function addProduct(p: Product) {
    setCart((prev) => {
      const exists = prev.find((i) => i.productId === p.id);
      if (exists)
        return prev.map((i) =>
          i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          productPrice: p.price,
          quantity: 1,
          saleUnit: "PORTION",
        },
      ];
    });
  }

  const [activeCategory, setActiveCategory] = useState<string>(() => {
    if (typeof window === "undefined") return "ALL";
    return sessionStorage.getItem(storageKey + "-cat") ?? "ALL";
  });

  function pickCategory(cat: string) {
    setActiveCategory(cat);
    sessionStorage.setItem(storageKey + "-cat", cat);
  }

  const availableProducts = products.filter((p) => p.status === "AVAILABLE");

  const categories = ["ALL", ...Array.from(new Set(availableProducts.map((p) => p.category)))];

  const filteredProducts = availableProducts.filter(
    (p) =>
      (activeCategory === "ALL" || p.category === activeCategory) &&
      (search === "" || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="bg-canvas border border-hairline overflow-hidden">
      {/* Header */}
      <div className="bg-surface-soft border-b border-hairline px-5 py-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wide">Món đặt trước</h2>
        {editable && (
          <span className="text-[11px] flex items-center gap-1.5">
            {saveStatus === "saving" && (
              <span className="text-muted-soft animate-pulse">Đang cập nhật...</span>
            )}
            {saveStatus === "saved" && (
              <span className="text-green-600 font-semibold">✓ Đã cập nhật</span>
            )}
            {saveStatus === "error" && (
              <span className="text-red-500 font-semibold">{errorMsg}</span>
            )}
            {saveStatus === "idle" && (
              <span className="text-muted-soft">Thay đổi sẽ tự lưu</span>
            )}
          </span>
        )}
      </div>

      {/* Cart items */}
      {cart.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-muted-soft">
          Chưa có món nào.{editable && " Thêm món bên dưới."}
        </div>
      ) : (
        <div className="divide-y divide-hairline">
          {cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-3 px-5 py-3">
              <img
                src={`/images/no-image.svg`}
                alt={item.productName}
                className="w-11 h-11 object-cover rounded flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink truncate">{item.productName}</div>
                <div className="text-xs text-muted-soft">{formatPrice(item.productPrice)} / phần</div>
              </div>
              {editable ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeQty(item.productId, -1)}
                    className="w-7 h-7 border border-hairline text-lg leading-none flex items-center justify-center hover:border-red-400 hover:text-red-500 transition-colors"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-ink">{item.quantity}</span>
                  <button
                    onClick={() => changeQty(item.productId, 1)}
                    className="w-7 h-7 border border-hairline text-lg leading-none flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
                  >
                    +
                  </button>
                </div>
              ) : (
                <span className="text-sm font-semibold text-ink">×{item.quantity}</span>
              )}
              <div className="w-20 text-right text-sm font-bold text-primary">
                {formatPrice(item.productPrice * item.quantity)}
              </div>
              {editable && (
                <button
                  onClick={() => setCart((prev) => prev.filter((i) => i.productId !== item.productId))}
                  className="w-8 h-8 flex items-center justify-center bg-red-50 border border-red-200 text-red-400 hover:bg-red-100 hover:text-red-600 hover:border-red-400 transition-colors flex-shrink-0"
                  title="Xóa món"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {cart.length > 0 && (
        <div className="flex justify-between items-center px-5 py-3 border-t border-hairline bg-surface-soft">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">Tổng cộng</span>
          <span className="text-base font-bold text-primary">{formatPrice(total)}</span>
        </div>
      )}

      {/* Add more (only when editable) */}
      {editable && (
        <div className="border-t border-hairline">
          {/* Toggle header */}
          <button
            type="button"
            onClick={togglePicker}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-soft transition-colors"
          >
            <span className="text-sm font-bold text-ink flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0">+</span>
              Thêm món đặt trước
            </span>
            <span className="text-muted-soft text-xs">{showPicker ? "Thu gọn ▲" : "Mở rộng ▼"}</span>
          </button>

          {showPicker && (
            <div className="border-t border-hairline">
              {/* Search */}
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 border border-hairline px-3 py-2 bg-surface-soft">
                  <span className="text-muted-soft text-sm">🔍</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); pickCategory("ALL"); }}
                    placeholder="Tìm tên món..."
                    className="flex-1 text-sm outline-none bg-transparent"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="text-muted-soft hover:text-ink text-xs">✕</button>
                  )}
                </div>
              </div>

              {/* Category tabs */}
              {!search && (
                <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => pickCategory(cat)}
                      className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold border transition-colors ${
                        activeCategory === cat
                          ? "border-primary bg-primary text-white"
                          : "border-hairline text-muted hover:border-primary hover:text-primary"
                      }`}
                    >
                      {cat === "ALL" ? "Tất cả" : (CATEGORY_LABEL[cat] ?? cat)}
                    </button>
                  ))}
                </div>
              )}

              {/* Product grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-4 pb-4">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-2 py-6 text-xs text-muted-soft text-center">Không tìm thấy món</div>
                ) : (
                  filteredProducts.map((p) => {
                    const inCart = cart.find((i) => i.productId === p.id);
                    return (
                      <div key={p.id} className="border border-hairline bg-canvas flex flex-col overflow-hidden">
                        {/* Product image */}
                        <div className="relative w-full aspect-[4/3] bg-surface-soft">
                          {p.imageUrl ? (
                            <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="160px" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl text-muted-soft">🍽</div>
                          )}
                        </div>
                        {/* Info + button */}
                        <div className="p-2 flex flex-col gap-1.5 flex-1">
                          <div className="text-xs font-semibold text-ink leading-snug line-clamp-2">{p.name}</div>
                          <div className="text-xs font-bold text-primary">{formatPrice(p.price)}</div>
                          <button
                            type="button"
                            onClick={() => addProduct(p)}
                            className={`mt-auto w-full py-1.5 text-xs font-bold transition-colors ${
                              inCart
                                ? "bg-primary/10 text-primary border border-primary"
                                : "bg-primary text-white hover:bg-primary-dark"
                            }`}
                          >
                            {inCart ? `+ Thêm (đã có ${inCart.quantity})` : "+ Thêm vào đặt"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lưu trang */}
      <div className="mx-5 mb-4 mt-1 border border-dashed border-hairline py-2.5 px-4 text-xs text-muted-soft text-center leading-relaxed">
        🔖 Lưu trang này để tra cứu trạng thái đặt bàn bất cứ lúc nào.
      </div>
    </div>
  );
}
