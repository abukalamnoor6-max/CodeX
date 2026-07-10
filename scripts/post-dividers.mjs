import { Client, GatewayIntentBits, AttachmentBuilder, ChannelType } from "discord.js";
import fs from "fs";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = "1524901009195798679";
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && (c.name.includes("الترحيب") || c.name.includes("الموقع")));
    if (!ch) ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.includes("شات"));
    const a1 = new AttachmentBuilder("C:/Users/Admin/Projects/codeX/public/discord/codex-divider.png", { name: "codex-divider.png" });
    const a2 = new AttachmentBuilder("C:/Users/Admin/Projects/codeX/public/discord/codex-divider-v2.png", { name: "codex-divider-v2.png" });
    await ch.send({ content: "**خطوط codeX الفاصلة** — استخدمها في الرومات:", files: [a1, a2] });
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