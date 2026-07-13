/**
 * Full server logs (CodeX-log style) for the live Railway bot.
 * Creates missing rooms and posts rich embeds + staff action menus.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  AuditLogEvent,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { MESSAGE_LOG_IGNORE_CHANNELS } from "./guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const STORE_PATH = path.join(ROOT, "discord", "log-rooms.json");

export const LOG_TYPES = {
  messages: "🗑️┝┃حذف・رسائل",
  allmessages: "💬┝┃كل・الرسائل",
  members: "📷┝┃دخول・خروج",
  roles: "🎭┝┃سجل・الرتب",
  channels: "📂┝┃سجل・الرومات",
  voice: "🔊┝┃سجل・الصوت",
  moderation: "⚖️┝┃سجل・العقوبات",
  automod: "🤖┝┃الأوتو・مود",
  webhooks: "🪝┝┃الويب・هوك",
  admin: "👑┝┃سجل・الأدمنية",
  streaming: "📺┝┃البث・المباشر",
  invites: "🔗┝┃الدعوات",
  nicknames: "✏️┝┃الألقاب",
};

/** كلمات مفتاحية لربط الرومات حتى لو الاسم تغيّر شوي */
const LOG_NAME_HINTS = {
  messages: [/حذف/, /رسائل/],
  allmessages: [/كل.*رسال/, /الرسائل/],
  members: [/دخول/, /خروج/],
  roles: [/الرتب/, /رتب/],
  channels: [/الرومات/, /رومات/],
  voice: [/الصوت/, /صوت/],
  moderation: [/العقوبات/, /عقوب/],
  automod: [/أوتو|اوتو/, /مود/],
  webhooks: [/ويب/, /هوك/],
  admin: [/أدمن|ادمن/],
  streaming: [/البث/, /مباشر/],
  invites: [/دعوات/],
  nicknames: [/ألقاب|القاب/],
};

/** لوقات حساسة — OWNER فقط */
export const SENSITIVE_CODEX_LOG_TYPES = new Set([
  "admin",
  "webhooks",
  "moderation",
  "roles",
  "invites",
  "automod",
]);

const COLORS = {
  blue: 0x3498db,
  green: 0x2ecc71,
  red: 0xe74c3c,
  gold: 0xf1c40f,
  orange: 0xe67e22,
  purple: 0x9b59b6,
  danger: 0xff0000,
  teal: 0x2dd4bf,
};

const TIMEOUT_MS = {
  "5m": 3e5,
  "10m": 6e5,
  "30m": 18e5,
  "1h": 36e5,
  "6h": 216e5,
  "12h": 432e5,
  "1d": 864e5,
  "7d": 6048e5,
};

const t = (d = new Date()) => `<t:${Math.floor(d.getTime() / 1000)}:R>`;

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { guilds: {} };
  }
}

function saveStore(data) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function guildCfg(guildId) {
  const data = loadStore();
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = { channels: {}, categoryId: null, modRoleId: null };
    saveStore(data);
  }
  return { data, g: data.guilds[guildId] };
}

function actionMenu(userId) {
  if (!userId) return [];
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`clog_action_${userId}`)
        .setPlaceholder("⚡ اختر إجراء")
        .addOptions([
          { label: "حظر", value: `ban_${userId}`, emoji: "🔨" },
          { label: "طرد", value: `kick_${userId}`, emoji: "👢" },
          { label: "تايم آوت", value: `timeout_${userId}`, emoji: "⏱️" },
          { label: "سحب الرتب", value: `strip_${userId}`, emoji: "🎭" },
        ]),
    ),
  ];
}

function timeoutMenu(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`clog_time_${userId}`)
        .setPlaceholder("⏱️ المدة")
        .addOptions([
          ...Object.keys(TIMEOUT_MS).map((k) => ({
            label: k,
            value: `${k}_${userId}`,
            emoji: "⏱️",
          })),
          { label: "رجوع", value: `back_${userId}`, emoji: "↩️" },
        ]),
    ),
  ];
}

function disabledMenu(action) {
  const texts = {
    ban: "✅ تم الحظر",
    kick: "✅ تم الطرد",
    timeout: "✅ تم الكتم",
    strip: "✅ تم السحب",
  };
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("clog_done")
        .setPlaceholder(texts[action] || "✅ تم")
        .setDisabled(true)
        .addOptions([{ label: "تم", value: "x", emoji: "✅" }]),
    ),
  ];
}

