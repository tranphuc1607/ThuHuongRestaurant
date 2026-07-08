"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";
import ImageUploader from "@/components/admin/ImageUploader";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const CATEGORIES = [
  { value: "CHICKEN", label: "Gà" },
  { value: "PORK", label: "Heo" },
  { value: "BEEF", label: "Bò" },
  { value: "FISH", label: "Cá" },
  { value: "VEGETABLE", label: "Rau củ" },
  { value: "DRINK_FOOD", label: "Đồ ăn kèm" },
  { value: "DRINK", label: "Đồ uống" },
  { value: "OTHER", label: "Khác" },
];

export default function NewProductPage() {
  const router = useRouter();
  const SALE_UNITS = [
    { value: "PORTION", label: "Phần" }, { value: "CUP", label: "Ly" },
    { value: "DISH", label: "Đĩa/Tô" }, { value: "PIECE", label: "Cái" },
    { value: "CHAI", label: "Chai" }, { value: "KG", label: "Kg" },
  ];
  const [form, setForm] = useState({
    name: "", price: "", description: "", imageUrl: "", category: "CHICKEN", status: "AVAILABLE", saleUnit: "PORTION",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function setField(key: keyof typeof form, value: string) {
    setForm(p => ({ ...p, [key]: value }));
    if (error) setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Vui lòng nhập tên món"); return; }
    if (!form.price || isNaN(Number(form.price))) { setError("Giá không hợp lệ"); return; }
    setError("");

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        price: Number(form.price),
        category: form.category,
        status: form.status,
        saleUnit: form.saleUnit,
      };
      if (form.description.trim()) body.description = form.description.trim();
      if (form.imageUrl.trim()) body.imageUrl = form.imageUrl.trim();

      const res = await fetch(`${BASE}/products`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        showToast("Đã thêm sản phẩm thành công!");
        setTimeout(() => router.push("/admin/san-pham"), 1200);
      } else {
        showToast(extractApiError(json, "Tạo sản phẩm thất bại"), false);
      }
    } catch {
      showToast("Không kết nối được máy chủ", false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-sm px-4 py-2.5 rounded-xl shadow-lg text-white transition-all
          ${toast.ok ? "bg-gray-800" : "bg-red-500"}`}>
          {toast.ok ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/san-pham" className="text-muted-soft hover:text-gray-600 text-sm">← Quay lại</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-bold text-ink">Thêm món mới</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: image */}
        <div className="bg-canvas rounded-xl border border-hairline p-5 space-y-2">
          <h2 className="text-xs font-bold text-muted-soft uppercase tracking-widest mb-3">Hình ảnh</h2>
          <ImageUploader
            value={form.imageUrl}
            onChange={(url) => setField("imageUrl", url)}
          />
        </div>

        {/* Right: info */}
        <div className="bg-canvas rounded-xl border border-hairline p-5 space-y-4">
          <h2 className="text-xs font-bold text-muted-soft uppercase tracking-widest">Thông tin</h2>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Tên món <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="VD: Gà nướng muối ớt"
              className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Giá (VNĐ) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setField("price", e.target.value)}
                placeholder="85000"
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Danh mục</label>
              <select
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-lg bg-white">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Đơn vị bán <span className="text-red-400">*</span>
            </label>
            <select
              value={form.saleUnit}
              onChange={(e) => setField("saleUnit", e.target.value)}
              className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-lg bg-white">
              {SALE_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Trạng thái</label>
            <select
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
              className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-lg bg-white">
              <option value="AVAILABLE">Có sẵn</option>
              <option value="OUT_OF_STOCK">Hết hàng</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Mô tả</label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={3}
              placeholder="Mô tả ngắn về món ăn..."
              className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-lg resize-none" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors">
              {loading ? "Đang lưu..." : "Lưu sản phẩm"}
            </button>
            <Link
              href="/admin/san-pham"
              className="px-5 py-2.5 bg-surface-soft text-gray-600 text-sm font-semibold rounded-xl hover:bg-hairline transition-colors">
              Hủy
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
