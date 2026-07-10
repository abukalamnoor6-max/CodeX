import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ChannelType,
} from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
const STORE_URL = "https://codexshop112.rmz.gg";

if (!TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function embed(title, description) {
  return new EmbedBuilder()
    .setColor(0x0059db)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "codeX · Premium Digital Services" })
    .setTimestamp();
}

async function clearBotMessages(channel, limit = 20) {
  const messages = await channel.messages.fetch({ limit });
  for (const m of messages.values()) {
    if (m.author.id === client.user.id) await m.delete().catch(() => {});
  }
}

async function findChannel(guild, includes) {
  return guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      includes.some((x) => c.name.includes(x)),
  );
}

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();

    const welcome = await findChannel(guild, ["الترحيب"]);
    const store = await findChannel(guild, ["المتجر"]);
    const tickets = await findChannel(guild, ["فتح-تذكرة", "تذكرة"]);
    const customerRole = guild.roles.cache.find((r) =>
      r.name.includes("Customer"),
    );
    const customerMention = customerRole
      ? `<@&${customerRole.id}>`
      : "**🛒 Customer**";

    const rankEmbed = embed(
      "كيف تاخذ رتبة الزبون؟",
      [
        "السلام عليكم ورحمة الله وبركاته",
        "",
        "رتبة الزبون **🛒 Customer** مخصّصة للي اشترى من متجر codeX.",
        "",
        "**وش فايدتها؟**",
        "• تمييزك كعميل رسمي",
        "• أولوية في الدعم والتذاكر",
        "• تنبيهات وعروض خاصة للعملاء",
        "",
        "**طريقة الحصول عليها (الحالية):**",
        `1. اطلب من المتجر: ${STORE_URL}`,
        "2. بعد الدفع، افتح تذكرة من روم التذاكر",
        "3. أرسل رقم الطلب / إثبات الدفع",
        `4. الطاقم يعطيك رتبة ${customerMention}`,
        "",
        "**ملاحظة:**",
        "قسم «المزايا / ربط Discord» التلقائي مو مفعّل حالياً في المتجر.",
        "لذلك الرتبة تُمنح يدوياً بعد التحقق من الطلب.",
        "",
        "شكراً لكم، ونتمنى لكم تجربة ممتعة مع المتجر 💙",
      ].join("\n"),
    );

    const waitingEmbed = embed(
      "الانتظار والدعم",
      [
        "**انتظار**",
        "إذا طلبك تحت التنفيذ، حالتك تكون بانتظار التسليم.",
        "لا تفتح أكثر من تذكرة لنفس الطلب — تابع من نفس التذكرة.",
        "",
        "**سبورت**",
        "للدعم بعد الشراء، أو تأخر الطلب، أو استلام الرتبة:",
        "افتح تذكرة واكتب رقم الطلب + مشكلتك بوضوح.",
        "",
        `🛒 المتجر: ${STORE_URL}`,
      ].join("\n"),
    );

    const ticketRulesEmbed = embed(
      "قوانين التكتات",
      [
        "• افتح تذكرة واحدة فقط لنفس المشكلة",
        "• ممنوع السبام أو منشن الإدارة بدون سبب",
        "• الرد قد يتأخر حسب الضغط أو الظروف",
        "• وضّح مشكلتك من أول رسالة",
        "• أرسل صور/فيديو إذا يحتاج التوضيح",
        "• أي إساءة أو قلة احترام = إغلاق التذكرة",
        "• إذا انحلّت المشكلة تُغلق التذكرة",
        "• ممنوع فتح تذكرة بدون سبب أو للمزاح",
        `• تذاكر العملاء بعد الشراء تُعالج مع رتبة ${customerMention}`,
        "• لطلب رتبة الزبون: أرفق رقم الطلب في التذكرة",
        "• بعد إغلاق التذكرة قد يصلك أرشيف المحادثة للمراجعة",
      ].join("\n"),
    );

    const supportEmbed = embed(
      "الدعم — سبورت codeX",
      [
        "هنا قسم **السبورت** لمتابعة الطلبات والمشاكل.",
        "",
        "**متى تفتح تذكرة؟**",
        "• طلب جديد / متابعة طلب",
        "• استلام رتبة الزبون بعد الشراء",
        "• مشكلة بعد التسليم",
        "• استفسار عن خدمة",
        "",
        "**اكتب في أول رسالة:**",
        "1. نوع الطلب",
        "2. رقم الطلب (إن وجد)",
        "3. تفاصيل واضحة",
      ].join("\n"),
    );

    if (welcome) {
      await clearBotMessages(welcome);
      await welcome.send({ embeds: [rankEmbed] });
      console.log("updated welcome");
    }
    if (store) {
      await clearBotMessages(store);
      const storeServices = embed(
        "متجر codeX الرسمي",
        [
          `🔗 ${STORE_URL}`,
          "",
          "**الخدمات**",
          "• برمجة فايف إم",
          "• مابات فايف إم بشعار سيرفرك",
          "• سيارة خاصة",
          "• بوت دسكورد متقدم / متوسط / أساسي",
          "• برمجة سيرفر دسكورد كامل",
          "• خاص المتجر",
          "",
          "**أيضاً**",
          "• انتظار (متابعة الطلب)",
          "• سبورت (الدعم عبر التذاكر)",
        ].join("\n"),
      );
      await store.send({ embeds: [storeServices, waitingEmbed] });
      await store.send(`🛒 **رابط المتجر:** ${STORE_URL}`);
      console.log("updated store");
    }
    if (tickets) {
      await clearBotMessages(tickets);
      await tickets.send({ embeds: [supportEmbed, ticketRulesEmbed] });
      console.log("updated tickets");
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