function normalizeLogName(name) {
  return String(name || "")
    .replace(/[・•‧∙⋅·|│┃┝]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findExistingLogChannel(guild, type, preferredParentId = null) {
  const expected = LOG_TYPES[type];
  if (!expected) return null;
  const texts = [...guild.channels.cache.values()].filter(
    (c) => c.type === ChannelType.GuildText,
  );

  const exact = texts.find((c) => c.name === expected);
  if (exact) return exact;

  const expectedNorm = normalizeLogName(expected);
  const byNorm = texts.find((c) => normalizeLogName(c.name) === expectedNorm);
  if (byNorm) return byNorm;

  const hints = LOG_NAME_HINTS[type] || [];
  if (!hints.length) return null;

  const scored = texts
    .map((c) => {
      const n = c.name;
      const hit = hints.every((re) => re.test(n));
      if (!hit) return null;
      const parentBonus =
        preferredParentId && c.parentId === preferredParentId ? 2 : 0;
      const codexBonus = /سجل|codeX|سجلات/i.test(c.parent?.name || "")
        ? 1
        : 0;
      return { c, score: parentBonus + codexBonus };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.c || null;
}

/**
 * يربط رومات اللوقات الموجودة بالـ IDs (بدون إنشاء رومات جديدة).
 * يحل مشكلة اختفاء log-rooms.json على Railway.
 */
export async function syncLogRooms(guild) {
  const { data, g } = guildCfg(guild.id);
  await guild.channels.fetch().catch(() => null);

  let category =
    (g.categoryId && guild.channels.cache.get(g.categoryId)) ||
    [...guild.channels.cache.values()].find(
      (c) =>
        c.type === ChannelType.GuildCategory &&
        /سجلات|LOGS|logs/i.test(c.name),
    ) ||
    null;
  if (category) g.categoryId = category.id;

  let changed = 0;
  const mapped = [];
  for (const type of Object.keys(LOG_TYPES)) {
    const byId = g.channels?.[type]
      ? guild.channels.cache.get(g.channels[type])
      : null;
    if (byId) {
      mapped.push(`${type}->${byId.name}`);
      continue;
    }
    const found = findExistingLogChannel(guild, type, category?.id || null);
    if (found) {
      g.channels[type] = found.id;
      changed += 1;
      mapped.push(`${type}->${found.name}`);
    } else {
      mapped.push(`${type}->MISSING`);
    }
  }
  if (changed) saveStore(data);
  return { changed, mapped, categoryId: g.categoryId || null };
}

async function getCh(client, guildId, type) {
  const { data, g } = guildCfg(guildId);
  const id = g.channels?.[type];
  if (id) {
    const ch =
      client.channels.cache.get(id) ||
      (await client.channels.fetch(id).catch(() => null));
    if (ch) return ch;
  }

  const guild =
    client.guilds.cache.get(guildId) ||
    (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return null;

  const found = findExistingLogChannel(guild, type, g.categoryId || null);
  if (!found) return null;
  g.channels[type] = found.id;
  saveStore(data);
  return found;
}

/** للـ Guard وغيره: جلب روم لوق CodeX بالاسم/الـ ID */
export async function getCodexLogChannel(client, guildId, type) {
  return getCh(client, guildId, type);
}

async function send(ch, payload) {
  if (!ch?.send) return;
  try {
    await ch.send(payload);
  } catch (e) {
    console.warn("[codex-logs]", e.message);
  }
}

async function audit(guild, type, targetId, windowMs = 10000) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 1 });
    const entry = logs.entries.first();
    if (!entry || Date.now() - entry.createdTimestamp > windowMs) return null;
    if (targetId && entry.target?.id && entry.target.id !== targetId)
      return null;
    return entry;
  } catch {
    return null;
  }
}

export async function setupLogRooms(guild, client, modRoleId = null) {
  const { data, g } = guildCfg(guild.id);
  const me = client.user.id;
  const ownerId = process.env.DISCORD_OWNER_ID || "1210972261968912425";
  const ownerRole =
    process.env.DISCORD_STAFF_ROLE_OWNER || "1524961206144860333";
  const teamRole =
    process.env.DISCORD_STAFF_ROLE_TEAM || "1524961198360236084";

  const baseDenyEveryone = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: me,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
    {
      id: ownerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageMessages,
      ],
    },
    {
      id: ownerRole,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
      ],
      deny: [PermissionFlagsBits.SendMessages],
    },
  ];

  function overwritesFor(type) {
    const list = [...baseDenyEveryone];
    if (!SENSITIVE_CODEX_LOG_TYPES.has(type)) {
      const mod = modRoleId || g.modRoleId || teamRole;
      list.push({
        id: mod,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
        deny: [PermissionFlagsBits.SendMessages],
      });
    } else {
      list.push({
        id: teamRole,
        deny: [PermissionFlagsBits.ViewChannel],
      });
    }
    return list;
  }

  let category = g.categoryId
    ? guild.channels.cache.get(g.categoryId)
    : null;
  if (!category) {
    category = await guild.channels.create({
      name: "📋┝┃سجلات・codeX",
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwritesFor("messages"),
      reason: "codeX full logs",
    });
    g.categoryId = category.id;
  }

  const created = [];
  for (const [type, name] of Object.entries(LOG_TYPES)) {
    const existing = g.channels?.[type]
      ? guild.channels.cache.get(g.channels[type])
      : null;
    const found =
      existing || findExistingLogChannel(guild, type, category?.id || null);
    if (found) {
      g.channels[type] = found.id;
      try {
        await found.permissionOverwrites.set(overwritesFor(type));
      } catch {}
      created.push(`✅ ${found}`);
      continue;
    }
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: overwritesFor(type),
      reason: "codeX log room",
    });
    g.channels[type] = channel.id;
    created.push(`🆕 ${channel}`);
    await new Promise((r) => setTimeout(r, 450));
  }
  saveStore(data);
  return created;
}

