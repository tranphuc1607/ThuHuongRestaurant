import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_API_URL ?? "http://localhost:8080/api/v1";

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const targetUrl = `${BACKEND}/${path.join("/")}${req.nextUrl.search}`;

  const forwardHeaders = new Headers();
  // Forward only safe headers to backend
  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();
    if (["content-type", "authorization", "cookie", "accept", "accept-language"].includes(lower)) {
      forwardHeaders.set(key, value);
    }
  }

  const isBodyMethod = !["GET", "HEAD"].includes(req.method);

  let body: BodyInit | null = null;
  if (isBodyMethod) {
    body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: isBodyMethod ? body : undefined,
      signal: AbortSignal.timeout(10000), // 10s — tránh treo vô hạn khi backend không phản hồi
      // @ts-expect-error Node.js fetch supports duplex
      duplex: isBodyMethod ? "half" : undefined,
    });
  } catch {
    return NextResponse.json(
      { statusCode: 503, message: "Máy chủ không phản hồi", data: null, error: "Service Unavailable" },
      { status: 503 }
    );
  }

  // Copy response headers, drop hop-by-hop headers that cause issues
  const resHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    const lower = key.toLowerCase();
    if (!["transfer-encoding", "connection", "keep-alive", "upgrade"].includes(lower)) {
      resHeaders.set(key, value);
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
