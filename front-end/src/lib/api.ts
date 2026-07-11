// Server: dùng BACKEND_API_URL (absolute, direct to backend)
// Client: dùng NEXT_PUBLIC_API_URL (relative /api/v1, proxied bởi Next.js rewrite)
const BASE_URL =
  typeof window === "undefined"
    ? (process.env.BACKEND_API_URL ?? "http://localhost:8080/api/v1")
    : (process.env.NEXT_PUBLIC_API_URL ?? "/api/v1");

export type ApiResponse<T> = {
  statusCode: number;
  message: string;
  data: T;
  error: string | null;
};

export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  empty: boolean;
};

export type BackendProduct = {
  id: number;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  category: string;
  status: "AVAILABLE" | "OUT_OF_STOCK";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const fetchInit: RequestInit = init?.cache
      ? { ...init }
      : { ...init, next: { revalidate: 60 } };
    const res = await fetch(`${BASE_URL}${path}`, fetchInit);
    if (!res.ok) return null;
    const json: ApiResponse<T> = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export const productsApi = {
  list: (params?: { page?: number; size?: number; category?: string; status?: string }, init?: RequestInit) => {
    const q = new URLSearchParams();
    if (params?.page != null) q.set("page", String(params.page));
    if (params?.size != null) q.set("size", String(params.size));
    if (params?.category) q.set("category", params.category);
    if (params?.status) q.set("status", params.status);
    return apiFetch<Page<BackendProduct>>(`/products?${q.toString()}`, init);
  },
  get: (id: number) => apiFetch<BackendProduct>(`/products/${id}`),
  search: (keyword: string, page = 0, size = 12) =>
    apiFetch<Page<BackendProduct>>(`/products/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}`),
};
