import fs from "fs";
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  PermissionsBitField,
} from "discord.js";

function loadToken() {
  if (process.env.DISCORD_BOT_TOKEN) return process.env.DISCORD_BOT_TOKEN;
  for (const f of [".env.local", ".env.bot.railway"]) {
    try {
      const raw = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
      const m = raw.match(/^DISCORD_BOT_TOKEN=(.+)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  return "";
}

const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";

const SPECS = [
  {
    match: /^@everyone$/,
    key: "everyone",
    perms: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.UseExternalStickers,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.Stream,
      PermissionFlagsBits.UseVAD,
      PermissionFlagsBits.ChangeNickname,
      PermissionFlagsBits.SendVoiceMessages,
    ],
  },
  {
    // decorative separators
    match: /^✕$|^🃏$|^×$/,
    key: "separator",
    perms: [],
  },
  {
    match: /⭐?\s*𝐁𝐎𝐓|⭐ 𝐁𝐎𝐓|^Bot$/i,
    key: "bot_display",
    perms: [],
  },
  {
    match: /𝐎𝐖𝐍𝐄𝐑|OWNER/i,
    key: "owner",
    perms: [PermissionFlagsBits.Administrator],
  },
  {
    match: /𝐓𝐄𝐀𝐌|TEAM\s*CodeX|TEAM\s*𝐂𝐨𝐝𝐞𝐗/i,
    key: "team",
    perms: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageNicknames,
      PermissionFlagsBits.ViewAuditLog,
      PermissionFlagsBits.MuteMembers,
      PermissionFlagsBits.DeafenMembers,
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.Stream,
      PermissionFlagsBits.PrioritySpeaker,
      PermissionFlagsBits.UseVAD,
      PermissionFlagsBits.ChangeNickname,
      PermissionFlagsBits.CreateInstantInvite,
    ],
  },
  {
    match: /𝐏𝐚𝐫𝐭𝐧𝐞𝐫|Partner/i,
    key: "partner",
    perms: [
      PermissionFlagsBits.CreateInstantInvite,
      PermissionFlagsBits.ChangeNickname,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.UseExternalStickers,
      PermissionFlagsBits.Stream,
      PermissionFlagsBits.PrioritySpeaker,
      PermissionFlagsBits.SendVoiceMessages,
    ],
  },
  {
    match: /𝐕𝐈𝐏|VIP/i,
    key: "vip",
    perms: [
      PermissionFlagsBits.ChangeNickname,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.UseExternalStickers,
      PermissionFlagsBits.Stream,
      PermissionFlagsBits.PrioritySpeaker,
      PermissionFlagsBits.SendVoiceMessages,
    ],
  },
  {
    match: /𝐏𝐫𝐞𝐦𝐢𝐮𝐦|Premium/i,
    key: "premium",
    perms: [
      PermissionFlagsBits.ChangeNickname,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.UseExternalStickers,
      PermissionFlagsBits.Stream,
      PermissionFlagsBits.SendVoiceMessages,
    ],
  },
  {
    match: /𝐂𝐥𝐢𝐞𝐧𝐭|Client|Customer/i,
    key: "client",
    // must not match Premium Client — check order: premium before client
    exclude: /Premium|𝐏𝐫𝐞𝐦𝐢𝐮𝐦/i,
    perms: [
      PermissionFlagsBits.ChangeNickname,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.UseExternalStickers,
      PermissionFlagsBits.Stream,
    ],
  },
  {
    match: /𝐕𝐢𝐬𝐢𝐭𝐨𝐫|Visitor/i,
    key: "visitor",
    perms: [PermissionFlagsBits.ChangeNickname],
  },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function findSpec(role) {
  for (const spec of SPECS) {
    if (!spec.match.test(role.name)) continue;
    if (spec.exclude && spec.exclude.test(role.name)) continue;
    return spec;
  }
  return null;
}

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();
    const me = await guild.members.fetchMe();
    console.log(
      "bot top role:",
      me.roles.highest.name,
      "pos",
      me.roles.highest.position,
    );

    const results = [];
    const roles = [...guild.roles.cache.values()].sort(
      (a, b) => b.position - a.position,
    );

    for (const role of roles) {
      if (role.managed) {
        results.push({ role: role.name, skip: "managed" });
        continue;
      }
      const spec = findSpec(role);
      if (!spec) {
        // unknown decorative → strip to empty safe
        if (role.id === guild.id) continue;
        results.push({ role: role.name, skip: "no-spec" });
        continue;
      }

      const bitfield = new PermissionsBitField(spec.perms);
      try {
        if (role.position >= me.roles.highest.position && role.id !== guild.id) {
          results.push({
            role: role.name,
            key: spec.key,
            error: "role above bot — move CodeX bot role to top first",
          });
          continue;
        }
        await role.setPermissions(bitfield, `𝐂𝐨𝐝𝐞𝐗 role perms: ${spec.key}`);
        results.push({
          role: role.name,
          key: spec.key,
          perms: bitfield.toArray(),
        });
        console.log("ok", spec.key, role.name);
      } catch (e) {
        results.push({ role: role.name, key: spec.key, error: e.message });
        console.error("fail", role.name, e.message);
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    client.destroy();
  }
});

client.login(loadToken());
