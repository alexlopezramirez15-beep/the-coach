/* THE COACH — Incorporación del alumno: presentación de plantilla, informe descargable,
 * modelo de juego validado contra la plantilla (espacios de fase) y gestión de accesos del superadministrador. */
(function (G) {
  'use strict';
  const TC = G.TC, S = G.TCStore, UI = G.UI, esc = UI.esc;
  const V = UI.views, A = UI.actions;
  const LINES = [['gk', 'Porteros'], ['def', 'Defensas'], ['mid', 'Centrocampistas'], ['att', 'Delanteros']];
  const GROUP_SHORT = { tecnicos: 'Téc', tacticos: 'Tác', fisicos: 'Fís', psicologicos: 'Psi' };
  const VERDICT = { coherente: ['Coherente con tu plantilla', 'ok'], riesgo: ['Con riesgo', 'warn'], incoherente: ['Poco coherente con tu plantilla', 'bad'] };
  const gAvg = (p, g) => Math.round(TC.avg(TC.ATTR_GROUPS[g].attrs.map((a) => p.attrs[a[0]])));
  const byLine = (players) => LINES.map(([k, l]) => [l, players.filter((p) => TC.POSITIONS[p.pos].line === k).sort((a, b) => Object.keys(TC.POSITIONS).indexOf(a.pos) - Object.keys(TC.POSITIONS).indexOf(b.pos) || TC.playerRating(b) - TC.playerRating(a))]);

  function spacesPanel(team) {
    const sp = TC.squadSpaces(team.players);
    return `<div class="grid g3 spaces">${Object.entries(TC.PHASE_SPACES).map(([k, d]) => `<section class="card space"><div class="card-head"><h3>${d.label}</h3><span class="score">${sp[k].value}</span></div><p class="small muted">${esc(d.desc)}</p>
      <div class="lines3">${[['def', 'Defensa'], ['mid', 'Medio'], ['att', 'Ataque']].map(([l, n]) => `<div><small>${n}</small><b class="${UI.attrClass(sp[k].byLine[l])}">${sp[k].byLine[l]}</b></div>`).join('')}</div>
      <p class="small">Destacan: ${sp[k].best.map(esc).join(', ')}</p></section>`).join('')}</div>`;
  }

  /* ───── Presentación de la plantilla ───── */
  V.presentacion = function (c) {
    const t = c.team; const first = !t.squadSeenAt;
    return `<div class="page-head"><div class="eyebrow">${first ? 'Paso 1 de 2 antes de competir' : 'Tu plantilla'}</div><h1>Presentación de la plantilla</h1>
      <p class="muted">${esc(t.name)} · 18 jugadores. Estúdialos antes de diseñar tu modelo de juego: el modelo se validará contra lo que estos jugadores saben hacer.</p></div>
    <div class="row wrap"><button class="btn" data-act="downloadReport">Descargar informe de la plantilla</button>${first ? '<button class="btn primary" data-act="squadSeen">He revisado la plantilla: diseñar mi modelo de juego</button>' : '<button class="btn ghost" data-go="modelo">Ir al modelo de juego</button>'}</div>
    <h2 class="sec">Perfil de la plantilla por espacios de fase</h2>
    <p class="small muted">Media del once inicial en las capacidades que exige cada espacio de fase (marco de Método Pro). Los porteros no se incluyen.</p>
    ${spacesPanel(t)}
    ${byLine(t.players).map(([l, ps]) => `<h2 class="sec">${l} <small class="muted">${ps.length}</small></h2><div class="grid g3">${ps.map((p) => { const sw = TC.strengthsWeaknesses(p); const r = TC.playerRating(p); return `<article class="card pl" data-go="jugador" data-p='{"id":"${p.id}"}' tabindex="0">
      <div class="pl-head"><span class="pl-r ${UI.attrClass(r)}">${r}</span><div><b>${esc(p.name)}</b><small>${esc(TC.POSITIONS[p.pos].label)}${p.sec.length ? ' · también ' + p.sec.join(', ') : ''}</small></div><span class="pos ${TC.POSITIONS[p.pos].line}">${p.pos}</span></div>
      <p class="small muted">${esc(p.profile)} · ${p.age} años · ${p.height} cm · pierna ${p.foot.toLowerCase()}</p>
      <div class="g4mini">${Object.keys(TC.ATTR_GROUPS).map((g) => `<div><small>${GROUP_SHORT[g]}</small><b class="${UI.attrClass(gAvg(p, g))}">${gAvg(p, g)}</b></div>`).join('')}</div>
      <div class="small"><span class="up">▲</span> ${sw.top.slice(0, 2).map(esc).join(', ')}<br><span class="down">▼</span> ${sw.low.slice(0, 2).map(esc).join(', ')}</div></article>`; }).join('')}</div>`).join('')}`;
  };
  A.squadSeen = () => { const c = UI.ctx(); S.markSquadSeen(c.team.id); UI.toast('Ahora diseña tu modelo de juego a partir de estos jugadores.'); UI.go('modelo'); };

  function reportHtml(team, comp) {
    const sp = TC.squadSpaces(team.players);
    const groups = Object.values(TC.ATTR_GROUPS);
    const cls = (v) => (v >= 75 ? 'hi' : v >= 60 ? 'md' : v >= 45 ? 'lo' : 'vl');
    const rows = byLine(team.players).map(([l, ps]) => `<h2>${l}</h2>` + ps.map((p) => { const sw = TC.strengthsWeaknesses(p); return `<section class="p"><header><b>${esc(p.name)}</b> <span>${p.pos} · ${esc(TC.POSITIONS[p.pos].label)}${p.sec.length ? ' (sec. ' + p.sec.join(', ') + ')' : ''}</span><span>${esc(p.profile)}</span><span>${p.age} años · ${p.height} cm · pierna ${p.foot.toLowerCase()}</span><span class="r">Val. ${TC.playerRating(p)}</span></header>
      <div class="gs">${groups.map((g) => `<table><caption>${g.label} · ${Math.round(TC.avg(g.attrs.map((a) => p.attrs[a[0]])))}</caption>${g.attrs.map(([a, lab]) => `<tr><td>${esc(lab)}</td><td class="${cls(p.attrs[a])}">${p.attrs[a]}</td></tr>`).join('')}</table>`).join('')}</div>
      <p><b>Fortalezas:</b> ${sw.top.map(esc).join(', ')} · <b>Debilidades:</b> ${sw.low.map(esc).join(', ')} · <b>Espacios de fase:</b> Intervención ${Math.round(TC.spaceValue(p, 'intervencion'))}, Ayuda mutua ${Math.round(TC.spaceValue(p, 'ayuda'))}, Cooperación ${Math.round(TC.spaceValue(p, 'cooperacion'))}</p></section>`; }).join('')).join('');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Plantilla ${esc(team.name)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px}h1{margin:0 0 4px;font-size:22px}h2{border-bottom:2px solid #1f8f52;margin:22px 0 8px;font-size:16px;text-transform:uppercase}
.sub{color:#555;margin-bottom:12px}.sp{display:flex;gap:10px;margin:10px 0}.sp div{border:1px solid #ccc;border-radius:6px;padding:8px;flex:1}.sp b{font-size:18px}
.p{border:1px solid #ddd;border-radius:6px;padding:8px 10px;margin:8px 0;page-break-inside:avoid}.p header{display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;margin-bottom:6px}.p header b{font-size:14px}.p header span{color:#444}.p .r{margin-left:auto;font-weight:bold;color:#111}
.gs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}table{border-collapse:collapse;width:100%}caption{text-align:left;font-weight:bold;padding:2px 0}td{border-bottom:1px solid #eee;padding:2px 4px}td:last-child{text-align:right;font-weight:bold;width:34px}
.hi{color:#137a3f}.md{color:#1d5fb8}.lo{color:#b36b00}.vl{color:#c0392b}p{margin:6px 0 0}@media print{body{margin:10mm}}
</style></head><body><h1>${esc(team.name)} · Informe de plantilla</h1><div class="sub">${esc(comp.name)} · 18 jugadores · generado el ${new Date().toLocaleDateString('es-ES')} · THE COACH Manager Academy</div>
<div class="sp">${Object.entries(TC.PHASE_SPACES).map(([k, d]) => `<div><small>${d.label}</small><br><b>${sp[k].value}</b><br><small>Defensa ${sp[k].byLine.def} · Medio ${sp[k].byLine.mid} · Ataque ${sp[k].byLine.att}</small><br><small>${esc(d.desc)}</small></div>`).join('')}</div>
${rows}<p style="margin-top:18px;color:#666">Atributos de 1 a 100. Espacios de fase según el marco de Método Pro: intervención, ayuda mutua y cooperación. Para guardarlo como PDF, ábrelo en el navegador e imprime.</p></body></html>`;
  }
  A.downloadReport = async () => {
    const c = UI.ctx(); const team = c.team || S.getTeam(UI.state.params.team);
    const html = reportHtml(team, S.getComp(team.compId));
    const filename = 'plantilla-' + team.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.html';
    let dl = null;
    try { dl = G.claude && G.claude.use ? await G.claude.use('downloads') : null; } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename, data: html }); UI.toast('Informe descargado. Ábrelo en el navegador; para PDF, imprímelo.'); }
      catch (e) { if (e && e.code !== 'declined') UI.toast('No se pudo descargar el informe en esta vista.', 'bad'); }
      return;
    }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); UI.toast('Informe descargado.'); }
    catch (e) { UI.toast('Esta vista no permite descargas.', 'bad'); }
  };

  /* ───── Modelo de juego con validación ───── */
  UI.validationPanel = function (v, compact) {
    const [vl, vk] = VERDICT[v.verdict];
    return `<section class="card"><div class="card-head"><h3>Validación con tu plantilla</h3><span class="score">${v.score}<i>/100</i></span></div>
      <p>${UI.pill(vl, vk)}</p>
      <p class="small muted">Cada decisión exige unas capacidades en un espacio de fase (intervención, ayuda mutua o cooperación). Se comparan con las de los jugadores que la ejecutarían en tu once. No hay un modelo correcto: la pregunta es si tus jugadores pueden sostenerlo.</p>
      ${v.checks.map((ch) => `<details class="vchk ${ch.verdict}" ${!compact && ch.verdict !== 'coherente' ? 'open' : ''}><summary><span>${esc(ch.label)}: <b>${esc(ch.choice)}</b></span>${UI.pill(VERDICT[ch.verdict][0].replace(' con tu plantilla', ''), VERDICT[ch.verdict][1])}</summary>
        <p class="small"><span class="chip">${esc(ch.space.split('+').map((x) => TC.PHASE_SPACES[x].label).join(' + '))}</span> ${esc(ch.why)}</p>
        <p class="small muted">Exige ${esc(ch.attrs.join(', ').toLowerCase())}. Tus ejecutores: ${ch.have} (su nivel general ${ch.own}). Mejores: ${esc(ch.best.join(', '))}${ch.weak.length ? ` · más justo: ${esc(ch.weak.join(', '))}` : ''}.</p></details>`).join('')}
      ${v.tensions.length ? `<h4>Tensiones internas del modelo</h4><ul class="small">${v.tensions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="tutor"><h4>Preguntas del tutor</h4><ul class="small">${v.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></div></section>`;
  };
  V.modelo = function (c) {
    const t = c.team; const m = t.model;
    const editable = S.canEditTeam(c.user, t);
    const live = TC.validateModel(m, t.players);
    const gated = UI.state.gated; UI.state.gated = null;
    return `<div class="page-head">${!m.submittedAt ? '<div class="eyebrow">Paso 2 de 2 antes de competir</div>' : ''}<h1>Modelo de juego</h1><p class="muted">Diseña la identidad de tu equipo a partir de tu plantilla. Define comportamientos en cada fase y momento, y justifica cada decisión pensando en tus jugadores.</p></div>
    ${gated ? `<div class="notice warn">Antes de planificar la semana tienes que presentar tu modelo de juego.</div>` : ''}
    ${m.submittedAt ? `<div class="notice ok">Modelo presentado el ${UI.fmtDate(m.submittedAt)} con una validación de ${m.validation ? m.validation.score : '—'}/100. Puedes ajustarlo y volver a presentarlo cuando quieras.</div>` : ''}
    <div class="grid g-task"><form data-submit="saveModel" data-change="modelLive" id="model-form" class="stack">
      <section class="card"><label class="field"><span>Identidad del equipo</span><input id="m-identity" name="identity" value="${esc(m.identity)}" placeholder="Ej. Dominar con balón y recuperar rápido tras pérdida" ${editable ? '' : 'disabled'}></label></section>
      ${Object.entries(TC.MODEL_FIELDS).map(([k, grp]) => `<section class="card"><h3>${esc(grp.label)}</h3><div class="fields">
        ${grp.fields.map(([f, l, opts]) => `<label class="field"><span>${esc(l)}</span><select id="m-${f}" name="${f}" ${editable ? '' : 'disabled'}>${UI.opts(opts, m[f])}</select></label>`).join('')}</div>
        <label class="field"><span>Justificación (¿qué jugadores lo hacen posible?)</span><textarea id="m-notes-${k}" name="notes.${k}" rows="3" ${editable ? '' : 'disabled'} placeholder="Nombra jugadores y capacidades concretas de tu plantilla.">${esc((m.notes || {})[k] || '')}</textarea></label></section>`).join('')}
      ${editable ? `<div class="sticky-actions"><span class="muted small">${m.updatedAt ? 'Guardado ' + UI.fmtDate(m.updatedAt) : 'Sin guardar'}</span><span class="row"><button class="btn ghost" type="submit">Guardar borrador</button><button class="btn primary" type="button" data-act="presentModel">${m.submittedAt ? 'Volver a presentar' : 'Presentar modelo'}</button></span></div>` : ''}
    </form>
    <aside class="stack sticky" id="model-val">${UI.validationPanel(live)}</aside></div>`;
  };
  function readModel() {
    const d = UI.formData(UI.$('#model-form')); const notes = {};
    for (const k of Object.keys(d)) if (k.startsWith('notes.')) { notes[k.slice(6)] = d[k]; delete d[k]; }
    d.notes = notes; return Object.assign({}, UI.ctx().team.model, d);
  }
  A.modelLive = () => { const box = UI.$('#model-val'); if (box) box.innerHTML = UI.validationPanel(TC.validateModel(readModel(), UI.ctx().team.players)); };
  A.saveModel = () => { S.saveModel(UI.ctx().team.id, readModel()); UI.toast('Borrador del modelo guardado.'); UI.render(); };
  A.presentModel = () => {
    const c = UI.ctx(); const m = readModel(); S.saveModel(c.team.id, m);
    const v = S.submitModel(c.team.id, m);
    UI.toast(`Modelo presentado: validación ${v.score}/100. Ya puedes planificar la semana.`); UI.render();
  };

  /* ───── Superadministrador: alumnos y accesos ───── */
  function freeTeamOptions() { const d = S.load(); const c = UI.ctx(); return (c.comps || []).flatMap((comp) => d.teams.filter((t) => t.compId === comp.id && !t.coachId).map((t) => [t.id, `${comp.name} · ${t.name}`])); }
  V['profe-alumnos'] = function (c) {
    const users = S.users().filter((u) => u.role === 'student');
    const pending = users.filter((u) => u.status === 'pending');
    const others = users.filter((u) => u.status !== 'pending');
    const teamOf = (u) => S.load().teams.find((t) => t.coachId === u.id);
    const free = freeTeamOptions();
    return `<div class="page-head"><h1>Alumnos y accesos</h1><p class="muted">Los alumnos se registran con nombre y email. Al aprobarlos, asignas su equipo y la app genera su código personal: pásaselo para que puedan entrar.</p></div>
    <section class="card"><div class="card-head"><h3>Solicitudes pendientes</h3>${UI.pill(String(pending.length), pending.length ? 'warn' : '')}</div>
      ${pending.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Alumno</th><th>Email</th><th>Solicitado</th><th>Equipo</th><th></th></tr></thead><tbody>${pending.map((u) => `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${UI.fmtDate(u.requestedAt)}</td>
        <td>${free.length ? `<select id="ap-${u.id}" class="mini" aria-label="Equipo">${free.map(([id, l]) => UI.opt(id, l)).join('')}</select>` : '<span class="muted small">No hay equipos libres: crea una competición</span>'}</td>
        <td class="row wrap">${free.length ? `<button class="btn sm primary" data-act="approve" data-id="${u.id}">Aprobar y generar código</button>` : ''}<button class="btn sm ghost" data-act="reject" data-id="${u.id}">Rechazar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No hay solicitudes pendientes.</p>'}</section>
    <section class="card"><h3>Alumnos</h3><div class="tablewrap"><table class="table"><thead><tr><th>Alumno</th><th>Email</th><th>Estado</th><th>Equipo</th><th>Plantilla</th><th>Modelo</th><th>Último acceso</th><th></th></tr></thead><tbody>
      ${others.map((u) => { const t = teamOf(u); const v = t && t.model.validation; return `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email || '—')}</td><td>${UI.pill(u.status === 'active' ? 'Activo' : 'Desactivado', u.status === 'active' ? 'ok' : 'bad')}</td>
        <td>${t ? `${UI.teamBadge(t, 20)} ${esc(t.name)}<br><small class="muted">${esc(S.getComp(t.compId).name)}</small>` : '<span class="muted">Sin equipo</span>'}</td>
        <td>${t && t.squadSeenAt ? UI.pill('Revisada', 'ok') : UI.pill('Pendiente', '')}</td><td>${t && t.model.submittedAt ? UI.pill((v ? v.score : '—') + '/100', v && v.score >= 70 ? 'ok' : v && v.score >= 45 ? 'warn' : 'bad') : UI.pill('Sin presentar', '')}</td>
        <td>${UI.fmtDate(u.lastLoginAt)}</td>
        <td class="row wrap">${t ? `<button class="btn sm" data-go="profe-alumno" data-p='{"team":"${t.id}"}'>Ver todo</button>` : ''}${u.demo ? '' : `<button class="btn sm ghost" data-act="regen" data-id="${u.id}">Nuevo código</button><button class="btn sm ghost" data-act="toggleStudent" data-id="${u.id}" data-s="${u.status === 'active' ? 'revoked' : 'active'}">${u.status === 'active' ? 'Desactivar' : 'Reactivar'}</button>`}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">Todavía no hay alumnos aprobados.</td></tr>'}
    </tbody></table></div></section>
    <section class="card"><h3>Actividad de accesos</h3><ul class="log">${S.load().log.filter((l) => ['solicitud', 'acceso', 'alta', 'modelo', 'plantilla'].includes(l.kind)).slice(-40).reverse().map((l) => `<li><time>${UI.fmtDate(l.at)}</time> ${esc(l.text)}</li>`).join('') || '<li class="muted">Sin actividad.</li>'}</ul></section>`;
  };
  function showCode(u, code, team) {
    UI.modal(`<h3>Código de acceso de ${esc(u.name)}</h3><p class="muted small">Pásaselo al alumno. Por seguridad sólo se muestra ahora; si se pierde, genera uno nuevo.</p>
      <div class="bigcode" id="code-val">${esc(code)}</div>${team ? `<p class="small">Equipo asignado: <b>${esc(team.name)}</b></p>` : ''}
      <p class="small">El alumno entra en «Tengo mi código» con <b>${esc(u.email)}</b> y este código.</p>
      <div class="row end"><button class="btn" data-act="copyText" data-t="${esc(code)}">Copiar código</button><button class="btn primary" data-act="closeModal">Hecho</button></div>`);
  }
  A.copyText = (el) => { const t = el.dataset.t; try { navigator.clipboard.writeText(t).then(() => UI.toast('Copiado.'), () => { const r = document.createRange(); r.selectNodeContents(UI.$('#code-val')); getSelection().removeAllRanges(); getSelection().addRange(r); UI.toast('Selecciónalo y cópialo.'); }); } catch (e) { UI.toast('Selecciónalo y cópialo.'); } };
  A.approve = (el) => { const u = S.users().find((x) => x.id === el.dataset.id); const teamId = UI.$('#ap-' + u.id).value; const code = S.approveStudent(u.id, teamId); UI.render(); showCode(u, code, S.getTeam(teamId)); };
  A.reject = (el) => { const u = S.users().find((x) => x.id === el.dataset.id); UI.ask('Rechazar solicitud', `Se eliminará la solicitud de ${u.name}.`, 'Rechazar', () => { S.setStudentStatus(u.id, 'rejected'); UI.render(); }, true); };
  A.regen = (el) => { const u = S.users().find((x) => x.id === el.dataset.id); UI.ask('Generar un código nuevo', `El código anterior de ${u.name} dejará de funcionar.`, 'Generar', () => { const code = S.regenerateCode(u.id); UI.render(); showCode(u, code, S.load().teams.find((t) => t.coachId === u.id)); }); };
  A.toggleStudent = (el) => { S.setStudentStatus(el.dataset.id, el.dataset.s); UI.toast(el.dataset.s === 'revoked' ? 'Acceso desactivado.' : 'Acceso reactivado.'); UI.render(); };

  // Vista completa del trabajo de un alumno (incluidos borradores sin entregar)
  V['profe-alumno'] = function (c, p) {
    const t = S.getTeam(p && p.team); if (!t) return '<div class="card">Equipo no encontrado.</div>';
    const u = S.users().find((x) => x.id === t.coachId); const comp = S.getComp(t.compId);
    const draft = S.getDraft(t.id, comp.currentRound); const subs = S.submissionsOf(t.id);
    const v = t.model.validation;
    const me = TC.evaluateMicrocycle(draft.microcycle, t.model, { sessionsRequired: comp.config.sessionsPerWeek });
    return `<div class="page-head"><a class="link" href="#profe-alumnos" data-go="profe-alumnos">← Alumnos</a><h1>${esc(u ? u.name : 'Sistema')} · ${esc(t.name)}</h1><p class="muted">${esc(comp.name)} · ${esc(u && u.email || '')}</p></div>
    <div class="row wrap"><button class="btn" data-act="downloadReport">Descargar informe de su plantilla</button></div>
    <div class="grid g2"><section class="card"><h3>Modelo de juego</h3>${t.model.submittedAt ? `<p>${UI.pill('Presentado ' + UI.fmtDate(t.model.submittedAt), 'ok')}</p>` : `<p>${UI.pill('Sin presentar (borrador)', 'warn')}</p>`}
      <p><b>${esc(t.model.identity || '—')}</b></p>
      ${Object.entries(TC.MODEL_FIELDS).map(([k, g]) => `<h4>${esc(g.label)}</h4><div class="chips">${g.fields.map(([f, l]) => `<span class="chip"><small>${esc(l)}:</small> ${esc(t.model[f])}</span>`).join('')}</div><p class="small">${esc((t.model.notes || {})[k] || '—')}</p>`).join('')}
      <p class="small muted">${(t.modelVersions || []).length} versiones guardadas.</p></section>
      <div class="stack">${UI.validationPanel(v || TC.validateModel(t.model, t.players), true)}</div></div>
    <section class="card"><h3>Perfil de la plantilla</h3>${spacesPanel(t)}</section>
    <section class="card"><div class="card-head"><h3>Semana en curso (J${comp.currentRound}) · borrador</h3><span class="score">${me.score25}<i>/25</i></span></div>
      <div class="tablewrap"><table class="table"><thead><tr><th>Día</th><th>Tipo</th><th>Objetivo</th><th>Carga</th><th>Tareas</th></tr></thead><tbody>${draft.microcycle.sessions.map((s) => `<tr><td>${esc(s.day)}</td><td>${esc(s.type)}</td><td>${esc(TC.IND_LABEL[s.objective] || '—')}</td><td>${s.duration}′ × ${s.intensity}</td><td>${s.tasks.map((x) => esc(x.name)).join('<br>') || '—'}</td></tr>`).join('')}</tbody></table></div>
      <p class="small">Plan de partido: ${Object.values(draft.plan.sections || {}).filter((x) => (x || '').trim()).length} apartados escritos · ${draft.plan.conditions.length} instrucciones condicionales · ${draft.plan.linkedSessions.length} sesiones vinculadas.</p></section>
    <section class="card"><h3>Entregas bloqueadas</h3>${subs.map((s) => `<div class="round-line"><b>J${s.round} v${s.version}</b> ${UI.fmtDate(s.submittedAt)} <a class="link" href="#profe-entrega" data-go="profe-entrega" data-p='{"sub":"${s.id}"}'>Abrir</a></div>`).join('') || '<p class="muted">Sin entregas.</p>'}</section>
    <section class="card"><h3>Historial de decisiones</h3><ul class="log">${S.logFor(comp.id, t.id).map((l) => `<li><time>${UI.fmtDate(l.at)}</time> ${esc(l.text)}</li>`).join('') || '<li class="muted">Sin registros.</li>'}</ul></section>`;
  };
})(window);
