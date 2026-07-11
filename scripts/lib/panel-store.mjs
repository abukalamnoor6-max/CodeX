import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const FILE = path.join(ROOT, "data", "guard-panel.json");

function defaults() {
  return {
    protections: {},
    settings: {
      logChannelId: null,
      exemptRoles: [],
      exemptUsers: [],
    },
    broadcast: {
      allowedRoles: [],
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

export function createPanelStore() {
  if (!fs.existsSync(path.dirname(FILE))) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
  }
  let data = defaults();
  try {
    if (fs.existsSync(FILE)) {
      const loaded = JSON.parse(fs.readFileSync(FILE, "utf8"));
      data = {
        ...defaults(),
        ...loaded,
        settings: { ...defaults().settings, ...(loaded.settings || {}) },
        broadcast: { ...defaults().broadcast, ...(loaded.broadcast || {}) },
        stats: { ...defaults().stats, ...(loaded.stats || {}) },
      };
    }
  } catch {
    /* keep defaults */
  }

  const api = {
    data,
    save() {
      fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    },
    log(entry) {
      data.logs.unshift({ at: new Date().toISOString(), ...entry });
      if (data.logs.length > 200) data.logs.length = 200;
      api.save();
    },
  };
  return api;
}
