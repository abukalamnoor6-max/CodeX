const api = {
  async req(path, options = {}) {
    const res = await fetch(`${window.CODEX.apiUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': window.CODEX.apiKey,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },
};

let overview = null;
let selectedGuildId = null;
let guildData = null;
let tab = 'protections';
let pollTimer = null;

const statusEl = document.getElementById('status');
const guildsEl = document.getElementById('guilds');
const statsEl = document.getElementById('stats');
const panelEl = document.getElementById('panel');

function setStatus(ok, text) {
  statusEl.textContent = text;
  statusEl.className = `status ${ok ? 'ok' : 'bad'}`;
}

async function boot() {
  try {
    overview = await api.req('/api/overview');
    setStatus(true, `متصل · ${overview.bot?.tag || 'بوت'}`);
    renderGuilds();
    statsEl.innerHTML = `
      <div>حماية تفعّلت: <b>${overview.stats.protectionsTriggered || 0}</b></div>
      <div>برودكاست نجح: <b>${overview.stats.broadcastsSent || 0}</b></div>
      <div>فشل DM: <b>${overview.stats.dmsFailed || 0}</b></div>
    `;
    if (overview.guilds[0]) selectGuild(overview.guilds[0].id);
  } catch (e) {
    setStatus(false, `فشل الاتصال: ${e.message}`);
    panelEl.innerHTML = `<div class="empty">تأكد أن البوت شغال على الخادم وأن API_URL و API_KEY صحيحين</div>`;
  }
}

function renderGuilds() {
  guildsEl.innerHTML = overview.guilds.map((g) => `
    <div class="guild ${g.id === selectedGuildId ? 'active' : ''}" data-id="${g.id}">
      ${g.icon ? `<img src="${g.icon}" alt="" />` : `<div class="ph">${g.name.slice(0, 1)}</div>`}
      <div>
        <strong>${escapeHtml(g.name)}</strong>
        <span>${g.members} عضو</span>
      </div>
    </div>
  `).join('');
  guildsEl.querySelectorAll('.guild').forEach((el) => {
    el.addEventListener('click', () => selectGuild(el.dataset.id));
  });
}

async function selectGuild(id) {
  selectedGuildId = id;
  renderGuilds();
  clearInterval(pollTimer);
  await refreshGuild({ full: true });
  // حدّث خفيف كل 5 ثوانٍ — بدون إعادة بناء الفورم
  pollTimer = setInterval(() => refreshGuild({ full: false }), 5000);
}

async function refreshGuild({ full = false } = {}) {
  if (!selectedGuildId) return;
  try {
    guildData = await api.req(`/api/guilds/${selectedGuildId}`);
  } catch (e) {
    console.warn('refresh failed', e.message);
    return;
  }

  // تحديث ناعم للإحصائيات فقط
  softUpdateStats();

  if (!full) {
    // البرودكاست: حدّث شريط التقدم فقط
    if (tab === 'broadcast') softUpdateBroadcast();
    return;
  }

  renderPanel();
}

function softUpdateStats() {
  if (!statsEl || !guildData) return;
  // الإحصائيات العامة من آخر overview إن وُجدت — وإلا اتركها
}

function softUpdateBroadcast() {
  const job = guildData?.job || {};
  const prog = document.getElementById('bc-progress');
  if (!prog) return;
  prog.textContent = job.running
    ? `جاري الإرسال… ${job.sent || 0}/${job.total || 0} · فشل ${job.failed || 0}`
    : 'لا يوجد برودكاست حالياً';
}

function renderPanel() {
  const g = guildData;
  panelEl.innerHTML = `
    <div class="head">
      <div>
        <h1>${escapeHtml(g.name)}</h1>
        <p>${g.members} عضو · اختر القسم من التبويبات</p>
      </div>
      <div class="tabs">
        <button class="tab ${tab === 'protections' ? 'active' : ''}" data-tab="protections">الحماية</button>
        <button class="tab ${tab === 'broadcast' ? 'active' : ''}" data-tab="broadcast">البرودكاست</button>
        <button class="tab ${tab === 'settings' ? 'active' : ''}" data-tab="settings">الإعدادات</button>
        <button class="tab ${tab === 'logs' ? 'active' : ''}" data-tab="logs">السجل</button>
      </div>
    </div>
    <div id="tab-body"></div>
  `;
  panelEl.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      tab = btn.dataset.tab;
      renderPanel();
    });
  });
  const body = document.getElementById('tab-body');
  if (tab === 'protections') renderProtections(body);
  if (tab === 'broadcast') renderBroadcast(body);
  if (tab === 'settings') renderSettings(body);
  if (tab === 'logs') renderLogs(body);
}

function renderProtections(body) {
  const meta = overview.protections || [];
  const groups = {};
  for (const p of meta) {
    const g = p.group || 'عام';
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  }
  const enabledCount = meta.filter((p) => gProtection(p.key)?.enabled).length;

  body.innerHTML = `
    <div class="toolbar">
      <div class="count">${enabledCount} / ${meta.length} نظام مفعّل</div>
      <div class="actions">
        <button class="btn" id="all-on">تفعيل الكل</button>
        <button class="btn" id="all-off">إيقاف الكل</button>
      </div>
    </div>
    ${Object.entries(groups).map(([group, items]) => `
      <div class="group">
        <h2>${escapeHtml(group)}</h2>
        <div class="plist">
          ${items.map((p) => {
            const on = !!gProtection(p.key)?.enabled;
            return `
              <div class="prow">
                <div>
                  <h3>${escapeHtml(p.name)}</h3>
                  <p>${escapeHtml(p.key)}</p>
                </div>
                <button class="switch ${on ? 'on' : ''}" data-key="${p.key}" aria-label="${escapeAttr(p.name)}"><i></i></button>
              </div>`;
          }).join('')}
        </div>
      </div>
    `).join('')}
  `;

  body.querySelectorAll('.switch').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      const enabled = !gProtection(key)?.enabled;
      await api.req(`/api/guilds/${selectedGuildId}/protections/${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      await refreshGuild({ full: true });
    });
  });
  body.querySelector('#all-on').onclick = async () => {
    await api.req(`/api/guilds/${selectedGuildId}/protections/bulk`, {
      method: 'POST', body: JSON.stringify({ enabled: true }),
    });
    await refreshGuild({ full: true });
  };
  body.querySelector('#all-off').onclick = async () => {
    await api.req(`/api/guilds/${selectedGuildId}/protections/bulk`, {
      method: 'POST', body: JSON.stringify({ enabled: false }),
    });
    await refreshGuild({ full: true });
  };
}

