"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getOrders, type SavedOrder } from "@/lib/order-history";
import { formatPrice } from "@/lib/format";
import { Footer } from "@/components/Footer";

const statusLabel: Record<SavedOrder["status"], string> = {
  completed: "مكتمل",
  pending: "قيد الانتظار",
  awaiting_review: "بانتظار المراجعة",
};

const methodLabel: Record<SavedOrder["paymentMethod"], string> = {
  paypal: "PayPal",
  bank: "تحويل بنكي",
  applepay: "Apple Pay",
  card: "بطاقة",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export default function OrdersPage() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<SavedOrder[]>([]);

  useEffect(() => {
    setOrders(getOrders());
  }, []);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="mb-8 text-center text-3xl font-bold text-white">طلباتي</h1>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-2xl border border-white/10 bg-[#0c1220]/90 p-3">
            <Link
              href="/account"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/60 hover:bg-white/5"
            >
              حسابي
            </Link>
            <Link
              href="/orders"
              className="flex items-center gap-3 rounded-xl border border-[#3b82f6]/40 bg-[#3b82f6]/15 px-4 py-3 text-sm font-medium text-[#93c5fd]"
            >
              الطلبات
            </Link>
            <Link
              href="/checkout"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/60 hover:bg-white/5"
            >
              السلة
            </Link>
            <button
              type="button"
              onClick={logout}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-red-300 hover:bg-red-500/10"
            >
              تسجيل الخروج
            </button>
          </aside>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1220]/90">
            {user && (
              <p className="border-b border-white/5 px-5 py-3 text-xs text-white/40" dir="ltr">
                {user.contact}
              </p>
            )}

            {orders.length === 0 ? (
              <div className="px-5 py-16 text-center text-white/45">
                <p>ما عندك طلبات بعد</p>
                <Link
                  href="/#products"
                  className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#3b82f6] px-5 text-sm font-semibold text-white"
                >
                  تصفح المنتجات
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/45">
                      <th className="px-5 py-4 text-right font-medium">رقم الطلب</th>
                      <th className="px-5 py-4 text-right font-medium">الإجمالي</th>
                      <th className="px-5 py-4 text-right font-medium">التاريخ</th>
                      <th className="px-5 py-4 text-right font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.orderId} className="border-b border-white/5">
                        <td className="px-5 py-4 font-mono text-[#93c5fd]" dir="ltr">
                          #{o.orderId.replace(/^CX-/, "").slice(0, 8)}
                        </td>
                        <td className="px-5 py-4 text-white">{formatPrice(o.total)}</td>
                        <td className="px-5 py-4 text-white/50">{timeAgo(o.createdAt)}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                              o.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : o.status === "awaiting_review"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-blue-500/15 text-blue-300"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {statusLabel[o.status]}
                          </span>
                          <p className="mt-1 text-[11px] text-white/30">
                            {methodLabel[o.paymentMethod]}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
