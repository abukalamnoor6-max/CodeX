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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    await guild.roles.fetch();

    const everyone = guild.roles.everyone;
    const me = await guild.members.fetchMe();
    const customer = guild.roles.cache.find((r) => r.name.includes("Customer"));

    let category = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildCategory &&
        c.name === "الموقع الإلكتروني",
    );
    if (!category) {
      category = await guild.channels.create({
        name: "الموقع الإلكتروني",
        type: ChannelType.GuildCategory,
        reason: "codeX website category",
      });
      console.log("created category");
    }

    const publicOverwrites = [
      {
        id: everyone.id,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
        deny: [PermissionFlagsBits.SendMessages],
      },
      {
        id: OWNER_ID,
        type: OverwriteType.Member,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: me.id,
        type: OverwriteType.Member,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    const privateOverwrites = [
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
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    if (customer) {
      privateOverwrites.push({
        id: customer.id,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.SendMessages,
        ],
      });
    }

    for (const roleName of ["👑 Owner", "🛠️ Admin", "💼 Support"]) {
      const role = guild.roles.cache.find((r) => r.name === roleName);
      if (!role) continue;
      privateOverwrites.push({
        id: role.id,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.SendMessages,
        ],
      });
    }

    async function ensureText(name, overwrites, topic) {
      let ch = guild.channels.cache.find(
        (c) =>
          c.type === ChannelType.GuildText &&
          (c.name === name ||
            c.name.replace(/\s+/g, "") === name.replace(/\s+/g, "")),
      );
      if (!ch) {
        ch = await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic,
          permissionOverwrites: overwrites,
          reason: "codeX website channels",
        });
        console.log("created text", name);
      } else {
        await ch.edit({
          name,
          parent: category.id,
          topic,
          permissionOverwrites: overwrites,
        });
        console.log("updated text", name);
      }
      return ch;
    }

    async function ensureForum(name, overwrites, topic) {
      let ch = guild.channels.cache.find(
        (c) =>
          c.type === ChannelType.GuildForum &&
          (c.name === name ||
            c.name.replace(/\s+/g, "") === name.replace(/\s+/g, "")),
      );
      if (!ch) {
        // fallback: some servers may not allow forum; try create, else text
        try {
          ch = await guild.channels.create({
            name,
            type: ChannelType.GuildForum,
            parent: category.id,
            topic,
            permissionOverwrites: overwrites,
            reason: "codeX website guides forum",
            availableTags: [
              { name: "عام" },
              { name: "فايف إم" },
              { name: "دسكورد" },
              { name: "المتجر" },
            ],
          });
          console.log("created forum", name);
        } catch (e) {
          console.log("forum failed, creating text:", e.message);
          ch = await ensureText(name, overwrites, topic);
        }
      } else {
        await ch.edit({
          name,
          parent: category.id,
          topic,
          permissionOverwrites: overwrites,
        });
        console.log("updated forum", name);
      }
      return ch;
    }

    const site = await ensureText(
      "🌐｜الموقع-الإلكتروني",
      publicOverwrites,
      "رابط المتجر ومعلومات الموقع",
    );
    const rank = await ensureText(
      "🌟｜رتبة-الزبون",
      privateOverwrites,
      "شرح رتبة الزبون وربط Discord",
    );
    const guides = await ensureForum(
      "📕｜شروحات",
      privateOverwrites,
      "شروحات وملفات مساعدة للعملاء",
    );

    // Post content
    const siteMsgs = await site.messages.fetch({ limit: 10 }).catch(() => null);
    const hasSite = siteMsgs?.some(
      (m) => m.author.id === client.user.id && m.embeds[0]?.title?.includes("الموقع"),
    );
    if (!hasSite) {
      await site.send({
        embeds: [
          {
            color: 0x0059db,
            title: "🌐 الموقع الإلكتروني — codeX",
            description: [
              "**رابط المتجر:**",
              "https://codex112.rmz.gg",
              "",
              "من هنا تقدر تتصفح المنتجات وتطلب خدمات فايف إم وبوتات الدسكورد.",
            ].join("\n"),
            footer: { text: "codeX" },
          },
        ],
      });
    }

    const rankMsgs = await rank.messages.fetch({ limit: 10 }).catch(() => null);
    const hasRank = rankMsgs?.some(
      (m) => m.author.id === client.user.id && m.embeds[0]?.title?.includes("رتبة"),
    );
    if (!hasRank) {
      await rank.send({
        embeds: [
          {
            color: 0x0059db,
            title: "🌟 رتبة الزبون",
            description: [
              "رتبة الزبون تنضاف بعد الشراء عبر **المزايا** في المتجر.",
              "",
              "1. اشترِ من المتجر",
              "2. ادخل حسابك → **المزايا**",
              "3. اضغط **ربط Discord**",
              "4. تنضاف لك رتبة 🛒 Customer",
              "",
              "إذا ظهرت **قيد الانتظار** اضغط ربط Discord.",
            ].join("\n"),
            footer: { text: "𝐂𝐨𝐝𝐞𝐗" },
          },
        ],
      });
    }

    console.log(
      JSON.stringify(
        {
          category: category.id,
          site: site.id,
          rank: rank.id,
          guides: guides.id,
          guidesType: guides.type,
        },
        null,
        2,
      ),
    );
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
