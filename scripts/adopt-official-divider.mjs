import { Client, GatewayIntentBits, AttachmentBuilder, ChannelType } from "discord.js";
import fs from "fs";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch("1524901009195798679");
    await guild.channels.fetch();
    const ch =
      guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name.includes("الترحيب")) ||
      guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name.includes("الموقع"));

    const file = new AttachmentBuilder(
      "C:/Users/Admin/Projects/codeX/public/discord/codex-divider-official.png",
      { name: "codex-divider-official.png" },
    );
    await ch.send({
      content: "✅ **تم اعتماد خط codeX الرسمي**\nاستخدموا هالصورة كفاصل في الرومات:",
      files: [file],
    });

    // Try set banner (may fail without boost)
    try {
      const buf = fs.readFileSync("C:/Users/Admin/Projects/codeX/public/discord/codex-banner-stars.png");
      await guild.setBanner(buf);
      console.log("banner updated");
    } catch (e) {
      console.log("banner skip:", e.message);
    }

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