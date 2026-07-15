"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice, extractApiError } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

type TableZone = "OUTDOOR" | "INDOOR_FLOOR_1" | "INDOOR_FLOOR_2";
type ZoneFilter = TableZone | "ALL";

const ZONE_LABEL: Record<TableZone, string> = {
  OUTDOOR: "Ngoài trời",
  INDOOR_FLOOR_1: "Tầng 1",
  INDOOR_FLOOR_2: "Tầng 2",
};

const ZONE_ICON: Record<TableZone, string> = {
  OUTDOOR: "🌿",
  INDOOR_FLOOR_1: "🏠",
  INDOOR_FLOOR_2: "🏢",
};

const ZONES: TableZone[] = ["OUTDOOR", "INDOOR_FLOOR_1", "INDOOR_FLOOR_2"];

interface TableItem {
  id: number;
  tableNumber: number;
  name: string;
  qrToken: string;
  status: "AVAILABLE" | "OCCUPIED";
  zone: TableZone;
  note?: string;
}
interface OrderItem {
  id: number;
  productName: string;
  productPrice: number;
  quantity: number;
  saleUnit: string;
  itemTotal: number;
}
interface OpenOrder {
  id: number;
  tableId?: number;
  status: string;
  totalAmount: number;
  prepaidAmount: number;
  createdBy: string;
  note?: string;
  items: OrderItem[];
}
type RefundMap = Record<number, { orderId: number; refundAmount: number }>;

