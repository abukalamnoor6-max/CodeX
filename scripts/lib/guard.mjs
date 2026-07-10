/**
 * codeX Guard — server protection + structured logs into LOGS channels.
 */
import {
  EmbedBuilder,
  AuditLogEvent,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";

export const LOG_CHANNELS = {
  general: "1524972399240679475", // xx
  tickets: "1524972402205921420", // ticket-logs
  permissions: "1524972405381136405", // Permissions
  ban: "1524972409088905296", // Ban · Unban
  rooms: "1524972412121120950", // Rooms
  chat: "1524972414763667598", // Chat · Delete
  roles: "1524972418576420864", // Roles
  join: "1524972421449519289", // Join
  left: "1524972425815658616", // Left
  important: "1524972428974100631", // مهم
};

const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";

/** Staff / immune roles (fancy unicode names included) */
const STAFF_ROLE_RE =
  /𝐎𝐖𝐍𝐄𝐑|OWNER|𝐓𝐄𝐀𝐌|TEAM|Founder|Admin|Partner|𝐏𝐚𝐫𝐭𝐧𝐞𝐫|𝐁𝐎𝐓|BOT/i;

const inviteRe =
  /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i;
const urlRe = /https?:\/\/[^\s]+/i;

// In-memory trackers
const msgBuckets = new Map(); // userId -> timestamps[]
const joinBuckets = []; // timestamps
const mentionBuckets = new Map();
const warnCount = new Map(); // userId -> count
const punished = new Set(); // cooldown after action

/** Cache recent messages so delete/edit logs keep author + content */
const MSG_CACHE_MAX = 2000;
const msgCache = new Map(); // messageId -> snapshot

function cacheMessage(message) {
  if (!message?.id || !message.guild) return;
  const attachments = [...(message.attachments?.values?.() || [])].map((a) => ({
    name: a.name,
    url: a.url,
    contentType: a.contentType || null,
  }));
  const stickers = [...(message.stickers?.values?.() || [])].map((s) => s.name);
  msgCache.set(message.id, {
    id: message.id,
    channelId: message.channelId,
    guildId: message.guild.id,
    authorId: message.author?.id || null,
    authorTag: message.author?.tag || null,
    bot: Boolean(message.author?.bot),
    content: message.content || "",
    attachments,
    stickers,
    createdTimestamp: message.createdTimestamp || Date.now(),
    url: message.url || null,
  });
  if (msgCache.size > MSG_CACHE_MAX) {
    const first = msgCache.keys().next().value;
    msgCache.delete(first);
  }
}

function formatAttachments(list) {
  if (!list?.length) return null;
  return list
    .map((a) => `• [${a.name || "ملف"}](${a.url})`)
    .join("\n");
}

function describeAction(whoId, what) {
  if (!whoId) return `**الفاعل:** غير معروف\n**الإجراء:** ${what}`;
  return `**الفاعل:** <@${whoId}>\n**الإجراء:** ${what}`;
}

function clip(s, n = 900) {
  const t = String(s || "");
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function isStaff(member) {
  if (!member) return false;
  if (member.id === OWNER_ID) return true;
  if (member.id === member.client.user.id) return true;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some((r) => STAFF_ROLE_RE.test(r.name));
}

function takeBucket(map, key, windowMs) {
  const now = Date.now();
  const arr = (map.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  map.set(key, arr);
  return arr.length;
}

async function sendLog(client, key, embed) {
  const id = LOG_CHANNELS[key];
  if (!id) return;
  try {
    const ch = await client.channels.fetch(id);
    if (!ch?.isTextBased?.()) return;
    await ch.send({ embeds: [embed] });
  } catch (e) {
    console.warn("log fail", key, e.message);
  }
}

function baseEmbed(color, title) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter({ text: "codeX · Guard" })
    .setTimestamp();
}

async function getExecutor(guild, typeOrTypes, targetId, { windowMs = 30_000 } = {}) {
  const types = Array.isArray(typeOrTypes) ? typeOrTypes : [typeOrTypes];
  const typeSet = new Set(types.map((t) => Number(t)));

  const pick = (entries, { requireTarget = true } = {}) => {
    for (const e of entries) {
      if (Date.now() - e.createdTimestamp >= windowMs) continue;
      if (typeSet.size && !typeSet.has(Number(e.action))) continue;
      if (requireTarget && targetId) {
        const hit =
          e.target?.id === targetId ||
          e.extra?.channel?.id === targetId ||
          e.extra?.id === targetId;
        if (!hit) continue;
      }
      if (!e.executor) continue;
      return {
        executor: e.executor,
        reason: e.reason || null,
        entry: e,
        type: e.action,
      };
    }
    return null;
  };

  try {
    // 1) Typed fetches (precise)
    for (const type of types) {
      const logs = await guild.fetchAuditLogs({ type, limit: 15 });
      const hit = pick([...logs.entries.values()], { requireTarget: true });
      if (hit) return hit;
    }

    // 2) Untyped recent log — more reliable for overwrite events
    const mixed = await guild.fetchAuditLogs({ limit: 25 });
    const mixedEntries = [...mixed.entries.values()];
    const hitTarget = pick(mixedEntries, { requireTarget: true });
    if (hitTarget) return hitTarget;

    // 3) Same types, ignore target (timing / odd payloads)
    for (const type of types) {
      const logs = await guild.fetchAuditLogs({ type, limit: 5 });
      const hit = pick([...logs.entries.values()], { requireTarget: false });
      if (hit) return hit;
    }

    const hitAny = pick(mixedEntries, { requireTarget: false });
    if (hitAny) return hitAny;

    return null;
  } catch (e) {
    console.warn("audit fetch failed", e.message);
    return null;
  }
}

/** Diff channel overwrites → human summary */
function diffOverwrites(oldCh, newCh) {
  const oldMap = oldCh.permissionOverwrites?.cache;
  const newMap = newCh.permissionOverwrites?.cache;
  if (!oldMap || !newMap) return [];
  const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
  const changes = [];
  for (const id of ids) {
    const o = oldMap.get(id);
    const n = newMap.get(id);
    const oAllow = o ? String(o.allow.bitfield) : null;
    const oDeny = o ? String(o.deny.bitfield) : null;
    const nAllow = n ? String(n.allow.bitfield) : null;
    const nDeny = n ? String(n.deny.bitfield) : null;
    if (!o && n) {
      changes.push({
        id,
        kind: "أضاف صلاحيات",
        type: Number(n.type),
      });
    } else if (o && !n) {
      changes.push({ id, kind: "حذف صلاحيات", type: Number(o.type) });
    } else if (o && n && (oAllow !== nAllow || oDeny !== nDeny)) {
      changes.push({
        id,
        kind: "عدّل صلاحيات",
        type: Number(n.type),
      });
    }
  }
  return changes;
}

async function punish(member, reason, { timeoutMs = 10 * 60_000, deleteMsg } = {}) {
  if (!member || isStaff(member) || punished.has(member.id)) return false;
  punished.add(member.id);
  setTimeout(() => punished.delete(member.id), 8_000);

  try {
    if (deleteMsg?.deletable) await deleteMsg.delete().catch(() => {});
  } catch {}

  const count = (warnCount.get(member.id) || 0) + 1;
  warnCount.set(member.id, count);

  try {
    if (count >= 4) {
      await member.ban({ reason: `codeX Guard: ${reason} (x${count})`, deleteMessageSeconds: 0 });
    } else if (count >= 3) {
      await member.kick(`codeX Guard: ${reason} (x${count})`);
    } else {
      await member.timeout(timeoutMs, `codeX Guard: ${reason}`);
    }
  } catch (e) {
    console.warn("punish fail", e.message);
    return false;
  }

  await sendLog(
    member.client,
    "important",
    baseEmbed(0xed4245, "🛡️ إجراء حماية")
      .setDescription(
        [
          `**العضو:** <@${member.id}> (\`${member.user.tag}\`)`,
          `**السبب:** ${reason}`,
          `**المخالفات:** ${count}/4`,
          `**الإجراء:** ${count >= 4 ? "Ban" : count >= 3 ? "Kick" : "Timeout"}`,
        ].join("\n"),
      ),
  );
  return true;
}

const inviteCache = new Map(); // guildId -> Map<code, {uses, inviterId, inviterTag}>

function formatLogTime(date = new Date()) {
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    for (const inv of invites.values()) {
      map.set(inv.code, {
        uses: inv.uses ?? 0,
        inviterId: inv.inviter?.id || null,
        inviterTag: inv.inviter?.username || "—",
      });
    }
    inviteCache.set(guild.id, map);
  } catch (e) {
    console.warn("invite cache failed", e.message);
  }
}

async function resolveJoinInvite(guild) {
  const prev = inviteCache.get(guild.id) || new Map();
  let used = null;
  try {
    const invites = await guild.invites.fetch();
    const next = new Map();
    for (const inv of invites.values()) {
      const uses = inv.uses ?? 0;
      const row = {
        uses,
        inviterId: inv.inviter?.id || null,
        inviterTag: inv.inviter?.username || "—",
      };
      next.set(inv.code, row);
      const before = prev.get(inv.code)?.uses ?? 0;
      if (uses > before) {
        used = {
          code: inv.code,
          inviterId: row.inviterId,
          inviterTag: row.inviterTag,
        };
      }
    }
    // invite deleted after use (vanity / one-time) — detect missing codes with uses
    if (!used) {
      for (const [code, row] of prev.entries()) {
        if (!next.has(code)) {
          used = {
            code,
            inviterId: row.inviterId,
            inviterTag: row.inviterTag,
          };
          break;
        }
      }
    }
    inviteCache.set(guild.id, next);
  } catch (e) {
    console.warn("resolve invite failed", e.message);
  }
  return used;
}

export function attachGuard(client) {
  client.once("clientReady", async () => {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) await cacheGuildInvites(guild);
  });

  client.on("inviteCreate", async (invite) => {
    if (invite.guild?.id !== GUILD_ID) return;
    await cacheGuildInvites(invite.guild);
  });

  client.on("inviteDelete", async (invite) => {
    if (invite.guild?.id !== GUILD_ID) return;
    const map = inviteCache.get(GUILD_ID);
    if (map) map.delete(invite.code);
  });

  // —— JOIN ——
  client.on("guildMemberAdd", async (member) => {
    if (member.guild.id !== GUILD_ID) return;
    const ageDays =
      (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    const now = Date.now();
    joinBuckets.push(now);
    while (joinBuckets.length && now - joinBuckets[0] > 20_000) joinBuckets.shift();

    const usedInvite = await resolveJoinInvite(member.guild);
    const username = member.user.username || member.user.tag || "—";

    await sendLog(
      client,
      "join",
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`🎉 عضو جديد \`${username}\` انضم إلى السيرفر!`)
        .setDescription(
          [
            "**معلومات العضو**",
            `العضو: <@${member.id}>`,
            `اسم المستخدم: \`${username}\``,
            "",
            "**تمت الدعوة بواسطة**",
            usedInvite?.inviterId
              ? `المستخدم: <@${usedInvite.inviterId}>`
              : "المستخدم: غير معروف",
            `اسم المستخدم: \`${usedInvite?.inviterTag || "—"}\``,
            "",
            "**الوقت**",
            `\`${formatLogTime()}\``,
          ].join("\n"),
        )
        .setFooter({ text: "codeX · Join" })
        .setTimestamp(),
    );

    // Anti-raid: many joins in short window
    if (joinBuckets.length >= 8) {
      await sendLog(
        client,
        "important",
        baseEmbed(0xed4245, "🚨 تنبيه رييد محتمل").setDescription(
          `دخل **${joinBuckets.length}** عضو خلال 20 ثانية.\nفعّل التحقق / راقب السيرفر.`,
        ),
      );
    }

    // New account quarantine (timeout short + alert)
    if (ageDays < 2 && !member.user.bot) {
      try {
        await member.timeout(
          30 * 60_000,
          "codeX Guard: حساب جديد أقل من يومين",
        );
      } catch {}
      await sendLog(
        client,
        "important",
        baseEmbed(0xf0b232, "⚠️ حساب جديد جداً")
          .setDescription(
            `<@${member.id}> عمر حسابه **${ageDays.toFixed(1)}** يوم — تم Timeout 30 دقيقة.`,
          ),
      );
    }

    // Unauthorized bot join
    if (member.user.bot && member.id !== client.user.id) {
      await sendLog(
        client,
        "important",
        baseEmbed(0xed4245, "🤖 بوت دخل السيرفر").setDescription(
          `<@${member.id}> (\`${member.user.tag}\`)\nتأكد إنه مصرّح له.`,
        ),
      );
    }
  });

  // —— LEAVE ——
  client.on("guildMemberRemove", async (member) => {
    if (member.guild.id !== GUILD_ID) return;
    const username = member.user?.username || member.user?.tag || String(member.id);

    await sendLog(
      client,
      "left",
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`💨 عضو \`${username}\` قد غادر السيرفر.`)
        .setDescription(
          [
            "**معلومات العضو**",
            `العضو: <@${member.id}>`,
            `اسم المستخدم: \`${username}\``,
            `معرّف المستخدم: \`${member.id}\``,
            "",
            "**الوقت**",
            `\`${formatLogTime()}\``,
          ].join("\n"),
        )
        .setFooter({ text: "codeX · Left" })
        .setTimestamp(),
    );
  });

  // —— BAN / UNBAN (Nova-style) ——
  client.on("guildBanAdd", async (ban) => {
    if (ban.guild.id !== GUILD_ID) return;
    const audit = await getExecutor(
      ban.guild,
      AuditLogEvent.MemberBanAdd,
      ban.user.id,
    );
    const admin = audit?.executor || null;
    const reason =
      (audit?.reason || ban.reason || "").trim() || "لم يتم تقديم سبب";
    const username = ban.user.username || ban.user.tag || "—";

    await sendLog(
      client,
      "ban",
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`✈️ تم حظره من السيرفر \`${username}\``)
        .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
        .setDescription(
          [
            "**معلومات العضو**",
            `العضو: <@${ban.user.id}>`,
            `اسم العضو: \`${username}\``,
            `مُعرّف العضو: \`( ${ban.user.id} )\``,
            "",
            "**السبب**",
            `\`${clip(reason, 500)}\``,
            "",
            "**الادمن**",
            `الادمن: ${admin ? `<@${admin.id}>` : "غير معروف"}`,
            `مُعرّف الادمن: \`( ${admin?.id || "—"} )\``,
            "",
            "**التوقيت**",
            `\`${formatLogTime()}\``,
          ].join("\n"),
        )
        .setFooter({ text: "codeX · Ban" })
        .setTimestamp(),
    );
  });

  client.on("guildBanRemove", async (ban) => {
    if (ban.guild.id !== GUILD_ID) return;
    const audit = await getExecutor(
      ban.guild,
      AuditLogEvent.MemberBanRemove,
      ban.user.id,
    );
    const admin = audit?.executor || null;
    const username = ban.user.username || ban.user.tag || "—";

    await sendLog(
      client,
      "ban",
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`✅ تم فك الحظر عن \`${username}\``)
        .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
        .setDescription(
          [
            "**معلومات العضو**",
            `العضو: <@${ban.user.id}>`,
            `اسم العضو: \`${username}\``,
            `مُعرّف العضو: \`( ${ban.user.id} )\``,
            "",
            "**الادمن**",
            `الادمن: ${admin ? `<@${admin.id}>` : "غير معروف"}`,
            `مُعرّف الادمن: \`( ${admin?.id || "—"} )\``,
            "",
            "**التوقيت**",
            `\`${formatLogTime()}\``,
          ].join("\n"),
        )
        .setFooter({ text: "codeX · Unban" })
        .setTimestamp(),
    );
  });

  // —— MESSAGE DELETE / UPDATE (accurate cache + actor) ——
  client.on("messageDelete", async (message) => {
    if (!message.guild || message.guild.id !== GUILD_ID) return;

    // Skip logging inside log channels (noise)
    if (Object.values(LOG_CHANNELS).includes(message.channelId)) return;

    const cached = msgCache.get(message.id);
    msgCache.delete(message.id);

    const authorId = message.author?.id || cached?.authorId || null;
    const authorTag = message.author?.tag || cached?.authorTag || null;
    const content = message.content || cached?.content || "";
    const attachments =
      message.attachments?.size
        ? [...message.attachments.values()].map((a) => ({
            name: a.name,
            url: a.url,
          }))
        : cached?.attachments || [];
    const isBot = message.author?.bot ?? cached?.bot ?? false;

    // Don't spam logs with our own bot system messages
    if (isBot && authorId === client.user.id) return;

    await new Promise((r) => setTimeout(r, 450)); // audit log lag
    const audit = await getExecutor(
      message.guild,
      AuditLogEvent.MessageDelete,
      authorId,
    );
    const ex = audit?.executor || null;

    let actorId = null;
    let actionText = "حذف رسالة";
    if (ex) {
      actorId = ex.id;
      if (authorId && ex.id === authorId) {
        actionText = "حذف رسالته بنفسه";
      } else {
        actionText = `حذف رسالة ${authorId ? `<@${authorId}>` : "عضو"}`;
      }
    } else if (authorId) {
      actorId = authorId;
      actionText = "حذف رسالته بنفسه (غالباً)";
    }

    const attText = formatAttachments(attachments);
    await sendLog(
      client,
      "chat",
      baseEmbed(0xf0b232, "🗑️ حذف رسالة").setDescription(
        [
          describeAction(actorId, actionText),
          `**الروم:** <#${message.channelId}>`,
          `**كاتب الرسالة:** ${authorId ? `<@${authorId}>` : "غير معروف"}${authorTag ? ` (\`${authorTag}\`)` : ""}`,
          `**آيدي الرسالة:** \`${message.id}\``,
          `**نص الرسالة:**\n${clip(content || "—", 900)}`,
          attText ? `**المرفقات:**\n${attText}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
  });

  client.on("messageUpdate", async (oldMsg, newMsg) => {
    if (!newMsg.guild || newMsg.guild.id !== GUILD_ID) return;
    if (Object.values(LOG_CHANNELS).includes(newMsg.channelId)) return;

    try {
      if (newMsg.partial) newMsg = await newMsg.fetch();
    } catch {
      return;
    }
    if (newMsg.author?.bot) return;

    const cached = msgCache.get(newMsg.id);
    const before = oldMsg.content ?? cached?.content ?? "";
    const after = newMsg.content ?? "";
    if (before === after) {
      cacheMessage(newMsg);
      return;
    }

    cacheMessage(newMsg);

    await sendLog(
      client,
      "chat",
      baseEmbed(0x5865f2, "✏️ تعديل رسالة").setDescription(
        [
          describeAction(newMsg.author.id, "عدّل رسالته"),
          `**الروم:** <#${newMsg.channelId}>`,
          `**كاتب الرسالة:** <@${newMsg.author.id}> (\`${newMsg.author.tag}\`)`,
          `**آيدي الرسالة:** \`${newMsg.id}\``,
          `**قبل التعديل:**\n${clip(before || "—", 700)}`,
          `**بعد التعديل:**\n${clip(after || "—", 700)}`,
          `[فتح الرسالة](${newMsg.url})`,
        ].join("\n"),
      ),
    );
  });

  // —— ANTI-SPAM / LINKS / MENTIONS ——
  client.on("messageCreate", async (message) => {
    if (!message.guild || message.guild.id !== GUILD_ID) return;
    cacheMessage(message);
    if (message.author.bot) return;
    if (isStaff(message.member)) return;

    const uid = message.author.id;
    const content = message.content || "";

    // Flood
    const flood = takeBucket(msgBuckets, uid, 6_000);
    if (flood >= 7) {
      await punish(message.member, "سبام رسائل (Flood)", {
        timeoutMs: 15 * 60_000,
        deleteMsg: message,
      });
      return;
    }

    // Mass mention
    const mentions =
      message.mentions.users.size +
      message.mentions.roles.size +
      (message.mentions.everyone ? 5 : 0);
    if (mentions >= 4) {
      const mCount = takeBucket(mentionBuckets, uid, 20_000);
      if (mCount >= 2 || mentions >= 6) {
        await punish(message.member, "منشن جماعي / سبام منشن", {
          timeoutMs: 30 * 60_000,
          deleteMsg: message,
        });
        return;
      }
    }

    // Discord invites (anti-ad)
    if (inviteRe.test(content)) {
      await message.delete().catch(() => {});
      await punish(message.member, "نشر دعوة ديسكورد", {
        timeoutMs: 20 * 60_000,
      });
      await sendLog(
        client,
        "important",
        baseEmbed(0xed4245, "🔗 دعوة محذوفة").setDescription(
          `<@${uid}> نشر دعوة في <#${message.channelId}>\n\`${clip(content, 200)}\``,
        ),
      );
      return;
    }

    // Too many links
    const links = content.match(urlRe) || [];
    if (links.length >= 3) {
      await punish(message.member, "روابط كثيرة في رسالة واحدة", {
        timeoutMs: 10 * 60_000,
        deleteMsg: message,
      });
    }
  });

  // —— MEMBER UPDATE: roles + nickname (Nova-style) ——
  client.on("guildMemberUpdate", async (oldM, newM) => {
    if (newM.guild.id !== GUILD_ID) return;

    const when = () =>
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Riyadh",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

    const memberBlock = [
      "**معلومات العضو**",
      `العضو: <@${newM.id}>`,
      `اسم العضو: \`${newM.id}\``,
    ].join("\n");

    // Nickname change
    const oldNick = oldM.nickname ?? null;
    const newNick = newM.nickname ?? null;
    if (oldNick !== newNick) {
      const audit = await getExecutor(
        newM.guild,
        AuditLogEvent.MemberUpdate,
        newM.id,
      );
      const admin = audit?.executor || null;
      const prevName = oldNick || oldM.user?.username || "—";
      const nextName = newNick || newM.user?.username || "—";

      await sendLog(
        client,
        "roles",
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("✏️ تم تحديث اسم اللقب لعضو في codeX")
          .setDescription(
            [
              memberBlock,
              "",
              "**الاسم السابق**",
              prevName,
              "",
              "**الاسم الجديد**",
              nextName,
              "",
              "**تم التحديث بواسطة**",
              `الادمن: ${admin ? `<@${admin.id}>` : "غير معروف"}`,
              `معرّف الادمن: ${admin ? `(${admin.id})` : "—"}`,
              "",
              "**وقت التحديث**",
              when(),
            ].join("\n"),
          )
          .setFooter({ text: "codeX · Nickname" })
          .setTimestamp(),
      );
    }

    const added = newM.roles.cache.filter((r) => !oldM.roles.cache.has(r.id));
    const removed = oldM.roles.cache.filter((r) => !newM.roles.cache.has(r.id));
    if (!added.size && !removed.size) return;

    const audit = await getExecutor(
      newM.guild,
      AuditLogEvent.MemberRoleUpdate,
      newM.id,
    );
    const admin = audit?.executor || null;
    const reason = audit?.reason?.trim() || "لم يتم تقديم سبب";
    const stamp = when();

    const adminBlock = (label) =>
      [
        `**${label}**`,
        `الادمن: ${admin ? `<@${admin.id}>` : "غير معروف"}`,
        `معرّف الادمن: ${admin ? `(${admin.id})` : "—"}`,
      ].join("\n");

    for (const role of removed.values()) {
      await sendLog(
        client,
        "roles",
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🎖️ تم ازالة رتبة من عضو في codeX")
          .setDescription(
            [
              memberBlock,
              "",
              "**الرتبة المزيلة**",
              `<@&${role.id}>`,
              "",
              adminBlock("تم الازالة بواسطة"),
              "",
              "**سبب الازالة**",
              reason,
              "",
              "**وقت الازالة**",
              stamp,
            ].join("\n"),
          )
          .setFooter({ text: "codeX · Roles" })
          .setTimestamp(),
      );
    }

    for (const role of added.values()) {
      await sendLog(
        client,
        "roles",
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🎖️ تم اعطاء رتبة لعضو في codeX")
          .setDescription(
            [
              memberBlock,
              "",
              "**الرتبة المعطاة**",
              `<@&${role.id}>`,
              "",
              adminBlock("تم اعطاء الرتبة بواسطة"),
              "",
              "**سبب الاعطاء**",
              reason,
              "",
              "**وقت الاعطاء**",
              stamp,
            ].join("\n"),
          )
          .setFooter({ text: "codeX · Roles" })
          .setTimestamp(),
      );

      if (
        role.permissions.has(PermissionFlagsBits.Administrator) ||
        role.permissions.has(PermissionFlagsBits.BanMembers) ||
        role.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        await sendLog(
          client,
          "important",
          baseEmbed(0xed4245, "🚨 رتبة صلاحيات خطرة").setDescription(
            `<@${newM.id}> حصل على \`${role.name}\`\nبواسطة: ${admin ? `<@${admin.id}>` : "—"}`,
          ),
        );
      }
    }
  });

  client.on("roleCreate", async (role) => {
    if (role.guild.id !== GUILD_ID) return;
    const audit = await getExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
    const ex = audit?.executor || null;
    await sendLog(
      client,
      "roles",
      baseEmbed(0x57f287, "➕ إنشاء رتبة").setDescription(
        [
          describeAction(ex?.id, "أنشأ رتبة جديدة"),
          `**الرتبة:** \`${role.name}\``,
        ].join("\n"),
      ),
    );
  });

  client.on("roleDelete", async (role) => {
    if (role.guild.id !== GUILD_ID) return;
    const audit = await getExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
    const ex = audit?.executor || null;
    await sendLog(
      client,
      "roles",
      baseEmbed(0xed4245, "➖ حذف رتبة").setDescription(
        [
          describeAction(ex?.id, "حذف رتبة"),
          `**الرتبة:** \`${role.name}\``,
        ].join("\n"),
      ),
    );
    await sendLog(
      client,
      "important",
      baseEmbed(0xed4245, "🚨 حذف رتبة").setDescription(
        `تم حذف \`${role.name}\` بواسطة ${ex ? `<@${ex.id}>` : "—"}`,
      ),
    );
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    if (newRole.guild.id !== GUILD_ID) return;
    const permChanged =
      oldRole.permissions.bitfield !== newRole.permissions.bitfield;
    if (!permChanged && oldRole.name === newRole.name) return;
    const audit = await getExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    const ex = audit?.executor || null;
    await sendLog(
      client,
      permChanged ? "permissions" : "roles",
      baseEmbed(0xf0b232, "🔧 تحديث رتبة").setDescription(
        [
          describeAction(
            ex?.id,
            permChanged ? "عدّل صلاحيات رتبة" : "أعاد تسمية رتبة",
          ),
          `**الرتبة:** \`${newRole.name}\``,
          oldRole.name !== newRole.name
            ? `**الاسم:** \`${oldRole.name}\` → \`${newRole.name}\``
            : null,
          permChanged ? "**الصلاحيات:** تغيّرت" : null,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
    if (
      permChanged &&
      (newRole.permissions.has(PermissionFlagsBits.Administrator) ||
        newRole.permissions.has(PermissionFlagsBits.ManageGuild))
    ) {
      await sendLog(
        client,
        "important",
        baseEmbed(0xed4245, "🚨 صلاحيات رتبة خطرة").setDescription(
          `\`${newRole.name}\` حصلت على صلاحيات إدارة — بواسطة ${ex ? `<@${ex.id}>` : "—"}`,
        ),
      );
    }
  });

  // —— CHANNELS / ROOMS ——
  client.on("channelCreate", async (channel) => {
    if (!channel.guild || channel.guild.id !== GUILD_ID) return;
    const audit = await getExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    const ex = audit?.executor || null;
    await sendLog(
      client,
      "rooms",
      baseEmbed(0x57f287, "📁 إنشاء روم").setDescription(
        [
          describeAction(ex?.id, "أنشأ روم"),
          `**الروم:** <#${channel.id}> (\`${channel.name}\`)`,
          `**النوع:** ${ChannelType[channel.type] || channel.type}`,
        ].join("\n"),
      ),
    );
  });

  client.on("channelDelete", async (channel) => {
    if (!channel.guild || channel.guild.id !== GUILD_ID) return;
    const audit = await getExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    const ex = audit?.executor || null;
    await sendLog(
      client,
      "rooms",
      baseEmbed(0xed4245, "💥 حذف روم").setDescription(
        [
          describeAction(ex?.id, "حذف روم"),
          `**الروم:** \`${channel.name}\``,
        ].join("\n"),
      ),
    );
    await sendLog(
      client,
      "important",
      baseEmbed(0xed4245, "🚨 حذف روم").setDescription(
        `تم حذف \`${channel.name}\` بواسطة ${ex ? `<@${ex.id}>` : "—"}`,
      ),
    );
  });

  client.on("channelUpdate", async (oldCh, newCh) => {
    if (!newCh.guild || newCh.guild.id !== GUILD_ID) return;
    // Ignore log-channel noise from our own bot edits when possible
    if (Object.values(LOG_CHANNELS).includes(newCh.id)) return;

    const nameChanged = oldCh.name !== newCh.name;
    const topicChanged = (oldCh.topic || "") !== (newCh.topic || "");
    const overwriteDiff = diffOverwrites(oldCh, newCh);
    const permsChanged = overwriteDiff.length > 0;
    if (!nameChanged && !topicChanged && !permsChanged) return;

    if (permsChanged) {
      let audit = null;
      for (let attempt = 0; attempt < 5 && !audit?.executor; attempt++) {
        await new Promise((r) => setTimeout(r, attempt === 0 ? 800 : 1000));
        audit = await getExecutor(
          newCh.guild,
          [
            AuditLogEvent.ChannelOverwriteUpdate,
            AuditLogEvent.ChannelOverwriteCreate,
            AuditLogEvent.ChannelOverwriteDelete,
            AuditLogEvent.ChannelUpdate,
          ],
          newCh.id,
          { windowMs: 90_000 },
        );
      }
      const ex = audit?.executor || null;
      // Skip pure bot self-noise unless someone else did it
      if (ex?.id === client.user.id && overwriteDiff.length === 0) return;

      const affected = audit?.entry?.extra;
      let affectedLabel = null;
      if (affected?.name) {
        affectedLabel = `**على رتبة:** \`${affected.name}\``;
      } else if (affected?.userId) {
        affectedLabel = `**على عضو:** <@${affected.userId}>`;
      } else if (affected?.id) {
        affectedLabel = `**على:** <@&${affected.id}> / <@${affected.id}>`;
      }

      const detail = overwriteDiff
        .slice(0, 8)
        .map((c) => {
          const who = c.type === 0 ? `<@&${c.id}>` : `<@${c.id}>`;
          return `• ${c.kind} → ${who}`;
        })
        .join("\n");

      await sendLog(
        client,
        "permissions",
        baseEmbed(0xf0b232, "🔐 تحديث صلاحيات روم").setDescription(
          [
            `**الفاعل:** ${ex ? `<@${ex.id}> (\`${ex.tag}\`)` : "غير معروف"}`,
            `**الإجراء:** عدّل صلاحيات روم`,
            `**الروم:** <#${newCh.id}> (\`${newCh.name}\`)`,
            affectedLabel,
            detail ? `**التفاصيل:**\n${detail}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    }

    if (nameChanged) {
      const audit = await getExecutor(
        newCh.guild,
        AuditLogEvent.ChannelUpdate,
        newCh.id,
        { windowMs: 60_000 },
      );
      const ex = audit?.executor || null;
      await sendLog(
        client,
        "rooms",
        baseEmbed(0x5865f2, "📝 إعادة تسمية روم").setDescription(
          [
            `**الفاعل:** ${ex ? `<@${ex.id}> (\`${ex.tag}\`)` : "غير معروف"}`,
            `**الإجراء:** أعاد تسمية روم`,
            `\`${oldCh.name}\` → \`${newCh.name}\``,
          ].join("\n"),
        ),
      );
    }
  });

  console.log("codeX Guard attached");
}
