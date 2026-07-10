/**
 * codeX Tickets — استفسار / استلام طلب / مشكلة
 */
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
  AttachmentBuilder,
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LOG_CHANNELS } from "./guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

export const TICKET_CHANNEL_ID =
  process.env.DISCORD_TICKET_CHANNEL_ID || "1524961237257949275";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";
const STAFF_ROLE_RE = /𝐎𝐖𝐍𝐄𝐑|OWNER|𝐓𝐄𝐀𝐌|TEAM|Founder|Admin|Partner|𝐏𝐚𝐫𝐭𝐧𝐞𝐫/i;

export const TICKET_TYPES = {
  inquiry: {
    value: "inquiry",
    label: "استفسار",
    emoji: "💬",
    description: "سؤال عن المتجر أو المنتجات أو الخدمات",
    color: 0x5865f2,
    prefix: "استفسار",
  },
  delivery: {
    value: "delivery",
    label: "استلام طلب",
    emoji: "📦",
    description: "جاهز تستلم طلبك أو تتابع التسليم",
    color: 0x57f287,
    prefix: "استلام",
  },
  problem: {
    value: "problem",
    label: "مشكلة",
    emoji: "⚠️",
    description: "مشكلة في طلب أو منتج أو الدفع",
    color: 0xed4245,
    prefix: "مشكلة",
  },
};

function bannerPath() {
  return path.join(ROOT, "public", "discord", "codex-ticket-banner.png");
}

function bannerUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL || "https://codex-theta-two.vercel.app";
  return `${base.replace(/\/$/, "")}/discord/codex-ticket-banner.png?v=1`;
}

function findStaffRoles(guild) {
  return [...guild.roles.cache.values()].filter((r) => STAFF_ROLE_RE.test(r.name));
}

async function sendTicketLog(client, embed) {
  const id = LOG_CHANNELS.tickets;
  try {
    const ch = await client.channels.fetch(id);
    if (ch?.isTextBased?.()) await ch.send({ embeds: [embed] });
  } catch (e) {
    console.warn("ticket log failed", e.message);
  }
}

export function buildTicketPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x0059db)
    .setTitle("الدعم الفني — codeX")
    .setDescription(
      [
        "الدعم متوفر من **10 صباحاً** إلى **10 مساءً**",
        "",
        "اختر سبب فتح التذكرة من القائمة تحت:",
        "• **استفسار** — سؤال عام",
        "• **استلام طلب** — متابعة / استلام",
        "• **مشكلة** — خلل أو شكوى",
      ].join("\n"),
    )
    .setImage(bannerUrl())
    .setFooter({ text: "codeX · التذاكر" })
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId("codex_ticket_open")
    .setPlaceholder("سبب فتح التذكرة")
    .addOptions(
      Object.values(TICKET_TYPES).map((t) => ({
        label: t.label,
        value: t.value,
        description: t.description.slice(0, 100),
        emoji: t.emoji,
      })),
    );

  const row = new ActionRowBuilder().addComponents(menu);
  const files = [];
  const local = bannerPath();
  if (fs.existsSync(local)) {
    files.push(new AttachmentBuilder(local, { name: "codex-ticket-banner.png" }));
    embed.setImage("attachment://codex-ticket-banner.png");
  }

  return { embeds: [embed], components: [row], files };
}

async function ensureTicketCategory(guild) {
  let cat = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildCategory &&
      (c.name.includes("التذاكر") || c.name.toLowerCase().includes("ticket")),
  );
  if (!cat) {
    cat = await guild.channels.create({
      name: "🎫 │ التذاكر",
      type: ChannelType.GuildCategory,
      reason: "codeX tickets category",
    });
  }
  return cat;
}

