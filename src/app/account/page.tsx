"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Footer } from "@/components/Footer";

export default function AccountPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="mb-8 text-center text-3xl font-bold text-white">حسابي</h1>
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-2xl border border-white/10 bg-[#0c1220]/90 p-3">
            <Link
              href="/account"
              className="flex items-center gap-3 rounded-xl border border-[#3b82f6]/40 bg-[#3b82f6]/15 px-4 py-3 text-sm font-medium text-[#93c5fd]"
            >
              حسابي
            </Link>
            <Link
              href="/orders"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/60 hover:bg-white/5"
            >
              الطلبات
            </Link>
            <button
              type="button"
              onClick={logout}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-red-300 hover:bg-red-500/10"
            >
              تسجيل الخروج
            </button>
          </aside>

          <section className="rounded-2xl border border-white/10 bg-[#0c1220]/90 p-6">
            <p className="text-sm text-white/45">بيانات الدخول</p>
            <p className="mt-2 text-lg text-white" dir="ltr">
              {user?.contact}
            </p>
            {user?.name && (
              <p className="mt-1 text-sm text-white/50">{user.name}</p>
            )}
            <p className="mt-4 text-xs text-white/35">
              النوع: {user?.type === "email" ? "إيميل" : "جوال"}
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
