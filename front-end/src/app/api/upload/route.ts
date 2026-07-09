import { NextRequest, NextResponse } from "next/server";

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const MAX_SIZE = 32 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!IMGBB_API_KEY) {
    return NextResponse.json({ error: "Chưa cấu hình IMGBB_API_KEY" }, { status: 500 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Không có file" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "File quá lớn (tối đa 32MB)" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const fd = new FormData();
    fd.append("key", IMGBB_API_KEY);
    fd.append("image", base64);

    const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: fd });
    const json = await res.json();

    if (!res.ok || !json.success) {
      return NextResponse.json({ error: json.error?.message ?? "Upload thất bại" }, { status: 500 });
    }

    return NextResponse.json({ url: json.data.image?.url ?? json.data.url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Lỗi khi upload ảnh" }, { status: 500 });
  }
}
