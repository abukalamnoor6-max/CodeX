/**
 * Staff utility: type "خط" → delete message + post codeX divider image.
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { AttachmentBuilder } from "discord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";
const STAFF_ROLE_IDS = [
  process.env.DISCORD_STAFF_ROLE_OWNER || "1524961206144860333",
  process.env.DISCORD_STAFF_ROLE_TEAM || "1524961198360236084",
];

const DIVIDER_URL =
  process.env.DISCORD_DIVIDER_URL ||
  `${(process.env.NEXT_PUBLIC_SITE_URL || "https://codex-theta-two.vercel.app").replace(/\/$/, "")}/discord/codex-divider-stars.png?v=1`;

function canUseDivider(member) {
  if (!member) return false;
  if (member.id === OWNER_ID) return true;
  if (member.permissions?.has?.("Administrator")) return true;
  return STAFF_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

async function sendDivider(channel) {
  const localCandidates = [
    path.join(ROOT, "public", "discord", "codex-divider-stars.png"),
    path.join(ROOT, "public", "discord", "codex-divider-official.png"),
  ];
  for (const local of localCandidates) {
    if (fs.existsSync(local)) {
      await channel.send({
        files: [new AttachmentBuilder(local, { name: path.basename(local) })],
      });
      return;
    }
  }
  // Fallback: fetch hosted image and attach (plain image, no embed box)
  const res = await fetch(DIVIDER_URL);
  if (!res.ok) throw new Error(`divider fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await channel.send({
    files: [new AttachmentBuilder(buf, { name: "codex-divider-stars.png" })],
  });
}

export function attachDividerCommand(client) {
  client.on("messageCreate", async (message) => {
    try {
      if (!message.guild || message.author.bot) return;
      const text = (message.content || "").trim();
      if (text !== "خط") return;
      if (!canUseDivider(message.member)) return;

      await message.delete().catch(() => {});
      await sendDivider(message.channel);
    } catch (e) {
      console.warn("divider command failed", e.message);
    }
  });

  console.log("codeX divider command attached");
}