function gProtection(key) {
  return guildData?.settings?.protections?.[key];
}

function renderBroadcast(body) {
  const job = guildData.job || {};
  const roles = guildData.roles || [];
  body.innerHTML = `
    <div class="form">
      <label>نص البرودكاست</label>
      <textarea id="bc-text" placeholder="مثال: مرحباً {منشن}، عندنا عرض جديد…"></textarea>
      <p class="hint" style="color:var(--muted);font-size:0.8rem;margin:0">
        رموز جاهزة: <code>{منشن}</code> · <code>{name}</code> · <code>{username}</code>
      </p>
      <label>اختر العملية</label>
      <div class="bc-options" id="bc-options">
        <button type="button" class="bc-opt active" data-filter="all">📬 إرسال للجميع</button>
        <button type="button" class="bc-opt" data-filter="online">🟢 إرسال للمتصلين</button>
        <button type="button" class="bc-opt" data-filter="offline">⚫ إرسال لغير المتصلين</button>
        <button type="button" class="bc-opt" data-filter="role">🎭 إرسال لرتبة معينة</button>
        <button type="button" class="bc-opt" data-filter="user">🎯 إرسال لشخص معين</button>
      </div>
      <div id="bc-extra" style="display:none"></div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <button class="btn primary" id="bc-start">بدء البرودكاست</button>
        <button class="btn danger" id="bc-cancel">إلغاء</button>
      </div>
      <div class="progress" id="bc-progress">
        ${job.running
          ? `جاري الإرسال… ${job.sent || 0}/${job.total || 0} · فشل ${job.failed || 0}`
          : 'لا يوجد برودكاست حالياً'}
      </div>
      <p class="hint" id="bc-counts" style="color:var(--muted);font-size:0.82rem"></p>
    </div>
  `;

  let filter = 'all';
  const extra = body.querySelector('#bc-extra');
  const opts = body.querySelectorAll('.bc-opt');

  function renderExtra() {
    if (filter === 'role') {
      extra.style.display = 'block';
      extra.innerHTML = `
        <label>الرتبة</label>
        <select id="bc-role">
          ${roles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}
        </select>`;
    } else if (filter === 'user') {
      extra.style.display = 'block';
      extra.innerHTML = `
        <label>آيدي العضو</label>
        <input id="bc-user" placeholder="Discord User ID" />`;
    } else {
      extra.style.display = 'none';
      extra.innerHTML = '';
    }
  }

  opts.forEach((btn) => {
    btn.onclick = () => {
      opts.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filter = btn.dataset.filter;
      renderExtra();
    };
  });

  api.req(`/api/guilds/${selectedGuildId}/broadcast/counts`).then((c) => {
    const el = body.querySelector('#bc-counts');
    if (el) el.textContent = `الجميع ${c.all} · متصل ${c.online} · غير متصل ${c.offline}`;
  }).catch(() => {});

  body.querySelector('#bc-start').onclick = async () => {
    const content = body.querySelector('#bc-text').value.trim();
    if (!content) return alert('اكتب رسالة');
    const payload = { content, filter };
    if (filter === 'role') payload.roleId = body.querySelector('#bc-role')?.value;
    if (filter === 'user') payload.userId = body.querySelector('#bc-user')?.value?.trim();
    try {
      await api.req(`/api/guilds/${selectedGuildId}/broadcast`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await refreshGuild({ full: true });
    } catch (e) {
      alert(e.message);
    }
  };
  body.querySelector('#bc-cancel').onclick = async () => {
    await api.req(`/api/guilds/${selectedGuildId}/broadcast/cancel`, { method: 'POST' });
    await refreshGuild({ full: true });
  };
}
function renderSettings(body) {
  const s = guildData.settings;
  const channels = guildData.channels || [];
  body.innerHTML = `
    <div class="form">
      <label>روم لوقات الحماية</label>
      <select id="log-channel">
        <option value="">— اختر روم —</option>
        ${channels.map((c) => `
          <option value="${c.id}" ${s.logChannelId === c.id ? 'selected' : ''}>
            #${escapeHtml(c.name)}
          </option>`).join('')}
      </select>
      <p class="hint" style="color:var(--muted);font-size:0.8rem;margin:0">
        هنا توصل تنبيهات الحماية (سبام، روابط، دعوات…)
      </p>
      <label>رتب مستثناة من الحماية (IDs مفصولة بفاصلة)</label>
      <input id="exempt-roles" value="${escapeAttr((s.exemptRoles || []).join(','))}" />
      <label>رتب مسموح لها بالبرودكاست</label>
      <input id="bc-roles" value="${escapeAttr((s.broadcast?.allowedRoles || []).join(','))}" />
      <label>حجم الدفعة / التأخير (مللي ثانية)</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
        <input id="batch-size" type="number" value="${s.broadcast?.batchSize || 5}" />
        <input id="batch-delay" type="number" value="${s.broadcast?.batchDelayMs || 1500}" />
      </div>
      <button class="btn primary" id="save-settings">حفظ</button>
    </div>
  `;
  body.querySelector('#save-settings').onclick = async () => {
    const btn = body.querySelector('#save-settings');
    btn.disabled = true;
    btn.textContent = 'جاري الحفظ…';
    try {
      const saved = await api.req(`/api/guilds/${selectedGuildId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          logChannelId: body.querySelector('#log-channel').value.trim() || null,
          exemptRoles: splitIds(body.querySelector('#exempt-roles').value),
          broadcast: {
            allowedRoles: splitIds(body.querySelector('#bc-roles').value),
            batchSize: Number(body.querySelector('#batch-size').value) || 5,
            batchDelayMs: Number(body.querySelector('#batch-delay').value) || 1500,
          },
        }),
      });
      if (saved?.settings) {
        guildData.settings = {
          ...guildData.settings,
          ...saved.settings,
          broadcast: saved.settings.broadcast || guildData.settings.broadcast,
        };
      }
      // حدّث القيم المعروضة بدون إعادة بناء مزعجة
      btn.textContent = '✓ تم الحفظ';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'حفظ';
      }, 1200);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'حفظ';
      alert('فشل الحفظ: ' + e.message);
    }
  };
}

async function renderLogs(body) {
  body.innerHTML = `<div class="logs">جاري التحميل…</div>`;
  const logs = await api.req(`/api/logs?guildId=${selectedGuildId}&limit=40`);
  body.innerHTML = `
    <div class="logs">
      ${logs.length ? logs.map((l) => `
        <div class="log">
          <div><b>${escapeHtml(l.type)}</b> · ${escapeHtml(l.system || '')} ${escapeHtml(l.detail || '')}</div>
          <time>${escapeHtml(l.at || '')}</time>
        </div>
      `).join('') : '<div class="empty">لا سجلات بعد</div>'}
    </div>
  `;
}

function splitIds(v) {
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

boot();
