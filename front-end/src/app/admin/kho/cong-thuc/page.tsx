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

const BASE_UNIT_LABEL: Record<string, string> = {
  LIT: "Lít", KG: "Kg", CHAI: "Chai", HOP: "Hộp", GOI: "Gói", PIECE: "Cái",
};

const EMPTY_FORM = { ingredientId: "", amountRequired: "", note: "" };

export default function CongThucPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // Tải danh sách sản phẩm
  useEffect(() => {
    fetch(`${BASE}/products?size=200`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => {
        const d = j.data;
        setProducts(Array.isArray(d) ? d : (d?.content ?? []));
      })
      .catch(() => {});
  }, []);

  // Tải danh sách nguyên liệu cho dropdown
  useEffect(() => {
    fetch(`${BASE}/inventory/ingredients?size=200`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => {
        const d = j.data;
        setIngredients(Array.isArray(d) ? d : (d?.content ?? []));
      })
      .catch(() => {});
  }, []);

  // Tải công thức của sản phẩm được chọn
  const loadRecipes = useCallback(async (productId: number) => {
    setRecipesLoading(true);
    try {
      const res = await fetch(`${BASE}/inventory/recipes/product/${productId}`, {
        headers: getAuthHeaders(),
      });
      const j = await res.json();
      setRecipes(j.data ?? []);
    } catch {
      setRecipes([]);
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setForm(EMPTY_FORM);
    setFormError("");
    loadRecipes(p.id);
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
      const body = {
        productId: selectedProduct.id,
        ingredientId: Number(form.ingredientId),
        amountRequired: Number(form.amountRequired),
        note: form.note.trim() || undefined,
      };
      const res = await fetch(`${BASE}/inventory/recipes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (res.ok && j.statusCode === 200) {
        showToast("Đã thêm nguyên liệu vào công thức");
        setForm(EMPTY_FORM);
        loadRecipes(selectedProduct.id);
      } else {
        setFormError(extractApiError(j, "Thêm thất bại"));
      }
    } catch {
      setFormError("Không kết nối được máy chủ");
    } finally {
      setFormLoading(false);
    }
  }

  async function deleteRecipe(recipeId: number) {
    if (!selectedProduct) return;
    if (!confirm("Xóa dòng nguyên liệu này khỏi công thức?")) return;
    try {
      const res = await fetch(`${BASE}/inventory/recipes/${recipeId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const j = await res.json();
      if (res.ok) {
        showToast("Đã xóa");
        loadRecipes(selectedProduct.id);
      } else {
        showToast(extractApiError(j, "Xóa thất bại"));
      }
    } catch {
      showToast("Không kết nối được máy chủ");
    }
  }

  async function deleteAllRecipes() {
    if (!selectedProduct) return;
    if (!confirm(`Xóa TOÀN BỘ công thức của "${selectedProduct.name}"?`)) return;
    try {
      const res = await fetch(`${BASE}/inventory/recipes/product/${selectedProduct.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast("Đã xóa tất cả công thức");
        setRecipes([]);
      } else {
        const j = await res.json();
        showToast(extractApiError(j, "Xóa thất bại"));
      }
    } catch {
      showToast("Không kết nối được máy chủ");
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Nguyên liệu đã có trong công thức (để lọc khỏi dropdown)
  const usedIngredientIds = new Set(recipes.map(r => r.ingredientId));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-surface-dark text-on-dark px-4 py-2.5 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <h1 className="text-xl font-bold text-ink mb-6">Công thức nguyên liệu</h1>

      <div className="grid grid-cols-5 gap-5">
        {/* Panel trái — danh sách sản phẩm */}
        <div className="col-span-2 bg-canvas border border-hairline rounded-xl overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
          <div className="p-3 border-b border-hairline">
            <input
              type="text"
              placeholder="Tìm sản phẩm..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="w-full border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredProducts.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">Không có sản phẩm</p>
            ) : (
              filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectProduct(p)}
                  className={`w-full text-left px-4 py-3 border-b border-hairline last:border-0 transition-colors ${
                    selectedProduct?.id === p.id
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-surface-soft"
                  }`}
                >
                  <div className="font-medium text-sm text-ink truncate">{p.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {CATEGORY_LABEL[p.category] ?? p.category}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Panel phải — công thức */}
        <div className="col-span-3 flex flex-col gap-4">
          {!selectedProduct ? (
            <div className="bg-canvas border border-hairline rounded-xl flex items-center justify-center h-48">
              <p className="text-muted text-sm">Chọn sản phẩm bên trái để xem công thức</p>
            </div>
          ) : (
            <>
              {/* Header sản phẩm */}
              <div className="bg-canvas border border-hairline rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-ink">{selectedProduct.name}</h2>
                  <p className="text-xs text-muted mt-0.5">
                    {CATEGORY_LABEL[selectedProduct.category] ?? selectedProduct.category}
                    {" · "}ID #{selectedProduct.id}
                  </p>
                </div>
                {recipes.length > 0 && (
                  <button
                    onClick={deleteAllRecipes}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    Xóa tất cả công thức
                  </button>
                )}
              </div>

              {/* Bảng công thức hiện tại */}
              <div className="bg-canvas border border-hairline rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-hairline">
                  <h3 className="text-sm font-semibold text-ink">
                    Công thức ({recipes.length} nguyên liệu)
                  </h3>
                </div>
                {recipesLoading ? (
                  <div className="py-8 text-center text-muted text-sm">Đang tải...</div>
                ) : recipes.length === 0 ? (
                  <div className="py-8 text-center text-muted text-sm">
                    Chưa có công thức. Thêm nguyên liệu bên dưới.
                  </div>
                ) : (
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
                          <td className="px-4 py-3 text-right text-ink tabular-nums">
                            {r.amountRequired}
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {BASE_UNIT_LABEL[r.ingredientBaseUnit] ?? r.ingredientBaseUnit}
                          </td>
                          <td className="px-4 py-3 text-muted italic text-xs">{r.note ?? "—"}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteRecipe(r.id)}
                              className="text-red-400 hover:text-red-600 transition-colors p-1 rounded"
                              title="Xóa nguyên liệu này"
                            >
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
                )}
              </div>

              {/* Form thêm nguyên liệu */}
              <div className="bg-canvas border border-hairline rounded-xl p-4">
                <h3 className="text-sm font-semibold text-ink mb-3">Thêm nguyên liệu vào công thức</h3>
                <form onSubmit={addRecipe} className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted block mb-1">
                        Nguyên liệu <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.ingredientId}
                        onChange={e => setForm(f => ({ ...f, ingredientId: e.target.value }))}
                        className="w-full border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white"
                      >
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
                      <label className="text-xs font-medium text-muted block mb-1">
                        Định mức (theo đơn vị lưu kho) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        placeholder="VD: 0.2"
                        value={form.amountRequired}
                        onChange={e => setForm(f => ({ ...f, amountRequired: e.target.value }))}
                        className="w-full border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Ghi chú</label>
                    <input
                      type="text"
                      placeholder="VD: thịt đã lọc xương"
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      className="w-full border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  {formError && (
                    <p className="text-red-500 text-xs">{formError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="self-start bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
                  >
                    {formLoading ? "Đang lưu..." : "Thêm nguyên liệu"}
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
