import { pageIdFromHash } from './app/router.mjs?v=2.0.2';

// Sync runtime is intentionally bundled here so the public static deployment
  // has no fragile module-path dependency. Source modules remain in /src for tests.
  function syncRequired(value, name) {
    if (!value) throw new Error(`${name} is required`);
    return value;
  }
  function normalizeRecord(record, options) {
    const timestamp = syncRequired(options.now, 'now');
    const deviceId = syncRequired(options.deviceId, 'deviceId');
    const id = record.id || syncRequired(options.createId, 'createId')();
    return { ...record, id, createdAt: record.createdAt || timestamp, updatedAt: record.updatedAt || timestamp,
      deletedAt: record.deletedAt || null, revision: Number.isInteger(record.revision) && record.revision > 0 ? record.revision : 1,
      deviceId: record.deviceId || deviceId };
  }
  function normalizeCollection(records, options) { return records.map((record) => normalizeRecord(record, options)); }
  function touchRecord(record, options) {
    const timestamp = syncRequired(options.now, 'now');
    const deviceId = syncRequired(options.deviceId, 'deviceId');
    return { ...record, updatedAt: timestamp, revision: (Number.isInteger(record.revision) && record.revision > 0 ? record.revision : 0) + 1, deviceId };
  }
  function markDeleted(record, options) { return { ...touchRecord(record, options), deletedAt: syncRequired(options.now, 'now') }; }
  function selectLatestRecord(left, right) {
    if (left.updatedAt !== right.updatedAt) return left.updatedAt > right.updatedAt ? left : right;
    if (left.revision !== right.revision) return left.revision > right.revision ? left : right;
    return left.deviceId >= right.deviceId ? left : right;
  }
  function syncEndpoint(baseUrl, path) { return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString(); }
  async function syncRequestJson(fetchImpl, url, options) {
    const response = await fetchImpl(url, options);
    const body = await response.text();
    if (!response.ok) throw new Error(`Supabase Auth request failed (${response.status})`);
    return body ? JSON.parse(body) : {};
  }
  function createSupabaseAuth({ url, anonKey, fetchImpl = fetch }) {
    syncRequired(url, 'url'); syncRequired(anonKey, 'anonKey');
    const headers = { apikey: anonKey, 'Content-Type': 'application/json' };
    function sessionFromResponse(response) { return { accessToken: syncRequired(response.access_token, 'missing access token'), refreshToken: syncRequired(response.refresh_token, 'missing refresh token'), userId: syncRequired(response.user?.id, 'missing user id') }; }
    return {
      async requestOtp(email, redirectTo) { syncRequired(email, 'email'); const body = { email: email, create_user: true }; if (redirectTo) body.email_redirect_to = redirectTo; await syncRequestJson(fetchImpl, syncEndpoint(url, '/auth/v1/otp'), { method: 'POST', headers, body: JSON.stringify(body) }); },
      async signInWithPassword(email, password) { syncRequired(email, 'email'); syncRequired(password, 'password'); const response = await syncRequestJson(fetchImpl, syncEndpoint(url, '/auth/v1/token?grant_type=password'), { method: 'POST', headers, body: JSON.stringify({ email: email, password: password }) }); return sessionFromResponse(response); },
      async verifyOtp(email, token) {
        syncRequired(email, 'email'); syncRequired(token, 'token');
        const response = await syncRequestJson(fetchImpl, syncEndpoint(url, '/auth/v1/verify'), { method: 'POST', headers, body: JSON.stringify({ type: 'email', email, token }) });
        return sessionFromResponse(response);
      },
      async refreshSession(refreshToken) { syncRequired(refreshToken, 'refreshToken'); const response = await syncRequestJson(fetchImpl, syncEndpoint(url, '/auth/v1/token?grant_type=refresh_token'), { method: 'POST', headers, body: JSON.stringify({ refresh_token: refreshToken }) }); return sessionFromResponse(response); },
      async consumeMagicLink(fragment) {
        const params = new URLSearchParams(String(fragment || '').replace(/^#/, ''));
        const accessToken = syncRequired(params.get('access_token'), 'missing access token');
        const refreshToken = syncRequired(params.get('refresh_token'), 'missing refresh token');
        const user = await syncRequestJson(fetchImpl, syncEndpoint(url, '/auth/v1/user'), { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
        return { accessToken: accessToken, refreshToken: refreshToken, userId: syncRequired(user.id, 'missing user id') };
      }
    };
  }
  function magicLinkFragment(value) {
    var raw = String(value || '').trim();
    if (raw.startsWith('#')) return raw;
    try { return new URL(raw).hash; } catch (error) { return ''; }
  }
  async function parseSupabaseResponse(response) {
    if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
    const body = await response.text(); return body ? JSON.parse(body) : [];
  }
  function createSupabaseTransport({ url, anonKey, getAccessToken = async () => anonKey, fetchImpl = fetch }) {
    syncRequired(url, 'url'); syncRequired(anonKey, 'anonKey'); syncRequired(fetchImpl, 'fetchImpl');
    async function authHeaders() { const accessToken = await getAccessToken(); syncRequired(accessToken, 'accessToken'); return { apikey: anonKey, Authorization: `Bearer ${accessToken}` }; }
    return {
      async pull(userId) { syncRequired(userId, 'userId'); const requestUrl = new URL(syncEndpoint(url, '/rest/v1/zos_records')); requestUrl.searchParams.set('user_id', `eq.${userId}`); requestUrl.searchParams.set('select', '*'); return parseSupabaseResponse(await fetchImpl(requestUrl.toString(), { headers: await authHeaders() })); },
      async upsert(rows) { if (!Array.isArray(rows) || rows.length === 0) return []; const requestUrl = new URL(syncEndpoint(url, '/rest/v1/zos_records')); requestUrl.searchParams.set('on_conflict', 'user_id,entity_type,record_id'); return parseSupabaseResponse(await fetchImpl(requestUrl.toString(), { method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows) })); }
    };
  }
  async function fetchBusinessData({ url, anonKey, accessToken, source, fetchImpl = fetch }) {
    syncRequired(url, 'url'); syncRequired(anonKey, 'anonKey'); syncRequired(accessToken, 'accessToken');
    var endpoint = new URL(syncEndpoint(url, '/functions/v1/zos-business-data'));
    if (source) endpoint.searchParams.set('source', source);
    const response = await fetchImpl(endpoint.toString(), {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` }
    });
    const body = await response.text();
    if (!response.ok) {
      var payload = {};
      try { payload = body ? JSON.parse(body) : {}; } catch (error) { /* Fall back to the HTTP status below. */ }
      var reasonMessages = {
        feishu_auth_failed: '飞书应用鉴权失败，请检查应用凭证',
        feishu_permission_denied: '飞书应用没有该多维表的高级权限，请在目标 Base 添加实际应用',
        feishu_resource_not_found: '飞书 Base 或数据表 ID 不存在，请核对当前表配置',
        feishu_field_mismatch: '飞书字段名与当前数据表不匹配，请核对字段配置',
        feishu_read_failed: '飞书数据读取失败，请检查应用权限或数据表配置',
        feishu_request_failed: '飞书服务请求失败，请稍后重试',
      };
      var reason = reasonMessages[payload && payload.reason];
      var missingFields = payload && Array.isArray(payload.missing_fields) && payload.missing_fields.length
        ? `：缺少字段 ${payload.missing_fields.join('、')}`
        : '';
      throw new Error(reason ? `业务数据请求失败（${response.status}）：${reason}${missingFields}` : `业务数据请求失败（${response.status}）`);
    }
    const data = body ? JSON.parse(body) : {};
    if (data?.meta?.mode !== 'read_only') throw new Error('接口未返回只读数据');
    return data;
  }
  function toCloudRow({ userId, entityType, record }) {
    syncRequired(userId, 'userId'); syncRequired(entityType, 'entityType');
    const metadata = { id: syncRequired(record.id, 'record.id'), createdAt: syncRequired(record.createdAt, 'record.createdAt'), updatedAt: syncRequired(record.updatedAt, 'record.updatedAt'), deletedAt: record.deletedAt || null, revision: syncRequired(record.revision, 'record.revision'), deviceId: syncRequired(record.deviceId, 'record.deviceId') };
    return { user_id: userId, entity_type: entityType, record_id: metadata.id, payload: { ...record }, created_at: metadata.createdAt, updated_at: metadata.updatedAt, deleted_at: metadata.deletedAt, revision: metadata.revision, device_id: metadata.deviceId };
  }
  function fromCloudRow(row) { return { ...(row.payload || {}), id: syncRequired(row.record_id, 'row.record_id'), createdAt: syncRequired(row.created_at, 'row.created_at'), updatedAt: syncRequired(row.updated_at, 'row.updated_at'), deletedAt: row.deleted_at || null, revision: syncRequired(row.revision, 'row.revision'), deviceId: syncRequired(row.device_id, 'row.device_id') }; }
  function indexRecords(records) { return new Map(records.map((record) => [record.id, record])); }
  function applyRemoteSnapshot({ local, remoteRows, userId = 'sync-user' }) {
    const remoteByEntity = new Map();
    for (const row of remoteRows) { const records = remoteByEntity.get(row.entity_type) || []; records.push(fromCloudRow(row)); remoteByEntity.set(row.entity_type, records); }
    const collections = {}, tombstones = [], uploads = [];
    const entityTypes = new Set([...Object.keys(local), ...remoteByEntity.keys()]);
    for (const entityType of entityTypes) {
      const localById = indexRecords(local[entityType] || []), remoteById = indexRecords(remoteByEntity.get(entityType) || []), ids = new Set([...localById.keys(), ...remoteById.keys()]), live = [];
      for (const id of ids) { const localRecord = localById.get(id), remoteRecord = remoteById.get(id), winner = !remoteRecord ? localRecord : !localRecord ? remoteRecord : selectLatestRecord(localRecord, remoteRecord); if (winner === localRecord && (!remoteRecord || winner !== remoteRecord)) uploads.push(toCloudRow({ userId, entityType, record: winner })); if (winner.deletedAt) tombstones.push({ ...winner, entity: entityType }); else live.push(winner); }
      collections[entityType] = live;
    }
    return { collections, tombstones, uploads };
  }

(function() {
  'use strict';

  const APP_VERSION = '2.0.2';
  const PUBLIC_APP_URL = new URL('.', window.location.href).href;
  const APP_RELEASE_DATE = '2026-08-07';

  // ==================== DATA LAYER ====================
  const KEYS = { TASKS:'zos_tasks', INBOX:'zos_inbox', PROJECTS:'zos_projects', COMMANDS:'zos_commands', TOMBSTONES:'zos_tombstones', ONBOARDED:'zos_onboarded', DEVICE:'zos_device_id', SCHEMA:'zos_schema_version', SYNC_CONFIG:'zos_supabase_config', SYNC_SESSION:'zos_supabase_session' };
  const SYNC_SCHEMA_VERSION = '2';

  function newDeviceId() {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'device-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  function deviceId() {
    var existing = loadVal(KEYS.DEVICE, '');
    if (existing) return existing;
    var id = newDeviceId();
    localStorage.setItem(KEYS.DEVICE, id);
    return id;
  }
  const currentDeviceId = deviceId();
  function newRecordId() {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return currentDeviceId + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2);
  }
  function load(k) {
    try {
      var raw = JSON.parse(localStorage.getItem(k)) || [];
      if (!Array.isArray(raw)) return [];
      var normalized = normalizeCollection(raw, { now: now(), deviceId: currentDeviceId, createId: newRecordId });
      if (JSON.stringify(raw) !== JSON.stringify(normalized)) localStorage.setItem(k, JSON.stringify(normalized));
      return normalized;
    } catch(e) { return []; }
  }
  function loadVal(k, fallback) { try { var v = localStorage.getItem(k); return v !== null ? v : fallback; } catch(e) { return fallback; } }
  function save(k, v) {
    var normalized = normalizeCollection(v, { now: now(), deviceId: currentDeviceId, createId: newRecordId });
    v.splice(0, v.length, ...normalized);
    localStorage.setItem(k, JSON.stringify(v));
  }

  let tasks = load(KEYS.TASKS);
  let inbox = load(KEYS.INBOX);
  let projects = load(KEYS.PROJECTS);
  let commands = load(KEYS.COMMANDS);
  let tombstones = load(KEYS.TOMBSTONES);
  let onboarded = loadVal(KEYS.ONBOARDED, '');

  // Migrate: ensure tasks have dueDate field
  let migrated = false;
  tasks.forEach(function(t) { if (!t.dueDate) { t.dueDate = null; migrated = true; } });
  if (migrated) { save(KEYS.TASKS, tasks); }

  localStorage.setItem(KEYS.SCHEMA, SYNC_SCHEMA_VERSION);
  function uid() { return newRecordId(); }
  function touch(record) {
    Object.assign(record, touchRecord(record, { now: now(), deviceId: currentDeviceId }));
    return record;
  }
  function rememberDeletion(entity, record) {
    if (!record) return;
    tombstones.push({ ...markDeleted(record, { now: now(), deviceId: currentDeviceId }), entity: entity });
    save(KEYS.TOMBSTONES, tombstones);
  }
  function now() { return new Date().toISOString(); }
  function todayStr() {
    var cn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    return cn.getFullYear() + '-' + String(cn.getMonth()+1).padStart(2,'0') + '-' + String(cn.getDate()).padStart(2,'0');
  }
  function isToday(dateStr) {
    if (!dateStr) return false;
    return dateStr.slice(0,10) === todayStr();
  }
  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + '分钟前';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + '小时前';
    const days = Math.floor(hrs / 24);
    return days + '天前';
  }

  // ==================== TOAST ====================
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // ==================== MODAL ====================
  function openModal(title, bodyHTML, onConfirm, confirmText) {
    confirmText = confirmText || '确定';
    const modal = document.getElementById('modalBody');
    modal.innerHTML = '<h3>' + title + '</h3>' + bodyHTML +
      '<div class="modal-actions"><button class="btn btn-ghost" onclick="window.closeModal()">取消</button>' +
      '<button class="btn btn-primary" id="modalConfirm">' + confirmText + '</button></div>';
    document.getElementById('modalOverlay').classList.add('show');
    document.getElementById('modalConfirm').addEventListener('click', function() {
      onConfirm();
      closeModal();
    });
  }
  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
  }
  function confirmDialog(title, msg, onConfirm) {
    openModal(title, '<p style="font-size:14px;color:var(--text-secondary);">' + msg + '</p>', onConfirm, '确认');
  }

  window.closeModal = closeModal;

  // ==================== TASK MANAGEMENT ====================
  function renderTasks(filter) {
    filter = filter || (document.querySelector('#taskFilter .filter-tab.active')?.dataset.filter || 'all');
    let list = [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter === 'todo') list = list.filter(t => t.status === 'todo');
    if (filter === 'done') list = list.filter(t => t.status === 'done');

    const container = document.getElementById('taskList');
    const empty = document.getElementById('taskEmpty');
    const summary = document.getElementById('taskSummary');

    const total = tasks.length;
    const doneCount = tasks.filter(t => t.status === 'done').length;
    summary.textContent = total ? '共 ' + total + ' 个任务，已完成 ' + doneCount + ' 个' : '任务管理';

    if (!list.length) {
      container.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';

    container.innerHTML = list.map(t => {
      const isDone = t.status === 'done';
      const proj = t.projectId ? projects.find(p => p.id === t.projectId) : null;
      return '<div class="list-item' + (isDone ? ' done' : '') + '">' +
        '<div class="checkbox' + (isDone ? ' checked' : '') + '" onclick="window.toggleTask(\'' + t.id + '\')">' + (isDone ? '✓' : '') + '</div>' +
        '<div class="list-item-body">' +
          '<div class="list-item-title">' + escapeHtml(t.title) + '</div>' +
          '<div class="list-item-meta">' +
            (proj ? '<span class="tag tag-active">' + escapeHtml(proj.name) + '</span>' : '') +
            '<span class="tag ' + (isDone ? 'tag-done' : 'tag-todo') + '">' + (isDone ? '已完成' : '进行中') + '</span>' +
            '<span>' + timeAgo(t.createdAt) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="list-item-actions">' +
          (t.description ? '<span style="font-size:12px;color:var(--text-muted);" title="' + escapeHtml(t.description) + '">💬</span>' : '') +
          '<button class="btn btn-xs btn-danger" onclick="window.deleteTask(\'' + t.id + '\')">删除</button>' +
        '</div>' +
      '</div>';
    }).join('');

    updateBadges();
  }

  function openTaskAdd() {
    openModal('新建任务',
      '<div class="form-group"><label>任务名称</label><input id="taskTitleInput" placeholder="输入任务名称" maxlength="100" autofocus></div>' +
      '<div class="form-group"><label>截止日期（可选，仅今天日期的任务才会出现在今日视图）</label><input id="taskDueInput" type="date" value="' + todayStr() + '"></div>' +
      '<div class="form-group"><label>备注（可选）</label><textarea id="taskDescInput" placeholder="任务详情…" maxlength="500"></textarea></div>' +
      '<div class="form-group"><label>关联项目（可选）</label><select id="taskProjectSelect"><option value="">不关联</option>' +
        projects.filter(p => p.status !== 'done').map(p => '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>').join('') +
      '</select></div>',
      function() {
        const title = document.getElementById('taskTitleInput').value.trim();
        if (!title) { toast('请输入任务名称'); return; }
        const projectId = document.getElementById('taskProjectSelect').value || null;
        const dueDate = document.getElementById('taskDueInput').value || null;
        tasks.push({ id: uid(), title: title, description: document.getElementById('taskDescInput').value.trim(), status: 'todo', createdAt: now(), doneAt: null, projectId: projectId, dueDate: dueDate });
        save(KEYS.TASKS, tasks);
        renderTasks();
        renderDashboardStats();
        toast('任务已创建');
      }, '创建');
  }

  window.toggleTask = function(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    if (t.status === 'done') { t.status = 'todo'; t.doneAt = null; }
    else { t.status = 'done'; t.doneAt = now(); }
    touch(t);
    save(KEYS.TASKS, tasks);
    renderTasks();
    renderDashboardStats();
    renderProjects();
  };

  window.deleteTask = function(id) {
    confirmDialog('删除任务', '确定要删除这个任务吗？此操作不可恢复。', function() {
      rememberDeletion('tasks', tasks.find(t => t.id === id));
      tasks = tasks.filter(t => t.id !== id);
      projects.forEach(p => { p.taskIds = (p.taskIds || []).filter(tid => tid !== id); touch(p); });
      save(KEYS.TASKS, tasks);
      save(KEYS.PROJECTS, projects);
      renderTasks();
      renderDashboardStats();
      renderProjects();
      toast('任务已删除');
    });
  };

  window.openTaskAdd = openTaskAdd;

  // ==================== INBOX ====================
  function renderInbox(filter) {
    filter = filter || (document.querySelector('#inboxFilter .filter-tab.active')?.dataset.filter || 'all');
    let list = [...inbox].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter === 'pending') list = list.filter(i => !i.convertedTo);
    if (filter === 'converted') list = list.filter(i => i.convertedTo);

    const container = document.getElementById('inboxList');
    const empty = document.getElementById('inboxEmpty');
    const filterEl = document.getElementById('inboxFilter');

    filterEl.style.display = inbox.length ? 'flex' : 'none';

    if (!list.length) {
      container.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';

    container.innerHTML = list.map(i => {
      const converted = i.convertedTo;
      const isBrief = i.kind === 'brief';
      const isReport = i.kind === 'report';
      const tag = converted
        ? '<span class="tag tag-done">已转为' + converted + '</span>'
        : (isReport ? '<span class="tag tag-todo">AI日报·待审核</span>' : (isBrief ? '<span class="tag tag-todo">AI简报·待审核</span>' : '<span class="tag tag-todo">待处理</span>'));
      const actions = converted
        ? '<div class="list-item-actions"><button class="btn btn-xs btn-danger" onclick="window.deleteInbox(\'' + i.id + '\')">删除</button></div>'
        : (isReport
          ? '<div class="list-item-actions"><button class="btn btn-xs btn-primary" onclick="window.exportReportDraft(\'' + i.id + '\')">导出日报(.md)</button><button class="btn btn-xs btn-danger" onclick="window.deleteInbox(\'' + i.id + '\')">删除</button></div>'
          : (isBrief
            ? '<div class="list-item-actions"><button class="btn btn-xs btn-primary" onclick="window.exportBriefDraft(\'' + i.id + '\')">导出简报(.md)</button><button class="btn btn-xs btn-danger" onclick="window.deleteInbox(\'' + i.id + '\')">删除</button></div>'
            : '<div class="list-item-actions"><button class="btn btn-xs btn-primary" onclick="window.convertToTask(\'' + i.id + '\')">转任务</button><button class="btn btn-xs" onclick="window.convertToProject(\'' + i.id + '\')">转项目</button><button class="btn btn-xs btn-danger" onclick="window.deleteInbox(\'' + i.id + '\')">删除</button></div>'));
      return '<div class="list-item">' +
        '<div class="list-item-body">' +
          '<div class="list-item-title">' + escapeHtml(i.content) + '</div>' +
          '<div class="list-item-meta"><span>' + timeAgo(i.createdAt) + '</span>' + tag + '</div>' +
        '</div>' + actions + '</div>';
    }).join('');
  }

  function addInboxItem() {
    const input = document.getElementById('inboxInput');
    const val = input.value.trim();
    if (!val) { toast('请输入内容'); return; }
    inbox.push({ id: uid(), content: val, createdAt: now(), convertedTo: null, convertedId: null });
    save(KEYS.INBOX, inbox);
    input.value = '';
    renderInbox();
    renderDashboardStats();
    updateBadges();
    toast('已收集');
  }

  window.convertToTask = function(id) {
    const item = inbox.find(i => i.id === id);
    if (!item) return;
    tasks.push({ id: uid(), title: item.content, description: '', status: 'todo', createdAt: now(), doneAt: null, projectId: null, dueDate: todayStr() });
    item.convertedTo = '任务';
    item.convertedId = tasks[tasks.length - 1].id;
    touch(item);
    save(KEYS.TASKS, tasks);
    save(KEYS.INBOX, inbox);
    renderInbox();
    renderTasks();
    renderDashboardStats();
    updateBadges();
    toast('已转为任务');
  };

  window.convertToProject = function(id) {
    const item = inbox.find(i => i.id === id);
    if (!item) return;
    projects.push({ id: uid(), name: item.content, description: '', status: 'planning', createdAt: now(), taskIds: [], source: '待确认' });
    item.convertedTo = '项目';
    item.convertedId = projects[projects.length - 1].id;
    touch(item);
    save(KEYS.PROJECTS, projects);
    save(KEYS.INBOX, inbox);
    renderInbox();
    renderProjects();
    renderDashboardStats();
    updateBadges();
    toast('已转为项目');
  };

  window.deleteInbox = function(id) {
    rememberDeletion('inbox', inbox.find(i => i.id === id));
    inbox = inbox.filter(i => i.id !== id);
    save(KEYS.INBOX, inbox);
    renderInbox();
    renderDashboardStats();
    updateBadges();
    toast('已删除');
  };

  window.addInboxItem = addInboxItem;

  function openInboxAdd() {
    navigateTo('inbox');
    setTimeout(function() {
      document.getElementById('inboxInput').focus();
    }, 300);
  }
  window.openInboxAdd = openInboxAdd;

  // ==================== PROJECT MANAGEMENT ====================
  function renderProjects(filter) {
    filter = filter || (document.querySelector('#projectFilter .filter-tab.active')?.dataset.filter || 'all');
    let list = [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter !== 'all') list = list.filter(p => p.status === filter);

    const container = document.getElementById('projectList');
    const empty = document.getElementById('projectEmpty');
    const filterEl = document.getElementById('projectFilter');

    document.getElementById('projectCount').textContent = projects.length;
    document.getElementById('projectActiveCount').textContent = projects.filter(p => p.status === 'active' || p.status === 'planning').length;
    document.getElementById('projectDoneCount').textContent = projects.filter(p => p.status === 'done').length;
    filterEl.style.display = projects.length ? 'flex' : 'none';

    if (!list.length) {
      container.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';

    const statusTags = { planning: '规划中', active: '进行中', done: '已完成', paused: '暂停' };
    const statusClasses = { planning: 'tag-planning', active: 'tag-active', done: 'tag-done', paused: 'tag-paused' };

    container.innerHTML = list.map(p => {
      const linkedTasks = tasks.filter(t => t.projectId === p.id);
      const doneCount = linkedTasks.filter(t => t.status === 'done').length;
      return '<div class="project-card">' +
        '<div class="project-card-header">' +
          '<div class="project-card-title">' + escapeHtml(p.name) + '</div>' +
          '<span class="tag ' + statusClasses[p.status] + '">' + statusTags[p.status] + '</span>' +
        '</div>' +
        (p.description ? '<div class="project-card-desc">' + escapeHtml(p.description) + '</div>' : '') +
        '<div class="project-card-meta">' +
          '<span>创建于 ' + timeAgo(p.createdAt) + '</span>' +
          (p.source ? ' · <span style="color:var(--orange);">来源：' + escapeHtml(p.source) + '</span>' : '') +
          ' · <span>' + linkedTasks.length + ' 个关联任务（' + doneCount + ' 已完成）</span>' +
        '</div>' +
        '<div class="linked-tasks">' + linkedTasks.map(t => '<span class="linked-task-dot' + (t.status === 'done' ? ' done' : '') + '" title="' + escapeHtml(t.title) + '"></span>').join('') + '</div>' +
        '<div class="project-card-footer">' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
            '<button class="btn btn-xs" onclick="window.changeProjectStatus(\'' + p.id + '\', \'planning\')">规划中</button>' +
            '<button class="btn btn-xs" onclick="window.changeProjectStatus(\'' + p.id + '\', \'active\')">进行中</button>' +
            '<button class="btn btn-xs" onclick="window.changeProjectStatus(\'' + p.id + '\', \'done\')">完成</button>' +
            '<button class="btn btn-xs" onclick="window.changeProjectStatus(\'' + p.id + '\', \'paused\')">暂停</button>' +
          '</div>' +
          '<div style="display:flex;gap:4px;">' +
            '<button class="btn btn-xs" onclick="window.editProject(\'' + p.id + '\')">编辑</button>' +
            '<button class="btn btn-xs btn-danger" onclick="window.deleteProject(\'' + p.id + '\')">删除</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function openProjectAdd() {
    openModal('新建项目',
      '<div class="form-group"><label>项目名称</label><input id="projectNameInput" placeholder="输入项目名称" maxlength="100" autofocus></div>' +
      '<div class="form-group"><label>描述（可选）</label><textarea id="projectDescInput" placeholder="项目描述…" maxlength="500"></textarea></div>' +
      '<div class="form-group"><label>数据来源</label><select id="projectSourceSelect"><option value="">手动创建</option><option value="待确认">待确认</option></select></div>',
      function() {
        const name = document.getElementById('projectNameInput').value.trim();
        if (!name) { toast('请输入项目名称'); return; }
        projects.push({ id: uid(), name: name, description: document.getElementById('projectDescInput').value.trim(), status: 'planning', createdAt: now(), taskIds: [], source: document.getElementById('projectSourceSelect').value || null });
        save(KEYS.PROJECTS, projects);
        renderProjects();
        renderDashboardStats();
        toast('项目已创建');
      }, '创建');
  }

  window.changeProjectStatus = function(id, status) {
    const p = projects.find(p => p.id === id);
    if (!p) return;
    p.status = status;
    touch(p);
    save(KEYS.PROJECTS, projects);
    renderProjects();
    renderDashboardStats();
    renderTasks();
    toast('项目状态已更新');
  };

  window.editProject = function(id) {
    const p = projects.find(p => p.id === id);
    if (!p) return;
    openModal('编辑项目',
      '<div class="form-group"><label>项目名称</label><input id="editProjectName" value="' + escapeHtml(p.name) + '" maxlength="100"></div>' +
      '<div class="form-group"><label>描述</label><textarea id="editProjectDesc" maxlength="500">' + escapeHtml(p.description || '') + '</textarea></div>',
      function() {
        p.name = document.getElementById('editProjectName').value.trim();
        if (!p.name) { toast('项目名称不能为空'); return; }
        p.description = document.getElementById('editProjectDesc').value.trim();
        touch(p);
        save(KEYS.PROJECTS, projects);
        renderProjects();
        renderTasks();
        toast('项目已更新');
      }, '保存');
  };

  window.deleteProject = function(id) {
    confirmDialog('删除项目', '删除项目不会删除关联任务，确定要删除吗？', function() {
      rememberDeletion('projects', projects.find(p => p.id === id));
      projects = projects.filter(p => p.id !== id);
      tasks.forEach(t => { if (t.projectId === id) { t.projectId = null; touch(t); } });
      save(KEYS.PROJECTS, projects);
      save(KEYS.TASKS, tasks);
      renderProjects();
      renderTasks();
      renderDashboardStats();
      toast('项目已删除');
    });
  };

  window.openProjectAdd = openProjectAdd;

  // ==================== COMMAND QUEUE ====================
  function renderCommands() {
    const list = [...commands].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const container = document.getElementById('cmdList');
    const empty = document.getElementById('cmdEmpty');

    if (!list.length) {
      container.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';

    container.innerHTML = list.map(c => {
      const isDone = c.status === 'executed';
      return '<div class="list-item">' +
        '<div class="list-item-body">' +
          '<div class="list-item-title">' + escapeHtml(c.instruction) + '</div>' +
          '<div class="list-item-meta">' +
            '<span class="tag ' + (isDone ? 'tag-executed' : 'tag-pending') + '">' + (isDone ? '已执行' : '待执行') + '</span>' +
            '<span>' + timeAgo(c.createdAt) + '</span>' +
            (c.notes ? '<span style="color:var(--text-secondary);">备注：' + escapeHtml(c.notes) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="list-item-actions">' +
          (!isDone ? '<button class="btn btn-xs btn-primary" onclick="window.executeCommand(\'' + c.id + '\')">标记执行</button>' : '') +
          '<button class="btn btn-xs btn-danger" onclick="window.deleteCommand(\'' + c.id + '\')">删除</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function addCommand() {
    const input = document.getElementById('cmdInput');
    const val = input.value.trim();
    if (!val) { toast('请输入指令'); return; }
    commands.push({ id: uid(), instruction: val, status: 'pending', createdAt: now(), executedAt: null, notes: null });
    save(KEYS.COMMANDS, commands);
    input.value = '';
    renderCommands();
    updateBadges();
    toast('指令已加入队列');
  }

  window.executeCommand = function(id) {
    const c = commands.find(c => c.id === id);
    if (!c) return;
    c.status = 'executed';
    c.executedAt = now();
    c.notes = '已手动标记执行——实际 AI 执行需接入后端服务';
    touch(c);
    save(KEYS.COMMANDS, commands);
    renderCommands();
    updateBadges();
    toast('指令已标记为已执行');
  };

  window.deleteCommand = function(id) {
    rememberDeletion('commands', commands.find(c => c.id === id));
    commands = commands.filter(c => c.id !== id);
    save(KEYS.COMMANDS, commands);
    renderCommands();
    updateBadges();
    toast('指令已删除');
  };

  window.addCommand = addCommand;

  // ==================== TODAY VIEW ====================
  function renderTodayView() {
    var todayTasks = tasks.filter(function(t) { return t.status === 'todo' && isToday(t.dueDate); });
    var pendingInbox = inbox.filter(function(i) { return !i.convertedTo; });
    var pendingCmds = commands.filter(function(c) { return c.status === 'pending'; });

    // Today date label
    var labelEl = document.getElementById('todayDateLabel');
    if (labelEl) {
      var cn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
      var weekdays = ['日','一','二','三','四','五','六'];
      labelEl.textContent = cn.getFullYear() + '年' + (cn.getMonth()+1) + '月' + cn.getDate() + '日 星期' + weekdays[cn.getDay()];
    }

    function renderSection(id, items, icon, emptyText, clickHandler) {
      var el = document.getElementById(id);
      if (!el) return;
      if (!items.length) {
        el.innerHTML = '<div class="today-empty">' + emptyText + '</div>';
        return;
      }
      el.innerHTML = items.map(function(item, idx) {
        var text = item.title || item.content || item.instruction || '';
        var tag = '';
        if (item.status === 'pending') tag = '<span class="today-item-tag tag tag-pending">待执行</span>';
        return '<div class="today-item" onclick="' + clickHandler + '(\'' + item.id + '\')">' +
          '<span class="today-item-icon">' + icon + '</span>' +
          '<span class="today-item-text">' + escapeHtml(text) + '</span>' +
          tag +
          '</div>';
      }).join('');
    }

    renderSection('todayTasks', todayTasks, '📌', '今天没有安排任务。去「任务」页面新建一个吧。', 'window.navigateToTaskDetail');
    renderSection('todayInbox', pendingInbox, '📥', '收集箱中没有待处理的内容。', 'window.navigateToInboxItem');
    renderSection('todayCommands', pendingCmds, '⚡', 'AI 指令队列为空。', 'window.navigateToBrain');
  }

  window.navigateToTaskDetail = function(id) { navigateTo('tasks'); };
  window.navigateToInboxItem = function(id) { navigateTo('inbox'); };
  window.navigateToBrain = function() { navigateTo('zos-brain'); };

  // ==================== DASHBOARD STATS ====================
  var commandCenterReadErrors = {};
  function commandCenterSetReadError(source, error) {
    if (error) commandCenterReadErrors[source] = error.message || String(error);
    else delete commandCenterReadErrors[source];
  }
  function hasBusinessSummary(source, summary) {
    var fields = source === 'wanjia' ? ['totalMerchants', 'activeMerchants', 'paymentGmv'] : ['activeProjects', 'pendingDeliveries', 'receivedAmount'];
    return !!summary && typeof summary === 'object' && fields.every(function(field) {
      return Object.prototype.hasOwnProperty.call(summary, field) && typeof summary[field] === 'number' && Number.isFinite(summary[field]);
    });
  }
  function businessSummaryMissingFields(source, summary) {
    var fields = source === 'wanjia' ? ['totalMerchants', 'activeMerchants', 'paymentGmv'] : ['activeProjects', 'pendingDeliveries', 'receivedAmount'];
    return fields.filter(function(field) {
      return !summary || typeof summary !== 'object' || !Object.prototype.hasOwnProperty.call(summary, field) || typeof summary[field] !== 'number' || !Number.isFinite(summary[field]);
    });
  }
  function commandSourceState(source, payload, isValid) {
    if (commandCenterReadErrors[source] || (payload && payload.error)) return 'failed';
    if (payload && isValid === false) return 'confirm';
    if (payload) return 'synced';
    var session = syncSession();
    return session.userId && session.accessToken ? 'pending' : 'confirm';
  }
  function renderStatusCard(state, config) {
    var labels = { synced: '已同步', pending: '待同步', confirm: '待确认', failed: '读取失败' };
    var notes = {
      synced: config.syncedNote || '只读数据已缓存。',
      pending: config.pendingNote || '已登录，等待手动刷新只读数据。',
      confirm: config.confirmNote || '请确认登录、权限或数据源配置。',
      failed: commandCenterReadErrors[config.source] || '最近一次读取失败，请核对权限和数据源。'
    };
    var metrics = (config.metrics || []).map(function(metric) {
      return '<div><div class="command-metric">' + escapeHtml(String(metric.value)) + '</div><div class="command-metric-label">' + escapeHtml(metric.label) + '</div></div>';
    }).join('');
    return '<article class="command-card">' +
      '<div class="command-card-head"><div><div class="command-card-title">' + escapeHtml(config.title) + '</div><div class="command-card-source">' + escapeHtml(config.sourceLabel) + '</div></div>' +
      '<span class="command-status ' + state + '">' + labels[state] + '</span></div>' +
      (metrics ? '<div class="command-metric-row">' + metrics + '</div>' : '') +
      '<p class="command-card-note">' + escapeHtml(notes[state]) + '</p>' +
      (config.action ? '<div class="command-card-actions"><button class="btn btn-xs" onclick="' + config.action + '">' + escapeHtml(config.actionLabel || '查看') + '</button></div>' : '') +
      '</article>';
  }
  function renderCommandList(items, emptyText, meta) {
    if (!items.length) return '<div class="command-empty">' + escapeHtml(emptyText) + '</div>';
    return '<div class="command-list">' + items.map(function(item) {
      return '<div class="command-list-item"><div class="command-list-main">' + escapeHtml(item.title) +
        (item.meta ? '<div class="command-list-meta">' + escapeHtml(item.meta) + '</div>' : '') +
        '</div>' + (meta ? meta(item) : '') + '</div>';
    }).join('') + '</div>';
  }
  function renderCommandCenter() {
    var container = document.getElementById('commandCenterGrid');
    if (!container) return;
    var cache = businessDataCache();
    var projectIndex = projectIndexState || loadProjectIndex();
    var projectRows = (projectIndex && Array.isArray(projectIndex.projects)) ? projectIndex.projects : [];
    var brainIndex = cache.brain && cache.brain.payload;
    var wanjia = cache.wanjia && cache.wanjia.summary;
    var huahuo = cache.huahuo && cache.huahuo.summary;
    var wanjiaSummaryValid = hasBusinessSummary('wanjia', wanjia);
    var huahuoSummaryValid = hasBusinessSummary('huahuo', huahuo);
    var wanjiaMissingFields = businessSummaryMissingFields('wanjia', wanjia);
    var huahuoMissingFields = businessSummaryMissingFields('huahuo', huahuo);
    var pendingTasks = tasks.filter(function(t) { return t.status !== 'done'; });
    var todayTasks = pendingTasks.filter(function(t) { return isToday(t.dueDate); });
    var pendingInbox = inbox.filter(function(i) { return !i.convertedTo; });
    var aiDrafts = pendingInbox.filter(function(i) { return i.kind === 'brief' || i.kind === 'report'; });
    var pendingCommands = commands.filter(function(c) { return c.status === 'pending'; });
    var activeProjects = projectRows.filter(function(p) { return p.status === '进行中'; }).length;
    var riskyProjects = projectRows.filter(function(p) { return p.riskLevel === '高' || p.status === '风险' || p.status === '已延期'; }).length;
    var recentNotes = brainIndex && Array.isArray(brainIndex.notes) ? brainIndex.notes.slice().sort(function(a, b) { return String(b.mtime || '').localeCompare(String(a.mtime || '')); }).slice(0, 3) : [];

    var overview = [
      renderStatusCard(commandSourceState('wanjia', wanjia, wanjiaSummaryValid), {
        title: '万嘉网络', source: 'wanjia', sourceLabel: '飞书 ERP · 只读汇总',
        metrics: wanjiaSummaryValid ? [{ value: wanjia.totalMerchants, label: '商家总数' }, { value: wanjia.activeMerchants, label: '活跃商家' }] : (wanjia ? [{ value: '—', label: '商家总数' }, { value: '—', label: '活跃商家' }] : []),
        action: "navigateTo('local-life')", actionLabel: '查看业务', pendingNote: '等待从飞书 ERP 手动刷新万嘉只读汇总。',
        confirmNote: wanjia ? '只读汇总缺少字段：' + wanjiaMissingFields.join('、') + '；暂不显示 KPI。' : '请确认登录、权限或万嘉只读数据源配置。'
      }),
      renderStatusCard(commandSourceState('huahuo', huahuo, huahuoSummaryValid), {
        title: '花火影像', source: 'huahuo', sourceLabel: '飞书 ERP · 只读汇总',
        metrics: huahuoSummaryValid ? [{ value: huahuo.activeProjects, label: '活跃项目' }, { value: huahuo.pendingDeliveries, label: '待交付' }] : (huahuo ? [{ value: '—', label: '活跃项目' }, { value: '—', label: '待交付' }] : []),
        action: "navigateTo('spark-media')", actionLabel: '查看业务', pendingNote: '等待从飞书 ERP 手动刷新花火只读汇总。',
        confirmNote: huahuo ? '只读汇总缺少字段：' + huahuoMissingFields.join('、') + '；暂不显示 KPI。' : '请确认登录、权限或花火只读数据源配置。'
      }),
      renderStatusCard(commandSourceState('projects', projectRows.length ? projectIndex : null), {
        title: '企业项目', source: 'projects', sourceLabel: '飞书项目索引 · 仅元数据',
        metrics: projectRows.length ? [{ value: activeProjects, label: '进行中' }, { value: riskyProjects, label: '风险或延期' }] : [],
        action: "navigateTo('enterprise')", actionLabel: '查看项目', confirmNote: '尚无可用项目索引；请确认飞书权限或导入经过确认的本地索引。'
      })
    ].join('');
    var schedule = renderCommandList(todayTasks.slice(0, 4).map(function(t) { return { title: t.title || '未命名任务', meta: t.dueDate ? '截止 ' + t.dueDate : '未设截止日' }; }), '今天没有已安排的本地任务。可新建任务或安排复盘。');
    var knowledge = renderCommandList(recentNotes.map(function(note) { return { title: note.title || note.path || '未命名笔记', meta: (note.folder || '未分类') + ' · ' + (note.mtime || '时间未知') }; }), '尚未读取企业大脑元数据索引；不会读取 Markdown 正文。');
    var aiQueue = renderCommandList(
      pendingCommands.slice(0, 2).map(function(c) { return { title: c.instruction || '未命名 AI 指令', meta: 'AI 指令队列 · 待人工确认' }; })
        .concat(aiDrafts.slice(0, 2).map(function(i) { return { title: i.content || 'AI 草稿', meta: '草稿收集箱 · 待人工审核' }; })),
      'AI 队列为空。AI 仅生成待确认项目，绝不自动执行或外发。'
    );
    var health = renderStatusCard(commandSourceState('brain', brainIndex), {
      title: '系统健康与知识索引', source: 'brain', sourceLabel: 'Obsidian · 只读元数据',
      metrics: brainIndex ? [{ value: recentNotes.length, label: '最近可见笔记' }, { value: pendingInbox.length, label: '待处理收集' }] : [{ value: pendingInbox.length, label: '待处理收集' }],
      action: "navigateTo('zos-brain')", actionLabel: '查看队列与索引',
      confirmNote: '请确认 Obsidian 元数据索引已生成并同步；工作台不读取 Markdown 正文。'
    });
    container.innerHTML = overview +
      '<article class="command-card wide"><div class="command-card-head"><div><div class="command-card-title">今日行动</div><div class="command-card-source">本地任务 · 需要人工推进</div></div><button class="btn btn-xs" onclick="navigateTo(\'today\')">打开今日视图</button></div>' + schedule + '</article>' +
      '<article class="command-card"><div class="command-card-head"><div><div class="command-card-title">AI 队列</div><div class="command-card-source">仅待确认与审核，不自动执行或外发</div></div><span class="command-status confirm">待确认</span></div>' + aiQueue + '<div class="command-card-actions"><button class="btn btn-xs" onclick="navigateTo(\'zos-brain\')">人工审核队列</button><button class="btn btn-xs" onclick="generateDailyReport()">生成日报草稿</button></div></article>' +
      '<article class="command-card wide"><div class="command-card-head"><div><div class="command-card-title">最近知识</div><div class="command-card-source">Obsidian 只读元数据 · 不含 Markdown 正文</div></div><button class="btn btn-xs" onclick="refreshBusinessData(\'brain\')">刷新索引</button></div>' + knowledge + '</article>' + health;
  }
  window.renderCommandCenter = renderCommandCenter;
  window.refreshCommandCenter = async function() {
    await Promise.all(['wanjia', 'huahuo', 'projects', 'brain'].map(function(source) { return refreshBusinessData(source); }));
    renderCommandCenter();
  };
  function renderDashboardStats() {
    const container = document.getElementById('dashboardStats');
    const todoCount = tasks.filter(t => t.status === 'todo').length;
    const doneCount = tasks.filter(t => t.status === 'done').length;
    const inboxCount = inbox.filter(i => !i.convertedTo).length;
    const projectCount = projects.length;
    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning').length;
    const pendingCmds = commands.filter(c => c.status === 'pending').length;

    container.innerHTML =
      '<div class="stat-card"><div class="stat-card-label">待处理收集</div><div class="stat-card-value">' + inboxCount + '</div></div>' +
      '<div class="stat-card"><div class="stat-card-label">进行中任务</div><div class="stat-card-value">' + todoCount + '</div></div>' +
      '<div class="stat-card"><div class="stat-card-label">已完成任务</div><div class="stat-card-value" style="color:var(--green)">' + doneCount + '</div></div>' +
      '<div class="stat-card"><div class="stat-card-label">活跃项目</div><div class="stat-card-value">' + activeProjects + '/' + projectCount + '</div></div>' +
      '<div class="stat-card"><div class="stat-card-label">待执行 AI 指令</div><div class="stat-card-value">' + pendingCmds + '</div></div>';

    // Update project overview card
    const po = document.getElementById('projectOverview');
    if (po) {
      po.textContent = projectCount ? '● ' + activeProjects + ' 个项目进行中' : '● 待确认';
    }
    renderCommandCenter();
  }

  function updateBadges() {
    const inboxBadge = document.getElementById('inboxBadge');
    const taskBadge = document.getElementById('taskBadge');
    const inboxCount = inbox.filter(i => !i.convertedTo).length;
    const todoCount = tasks.filter(t => t.status === 'todo').length;

    if (inboxCount) { inboxBadge.style.display = ''; inboxBadge.textContent = inboxCount; }
    else { inboxBadge.style.display = 'none'; }
    if (todoCount) { taskBadge.style.display = ''; taskBadge.textContent = todoCount; }
    else { taskBadge.style.display = 'none'; }
  }

  // ==================== ONBOARDING ====================
  function checkOnboarding() {
    var hasData = tasks.length || inbox.length || projects.length || commands.length;
    var banner = document.getElementById('onboardingBanner');
    if (banner) {
      banner.style.display = (!onboarded && !hasData) ? 'flex' : 'none';
    }
  }

  function createSampleData() {
    var today = todayStr();
    var nowStr = now();

    // Sample inbox items
    inbox.push(
      { id: uid(), content: '整理本周花火影像拍摄排期', createdAt: nowStr, convertedTo: null, convertedId: null },
      { id: uid(), content: '联系万嘉网络供应商确认活动档期', createdAt: nowStr, convertedTo: null, convertedId: null },
      { id: uid(), content: '研究 AI + Obsidian 知识图谱搭建方案', createdAt: nowStr, convertedTo: null, convertedId: null }
    );

    // Sample projects
    var p1 = uid(); var p2 = uid();
    projects.push(
      { id: p1, name: 'Q3 万嘉网络营销活动', description: '暑期餐饮门店联合推广活动策划与执行', status: 'active', createdAt: nowStr, taskIds: [], source: '待确认' },
      { id: p2, name: '花火影像 · 品牌宣传片', description: '客户品牌年度宣传片拍摄与后期制作', status: 'planning', createdAt: nowStr, taskIds: [], source: '待确认' }
    );

    // Sample tasks with dates
    tasks.push(
      { id: uid(), title: '完成活动方案初稿', description: '包含预算、时间线、门店清单', status: 'todo', createdAt: nowStr, doneAt: null, projectId: p1, dueDate: today },
      { id: uid(), title: '审核拍摄脚本 V2', description: '', status: 'todo', createdAt: nowStr, doneAt: null, projectId: p2, dueDate: today },
      { id: uid(), title: '搭建 Obsidian 知识库模板', description: '设计笔记分类、模板与双向链接结构', status: 'done', createdAt: nowStr, doneAt: nowStr, projectId: null, dueDate: null },
      { id: uid(), title: '周会纪要整理', description: '', status: 'todo', createdAt: nowStr, doneAt: null, projectId: null, dueDate: null }
    );

    // Sample AI commands
    commands.push(
      { id: uid(), instruction: '帮我分析本周项目进度，生成一份项目周报', status: 'pending', createdAt: nowStr, executedAt: null, notes: null },
      { id: uid(), instruction: '从收集箱中提取关键待办事项，按优先级排序', status: 'pending', createdAt: nowStr, executedAt: null, notes: null }
    );

    save(KEYS.TASKS, tasks);
    save(KEYS.INBOX, inbox);
    save(KEYS.PROJECTS, projects);
    save(KEYS.COMMANDS, commands);

    onboarded = '1';
    localStorage.setItem(KEYS.ONBOARDED, onboarded);

    refreshAll();
    document.getElementById('onboardingBanner').style.display = 'none';
    toast('示例数据已创建，欢迎体验！可在设置中一键清除。');
  }

  function dismissOnboarding() {
    onboarded = '1';
    localStorage.setItem(KEYS.ONBOARDED, onboarded);
    document.getElementById('onboardingBanner').style.display = 'none';
    toast('随时可以在仪表盘创建新内容。');
  }

  function clearSampleData() {
    confirmDialog('清除示例数据',
      '确定要清除所有数据吗？<br><br>将清除：<br>' +
      '· 所有任务（' + tasks.length + ' 条）<br>' +
      '· 收集箱内容（' + inbox.length + ' 条）<br>' +
      '· 项目数据（' + projects.length + ' 条）<br>' +
      '· AI 指令队列（' + commands.length + ' 条）<br><br>' +
      '建议先导出数据备份。',
      function() {
        tasks = []; inbox = []; projects = []; commands = []; onboarded = '';
        save(KEYS.TASKS, tasks);
        save(KEYS.INBOX, inbox);
        save(KEYS.PROJECTS, projects);
        save(KEYS.COMMANDS, commands);
        localStorage.setItem(KEYS.ONBOARDED, onboarded);
        refreshAll();
        checkOnboarding();
        toast('所有数据已清除');
      });
  }

  window.createSampleData = createSampleData;
  window.dismissOnboarding = dismissOnboarding;
  window.clearSampleData = clearSampleData;

  // ==================== DATA IMPORT/EXPORT ====================
  function exportData() {
    if (!window.ZOS_CEO_OS || !window.ZOS_CEO_OS.exportSafeBackup) {
      toast('数据保护中心正在加载，请稍后再试');
      return;
    }
    window.ZOS_CEO_OS.exportSafeBackup();
    toast('完整安全备份已下载');
  }

  function importData(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast('文件过大，最大支持 10MB'); event.target.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var app = window.ZOS_CEO_OS;
        if (!app || !app.previewBackupText || !app.importBackupText) throw new Error('数据保护中心正在加载');
        var preview = app.previewBackupText(e.target.result);
        var summary = Object.keys(preview.summary.collections).filter(function(type) {
          return preview.summary.collections[type] > 0;
        }).map(function(type) {
          return '· ' + type + '：' + preview.summary.collections[type] + ' 条';
        }).join('<br>');
        confirmDialog('确认安全合并恢复',
          '<p style="font-size:13px;color:var(--green);font-weight:600;margin-bottom:8px;">✓ 保留当前数据，不自动删除</p>' +
          '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">导入前会自动创建可撤销快照。</p>' +
          '<p style="font-size:13px;color:var(--text);">共 ' + preview.summary.totalRecords + ' 条记录<br>' + summary + '</p>' +
          '<p style="font-size:12px;color:var(--text-muted);margin-top:8px;">来源版本：' + escapeHtml(preview.sourceVersion || '未知') + '</p>',
          async function() {
            try {
              await app.importBackupText(e.target.result);
              toast('安全合并恢复完成；当前数据均已保留');
            } catch (error) {
              toast('恢复未执行：' + (error.message || '请先下载安全备份'));
            }
          });
      } catch(err) {
        openModal('恢复未执行 — 文件校验失败',
          '<div style="font-size:13px;color:var(--red);margin-bottom:8px;">当前数据未发生任何变化。</div>' +
          '<div style="font-size:13px;color:var(--text-secondary);font-family:monospace;background:#f5f5f5;padding:8px;border-radius:6px;word-break:break-all;">' + escapeHtml(err.message) + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">请确认文件是通过 ZOS 工作台导出的 .json 文件。</div>',
          function() {}, '关闭');
      }
    };
    reader.onerror = function() {
      toast('文件读取失败，请重试');
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  async function undoBackupRestore() {
    var app = window.ZOS_CEO_OS;
    if (!app || !app.undoLastRestore) { toast('数据保护中心正在加载，请稍后再试'); return; }
    try {
      await app.undoLastRestore();
      toast('已恢复导入前版本，并保留后来新增内容');
    } catch (error) {
      toast(error.message === 'restore_checkpoint_not_found' ? '暂无可撤销的恢复记录' : '撤销未完成，请重试');
    }
  }

  function clearAllData() {
    confirmDialog('清除所有数据',
      '<span style="color:var(--red);font-weight:600;">⚠️ 此操作不可恢复！</span><br><br>将清除：<br>' +
      '· 所有任务（' + tasks.length + ' 条）<br>' +
      '· 收集箱内容（' + inbox.length + ' 条）<br>' +
      '· 项目数据（' + projects.length + ' 条）<br>' +
      '· AI 指令队列（' + commands.length + ' 条）<br><br>' +
      '建议先导出数据备份。',
      function() {
        tasks = []; inbox = []; projects = []; commands = []; onboarded = '';
        save(KEYS.TASKS, tasks);
        save(KEYS.INBOX, inbox);
        save(KEYS.PROJECTS, projects);
        save(KEYS.COMMANDS, commands);
        localStorage.setItem(KEYS.ONBOARDED, onboarded);
        refreshAll();
        checkOnboarding();
        toast('所有数据已清除');
      });
  }

  function refreshAll() {
    renderTasks();
    renderInbox();
    renderProjects();
    renderCommands();
    renderDashboardStats();
    renderTodayView();
    updateBadges();
    renderBusinessDataStates();
    checkOnboarding();
  }

  window.addEventListener?.('zos:durable-state-restored', function() {
    tasks = load(KEYS.TASKS);
    inbox = load(KEYS.INBOX);
    projects = load(KEYS.PROJECTS);
    commands = load(KEYS.COMMANDS);
    tombstones = load(KEYS.TOMBSTONES);
    refreshAll();
  });

  window.exportData = exportData;
  window.importData = importData;
  window.undoBackupRestore = undoBackupRestore;
  window.clearAllData = clearAllData;

  // ==================== PRIVATE CLOUD SYNC ====================
  // The publishable key is deliberately safe for browser distribution. Real data access
  // still requires an authenticated user token and is constrained by the table's RLS rules.
  // Never add a Supabase secret or service_role key here.
  const DEFAULT_SYNC_CONFIG = Object.freeze({
    url: 'https://dtwvyramgbwtlyhmkhkd.supabase.co',
    anonKey: 'sb_publishable_a9d0ekZtcMn6oce51UdV0g_j7_BmVjg'
  });
  function syncConfig() {
    var stored = JSON.parse(loadVal(KEYS.SYNC_CONFIG, '{}'));
    return Object.assign({}, DEFAULT_SYNC_CONFIG, stored);
  }
  function syncSession() { return JSON.parse(loadVal(KEYS.SYNC_SESSION, '{}')); }
  function syncStatus(message) {
    var el = document.getElementById('syncStatus');
    if (el) el.textContent = message;
  }
  function syncState() {
    var config = syncConfig(); var session = syncSession();
    if (session.userId && session.accessToken) return { label: '已登录，可手动同步', note: 'Supabase 已登录；数据只有在你点击“立即同步”后才上传。' };
    if (config.url && config.anonKey) return { label: '已配置，等待登录', note: 'Supabase 配置已保存，尚未完成邮箱登录；本地数据不会自动上传。' };
    return { label: '未配置，仅本机', note: '尚未配置 Supabase；工作台数据仅保存在当前设备。' };
  }
  function updatePrivacyStatus() {
    var state = syncState();
    var item = document.getElementById('privacySupabaseStatus');
    var note = document.getElementById('privacySyncNote');
    if (item) item.innerHTML = '<span class="' + (state.label.indexOf('已登录') === 0 ? 'check-icon' : 'cross-icon') + '">' + (state.label.indexOf('已登录') === 0 ? '✓' : '—') + '</span> Supabase — ' + state.label;
    if (note) note.textContent = state.note;
  }
  // Business data is intentionally read-only. The cache is populated only by the
  // future Supabase Edge Function; the PWA never stores ERP credentials.
  const BUSINESS_DATA_CACHE_KEY = 'zos_business_data_cache_v1';
  function businessDataCache() {
    try { return JSON.parse(loadVal(BUSINESS_DATA_CACHE_KEY, '{}')) || {}; }
    catch (error) { return {}; }
  }
  function displayCurrency(value) {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
  function businessConnectionMessage() {
    var session = syncSession();
    if (!session.userId || !session.accessToken) return '未登录 Supabase；只读数据通道尚未启用。';
    return '已登录 Supabase；点击“刷新数据”后读取汇总数据，不会写入飞书。';
  }
  function setBusinessValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  function formatSourceUpdate(value, fallback) {
    if (!value) return fallback || '等待首次手动刷新。';
    var date = new Date(value);
    return '最近更新：' + (isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false }));
  }
  function renderSourceRails() {
    var cache = businessDataCache();
    var errors = commandCenterReadErrors || {};
    document.querySelectorAll('[data-source-rail]').forEach(function(rail) {
      var source = rail.dataset.source;
      var sourceErrors = source === 'risk'
        ? ['wanjia', 'huahuo', 'projects'].map(function(key) { return errors[key]; }).filter(Boolean)
        : (errors[source] ? [errors[source]] : []);
      var fetchedAt = source === 'wanjia' && cache.wanjia ? cache.wanjia.fetchedAt
        : source === 'huahuo' && cache.huahuo ? cache.huahuo.fetchedAt
        : source === 'brain' && cache.brain ? cache.brain.fetchedAt
        : source === 'risk' ? [cache.wanjia && cache.wanjia.fetchedAt, cache.huahuo && cache.huahuo.fetchedAt].filter(Boolean).sort().pop()
        : null;
      var status = rail.querySelector('[data-source-status]');
      var updated = rail.querySelector('[data-source-updated]');
      var error = rail.querySelector('[data-source-error]');
      if (status && (source === 'wanjia' || source === 'huahuo')) status.textContent = fetchedAt ? '已读取只读汇总；不会回写飞书。' : businessConnectionMessage();
      if (status && source === 'brain') status.textContent = fetchedAt ? '已读取只读元数据；不含 Markdown 正文。' : businessConnectionMessage();
      if (status && source === 'risk') status.textContent = fetchedAt ? '基于已缓存的只读来源生成风险提示，不会写回事实源。' : '尚无可聚合的来源数据；请手动刷新各只读来源。';
      if (updated && (source === 'wanjia' || source === 'huahuo' || source === 'brain' || source === 'risk')) updated.textContent = formatSourceUpdate(fetchedAt);
      rail.classList.toggle('has-error', sourceErrors.length > 0);
      if (error) { error.hidden = sourceErrors.length === 0; if (sourceErrors.length) error.textContent = '最近一次读取失败：' + sourceErrors.join('；'); }
    });
  }
  function renderBusinessDataStates() {
    var cache = businessDataCache();
    var message = businessConnectionMessage();
    ['wanjiaDataStatus', 'huahuoDataStatus', 'brainDataStatus'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = message;
    });

    var wanjia = cache.wanjia && cache.wanjia.summary;
    var wanjiaValid = hasBusinessSummary('wanjia', wanjia);
    var wanjiaEmpty = document.getElementById('wanjiaDataEmpty');
    var wanjiaStatus = document.getElementById('wanjiaDataStatus');
    if (wanjiaValid) {
      setBusinessValue('wanjiaMerchantCount', String(wanjia.totalMerchants));
      setBusinessValue('wanjiaActiveMerchantCount', String(wanjia.activeMerchants));
      setBusinessValue('wanjiaPaymentGmv', displayCurrency(wanjia.paymentGmv));
      if (wanjiaEmpty) wanjiaEmpty.style.display = 'none';
      if (wanjiaStatus) wanjiaStatus.textContent = '已读取缓存 · 更新于 ' + (cache.wanjia.fetchedAt || '未知时间') + ' · 只读';
      renderRecordList('wanjiaRecordList', (cache.wanjia && cache.wanjia.records) || [], 'wanjia');
    } else {
      setBusinessValue('wanjiaMerchantCount', '—');
      setBusinessValue('wanjiaActiveMerchantCount', '—');
      setBusinessValue('wanjiaPaymentGmv', '—');
      if (wanjia) {
        if (wanjiaEmpty) wanjiaEmpty.style.display = '';
        if (wanjiaStatus) wanjiaStatus.textContent = '待确认 · 只读汇总缺少字段：' + businessSummaryMissingFields('wanjia', wanjia).join('、') + '。';
      }
    }

    var huahuo = cache.huahuo && cache.huahuo.summary;
    var huahuoValid = hasBusinessSummary('huahuo', huahuo);
    var huahuoEmpty = document.getElementById('huahuoDataEmpty');
    var huahuoStatus = document.getElementById('huahuoDataStatus');
    if (huahuoValid) {
      setBusinessValue('huahuoActiveProjects', String(huahuo.activeProjects));
      setBusinessValue('huahuoPendingDeliveries', String(huahuo.pendingDeliveries));
      setBusinessValue('huahuoReceivedAmount', displayCurrency(huahuo.receivedAmount));
      if (huahuoEmpty) huahuoEmpty.style.display = 'none';
      if (huahuoStatus) huahuoStatus.textContent = '已读取缓存 · 更新于 ' + (cache.huahuo.fetchedAt || '未知时间') + ' · 只读';
      renderRecordList('huahuoRecordList', (cache.huahuo && cache.huahuo.records) || [], 'huahuo');
    } else {
      setBusinessValue('huahuoActiveProjects', '—');
      setBusinessValue('huahuoPendingDeliveries', '—');
      setBusinessValue('huahuoReceivedAmount', '—');
      if (huahuo) {
        if (huahuoEmpty) huahuoEmpty.style.display = '';
        if (huahuoStatus) huahuoStatus.textContent = '待确认 · 只读汇总缺少字段：' + businessSummaryMissingFields('huahuo', huahuo).join('、') + '。';
      }
    }
    renderSourceRails();
    renderCommandCenter();
  }
  async function refreshBusinessData(source) {
    var labels = { wanjia: '万嘉网络', huahuo: '花火影像', brain: 'ZOS 企业大脑' };
    if (source === 'brain') {
      try {
        var config = syncConfig(); var session = syncSession();
        if (!session.userId || !session.accessToken) { toast('请先完成 Supabase 邮箱登录'); return; }
        if (session.refreshToken) {
          try { var refreshed = await configuredAuth().refreshSession(session.refreshToken); session = Object.assign({}, session, refreshed); localStorage.setItem(KEYS.SYNC_SESSION, JSON.stringify(session)); } catch (e) {}
        }
        toast('正在读取企业大脑只读索引…');
        var brainPayload = await fetchBrainIndex();
        if (!brainPayload) {
          var stEl = document.getElementById('brainDataStatus');
          if (stEl) stEl.textContent = '云端暂无只读索引；请先在本地运行 obsidian-metadata-scan 并同步';
          toast('云端暂无只读索引；请先生成并同步索引');
          renderBusinessDataStates(); renderBrainIndex();
          return;
        }
        var bcache = businessDataCache();
        bcache.brain = { payload: brainPayload, fetchedAt: brainPayload.scannedAt || new Date().toISOString() };
        localStorage.setItem(BUSINESS_DATA_CACHE_KEY, JSON.stringify(bcache));
        commandCenterSetReadError('brain');
        renderBusinessDataStates(); renderBrainIndex();
        toast('企业大脑只读索引已刷新（仅元数据，不取正文）');
      } catch (error) {
        commandCenterSetReadError('brain', error);
        renderBusinessDataStates(); renderBrainIndex();
        toast('知识库读取失败：' + error.message);
      }
      return;
    }
    if (source === 'projects') {
      try {
        var config = syncConfig(); var session = syncSession();
        if (!session.userId || !session.accessToken) {
          var localProj = loadProjectIndex();
          if (localProj) { projectIndexState = localProj; renderProjectCenter(); renderCockpit(); toast('已载入本地项目索引缓存（未登录也可查看）'); }
          else { toast('请先完成 Supabase 登录，或导入本地索引 JSON'); }
          return;
        }
        if (session.refreshToken) {
          try { var pr = await configuredAuth().refreshSession(session.refreshToken); session = Object.assign({}, session, pr); localStorage.setItem(KEYS.SYNC_SESSION, JSON.stringify(session)); } catch (e) {}
        }
        toast('正在读取项目只读索引…');
        var projPayload = null;
        try {
          // 主路径：Edge Function（飞书只读代理），与 wanjia/huahuo 一致
          var bdata = await fetchBusinessData({ url: config.url, anonKey: config.anonKey, accessToken: session.accessToken });
          if (bdata && bdata.projects && Array.isArray(bdata.projects.projects)) {
            projPayload = bdata.projects; // { source:'projects', mode:'read_only', projects:[...] }
          }
        } catch (e) { /* 落到下方缓存回退 */ }
        if (!projPayload) {
          // 回退路径：Supabase zos_business_cache（source='projects'）
          try { projPayload = await fetchProjectIndex(); } catch (e) {}
        }
        if (!projPayload) {
          var localProj2 = loadProjectIndex();
          if (localProj2) { projectIndexState = localProj2; commandCenterSetReadError('projects'); renderProjectCenter(); renderCockpit(); toast('云端暂无项目索引，已回退本地缓存'); return; }
          var stp = document.getElementById('projectDataStatus');
          if (stp) stp.textContent = '云端暂无项目索引；请确认 Edge Function 已返回 projects 或导入本地索引';
          renderProjectCenter(); renderCockpit();
          toast('云端暂无项目索引');
          return;
        }
        projectIndexState = projPayload;
        saveProjectIndex(projPayload);
        commandCenterSetReadError('projects');
        renderProjectCenter(); renderCockpit();
        toast('项目只读索引已刷新（仅元数据）');
      } catch (error) {
        commandCenterSetReadError('projects', error);
        renderProjectCenter(); renderCockpit();
        toast('项目读取失败：' + error.message);
      }
      return;
    }
    try {
      var config = syncConfig(); var session = syncSession();
      if (!session.userId || !session.accessToken) { toast('请先完成 Supabase 邮箱登录'); return; }
      if (session.refreshToken) {
        var refreshed = await configuredAuth().refreshSession(session.refreshToken);
        session = { ...session, ...refreshed };
        localStorage.setItem(KEYS.SYNC_SESSION, JSON.stringify(session));
      }
      toast('正在读取' + (labels[source] || '业务') + '汇总…');
      var data = await fetchBusinessData({ url: config.url, anonKey: config.anonKey, accessToken: session.accessToken, source: source });
      var cache = businessDataCache();
      if (source === 'wanjia') {
        cache.wanjia = { summary: data.wanjia?.summary || {}, records: data.wanjia?.records || [], fetchedAt: data.meta?.fetchedAt || new Date().toISOString() };
      } else if (source === 'huahuo') {
        cache.huahuo = { summary: data.huahuo?.summary || {}, records: data.huahuo?.records || [], fetchedAt: data.meta?.fetchedAt || new Date().toISOString() };
      } else {
        cache.wanjia = { summary: data.wanjia?.summary || {}, records: data.wanjia?.records || [], fetchedAt: data.meta?.fetchedAt || new Date().toISOString() };
        cache.huahuo = { summary: data.huahuo?.summary || {}, records: data.huahuo?.records || [], fetchedAt: data.meta?.fetchedAt || new Date().toISOString() };
      }
      localStorage.setItem(BUSINESS_DATA_CACHE_KEY, JSON.stringify(cache));
      commandCenterSetReadError(source);
      renderBusinessDataStates();
      toast((labels[source] || '业务') + '汇总已刷新（只读）');
    } catch (error) {
      commandCenterSetReadError(source, error);
      renderBusinessDataStates();
      toast((labels[source] || '业务') + '数据读取失败：' + error.message);
    }
  }
  window.refreshBusinessData = refreshBusinessData;

  // ===== ZOS 企业大脑 · 只读元数据索引（仅元数据，绝不取正文） =====
  function validateBrainIndex(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('索引格式无效');
    if (obj.mode !== 'read_only') throw new Error('索引不是只读模式');
    if (obj.source !== 'brain') throw new Error('索引来源不是 brain');
    if (!Array.isArray(obj.notes)) throw new Error('notes 不是数组');
    var FORBIDDEN = ['content', 'body', 'text', 'markdown'];
    obj.notes.forEach(function (note) {
      ['path', 'title', 'tags', 'mtime', 'folder', 'reviewStatus'].forEach(function (k) {
        if (!(k in note)) throw new Error('笔记缺少字段: ' + k);
      });
      FORBIDDEN.forEach(function (f) { if (f in note) throw new Error('索引禁止包含正文字段: ' + f); });
    });
    return true;
  }

  async function fetchBrainIndex() {
    var config = syncConfig(); var session = syncSession();
    syncRequired(config.url, 'url'); syncRequired(config.anonKey, 'anonKey'); syncRequired(session.accessToken, 'accessToken');
    var requestUrl = new URL(syncEndpoint(config.url, '/rest/v1/zos_business_cache'));
    requestUrl.searchParams.set('source', 'eq.brain');
    requestUrl.searchParams.set('select', 'payload');
    var response = await fetch(requestUrl.toString(), {
      headers: { apikey: config.anonKey, Authorization: 'Bearer ' + session.accessToken }
    });
    if (!response.ok) throw new Error('只读索引请求失败（' + response.status + '）');
    var rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    var payload = rows[0] && rows[0].payload;
    if (!payload || payload.mode !== 'read_only') throw new Error('只读索引响应未标记为 read_only');
    validateBrainIndex(payload);
    return payload;
  }

  async function uploadBrainIndexFile(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    try {
      var config = syncConfig(); var session = syncSession();
      if (!session.userId || !session.accessToken) throw new Error('请先完成 Supabase 邮箱登录');
      if (file.size > 2 * 1024 * 1024) throw new Error('索引文件超过 2 MB 上限');
      var payload = JSON.parse(await file.text());
      validateBrainIndex(payload);
      toast('正在同步企业大脑只读索引…');
      var endpoint = syncEndpoint(config.url, '/functions/v1/zos-brain-index');
      var response = await fetch(endpoint, {
        method: 'POST',
        headers: { apikey: config.anonKey, Authorization: 'Bearer ' + session.accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('索引同步失败（' + response.status + '）');
      await refreshBusinessData('brain');
      toast('企业大脑只读索引已同步，可在其他已登录设备刷新查看');
    } catch (error) {
      toast('企业大脑索引未同步：' + error.message);
    } finally {
      input.value = '';
    }
  }
  window.uploadBrainIndexFile = uploadBrainIndexFile;

  function brainNoteFolderGroup(note) {
    var path = (note.path || '').replace(/\\/g, '/').toLowerCase();
    if (note.reviewStatus === 'inbox-draft' || path.indexOf('收集箱') !== -1 || path.indexOf('inbox') !== -1) return 'inbox';
    if (path.indexOf('万嘉') !== -1 || path.indexOf('wanjia') !== -1) return 'wanjia';
    if (path.indexOf('花火') !== -1 || path.indexOf('huahuo') !== -1) return 'huahuo';
    if (path.indexOf('sop') !== -1 || path.indexOf('案例') !== -1 || path.indexOf('case') !== -1) return 'sop';
    return 'other';
  }

  function brainRenderNote(note, container, allowApprove) {
    var group = brainNoteFolderGroup(note);
    var li = document.createElement('div');
    li.className = 'brain-note';
    var main = document.createElement('div'); main.className = 'brain-note-main';
    var title = document.createElement('div'); title.className = 'brain-note-title'; title.textContent = note.title || note.path;
    var meta = document.createElement('div'); meta.className = 'brain-note-meta';
    var f = document.createElement('span'); f.textContent = '📁 ' + (note.folder || '(root)');
    var t = document.createElement('span'); t.textContent = '🕒 ' + (note.mtime ? new Date(note.mtime).toLocaleString('zh-CN') : '');
    meta.appendChild(f); meta.appendChild(t);
    main.appendChild(title); main.appendChild(meta);
    if (note.tags && note.tags.length) {
      var tags = document.createElement('div'); tags.className = 'brain-tags';
      note.tags.slice(0, 6).forEach(function (tg) { var el = document.createElement('span'); el.className = 'brain-tag'; el.textContent = '#' + tg; tags.appendChild(el); });
      main.appendChild(tags);
    }
    var side = document.createElement('div'); side.className = 'brain-note-side';
    var badge = document.createElement('span'); badge.className = 'review-badge ' + (note.reviewStatus || 'published');
    badge.textContent = note.reviewStatus === 'inbox-draft' ? '收集箱草稿' : (note.reviewStatus === 'excluded' ? '已排除' : '已发布');
    side.appendChild(badge);
    if (allowApprove && group === 'inbox') {
      var approved = brainApprovedSet().has(note.path);
      if (approved) {
        var ok = document.createElement('span'); ok.className = 'brain-approve-state'; ok.textContent = '✓ 已审核导出';
        side.appendChild(ok);
      } else {
        var btn = document.createElement('button'); btn.className = 'btn btn-sm btn-primary'; btn.textContent = '审核通过→导出';
        btn.addEventListener('click', function () { approveBrainNote(note.path); });
        side.appendChild(btn);
      }
    }
    li.appendChild(main); li.appendChild(side);
    container.appendChild(li);
  }

  function brainFilterState() {
    var active = document.querySelector('#brainFilter .filter-tab.active');
    return active ? active.getAttribute('data-filter') : 'all';
  }
  window.setBrainFilter = function (btn) {
    document.querySelectorAll('#brainFilter .filter-tab').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderBrainIndex();
  };

  function renderBrainIndex() {
    var cache = businessDataCache();
    var index = cache.brain && cache.brain.payload;
    var list = document.getElementById('brainNoteList');
    var empty = document.getElementById('brainDataEmpty');
    var inboxList = document.getElementById('brainInboxList');
    var inboxEmpty = document.getElementById('brainInboxEmpty');
    if (!index || !Array.isArray(index.notes) || index.notes.length === 0) {
      if (list) list.innerHTML = '';
      if (empty) empty.style.display = '';
      if (inboxList) inboxList.innerHTML = '';
      if (inboxEmpty) inboxEmpty.style.display = '';
      setBusinessValue('brainTotalCount', '—');
      setBusinessValue('brainInboxCount', '—');
      setBusinessValue('brainPublishedCount', '—');
      return;
    }
    if (empty) empty.style.display = 'none';
    var filter = brainFilterState();
    var q = (document.getElementById('brainSearch') || {}).value || '';
    var ql = q.trim().toLowerCase();
    var notes = index.notes.filter(function (note) {
      var group = brainNoteFolderGroup(note);
      if (filter !== 'all' && group !== filter) return false;
      if (ql) {
        var hay = ((note.title || '') + ' ' + (note.tags || []).join(' ') + ' ' + (note.folder || '') + ' ' + (note.path || '')).toLowerCase();
        if (hay.indexOf(ql) === -1) return false;
      }
      return true;
    });
    if (list) { list.innerHTML = ''; notes.forEach(function (n) { brainRenderNote(n, list, false); }); }
    var inboxCount = index.notes.filter(function (n) { return n.reviewStatus === 'inbox-draft'; }).length;
    var pubCount = index.notes.filter(function (n) { return n.reviewStatus === 'published'; }).length;
    setBusinessValue('brainTotalCount', String(index.notes.length));
    setBusinessValue('brainInboxCount', String(inboxCount));
    setBusinessValue('brainPublishedCount', String(pubCount));
    var inboxNotes = index.notes.filter(function (n) { return n.reviewStatus === 'inbox-draft'; });
    if (inboxList) {
      inboxList.innerHTML = '';
      if (inboxNotes.length === 0) { if (inboxEmpty) inboxEmpty.style.display = ''; }
      else { if (inboxEmpty) inboxEmpty.style.display = 'none'; inboxNotes.forEach(function (n) { brainRenderNote(n, inboxList, true); }); }
    }
    var status = document.getElementById('brainDataStatus');
    if (status) status.textContent = '已读取只读索引 · 更新于 ' + (cache.brain.fetchedAt || '未知时间') + ' · 仅元数据';
  }

  var BRAIN_APPROVED_KEY = 'zos_brain_approved_v1';
  function brainApprovedSet() {
    try { return new Set(JSON.parse(loadVal(BRAIN_APPROVED_KEY, '[]'))); } catch (e) { return new Set(); }
  }
  function brainMarkApproved(path) {
    var s = brainApprovedSet(); s.add(path);
    try { localStorage.setItem(BRAIN_APPROVED_KEY, JSON.stringify(Array.from(s))); } catch (e) {}
  }
  window.approveBrainNote = function (path) {
    var cache = businessDataCache();
    var index = cache.brain && cache.brain.payload;
    if (!index) { toast('请先刷新只读索引'); return; }
    var note = (index.notes || []).find(function (n) { return n.path === path; });
    if (!note) { toast('未找到该笔记'); return; }
    brainMarkApproved(path);
    exportBrainDraft(note);
    toast('已审核通过 · 草稿已导出（请放入暂存目录，勿直写知识库）');
    renderBrainIndex();
  };
  function exportBrainDraft(note) {
    var body = [
      '---',
      'title: ' + (note.title || note.path),
      'tags: [' + (note.tags || []).join(', ') + ']',
      'reviewed_by: ZOS 审核网关',
      'source_path: ' + note.path,
      'status: draft',
      '---',
      '',
      '# ' + (note.title || note.path),
      '',
      '> 本草稿由 ZOS 企业大脑「审核网关」于 ' + new Date().toLocaleString('zh-CN') + ' 导出。',
      '> 仅含元数据占位，不含知识库正文；请补充内容后移入知识库，切勿直接覆盖原笔记。',
      '',
      '（在此补充正文…）'
    ].join('\n');
    var blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    var safe = (note.title || 'draft').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    a.href = URL.createObjectURL(blob);
    a.download = safe + '.md';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ===== 项目中心 · 企业数据只读元数据索引 =====
  // 严守 read_only 契约：只渲染元数据（名称/类型/状态/负责人/更新时间/风险），
  // 绝不读取或写入知识正文，绝不回写事实源（飞书 ERP）。
  const PROJECT_INDEX_KEY = 'zos_project_index';
  const BRIEF_DRAFTS_KEY = 'zos_brief_drafts';
  const REPORT_DRAFTS_KEY = 'zos_report_drafts';
  var projectIndexState = null;

  function loadProjectIndex() {
    try { return JSON.parse(loadVal(PROJECT_INDEX_KEY, 'null')); } catch (e) { return null; }
  }
  function saveProjectIndex(idx) {
    try { localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(idx)); } catch (e) {}
  }
  function briefDraftsMap() {
    try { return JSON.parse(loadVal(BRIEF_DRAFTS_KEY, '{}')) || {}; } catch (e) { return {}; }
  }
  function saveBriefDraft(id, md) {
    var m = briefDraftsMap(); m[id] = md;
    try { localStorage.setItem(BRIEF_DRAFTS_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function reportDraftsMap() {
    try { return JSON.parse(loadVal(REPORT_DRAFTS_KEY, '{}')) || {}; } catch (e) { return {}; }
  }
  function saveReportDraft(id, md) {
    var m = reportDraftsMap(); m[id] = md;
    try { localStorage.setItem(REPORT_DRAFTS_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function exportReportDraft(id) {
    var m = reportDraftsMap(); var md = m[id];
    if (!md) { toast('未找到日报内容'); return; }
    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '朱帅经营日报-' + todayStr() + '.md';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('经营日报草稿已导出（.md），请人工审核后使用');
  }
  window.exportReportDraft = exportReportDraft;
  function shortDate(iso) {
    if (!iso) return '未知';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '未知';
    return d.toISOString().slice(0, 10);
  }
  function projectRiskClass(level) {
    return level === '高' ? 'high' : (level === '中' ? 'mid' : 'low');
  }
  function projectStatusClass(s) {
    if (s === '进行中') return 'active';
    if (s === '风险' || s === '已延期') return 'bad';
    return 'idle';
  }

  async function fetchProjectIndex() {
    var config = syncConfig(); var session = syncSession();
    syncRequired(config.url, 'url'); syncRequired(config.anonKey, 'anonKey'); syncRequired(session.accessToken, 'accessToken');
    var requestUrl = new URL(syncEndpoint(config.url, '/rest/v1/zos_business_cache'));
    requestUrl.searchParams.set('source', 'eq.projects');
    requestUrl.searchParams.set('select', 'payload');
    var response = await fetch(requestUrl.toString(), {
      headers: { apikey: config.anonKey, Authorization: 'Bearer ' + session.accessToken }
    });
    if (!response.ok) throw new Error('项目索引请求失败（' + response.status + '）');
    var rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    var payload = rows[0] && rows[0].payload;
    if (!payload || payload.mode !== 'read_only') throw new Error('项目索引响应未标记为 read_only');
    if (payload.source !== 'projects') throw new Error('项目索引来源不是 projects');
    if (!Array.isArray(payload.projects)) throw new Error('projects 不是数组');
    return payload;
  }

  function projectFilterState() {
    var a = document.querySelector('#projectFilter .filter-tab.active');
    return a ? a.getAttribute('data-filter') : 'all';
  }
  window.setProjectFilter = function (btn) {
    document.querySelectorAll('#projectFilter .filter-tab').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderProjectCenter();
  };

  function renderProjectCenter() {
    var index = projectIndexState || loadProjectIndex();
    var list = document.getElementById('projectList');
    var empty = document.getElementById('projectDataEmpty');
    var st = document.getElementById('projectDataStatus');
    if (!index || !Array.isArray(index.projects) || index.projects.length === 0) {
      if (list) list.innerHTML = '';
      if (empty) empty.style.display = '';
      setBusinessValue('projActiveCount', '—'); setBusinessValue('projRiskCount', '—'); setBusinessValue('projTotalCount', '—');
      if (st) st.textContent = '等待首次同步…';
      return;
    }
    if (empty) empty.style.display = 'none';
    var filter = projectFilterState();
    var rows = index.projects.filter(function (p) { return filter === 'all' || p.type === filter; });
    var active = index.projects.filter(function (p) { return p.status === '进行中'; }).length;
    var risk = index.projects.filter(function (p) { return p.riskLevel === '高' || p.status === '风险' || p.status === '已延期'; }).length;
    setBusinessValue('projActiveCount', String(active));
    setBusinessValue('projRiskCount', String(risk));
    setBusinessValue('projTotalCount', String(index.projects.length));
    if (st) st.textContent = '已读取只读索引 · 更新于 ' + (index.scannedAt || '未知时间') + ' · 仅元数据';
    if (list) {
      list.innerHTML = rows.map(function (p) {
        return '<div class="project-card">' +
          '<div class="project-main">' +
            '<div class="project-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="project-meta">' +
              '<span>类型：' + escapeHtml(p.type) + '</span>' +
              '<span>负责人：' + escapeHtml(p.owner) + '</span>' +
              '<span>更新：' + escapeHtml(shortDate(p.updatedAt)) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="project-side">' +
            '<span class="status-badge ' + projectStatusClass(p.status) + '">' + escapeHtml(p.status) + '</span>' +
            '<span class="risk-badge ' + projectRiskClass(p.riskLevel) + '">风险：' + escapeHtml(p.riskLevel) + '</span>' +
            '<span class="src-badge">' + escapeHtml(p.source) + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  window.importProjectIndexFile = function (input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        var idx = (obj && Array.isArray(obj.projects)) ? obj
          : (obj && obj.source === 'projects' ? obj
            : { source: 'projects', mode: 'read_only', scannedAt: new Date().toISOString(), projects: Array.isArray(obj) ? obj : [] });
        if (!Array.isArray(idx.projects)) throw new Error('缺少 projects 数组');
        if (idx.mode !== 'read_only') throw new Error('索引必须为 read_only');
        idx.projects = idx.projects.map(function (p) {
          var c = {};
          ['id', 'name', 'type', 'status', 'owner', 'updatedAt', 'riskLevel', 'source'].forEach(function (k) { if (k in p) c[k] = p[k]; });
          return c;
        });
        idx.mode = 'read_only'; idx.source = 'projects';
        projectIndexState = idx;
        saveProjectIndex(idx);
        renderProjectCenter(); renderCockpit();
        toast('已导入本地项目索引（' + idx.projects.length + ' 条，仅元数据）');
      } catch (e) {
        toast('导入失败：' + e.message);
      }
      input.value = '';
    };
    reader.readAsText(file);
  };

  // ===== 项目经理 Agent V1（内联实现，与 src/project-manager-agent.mjs 保持一致） =====
  // 纯函数、确定性、无网络、无密钥。只生成结构化简报，绝不写库/知识库/外发。
  function buildBrief(projects, ctx) {
    ctx = ctx || {};
    var owner = ctx.owner || '朱帅';
    var date = ctx.date || todayStr();
    var list = projects || [];
    var highRisk = list.filter(function (p) { return p.riskLevel === '高' || p.status === '风险' || p.status === '已延期'; });
    var active = list.filter(function (p) { return p.status === '进行中'; });
    var wanjia = list.filter(function (p) { return p.source === 'wanjia' || p.type === '万嘉商家运营'; });
    var keyTasks = [];
    active.forEach(function (p) { keyTasks.push('跟进「' + p.name + '」（状态：' + p.status + '，风险：' + p.riskLevel + '，负责人：' + p.owner + '）'); });
    (ctx.tasks || []).forEach(function (t) { keyTasks.push('处理任务：' + (t.title || t.name || '未命名任务')); });
    if (!keyTasks.length) keyTasks.push('今日无进行中项目，可安排规划与复盘。');
    var delayRisks = [];
    highRisk.forEach(function (p) { delayRisks.push('「' + p.name + '」存在延期/风险（状态：' + p.status + '，风险：' + p.riskLevel + '，更新：' + shortDate(p.updatedAt) + '）'); });
    if (!delayRisks.length) delayRisks.push('当前无高风险的延期项目，保持监控。');
    var followups = [];
    wanjia.forEach(function (p) { if (p.status === '进行中') followups.push('万嘉商家运营「' + p.name + '」进行中，建议今日核对动销与核销数据。'); });
    if (!followups.length) followups.push('暂无万嘉商家运营跟进提醒。');
    var decisions = [];
    highRisk.forEach(function (p) { decisions.push('需决策：「' + p.name + '」是否增派资源或调整交付节奏（风险：' + p.riskLevel + '）。'); });
    if ((ctx.inboxDrafts || 0) > 0) decisions.push('有 ' + ctx.inboxDrafts + ' 条收集箱草稿待审核，决定是否进入工作流。');
    if (!decisions.length) decisions.push('今日无明确待决策事项。');
    var suggestions = [];
    if (highRisk.length >= 2) suggestions.push('高风险项目较多（' + highRisk.length + ' 个），建议优先召开项目同步会。');
    if (active.length > 0) suggestions.push('建议每日上午固定 15 分钟过一遍进行中项目状态。');
    if ((ctx.inboxDrafts || 0) > 0) suggestions.push('先清理收集箱草稿，避免 AI 指令与待办堆积。');
    if (!suggestions.length) suggestions.push('系统运行平稳，按既定节奏推进即可。');
    return {
      title: owner + '每日经营简报', date: date, owner: owner, reviewRequired: true,
      disclaimer: '本简报由 AI 生成，须人工审核后方可执行；AI 不直接修改数据库、知识库或发送外部消息。',
      sections: { keyTasks: keyTasks, delayRisks: delayRisks, merchantFollowups: followups, decisions: decisions, suggestions: suggestions }
    };
  }
  function buildBriefMarkdown(brief) {
    var titles = { keyTasks: '一、今日重点任务', delayRisks: '二、项目延期风险', merchantFollowups: '三、商家跟进提醒', decisions: '四、待决策事项', suggestions: '五、AI 建议' };
    var lines = ['# ' + brief.title, '', '- 日期：' + brief.date, '- 负责人：' + brief.owner, '- 状态：待人工审核（AI 生成）', ''];
    ['keyTasks', 'delayRisks', 'merchantFollowups', 'decisions', 'suggestions'].forEach(function (k) {
      lines.push('## ' + titles[k]);
      var items = brief.sections[k] || [];
      if (!items.length) lines.push('- （无）'); else items.forEach(function (it) { lines.push('- ' + it); });
      lines.push('');
    });
    lines.push('> ' + brief.disclaimer);
    return lines.join('\n');
  }

  window.generateProjectBrief = function () {
    var index = projectIndexState || loadProjectIndex();
    if (!index || !index.projects || !index.projects.length) { toast('请先刷新或导入项目索引'); return; }
    var pendingTasks = (typeof tasks !== 'undefined' ? tasks : []).filter(function (t) { return t.status !== 'done' && t.status !== '已完成'; });
    var inboxDrafts = (typeof inbox !== 'undefined' ? inbox : []).filter(function (i) { return !i.convertedTo && i.kind !== 'brief'; }).length;
    var brief = buildBrief(index.projects, { owner: '朱帅', date: todayStr(), tasks: pendingTasks, inboxDrafts: inboxDrafts });
    var md = buildBriefMarkdown(brief);
    var id = uid();
    inbox.push({ id: id, content: '【AI每日简报·待审核】' + brief.title, createdAt: now(), convertedTo: null, convertedId: null, kind: 'brief' });
    save(KEYS.INBOX, inbox);
    saveBriefDraft(id, md);
    renderInbox(); renderDashboardStats(); updateBadges();
    toast('已生成《' + brief.title + '》草稿，请在收集箱审核');
  };

  window.exportBriefDraft = function (id) {
    var m = briefDraftsMap();
    var md = m[id];
    if (!md) { toast('未找到简报内容'); return; }
    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '朱帅每日经营简报-' + todayStr() + '.md';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('简报草稿已导出（.md），请人工审核后使用');
  };

  // ===== 项目经理 Agent V2 — 朱帅经营日报（内联镜像 src/project-manager-agent.mjs，前端只读聚合） =====
  function buildDailyReportInline(sources, ctx) {
    ctx = ctx || {};
    var date = ctx.date || todayStr();
    var owner = ctx.owner || '朱帅';
    var asOf = ctx.asOf || new Date();
    var wanjia = sources.wanjia || [];
    var huahuo = sources.huahuo || [];
    var projects = sources.projects || [];
    var tasks = sources.tasks || [];
    var inboxDrafts = ctx.inboxDrafts || 0;
    var wRisks = detectRisksInline(wanjia, 'wanjia', asOf);
    var hRisks = detectRisksInline(huahuo, 'huahuo', asOf);
    var pRisks = detectRisksInline(projects, 'project', asOf);
    var allRisks = wRisks.concat(hRisks).concat(pRisks);
    var keyFocus = [];
    projects.forEach(function (p) { if (p.status === '进行中') keyFocus.push('推进「' + p.name + '」（负责人：' + p.owner + '，风险：' + p.riskLevel + '）'); });
    wanjia.forEach(function (w) { if (!isDoneInline(w, 'wanjia')) keyFocus.push('万嘉「' + w.merchantName + '」：' + (w.nextAction || w.stage)); });
    huahuo.forEach(function (h) { if (!isDoneInline(h, 'huahuo')) keyFocus.push('花火「' + h.projectName + '」：' + h.stage + ' / ' + h.deliveryStatus + ' / ' + h.revenueStatus); });
    tasks.forEach(function (t) { if (t && t.status !== 'done' && t.status !== '已完成') keyFocus.push('任务：' + (t.title || t.name || '未命名任务')); });
    if (!keyFocus.length) keyFocus.push('今日无进行中项目或未完成任务，可安排规划与复盘。');
    var projectRisksLines = allRisks.length
      ? allRisks.map(function (r) { return '【' + r.level + '】' + r.name + '（' + kindLabelInline(r.kind) + '）：' + (r.reasons || []).map(function (x) { return x.label; }).join('；'); })
      : ['当前无高风险或延期项目，保持监控。'];
    var decisions = [];
    allRisks.forEach(function (r) { if (r.level === '高') decisions.push('「' + r.name + '」风险等级高，需决策是否增派资源或调整交付节奏。'); });
    if (inboxDrafts > 0) decisions.push('有 ' + inboxDrafts + ' 条收集箱草稿待审核，决定是否进入工作流。');
    if (!decisions.length) decisions.push('今日无明确待决策事项。');
    var suggestions = [];
    if (allRisks.length >= 2) suggestions.push('风险项较多（' + allRisks.length + ' 个），建议上午召开 15 分钟项目同步会。');
    var stale = allRisks.filter(function (r) { return (r.reasons || []).some(function (x) { return x.code === 'stale'; }); });
    if (stale.length) suggestions.push(stale.length + ' 个项目超过 7 天未更新，建议立即推动状态刷新与负责人确认。');
    suggestions.push('所有结论须经 Inbox 审核、人工确认后方可执行；AI 不直接修改数据库、知识库或发送外部消息。');
    if (suggestions.length === 1) suggestions.unshift('系统运行平稳，按既定节奏推进即可。');
    return {
      title: owner + '经营日报', date: date, owner: owner, reviewRequired: true,
      disclaimer: '本日报由 AI 生成，须人工审核后方可执行；AI 不直接修改数据库、知识库或发送外部消息。',
      risksCount: allRisks.length,
      sections: { keyFocus: keyFocus, projectRisks: projectRisksLines, decisions: decisions, suggestions: suggestions }
    };
  }
  function reportToMarkdownInline(report) {
    var titles = { keyFocus: '一、今日重点', projectRisks: '二、项目风险', decisions: '三、需要决策', suggestions: '四、建议动作' };
    var lines = ['# ' + report.title, '', '- 日期：' + report.date, '- 负责人：' + report.owner, '- 风险项：' + report.risksCount, '- 状态：待人工审核（AI 生成）', ''];
    ['keyFocus', 'projectRisks', 'decisions', 'suggestions'].forEach(function (k) {
      lines.push('## ' + titles[k]);
      var items = report.sections[k] || [];
      if (!items.length) lines.push('- （无）'); else items.forEach(function (it) { lines.push('- ' + it); });
      lines.push('');
    });
    lines.push('> ' + report.disclaimer);
    return lines.join('\n');
  }
  // 生成经营日报：仅读取只读缓存（万嘉/花火/项目）+ 风险检测结果 → 生成草稿 → 入收集箱待人工审核。
  // 绝不自动发送消息、绝不自动修改任何事实源 / 知识库。
  window.generateDailyReport = function () {
    var cache = businessDataCache();
    var wanjia = (cache.wanjia && cache.wanjia.records) || [];
    var huahuo = (cache.huahuo && cache.huahuo.records) || [];
    var idx = projectIndexState || loadProjectIndex();
    var projects = (idx && idx.projects) || [];
    var pendingTasks = (typeof tasks !== 'undefined' ? tasks : []).filter(function (t) { return t.status !== 'done' && t.status !== '已完成'; });
    var inboxDrafts = (typeof inbox !== 'undefined' ? inbox : []).filter(function (i) { return !i.convertedTo && i.kind !== 'brief' && i.kind !== 'report'; }).length;
    var report = buildDailyReportInline({ wanjia: wanjia, huahuo: huahuo, projects: projects, tasks: pendingTasks }, { owner: '朱帅', date: todayStr(), inboxDrafts: inboxDrafts });
    var md = reportToMarkdownInline(report);
    var id = uid();
    inbox.push({ id: id, content: '【AI经营日报·待审核】' + report.title + '（风险项 ' + report.risksCount + '）', createdAt: now(), convertedTo: null, convertedId: null, kind: 'report' });
    save(KEYS.INBOX, inbox);
    saveReportDraft(id, md);
    renderInbox(); renderDashboardStats(); updateBadges(); renderCockpit();
    toast('已生成《' + report.title + '》草稿（风险项 ' + report.risksCount + '），请在收集箱审核');
  };

  // ===== 今日驾驶舱 =====
  // ---- 内联风险引擎（与 src/risk-detector.mjs 规则一致，前端只读聚合） ----
  var RISK_DONE_STAGES = {
    wanjia: ['已结束', '已结案', '已完成'],
    huahuo: ['已结项', '已结案', '已完成', '已结束'],
    project: ['已完成'],
  };
  function daysSinceIso(iso, asOf) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return Infinity;
    return Math.floor((new Date(asOf).getTime() - d.getTime()) / 86400000);
  }
  function isDoneInline(record, kind) {
    var done = RISK_DONE_STAGES[kind] || [];
    var stage = record.stage || record.status || '';
    return done.indexOf(stage) !== -1;
  }
  function hasUnfinishedInline(record, kind) {
    if (kind === 'wanjia') return !!(record.nextAction && !/^(无|完成|结束|暂无)/.test(String(record.nextAction).trim()));
    if (kind === 'huahuo') return record.deliveryStatus === '待交付' || record.deliveryStatus === '交付中' || record.revenueStatus === '待回款';
    if (kind === 'project') return ['进行中', '已延期', '风险'].indexOf(record.status) !== -1;
    return false;
  }
  function isHighRiskInline(record, kind) {
    if (kind === 'wanjia') return record.riskLevel === '高';
    if (kind === 'huahuo') return record.profitStatus === '亏损' || record.riskLevel === '高';
    if (kind === 'project') return record.riskLevel === '高' || record.status === '风险' || record.status === '已延期';
    return false;
  }
  function isRevenuePendingInline(record, kind) {
    if (kind === 'wanjia') return record.revenueStatus === '待收款';
    if (kind === 'huahuo') return record.revenueStatus === '待回款';
    return false;
  }
  function detectRisksInline(records, kind, asOf) {
    if (!Array.isArray(records)) return [];
    var staleDays = 7, stuckDays = 14;
    return records
      .filter(function (r) { return !isDoneInline(r, kind); })
      .map(function (r) {
        var reasons = [];
        var since = daysSinceIso(r.updatedAt, asOf);
        if (since > staleDays) reasons.push({ code: 'stale', label: '超过 ' + staleDays + ' 天未更新（已停滞 ' + since + ' 天）', severity: since > stuckDays ? 'high' : 'medium' });
        if (since > stuckDays) reasons.push({ code: 'stuck', label: '状态「' + (r.stage || r.status || '未知') + '」停留超过 ' + stuckDays + ' 天', severity: 'medium' });
        if (hasUnfinishedInline(r, kind)) reasons.push({ code: 'unfinished', label: '存在未完成动作 / 交付 / 任务', severity: 'medium' });
        if (isHighRiskInline(r, kind)) reasons.push({ code: 'high_risk', label: '内置高风险标记', severity: 'high' });
        if (isRevenuePendingInline(r, kind)) reasons.push({ code: 'revenue_pending', label: '回款 / 收款待处理', severity: 'medium' });
        if (!reasons.length) return null;
        var name = r.merchantName || r.projectName || r.name || String(r.id);
        var level = reasons.some(function (x) { return x.severity === 'high'; }) ? '高' : (reasons.some(function (x) { return x.severity === 'medium'; }) ? '中' : '低');
        return { recordId: String(r.id), name: name, kind: kind, stage: r.stage || r.status || '', owner: r.owner || '', level: level, reasons: reasons };
      })
      .filter(Boolean)
      .sort(function (a, b) { var o = { '高': 0, '中': 1, '低': 2 }; return o[a.level] - o[b.level]; });
  }
  function riskPill(level) {
    var cls = level === '高' ? 'high' : (level === '中' ? 'mid' : 'low');
    return '<span class="risk-pill ' + cls + '">' + escapeHtml(level + '风险') + '</span>';
  }
  function shortDateInline(iso) {
    if (!iso) return '未知';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '未知';
    return d.toISOString().slice(0, 10);
  }
  function kindLabelInline(kind) { return { wanjia: '万嘉', huahuo: '花火', project: '项目' }[kind] || kind; }
  function renderRecordList(containerId, records, kind) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!records || !records.length) {
      el.innerHTML = '<div class="record-row-empty">暂无明细记录（点击「刷新数据」后展示只读元数据）。</div>';
      return;
    }
    el.innerHTML = records.map(function (r) {
      var title, sub = [];
      if (kind === 'wanjia') {
        title = r.merchantName || '未知商家';
        sub = [['合作类型', r.cooperationType], ['当前阶段', r.stage], ['负责人', r.owner], ['更新', shortDateInline(r.updatedAt)], ['风险', r.riskLevel], ['收入', r.revenueStatus]];
      } else if (kind === 'huahuo') {
        title = r.projectName || '花火项目';
        sub = [['客户', r.clientName], ['类型', r.projectType], ['拍摄', shortDateInline(r.shootingDate)], ['阶段', r.stage], ['交付', r.deliveryStatus], ['回款', r.revenueStatus], ['利润', r.profitStatus]];
      }
      var subHtml = sub.map(function (kv) { return '<span class="meta-pill">' + escapeHtml(kv[0] + '：' + (kv[1] != null ? kv[1] : '—')) + '</span>'; }).join('');
      return '<div class="record-row"><div class="record-row-top"><div class="record-row-title">' + escapeHtml(title) + '</div>' + riskPill(r.riskLevel || '低') + '</div><div class="record-row-sub">' + subHtml + '</div></div>';
    }).join('');
  }
  var riskSortMode = 'level';
  function setRiskSort(mode) {
    riskSortMode = mode;
    var lb = document.getElementById('sortLevelBtn');
    var sb = document.getElementById('sortSourceBtn');
    if (lb) lb.classList.toggle('active', mode === 'level');
    if (sb) sb.classList.toggle('active', mode === 'source');
    renderRiskCenter();
  }
  window.setRiskSort = setRiskSort;
  function riskLevelOrder(l) { return { '高': 0, '中': 1, '低': 2 }[l] != null ? { '高': 0, '中': 1, '低': 2 }[l] : 3; }
  function riskSourceOrder(k) { return { wanjia: 0, huahuo: 1, project: 2 }[k] != null ? { wanjia: 0, huahuo: 1, project: 2 }[k] : 3; }
  function suggestActionInline(risk) {
    var map = {
      stale: '立即联系负责人刷新状态，确认最新进展',
      stuck: '推动阶段流转，定位卡点并明确下一步',
      unfinished: '明确下一步动作与截止时间',
      high_risk: '优先评估资源投入与交付节奏',
      revenue_pending: '跟进回款 / 收款流程，避免资金占用'
    };
    var seen = {}; var out = [];
    (risk.reasons || []).forEach(function (r) {
      if (map[r.code] && !seen[r.code]) { seen[r.code] = 1; out.push(map[r.code]); }
    });
    return out.length ? out : ['保持监控，按既定节奏推进'];
  }
  function levelBadgeInline(level) {
    var cls = level === '高' ? 'high' : (level === '中' ? 'mid' : 'low');
    var text = level === '高' ? '需要立即处理' : (level === '中' ? '需要关注' : '正常');
    return '<span class="level-badge ' + cls + '">' + escapeHtml(level) + ' · ' + escapeHtml(text) + '</span>';
  }
  function classifyRiskInline(record, kind, asOf) {
    var risks = detectRisksInline([record], kind, asOf);
    if (risks.length) return risks[0];
    return {
      recordId: String(record.id),
      name: record.merchantName || record.projectName || record.name || String(record.id),
      kind: kind,
      stage: record.stage || record.status || '',
      owner: record.owner || '',
      level: '低',
      reasons: []
    };
  }
  function renderRiskCenter() {
    var cache = businessDataCache();
    var asOf = new Date();
    var wanjia = (cache.wanjia && cache.wanjia.records) || [];
    var huahuo = (cache.huahuo && cache.huahuo.records) || [];
    var idx = projectIndexState || loadProjectIndex();
    var projects = (idx && idx.projects) || [];
    var all = [];
    wanjia.forEach(function (r) { if (!isDoneInline(r, 'wanjia')) all.push(classifyRiskInline(r, 'wanjia', asOf)); });
    huahuo.forEach(function (r) { if (!isDoneInline(r, 'huahuo')) all.push(classifyRiskInline(r, 'huahuo', asOf)); });
    projects.forEach(function (r) { if (!isDoneInline(r, 'project')) all.push(classifyRiskInline(r, 'project', asOf)); });
    all.sort(function (a, b) {
      if (riskSortMode === 'source') {
        var d = riskSourceOrder(a.kind) - riskSourceOrder(b.kind);
        return d !== 0 ? d : riskLevelOrder(a.level) - riskLevelOrder(b.level);
      }
      return riskLevelOrder(a.level) - riskLevelOrder(b.level);
    });
    var high = all.filter(function (r) { return r.level === '高'; }).length;
    var mid = all.filter(function (r) { return r.level === '中'; }).length;
    var low = all.filter(function (r) { return r.level === '低'; }).length;
    var noData = (!wanjia.length && !huahuo.length && !projects.length);
    var banner = document.getElementById('riskBanner');
    if (banner) {
      if (noData) {
        banner.innerHTML = '<span class="boss-banner-empty">暂无业务数据，请先在万嘉 / 花火 / 企业项目页刷新只读汇总。</span>';
      } else {
        banner.innerHTML = '<span class="boss-stat high">🔴 需立即处理 ' + high + '</span>' +
          '<span class="boss-stat mid">🟡 需关注 ' + mid + '</span>' +
          '<span class="boss-stat low">🟢 正常 ' + low + '</span>';
      }
    }
    var el = document.getElementById('riskDecisionList');
    if (el) {
      if (!all.length) {
        el.innerHTML = '<div class="record-row-empty">当前无进行中的业务项，业务运行平稳。</div>';
      } else {
        el.innerHTML = all.map(function (r) {
          var reasons = (r.reasons && r.reasons.length) ? (r.reasons || []).map(function (x) { return escapeHtml(x.label); }).join('；') : '正常 · 无需处理';
          var actions = suggestActionInline(r).map(function (a) { return '<li>' + escapeHtml(a) + '</li>'; }).join('');
          var lvl = r.level === '高' ? 'high' : (r.level === '中' ? 'mid' : 'low');
          return '<div class="decision-card level-' + lvl + '">' +
            '<div class="decision-card-head"><div class="decision-name">' + escapeHtml(r.name) + '</div>' + levelBadgeInline(r.level) + '</div>' +
            '<div class="decision-meta"><span class="source-pill">' + escapeHtml(kindLabelInline(r.kind)) + '</span>' +
            '<span class="meta-pill">阶段：' + escapeHtml(r.stage || '—') + '</span>' +
            (r.owner ? '<span class="meta-pill">负责人：' + escapeHtml(r.owner) + '</span>' : '') + '</div>' +
            '<div class="decision-reasons"><span class="decision-label">风险原因</span>' + reasons + '</div>' +
            '<div class="decision-action"><span class="decision-label">建议动作</span><ul class="action-list">' + actions + '</ul></div>' +
            '</div>';
        }).join('');
      }
    }
    var badge = document.getElementById('riskBadge');
    if (badge) { var total = high + mid; badge.style.display = total ? 'inline-block' : 'none'; badge.textContent = String(total); }
  }
  window.renderRiskCenter = renderRiskCenter;

  function renderCockpit() {
    var idx = projectIndexState || loadProjectIndex();
    var projects = (idx && idx.projects) || [];
    var totalProjects = projects.length;
    var projectRisk = projects.filter(function (p) { return p.riskLevel === '高' || p.status === '风险' || p.status === '已延期'; }).length;
    var pendingTasks = (typeof tasks !== 'undefined' ? tasks : []).filter(function (t) { return t.status !== 'done' && t.status !== '已完成'; }).length;
    var pendingInbox = (typeof inbox !== 'undefined' ? inbox : []).filter(function (i) { return !i.convertedTo; }).length;
    var pendingAI = (typeof inbox !== 'undefined' ? inbox : []).filter(function (i) { return !i.convertedTo && (i.kind === 'brief' || i.kind === 'report'); }).length;
    var cache = businessDataCache();
    var asOf = new Date();
    var wRecords = (cache.wanjia && cache.wanjia.records) || [];
    var hRecords = (cache.huahuo && cache.huahuo.records) || [];
    var wRisk = detectRisksInline(wRecords, 'wanjia', asOf).length;
    var hRisk = detectRisksInline(hRecords, 'huahuo', asOf).length;
    var totalRisk = projectRisk + wRisk + hRisk;
    var followUp = pendingTasks + pendingInbox;
    var hasAny = projects.length || wRecords.length || hRecords.length;
    var advice = hasAny ? (totalRisk > 0 ? totalRisk + ' 项需关注' : '运行平稳') : '待同步';
    setBusinessValue('cockpitProjects', String(totalProjects));
    setBusinessValue('cockpitRisk', String(totalRisk));
    setBusinessValue('cockpitFollow', String(followUp));
    setBusinessValue('cockpitReview', String(pendingAI));
    setBusinessValue('cockpitAdvice', advice);
  }
  window.renderCockpit = renderCockpit;

  function fillSyncSettings() {
    var config = syncConfig(); var session = syncSession();
    var url = document.getElementById('syncUrl'); var key = document.getElementById('syncAnonKey');
    if (url) url.value = config.url || '';
    if (key) key.value = config.anonKey || '';
    var state = syncState();
    syncStatus(state.label);
    updatePrivacyStatus();
  }
  function saveSyncConfig() {
    var url = document.getElementById('syncUrl').value.trim().replace(/\/$/, '');
    var anonKey = document.getElementById('syncAnonKey').value.trim();
    if (!/^https:\/\/[^/]+\.supabase\.co$/i.test(url) || !anonKey) { toast('请填写有效的 Supabase 项目 URL 和 Publishable / anon key'); return; }
    localStorage.setItem(KEYS.SYNC_CONFIG, JSON.stringify({ url: url, anonKey: anonKey }));
    fillSyncSettings(); toast('云端连接配置已保存在当前设备');
  }
  function configuredAuth() {
    var config = syncConfig();
    if (!config.url || !config.anonKey) throw new Error('请先保存云端连接配置');
    return createSupabaseAuth(config);
  }
  async function signInSyncPassword() {
    try {
      var email = document.getElementById('syncEmail').value.trim();
      var passwordInput = document.getElementById('syncPassword');
      var password = passwordInput ? passwordInput.value : '';
      if (!email || !password) { toast('请填写登录邮箱和密码'); return; }
      var session = await configuredAuth().signInWithPassword(email, password);
      localStorage.setItem(KEYS.SYNC_SESSION, JSON.stringify(session));
      if (passwordInput) passwordInput.value = '';
      fillSyncSettings(); toast('云端登录成功');
    } catch (error) { syncStatus('密码登录失败：' + error.message); toast('密码登录失败，请核对账号和密码'); }
  }
  window.signInSyncPassword = signInSyncPassword;
  async function requestSyncOtp() {
    try {
      var email = document.getElementById('syncEmail').value.trim();
      if (!email) { toast('请填写登录邮箱'); return; }
      await configuredAuth().requestOtp(email, PUBLIC_APP_URL); syncStatus('登录链接已发送，请在同一浏览器打开邮件链接'); toast('登录链接已发送');
    } catch (error) { syncStatus('发送失败：' + error.message); toast('登录链接发送失败，请检查配置'); }
  }
  async function consumeSyncMagicLink() {
    if (!window.location.hash.includes('access_token=')) return;
    try {
      var session = await configuredAuth().consumeMagicLink(window.location.hash);
      localStorage.setItem(KEYS.SYNC_SESSION, JSON.stringify(session));
      history.replaceState(null, '', window.location.pathname + window.location.search);
      fillSyncSettings(); toast('云端登录成功');
    } catch (error) { syncStatus('登录链接处理失败：' + error.message); toast('登录链接无效或已过期'); }
  }
  async function consumePastedSyncMagicLink() {
    try {
      var input = document.getElementById('syncMagicLink');
      var fragment = magicLinkFragment(input ? input.value : '');
      if (!fragment.includes('access_token=')) throw new Error('登录链接缺少会话信息');
      var session = await configuredAuth().consumeMagicLink(fragment);
      localStorage.setItem(KEYS.SYNC_SESSION, JSON.stringify(session));
      if (input) input.value = '';
      fillSyncSettings(); toast('云端登录成功');
    } catch (error) { syncStatus('登录链接处理失败：' + error.message); toast('登录链接无效或已过期'); }
  }
  window.consumePastedSyncMagicLink = consumePastedSyncMagicLink;
  async function syncNow() {
    try {
      var config = syncConfig(); var session = syncSession();
      if (!session.userId || !session.accessToken) { toast('请先完成邮箱登录'); return; }
      syncStatus('正在同步…');
      if (session.refreshToken) {
        var refreshed = await configuredAuth().refreshSession(session.refreshToken);
        session = { ...session, ...refreshed };
        localStorage.setItem(KEYS.SYNC_SESSION, JSON.stringify(session));
      }
      var transport = createSupabaseTransport({ ...config, getAccessToken: async function() { return session.accessToken; } });
      var remoteRows = await transport.pull(session.userId);
      var local = { tasks: tasks.slice(), inbox: inbox.slice(), projects: projects.slice(), commands: commands.slice() };
      tombstones.forEach(function(record) { (local[record.entity] || (local[record.entity] = [])).push(record); });
      var merged = applyRemoteSnapshot({ local: local, remoteRows: remoteRows, userId: session.userId });
      tasks = merged.collections.tasks || []; inbox = merged.collections.inbox || []; projects = merged.collections.projects || []; commands = merged.collections.commands || []; tombstones = merged.tombstones;
      save(KEYS.TASKS, tasks); save(KEYS.INBOX, inbox); save(KEYS.PROJECTS, projects); save(KEYS.COMMANDS, commands); save(KEYS.TOMBSTONES, tombstones);
      if (merged.uploads.length) await transport.upsert(merged.uploads);
      refreshAll(); syncStatus('同步完成 · ' + merged.uploads.length + ' 条本地更新已上传'); toast('云端同步完成');
    } catch (error) { syncStatus('同步失败：' + error.message); toast('同步失败，请检查网络、权限和登录状态'); }
  }
  window.saveSyncConfig = saveSyncConfig; window.requestSyncOtp = requestSyncOtp; window.syncNow = syncNow;

  // ==================== UTILS ====================
  function copyToClipboard(text) {
    if (!text || text === '待部署后生成') { toast('链接尚未生成，请先部署'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() { toast('链接已复制到剪贴板'); })
        .catch(function() { fallbackCopy(text); });
    } else { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('链接已复制到剪贴板'); } catch(e) { toast('复制失败，请手动复制'); }
    document.body.removeChild(ta);
  }
  window.copyToClipboard = copyToClipboard;

  // ==================== ESCAPE HTML ====================
  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ==================== PAGE NAVIGATION ====================
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburger');
  const pageTitle = document.getElementById('pageTitle');
  const clock = document.getElementById('clock');
  const greeting = document.getElementById('greeting');
  const welcomeDate = document.getElementById('welcomeDate');

      const pageTitles = {
        'dashboard': '工作首页',
        'life': '生活首页',
        'calendar': '日历中心',
        'intelligence': '情报中心',
        'search': '全局搜索',
        'relations': '关系与跟进',
        'reviews': '复盘中心',
        'content-growth': '内容增长中心',
        'agent-workbench': 'Agent 工作台',
        'decisions': '待我决策',
        'today': '今日视图',
        'focus': '专注中心',
    'inbox': '收集箱',
    'tasks': '任务',
    'local-life': '万嘉网络',
    'spark-media': '花火影像',
        'lingli': '玲丽教育',
        'enterprise': '企业项目',
        'targets': '经营目标',
        'health': '数据健康',
    'zos-brain': 'ZOS 企业大脑',
    'risk': '风险中心',
    'privacy': '隐私与数据',
    'settings': '设置'
  };

  // Page enter handlers
  const pageEnterHandlers = {
    'today': function() { renderTodayView(); },
    'inbox': function() { renderInbox(); },
    'tasks': function() { renderTasks(); },
    'enterprise': function() { renderProjects(); },
    'zos-brain': function() { renderCommands(); renderBusinessDataStates(); renderBrainIndex(); renderProjectCenter(); },
    'local-life': function() { renderBusinessDataStates(); },
    'spark-media': function() { renderBusinessDataStates(); },
    'risk': function() { renderRiskCenter(); },
    'dashboard': function() { renderDashboardStats(); renderCockpit(); }
  };

  let currentPage = 'dashboard';
  let sidebarCollapsed = false;
      const mobileMorePageIds = ['dashboard', 'decisions', 'life', 'local-life', 'spark-media', 'lingli', 'intelligence', 'content-growth', 'agent-workbench', 'search', 'relations', 'reviews', 'enterprise', 'targets', 'health', 'inbox', 'tasks', 'zos-brain', 'risk', 'privacy', 'settings'];

  function closeMobileMoreMenu(returnFocus) {
    const menu = document.getElementById('mobileMoreMenu');
    const toggle = document.getElementById('mobileMoreToggle');
    if (!menu || !toggle || menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle.focus();
  }

  function toggleMobileMoreMenu() {
    const menu = document.getElementById('mobileMoreMenu');
    const toggle = document.getElementById('mobileMoreToggle');
    if (!menu || !toggle) return;
    if (!menu.hidden) {
      closeMobileMoreMenu(true);
      return;
    }
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    menu.querySelector('.mobile-more-item')?.focus();
  }

  function focusPageContent(target) {
    const focusTarget = target.querySelector('h1, h2') || document.getElementById('content');
    if (!focusTarget) return;
    focusTarget.setAttribute('tabindex', '-1');
    focusTarget.focus({ preventScroll: true });
  }

  function navigateTo(pageId, options) {
    options = options || {};
    const target = document.getElementById('page-' + pageId);
    if (!target) return;
    closeMobileMoreMenu(false);
    if (pageId === currentPage) {
      if (options.focusPage) focusPageContent(target);
      return;
    }

    document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-footer .nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    target.classList.add('active');

    document.querySelectorAll('#bottomNav .bottom-nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });
    document.getElementById('mobileMoreToggle')?.classList.toggle('active', mobileMorePageIds.includes(pageId));

    pageTitle.textContent = pageTitles[pageId] || pageId;
    currentPage = pageId;

    if (!options.fromLocation && window.location.hash !== '#' + pageId) {
      window.history.pushState(null, '', '#' + pageId);
    }

    if (window.innerWidth <= 1024) closeSidebar();
    document.getElementById('content').scrollTop = 0;

    // Call page enter handler
    if (pageEnterHandlers[pageId]) pageEnterHandlers[pageId]();
    if (window.ZOS_CEO_OS && typeof window.ZOS_CEO_OS.render === 'function') {
      window.ZOS_CEO_OS.render();
    }
    if (options.focusPage) focusPageContent(target);
  }

  window.navigateTo = navigateTo;

  function navigateFromLocation() {
    const pageId = pageIdFromHash(window.location.hash, function(candidate) {
      return Boolean(document.getElementById('page-' + candidate));
    });
    if (pageId) navigateTo(pageId, { fromLocation: true });
  }

  window.addEventListener('popstate', navigateFromLocation);
  window.addEventListener('hashchange', navigateFromLocation);

  document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-footer .nav-item').forEach(el => {
    el.addEventListener('click', function() { navigateTo(this.dataset.page); });
  });

  document.querySelectorAll('#bottomNav .bottom-nav-item[data-page]').forEach(el => {
    el.addEventListener('click', function() { navigateTo(this.dataset.page); });
  });
  document.getElementById('mobileMoreToggle')?.addEventListener('click', toggleMobileMoreMenu);
  document.querySelector('.mobile-more-close')?.addEventListener('click', function() { closeMobileMoreMenu(true); });
  document.querySelectorAll('.mobile-more-item[data-page]').forEach(el => {
    el.addEventListener('click', function() { navigateTo(this.dataset.page, { focusPage: true }); });
  });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') closeMobileMoreMenu(true);
  });

  navigateFromLocation();

  // ==================== FILTER TABS ====================
  document.querySelectorAll('.filter-tabs').forEach(tabs => {
    tabs.addEventListener('click', function(e) {
      const tab = e.target.closest('.filter-tab');
      if (!tab) return;
      tabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;
      if (tabs.id === 'taskFilter') renderTasks(filter);
      else if (tabs.id === 'inboxFilter') renderInbox(filter);
      else if (tabs.id === 'projectFilter') renderProjects(filter);
    });
  });

  // ==================== ENTER KEY HANDLERS ====================
  document.getElementById('inboxInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); addInboxItem(); }
  });
  document.getElementById('cmdInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCommand(); }
  });

  // ==================== CLOCK (UTC+8) ====================
  function updateClock() {
    const cn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const h = String(cn.getHours()).padStart(2, '0');
    const m = String(cn.getMinutes()).padStart(2, '0');
    const s = String(cn.getSeconds()).padStart(2, '0');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const wd = weekdays[cn.getDay()];
    const month = cn.getMonth() + 1;
    const day = cn.getDate();
    clock.textContent = h + ':' + m + ':' + s + ' · 周' + wd + ' ' + month + '/' + day;
  }
  updateClock();
  setInterval(updateClock, 1000);

  function updateGreeting() {
    const cn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const h = cn.getHours();
    let g;
    if (h < 6) g = '夜深了，';
    else if (h < 9) g = '早上好，';
    else if (h < 12) g = '上午好，';
    else if (h < 14) g = '中午好，';
    else if (h < 18) g = '下午好，';
    else g = '晚上好，';
    greeting.textContent = g + '朱帅';
  }
  updateGreeting();

  function updateWelcomeDate() {
    const cn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const y = cn.getFullYear();
    const m = cn.getMonth() + 1;
    const d = cn.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const wd = weekdays[cn.getDay()];
    welcomeDate.textContent = y + '年' + m + '月' + d + '日 星期' + wd;
  }
  updateWelcomeDate();

  // ==================== SIDEBAR ====================
  sidebarToggle.addEventListener('click', function() {
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle('collapsed', sidebarCollapsed);
    sidebarToggle.textContent = sidebarCollapsed ? '▶' : '◀';
  });

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('show');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('show');
  }
  hamburger.addEventListener('click', openSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  let lastWidth = window.innerWidth;
  window.addEventListener('resize', function() {
    const w = window.innerWidth;
    if (w > 1024 && lastWidth <= 1024) {
      closeSidebar();
      sidebar.classList.remove('collapsed');
      sidebarCollapsed = false;
      sidebarToggle.textContent = '◀';
    }
    if (w <= 1024 && lastWidth > 1024) {
      sidebar.classList.remove('collapsed');
      sidebarCollapsed = false;
    }
    lastWidth = w;
  });

  let touchStartX = 0;
  sidebar.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  sidebar.addEventListener('touchmove', function(e) {
    const dx = e.touches[0].clientX - touchStartX;
    if (dx < -60) closeSidebar();
  }, { passive: true });

  // ==================== DISPLAY MODE ====================
  const displayModeLabel = document.getElementById('displayMode');
  if (displayModeLabel) {
    function updateDisplayMode() {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      displayModeLabel.textContent = standalone ? '当前以独立 App 模式运行（PWA）' : '当前以浏览器标签页运行';
    }
    updateDisplayMode();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', updateDisplayMode);
  }

  // ==================== SERVICE WORKER ====================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js')
        .then(function(registration) {
          console.log('Service Worker 注册成功:', registration.scope);

          // 强制检查 SW 更新（每次页面加载时）
          registration.update();

          // 监听 SW 更新
          registration.addEventListener('updatefound', function() {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', function() {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 检测到新版本，自动刷新页面
                newWorker.postMessage({ type: 'skip-waiting' });
              }
            });
          });

        })
        .catch(function(err) { console.error('Service Worker 注册失败:', err); });

      // 定期检查 SW 更新（每 30 分钟）
      setInterval(function() {
        navigator.serviceWorker.getRegistration().then(function(reg) {
          if (reg) reg.update();
        });
      }, 30 * 60 * 1000);
    });
  }

  // ==================== INIT ====================
  var publicLink = document.getElementById('publicLinkUrl');
  if (publicLink) publicLink.textContent = PUBLIC_APP_URL;
  updateBadges();
  renderDashboardStats();
  renderTodayView();
  fillSyncSettings();
  renderBusinessDataStates();
  consumeSyncMagicLink();
  checkOnboarding();
  console.log('ZOS 跨端 AI 工作台 v' + APP_VERSION + ' 已就绪（' + APP_RELEASE_DATE + '）');
  console.log('新增：今日视图 · 新手引导 · 导入校验 · 跨端实测清单 · 公开链接管理');
  console.log('适配：Mac / Windows / iPhone / Android / PWA');
  console.log('用户：朱帅 | 时区：UTC+8 | 数据存储：本地 localStorage');
})();
