import { Client, GatewayIntentBits, AttachmentBuilder, ChannelType } from "discord.js";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch("1524901009195798679");
    await guild.channels.fetch();
    const ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.includes("الترحيب"))
      || guild.channels.cache.find(c => c.type === ChannelType.GuildText);
    const files = [
      new AttachmentBuilder("C:/Users/Admin/Projects/codeX/public/discord/codex-divider-stars.png", { name: "codex-divider-stars.png" }),
      new AttachmentBuilder("C:/Users/Admin/Projects/codeX/public/discord/codex-banner-stars.png", { name: "codex-banner-stars.png" }),
      new AttachmentBuilder("C:/Users/Admin/Projects/codeX/public/discord/codex-icon-stars.png", { name: "codex-icon-stars.png" }),
    ];
    await ch.send({
      content: "**تصميم codeX** — خلفية سوداء + نجوم بيضاء + الشعار في الوسط:",
      files,
    });
    console.log("posted to", ch.name);
    console.log("SUCCESS");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});
client.login(TOKEN);