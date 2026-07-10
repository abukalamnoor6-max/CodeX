"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { saveOrder } from "@/lib/order-history";

function SuccessContent() {
  const params = useSearchParams();
  const order = params.get("order");
  const method = params.get("method");
  const total = params.get("total");

  useEffect(() => {
    if (!order || !method) return;
    // Apple Pay returns here — ensure order appears in history
    if (method === "applepay" || method === "card") {
      saveOrder({
        orderId: order,
        total: total ? Number(total) : 0,
        createdAt: new Date().toISOString(),
        status: "completed",
        paymentMethod: method === "card" ? "card" : "applepay",
        items: [],
      });
    }
  }, [order, method, total]);

  const methodLabel =
    method === "bank"
      ? "افتح التذكرة في دسكورد — بنرسل لك الآيبان هناك"
      : method === "paypal"
        ? "تم التحقق من دفع PayPal بنجاح"
        : method === "applepay"
          ? "Apple Pay / بطاقة"
          : "طلبك";

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#3b82f6]/15 text-2xl text-[#60a5fa]">
        ✓
      </div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-white">
        تم استلام طلبك
      </h1>
      <p className="mt-3 text-white/55">{methodLabel}</p>
      {order && (
        <p className="mt-6 rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-[#93c5fd]">
          {order}
        </p>
      )}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/orders"
          className="inline-flex h-11 items-center rounded-lg bg-[#3b82f6] px-6 text-sm font-semibold text-white"
        >
          عرض طلباتي
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-lg border border-white/20 px-6 text-sm text-white/70"
        >
          العودة للمتجر
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-white/50">
          جاري التحميل...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
