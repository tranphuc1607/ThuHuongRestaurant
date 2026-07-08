"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice, extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

interface Order {
  id: number;
  tableId: number;
  tableName?: string;
  tableNumber?: number;
  status: string;
  totalAmount: number;
  prepaidAmount: number;
  createdBy: string;
  note?: string;
  cancelReason?: string;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Đang mở", PAID: "Đã thanh toán", CANCELLED: "Đã hủy",
};
const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-orange-100 text-orange-700",
  PAID: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const FILTERS = [
  { v: "OPEN",      l: "Đang mở" },
  { v: "PAID",      l: "Đã TT" },
  { v: "CANCELLED", l: "Đã hủy" },
  { v: "",          l: "Tất cả" },
];

export default function EmployeeOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState(() =>
    searchParams.get("status") ?? (typeof window !== "undefined" ? (sessionStorage.getItem("order-filter") ?? "OPEN") : "OPEN")
  );
  const [cancelLoading, setCancelLoading] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const scrollMoved = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didRestoreScroll = useRef(false);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), size: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`${BASE}/orders?${params}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        setOrders(json.data.content ?? []);
        setTotalPages(json.data.totalPages ?? 0);
      } else {
        setError(json.message ?? "Không tải được đơn hàng");
        setOrders([]);
      }
    } catch { setError("Không kết nối được máy chủ"); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Restore scroll sau reload (1 lần duy nhất)
  useEffect(() => {
    if (!loading && !didRestoreScroll.current && scrollRef.current) {
      didRestoreScroll.current = true;
      const saved = sessionStorage.getItem("order-scroll");
      if (saved) scrollRef.current.scrollTop = parseInt(saved);
    }
  }, [loading]);

  async function cancelOrder(orderId: number, netRefund: number, hasItems: boolean) {
    if (netRefund > 0) { showToast("Cần hoàn tiền cho khách trước khi hủy"); return; }
    let reason = "";
    if (hasItems) {
      const input = prompt(`Lý do hủy đơn #${orderId}:`);
      if (input === null) return;
      reason = input.trim();
    } else {
      if (!confirm(`Hủy đơn #${orderId} và giải phóng bàn?`)) return;
    }
    setCancelLoading(orderId);
    try {
      const res = await fetch(`${BASE}/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (json.statusCode === 200) { showToast("Đã hủy — bàn đã giải phóng"); load(); }
      else showToast(extractApiError(json, "Hủy đơn thất bại"));
    } catch { showToast("Không kết nối được máy chủ"); }
    finally { setCancelLoading(null); }
  }

  const openCount = statusFilter === "OPEN" ? orders.length : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-canvas border-b border-hairline">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-ink leading-tight">Đơn hàng</h1>
            {statusFilter === "OPEN" && !loading && openCount > 0 && (
              <p className="text-xs text-orange-500 font-medium">{openCount} đơn đang mở</p>
            )}
          </div>
          <Link href="/employee/ban"
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-semibold rounded-lg touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="hidden sm:inline">Sơ đồ bàn</span>
            <span className="sm:hidden">Bàn</span>
          </Link>
        </div>

        {/* Filter pills — scrollable */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map(({ v, l }) => (
            <button key={v}
              onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); setPage(0); setStatusFilter(v); sessionStorage.setItem("order-filter", v); scrollRef.current?.scrollTo(0, 0); } }}
              onClick={() => { setPage(0); setStatusFilter(v); sessionStorage.setItem("order-filter", v); scrollRef.current?.scrollTo(0, 0); }}
              className={`flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-full border transition-colors touch-manipulation ${
                statusFilter === v
                  ? "bg-primary text-white border-primary"
                  : "bg-canvas text-gray-600 border-hairline"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-auto" style={{ overscrollBehavior: 'none' }}
        onScroll={() => { if (scrollRef.current) sessionStorage.setItem("order-scroll", String(scrollRef.current.scrollTop)); }}
        onPointerDown={(e) => { pointerDownPos.current = { x: e.clientX, y: e.clientY }; scrollMoved.current = false; }}
        onPointerMove={(e) => {
          const s = pointerDownPos.current;
          if (s && (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8)) scrollMoved.current = true;
        }}
        onClickCapture={(e) => {
          const s = pointerDownPos.current;
          const moved = scrollMoved.current || (s != null && (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8));
          if (moved) { e.stopPropagation(); e.preventDefault(); }
        }}>
        {error && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted">Đang tải...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="text-5xl mb-3">🍽️</div>
            <p className="text-base font-medium text-ink mb-1">Không có đơn hàng nào</p>
            {statusFilter === "OPEN" && (
              <Link href="/employee/ban" className="text-primary text-sm underline mt-1">
                → Vào sơ đồ bàn để mở bàn mới
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {orders.map(o => {
              const prepaid = o.prepaidAmount ?? 0;
              const netRefund = Math.round(prepaid - o.totalAmount);
              const needsRefund = netRefund > 0 && o.status === "OPEN";
              const hasItems = (o.totalAmount ?? 0) > 0;
              return (
                <div key={o.id}
                  className={`px-4 py-4 ${needsRefund ? "bg-amber-50/50" : ""}`}
                  onPointerDown={(e) => { pointerDownPos.current = { x: e.clientX, y: e.clientY }; }}
                  onClick={(e) => {
                    const s = pointerDownPos.current;
                    if (s && (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8)) return;
                    router.push(`/employee/don-hang/${o.id}?from=orders`);
                  }}>

                  {/* Top: ID + status */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-primary">#{o.id}</span>
                      {needsRefund && (
                        <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                          💰 CẦN HOÀN
                        </span>
                      )}
                    </div>
                    <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      needsRefund ? "bg-amber-100 text-amber-700" : (STATUS_STYLE[o.status] ?? "bg-gray-100 text-gray-500")
                    }`}>
                      {needsRefund ? "Hoàn tiền" : (STATUS_LABEL[o.status] ?? o.status)}
                    </span>
                  </div>

                  {/* Mid: info + amount */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">
                        {o.tableName ?? `Bàn ${o.tableId}`}
                      </div>
                      <div className="text-xs text-muted mt-0.5">Bởi: {o.createdBy}</div>
                      {o.note && (
                        <div className="text-xs text-muted-soft mt-0.5 line-clamp-1">📝 {o.note}</div>
                      )}
                      {o.status === "CANCELLED" && o.cancelReason && (
                        <div className="text-xs text-red-500 mt-0.5 line-clamp-1">Lý do: {o.cancelReason}</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-bold text-ink">{formatPrice(o.totalAmount)}</div>
                      {needsRefund ? (
                        <div className="text-xs font-bold text-amber-700 mt-0.5">Hoàn {formatPrice(netRefund)}</div>
                      ) : prepaid > 0 ? (
                        <div className="text-xs text-green-600 mt-0.5">Cọc {formatPrice(prepaid)}</div>
                      ) : null}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 pt-3 border-t border-hairline flex gap-2"
                    onClick={e => e.stopPropagation()}>
                    {o.status === "OPEN" ? (
                      <>
                        <Link href={`/employee/don-hang/${o.id}?from=orders`}
                          className="flex-1 flex items-center justify-center py-2.5 bg-primary text-white text-sm font-semibold rounded-xl touch-manipulation"
                          style={{ WebkitTapHighlightColor: "transparent" }}>
                          Quản lý
                        </Link>
                        {hasItems ? (
                          <Link href={`/employee/thanh-toan?orderId=${o.id}`}
                            className="flex-1 flex items-center justify-center py-2.5 bg-green-500 text-white text-sm font-semibold rounded-xl touch-manipulation"
                            style={{ WebkitTapHighlightColor: "transparent" }}>
                            Thanh toán
                          </Link>
                        ) : (
                          <span className="flex-1 flex items-center justify-center py-2.5 bg-gray-100 text-gray-400 text-sm rounded-xl">
                            Chưa có món
                          </span>
                        )}
                        <button
                          onClick={() => cancelOrder(o.id, netRefund, hasItems)}
                          disabled={cancelLoading === o.id}
                          className="px-4 py-2.5 bg-red-50 text-red-500 text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation"
                          style={{ WebkitTapHighlightColor: "transparent" }}>
                          {cancelLoading === o.id ? "..." : "Hủy"}
                        </button>
                      </>
                    ) : (
                      <Link href={`/employee/don-hang/${o.id}?from=orders`}
                        className="flex-1 flex items-center justify-center py-2.5 bg-surface-soft text-ink text-sm font-medium rounded-xl touch-manipulation"
                        style={{ WebkitTapHighlightColor: "transparent" }}>
                        Xem chi tiết
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 p-4 border-t border-hairline">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-5 py-2.5 text-sm font-medium border border-hairline rounded-xl disabled:opacity-40 touch-manipulation">
              ← Trước
            </button>
            <span className="text-sm text-muted font-medium">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-5 py-2.5 text-sm font-medium border border-hairline rounded-xl disabled:opacity-40 touch-manipulation">
              Tiếp →
            </button>
          </div>
        )}

        <div className="h-24 md:hidden" aria-hidden />
      </div>
    </div>
  );
}
