import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  AttachmentBuilder,
  MessageFlags,
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { attachGuard, LOG_CHANNELS } from "./lib/guard.mjs";
import {
  sendWelcome,
  sendWelcomeFallback,
  assignVisitorRole,
  setCodexNickname,
} from "./lib/welcome.mjs";
import { attachTickets, postTicketPanel } from "./lib/tickets.mjs";
import { attachDividerCommand } from "./lib/divider-command.mjs";
import { attachTicketAi } from "./lib/ticket-ai.mjs";
import { attachCodexLogs, setupLogRooms } from "./lib/codex-logs.mjs";
import { createPanelStore } from "./lib/panel-store.mjs";
import { createBroadcastService } from "./lib/broadcast.mjs";
import {
  attachBroadcastUi,
  registerPanelCommands,
} from "./lib/broadcast-ui.mjs";
import { createPanelApp } from "./lib/panel-app.mjs";
import { createStripePayments } from "./lib/stripe-payments.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";
const PORT = Number(process.env.PORT || process.env.CODEX_BOT_PORT || 8787);
const API_KEY =
  process.env.GUARD_API_KEY ||
  process.env.API_KEY ||
  process.env.DISCORD_OWNER_ID ||
  "codex-guard";
const WAITING_URL =
  process.env.DISCORD_WAITING_URL ||
  "https://discord.com/channels/1524901009195798679/1524971494663258235";
const REVIEWS_CHANNEL_ID =
  process.env.DISCORD_REVIEWS_CHANNEL_ID || "1524981051787837540";
const DELIVERY_CHANNEL_ID =
  process.env.DISCORD_DELIVERY_CHANNEL_ID || "1524961264869310494";
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "")
).replace(/\/$/, "");
const STRIPE_NOTIFY_CHANNEL_ID =
  process.env.STRIPE_NOTIFY_CHANNEL_ID || "1524971495921684601";

