import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://localhost:8080/api/v1";

async function proxy(req: NextRequest, params: Promise<{ path: string[] }>, method: string) {
  const { path } = await params;
  const pathStr = path.join("/");
  const search = req.nextUrl.search;
  const url = `${BACKEND}/${pathStr}${search}`;

  // Only forward auth + content-type; do NOT forward Origin/Host to avoid gateway CORS rejection
  const headers: Record<string, string> = {};
  const ct = req.headers.get("Content-Type");
  if (ct) headers["Content-Type"] = ct;
  const auth = req.headers.get("Authorization");
  if (auth) headers["Authorization"] = auth;
  const cookie = req.headers.get("Cookie");
  if (cookie) headers["Cookie"] = cookie;

  const body = method !== "GET" && method !== "DELETE" ? await req.text() : undefined;

  const res = await fetch(url, { method, headers, body });
  const resBody = await res.text();

  return new NextResponse(resBody, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params, "GET");
}
export function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params, "POST");
}
export function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params, "PUT");
}
export function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params, "PATCH");
}
export function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params, "DELETE");
}
