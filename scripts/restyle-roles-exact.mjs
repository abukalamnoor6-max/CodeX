import { Client, GatewayIntentBits } from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
if (!TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

/** ASCII → Mathematical Bold (Discord fancy role look) */
function bold(text) {
  const A = 0x1d400; // 𝐀
  const a = 0x1d41a; // 𝐚
  return [...text]
    .map((ch) => {
      const c = ch.codePointAt(0);
      if (c >= 65 && c <= 90) return String.fromCodePoint(A + (c - 65));
      if (c >= 97 && c <= 122) return String.fromCodePoint(a + (c - 97));
      return ch;
    })
    .join("");
}

const BAR = "〢";

// Exact order top → bottom (under bot), matching the screenshot
const TARGET = [
  {
    key: "sep_joker",
    name: "🃏",
    color: 0x2b2d31,
    hoist: false,
    match: [/^🃏$/, /joker/i],
  },
  {
    key: "bot",
    name: `⭐ ${bold("BOT")} ツ`,
    color: 0x95a5a6,
    hoist: false,
    match: [/^⭐?\s*𝐁𝐎𝐓/, /^Bot$/i, /🤖|ＢＯＴ/],
  },
  {
    key: "owner",
    name: `${BAR} ${bold("OWNER")}`,
    color: 0xffffff,
    hoist: true,
    match: [/𝐎𝐖𝐍𝐄𝐑|OWNER|Founder|مالك|ＯＷＮＥＲ/i],
  },
  {
    key: "sep_x",
    name: "✕",
    color: 0x2b2d31,
    hoist: false,
    match: [/^✕$/, /^×$/, /^x$/i],
  },
  {
    key: "team",
    name: `${BAR} ${bold("TEAM")} ${bold("CodeX")}`,
    color: 0x57f287,
    hoist: true,
    match: [/𝐓𝐄𝐀𝐌|TEAM\s*CodeX|Co\s*Founder|Admin|Support|Advisor|Developer|Designer|فريق/i],
  },
  {
    key: "partner",
    name: `${BAR} ${bold("Partner")}`,
    color: 0xed4245,
    hoist: true,
    match: [/𝐏𝐚𝐫𝐭𝐧𝐞𝐫|Partner|شريك/i],
  },
  {
    key: "vip",
    name: `${BAR} ${bold("VIP")} ${bold("CodeX")}`,
    color: 0xc3b1e1,
    hoist: true,
    match: [/𝐕𝐈𝐏|VIP|ＶＩＰ/i],
  },
  {
    key: "premium",
    name: `${BAR} ${bold("Premium")} ${bold("Client")}`,
    color: 0x00b0f4,
    hoist: true,
    match: [/𝐏𝐫𝐞𝐦𝐢𝐮𝐦|Premium/i],
  },
  {
    key: "client",
    name: `${BAR} ${bold("Client")}`,
    color: 0x0059db,
    hoist: true,
    match: [/𝐂𝐥𝐢𝐞𝐧𝐭|^⭐?\s*Client$|Customer|زبون|عميل|ＣＬＩＥＮＴ/i],
  },
  {
    key: "visitor",
    name: `${BAR} ${bold("Visitor")}`,
    color: 0xfee75c,
    hoist: true,
    match: [/𝐕𝐢𝐬𝐢𝐭𝐨𝐫|Visitor|Member|عضو|ＭＥＭＢＥＲ/i],
  },
  {
    key: "booster",
    name: `${BAR} ${bold("BOOSTER")}`,
    color: 0xf47fff,
    hoist: true,
    match: [/𝐁𝐎𝐎𝐒𝐓𝐄𝐑|BOOSTER|Booster|Server Booster/i],
  },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function findRole(guild, spec, claimed) {
  for (const re of spec.match) {
    const hit = guild.roles.cache.find(
      (r) =>
        !r.managed &&
        r.name !== "@everyone" &&
        !claimed.has(r.id) &&
        re.test(r.name),
    );
    if (hit) return hit;
  }
  return null;
}

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();
    const claimed = new Set();
    const byKey = {};

    // 1) Match / create each target role
    for (const spec of TARGET) {
      let role = findRole(guild, spec, claimed);
      if (!role) {
        role = await guild.roles.create({
          name: spec.name,
          colors: { primaryColor: spec.color },
          hoist: spec.hoist,
          mentionable: false,
          reason: "codeX role restyle exact",
        });
        console.log("created", spec.name);
      } else {
        try {
          await role.edit({
            name: spec.name,
            colors: { primaryColor: spec.color },
            hoist: spec.hoist,
            mentionable: false,
          });
        } catch {
          await role.edit({
            name: spec.name,
            color: spec.color,
            hoist: spec.hoist,
            mentionable: false,
          });
        }
        console.log("updated", role.id, "->", spec.name);
      }
      claimed.add(role.id);
      byKey[spec.key] = role;
      await new Promise((r) => setTimeout(r, 400));
    }

    // 2) Fold leftover old staff roles into TEAM (rename away / delete if empty)
    const keepIds = new Set(Object.values(byKey).map((r) => r.id));
    const leftovers = [...guild.roles.cache.values()].filter(
      (r) =>
        !r.managed &&
        r.name !== "@everyone" &&
        !keepIds.has(r.id) &&
        /Founder|Advisor|Developer|Designer|Support|Admin|Member|Bot|VIP|Client|Customer|Owner/i.test(
          r.name,
        ),
    );

    // Don't fetch all guild members (can hang). Delete leftovers if empty in cache.
    for (const role of leftovers) {
      try {
        if (role.members.size === 0) {
          await role.delete("codeX role cleanup — replaced by new style");
          console.log("deleted", role.name);
        } else {
          console.log("keep leftover (has members)", role.name, role.members.size);
        }
      } catch (e) {
        console.log("cleanup skip", role.name, e.message);
      }
      await new Promise((r) => setTimeout(r, 350));
    }

    // 3) Hierarchy: top → bottom under bot role
    const me = await guild.members.fetchMe();
    let pos = me.roles.highest.position - 1;
    for (const spec of TARGET) {
      const role = byKey[spec.key];
      if (!role || role.managed) continue;
      try {
        await role.setPosition(Math.max(1, pos));
        console.log("pos", spec.name, "->", pos);
        pos -= 1;
        await new Promise((r) => setTimeout(r, 350));
      } catch (e) {
        console.log("pos skip", spec.name, e.message);
      }
    }

    // Keep RMZ bot role above Client so it can assign Client
    const rmz = guild.roles.cache.find(
      (r) => r.managed && /rmz|رمز/i.test(r.name),
    );
    const clientRole = byKey.client;
    if (rmz && clientRole && rmz.position <= clientRole.position) {
      console.log(
        "NOTE: move RMZGG role above Client manually if RMZ can't assign Client",
        { rmz: rmz.position, client: clientRole.position },
      );
    }

    await guild.roles.fetch();
    const list = [...guild.roles.cache.values()]
      .filter((r) => r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((r) => `${r.position}|${r.name}${r.managed ? " [managed]" : ""}`);
    console.log(list.join("\n"));
    console.log("SUCCESS");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(TOKEN);
