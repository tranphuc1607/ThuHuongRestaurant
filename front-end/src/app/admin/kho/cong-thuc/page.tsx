"use client";
import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface Product { id: number; name: string; category: string; }
interface Ingredient { id: number; name: string; baseUnit: string; }
interface Recipe {
  id: number; productId: number; ingredientId: number;
  ingredientName: string; ingredientBaseUnit: string;
  amountRequired: number; note?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  CHICKEN: "Gà", PORK: "Heo", BEEF: "Bò", FISH: "Cá/Hải sản",
  VEGETABLE: "Rau củ", DRINK_FOOD: "Đồ uống + Ăn", DRINK: "Đồ uống", OTHER: "Khác",
};
const CATEGORY_ICON: Record<string, string> = {
  CHICKEN: "🍗", PORK: "🥩", BEEF: "🐄", FISH: "🐟",
  VEGETABLE: "🥦", DRINK_FOOD: "🍽️", DRINK: "🥤", OTHER: "🍴",
};
const BASE_UNIT_LABEL: Record<string, string> = {
  LIT: "Lít", KG: "Kg", CHAI: "Chai", HOP: "Hộp", GOI: "Gói", PIECE: "Cái",
};

const EMPTY_FORM = { ingredientId: "", amountRequired: "", note: "" };

