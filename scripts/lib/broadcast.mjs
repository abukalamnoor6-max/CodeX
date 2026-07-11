const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createBroadcastService({ client, store, ownerId }) {
  const jobs = new Map();

  function getJob(guildId) {
    return jobs.get(guildId) || null;
  }

  async function countTargets(guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { all: 0, online: 0, offline: 0 };
    await guild.members.fetch().catch(() => {});
    const blacklist = new Set(store.data.broadcast.blacklist || []);
    const members = [...guild.members.cache.values()].filter(
      (m) => !m.user.bot && !blacklist.has(m.id),
    );
    const online = members.filter(
      (m) => m.presence?.status && m.presence.status !== "offline",
    ).length;
    return { all: members.length, online, offline: members.length - online };
  }

  async function resolveTargets(guild, { filter, roleId, userId }) {
    const blacklist = new Set(store.data.broadcast.blacklist || []);
    await guild.members.fetch().catch(() => {});
    if (filter === "user") {
      const m = await guild.members.fetch(userId).catch(() => null);
      if (!m || m.user.bot) throw new Error("العضو غير موجود");
      return [m];
    }
    let targets = [...guild.members.cache.values()].filter((m) => !m.user.bot);
    if (filter === "online") {
      targets = targets.filter(
        (m) => m.presence?.status && m.presence.status !== "offline",
      );
    } else if (filter === "offline") {
      targets = targets.filter(
        (m) => !m.presence?.status || m.presence.status === "offline",
      );
    } else if (filter === "role") {
      if (!roleId) throw new Error("حدد الرتبة");
      targets = targets.filter((m) => m.roles.cache.has(roleId));
    }
    return targets.filter((m) => !blacklist.has(m.id));
  }

  async function startBroadcast({
    guildId,
    content,
    filter = "all",
    roleId = null,
    userId = null,
    requestedBy,
  }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error("السيرفر غير موجود");
    const bc = store.data.broadcast;
    const now = Date.now();
    if (now - (bc.lastRunAt || 0) < (bc.cooldownMs || 60000)) {
      const wait = Math.ceil(((bc.cooldownMs || 60000) - (now - bc.lastRunAt)) / 1000);
      throw new Error(`انتظر ${wait} ثانية`);
    }
    if (jobs.get(guildId)?.running) throw new Error("يوجد برودكاست شغّال");

    const targets = await resolveTargets(guild, { filter, roleId, userId });
    if (!targets.length) throw new Error("لا يوجد أعضاء مطابقين");

    const job = {
      running: true,
      cancelled: false,
      guildId,
      total: targets.length,
      sent: 0,
      failed: 0,
      filter,
      startedAt: new Date().toISOString(),
    };
    jobs.set(guildId, job);
    bc.lastRunAt = now;
    store.save();

    const batchSize = bc.batchSize || 5;
    const delay = bc.batchDelayMs || 1500;

    (async () => {
      for (let i = 0; i < targets.length; i += batchSize) {
        if (job.cancelled) break;
        const chunk = targets.slice(i, i + batchSize);
        await Promise.all(
          chunk.map(async (m) => {
            try {
              const personalized = String(content || "")
                .replaceAll("{منشن}", `<@${m.id}>`)
                .replaceAll("{mention}", `<@${m.id}>`)
                .replaceAll("{user}", `${m}`)
                .replaceAll("{name}", m.displayName || m.user.username)
                .replaceAll("{username}", m.user.username);
              await m.send({ content: personalized });
              job.sent += 1;
              store.data.stats.broadcastsSent += 1;
            } catch {
              job.failed += 1;
              store.data.stats.dmsFailed += 1;
            }
          }),
        );
        store.save();
        await sleep(delay);
      }
      job.running = false;
      bc.history.unshift({
        at: new Date().toISOString(),
        filter,
        total: job.total,
        sent: job.sent,
        failed: job.failed,
        preview: String(content || "").slice(0, 120),
        requestedBy,
      });
      if (bc.history.length > 100) bc.history.length = 100;
      store.log({ type: "broadcast", detail: `sent=${job.sent}` });
      store.save();
    })();

    return job;
  }

  function cancel(guildId) {
    const job = jobs.get(guildId);
    if (!job?.running) return false;
    job.cancelled = true;
    return true;
  }

  function canUse(member) {
    if (!member) return false;
    if (member.id === ownerId || member.id === member.guild.ownerId) return true;
    if (member.permissions?.has?.("Administrator")) return true;
    const roles = store.data.broadcast.allowedRoles || [];
    return member.roles.cache.some((r) => roles.includes(r.id));
  }

  return { startBroadcast, cancel, getJob, canUse, countTargets };
}
