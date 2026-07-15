"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChamCongRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/cham-cong");
  }, [router]);
  return null;
}
