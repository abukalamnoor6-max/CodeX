import { NextResponse } from "next/server";
import { createOrderId, notifyDiscord, type OrderPayload } from "@/lib/orders";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      customerName,
      discord,
      email,
      notes,
      paymentMethod,
      paymentStatus,
      items,
      total,
      receiptNote,
      transactionId,
    } = body as Partial<OrderPayload>;

    if (!customerName?.trim() || !discord?.trim()) {
      return NextResponse.json(
        { error: "الاسم ومعرف الدسكورد مطلوبان" },
        { status: 400 },
      );
    }

    if (!items?.length || typeof total !== "number" || total <= 0) {
      return NextResponse.json({ error: "السلة فارغة" }, { status: 400 });
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: "اختر طريقة الدفع" }, { status: 400 });
    }

    const order: OrderPayload = {
      orderId: createOrderId(),
      customerName: customerName.trim(),
      discord: discord.trim(),
      email: email?.trim(),
      notes: notes?.trim(),
      paymentMethod,
      paymentStatus: paymentStatus ?? "pending",
      items,
      total,
      receiptNote: receiptNote?.trim(),
      transactionId,
    };

    await notifyDiscord(order);

    return NextResponse.json({ ok: true, orderId: order.orderId });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "تعذر إرسال الطلب. حاول مرة أخرى." },
      { status: 500 },
    );
  }
}
