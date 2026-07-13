import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { PROTECTION_META } from "./protection-meta.mjs";
import {
  getDiscordOAuthConfig,
  signOAuthState,
  verifyOAuthState,
  signDiscordSession,
  verifyDiscordSession,
  buildAuthorizeUrl,
  exchangeCode,
  fetchDiscordMe,
  avatarUrl,
} from "./discord-oauth.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUARD_PUBLIC = path.resolve(__dirname, "../../public/guard");

/** Short-lived checkout meta so mobile PayPal returns can rebuild the success page */
const pendingPayMeta = new Map();
function rememberPayMeta(orderId, meta) {
  const id = String(orderId || "").trim();
  if (!id) return;
  pendingPayMeta.set(id, { ...meta, t: Date.now() });
  if (pendingPayMeta.size > 500) {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [k, v] of pendingPayMeta) {
      if (!v?.t || v.t < cutoff) pendingPayMeta.delete(k);
    }
  }
}
function takePayMeta(orderId) {
  const id = String(orderId || "").trim();
  if (!id) return null;
  const hit = pendingPayMeta.get(id) || null;
  return hit;
}

export function createPanelApp({
  client,
  store,
  broadcast,
  apiKey,
  guildId,
  postDeliveryOrder,
  paypalPayments = null,
  onPayPalPaid = null,
}) {
  const app = express();
  app.use(cors());

  function clearPendingPayCookie(res) {
    res.append(
      "Set-Cookie",
      "codex_pending_pay=; Path=/; Max-Age=0; Secure; SameSite=Lax",
    );
  }

  async function resolvePayOrderState(orderId) {
    if (!paypalPayments || !orderId) {
      return { paid: false, denied: false, status: "", meta: {} };
    }
    const saved = takePayMeta(orderId) || {};
    try {
      // Best-effort capture if buyer already approved
      await paypalPayments.captureOrder(orderId).catch(() => null);
      const order = await paypalPayments.getOrder(orderId);
      const status = String(order?.status || "");
      const captures =
        order?.purchase_units?.flatMap((u) => u.payments?.captures || []) ||
        [];
      const captureCompleted = captures.some(
        (c) => String(c.status || "") === "COMPLETED",
      );
      const captureDenied = captures.some((c) =>
        /DECLINED|DENIED|FAILED|VOIDED/i.test(String(c.status || "")),
      );
      const paid = status === "COMPLETED" || captureCompleted;
      const denied =
        captureDenied || /VOIDED|EXPIRED/i.test(status);
      let custom = {};
      try {
        custom =
          paypalPayments.decodeCustomId?.(
            order?.purchase_units?.[0]?.custom_id || "",
          ) || {};
      } catch {
        custom = {};
      }
      return {
        paid,
        denied,
        status,
        meta: {
          amount:
            saved.amount || order?.purchase_units?.[0]?.amount?.value || "",
          name: saved.name || custom.productName || "",
          user: saved.user || custom.discordUser || "",
          lang: saved.lang || "ar",
        },
      };
    } catch (e) {
      return {
        paid: false,
        denied: false,
        status: "ERROR",
        meta: saved,
        error: e.message,
      };
    }
  }

  // PayPal mobile/card full-page return lands here with ?token=&PayerID=
  app.get("/pay/return", async (req, res) => {
    const token = String(req.query.token || req.query.orderID || "").trim();
    const cookies = parseCookies(req);
    const cookieId = String(cookies.codex_pending_pay || "").trim();
    const orderId = token || cookieId;
    if (!orderId) {
      return res.redirect(302, "/pay/cancel");
    }
    const state = await resolvePayOrderState(orderId);
    const q = new URLSearchParams({
      token: orderId,
      lang: state.meta.lang === "en" ? "en" : "ar",
    });
    if (state.meta.amount) q.set("amount", String(state.meta.amount));
    if (state.meta.name) q.set("name", String(state.meta.name));
    if (state.meta.user) q.set("user", String(state.meta.user));

    if (state.paid || state.status === "APPROVED") {
      clearPendingPayCookie(res);
      return res.redirect(302, `/pay/success?${q.toString()}`);
    }
    if (state.denied) {
      clearPendingPayCookie(res);
      return res.redirect(302, `/pay/cancel?${q.toString()}`);
    }
    // PayPal sent buyer back with a token — settle on success page
    if (token) {
      clearPendingPayCookie(res);
      return res.redirect(302, `/pay/success?${q.toString()}`);
    }
    return res.redirect(302, `/pay/cancel`);
  });
  app.post(
    "/paypal/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      if (!paypalPayments) {
        return res.status(503).send("PayPal not configured");
      }
      try {
        const raw =
          Buffer.isBuffer(req.body)
            ? req.body.toString("utf8")
            : String(req.body || "");
        const event = raw ? JSON.parse(raw) : {};

        let verified = true;
        if (process.env.PAYPAL_WEBHOOK_ID) {
          verified = await paypalPayments.verifyWebhook({
            headers: req.headers,
            body: event,
          });
        } else {
          console.warn(
            "PAYPAL_WEBHOOK_ID missing — webhook accepted without signature verify",
          );
        }
        if (!verified) {
          console.warn("paypal webhook verification failed");
          return res.status(400).send("invalid signature");
        }

        const type = String(event.event_type || "");

        // Buyer approved an API order → capture so money settles
        if (type === "CHECKOUT.ORDER.APPROVED") {
          const orderId = event.resource?.id;
          if (orderId) {
            await paypalPayments.captureOrder(orderId).catch((e) =>
              console.error("paypal capture error:", e.message),
            );
          }
        }

        // Payment completed (NCP links + Orders API captures)
        if (
          (type === "PAYMENT.CAPTURE.COMPLETED" ||
            type === "PAYMENT.SALE.COMPLETED") &&
          typeof onPayPalPaid === "function"
        ) {
          await onPayPalPaid(event.resource || {}, event);
        }

        res.json({ received: true });
      } catch (e) {
        console.error("paypal webhook error:", e.message);
        res.status(400).send(`Webhook Error: ${e.message}`);
      }
    },
  );

  app.use(express.json({ limit: "1mb" }));

  // Delivery webhook (existing)
  app.post("/delivery-order", async (req, res) => {
    try {
      if (!req.body?.orderId) throw new Error("orderId required");
      const result = await postDeliveryOrder(req.body);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/health", (req, res) => {
    const oauth = getDiscordOAuthConfig();
    res.json({
      ok: true,
      user: client.user?.tag || null,
      paypal: Boolean(paypalPayments),
      discordOAuth: oauth.enabled,
      payReturn: `${String(oauth.publicBase || "").replace(/\/$/, "")}/pay/return`,
    });
  });

  // Create PayPal order → returns { url }
  app.post("/paypal/order", express.json(), async (req, res) => {
    try {
      if (!paypalPayments) {
        return res.status(503).json({ error: "PayPal not configured" });
      }
      const { name, amount, discordId, discordUser, lang } = req.body || {};
      const order = await paypalPayments.createOrder({
        name: name || "𝐂𝐨𝐝𝐞𝐗 — خدمة",
        amountMajor: amount,
        discordId,
        discordUser,
        lang,
      });
      rememberPayMeta(order.id, {
        amount: Number(amount).toFixed(2),
        name: String(name || "𝐂𝐨𝐝𝐞𝐗 — خدمة"),
        user: String(discordUser || "").replace(/^@+/, ""),
        lang: String(lang || "ar").toLowerCase() === "en" ? "en" : "ar",
      });
      // Survives mobile Safari / Discord WebView storage wipes
      res.setHeader(
        "Set-Cookie",
        `codex_pending_pay=${encodeURIComponent(order.id)}; Path=/; Max-Age=7200; Secure; SameSite=Lax`,
      );
      res.json({ ok: true, id: order.id, url: order.url, status: order.status });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post("/paypal/capture", express.json(), async (req, res) => {
    try {
      if (!paypalPayments) {
        return res.status(503).json({ error: "PayPal not configured" });
      }
      const orderId = String(req.body?.orderID || req.body?.orderId || "");
      if (!orderId) {
        return res.status(400).json({ ok: false, error: "orderID required" });
      }
      const capture = await paypalPayments.captureOrder(orderId);
      const status = capture?.status || "COMPLETED";
      res.json({
        ok: true,
        status,
        id: capture?.id || orderId,
      });
    } catch (e) {
      console.error("paypal capture failed:", e.message, e.issue || "");
      // Still tell client ok-ish so UI can leave checkout; webhook may settle
      res.status(200).json({
        ok: true,
        status: "PENDING_SETTLEMENT",
        warning: e.message,
      });
    }
  });

  app.get("/paypal/status", async (req, res) => {
    try {
      if (!paypalPayments) {
        return res.status(503).json({ ok: false, error: "PayPal not configured" });
      }
      const orderId = String(req.query.id || req.query.token || "").trim();
      if (!orderId) {
        return res.status(400).json({ ok: false, error: "id required" });
      }
      const order = await paypalPayments.getOrder(orderId);
      const status = String(order?.status || "");
      const captures =
        order?.purchase_units?.flatMap((u) => u.payments?.captures || []) ||
        [];
      const captureCompleted = captures.some(
        (c) => String(c.status || "") === "COMPLETED",
      );
      const captureDenied = captures.some((c) =>
        /DECLINED|DENIED|FAILED|VOIDED/i.test(String(c.status || "")),
      );
      // APPROVED alone is not paid — card can still decline on capture
      const paid = status === "COMPLETED" || captureCompleted;
      const denied =
        captureDenied ||
        /VOIDED|EXPIRED/i.test(status) ||
        (!paid && /COMPLETED|APPROVED/.test(status) === false && captures.length > 0);
      if (status === "APPROVED" && !paid && !denied) {
        paypalPayments.captureOrder(orderId).catch(() => {});
      }
      const saved = takePayMeta(orderId) || {};
      let custom = {};
      try {
        custom =
          paypalPayments.decodeCustomId?.(
            order?.purchase_units?.[0]?.custom_id || "",
          ) || {};
      } catch {
        custom = {};
      }
      res.json({
        ok: true,
        paid,
        denied,
        status,
        id: orderId,
        amount:
          saved.amount || order?.purchase_units?.[0]?.amount?.value || "",
        name: saved.name || custom.productName || "",
        user: saved.user || custom.discordUser || "",
        lang: saved.lang || "ar",
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseCookies(req) {
    const out = {};
    const raw = String(req.headers?.cookie || "");
    for (const part of raw.split(";")) {
      const i = part.indexOf("=");
      if (i < 0) continue;
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
    return out;
  }

  function readDiscordSession(req) {
    const cfg = getDiscordOAuthConfig();
    const cookies = parseCookies(req);
    return verifyDiscordSession(cookies.codex_discord || "", cfg.stateSecret);
  }

  const paypalClientId =
    process.env.PAYPAL_CLIENT_ID ||
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
    "";

  const CLIENT_ROLE_ID =
    process.env.DISCORD_ROLE_CLIENT || "1524961186007879801";
  const PAY_GUILD_ID =
    guildId || process.env.DISCORD_GUILD_ID || "1524901009195798679";

  async function ensureClientRole(userId, accessToken) {
    const guild = await client.guilds.fetch(PAY_GUILD_ID);
    let member = null;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      member = null;
    }
    if (!member && accessToken) {
      const botToken = process.env.DISCORD_BOT_TOKEN || "";
      const put = await fetch(
        `https://discord.com/api/v10/guilds/${PAY_GUILD_ID}/members/${userId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: accessToken }),
        },
      );
      // 201 created, 204 already member
      if (put.status === 201 || put.status === 204) {
        try {
          member = await guild.members.fetch(userId);
        } catch {
          member = null;
        }
      } else {
        const body = await put.json().catch(() => ({}));
        console.warn(
          "guilds.join failed:",
          put.status,
          body.message || body.code || "",
        );
      }
    }
    if (!member) {
      return { ok: false, reason: "not_in_guild" };
    }
    if (!member.roles.cache.has(CLIENT_ROLE_ID)) {
      await member.roles.add(CLIENT_ROLE_ID, "codeX pay link — Client");
    }
    return { ok: true, username: member.user?.username || "" };
  }

  function payFormPage({
    amount,
    name,
    error = "",
    discord = "",
    discordId = "",
    lang = "ar",
    connected = null,
    oauthEnabled = false,
    roleOk = null,
  }) {
    const amountLabel = Number(amount).toFixed(2);
    const safeName = escapeHtml(name);
    const initialLang = lang === "en" ? "en" : "ar";
    const errJson = JSON.stringify(error || "");
    const hasConnected =
      connected &&
      connected.id &&
      /^\d{15,22}$/.test(String(connected.id));
    const userName = hasConnected
      ? String(connected.username || discord || "")
      : String(discord || "");
    const userId = hasConnected ? String(connected.id) : String(discordId || "");
    const av = hasConnected ? avatarUrl(connected) : "";
    const oauthStart = `/auth/discord/start?amount=${encodeURIComponent(amountLabel)}&name=${encodeURIComponent(name)}&lang=${initialLang}`;
    const roleNote =
      roleOk === false
        ? `<p class="hint center" data-i18n="roleWarn"></p>`
        : roleOk === true
          ? `<p class="hint center ok" data-i18n="roleOk"></p>`
          : "";

    const bodyBlock = hasConnected
      ? `<div class="linked">
  <img class="av" src="${escapeHtml(av)}" alt=""/>
  <div class="linked-meta">
    <div class="linked-name">@${escapeHtml(userName)}</div>
    <div class="linked-sub" data-i18n="linkedSub"></div>
  </div>
  <a class="unlink" href="/auth/discord/logout?amount=${encodeURIComponent(amountLabel)}&name=${encodeURIComponent(name)}&lang=${initialLang}" data-i18n="switch"></a>
</div>
${roleNote}
<form method="POST" action="/pay">
<input type="hidden" name="amount" value="${escapeHtml(amountLabel)}"/>
<input type="hidden" name="name" value="${safeName}"/>
<input type="hidden" name="lang" id="langInput" value="${initialLang}"/>
<input type="hidden" name="discord" value="${escapeHtml(userName)}"/>
<input type="hidden" name="discordId" value="${escapeHtml(userId)}"/>
<button class="submit" type="submit" data-i18n="submit"></button>
</form>`
      : oauthEnabled
        ? `<a class="discord-btn" href="${escapeHtml(oauthStart)}">
  <span class="dc-ico">Discord</span>
  <span data-i18n="connect"></span>
</a>
<p class="hint center" data-i18n="connectHint"></p>
<input type="hidden" id="langInput" value="${initialLang}"/>`
        : `<form method="POST" action="/pay">
<input type="hidden" name="amount" value="${escapeHtml(amountLabel)}"/>
<input type="hidden" name="name" value="${safeName}"/>
<input type="hidden" name="lang" id="langInput" value="${initialLang}"/>
<div class="field">
<label for="discord"><span data-i18n="userLabel"></span></label>
<input id="discord" name="discord" type="text" required maxlength="40" autocomplete="username" data-i18n-placeholder="userPh" value="${escapeHtml(discord)}" autofocus/>
</div>
<div class="field">
<label for="discordId"><span data-i18n="idLabel"></span></label>
<input id="discordId" name="discordId" type="text" required maxlength="22" inputmode="numeric" pattern="\\d{15,22}" data-i18n-placeholder="idPh" value="${escapeHtml(discordId)}"/>
</div>
<button class="submit" type="submit" data-i18n="submit"></button>
</form>`;

    return `<!doctype html>
<html lang="${initialLang}" dir="${initialLang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>𝐂𝐨𝐝𝐞𝐗</title>
<style>
:root{--bg:#0b1220;--card:#121a2b;--line:#243049;--text:#e8eefc;--muted:#9fb0cc;--accent:#2dd4bf;--err:#f87171;--discord:#5865F2}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.25rem;font-family:"Segoe UI",Tahoma,sans-serif;background:radial-gradient(1200px 600px at 80% -10%,#1a2742 0%,var(--bg) 55%);color:var(--text)}
.card{width:100%;max-width:440px;padding:1.6rem;border:1px solid var(--line);border-radius:18px;background:rgba(18,26,43,.92);box-shadow:0 20px 60px rgba(0,0,0,.35);position:relative}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin:0 0 .85rem;direction:ltr}
.brand{font-size:.85rem;letter-spacing:.08em;color:var(--accent);margin:0;font-weight:700}
.langs{display:flex;gap:.35rem;background:#0d1524;border:1px solid var(--line);border-radius:999px;padding:.2rem;margin-left:auto}
.langs button{width:auto;margin:0;padding:.35rem .7rem;border-radius:999px;background:transparent;color:var(--muted);font-weight:600;font-size:.78rem;border:0;cursor:pointer}
.langs button.active{background:rgba(45,212,191,.18);color:var(--accent)}
h1{margin:0 0 .75rem;font-size:1.35rem}
.meta{margin:0 0 1.1rem;color:var(--muted);line-height:1.7;font-size:.95rem}
.meta strong{color:var(--text)}
label{display:block;margin:0 0 .4rem;font-size:.92rem}
.field{margin:0 0 1rem}
input{width:100%;padding:.85rem 1rem;border-radius:12px;border:1px solid var(--line);background:#0d1524;color:var(--text);font-size:1rem;outline:none}
input:focus{border-color:var(--accent)}
.hint{margin:.4rem 0 0;color:var(--muted);font-size:.8rem;line-height:1.5}
.hint.center{text-align:center;margin-top:.85rem}
.hint.ok{color:var(--accent)}
.why{margin:0 0 1.15rem;padding:.85rem 1rem;border-radius:12px;border:1px solid rgba(45,212,191,.22);background:rgba(45,212,191,.07);color:var(--text);font-size:.88rem;line-height:1.65}
.why strong{color:var(--accent)}
button.submit{width:100%;border:0;border-radius:12px;padding:.95rem 1rem;background:linear-gradient(135deg,#14b8a6,#0d9488);color:#041016;font-weight:700;font-size:1rem;cursor:pointer;margin-top:.35rem}
button.submit:hover{filter:brightness(1.05)}
.discord-btn{display:flex;align-items:center;justify-content:center;gap:.55rem;width:100%;padding:1rem 1rem;border-radius:12px;background:var(--discord);color:#fff;font-weight:700;font-size:1rem;text-decoration:none;margin-top:.25rem;box-shadow:0 10px 30px rgba(88,101,242,.28)}
.discord-btn:hover{filter:brightness(1.06)}
.dc-ico{display:inline-flex;width:1.35rem;height:1.35rem;border-radius:4px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 127.14 96.36'%3E%3Cpath fill='%23fff' d='M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69c-6.23 0-11.36-5.66-11.36-12.6s4.98-12.62 11.36-12.62S53.9 46.13 53.9 53.09 48.83 65.69 42.45 65.69Zm42.24 0c-6.23 0-11.36-5.66-11.36-12.6s5-12.62 11.36-12.62 11.38 5.72 11.38 12.62-5.03 12.6-11.38 12.6Z'/%3E%3C/svg%3E") center/contain no-repeat;text-indent:-999px;overflow:hidden}
.linked{display:flex;align-items:center;gap:.75rem;padding:.85rem 1rem;border-radius:14px;border:1px solid var(--line);background:#0d1524;margin:0 0 .85rem}
.av{width:48px;height:48px;border-radius:50%;object-fit:cover;background:#243049}
.linked-meta{flex:1;min-width:0}
.linked-name{font-weight:700;font-size:1rem}
.linked-sub{color:var(--muted);font-size:.78rem;margin-top:.15rem}
.unlink{color:var(--accent);font-size:.78rem;text-decoration:none;white-space:nowrap}
.err{color:var(--err);background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);padding:.7rem .85rem;border-radius:10px;margin:0 0 1rem;font-size:.9rem;display:none}
.err.show{display:block}
</style></head><body><div class="card">
<div class="topbar">
  <p class="brand">𝐂𝐨𝐝𝐞𝐗</p>
  <div class="langs" role="group" aria-label="Language">
    <button type="button" data-lang="ar" id="btn-ar">عربي</button>
    <button type="button" data-lang="en" id="btn-en">English</button>
  </div>
</div>
<h1 data-i18n="title"></h1>
<p class="meta"><span data-i18n="orderLabel"></span> <strong>${safeName}</strong><br/><span data-i18n="amountLabel"></span> <strong>${amountLabel} USD</strong></p>
<p class="why"><strong data-i18n="whyTitle"></strong><br/><span data-i18n="whyBody"></span></p>
<p class="err" id="errBox"></p>
${bodyBlock}
</div>
<script>
(function(){
  var I18N = {
    ar: {
      title: "قبل الدفع",
      orderLabel: "الطلب:",
      amountLabel: "المبلغ:",
      whyTitle: "خطوة سريعة",
      whyBody: "اضغط الزر، نقرأ يوزر دسكورد حقك فقط عشان التسليم، ونعطيك رتبة Client في السيرفر. ما نطلب كلمات سر ولا بيانات زيادة.",
      connect: "دخول بدسكورد",
      connectHint: "يظهر يوزرك تلقائيًا وتكمل الدفع.",
      linkedSub: "جاهز للتسليم",
      switch: "تغيير",
      roleOk: "تم منحك رتبة Client",
      roleWarn: "تم تسجيل يوزرك. ادخل سيرفر 𝐂𝐨𝐝𝐞𝐗 عشان توصلك الرتبة.",
      userLabel: "اليوزر",
      userPh: "مثال: username",
      idLabel: "الآيدي",
      idPh: "مثال: 123456789012345678",
      submit: "متابعة للدفع",
      errUser: "ادخل بدسكورد قبل الدفع"
    },
    en: {
      title: "Before payment",
      orderLabel: "Order:",
      amountLabel: "Amount:",
      whyTitle: "Quick step",
      whyBody: "Tap the button — we only read your Discord username for delivery, and give you the Client role. No passwords, nothing extra.",
      connect: "Continue with Discord",
      connectHint: "We show your username, then you pay.",
      linkedSub: "Ready for delivery",
      switch: "Switch",
      roleOk: "Client role granted",
      roleWarn: "Username saved. Join the 𝐂𝐨𝐝𝐞𝐗 server to receive the role.",
      userLabel: "Username",
      userPh: "e.g. username",
      idLabel: "User ID",
      idPh: "e.g. 123456789012345678",
      submit: "Continue to payment",
      errUser: "Sign in with Discord first"
    }
  };
  var serverErr = ${errJson};
  var lang = localStorage.getItem("codex_pay_lang") || ${JSON.stringify(initialLang)};
  if (lang !== "en" && lang !== "ar") lang = "ar";

  function apply(langKey) {
    lang = langKey;
    localStorage.setItem("codex_pay_lang", lang);
    var t = I18N[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    var langInput = document.getElementById("langInput");
    if (langInput) langInput.value = lang;
    document.querySelectorAll("[data-i18n]").forEach(function(el){
      var k = el.getAttribute("data-i18n");
      if (t[k] != null) el.textContent = t[k];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function(el){
      var k = el.getAttribute("data-i18n-placeholder");
      if (t[k] != null) el.placeholder = t[k];
    });
    document.getElementById("btn-ar").classList.toggle("active", lang === "ar");
    document.getElementById("btn-en").classList.toggle("active", lang === "en");
    document.querySelectorAll('a.discord-btn, a.unlink').forEach(function(a){
      try {
        var u = new URL(a.href, location.origin);
        u.searchParams.set("lang", lang);
        a.href = u.pathname + u.search;
      } catch {}
    });
    var box = document.getElementById("errBox");
    if (serverErr) {
      box.textContent = /يوزر|username|دسكورد|discord|ربط|signin/i.test(serverErr) ? t.errUser : serverErr;
      box.classList.add("show");
    } else {
      box.classList.remove("show");
      box.textContent = "";
    }
  }

  document.getElementById("btn-ar").addEventListener("click", function(){ apply("ar"); });
  document.getElementById("btn-en").addEventListener("click", function(){ apply("en"); });
  apply(lang);
})();
</script>
</body></html>`;
  }

  function payCheckoutPage({
    amount,
    name,
    discordUser,
    discordId = "",
    lang = "ar",
  }) {
    const amountLabel = Number(amount).toFixed(2);
    const safeName = escapeHtml(name);
    const safeUser = escapeHtml(String(discordUser || "").replace(/^@+/, ""));
    const safeId = escapeHtml(String(discordId || ""));
    const clientId = escapeHtml(paypalClientId);
    const initialLang = lang === "en" ? "en" : "ar";
    if (!paypalClientId) {
      return `<h1>PayPal Client ID missing</h1>`;
    }
    return `<!doctype html>
<html lang="${initialLang}" dir="${initialLang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>𝐂𝐨𝐝𝐞𝐗</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#f5f5f5;color:#111;font-family:"Segoe UI",Tahoma,sans-serif;display:grid;place-items:center;padding:1.25rem}
.wrap{width:100%;max-width:420px}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:.85rem;gap:.75rem;direction:ltr}
.top{display:flex;justify-content:space-between;align-items:center;font-size:.95rem;flex:1;gap:.5rem}
.top .name{font-weight:600}
.langs{display:flex;gap:.3rem;background:#eee;border-radius:999px;padding:.18rem;margin-left:auto}
.langs button{border:0;background:transparent;padding:.3rem .65rem;border-radius:999px;font-size:.75rem;font-weight:600;color:#666;cursor:pointer}
.langs button.active{background:#fff;color:#111;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card{background:#fff;border-radius:16px;padding:1.25rem 1.2rem 1.4rem;box-shadow:0 8px 30px rgba(0,0,0,.08)}
h1{margin:0 0 1rem;font-size:1.15rem;font-weight:700}
.row{display:flex;justify-content:space-between;margin-bottom:1rem;font-size:1rem}
.row strong{font-size:1.05rem}
.sub{margin:0 0 .55rem;color:#555;font-size:.9rem}
#paypal-buttons{min-height:140px;margin-top:.6rem}
#mobile-pay{display:none;margin-top:.6rem}
.m-pay{width:100%;border:0;border-radius:4px;padding:.95rem 1rem;font-weight:700;font-size:1rem;cursor:pointer;margin:0 0 .55rem}
.m-paypal{background:#ffc439;color:#003087}
.m-card{background:#2c2e2f;color:#fff;display:flex;align-items:center;justify-content:center;gap:.55rem}
.m-card svg{width:22px;height:16px;fill:#fff}
.m-powered{margin:.15rem 0 0;text-align:center;color:#888;font-size:.75rem}
.msg{margin-top:.9rem;color:#b91c1c;font-size:.88rem;display:none}
.foot{margin-top:1rem;text-align:center;color:#888;font-size:.78rem}
.resume{display:none;margin-top:.85rem;width:100%;border:0;border-radius:12px;padding:.9rem 1rem;background:#0f766e;color:#fff;font-weight:700;font-size:.95rem;cursor:pointer}
.resume.show{display:block}
.overlay{display:none;position:fixed;inset:0;background:rgba(11,18,32,.72);z-index:99;place-items:center;color:#fff;font-weight:700;font-size:1.05rem;padding:1.5rem;text-align:center}
.overlay.show{display:grid}
</style>
<script src="https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&components=buttons&enable-funding=venmo,paylater,card"></script>
</head><body>
<div class="overlay" id="payOverlay">جاري تأكيد الدفع...</div>
<div class="wrap">
  <div class="topbar">
    <div class="top"><span class="amt">${amountLabel} USD</span><span class="name">${safeName}</span></div>
    <div class="langs">
      <button type="button" id="btn-ar">عربي</button>
      <button type="button" id="btn-en">English</button>
    </div>
  </div>
  <div class="card">
    <h1 data-i18n="title"></h1>
    <div class="row"><span data-i18n="total"></span><strong>${amountLabel} USD</strong></div>
    <p class="sub"><span data-i18n="user"></span> @${safeUser}</p>
    <p class="sub" data-i18n="payOpts"></p>
    <div id="paypal-buttons"></div>
    <div id="mobile-pay">
      <button type="button" class="m-pay m-paypal" id="mPayPal">PayPal</button>
      <button type="button" class="m-pay m-card" id="mCard">
        <svg viewBox="0 0 24 16" aria-hidden="true"><rect x="1" y="1" width="22" height="14" rx="2" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M1 5h22" stroke="#fff" stroke-width="1.5"/><rect x="3.5" y="9" width="6" height="2" rx=".5"/></svg>
        <span>Debit or Credit Card</span>
      </button>
      <p class="m-powered">Powered by PayPal</p>
    </div>
    <button type="button" class="resume" id="resumeBtn" data-i18n="resume"></button>
    <p class="msg" id="err"></p>
  </div>
  <p class="foot" data-i18n="foot"></p>
</div>
<script>
(function(){
  var amount = ${JSON.stringify(amountLabel)};
  var name = ${JSON.stringify(String(name))};
  var discordUser = ${JSON.stringify(String(discordUser || "").replace(/^@+/, ""))};
  var discordId = ${JSON.stringify(String(discordId || ""))};
  var err = document.getElementById('err');
  var overlay = document.getElementById('payOverlay');
  var resumeBtn = document.getElementById('resumeBtn');
  var I18N = {
    ar: {
      title: "موجز الطلب",
      total: "الإجمالي",
      user: "اليوزر:",
      id: "كوبي يوزر:",
      payOpts: "خيارات الدفع الإلكتروني السريع",
      foot: "مدعوم من PayPal · 𝐂𝐨𝐝𝐞𝐗",
      resume: "تم الدفع — اضغط هنا للمتابعة",
      confirming: "جاري تأكيد الدفع...",
      fail: "فشل الدفع",
      createFail: "تعذر إنشاء الطلب",
      captureFail: "تعذر تأكيد الدفع",
      errPay: "حدث خطأ أثناء الدفع",
      cancel: "تم إلغاء الدفع",
      declined: "تم رفض الدفع. ما تم خصم المبلغ — جرّب بطاقة ثانية أو PayPal.",
      notPaidYet: "ما تم تأكيد الدفع بعد. إذا خصموا المبلغ انتظر ثواني واضغط مرة ثانية."
    },
    en: {
      title: "Order summary",
      total: "Total",
      user: "Username:",
      id: "Copy User ID:",
      payOpts: "Express checkout options",
      foot: "Powered by PayPal · 𝐂𝐨𝐝𝐞𝐗",
      resume: "Payment done — tap here to continue",
      confirming: "Confirming payment...",
      fail: "Payment failed",
      createFail: "Could not create the order",
      captureFail: "Could not confirm payment",
      errPay: "Something went wrong during payment",
      cancel: "Payment cancelled",
      declined: "Payment declined. You were not charged — try another card or PayPal.",
      notPaidYet: "Payment not confirmed yet. If you were charged, wait a few seconds and try again."
    }
  };
  var lang = localStorage.getItem("codex_pay_lang") || ${JSON.stringify(initialLang)};
  if (lang !== "en" && lang !== "ar") lang = "ar";
  function t(){ return I18N[lang]; }
  function apply(next){
    lang = next;
    localStorage.setItem("codex_pay_lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.getElementById("btn-ar").classList.toggle("active", lang === "ar");
    document.getElementById("btn-en").classList.toggle("active", lang === "en");
    document.querySelectorAll("[data-i18n]").forEach(function(el){
      var k = el.getAttribute("data-i18n");
      if (t()[k] != null) el.textContent = t()[k];
    });
    if (overlay && overlay.classList.contains('show')) overlay.textContent = t().confirming;
  }
  document.getElementById("btn-ar").addEventListener("click", function(){ apply("ar"); });
  document.getElementById("btn-en").addEventListener("click", function(){ apply("en"); });
  apply(lang);

  function showErr(msg){ err.style.display='block'; err.textContent=msg||t().fail; }
  function hideOverlay(){ overlay.classList.remove('show'); }
  function showOverlay(){
    overlay.textContent = t().confirming;
    overlay.classList.add('show');
  }
  function successUrl(orderId, meta){
    var m = meta || {};
    var q = new URLSearchParams({
      amount: m.amount || amount,
      name: m.name || name,
      user: m.user || discordUser,
      lang: m.lang || lang
    });
    if (orderId) q.set('token', orderId);
    return location.origin + '/pay/success?' + q.toString();
  }
  function savePending(orderId){
    try {
      // localStorage survives mobile tab switches better than sessionStorage
      localStorage.setItem('codex_pending_order', String(orderId || ''));
      sessionStorage.setItem('codex_pending_order', String(orderId || ''));
      sessionStorage.setItem('codex_pay_meta', JSON.stringify({
        amount: amount, name: name, user: discordUser, lang: lang, orderId: orderId
      }));
      document.cookie = 'codex_pending_pay=' + encodeURIComponent(String(orderId||'')) + '; Path=/; Max-Age=7200; SameSite=Lax; Secure';
    } catch (e) {}
  }
  function pendingId(){
    try {
      return sessionStorage.getItem('codex_pending_order')
        || localStorage.getItem('codex_pending_order')
        || '';
    } catch (e) { return ''; }
  }
  function clearPending(){
    try {
      sessionStorage.removeItem('codex_pending_order');
      localStorage.removeItem('codex_pending_order');
      document.cookie = 'codex_pending_pay=; Path=/; Max-Age=0; SameSite=Lax; Secure';
    } catch (e) {}
  }
  function goSuccess(orderId, meta){
    clearPending();
    hideOverlay();
    var url = successUrl(orderId, meta);
    try { window.location.assign(url); return; } catch (e0) {}
    try { window.location.href = url; return; } catch (e1) {}
    try { window.location.replace(url); } catch (e2) {}
  }
  function fetchStatus(id){
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function(){ try { ctrl && ctrl.abort(); } catch (e) {} }, 8000);
    return fetch('/paypal/status?id=' + encodeURIComponent(id), {
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function(r){
      clearTimeout(timer);
      return r.json().catch(function(){ return {}; });
    }).catch(function(){
      clearTimeout(timer);
      return { ok: false, paid: false };
    });
  }
  function checkPaid(orderId, opts){
    var id = orderId || pendingId();
    if (!id) {
      hideOverlay();
      resumeBtn.classList.remove('show');
      return Promise.resolve(false);
    }
    if (opts && opts.overlay) showOverlay();
    var stuck = setTimeout(function(){ hideOverlay(); }, 9000);
    return fetchStatus(id).then(function(j){
      clearTimeout(stuck);
      if (j && j.paid) {
        // Only show recovery button after confirmed payment
        resumeBtn.classList.add('show');
        if (!opts || opts.autoRedirect !== false) goSuccess(id, j);
        return true;
      }
      hideOverlay();
      resumeBtn.classList.remove('show');
      if (j && j.denied) {
        clearPending();
        showErr(t().declined);
        return false;
      }
      if (opts && opts.errorIfNot) showErr(t().notPaidYet);
      if (!opts || !opts.keepPending) clearPending();
      return false;
    });
  }

  try {
    sessionStorage.setItem('codex_pay_meta', JSON.stringify({
      amount: amount, name: name, user: discordUser, lang: lang
    }));
  } catch (e) {}

  function createOrderPayload(){
    return {
      amount: Number(amount),
      name: name,
      discordUser: discordUser,
      discordId: discordId,
      lang: lang
    };
  }
  function createOrder(){
    return fetch('/paypal/order', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(createOrderPayload())
    }).then(function(r){ return r.json().then(function(j){
      if(!r.ok||!j.id) throw new Error(j.error||t().createFail);
      savePending(j.id);
      return j.id;
    }); });
  }
  function onApprove(data, actions){
    var orderId = (data && data.orderID) || pendingId() || '';
    savePending(orderId);
    showOverlay();
    function failDeclined(msg){
      hideOverlay();
      clearPending();
      showErr(msg || t().declined);
    }
    function afterCapture(details){
      var st = String((details && details.status) || '');
      if (st === 'COMPLETED') {
        goSuccess(orderId);
        return;
      }
      try {
        var caps = (((details || {}).purchase_units || [])[0] || {}).payments || {};
        var list = caps.captures || [];
        var bad = list.some(function(c){ return /DECLINED|DENIED|FAILED/i.test(String(c.status||'')); });
        var good = list.some(function(c){ return String(c.status||'') === 'COMPLETED'; });
        if (good) { goSuccess(orderId); return; }
        if (bad) { failDeclined(t().declined); return; }
      } catch (e) {}
      checkPaid(orderId, { overlay: true, keepPending: true });
    }
    var p =
      actions && actions.order && typeof actions.order.capture === 'function'
        ? actions.order.capture()
        : fetch('/paypal/capture', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ orderID: orderId }),
            keepalive: true
          }).then(function(r){ return r.json(); });
    setTimeout(function(){
      if (overlay.classList.contains('show')) {
        checkPaid(orderId, { overlay: true, keepPending: true });
      }
    }, 10000);
    return Promise.resolve(p).then(afterCapture).catch(function(e){
      var msg = (e && (e.message || e)) || '';
      if (/INSTRUMENT_DECLINED|DECLINED|DENIED|FAILED|CARD/i.test(String(msg))) {
        failDeclined(t().declined);
        return;
      }
      checkPaid(orderId, { overlay: true, keepPending: true });
    });
  }
  function onError(e){
    hideOverlay();
    clearPending();
    var msg = (e && e.message) || '';
    showErr(/declin|denied|instrument/i.test(String(msg)) ? t().declined : (msg || t().errPay));
  }
  function onCancel(){
    hideOverlay();
    clearPending();
    showErr(t().cancel);
  }

  // PayPal return with token — only go success if actually paid
  try {
    var params = new URLSearchParams(location.search);
    var retToken = params.get('token') || params.get('orderID');
    if (retToken) {
      savePending(retToken);
      checkPaid(retToken, { overlay: true, keepPending: true });
      return;
    }
  } catch (e) {}

  // After returning from PayPal (same tab): if payment completed, show button + redirect
  function recoverIfPaid(showOverlayFlag){
    if (!pendingId()) {
      resumeBtn.classList.remove('show');
      return;
    }
    checkPaid(pendingId(), {
      overlay: !!showOverlayFlag,
      keepPending: true,
      autoRedirect: true
    });
  }
  if (pendingId()) recoverIfPaid(false);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') recoverIfPaid(false);
  });
  window.addEventListener('pageshow', function(){ recoverIfPaid(false); });
  resumeBtn.addEventListener('click', function(){
    checkPaid(pendingId(), {
      overlay: true,
      keepPending: true,
      autoRedirect: true,
      errorIfNot: true
    });
  });

  var ua = navigator.userAgent || '';
  var isMobile = /Android|iPhone|iPad|iPod|Mobile|Discord|FBAN|Line\//i.test(ua)
    || ((window.matchMedia && window.matchMedia('(max-width: 900px)').matches)
      && ('ontouchstart' in window));

  function startMobileRedirect(){
    showOverlay();
    overlay.textContent = t().confirming;
    fetch('/paypal/order', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(createOrderPayload())
    }).then(function(r){
      return r.json().then(function(j){
        if (!r.ok || !j.url) throw new Error((j && j.error) || t().createFail);
        savePending(j.id);
        // Full-page PayPal — return_url /pay/return sends buyer to success
        window.location.href = j.url;
      });
    }).catch(function(e){
      hideOverlay();
      showErr((e && e.message) || t().errPay);
    });
  }

  if (isMobile) {
    // Smart Buttons break success redirect inside mobile/Discord WebViews.
    // Use full PayPal redirect so /pay/return always runs after payment.
    var desk = document.getElementById('paypal-buttons');
    var mob = document.getElementById('mobile-pay');
    if (desk) desk.style.display = 'none';
    if (mob) mob.style.display = 'block';
    document.getElementById('mPayPal').addEventListener('click', startMobileRedirect);
    document.getElementById('mCard').addEventListener('click', startMobileRedirect);
  } else {
    var mobHide = document.getElementById('mobile-pay');
    if (mobHide) mobHide.style.display = 'none';
    if (window.paypal && paypal.Buttons) {
      paypal.Buttons({
        style: { layout:'vertical', color:'gold', shape:'rect', label:'paypal', height:48 },
        createOrder: createOrder,
        onApprove: onApprove,
        onError: onError,
        onCancel: onCancel
      }).render('#paypal-buttons');
    }
  }
})();
</script>
</body></html>`;
  }

  app.get("/auth/discord/start", (req, res) => {
    const oauth = getDiscordOAuthConfig();
    if (!oauth.enabled) {
      return res
        .status(503)
        .type("html")
        .send(
          "<h1>ربط دسكورد غير مضبوط</h1><p>أضف DISCORD_CLIENT_SECRET و PUBLIC_BASE_URL في Railway، وسجّل Redirect URL في بوابة دسكورد.</p>",
        );
    }
    const amount = String(req.query.amount || "");
    const name = String(req.query.name || "𝐂𝐨𝐝𝐞𝐗 — خدمة");
    const lang = String(req.query.lang || "ar").toLowerCase() === "en" ? "en" : "ar";
    const state = signOAuthState({ amount, name, lang }, oauth.stateSecret);
    const url = buildAuthorizeUrl({
      clientId: oauth.clientId,
      redirectUri: oauth.redirectUri,
      state,
    });
    res.redirect(302, url);
  });

  app.get("/auth/discord/callback", async (req, res) => {
    const oauth = getDiscordOAuthConfig();
    try {
      if (!oauth.enabled) throw new Error("oauth not configured");
      if (req.query.error) {
        throw new Error(String(req.query.error_description || req.query.error));
      }
      const code = String(req.query.code || "");
      const state = verifyOAuthState(String(req.query.state || ""), oauth.stateSecret);
      if (!code || !state) throw new Error("invalid oauth state");

      const token = await exchangeCode({
        clientId: oauth.clientId,
        clientSecret: oauth.clientSecret,
        redirectUri: oauth.redirectUri,
        code,
      });
      const me = await fetchDiscordMe(token.access_token);
      let roleOk = false;
      try {
        const granted = await ensureClientRole(me.id, token.access_token);
        roleOk = Boolean(granted?.ok);
        if (!granted?.ok) {
          console.warn("client role not granted:", granted?.reason || "unknown");
        }
      } catch (roleErr) {
        console.error("client role grant failed:", roleErr.message);
      }
      const session = signDiscordSession(me, oauth.stateSecret);
      const amount = Number(state.amount);
      const name = String(state.name || "𝐂𝐨𝐝𝐞𝐗 — خدمة");
      const lang = state.lang === "en" ? "en" : "ar";
      const q = new URLSearchParams({
        amount: Number.isFinite(amount) ? amount.toFixed(2) : String(state.amount || ""),
        name,
        lang,
        role: roleOk ? "1" : "0",
      });
      res.setHeader(
        "Set-Cookie",
        `codex_discord=${encodeURIComponent(session)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`,
      );
      res.redirect(302, `/pay?${q.toString()}`);
    } catch (e) {
      console.error("discord oauth callback:", e.message);
      res
        .status(400)
        .type("html")
        .send(
          `<h1>فشل تسجيل دسكورد</h1><p>${escapeHtml(e.message)}</p><p><a href="/pay">رجوع</a></p>`,
        );
    }
  });

  app.get("/auth/discord/logout", (req, res) => {
    const amount = String(req.query.amount || "");
    const name = String(req.query.name || "");
    const lang = String(req.query.lang || "ar");
    const q = new URLSearchParams({ amount, name, lang });
    res.setHeader(
      "Set-Cookie",
      "codex_discord=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    );
    res.redirect(302, `/pay?${q.toString()}`);
  });

  // Checkout gate: Discord OAuth (username + Client role), then PayPal
  app.get("/pay", async (req, res) => {
    try {
      // Mobile recovery: pending cookie after PayPal when storage was wiped
      const cookies = parseCookies(req);
      const pendingCookie = String(cookies.codex_pending_pay || "").trim();
      if (pendingCookie && !String(req.query.token || "").trim()) {
        const state = await resolvePayOrderState(pendingCookie);
        if (state.paid || state.status === "APPROVED") {
          const q = new URLSearchParams({
            token: pendingCookie,
            lang: state.meta.lang === "en" ? "en" : "ar",
          });
          if (state.meta.amount) q.set("amount", String(state.meta.amount));
          if (state.meta.name) q.set("name", String(state.meta.name));
          if (state.meta.user) q.set("user", String(state.meta.user));
          clearPendingPayCookie(res);
          return res.redirect(302, `/pay/success?${q.toString()}`);
        }
      }

      // PayPal full-page return after card/wallet approve
      const retToken = String(req.query.token || req.query.orderID || "").trim();
      if (retToken) {
        const state = await resolvePayOrderState(retToken);
        const saved = state.meta || takePayMeta(retToken) || {};
        const q = new URLSearchParams({
          token: retToken,
          lang:
            String(req.query.lang || saved.lang || "").toLowerCase() === "en"
              ? "en"
              : "ar",
        });
        const amount = req.query.amount || saved.amount;
        const name = req.query.name || saved.name;
        const user = req.query.user || saved.user;
        if (amount) q.set("amount", String(amount));
        if (name) q.set("name", String(name));
        if (user) q.set("user", String(user));
        clearPendingPayCookie(res);
        if (state.denied) {
          return res.redirect(302, `/pay/cancel?${q.toString()}`);
        }
        return res.redirect(302, `/pay/success?${q.toString()}`);
      }
      if (!paypalPayments) {
        return res
          .status(503)
          .type("html")
          .send(
            "<h1>PayPal غير مضبوط</h1><p>أضف PAYPAL_CLIENT_ID و PAYPAL_CLIENT_SECRET في Railway.</p>",
          );
      }
      const amount = Number(req.query.amount || req.query.a);
      const name = String(req.query.name || req.query.n || "𝐂𝐨𝐝𝐞𝐗 — خدمة");
      if (!Number.isFinite(amount) || amount <= 0) {
        return res
          .status(400)
          .type("html")
          .send("<h1>خطأ</h1><p>المبلغ غير صالح. استخدم مثلاً /pay?amount=10&name=خدمة</p>");
      }
      const oauth = getDiscordOAuthConfig();
      const session = readDiscordSession(req);
      let discord = String(
        req.query.discord || req.query.user || req.query.u || "",
      )
        .trim()
        .replace(/^@+/, "");
      let discordId = String(
        req.query.discordId || req.query.id || req.query.d || "",
      ).trim();
      if (session?.id) {
        discord = String(session.username || discord).replace(/^@+/, "");
        discordId = String(session.id);
      }
      const lang = String(req.query.lang || "").toLowerCase() === "en" ? "en" : "ar";
      const roleParam = String(req.query.role || "");
      const roleOk =
        roleParam === "1" ? true : roleParam === "0" ? false : null;
      const skipForm =
        !session &&
        discord &&
        /^\d{15,22}$/.test(discordId) &&
        String(req.query.ready || "") === "1";
      if (!skipForm) {
        return res.type("html").send(
          payFormPage({
            amount,
            name,
            discord,
            discordId,
            lang,
            connected: session,
            oauthEnabled: oauth.enabled,
            roleOk: session ? roleOk : null,
          }),
        );
      }
      return res
        .type("html")
        .send(
          payCheckoutPage({
            amount,
            name,
            discordUser: discord,
            discordId,
            lang,
          }),
        );
    } catch (e) {
      res
        .status(400)
        .type("html")
        .send(`<h1>خطأ</h1><p>${escapeHtml(e.message)}</p>`);
    }
  });

  app.post("/pay", express.urlencoded({ extended: false }), async (req, res) => {
    try {
      if (!paypalPayments) {
        return res.status(503).type("html").send("<h1>PayPal غير مضبوط</h1>");
      }
      const oauth = getDiscordOAuthConfig();
      const session = readDiscordSession(req);
      const amount = Number(req.body?.amount);
      const name = String(req.body?.name || "𝐂𝐨𝐝𝐞𝐗 — خدمة");
      let discord = String(req.body?.discord || "")
        .trim()
        .replace(/^@+/, "");
      let discordId = String(req.body?.discordId || "")
        .trim()
        .replace(/\s+/g, "");
      if (session?.id) {
        discord = String(session.username || discord).replace(/^@+/, "");
        discordId = String(session.id);
      }
      const lang = String(req.body?.lang || "").toLowerCase() === "en" ? "en" : "ar";
      if (!Number.isFinite(amount) || amount <= 0) {
        return res
          .status(400)
          .type("html")
          .send("<h1>خطأ</h1><p>المبلغ غير صالح</p>");
      }
      if (!discord || discord.length < 2 || !/^\d{15,22}$/.test(discordId)) {
        return res
          .status(400)
          .type("html")
          .send(
            payFormPage({
              amount,
              name,
              discord,
              discordId,
              lang,
              connected: session,
              oauthEnabled: oauth.enabled,
              error: oauth.enabled
                ? "ادخل بدسكورد قبل الدفع"
                : "اكتب اليوزر والآيدي قبل الدفع",
            }),
          );
      }
      return res
        .type("html")
        .send(
          payCheckoutPage({
            amount,
            name,
            discordUser: discord,
            discordId,
            lang,
          }),
        );
    } catch (e) {
      const amount = Number(req.body?.amount);
      const name = String(req.body?.name || "𝐂𝐨𝐝𝐞𝐗 — خدمة");
      const discord = String(req.body?.discord || "")
        .trim()
        .replace(/^@+/, "");
      const discordId = String(req.body?.discordId || "").trim();
      const lang = String(req.body?.lang || "").toLowerCase() === "en" ? "en" : "ar";
      const oauth = getDiscordOAuthConfig();
      if (Number.isFinite(amount) && amount > 0) {
        return res
          .status(400)
          .type("html")
          .send(
            payFormPage({
              amount,
              name,
              discord,
              discordId,
              lang,
              connected: readDiscordSession(req),
              oauthEnabled: oauth.enabled,
              error: e.message,
            }),
          );
      }
      res
        .status(400)
        .type("html")
        .send(`<h1>خطأ</h1><p>${escapeHtml(e.message)}</p>`);
    }
  });

  app.get("/pay/success", async (req, res) => {
    const token = String(req.query.token || req.query.orderID || "").trim();
    const saved = token ? takePayMeta(token) : null;
    // Settle capture if PayPal returned an order token (card/redirect flows)
    let fromOrder = null;
    if (token && paypalPayments) {
      try {
        await paypalPayments.captureOrder(token);
      } catch (e) {
        console.warn("pay/success capture:", e.message || e);
      }
      try {
        const order = await paypalPayments.getOrder(token);
        const custom = paypalPayments.decodeCustomId?.(
          order?.purchase_units?.[0]?.custom_id || "",
        );
        fromOrder = {
          amount: order?.purchase_units?.[0]?.amount?.value || "",
          name: custom?.productName || "",
          user: custom?.discordUser || "",
        };
      } catch (e) {
        console.warn("pay/success getOrder:", e.message || e);
      }
    }

    let lang = String(req.query.lang || saved?.lang || "").toLowerCase() === "en" ? "en" : "ar";
    let amount = String(req.query.amount || saved?.amount || fromOrder?.amount || "").trim();
    let name = String(req.query.name || saved?.name || fromOrder?.name || "").trim();
    let user = String(req.query.user || req.query.discord || saved?.user || fromOrder?.user || "")
      .trim()
      .replace(/^@+/, "");
    const amountLabel = amount
      ? `${escapeHtml(
          Number.isFinite(Number(amount)) ? Number(amount).toFixed(2) : amount,
        )} USD`
      : "";
    const safeName = escapeHtml(name || (lang === "en" ? "your order" : "طلبك"));
    const safeUser = escapeHtml(user);
    const copy =
      lang === "en"
        ? {
            title: "Payment successful",
            thanks: "Thank you for trusting 𝐂𝐨𝐝𝐞𝐗.",
            order: "Order",
            amount: "Amount",
            deliver: "Delivery account",
            next: "We’ll confirm on Discord shortly and start delivery.",
            tip: "Keep your Discord notifications on.",
          }
        : {
            title: "تم الدفع بنجاح",
            thanks: "شكراً لثقتك في 𝐂𝐨𝐝𝐞𝐗.",
            order: "الطلب",
            amount: "المبلغ",
            deliver: "حساب التسليم",
            next: "راح يوصلك تأكيد على دسكورد قريب ونبدأ التسليم.",
            tip: "خلّ تنبيهات دسكورد مفتوحة.",
          };
    const hasDetails = Boolean(name || amountLabel || user);
    const details = [
      name
        ? `<div class="row" id="rowOrder"><span>${copy.order}</span><strong id="vOrder">${safeName}</strong></div>`
        : `<div class="row" id="rowOrder" hidden><span>${copy.order}</span><strong id="vOrder"></strong></div>`,
      amountLabel
        ? `<div class="row" id="rowAmount"><span>${copy.amount}</span><strong id="vAmount">${amountLabel}</strong></div>`
        : `<div class="row" id="rowAmount" hidden><span>${copy.amount}</span><strong id="vAmount"></strong></div>`,
      user
        ? `<div class="row" id="rowUser"><span>${copy.deliver}</span><strong id="vUser">@${safeUser}</strong></div>`
        : `<div class="row" id="rowUser" hidden><span>${copy.deliver}</span><strong id="vUser"></strong></div>`,
    ].join("");

    res.type("html").send(`<!doctype html>
<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${copy.title} — 𝐂𝐨𝐝𝐞𝐗</title>
<style>
:root{--bg:#0b1220;--card:#121a2b;--line:#243049;--text:#e8eefc;--muted:#9fb0cc;--accent:#2dd4bf;--ok:#34d399}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.25rem;font-family:"Segoe UI",Tahoma,sans-serif;background:radial-gradient(1100px 560px at 80% -10%,#163528 0%,var(--bg) 55%);color:var(--text)}
.card{width:100%;max-width:440px;padding:1.85rem 1.5rem 1.6rem;border:1px solid rgba(52,211,153,.28);border-radius:20px;background:rgba(18,26,43,.94);box-shadow:0 24px 70px rgba(0,0,0,.4);text-align:center}
.badge{width:72px;height:72px;margin:0 auto 1rem;border-radius:50%;display:grid;place-items:center;background:rgba(52,211,153,.14);border:1px solid rgba(52,211,153,.35);color:var(--ok);font-size:2rem;font-weight:700}
.brand{margin:0 0 .35rem;color:var(--accent);letter-spacing:.08em;font-size:.82rem;font-weight:700}
h1{margin:0 0 .55rem;font-size:1.55rem}
.thanks{margin:0 0 1.15rem;color:var(--muted);line-height:1.7}
.box{text-align:start;border:1px solid var(--line);background:#0d1524;border-radius:14px;padding:.85rem 1rem;margin:0 0 1.1rem}
.row{display:flex;justify-content:space-between;gap:1rem;padding:.45rem 0;font-size:.95rem;color:var(--muted)}
.row+ .row{border-top:1px solid rgba(36,48,73,.85)}
.row strong{color:var(--text);font-weight:700;text-align:end;word-break:break-word}
.next{margin:0 0 .45rem;line-height:1.7;font-size:.98rem}
.tip{margin:0;color:var(--muted);font-size:.84rem;line-height:1.55}
</style></head><body>
<div class="card">
  <div class="badge" aria-hidden="true">✓</div>
  <p class="brand">𝐂𝐨𝐝𝐞𝐗</p>
  <h1>${copy.title}</h1>
  <p class="thanks">${copy.thanks}</p>
  <div class="box" id="detailsBox" ${hasDetails ? "" : "hidden"}>${details}</div>
  <p class="next">${copy.next}</p>
  <p class="tip">${copy.tip}</p>
</div>
<script>
(function(){
  try {
    var meta = JSON.parse(sessionStorage.getItem('codex_pay_meta') || '{}');
    if (!meta || typeof meta !== 'object') return;
    var box = document.getElementById('detailsBox');
    function fill(rowId, valId, text, prefix){
      if (!text) return;
      var row = document.getElementById(rowId);
      var val = document.getElementById(valId);
      if (!row || !val) return;
      val.textContent = (prefix || '') + text;
      row.hidden = false;
      if (box) box.hidden = false;
    }
    var q = new URLSearchParams(location.search);
    if (!q.get('name') && meta.name) fill('rowOrder', 'vOrder', meta.name);
    if (!q.get('amount') && meta.amount) fill('rowAmount', 'vAmount', Number(meta.amount).toFixed(2) + ' USD');
    if (!q.get('user') && meta.user) fill('rowUser', 'vUser', meta.user, '@');
  } catch (e) {}
})();
</script>
</body></html>`);
  });

  app.get("/pay/cancel", (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>تم الإلغاء — 𝐂𝐨𝐝𝐞𝐗</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b1220;color:#e8eefc;display:grid;place-items:center;min-height:100vh;margin:0}
.card{max-width:420px;padding:2rem;border:1px solid #1e2a44;border-radius:16px;background:#121a2b;text-align:center}
h1{margin:0 0 .5rem;font-size:1.4rem}p{opacity:.85;line-height:1.6}
</style></head><body><div class="card">
<h1>تم إلغاء الدفع</h1>
<p>ما تم خصم أي مبلغ. تقدر ترجع وتجرب مرة ثانية متى ما تبي.</p>
</div></body></html>`);
  });

  // Dashboard config — same origin API
  app.get("/config.js", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.type("application/javascript").send(
      `window.CODEX = ${JSON.stringify({ apiUrl: "", apiKey })};`,
    );
  });

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, max: 240 }));
  api.use((req, res, next) => {
    const key = req.header("x-api-key") || req.query.key;
    if (!apiKey || key !== apiKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });

  api.get("/health", (req, res) => {
    res.json({
      ok: true,
      bot: client.user?.tag || null,
      guilds: client.guilds.cache.size,
      uptime: process.uptime(),
    });
  });

  api.get("/overview", (req, res) => {
    res.json({
      bot: {
        tag: client.user?.tag,
        id: client.user?.id,
        avatar: client.user?.displayAvatarURL({ size: 128 }),
      },
      guilds: client.guilds.cache.map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL({ size: 64 }),
        members: g.memberCount,
      })),
      stats: store.data.stats,
      protections: PROTECTION_META,
    });
  });

  api.get("/guilds/:id", (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });
    const protections = {};
    for (const p of PROTECTION_META) {
      protections[p.key] = {
        enabled: store.data.protections[p.key]?.enabled ?? true,
      };
    }
    res.json({
      id: guild.id,
      name: guild.name,
      members: guild.memberCount,
      settings: {
        protections,
        broadcast: store.data.broadcast,
        logChannelId: store.data.settings?.logChannelId || null,
        exemptRoles: store.data.settings?.exemptRoles || [],
        exemptUsers: store.data.settings?.exemptUsers || [],
      },
      job: broadcast.getJob(guild.id),
      roles: guild.roles.cache
        .filter((r) => r.id !== guild.id)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      channels: guild.channels.cache
        .filter((c) => c.isTextBased?.())
        .map((c) => ({ id: c.id, name: c.name })),
    });
  });

  api.patch("/guilds/:id/protections/:key", (req, res) => {
    const key = req.params.key;
    if (!PROTECTION_META.some((p) => p.key === key)) {
      return res.status(404).json({ error: "Unknown" });
    }
    store.data.protections[key] = {
      ...(store.data.protections[key] || {}),
      enabled: Boolean(req.body.enabled),
    };
    store.save();
    res.json({ ok: true, protection: store.data.protections[key] });
  });

  api.post("/guilds/:id/protections/bulk", (req, res) => {
    for (const p of PROTECTION_META) {
      store.data.protections[p.key] = { enabled: Boolean(req.body.enabled) };
    }
    store.save();
    res.json({ ok: true });
  });

  api.patch("/guilds/:id/settings", (req, res) => {
    if (!store.data.settings) store.data.settings = {};
    if (req.body.logChannelId !== undefined) {
      store.data.settings.logChannelId = req.body.logChannelId || null;
    }
    if (Array.isArray(req.body.exemptRoles)) {
      store.data.settings.exemptRoles = req.body.exemptRoles;
    }
    if (Array.isArray(req.body.exemptUsers)) {
      store.data.settings.exemptUsers = req.body.exemptUsers;
    }
    if (req.body.broadcast) {
      store.data.broadcast = { ...store.data.broadcast, ...req.body.broadcast };
    }
    store.save();
    res.json({
      ok: true,
      settings: {
        ...store.data.settings,
        broadcast: store.data.broadcast,
        protections: store.data.protections,
      },
    });
  });

  api.get("/logs", (req, res) => {
    res.json((store.data.logs || []).slice(0, Number(req.query.limit) || 40));
  });

  api.get("/guilds/:id/broadcast/counts", async (req, res) => {
    try {
      res.json(await broadcast.countTargets(req.params.id));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  api.get("/guilds/:id/broadcast/job", (req, res) => {
    res.json(broadcast.getJob(req.params.id) || { running: false });
  });

  api.post("/guilds/:id/broadcast", async (req, res) => {
    try {
      if (guildId && req.params.id !== guildId) {
        return res.status(403).json({ error: "Guild not allowed" });
      }
      const job = await broadcast.startBroadcast({
        guildId: req.params.id,
        content: req.body.content,
        filter: req.body.filter || "all",
        roleId: req.body.roleId || null,
        userId: req.body.userId || null,
        requestedBy: req.body.requestedBy || "dashboard",
      });
      res.json(job);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  api.post("/guilds/:id/broadcast/cancel", (req, res) => {
    res.json({ ok: broadcast.cancel(req.params.id) });
  });

  app.use("/api", api);

  // Static dashboard at / and /guard
  app.use(express.static(GUARD_PUBLIC, { index: "index.html" }));
  app.use("/guard", express.static(GUARD_PUBLIC, { index: "index.html" }));

  return app;
}

export { PROTECTION_META };
