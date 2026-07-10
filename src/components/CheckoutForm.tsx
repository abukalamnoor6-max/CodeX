"use client";

import { useMemo, useState } from "react";
import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { storeConfig } from "@/data/products";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { saveOrder } from "@/lib/order-history";

type Method = "paypal" | "bank" | "applepay";

function persistOrder(args: {
  orderId: string;
  total: number;
  paymentMethod: Method;
  status: "completed" | "pending" | "awaiting_review";
  items: { name: string; quantity: number; price: number }[];
  transactionId?: string;
}) {
  saveOrder({
    orderId: args.orderId,
    total: args.total,
    createdAt: new Date().toISOString(),
    status: args.status,
    paymentMethod: args.paymentMethod,
    items: args.items,
    transactionId: args.transactionId,
  });
}

export function CheckoutForm() {
  const { items, total, updateQty, removeItem, clear } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [method, setMethod] = useState<Method>("paypal");
  const [customerName, setCustomerName] = useState(user?.name || "");
  const [discord, setDiscord] = useState("");
  const [email, setEmail] = useState(
    user?.type === "email" ? user.contact : "",
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const moyasarKey = process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY;

  const customerOk = customerName.trim() && discord.trim();

  const methods = useMemo(
    () =>
      [
        { id: "paypal" as const, label: "PayPal", hint: "فوري" },
        { id: "applepay" as const, label: "Apple Pay", hint: "Moyasar" },
        { id: "bank" as const, label: "تحويل الراجحي", hint: "دسكورد" },
      ] as const,
    [],
  );

  const submitBankOrder = async () => {
    setError("");
    if (!customerOk) {
      setError("اكتب اسمك ومعرف الدسكورد");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          discord,
          email,
          notes,
          paymentMethod: "bank",
          paymentStatus: "awaiting_review",
          items,
          total,
          receiptNote: `تحويل بنكي عبر تذكرة دسكورد — الآيبان يُرسل في التكت`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإرسال");

      persistOrder({
        orderId: data.orderId,
        total,
        paymentMethod: "bank",
        status: "awaiting_review",
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
      });

      clear();

      // افتح تذكرة الدسكورد — الآيبان يُرسل هناك
      const ticketUrl = storeConfig.discordTicketUrl;
      if (ticketUrl && !ticketUrl.includes("YOUR_INVITE")) {
        window.open(ticketUrl, "_blank", "noopener,noreferrer");
      }

      router.push(`/success?order=${data.orderId}&method=bank`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const submitApplePayDemo = async () => {
    setError("");
    if (!customerOk) {
      setError("اكتب اسمك ومعرف الدسكورد");
      return;
    }
    if (!moyasarKey) {
      setError(
        "Apple Pay يحتاج حساب Moyasar. أضف NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY و MOYASAR_SECRET_KEY في ملف .env.local",
      );
      return;
    }

    setLoading(true);
    try {
      // Opens Moyasar payment page flow — user completes Apple Pay / card there
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          discord,
          email,
          notes,
          paymentMethod: "applepay",
          paymentStatus: "pending",
          items,
          total,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإرسال");

      persistOrder({
        orderId: data.orderId,
        total,
        paymentMethod: "applepay",
        status: "pending",
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
      });

      // Redirect to Moyasar hosted payment (form) via their CDN form
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://api.moyasar.com/v1/payments.html";
      form.acceptCharset = "UTF-8";

      const fields: Record<string, string> = {
        publishable_api_key: moyasarKey,
        amount: String(Math.round(total * 100)),
        currency: "SAR",
        description: `codeX ${data.orderId}`,
        callback_url: `${window.location.origin}/success?order=${data.orderId}&method=applepay&total=${total}`,
        "metadata[orderId]": data.orderId,
        "metadata[discord]": discord,
        "metadata[customerName]": customerName,
      };

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-32 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-white">
          السلة فارغة
        </h1>
        <p className="mt-3 text-white/50">أضف منتجات من المتجر أولاً</p>
        <Link
          href="/#products"
          className="mt-8 inline-flex h-11 items-center rounded-lg bg-[#3dffa8] px-6 text-sm font-semibold text-[#0b1220]"
        >
          العودة للمنتجات
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-28 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-white sm:text-4xl">
          إتمام الطلب
        </h1>
        <p className="mt-2 text-white/50">
          بعد الدفع يوصلك تأكيد على دسكورد
        </p>

        <div className="mt-10 space-y-4">
          <Field
            label="الاسم"
            value={customerName}
            onChange={setCustomerName}
            placeholder="اسمك"
            required
          />
          <Field
            label="دسكورد"
            value={discord}
            onChange={setDiscord}
            placeholder="username أو user#0000"
            required
            dir="ltr"
          />
          <Field
            label="الإيميل (اختياري)"
            value={email}
            onChange={setEmail}
            placeholder="you@email.com"
            dir="ltr"
          />
          <label className="block">
            <span className="mb-1.5 block text-sm text-white/60">ملاحظات</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="تفاصيل السيرفر، الشعار، أو أي طلب خاص..."
              className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#3dffa8]/50"
            />
          </label>
        </div>

        <div className="mt-10">
          <p className="mb-3 text-sm text-white/60">طريقة الدفع</p>
          <div className="flex flex-wrap gap-2">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`rounded-lg border px-4 py-3 text-sm transition ${
                  method === m.id
                    ? "border-[#3dffa8] bg-[#3dffa8]/10 text-[#3dffa8]"
                    : "border-white/15 text-white/60 hover:border-white/30"
                }`}
              >
                <span className="font-medium">{m.label}</span>
                <span className="mr-2 text-xs opacity-60">{m.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {method === "bank" && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm leading-6 text-white/55">
              التحويل البنكي يتم عبر{" "}
              <strong className="text-white">تذكرة دسكورد</strong>. بعد تأكيد
              الطلب يفتح لك الدسكورد، وبنرسل لك الآيبان داخل التكت.
            </p>
            <p className="mt-3 text-xs text-white/40">
              المبلغ: {formatPrice(total)}
            </p>
            <button
              type="button"
              disabled={loading || !customerOk}
              onClick={submitBankOrder}
              className="mt-5 h-12 w-full rounded-lg bg-[#3b82f6] text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading
                ? "جاري فتح التذكرة..."
                : "فتح تذكرة دسكورد للتحويل"}
            </button>
            {(!storeConfig.discordTicketUrl ||
              storeConfig.discordTicketUrl.includes("YOUR_INVITE")) && (
              <p className="mt-3 text-xs text-amber-300/90">
                أضف رابط دعوة الدسكورد في الإعدادات لتفعيل فتح التكت تلقائياً
              </p>
            )}
          </div>
        )}

        {method === "paypal" && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            {!customerOk ? (
              <p className="text-sm text-amber-300/90">
                اكتب اسمك ومعرف الدسكورد أولاً لتفعيل زر PayPal
              </p>
            ) : !paypalClientId ? (
              <div className="space-y-3 text-sm text-white/60">
                <p>
                  ادفع يدوياً إلى PayPal ثم أكّد الطلب:
                </p>
                <p>
                  <span className="text-[#3dffa8]" dir="ltr">
                    {storeConfig.paypalEmail}
                  </span>
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    setError("");
                    try {
                      const res = await fetch("/api/orders", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          customerName,
                          discord,
                          email,
                          notes,
                          paymentMethod: "paypal",
                          paymentStatus: "awaiting_review",
                          items,
                          total,
                          receiptNote: `تحويل يدوي إلى ${storeConfig.paypalEmail}`,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      persistOrder({
                        orderId: data.orderId,
                        total,
                        paymentMethod: "paypal",
                        status: "awaiting_review",
                        items: items.map((i) => ({
                          name: i.name,
                          quantity: i.quantity,
                          price: i.price,
                        })),
                      });
                      clear();
                      router.push(
                        `/success?order=${data.orderId}&method=paypal`,
                      );
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "حدث خطأ",
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="h-12 w-full rounded-lg border border-[#3dffa8]/40 text-sm font-semibold text-[#3dffa8] hover:bg-[#3dffa8]/10"
                >
                  أرسلت الفلوس على PayPal — تأكيد الطلب
                </button>
              </div>
            ) : (
              <PayPalScriptProvider
                options={{
                  clientId: paypalClientId,
                  currency: process.env.NEXT_PUBLIC_PAYPAL_CURRENCY || "USD",
                  intent: "capture",
                }}
              >
                <PayPalButtons
                  style={{ layout: "vertical", shape: "rect", color: "gold" }}
                  disabled={!customerOk || loading}
                  createOrder={async () => {
                    const res = await fetch("/api/paypal/create-order", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ total }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    return data.id;
                  }}
                  onApprove={async (data) => {
                    setLoading(true);
                    setError("");
                    try {
                      const res = await fetch("/api/paypal/capture-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          paypalOrderId: data.orderID,
                          customerName,
                          discord,
                          email,
                          notes,
                          items,
                          total,
                        }),
                      });
                      const result = await res.json();
                      if (!res.ok) throw new Error(result.error);
                      if (result.captureStatus !== "COMPLETED") {
                        throw new Error(
                          "الدفع لم يكتمل في PayPal — حاول مرة أخرى",
                        );
                      }
                      persistOrder({
                        orderId: result.orderId,
                        total,
                        paymentMethod: "paypal",
                        status: "completed",
                        items: items.map((i) => ({
                          name: i.name,
                          quantity: i.quantity,
                          price: i.price,
                        })),
                        transactionId: data.orderID,
                      });
                      clear();
                      router.push(
                        `/success?order=${result.orderId}&method=paypal`,
                      );
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "فشل تأكيد الدفع",
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                  onError={() => setError("حدث خطأ في PayPal")}
                />
              </PayPalScriptProvider>
            )}
          </div>
        )}

        {method === "applepay" && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            {!customerOk ? (
              <p className="text-sm text-amber-300/90">
                اكتب اسمك ومعرف الدسكورد أولاً لتفعيل الدفع
              </p>
            ) : !moyasarKey ? (
              <p className="text-sm text-white/55">
                الدفع بـ Apple Pay قيد التفعيل. جرّب PayPal أو تحويل الراجحي
                حالياً.
              </p>
            ) : (
              <>
                <p className="text-sm leading-6 text-white/55">
                  ادفع بأمان عبر Apple Pay أو البطاقة. المبلغ:{" "}
                  <strong className="text-white">{formatPrice(total)}</strong>
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={submitApplePayDemo}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-black disabled:opacity-40"
                >
                  <AppleLogo />
                  ادفع بـ Apple Pay / بطاقة
                </button>
              </>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
      </div>

      <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold text-white">ملخص الطلب</h2>
        <ul className="mt-6 space-y-4">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-start justify-between gap-3 border-b border-white/10 pb-4"
            >
              <div>
                <p className="text-sm text-white">{item.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQty(item.key, item.quantity - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-white/20 text-white/70"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm text-white">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.key, item.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-white/20 text-white/70"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="mr-2 text-xs text-red-300/80 hover:text-red-200"
                  >
                    حذف
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-white">
                {formatPrice(item.price * item.quantity)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-white/50">الإجمالي</span>
          <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#3dffa8]">
            {formatPrice(total)}
          </span>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  dir?: "ltr" | "rtl";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-white/60">
        {label}
        {required && <span className="text-[#3dffa8]"> *</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#3dffa8]/50"
      />
    </label>
  );
}

function AppleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}
