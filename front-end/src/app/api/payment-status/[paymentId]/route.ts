import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_API_URL ?? "http://localhost:8080/api/v1";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const res = await fetch(`${BACKEND}/payments/customer-status/${paymentId}`, {
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data);
}
