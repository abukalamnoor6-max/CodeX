import { NextResponse } from "next/server";
import { createOrderId, notifyDiscord, type OrderPayload } from "@/lib/orders";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      amount,
      customerName,
      discord,
      email,
      notes,
      items,
      total,
      source,
      applePayToken,
    } = body;

    const secret = process.env.MOYASAR_SECRET_KEY;
    if (!secret) {
      return NextResponse.json(
        {
          error:
            "Apple Pay / Moyasar غير مُعدّ. أضف MOYASAR_SECRET_KEY في .env",
        },
        { status: 500 },
      );
    }

    if (!customerName?.trim() || !discord?.trim()) {
      return NextResponse.json(
        { error: "الاسم ومعرف الدسكورد مطلوبان" },
        { status: 400 },
      );
    }

    const amountHalalas = Math.round(Number(amount || total) * 100);
    if (!amountHalalas || amountHalalas < 100) {
      return NextResponse.json({ error: "مبلغ غير صالح" }, { status: 400 });
    }

    const orderId = createOrderId();

    const paymentBody: Record<string, unknown> = {
      amount: amountHalalas,
      currency: "SAR",
      description: `codeX ${orderId}`,
      callback_url:
        process.env.NEXT_PUBLIC_SITE_URL
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/success`
          : "http://localhost:3000/success",
      metadata: {
        orderId,
        discord,
        customerName,
      },
    };

    if (applePayToken) {
      paymentBody.source = {
        type: "applepay",
        token: applePayToken,
      };
    } else if (source) {
      paymentBody.source = source;
    } else {
      // Create payment form session via Moyasar (redirect / card)
      paymentBody.source = {
        type: "creditcard",
        // Client should use Moyasar.js; this endpoint expects tokenized source
        name: "pending",
        number: "pending",
        cvc: "pending",
        month: "01",
        year: "30",
      };
      return NextResponse.json(
        {
          error:
            "أرسل توكن Apple Pay أو مصدر بطاقة من Moyasar.js",
          publishableKey: process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY,
          orderId,
        },
        { status: 400 },
      );
    }

    const res = await fetch("https://api.moyasar.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentBody),
    });

    const payment = await res.json();
    if (!res.ok) {
      console.error(payment);
      return NextResponse.json(
        { error: payment?.message || "فشل إنشاء الدفع" },
        { status: 500 },
      );
    }

    const paid =
      payment.status === "paid" || payment.status === "captured";

    const order: OrderPayload = {
      orderId,
      customerName: customerName.trim(),
      discord: discord.trim(),
      email: email?.trim(),
      notes: notes?.trim(),
      paymentMethod: applePayToken ? "applepay" : "card",
      paymentStatus: paid ? "paid" : "pending",
      items: items || [],
      total: total || amountHalalas / 100,
      transactionId: payment.id,
    };

    if (paid) {
      await notifyDiscord(order);
    }

    return NextResponse.json({
      ok: true,
      orderId,
      payment,
      paid,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطأ في الدفع" }, { status: 500 });
  }
}
