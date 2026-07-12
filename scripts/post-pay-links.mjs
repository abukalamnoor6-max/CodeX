import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(p) {
  if (!fs.existsSync(p)) return {};
  const o = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    o[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return o;
}

const env = {
  ...loadEnv(path.join(root, ".env")),
  ...loadEnv(path.join(root, ".env.local")),
  ...loadEnv(path.join(root, ".env.bot.railway")),
};
const token = env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("NO_TOKEN");
  process.exit(1);
}

const CHANNEL = process.argv[2] || "1525807603546849433";
const BASE = "https://codex-delivery-bot-production.up.railway.app/pay";
const pay = (name, usd) =>
  `${BASE}?amount=${usd}&name=${encodeURIComponent(name)}`;

const groups = [
  {
    title: "بوستات دسكورد",
    color: 0x5865f2,
    items: [
      ["بوستات شهر — 8 بوستات", 3.47, 13],
      ["بوستات شهر — 10 بوستات", 4.27, 16],
      ["بوستات شهر — 12 بوستات", 4.8, 18],
      ["بوستات شهر — 14 بوستات", 5.6, 21],
      ["بوستات شهر — 20 بوستات", 7.73, 29],
      ["بوستات 3 شهور — 14 بوستات", 13.87, 52],
      ["بوستات 3 شهور — 20 بوستات", 19.73, 74],
    ],
  },
  {
    title: "توكنات وحسابات دسكورد",
    color: 0x57f287,
    items: [
      ["توكنات دسكورد — 2 توكن", 2.13, 8],
      ["توكنات دسكورد — 7 توكنات", 5.87, 22],
      ["حساب دسكورد — 2026", 1.6, 6],
      ["حساب دسكورد — 2025", 1.87, 7],
      ["حساب دسكورد — 2024", 2.13, 8],
      ["حساب دسكورد — 2023", 2.4, 9],
      ["حساب دسكورد — 2022", 2.67, 10],
      ["حساب دسكورد — 2021", 3.2, 12],
    ],
  },
  {
    title: "اشتراكات",
    color: 0xeb459e,
    items: [
      ["سناب بلس — 3 شهور", 7.73, 29],
      ["سناب بلس — 6 شهور", 14.67, 55],
      ["سناب بلس — سنة", 29.07, 109],
      ["نتفلكس — شهر حساب كامل", 5.87, 22],
      ["نتفلكس — شهر برو", 14.67, 55],
      ["نتفلكس — 3 شهور", 38.67, 145],
      ["شاهد — شهر خاص", 4.8, 18],
      ["شاهد — شهر كامل", 9.33, 35],
      ["شاهد — سنة كامل", 49.33, 185],
      ["جيمناي — شهر", 3.73, 14],
      ["جيمناي — 3 شهور", 6.67, 25],
      ["جيمناي — 6 شهور", 15.73, 59],
      ["جيمناي — سنة", 21.07, 79],
    ],
  },
  {
    title: "بوتات + فايف إم + نيترو",
    color: 0xfee75c,
    items: [
      ["بوت دسكورد متقدم", 33, 125],
      ["بوت دسكورد متوسط", 20, 75],
      ["بوت دسكورد أساسي", 8, 30],
      ["برمجة سيرفر دسكورد بشكل كامل", 53, 200],
      ["برمجة فايف إم", 213, 800],
      ["مابات فايف إم بشعار سيرفرك", 21, 80],
      ["نيترو سنة", 27, 100],
      ["نيترو 3 شهور", 13, 50],
      ["يوتيوب بريميوم", 8, 30],
      ["خاص بي المتجر", 1, 4],
    ],
  },
];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function shortLabel(name) {
  const s = String(name);
  return s.length > 70 ? `${s.slice(0, 67)}...` : s;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    const ch = await client.channels.fetch(CHANNEL);

    // Delete previous bot messages in this channel (cleanup messy URLs)
    let deleted = 0;
    let before;
    for (let i = 0; i < 8; i++) {
      const batch = await ch.messages.fetch({ limit: 50, ...(before ? { before } : {}) });
      if (!batch.size) break;
      before = batch.last()?.id;
      for (const msg of batch.values()) {
        if (msg.author?.id !== client.user.id) continue;
        await msg.delete().catch(() => {});
        deleted += 1;
        await new Promise((r) => setTimeout(r, 350));
      }
    }
    console.log("deleted", deleted);

    await ch.send({
      content:
        "روابط الدفع الرسمية لـ **𝐂𝐨𝐝𝐞𝐗**\nاضغط زر المنتج → اكتب يوزر دسكورد للتوصيل → الدفع (PayPal / بطاقة).",
    });

    for (const g of groups) {
      // Max 5 link buttons per row, 5 rows => 25 buttons max per message.
      // Keep 5 products per message for clean layout.
      const parts = chunk(g.items, 5);
      for (let pi = 0; pi < parts.length; pi++) {
        const items = parts[pi];
        const lines = items.map(
          ([n, usd, sar], idx) =>
            `**${idx + 1}. ${n}**\nالسعر: **${sar} ر.س** (≈ ${usd} دولار)`,
        );
        const embed = new EmbedBuilder()
          .setColor(g.color)
          .setTitle(
            parts.length > 1 ? `${g.title} (${pi + 1}/${parts.length})` : g.title,
          )
          .setDescription(lines.join("\n\n"))
          .setFooter({ text: "𝐂𝐨𝐝𝐞𝐗 • اضغط الزر تحت للدفع" });

        const rows = [];
        for (const btnChunk of chunk(items, 5)) {
          const row = new ActionRowBuilder();
          for (const [n, usd] of btnChunk) {
            row.addComponents(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(pay(n, usd))
                .setLabel(shortLabel(n)),
            );
          }
          rows.push(row);
        }

        await ch.send({ embeds: [embed], components: rows });
        await new Promise((r) => setTimeout(r, 700));
      }
    }
    console.log("DONE", CHANNEL);
  } catch (e) {
    console.error("FAIL", e.message);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);
