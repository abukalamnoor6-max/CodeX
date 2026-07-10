import { Client, GatewayIntentBits } from "discord.js";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = "1524901009195798679";
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();
    const byName = (n) => guild.roles.cache.find(r => r.name === n || r.name.includes(n));
    // Desired order high -> low (below CodeX bot which is managed at top):
    // Owner, Admin, Support, Designer, Developer, VIP, Member, Bot(manual), RMZGG(managed can't move easily), Customer, everyone
    // Actually managed roles positions are restricted. We can reorder non-managed roles.
    // Target: Owner > Admin > Support > Designer > Developer > VIP > Member > Bot > Customer
    // And Customer MUST be below RMZGG.
    const order = [
      "👑 Owner",
      "🛠️ Admin",
      "💼 Support",
      "🎨 Designer",
      "💻 Developer",
      "⭐ VIP",
      "👤 Member",
      "🤖 Bot",
      "🛒 Customer",
    ];
    const me = await guild.members.fetchMe();
    console.log("my role", me.roles.highest.name, me.roles.highest.position);
    const rmz = guild.roles.cache.find(r => r.name === "RMZGG");
    console.log("RMZGG pos", rmz?.position);

    // Set positions from bottom up for safety
    // Put Customer at position 1 (just above everyone), then Bot at 2, ... but RMZGG is managed at 2 currently.
    // Better: set Customer to position 1 explicitly under RMZGG.
    const customer = byName("🛒 Customer");
    if (customer && rmz) {
      // position below rmz
      await customer.setPosition(1);
      console.log("Customer -> 1");
    }

    // Raise staff roles high, just below CodeX bot
    // positions: request absolute positions carefully
    const desired = [
      { name: "👑 Owner", pos: 10 },
      { name: "🛠️ Admin", pos: 9 },
      { name: "💼 Support", pos: 8 },
      { name: "🎨 Designer", pos: 7 },
      { name: "💻 Developer", pos: 6 },
      { name: "⭐ VIP", pos: 5 },
      { name: "👤 Member", pos: 4 },
      { name: "🤖 Bot", pos: 3 },
      // RMZGG managed ~2
      { name: "🛒 Customer", pos: 1 },
    ];
    for (const d of desired) {
      const role = guild.roles.cache.find(r => r.name === d.name);
      if (!role) continue;
      try {
        await role.setPosition(d.pos);
        console.log("set", d.name, "->", d.pos);
        await new Promise(r => setTimeout(r, 400));
      } catch (e) {
        console.log("skip", d.name, e.message);
      }
    }

    const after = [...guild.roles.cache.values()].sort((a,b)=>b.position-a.position).map(r=>`${r.position}|${r.name}`);
    console.log(after.join("\n"));
    console.log("SUCCESS");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});
client.login(TOKEN);