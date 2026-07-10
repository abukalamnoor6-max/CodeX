import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
const OWNER_ID = "1210972261968912425";

if (!TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

const LOG_CATEGORY = "🔍 い ╭ LOGS ╮";
const LOG_CHANNELS = [
  "xx",
  "ticket-logs",
  "↳〢𝑷𝒆𝒓𝒎𝒊𝒔𝒔𝒊𝒐𝒏𝒔",
  "↳〢𝑩𝒂𝒏 · 𝑼𝒏𝒃𝒂𝒏",
  "↳〢𝑹𝒐𝒐𝒎𝒔",
  "↳〢𝑪𝒉𝒂𝒕 · 𝑫𝒆𝒍𝒆𝒕𝒆",
  "↳〢𝑹𝒐𝒍𝒆𝒔",
  "↳〢𝑱𝒐𝒊𝒏",
  "↳〢𝑳𝒆𝒇𝒕",
  "مهم",
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    const everyone = guild.roles.everyone;
    const me = await guild.members.fetchMe();

    let category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === LOG_CATEGORY,
    );
    if (!category) {
      category = await guild.channels.create({
        name: LOG_CATEGORY,
        type: ChannelType.GuildCategory,
        reason: "codeX logs category",
      });
      console.log("created category");
    }

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
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ];

    for (const roleName of ["👑 Owner", "🛠️ Admin"]) {
      const role = guild.roles.cache.find((r) => r.name === roleName);
      if (!role) continue;
      overwrites.push({
        id: role.id,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.SendMessages,
        ],
      });
    }

    // Remove old staff logs rooms if present (staff│اللوقات)
    const oldLogs = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildText &&
        (c.name.includes("اللوقات") || c.name === "staff│اللوقات"),
    );
    if (oldLogs) {
      await oldLogs.delete("Replaced by styled LOGS category").catch(() => {});
      console.log("deleted old staff logs");
    }

    for (const name of LOG_CHANNELS) {
      let ch = guild.channels.cache.find(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.name === name &&
          c.parentId === category.id,
      );
      if (!ch) {
        // also match by name anywhere under logs-like
        ch = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildText && c.name === name,
        );
      }
      if (!ch) {
        ch = await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: overwrites,
          reason: "codeX styled logs",
        });
        console.log("created", name);
      } else {
        await ch.edit({
          parent: category.id,
          permissionOverwrites: overwrites,
        });
        console.log("updated", name);
      }
      await new Promise((r) => setTimeout(r, 350));
    }

    console.log("SUCCESS");
  } catch (e) {
    console.error("FAILED", e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(TOKEN).catch((e) => {
  console.error("LOGIN_FAILED", e.message);
  process.exit(1);
});
