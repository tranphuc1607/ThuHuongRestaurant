"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/layout/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { extractApiError } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const redirectParam = searchParams.get("redirect");

  function getRoleDestination(token: string): string {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const roles: string[] = payload.roles ?? [];
      if (roles.includes("ROLE_ADMIN")) return "/admin/dashboard";
      if (roles.includes("ROLE_EMPLOYEE")) return "/employee/ban";
    } catch {}
    return "/";
  }

  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCountdown(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    if (error) setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.statusCode !== 200) {
        const msg = extractApiError(json, "Tên đăng nhập hoặc mật khẩu không đúng");
        setError(msg);
        if (json.statusCode === 429) {
          const match = msg.match(/(\d+)\s*giây/);
          if (match) startCountdown(parseInt(match[1], 10));
        }
        return;
      }
      const token = json.data?.accessToken ?? json.data?.access_token ?? json.data?.token;
      if (token) {
        await login(token);
        const dest = redirectParam ?? getRoleDestination(token);
        router.push(dest);
        router.refresh();
      }
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Logo size="lg" />
        </div>
        <h1 className="text-xl font-bold text-ink" style={{ fontFamily: "Georgia, serif" }}>
          Đăng nhập
        </h1>
        <p className="text-xs text-muted-soft mt-1">Chào mừng bạn quay trở lại!</p>
      </div>

      {registered && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mb-5 text-center">
          Đăng ký thành công! Vui lòng đăng nhập.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
            Tên đăng nhập
          </label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setField("username", e.target.value)}
            placeholder="Nhập tên đăng nhập"
            autoComplete="username"
            autoFocus
            className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
            Mật khẩu
          </label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit(e as unknown as React.FormEvent)}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              className="w-full border border-hairline px-4 py-2.5 pr-14 text-sm outline-none focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-soft hover:text-gray-600 text-xs font-medium"
            >
              {showPass ? "Ẩn" : "Hiện"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 text-center">
            {countdown > 0
              ? error.replace(/\d+\s*giây/, `${countdown} giây`)
              : error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || countdown > 0}
          className="w-full bg-primary text-white py-3 text-sm font-bold uppercase tracking-wide hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {loading ? "Đang đăng nhập..." : countdown > 0 ? `Thử lại sau ${countdown}s` : "Đăng Nhập"}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-muted">
        Chưa có tài khoản?{" "}
        <Link href="/tai-khoan/dang-ky" className="text-primary font-semibold hover:underline">
          Đăng ký ngay
        </Link>
      </div>

      <div className="mt-4 text-center">
        <Link href="/" className="text-xs text-muted-soft hover:text-gray-600">
          ← Về trang chủ
        </Link>
      </div>
    </div>
  );
}

export default function DangNhapPage() {
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12 bg-surface-soft">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
