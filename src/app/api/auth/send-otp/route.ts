import { NextResponse } from "next/server";
import {
  generateOtp,
  notifyOtpDiscord,
  sendEmailOtp,
  sendSmsOtp,
  signOtp,
} from "@/lib/otp";

export async function POST(req: Request) {
  try {
    const { contact, type } = await req.json();
    const value = String(contact || "").trim();
    const mode = type === "email" ? "email" : "phone";

    if (!value) {
      return NextResponse.json({ error: "أدخل الجوال أو الإيميل" }, { status: 400 });
    }

    if (mode === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return NextResponse.json({ error: "إيميل غير صحيح" }, { status: 400 });
    }

    if (mode === "phone" && value.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "رقم جوال غير صحيح" }, { status: 400 });
    }

    const otp = generateOtp();
    const exp = Date.now() + 10 * 60 * 1000;
    const pendingToken = signOtp(value, otp, exp);

    let sent = false;
    let channel: "email" | "sms" | "demo" = "demo";

    if (mode === "email") {
      const result = await sendEmailOtp(value, otp);
      if (result.ok) {
        sent = true;
        channel = "email";
      }
    } else {
      const result = await sendSmsOtp(value, otp);
      if (result.ok) {
        sent = true;
        channel = "sms";
      }
    }

    // Fallback: Discord admin + demo code so login still works before keys are set
    if (!sent) {
      await notifyOtpDiscord(value, otp);
      channel = "demo";
    }

    return NextResponse.json({
      ok: true,
      pendingToken,
      channel,
      message:
        channel === "email"
          ? "تم إرسال الرمز إلى إيميلك"
          : channel === "sms"
            ? "تم إرسال الرمز عبر SMS"
            : "تم إنشاء الرمز (وضع تجربة — فعّل Resend/Twilio للإرسال الحقيقي)",
      // Only expose OTP in demo mode so you can test without SMS/email keys
      ...(channel === "demo" ? { demoOtp: otp } : {}),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "تعذر إرسال الرمز" }, { status: 500 });
  }
}
