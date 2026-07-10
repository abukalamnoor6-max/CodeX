import { Client, GatewayIntentBits, AttachmentBuilder } from "discord.js";
import { renderWelcomeCard } from "./lib/welcome-card.mjs";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_WELCOME_CHANNEL_ID || "1524961216097816717";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";
const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(OWNER_ID);
    const png = await renderWelcomeCard({
      displayName: member.displayName,
      username: member.user.username,
      avatarUrl: member.user.displayAvatarURL({
        extension: "png",
        size: 256,
        forceStatic: true,
      }),
      memberCount: guild.memberCount,
    });
    const ch = await client.channels.fetch(CHANNEL_ID);
    await ch.send({
      content: `مرحباً <@${member.id}> في **codeX** 🖤`,
      files: [new AttachmentBuilder(png, { name: "codex-welcome.png" })],
      allowedMentions: { users: [member.id] },
    });
    console.log("SUCCESS preview posted");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(TOKEN);
