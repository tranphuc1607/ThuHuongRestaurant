"use client";
import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface Ingredient { id: number; name: string; baseUnit: string; category: string; }
interface Conversion {
  id: number; ingredientId: number; ingredientName: string;
  saleUnit: string; baseQtyPerSaleUnit: number; note?: string;
}

const SALE_UNIT_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "THUNG", label: "Thùng",    desc: "VD: 1 thùng = 24 chai" },
  { value: "BAO",   label: "Bao",      desc: "VD: 1 bao gạo = 50 kg" },
  { value: "HOP",   label: "Hộp",      desc: "VD: 1 hộp trứng = 30 quả" },
  { value: "VI",    label: "Vỉ",       desc: "VD: 1 vỉ = 10 quả" },
  { value: "BINH",  label: "Bình",     desc: "VD: 1 bình = 19 lít" },
  { value: "GOI",   label: "Gói",      desc: "VD: 1 gói = 0.5 kg" },
  { value: "CHAI",  label: "Chai",     desc: "VD: 1 chai = 1 lít" },
  { value: "CUP",   label: "Ly",       desc: "" },
  { value: "PIECE", label: "Cái/Miếng/Lon", desc: "" },
  { value: "KG",    label: "Kg",       desc: "" },
  { value: "PORTION", label: "Phần",   desc: "" },
  { value: "DISH",  label: "Đĩa/Tô",  desc: "" },
];

const SALE_UNIT_LABEL: Record<string, string> = Object.fromEntries(
  SALE_UNIT_OPTIONS.map(o => [o.value, o.label])
);

const CATEGORY_LABEL: Record<string, string> = {
  MEAT: "Thịt", FISH: "Cá", SEAFOOD: "Hải sản", VEGETABLE: "Rau củ",
  DRY_GOODS: "Khô / Đồ hộp", SPICE: "Gia vị", DRINK: "Đồ uống", OTHER: "Khác",
};

const EMPTY_FORM = { saleUnit: "", baseQtyPerSaleUnit: "", note: "" };

