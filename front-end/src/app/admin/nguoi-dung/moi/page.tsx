"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export default function NewUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "", fullName: "", email: "", phone: "", role: "ROLE_USER" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setField(key: keyof typeof form, value: string) {
    setForm(p => ({ ...p, [key]: value })); if (error) setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim()) return setError("Vui lòng nhập tên đăng nhập");
    if (!form.password || form.password.length < 6) return setError("Mật khẩu phải từ 6 ký tự");
    setLoading(true);
    try {
      const body: Record<string, string> = { username: form.username.trim(), password: form.password, role: form.role };
      if (form.fullName.trim()) body.fullName = form.fullName.trim();
      if (form.email.trim()) body.email = form.email.trim();
      if (form.phone.trim()) body.phone = form.phone.trim();
      const res = await fetch(`${BASE}/users`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) router.push("/admin/nguoi-dung");
      else setError(extractApiError(json, "Tạo tài khoản thất bại"));
    } catch { setError("Không kết nối được máy chủ"); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-6 max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/nguoi-dung" className="text-muted-soft hover:text-gray-600 text-sm">← Quay lại</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-bold text-ink">Thêm tài khoản</h1>
      </div>
      <div className="bg-canvas rounded-lg border border-hairline-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: "username", label: "Tên đăng nhập *", type: "text", placeholder: "vd: nhanvien01" },
            { key: "password", label: "Mật khẩu *", type: "password", placeholder: "Ít nhất 6 ký tự" },
            { key: "fullName", label: "Họ và tên", type: "text", placeholder: "Nguyễn Văn A" },
            { key: "email", label: "Email", type: "email", placeholder: "abc@gmail.com" },
            { key: "phone", label: "Số điện thoại", type: "tel", placeholder: "0901 234 567" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">{label}</label>
              <input type={type} value={form[key as keyof typeof form]} placeholder={placeholder}
                onChange={(e) => setField(key as keyof typeof form, e.target.value)}
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Role</label>
            <select value={form.role} onChange={(e) => setField("role", e.target.value)}
              className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
              <option value="ROLE_USER">Người dùng</option>
              <option value="ROLE_EMPLOYEE">Nhân viên</option>
              <option value="ROLE_ADMIN">Admin</option>
            </select>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-6 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-60">
              {loading ? "Đang lưu..." : "Tạo tài khoản"}
            </button>
            <Link href="/admin/nguoi-dung" className="px-6 py-2 bg-canvas text-gray-600 text-sm font-semibold rounded hover:bg-surface-card">Hủy</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
