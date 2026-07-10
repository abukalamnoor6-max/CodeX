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
import http from "http";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";
const PORT = Number(process.env.PORT || process.env.CODEX_BOT_PORT || 8787);
const WAITING_URL =
  process.env.DISCORD_WAITING_URL ||
  "https://discord.com/channels/1524901009195798679/1524971494663258235";
const REVIEWS_CHANNEL_ID =
  process.env.DISCORD_REVIEWS_CHANNEL_ID || "1524981051787837540";
const DELIVERY_CHANNEL_ID =
  process.env.DISCORD_DELIVERY_CHANNEL_ID || "1524961264869310494";

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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

attachGuard(client);
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

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/delivery-order") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const order = JSON.parse(body || "{}");
        if (!order.orderId) throw new Error("orderId required");
        const result = await postDeliveryOrder(order);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, user: client.user?.tag || null }));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => console.log("http bridge on", PORT));
client.login(TOKEN);
