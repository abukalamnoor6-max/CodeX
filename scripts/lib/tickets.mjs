/**
 * codeX Tickets — استفسار / استلام طلب / مشكلة
 * Staff controls: claim / add / remove / alert / close
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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LOG_CHANNELS } from "./guard.mjs";
import {
  handleAiHumanButton,
  silenceAiOnClaim,
  parseTopic as parseAiTopic,
  buildTopic as buildAiTopic,
} from "./ticket-ai.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

export const TICKET_CHANNEL_ID =
  process.env.DISCORD_TICKET_CHANNEL_ID || "1524961237257949275";
const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";

/** Only these roles can see tickets + use staff controls */
export const STAFF_ROLE_IDS = [
  process.env.DISCORD_STAFF_ROLE_OWNER || "1524961206144860333", // 〢 OWNER
  process.env.DISCORD_STAFF_ROLE_TEAM || "1524961198360236084", // 〢 TEAM CodeX
];

export const TICKET_TYPES = {
  inquiry: {
    value: "inquiry",
    label: "استفسار",
    categoryLabel: "للاستفسار و المشاكل",
    emoji: "💬",
    description: "سؤال عن المتجر أو المنتجات أو الخدمات",
    color: 0x5865f2,
    prefix: "استفسار",
  },
  delivery: {
    value: "delivery",
    label: "استلام طلب",
    categoryLabel: "استلام طلب",
    emoji: "📦",
    description: "جاهز تستلم طلبك أو تتابع التسليم",
    color: 0x57f287,
    prefix: "استلام",
  },
  problem: {
    value: "problem",
    label: "مشكلة",
    categoryLabel: "للاستفسار و المشاكل",
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
  return `${base.replace(/\/$/, "")}/discord/codex-ticket-banner.png?v=2`;
}

function parseTopic(topic = "") {
  return parseAiTopic(topic);
}

function buildTopic({ type, owner, claimed, ai = "on" }) {
  return buildAiTopic({ type, owner, claimed, ai });
}

function isStaffMember(member) {
  if (!member) return false;
  if (member.id === OWNER_ID) return true;
  return STAFF_ROLE_IDS.some((id) => member.roles.cache.has(id));
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

function staffControlsRow(ownerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`codex_ticket_claim:${ownerId}`)
      .setLabel("استلام التذكرة")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📝"),
    new ButtonBuilder()
      .setCustomId(`codex_ticket_add:${ownerId}`)
      .setLabel("إضافة شخص")
      .setStyle(ButtonStyle.Success)
      .setEmoji("➕"),
    new ButtonBuilder()
      .setCustomId(`codex_ticket_remove:${ownerId}`)
      .setLabel("إزالة شخص")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("➖"),
    new ButtonBuilder()
      .setCustomId(`codex_ticket_alert:${ownerId}`)
      .setLabel("تنبيه العميل")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("📢"),
    new ButtonBuilder()
      .setCustomId(`codex_ticket_close:${ownerId}`)
      .setLabel("إغلاق التذكرة")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔒"),
  );
}

function ticketEmbed({ opener, type, claimedById }) {
  const manager = claimedById
    ? `<@${claimedById}> (\`${claimedById}\`)`
    : "بانتظار الاستلام";

  return new EmbedBuilder()
    .setColor(type.color)
    .setAuthor({
      name: opener.tag || opener.username,
      iconURL: opener.displayAvatarURL?.({ size: 64 }) || undefined,
    })
    .addFields(
      {
        name: "فئة التذكرة",
        value: type.categoryLabel || type.label,
        inline: true,
      },
      {
        name: "مسؤول التذكرة",
        value: manager,
        inline: true,
      },
    )
    .setFooter({ text: "codeX Store" })
    .setTimestamp();
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
        "• **استفسار**",
        "• **استلام طلب**",
        "• **مشكلة**",
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

function ticketOverwrites(guild, openerId, botId) {
  return [
    {
      id: guild.roles.everyone.id,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: openerId,
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
      id: botId,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.MentionEveryone,
      ],
    },
    ...STAFF_ROLE_IDS.map((id) => ({
      id,
      type: OverwriteType.Role,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
      ],
    })),
  ];
}

