import { NextResponse } from "next/server";
import { verifySignedOtp } from "@/lib/otp";

export async function POST(req: Request) {
  try {
    const { contact, otp, pendingToken } = await req.json();
    const value = String(contact || "").trim();
    const code = String(otp || "").trim();
    const token = String(pendingToken || "").trim();

    if (!value || !code || !token) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    if (!verifySignedOtp(token, value, code)) {
      return NextResponse.json(
        { error: "رمز غير صحيح أو منتهي" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "فشل التحقق" }, { status: 500 });
  }
}
