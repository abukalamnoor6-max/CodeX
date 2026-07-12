import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
} from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
const STORE_CHANNEL_ID = "1524961223156695200";

if (!TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

const description = [
  "**متجر 𝐂𝐨𝐝𝐞𝐗 الرسمي**",
  "",
  "🔗 https://codexshop112.rmz.gg",
  "",
  "### الخدمات",
  "• برمجة فايف إم",
  "• مابات فايف إم بشعار سيرفرك",
  "• بوت دسكورد متقدم",
  "• بوت دسكورد متوسط",
  "• بوت دسكورد أساسي",
  "• برمجة سيرفر دسكورد كامل",
  "• خاص المتجر",
  "• انتظار",
  "• سبورت",
  "",
  "### طريقة الطلب",
  "1. اختر المنتج من المتجر",
  "2. أو افتح تذكرة من روم التذاكر",
  "3. أرسل تفاصيل طلبك",
  "",
  "💳 الدفع عبر الوسائل المتاحة في المتجر.",
].join("\n");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    const channel = await client.channels.fetch(STORE_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 20 });
    const mine = messages.filter((m) => m.author.id === client.user.id);

    // Delete old bot messages in store channel, then post fresh
    for (const m of mine.values()) {
      await m.delete().catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setColor(0x0059db)
      .setTitle("متجر 𝐂𝐨𝐝𝐞𝐗 الرسمي")
      .setDescription(description)
      .setFooter({ text: "𝐂𝐨𝐝𝐞𝐗 · Premium Digital Services" })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    await channel.send("🛒 **رابط المتجر:** https://codexshop112.rmz.gg");
    console.log("SUCCESS");
  } catch (e) {
    console.error("FAILED", e.message);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(TOKEN).catch((e) => {
  console.error("LOGIN_FAILED", e.message);
  process.exit(1);
});
