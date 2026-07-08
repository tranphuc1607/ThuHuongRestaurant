"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

type RevenuePeriod = {
  period: string; revenue: number; transactions: number; byMethod: Record<string, number>;
};
interface DashboardData {
  revenue?: {
    today: number; todayTransactions: number; todayByMethod: Record<string, number>;
    thisWeek: number; thisMonth: number;
    dailySeries: RevenuePeriod[]; weeklySeries: RevenuePeriod[];
    monthlySeries: RevenuePeriod[]; yearlySeries: RevenuePeriod[];
  };
  orders?: { open: number; paid: number; cancelled: number; occupiedTables: number; topProducts: { productName: string; quantity: number }[] };
  bookings?: { pendingPayment: number; confirmedToday: number; upcomingIn2Hours: number };
  inventory?: { lowStockCount: number; lowStockItems: { name: string; unit: string; currentQty: number; minThreshold: number }[] };
  users?: { activeAdmin: number; activeEmployee: number; totalActive: number };
}

// ── Config ───────────────────────────────────────────────────────────────────

const PERIOD_TABS = ["Ngày", "Tuần", "Tháng", "Năm"] as const;
type PeriodTab = typeof PERIOD_TABS[number];

const CURRENT_LABELS: Record<PeriodTab, string> = {
  "Ngày": "Hôm nay", "Tuần": "Tuần này", "Tháng": "Tháng này", "Năm": "Năm nay",
};

