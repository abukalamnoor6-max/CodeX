import type { CartItem } from "@/lib/cart";

export type OrderPayload = {
  orderId: string;
  customerName: string;
  discord: string;
  email?: string;
  notes?: string;
  paymentMethod: "paypal" | "bank" | "applepay" | "card";
  paymentStatus: "pending" | "paid" | "awaiting_review";
  items: CartItem[];
  total: number;
  receiptNote?: string;
  transactionId?: string;
};

const OWNER_MENTION =
  process.env.DISCORD_OWNER_ID
    ? `<@${process.env.DISCORD_OWNER_ID}>`
    : "<@1210972261968912425>";

function clip(value: string, max = 1024) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export async function notifyDiscord(order: OrderPayload) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    console.warn("DISCORD_WEBHOOK_URL is not set — order logged only");
    console.log(JSON.stringify(order, null, 2));
    return { ok: true, skipped: true };
  }

  const methodLabel: Record<OrderPayload["paymentMethod"], string> = {
    paypal: "PayPal",
    bank: "تحويل بنكي — الراجحي",
    applepay: "Apple Pay",
    card: "بطاقة ائتمان/مدى",
  };

  const statusLabel: Record<OrderPayload["paymentStatus"], string> = {
    pending: "⏳ قيد الانتظار",
    paid: "✅ مدفوع",
    awaiting_review: "🔎 بانتظار مراجعة الإيصال",
  };

  const itemLines = order.items
    .map((i, idx) => {
      const lineTotal = i.price * i.quantity;
      return [
        `**${idx + 1}) ${i.name}**`,
        `الكمية: \`${i.quantity}\``,
        `سعر الوحدة: \`${i.price} ر.س\``,
        `الإجمالي الفرعي: \`${lineTotal} ر.س\``,
      ].join("\n");
    })
    .join("\n\n");

  const summaryLines = order.items
    .map((i) => `• ${i.name} ×${i.quantity} = **${i.price * i.quantity} ر.س**`)
    .join("\n");

  const bankIban = process.env.BANK_IBAN || "SA5280204406341222121014";
  const createdAt = new Date();
  const dateAr = createdAt.toLocaleString("ar-SA", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const embed = {
    title: `🧾 فاتورة codeX — ${order.orderId}`,
    description: [
      `${OWNER_MENTION} طلب جديد يحتاج متابعتك`,
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      `**رقم الفاتورة:** \`${order.orderId}\``,
      `**التاريخ:** ${dateAr}`,
      `**حالة الدفع:** ${statusLabel[order.paymentStatus]}`,
      `**طريقة الدفع:** ${methodLabel[order.paymentMethod]}`,
      "━━━━━━━━━━━━━━━━━━━━",
    ].join("\n"),
    color:
      order.paymentStatus === "paid"
        ? 0x22c55e
        : order.paymentStatus === "awaiting_review"
          ? 0xf59e0b
          : 0x0059db,
    fields: [
      {
        name: "👤 بيانات العميل",
        value: clip(
          [
            `**الاسم:** ${order.customerName}`,
            `**دسكورد:** ${order.discord}`,
            order.email ? `**الإيميل:** ${order.email}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      },
      {
        name: "📦 ملخص المنتجات",
        value: clip(summaryLines || "—"),
      },
      {
        name: "🧾 تفاصيل الفاتورة",
        value: clip(itemLines || "—"),
      },
      {
        name: "💰 الإجمالي المستحق",
        value: `## ${order.total} ر.س`,
        inline: true,
      },
      {
        name: "📌 حالة الطلب",
        value: statusLabel[order.paymentStatus],
        inline: true,
      },
      {
        name: "💳 الدفع",
        value: methodLabel[order.paymentMethod],
        inline: true,
      },
      ...(order.transactionId
        ? [
            {
              name: "🔢 رقم العملية",
              value: `\`${order.transactionId}\``,
            },
          ]
        : []),
      ...(order.notes
        ? [{ name: "📝 ملاحظات العميل", value: clip(order.notes) }]
        : []),
      ...(order.receiptNote
        ? [{ name: "📎 ملاحظة الإيصال/التحويل", value: clip(order.receiptNote) }]
        : []),
      ...(order.paymentMethod === "bank"
        ? [
            {
              name: "🏦 بيانات التحويل",
              value: [
                "**البنك:** مصرف الراجحي",
                `**الآيبان:** \`${bankIban}\``,
                "**باسم:** codeX",
              ].join("\n"),
            },
          ]
        : []),
      {
        name: "✅ إجراء مطلوب",
        value:
          order.paymentStatus === "paid"
            ? "الطلب مدفوع — ابدأ التنفيذ وتواصل مع العميل."
            : order.paymentStatus === "awaiting_review"
              ? "راجع الإيصال ثم أكّد الدفع وابدأ التنفيذ."
              : "بانتظار إكمال الدفع من العميل.",
      },
    ],
    timestamp: createdAt.toISOString(),
    footer: { text: "codeX · فاتورة خاصة • للمالك فقط" },
  };

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `${OWNER_MENTION} 🧾 فاتورة جديدة من المتجر`,
      allowed_mentions: {
        users: [process.env.DISCORD_OWNER_ID || "1210972261968912425"],
      },
      embeds: [embed],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook failed: ${res.status} ${text}`);
  }

  // Official codeX divider after every order invoice
  await sendOfficialDividerWebhook(webhook).catch((err) => {
    console.warn("orders divider failed:", err);
  });

  // Also post interactive delivery card for staff
  await notifyDeliveryChannel(order).catch((err) => {
    console.warn("delivery channel notify failed:", err);
  });

  return { ok: true };
}

function officialDividerUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL || "https://codex-theta-two.vercel.app";
  return `${base.replace(/\/$/, "")}/discord/codex-divider-official.png`;
}

async function fetchOfficialDividerBlob() {
  const imageUrl = `${officialDividerUrl()}?v=official`;
  const img = await fetch(imageUrl);
  if (!img.ok) {
    throw new Error(`divider asset fetch failed: ${img.status}`);
  }
  return img.blob();
}

/** Plain image attachment — no embed box / sidebar. */
async function sendOfficialDividerWebhook(webhook: string) {
  const blob = await fetchOfficialDividerBlob();
  const form = new FormData();
  form.append("payload_json", JSON.stringify({}));
  form.append("files[0]", blob, "codex-divider-official.png");
  const res = await fetch(webhook, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`divider webhook failed: ${res.status} ${await res.text()}`);
  }
}

async function sendOfficialDividerToChannel(channelId: string, token: string) {
  const blob = await fetchOfficialDividerBlob();
  const form = new FormData();
  form.append("payload_json", JSON.stringify({}));
  form.append("files[0]", blob, "codex-divider-official.png");
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bot ${token}` },
      body: form,
    },
  );
  if (!res.ok) {
    throw new Error(`divider channel failed: ${res.status} ${await res.text()}`);
  }
}

