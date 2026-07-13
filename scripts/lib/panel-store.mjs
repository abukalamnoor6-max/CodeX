import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

/** مسار دائم: Volume على Railway أو PANEL_DATA_PATH */
function resolveStorePath() {
  if (process.env.PANEL_DATA_PATH) return process.env.PANEL_DATA_PATH;
  if (fs.existsSync("/data") && fs.statSync("/data").isDirectory()) {
    return "/data/guard-panel.json";
  }
  return path.join(ROOT, "data", "guard-panel.json");
}

const FILE = resolveStorePath();

function defaults() {
  // قيم افتراضية منطقية لـ CodeX (OWNER + TEAM)
  const ownerRole = process.env.DISCORD_STAFF_ROLE_OWNER || "1524961206144860333";
  const teamRole = process.env.DISCORD_STAFF_ROLE_TEAM || "1524961198360236084";
  // الرتبة الثانية الظاهرة في اللوحة كانت Founder/VIP — نبقيها إن وُجدت بالـ env
  const extraExempt = process.env.DISCORD_EXEMPT_ROLE_IDS || "1524961179686932646";
  const exempt = [ownerRole, ...String(extraExempt).split(",").map((s) => s.trim()).filter(Boolean)];
  return {
    protections: {},
    settings: {
      logChannelId: null,
      exemptRoles: [...new Set(exempt)],
      exemptUsers: [],
    },
    broadcast: {
      allowedRoles: [...new Set([ownerRole, ...String(extraExempt).split(",").map((s) => s.trim()).filter(Boolean)])],
      cooldownMs: 60000,
      batchSize: 5,
      batchDelayMs: 1500,
      lastRunAt: 0,
      blacklist: [],
      history: [],
    },
    stats: { protectionsTriggered: 0, broadcastsSent: 0, dmsFailed: 0 },
    logs: [],
  };
}

function atomicWrite(filePath, text) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, filePath);
}

function loadFile() {
  try {
    if (!fs.existsSync(FILE)) return null;
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return null;
  }
}

function mergeLoaded(loaded) {
  const base = defaults();
  if (!loaded) return base;
  return {
    ...base,
    ...loaded,
    settings: { ...base.settings, ...(loaded.settings || {}) },
    broadcast: { ...base.broadcast, ...(loaded.broadcast || {}) },
    stats: { ...base.stats, ...(loaded.stats || {}) },
    protections: { ...base.protections, ...(loaded.protections || {}) },
    logs: Array.isArray(loaded.logs) ? loaded.logs : [],
  };
}

export function createPanelStore() {
  const existed = fs.existsSync(FILE);
  let data = mergeLoaded(loadFile());

  // لا نكتب ملفًا جديدًا قبل فرصة الاسترجاع من دسكورد
  if (existed) {
    try {
      atomicWrite(FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn("[panel-store] initial write failed", e.message, FILE);
    }
  }

  console.log("[panel-store] path =", FILE, "existed=", existed);

  const api = {
    data,
    filePath: FILE,
    save() {
      try {
        atomicWrite(FILE, JSON.stringify(data, null, 2));
      } catch (e) {
        console.warn("[panel-store] save failed", e.message);
        throw e;
      }
      // نسخة احتياطية على دسكورد إن وُجدت دالة مربوطة
      if (typeof api._backup === "function") {
        Promise.resolve(api._backup(data)).catch((e) =>
          console.warn("[panel-store] backup failed", e.message),
        );
      }
    },
    /** اربط نسخ احتياطي لدسكورد بعد إقلاع البوت */
    setBackup(fn) {
      api._backup = fn;
    },
    /** استرجع من JSON خارجي (رسالة دسكورد) إن الملف ناقص */
    restoreFrom(obj) {
      if (!obj || typeof obj !== "object") return false;
      data = mergeLoaded(obj);
      api.data = data;
      api.save();
      return true;
    },
    log(entry) {
      data.logs.unshift({ at: new Date().toISOString(), ...entry });
      if (data.logs.length > 200) data.logs.length = 200;
      api.save();
    },
  };
  return api;
}
