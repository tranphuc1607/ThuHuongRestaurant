"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 1000);
  }

  return (
    <button
      onClick={handleRefresh}
      title="Làm mới trạng thái"
      className="text-xs text-muted-soft hover:text-primary transition-colors flex items-center gap-1 flex-shrink-0"
    >
      <span className={spinning ? "animate-spin inline-block" : "inline-block"}>↻</span>
      Làm mới
    </button>
  );
}