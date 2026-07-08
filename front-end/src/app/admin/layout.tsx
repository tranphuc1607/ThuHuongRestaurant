"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/tai-khoan/dang-nhap?redirect=/admin/dashboard");
      return;
    }
    if (user.role !== "ROLE_ADMIN") {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "ROLE_ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-muted text-sm">Đang kiểm tra quyền truy cập...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <AdminSidebar />
      <div className="flex-1 overflow-auto pt-14 lg:pt-0">
        {children}
      </div>
    </div>
  );
}
