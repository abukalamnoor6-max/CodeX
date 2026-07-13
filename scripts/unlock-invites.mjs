/**
 * Re-enable Discord invites (undo lock-invites).
 * Run: node scripts/unlock-invites.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} from "discord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env.bot.railway"));

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1524901009195798679";

if (!TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

/** Roles we stripped when locking (plus @everyone). */
const RESTORE_ROLE_NAMES = new Set([
  "@everyone",
  "🃏",
  "✕",
  "〢 𝐏𝐚𝐫𝐭𝐧𝐞𝐫",
  "〢 𝐏𝐫𝐞𝐦𝐢𝐮𝐦 𝐂𝐥𝐢𝐞𝐧𝐭",
  "〢 𝐁𝐎𝐎𝐒𝐓𝐄𝐑",
]);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();

    // 1) Clear pause (enable invites)
    let pauseCleared = false;
    try {
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/incident-actions`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invites_disabled_until: null,
            dms_disabled_until: null,
          }),
        },
      );
      const text = await res.text();
      pauseCleared = res.ok;
      console.log("enable invites:", res.status, text.slice(0, 250));
    } catch (e) {
      console.warn("enable pause clear failed", e.message);
    }

    // 2) Restore Create Instant Invite on roles we locked
    const restored = [];
    for (const role of guild.roles.cache.values()) {
      const isEveryone = role.id === guild.id;
      const name = isEveryone ? "@everyone" : role.name;
      if (!RESTORE_ROLE_NAMES.has(name) && !isEveryone) continue;
      if (role.managed) continue;
      if (role.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
        restored.push(`${name} (already had)`);
        continue;
      }
      try {
        const next = role.permissions.add(
          PermissionFlagsBits.CreateInstantInvite,
        );
        await role.setPermissions(next, "Owner reopened invites");
        restored.push(name);
      } catch (e) {
        console.warn("restore failed", name, e.message);
      }
    }

    console.log(
      JSON.stringify(
        {
          guild: guild.name,
          invitesEnabled: pauseCleared,
          rolesRestored: restored,
          next: "أنشئ إنفايت جديد من الدسكورد لو تبي رابط جاهز",
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(TOKEN);
