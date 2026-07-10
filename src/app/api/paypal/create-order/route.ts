import { NextResponse } from "next/server";

const PAYPAL_API =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error("PayPal credentials missing");
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

export async function POST(req: Request) {
  try {
    const { total, orderId } = await req.json();

    if (!total || total <= 0) {
      return NextResponse.json({ error: "مبلغ غير صالح" }, { status: 400 });
    }

    const token = await getAccessToken();

    // PayPal SAR may require business account approval; USD fallback for sandbox
    const currency = process.env.PAYPAL_CURRENCY || "USD";
    const amount =
      currency === "SAR"
        ? Number(total).toFixed(2)
        : (Number(total) / 3.75).toFixed(2);

    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: orderId || "codeX",
            description: `codeX order ${orderId || ""}`.trim(),
            amount: {
              currency_code: currency,
              value: amount,
            },
          },
        ],
        application_context: {
          brand_name: "codeX",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(data);
      return NextResponse.json(
        { error: "تعذر إنشاء طلب PayPal" },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "PayPal غير مُعدّ. أضف مفاتيح API في .env" },
      { status: 500 },
    );
  }
}
