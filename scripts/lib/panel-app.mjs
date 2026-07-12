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
  app.post("/paypal/order", async (req, res) => {
    try {
      if (!paypalPayments) {
        return res.status(503).json({ error: "PayPal not configured" });
      }
      const { name, amount, discordId } = req.body || {};
      const order = await paypalPayments.createOrder({
        name: name || "codeX — خدمة",
        amountMajor: amount,
        discordId,
      });
      res.json({ ok: true, id: order.id, url: order.url, status: order.status });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // Quick pay link: /pay?amount=10&name=بوت
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
      const name = String(req.query.name || req.query.n || "codeX — خدمة");
      const discordId = String(req.query.discord || req.query.d || "");
      const order = await paypalPayments.createOrder({
        name,
        amountMajor: amount,
        discordId,
      });
      res.redirect(303, order.url);
    } catch (e) {
      res
        .status(400)
        .type("html")
        .send(`<h1>خطأ</h1><p>${e.message}</p>`);
    }
  });

  app.get("/pay/success", (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>تم الدفع — codeX</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b1220;color:#e8eefc;display:grid;place-items:center;min-height:100vh;margin:0}
.card{max-width:420px;padding:2rem;border:1px solid #1e2a44;border-radius:16px;background:#121a2b;text-align:center}
h1{margin:0 0 .5rem;font-size:1.4rem}p{opacity:.85;line-height:1.6}
</style></head><body><div class="card">
<h1>تم الدفع بنجاح</h1>
<p>شكراً لثقتك في codeX. راح يوصلك تأكيد على دسكورد قريب إن شاء الله.</p>
</div></body></html>`);
  });

  app.get("/pay/cancel", (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>تم الإلغاء — codeX</title>
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
