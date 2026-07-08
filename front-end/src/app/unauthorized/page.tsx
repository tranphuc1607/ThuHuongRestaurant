"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  ROLE_ADMIN:    "Quản trị viên",
  ROLE_EMPLOYEE: "Nhân viên",
  ROLE_USER:     "Khách hàng",
};

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user } = useAuth();

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  const roleLabel = user ? (ROLE_LABEL[user.role] ?? user.role) : null;

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-5">

      {/* Card */}
      <div className="w-full max-w-md">

        {/* Restaurant brand — top */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-soft">
            Nhà hàng Thu Hương
          </p>
        </div>

        {/* Icon block */}
        <div className="flex flex-col items-center mb-8">
          {/* Lock icon */}
          <div className="w-20 h-20 rounded-2xl bg-surface-card flex items-center justify-center mb-5 shadow-sm">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          {/* 403 badge */}
          <div className="text-[11px] font-bold tracking-widest text-muted-soft uppercase mb-3">
            Lỗi 403
          </div>

          {/* Heading */}
          <h1 className="text-2xl md:text-3xl font-bold text-ink text-center leading-snug mb-3">
            Không có quyền<br className="md:hidden" /> truy cập
          </h1>

          {/* Sub */}
          <p className="text-sm text-muted text-center leading-relaxed max-w-xs">
            Trang này chỉ dành cho người có quyền hạn phù hợp.
            {roleLabel && (
              <>
                {" "}Tài khoản hiện tại của bạn là{" "}
                <span className="font-semibold text-ink">{roleLabel}</span>.
              </>
            )}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-hairline mb-7" />

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={goBack}
            className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl text-sm hover:bg-primary-dark transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            ← Quay lại trang trước
          </button>

          <button
            onClick={() => router.push("/")}
            className="w-full py-3.5 bg-surface-card text-ink font-semibold rounded-2xl text-sm hover:bg-hairline transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            Về trang chủ
          </button>

          {!user && (
            <button
              onClick={() => router.push("/tai-khoan/dang-nhap")}
              className="w-full py-3.5 border border-hairline text-muted font-semibold rounded-2xl text-sm hover:bg-surface-soft transition-colors"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              Đăng nhập tài khoản khác
            </button>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-muted-soft mt-8">
          Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ quản trị viên.
        </p>
      </div>

      {/* Desktop decorative bottom brand */}
      <div className="hidden md:block fixed bottom-6 text-xs text-muted-soft text-center">
        © {new Date().getFullYear()} Nhà hàng Thu Hương
      </div>
    </div>
  );
}
