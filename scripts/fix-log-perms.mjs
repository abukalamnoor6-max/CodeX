import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} from "discord.js";
import { LOG_CHANNELS } from "./lib/guard.mjs";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();
    await guild.channels.fetch();
    const me = await guild.members.fetchMe();
    const everyone = guild.roles.everyone;

    const staffRoles = [...guild.roles.cache.values()].filter((r) =>
      /𝐎𝐖𝐍𝐄𝐑|OWNER|𝐓𝐄𝐀𝐌|TEAM|Founder|Admin/i.test(r.name),
    );

    const overwrites = [
      {
        id: everyone.id,
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
        id: me.id,
        type: OverwriteType.Member,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ModerateMembers,
          PermissionFlagsBits.KickMembers,
          PermissionFlagsBits.BanMembers,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ViewAuditLog,
        ],
      },
      ...staffRoles.map((role) => ({
        id: role.id,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
        deny: [PermissionFlagsBits.SendMessages],
      })),
    ];

    for (const id of Object.values(LOG_CHANNELS)) {
      const ch = guild.channels.cache.get(id);
      if (!ch || ch.type !== ChannelType.GuildText) {
        console.log("missing", id);
        continue;
      }
      await ch.permissionOverwrites.set(overwrites);
      console.log("perms ok", ch.name);
      await new Promise((r) => setTimeout(r, 300));
    }

    // Ensure bot has moderation perms at guild level via its role if possible
    const botRole = me.roles.highest;
    try {
      await botRole.setPermissions(
        botRole.permissions
          .add(PermissionFlagsBits.ModerateMembers)
          .add(PermissionFlagsBits.KickMembers)
          .add(PermissionFlagsBits.BanMembers)
          .add(PermissionFlagsBits.ManageMessages)
          .add(PermissionFlagsBits.ViewAuditLog)
          .add(PermissionFlagsBits.ManageChannels)
          .add(PermissionFlagsBits.ManageRoles),
        "codeX Guard permissions",
      );
      console.log("bot role perms updated", botRole.name);
    } catch (e) {
      console.log("bot role perms skip", e.message);
    }

    console.log("SUCCESS");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(TOKEN);
