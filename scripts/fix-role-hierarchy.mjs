import { Client, GatewayIntentBits } from "discord.js";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = "1524901009195798679";
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();
    const roles = [...guild.roles.cache.values()]
      .sort((a,b) => b.position - a.position)
      .map(r => ({ name: r.name, pos: r.position, id: r.id, managed: r.managed, botId: r.tags?.botId }));
    console.log(JSON.stringify(roles, null, 2));

    const customer = guild.roles.cache.find(r => r.name.includes("Customer"));
    const rmzBot = guild.roles.cache.find(r => r.managed && /rmz|رمز/i.test(r.name))
      || guild.roles.cache.find(r => r.managed && r.name !== "@everyone" && !r.name.includes("CodeX"));
    // Also list managed roles
    const managed = roles.filter(r => r.managed);
    console.log("managed", managed);
    console.log("customer", customer && {name: customer.name, pos: customer.position});
    console.log("rmzBotGuess", rmzBot && {name: rmzBot.name, pos: rmzBot.position});

    // Our bot CodeX can only move roles below itself. RMZ bot role must be moved by server owner in Discord UI if higher.
    // Try to move Customer below highest manageable position under our bot.
    const me = await guild.members.fetchMe();
    const myTop = me.roles.highest;
    console.log("myHighest", myTop.name, myTop.position);

    if (customer && customer.position >= myTop.position) {
      // move customer down under our bot
      await customer.setPosition(Math.max(1, myTop.position - 1));
      console.log("moved Customer under CodeX bot");
    }

    // Ensure Customer is below any RMZ managed role if we can compare
    if (customer && rmzBot && customer.position >= rmzBot.position && rmzBot.position < myTop.position) {
      await customer.setPosition(Math.max(1, rmzBot.position - 1));
      console.log("moved Customer under RMZ bot");
    }

    const after = [...guild.roles.cache.values()].sort((a,b)=>b.position-a.position).map(r=>`${r.position}|${r.name}|managed=${r.managed}`);
    console.log(after.join("\n"));
    console.log("SUCCESS");
  } catch (e) {
    console.error("FAIL", e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});
client.login(TOKEN);