"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const CATEGORY_LABELS: Record<string, string> = {
  CHICKEN: "Gà", PORK: "Heo", BEEF: "Bò", FISH: "Cá",
  VEGETABLE: "Rau", DRINK_FOOD: "Đồ ăn kèm", DRINK: "Đồ uống", OTHER: "Khác",
};

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  OUT_OF_STOCK: "bg-red-100 text-red-600",
};

interface Product {
  id: number; name: string; price: number; category: string; status: string;
  imageUrl?: string; description?: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let url: string;
      if (search.trim()) {
        url = `${BASE}/products/search?keyword=${encodeURIComponent(search)}&page=${page}&size=15`;
      } else {
        const params = new URLSearchParams({ page: String(page), size: "15" });
        if (catFilter) params.set("category", catFilter);
        url = `${BASE}/products?${params}`;
      }
      const res = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok && (json.statusCode === 200 || json.data)) {
        setProducts(json.data?.content ?? json.data ?? []);
        setTotalPages(json.data?.totalPages ?? 1);
      } else {
        setError(`Lỗi ${res.status}: ${json.message ?? json.error ?? "Không tải được dữ liệu"}`);
      }
    } catch (e) {
      setError(`Không kết nối được: ${e}`);
    } finally { setLoading(false); }
  }, [page, search, catFilter]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function deleteProduct(id: number, name: string) {
    if (!confirm(`Xóa sản phẩm "${name}"?`)) return;
    setActionLoading(id);
    try {
      const res = await fetch(`${BASE}/products/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok) { showToast("Đã xóa sản phẩm"); load(); }
      else showToast(json.message ?? "Thất bại");
    } finally { setActionLoading(null); }
  }

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white text-sm px-4 py-2.5 rounded shadow-lg z-50">{toast}</div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-ink">Quản lý Sản phẩm</h1>
          <p className="text-sm text-muted">Thêm, sửa, xóa món ăn</p>
        </div>
        <Link href="/admin/san-pham/moi"
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark">
          + Thêm món
        </Link>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(searchInput); }} className="flex gap-2">
          <input
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên..."
            className="border border-hairline px-3 py-1.5 text-sm outline-none focus:border-primary rounded w-52"
          />
          <button type="submit" className="px-3 py-1.5 bg-canvas text-sm rounded hover:bg-surface-card">Tìm</button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
              className="px-3 py-1.5 text-xs text-muted hover:text-ink">✕ Xóa</button>
          )}
        </form>
        <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(0); }}
          className="border border-hairline px-3 py-1.5 text-sm outline-none focus:border-primary rounded">
          <option value="">Tất cả danh mục</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase">
                <th className="text-left px-4 py-3">Ảnh</th>
                <th className="text-left px-4 py-3">Tên món</th>
                <th className="text-left px-4 py-3">Danh mục</th>
                <th className="text-right px-4 py-3">Giá</th>
                <th className="text-center px-4 py-3">Trạng thái</th>
                <th className="text-center px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-soft">Đang tải...</td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="text-center py-8 text-red-500 text-xs">{error}</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-soft">Không có sản phẩm nào</td></tr>
              ) : products.map((p) => (
                <tr key={p.id} className="hover:bg-surface-soft">
                  <td className="px-4 py-2.5">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-12 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-10 bg-canvas rounded flex items-center justify-center text-lg">🍜</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink">{p.name}</td>
                  <td className="px-4 py-2.5 text-muted">{CATEGORY_LABELS[p.category] ?? p.category}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatPrice(p.price)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[p.status] ?? "bg-canvas text-muted"}`}>
                      {p.status === "AVAILABLE" ? "Có sẵn" : p.status === "OUT_OF_STOCK" ? "Hết hàng" : p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/admin/san-pham/${p.id}`}
                        className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100">
                        Sửa
                      </Link>
                      <button onClick={() => deleteProduct(p.id, p.name)} disabled={actionLoading === p.id}
                        className="px-2 py-1 bg-red-50 text-red-500 text-xs rounded hover:bg-red-100 disabled:opacity-50">
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-hairline">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-surface-soft">← Trước</button>
            <span className="text-sm text-gray-600">Trang {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-surface-soft">Tiếp →</button>
          </div>
        )}
      </div>
    </div>
  );
}
