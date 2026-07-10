import { NextResponse } from "next/server";
import { notifyDiscord, createOrderId, type OrderPayload } from "@/lib/orders";

const PAYPAL_API =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PayPal credentials missing");

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { paypalOrderId, customerName, discord, email, notes, items, total } =
      body;

    if (!paypalOrderId) {
      return NextResponse.json({ error: "معرف PayPal ناقص" }, { status: 400 });
    }

    const token = await getAccessToken();
    const res = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const capture = await res.json();
    if (!res.ok) {
      console.error(capture);
      return NextResponse.json(
        { error: "فشل تأكيد الدفع من PayPal" },
        { status: 500 },
      );
    }

    // Verify real payment completion
    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: "الدفع غير مكتمل",
          captureStatus: capture.status,
        },
        { status: 402 },
      );
    }

    const captureUnit = capture.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = captureUnit?.id || paypalOrderId;
    if (captureUnit && captureUnit.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "عملية السحب من PayPal لم تكتمل" },
        { status: 402 },
      );
    }

    const order: OrderPayload = {
      orderId: createOrderId(),
      customerName: customerName || "عميل PayPal",
      discord: discord || "غير محدد",
      email,
      notes,
      paymentMethod: "paypal",
      paymentStatus: "paid",
      items: items || [],
      total: total || 0,
      transactionId: captureId,
    };

    await notifyDiscord(order);

    return NextResponse.json({
      ok: true,
      orderId: order.orderId,
      captureStatus: capture.status,
      transactionId: captureId,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "خطأ في تأكيد الدفع" },
      { status: 500 },
    );
  }
}
