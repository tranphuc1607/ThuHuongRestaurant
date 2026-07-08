export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  isNew?: boolean;
  isBestSeller?: boolean;
  isFeatured?: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  error: string | null;
}

export interface Booking {
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  scheduledTime: string;
  guestCount: number;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  paymentMethod: "BANK_TRANSFER" | "CASH";
  depositAmount?: number;
  note?: string;
}
