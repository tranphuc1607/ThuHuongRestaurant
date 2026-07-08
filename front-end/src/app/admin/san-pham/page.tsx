"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const CATEGORIES: { value: string; label: string; icon: string }[] = [
  { value: "",           label: "Tất cả",      icon: "🍽️" },
  { value: "CHICKEN",   label: "Gà",           icon: "🍗" },
  { value: "PORK",      label: "Heo",          icon: "🥩" },
  { value: "BEEF",      label: "Bò",           icon: "🐄" },
  { value: "FISH",      label: "Cá & Hải sản", icon: "🐟" },
  { value: "VEGETABLE", label: "Rau",          icon: "🥦" },
  { value: "DRINK_FOOD",label: "Ăn kèm",       icon: "🧆" },
  { value: "DRINK",     label: "Đồ uống",      icon: "🥤" },
  { value: "OTHER",     label: "Khác",         icon: "📦" },
];

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE:    "bg-green-100 text-green-700",
  OUT_OF_STOCK: "bg-red-100 text-red-600",
};

interface Product {
  id: number; name: string; price: number; category: string; status: string;
  imageUrl?: string; description?: string;
}

// Đọc trạng thái đã lưu khi navigate back
function readNavState(): { cat: string; page: number; scroll: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("admin-products-nav");
    if (!raw) return null;
    sessionStorage.removeItem("admin-products-nav"); // dùng 1 lần rồi xóa
    return JSON.parse(raw);
  } catch { return null; }
}

