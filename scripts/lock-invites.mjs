/**
 * Hard-lock Discord joins: delete invites + strip Create Instant Invite
 * from every role (owner/admins can still restore later).
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

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();
    await guild.channels.fetch();

    // Delete remaining invites
    let deleted = 0;
    try {
      const invites = await guild.invites.fetch();
      for (const inv of invites.values()) {
        try {
          await inv.delete("Server locked by owner request");
          deleted++;
        } catch (e) {
          console.warn("invite delete", inv.code, e.message);
        }
      }
    } catch (e) {
      console.warn("invites fetch", e.message);
    }

    // Pause invites for max allowed window (24h) — extra safety net
    let pausedHours = 0;
    try {
      const until = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/incident-actions`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invites_disabled_until: until,
            dms_disabled_until: null,
          }),
        },
      );
      const body = await res.text();
      if (res.ok) pausedHours = 23;
      console.log("pause 23h:", res.status, body.slice(0, 200));
    } catch (e) {
      console.warn("pause", e.message);
    }

    // Strip CreateInstantInvite from ALL roles (incl. @everyone)
    // Roles with Administrator can still create invites — Discord always allows that.
    const stripped = [];
    const skippedAdmin = [];
    for (const role of guild.roles.cache.values()) {
      if (role.managed) continue; // bot/integration roles
      if (role.permissions.has(PermissionFlagsBits.Administrator)) {
        skippedAdmin.push(role.name);
        continue;
      }
      if (!role.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
        continue;
      }
      try {
        const next = role.permissions.remove(
          PermissionFlagsBits.CreateInstantInvite,
        );
        await role.setPermissions(next, "Lock invites until owner reopens");
        stripped.push(role.name);
      } catch (e) {
        console.warn("role strip failed", role.name, e.message);
      }
    }

    // Clear channel overwrites that explicitly allow CreateInstantInvite
    let overwriteCleared = 0;
    for (const ch of guild.channels.cache.values()) {
      if (!ch.permissionOverwrites?.cache) continue;
      for (const ow of ch.permissionOverwrites.cache.values()) {
        if (!ow.allow.has(PermissionFlagsBits.CreateInstantInvite)) continue;
        try {
          await ow.edit(
            {
              Allow: ow.allow.remove(PermissionFlagsBits.CreateInstantInvite),
            },
            "Lock invites until owner reopens",
          );
          overwriteCleared++;
        } catch (e) {
          // try alternate API
          try {
            await ch.permissionOverwrites.edit(
              ow.id,
              { CreateInstantInvite: null },
              { reason: "Lock invites until owner reopens" },
            );
            overwriteCleared++;
          } catch (e2) {
            console.warn("overwrite", ch.name, e2.message);
          }
        }
      }
    }

    // Verify no invites left
    let remaining = -1;
    try {
      remaining = (await guild.invites.fetch()).size;
    } catch {}

    console.log(
      JSON.stringify(
        {
          guild: guild.name,
          deletedInvites: deleted,
          remainingInvites: remaining,
          pausedHours,
          rolesStripped: stripped,
          adminRolesKeptInvite: skippedAdmin,
          channelOverwritesCleared: overwriteCleared,
          howToReopen: [
            "Server Settings → Invites → Enable Invites (لو Pause شغال)",
            "أرجع صلاحية Create Instant Invite للرولات اللي تبيها",
            "أنشئ إنفايت جديد بنفسك كمالك",
          ],
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
