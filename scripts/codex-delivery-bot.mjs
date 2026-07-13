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
import {
  attachCodexLogs,
  setupLogRooms,
  syncLogRooms,
} from "./lib/codex-logs.mjs";
import { createPanelStore } from "./lib/panel-store.mjs";
import { attachPanelSettingsBackup } from "./lib/panel-backup.mjs";
import { createBroadcastService } from "./lib/broadcast.mjs";
import {
  attachBroadcastUi,
  registerPanelCommands,
} from "./lib/broadcast-ui.mjs";
import { createPanelApp } from "./lib/panel-app.mjs";
import { createPayPalPayments } from "./lib/paypal-payments.mjs";

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
    : "https://codex-delivery-bot-production.up.railway.app")
).replace(/\/$/, "");
const PAYPAL_NOTIFY_CHANNEL_ID =
  process.env.PAYPAL_NOTIFY_CHANNEL_ID ||
  process.env.STRIPE_NOTIFY_CHANNEL_ID ||
  "1524971495921684601";

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
      "تم استلام طلبك بنجاح، وفريق 𝐂𝐨𝐝𝐞𝐗 يقوم حالياً بالتأكد من التفاصيل والدفع.",
    sendRating: false,
  },
  confirmed: {
    id: "codex_status_confirmed",
    label: "تم التأكيد — يتم العمل",
    color: ButtonStyle.Primary,
    embedColor: 0x0059db,
    staffLabel: "🔵 تم التأكيد / قيد التنفيذ",
    dmTitle: "تم تأكيد طلبك",
    dmBody: "تم تأكيد طلبك، وفريق 𝐂𝐨𝐝𝐞𝐗 بدأ العمل عليه الآن.",
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
const panelBackup = attachPanelSettingsBackup(client, panelStore);

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

async function resolveCustomerFromEmbed(desc = "") {
  const text = String(desc || "");

  // Prefer explicit customer mention lines (avoid staff role noise)
  const discordField =
    (text.match(/\*\*دسكورد(?: العميل)?:\*\*\s*(.+)/i) || [])[1] || "";
  const mentionInField = (discordField.match(/<@!?(\d{15,22})>/) || [])[1];
  if (mentionInField) {
    try {
      return await client.users.fetch(mentionInField);
    } catch {}
  }

  const anyCustomerMention =
    (text.match(/\*\*منشن:\*\*\s*<@!?(\d{15,22})>/) || [])[1] ||
    (text.match(/\*\*دسكورد:\*\*\s*<@!?(\d{15,22})>/) || [])[1];
  if (anyCustomerMention) {
    try {
      return await client.users.fetch(anyCustomerMention);
    } catch {}
  }

  const rawId = (discordField.match(/\d{15,22}/) || [])[0];
  if (rawId) {
    try {
      return await client.users.fetch(rawId);
    } catch {}
  }

  // Username from ` @user ` or plain text
  let username = discordField
    .replace(/<@!?\d+>/g, "")
    .replace(/[`@]/g, "")
    .replace(/^—$/, "")
    .trim();
  if (!username || username === "—") {
    username = ((text.match(/\*\*الاسم:\*\*\s*(.+)/) || [])[1] || "")
      .replace(/^عميل(?: PayPal)?$/i, "")
      .trim();
  }
  if (!username || username.length < 2) return null;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const results = await guild.members.search({ query: username, limit: 15 });
    const exact =
      results.find(
        (m) => m.user.username.toLowerCase() === username.toLowerCase(),
      ) ||
      results.find(
        (m) =>
          (m.user.globalName || "").toLowerCase() === username.toLowerCase(),
      ) ||
      results.find(
        (m) => m.displayName.toLowerCase() === username.toLowerCase(),
      );
    if (exact) return exact.user;
    if (results.size === 1) return results.first().user;
  } catch (e) {
    console.warn("customer username resolve failed", e.message);
  }
  return null;
}

function applyStatusToInvoiceEmbed(embed, statusEntry) {
  const next = EmbedBuilder.from(embed);
  let desc = next.data.description || "";
  const statusLine = `**حالة الطلب:** ${statusEntry.staffLabel}`;
  if (/\*\*حالة الطلب:\*\*/.test(desc)) {
    desc = desc.replace(/\*\*حالة الطلب:\*\*[^\n]*/g, statusLine);
  } else if (/\*\*حالة الدفع:\*\*/.test(desc)) {
    desc = desc.replace(
      /(\*\*حالة الدفع:\*\*[^\n]*)/,
      `$1\n${statusLine}`,
    );
  } else {
    desc = `${statusLine}\n\n${desc}`;
  }
  next.setDescription(desc);
  next.setColor(statusEntry.embedColor);
  return next;
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
    .setFooter({ text: "𝐂𝐨𝐝𝐞𝐗 · Delivery Control" })
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
        .setTitle("𝐂𝐨𝐝𝐞𝐗 — تم تسليم طلبك")
        .setDescription(
          [
            `تم تسليم طلبك **${orderId}** بنجاح 🎉`,
            "",
            "نقدر تقييمك جداً.",
            "اضغط على عدد النجوم المناسب لتجربتك:",
          ].join("\n"),
        )
        .setFooter({ text: "𝐂𝐨𝐝𝐞𝐗 Store · Rating" })
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
    await panelBackup.boot();
  } catch (e) {
    console.warn("panel backup boot failed", e.message);
  }
  try {
    await registerPanelCommands(client, GUILD_ID);
    console.log("panel slash commands registered");
  } catch (e) {
    console.warn("panel commands failed", e.message);
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    const synced = await syncLogRooms(guild);
    console.log(
      "log rooms synced",
      synced.changed,
      synced.mapped.filter((m) => m.includes("MISSING")).join(" | ") || "ok",
    );
    if (process.env.CODEX_SETUP_LOGS === "1") {
      const created = await setupLogRooms(guild, client);
      console.log("log rooms:", created.length);
    }
  } catch (e) {
    console.warn("setup logs failed", e.message);
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

const ORDERS_CHANNEL_ID =
  process.env.DISCORD_ORDERS_CHANNEL_ID || "1524971495921684601";

client.on(Events.InteractionCreate, async (interaction) => {
  // /order — فاتورة يدوية في روم الطلبات
  if (interaction.isChatInputCommand() && interaction.commandName === "order") {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const user = interaction.options.getUser("user", true);
      const orderId = String(
        interaction.options.getString("order_id", true),
      ).trim();
      const product =
        interaction.options.getString("product")?.trim() || "طلب يدوي";
      const amount = interaction.options.getString("amount")?.trim() || "—";
      const currencyRaw =
        interaction.options.getString("currency")?.trim().toUpperCase() ||
        "USD";
      const currencyLabel =
        currencyRaw === "SAR" || currencyRaw === "ر.س" ? "ر.س" : currencyRaw;
      const payment =
        interaction.options.getString("payment")?.trim() || "يدوي";

      const invoiceNo = orderId.toUpperCase().startsWith("CX-")
        ? orderId
        : `CX-${orderId}`;

      const result = await sendPaidInvoice({
        invoiceNo,
        productName: product,
        amountLabel: amount,
        currencyLabel,
        email: "—",
        customerName: user.globalName || user.username,
        discordId: user.id,
        discordUser: user.username,
        paymentMethod: payment,
        modeLabel: "يدوي",
        refId: invoiceNo,
        channelIdOverride: ORDERS_CHANNEL_ID,
      });

      await interaction.editReply({
        content: `✅ تم نشر الفاتورة \`${result.invoiceNo}\` في <#${ORDERS_CHANNEL_ID}> للعميل ${user}`,
      });
    } catch (e) {
      console.warn("/order failed", e.message);
      const msg = `❌ فشل إنشاء الفاتورة: ${e.message}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg }).catch(() => {});
      } else {
        await interaction
          .reply({ content: msg, flags: MessageFlags.Ephemeral })
          .catch(() => {});
      }
    }
    return;
  }

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
            .setTitle("⭐ تقييم جديد — 𝐂𝐨𝐝𝐞𝐗")
            .setDescription(
              [
                `**الطلب:** \`${orderId}\``,
                `**العميل:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)`,
                `**التقييم:** ${starText} (${stars}/5)`,
              ].join("\n"),
            )
            .setFooter({ text: "𝐂𝐨𝐝𝐞𝐗 · Reviews" })
            .setTimestamp(),
        ],
      });
      await sendOfficialDivider(reviewsCh).catch((e) =>
        console.warn("divider after review failed", e.message),
      );
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
              `تم تسجيل تقييمك لطلب **${orderId}**:\n\n${starText} (${stars}/5)\n\nشكراً لثقتك في 𝐂𝐨𝐝𝐞𝐗 💙`,
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

  const original = interaction.message.embeds[0];
  const desc = original?.description || "";
  const isInvoice = /فاتورة|رقم الفاتورة/i.test(
    `${original?.title || ""}\n${desc}`,
  );
  const statusKey = Object.keys(STATUS).find((k) => STATUS[k].id === action);

  let updated;
  if (isInvoice) {
    updated = applyStatusToInvoiceEmbed(original, statusEntry);
  } else {
    const customerMention = (desc.match(/<@(\d{15,22})>/) || [])[1];
    const discordLine = (desc.match(/\*\*دسكورد العميل:\*\*\s*(.+)/) || [])[1];
    const customerName = (desc.match(/\*\*العميل:\*\*\s*(.+)/) || [])[1];
    updated = buildOrderEmbed(
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
    const oldFields = original?.fields || [];
    for (const f of oldFields) {
      if (f.name === "المنتجات" || f.name === "ملاحظات") {
        updated.addFields({ name: f.name, value: f.value });
      }
    }
  }

  await interaction.message.edit({
    embeds: [updated],
    components: [buildButtons(orderId)],
  });

  const user = await resolveCustomerFromEmbed(desc);

  if (user) {
    try {
      if (statusEntry.sendRating) {
        await sendRatingDm(user, orderId);
      } else {
        await user.send({
          embeds: [
            new EmbedBuilder()
              .setColor(statusEntry.embedColor)
              .setTitle(`𝐂𝐨𝐝𝐞𝐗 — ${statusEntry.dmTitle}`)
              .setDescription(
                [
                  `مرحباً، تحديث بخصوص طلبك **${orderId}**:`,
                  "",
                  statusEntry.dmBody,
                  "",
                  "شكراً لثقتك في 𝐂𝐨𝐝𝐞𝐗 💙",
                ].join("\n"),
              )
              .setFooter({ text: "𝐂𝐨𝐝𝐞𝐗 Store" })
              .setTimestamp(),
          ],
        });
      }
      await interaction.followUp({
        content: statusEntry.sendRating
          ? `✅ تم التسليم، وانرسل لـ ${user} رسالة تقييم بالنجوم.`
          : `✅ تم إرسال حالة الطلب لـ ${user}: ${statusEntry.staffLabel}`,
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
        "⚠️ تم تحديث الحالة، لكن ما لقيت دسكورد العميل. تأكد إنه كتب يوزره صح وهو داخل السيرفر.",
      flags: MessageFlags.Ephemeral,
    });
  }
});

