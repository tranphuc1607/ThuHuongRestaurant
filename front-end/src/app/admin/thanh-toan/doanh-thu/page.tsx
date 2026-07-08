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
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const METHOD_LABELS: Record<string, string> = { CASH: "Tiền mặt", CARD: "Thẻ", BANK_TRANSFER: "Chuyển khoản" };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/thanh-toan" className="text-muted-soft hover:text-gray-600 text-sm">← Quay lại</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-bold text-ink">Báo cáo doanh thu</h1>
      </div>

      {/* Date range picker */}
      <div className="bg-canvas rounded-lg border border-hairline-sm p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Từ ngày</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Đến ngày</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
          </div>
          <button onClick={load} disabled={loading}
            className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-60">
            {loading ? "Đang tải..." : "Xem báo cáo"}
          </button>
          <div className="flex gap-2 ml-auto flex-wrap">
            {[
              { label: "Hôm nay", f: todayISO(), t: todayISO() },
              { label: "Tháng này", f: monthStartISO(), t: todayISO() },
            ].map(p => (
              <button key={p.label} onClick={() => { setFrom(p.f); setTo(p.t); }}
                className="px-3 py-2 text-xs border border-hairline rounded hover:bg-surface-soft text-gray-600">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded mb-4">{error}</div>}

      {data && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-canvas rounded-lg border border-hairline-sm p-5 border-l-4 border-primary">
              <div className="text-xs text-muted uppercase mb-1">Tổng doanh thu</div>
              <div className="text-2xl font-bold text-primary">{formatPrice(data.totalRevenue)}</div>
            </div>
            <div className="bg-canvas rounded-lg border border-hairline-sm p-5 border-l-4 border-blue-400">
              <div className="text-xs text-muted uppercase mb-1">Số giao dịch</div>
              <div className="text-2xl font-bold text-ink">{data.totalTransactions}</div>
            </div>
          </div>

          {/* By method */}
          {data.byMethod && Object.keys(data.byMethod).length > 0 && (
            <div className="bg-canvas rounded-lg border border-hairline-sm p-5">
              <h3 className="text-sm font-bold text-ink mb-4 uppercase tracking-wide">Theo phương thức</h3>
              <div className="space-y-3">
                {Object.entries(data.byMethod).map(([method, amount]) => {
                  const pct = data.totalRevenue > 0 ? ((amount as number) / data.totalRevenue) * 100 : 0;
                  return (
                    <div key={method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{METHOD_LABELS[method] ?? method}</span>
                        <span className="font-semibold">{formatPrice(amount as number)} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-canvas rounded-full">
                        <div className="h-2 bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-soft text-center">
            Kỳ: {from} đến {to}
          </p>
        </div>
      )}
    </div>
  );
}
