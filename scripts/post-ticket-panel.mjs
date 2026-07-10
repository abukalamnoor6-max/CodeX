import { Client, GatewayIntentBits } from "discord.js";
import { postTicketPanel } from "./lib/tickets.mjs";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    const id = await postTicketPanel(client);
    console.log("SUCCESS panel in", id);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(TOKEN);
