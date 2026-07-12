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

  // PayPal webhook needs raw body — must be before express.json()
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
    res.json({
      ok: true,
      user: client.user?.tag || null,
      paypal: Boolean(paypalPayments),
    });
  });

  // Create PayPal order → returns { url }
  app.post("/paypal/order", express.json(), async (req, res) => {
    try {
      if (!paypalPayments) {
        return res.status(503).json({ error: "PayPal not configured" });
      }
      const { name, amount, discordId, discordUser } = req.body || {};
      const order = await paypalPayments.createOrder({
        name: name || "𝐂𝐨𝐝𝐞𝐗 — خدمة",
        amountMajor: amount,
        discordId,
        discordUser,
      });
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

  function payFormPage({
    amount,
    name,
    error = "",
    discord = "",
    discordId = "",
    lang = "ar",
    connected = null,
    oauthEnabled = false,
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

    const connectedBlock = hasConnected
      ? `<div class="linked">
  <img class="av" src="${escapeHtml(av)}" alt=""/>
  <div class="linked-meta">
    <div class="linked-name">@${escapeHtml(userName)}</div>
    <div class="linked-id">${escapeHtml(userId)}</div>
  </div>
  <a class="unlink" href="${escapeHtml(oauthStart)}" data-i18n="relink"></a>
</div>
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
  <span class="dc-ico"> Discord </span>
  <span data-i18n="connect"></span>
</a>
<p class="hint center" data-i18n="connectHint"></p>`
        : `<form method="POST" action="/pay">
<input type="hidden" name="amount" value="${escapeHtml(amountLabel)}"/>
<input type="hidden" name="name" value="${safeName}"/>
<input type="hidden" name="lang" id="langInput" value="${initialLang}"/>
<div class="field">
<label for="discord"><span data-i18n="userLabel"></span> <span class="badge" data-i18n="userBadge"></span></label>
<input id="discord" name="discord" type="text" required maxlength="40" autocomplete="username" data-i18n-placeholder="userPh" value="${escapeHtml(discord)}" autofocus/>
<p class="hint" data-i18n="userHint"></p>
</div>
<div class="field">
<label for="discordId"><span data-i18n="idLabel"></span> <span class="badge" data-i18n="idBadge"></span></label>
<input id="discordId" name="discordId" type="text" required maxlength="22" inputmode="numeric" pattern="\\d{15,22}" data-i18n-placeholder="idPh" value="${escapeHtml(discordId)}"/>
<p class="hint" data-i18n="idHint"></p>
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
.why{margin:0 0 1.15rem;padding:.85rem 1rem;border-radius:12px;border:1px solid rgba(45,212,191,.22);background:rgba(45,212,191,.07);color:var(--text);font-size:.88rem;line-height:1.65}
.why strong{color:var(--accent)}
button.submit{width:100%;border:0;border-radius:12px;padding:.95rem 1rem;background:linear-gradient(135deg,#14b8a6,#0d9488);color:#041016;font-weight:700;font-size:1rem;cursor:pointer;margin-top:.35rem}
button.submit:hover{filter:brightness(1.05)}
.discord-btn{display:flex;align-items:center;justify-content:center;gap:.55rem;width:100%;padding:1rem 1rem;border-radius:12px;background:var(--discord);color:#fff;font-weight:700;font-size:1rem;text-decoration:none;margin-top:.25rem;box-shadow:0 10px 30px rgba(88,101,242,.28)}
.discord-btn:hover{filter:brightness(1.06)}
.dc-ico{display:inline-flex;width:1.35rem;height:1.35rem;border-radius:4px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 127.14 96.36'%3E%3Cpath fill='%23fff' d='M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69c-6.23 0-11.36-5.66-11.36-12.6s4.98-12.62 11.36-12.62S53.9 46.13 53.9 53.09 48.83 65.69 42.45 65.69Zm42.24 0c-6.23 0-11.36-5.66-11.36-12.6s5-12.62 11.36-12.62 11.38 5.72 11.38 12.62-5.03 12.6-11.38 12.6Z'/%3E%3C/svg%3E") center/contain no-repeat;text-indent:-999px;overflow:hidden}
.linked{display:flex;align-items:center;gap:.75rem;padding:.85rem 1rem;border-radius:14px;border:1px solid var(--line);background:#0d1524;margin:0 0 1rem}
.av{width:48px;height:48px;border-radius:50%;object-fit:cover;background:#243049}
.linked-meta{flex:1;min-width:0}
.linked-name{font-weight:700;font-size:1rem}
.linked-id{color:var(--muted);font-size:.78rem;margin-top:.15rem;word-break:break-all}
.unlink{color:var(--accent);font-size:.78rem;text-decoration:none;white-space:nowrap}
.err{color:var(--err);background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);padding:.7rem .85rem;border-radius:10px;margin:0 0 1rem;font-size:.9rem;display:none}
.err.show{display:block}
.badge{display:inline-block;font-size:.72rem;padding:.15rem .45rem;border-radius:999px;background:rgba(45,212,191,.12);color:var(--accent);margin-inline-start:.35rem;vertical-align:middle}
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
${connectedBlock}
${!hasConnected && oauthEnabled ? `<input type="hidden" id="langInput" value="${initialLang}"/>` : ""}
</div>
<script>
(function(){
  var I18N = {
    ar: {
      title: "قبل الدفع",
      orderLabel: "الطلب:",
      amountLabel: "المبلغ:",
      whyTitle: "ليش نطلب الربط؟",
      whyBody: "عشان نتأكد من العميل اللي اشترى بالضبط، ونربط الدفع بحسابك في دسكورد، ونسلّم الطلب لنفس الشخص بدون لخبطة أو تأخير.",
      connect: "ربط دسكورد",
      connectHint: "اضغط الزر فوق — يسجّل دخولك ويجيب اليوزر والآيدي تلقائيًا.",
      relink: "تغيير الحساب",
      userLabel: "اليوزر",
      userBadge: "اسم الحساب",
      userPh: "مثال: username",
      userHint: "يوزر دسكورد الحالي.",
      idLabel: "كوبي يوزر",
      idBadge: "آيدي الحساب",
      idPh: "مثال: 123456789012345678",
      idHint: "آيدي حسابك من دسكورد.",
      submit: "متابعة لخيارات الدفع",
      errUser: "اربط دسكورد أو اكتب اليوزر قبل الدفع",
      errId: "اربط دسكورد أو الصق الآيدي قبل الدفع"
    },
    en: {
      title: "Before payment",
      orderLabel: "Order:",
      amountLabel: "Amount:",
      whyTitle: "Why link Discord?",
      whyBody: "So we can verify the exact customer who purchased, link payment to your Discord, and deliver to the same person — no mix-ups.",
      connect: "Connect Discord",
      connectHint: "One tap — we pull your username and ID automatically.",
      relink: "Switch account",
      userLabel: "Username",
      userBadge: "Account name",
      userPh: "e.g. username",
      userHint: "Your current Discord username.",
      idLabel: "Copy User ID",
      idBadge: "Account ID",
      idPh: "e.g. 123456789012345678",
      idHint: "Your Discord account ID.",
      submit: "Continue to payment options",
      errUser: "Connect Discord or enter username first",
      errId: "Connect Discord or paste your ID first"
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
    // refresh oauth link lang
    document.querySelectorAll('a.discord-btn, a.unlink').forEach(function(a){
      try {
        var u = new URL(a.href, location.origin);
        u.searchParams.set("lang", lang);
        a.href = u.pathname + u.search;
      } catch {}
    });
    var box = document.getElementById("errBox");
    if (serverErr) {
      var msg = serverErr;
      if (/يوزر|username|ربط/i.test(serverErr) && !/آيدي|id|كوبي/i.test(serverErr)) msg = t.errUser;
      else if (/كوبي|آيدي|id/i.test(serverErr)) msg = t.errId;
      box.textContent = msg;
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
.msg{margin-top:.9rem;color:#b91c1c;font-size:.88rem;display:none}
.foot{margin-top:1rem;text-align:center;color:#888;font-size:.78rem}
</style>
<script src="https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&components=buttons&enable-funding=venmo,paylater,card"></script>
</head><body>
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
    <p class="sub"><span data-i18n="id"></span> ${safeId || "—"}</p>
    <p class="sub" data-i18n="payOpts"></p>
    <div id="paypal-buttons"></div>
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
  var I18N = {
    ar: {
      title: "موجز الطلب",
      total: "الإجمالي",
      user: "اليوزر:",
      id: "كوبي يوزر:",
      payOpts: "خيارات الدفع الإلكتروني السريع",
      foot: "مدعوم من PayPal · 𝐂𝐨𝐝𝐞𝐗",
      fail: "فشل الدفع",
      createFail: "تعذر إنشاء الطلب",
      captureFail: "تعذر تأكيد الدفع",
      errPay: "حدث خطأ أثناء الدفع",
      cancel: "تم إلغاء الدفع"
    },
    en: {
      title: "Order summary",
      total: "Total",
      user: "Username:",
      id: "Copy User ID:",
      payOpts: "Express checkout options",
      foot: "Powered by PayPal · 𝐂𝐨𝐝𝐞𝐗",
      fail: "Payment failed",
      createFail: "Could not create the order",
      captureFail: "Could not confirm payment",
      errPay: "Something went wrong during payment",
      cancel: "Payment cancelled"
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
  }
  document.getElementById("btn-ar").addEventListener("click", function(){ apply("ar"); });
  document.getElementById("btn-en").addEventListener("click", function(){ apply("en"); });
  apply(lang);

  function showErr(msg){ err.style.display='block'; err.textContent=msg||t().fail; }

  function createOrder(){
    return fetch('/paypal/order', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ amount: Number(amount), name: name, discordUser: discordUser, discordId: discordId })
    }).then(function(r){ return r.json().then(function(j){ if(!r.ok||!j.id) throw new Error(j.error||t().createFail); return j.id; }); });
  }
  function onApprove(data){
    return fetch('/paypal/capture', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ orderID: data.orderID })
    }).then(function(r){ return r.json().then(function(j){
      if(j && (j.ok || j.status === 'COMPLETED')) { window.location='/pay/success'; return; }
      if(!r.ok) throw new Error(j.error||t().captureFail);
      window.location='/pay/success';
    }); });
  }
  function onError(e){ showErr((e&&e.message)||t().errPay); }
  function onCancel(){ showErr(t().cancel); }

  if (paypal.Buttons) {
    paypal.Buttons({
      style: { layout:'vertical', color:'gold', shape:'rect', label:'paypal', height:48 },
      createOrder: createOrder,
      onApprove: onApprove,
      onError: onError,
      onCancel: onCancel
    }).render('#paypal-buttons');
  }
})();
</script>
</body></html>`;
  }

  app.get("/health", (req, res) => {
    const oauth = getDiscordOAuthConfig();
    res.json({
      ok: true,
      user: client.user?.tag || null,
      paypal: Boolean(paypalPayments),
      discordOAuth: oauth.enabled,
    });
  });

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
      const session = signDiscordSession(me, oauth.stateSecret);
      const amount = Number(state.amount);
      const name = String(state.name || "𝐂𝐨𝐝𝐞𝐗 — خدمة");
      const lang = state.lang === "en" ? "en" : "ar";
      const q = new URLSearchParams({
        amount: Number.isFinite(amount) ? amount.toFixed(2) : String(state.amount || ""),
        name,
        lang,
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
          `<h1>فشل ربط دسكورد</h1><p>${escapeHtml(e.message)}</p><p><a href="/pay">رجوع</a></p>`,
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

  // Checkout gate: Discord OAuth (or manual fallback), then PayPal
  app.get("/pay", async (req, res) => {
    try {
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
      // Show checkout only after explicit continue POST — GET always shows gate
      // unless both query params present (legacy deep link)
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
                ? "اربط دسكورد قبل الدفع"
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

  app.get("/pay/success", (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>تم الدفع — 𝐂𝐨𝐝𝐞𝐗</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b1220;color:#e8eefc;display:grid;place-items:center;min-height:100vh;margin:0}
.card{max-width:420px;padding:2rem;border:1px solid #1e2a44;border-radius:16px;background:#121a2b;text-align:center}
h1{margin:0 0 .5rem;font-size:1.4rem}p{opacity:.85;line-height:1.6}
</style></head><body><div class="card">
<h1>تم الدفع بنجاح</h1>
<p>شكراً لثقتك في 𝐂𝐨𝐝𝐞𝐗. راح يوصلك تأكيد على دسكورد قريب إن شاء الله.</p>
</div></body></html>`);
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
