"use client";

import { useState } from "react";

const reviews = [
  {
    name: "أحمد",
    text: "برمجة فايف إم ممتازة والتسليم سريع. أنصح فيه.",
  },
  {
    name: "نورة",
    text: "بوت الدسكورد اشتغل تمام حسب طلب السيرفر.",
  },
  {
    name: "خالد",
    text: "تعامل محترم والأسعار واضحة. راح أطلب مرة ثانية.",
  },
];

const faqs = [
  {
    q: "وش خدمات codeX؟",
    a: "برمجة فايف إم، مابات، سيارات خاصة، وبوتات دسكورد مخصصة لسيرفرك.",
  },
  {
    q: "كم يستغرق تسليم الطلب؟",
    a: "حسب نوع الخدمة. غالباً من نفس اليوم إلى عدة أيام للمشاريع الكبيرة.",
  },
  {
    q: "كيف أدفع؟",
    a: "PayPal أو Apple Pay أو تحويل الراجحي. بعد الدفع يوصلك تأكيد على دسكورد.",
  },
  {
    q: "هل فيه ضمان؟",
    a: "نعم، نراجع معك الطلب ونعدّل حسب الاتفاق قبل التسليم النهائي.",
  },
];

export function ReviewsFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-14">
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">تقييمات العملاء</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {reviews.map((r) => (
              <article
                key={r.name}
                className="rounded-2xl border border-white/10 bg-[#0c1220]/80 p-5"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b82f6] text-sm font-bold text-white">
                    {r.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{r.name}</p>
                    <p className="text-xs text-amber-400">★★★★★</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-white/55">{r.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-20">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">
            الأسئلة الشائعة
          </h2>
          <div className="mx-auto max-w-3xl space-y-3">
            {faqs.map((item, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1220]/80"
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between px-5 py-4 text-right text-sm font-medium text-white"
                  >
                    {item.q}
                    <span className="text-white/40">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <p className="border-t border-white/5 px-5 py-4 text-sm leading-6 text-white/50">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
