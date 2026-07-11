import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { renderWelcomeCard, normalizeFancyText } from "./welcome-card.mjs";

export const WELCOME_CHANNEL_ID =
  process.env.DISCORD_WELCOME_CHANNEL_ID || "1524961216097816717";

const VISITOR_ROLE_RE = /𝐕𝐢𝐬𝐢𝐭𝐨𝐫|Visitor|زائر/i;
const NICK_PREFIX = "𝐂𝐗〢";

function buildCodexNick(member) {
  const base =
    member.user.globalName ||
    member.displayName ||
    member.user.username ||
    "Member";
  // Discord nick max 32
  const maxName = 32 - NICK_PREFIX.length;
  let name = String(base).trim();
  if (name.length > maxName) name = `${name.slice(0, maxName - 1)}…`;
  return `${NICK_PREFIX}${name}`;
}

/** Set nickname: 𝐂𝐗〢اسم الشخص */
export async function setCodexNickname(member) {
  if (member.user.bot) return null;
  if (member.id === member.guild.ownerId) return null; // can't nick owner

  const nick = buildCodexNick(member);
  if (member.nickname === nick) return nick;

  try {
    await member.setNickname(nick, "codeX auto nickname on join");
    return nick;
  } catch (e) {
    console.warn("nickname failed", member.user.tag, e.message);
    return null;
  }
}

/** Give Visitor role immediately on join */
export async function assignVisitorRole(member) {
  if (member.user.bot) return null;
  await member.guild.roles.fetch().catch(() => {});
  const role =
    member.guild.roles.cache.find((r) => VISITOR_ROLE_RE.test(r.name)) ||
    null;
  if (!role) {
    console.warn("Visitor role not found");
    return null;
  }
  if (member.roles.cache.has(role.id)) return role;
  await member.roles.add(role, "codeX auto Visitor on join");
  return role;
}

export async function sendWelcome(member) {
  if (member.user.bot) return;

  const avatarUrl = member.user.displayAvatarURL({
    extension: "png",
    size: 256,
    forceStatic: true,
  });

  const png = await renderWelcomeCard({
    displayName: normalizeFancyText(
      member.displayName || member.user.globalName || member.user.username,
    ),
    username: normalizeFancyText(member.user.username),
    avatarUrl,
    memberCount: member.guild.memberCount,
  });

  const file = new AttachmentBuilder(png, { name: "codex-welcome.png" });

  const channel =
    (await member.client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null)) ||
    member.guild.channels.cache.find((c) => c.name?.includes("الترحيب"));

  if (!channel?.isTextBased?.()) {
    throw new Error("welcome channel missing");
  }

  await channel.send({
    content: `مرحباً <@${member.id}> في **codeX** 🖤`,
    files: [file],
    allowedMentions: { users: [member.id] },
  });
}

/** Optional compact embed fallback if image fails */
export async function sendWelcomeFallback(member) {
  const channel = await member.client.channels
    .fetch(WELCOME_CHANNEL_ID)
    .catch(() => null);
  if (!channel?.isTextBased?.()) return;
  await channel.send({
    content: `مرحباً <@${member.id}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x000000)
        .setTitle("أهلاً بك في codeX")
        .setDescription(
          [
            `نورت السيرفر **${member.displayName}**`,
            "نتمنى لك تجربة مميزة مع فريق codeX",
            `أنت العضو رقم **${member.guild.memberCount}**`,
          ].join("\n"),
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setTimestamp(),
    ],
    allowedMentions: { users: [member.id] },
  });
}
