import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { PROTECTION_META } from "./protection-meta.mjs";

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

  const paypalClientId =
    process.env.PAYPAL_CLIENT_ID ||
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
    "";

  function payFormPage({ amount, name, error = "", discord = "", discordId = "" }) {
    const amountLabel = Number(amount).toFixed(2);
    const safeName = escapeHtml(name);
    const errBlock = error
      ? `<p class="err">${escapeHtml(error)}</p>`
      : "";
    return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>إتمام الطلب — 𝐂𝐨𝐝𝐞𝐗</title>
<style>
:root{--bg:#0b1220;--card:#121a2b;--line:#243049;--text:#e8eefc;--muted:#9fb0cc;--accent:#2dd4bf;--err:#f87171}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.25rem;font-family:"Segoe UI",Tahoma,sans-serif;background:radial-gradient(1200px 600px at 80% -10%,#1a2742 0%,var(--bg) 55%);color:var(--text)}
.card{width:100%;max-width:440px;padding:1.6rem;border:1px solid var(--line);border-radius:18px;background:rgba(18,26,43,.92);box-shadow:0 20px 60px rgba(0,0,0,.35)}
.brand{font-size:.85rem;letter-spacing:.08em;color:var(--accent);margin:0 0 .35rem;font-weight:700}
h1{margin:0 0 .75rem;font-size:1.35rem}
.meta{margin:0 0 1.1rem;color:var(--muted);line-height:1.7;font-size:.95rem}
.meta strong{color:var(--text)}
label{display:block;margin:0 0 .4rem;font-size:.92rem}
.field{margin:0 0 1rem}
input{width:100%;padding:.85rem 1rem;border-radius:12px;border:1px solid var(--line);background:#0d1524;color:var(--text);font-size:1rem;outline:none}
input:focus{border-color:var(--accent)}
.hint{margin:.4rem 0 0;color:var(--muted);font-size:.8rem;line-height:1.5}
.why{margin:0 0 1.15rem;padding:.85rem 1rem;border-radius:12px;border:1px solid rgba(45,212,191,.22);background:rgba(45,212,191,.07);color:var(--text);font-size:.88rem;line-height:1.65}
.why strong{color:var(--accent)}
button{width:100%;border:0;border-radius:12px;padding:.95rem 1rem;background:linear-gradient(135deg,#14b8a6,#0d9488);color:#041016;font-weight:700;font-size:1rem;cursor:pointer;margin-top:.35rem}
button:hover{filter:brightness(1.05)}
.err{color:var(--err);background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);padding:.7rem .85rem;border-radius:10px;margin:0 0 1rem;font-size:.9rem}
.badge{display:inline-block;font-size:.72rem;padding:.15rem .45rem;border-radius:999px;background:rgba(45,212,191,.12);color:var(--accent);margin-inline-start:.35rem;vertical-align:middle}
</style></head><body><div class="card">
<p class="brand">𝐂𝐨𝐝𝐞𝐗</p>
<h1>قبل الدفع</h1>
<p class="meta">الطلب: <strong>${safeName}</strong><br/>المبلغ: <strong>${amountLabel} USD</strong></p>
<p class="why"><strong>ليش نطلب البيانات؟</strong><br/>عشان نتأكد من <strong>العميل اللي اشترى</strong> بالضبط، ونربط الدفع بحسابك في دسكورد، ونسلّم الطلب لنفس الشخص بدون لخبطة أو تأخير.</p>
${errBlock}
<form method="POST" action="/pay">
<input type="hidden" name="amount" value="${escapeHtml(amountLabel)}"/>
<input type="hidden" name="name" value="${safeName}"/>
<div class="field">
<label for="discord">اليوزر <span class="badge">اسم الحساب</span></label>
<input id="discord" name="discord" type="text" required maxlength="40" autocomplete="username" placeholder="مثال: username" value="${escapeHtml(discord)}" autofocus/>
<p class="hint">يوزر دسكورد الحالي (مو الديسپلاي نيم القديمًا) — عشان نعرف مين العميل اللي دفع.</p>
</div>
<div class="field">
<label for="discordId">كوبي يوزر <span class="badge">آيدي الحساب</span></label>
<input id="discordId" name="discordId" type="text" required maxlength="22" inputmode="numeric" pattern="\\d{15,22}" placeholder="مثال: 123456789012345678" value="${escapeHtml(discordId)}"/>
<p class="hint">للتأكيد النهائي على حسابك وتسليم الطلب لك مباشرة. من دسكورد: الإعدادات ← متقدم ← وضع المطوّر ← يمين على حسابك ← نسخ معرّف المستخدم.</p>
</div>
<button type="submit">متابعة لخيارات الدفع</button>
</form>
</div></body></html>`;
  }

  function payCheckoutPage({ amount, name, discordUser, discordId = "" }) {
    const amountLabel = Number(amount).toFixed(2);
    const safeName = escapeHtml(name);
    const safeUser = escapeHtml(String(discordUser || "").replace(/^@+/, ""));
    const safeId = escapeHtml(String(discordId || ""));
    const clientId = escapeHtml(paypalClientId);
    if (!paypalClientId) {
      return `<h1>PayPal Client ID ناقص</h1>`;
    }
    return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>الدفع — 𝐂𝐨𝐝𝐞𝐗</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#f5f5f5;color:#111;font-family:"Segoe UI",Tahoma,sans-serif;display:grid;place-items:center;padding:1.25rem}
.wrap{width:100%;max-width:420px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:.85rem;font-size:.95rem}
.top .name{font-weight:600}
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
  <div class="top"><span class="amt">${amountLabel} USD</span><span class="name">${safeName}</span></div>
  <div class="card">
    <h1>موجز الطلب</h1>
    <div class="row"><span>الإجمالي</span><strong>${amountLabel} USD</strong></div>
    <p class="sub">اليوزر: @${safeUser}</p>
    <p class="sub">كوبي يوزر: ${safeId || "—"}</p>
    <p class="sub">خيارات الدفع الإلكتروني السريع</p>
    <div id="paypal-buttons"></div>
    <p class="msg" id="err"></p>
  </div>
  <p class="foot">مدعوم من PayPal · 𝐂𝐨𝐝𝐞𝐗</p>
</div>
<script>
(function(){
  var amount = ${JSON.stringify(amountLabel)};
  var name = ${JSON.stringify(String(name))};
  var discordUser = ${JSON.stringify(String(discordUser || "").replace(/^@+/, ""))};
  var discordId = ${JSON.stringify(String(discordId || ""))};
  var err = document.getElementById('err');
  function showErr(t){ err.style.display='block'; err.textContent=t||'فشل الدفع'; }

  function createOrder(){
    return fetch('/paypal/order', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ amount: Number(amount), name: name, discordUser: discordUser, discordId: discordId })
    }).then(function(r){ return r.json().then(function(j){ if(!r.ok||!j.id) throw new Error(j.error||'تعذر إنشاء الطلب'); return j.id; }); });
  }
  function onApprove(data){
    return fetch('/paypal/capture', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ orderID: data.orderID })
    }).then(function(r){ return r.json().then(function(j){
      if(j && (j.ok || j.status === 'COMPLETED')) { window.location='/pay/success'; return; }
      if(!r.ok) throw new Error(j.error||'تعذر تأكيد الدفع');
      window.location='/pay/success';
    }); });
  }
  function onError(e){ showErr((e&&e.message)||'حدث خطأ أثناء الدفع'); }
  function onCancel(){ showErr('تم إلغاء الدفع'); }

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

  // Checkout gate: collect Discord username, then show PayPal button stack
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
      const discord = String(
        req.query.discord || req.query.user || req.query.u || "",
      )
        .trim()
        .replace(/^@+/, "");
      const discordId = String(
        req.query.discordId || req.query.id || req.query.d || "",
      ).trim();
      // Always show the form unless both identity fields are present
      if (!discord || !/^\d{15,22}$/.test(discordId)) {
        return res
          .type("html")
          .send(payFormPage({ amount, name, discord, discordId }));
      }
      return res
        .type("html")
        .send(
          payCheckoutPage({
            amount,
            name,
            discordUser: discord,
            discordId,
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
      const amount = Number(req.body?.amount);
      const name = String(req.body?.name || "𝐂𝐨𝐝𝐞𝐗 — خدمة");
      const discord = String(req.body?.discord || "")
        .trim()
        .replace(/^@+/, "");
      const discordId = String(req.body?.discordId || "")
        .trim()
        .replace(/\s+/g, "");
      if (!Number.isFinite(amount) || amount <= 0) {
        return res
          .status(400)
          .type("html")
          .send("<h1>خطأ</h1><p>المبلغ غير صالح</p>");
      }
      if (!discord || discord.length < 2) {
        return res
          .status(400)
          .type("html")
          .send(
            payFormPage({
              amount,
              name,
              discord,
              discordId,
              error: "اكتب اليوزر قبل الدفع",
            }),
          );
      }
      if (!/^\d{15,22}$/.test(discordId)) {
        return res
          .status(400)
          .type("html")
          .send(
            payFormPage({
              amount,
              name,
              discord,
              discordId,
              error: "الصق كوبي يوزر (آيدي الحساب) — أرقام فقط من دسكورد",
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
          }),
        );
    } catch (e) {
      const amount = Number(req.body?.amount);
      const name = String(req.body?.name || "𝐂𝐨𝐝𝐞𝐗 — خدمة");
      const discord = String(req.body?.discord || "")
        .trim()
        .replace(/^@+/, "");
      const discordId = String(req.body?.discordId || "").trim();
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
