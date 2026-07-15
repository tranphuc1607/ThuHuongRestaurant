import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_API_URL ?? "http://localhost:8080/api/v1";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface Product {
  id: number; name: string; category: string; status: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY chưa được cấu hình trong .env.local" }, { status: 500 });
  }

  let imageBase64: string, mimeType: string;
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    mimeType = body.mimeType ?? "image/jpeg";
    if (!imageBase64) throw new Error("Thiếu imageBase64");
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  // Lấy danh sách sản phẩm (public endpoint)
  let products: Product[] = [];
  try {
    const res = await fetch(`${BACKEND}/products?status=AVAILABLE&size=200`, { cache: "no-store" });
    const json = await res.json();
    const list: Product[] = json.data?.content ?? json.data ?? [];
    products = list.filter(p => p.status === "AVAILABLE");
  } catch {
    return NextResponse.json({ error: "Không thể tải danh sách sản phẩm" }, { status: 502 });
  }

  const productListText = products
    .map(p => `${p.id} | ${p.name} | ${p.category}`)
    .join("\n");

  const prompt = `Bạn là hệ thống đọc hóa đơn viết tay của nhà hàng Việt Nam.

Danh sách sản phẩm hiện có (ID | Tên | Danh mục):
${productListText}

Đơn vị tính: PORTION=phần/đĩa/tô/nồi, CUP=ly/cốc, PIECE=cái, KG=kg

Hãy đọc hóa đơn viết tay trong ảnh. Trích xuất TẤT CẢ các dòng ghi món ăn và số lượng.
Với mỗi món, tìm sản phẩm phù hợp nhất trong danh sách trên (so sánh tên, viết tắt, cách viết thông thường của người Việt).

Trả về JSON (CHỈ JSON, không có text nào khác):
{"items":[{"productId":<số id hoặc null>,"productName":"<tên sản phẩm trong DB hoặc tên gốc trong ảnh nếu null>","quantity":<số nguyên>,"saleUnit":"<PORTION|CUP|PIECE|KG>","rawText":"<dòng text gốc trong ảnh>","confidence":"<high|low|none>"}]}

Quy tắc confidence:
- "high": tên trong ảnh khớp rõ ràng với sản phẩm trong DB (ví dụ: "gà nướng" → "Gà Nướng Mật Ong")
- "low": tên trong ảnh chỉ khớp một phần hoặc AI đoán (ví dụ: "gà" có thể là nhiều món gà)
- "none": không tìm thấy sản phẩm nào phù hợp, productId phải là null

Lưu ý khác:
- Nếu một dòng có nhiều món thì tách thành nhiều item riêng
- "bia" thường là CUP, các món còn lại thường là PORTION
- Số lượng mặc định là 1 nếu không ghi rõ`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "ThuHuong Restaurant",
      },
      body: JSON.stringify({
        model: "openrouter/auto",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[scan-invoice] OpenRouter error:", response.status, errText);
      const is429 = response.status === 429;
      return NextResponse.json(
        { error: is429 ? "API đang bận, vui lòng thử lại sau 1 phút." : `Lỗi AI: ${errText.slice(0, 120)}` },
        { status: 500 }
      );
    }

    const json = await response.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI không trả về dữ liệu hợp lệ", raw }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ items: parsed.items ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[scan-invoice] Error:", msg);
    return NextResponse.json({ error: `Lỗi kết nối: ${msg.slice(0, 120)}` }, { status: 500 });
  }
}