export default function CongThucPage() {
  const [products, setProducts]           = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [mobileView, setMobileView]       = useState<"list" | "detail">("list");
  const [recipes, setRecipes]             = useState<Recipe[]>([]);
  const [ingredients, setIngredients]     = useState<Ingredient[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [formLoading, setFormLoading]     = useState(false);
  const [formError, setFormError]         = useState("");
  const [toast, setToast]                 = useState("");

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    fetch(`${BASE}/products?size=200`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => { const d = j.data; setProducts(Array.isArray(d) ? d : (d?.content ?? [])); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${BASE}/inventory/ingredients?size=200`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => { const d = j.data; setIngredients(Array.isArray(d) ? d : (d?.content ?? [])); })
      .catch(() => {});
  }, []);

  const loadRecipes = useCallback(async (productId: number) => {
    setRecipesLoading(true);
    try {
      const res = await fetch(`${BASE}/inventory/recipes/product/${productId}`, { headers: getAuthHeaders() });
      const j = await res.json();
      setRecipes(j.data ?? []);
    } catch { setRecipes([]); }
    finally { setRecipesLoading(false); }
  }, []);

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setForm(EMPTY_FORM);
    setFormError("");
    loadRecipes(p.id);
    setMobileView("detail");
  }

  async function addRecipe(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!form.ingredientId) return setFormError("Chọn nguyên liệu");
    if (!form.amountRequired || Number(form.amountRequired) <= 0)
      return setFormError("Định mức phải lớn hơn 0");
    setFormError("");
    setFormLoading(true);
    try {
      const res = await fetch(`${BASE}/inventory/recipes`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({
          productId: selectedProduct.id,
          ingredientId: Number(form.ingredientId),
          amountRequired: Number(form.amountRequired),
          note: form.note.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (res.ok && j.statusCode === 200) {
        showToast("Đã thêm nguyên liệu vào công thức");
        setForm(EMPTY_FORM);
        loadRecipes(selectedProduct.id);
      } else { setFormError(extractApiError(j, "Thêm thất bại")); }
    } catch { setFormError("Không kết nối được máy chủ"); }
    finally { setFormLoading(false); }
  }

  async function deleteRecipe(recipeId: number) {
    if (!selectedProduct) return;
    if (!confirm("Xóa dòng nguyên liệu này khỏi công thức?")) return;
    try {
      const res = await fetch(`${BASE}/inventory/recipes/${recipeId}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      if (res.ok) { showToast("Đã xóa"); loadRecipes(selectedProduct.id); }
      else { const j = await res.json(); showToast(extractApiError(j, "Xóa thất bại")); }
    } catch { showToast("Không kết nối được máy chủ"); }
  }

  async function deleteAllRecipes() {
    if (!selectedProduct) return;
    if (!confirm(`Xóa TOÀN BỘ công thức của "${selectedProduct.name}"?`)) return;
    try {
      const res = await fetch(`${BASE}/inventory/recipes/product/${selectedProduct.id}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      if (res.ok) { showToast("Đã xóa tất cả công thức"); setRecipes([]); }
      else { const j = await res.json(); showToast(extractApiError(j, "Xóa thất bại")); }
    } catch { showToast("Không kết nối được máy chủ"); }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );
  const usedIngredientIds = new Set(recipes.map(r => r.ingredientId));

  /* ── shared: product list ── */
  function ProductList() {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-hairline">
          <input type="text" placeholder="Tìm sản phẩm..."
            value={productSearch} onChange={e => setProductSearch(e.target.value)}
            className="w-full border border-hairline rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary bg-white" />
        </div>
        <div className="overflow-y-auto flex-1">
          {filteredProducts.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">Không có sản phẩm</p>
          ) : filteredProducts.map(p => (
            <button key={p.id} onClick={() => selectProduct(p)}
              className={`w-full text-left px-4 py-3 border-b border-hairline last:border-0 transition-colors touch-manipulation ${
                selectedProduct?.id === p.id
                  ? "bg-primary/10 border-l-2 border-l-primary"
                  : "hover:bg-surface-soft"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              <div className="flex items-center gap-2">
                <span className="text-base shrink-0">{CATEGORY_ICON[p.category] ?? "🍴"}</span>
                <div className="min-w-0">
                  <div className="font-medium text-sm text-ink truncate">{p.name}</div>
                  <div className="text-xs text-muted mt-0.5">{CATEGORY_LABEL[p.category] ?? p.category}</div>
                </div>
                <span className="ml-auto text-xs text-muted-soft shrink-0">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── shared: recipe detail ── */
  function RecipeDetail({ isDesktop = false }: { isDesktop?: boolean }) {
    if (!selectedProduct) {
      return (
        <div className="bg-white border border-hairline rounded-2xl flex flex-col items-center justify-center h-48 gap-2 p-6 text-center">
          <div className="text-3xl">📋</div>
          <p className="text-muted text-sm">Chọn sản phẩm để xem công thức nguyên liệu</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {/* Product info header */}
        <div className="bg-white border border-hairline rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center text-xl shrink-0">
                {CATEGORY_ICON[selectedProduct.category] ?? "🍴"}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-ink text-base leading-snug">{selectedProduct.name}</h2>
                <p className="text-xs text-muted mt-0.5">
                  {CATEGORY_LABEL[selectedProduct.category] ?? selectedProduct.category}
                  {" · "}ID #{selectedProduct.id}
                </p>
              </div>
            </div>
            {recipes.length > 0 && (
              <button
                onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); deleteAllRecipes(); } }}
                onClick={deleteAllRecipes}
                className="shrink-0 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-xl px-3 py-1.5 transition-colors touch-manipulation whitespace-nowrap"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {/* Recipe list */}
        <div className="bg-white border border-hairline rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline">
            <h3 className="text-sm font-semibold text-ink">
              Công thức
              <span className="ml-2 text-xs font-normal text-muted">({recipes.length} nguyên liệu)</span>
            </h3>
          </div>

          {recipesLoading ? (
            <div className="py-8 text-center text-muted text-sm">Đang tải...</div>
          ) : recipes.length === 0 ? (
            <div className="py-10 text-center text-muted-soft text-sm px-4">
              Chưa có công thức.<br />
              <span className="text-xs">Thêm nguyên liệu bên dưới.</span>
            </div>
          ) : isDesktop ? (
            /* Desktop: table */
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-soft text-muted text-xs uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-semibold">Nguyên liệu</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Định mức</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Đơn vị</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Ghi chú</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {recipes.map(r => (
                  <tr key={r.id} className="hover:bg-surface-soft/60">
                    <td className="px-4 py-3 font-medium text-ink">{r.ingredientName}</td>
                    <td className="px-4 py-3 text-right text-ink tabular-nums">{r.amountRequired}</td>
                    <td className="px-4 py-3 text-muted">
                      {BASE_UNIT_LABEL[r.ingredientBaseUnit] ?? r.ingredientBaseUnit}
                    </td>
                    <td className="px-4 py-3 text-muted italic text-xs">{r.note ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteRecipe(r.id)}
                        className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="Xóa nguyên liệu này">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* Mobile: cards */
            <div className="divide-y divide-hairline">
              {recipes.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                  {/* Ingredient icon */}
                  <div className="w-9 h-9 rounded-xl bg-surface-card flex items-center justify-center text-base shrink-0">
                    🧂
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">{r.ingredientName}</div>
                    <div className="text-xs text-muted mt-0.5">
                      <span className="font-bold text-primary">{r.amountRequired}</span>
                      {" "}{BASE_UNIT_LABEL[r.ingredientBaseUnit] ?? r.ingredientBaseUnit}
                      {r.note && <span className="text-muted-soft italic ml-2">— {r.note}</span>}
                    </div>
                  </div>
                  {/* Delete */}
                  <button
                    onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); deleteRecipe(r.id); } }}
                    onClick={() => deleteRecipe(r.id)}
                    className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-400 hover:text-red-600 rounded-xl shrink-0 touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add ingredient form */}
        <div className="bg-white border border-hairline rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-ink mb-3">➕ Thêm nguyên liệu vào công thức</h3>
          <form onSubmit={addRecipe} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted uppercase block mb-1.5">
                Nguyên liệu <span className="text-red-500">*</span>
              </label>
              <select value={form.ingredientId}
                onChange={e => setForm(f => ({ ...f, ingredientId: e.target.value }))}
                className="w-full border border-hairline rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary bg-white">
                <option value="">— Chọn nguyên liệu —</option>
                {ingredients
                  .filter(i => !usedIngredientIds.has(i.id))
                  .map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({BASE_UNIT_LABEL[i.baseUnit] ?? i.baseUnit})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase block mb-1.5">
                Định mức (đơn vị lưu kho) <span className="text-red-500">*</span>
              </label>
              <input type="number" step="0.001" min="0.001" placeholder="VD: 0.2"
                value={form.amountRequired}
                onChange={e => setForm(f => ({ ...f, amountRequired: e.target.value }))}
                className="w-full border border-hairline rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
            </div>

            {/* Preview */}
            {form.ingredientId && Number(form.amountRequired) > 0 && (() => {
              const ing = ingredients.find(i => i.id === Number(form.ingredientId));
              return ing ? (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 text-sm text-orange-700">
                  Mỗi phần <strong>{selectedProduct.name}</strong> dùng{" "}
                  <strong>{form.amountRequired} {BASE_UNIT_LABEL[ing.baseUnit] ?? ing.baseUnit}</strong>{" "}
                  {ing.name}
                </div>
              ) : null;
            })()}

            <div>
              <label className="text-xs font-semibold text-muted uppercase block mb-1.5">Ghi chú</label>
              <input type="text" placeholder="VD: thịt đã lọc xương"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full border border-hairline rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
            </div>

            {formError && <p className="text-red-500 text-xs">{formError}</p>}

            <button type="submit" disabled={formLoading}
              className="w-full py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {formLoading ? "Đang lưu..." : "Thêm nguyên liệu"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:left-auto md:translate-x-0 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* ── MOBILE LAYOUT ── */}
      <div className="block md:hidden">
        {mobileView === "list" ? (
          <>
            <div className="mb-4">
              <h1 className="text-lg font-bold text-ink">Công thức nguyên liệu</h1>
              <p className="text-xs text-muted mt-0.5">
                Cấu hình lượng nguyên liệu cần dùng cho mỗi món
              </p>
            </div>
            <div className="bg-white border border-hairline rounded-2xl overflow-hidden" style={{ minHeight: "60vh" }}>
              <ProductList />
            </div>
          </>
        ) : (
          <>
            {/* Detail header */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setMobileView("list"); } }}
                onClick={() => setMobileView("list")}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-card text-muted hover:bg-hairline touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                ←
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-ink truncate">{selectedProduct?.name}</h1>
                <p className="text-xs text-muted">
                  {selectedProduct ? (CATEGORY_LABEL[selectedProduct.category] ?? selectedProduct.category) : ""}
                </p>
              </div>
            </div>
            <RecipeDetail isDesktop={false} />
          </>
        )}
      </div>

      {/* ── DESKTOP LAYOUT (2-panel) ── */}
      <div className="hidden md:block">
        <h1 className="text-xl font-bold text-ink mb-1">Công thức nguyên liệu</h1>
        <p className="text-sm text-muted mb-6">
          Cấu hình lượng nguyên liệu cần dùng cho mỗi phần của từng món ăn
        </p>

        <div className="grid grid-cols-5 gap-5">
          {/* Left panel */}
          <div className="col-span-2 bg-canvas border border-hairline rounded-xl overflow-hidden flex flex-col"
            style={{ height: "calc(100vh - 12rem)" }}>
            <ProductList />
          </div>

          {/* Right panel */}
          <div className="col-span-3 overflow-y-auto" style={{ height: "calc(100vh - 12rem)" }}>
            <RecipeDetail isDesktop={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
