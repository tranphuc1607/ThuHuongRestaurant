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
        name: form.name.trim(), type: form.type,
        salaryType: form.salaryType, baseValue: Number(form.baseValue),
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

  const salaryLabel = form.salaryType === "HOURLY" ? "giờ" : "tháng";
  const salaryPreview = Number(form.baseValue) > 0
    ? `${Number(form.baseValue).toLocaleString("vi-VN")}đ/${salaryLabel}${form.salaryType === "FIXED" && form.targetDays ? ` · ${form.targetDays} ngày/tháng` : ""}`
    : null;

  return (
    <div className="p-3 md:p-6 max-w-lg mx-auto md:mx-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/nhan-su"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-card text-muted hover:bg-hairline touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          ←
        </Link>
        <div>
          <h1 className="text-lg font-bold text-ink">Thêm nhân viên</h1>
          <p className="text-xs text-muted">Điền thông tin nhân viên mới</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-hairline p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Họ tên */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Họ và tên *</label>
            <input value={form.name} onChange={(e) => setField("name", e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
          </div>

          {/* Phone + Telegram */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Số điện thoại</label>
              <input value={form.phone} onChange={(e) => setField("phone", e.target.value)}
                placeholder="0901 234 567"
                className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Telegram ID</label>
              <input type="number" value={form.telegramId} onChange={(e) => setField("telegramId", e.target.value)}
                placeholder="VD: 123456789"
                className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
            </div>
          </div>

          {/* Type + Salary type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Loại nhân viên *</label>
              <select value={form.type} onChange={(e) => setField("type", e.target.value)}
                className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl bg-white">
                <option value="FULL_TIME">Toàn thời gian</option>
                <option value="PART_TIME">Bán thời gian</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Loại lương *</label>
              <select value={form.salaryType} onChange={(e) => setField("salaryType", e.target.value)}
                className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl bg-white">
                <option value="FIXED">Tháng cố định</option>
                <option value="HOURLY">Theo giờ</option>
              </select>
            </div>
          </div>

          {/* Base value + target days */}
          <div className={`grid gap-3 ${form.salaryType === "FIXED" ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">
                Lương cơ bản * (đ/{salaryLabel})
              </label>
              <input type="number" value={form.baseValue} onChange={(e) => setField("baseValue", e.target.value)}
                placeholder={form.salaryType === "HOURLY" ? "VD: 25000" : "VD: 6000000"}
                className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
            </div>
            {form.salaryType === "FIXED" && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Ngày công chuẩn *</label>
                <input type="number" min="1" max="31" value={form.targetDays}
                  onChange={(e) => setField("targetDays", e.target.value)}
                  placeholder="VD: 26"
                  className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
              </div>
            )}
          </div>

          {/* Salary preview */}
          {salaryPreview && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-sm text-green-700">
              💰 Lương cơ bản: <strong>{salaryPreview}</strong>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {loading ? "Đang lưu..." : "Thêm nhân viên"}
            </button>
            <Link href="/admin/nhan-su"
              className="flex-1 py-3 text-center bg-surface-card text-gray-600 text-sm font-semibold rounded-xl hover:bg-hairline touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
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