const METHOD_CONFIG: Record<string, { label: string; bar: string; dot: string; fill: string; pill: string }> = {
  BANK_TRANSFER: { label: "Chuyển khoản", bar: "bg-blue-500",    dot: "bg-blue-500",    fill: "#3b82f6", pill: "bg-blue-50 text-blue-700"     },
  CASH:          { label: "Tiền mặt",     bar: "bg-emerald-500", dot: "bg-emerald-500", fill: "#10b981", pill: "bg-emerald-50 text-emerald-700" },
  CARD:          { label: "Thẻ",          bar: "bg-violet-500",  dot: "bg-violet-500",  fill: "#8b5cf6", pill: "bg-violet-50 text-violet-700"   },
};
const METHOD_ORDER = ["BANK_TRANSFER", "CASH", "CARD"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPeriodLabel(period: string, tab: PeriodTab, idx: number): string {
  if (tab === "Ngày") {
    if (idx === 0) return "Hôm nay"; if (idx === 1) return "Hôm qua";
    const [y, m, d] = period.split("-"); return `${d}/${m}/${y}`;
  }
  if (tab === "Tuần") {
    if (idx === 0) return "Tuần này"; if (idx === 1) return "Tuần trước";
    const [y, w] = period.split("-W"); return `Tuần ${parseInt(w)} · ${y}`;
  }
  if (tab === "Tháng") {
    if (idx === 0) return "Tháng này"; if (idx === 1) return "Tháng trước";
    const [y, m] = period.split("-"); return `Tháng ${parseInt(m)} · ${y}`;
  }
  if (idx === 0) return "Năm nay"; if (idx === 1) return "Năm ngoái";
  return `Năm ${period}`;
}

function shortLabel(period: string, tab: PeriodTab, idx: number): string {
  if (tab === "Ngày") {
    if (idx === 0) return "H.nay"; if (idx === 1) return "H.qua";
    const [, m, d] = period.split("-"); return `${d}/${m}`;
  }
  if (tab === "Tuần") {
    if (idx === 0) return "T.này"; if (idx === 1) return "T.trước";
    const [, w] = period.split("-W"); return `T${parseInt(w)}`;
  }
  if (tab === "Tháng") {
    if (idx === 0) return "T.này"; if (idx === 1) return "T.trước";
    const [y, m] = period.split("-"); return `T${parseInt(m)}/${y.slice(2)}`;
  }
  if (idx === 0) return "Năm nay"; if (idx === 1) return "Năm ngoái";
  return period;
}

function getPeriodDateRange(period: string, tab: PeriodTab, idx: number): string {
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const today = new Date();
  if (tab === "Ngày") { const [y,m,d]=period.split("-").map(Number); return fmt(new Date(y,m-1,d)); }
  if (tab === "Tuần") {
    const [yr,wk]=period.split("-W"); const year=parseInt(yr),week=parseInt(wk);
    const jan4=new Date(year,0,4); const dow=jan4.getDay()||7;
    const mon=new Date(jan4); mon.setDate(jan4.getDate()-(dow-1)+(week-1)*7);
    const sun=new Date(mon); sun.setDate(mon.getDate()+6);
    return `${fmt(mon)} – ${fmt(idx===0?today:sun)}`;
  }
  if (tab === "Tháng") {
    const [y,m]=period.split("-").map(Number);
    return `${fmt(new Date(y,m-1,1))} – ${fmt(idx===0?today:new Date(y,m,0))}`;
  }
  const y=parseInt(period);
  return `${fmt(new Date(y,0,1))} – ${fmt(idx===0?today:new Date(y,11,31))}`;
}

function todayStr() {
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtDate(s:string){const[y,m,d]=s.split("-");return `${d}/${m}/${y}`;}
function addDays(s:string,n:number){
  const d=new Date(s+"T00:00:00"); d.setDate(d.getDate()+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
const yFmt=(v:number)=>v>=1_000_000?`${(v/1_000_000).toFixed(1)}M`:v>=1_000?`${(v/1_000).toFixed(0)}k`:"0";

// ── Chart tooltips ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RevTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <div className="text-gray-500 mb-1">{label}</div>
      <div className="font-bold text-gray-900">{formatPrice(payload[0].value)}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OrderTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <div className="font-semibold text-gray-800">{payload[0].name}: {payload[0].value}</div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function NavBtn({ onClick, disabled, children }: { onClick:()=>void; disabled?:boolean; children:React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 flex items-center justify-center text-gray-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all flex-shrink-0">
      {children}
    </button>
  );
}
const ChevL = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>;
const ChevR = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>;

function KpiCard({ value, label, icon, accent }: { value:string|number; label:string; icon:React.ReactNode; accent:string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-2.5 md:p-4 flex items-center gap-2 md:gap-3">
      <div className={`w-8 h-8 md:w-11 md:h-11 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        <span className="scale-75 md:scale-100 block">{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-xl md:text-2xl font-bold text-gray-900 leading-none">{value}</div>
        <div className="text-[10px] md:text-xs text-gray-500 mt-0.5 md:mt-1 leading-tight">{label}</div>
      </div>
    </div>
  );
}

function MethodBreakdown({ byMethod, total }: { byMethod:Record<string,number>; total:number }) {
  const methods = METHOD_ORDER.filter(m => (byMethod[m]??0) > 0);
  if (!methods.length) return <div className="flex items-center justify-center h-24 text-sm text-gray-400">Không có giao dịch</div>;
  return (
    <div className="space-y-3">
      {methods.map(key => {
        const amount = byMethod[key]??0;
        const pct = total>0 ? Math.round((amount/total)*100) : 0;
        const cfg = METHOD_CONFIG[key];
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`}/>
                <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.pill}`}>{pct}%</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{formatPrice(amount)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`} style={{width:`${pct}%`}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData]               = useState<DashboardData|null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [periodTab, setPeriodTab]     = useState<PeriodTab>("Ngày");
  const [periodIdx, setPeriodIdx]     = useState(0);
  const [statsDate, setStatsDate]     = useState(todayStr());
  const [dayOrders, setDayOrders]     = useState<DashboardData["orders"]|null>(null);
  const [dayBookings, setDayBookings] = useState<DashboardData["bookings"]|null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(()=>{
    (async()=>{
      try {
        const res  = await fetch(`${BASE}/dashboard/summary`,{headers:getAuthHeaders()});
        const json = await res.json();
        if(json.statusCode===200) setData(json.data);
        else setError(`Lỗi ${res.status}: ${json.message??""}`);
      } catch(e){ setError(`Không kết nối được máy chủ: ${e}`); }
      finally { setLoading(false); }
    })();
  },[]);

  useEffect(()=>{
    (async()=>{
      setStatsLoading(true);
      try {
        const [oR,bR] = await Promise.all([
          fetch(`${BASE}/orders/stats?date=${statsDate}`,{headers:getAuthHeaders()}),
          fetch(`${BASE}/bookings/stats?date=${statsDate}`,{headers:getAuthHeaders()}),
        ]);
        const [oJ,bJ] = await Promise.all([oR.json(),bR.json()]);
        if(oJ.statusCode===200) setDayOrders(oJ.data);
        if(bJ.statusCode===200) setDayBookings(bJ.data);
      } catch{} finally { setStatsLoading(false); }
    })();
  },[statsDate]);

  useEffect(()=>setPeriodIdx(0),[periodTab]);

  if(loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
        <p className="text-sm text-gray-500">Đang tải dashboard...</p>
      </div>
    </div>
  );
  if(error) return <div className="p-8 text-red-500">{error}</div>;
  if(!data) return null;

  const {revenue, inventory, users} = data;
  const orders   = dayOrders   ?? data.orders;
  const bookings = dayBookings ?? data.bookings;
  const isToday      = statsDate === todayStr();
  const canGoForward = statsDate < todayStr();

  const seriesMap: Record<PeriodTab,RevenuePeriod[]> = {
    "Ngày":  revenue?.dailySeries   ?? [],
    "Tuần":  revenue?.weeklySeries  ?? [],
    "Tháng": revenue?.monthlySeries ?? [],
    "Năm":   revenue?.yearlySeries  ?? [],
  };
  const currentSeries   = seriesMap[periodTab];
  const current         = currentSeries[periodIdx] ?? null;
  const canRevGoBack    = periodIdx < currentSeries.length - 1;
  const canRevGoForward = periodIdx > 0;

  // Chart data — reversed (oldest left → newest right)
  const revChartData = [...currentSeries].reverse().map((p,i)=>{
    const idx = currentSeries.length - 1 - i;
    return { name: shortLabel(p.period, periodTab, idx), revenue: p.revenue, idx, selected: idx===periodIdx };
  });

  // Order donut
  const orderTotal = (orders?.open??0)+(orders?.paid??0)+(orders?.cancelled??0);
  const orderDonut = [
    {name:"Đang mở",   value:orders?.open??0,      fill:"#fb923c"},
    {name:"Đã TT",     value:orders?.paid??0,       fill:"#34d399"},
    {name:"Đã hủy",   value:orders?.cancelled??0,  fill:"#f87171"},
  ].filter(d=>d.value>0);

  // Top products bar
  const topMax = Math.max(...(orders?.topProducts??[]).map(p=>p.quantity), 1);

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-5 space-y-3 md:space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})}
          </p>
        </div>
        <Link href="/admin/thanh-toan"
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
          </svg>
          Thanh toán
        </Link>
      </div>

      {/* ── Revenue ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {PERIOD_TABS.map(tab=>(
            <button key={tab} onClick={()=>setPeriodTab(tab)}
              className={`flex-1 py-2.5 md:py-3.5 text-sm font-semibold transition-all ${periodTab===tab?"text-primary border-b-2 border-primary bg-primary/5":"text-gray-400 hover:text-gray-700 hover:bg-gray-50"}`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Period nav */}
          <div className="flex items-center gap-3">
            <NavBtn onClick={()=>setPeriodIdx(i=>i+1)} disabled={!canRevGoBack}><ChevL/></NavBtn>
            <div className="flex-1 text-center">
              <div className="font-bold text-gray-900">{current?getPeriodLabel(current.period,periodTab,periodIdx):"—"}</div>
              {current && <div className="text-xs text-gray-400 mt-0.5">{getPeriodDateRange(current.period,periodTab,periodIdx)}</div>}
              <div className="mt-1.5">
                {periodIdx===0
                  ? <span className="inline-block px-3 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">{CURRENT_LABELS[periodTab]}</span>
                  : <button onClick={()=>setPeriodIdx(0)} className="inline-block px-3 py-0.5 rounded-full bg-gray-100 hover:bg-primary/10 text-gray-500 hover:text-primary text-xs font-semibold transition-colors">↩ Về {CURRENT_LABELS[periodTab]}</button>
                }
              </div>
            </div>
            <NavBtn onClick={()=>setPeriodIdx(i=>i-1)} disabled={!canRevGoForward}><ChevR/></NavBtn>
          </div>

          {/* Stats + breakdown */}
          {current ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="flex flex-col justify-center">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Doanh thu</div>
                <div className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight leading-none">{formatPrice(current.revenue)}</div>
                <div className="flex items-center gap-1.5 mt-3 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                  {current.transactions} giao dịch
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {METHOD_ORDER.filter(m=>(current.byMethod?.[m]??0)>0).map(key=>{
                    const cfg=METHOD_CONFIG[key];
                    return (
                      <span key={key} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>
                        {cfg.label}: {formatPrice(current.byMethod[key])}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Theo phương thức</div>
                <MethodBreakdown byMethod={current.byMethod??{}} total={current.revenue}/>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 text-sm">Chưa có dữ liệu</div>
          )}

          {/* ── Revenue trend bar chart ── */}
          {revChartData.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Xu hướng · {CURRENT_LABELS[periodTab]} được tô sáng
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={revChartData} barSize={revChartData.length > 20 ? 8 : 14}
                  onClick={(d: unknown)=>{ const p = d as {activePayload?: {payload: {idx: number}}[]}; if(p?.activePayload?.[0]) setPeriodIdx(p.activePayload[0].payload.idx); }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false}
                    interval={revChartData.length > 15 ? Math.floor(revChartData.length/8) : 0}/>
                  <YAxis tickFormatter={yFmt} tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} width={36}/>
                  <Tooltip content={<RevTooltip/>} cursor={{fill:"#f9fafb"}}/>
                  <Bar dataKey="revenue" radius={[4,4,0,0]} style={{cursor:"pointer"}}>
                    {revChartData.map((entry,i)=>(
                      <Cell key={i} fill={entry.selected?"#6366f1":"#e5e7eb"}
                        className="hover:opacity-80 transition-opacity"/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-gray-400 mt-1">Click vào cột để xem chi tiết kỳ đó</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Operations ──────────────────────────────────────────────────── */}
      <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-opacity ${statsLoading?"opacity-60":""}`}>

        {/* Date nav header */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 flex items-center gap-3">
          <NavBtn onClick={()=>setStatsDate(d=>addDays(d,-1))}><ChevL/></NavBtn>
          <div className="flex-1 text-center">
            <span className="font-bold text-gray-900">{isToday?"Hôm nay":fmtDate(statsDate)}</span>
            {!isToday && <span className="text-gray-400 text-sm ml-2">— {fmtDate(statsDate)}</span>}
            {!isToday
              ? <button onClick={()=>setStatsDate(todayStr())} className="ml-3 px-2.5 py-0.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors">↩ Hôm nay</button>
              : <span className="ml-3 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">Hôm nay</span>
            }
          </div>
          <NavBtn onClick={()=>setStatsDate(d=>addDays(d,1))} disabled={!canGoForward}><ChevR/></NavBtn>
        </div>

        <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">

          {/* Orders */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-700">Đơn hàng</h3>
            </div>

            <div className="flex gap-4 items-center">
              {/* Donut */}
              {orderTotal > 0 ? (
                <div className="flex-shrink-0 relative">
                  <PieChart width={110} height={110}>
                    <Pie data={orderDonut} cx={50} cy={50} innerRadius={32} outerRadius={50}
                      dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                      {orderDonut.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                    </Pie>
                    <Tooltip content={<OrderTooltip/>}/>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-gray-900">{orderTotal}</span>
                    <span className="text-xs text-gray-400">đơn</span>
                  </div>
                </div>
              ) : (
                <div className="w-[110px] h-[110px] flex-shrink-0 rounded-full bg-gray-50 flex items-center justify-center">
                  <span className="text-xs text-gray-400">Không có</span>
                </div>
              )}

              {/* KPI list */}
              <div className="flex-1 space-y-2">
                {[
                  {label:"Đang mở",  value:orders?.open??0,           color:"text-orange-500", dot:"bg-orange-400"},
                  {label:"Đã TT",    value:orders?.paid??0,            color:"text-emerald-600",dot:"bg-emerald-400"},
                  {label:"Bàn dùng", value:isToday?(orders?.occupiedTables??0):"—", color:"text-blue-600",   dot:"bg-blue-400"},
                  {label:"Đã hủy",   value:orders?.cancelled??0,       color:"text-red-500",    dot:"bg-red-400"},
                ].map(item=>(
                  <div key={item.label} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.dot}`}/>
                      <span className="text-sm text-gray-600">{item.label}</span>
                    </div>
                    <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bookings */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-700">Đặt bàn</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <KpiCard value={bookings?.pendingPayment??0} label="Chờ thanh toán" accent="bg-amber-100"
                icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}/>
              <KpiCard value={bookings?.confirmedToday??0} label="Đã xác nhận" accent="bg-emerald-100"
                icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}/>
              <KpiCard value={bookings?.upcomingIn2Hours??0} label={isToday?"Sắp tới (2h)":"Tổng lịch"} accent="bg-blue-100"
                icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>}/>
            </div>

            {/* Booking total bar */}
            {(bookings?.pendingPayment??0)+(bookings?.confirmedToday??0) > 0 && (
              <div className="mt-5 p-4 bg-gray-50 rounded-xl">
                <div className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-widest">Tỉ lệ đặt bàn</div>
                {[
                  {label:"Chờ TT",   value:bookings?.pendingPayment??0, fill:"bg-amber-400"},
                  {label:"Xác nhận", value:bookings?.confirmedToday??0, fill:"bg-emerald-400"},
                ].map(item=>{
                  const bkTotal=(bookings?.pendingPayment??0)+(bookings?.confirmedToday??0);
                  const pct=bkTotal>0?Math.round((item.value/bkTotal)*100):0;
                  return (
                    <div key={item.label} className="flex items-center gap-3 mb-2 last:mb-0">
                      <span className="text-xs text-gray-500 w-16 flex-shrink-0">{item.label}</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.fill}`} style={{width:`${pct}%`}}/>
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-8 text-right">{item.value}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Top products - horizontal bar chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-pink-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <h3 className="text-sm font-bold text-gray-700">
              Top 5 món · {isToday?"Hôm nay":fmtDate(statsDate)}
            </h3>
          </div>
          {(orders?.topProducts??[]).length > 0 ? (
            <div className="space-y-3.5">
              {orders!.topProducts.map((p,i)=>{
                const pct = Math.round((p.quantity/topMax)*100);
                const colors=["#f59e0b","#94a3b8","#f97316","#3b82f6","#8b5cf6"];
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
                          style={{background:colors[i]??'#94a3b8'}}>{i+1}</span>
                        <span className="text-sm text-gray-700 truncate max-w-[120px]">{p.productName}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900 ml-2">{p.quantity}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{width:`${pct}%`, background:colors[i]??'#94a3b8'}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-gray-400 text-sm">Chưa có dữ liệu</div>
          )}
        </div>

        {/* Low stock */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-700">Kho sắp hết</h3>
            </div>
            {(inventory?.lowStockCount??0)>0 && (
              <span className="bg-red-100 text-red-600 text-xs font-bold px-2.5 py-1 rounded-full">
                {inventory!.lowStockCount} mặt hàng
              </span>
            )}
          </div>
          {(inventory?.lowStockItems??[]).length>0 ? (
            <div className="space-y-3">
              {inventory!.lowStockItems.slice(0,6).map((item,i)=>{
                const pct=item.minThreshold>0?Math.min(Math.round((item.currentQty/item.minThreshold)*100),100):100;
                const urgent=pct<30;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 truncate flex-1">{item.name}</span>
                      <span className={`text-xs font-bold ml-2 ${urgent?"text-red-500":"text-orange-500"}`}>
                        {item.currentQty} {item.unit}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${urgent?"bg-red-400":"bg-orange-400"}`}
                        style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center">
              <div className="text-2xl mb-1">✅</div>
              <div className="text-sm text-gray-400">Tất cả nguyên liệu đủ hàng</div>
            </div>
          )}
        </div>

        {/* Staff */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h3 className="text-sm font-bold text-gray-700">Nhân sự</h3>
          </div>

          {/* Mini bar chart for staff */}
          {(users?.totalActive??0)>0 && (
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={[
                {name:"Admin",    value:users?.activeAdmin??0,    fill:"#6366f1"},
                {name:"Nhân viên",value:users?.activeEmployee??0, fill:"#3b82f6"},
              ]} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:"#9ca3af"}} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip content={<OrderTooltip/>}/>
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {[{fill:"#6366f1"},{fill:"#3b82f6"}].map((d,i)=><Cell key={i} fill={d.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="space-y-3 mt-3">
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
              <span className="text-sm text-indigo-700 font-medium">Quản trị viên</span>
              <span className="text-xl font-bold text-indigo-700">{users?.activeAdmin??0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <span className="text-sm text-blue-700 font-medium">Nhân viên</span>
              <span className="text-xl font-bold text-blue-700">{users?.activeEmployee??0}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500 font-semibold">Tổng hoạt động</span>
              <span className="text-2xl font-bold text-gray-900">{users?.totalActive??0}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