async function notifyDeliveryChannel(order: OrderPayload) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId =
    process.env.DISCORD_DELIVERY_CHANNEL_ID || "1524961264869310494";
  if (!token) {
    console.warn("DISCORD_BOT_TOKEN missing — skip delivery card");
    return;
  }

  const items = order.items
    .map((i) => `• ${i.name} ×${i.quantity}`)
    .join("\n");

  const customerId = (order.discord.match(/\d{15,20}/) || [])[0];
  const ownerId = process.env.DISCORD_OWNER_ID || "1210972261968912425";

  const body = {
    content: `<@${ownerId}>`,
    allowed_mentions: { users: [ownerId] },
    embeds: [
      {
        title: "📦 حالة التسليم",
        description: [
          `**رقم الطلب:** \`${order.orderId}\``,
          `**الحالة:** 🟡 تم الاستلام / قيد التأكد`,
          `**العميل:** ${order.customerName}`,
          `**دسكورد العميل:** ${order.discord}`,
          customerId ? `**منشن:** <@${customerId}>` : null,
          `**الإجمالي:** ${order.total} ر.س`,
          `**الدفع:** ${order.paymentMethod} / ${order.paymentStatus}`,
        ]
          .filter(Boolean)
          .join("\n"),
        color: 0xf59e0b,
        fields: [
          { name: "المنتجات", value: clip(items || "—") },
          ...(order.notes
            ? [{ name: "ملاحظات", value: clip(order.notes) }]
            : []),
        ],
        footer: { text: "codeX · Delivery Control" },
        timestamp: new Date().toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            custom_id: `codex_status_received:${order.orderId}`,
            label: "تم الاستلام — يتم التأكد",
          },
          {
            type: 2,
            style: 1,
            custom_id: `codex_status_confirmed:${order.orderId}`,
            label: "تم التأكيد — يتم العمل",
          },
          {
            type: 2,
            style: 3,
            custom_id: `codex_status_done:${order.orderId}`,
            label: "تم الانتهاء — للتسليم",
          },
          {
            type: 2,
            style: 3,
            custom_id: `codex_status_delivered:${order.orderId}`,
            label: "تم التسليم",
            emoji: { name: "✅" },
          },
        ],
      },
    ],
  };

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`delivery message failed: ${res.status} ${text}`);
  }

  // One plain divider after the delivery card (not on every status click)
  await sendOfficialDividerToChannel(channelId, token).catch((err) => {
    console.warn("delivery divider failed:", err);
  });
}

export function createOrderId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `طلب-${stamp}${rand}`;
}
