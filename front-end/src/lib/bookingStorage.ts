// Client-side localStorage helpers for booking tracking
// BT_LAST_KEY   = mảng SavedBooking (chuyển khoản — check EXPIRED để gợi ý đặt lại)
// CASH_PENDING_KEY = mảng CashItem  (tiền mặt — theo dõi cho đến COMPLETED/CANCELLED)

import type { DishItem } from "./dishCart";

export const BT_LAST_KEY = "booking_bt_last";
export const CASH_PENDING_KEY = "booking_cash_pending";
export const LAST_BOOKING_KEY = "booking_last";

export type SavedBooking = {
  code: string;
  name: string;
  phone: string;
  date: string; // YYYY-MM-DD (VN)
  time: string; // HH:MM (VN)
  guestCount: number;
  notes: string;
  items: DishItem[];
};

export type CashItem = {
  code: string;
  name: string;
  phone: string;
  date: string;
  time: string;
};

export const FINAL_STATUSES = ["COMPLETED", "CANCELLED", "EXPIRED", "CHECKED_IN"];

export function getBtBookings(): SavedBooking[] {
  try {
    const raw = localStorage.getItem(BT_LAST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // backward compat: old format was single object
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export function saveBtBookings(bookings: SavedBooking[]) {
  try {
    localStorage.setItem(BT_LAST_KEY, JSON.stringify(bookings));
  } catch {}
}

export function getCashItems(): CashItem[] {
  try {
    const raw = localStorage.getItem(CASH_PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCashItems(items: CashItem[]) {
  try {
    localStorage.setItem(CASH_PENDING_KEY, JSON.stringify(items));
  } catch {}
}

/**
 * Khi đổi phương thức thanh toán, đồng bộ localStorage:
 * BT→CASH: xóa khỏi BT array, thêm vào CASH array
 * CASH→BT: xóa khỏi CASH array, thêm vào BT array
 */
export function syncSwitchPayment(
  bookingCode: string,
  newMethod: "CASH" | "BANK_TRANSFER",
  meta: { name: string; phone: string; date: string; time: string; guestCount: number }
) {
  if (newMethod === "CASH") {
    saveBtBookings(getBtBookings().filter((b) => b.code !== bookingCode));
    const cashArr = getCashItems();
    if (!cashArr.find((c) => c.code === bookingCode)) {
      saveCashItems([
        ...cashArr,
        { code: bookingCode, name: meta.name, phone: meta.phone, date: meta.date, time: meta.time },
      ]);
    }
  } else {
    saveCashItems(getCashItems().filter((c) => c.code !== bookingCode));
    const btArr = getBtBookings();
    if (!btArr.find((b) => b.code === bookingCode)) {
      saveBtBookings([
        ...btArr,
        {
          code: bookingCode,
          name: meta.name,
          phone: meta.phone,
          date: meta.date,
          time: meta.time,
          guestCount: meta.guestCount,
          notes: "",
          items: [],
        },
      ]);
    }
  }
}
