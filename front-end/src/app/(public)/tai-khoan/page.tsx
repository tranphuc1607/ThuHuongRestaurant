"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  ROLE_ADMIN:    { label: "Quản trị viên", color: "bg-red-100 text-red-700" },
  ROLE_EMPLOYEE: { label: "Nhân viên",     color: "bg-blue-100 text-blue-700" },
  ROLE_USER:     { label: "Khách hàng",    color: "bg-green-100 text-green-700" },
};

type EditForm = { fullName: string; phone: string; email: string };

export default function TaiKhoanPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ fullName: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Redirect nếu chưa đăng nhập
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/tai-khoan/dang-nhap?redirect=/tai-khoan");
    }
  }, [loading, user, router]);

  // Sync edit form khi user load xong
  useEffect(() => {
    if (user) {
      setEditForm({
        fullName: user.fullName ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
      });
    }
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`${BASE_URL}/users/me`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fullName: editForm.fullName.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          email: editForm.email.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        await refreshUser(); // cập nhật lại AuthContext
        setEditing(false);
        setSaveMsg("Cập nhật thành công!");
        setTimeout(() => setSaveMsg(""), 3000);
      } else {
        setSaveMsg(json.message ?? "Cập nhật thất bại");
      }
    } catch {
      setSaveMsg("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    router.push("/");
    router.refresh();
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm text-muted-soft">Đang tải thông tin tài khoản...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const roleInfo = ROLE_LABEL[user.role] ?? { label: user.role, color: "bg-canvas text-gray-600" };
  const initials = (user.fullName ?? user.username).slice(0, 2).toUpperCase();

  return (
    <>
      {/* Hero strip */}
      <div
        className="py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #a9583e 0%, #cc785c 100%)" }}
      >
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-black mx-auto mb-3">
          {initials}
        </div>
        <h1 className="text-xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
          {user.fullName ?? user.username}
        </h1>
        <span className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${roleInfo.color}`}>
          {roleInfo.label}
        </span>
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface-soft border-b border-hairline py-2">
        <div className="max-w-[900px] mx-auto px-4 text-xs text-muted-soft flex gap-2">
          <Link href="/" className="hover:text-primary">Trang chủ</Link>
          <span>›</span>
          <span className="text-gray-600">Tài khoản</span>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-4 py-10">
        <div className="grid md:grid-cols-[220px_1fr] gap-8">

          {/* Sidebar nav */}
          <aside className="space-y-2">
            <nav className="bg-canvas border border-hairline">
              <div className="px-4 py-3 text-sm text-primary font-semibold border-l-2 border-l-primary bg-primary/5 border-b border-gray-50">
                Thông tin tài khoản
              </div>
              <Link
                href="/dat-ban/lich-su"
                className="block px-4 py-3 text-sm text-gray-600 hover:text-primary transition-colors border-b border-gray-50"
              >
                Lịch sử đặt bàn
              </Link>
            </nav>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 text-sm text-red-500 hover:text-red-600 border border-red-100 hover:border-red-200 transition-colors bg-canvas"
            >
              Đăng xuất
            </button>
          </aside>

          {/* Main content */}
          <div>
            <div className="bg-canvas border border-hairline">
              <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
                <h2 className="font-bold text-ink text-sm uppercase tracking-wide">
                  Thông tin tài khoản
                </h2>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    Chỉnh sửa
                  </button>
                )}
              </div>

              {saveMsg && (
                <div className={`px-6 py-3 text-sm text-center ${saveMsg.includes("thành công") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {saveMsg}
                </div>
              )}

              {editing ? (
                <form onSubmit={handleSave} className="p-6 space-y-4">
                  {[
                    { key: "fullName" as const, label: "Họ và tên", type: "text", placeholder: "Nguyễn Văn A" },
                    { key: "phone" as const, label: "Số điện thoại", type: "tel", placeholder: "0901 234 567" },
                    { key: "email" as const, label: "Email", type: "email", placeholder: "example@gmail.com" },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        {label}
                      </label>
                      <input
                        type={type}
                        value={editForm[key]}
                        onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-primary text-white px-6 py-2.5 text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-60"
                    >
                      {saving ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setSaveMsg(""); }}
                      className="border border-hairline text-gray-600 px-6 py-2.5 text-sm hover:border-gray-300 transition-colors"
                    >
                      Huỷ
                    </button>
                  </div>
                </form>
              ) : (
                <div className="divide-y divide-gray-50">
                  {[
                    { label: "Tên đăng nhập", value: user.username },
                    { label: "Họ và tên", value: user.fullName || "—" },
                    { label: "Số điện thoại", value: user.phone || "—" },
                    { label: "Email", value: user.email || "—" },
                    { label: "Vai trò", value: roleInfo.label },
                    { label: "Trạng thái", value: user.status === "ACTIVE" ? "Đang hoạt động" : user.status ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex px-6 py-3.5">
                      <span className="w-36 flex-shrink-0 text-xs text-muted-soft uppercase tracking-wide pt-0.5">
                        {label}
                      </span>
                      <span className="text-sm text-ink">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Link
                href="/dat-ban"
                className="border border-hairline bg-canvas p-4 hover:border-primary hover:shadow-sm transition-all group"
              >
                <div className="text-2xl mb-2">🪑</div>
                <div className="text-sm font-semibold text-ink group-hover:text-primary">Đặt bàn mới</div>
                <div className="text-xs text-muted-soft mt-0.5">Đặt bàn trực tuyến nhanh chóng</div>
              </Link>
              <Link
                href="/dat-ban/lich-su"
                className="border border-hairline bg-canvas p-4 hover:border-primary hover:shadow-sm transition-all group"
              >
                <div className="text-2xl mb-2">📋</div>
                <div className="text-sm font-semibold text-ink group-hover:text-primary">Lịch sử đặt bàn</div>
                <div className="text-xs text-muted-soft mt-0.5">Xem các lần đặt bàn của bạn</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
