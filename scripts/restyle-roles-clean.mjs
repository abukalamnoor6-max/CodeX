import { Client, GatewayIntentBits } from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
if (!TOKEN) process.exit(1);

// Clean premium style like the screenshots
const ROLES = [
  { match: /Owner|ＯＷＮＥＲ|مالك|Founder/i, name: "🔒Founder", color: 0xF5C542 },
  { match: /Admin|ＡＤＭＩＮ|ادمن|Co\s*Founder/i, name: "🔒Co Founder", color: 0xC0C7D1 },
  { match: /Developer|ＤＥＶ|مطور|Server Developer/i, name: "Server Developer", color: 0xE8B923 },
  { match: /Support|ＳＵＰＰＯＲＴ|دعم|Advisor/i, name: "Senior Advisor", color: 0xB8C0CC },
  { match: /Designer|ＤＥＳＩＧＮ|تصميم/i, name: "Creative Designer", color: 0xC084FC },
  { match: /VIP|ＶＩＰ/i, name: "⭐ VIP", color: 0xF472B6 },
  { match: /Customer|ＣＬＩＥＮＴ|زبون|عميل|Client/i, name: "⭐ Client", color: 0x60A5FA },
  { match: /Member|ＭＥＭＢＥＲ|عضو/i, name: "Member", color: 0x94A3B8 },
  { match: /Bot|ＢＯＴＳ|🤖/i, name: "Bot", color: 0x64748B },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();

    for (const spec of ROLES) {
      const role = guild.roles.cache.find((r) => spec.match.test(r.name) && !r.managed);
      if (!role) {
        console.log("missing", spec.name);
        continue;
      }
      try {
        await role.edit({
          name: spec.name,
          colors: { primaryColor: spec.color },
          hoist: !/Member|Bot/i.test(spec.name),
          mentionable: false,
        });
        console.log("ok", role.id, "->", spec.name);
      } catch (e) {
        // fallback old color API
        try {
          await role.edit({ name: spec.name, color: spec.color, hoist: !/Member|Bot/i.test(spec.name) });
          console.log("ok-fallback", spec.name);
        } catch (e2) {
          console.log("fail", role.name, e2.message);
        }
      }
      await new Promise((r) => setTimeout(r, 450));
    }

    // Ensure hierarchy looks right (high -> low under bot)
    const order = [
      "🔒Founder",
      "🔒Co Founder",
      "Server Developer",
      "Senior Advisor",
      "Creative Designer",
      "⭐ VIP",
      "⭐ Client",
      "Member",
      "Bot",
    ];
    const me = await guild.members.fetchMe();
    let pos = me.roles.highest.position - 1;
    for (const name of order) {
      const role = guild.roles.cache.find((r) => r.name === name);
      if (!role || role.managed) continue;
      try {
        await role.setPosition(Math.max(1, pos));
        console.log("pos", name, "->", pos);
        pos -= 1;
        await new Promise((r) => setTimeout(r, 350));
      } catch (e) {
        console.log("pos skip", name, e.message);
      }
    }

    const list = [...guild.roles.cache.values()]
      .filter((r) => !r.managed && r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((r) => `${r.position}|${r.name}`);
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