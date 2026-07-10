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

const ROLE_STYLE = [
  { match: /Owner|مالك/i, name: "♛ ＯＷＮＥＲ", color: "#8B0000", hoist: true },
  { match: /Admin|إدارة|ادمن/i, name: "◈ ＡＤＭＩＮ", color: "#00E5FF", hoist: true },
  { match: /Support|دعم/i, name: "✧ ＳＵＰＰＯＲＴ", color: "#7CFFB2", hoist: true },
  { match: /Designer|تصميم/i, name: "◈ ＤＥＳＩＧＮ", color: "#C084FC", hoist: true },
  { match: /Developer|مطور/i, name: "⟨／⟩ ＤＥＶ", color: "#38BDF8", hoist: true },
  { match: /VIP/i, name: "✦ ＶＩＰ", color: "#F5D76E", hoist: true },
  { match: /Customer|زبون|عميل/i, name: "◎ ＣＬＩＥＮＴ", color: "#60A5FA", hoist: true },
  { match: /^👤|^Member|عضو/i, name: "· ＭＥＭＢＥＲ", color: "#94A3B8", hoist: false },
  { match: /🤖|^Bot$/i, name: "⬡ ＢＯＴＳ", color: "#64748B", hoist: false },
];

function hex(color) {
  return parseInt(String(color).replace("#", ""), 16);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    await guild.roles.fetch();
    const everyone = guild.roles.everyone;
    const me = await guild.members.fetchMe();

    // Staff category
    let cat = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildCategory &&
        (c.name.includes("الطاقم") || c.name.includes("staff")),
    );
    if (!cat) {
      cat = await guild.channels.create({
        name: "🔒｜الطاقم",
        type: ChannelType.GuildCategory,
      });
    } else {
      await cat.setName("🔒｜الطاقم").catch(() => {});
    }

    const staffOverwrites = [
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
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      },
      {
        id: me.id,
        type: OverwriteType.Member,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
        ],
      },
    ];

    for (const role of guild.roles.cache.values()) {
      if (/Owner|Admin|Support|ＯＷＮＥＲ|ＡＤＭＩＮ|ＳＵＰＰＯＲＴ/i.test(role.name)) {
        staffOverwrites.push({
          id: role.id,
          type: OverwriteType.Role,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }
    }

    async function ensureStaffText(targetName, aliases) {
      let ch = guild.channels.cache.find(
        (c) =>
          c.type === ChannelType.GuildText &&
          (c.name === targetName || aliases.some((a) => c.name.includes(a))),
      );
      if (!ch) {
        ch = await guild.channels.create({
          name: targetName,
          type: ChannelType.GuildText,
          parent: cat.id,
          permissionOverwrites: staffOverwrites,
        });
        console.log("created", targetName);
      } else {
        await ch.edit({
          name: targetName,
          parent: cat.id,
          permissionOverwrites: staffOverwrites,
        });
        console.log("updated", ch.id, "->", targetName);
      }
      return ch;
    }

    const chat = await ensureStaffText("💬｜شات", ["الشات", "شات", "staff│الشات", "staff | الشات"]);
    const delivery = await ensureStaffText("📦｜حاله-التسليم", [
      "الطلبيات",
      "التسليم",
      "حاله",
      "staff│الطلبات",
      "staff | الطلبيات",
    ]);

    // Fancy roles
    for (const style of ROLE_STYLE) {
      const role = guild.roles.cache.find((r) => style.match.test(r.name));
      if (!role || role.managed) continue;
      try {
        await role.edit({
          name: style.name,
          color: hex(style.color),
          hoist: style.hoist,
          mentionable: false,
        });
        console.log("role", role.id, "->", style.name, style.color);
        await new Promise((r) => setTimeout(r, 400));
      } catch (e) {
        console.log("role skip", role.name, e.message);
      }
    }

    // Save delivery channel id for bot/site
    const fs = await import("fs");
    const meta = {
      guildId: GUILD_ID,
      staffChatId: chat.id,
      deliveryChannelId: delivery.id,
      waitingVoiceUrl: "https://discord.com/channels/1524901009195798679/1524971494663258235",
      ownerId: OWNER_ID,
    };
    fs.writeFileSync(
      "C:/Users/Admin/Projects/codeX/discord/channels.json",
      JSON.stringify(meta, null, 2),
      "utf8",
    );

    console.log(JSON.stringify(meta, null, 2));
    console.log("SUCCESS");
  } catch (e) {
    console.error("FAILED", e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(TOKEN);
