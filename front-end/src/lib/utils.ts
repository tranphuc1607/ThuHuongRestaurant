export function formatPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN").format(price) + "đ";
}

// Các service khác nhau đặt message ở `message` hoặc `error`.
// Heuristic: ưu tiên field không phải chuỗi kỹ thuật tiếng Anh.
const GENERIC_EN = new Set([
  "Bad Request", "Unauthorized", "Forbidden", "Not Found",
  "Internal Server Error", "Service Unavailable",
  "Business Logic Exception", "OK", "Conflict", "Unprocessable Entity",
]);

function isTechnical(s: string): boolean {
  return (
    /Exception/.test(s) ||
    /\.(java|kt)/.test(s) ||
    /com\.(example|spring|mysql|hibernate)/.test(s) ||
    /org\.(springframework|hibernate)/.test(s) ||
    /ConstraintViolation/.test(s) ||
    /DataIntegrity/.test(s)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractApiError(json: any, fallback: string): string {
  const msg = String(json?.message ?? "");
  const err = String(json?.error ?? "");
  if (msg && !GENERIC_EN.has(msg) && !isTechnical(msg)) return msg;
  if (err && !GENERIC_EN.has(err) && !isTechnical(err)) return err;
  return fallback;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
