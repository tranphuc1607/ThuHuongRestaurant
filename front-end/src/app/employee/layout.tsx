"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import EmployeeSidebar from "@/components/employee/EmployeeSidebar";

const PULL_THRESHOLD = 60;
const MAX_PULL = 80;

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [timedOut, setTimedOut] = useState(false);

  const scrollEl = useRef<HTMLDivElement>(null);
  const startY = useRef(-1);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    const el = scrollEl.current;
    if (el && el.scrollTop === 0 && el.scrollHeight > el.clientHeight + 100) {
      startY.current = e.touches[0].clientY;
    } else {
      startY.current = -1;
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current < 0 || refreshingRef.current) return;
    const dy = e.touches[0].clientY - startY.current;
    setPullPx(dy > 0 ? Math.min(dy * 0.45, MAX_PULL) : 0);
  }

  function onTouchEnd() {
    if (pullPx >= PULL_THRESHOLD && !refreshingRef.current) {
      refreshingRef.current = true;
      setRefreshing(true);
      setTimeout(() => window.location.reload(), 600);
    } else {
      setPullPx(0);
    }
    startY.current = -1;
  }

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/tai-khoan/dang-nhap?redirect=/employee/ban");
      return;
    }
    if (user.role !== "ROLE_EMPLOYEE" && user.role !== "ROLE_ADMIN") {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user || (user.role !== "ROLE_EMPLOYEE" && user.role !== "ROLE_ADMIN")) {
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
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-muted text-sm">Đang kiểm tra quyền truy cập...</div>
      </div>
    );
  }

  const pullProgress = Math.min(pullPx / PULL_THRESHOLD, 1);
  const ready = pullPx >= PULL_THRESHOLD;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <EmployeeSidebar />
      <div
        ref={scrollEl}
        className="flex-1 overflow-y-auto h-full pb-16 md:pb-0"
        style={{ overscrollBehavior: 'none' } as React.CSSProperties}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          aria-hidden
          className="flex items-center justify-center gap-1.5 text-xs text-muted-soft select-none pointer-events-none overflow-hidden"
          style={{
            height: refreshing ? 52 : pullPx,
            transition: (!refreshing && pullPx === 0) ? 'height 0.2s ease' : 'none',
          }}
        >
          <span
            className={refreshing ? 'animate-spin inline-block' : 'inline-block'}
            style={!refreshing ? { transform: `rotate(${pullProgress * 180}deg)` } : {}}
          >
            ↻
          </span>
          <span>
            {refreshing ? 'Đang tải lại...' : ready ? 'Thả để tải lại' : 'Kéo xuống để tải lại'}
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}
