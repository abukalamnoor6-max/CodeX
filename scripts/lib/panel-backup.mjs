/**
 * نسخ احتياطي لإعدادات اللوحة على روم دسكورد خاص
 * عشان ما تضيع بعد إعادة نشر Railway بدون Volume.
 *
 * مصدر الحقيقة على Railway = رسالة النسخة في دسكورد (يُسترجع عند كل إقلاع).
 */
import { AttachmentBuilder } from "discord.js";

const MARKER = "CODEX_GUARD_PANEL_BACKUP_V1";

export function attachPanelSettingsBackup(
  client,
  store,
  {
    channelId = process.env.GUARD_BACKUP_CHANNEL_ID || "1525118012028489838",
  } = {},
) {
  let backupTimer = null;
  let bootDone = false;

  async function findBackupMessage(ch) {
    const msgs = await ch.messages.fetch({ limit: 50 });
    return (
      [...msgs.values()].find(
        (m) =>
          m.author?.id === client.user.id &&
          (String(m.content || "").includes(MARKER) ||
            [...(m.attachments?.values?.() || [])].some(
              (a) => a.name === "guard-panel.json",
            )),
      ) || null
    );
  }

  async function getChannel() {
    if (!channelId) return null;
    return (
      client.channels.cache.get(channelId) ||
      (await client.channels.fetch(channelId).catch(() => null))
    );
  }

  async function backup(data) {
    const ch = await getChannel();
    if (!ch?.send) return false;

    const json = JSON.stringify(data, null, 2);
    const file = new AttachmentBuilder(Buffer.from(json, "utf8"), {
      name: "guard-panel.json",
    });
    const content = [
      MARKER,
      `updated: ${new Date().toISOString()}`,
      "لا تحذف هالرسالة — نسخة احتياطية دائمة لإعدادات لوحة الحماية.",
    ].join("\n");

    const existing = await findBackupMessage(ch);
    if (existing) {
      await existing.edit({ content, files: [file] });
    } else {
      await ch.send({ content, files: [file] });
    }
    return true;
  }

  function scheduleBackup(data) {
    clearTimeout(backupTimer);
    backupTimer = setTimeout(() => {
      backup(data).catch((e) =>
        console.warn("[panel-store] backup failed", e.message),
      );
    }, 400);
  }

  async function restoreFromDiscord() {
    const ch = await getChannel();
    if (!ch) return false;

    const existing = await findBackupMessage(ch);
    if (!existing) return false;

    const att =
      [...(existing.attachments?.values?.() || [])].find(
        (a) => a.name === "guard-panel.json",
      ) || [...(existing.attachments?.values?.() || [])][0];
    if (!att?.url) return false;

    const res = await fetch(att.url);
    if (!res.ok) return false;
    const obj = await res.json();
    store.restoreFrom(obj);
    console.log("[panel-store] restored from Discord backup");
    return true;
  }

  // كل حفظ محلي → نسخة دسكورد (بعد الإقلاع)
  store.setBackup((data) => {
    if (!bootDone) return Promise.resolve();
    scheduleBackup(data);
    return Promise.resolve();
  });

  store.flushBackup = async () => {
    if (!bootDone) return false;
    clearTimeout(backupTimer);
    return backup(store.data);
  };

  return {
    backup,
    async boot() {
      // دائمًا: استرجع من دسكورد أولًا (يتغلب على ضياع ملف Railway)
      try {
        const ok = await restoreFromDiscord();
        if (!ok) {
          console.log("[panel-store] no Discord backup yet — using local/defaults");
        }
      } catch (e) {
        console.warn("[panel-store] restore failed", e.message);
      }

      bootDone = true;

      // احفظ محليًا + ارفع نسخة محدّثة
      try {
        store.save();
      } catch (e) {
        console.warn("[panel-store] post-restore save failed", e.message);
      }
      try {
        await backup(store.data);
        console.log("[panel-store] Discord backup synced");
      } catch (e) {
        console.warn("[panel-store] initial backup failed", e.message);
      }
    },
  };
}
