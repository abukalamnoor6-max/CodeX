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
      <div>حماية تفعّلت: <b>${overview.stats.protectionsTriggered}</b></div>
      <div>برودكاست نجح: <b>${overview.stats.broadcastsSent}</b></div>
      <div>فشل DM: <b>${overview.stats.dmsFailed}</b></div>
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
  pollTimer = setInterval(() => refreshGuild({ full: false }), 4000);
}

async function refreshGuild({ full = false } = {}) {
  if (!selectedGuildId) return;
  guildData = await api.req(`/api/guilds/${selectedGuildId}`);

  // لا تعيد بناء الفورم وأنت تكتب — حدّث التقدم فقط
  const typing = document.activeElement &&
    (document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'SELECT');

  if (!full && typing && tab === 'broadcast') {
    const job = guildData.job || {};
    const prog = document.getElementById('bc-progress');
    if (prog) {
      prog.textContent = job.running
        ? `جاري الإرسال… ${job.sent || 0}/${job.total || 0} · فشل ${job.failed || 0}`
        : 'لا يوجد برودكاست حالياً';
    }
    return;
  }

  if (!full && typing) return;

  renderPanel();
}

function renderPanel() {
  const g = guildData;
  panelEl.innerHTML = `
    <div class="head">
      <h1>${escapeHtml(g.name)}</h1>
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
  body.innerHTML = `
    <div class="row" style="margin-bottom:0.8rem">
      <div></div>
      <div style="display:flex;gap:0.4rem">
        <button class="btn" id="all-on">تفعيل الكل</button>
        <button class="btn" id="all-off">إيقاف الكل</button>
      </div>
    </div>
    <div class="grid">
      ${meta.map((p) => {
        const on = !!gProtection(p.key)?.enabled;
        return `
          <div class="card">
            <h3>${escapeHtml(p.name)}</h3>
            <p>${escapeHtml(p.key)}</p>
            <div class="row">
              <span>${on ? 'مفعّل' : 'متوقف'}</span>
              <button class="switch ${on ? 'on' : ''}" data-key="${p.key}"><i></i></button>
            </div>
          </div>`;
      }).join('')}
    </div>
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
      <textarea id="bc-text" placeholder="اكتب الرسالة…"></textarea>
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
  body.innerHTML = `
    <div class="form">
      <label>روم اللوق (ID)</label>
      <input id="log-channel" value="${escapeAttr(s.logChannelId || '')}" placeholder="Channel ID" />
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
    await api.req(`/api/guilds/${selectedGuildId}/settings`, {
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
    await refreshGuild({ full: true });
    alert('تم الحفظ');
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
