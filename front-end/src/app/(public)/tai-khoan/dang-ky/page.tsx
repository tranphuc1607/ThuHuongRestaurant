"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/layout/Logo";
import { extractApiError } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export default function DangKyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phone: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  function setField(key: keyof typeof form, value: string) {
    setForm(p => ({ ...p, [key]: value }));
    if (error) setError("");
  }

  function validate(): string | null {
    if (!form.username.trim()) return "Vui lòng nhập tên đăng nhập";
    if (form.username.trim().length < 3) return "Tên đăng nhập phải từ 3 ký tự";
    if (!form.password) return "Vui lòng nhập mật khẩu";
    if (form.password.length < 6) return "Mật khẩu phải từ 6 ký tự";
    if (form.password !== form.confirmPassword) return "Mật khẩu xác nhận không khớp";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError("");

    try {
      const body: Record<string, string> = {
        username: form.username.trim(),
        password: form.password,
      };
      if (form.fullName.trim()) body.fullName = form.fullName.trim();
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.email.trim()) body.email = form.email.trim();

      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || (json.statusCode !== 200 && json.statusCode !== 201)) {
        setError(extractApiError(json, "Đăng ký thất bại. Vui lòng thử lại."));
        return;
      }

      router.push("/tai-khoan/dang-nhap?registered=1");
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12 bg-surface-soft">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: "Georgia, serif" }}>
            Tạo tài khoản
          </h1>
          <p className="text-xs text-muted-soft mt-1">Đăng ký để đặt bàn và theo dõi lịch sử</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Tên đăng nhập <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              placeholder="vd: nguyenvana"
              autoComplete="username"
              className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Họ tên */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Họ và tên
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              placeholder="Nguyễn Văn A"
              autoComplete="name"
              className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* SĐT */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Số điện thoại
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="0901 234 567"
              autoComplete="tel"
              className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Mật khẩu <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                autoComplete="new-password"
                className="w-full border border-hairline px-4 py-2.5 pr-10 text-sm outline-none focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-soft hover:text-gray-600 text-xs"
              >
                {showPass ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Xác nhận mật khẩu <span className="text-red-400">*</span>
            </label>
            <input
              type={showPass ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => setField("confirmPassword", e.target.value)}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 text-sm font-bold uppercase tracking-wide hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {loading ? "Đang xử lý..." : "Tạo Tài Khoản"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-muted">
          Đã có tài khoản?{" "}
          <Link href="/tai-khoan/dang-nhap" className="text-primary font-semibold hover:underline">
            Đăng nhập
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-muted-soft hover:text-gray-600">
            ← Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