export async function openTicket(interaction, typeKey) {
  const type = TICKET_TYPES[typeKey];
  if (!type) {
    await interaction.reply({ content: "خيار غير معروف.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  await guild.channels.fetch();
  await guild.roles.fetch();

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
  const me = await guild.members.fetchMe();

  const short =
    interaction.user.username
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff]/gi, "")
      .slice(0, 12) || "user";
  const name = `${type.prefix}-${short}`.slice(0, 90);

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: cat.id,
    topic: buildTopic({
      type: type.value,
      owner: interaction.user.id,
      claimed: null,
      ai: "on",
    }),
    permissionOverwrites: ticketOverwrites(guild, interaction.user.id, me.id),
    reason: `codeX ticket: ${type.label}`,
  });

  const staffMentions = STAFF_ROLE_IDS.map((id) => `<@&${id}>`).join(" ");

  await channel.send({
    content: `${staffMentions}`,
    embeds: [
      ticketEmbed({
        opener: interaction.user,
        type,
        claimedById: null,
      }),
    ],
    components: [staffControlsRow(interaction.user.id)],
    allowedMentions: { roles: STAFF_ROLE_IDS },
  });

  await channel.send({
    content: [
      `<@${interaction.user.id}> اكتب تفاصيل طلبك هنا.`,
      "المساعد الذكي بيرد عليك أولاً — وإذا احتجت موظف اضغط **تحويل لدعم بشري**.",
    ].join("\n"),
    allowedMentions: { users: [interaction.user.id] },
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

  const jumpUrl = `https://discord.com/channels/${guild.id}/${channel.id}`;
  const jumpRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("الانتقال للتذكرة")
      .setStyle(ButtonStyle.Link)
      .setURL(jumpUrl)
      .setEmoji("🎫"),
  );

  await interaction.editReply({
    content: [
      `✅ تم فتح تذكرتك`,
      `${channel}`,
      "",
      "اضغط الزر تحت للانتقال مباشرة:",
    ].join("\n"),
    components: [jumpRow],
  });

  try {
    if (interaction.message?.editable) {
      await interaction.message.edit(buildTicketPanelPayload());
    }
  } catch {}
}

