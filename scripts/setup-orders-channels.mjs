import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} from "discord.js";
import fs from "fs";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";

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

    const ownerId = guild.ownerId;
    const everyone = guild.roles.everyone;
    const me = await guild.members.fetchMe();

    console.log("guild", guild.name, "owner", ownerId);

    // Category for voice support/waiting
    let voiceCat = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildCategory &&
        (c.name.includes("انتظار") ||
          c.name.includes("سبورت") ||
          c.name === "🎧 │ الدعم الصوتي"),
    );
    if (!voiceCat) {
      voiceCat = await guild.channels.create({
        name: "🎧 │ الدعم الصوتي",
        type: ChannelType.GuildCategory,
        reason: "codeX support/waiting voice",
      });
      console.log("created category", voiceCat.name);
    }

    async function ensureVoice(name) {
      let ch = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildVoice && c.name === name,
      );
      const overwrites = [
        {
          id: everyone.id,
          type: OverwriteType.Role,
          deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
          allow: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: ownerId,
          type: OverwriteType.Member,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
          ],
        },
        {
          id: me.id,
          type: OverwriteType.Member,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ];
      // Staff can also join
      for (const roleName of ["👑 Owner", "🛠️ Admin", "💼 Support"]) {
        const role = guild.roles.cache.find((r) => r.name === roleName);
        if (!role) continue;
        overwrites.push({
          id: role.id,
          type: OverwriteType.Role,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MoveMembers,
          ],
        });
      }

      if (!ch) {
        ch = await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          parent: voiceCat.id,
          permissionOverwrites: overwrites,
          reason: "codeX voice rooms",
        });
        console.log("created voice", name);
      } else {
        await ch.edit({
          parent: voiceCat.id,
          permissionOverwrites: overwrites,
        });
        console.log("updated voice", name);
      }
      return ch;
    }

    // Private orders text channel — owner only
    async function ensureOrders() {
      const name = "📊│الطلبات";
      let ch = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.name === name,
      );
      const overwrites = [
        {
          id: everyone.id,
          type: OverwriteType.Role,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: ownerId,
          type: OverwriteType.Member,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageWebhooks,
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
            PermissionFlagsBits.ManageWebhooks,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ];

      if (!ch) {
        ch = await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          topic: "فواتير وطلبات المتجر — خاص بك فقط",
          permissionOverwrites: overwrites,
          reason: "codeX private orders invoices",
        });
        console.log("created orders channel");
      } else {
        await ch.permissionOverwrites.set(overwrites);
        console.log("updated orders channel");
      }
      return ch;
    }

    // Remove/rename old conflicting staff voice-like or unused if user asked replace
    // Keep staff text rooms; just ensure new ones exist.

    const support = await ensureVoice("| support");
    const waiting = await ensureVoice("| waiting");
    const orders = await ensureOrders();

    // Create webhook for invoices
    const existingHooks = await orders.fetchWebhooks();
    let hook = existingHooks.find((h) => h.name === "codeX Orders");
    if (!hook) {
      hook = await orders.createWebhook({
        name: "codeX Orders",
        reason: "Store order invoices",
      });
      console.log("created webhook");
    } else {
      console.log("webhook exists");
    }

    const webhookUrl = `https://discord.com/api/webhooks/${hook.id}/${hook.token}`;

    // Save locally (do not print full token in logs beyond file)
    const envPath = "C:/Users/Admin/Projects/codeX/.env.local";
    let env = "";
    try {
      env = fs.readFileSync(envPath, "utf8");
    } catch {
      env = "";
    }
    if (/^DISCORD_WEBHOOK_URL=/m.test(env)) {
      env = env.replace(
        /^DISCORD_WEBHOOK_URL=.*$/m,
        `DISCORD_WEBHOOK_URL=${webhookUrl}`,
      );
    } else {
      env += `\nDISCORD_WEBHOOK_URL=${webhookUrl}\n`;
    }
    fs.writeFileSync(envPath, env, "utf8");

    // Also write a private local file for RMZ paste
    fs.writeFileSync(
      "C:/Users/Admin/Projects/codeX/discord/orders-webhook.url",
      webhookUrl,
      "utf8",
    );

    // Intro message in orders channel
    const recent = await orders.messages.fetch({ limit: 5 });
    const hasIntro = recent.some(
      (m) => m.author.id === client.user.id && m.embeds[0]?.title?.includes("الطلبات"),
    );
    if (!hasIntro) {
      await orders.send({
        embeds: [
          {
            color: 0x0059db,
            title: "📊│الطلبات — خاص",
            description:
              "هذا الروم **خاص فيك فقط**.\nكل طلب جديد من المتجر يوصل هنا كفاتورة عبر الويب هوك.",
            footer: { text: "codeX · Private Orders" },
          },
        ],
      });
    }

    // Test invoice
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "طلب تجريبي — CX-TEST",
            color: 0x0059db,
            fields: [
              { name: "العميل", value: "Test Customer", inline: true },
              { name: "دسكورد", value: "test#0000", inline: true },
              { name: "الدفع", value: "تجريبي", inline: true },
              { name: "المنتجات", value: "• منتج تجريبي ×1 — **0 ر.س**" },
              { name: "الإجمالي", value: "**0 ر.س**", inline: true },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: "codeX Store · test" },
          },
        ],
      }),
    });

    console.log(
      JSON.stringify(
        {
          support: support.id,
          waiting: waiting.id,
          orders: orders.id,
          webhookSaved: true,
          ownerOnly: true,
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