export async function openTicket(interaction, typeKey) {
  const type = TICKET_TYPES[typeKey];
  if (!type) {
    await interaction.reply({ content: "خيار غير معروف.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  await guild.channels.fetch();
  await guild.roles.fetch();

  // One open ticket per user
  const existing = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.topic?.includes(`owner:${interaction.user.id}`) &&
      !c.name.startsWith("مغلق-"),
  );
  if (existing) {
    await interaction.editReply({
      content: `عندك تذكرة مفتوحة مسبقاً: ${existing}`,
    });
    return;
  }

  const cat = await ensureTicketCategory(guild);
  const staffRoles = findStaffRoles(guild);
  const me = await guild.members.fetchMe();

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: me.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: OWNER_ID,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    ...staffRoles.map((r) => ({
      id: r.id,
      type: OverwriteType.Role,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    })),
  ];

  const short = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]/gi, "")
    .slice(0, 12) || "user";
  const name = `${type.prefix}-${short}`.slice(0, 90);

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: cat.id,
    topic: `type:${type.value} | owner:${interaction.user.id} | ${type.label}`,
    permissionOverwrites: overwrites,
    reason: `codeX ticket: ${type.label}`,
  });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`codex_ticket_close:${interaction.user.id}`)
      .setLabel("إغلاق التذكرة")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒"),
  );

  await channel.send({
    content: `<@${interaction.user.id}> ${staffRoles[0] ? `<@&${staffRoles[0].id}>` : `<@${OWNER_ID}>`}`,
    embeds: [
      new EmbedBuilder()
        .setColor(type.color)
        .setTitle(`${type.emoji} تذكرة ${type.label}`)
        .setDescription(
          [
            `مرحباً <@${interaction.user.id}>`,
            "",
            `**النوع:** ${type.label}`,
            "اكتب تفاصيل طلبك هنا، والفريق بيرد عليك بأقرب وقت.",
            "",
            type.value === "delivery"
              ? "إذا عندك رقم طلب، أرسله مع الرسالة."
              : type.value === "problem"
                ? "وضّح المشكلة + رقم الطلب إن وجد + صورة إن أمكن."
                : "اكتب سؤالك بوضوح.",
          ].join("\n"),
        )
        .setFooter({ text: "codeX · التذاكر" })
        .setTimestamp(),
    ],
    components: [closeRow],
    allowedMentions: {
      users: [interaction.user.id, OWNER_ID],
      roles: staffRoles.slice(0, 1).map((r) => r.id),
    },
  });

  await sendTicketLog(
    interaction.client,
    new EmbedBuilder()
      .setColor(type.color)
      .setTitle("🎫 تذكرة جديدة")
      .setDescription(
        [
          `**النوع:** ${type.label}`,
          `**بواسطة:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)`,
          `**الروم:** ${channel}`,
        ].join("\n"),
      )
      .setTimestamp(),
  );

  await interaction.editReply({
    content: `تم فتح تذكرتك: ${channel}`,
  });

  // Reset select menu so others can open tickets
  try {
    if (interaction.message?.editable) {
      await interaction.message.edit(buildTicketPanelPayload());
    }
  } catch {}
}

export async function closeTicket(interaction) {
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const topic = channel.topic || "";
  const ownerMatch = topic.match(/owner:(\d{15,20})/);
  const ownerId = ownerMatch?.[1];
  const isOwner = ownerId && interaction.user.id === ownerId;
  const member = interaction.member;
  const isStaff =
    interaction.user.id === OWNER_ID ||
    member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
    member?.roles?.cache?.some((r) => STAFF_ROLE_RE.test(r.name));

  if (!isOwner && !isStaff) {
    await interaction.reply({
      content: "ما تقدر تغلق هالتذكرة.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({ content: "جاري إغلاق التذكرة…" });

  await sendTicketLog(
    interaction.client,
    new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("🔒 إغلاق تذكرة")
      .setDescription(
        [
          `**الروم:** \`${channel.name}\``,
          `**أغلقها:** <@${interaction.user.id}>`,
          ownerId ? `**صاحب التذكرة:** <@${ownerId}>` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .setTimestamp(),
  );

  try {
    await channel.setName(`مغلق-${channel.name}`.slice(0, 90));
  } catch {}

  setTimeout(async () => {
    try {
      await channel.delete("codeX ticket closed");
    } catch (e) {
      console.warn("ticket delete failed", e.message);
    }
  }, 4000);
}

export function attachTickets(client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isStringSelectMenu() && interaction.customId === "codex_ticket_open") {
        const value = interaction.values[0];
        await openTicket(interaction, value);
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith("codex_ticket_close:")) {
        await closeTicket(interaction);
      }
    } catch (e) {
      console.warn("ticket interaction error", e.message);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "صار خطأ، حاول مرة ثانية.", ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: "صار خطأ، حاول مرة ثانية.", ephemeral: true }).catch(() => {});
      }
    }
  });

  console.log("codeX Tickets attached");
}

export async function postTicketPanel(client) {
  const ch = await client.channels.fetch(TICKET_CHANNEL_ID);
  if (!ch?.isTextBased?.()) throw new Error("ticket channel missing");

  // Clear old bot panels (keep history light)
  try {
    const msgs = await ch.messages.fetch({ limit: 15 });
    for (const m of msgs.values()) {
      if (m.author.id === client.user.id) await m.delete().catch(() => {});
    }
  } catch {}

  await ch.send(buildTicketPanelPayload());
  return ch.id;
}
