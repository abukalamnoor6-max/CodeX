export type SavedOrder = {
  orderId: string;
  total: number;
  createdAt: string;
  status: "completed" | "pending" | "awaiting_review";
  paymentMethod: "paypal" | "bank" | "applepay" | "card";
  items: { name: string; quantity: number; price: number }[];
  transactionId?: string;
};

const KEY = "codex_orders";

export function getOrders(): SavedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedOrder[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveOrder(order: SavedOrder) {
  const list = getOrders();
  const next = [order, ...list.filter((o) => o.orderId !== order.orderId)];
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearOrders() {
  localStorage.removeItem(KEY);
}
