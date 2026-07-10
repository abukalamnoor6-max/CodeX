"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<"contact" | "otp">("contact");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [channelMsg, setChannelMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, type: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإرسال");
      setPendingToken(data.pendingToken);
      setChannelMsg(data.message || "");
      setDemoOtp(data.demoOtp || "");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, otp, pendingToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "رمز غير صحيح");
      login(contact, name);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div className="stars-bg pointer-events-none absolute inset-0" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#3b82f6]/50 bg-[#3b82f6]/10 shadow-[0_0_40px_rgba(59,130,246,0.35)]">
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-white">
              cX
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-white">
            codeX
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {step === "contact"
              ? "سجّل دخولك بالجوال أو الإيميل"
              : "أدخل رمز التحقق المرسل لك"}
          </p>
        </div>

        {step === "contact" ? (
          <form
            onSubmit={sendOtp}
            className="rounded-2xl border border-[#3b82f6]/25 bg-[#0a0f1c]/90 p-6 shadow-[0_0_60px_rgba(59,130,246,0.12)] backdrop-blur"
          >
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-black/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("phone");
                  setContact("");
                  setError("");
                }}
                className={`rounded-lg py-2.5 text-sm font-medium transition ${
                  mode === "phone"
                    ? "bg-[#3b82f6] text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                رقم الجوال
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("email");
                  setContact("");
                  setError("");
                }}
                className={`rounded-lg py-2.5 text-sm font-medium transition ${
                  mode === "email"
                    ? "bg-[#3b82f6] text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                الإيميل
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-white/60">
                الاسم (اختياري)
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسمك"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#3b82f6]/60"
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-white/60">
                {mode === "phone" ? "رقم الجوال" : "الإيميل"}
              </span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={mode === "phone" ? "05xxxxxxxx" : "you@email.com"}
                dir="ltr"
                inputMode={mode === "phone" ? "tel" : "email"}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#3b82f6]/60"
                required
              />
            </label>

            {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-[#3b82f6] text-sm font-semibold text-white shadow-[0_0_30px_rgba(59,130,246,0.45)] disabled:opacity-50"
            >
              {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={verifyOtp}
            className="rounded-2xl border border-[#3b82f6]/25 bg-[#0a0f1c]/90 p-6 shadow-[0_0_60px_rgba(59,130,246,0.12)] backdrop-blur"
          >
            <p className="mb-2 text-sm text-white/55" dir="ltr">
              {contact}
            </p>
            {channelMsg && (
              <p className="mb-4 text-xs text-[#93c5fd]">{channelMsg}</p>
            )}
            {demoOtp && (
              <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                رمز التجربة: <strong dir="ltr">{demoOtp}</strong>
              </p>
            )}

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-white/60">
                رمز التحقق
              </span>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                dir="ltr"
                inputMode="numeric"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-lg tracking-[0.4em] text-white outline-none focus:border-[#3b82f6]/60"
                required
              />
            </label>

            {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="h-12 w-full rounded-xl bg-[#3b82f6] text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "جاري التحقق..." : "تأكيد الدخول"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("contact");
                setOtp("");
                setDemoOtp("");
                setError("");
              }}
              className="mt-3 w-full text-sm text-white/45 hover:text-white"
            >
              رجوع وتغيير الرقم/الإيميل
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