if (!TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

const metaPath = path.join(ROOT, "discord", "channels.json");
let meta = {
  deliveryChannelId: DELIVERY_CHANNEL_ID,
  reviewsChannelId: REVIEWS_CHANNEL_ID,
};
try {
  meta = { ...meta, ...JSON.parse(fs.readFileSync(metaPath, "utf8")) };
} catch {
  // ok — use env defaults on cloud hosts
}
meta.reviewsChannelId = REVIEWS_CHANNEL_ID;
meta.deliveryChannelId = meta.deliveryChannelId || DELIVERY_CHANNEL_ID;
meta.logChannels = LOG_CHANNELS;

const STATUS = {
  received: {
    id: "codex_status_received",
    label: "تم الاستلام — يتم التأكد",
    color: ButtonStyle.Secondary,
    embedColor: 0xf59e0b,
    staffLabel: "🟡 تم الاستلام / قيد التأكد",
    dmTitle: "تم استلام طلبك",
    dmBody:
      "تم استلام طلبك بنجاح، وفريق codeX يقوم حالياً بالتأكد من التفاصيل والدفع.",
    sendRating: false,
  },
  confirmed: {
    id: "codex_status_confirmed",
    label: "تم التأكيد — يتم العمل",
    color: ButtonStyle.Primary,
    embedColor: 0x0059db,
    staffLabel: "🔵 تم التأكيد / قيد التنفيذ",
    dmTitle: "تم تأكيد طلبك",
    dmBody: "تم تأكيد طلبك، وفريق codeX بدأ العمل عليه الآن.",
    sendRating: false,
  },
  done: {
    id: "codex_status_done",
    label: "تم الانتهاء — للتسليم",
    color: ButtonStyle.Success,
    embedColor: 0x22c55e,
    staffLabel: "🟢 تم الانتهاء / جاهز للتسليم",
    dmTitle: "طلبك جاهز للتسليم",
    dmBody: `تم الانتهاء من طلبك.\nتوجه الآن إلى روم انتظار الدعم:\n${WAITING_URL}`,
    sendRating: false,
  },
  delivered: {
    id: "codex_status_delivered",
    label: "تم التسليم",
    color: ButtonStyle.Success,
    embedColor: 0x10b981,
    staffLabel: "✅ تم التسليم",
    dmTitle: "تم تسليم طلبك",
    dmBody:
      "تم تسليم طلبك بنجاح 🎉\nنقدر تقييمك — اختر عدد النجوم من الأزرار تحت:",
    sendRating: true,
  },
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.AutoModerationExecution,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

const panelStore = createPanelStore();

attachGuard(client, {
  getLogChannelId: () => panelStore.data.settings?.logChannelId || null,
});
attachCodexLogs(client, { guildId: GUILD_ID, ownerId: OWNER_ID });

const broadcast = createBroadcastService({
  client,
  store: panelStore,
  ownerId: OWNER_ID,
});
attachBroadcastUi({
  client,
  store: panelStore,
  broadcast,
  ownerId: OWNER_ID,
  guildId: GUILD_ID,
});

attachTickets(client);
attachTicketAi(client);
attachDividerCommand(client);

client.on("guildMemberAdd", async (member) => {
  if (member.guild.id !== GUILD_ID) return;

  try {
    const role = await assignVisitorRole(member);
    if (role) console.log("visitor role ->", member.user.tag);
  } catch (e) {
    console.warn("visitor role failed", e.message);
  }

  try {
    const nick = await setCodexNickname(member);
    if (nick) console.log("nickname ->", nick);
  } catch (e) {
    console.warn("nickname failed", e.message);
  }

  try {
    await sendWelcome(member);
  } catch (e) {
    console.warn("welcome image failed", e.message);
    try {
      await sendWelcomeFallback(member);
    } catch (e2) {
      console.warn("welcome fallback failed", e2.message);
    }
  }
});

function clip(v, max = 1024) {
  const s = String(v || "");
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function buildButtons(orderId) {
  // Discord allows max 5 buttons per row
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${STATUS.received.id}:${orderId}`)
      .setLabel(STATUS.received.label)
      .setStyle(STATUS.received.color),
    new ButtonBuilder()
      .setCustomId(`${STATUS.confirmed.id}:${orderId}`)
      .setLabel(STATUS.confirmed.label)
      .setStyle(STATUS.confirmed.color),
    new ButtonBuilder()
      .setCustomId(`${STATUS.done.id}:${orderId}`)
      .setLabel(STATUS.done.label)
      .setStyle(STATUS.done.color),
    new ButtonBuilder()
      .setCustomId(`${STATUS.delivered.id}:${orderId}`)
      .setLabel(STATUS.delivered.label)
      .setStyle(STATUS.delivered.color)
      .setEmoji("✅"),
  );
}

function buildRatingButtons(orderId) {
  return new ActionRowBuilder().addComponents(
    ...[1, 2, 3, 4, 5].map((n) =>
      new ButtonBuilder()
        .setCustomId(`codex_rate_${n}:${orderId}`)
        .setLabel("⭐".repeat(n))
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

function buildOrderEmbed(order, statusKey = "received") {
  const st = STATUS[statusKey] || STATUS.received;
  const items = (order.items || [])
    .map((i) => `• ${i.name} ×${i.quantity}`)
    .join("\n");

  return new EmbedBuilder()
    .setColor(st.embedColor)
    .setTitle("📦 حالة التسليم")
    .setDescription(
      [
        `<@${OWNER_ID}> طلب جديد للمتابعة`,
        "",
        `**رقم الطلب:** \`${order.orderId}\``,
        `**الحالة:** ${st.staffLabel}`,
        `**العميل:** ${order.customerName || "—"}`,
        `**دسكورد العميل:** ${order.discord || "—"}`,
        order.customerId ? `**منشن:** <@${order.customerId}>` : null,
        `**الإجمالي:** ${order.total ?? "—"} ر.س`,
        `**الدفع:** ${order.paymentMethod || "—"} / ${order.paymentStatus || "—"}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .addFields(
      { name: "المنتجات", value: clip(items || "—") },
      ...(order.notes ? [{ name: "ملاحظات", value: clip(order.notes) }] : []),
    )
    .setFooter({ text: "codeX · Delivery Control" })
    .setTimestamp();
}

function officialDividerUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL || "https://codex-theta-two.vercel.app";
  return `${base.replace(/\/$/, "")}/discord/codex-divider-official.png?v=official`;
}

async function sendOfficialDivider(channel) {
  const local = path.join(
    ROOT,
    "public",
    "discord",
    "codex-divider-official.png",
  );
  if (fs.existsSync(local)) {
    await channel.send({
      files: [
        new AttachmentBuilder(local, { name: "codex-divider-official.png" }),
      ],
    });
    return;
  }
  // Fallback: download hosted asset and attach as plain file (no embed box)
  const res = await fetch(officialDividerUrl());
  if (!res.ok) throw new Error(`divider fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await channel.send({
    files: [
      new AttachmentBuilder(buf, { name: "codex-divider-official.png" }),
    ],
  });
}

async function postDeliveryOrder(order) {
  const channelId =
    meta.deliveryChannelId || process.env.DISCORD_DELIVERY_CHANNEL_ID;
  if (!channelId) throw new Error("deliveryChannelId missing");
  const channel = await client.channels.fetch(channelId);
  const embed = buildOrderEmbed(order, "received");
  const row = buildButtons(order.orderId);
  const msg = await channel.send({
    content: `<@${OWNER_ID}>`,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [OWNER_ID] },
  });
  await sendOfficialDivider(channel).catch((e) =>
    console.warn("divider after delivery failed", e.message),
  );
  return { messageId: msg.id, channelId };
}

async function sendRatingDm(user, orderId) {
  await user.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x10b981)
        .setTitle("codeX — تم تسليم طلبك")
        .setDescription(
          [
            `تم تسليم طلبك **${orderId}** بنجاح 🎉`,
            "",
            "نقدر تقييمك جداً.",
            "اضغط على عدد النجوم المناسب لتجربتك:",
          ].join("\n"),
        )
        .setFooter({ text: "codeX Store · Rating" })
        .setTimestamp(),
    ],
    components: [buildRatingButtons(orderId)],
  });
}

