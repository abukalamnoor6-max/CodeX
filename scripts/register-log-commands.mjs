import fs from "fs";
import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env.bot.railway");
loadEnvFile(".env.local");

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID || "1524901009195798679";
if (!token) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

const body = [
  new SlashCommandBuilder()
    .setName("setup-logs")
    .setDescription("إنشاء رومات اللوقات الناقصة")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
  new SlashCommandBuilder()
    .setName("logs-info")
    .setDescription("عرض رومات اللوقات")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
  new SlashCommandBuilder()
    .setName("set-staff")
    .setDescription("رتبة إجراءات اللوقات")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption((o) =>
      o.setName("role").setDescription("الرتبة").setRequired(true),
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(token);
const me = await rest.get(Routes.user("@me"));
await rest.put(Routes.applicationGuildCommands(me.id, guildId), { body });
console.log("OK registered for", me.username, "guild", guildId);
console.log(body.map((c) => "/" + c.name).join(", "));
