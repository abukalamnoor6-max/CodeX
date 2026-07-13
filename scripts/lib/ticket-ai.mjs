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
    return "متجر 𝐂𝐨𝐝𝐞𝐗 — خدمات فايف إم وبوتات ديسكورد.";
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
  if (!topic.includes("owner:")) return false;
  if (channel.name.startsWith("مغلق-") || channel.name.startsWith("🔒")) return false;
  return true;
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

function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  try {
    return JSON.parse(text);
  } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }
  return { reply: text.slice(0, 1800), suggest_human: false, close_ticket: false };
}

async function callLlmOnce({ system, messages, jsonMode }) {
  const body = {
    model: MODEL,
    temperature: 0.35,
    messages: [{ role: "system", content: system }, ...messages],
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";
  return extractJsonObject(raw);
}

async function callLlm({ system, messages }) {
  try {
    return await callLlmOnce({ system, messages, jsonMode: true });
  } catch (e1) {
    console.warn("ticket AI jsonMode failed, retry plain:", e1.message);
    return await callLlmOnce({ system, messages, jsonMode: false });
  }
}

function localFallbackReply(userText) {
  const t = String(userText || "").toLowerCase();
  if (/خدم|منتج|وش عندكم|ما ?هي|ماهي|أسعار|سعر|price|services?/.test(t)) {
    return {
      reply: [
        "خدمات 𝐂𝐨𝐝𝐞𝐗:",
        "• برمجة فايف إم — 800 ر.س",
        "• مابات فايف إم بشعار سيرفرك — 80 ر.س",
        "• بوت ديسكورد: متقدم 125 / متوسط 75 / أساسي 30 ر.س",
        "• برمجة سيرفر ديسكورد كامل — 200 ر.س",
        "• باقات خاص المتجر: 5 / 50 / 100 / 250 / 500 / 1000 ر.س",
        "",
        "المتجر: https://codex112.rmz.gg",
        "للتفاصيل الدقيقة اضغط زر تحويل لدعم بشري.",
      ].join("\n"),
      suggest_human: true,
    };
  }
  if (/ماستر|فيزا|بطاقة|دفع|paypal|مدى|apple ?pay/.test(t)) {
    return {
      reply: [
        "فهمت — مشكلة دفع.",
        "أرسل لو تقدر:",
        "1) وسيلة الدفع (ماستر/فيزا/PayPal/...)",
        "2) رسالة الخطأ أو لقطة شاشة",
        "3) رقم الطلب إن وجد",
        "",
        "وبعدها الأفضل تضغط تحويل لدعم بشري عشان يراجعون معك.",
      ].join("\n"),
      suggest_human: true,
    };
  }
  return {
    reply:
      "حالياً الرد الآلي متأخر. اكتب سؤالك باختصار، أو اضغط زر تحويل لدعم بشري.",
    suggest_human: true,
  };
}

function buildSystemPrompt(ticketType, lastAssistantReply = "") {
  const knowledge = loadKnowledge();
  const typeLabel = TYPE_LABELS[ticketType] || ticketType;
  return [
    "أنت مساعد دعم 𝐂𝐨𝐝𝐞𝐗 داخل تذكرة ديسكورد.",
    `نوع التذكرة الحالية: ${typeLabel}`,
    "",
    "قواعد إلزامية:",
    "1) جاوب فقط من قاعدة المعرفة. ممنوع الاختراع.",
    "2) لا تكرر نفس الرد السابق أبداً. إذا العميل أعطى معلومة جديدة، ابنِ عليها ورد بشكل مختلف.",
    "3) إذا سأل عن الخدمات/الأسعار: اعرض القائمة من قاعدة المعرفة مباشرة.",
    "4) إذا مشكلة دفع وذكر وسيلة معيّنة (مثل ماستركارد): اعترف بالمعلومة واطلب لقطة/رسالة الخطأ أو رقم الطلب، ثم اقترح زر الدعم البشري.",
    "5) منتجات مخصصة للعميل (ماب/بوت/خدمة) = حسب طلب العميل.",
    "6) رتبة العميل: المتجر ← المزايا ← ربط Discord.",
    "7) التحويل البشري اختياري عبر الزر فقط.",
    "8) للإغلاق الصريح فقط: close_ticket=true.",
    "",
    lastAssistantReply
      ? `آخر رد لك (ممنوع تكراره):\n"""${lastAssistantReply.slice(0, 500)}"""`
      : "",
    "",
    "أجب JSON فقط:",
    '{"reply":"نص عربي مختصر","suggest_human":false,"close_ticket":false}',
    "",
    "=== قاعدة المعرفة ===",
    knowledge,
  ]
    .filter(Boolean)
    .join("\n");
}

async function collectHistory(channel, limit = 14) {
  const msgs = await channel.messages.fetch({ limit: 40 });
  const sorted = [...msgs.values()].sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp,
  );
  const out = [];
  for (const m of sorted) {
    if (!m.content?.trim()) continue;
    if (m.author.bot && m.author.id !== channel.client.user.id) continue;
    let content = m.content.trim();
    if (content.startsWith("👤") || content.startsWith("✅ استلم")) continue;
    if (content.includes("تم التحويل للدعم البشري")) continue;
    if (content.includes("تعذر الرد الآلي")) continue;
    if (content.includes("جاري حفظ الأرشيف")) continue;
    // skip staff ping opener lines
    if (/^<@&\d+>/.test(content) && content.length < 120) continue;
    const role =
      m.author.id === channel.client.user.id ? "assistant" : "user";
    // skip very first bot embed-only style short system lines
    if (role === "assistant" && content.includes("اكتب تفاصيل طلبك هنا")) continue;
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

function wantsCloseTicket(text = "", llmFlag = false) {
  if (llmFlag) return true;
  const t = String(text).toLowerCase();
  return (
    /سك+ر\s*التذك|اقفل\s*التذك|اغلق\s*التذك|أغلق\s*التذك|سكر\s*التكت|سكّر|اقفلها|اغلقها|أغلقها|close\s*ticket|close\s*the\s*ticket/i.test(
      t,
    ) ||
    /^(سكر|سكّر|اقفل|اغلق|أغلق|close)\s*(التذكرة|التكت|ticket)?\s*[.!؟]?$/i.test(
      t.trim(),
    )
  );
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
    const lastAssistant =
      [...history].reverse().find((m) => m.role === "assistant")?.content || "";
    const system = buildSystemPrompt(meta.type, lastAssistant);

    let result;
    try {
      result = await callLlm({ system, messages: history });
    } catch (e) {
      console.warn("ticket AI LLM error:", e.message);
      result = localFallbackReply(message.content);
    }

    let reply = String(result?.reply || "").trim().slice(0, 1900);
    if (!reply) result = localFallbackReply(message.content);
    reply = String(result?.reply || "").trim().slice(0, 1900);

    // if model repeated previous answer, use fallback tailored to latest message
    if (
      lastAssistant &&
      reply &&
      (reply === lastAssistant ||
        (reply.length > 40 &&
          lastAssistant.includes(reply.slice(0, 40)) &&
          reply.includes(lastAssistant.slice(0, 40))))
    ) {
      result = localFallbackReply(message.content);
      reply = String(result.reply).trim().slice(0, 1900);
    }

    const closeTicket = wantsCloseTicket(
      message.content,
      Boolean(result?.close_ticket),
    );

    const freshChannel = await channel.fetch();
    const fresh = parseTopic(freshChannel.topic || channel.topic || "");
    if (fresh.claimed || fresh.ai === "off" || fresh.ai === "escalated") return;

    if (closeTicket) {
      await channel.send({
        content:
          reply ||
          "تمام، راح أسكر التذكرة الآن. شكراً لتواصلك مع 𝐂𝐨𝐝𝐞𝐗.",
      });
      const { closeTicketByChannel } = await import("./tickets.mjs");
      await closeTicketByChannel({
        channel,
        client: message.client,
        closedBy: message.author,
        notifyChannel: false,
      });
      return;
    }

    if (reply) {
      await channel.send({
        content: reply,
        components: [humanRequestRow(meta.owner)],
      });
    }
  } catch (e) {
    console.warn("ticket AI failed", e.message);
    try {
      const fb = localFallbackReply(message.content);
      await message.channel.send({
        content: fb.reply,
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