function canAct(member, g, ownerId) {
  if (!member) return false;
  if (member.id === ownerId || member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (g.modRoleId && member.roles.cache.has(g.modRoleId)) return true;
  return false;
}

export function attachCodexLogs(client, { guildId, ownerId }) {
  process.env.DISABLE_GUARD_LOGS = "1";

  client.on("messageCreate", async (msg) => {
    if (!msg.guild || msg.author.bot || msg.guild.id !== guildId) return;
    if (MESSAGE_LOG_IGNORE_CHANNELS.has(msg.channelId)) return;
    const ch = await getCh(client, msg.guild.id, "allmessages");
    if (!ch) return;
    const when = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Riyadh",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const e = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(`💬 رسالة جديدة في #${msg.channel?.name || "روم"} !`)
      .setDescription(
        [
          "**صاحب الرسالة**",
          `الشخص: <@${msg.author.id}>`,
          `اسم الشخص: \`${msg.author.username}\``,
          `مُعرّف الشخص: \`${msg.author.id}\``,
          "",
          "**معلومات الرسالة**",
          `\`${(msg.content || "—").slice(0, 900)}\``,
          "",
          "**الروم**",
          `الروم: <#${msg.channelId}>`,
          "",
          "**التوقيت**",
          `\`${when}\``,
        ].join("\n"),
      )
      .setFooter({ text: "𝐂𝐨𝐝𝐞𝐗 · Messages" })
      .setTimestamp();
    await send(ch, { embeds: [e] });
  });

  // حذف/تعديل الرسائل + الرتب + الألقاب + الرومات + الدخول/الخروج + الحظر
  // تُدار بستايل Nova التفصيلي من guard.mjs → رومات CodeX

  client.on("guildMemberUpdate", async (oldM, newM) => {
    if (newM.guild.id !== guildId) return;
    if (
      oldM.communicationDisabledUntil !== newM.communicationDisabledUntil &&
      newM.communicationDisabledUntil
    ) {
      const ch = await getCh(client, newM.guild.id, "moderation");
      if (ch) {
        const entry = await audit(
          newM.guild,
          AuditLogEvent.MemberUpdate,
          newM.id,
        );
        const mins = Math.round(
          (newM.communicationDisabledUntil - Date.now()) / 60000,
        );
        const when = new Date().toLocaleString("en-US", {
          timeZone: "Asia/Riyadh",
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        await send(ch, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle("⏱️ تم إعطاء تايم آوت لعضو في 𝐂𝐨𝐝𝐞𝐗 .")
              .setDescription(
                [
                  "**معلومات العضو**",
                  `العضو: <@${newM.id}>`,
                  `اسم العضو: \`${newM.id}\``,
                  "",
                  "**المدة**",
                  `\`${mins} دقيقة\``,
                  "",
                  "**تم بواسطة**",
                  `الادمن: ${entry?.executor ? `<@${entry.executor.id}>` : "غير معروف"}`,
                  `مُعرّف الادمن: ${entry?.executor ? `\`${entry.executor.id}\`` : "—"}`,
                  "",
                  "**السبب**",
                  entry?.reason || "لم يتم تقديم سبب",
                  "",
                  "**وقت التحديث**",
                  `\`${when}\``,
                ].join("\n"),
              )
              .setFooter({ text: "𝐂𝐨𝐝𝐞𝐗 · Moderation" })
              .setTimestamp(),
          ],
        });
      }
    }
  });

  client.on("webhooksUpdate", async (channel) => {
    if (!channel.guild || channel.guild.id !== guildId) return;
    const ch = await getCh(client, channel.guild.id, "webhooks");
    if (!ch) return;
    try {
      const logs = await channel.guild.fetchAuditLogs({ limit: 5 });
      const entry = [...logs.entries.values()].find(
        (e) =>
          [AuditLogEvent.WebhookCreate, AuditLogEvent.WebhookDelete].includes(
            e.action,
          ) && Date.now() - e.createdTimestamp < 10000,
      );
      if (!entry) return;
      const isNew = entry.action === AuditLogEvent.WebhookCreate;
      await send(ch, {
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: isNew ? "⚠️ ويب هوك جديد" : "🗑️ ويب هوك محذوف",
            })
            .setColor(isNew ? COLORS.danger : COLORS.red)
            .addFields(
              { name: "الروم", value: `${channel}`, inline: true },
              { name: "بواسطة", value: `${entry.executor}`, inline: true },
            )
            .setTimestamp(),
        ],
        components: isNew ? actionMenu(entry.executor.id) : [],
      });
    } catch {
      /* ignore */
    }
  });

  client.on("autoModerationActionExecution", async (exec) => {
    if (exec.guildId !== guildId) return;
    const ch = await getCh(client, exec.guildId, "automod");
    if (!ch) return;
    await send(ch, {
      embeds: [
        new EmbedBuilder()
          .setAuthor({ name: "🤖 أوتو مود" })
          .setColor(COLORS.gold)
          .addFields(
            { name: "👤", value: `\`${exec.userId}\``, inline: true },
            { name: "المحتوى", value: (exec.content || "—").slice(0, 500) },
          )
          .setTimestamp(),
      ],
      components: actionMenu(exec.userId),
    });
  });

  client.on("voiceStateUpdate", async (oldS, newS) => {
    if (newS.guild.id !== guildId || !newS.member) return;
    const ch = await getCh(client, newS.guild.id, "voice");
    if (!ch) return;
    let title = null;
    let fields = [{ name: "👤", value: `${newS.member}`, inline: true }];
    if (!oldS.channel && newS.channel) {
      title = "🔊 دخل صوت";
      fields.push({ name: "الروم", value: `${newS.channel}`, inline: true });
    } else if (oldS.channel && !newS.channel) {
      title = "🔇 طلع من الصوت";
      fields.push({ name: "الروم", value: `${oldS.channel}`, inline: true });
    } else if (oldS.channelId && newS.channelId && oldS.channelId !== newS.channelId) {
      title = "🔀 تنقل صوتي";
      fields.push(
        { name: "من", value: `${oldS.channel}`, inline: true },
        { name: "إلى", value: `${newS.channel}`, inline: true },
      );
    }
    if (!title) return;
    await send(ch, {
      embeds: [
        new EmbedBuilder()
          .setAuthor({ name: title })
          .setColor(COLORS.blue)
          .addFields(fields)
          .setTimestamp(),
      ],
    });
  });

  client.on("presenceUpdate", async (oldP, newP) => {
    if (!newP?.guild || newP.guild.id !== guildId || !newP.member) return;
    const streaming = newP.activities.find((a) => a.type === 1);
    const was = oldP?.activities?.find((a) => a.type === 1);
    if (streaming && !was) {
      const ch = await getCh(client, newP.guild.id, "streaming");
      if (ch) {
        const isAdmin = newP.member.permissions.has(
          PermissionFlagsBits.Administrator,
        );
        await send(ch, {
          embeds: [
            new EmbedBuilder()
              .setAuthor({ name: "📺 بدأ بث" })
              .setColor(COLORS.purple)
              .addFields(
                { name: "👤", value: `${newP.member}`, inline: true },
                {
                  name: "العرض",
                  value: streaming.name || streaming.details || "بث",
                  inline: true,
                },
              )
              .setTimestamp(),
          ],
          components: isAdmin ? actionMenu(newP.member.id) : [],
        });
      }
    }
    if (newP.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const oldStatus = oldP?.status || "offline";
      if (oldStatus !== newP.status) {
        const ch = await getCh(client, newP.guild.id, "admin");
        if (ch) {
          await send(ch, {
            embeds: [
              new EmbedBuilder()
                .setAuthor({ name: "👑 حالة أدمن" })
                .setColor(COLORS.teal)
                .addFields(
                  { name: "👤", value: `${newP.member}`, inline: true },
                  { name: "من", value: `\`${oldStatus}\``, inline: true },
                  { name: "إلى", value: `\`${newP.status}\``, inline: true },
                )
                .setTimestamp(),
            ],
          });
        }
      }
    }
  });

  client.on("inviteCreate", async (invite) => {
    if (!invite.guild || invite.guild.id !== guildId) return;
    const ch = await getCh(client, invite.guild.id, "invites");
    if (!ch) return;
    await send(ch, {
      embeds: [
        new EmbedBuilder()
          .setAuthor({ name: "🔗 دعوة جديدة" })
          .setColor(COLORS.green)
          .addFields(
            { name: "الكود", value: `\`${invite.code}\``, inline: true },
            {
              name: "بواسطة",
              value: invite.inviter ? `${invite.inviter}` : "؟",
              inline: true,
            },
          )
          .setTimestamp(),
      ],
    });
  });

  client.on("inviteDelete", async (invite) => {
    if (!invite.guild || invite.guild.id !== guildId) return;
    const ch = await getCh(client, invite.guild.id, "invites");
    if (!ch) return;
    await send(ch, {
      embeds: [
        new EmbedBuilder()
          .setAuthor({ name: "🗑️ دعوة محذوفة" })
          .setColor(COLORS.red)
          .addFields({ name: "الكود", value: `\`${invite.code}\`` })
          .setTimestamp(),
      ],
    });
  });

  // Staff action menus
  client.on("interactionCreate", async (i) => {
    try {
      if (!i.guild || i.guild.id !== guildId) return;
      const { g } = guildCfg(i.guild.id);

      if (i.isChatInputCommand()) {
        if (i.commandName === "setup-logs") {
          await i.deferReply({ ephemeral: true });
          const created = await setupLogRooms(i.guild, client, g.modRoleId);
          await i.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle("✅ رومات اللوقات")
                .setColor(COLORS.green)
                .setDescription(created.join("\n").slice(0, 4000)),
            ],
          });
          return;
        }
        if (i.commandName === "logs-info") {
          const embed = new EmbedBuilder()
            .setTitle("⚙️ رومات اللوقات")
            .setColor(COLORS.blue);
          for (const [type, name] of Object.entries(LOG_TYPES)) {
            const id = g.channels?.[type];
            const ch = id ? i.guild.channels.cache.get(id) : null;
            embed.addFields({
              name,
              value: ch ? `${ch}` : "❌",
              inline: true,
            });
          }
          await i.reply({ embeds: [embed], ephemeral: true });
          return;
        }
        if (i.commandName === "set-staff") {
          const role = i.options.getRole("role");
          const pack = guildCfg(i.guild.id);
          pack.g.modRoleId = role.id;
          saveStore(pack.data);
          await i.reply({
            content: `✅ رتبة الإجراءات: ${role}`,
            ephemeral: true,
          });
          return;
        }
      }

      if (i.isStringSelectMenu()) {
        if (i.customId === "clog_done") return;
        if (i.customId.startsWith("clog_action_")) {
          if (!canAct(i.member, g, ownerId)) {
            return i.reply({ content: "❌ لا صلاحية", ephemeral: true });
          }
          const val = i.values[0];
          const [action] = val.split("_");
          const targetId = val.split("_").pop();
          const target = await i.guild.members.fetch(targetId).catch(() => null);
          if (action === "ban") {
            return i.showModal(
              new ModalBuilder()
                .setCustomId(`clog_ban_${targetId}`)
                .setTitle("حظر")
                .addComponents(
                  new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                      .setCustomId("reason")
                      .setLabel("السبب")
                      .setStyle(TextInputStyle.Paragraph)
                      .setRequired(false),
                  ),
                ),
            );
          }
          if (action === "kick") {
            if (!target)
              return i.reply({ content: "❌ مو موجود", ephemeral: true });
            return i.showModal(
              new ModalBuilder()
                .setCustomId(`clog_kick_${targetId}`)
                .setTitle("طرد")
                .addComponents(
                  new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                      .setCustomId("reason")
                      .setLabel("السبب")
                      .setStyle(TextInputStyle.Paragraph)
                      .setRequired(false),
                  ),
                ),
            );
          }
          if (action === "timeout") {
            return i.update({ components: timeoutMenu(targetId) });
          }
          if (action === "strip") {
            if (!target)
              return i.reply({ content: "❌ مو موجود", ephemeral: true });
            const roles = target.roles.cache.filter(
              (r) => r.name !== "@everyone" && r.editable,
            );
            await target.roles.remove(roles).catch(() => {});
            return i.reply({
              content: `✅ سحب ${roles.size} رتبة`,
              ephemeral: true,
            });
          }
        }
        if (i.customId.startsWith("clog_time_")) {
          if (!canAct(i.member, g, ownerId)) {
            return i.reply({ content: "❌ لا صلاحية", ephemeral: true });
          }
          const val = i.values[0];
          const key = val.split("_")[0];
          const targetId = val.split("_").pop();
          if (key === "back")
            return i.update({ components: actionMenu(targetId) });
          const target = await i.guild.members.fetch(targetId).catch(() => null);
          if (!target)
            return i.reply({ content: "❌ مو موجود", ephemeral: true });
          await target.timeout(
            TIMEOUT_MS[key] || 600000,
            `codeX — ${i.user.tag}`,
          );
          return i.reply({
            content: `✅ تايم آوت ${key}`,
            ephemeral: true,
          });
        }
      }

      if (i.isModalSubmit()) {
        if (!canAct(i.member, g, ownerId)) {
          return i.reply({ content: "❌ لا صلاحية", ephemeral: true });
        }
        if (i.customId.startsWith("clog_ban_")) {
          const targetId = i.customId.replace("clog_ban_", "");
          const reason = i.fields.getTextInputValue("reason") || "بدون";
          await i.guild.members.ban(targetId, {
            reason: `${reason} — ${i.user.tag}`,
          });
          return i.reply({ content: "✅ تم الحظر", ephemeral: true });
        }
        if (i.customId.startsWith("clog_kick_")) {
          const targetId = i.customId.replace("clog_kick_", "");
          const reason = i.fields.getTextInputValue("reason") || "بدون";
          const target = await i.guild.members.fetch(targetId).catch(() => null);
          if (!target)
            return i.reply({ content: "❌ مو موجود", ephemeral: true });
          await target.kick(`${reason} — ${i.user.tag}`);
          return i.reply({ content: "✅ تم الطرد", ephemeral: true });
        }
      }
    } catch (e) {
      console.error("[codex-logs interaction]", e.message);
    }
  });
}

export async function registerLogCommands(client, guildId) {
  const body = [
    new SlashCommandBuilder()
      .setName("setup-logs")
      .setDescription("إنشاء رومات اللوقات الناقصة")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("logs-info")
      .setDescription("عرض رومات اللوقات")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("set-staff")
      .setDescription("رتبة إجراءات اللوقات")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addRoleOption((o) =>
        o.setName("role").setDescription("الرتبة").setRequired(true),
      )
      .toJSON(),
  ];
  const rest = new REST({ version: "10" }).setToken(client.token);
  // Guild commands تظهر فوراً (مو مثل الـ global اللي يتأخر ساعة)
  if (guildId) {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, guildId),
      { body },
    );
  } else {
    await rest.put(Routes.applicationCommands(client.user.id), { body });
  }
}
