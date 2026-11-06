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

  UI.run = function (fn) {
    try { const r = fn(); return r; } catch (e) {
      if (e && e.userFacing) UI.toast(e.message, 'bad'); else { console.error(e); UI.toast('Error inesperado: ' + (e && e.message), 'bad'); }
    }
  };

  /* ───── Navegación ───── */
  const HASHABLE = /^[a-z0-9-]+$/;
  UI.go = function (view, params) {
    UI.state.view = view; UI.state.params = params || {};
    if (HASHABLE.test(view) && location.hash !== '#' + view) { UI._fromGo = true; try { history.replaceState(null, '', '#' + view); } catch (e) { location.hash = view; } }
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
    ['Mi equipo', [['equipo', 'Mi equipo'], ['plantilla', 'Plantilla'], ['modelo', 'Modelo de juego'], ['pizarra', 'Pizarra táctica']]],
    ['Semana', [['microciclo', 'Microciclo'], ['biblioteca', 'Biblioteca de tareas'], ['rival', 'Análisis del rival'], ['plan', 'Plan de partido'], ['alineacion', 'Alineación']]],
    ['Proyecto', [['estado', 'Estado del desarrollo']]],
  ];
  const TEACHER_NAV = [
    ['Clase', [['profe', 'Panel del profesor'], ['profe-jornadas', 'Jornadas'], ['profe-entregas', 'Entregas'], ['profe-evaluar', 'Evaluaciones']]],
    ['Competición', [['clasificacion', 'Clasificación'], ['ranking', 'Ranking académico'], ['profe-jugadores', 'Jugadores'], ['profe-config', 'Configuración']]],
    ['Proyecto', [['estado', 'Estado del desarrollo']]],
  ];

  UI.render = function () {
    if (UI.stopReplay) UI.stopReplay();
    const root = UI.$('#app');
    const c = UI.ctx();
    if (!c.user) { root.innerHTML = UI.views.login(c); return; }
    let view = UI.state.view;
    if (c.user.role === 'student' && !c.team) view = 'unirse';
    const nav = c.user.role === 'teacher' ? TEACHER_NAV : COACH_NAV;
    const allowed = nav.flatMap((g) => g[1].map((x) => x[0])).concat(['jugador', 'tarea', 'informe', 'unirse', 'nueva-comp', 'profe-entrega', 'logros']);
    if (!view || !allowed.includes(view) || !UI.views[view]) view = c.user.role === 'teacher' ? 'profe' : 'inicio';
    if (c.user.role === 'teacher' && !c.comp && !['profe', 'nueva-comp', 'estado'].includes(view)) view = 'profe';
    UI.state.view = view;
    let body;
    try { body = UI.views[view](c, UI.state.params); }
    catch (e) { console.error(e); body = `<div class="card"><h2>No se pudo mostrar esta pantalla</h2><p class="muted">${esc(e.message)}</p></div>`; }
    const navHtml = view === 'unirse' ? '' : nav.map(([g, items]) => `<div class="nav-group"><div class="nav-title">${esc(g)}</div>${items.map(([k, l]) => `<a href="#${k}" data-go="${k}" class="${k === view || (k === 'plantilla' && view === 'jugador') || (k === 'microciclo' && view === 'tarea') || (k === 'partido' && view === 'informe') || (k === 'profe-entregas' && view === 'profe-entrega') ? 'on' : ''}">${esc(l)}</a>`).join('')}</div>`).join('');
    const ctxLabel = c.user.role === 'student'
      ? (c.team ? `${UI.teamBadge(c.team)} <span><b>${esc(c.team.name)}</b><small>${esc(c.comp.name)} · J${c.comp.currentRound}/${c.comp.config.rounds}</small></span>` : '')
      : (c.comp ? `<span><b>${esc(c.comp.name)}</b><small>Código ${esc(c.comp.code)} · J${c.comp.currentRound}/${c.comp.config.rounds}</small></span>` : '<span><b>Sin competición</b></span>');
    const compSwitch = c.user.role === 'teacher' && c.comps.length > 1 ? `<select class="mini" data-change="switchComp" aria-label="Competición">${c.comps.map((x) => UI.opt(x.id, x.name, c.comp && c.comp.id)).join('')}</select>` : c.user.role === 'student' && c.teams.length > 1 ? `<select class="mini" data-change="switchTeam" aria-label="Equipo">${c.teams.map((x) => UI.opt(x.id, x.name + ' · ' + S.getComp(x.compId).name, c.team.id)).join('')}</select>` : '';
    root.innerHTML = `
      <header class="topbar">
        <a class="brand" href="#inicio" data-go="${c.user.role === 'teacher' ? 'profe' : 'inicio'}"><span class="logo">TC</span><span class="brand-t"><b>THE COACH</b><small>Manager Academy</small></span></a>
        <div class="ctx">${ctxLabel}${compSwitch}</div>
        <div class="who"><span class="role ${c.user.role}">${c.user.role === 'teacher' ? 'Profesor' : 'Entrenador'}</span><span class="uname">${esc(c.user.name)}</span><button class="btn ghost sm" data-act="switchProfile">Cambiar perfil</button></div>
      </header>
      <div class="shell ${view === 'unirse' ? 'nonav' : ''}">
        ${navHtml ? `<nav class="side" aria-label="Navegación">${navHtml}</nav>` : ''}
        <main id="main" class="main view-${view}">${body}</main>
      </div>`;
    if (UI.after[view]) { try { UI.after[view](c, UI.state.params); } catch (e) { console.error(e); } }
  };
  UI.after = UI.after || {};
  UI.actions.switchComp = (el) => { UI.state.compId = el.value; UI.render(); };
  UI.actions.switchTeam = (el) => { UI.state.teamId = el.value; UI.render(); };
  UI.actions.switchProfile = () => { UI.stopReplay && UI.stopReplay(); S.logout(); UI.state.view = null; UI.render(); };

  /* ───── Acceso ───── */
  UI.views.login = function () {
    const users = S.users();
    const hasDemo = S.load().competitions.some((c) => c.demo);
    return `
    <div class="login">
      <section class="login-hero">
        <div class="brand big"><span class="logo">TC</span><span class="brand-t"><b>THE COACH</b><small>Manager Academy</small></span></div>
        <h1>Piensa como un entrenador.<br>Compite con tu clase.</h1>
        <p>Simulador educativo de gestión y competición táctica para el CFGM de Técnico Deportivo en Fútbol. Lo que trabajas durante la semana decide lo que tu equipo es capaz de hacer el día del partido.</p>
        <ol class="flow">
          <li>Modelo de juego</li><li>Microciclo</li><li>Tareas</li><li>Rival</li><li>Plan de partido</li><li>Simulación</li><li>Análisis</li>
        </ol>
        <div class="demo-box">
          <h3>Modo demostración</h3>
          <p class="muted">Liga de 8 equipos, 20 jugadores por plantilla y 7 jornadas. Tu equipo (CF Alameda) tiene la semana 1 preparada para que pruebes el flujo completo.</p>
          <div class="row wrap">
            <button class="btn primary" data-act="demoCoach">${hasDemo ? 'Entrar como entrenador demo' : 'Crear demo y entrar como entrenador'}</button>
            <button class="btn" data-act="demoTeacher">${hasDemo ? 'Entrar como profesor demo' : 'Crear demo y entrar como profesor'}</button>
            ${hasDemo ? '<button class="btn ghost" data-act="demoReset">Reiniciar la demo</button>' : ''}
          </div>
        </div>
      </section>
      <section class="login-panel">
        <div class="card">
          <h2>Crear perfil</h2>
          <form data-submit="register" class="stack">
            <label class="field"><span>Nombre</span><input id="reg-name" name="name" required minlength="2" placeholder="Nombre y apellido"></label>
            <fieldset class="roles"><legend>Rol</legend>
              <label class="role-opt"><input type="radio" name="role" value="student" checked><span><b>Alumno / entrenador</b><small>Dirige un equipo y entrega su planificación.</small></span></label>
              <label class="role-opt"><input type="radio" name="role" value="teacher"><span><b>Profesor / administrador</b><small>Crea competiciones, activa jornadas y evalúa.</small></span></label>
            </fieldset>
            <label class="field"><span>Código de clase (alumnos)</span><input id="reg-code" name="code" placeholder="Ej. 7KQ2MD" maxlength="6" style="text-transform:uppercase"></label>
            <button class="btn primary" type="submit">Entrar</button>
          </form>
        </div>
        ${users.length ? `<div class="card"><h3>Perfiles en este dispositivo</h3><div class="profiles">${users.map((u) => `<button class="profile" data-act="loginAs" data-id="${u.id}"><span class="role ${u.role}">${u.role === 'teacher' ? 'Profesor' : 'Entrenador'}</span><b>${esc(u.name)}</b></button>`).join('')}</div>
          <p class="note">Versión de prueba: los perfiles no usan contraseña y los datos se guardan en este navegador. El acceso con credenciales llegará con el servidor.</p></div>` : ''}
      </section>
    </div>`;
  };
  UI.actions.register = (f) => {
    const d = UI.formData(f);
    S.register(d.name, d.role);
    if (d.role === 'student' && d.code) { try { S.joinWithCode(d.code); } catch (e) { UI.toast(e.message, 'bad'); } }
    UI.state.view = null; UI.render();
  };
  UI.actions.loginAs = (el) => { S.loginAs(el.dataset.id); UI.state.view = null; UI.state.teamId = null; UI.state.compId = null; UI.render(); };
  function ensureDemo() { let comp = S.load().competitions.find((c) => c.demo); if (!comp) comp = G.TCDemo.createDemo().comp; return comp; }
  UI.actions.demoCoach = () => { ensureDemo(); const u = S.users().find((x) => x.demo === 'coach'); S.loginAs(u.id); UI.state.teamId = null; UI.go('inicio'); };
  UI.actions.demoTeacher = () => { const comp = ensureDemo(); const u = S.users().find((x) => x.demo === 'teacher'); S.loginAs(u.id); UI.state.compId = comp.id; UI.go('profe'); };
  UI.actions.demoReset = () => UI.ask('Reiniciar la demo', 'Se borran todos los datos de la liga demo (resultados, entregas y evaluaciones) y se vuelve a crear desde cero.', 'Reiniciar demo', () => { G.TCDemo.createDemo(); UI.toast('Demo reiniciada.'); UI.render(); }, true);

  UI.views.unirse = function (c) {
    return `<div class="narrow"><div class="card"><h2>Únete a tu competición</h2><p class="muted">Pide a tu profesor el código de clase de 6 caracteres.</p>
      <form data-submit="join" class="stack"><label class="field"><span>Código</span><input id="join-code" name="code" maxlength="6" required style="text-transform:uppercase" placeholder="7KQ2MD" data-input="joinPreview"></label>
      <div id="join-teams"></div>
      <button class="btn primary" type="submit">Unirme</button></form></div>
      <p class="note">¿Quieres probar sin código? <a href="#" data-act="demoCoach">Entra en la demo como entrenador</a>.</p></div>`;
  };
  UI.actions.joinPreview = (el) => {
    const r = S.freeTeams(el.value); const box = UI.$('#join-teams');
    if (!r) { box.innerHTML = ''; return; }
    box.innerHTML = `<p><b>${esc(r.comp.name)}</b>: ${r.teams.length} equipos libres.</p>` + (r.teams.length ? `<label class="field"><span>Equipo</span><select name="teamId">${r.teams.map((t) => UI.opt(t.id, t.name)).join('')}</select></label>` : '');
  };
  UI.actions.join = (f) => { const d = UI.formData(f); const t = S.joinWithCode(d.code, d.teamId); UI.state.teamId = t.id; UI.toast(`Ya diriges ${t.name}.`); UI.go('equipo'); };

  /* ───── Estado del desarrollo ───── */
  UI.views.estado = function () {
    const rows = [
      ['Fase 1', 'Registro de profesor y alumnos, selección de rol, acceso por código', 'hecho', 'Perfiles locales sin contraseña.'],
      ['Fase 1', 'Creación de liga, calendario automático (ida o ida y vuelta) y generación automática', 'hecho', ''],
      ['Fase 1', 'Asignación de equipos y plantillas equilibradas de 20 jugadores', 'hecho', 'Mismo potencial medio, perfiles distintos.'],
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
      ['Infra', 'Servidor y base de datos compartida (multiusuario real, permisos en servidor)', 'pendiente', 'Hoy los datos viven en este navegador. La capa de datos está aislada para migrarla.'],
      ['Infra', 'Interfaz en catalán', 'pendiente', 'Textos centralizables.'],
    ];
    const cls = { hecho: 'ok', básico: 'info', pendiente: 'pending' };
    return `<div class="page-head"><h1>Estado del desarrollo</h1><p class="muted">Qué funciona de verdad en esta versión y qué falta. Nada de lo marcado como pendiente se muestra con datos inventados.</p></div>
    <div class="card"><div class="tablewrap"><table class="table"><thead><tr><th>Fase</th><th>Funcionalidad</th><th>Estado</th><th>Notas</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td>${UI.pill(r[2], cls[r[2]])}</td><td class="muted">${esc(r[3])}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  };

  UI.start = function () {
    const v = location.hash.slice(1);
    UI.state.view = v || null;
    UI.render();
  };
})(window);