async function requireStaff(interaction) {
  if (isStaffMember(interaction.member)) return true;
  await interaction.reply({
    content: "هالزر للطاقم فقط.",
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

async function claimTicket(interaction) {
  if (!(await requireStaff(interaction))) return;
  const channel = interaction.channel;
  const meta = parseTopic(channel.topic || "");
  const type = TICKET_TYPES[meta.type] || TICKET_TYPES.inquiry;

  if (meta.claimed && meta.claimed !== interaction.user.id) {
    await interaction.reply({
      content: `التذكرة مستلمة مسبقاً من <@${meta.claimed}>`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await channel.setTopic(
    buildTopic({
      type: meta.type,
      owner: meta.owner,
      claimed: interaction.user.id,
      ai: "off",
    }),
  );

  await silenceAiOnClaim(channel, {
    ...meta,
    claimed: interaction.user.id,
  });

  const opener = meta.owner
    ? await interaction.client.users.fetch(meta.owner).catch(() => interaction.user)
    : interaction.user;

  await interaction.update({
    embeds: [
      ticketEmbed({
        opener,
        type,
        claimedById: interaction.user.id,
      }),
    ],
    components: [staffControlsRow(meta.owner || "0")],
  });

  await channel.send({
    content: `✅ استلم التذكرة: <@${interaction.user.id}>`,
  });

  await sendTicketLog(
    interaction.client,
    new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📝 استلام تذكرة")
      .setDescription(
        `**الروم:** ${channel}\n**المسؤول:** <@${interaction.user.id}>`,
      )
      .setTimestamp(),
  );
}

async function showUserModal(interaction, mode) {
  if (!(await requireStaff(interaction))) return;
  const modal = new ModalBuilder()
    .setCustomId(`codex_ticket_modal_${mode}`)
    .setTitle(mode === "add" ? "إضافة شخص للتذكرة" : "إزالة شخص من التذكرة");

  const input = new TextInputBuilder()
    .setCustomId("user_id")
    .setLabel("آيدي العضو أو منشن")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("1210972261968912425 أو @user")
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

function extractUserId(raw) {
  const m = String(raw || "").match(/\d{15,20}/);
  return m?.[0] || null;
}

async function handleUserModal(interaction, mode) {
  if (!(await requireStaff(interaction))) return;
  const userId = extractUserId(interaction.fields.getTextInputValue("user_id"));
  if (!userId) {
    await interaction.reply({ content: "آيدي غير صحيح.", flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = interaction.channel;
  const meta = parseTopic(channel.topic || "");

  try {
    if (mode === "add") {
      await channel.permissionOverwrites.edit(userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });
      await interaction.reply({
        content: `تمت إضافة <@${userId}> للتذكرة.`,
      });
      await sendTicketLog(
        interaction.client,
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("➕ إضافة شخص لتذكرة")
          .setDescription(
            `**الروم:** ${channel}\n**أضاف:** <@${interaction.user.id}>\n**العضو:** <@${userId}>`,
          )
          .setTimestamp(),
      );
    } else {
      if (userId === meta.owner) {
        await interaction.reply({
          content: "ما تقدر تشيل صاحب التذكرة.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await channel.permissionOverwrites.delete(userId);
      await interaction.reply({
        content: `تمت إزالة <@${userId}> من التذكرة.`,
      });
      await sendTicketLog(
        interaction.client,
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("➖ إزالة شخص من تذكرة")
          .setDescription(
            `**الروم:** ${channel}\n**أزال:** <@${interaction.user.id}>\n**العضو:** <@${userId}>`,
          )
          .setTimestamp(),
      );
    }
  } catch (e) {
    await interaction.reply({
      content: `فشل التعديل: ${e.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function alertCustomer(interaction) {
  if (!(await requireStaff(interaction))) return;
  const meta = parseTopic(interaction.channel.topic || "");
  if (!meta.owner) {
    await interaction.reply({ content: "ما لقيت صاحب التذكرة.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    content: `📢 <@${meta.owner}> يرجى الرد على التذكرة — فريق الدعم بانتظارك.`,
    allowedMentions: { users: [meta.owner] },
  });
}

export async function closeTicketByChannel({
  channel,
  client,
  closedBy,
  notifyChannel = true,
}) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;

  const meta = parseTopic(channel.topic || "");

  if (notifyChannel) {
    await channel
      .send({ content: "جاري حفظ الأرشيف وإغلاق التذكرة…" })
      .catch(() => {});
  }

  let transcriptFile = null;
  try {
    const lines = [
      "========================================",
      "         codeX — أرشيف تذكرة",
      "========================================",
      `الروم: #${channel.name}`,
      `آيدي الروم: ${channel.id}`,
      `النوع: ${meta.type || "—"}`,
      `صاحب التذكرة: ${meta.owner || "—"}`,
      `المسؤول: ${meta.claimed || "—"}`,
      `أُغلقت بواسطة: ${closedBy?.tag || closedBy?.username || "unknown"} (${closedBy?.id || "?"})`,
      `التاريخ: ${new Date().toISOString()}`,
      "========================================",
      "",
    ];

    const collected = [];
    let lastId;
    for (let i = 0; i < 20; i++) {
      const batch = await channel.messages.fetch({
        limit: 100,
        ...(lastId ? { before: lastId } : {}),
      });
      if (!batch.size) break;
      collected.push(...batch.values());
      lastId = batch.last().id;
      if (batch.size < 100) break;
    }
    collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const m of collected) {
      const time = new Date(m.createdTimestamp).toLocaleString("en-GB", {
        timeZone: "Asia/Riyadh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const author = `${m.author?.tag || "unknown"} (${m.author?.id || "?"})`;
      const content = m.content || "";
      const embeds =
        m.embeds?.length
          ? m.embeds
              .map((e, idx) => {
                const parts = [
                  e.title ? `عنوان: ${e.title}` : null,
                  e.description ? `وصف: ${e.description}` : null,
                  ...(e.fields || []).map((f) => `${f.name}: ${f.value}`),
                ].filter(Boolean);
                return parts.length
                  ? `[embed ${idx + 1}]\n${parts.join("\n")}`
                  : null;
              })
              .filter(Boolean)
              .join("\n")
          : "";
      const files = m.attachments?.size
        ? [...m.attachments.values()]
            .map((a) => `[مرفق] ${a.name} → ${a.url}`)
            .join("\n")
        : "";

      lines.push(`----- ${time} -----`);
      lines.push(author);
      if (content) lines.push(content);
      if (embeds) lines.push(embeds);
      if (files) lines.push(files);
      lines.push("");
    }

    // UTF-8 BOM so Windows Notepad / Discord download opens Arabic correctly
    const body = lines.join("\r\n");
    const buf = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(body, "utf8"),
    ]);
    const safeName = channel.name
      .replace(/[^\w-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 40) || "ticket";
    transcriptFile = new AttachmentBuilder(buf, {
      name: `codex-ticket-${safeName}-${Date.now()}.txt`,
    });
  } catch (e) {
    console.warn("transcript failed", e.message);
  }

  await sendTicketLog(
    client,
    new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("🔒 إغلاق تذكرة + أرشيف")
      .setDescription(
        [
          `**الروم:** \`${channel.name}\``,
          closedBy?.id ? `**أغلقها:** <@${closedBy.id}>` : null,
          meta.owner ? `**صاحب التذكرة:** <@${meta.owner}>` : null,
          meta.claimed ? `**المسؤول:** <@${meta.claimed}>` : null,
          transcriptFile ? "**الأرشيف:** مرفق تحت ⬇️" : "**الأرشيف:** فشل الحفظ",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .setTimestamp(),
  );

  if (transcriptFile) {
    try {
      const logCh = await client.channels.fetch(LOG_CHANNELS.tickets);
      if (logCh?.isTextBased?.()) {
        await logCh.send({
          content: `📄 أرشيف تذكرة \`${channel.name}\``,
          files: [transcriptFile],
        });
      }
    } catch (e) {
      console.warn("transcript send failed", e.message);
    }
  }

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

  return true;
}

export async function closeTicket(interaction) {
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const meta = parseTopic(channel.topic || "");
  const isOwner = meta.owner && interaction.user.id === meta.owner;
  const staff = isStaffMember(interaction.member);

  if (!isOwner && !staff) {
    await interaction.reply({
      content: "ما تقدر تغلق هالتذكرة.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({ content: "جاري حفظ الأرشيف وإغلاق التذكرة…" });

  await closeTicketByChannel({
    channel,
    client: interaction.client,
    closedBy: interaction.user,
    notifyChannel: false,
  });
}

export function attachTickets(client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "codex_ticket_open"
      ) {
        await openTicket(interaction, interaction.values[0]);
        return;
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === "codex_ticket_modal_add") {
          await handleUserModal(interaction, "add");
          return;
        }
        if (interaction.customId === "codex_ticket_modal_remove") {
          await handleUserModal(interaction, "remove");
          return;
        }
      }

      if (!interaction.isButton()) return;
      const id = interaction.customId;

      if (id.startsWith("codex_ticket_claim:")) {
        await claimTicket(interaction);
        return;
      }
      if (id.startsWith("codex_ticket_ai_human:")) {
        await handleAiHumanButton(interaction);
        return;
      }
      if (id.startsWith("codex_ticket_add:")) {
        await showUserModal(interaction, "add");
        return;
      }
      if (id.startsWith("codex_ticket_remove:")) {
        await showUserModal(interaction, "remove");
        return;
      }
      if (id.startsWith("codex_ticket_alert:")) {
        await alertCustomer(interaction);
        return;
      }
      if (id.startsWith("codex_ticket_close:")) {
        await closeTicket(interaction);
      }
    } catch (e) {
      console.warn("ticket interaction error", e.message);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: "صار خطأ، حاول مرة ثانية.",
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: "صار خطأ، حاول مرة ثانية.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch {}
    }
  });

  console.log("codeX Tickets attached");
}

export async function postTicketPanel(client) {
  const ch = await client.channels.fetch(TICKET_CHANNEL_ID);
  if (!ch?.isTextBased?.()) throw new Error("ticket channel missing");

  try {
    const msgs = await ch.messages.fetch({ limit: 15 });
    for (const m of msgs.values()) {
      if (m.author.id === client.user.id) await m.delete().catch(() => {});
    }
  } catch {}

  await ch.send(buildTicketPanelPayload());
  return ch.id;
}
