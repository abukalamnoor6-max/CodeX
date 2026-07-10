import { Client, GatewayIntentBits, ChannelType } from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();
  const cats = [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildCategory)
    .map((c) => c.name);
  console.log("CATEGORIES", cats);
  const logs = [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildText)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      name: c.name,
      parent: c.parent?.name || null,
    }));
  console.log(JSON.stringify(logs, null, 2));
  client.destroy();
});
client.login(TOKEN);
