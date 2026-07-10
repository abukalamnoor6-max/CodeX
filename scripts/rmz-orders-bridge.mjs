/**
 * RMZ → Discord bridge (no Plus webhooks needed).
 * Polls Merchant API for new orders and posts to Discord orders + delivery.
 *
 * Env:
 *   RMZ_API_TOKEN=...
 *   DISCORD_BOT_TOKEN=...
 *   DISCORD_ORDERS_CHANNEL_ID=1524971495921684601
 *   DISCORD_DELIVERY_CHANNEL_ID=1524961264869310494
 *   DISCORD_OWNER_ID=1210972261968912425
 *   RMZ_POLL_MS=60000
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from "discord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STATE_PATH = path.join(ROOT, "discord", "rmz-bridge-state.json");

const RMZ_TOKEN = process.env.RMZ_API_TOKEN;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const ORDERS_CH =
  process.env.DISCORD_ORDERS_CHANNEL_ID || "1524971495921684601";
const DELIVERY_CH =
  process.env.DISCORD_DELIVERY_CHANNEL_ID || "1524961264869310494";
const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";
const POLL_MS = Number(process.env.RMZ_POLL_MS || 60_000);
const API = "https://merchant-api.rmz.gg/shawarma";

if (!RMZ_TOKEN) {
  console.error("Missing RMZ_API_TOKEN (Settings → API Keys in RMZ dashboard)");
  process.exit(1);
}
if (!BOT_TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { seenIds: [], lastPoll: null };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  // keep last 500 ids
  state.seenIds = [...new Set(state.seenIds)].slice(-500);
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function rmzGet(pathname) {
  const res = await fetch(`${API}${pathname}`, {
    headers: {
      Authorization: `Bearer ${RMZ_TOKEN}`,
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
    err.body = json;
    throw err;
  }
  return json;
}

function statusLabel(code) {
  const map = {
    1: "بانتظار الدفع",
    2: "قيد المراجعة",
    3: "قيد التنفيذ",
    4: "مكتمل",
    5: "ملغي",
    6: "مسترجع",
  };
  return map[code] || `حالة ${code}`;
}

function mapOrder(raw) {
  const id = String(raw.id ?? raw.order_id ?? "");
  const customer = raw.customer || {};
  const name = [customer.first_name || customer.firstName, customer.last_name || customer.lastName]
    .filter(Boolean)
    .join(" ") || customer.name || "—";
  const items = (raw.items || raw.products || [])
    .map((i) => {
      const n = i.name || i.product?.name || "منتج";
      const q = i.quantity || i.qty || 1;
      return `• ${n} ×${q}`;
    })
    .join("\n");
  const total = raw.total ?? raw.amount ?? "—";
  const pay =
    raw.transaction?.payment_method ||
    raw.payment?.method ||
    raw.payment_method ||
    "—";
  const status = statusLabel(raw.status ?? raw.status_id);
  const discord =
    customer.discord ||
    customer.discord_id ||
    raw.discord ||
    "—";

  return {
    orderId: `RMZ-${id}`,
    rmzId: id,
    customerName: name,
    discord: String(discord),
    items: items || "—",
    total,
    paymentMethod: pay,
    paymentStatus: status,
    createdAt: raw.created_at || raw.createdAt || null,
    raw,
  };
}

function dividerLocal() {
  return path.join(ROOT, "public", "discord", "codex-divider-official.png");
}

async function sendDivider(channel) {
  const local = dividerLocal();
  if (fs.existsSync(local)) {
    await channel.send({
      files: [new AttachmentBuilder(local, { name: "codex-divider-official.png" })],
    });
  }
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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function postOrder(order) {
  const ordersCh = await client.channels.fetch(ORDERS_CH);
  const deliveryCh = await client.channels.fetch(DELIVERY_CH);

  const invoice = new EmbedBuilder()
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
    .addFields({ name: "المنتجات", value: order.items.slice(0, 1000) || "—" })
    .setFooter({ text: "codeX · RMZ Bridge" })
    .setTimestamp(order.createdAt ? new Date(order.createdAt) : new Date());

  await ordersCh.send({
    content: `<@${OWNER_ID}>`,
    embeds: [invoice],
    allowedMentions: { users: [OWNER_ID] },
  });
  await sendDivider(ordersCh).catch(() => {});

  const delivery = new EmbedBuilder()
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
    .addFields({ name: "المنتجات", value: order.items.slice(0, 1000) || "—" })
    .setFooter({ text: "codeX · Delivery Control" })
    .setTimestamp();

  await deliveryCh.send({
    content: `<@${OWNER_ID}>`,
    embeds: [delivery],
    components: [deliveryButtons(order.orderId)],
    allowedMentions: { users: [OWNER_ID] },
  });
  await sendDivider(deliveryCh).catch(() => {});
}

async function pollOnce(state) {
  const json = await rmzGet("/orders?page=1&orderBy=created_at&orderDirection=desc");
  const list = json?.data?.data || json?.data || json?.orders || [];
  const rows = Array.isArray(list) ? list : [];
  const fresh = [];

  for (const raw of rows) {
    const id = String(raw.id ?? raw.order_id ?? "");
    if (!id) continue;
    if (state.seenIds.includes(id)) continue;
    fresh.push(raw);
  }

  // oldest first so Discord order is chronological
  fresh.reverse();
  for (const raw of fresh) {
    const order = mapOrder(raw);
    console.log("new RMZ order", order.orderId);
    await postOrder(order);
    state.seenIds.push(String(raw.id ?? raw.order_id));
    saveState(state);
  }

  state.lastPoll = new Date().toISOString();
  saveState(state);
  return fresh.length;
}

client.once("clientReady", async () => {
  console.log("RMZ bridge ready as", client.user.tag);

  // seed seen ids with current page so we don't spam old orders on first run
  const state = loadState();
  if (!state.seenIds.length) {
    try {
      const json = await rmzGet("/orders?page=1&orderBy=created_at&orderDirection=desc");
      const list = json?.data?.data || json?.data || [];
      for (const raw of Array.isArray(list) ? list : []) {
        const id = String(raw.id ?? "");
        if (id) state.seenIds.push(id);
      }
      saveState(state);
      console.log("seeded", state.seenIds.length, "existing orders (won't repost)");
    } catch (e) {
      console.error("seed failed", e.message);
      if (e.status === 401 || e.status === 403) {
        console.error("API token invalid or plan blocked. Check Settings → API Keys.");
        process.exit(1);
      }
    }
  }

  const tick = async () => {
    try {
      const n = await pollOnce(loadState());
      if (n) console.log("posted", n, "new order(s)");
    } catch (e) {
      console.warn("poll error", e.message);
      if (e.status === 401 || e.status === 403) {
        console.error("RMZ API unauthorized — update RMZ_API_TOKEN");
      }
    }
  };

  await tick();
  setInterval(tick, POLL_MS);
  console.log("polling every", POLL_MS / 1000, "s");
});

client.login(BOT_TOKEN);
