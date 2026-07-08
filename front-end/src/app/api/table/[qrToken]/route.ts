import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_API_URL ?? "http://localhost:8080/api/v1";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ qrToken: string }> }
) {
  const { qrToken } = await params;
  try {
    const res = await fetch(`${BACKEND}/orders/table/${qrToken}`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { statusCode: 500, message: "Không kết nối được máy chủ" },
      { status: 500 }
    );
  }
}