function saveMeta() {
  try {
    fs.mkdirSync(path.dirname(metaPath), { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  } catch (e) {
    console.warn("meta save skipped", e.message);
  }
}

client.once("clientReady", async () => {
  console.log("bot ready as", client.user.tag);
  saveMeta();
  try {
    await registerPanelCommands(client, GUILD_ID);
    console.log("panel slash commands registered");
  } catch (e) {
    console.warn("panel commands failed", e.message);
  }

  if (process.env.CODEX_SETUP_LOGS === "1") {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      await guild.channels.fetch();
      const created = await setupLogRooms(guild, client);
      console.log("log rooms:", created.length);
    } catch (e) {
      console.warn("setup logs failed", e.message);
    }
  }

  if (!meta.deliveryChannelId) {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    const ch = guild.channels.cache.find(
      (c) =>
        c.type === 0 &&
        (c.name.includes("حاله-التسليم") || c.name.includes("التسليم")),
    );
    if (ch) {
      meta.deliveryChannelId = ch.id;
      saveMeta();
      console.log("discovered delivery channel", ch.id);
    }
  }

  if (process.env.CODEX_POST_TICKET_PANEL === "1") {
    try {
      const id = await postTicketPanel(client);
      console.log("ticket panel posted in", id);
    } catch (e) {
      console.warn("ticket panel failed", e.message);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, orderId] = interaction.customId.split(":");
  if (!orderId) return;

  // Rating buttons from customer DM
  if (action.startsWith("codex_rate_")) {
    const stars = Number(action.replace("codex_rate_", ""));
    if (![1, 2, 3, 4, 5].includes(stars)) return;

    await interaction.deferUpdate();

    const starText = "⭐".repeat(stars);
    const reviewsId = meta.reviewsChannelId || REVIEWS_CHANNEL_ID;

    try {
      const reviewsCh = await client.channels.fetch(reviewsId);
      await reviewsCh.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf5d76e)
            .setTitle("⭐ تقييم جديد — codeX")
            .setDescription(
              [
                `**الطلب:** \`${orderId}\``,
                `**العميل:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)`,
                `**التقييم:** ${starText} (${stars}/5)`,
              ].join("\n"),
            )
            .setFooter({ text: "codeX · Reviews" })
            .setTimestamp(),
        ],
      });
    } catch (e) {
      console.warn("reviews post failed", e.message);
    }

    try {
      await interaction.message.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf5d76e)
            .setTitle("شكراً لتقييمك ⭐")
            .setDescription(
              `تم تسجيل تقييمك لطلب **${orderId}**:\n\n${starText} (${stars}/5)\n\nشكراً لثقتك في codeX 💙`,
            )
            .setTimestamp(),
        ],
        components: [],
      });
    } catch {}

    return;
  }

  const statusEntry = Object.values(STATUS).find((s) => s.id === action);
  if (!statusEntry) return;

  await interaction.deferUpdate();

  const embed = EmbedBuilder.from(interaction.message.embeds[0] || {});
  const desc = embed.data.description || "";
  const customerMention = (desc.match(/<@(\d{15,20})>/) || [])[1];
  const discordLine = (desc.match(/\*\*دسكورد العميل:\*\*\s*(.+)/) || [])[1];
  const customerName = (desc.match(/\*\*العميل:\*\*\s*(.+)/) || [])[1];

  const statusKey = Object.keys(STATUS).find((k) => STATUS[k].id === action);
  const updated = buildOrderEmbed(
    {
      orderId,
      customerName: customerName || "—",
      discord: discordLine || "—",
      customerId: customerMention,
      items: [],
      total: "—",
      paymentMethod: "—",
      paymentStatus: "—",
    },
    statusKey,
  );

  const oldFields = interaction.message.embeds[0]?.fields || [];
  for (const f of oldFields) {
    if (f.name === "المنتجات" || f.name === "ملاحظات") {
      updated.addFields({ name: f.name, value: f.value });
    }
  }

  await interaction.message.edit({
    embeds: [updated],
    components: [buildButtons(orderId)],
  });

  let user = null;
  if (customerMention) {
    try {
      user = await client.users.fetch(customerMention);
    } catch {}
  }
  if (!user && discordLine) {
    const id = (String(discordLine).match(/\d{15,20}/) || [])[0];
    if (id) {
      try {
        user = await client.users.fetch(id);
      } catch {}
    }
  }

  if (user) {
    try {
      if (statusEntry.sendRating) {
        await sendRatingDm(user, orderId);
      } else {
        await user.send({
          embeds: [
            new EmbedBuilder()
              .setColor(statusEntry.embedColor)
              .setTitle(`codeX — ${statusEntry.dmTitle}`)
              .setDescription(
                [
                  `مرحباً، تحديث بخصوص طلبك **${orderId}**:`,
                  "",
                  statusEntry.dmBody,
                  "",
                  "شكراً لثقتك في codeX 💙",
                ].join("\n"),
              )
              .setFooter({ text: "codeX Store" })
              .setTimestamp(),
          ],
        });
      }
      await interaction.followUp({
        content: statusEntry.sendRating
          ? "✅ تم التسليم، وانرسل للعميل رسالة تقييم بالنجوم."
          : "✅ تم تحديث الحالة وإرسال خاص للعميل.",
        flags: MessageFlags.Ephemeral,
      });
    } catch {
      await interaction.followUp({
        content:
          "⚠️ تم تحديث الحالة، لكن ما قدرت أرسل خاص للعميل (الخصوصية مقفلة أو اليوزر غير موجود).",
        flags: MessageFlags.Ephemeral,
      });
    }
  } else {
    await interaction.followUp({
      content:
        "⚠️ تم تحديث الحالة، لكن ما لقيت آيدي دسكورد العميل لإرسال الخاص.",
      flags: MessageFlags.Ephemeral,
    });
  }
});

