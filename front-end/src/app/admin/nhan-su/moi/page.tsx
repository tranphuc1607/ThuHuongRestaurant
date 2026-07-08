"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

function NewEmployeeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    name: searchParams.get("name") ?? "",
    phone: searchParams.get("phone") ?? "",
    telegramId: "",
    type: "FULL_TIME", salaryType: "FIXED",
    baseValue: "", targetDays: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setField(key: keyof typeof form, value: string) {
    setForm(p => ({ ...p, [key]: value }));
    if (error) setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Vui lòng nhập họ tên");
    if (!form.baseValue || isNaN(Number(form.baseValue)) || Number(form.baseValue) <= 0)
      return setError("Lương cơ bản phải lớn hơn 0");
    if (form.salaryType === "FIXED" && (!form.targetDays || Number(form.targetDays) <= 0))
      return setError("Vui lòng nhập số ngày công chuẩn");

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        salaryType: form.salaryType,
        baseValue: Number(form.baseValue),
      };
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.telegramId.trim()) body.telegramId = Number(form.telegramId);
      if (form.salaryType === "FIXED") body.targetDays = Number(form.targetDays);

      const res = await fetch(`${BASE}/hr/employees`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) router.push("/admin/nhan-su");
      else setError(extractApiError(json, "Thêm nhân viên thất bại"));
    } catch { setError("Không kết nối được máy chủ"); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-6 max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/nhan-su" className="text-muted-soft hover:text-gray-600 text-sm">← Quay lại</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-bold text-ink">Thêm nhân viên</h1>
      </div>

      <div className="bg-canvas rounded-lg border border-hairline-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Họ và tên *</label>
            <input value={form.name} onChange={(e) => setField("name", e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Số điện thoại</label>
              <input value={form.phone} onChange={(e) => setField("phone", e.target.value)}
                placeholder="0901 234 567"
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Telegram ID</label>
              <input type="number" value={form.telegramId} onChange={(e) => setField("telegramId", e.target.value)}
                placeholder="VD: 123456789"
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Loại nhân viên *</label>
              <select value={form.type} onChange={(e) => setField("type", e.target.value)}
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                <option value="FULL_TIME">Toàn thời gian</option>
                <option value="PART_TIME">Bán thời gian</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Loại lương *</label>
              <select value={form.salaryType} onChange={(e) => setField("salaryType", e.target.value)}
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                <option value="FIXED">Tháng cố định</option>
                <option value="HOURLY">Theo giờ</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">
                Lương cơ bản * (VNĐ/{form.salaryType === "HOURLY" ? "giờ" : "tháng"})
              </label>
              <input type="number" value={form.baseValue} onChange={(e) => setField("baseValue", e.target.value)}
                placeholder={form.salaryType === "HOURLY" ? "VD: 25000" : "VD: 6000000"}
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
            </div>
            {form.salaryType === "FIXED" && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Ngày công chuẩn *</label>
                <input type="number" min="1" max="31" value={form.targetDays}
                  onChange={(e) => setField("targetDays", e.target.value)}
                  placeholder="VD: 26"
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-6 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-60">
              {loading ? "Đang lưu..." : "Thêm nhân viên"}
            </button>
            <Link href="/admin/nhan-su"
              className="px-6 py-2 bg-canvas text-gray-600 text-sm font-semibold rounded hover:bg-surface-card">
              Hủy
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewEmployeePage() {
  return (
    <Suspense>
      <NewEmployeeForm />
    </Suspense>
  );
}