export default function TableMapPage() {
  const router = useRouter();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [refundMap, setRefundMap] = useState<RefundMap>({});
  const [loading, setLoading] = useState(true);
  const [activeZone, setActiveZone] = useState<ZoneFilter>("ALL");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Create modal (bàn trống)
  const [createModal, setCreateModal] = useState<TableItem | null>(null);
  const [createNote, setCreateNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // QR overlay sau khi mở bàn thành công
  const [qrOverlay, setQrOverlay] = useState<{ orderId: number; tableName: string; qrToken: string } | null>(null);

  // Order panel (bàn đang phục vụ)
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OpenOrder | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [origin, setOrigin] = useState("");
  const [panelToast, setPanelToast] = useState<string | null>(null);

  useEffect(() => { setOrigin(process.env.NEXT_PUBLIC_APP_URL || window.location.origin); }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [tablesRes, ordersRes] = await Promise.all([
        fetch(`${BASE}/orders/tables`, { headers: getAuthHeaders() }),
        fetch(`${BASE}/orders?status=OPEN&size=100`, { headers: getAuthHeaders() }),
      ]);
      const tablesJson = await tablesRes.json();
      const ordersJson = await ordersRes.json();
      if (tablesJson.statusCode === 200) {
        const d = tablesJson.data;
        setTables((Array.isArray(d) ? d : (d.content ?? [])).sort(
          (a: TableItem, b: TableItem) => a.tableNumber - b.tableNumber
        ));
      }
      if (ordersJson.statusCode === 200) {
        const orders: OpenOrder[] = ordersJson.data?.content ?? ordersJson.data ?? [];
        const map: RefundMap = {};
        for (const o of orders) {
          const refundAmt = Math.round((o.prepaidAmount ?? 0) - o.totalAmount);
          if (refundAmt > 0 && o.tableId) map[o.tableId] = { orderId: o.id, refundAmount: refundAmt };
        }
        setRefundMap(map);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  async function openOrderPanel(table: TableItem) {
    setSelectedTable(table);
    setCurrentOrder(null);
    setOrderLoading(true);
    setPanelToast(null);
    try {
      const res = await fetch(`${BASE}/orders/table/${table.qrToken}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200 && json.data) setCurrentOrder(json.data);
    } finally {
      setOrderLoading(false);
    }
  }

  function openCreateModal(table: TableItem) {
    setCreateNote("");
    setCreateError("");
    setCreateModal(table);
  }

  async function submitCreate() {
    if (!createModal) return;
    setCreating(true);
    setCreateError("");
    try {
      const body: Record<string, unknown> = { tableId: createModal.id };
      if (createNote.trim()) body.note = createNote.trim();
      const res = await fetch(`${BASE}/orders`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        setCreateModal(null);
        const newQrToken = json.data.tableQrToken ?? createModal.qrToken;
        setQrOverlay({ orderId: json.data.id, tableName: createModal.name, qrToken: newQrToken });
        load(true);
      } else {
        setCreateError(extractApiError(json, "Tạo đơn thất bại"));
      }
    } catch {
      setCreateError("Không kết nối được máy chủ");
    } finally {
      setCreating(false);
    }
  }

  async function processRefundPanel() {
    if (!currentOrder) return;
    const amount = panelNetRefund;
    if (!confirm(`Xác nhận đã hoàn ${formatPrice(amount)} cho khách?`)) return;
    setRefundLoading(true);
    try {
      const res = await fetch(`${BASE}/payments/orders/${currentOrder.id}/refund`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        setPanelToast(`Đã hoàn ${formatPrice(amount)} ✓`);
        setTimeout(() => setPanelToast(null), 3000);
        load(true);
      } else {
        setPanelToast(extractApiError(json, "Không thể ghi nhận hoàn tiền"));
        setTimeout(() => setPanelToast(null), 3000);
      }
    } catch {
      setPanelToast("Không kết nối được máy chủ");
      setTimeout(() => setPanelToast(null), 3000);
    } finally {
      setRefundLoading(false);
    }
  }

  async function cancelOrderPanel() {
    if (!currentOrder) return;
    if (panelNetRefund > 0) {
      setPanelToast("Cần hoàn tiền cho khách trước khi hủy");
      setTimeout(() => setPanelToast(null), 3000);
      return;
    }
    const hasItems = (currentOrder.items?.length ?? 0) > 0;
    let reason = "";
    if (hasItems) {
      const input = prompt(`Lý do hủy đơn #${currentOrder.id}:`);
      if (input === null) return;
      reason = input.trim();
    } else {
      if (!confirm(`Hủy đơn #${currentOrder.id} và giải phóng bàn?`)) return;
    }
    setCancelLoading(true);
    try {
      const res = await fetch(`${BASE}/orders/${currentOrder.id}/cancel`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        setTables(prev => prev.map(t =>
          t.id === selectedTable!.id ? { ...t, status: "AVAILABLE" as const } : t
        ));
        setRefundMap(prev => { const m = { ...prev }; delete m[selectedTable!.id]; return m; });
        setCurrentOrder(null);
        setSelectedTable(null);
        load(true);
      } else {
        setPanelToast(extractApiError(json, "Hủy đơn thất bại"));
        setTimeout(() => setPanelToast(null), 3000);
      }
    } catch {
      setPanelToast("Không kết nối được máy chủ");
      setTimeout(() => setPanelToast(null), 3000);
    } finally {
      setCancelLoading(false);
    }
  }

  function closePanel() { setSelectedTable(null); setCurrentOrder(null); }

  // ── Derived ───────────────────────────────────────────────────────────────

  const available   = tables.filter(t => t.status === "AVAILABLE").length;
  const occupied    = tables.filter(t => t.status === "OCCUPIED").length;
  const refundCount = Object.keys(refundMap).length;

  const panelPrepaid    = currentOrder?.prepaidAmount ?? 0;
  const panelNetRefund  = Math.round(panelPrepaid - (currentOrder?.totalAmount ?? 0));
  const panelNeedRefund = panelNetRefund > 0;

  const filteredTables = activeZone === "ALL" ? tables : tables.filter(t => t.zone === activeZone);

  const zoneCounts = ZONES.reduce((acc, z) => {
    acc[z] = tables.filter(t => t.zone === z).length;
    return acc;
  }, {} as Record<TableZone, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-muted-soft text-sm">Đang tải sơ đồ bàn...</div>
      </div>
    );
  }

  return (
    <div className="relative">

      {/* ── MAIN CONTENT ── */}
      <div className="p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-ink">Sơ đồ bàn</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-sm">
              <span className="text-green-600 font-semibold">{available} trống</span>
              <span className="text-orange-500 font-semibold">{occupied} phục vụ</span>
              <span className="text-muted-soft">{tables.length} bàn</span>
              {refundCount > 0 && (
                <span className="text-amber-600 font-semibold">💰 {refundCount} hoàn tiền</span>
              )}
            </div>
          </div>
          <button onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas border border-hairline text-gray-600 text-sm rounded-lg hover:bg-surface-card transition-colors">
            <span className="text-base leading-none">↻</span>
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>

        {/* Refund alert */}
        {refundCount > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl shrink-0">💰</span>
            <div className="text-sm text-amber-800">
              <span className="font-bold">{refundCount} bàn</span> cần hoàn tiền cọc — bấm vào bàn để xử lý.
            </div>
          </div>
        )}

        {/* Zone tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-surface-soft rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveZone("ALL")}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeZone === "ALL"
                ? "bg-canvas shadow text-ink"
                : "text-muted-soft hover:text-ink"
            }`}
          >
            Tất cả
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeZone === "ALL" ? "bg-primary/10 text-primary" : "bg-hairline text-muted-soft"}`}>
              {tables.length}
            </span>
          </button>
          {ZONES.map(zone => (
            <button
              key={zone}
              onClick={() => setActiveZone(zone)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeZone === zone
                  ? "bg-canvas shadow text-ink"
                  : "text-muted-soft hover:text-ink"
              }`}
            >
              <span>{ZONE_ICON[zone]}</span>
              <span>{ZONE_LABEL[zone]}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeZone === zone ? "bg-primary/10 text-primary" : "bg-hairline text-muted-soft"}`}>
                {zoneCounts[zone]}
              </span>
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border-2 border-green-400 bg-green-50 inline-block" />
            Trống
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border-2 border-orange-400 bg-orange-50 inline-block" />
            Đang phục vụ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-amber-500 text-sm">💰</span>
            Cần hoàn tiền
          </span>
        </div>

        {/* Table grid — grouped by zone when ALL, else flat */}
        {activeZone === "ALL" ? (
          <div className="space-y-6">
            {ZONES.map(zone => {
              const zoneTables = tables.filter(t => t.zone === zone);
              if (zoneTables.length === 0) return null;
              return (
                <div key={zone}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{ZONE_ICON[zone]}</span>
                    <span className="font-bold text-ink text-sm">{ZONE_LABEL[zone]}</span>
                    <span className="text-xs text-muted-soft">({zoneTables.length} bàn)</span>
                    <div className="flex-1 h-px bg-hairline" />
                  </div>
                  <TableGrid
                    tables={zoneTables}
                    refundMap={refundMap}
                    selectedTable={selectedTable}
                    pointerDownPos={pointerDownPos}
                    onAvailable={openCreateModal}
                    onOccupied={openOrderPanel}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          filteredTables.length === 0 ? (
            <div className="text-center py-20 text-muted-soft">
              <div className="text-5xl mb-3">🪑</div>
              <p className="text-sm">Chưa có bàn nào trong khu vực này</p>
            </div>
          ) : (
            <TableGrid
              tables={filteredTables}
              refundMap={refundMap}
              selectedTable={selectedTable}
              pointerDownPos={pointerDownPos}
              onAvailable={openCreateModal}
              onOccupied={openOrderPanel}
            />
          )
        )}

        <div className="h-24 md:hidden" aria-hidden />
      </div>

      {/* ── PANEL: Bottom sheet (mobile) / Right panel (desktop) ── */}
      {selectedTable && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={closePanel} />

          {/* Desktop right panel */}
          <div className="hidden md:flex fixed right-0 top-0 h-full w-80 bg-canvas border-l border-hairline flex-col z-30">
            <PanelContent
              selectedTable={selectedTable}
              currentOrder={currentOrder}
              orderLoading={orderLoading}
              panelNeedRefund={panelNeedRefund}
              panelNetRefund={panelNetRefund}
              panelPrepaid={panelPrepaid}
              panelToast={panelToast}
              origin={origin}
              refundLoading={refundLoading}
              cancelLoading={cancelLoading}
              onClose={closePanel}
              onRefund={processRefundPanel}
              onCancel={cancelOrderPanel}
              onManage={() => router.push(`/employee/don-hang/${currentOrder!.id}?from=ban`)}
              onCheckout={() => router.push(`/employee/thanh-toan?orderId=${currentOrder!.id}&tableId=${selectedTable.id}`)}
            />
          </div>

          {/* Mobile bottom sheet */}
          <div className="md:hidden fixed bottom-16 left-0 right-0 z-50 bg-canvas rounded-t-2xl shadow-2xl border-t border-hairline max-h-[80vh] flex flex-col">
            <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-hairline" />
            </div>
            <PanelContent
              selectedTable={selectedTable}
              currentOrder={currentOrder}
              orderLoading={orderLoading}
              panelNeedRefund={panelNeedRefund}
              panelNetRefund={panelNetRefund}
              panelPrepaid={panelPrepaid}
              panelToast={panelToast}
              origin={origin}
              refundLoading={refundLoading}
              cancelLoading={cancelLoading}
              onClose={closePanel}
              onRefund={processRefundPanel}
              onCancel={cancelOrderPanel}
              onManage={() => router.push(`/employee/don-hang/${currentOrder!.id}?from=ban`)}
              onCheckout={() => router.push(`/employee/thanh-toan?orderId=${currentOrder!.id}&tableId=${selectedTable.id}`)}
            />
          </div>
        </>
      )}

      {/* ── QR Overlay sau khi mở bàn thành công ── */}
      {qrOverlay && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center px-6">
          <div className="bg-canvas rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-5 w-full max-w-xs">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-soft mb-0.5">Bàn vừa mở</p>
              <p className="text-lg font-bold text-ink">{qrOverlay.tableName}</p>
            </div>
            <div className="p-3 bg-white rounded-2xl shadow-inner">
              <QRCodeSVG value={`${origin}/ban/${qrOverlay.qrToken}`} size={200} level="M" />
            </div>
            <p className="text-sm text-muted-soft text-center leading-relaxed">
              Cho khách quét để theo dõi đơn
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setQrOverlay(null)}
                className="flex-1 py-3.5 bg-surface-card border border-hairline text-gray-600 font-semibold rounded-2xl text-sm touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Đóng
              </button>
              <button
                onClick={() => { setQrOverlay(null); router.push(`/employee/don-hang/${qrOverlay.orderId}?from=ban`); }}
                className="flex-1 py-3.5 bg-primary text-white font-bold rounded-2xl text-sm touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Vào đơn →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create order modal (bàn trống) ── */}
      {createModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={() => !creating && setCreateModal(null)}>
          <div className="bg-canvas rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-ink text-base mb-0.5">Mở bàn mới</h2>
            <p className="text-sm text-muted-soft mb-5">
              {createModal.name} · Bàn #{createModal.tableNumber}
              {createModal.zone && (
                <span className="ml-1">· {ZONE_ICON[createModal.zone]} {ZONE_LABEL[createModal.zone]}</span>
              )}
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                Ghi chú <span className="font-normal text-gray-300">(không bắt buộc)</span>
              </label>
              <input
                value={createNote}
                onChange={e => setCreateNote(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !creating) submitCreate(); }}
                placeholder="VD: 4 khách, có trẻ em..."
                maxLength={500}
                className="w-full border border-hairline px-3 py-2.5 text-sm rounded-lg outline-none focus:border-primary transition-colors"
                style={{ fontSize: "16px" }}
                autoFocus
              />
            </div>
            {createError && (
              <div className="bg-red-50 border border-red-200 text-red-500 text-sm px-3 py-2 rounded-lg mb-3">
                {createError}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={submitCreate} disabled={creating}
                className="flex-1 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors">
                {creating ? "Đang mở..." : "Mở bàn"}
              </button>
              <button onClick={() => setCreateModal(null)} disabled={creating}
                className="px-4 py-3 bg-surface-card text-gray-600 text-sm font-medium rounded-xl">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Table Grid Component ─────────────────────────────────────────────────────
interface TableGridProps {
  tables: TableItem[];
  refundMap: RefundMap;
  selectedTable: TableItem | null;
  pointerDownPos: React.MutableRefObject<{ x: number; y: number } | null>;
  onAvailable: (t: TableItem) => void;
  onOccupied: (t: TableItem) => void;
}

function TableGrid({ tables, refundMap, selectedTable, pointerDownPos, onAvailable, onOccupied }: TableGridProps) {
  return (
    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {tables.map((table) => {
        const isOccupied  = table.status === "OCCUPIED";
        const isSelected  = selectedTable?.id === table.id;
        const refundInfo  = refundMap[table.id];
        const needsRefund = !!refundInfo;

        return (
          <button
            key={table.id}
            onPointerDown={(e) => { pointerDownPos.current = { x: e.clientX, y: e.clientY }; }}
            onClick={(e) => {
              const start = pointerDownPos.current;
              if (start && (Math.abs(e.clientX - start.x) > 8 || Math.abs(e.clientY - start.y) > 8)) return;
              if (isOccupied || needsRefund) onOccupied(table);
              else onAvailable(table);
            }}
            className={[
              "relative text-left p-3 rounded-xl border-2 shadow-sm transition-all active:scale-95 min-h-[76px] touch-manipulation",
              needsRefund
                ? `bg-amber-50 border-amber-400 ${isSelected ? "ring-2 ring-amber-400 ring-offset-1" : ""}`
                : isOccupied
                ? `bg-orange-50 border-orange-300 ${isSelected ? "ring-2 ring-orange-400 ring-offset-1" : ""}`
                : `bg-canvas border-green-300 hover:border-green-400 ${isSelected ? "ring-2 ring-green-400 ring-offset-1" : ""}`,
            ].join(" ")}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {needsRefund && (
              <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow leading-none">
                💰
              </div>
            )}
            <div className="text-[10px] text-muted-soft mb-1">#{table.tableNumber}</div>
            <div className="font-bold text-ink text-sm leading-tight truncate">{table.name}</div>
            {needsRefund ? (
              <div className="text-[10px] mt-1.5 text-amber-600 font-semibold">
                Hoàn {formatPrice(refundInfo.refundAmount)}
              </div>
            ) : (
              <div className={`text-[10px] mt-1.5 font-semibold ${isOccupied ? "text-orange-500" : "text-green-600"}`}>
                {isOccupied ? "Xem đơn →" : "+ Mở bàn"}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Panel Content ────────────────────────────────────────────────────────────
interface PanelProps {
  selectedTable: TableItem;
  currentOrder: OpenOrder | null;
  orderLoading: boolean;
  panelNeedRefund: boolean;
  panelNetRefund: number;
  panelPrepaid: number;
  panelToast: string | null;
  origin: string;
  refundLoading: boolean;
  cancelLoading: boolean;
  onClose: () => void;
  onRefund: () => void;
  onCancel: () => void;
  onManage: () => void;
  onCheckout: () => void;
}

function PanelContent({
  selectedTable, currentOrder, orderLoading,
  panelNeedRefund, panelNetRefund, panelPrepaid, panelToast,
  origin, refundLoading, cancelLoading,
  onClose, onRefund, onCancel, onManage, onCheckout,
}: PanelProps) {
  const [showQrZoom, setShowQrZoom] = useState(false);
  const zoneLabel = selectedTable.zone
    ? `${ZONE_ICON[selectedTable.zone]} ${ZONE_LABEL[selectedTable.zone]}`
    : "";

  return (
    <>
      {/* QR Zoom Modal */}
      {showQrZoom && origin && (
        <div className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center px-4"
          onClick={() => setShowQrZoom(false)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 flex flex-col items-center gap-4 w-full max-w-xs"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <p className="text-sm font-bold text-gray-800">{selectedTable.name}</p>
              <button onClick={() => setShowQrZoom(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-base touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                ✕
              </button>
            </div>
            <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-inner">
              <QRCodeSVG value={`${origin}/ban/${selectedTable.qrToken}`} size={240} level="M" />
            </div>
            <p className="text-xs text-gray-400 text-center">Cho khách quét để theo dõi đơn theo thời gian thực</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-hairline flex-shrink-0 ${
        panelNeedRefund ? "bg-amber-50" : "bg-orange-50"
      }`}>
        <div>
          <div className="font-bold text-ink">{selectedTable.name}</div>
          <div className={`text-xs font-medium ${panelNeedRefund ? "text-amber-600" : "text-orange-500"}`}>
            Bàn #{selectedTable.tableNumber} · {panelNeedRefund ? "💰 Cần hoàn tiền" : "Đang phục vụ"}
          </div>
          {zoneLabel && <div className="text-[11px] text-muted-soft mt-0.5">{zoneLabel}</div>}
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/70 hover:bg-white border border-hairline text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          <span className="text-base leading-none">✕</span>
          <span>Đóng</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {origin && (
          <div className="mb-3 bg-white border border-hairline rounded-xl p-3 flex items-center gap-3">
            <button
              className="flex-shrink-0 cursor-pointer hover:opacity-75 transition-opacity touch-manipulation"
              onClick={() => setShowQrZoom(true)}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              <QRCodeSVG value={`${origin}/ban/${selectedTable.qrToken}`} size={64} level="M" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink">Cho khách quét</p>
              <p className="text-[11px] text-muted-soft mt-0.5">Xem đơn theo thời gian thực</p>
              <button onClick={() => setShowQrZoom(true)}
                className="text-[10px] text-primary font-semibold mt-0.5 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Bấm để phóng to →
              </button>
            </div>
          </div>
        )}

        {panelToast && (
          <div className="mb-2 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg text-center">{panelToast}</div>
        )}

        {orderLoading ? (
          <div className="text-center py-10 text-muted-soft text-sm">Đang tải đơn...</div>
        ) : !currentOrder ? (
          <div className="text-center py-10 text-muted-soft text-sm">
            <div className="text-3xl mb-2">📋</div>
            Không tìm thấy đơn hàng
          </div>
        ) : (
          <>
            {panelNeedRefund && (
              <div className="mb-3 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 space-y-2">
                <div className="text-xs font-bold text-amber-700">💰 Cần hoàn tiền cọc</div>
                <div className="text-lg font-bold text-amber-800">{formatPrice(panelNetRefund)}</div>
                <div className="text-[11px] text-amber-600">
                  Cọc {formatPrice(panelPrepaid)} − Tổng {formatPrice(currentOrder.totalAmount)}
                </div>
                <button onClick={onRefund} disabled={refundLoading}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                  {refundLoading ? "Đang xử lý..." : "✓ Đã hoàn tiền cho khách"}
                </button>
              </div>
            )}

            <div className="text-xs text-muted-soft mb-3">
              Đơn #{currentOrder.id} · {currentOrder.createdBy}
            </div>

            {currentOrder.note && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-3 py-2 rounded-lg mb-3">
                📝 {currentOrder.note}
              </div>
            )}

            <div className="text-xs font-semibold text-muted-soft uppercase tracking-wide mb-2">
              Các món ({currentOrder.items.length})
            </div>

            {currentOrder.items.length === 0 ? (
              <p className="text-xs text-muted-soft text-center py-4 bg-surface-soft rounded-lg">Chưa có món</p>
            ) : (
              <div className="divide-y divide-hairline mb-3">
                {currentOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2.5 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink leading-snug truncate">{item.productName}</div>
                      <div className="text-xs text-muted-soft mt-0.5">{formatPrice(item.productPrice)} / {item.saleUnit}</div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <div className="text-sm font-bold text-primary">{formatPrice(item.itemTotal)}</div>
                      <div className="text-xs text-muted-soft">×{item.quantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={`rounded-xl px-4 py-3 space-y-1 ${panelNeedRefund ? "bg-amber-50 border border-amber-200" : "bg-surface-soft"}`}>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Tổng cộng</span>
                <span className="font-bold text-ink text-base">{formatPrice(currentOrder.totalAmount)}</span>
              </div>
              {panelPrepaid > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-soft">Đã cọc</span>
                  <span className="text-green-600 font-medium">− {formatPrice(panelPrepaid)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      {currentOrder && (
        <div className="border-t border-hairline p-3 space-y-2 flex-shrink-0">
          <button onClick={onManage}
            className={`w-full py-3.5 text-white text-sm font-bold rounded-xl transition-colors touch-manipulation ${
              panelNeedRefund ? "bg-amber-500 hover:bg-amber-600" : "bg-primary hover:bg-primary-dark"
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            {panelNeedRefund ? "💰 Xử lý hoàn tiền" : "Quản lý đơn hàng"}
          </button>
          {!panelNeedRefund && (
            <button onClick={onCheckout}
              className="w-full py-3.5 bg-green-500 text-white text-sm font-bold rounded-xl hover:bg-green-600 transition-colors touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              Thanh toán
            </button>
          )}
          <button onClick={onCancel} disabled={cancelLoading}
            className="w-full py-2.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-200 transition-colors disabled:opacity-40 touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            {cancelLoading ? "Đang hủy..." : "🚫 Hủy đơn"}
          </button>
        </div>
      )}
    </>
  );
}
