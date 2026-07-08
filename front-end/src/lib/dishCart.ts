export type DishItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

const CART_KEY = "thu_huong_dishes";
export const CART_EVENT = "dish-cart-updated";
export const CART_ADDED_EVENT = "dish-cart-added";

export function getDishes(): DishItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveDishes(items: DishItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addDish(dish: Omit<DishItem, "quantity">): void {
  const items = getDishes();
  const idx = items.findIndex((i) => i.id === dish.id);
  if (idx >= 0) {
    items[idx].quantity += 1;
  } else {
    items.push({ ...dish, quantity: 1 });
  }
  saveDishes(items);
  window.dispatchEvent(new CustomEvent(CART_ADDED_EVENT, { detail: { name: dish.name } }));
}

export function removeDish(id: number): void {
  saveDishes(getDishes().filter((i) => i.id !== id));
}

export function updateQuantity(id: number, qty: number): void {
  if (qty <= 0) { removeDish(id); return; }
  const items = getDishes();
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) { items[idx].quantity = qty; saveDishes(items); }
}

export function clearDishes(): void {
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event(CART_EVENT));
}

export function restoreDishes(items: DishItem[]): void {
  saveDishes(items);
}

export function getTotalCount(items: DishItem[]): number {
  return items.reduce((s, d) => s + d.quantity, 0);
}

export function buildNotesFromDishes(dishes: DishItem[]): string {
  if (dishes.length === 0) return "";
  const list = dishes.map((d) => `${d.name} x${d.quantity}`).join(", ");
  return `Tôi muốn đặt trước: ${list}`;
}