export default function AdminProductsPage() {
  // Khởi tạo state từ sessionStorage ngay lần đầu render (lazy initializer)
  const [navRestored]              = useState(() => readNavState());
  const [catFilter,  setCatFilter] = useState(navRestored?.cat  ?? "");
  const [page,       setPage]      = useState(navRestored?.page ?? 0);
  const pendingScroll               = useRef(navRestored?.scroll ?? 0);

  const [products,      setProducts]      = useState<Product[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [totalPages,    setTotalPages]    = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [search,        setSearch]        = useState("");
  const [searchInput,   setSearchInput]   = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const savedScroll = useRef(0);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // Lưu trạng thái vào sessionStorage trước khi navigate sang trang edit
  function saveNavState() {
    try {
      const el = document.getElementById("admin-scroll-content");
      sessionStorage.setItem("admin-products-nav", JSON.stringify({
        cat:    catFilter,
        page,
        scroll: el ? el.scrollTop : window.scrollY,
      }));
    } catch { /* ignore */ }
  }

  const load = useCallback(async (preserveScroll = false) => {
    if (preserveScroll) {
      const el = document.getElementById("admin-scroll-content");
      savedScroll.current = el ? el.scrollTop : window.scrollY;
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      let url: string;
      if (search.trim()) {
        url = `${BASE}/products/search?keyword=${encodeURIComponent(search)}&page=${page}&size=16`;
      } else {
        const params = new URLSearchParams({ page: String(page), size: "16" });
        if (catFilter) params.set("category", catFilter);
        url = `${BASE}/products?${params}`;
      }
      const res  = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok && (json.statusCode === 200 || json.data)) {
        setProducts(json.data?.content ?? json.data ?? []);
        setTotalPages(json.data?.totalPages ?? 1);
        setTotalElements(json.data?.totalElements ?? 0);
      }
    } catch { /* ignore */ }
    finally {
      setLoading(false);
      setRefreshing(false);

      // Ưu tiên: khôi phục từ navigate back
      if (pendingScroll.current > 0) {
        const scroll = pendingScroll.current;
        pendingScroll.current = 0;
        setTimeout(() => {
          const el = document.getElementById("admin-scroll-content");
          if (el) el.scrollTop = scroll;
          else window.scrollTo(0, scroll);
        }, 50);
      } else if (preserveScroll) {
        // Khôi phục sau xóa / action
        setTimeout(() => {
          const el = document.getElementById("admin-scroll-content");
          if (el) el.scrollTop = savedScroll.current;
          else window.scrollTo(0, savedScroll.current);
        }, 30);
      }
    }
  }, [page, search, catFilter]);

  useEffect(() => { load(); }, [load]);

  async function deleteProduct(id: number, name: string) {
    if (!confirm(`Xóa sản phẩm "${name}"?`)) return;
    setActionLoading(id);
    try {
      const res  = await fetch(`${BASE}/products/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok) { showToast("Đã xóa sản phẩm"); load(true); }
      else showToast(json.message ?? "Thất bại", false);
    } finally { setActionLoading(null); }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  }

  function clearSearch() {
    setSearch(""); setSearchInput(""); setPage(0);
  }

  function selectCat(val: string) {
    setCatFilter(val);
    setPage(0);
    setSearch(""); setSearchInput("");
  }

  return (
    <div className="p-3 md:p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:left-auto md:translate-x-0 z-50 text-sm px-4 py-2.5 rounded-xl shadow-lg text-white font-semibold whitespace-nowrap
          ${toast.ok ? "bg-gray-800" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-ink">Quản lý Sản phẩm</h1>
          <p className="text-xs md:text-sm text-muted mt-0.5">
            {!loading && !refreshing && `${totalElements} sản phẩm`}
          </p>
        </div>
        <Link href="/admin/san-pham/moi"
          className="px-3 py-1.5 md:px-4 md:py-2 bg-primary text-white text-xs md:text-sm font-bold rounded-xl hover:bg-primary-dark transition-colors whitespace-nowrap touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          + Thêm món
        </Link>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên món..."
            className="w-full border border-hairline pl-3 pr-8 py-2 text-sm rounded-xl outline-none focus:border-primary bg-white"
          />
          {searchInput && (
            <button type="button" onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-soft hover:text-ink text-base leading-none">
              ×
            </button>
          )}
        </div>
        <button type="submit"
          className="px-4 py-2 bg-ink text-canvas text-sm font-semibold rounded-xl hover:bg-ink/80 transition-colors touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          Tìm
        </button>
      </form>

      {/* Category pills — horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 mb-4 pb-1">
        <div className="flex gap-1.5 min-w-max md:flex-wrap md:min-w-0">
          {CATEGORIES.map(cat => (
            <button key={cat.value}
              onClick={() => selectCat(cat.value)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap touch-manipulation ${
                catFilter === cat.value
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-muted border-hairline hover:border-primary/40"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile: Danh sách ── */}
      <div className="block md:hidden">
        {refreshing && (
          <div className="h-0.5 bg-hairline rounded-full overflow-hidden -mx-3 mb-3">
            <div className="h-full bg-primary rounded-full animate-pulse w-1/2 mx-auto" />
          </div>
        )}

        {loading && !refreshing ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-hairline p-3 flex items-center gap-3 animate-pulse">
                <div className="w-16 h-16 flex-shrink-0 rounded-xl bg-surface-card" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-surface-card rounded w-2/3" />
                  <div className="h-3 bg-surface-card rounded w-1/3" />
                  <div className="h-3 bg-surface-card rounded w-1/2" />
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <div className="w-12 h-7 bg-surface-card rounded-xl" />
                  <div className="w-12 h-7 bg-surface-card rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-muted-soft text-sm">
            {search ? `Không tìm thấy "${search}"` : "Không có sản phẩm nào"}
          </div>
        ) : (
          <div className="space-y-2.5">
            {products.map(p => {
              const catMeta = CATEGORIES.find(c => c.value === p.category);
              return (
                <div key={p.id}
                  className="bg-white rounded-2xl border border-hairline overflow-hidden flex items-center gap-3 p-3">
                  {/* Ảnh bên trái */}
                  <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-surface-card">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        {catMeta?.icon ?? "🍜"}
                      </div>
                    )}
                  </div>

                  {/* Info giữa */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{p.name}</p>
                    <p className="text-xs text-muted mt-0.5">{catMeta?.icon} {catMeta?.label ?? p.category}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-sm font-black text-primary">{formatPrice(p.price)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[p.status] ?? "bg-canvas text-muted"}`}>
                        {p.status === "AVAILABLE" ? "Có sẵn" : "Hết hàng"}
                      </span>
                    </div>
                  </div>

                  {/* Nút bên phải */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <Link
                      href={`/admin/san-pham/${p.id}`}
                      onClick={saveNavState}
                      className="px-3.5 py-1.5 text-center text-xs font-semibold bg-blue-50 text-blue-600 rounded-xl touch-manipulation"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      Sửa
                    </Link>
                    <button
                      onClick={() => deleteProduct(p.id, p.name)}
                      disabled={actionLoading === p.id}
                      onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); deleteProduct(p.id, p.name); } }}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-red-50 text-red-500 rounded-xl disabled:opacity-50 touch-manipulation"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      {actionLoading === p.id ? "..." : "Xóa"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination mobile */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4 pb-4">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-5 py-2.5 text-sm border border-hairline rounded-xl disabled:opacity-40 bg-white touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              ←
            </button>
            <span className="text-sm text-muted">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-5 py-2.5 text-sm border border-hairline rounded-xl disabled:opacity-40 bg-white touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              →
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop: Table ── */}
      <div className={`hidden md:block bg-canvas rounded-xl border border-hairline overflow-hidden transition-opacity ${refreshing ? "opacity-70" : ""}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Ảnh</th>
                <th className="text-left px-4 py-3 font-semibold">Tên món</th>
                <th className="text-left px-4 py-3 font-semibold">Danh mục</th>
                <th className="text-right px-4 py-3 font-semibold">Giá</th>
                <th className="text-center px-4 py-3 font-semibold">Trạng thái</th>
                <th className="text-center px-4 py-3 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading && !refreshing ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-soft animate-pulse">Đang tải...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-soft">
                  {search ? `Không tìm thấy "${search}"` : "Không có sản phẩm nào"}
                </td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-surface-soft">
                  <td className="px-4 py-2.5">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-12 h-10 object-cover rounded-lg" />
                    ) : (
                      <div className="w-12 h-10 bg-canvas rounded-lg flex items-center justify-center text-xl">
                        {CATEGORIES.find(c => c.value === p.category)?.icon ?? "🍜"}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink">{p.name}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {CATEGORIES.find(c => c.value === p.category)?.label ?? p.category}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-primary">{formatPrice(p.price)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[p.status] ?? "bg-canvas text-muted"}`}>
                      {p.status === "AVAILABLE" ? "Có sẵn" : p.status === "OUT_OF_STOCK" ? "Hết hàng" : p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link href={`/admin/san-pham/${p.id}`} onClick={saveNavState}
                        className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors">
                        Sửa
                      </Link>
                      <button onClick={() => deleteProduct(p.id, p.name)} disabled={actionLoading === p.id}
                        className="px-3 py-1 bg-red-50 text-red-500 text-xs font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
                        {actionLoading === p.id ? "..." : "Xóa"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination desktop */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 p-4 border-t border-hairline bg-surface-soft">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 text-sm border border-hairline rounded-lg disabled:opacity-40 hover:bg-canvas transition-colors">
              ← Trước
            </button>
            <span className="text-sm text-muted">Trang {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm border border-hairline rounded-lg disabled:opacity-40 hover:bg-canvas transition-colors">
              Tiếp →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
