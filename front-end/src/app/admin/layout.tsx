"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  // Nếu loading quá 8 giây (token cũ + backend chậm) → cho phép retry
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/tai-khoan/dang-nhap?redirect=/admin/dashboard");
      return;
    }
    if (user.role !== "ROLE_ADMIN") {
      router.push("/unauthorized");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "ROLE_ADMIN") {
    if (timedOut) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-canvas px-6">
          <div className="text-3xl">⚠️</div>
          <div className="text-ink font-semibold text-center">Không kết nối được máy chủ</div>
          <div className="text-muted-soft text-sm text-center">Kiểm tra mạng hoặc thử lại</div>
          <button
            onClick={() => { setTimedOut(false); window.location.reload(); }}
            className="mt-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl text-sm touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            Thử lại
          </button>
          <a href="/tai-khoan/dang-nhap" className="text-xs text-muted-soft underline mt-1">
            Đăng nhập lại
          </a>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-canvas">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <div className="text-muted-soft text-xs">Đang kiểm tra quyền truy cập...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <AdminSidebar />
      <div id="admin-scroll-content" className="flex-1 overflow-auto pt-14 lg:pt-0">
        {children}
      </div>
    </div>
  );
}
