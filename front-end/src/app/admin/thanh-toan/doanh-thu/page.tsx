"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface RevenueData {
  totalRevenue: number; totalTransactions: number;
  byMethod: Record<string, number>; byDate?: Record<string, number>;
}

function todayISO() {
  const d = new Date(); return d.toISOString().slice(0, 10);
}
function monthStartISO() {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
}

export default function RevenueReportPage() {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo]     = useState(todayISO());
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function load() {
    if (!from || !to) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ from: from + "T00:00:00Z", to: to + "T23:59:59Z" });
      const res = await fetch(`${BASE}/payments/revenue?${params}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) setData(json.data);
      else setError(json.message ?? "Không tải được dữ liệu");
    } catch { setError("Không kết nối được máy chủ"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const METHOD_LABELS: Record<string, string> = {
    CASH: "Tiền mặt", CARD: "Thẻ", BANK_TRANSFER: "Chuyển khoản",
  };
  const METHOD_COLORS: Record<string, string> = {
    CASH: "bg-green-500", CARD: "bg-blue-500", BANK_TRANSFER: "bg-purple-500",
  };

  return (
    <div className="p-3 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/thanh-toan"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface-card text-muted hover:bg-hairline transition-colors touch-manipulation text-sm"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          ←
        </Link>
        <h1 className="text-lg md:text-xl font-bold text-ink">Báo cáo doanh thu</h1>
      </div>

      {/* Date range picker */}
      <div className="bg-white rounded-2xl border border-hairline p-4 mb-5">
        {/* Quick presets */}
        <div className="flex gap-2 mb-3">
          {[
            { label: "Hôm nay", f: todayISO(), t: todayISO() },
            { label: "Tháng này", f: monthStartISO(), t: todayISO() },
          ].map(p => (
            <button key={p.label}
              onClick={() => { setFrom(p.f); setTo(p.t); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors touch-manipulation ${
                from === p.f && to === p.t
                  ? "bg-primary text-white border-primary"
                  : "border-hairline text-muted hover:border-primary/40"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Date inputs */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Từ ngày</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full border border-hairline px-3 py-2 text-sm rounded-xl outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Đến ngày</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full border border-hairline px-3 py-2 text-sm rounded-xl outline-none focus:border-primary" />
          </div>
        </div>

        <button onClick={load} disabled={loading}
          className="w-full py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          {loading ? "Đang tải..." : "Xem báo cáo"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-hairline p-4 border-l-4 border-l-primary">
              <div className="text-xs text-muted uppercase mb-1.5 font-semibold">Tổng doanh thu</div>
              <div className="text-xl md:text-2xl font-black text-primary leading-tight">{formatPrice(data.totalRevenue)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-hairline p-4 border-l-4 border-l-blue-400">
              <div className="text-xs text-muted uppercase mb-1.5 font-semibold">Giao dịch</div>
              <div className="text-xl md:text-2xl font-black text-ink leading-tight">{data.totalTransactions}</div>
            </div>
          </div>

          {/* By method */}
          {data.byMethod && Object.keys(data.byMethod).length > 0 && (
            <div className="bg-white rounded-2xl border border-hairline p-4">
              <h3 className="text-sm font-bold text-ink mb-4">Theo phương thức</h3>
              <div className="space-y-4">
                {Object.entries(data.byMethod).map(([method, amount]) => {
                  const pct = data.totalRevenue > 0 ? ((amount as number) / data.totalRevenue) * 100 : 0;
                  const barColor = METHOD_COLORS[method] ?? "bg-primary";
                  return (
                    <div key={method}>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-sm text-muted">{METHOD_LABELS[method] ?? method}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-ink">{formatPrice(amount as number)}</span>
                          <span className="text-xs text-muted-soft ml-1.5">({pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-surface-card rounded-full overflow-hidden">
                        <div className={`h-2 ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-soft text-center pb-4">
            Kỳ báo cáo: {from} → {to}
          </p>
        </div>
      )}
    </div>
  );
}