function fmtQty(n: number) {
  return n % 1 === 0
    ? n.toLocaleString("vi-VN")
    : n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

export default function QuyDoiPage() {
  const [products, setProducts] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ baseQtyPerSaleUnit: "", note: "" });
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    fetch(`${BASE}/inventory/ingredients?page=0&size=200`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => setProducts(j.data?.content ?? j.data ?? []))
      .catch(() => {});
  }, []);

  const loadConversions = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/inventory/conversions/ingredient/${id}`, { headers: getAuthHeaders() });
      const j = await res.json();
      setConversions(j.data ?? []);
    } finally { setLoading(false); }
  }, []);

  function selectIngredient(ing: Ingredient) {
    setSelected(ing);
    setForm(EMPTY_FORM);
    setFormError("");
    setEditId(null);
    loadConversions(ing.id);
  }

  // Các saleUnit đã có conversion (để lọc khỏi dropdown thêm mới)
  const usedUnits = new Set(conversions.map(c => c.saleUnit));

  async function addConversion(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!form.saleUnit) return setFormError("Chọn đơn vị mua");
    const qty = Number(form.baseQtyPerSaleUnit);
    if (!qty || qty <= 0) return setFormError("Số lượng quy đổi phải lớn hơn 0");
    setFormError("");
    setFormLoading(true);
    try {
      const res = await fetch(`${BASE}/inventory/conversions`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ingredientId: selected.id,
          saleUnit: form.saleUnit,
          baseQtyPerSaleUnit: qty,
          note: form.note.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (res.ok && j.statusCode === 200) {
        showToast("Đã thêm quy đổi đơn vị");
        setForm(EMPTY_FORM);
        loadConversions(selected.id);
      } else {
        setFormError(extractApiError(j, "Thêm thất bại"));
      }
    } catch { setFormError("Không kết nối được máy chủ"); }
    finally { setFormLoading(false); }
  }

  function startEdit(c: Conversion) {
    setEditId(c.id);
    setEditForm({ baseQtyPerSaleUnit: String(c.baseQtyPerSaleUnit), note: c.note ?? "" });
  }

  async function saveEdit(id: number) {
    if (!selected) return;
    const qty = Number(editForm.baseQtyPerSaleUnit);
    if (!qty || qty <= 0) return showToast("Số lượng phải lớn hơn 0");
    try {
      const res = await fetch(`${BASE}/inventory/conversions/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          baseQtyPerSaleUnit: qty,
          note: editForm.note.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (res.ok && j.statusCode === 200) {
        showToast("Đã cập nhật");
        setEditId(null);
        loadConversions(selected.id);
      } else {
        showToast(extractApiError(j, "Cập nhật thất bại"));
      }
    } catch { showToast("Không kết nối được máy chủ"); }
  }

  async function deleteConversion(id: number, label: string) {
    if (!selected) return;
    if (!confirm(`Xóa quy đổi "${label}"?`)) return;
    try {
      const res = await fetch(`${BASE}/inventory/conversions/${id}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast("Đã xóa");
        loadConversions(selected.id);
      } else {
        const j = await res.json();
        showToast(extractApiError(j, "Xóa thất bại"));
      }
    } catch { showToast("Không kết nối được máy chủ"); }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-surface-dark text-on-dark px-4 py-2.5 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <h1 className="text-xl font-bold text-ink mb-1">Quy đổi đơn vị</h1>
      <p className="text-sm text-muted mb-6">
        Cấu hình để nhập kho theo đơn vị mua (thùng, bao, hộp...) thay vì đơn vị cơ sở
      </p>

      <div className="grid grid-cols-5 gap-5">
        {/* Panel trái — danh sách nguyên liệu */}
        <div className="col-span-2 bg-canvas border border-hairline rounded-xl overflow-hidden flex flex-col h-[calc(100vh-10rem)]">
          <div className="p-3 border-b border-hairline">
            <input
              type="text"
              placeholder="Tìm nguyên liệu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">Không có nguyên liệu</p>
            ) : filtered.map(ing => (
              <button
                key={ing.id}
                onClick={() => selectIngredient(ing)}
                className={`w-full text-left px-4 py-3 border-b border-hairline last:border-0 transition-colors ${
                  selected?.id === ing.id
                    ? "bg-primary/10 border-l-2 border-l-primary"
                    : "hover:bg-surface-soft"
                }`}
              >
                <div className="font-medium text-sm text-ink truncate">{ing.name}</div>
                <div className="text-xs text-muted mt-0.5">
                  Đ.vị cơ sở: <strong>{ing.baseUnit}</strong>
                  {" · "}{CATEGORY_LABEL[ing.category] ?? ing.category}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Panel phải */}
        <div className="col-span-3 flex flex-col gap-4">
          {!selected ? (
            <div className="bg-canvas border border-hairline rounded-xl flex flex-col items-center justify-center h-48 gap-2">
              <p className="text-muted text-sm">Chọn nguyên liệu để cấu hình quy đổi</p>
              <p className="text-xs text-muted-soft">VD: Bia Hà Nội — baseUnit: PIECE → 1 Thùng = 24 PIECE</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-canvas border border-hairline rounded-xl p-4">
                <h2 className="font-bold text-ink">{selected.name}</h2>
                <p className="text-xs text-muted mt-0.5">
                  Đơn vị lưu kho cơ sở: <strong className="text-ink">{selected.baseUnit}</strong>
                  {" · "}{CATEGORY_LABEL[selected.category] ?? selected.category}
                </p>
                <p className="text-xs text-muted-soft mt-1">
                  Các quy đổi bên dưới cho phép nhập kho bằng đơn vị lớn hơn. Hệ thống tự nhân với tỷ lệ để ra đơn vị cơ sở.
                </p>
              </div>

              {/* Bảng quy đổi hiện có */}
              <div className="bg-canvas border border-hairline rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-hairline">
                  <h3 className="text-sm font-semibold text-ink">
                    Quy đổi đã cấu hình ({conversions.length})
                  </h3>
                </div>
                {loading ? (
                  <div className="py-8 text-center text-muted text-sm">Đang tải...</div>
                ) : conversions.length === 0 ? (
                  <div className="py-8 text-center text-muted-soft text-sm">
                    Chưa có quy đổi nào. Thêm bên dưới để nhập kho theo thùng, bao, hộp...
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-soft text-muted text-xs uppercase tracking-wider">
                        <th className="px-4 py-2.5 text-left font-semibold">Đơn vị mua</th>
                        <th className="px-4 py-2.5 text-center font-semibold">= ? {selected.baseUnit}</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Ghi chú</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {conversions.map(c => (
                        <tr key={c.id} className="hover:bg-surface-soft/60">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-ink">
                              1 {SALE_UNIT_LABEL[c.saleUnit] ?? c.saleUnit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {editId === c.id ? (
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                value={editForm.baseQtyPerSaleUnit}
                                onChange={e => setEditForm(f => ({ ...f, baseQtyPerSaleUnit: e.target.value }))}
                                className="w-24 border border-primary rounded px-2 py-1 text-sm text-center outline-none"
                                autoFocus
                              />
                            ) : (
                              <span className="font-bold text-blue-700">{fmtQty(c.baseQtyPerSaleUnit)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-soft text-xs italic">
                            {editId === c.id ? (
                              <input
                                type="text"
                                value={editForm.note}
                                onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                                placeholder="Ghi chú..."
                                className="w-full border border-hairline rounded px-2 py-1 text-sm outline-none focus:border-primary"
                              />
                            ) : (
                              c.note || "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {editId === c.id ? (
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => saveEdit(c.id)}
                                  className="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                                >
                                  Lưu
                                </button>
                                <button
                                  onClick={() => setEditId(null)}
                                  className="text-xs px-3 py-1 border border-hairline rounded text-muted hover:bg-surface-soft transition-colors"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => startEdit(c)}
                                  className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => deleteConversion(c.id, SALE_UNIT_LABEL[c.saleUnit] ?? c.saleUnit)}
                                  className="text-xs px-3 py-1 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors"
                                >
                                  Xóa
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Form thêm quy đổi */}
              <div className="bg-canvas border border-hairline rounded-xl p-4">
                <h3 className="text-sm font-semibold text-ink mb-3">Thêm quy đổi mới</h3>
                <form onSubmit={addConversion} className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted block mb-1">
                        Đơn vị mua <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.saleUnit}
                        onChange={e => setForm(f => ({ ...f, saleUnit: e.target.value }))}
                        className="w-full border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white"
                      >
                        <option value="">— Chọn —</option>
                        {SALE_UNIT_OPTIONS
                          .filter(o => !usedUnits.has(o.value))
                          .map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}{o.desc ? ` (${o.desc})` : ""}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted block mb-1">
                        1 {form.saleUnit ? (SALE_UNIT_LABEL[form.saleUnit] ?? form.saleUnit) : "đơn vị mua"}{" "}
                        = ? {selected.baseUnit} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        placeholder="VD: 24"
                        value={form.baseQtyPerSaleUnit}
                        onChange={e => setForm(f => ({ ...f, baseQtyPerSaleUnit: e.target.value }))}
                        className="w-full border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted block mb-1">Ghi chú</label>
                      <input
                        type="text"
                        placeholder="VD: Bia 330ml lon"
                        value={form.note}
                        onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                        className="w-full border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {form.saleUnit && Number(form.baseQtyPerSaleUnit) > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700">
                      1 <strong>{SALE_UNIT_LABEL[form.saleUnit]}</strong> = <strong>{fmtQty(Number(form.baseQtyPerSaleUnit))} {selected.baseUnit}</strong>
                      {" · "}Nhập 5 {SALE_UNIT_LABEL[form.saleUnit]} → +{fmtQty(5 * Number(form.baseQtyPerSaleUnit))} {selected.baseUnit} vào kho
                    </div>
                  )}

                  {formError && <p className="text-red-500 text-xs">{formError}</p>}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
                  >
                    {formLoading ? "Đang lưu..." : "Thêm quy đổi"}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