async function sendPaidInvoice({
  invoiceNo,
  productName,
  amountLabel,
  currencyLabel,
  email = "—",
  customerName = "عميل",
  discordId = "",
  discordUser = "",
  paymentMethod = "PayPal",
  modeLabel = "",
  refId = "",
  channelIdOverride = "",
}) {
  const channelId =
    channelIdOverride ||
    PAYPAL_NOTIFY_CHANNEL_ID ||
    meta.deliveryChannelId;
  if (!channelId) {
    console.warn("paid invoice but no notify channel");
    throw new Error("روم الطلبات غير محدد");
  }
  const staffRoleOwner =
    process.env.DISCORD_STAFF_ROLE_OWNER || "1524961206144860333";
  const staffRoleTeam =
    process.env.DISCORD_STAFF_ROLE_TEAM || "1524961198360236084";
  const paidAt = new Date().toLocaleString("ar-SA");
  const userLabel = discordUser
    ? `\`@${String(discordUser).replace(/^@+/, "")}\``
    : "";
  const idLabel = discordId ? `<@${discordId}>` : "";
  const discordLine =
    idLabel && userLabel
      ? `**دسكورد:** ${idLabel} · اليوزر: ${userLabel}`
      : idLabel
        ? `**دسكورد:** ${idLabel}`
        : userLabel
          ? `**دسكورد:** ${userLabel}`
          : "**دسكورد:** —";

  const channel = await client.channels.fetch(channelId);
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle(`فاتورة 𝐂𝐨𝐝𝐞𝐗 — ${invoiceNo} 🧾`)
    .setDescription(
      [
        `<@&${staffRoleOwner}> <@&${staffRoleTeam}> طلب جديد يحتاج متابعتك`,
        "",
        `**رقم الفاتورة:** \`${invoiceNo}\``,
        `**التاريخ:** ${paidAt}${modeLabel ? ` (${modeLabel})` : ""}`,
        `**حالة الدفع:** مدفوع ✅`,
        `**حالة الطلب:** 🟡 بانتظار الفريق`,
        `**طريقة الدفع:** ${paymentMethod}`,
        "",
        "👤 **بيانات العميل**",
        `**الاسم:** ${customerName}`,
        discordLine,
        `**الإيميل:** ${email}`,
        "",
        "📦 **ملخص المنتجات**",
        `• ${productName} ×1 = ${amountLabel} ${currencyLabel}`,
        "",
        "🧾 **تفاصيل الفاتورة**",
        `الكمية: 1 | سعر الوحدة: ${amountLabel} ${currencyLabel} | الإجمالي: **${amountLabel} ${currencyLabel}**`,
        "",
        `💳 الدفع ${paymentMethod} ✅ مدفوع`,
        `💰 **الإجمالي المستحق:** ${amountLabel} ${currencyLabel}`,
        "",
        "✅ **إجراء مطلوب**",
        "الطلب مدفوع — ابدأ التنفيذ وتواصل مع العميل",
      ].join("\n"),
    )
    .setFooter({
      text: `فاتورة خاصة • للمالك فقط • 𝐂𝐨𝐝𝐞𝐗 • ${refId || invoiceNo}`,
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
    console.warn("divider after invoice failed", e.message),
  );

  return { messageId: msg.id, channelId, invoiceNo };
}

const paypalPayments = createPayPalPayments({
  clientId: process.env.PAYPAL_CLIENT_ID || "",
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
  webhookId: process.env.PAYPAL_WEBHOOK_ID || "",
  publicBaseUrl: PUBLIC_BASE_URL,
  currency: process.env.PAYPAL_CURRENCY || "USD",
  mode: process.env.PAYPAL_MODE || "live",
});

async function onPayPalPaid(resource) {
  const parsed = paypalPayments
    ? paypalPayments.parseCaptureResource(resource)
    : {
        captureId: resource?.id || "",
        amountValue: resource?.amount?.value || "?",
        currencyCode: resource?.amount?.currency_code || "USD",
        productName: resource?.custom_id || "خدمة 𝐂𝐨𝐝𝐞𝐗",
        discordId: "",
        discordUser: "",
        payerName: "",
        payerEmail: "",
      };

  const currencyRaw = String(parsed.currencyCode || "USD").toLowerCase();
  const currencyLabel =
    currencyRaw === "usd"
      ? "USD"
      : currencyRaw === "sar"
        ? "ر.س"
        : currencyRaw.toUpperCase();

  const shortId = String(parsed.captureId || parsed.orderId || "XXXX")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toUpperCase();
  const invoiceNo = `CX-PP-${shortId || "XXXX"}`;
  const modeLabel =
    String(process.env.PAYPAL_MODE || "live").toLowerCase() === "sandbox"
      ? "تجريبي"
      : "Live";

  const discordUser = String(parsed.discordUser || "").trim();
  const customerName =
    discordUser || parsed.payerName || "عميل PayPal";

  return sendPaidInvoice({
    invoiceNo,
    productName: parsed.productName || "خدمة 𝐂𝐨𝐝𝐞𝐗",
    amountLabel: String(parsed.amountValue || "?"),
    currencyLabel,
    email: parsed.payerEmail || "—",
    customerName,
    discordId: parsed.discordId || "",
    discordUser,
    paymentMethod: "PayPal",
    modeLabel,
    refId: parsed.captureId || parsed.orderId || "",
  });
}

const panelApp = createPanelApp({
  client,
  store: panelStore,
  broadcast,
  apiKey: API_KEY,
  guildId: GUILD_ID,
  postDeliveryOrder,
  paypalPayments,
  onPayPalPaid,
});

panelApp.listen(PORT, "0.0.0.0", () => {
  console.log("http panel on", PORT);
  console.log("dashboard: /  |  health: /health  |  api: /api/*");
  console.log(
    "paypal:",
    paypalPayments ? "enabled" : "disabled (set PAYPAL_CLIENT_ID + SECRET)",
  );
  if (PUBLIC_BASE_URL && paypalPayments) {
    console.log("pay paypal:", `${PUBLIC_BASE_URL}/pay?amount=10&name=%F0%9D%90%82%F0%9D%90%A8%F0%9D%90%9D%F0%9D%90%9E%F0%9D%90%97`);
    console.log("paypal webhook:", `${PUBLIC_BASE_URL}/paypal/webhook`);
  }
});
client.login(TOKEN);
