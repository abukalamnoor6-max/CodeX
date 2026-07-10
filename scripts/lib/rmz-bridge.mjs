/**
 * Poll RMZ Merchant API for new orders and post to Discord.
 * Requires RMZ_API_TOKEN (Settings → API Keys).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from "discord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const STATE_PATH = path.join(ROOT, "discord", "rmz-bridge-state.json");
const API = "https://merchant-api.rmz.gg/shawarma";

const ORDERS_CH =
  process.env.DISCORD_ORDERS_CHANNEL_ID || "1524971495921684601";
const DELIVERY_CH =
  process.env.DISCORD_DELIVERY_CHANNEL_ID || "1524961264869310494";
const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";
const POLL_MS = Number(process.env.RMZ_POLL_MS || 60_000);

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { seenIds: [], lastPoll: null };
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    state.seenIds = [...new Set(state.seenIds)].slice(-500);
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn("rmz state save skip", e.message);
  }
}

async function rmzGet(token, pathname) {
  const res = await fetch(`${API}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`RMZ ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

function statusLabel(code) {
  return (
    {
      1: "بانتظار الدفع",
      2: "قيد المراجعة",
      3: "قيد التنفيذ",
      4: "مكتمل",
      5: "ملغي",
      6: "مسترجع",
    }[code] || `حالة ${code}`
  );
}

function mapOrder(raw) {
  const id = String(raw.id ?? raw.order_id ?? "");
  const customer = raw.customer || {};
  const name =
    [customer.first_name || customer.firstName, customer.last_name || customer.lastName]
      .filter(Boolean)
      .join(" ") ||
    customer.name ||
    "—";
  const items = (raw.items || raw.products || [])
    .map((i) => {
      const n = i.name || i.product?.name || "منتج";
      const q = i.quantity || i.qty || 1;
      return `• ${n} ×${q}`;
    })
    .join("\n");
  return {
    orderId: `RMZ-${id}`,
    customerName: name,
    discord: String(customer.discord || customer.discord_id || raw.discord || "—"),
    items: items || "—",
    total: raw.total ?? raw.amount ?? "—",
    paymentMethod:
      raw.transaction?.payment_method ||
      raw.payment?.method ||
      raw.payment_method ||
      "—",
    paymentStatus: statusLabel(raw.status ?? raw.status_id),
    createdAt: raw.created_at || raw.createdAt || null,
  };
}

async function sendDivider(channel) {
  const local = path.join(ROOT, "public", "discord", "codex-divider-official.png");
  if (!fs.existsSync(local)) return;
  await channel.send({
    files: [new AttachmentBuilder(local, { name: "codex-divider-official.png" })],
  });
}

function deliveryButtons(orderId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`codex_status_received:${orderId}`)
      .setLabel("تم الاستلام — يتم التأكد")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`codex_status_confirmed:${orderId}`)
      .setLabel("تم التأكيد — يتم العمل")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`codex_status_done:${orderId}`)
      .setLabel("تم الانتهاء — للتسليم")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`codex_status_delivered:${orderId}`)
      .setLabel("تم التسليم")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅"),
  );
}

async function postOrder(client, order) {
  const ordersCh = await client.channels.fetch(ORDERS_CH);
  const deliveryCh = await client.channels.fetch(DELIVERY_CH);

  await ordersCh.send({
    content: `<@${OWNER_ID}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x0059db)
        .setTitle(`🧾 طلب رمز — ${order.orderId}`)
        .setDescription(
          [
            `<@${OWNER_ID}> طلب جديد من متجر رمز`,
            "",
            `**العميل:** ${order.customerName}`,
            `**دسكورد:** ${order.discord}`,
            `**الإجمالي:** ${order.total}`,
            `**الدفع:** ${order.paymentMethod}`,
            `**الحالة:** ${order.paymentStatus}`,
          ].join("\n"),
        )
        .addFields({ name: "المنتجات", value: String(order.items).slice(0, 1000) })
        .setFooter({ text: "codeX · RMZ Bridge" })
        .setTimestamp(order.createdAt ? new Date(order.createdAt) : new Date()),
    ],
    allowedMentions: { users: [OWNER_ID] },
  });
  await sendDivider(ordersCh).catch(() => {});

  await deliveryCh.send({
    content: `<@${OWNER_ID}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("📦 حالة التسليم")
        .setDescription(
          [
            `**رقم الطلب:** \`${order.orderId}\``,
            `**الحالة:** 🟡 تم الاستلام / قيد التأكد`,
            `**العميل:** ${order.customerName}`,
            `**دسكورد العميل:** ${order.discord}`,
            `**الإجمالي:** ${order.total}`,
            `**الدفع:** ${order.paymentMethod} / ${order.paymentStatus}`,
            "",
            "_مصدر: متجر رمز_",
          ].join("\n"),
        )
        .addFields({ name: "المنتجات", value: String(order.items).slice(0, 1000) })
        .setFooter({ text: "codeX · Delivery Control" })
        .setTimestamp(),
    ],
    components: [deliveryButtons(order.orderId)],
    allowedMentions: { users: [OWNER_ID] },
  });
  await sendDivider(deliveryCh).catch(() => {});
}

export function attachRmzBridge(client) {
  const token = process.env.RMZ_API_TOKEN;
  if (!token) {
    console.log("RMZ bridge skipped (no RMZ_API_TOKEN)");
    return;
  }

  const boot = async () => {
    console.log("RMZ bridge attached — polling every", POLL_MS / 1000, "s");
    let state = loadState();

    // Seed existing orders once so we don't flood Discord
    if (!state.seenIds.length) {
      try {
        const json = await rmzGet(
          token,
          "/orders?page=1&orderBy=created_at&orderDirection=desc",
        );
        const list = json?.data?.data || json?.data || [];
        for (const raw of Array.isArray(list) ? list : []) {
          const id = String(raw.id ?? "");
          if (id) state.seenIds.push(id);
        }
        saveState(state);
        console.log("RMZ seeded", state.seenIds.length, "orders");
      } catch (e) {
        console.warn("RMZ seed failed", e.message);
      }
    }

    const tick = async () => {
      try {
        state = loadState();
        const json = await rmzGet(
          token,
          "/orders?page=1&orderBy=created_at&orderDirection=desc",
        );
        const list = json?.data?.data || json?.data || [];
        const rows = Array.isArray(list) ? list : [];
        const fresh = [];
        for (const raw of rows) {
          const id = String(raw.id ?? "");
          if (!id || state.seenIds.includes(id)) continue;
          fresh.push(raw);
        }
        fresh.reverse();
        for (const raw of fresh) {
          const order = mapOrder(raw);
          console.log("RMZ new order", order.orderId);
          await postOrder(client, order);
          state.seenIds.push(String(raw.id));
          saveState(state);
        }
        state.lastPoll = new Date().toISOString();
        saveState(state);
      } catch (e) {
        console.warn("RMZ poll error", e.message);
      }
    };

    await tick();
    setInterval(tick, POLL_MS);
  };

  if (client.isReady?.()) boot();
  else client.once("clientReady", boot);
}
