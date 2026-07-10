import { createHmac, timingSafeEqual } from "crypto";

function secret() {
  return (
    process.env.OTP_SECRET ||
    process.env.MOYASAR_SECRET_KEY ||
    "codex-dev-otp-secret"
  );
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function signOtp(contact: string, otp: string, exp: number) {
  const payload = `${contact.toLowerCase().trim()}|${otp}|${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export function verifySignedOtp(token: string, contact: string, otp: string) {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [c, code, expStr, sig] = raw.split("|");
    if (!c || !code || !expStr || !sig) return false;
    if (c !== contact.toLowerCase().trim()) return false;
    if (code !== otp.trim()) return false;
    if (Date.now() > Number(expStr)) return false;

    const payload = `${c}|${code}|${expStr}`;
    const expected = createHmac("sha256", secret()).update(payload).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function sendEmailOtp(email: string, otp: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "codeX <onboarding@resend.dev>";
  if (!key) return { ok: false as const, reason: "missing_resend" as const };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "رمز دخول codeX",
      html: `<p>رمز التحقق الخاص بك:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${otp}</p><p>صالح لمدة 10 دقائق.</p>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Resend error", text);
    return { ok: false as const, reason: "send_failed" as const };
  }
  return { ok: true as const, channel: "email" as const };
}

export async function sendSmsOtp(phone: string, otp: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { ok: false as const, reason: "missing_twilio" as const };
  }

  const to = phone.startsWith("+")
    ? phone
    : phone.startsWith("05")
      ? `+966${phone.slice(1)}`
      : phone.startsWith("5")
        ? `+966${phone}`
        : phone;

  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: `رمز دخول codeX: ${otp}`,
  });

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Twilio error", text);
    return { ok: false as const, reason: "send_failed" as const };
  }
  return { ok: true as const, channel: "sms" as const };
}

export async function notifyOtpDiscord(contact: string, otp: string) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "رمز دخول (تجربة)",
          color: 0x3b82f6,
          fields: [
            { name: "المستلم", value: contact, inline: true },
            { name: "الرمز", value: otp, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  }).catch(() => undefined);
}
