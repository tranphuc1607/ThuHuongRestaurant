"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  qrToken: string;
  tableName: string;
  tableNumber: number;
  onClose: () => void;
}

export default function QrModal({ qrToken, tableName, tableNumber, onClose }: Props) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    setUrl(`${base}/ban/${qrToken}`);
  }, [qrToken]);

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-72 mx-auto text-center overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="bg-primary px-5 py-4 text-white">
          <p className="font-bold text-base">{tableName}</p>
          <p className="text-xs opacity-80 mt-0.5">Bàn #{tableNumber} · Quét để xem đơn hàng</p>
        </div>
        <div className="p-5 flex flex-col items-center gap-4">
          {url && (
            <div className="p-3 bg-white rounded-xl border-2 border-gray-100">
              <QRCodeSVG value={url} size={180} level="M" />
            </div>
          )}
          <p className="text-[11px] text-gray-400 break-all leading-relaxed">{url}</p>
          <button onClick={copy}
            className="w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors">
            {copied ? "✓ Đã sao chép" : "Sao chép link"}
          </button>
          <button onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
