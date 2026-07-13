/**
 * Disable Create Thread + Use Apps server-wide for everyone.
 */
import fs from "fs";
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
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
const DENY_BITS =
  PermissionFlagsBits.CreatePublicThreads |
  PermissionFlagsBits.CreatePrivateThreads |
  PermissionFlagsBits.UseApplicationCommands |
  PermissionFlagsBits.UseExternalApps;

const token = loadToken();
if (!token) {
  console.error("no token");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();
    await guild.channels.fetch();

    // 1) Strip from every role (Administrator roles keep bypassing Discord-side)
    let rolesFixed = 0;
    for (const role of guild.roles.cache.values()) {
      if (role.managed) continue;
      if (role.permissions.has(PermissionFlagsBits.Administrator)) continue;
      if (!role.permissions.any(DENY_BITS)) continue;
      const next = role.permissions.remove(DENY_BITS);
      await role.setPermissions(next, "codeX: disable threads + use apps");
      rolesFixed++;
      console.log("role stripped:", role.name);
      await new Promise((r) => setTimeout(r, 350));
    }

    // 2) Channel overwrites: remove explicit allows for these bits
    let channelsFixed = 0;
    for (const ch of guild.channels.cache.values()) {
      if (
        ch.type !== ChannelType.GuildText &&
        ch.type !== ChannelType.GuildForum &&
        ch.type !== ChannelType.GuildAnnouncement &&
        ch.type !== ChannelType.GuildVoice
      ) {
        continue;
      }
      if (!ch.permissionOverwrites?.cache?.size) continue;

      let touched = false;
      for (const ow of ch.permissionOverwrites.cache.values()) {
        const allowHas = ow.allow.any(DENY_BITS);
        const denyHas = ow.deny.any(DENY_BITS);
        if (!allowHas && denyHas) continue;
        if (!allowHas && !denyHas) {
          // add explicit deny on @everyone only to harden
          if (ow.id !== guild.roles.everyone.id) continue;
        }
        const allow = ow.allow.remove(DENY_BITS);
        const deny = ow.deny.add(DENY_BITS);
        await ch.permissionOverwrites.edit(
          ow.id,
          {
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            UseApplicationCommands: false,
            UseExternalApps: false,
          },
          { reason: "codeX: disable threads + use apps" },
        );
        touched = true;
        void allow;
        void deny;
      }

      // Ensure @everyone deny exists even with no prior overwrite
      const everyoneOw = ch.permissionOverwrites.cache.get(
        guild.roles.everyone.id,
      );
      if (
        !everyoneOw ||
        !everyoneOw.deny.has(PermissionFlagsBits.CreatePublicThreads) ||
        !everyoneOw.deny.has(PermissionFlagsBits.UseApplicationCommands)
      ) {
        await ch.permissionOverwrites.edit(
          guild.roles.everyone.id,
          {
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            UseApplicationCommands: false,
            UseExternalApps: false,
          },
          { reason: "codeX: disable threads + use apps (@everyone)" },
        );
        touched = true;
      }

      if (touched) {
        channelsFixed++;
        console.log("channel hardened:", ch.name);
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    console.log(
      JSON.stringify({ ok: true, rolesFixed, channelsFixed }, null, 2),
    );
  } catch (e) {
    console.error("failed:", e.message);
  } finally {
    client.destroy();
  }
});

client.login(token);
