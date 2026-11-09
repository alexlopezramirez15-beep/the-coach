/* THE COACH — Sincronización con el servidor compartido.
 * La app sigue trabajando con una base de datos en memoria (TCStore). Este módulo:
 *  · entra/sale (sesión del servidor), descarga los documentos visibles para el usuario,
 *  · detecta qué campos han cambiado tras cada operación y los envía por lotes,
 *  · trae periódicamente los cambios de los demás (alumnos, profesor) y los fusiona.
 * El servidor decide qué puede ver y escribir cada uno; aquí sólo se transporta. */
(function (G) {
  'use strict';
  const CFG = G.TC_CONFIG || {};
  const S = G.TCStore;
  const ARR = ['users', 'competitions', 'teams', 'rounds', 'matches', 'submissions', 'evaluations', 'reflections', 'log'];
  const TOKEN_KEY = 'thecoach.remote.token';
  const keyOf = (c, o) => (c === 'reflections' ? o.teamId + ':' + o.round : o.id);

  const st = { enabled: !!(CFG.url && CFG.key && G.fetch), mode: 'remote', token: null, rev: 0, base: new Map(), secrets: [], timer: null, inflight: false, again: false, poll: null, status: 'idle', adminExists: null, online: null, myTeams: '' };
  const lsGet = (k) => { try { return G.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) G.localStorage.removeItem(k); else G.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

  function userErr(msg) { const e = new Error(msg); e.userFacing = true; return e; }
  async function rpc(fn, args) {
    let res;
    try {
      res = await G.fetch(CFG.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
    } catch (e) { setStatus('offline'); throw userErr('No hay conexión con el servidor. Revisa tu conexión a internet y vuelve a intentarlo.'); }
    let body = null; try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      const msg = (body && (body.message || body.hint)) || 'Error del servidor (' + res.status + ').';
      if (/^TC_AUTH:/.test(msg)) { dropSession(); const e = userErr(msg.replace(/^TC_AUTH:\s*/, '')); e.auth = true; throw e; }
      throw userErr(msg);
    }
    st.online = true;
    if (body && body.error) throw userErr(body.error);
    return body;
  }

  /* ───── Estado visible ───── */
  function setStatus(s) {
    st.status = s;
    const el = G.document && G.document.getElementById('sync-st');
    if (el) { el.className = 'sync ' + s; el.textContent = label(); el.title = s === 'offline' ? 'Los cambios se guardan aquí y se enviarán al recuperar la conexión.' : ''; }
  }
  function label() { return { idle: 'Guardado', saving: 'Guardando…', offline: 'Sin conexión', error: 'Error al guardar' }[st.status] || ''; }

  /* ───── Instantáneas por campo ───── */
  function snap(o) { const r = {}; for (const k of Object.keys(o)) if (o[k] !== undefined) r[k] = JSON.stringify(o[k]); return r; }
  function allDocs(db) {
    const out = [];
    for (const c of ARR) for (const o of db[c] || []) out.push([c, keyOf(c, o), o]);
    for (const k of Object.keys(db.drafts || {})) out.push(['drafts', k, db.drafts[k]]);
    return out;
  }
  function diff() {
    const db = S.load(); const ops = []; const seen = new Set();
    for (const [c, id, o] of allDocs(db)) {
      const K = c + '|' + id; seen.add(K);
      const b = st.base.get(K); const cur = snap(o);
      if (!b) { ops.push({ op: { c, id, s: JSON.parse(JSON.stringify(o)) }, K, cur, full: true }); continue; }
      const s = {}, u = []; let n = 0;
      for (const k of Object.keys(cur)) if (cur[k] !== b[k]) { s[k] = o[k]; n++; }
      for (const k of Object.keys(b)) if (!(k in cur)) { u.push(k); n++; }
      if (n) ops.push({ op: { c, id, s: JSON.parse(JSON.stringify(s)), u }, K, cur });
    }
    for (const K of st.base.keys()) if (!seen.has(K)) { const i = K.indexOf('|'); ops.push({ op: { c: K.slice(0, i), id: K.slice(i + 1), del: true }, K, del: true }); }
    return ops;
  }

  /* ───── Envío ───── */
  function changed() { if (st.mode !== 'remote' || !st.token) return; clearTimeout(st.timer); st.timer = setTimeout(flush, 350); }
  async function flush() {
    if (st.mode !== 'remote' || !st.token) return;
    if (st.inflight) { st.again = true; return; }
    const ops = diff(); const secrets = st.secrets.slice();
    if (!ops.length && !secrets.length) { if (st.status !== 'offline') setStatus('idle'); return; }
    st.inflight = true; setStatus('saving');
    try {
      // lotes de ~1,5 MB
      const batches = []; let curB = [], size = 0;
      for (const x of ops) { const len = JSON.stringify(x.op).length; if (curB.length && size + len > 1.5e6) { batches.push(curB); curB = []; size = 0; } curB.push(x); size += len; }
      if (curB.length) batches.push(curB);
      if (!batches.length) batches.push([]);
      const rejected = [];
      for (let i = 0; i < batches.length; i++) {
        const payload = batches[i].map((x) => x.op).concat(i === batches.length - 1 ? secrets.map((x) => ({ t: 'secret', userId: x.userId, secret: x.secret })) : []);
        const r = await rpc('tc_push', { p_token: st.token, p_ops: payload });
        for (const x of batches[i]) {
          if (x.del) st.base.delete(x.K);
          else if (x.full) st.base.set(x.K, x.cur);
          else { const b = Object.assign({}, st.base.get(x.K) || {}); for (const k of Object.keys(x.op.s)) b[k] = x.cur[k]; for (const k of x.op.u || []) delete b[k]; st.base.set(x.K, b); }
        }
        (r.rejected || []).forEach((rj) => rejected.push(rj));
      }
      st.secrets = st.secrets.filter((x) => !secrets.includes(x));
      setStatus('idle');
      if (rejected.filter((x) => x.c).length) {
        console.warn('Cambios rechazados por el servidor', rejected);
        const forced = new Set(rejected.filter((x) => x.c).map((x) => x.c + '|' + x.id));
        await pull(true, forced);
        if (G.UI && G.UI.toast) G.UI.toast('Algún cambio no se ha podido guardar (sin permiso o jornada cerrada). Se ha recargado la versión del servidor.', 'bad');
        safeRender(true);
      }
    } catch (e) {
      setStatus(e.auth ? 'error' : 'offline');
      if (e.auth) { if (G.UI) { G.UI.toast(e.message, 'bad'); G.UI.state.view = null; G.UI.render(); } }
      else setTimeout(changed, 5000);
    } finally {
      st.inflight = false;
      if (st.again) { st.again = false; changed(); }
    }
  }
  function secret(userId, value) { st.secrets.push({ userId, secret: value }); }

  /* ───── Descarga y fusión ───── */
  function indexOf(db) { const idx = {}; for (const c of ARR) { idx[c] = new Map(); (db[c] || []).forEach((o) => idx[c].set(keyOf(c, o), o)); } return idx; }
  function apply(docs, full, forced) {
    const db = S.load(); const idx = indexOf(db); let changes = 0; const seen = new Set();
    for (const doc of docs) {
      const c = doc.c, id = doc.id, K = c + '|' + id; seen.add(K);
      if (c !== 'drafts' && !idx[c]) continue;
      const local = c === 'drafts' ? db.drafts[id] : idx[c].get(id);
      const b = st.base.get(K); const force = forced && forced.has(K);
      if (doc.x) {
        if (local) { if (c === 'drafts') delete db.drafts[id]; else db[c] = db[c].filter((o) => o !== local); changes++; }
        st.base.delete(K); continue;
      }
      const sd = doc.d; const ss = snap(sd);
      if (!local) { if (c === 'drafts') db.drafts[id] = sd; else db[c].push(sd); st.base.set(K, ss); changes++; continue; }
      for (const k of Object.keys(ss)) {
        const lv = local[k] === undefined ? undefined : JSON.stringify(local[k]);
        const dirty = b ? lv !== b[k] : lv !== undefined && lv !== ss[k];
        if ((force || !dirty) && lv !== ss[k]) { local[k] = sd[k]; changes++; }
      }
      for (const k of Object.keys(local)) if (!(k in ss)) {
        const dirty = b ? !(k in b) || JSON.stringify(local[k]) !== b[k] : true;
        if (force || (b && !dirty)) { delete local[k]; changes++; }
      }
      st.base.set(K, ss);
    }
    if (full) {
      // documentos que ya no son visibles para este usuario
      for (const K of Array.from(st.base.keys())) if (!seen.has(K)) {
        const i = K.indexOf('|'); const c = K.slice(0, i), id = K.slice(i + 1);
        if (c === 'drafts') delete db.drafts[id]; else if (db[c]) db[c] = db[c].filter((o) => keyOf(c, o) !== id);
        st.base.delete(K); changes++;
      }
    }
    return changes;
  }
  async function pull(full, forced) {
    if (!st.token) return 0;
    const r = await rpc('tc_pull', { p_token: st.token, p_since: full ? 0 : st.rev });
    const db = S.load();
    const ch = apply(r.docs || [], full, forced);
    st.rev = Math.max(full ? 0 : st.rev, r.rev || 0);
    // El usuario de la sesión, siempre actualizado
    if (r.me) { const i = db.users.findIndex((u) => u.id === r.me.id); if (i < 0) db.users.push(r.me); else Object.assign(db.users[i], r.me); db.session = { userId: r.me.id, at: new Date().toISOString() }; }
    if (st.status === 'offline') setStatus('idle');
    // Si al alumno le cambian el equipo asignado, hace falta una descarga completa
    if (r.me && r.me.role === 'student') {
      const mine = db.teams.filter((t) => t.coachId === r.me.id).map((t) => t.id).sort().join(',');
      if (!full && mine !== st.myTeams) { st.myTeams = mine; return ch + (await pull(true)); }
      st.myTeams = mine;
    }
    return ch;
  }
  function busy() {
    const d = G.document; if (!d) return true;
    const a = d.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
    if (d.getElementById('modal')) return true;
    if (G.UI && G.UI.isReplaying && G.UI.isReplaying()) return true;
    return false;
  }
  function safeRender(force) { if (G.UI && G.UI.render && (force || !busy())) { const y = G.scrollY; G.UI.render(); G.scrollTo(0, y); } else st.pendingRender = true; }
  async function tick() {
    if (st.mode !== 'remote' || !st.token || st.inflight) return;
    if (G.document && G.document.visibilityState === 'hidden') return;
    try { const ch = await pull(false); if (ch || st.pendingRender) { st.pendingRender = false; safeRender(); } }
    catch (e) { if (e.auth && G.UI) { G.UI.toast(e.message, 'bad'); G.UI.state.view = null; G.UI.render(); } }
  }
  function startPolling() { stopPolling(); st.poll = setInterval(tick, (CFG.pollSeconds || 15) * 1000); }
  function stopPolling() { if (st.poll) clearInterval(st.poll); st.poll = null; }

  /* ───── Sesión ───── */
  function resetLocal() { st.base = new Map(); st.rev = 0; st.secrets = []; st.myTeams = ''; S.useBackend(api, S.emptyDb()); }
  function dropSession() { st.token = null; lsSet(TOKEN_KEY, null); stopPolling(); resetLocal(); }
  async function begin(res) {
    st.token = res.token; lsSet(TOKEN_KEY, res.token); resetLocal();
    await pull(true);
    startPolling();
    return S.currentUser();
  }
  async function status() { try { const r = await rpc('tc_status', {}); st.adminExists = !!r.adminExists; st.online = true; } catch (e) { st.online = false; } return st; }
  const api = { changed, secret };

  const TCSync = {
    get enabled() { return st.enabled; },
    get remote() { return st.enabled && st.mode === 'remote'; },
    get demo() { return st.mode === 'demo'; },
    get adminExists() { return st.adminExists; },
    get online() { return st.online; },
    get pendingSecrets() { return st.secrets.length; },
    label, flush, pull,
    // Envía ya todo lo pendiente y espera a que el servidor lo confirme
    async flushNow() { clearTimeout(st.timer); for (let i = 0; i < 4; i++) { while (st.inflight) await new Promise((r) => setTimeout(r, 80)); if (!diff().length && !st.secrets.length) return true; await flush(); if (st.status === 'offline' || st.status === 'error') return false; } return !diff().length && !st.secrets.length; },
    statusHtml() { return st.enabled && st.mode === 'remote' && st.token ? `<span id="sync-st" class="sync ${st.status}">${label()}</span>` : ''; },
    async init() {
      if (!st.enabled) return false;
      S.useBackend(api, S.emptyDb());
      const t = lsGet(TOKEN_KEY);
      const pS = status();
      if (t) { st.token = t; try { await pull(true); startPolling(); } catch (e) { if (!e.auth) { st.online = false; } } }
      await pS;
      G.addEventListener('focus', tick);
      G.document.addEventListener('visibilitychange', () => { if (G.document.visibilityState === 'hidden') flush(); else tick(); });
      G.document.addEventListener('focusout', () => setTimeout(() => { if (st.pendingRender && !busy()) { st.pendingRender = false; safeRender(); } }, 50));
      G.addEventListener('beforeunload', (e) => { if (st.inflight || diff().length) { flush(); e.preventDefault(); e.returnValue = ''; } });
      return true;
    },
    async requestAccess(name, email) { return rpc('tc_request_access', { p_name: name, p_email: email }); },
    async loginStudent(email, code) { return begin(await rpc('tc_login', { p_email: email, p_secret: code, p_kind: 'student' })); },
    async loginAdmin(email, password) { return begin(await rpc('tc_login', { p_email: email, p_secret: password, p_kind: 'teacher' })); },
    async adminSetup(name, email, password) { const r = await begin(await rpc('tc_admin_setup', { p_name: name, p_email: email, p_password: password })); st.adminExists = true; return r; },
    async logout() { const t = st.token; await flush().catch(() => {}); dropSession(); if (t) rpc('tc_logout', { p_token: t }).catch(() => {}); },
    // La demo siempre es local (este navegador) y no toca el servidor
    enterDemo() { if (st.mode === 'demo') return; flush(); stopPolling(); st.saved = { db: S.load(), token: st.token }; st.mode = 'demo'; S.useBackend(null); },
    leaveDemo() { if (st.mode !== 'demo') return; st.mode = 'remote'; const sv = st.saved || {}; S.useBackend(api, sv.db || S.emptyDb()); st.saved = null; if (st.token) startPolling(); },
    hasLocalDemo() { try { const raw = lsGet('thecoach.db.v1'); return !!(raw && JSON.parse(raw).competitions.some((c) => c.demo)); } catch (e) { return false; } },
    _st: st, _diff: diff,
  };
  G.TCSync = TCSync;
})(typeof window !== 'undefined' ? window : globalThis);
