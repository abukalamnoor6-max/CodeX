import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import fs from "fs";
import path from "path";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const ROOT = "C:/Users/Admin/Projects/codeX";

if (!TOKEN || !GUILD_ID) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
  process.exit(1);
}

const structure = JSON.parse(
  fs.readFileSync(path.join(ROOT, "discord/structure.json"), "utf8"),
);

function readMsg(name) {
  return fs.readFileSync(
    path.join(ROOT, `discord/messages/${name}.md`),
    "utf8",
  );
}

function stripMdHeading(md) {
  return md.replace(/^# .+\n+/, "").trim();
}

function hex(color) {
  return parseInt(String(color).replace("#", ""), 16);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

client.once("ready", async () => {
  try {
    console.log("logged in as", client.user.tag);
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.fetch();
    console.log("guild:", guild.name);

    // Rename server
    try {
      await guild.setName(structure.name);
      console.log("renamed server");
    } catch (e) {
      console.log("rename skip:", e.message);
    }

    // Icon + banner
    try {
      const icon = fs.readFileSync(path.join(ROOT, "public/discord/icon.png"));
      await guild.setIcon(icon);
      console.log("icon set");
    } catch (e) {
      console.log("icon skip:", e.message);
    }
    try {
      const banner = fs.readFileSync(
        path.join(ROOT, "public/discord/banner.png"),
      );
      await guild.setBanner(banner);
      console.log("banner set");
    } catch (e) {
      console.log("banner skip:", e.message);
    }

    // Roles (create bottom-up so hierarchy is nicer; discord creates at bottom)
    const roleMap = new Map();
    const everyone = guild.roles.everyone;

    for (const r of [...structure.roles].reverse()) {
      let existing = guild.roles.cache.find((x) => x.name === r.name);
      if (!existing) {
        const perms =
          r.permissions === "ADMINISTRATOR"
            ? [PermissionFlagsBits.Administrator]
            : [];
        existing = await guild.roles.create({
          name: r.name,
          color: hex(r.color),
          hoist: !!r.hoist,
          mentionable: false,
          permissions: perms,
          reason: "codeX server setup",
        });
        console.log("role created:", r.name);
        await sleep(400);
      } else {
        await existing
          .edit({
            color: hex(r.color),
            hoist: !!r.hoist,
          })
          .catch(() => {});
        console.log("role exists:", r.name);
      }
      roleMap.set(r.name, existing);
    }

    const staffRoles = ["👑 Owner", "🛠️ Admin", "💼 Support"].map((n) =>
      roleMap.get(n),
    );
    const adminRoles = ["👑 Owner", "🛠️ Admin"].map((n) => roleMap.get(n));

    const channelIds = {};

    for (const cat of structure.categories) {
      let category = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === cat.name,
      );

      const overwrites = [
        {
          id: everyone.id,
          deny: cat.staffOnly
            ? [PermissionFlagsBits.ViewChannel]
            : [],
          allow: cat.staffOnly ? [] : [PermissionFlagsBits.ViewChannel],
        },
      ];

      if (cat.staffOnly) {
        for (const role of staffRoles.filter(Boolean)) {
          overwrites.push({
            id: role.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          });
        }
      }

      if (!category) {
        category = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: overwrites,
          reason: "codeX server setup",
        });
        console.log("category:", cat.name);
        await sleep(500);
      } else {
        await category.permissionOverwrites.set(overwrites).catch(() => {});
        console.log("category exists:", cat.name);
      }

      for (const ch of cat.channels) {
        let channel = guild.channels.cache.find(
          (c) =>
            c.parentId === category.id &&
            c.name === ch.name &&
            c.type === ChannelType.GuildText,
        );

        const chOverwrites = [
          {
            id: everyone.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
            ],
            deny: ch.readonly
              ? [PermissionFlagsBits.SendMessages]
              : cat.staffOnly
                ? [PermissionFlagsBits.ViewChannel]
                : [],
          },
        ];

        if (cat.staffOnly) {
          chOverwrites[0] = {
            id: everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          };
          for (const role of staffRoles.filter(Boolean)) {
            chOverwrites.push({
              id: role.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            });
          }
        } else if (ch.readonly) {
          for (const role of adminRoles.filter(Boolean)) {
            chOverwrites.push({
              id: role.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            });
          }
        }

        if (!channel) {
          channel = await guild.channels.create({
            name: ch.name,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: chOverwrites,
            topic:
              ch.message === "store"
                ? structure.storeUrl
                : ch.message === "welcome"
                  ? "مرحباً بك في codeX"
                  : undefined,
            reason: "codeX server setup",
          });
          console.log("channel:", ch.name);
          await sleep(500);
        } else {
          await channel.permissionOverwrites.set(chOverwrites).catch(() => {});
          console.log("channel exists:", ch.name);
        }

        if (ch.message) channelIds[ch.message] = channel.id;
      }
    }

    // Post branded embeds
    const brand = structure.brandColor;

    function replaceRefs(text) {
      return text
        .replaceAll("<#CHANNEL_RULES>", `<#${channelIds.rules || "0"}>`)
        .replaceAll("<#CHANNEL_STORE>", `<#${channelIds.store || "0"}>`)
        .replaceAll("<#CHANNEL_TICKET>", `<#${channelIds.tickets || "0"}>`);
    }

    async function postOnce(key, title, description) {
      const id = channelIds[key];
      if (!id) return;
      const channel = await guild.channels.fetch(id);
      const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
      const already = recent?.some(
        (m) => m.author.id === client.user.id && m.embeds[0]?.title === title,
      );
      if (already) {
        console.log("message exists:", title);
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(hex(brand))
        .setTitle(title)
        .setDescription(replaceRefs(description).slice(0, 4000))
        .setFooter({ text: "codeX · Premium Digital Services" })
        .setTimestamp();
      await channel.send({ embeds: [embed] });
      console.log("posted:", title);
      await sleep(600);
    }

    await postOnce(
      "welcome",
      "أهلاً بك في codeX",
      stripMdHeading(readMsg("welcome")),
    );
    await postOnce("rules", "قوانين سيرفر codeX", stripMdHeading(readMsg("rules")));
    await postOnce("store", "متجر codeX الرسمي", stripMdHeading(readMsg("store")));
    await postOnce(
      "tickets",
      "الدعم والطلبات",
      stripMdHeading(readMsg("tickets")),
    );

    // Store button-like link message
    if (channelIds.store) {
      const storeCh = await guild.channels.fetch(channelIds.store);
      const recent = await storeCh.messages.fetch({ limit: 10 });
      const hasLink = recent.some(
        (m) =>
          m.author.id === client.user.id &&
          m.content.includes(structure.storeUrl),
      );
      if (!hasLink) {
        await storeCh.send(`🛒 **رابط المتجر:** ${structure.storeUrl}`);
      }
    }

    console.log("SUCCESS");
    console.log(
      JSON.stringify(
        {
          channels: channelIds,
          inviteHint: "https://discord.gg/pXAzQjENM",
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error("SETUP_FAILED", e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(TOKEN).catch((e) => {
  console.error("LOGIN_FAILED", e.message);
  process.exit(1);
});
