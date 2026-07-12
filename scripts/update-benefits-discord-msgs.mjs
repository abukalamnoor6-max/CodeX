import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from "discord.js";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = "1524901009195798679";
const STORE_URL = "https://codexshop112.rmz.gg";
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
function embed(title, description) {
  return new EmbedBuilder().setColor(0x0059db).setTitle(title).setDescription(description)
    .setFooter({ text: "𝐂𝐨𝐝𝐞𝐗 · Premium Digital Services" }).setTimestamp();
}
async function clearBot(channel) {
  const msgs = await channel.messages.fetch({ limit: 20 });
  for (const m of msgs.values()) if (m.author.id === client.user.id) await m.delete().catch(()=>{});
}
client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    const find = (parts) => guild.channels.cache.find(c => c.type === ChannelType.GuildText && parts.some(p => c.name.includes(p)));
    const welcome = find(["الترحيب"]);
    const store = find(["المتجر"]);
    const tickets = find(["فتح-تذكرة","تذكرة"]);
    const customer = guild.roles.cache.find(r => r.name.includes("Customer"));
    const mention = customer ? `<@&${customer.id}>` : "**🛒 Customer**";

    const rank = embed("كيف تاخذ رتبة الزبون؟", [
      "السلام عليكم ورحمة الله وبركاته",
      "",
      "رتبة الزبون صارت مربوطة بقسم **المزايا** في متجر 𝐂𝐨𝐝𝐞𝐗.",
      "",
      "**وش تسوي؟**",
      `1. ادخل المتجر: ${STORE_URL}`,
      "2. اشترِ أي منتج",
      "3. بعد الشراء ادخل حسابك في المتجر",
      "4. روح **مزاياي**",
      "5. اضغط **ربط Discord**",
      `6. تنضاف لك رتبة ${mention} تلقائياً`,
      "",
      "إذا ظهرت حالة **قيد الانتظار** معناها الميزة جاهزة وبانتظار ربط حسابك.",
      "",
      "شكراً لكم 💙",
    ].join("\n"));

    const waiting = embed("المزايا وربط Discord", [
      "بعد الشراء تظهر لك ميزة **𝐂𝐨𝐝𝐞𝐗 Discord** في صفحة **مزاياي**.",
      "",
      "**قيد الانتظار** = اضغط ربط Discord عشان تاخذ الرتبة.",
      "",
      `🛒 ${STORE_URL}`,
    ].join("\n"));

    if (welcome) { await clearBot(welcome); await welcome.send({ embeds: [rank] }); }
    if (store) {
      await clearBot(store);
      await store.send({ embeds: [
        embed("متجر 𝐂𝐨𝐝𝐞𝐗 الرسمي", [`🔗 ${STORE_URL}`, "", "**الخدمات**", "• برمجة فايف إم", "• مابات فايف إم", "• بوتات دسكورد", "• سيرفر دسكورد كامل", "• خاص المتجر"].join("\n")),
        waiting,
      ]});
      await store.send(`🛒 **رابط المتجر:** ${STORE_URL}`);
    }
    if (tickets) {
      await clearBot(tickets);
      await tickets.send({ embeds: [
        embed("الدعم — سبورت 𝐂𝐨𝐝𝐞𝐗", ["للدعم بعد الشراء أو مشكلة ربط المزايا:", "افتح تذكرة واكتب رقم الطلب + المشكلة بوضوح."].join("\n")),
        embed("قوانين التكتات", ["• تذكرة واحدة لنفس المشكلة", "• ممنوع السبام", "• وضّح مشكلتك من أول رسالة", "• أرفق رقم الطلب عند طلب الرتبة/الربط", "• أي إساءة = إغلاق التذكرة"].join("\n")),
      ]});
    }
    console.log("DISCORD_MSGS_UPDATED");
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { client.destroy(); }
});
client.login(TOKEN);