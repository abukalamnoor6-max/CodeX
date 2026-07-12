/**
 * Hide sensitive log rooms from TEAM; OWNER + bot only.
 * Also re-applies nickname lock (no ChangeNickname for customers).
 */
import fs from "fs";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} from "discord.js";
import {
  LOG_CHANNELS,
  SENSITIVE_LOG_KEYS,
} from "./lib/guard.mjs";
import {
  LOG_TYPES,
  SENSITIVE_CODEX_LOG_TYPES,
} from "./lib/codex-logs.mjs";

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
const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";
const TEAM_ROLE_ID =
  process.env.DISCORD_STAFF_ROLE_TEAM || "1524961198360236084";
const OWNER_ROLE_ID =
  process.env.DISCORD_STAFF_ROLE_OWNER || "1524961206144860333";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function isSensitiveGuard(key) {
  return SENSITIVE_LOG_KEYS.has(key);
}

function isSensitiveCodex(type) {
  return SENSITIVE_CODEX_LOG_TYPES.has(type);
}

function baseOverwrites(guild, me, { teamCanView }) {
  const list = [
    {
      id: guild.roles.everyone.id,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: OWNER_ID,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageMessages,
      ],
    },
    {
      id: OWNER_ROLE_ID,
      type: OverwriteType.Role,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
      ],
      deny: [PermissionFlagsBits.SendMessages],
    },
    {
      id: me.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  if (teamCanView) {
    list.push({
      id: TEAM_ROLE_ID,
      type: OverwriteType.Role,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
      ],
      deny: [PermissionFlagsBits.SendMessages],
    });
  } else {
    list.push({
      id: TEAM_ROLE_ID,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel],
    });
  }
  return list;
}

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    const me = await guild.members.fetchMe();

    // 1) Guard LOG_CHANNELS
    for (const [key, id] of Object.entries(LOG_CHANNELS)) {
      const ch = guild.channels.cache.get(id);
      if (!ch || ch.type !== ChannelType.GuildText) {
        console.log("missing guard log", key, id);
        continue;
      }
      const teamCanView = !isSensitiveGuard(key);
      await ch.permissionOverwrites.set(
        baseOverwrites(guild, me, { teamCanView }),
      );
      console.log(
        "guard",
        key,
        ch.name,
        teamCanView ? "TEAM=yes" : "TEAM=no",
      );
      await new Promise((r) => setTimeout(r, 350));
    }

    // 2) Codex-style log rooms by name match
    for (const [type, name] of Object.entries(LOG_TYPES)) {
      const ch = [...guild.channels.cache.values()].find(
        (c) =>
          c.type === ChannelType.GuildText &&
          (c.name === name || c.name.includes(name.slice(0, 8))),
      );
      if (!ch) {
        console.log("missing codex log", type, name);
        continue;
      }
      const teamCanView = !isSensitiveCodex(type);
      await ch.permissionOverwrites.set(
        baseOverwrites(guild, me, { teamCanView }),
      );
      console.log(
        "codex",
        type,
        ch.name,
        teamCanView ? "TEAM=yes" : "TEAM=no",
      );
      await new Promise((r) => setTimeout(r, 350));
    }

    console.log("SUCCESS");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(loadToken());
