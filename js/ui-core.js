/* THE COACH — Núcleo de interfaz: utilidades, navegación, acceso y estructura. */
(function (G) {
  'use strict';
  const TC = G.TC, S = G.TCStore;
  const UI = (G.UI = G.UI || {});
  UI.views = UI.views || {};
  UI.actions = UI.actions || {};

  const esc = (UI.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  UI.$ = (s, r) => (r || document).querySelector(s);
  UI.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  UI.state = { view: null, params: {}, teamId: null, compId: null };
  UI.fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  UI.opt = (val, label, cur) => `<option value="${esc(val)}" ${String(val) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
  UI.opts = (list, cur) => list.map((x) => (Array.isArray(x) ? UI.opt(x[0], x[1], cur) : UI.opt(x, x, cur))).join('');
  UI.pill = (txt, kind) => `<span class="pill ${kind || ''}">${esc(txt)}</span>`;
  UI.soon = (phase, txt) => `<div class="soon"><span class="pill pending">Pendiente · Fase ${phase}</span><span>${esc(txt)}</span></div>`;
  UI.bar = (v, max, cls) => `<span class="bar ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, (v / (max || 100)) * 100))}%"></i></span>`;
  UI.attrClass = (v) => (v >= 75 ? 'hi' : v >= 60 ? 'mid' : v >= 45 ? 'lo' : 'vlo');
  UI.teamBadge = (t, size) => t ? `<span class="crest" style="--c:${esc(t.color)};${size ? `--s:${size}px` : ''}">${esc(t.short)}</span>` : '';

  /* ───── Toasts y diálogos dentro de la página ───── */
  UI.toast = function (msg, kind) {
    const box = UI.$('#toasts'); if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'ok');
    el.innerHTML = esc(msg).replace(/\n/g, '<br>');
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), kind === 'bad' ? 7000 : 3200);
    setTimeout(() => el.remove(), kind === 'bad' ? 7600 : 3800);
  };
  UI.modal = function (html, opts) {
    UI.closeModal();
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap'; wrap.id = 'modal';
    wrap.innerHTML = `<div class="modal ${opts && opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><button class="x" data-act="closeModal" aria-label="Cerrar">×</button>${html}</div>`;
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) UI.closeModal(); });
    document.body.appendChild(wrap);
    const f = wrap.querySelector('input,select,textarea,button.primary'); if (f) f.focus();
  };
  UI.closeModal = () => { const m = UI.$('#modal'); if (m) m.remove(); };
  UI.ask = function (title, text, okLabel, fn, danger) {
    UI._askFn = fn;
    UI.modal(`<h3>${esc(title)}</h3><p class="muted">${esc(text)}</p><div class="row end"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="askOk">${esc(okLabel)}</button></div>`);
  };
  UI.actions.askOk = () => { const fn = UI._askFn; UI.closeModal(); if (fn) UI.run(fn); };
  UI.actions.closeModal = () => UI.closeModal();

  const showErr = (e) => { if (e && e.userFacing) UI.toast(e.message, 'bad'); else { console.error(e); UI.toast('Error inesperado: ' + (e && e.message), 'bad'); } };
  UI.run = function (fn) {
    try { const r = fn(); if (r && typeof r.then === 'function') r.catch(showErr); return r; } catch (e) { showErr(e); }
  };
  // Acciones que esperan al servidor: bloquea el botón mientras tanto
  UI.busy = async function (el, fn) {
    const btn = el && (el.tagName === 'FORM' ? el.querySelector('button[type=submit],button:not([type])') : el);
    const txt = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Conectando…'; }
    try { return await fn(); } finally { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = txt; } }
  };
  const Y = () => G.TCSync && G.TCSync.remote;

  /* ───── Navegación ───── */
  const HASHABLE = /^[a-z0-9-]+$/;
  UI.go = function (view, params) {
    UI.state.view = view; UI.state.params = params || {};
    if (HASHABLE.test(view) && location.hash !== '#' + view) { try { history.replaceState(null, '', '#' + view); } catch (e) { UI._fromGo = true; location.hash = view; } }
    UI.render();
    const main = UI.$('#main'); if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', () => {
    if (UI._fromGo) { UI._fromGo = false; return; }
    const v = location.hash.slice(1); if (v && UI.views[v]) { UI.state.view = v; UI.state.params = {}; UI.render(); }
  });

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); let p = {}; try { p = g.dataset.p ? JSON.parse(g.dataset.p) : {}; } catch (x) { p = {}; } UI.go(g.dataset.go, p); return; }
    const a = e.target.closest('[data-act]');
    if (a && UI.actions[a.dataset.act]) { e.preventDefault(); UI.run(() => UI.actions[a.dataset.act](a, e)); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target; e.preventDefault();
    if (f.dataset.submit && UI.actions[f.dataset.submit]) UI.run(() => UI.actions[f.dataset.submit](f, e));
  });
  document.addEventListener('change', (e) => {
    const a = e.target.closest('[data-change]');
    if (a && UI.actions[a.dataset.change]) UI.run(() => UI.actions[a.dataset.change](a, e));
  });
  document.addEventListener('input', (e) => {
    const a = e.target.closest('[data-input]');
    if (a && UI.actions[a.dataset.input]) UI.run(() => UI.actions[a.dataset.input](a, e));
  });
  UI.formData = (f) => { const o = {}; new FormData(f).forEach((v, k) => { if (o[k] !== undefined) { o[k] = [].concat(o[k], v); } else o[k] = v; }); return o; };

  /* ───── Contexto ───── */
  UI.ctx = function () {
    const user = S.currentUser();
    if (!user) return { user: null };
    if (user.role === 'student') {
      const teams = S.myTeams(user);
      let team = teams.find((t) => t.id === UI.state.teamId) || teams[0] || null;
      UI.state.teamId = team && team.id;
      const comp = team ? S.getComp(team.compId) : null;
      return { user, teams, team, comp };
    }
    const comps = S.myCompetitions(user);
    let comp = comps.find((c) => c.id === UI.state.compId) || comps[comps.length - 1] || null;
    UI.state.compId = comp && comp.id;
    return { user, comps, comp };
  };

  const COACH_NAV = [
    ['Competición', [['inicio', 'Inicio'], ['partido', 'Centro de partido'], ['clasificacion', 'Clasificación'], ['ranking', 'Ranking de entrenadores'], ['historial', 'Historial']]],
    ['Mi equipo', [['presentacion', 'Presentación de plantilla'], ['club', 'Historia del club'], ['equipo', 'Mi equipo'], ['plantilla', 'Plantilla'], ['modelo', 'Modelo de juego'], ['pizarra', 'Pizarra táctica']]],
    ['Semana', [['microciclo', 'Microciclo'], ['biblioteca', 'Biblioteca de tareas'], ['rival', 'Análisis del rival'], ['plan', 'Plan de partido'], ['alineacion', 'Alineación']]],
    ['Proyecto', [['estado', 'Estado del desarrollo']]],
  ];
  const TEACHER_NAV = [
    ['Clase', [['profe', 'Panel del profesor'], ['profe-alumnos', 'Alumnos y accesos'], ['profe-jornadas', 'Jornadas'], ['profe-entregas', 'Entregas'], ['profe-evaluar', 'Evaluaciones']]],
    ['Competición', [['clasificacion', 'Clasificación'], ['ranking', 'Ranking académico'], ['profe-jugadores', 'Jugadores'], ['profe-config', 'Configuración']]],
    ['Proyecto', [['estado', 'Estado del desarrollo']]],
  ];

  UI.render = function () {
    if (UI.stopReplay) UI.stopReplay();
    const root = UI.$('#app');
    const c = UI.ctx();
    if (!c.user) { root.innerHTML = UI.views.login(c); return; }
    let view = UI.state.view;
    const nav = c.user.role === 'teacher' ? TEACHER_NAV : COACH_NAV;
    if (c.user.role === 'student' && !c.team) view = 'espera';
    // Orden obligatorio: primero conocer la plantilla, después presentar el modelo de juego
    const GATED = ['microciclo', 'biblioteca', 'rival', 'plan', 'alineacion', 'tarea', 'partido'];
    let locked = [];
    if (c.user.role === 'student' && c.team && !c.user.noGates) {
      const req = view;
      if (!c.team.squadSeenAt) { locked = nav.flatMap((g) => g[1].map((x) => x[0])).filter((k) => !['presentacion', 'estado', 'plantilla', 'club'].includes(k)); if (!['estado', 'plantilla', 'jugador', 'club'].includes(view)) view = 'presentacion'; }
      else if (!c.team.model.submittedAt) { locked = GATED; if (GATED.includes(view)) { UI.state.gated = view; view = 'modelo'; } }
      // Explica por qué no se abre la pantalla pedida
      if (req && req !== view && UI.views[req] && UI._lastGateMsg !== req + view) {
        UI._lastGateMsg = req + view;
        setTimeout(() => UI.toast(view === 'presentacion' ? 'Primero revisa tu plantilla y pulsa «He revisado la plantilla». Así se desbloquea el modelo de juego.' : 'Presenta tu modelo de juego para desbloquear la planificación de la semana.', 'bad'), 0);
      }
    }
    const allowed = nav.flatMap((g) => g[1].map((x) => x[0])).concat(['jugador', 'tarea', 'informe', 'espera', 'nueva-comp', 'profe-entrega', 'profe-alumno', 'logros']);
    if (!view || !allowed.includes(view) || !UI.views[view]) view = c.user.role === 'teacher' ? 'profe' : 'inicio';
    if (c.user.role === 'teacher' && !c.comp && !['profe', 'nueva-comp', 'estado', 'profe-alumnos', 'profe-alumno'].includes(view)) view = 'profe';
    UI.state.view = view;
    let body;
    try { body = UI.views[view](c, UI.state.params); }
    catch (e) { console.error(e); body = `<div class="card"><h2>No se pudo mostrar esta pantalla</h2><p class="muted">${esc(e.message)}</p></div>`; }
    const navHtml = view === 'espera' ? '' : nav.map(([g, items]) => `<div class="nav-group"><div class="nav-title">${esc(g)}</div>${items.map(([k, l]) => `<a href="#${k}" data-go="${k}" class="${locked.includes(k) ? 'locked ' : ''}${k === view || (k === 'plantilla' && view === 'jugador') || (k === 'microciclo' && view === 'tarea') || (k === 'partido' && view === 'informe') || (k === 'profe-entregas' && view === 'profe-entrega') ? 'on' : ''}">${esc(l)}${locked.includes(k) ? ' <span aria-label="bloqueado">🔒</span>' : ''}</a>`).join('')}</div>`).join('');
    const ctxLabel = c.user.role === 'student'
      ? (c.team ? `${UI.teamBadge(c.team)} <span><b>${esc(c.team.name)}</b><small>${esc(c.comp.name)} · J${c.comp.currentRound}/${c.comp.config.rounds}</small></span>` : '')
      : (c.comp ? `<span><b>${esc(c.comp.name)}</b><small>Código ${esc(c.comp.code)} · J${c.comp.currentRound}/${c.comp.config.rounds}</small></span>` : '<span><b>Sin competición</b></span>');
    const compSwitch = c.user.role === 'teacher' && c.comps.length > 1 ? `<select class="mini" data-change="switchComp" aria-label="Competición">${c.comps.map((x) => UI.opt(x.id, x.name, c.comp && c.comp.id)).join('')}</select>` : c.user.role === 'student' && c.teams.length > 1 ? `<select class="mini" data-change="switchTeam" aria-label="Equipo">${c.teams.map((x) => UI.opt(x.id, x.name + ' · ' + S.getComp(x.compId).name, c.team.id)).join('')}</select>` : '';
    root.innerHTML = `
      <header class="topbar">
        <a class="brand" href="#inicio" data-go="${c.user.role === 'teacher' ? 'profe' : 'inicio'}">${G.TCArt.brand()}</a>
        <div class="ctx">${ctxLabel}${compSwitch}</div>
        <div class="who">${G.TCSync ? G.TCSync.statusHtml() : ''}<span class="role ${c.user.superadmin ? 'admin' : c.user.role}">${c.user.superadmin ? 'Superadmin' : c.user.role === 'teacher' ? 'Profesor' : 'Entrenador'}</span><span class="uname">${esc(c.user.name)}</span><button class="btn ghost sm" data-act="switchProfile">Salir</button></div>
      </header>
      <div class="shell ${view === 'espera' ? 'nonav' : ''}">
        ${navHtml ? `<nav class="side" aria-label="Navegación">${navHtml}</nav>` : ''}
        <main id="main" class="main view-${view}">${body}</main>
      </div>`;
    if (UI.after[view]) { try { UI.after[view](c, UI.state.params); } catch (e) { console.error(e); } }
  };
  UI.after = UI.after || {};
  UI.actions.switchComp = (el) => { UI.state.compId = el.value; UI.render(); };
  UI.actions.switchTeam = (el) => { UI.state.teamId = el.value; UI.render(); };
  UI.actions.switchProfile = async () => {
    UI.stopReplay && UI.stopReplay();
    if (G.TCSync && G.TCSync.demo) { S.logout(); G.TCSync.leaveDemo(); }
    else if (Y()) await G.TCSync.logout();
    else S.logout();
    UI.state.view = null; UI.state.teamId = null; UI.state.compId = null; UI.render();
  };

  /* ───── Acceso ───── */
  UI.views.login = function () {
    const remote = Y();
    const hasDemo = remote ? G.TCSync.hasLocalDemo() : S.load().competitions.some((c) => c.demo);
    const tab = UI.state.loginTab || 'alumno';
    const adminExists = remote ? G.TCSync.adminExists !== false : S.adminExists();
    const tabs = [['alumno', 'Solicitar acceso'], ['codigo', 'Tengo mi código'], ['admin', 'Administrador']];
    let form = '';
    if (tab === 'alumno') form = UI.state.requested
      ? `<div class="notice ok"><b>Solicitud enviada.</b><br>Tu profesor revisará tu solicitud y te pasará un código personal (formato ABCD-EFGH). Cuando lo tengas, entra en «Tengo mi código» con tu email.</div><button class="btn ghost" data-act="loginTab" data-t="codigo">Ya tengo el código</button>`
      : `<p class="muted small">Regístrate con tu nombre y tu email. No podrás entrar hasta que tu profesor apruebe la solicitud y te pase tu código.</p>
        <form data-submit="requestAccess" class="stack"><label class="field"><span>Nombre y apellidos</span><input id="ra-name" name="name" required minlength="3" autocomplete="name"></label>
        <label class="field"><span>Email</span><input id="ra-email" name="email" type="email" required autocomplete="email"></label>
        <button class="btn primary" type="submit">Enviar solicitud</button></form>`;
    if (tab === 'codigo') form = `<p class="muted small">Entra con el email con el que te registraste y el código que te ha dado tu profesor.</p>
        <form data-submit="loginCode" class="stack"><label class="field"><span>Email</span><input id="lc-email" name="email" type="email" required autocomplete="email"></label>
        <label class="field"><span>Código de acceso</span><input id="lc-code" name="code" required placeholder="ABCD-EFGH" maxlength="9" style="text-transform:uppercase;letter-spacing:.15em" autocomplete="one-time-code"></label>
        <button class="btn primary" type="submit">Entrar</button></form>`;
    if (tab === 'admin') form = adminExists
      ? `<form data-submit="adminLogin" class="stack"><label class="field"><span>Email</span><input id="al-email" name="email" type="email" required></label><label class="field"><span>Contraseña</span><input id="al-pass" name="password" type="password" required></label><button class="btn primary" type="submit">Entrar como administrador</button></form>`
      : `<p class="muted small">Primera vez: crea la cuenta de superadministrador. Verá todas las competiciones, equipos, entregas y alumnos, y es quien aprueba los accesos.</p>
        <form data-submit="adminSetup" class="stack"><label class="field"><span>Nombre</span><input id="as-name" name="name" required></label><label class="field"><span>Email</span><input id="as-email" name="email" type="email" required></label><label class="field"><span>Contraseña (mín. 8)</span><input id="as-pass" name="password" type="password" minlength="8" required></label><button class="btn primary" type="submit">Crear superadministrador</button></form>`;
    return `
    <div class="login">
      <section class="login-hero">
        <div class="brand big">${G.TCArt.brand(true)}</div>
        <h1>Piensa como un entrenador.<br>Compite con tu clase.</h1>
        <p>Simulador educativo de gestión y competición táctica para el CFGM de Técnico Deportivo en Fútbol. Lo que trabajas durante la semana decide lo que tu equipo es capaz de hacer el día del partido.</p>
        <ol class="flow"><li>Conoce tu plantilla</li><li>Modelo de juego</li><li>Microciclo</li><li>Tareas</li><li>Rival</li><li>Plan de partido</li><li>Simulación</li><li>Análisis</li></ol>
        <div class="demo-box">
          <h3>Modo demostración</h3>
          <p class="muted">Liga de 8 equipos con 18 jugadores y 7 jornadas. Hay dos solicitudes de alumnos de ejemplo para probar la aprobación.</p>
          <div class="row wrap">
            <button class="btn primary" data-act="demoCoach">${hasDemo ? 'Entrar como entrenador demo' : 'Crear demo y entrar como entrenador'}</button>
            <button class="btn" data-act="demoTeacher">${hasDemo ? 'Entrar como superadmin demo' : 'Crear demo y entrar como superadmin'}</button>
            ${hasDemo ? '<button class="btn ghost" data-act="demoReset">Reiniciar la demo</button>' : ''}
          </div>
        </div>
      </section>
      <section class="login-panel">
        <div class="card">
          <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="tab ${k === tab ? 'on' : ''}" data-act="loginTab" data-t="${k}">${l}</button>`).join('')}</div>
          ${form}
        </div>
        ${remote ? (G.TCSync.online === false ? '<p class="note bad">No se puede conectar con el servidor ahora mismo. Revisa la conexión y recarga la página. La demo sí funciona sin conexión.</p>' : '<p class="note">Servidor compartido: cada alumno entra desde su propio dispositivo y el profesor ve el trabajo de toda la clase. La demo es local y no se mezcla con la clase.</p>')
          : '<p class="note">Versión local: los datos se guardan en este navegador. Con el servidor compartido, cada alumno se registra desde su propio dispositivo.</p>'}
      </section>
    </div>`;
  };
  UI.actions.loginTab = (el) => { UI.state.loginTab = el.dataset.t; UI.state.requested = false; UI.render(); };
  UI.actions.requestAccess = (f) => { const d = UI.formData(f); if (Y()) return UI.busy(f, async () => { await G.TCSync.requestAccess(d.name, d.email); UI.state.requested = true; UI.render(); }); S.requestAccess(d.name, d.email); UI.state.requested = true; UI.render(); };
  UI.actions.loginCode = (f) => { const d = UI.formData(f); const done = () => { UI.state.view = null; UI.state.teamId = null; UI.render(); }; if (Y()) return UI.busy(f, async () => { await G.TCSync.loginStudent(d.email, d.code); done(); }); S.loginWithCode(d.email, d.code); done(); };
  UI.actions.adminLogin = (f) => { const d = UI.formData(f); const done = () => { UI.state.view = 'profe'; UI.state.compId = null; UI.render(); }; if (Y()) return UI.busy(f, async () => { await G.TCSync.loginAdmin(d.email, d.password); done(); }); S.adminLogin(d.email, d.password); done(); };
  UI.actions.adminSetup = (f) => { const d = UI.formData(f); const done = () => { UI.toast('Superadministrador creado.'); UI.state.view = 'profe'; UI.render(); }; if (Y()) return UI.busy(f, async () => { await G.TCSync.adminSetup(d.name, d.email, d.password); done(); }); S.adminSetup(d.name, d.email, d.password); done(); };
  const toDemo = () => { if (G.TCSync && G.TCSync.remote) G.TCSync.enterDemo(); };
  UI.actions.loginAs = (el) => { S.loginAs(el.dataset.id); UI.state.view = null; UI.state.teamId = null; UI.state.compId = null; UI.render(); };
  function ensureDemo() { toDemo(); let comp = S.load().competitions.find((c) => c.demo); if (!comp) comp = G.TCDemo.createDemo().comp; return comp; }
  UI.actions.demoCoach = () => { ensureDemo(); const u = S.users().find((x) => x.demo === 'coach'); S.loginAs(u.id); UI.state.teamId = null; UI.go('inicio'); };
  UI.actions.demoTeacher = () => { const comp = ensureDemo(); const u = S.users().find((x) => x.demo === 'teacher'); S.loginAs(u.id); UI.state.compId = comp.id; UI.go('profe'); };
  UI.actions.demoReset = () => UI.ask('Reiniciar la demo', 'Se borran todos los datos de la liga demo (resultados, entregas y evaluaciones) y se vuelve a crear desde cero.', 'Reiniciar demo', () => { const wasRemote = Y(); toDemo(); G.TCDemo.createDemo(); S.logout(); if (wasRemote) G.TCSync.leaveDemo(); UI.toast('Demo reiniciada.'); UI.render(); }, true);

  UI.views.espera = function (c) {
    return `<div class="narrow"><div class="card"><h2>Tu cuenta está activa</h2><p class="muted">Todavía no tienes un equipo asignado. Tu profesor te lo asignará desde el panel de alumnos.</p><button class="btn ghost" data-act="switchProfile">Salir</button></div></div>`;
  };

  /* ───── Estado del desarrollo ───── */
  UI.views.estado = function () {
    const rows = [
      ['Fase 1', 'Registro del alumno con nombre y email, aprobación y código personal', 'hecho', 'El código se guarda cifrado en el servidor.'],
      ['Fase 1', 'Creación de liga, calendario automático (ida o ida y vuelta) y generación automática', 'hecho', ''],
      ['Fase 1', 'Asignación de equipos y plantillas equilibradas de 18 jugadores', 'hecho', 'Mismo potencial medio, perfiles distintos.'],
      ['Fase 1', 'Modelo de juego por fases y momentos con justificación', 'hecho', ''],
      ['Fase 1', 'Pizarra táctica interactiva (con y sin balón, movimientos, pases, zonas)', 'hecho', ''],
      ['Fase 1', 'Planificador semanal (microciclo) con cargas y evaluación de coherencia', 'hecho', ''],
      ['Fase 1', 'Constructor de tareas, biblioteca reutilizable y evaluación metodológica explicada', 'hecho', 'Evaluación por reglas, sin IA externa.'],
      ['Fase 1', 'Aprendizaje del equipo: 12 indicadores que cambian con el entrenamiento', 'hecho', 'Rendimientos decrecientes y techo semanal.'],
      ['Fase 1', 'Plan de partido A–H con instrucciones condicionales (modo asíncrono)', 'hecho', ''],
      ['Fase 1', 'Alineación y convocatoria', 'hecho', ''],
      ['Fase 1', 'Entregas versionadas y bloqueadas por jornada', 'hecho', ''],
      ['Fase 1', 'Simulador por secuencias, reproducible con semilla', 'hecho', 'Botón «Verificar reproducibilidad» en cada informe.'],
      ['Fase 1', 'Resultados, clasificación deportiva y ranking académico separados', 'hecho', ''],
      ['Fase 2', 'Informe de scouting (hechos observados vs hipótesis)', 'básico', 'Se deriva de partidos reales simulados.'],
      ['Fase 2', 'Rúbrica de 100 puntos con propuesta automática y revisión docente', 'básico', 'El profesor tiene la última palabra.'],
      ['Fase 2', 'Tutor metodológico', 'básico', 'Preguntas generadas por reglas. Falta el asistente con IA.'],
      ['Fase 2', 'Feedback docente detallado y evolución del aprendizaje por alumno', 'pendiente', ''],
      ['Fase 3', 'Visor 2D del partido sincronizado con los eventos', 'básico', 'Visualización simplificada por secuencias.'],
      ['Fase 3', 'Intervenciones en directo durante pausas tácticas', 'pendiente', 'Hoy: instrucciones condicionales previas.'],
      ['Fase 3', 'Sustituciones', 'básico', 'Programadas como instrucción condicional.'],
      ['Fase 3', 'Eventos especiales (lesión, lluvia, expulsión, calendario exigente…)', 'pendiente', ''],
      ['Fase 3', 'Estadísticas avanzadas y análisis contextual', 'pendiente', ''],
      ['Fase 4', 'Niveles de entrenador', 'básico', 'Calculado a partir de la nota académica media.'],
      ['Fase 4', 'Logros, historial de temporadas, palmarés y retos docentes', 'pendiente', ''],
      ['Fase 4', 'Personalización de equipos', 'básico', 'Nombre, siglas y color.'],
      ['Infra', 'Servidor y base de datos compartida (multiusuario real, permisos en servidor)', 'hecho', 'Supabase. Cada alumno sólo ve y modifica lo suyo; las entregas quedan bloqueadas en el servidor.'],
      ['Infra', 'Interfaz en catalán', 'pendiente', 'Textos centralizables.'],
    ];
    const cls = { hecho: 'ok', básico: 'info', pendiente: 'pending' };
    return `<div class="page-head"><h1>Estado del desarrollo</h1><p class="muted">Qué funciona de verdad en esta versión y qué falta. Nada de lo marcado como pendiente se muestra con datos inventados.</p></div>
    <div class="card"><div class="tablewrap"><table class="table"><thead><tr><th>Fase</th><th>Funcionalidad</th><th>Estado</th><th>Notas</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td>${UI.pill(r[2], cls[r[2]])}</td><td class="muted">${esc(r[3])}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  };

  UI.start = async function () {
    const v = location.hash.slice(1);
    UI.state.view = v || null;
    if (G.TCSync && G.TCSync.enabled) {
      const root = UI.$('#app'); if (root) root.innerHTML = '<div class="boot">' + G.TCArt.logo(64) + '<p class="muted">Conectando con el servidor…</p></div>';
      try { await G.TCSync.init(); } catch (e) { console.error(e); }
    }
    UI.render();
  };
})(window);
