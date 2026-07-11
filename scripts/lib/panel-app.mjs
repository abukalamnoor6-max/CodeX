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
}) {
  const app = express();
  app.use(cors());
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
    res.json({ ok: true, user: client.user?.tag || null });
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
        logChannelId: null,
        exemptRoles: [],
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
    if (req.body.broadcast) {
      store.data.broadcast = { ...store.data.broadcast, ...req.body.broadcast };
    }
    store.save();
    res.json({ ok: true, settings: store.data });
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
