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

function embed(title, description, extra = {}) {
  const e = new EmbedBuilder()
    .setColor(0x0059db)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "codeX · Premium Digital Services" })
    .setTimestamp();
  if (extra.thumbnail) e.setThumbnail(extra.thumbnail);
  return e;
}

async function clearBotMessages(channel, limit = 15) {
  const messages = await channel.messages.fetch({ limit });
  for (const m of messages.values()) {
    if (m.author.id === client.user.id) {
      await m.delete().catch(() => {});
    }
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
    const customerRole =
      guild.roles.cache.find((r) => r.name.includes("Customer")) ||
      guild.roles.cache.find((r) => r.name.includes("Member"));

    const customerMention = customerRole
      ? `<@&${customerRole.id}>`
      : "**🛒 Customer**";

    // 1) رتبة العميل — مثل الصورة الأولى
    const rankEmbed = embed(
      "رتبة العميل في codeX",
      [
        "السلام عليكم ورحمة الله وبركاته",
        "",
        "بسبب كثرة الاستفسارات عن **رتبة العميل**، نوضّح كل شيء عنها هنا:",
        "",
        "**ما هي رتبة العميل؟**",
        "رتبة مخصّصة فقط للزبائن اللي اشتروا من قبل أو عندهم اشتراك/طلب فعّال في المتجر.",
        "",
        "**وش فايدتها؟**",
        "• الدخول لقنوات العملاء الخاصة والخدمات",
        "• إمكانية فتح تذكرة دعم عند الحاجة",
        "• تنبيهات وعروض خاصة للعملاء",
        "",
        "**كيف تحصل على الرتبة؟**",
        `1. ادخل موقع المتجر: ${STORE_URL}`,
        "2. سجّل دخول لحسابك (من أعلى الصفحة)",
        "3. ادخل قسم **المزايا**",
        "4. اضغط **ربط Discord**",
        "5. بعد الربط تنضاف رتبة العميل تلقائياً",
        "",
        "**ملاحظة مهمة:**",
        "التذاكر مخصّصة لأصحاب رتبة العميل فقط.",
        "إذا ربطت حسابك وما وصلك الرتبة، افتح تذكرة عامة وبلّغنا.",
        "",
        "شكراً لكم، ونتمنى لكم تجربة ممتعة مع المتجر 💙",
      ].join("\n"),
    );

    // 2) الانتظار / المزايا — مثل صورة مزاياي
    const waitingEmbed = embed(
      "المزايا وربط Discord",
      [
        "بعد الشراء تظهر لك ميزة **ربط Discord** في صفحة **مزاياي** داخل المتجر.",
        "",
        "**حالة قيد الانتظار**",
        "إذا شفت حالة `قيد الانتظار` معناها الميزة جاهزة، وبانتظار ربط حسابك.",
        "",
        "**وش تسوي؟**",
        `1. افتح المتجر: ${STORE_URL}`,
        "2. ادخل حسابك",
        "3. روح **المزايا**",
        "4. اضغط **ربط Discord**",
        "5. بعد الربط تحصل على رتبة الدخول للقنوات الخاصة والتنبيهات",
        "",
        "إذا بقيت على `قيد الانتظار` بعد الربط، تواصل معنا من روم التذاكر.",
      ].join("\n"),
    );

    // 3) قوانين التكتات — مثل الصورة الثالثة
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
        `• تذكرة المشاكل مخصّصة فقط لمن لديه رتبة العميل ${customerMention}`,
        "• إذا فتحت تذكرة عامة وكتبت مشكلتك فيها قد يتم تجاهلها",
        "• بعد إغلاق التذكرة يصلك أرشيف المحادثة للمراجعة عند الحاجة",
      ].join("\n"),
    );

    const supportEmbed = embed(
      "الدعم — سبورت codeX",
      [
        "هنا قسم **السبورت** لمتابعة الطلبات والمشاكل بعد الشراء.",
        "",
        "**متى تفتح تذكرة؟**",
        "• استفسار عن طلب قائم",
        "• مشكلة بعد التسليم",
        "• تأخر أو حالة `قيد الانتظار` ما تتحدث",
        "• ربط Discord ما أعطاك الرتبة",
        "",
        "**قبل ما تفتح**",
        "1. تأكد إنك مربوط دسكورد من المزايا",
        "2. جهّز رقم الطلب",
        "3. اكتب المشكلة بوضوح من أول رسالة",
        "",
        "اقرأ قوانين التكتات تحت، ثم افتح تذكرتك.",
      ].join("\n"),
    );

    if (welcome) {
      await clearBotMessages(welcome);
      await welcome.send({ embeds: [rankEmbed] });
      console.log("posted rank ->", welcome.name);
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
          "**أيضاً في المتجر**",
          "• انتظار (حالة المزايا / الربط)",
          "• سبورت (الدعم عبر التذاكر)",
        ].join("\n"),
      );
      await store.send({ embeds: [storeServices, waitingEmbed] });
      await store.send(`🛒 **رابط المتجر:** ${STORE_URL}`);
      console.log("posted store+waiting ->", store.name);
    }

    if (tickets) {
      await clearBotMessages(tickets);
      await tickets.send({ embeds: [supportEmbed, ticketRulesEmbed] });
      console.log("posted support+rules ->", tickets.name);
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
