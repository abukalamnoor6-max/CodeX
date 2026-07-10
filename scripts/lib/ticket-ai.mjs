/**
 * codeX Ticket AI — replies in tickets, escalates to human staff when needed.
 * Uses OpenAI-compatible Chat Completions (OpenAI / Groq / etc).
 *
 * Env:
 *   OPENAI_API_KEY   (required to enable)
 *   OPENAI_BASE_URL  (default https://api.openai.com/v1)
 *   OPENAI_MODEL     (default gpt-4o-mini)
 *   TICKET_AI=off    to disable without removing the key
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
} from "discord.js";
import { LOG_CHANNELS } from "./guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const KNOWLEDGE_PATH = path.join(ROOT, "discord", "ai-knowledge.md");

const OWNER_ID = process.env.DISCORD_OWNER_ID || "1210972261968912425";
const STAFF_ROLE_IDS = [
  process.env.DISCORD_STAFF_ROLE_OWNER || "1524961206144860333",
  process.env.DISCORD_STAFF_ROLE_TEAM || "1524961198360236084",
];
const TYPE_LABELS = {
  inquiry: "استفسار",
  delivery: "استلام طلب",
  problem: "مشكلة",
};

const API_KEY = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || "";
const BASE_URL = (
  process.env.OPENAI_BASE_URL ||
  (process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY
    ? "https://api.groq.com/openai/v1"
    : "https://api.openai.com/v1")
).replace(/\/$/, "");
const MODEL =
  process.env.OPENAI_MODEL ||
  (BASE_URL.includes("groq.com") ? "llama-3.3-70b-versatile" : "gpt-4o-mini");
const ENABLED =
  process.env.TICKET_AI !== "off" && Boolean(API_KEY);

const pending = new Map();
const typingLocks = new Set();

function loadKnowledge() {
  try {
    return fs.readFileSync(KNOWLEDGE_PATH, "utf8");
  } catch {
    return "متجر codeX — خدمات فايف إم وبوتات ديسكورد.";
  }
}

export function parseTopic(topic = "") {
  const owner = (topic.match(/owner:(\d{15,20})/) || [])[1] || null;
  const type = (topic.match(/type:([a-z]+)/) || [])[1] || "inquiry";
  const claimed = (topic.match(/claimed:(\d{15,20})/) || [])[1] || null;
  const ai = (topic.match(/ai:(on|off|escalated)/) || [])[1] || "on";
  return { owner, type, claimed, ai };
}

export function buildTopic({ type, owner, claimed, ai = "on" }) {
  return [
    `type:${type}`,
    `owner:${owner}`,
    claimed ? `claimed:${claimed}` : null,
    `ai:${ai || "on"}`,
  ]
    .filter(Boolean)
    .join(" | ");
}

function isStaffMember(member) {
  if (!member) return false;
  if (member.id === OWNER_ID) return true;
  return STAFF_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

function isTicketChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  const topic = channel.topic || "";
  return topic.includes("owner:") && !channel.name.startsWith("مغلق-");
}

function humanRequestRow(ownerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`codex_ticket_ai_human:${ownerId}`)
      .setLabel("تحويل لدعم بشري")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("👤"),
  );
}

async function callLlm({ system, messages }) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { reply: raw.slice(0, 1800), escalate: false };
  }
}

function buildSystemPrompt(ticketType) {
  const knowledge = loadKnowledge();
  const typeLabel = TYPE_LABELS[ticketType] || ticketType;
  return [
    "أنت مساعد دعم codeX داخل تذكرة ديسكورد.",
    `نوع التذكرة الحالية: ${typeLabel}`,
    "",
    "قواعد إلزامية (أخطر من أي شيء آخر):",
    "1) جاوب فقط من قاعدة المعرفة. ممنوع الاختراع أو التخمين أو اختلاق سياسة.",
    "2) إذا التفصيلة غير مكتوبة بوضوح: لا تعطِ جواباً قاطعاً. اقترح زر «تحويل لدعم بشري» — بدون إجبار.",
    "3) خدمات codeX مخصصة للعميل: العميل يختار المتطلبات (شعار/تصميم/وصف)، والفريق ينفّذ.",
    "4) ممنوع تقول إن الفريق يفرض التصميم ويرفض اختيار العميل.",
    "5) مابات فايف إم بشعار سيرفرك = بشعار العميل. سيارة خاصة = العميل يحدد التصميم/المرجع.",
    "6) لا تعد بتنفيذ/تسليم/استرجاع/تعويض بنفسك.",
    "7) رتبة العميل: حساب المتجر ← مزاياي ← ربط Discord.",
    "8) لأي تفاصيل زيادة: اقترح الزر فقط. التحويل الفعلي بالزر فقط، مو تلقائي. لا تختلق تفاصيل.",
    "",
    "أجب دائماً بصيغة JSON فقط:",
    '{"reply":"نص الرد للعميل بالعربية","suggest_human":false}',
    "",
    "إذا التفاصيل زيادة أو مو متأكد: اكتب في reply إن الأفضل الضغط على زر «تحويل لدعم بشري» — لكن لا تجبر التحويل.",
    "ضع suggest_human=true فقط كتذكير داخلي؛ التحويل الفعلي يتم بالزر فقط.",
    "لا تذكر JSON للعميل.",
    "",
    "=== قاعدة المعرفة ===",
    knowledge,
  ].join("\n");
}

async function collectHistory(channel, limit = 12) {
  const msgs = await channel.messages.fetch({ limit: 30 });
  const sorted = [...msgs.values()].sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp,
  );
  const out = [];
  for (const m of sorted) {
    if (!m.content?.trim()) continue;
    if (m.author.bot && m.author.id !== channel.client.user.id) continue;
    let content = m.content.trim();
    if (content.startsWith("👤") || content.startsWith("✅ استلم")) continue;
    if (m.author.bot && content.includes("تم التحويل للدعم البشري")) continue;
    const role =
      m.author.id === channel.client.user.id ? "assistant" : "user";
    out.push({
      role,
      content: content.slice(0, 1200),
    });
  }
  return out.slice(-limit);
}

async function escalateTicket(channel, meta, reason, triggeredBy) {
  const nextTopic = buildTopic({
    type: meta.type,
    owner: meta.owner,
    claimed: meta.claimed,
    ai: "escalated",
  });
  try {
    await channel.setTopic(nextTopic);
  } catch (e) {
    console.warn("ai escalate topic failed", e.message);
  }

  const staffMentions = STAFF_ROLE_IDS.map((id) => `<@&${id}>`).join(" ");
  await channel.send({
    content: [
      `👤 تم التحويل للدعم البشري ${staffMentions}`,
      reason ? `السبب: ${reason}` : null,
      triggeredBy ? `طلب من: <@${triggeredBy}>` : null,
      "المساعد الذكي توقف عن الرد في هالتذكرة.",
    ]
      .filter(Boolean)
      .join("\n"),
    allowedMentions: {
      roles: STAFF_ROLE_IDS,
      users: triggeredBy ? [triggeredBy] : [],
    },
  });

  try {
    const logCh = await channel.client.channels.fetch(LOG_CHANNELS.tickets);
    if (logCh?.isTextBased?.()) {
      await logCh.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle("👤 تحويل تذكرة لدعم بشري")
            .setDescription(
              [
                `**الروم:** ${channel}`,
                reason ? `**السبب:** ${reason}` : null,
                triggeredBy
                  ? `**بواسطة:** <@${triggeredBy}>`
                  : "**بواسطة:** المساعد الذكي",
              ]
                .filter(Boolean)
                .join("\n"),
            )
            .setTimestamp(),
        ],
      });
    }
  } catch {}
}

async function replyWithAi(message) {
  const channel = message.channel;
  if (typingLocks.has(channel.id)) return;
  typingLocks.add(channel.id);

  try {
    const meta = parseTopic(channel.topic || "");
    if (!meta.owner) return;
    if (meta.ai === "off" || meta.ai === "escalated") return;
    if (meta.claimed) return;

    if (message.author.id !== meta.owner) return;
    if (message.author.bot) return;

    await channel.sendTyping().catch(() => {});

    const history = await collectHistory(channel);
    const system = buildSystemPrompt(meta.type);
    const result = await callLlm({ system, messages: history });

    const reply = String(result?.reply || "").trim().slice(0, 1900);
    // ignore model escalate flags — transfer is button-only
    void result?.escalate;
    void result?.suggest_human;
    void result?.reason;

    const freshChannel = await channel.fetch();
    const fresh = parseTopic(freshChannel.topic || channel.topic || "");
    if (fresh.claimed || fresh.ai === "off" || fresh.ai === "escalated") return;

    if (reply) {
      await channel.send({
        content: reply,
        components: [humanRequestRow(meta.owner)],
      });
    }

    // Soft suggest only — never force escalate from the model.
    // Real transfer happens when the user/staff clicks «تحويل لدعم بشري».
  } catch (e) {
    console.warn("ticket AI failed", e.message);
    try {
      await message.channel.send({
        content:
          "تعذر الرد الآلي حالياً. اضغط الزر تحت أو انتظر فريق الدعم.",
        components: [
          humanRequestRow(
            parseTopic(message.channel.topic || "").owner || message.author.id,
          ),
        ],
      });
    } catch {}
  } finally {
    typingLocks.delete(channel.id);
  }
}

function scheduleAi(message) {
  if (!ENABLED) return;
  if (!isTicketChannel(message.channel)) return;

  const meta = parseTopic(message.channel.topic || "");
  if (!meta.owner || message.author.id !== meta.owner) return;
  if (meta.claimed || meta.ai === "off" || meta.ai === "escalated") return;

  const prev = pending.get(message.channel.id);
  if (prev) clearTimeout(prev);

  const t = setTimeout(() => {
    pending.delete(message.channel.id);
    replyWithAi(message).catch((e) =>
      console.warn("ticket AI schedule", e.message),
    );
  }, 1400);
  pending.set(message.channel.id, t);
}

export async function handleAiHumanButton(interaction) {
  const channel = interaction.channel;
  if (!isTicketChannel(channel)) {
    await interaction.reply({
      content: "هذا الزر داخل التذاكر فقط.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const meta = parseTopic(channel.topic || "");
  const staff = isStaffMember(interaction.member);
  const isOwner = meta.owner && interaction.user.id === meta.owner;

  if (!staff && !isOwner) {
    await interaction.reply({
      content: "ما تقدر تستخدم هالزر.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (meta.ai === "escalated") {
    await interaction.reply({
      content: "التذكرة محوّلة مسبقاً للدعم البشري.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate().catch(() => {});
  await escalateTicket(
    channel,
    meta,
    "طلب تحويل يدوي",
    interaction.user.id,
  );
}

export async function silenceAiOnClaim(channel, meta) {
  try {
    await channel.setTopic(
      buildTopic({
        type: meta.type,
        owner: meta.owner,
        claimed: meta.claimed,
        ai: "off",
      }),
    );
  } catch {}
}

export function attachTicketAi(client) {
  if (!ENABLED) {
    console.log("Ticket AI skipped (no OPENAI_API_KEY / GROQ_API_KEY)");
    return;
  }

  client.on("messageCreate", (message) => {
    try {
      scheduleAi(message);
    } catch (e) {
      console.warn("ticket AI message hook", e.message);
    }
  });

  console.log(`Ticket AI attached (${MODEL} @ ${BASE_URL})`);
}

export const ticketAiConfig = {
  enabled: ENABLED,
  model: MODEL,
  baseUrl: BASE_URL,
};