async function onStripePaid(session) {
  const channelId = STRIPE_NOTIFY_CHANNEL_ID || meta.deliveryChannelId;
  if (!channelId) {
    console.warn("stripe paid but no notify channel");
    return;
  }

  const amountTotal =
    typeof session.amount_total === "number"
      ? (session.amount_total / 100).toFixed(2)
      : "?";
  const currencyRaw = String(session.currency || "aed").toLowerCase();
  const currencyLabel =
    currencyRaw === "aed"
      ? "د.إ"
      : currencyRaw === "sar"
        ? "ر.س"
        : currencyRaw.toUpperCase();
  const productName = session.metadata?.productName || "خدمة codeX";
  const discordId = session.metadata?.discordId || "";
  const email =
    session.customer_details?.email || session.customer_email || "—";
  const customerName =
    session.customer_details?.name ||
    session.metadata?.customerName ||
    "عميل Stripe";
  const sessionId = session.id || "—";
  const shortId = String(sessionId).replace(/^cs_test_/, "").replace(/^cs_live_/, "").slice(-8).toUpperCase();
  const invoiceNo = `CX-STRIPE-${shortId || "XXXX"}`;
  const paidAt = session.created
    ? new Date(session.created * 1000).toLocaleString("ar-SA")
    : "الآن";
  const modeLabel = String(sessionId).includes("test") ? "تجريبي" : "Live";
  const staffRoleOwner =
    process.env.DISCORD_STAFF_ROLE_OWNER || "1524961206144860333";
  const staffRoleTeam =
    process.env.DISCORD_STAFF_ROLE_TEAM || "1524961198360236084";

  const channel = await client.channels.fetch(channelId);
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle(`فاتورة codeX — ${invoiceNo} 🧾`)
    .setDescription(
      [
        `<@&${staffRoleOwner}> <@&${staffRoleTeam}> طلب جديد يحتاج متابعتك`,
        "",
        `**رقم الفاتورة:** \`${invoiceNo}\``,
        `**التاريخ:** ${paidAt} (${modeLabel})`,
        `**حالة الدفع:** مدفوع ✅`,
        `**طريقة الدفع:** Stripe`,
        "",
        "👤 **بيانات العميل**",
        `**الاسم:** ${customerName}`,
        discordId
          ? `**دسكورد:** <@${discordId}>`
          : "**دسكورد:** —",
        `**الإيميل:** ${email}`,
        "",
        "📦 **ملخص المنتجات**",
        `• ${productName} ×1 = ${amountTotal} ${currencyLabel}`,
        "",
        "🧾 **تفاصيل الفاتورة**",
        `الكمية: 1 | سعر الوحدة: ${amountTotal} ${currencyLabel} | الإجمالي: **${amountTotal} ${currencyLabel}**`,
        "",
        `💳 الدفع Stripe ✅ مدفوع`,
        `💰 **الإجمالي المستحق:** ${amountTotal} ${currencyLabel}`,
        "",
        "✅ **إجراء مطلوب**",
        "الطلب مدفوع — ابدأ التنفيذ وتواصل مع العميل",
      ].join("\n"),
    )
    .setFooter({
      text: `فاتورة خاصة • للمالك فقط • codeX • ${sessionId}`,
    })
    .setTimestamp();

  const msg = await channel.send({
    content: `فاتورة جديدة من المتجر 🧾 <@&${staffRoleOwner}> <@&${staffRoleTeam}>`,
    embeds: [embed],
    components: [buildButtons(invoiceNo)],
    allowedMentions: {
      roles: [staffRoleOwner, staffRoleTeam],
    },
  });

  await sendOfficialDivider(channel).catch((e) =>
    console.warn("divider after stripe invoice failed", e.message),
  );

  return { messageId: msg.id, channelId, invoiceNo };
}

const stripePayments = createStripePayments({
  secretKey: process.env.STRIPE_SECRET_KEY || "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  publicBaseUrl: PUBLIC_BASE_URL,
  currency: process.env.STRIPE_CURRENCY || "aed",
});

const panelApp = createPanelApp({
  client,
  store: panelStore,
  broadcast,
  apiKey: API_KEY,
  guildId: GUILD_ID,
  postDeliveryOrder,
  stripePayments,
  onStripePaid,
});

panelApp.listen(PORT, "0.0.0.0", () => {
  console.log("http panel on", PORT);
  console.log("dashboard: /  |  health: /health  |  api: /api/*");
  console.log(
    "stripe:",
    stripePayments ? "enabled" : "disabled (set STRIPE_SECRET_KEY)",
  );
  if (stripePayments && PUBLIC_BASE_URL) {
    console.log("pay example:", `${PUBLIC_BASE_URL}/pay?amount=50&name=codeX`);
    console.log("webhook:", `${PUBLIC_BASE_URL}/stripe/webhook`);
  }
});
client.login(TOKEN);
