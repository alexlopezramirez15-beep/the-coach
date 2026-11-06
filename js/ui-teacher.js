/* THE COACH — Panel del profesor. */
(function (G) {
  'use strict';
  const TC = G.TC, S = G.TCStore, UI = G.UI, esc = UI.esc;
  const V = UI.views, A = UI.actions;

  function students() { return S.users().filter((u) => u.role === 'student'); }

  V.profe = function (c) {
    if (!c.comp) return `<div class="page-head"><h1>Panel del profesor</h1><p class="muted">Crea tu primera competición o carga la liga de demostración.</p></div>
      <div class="grid g2"><section class="card"><h3>Nueva competición</h3><p class="muted small">Configura equipos, jornadas y reglas. Se genera el calendario y un código para tus alumnos.</p><button class="btn primary" data-go="nueva-comp">Crear competición</button></section>
      <section class="card"><h3>Competición automática</h3><p class="muted small">Crea una liga de 4 equipos con la configuración por defecto, lista para que tus alumnos se unan.</p><button class="btn" data-act="autoComp">Generar automáticamente</button></section></div>`;
    const comp = c.comp; const n = comp.currentRound; const rd = S.roundOf(comp.id, n);
    const rs = S.roundStatus(comp.id, n);
    const teams = S.teamsOf(comp.id);
    const assigned = teams.filter((t) => t.coachId);
    const pending = rs.filter((x) => x.team.coachId && !x.sub);
    const evs = S.load().evaluations.filter((e) => e.compId === comp.id);
    const toReview = evs.filter((e) => !e.final);
    const alerts = [];
    if (pending.length && rd.status === 'open') alerts.push(`${pending.length} alumnos no han entregado la jornada ${n}.`);
    if (toReview.length) alerts.push(`${toReview.length} evaluaciones esperan tu revisión.`);
    for (const t of teams) { const tired = t.players.filter((p) => p.fatigue > 55).length; if (t.coachId && tired >= 3) alerts.push(`${t.name}: ${tired} jugadores con fatiga elevada.`); }
    if (rd.alerts) alerts.push(...rd.alerts);
    const studs = students();
    return `<div class="page-head"><h1>${esc(comp.name)}</h1><p class="muted">${esc(comp.className || 'Clase sin nombre')} · ${comp.config.teams} equipos · ${comp.config.rounds} jornadas ${comp.config.doubleRound ? 'a doble vuelta' : 'a una vuelta'} · ${comp.status === 'finished' ? 'Finalizada' : 'En curso'}</p></div>
    <div class="kpi-row">
      <div class="kpi card"><small>Código de acceso</small><b class="code">${esc(comp.code)}</b><button class="btn sm ghost" data-act="copyCode" data-code="${esc(comp.code)}">Copiar</button></div>
      <div class="kpi card"><small>Alumnos con equipo</small><b>${assigned.length}<i>/${teams.length}</i></b></div>
      <div class="kpi card"><small>Jornada actual</small><b>${n}<i>/${comp.config.rounds}</i></b>${UI.pill(rd.status === 'open' ? 'Abierta' : rd.status === 'played' ? 'Disputada' : 'Bloqueada', rd.status === 'open' ? 'info' : rd.status === 'played' ? 'ok' : '')}</div>
      <div class="kpi card"><small>Entregas pendientes</small><b>${pending.length}</b></div>
      <div class="kpi card"><small>Por evaluar</small><b>${toReview.length}</b></div>
    </div>
    ${alerts.length ? `<section class="card alerts"><h3>Alertas</h3><ul>${alerts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : ''}
    <div class="grid g-hero">
      <section class="card"><div class="card-head"><h3>Equipos y entrenadores</h3><span class="muted small">Los equipos sin alumno los gestiona el sistema</span></div>
        <div class="tablewrap"><table class="table"><thead><tr><th>Equipo</th><th>Entrenador</th><th>J${n}</th><th>Microciclo</th><th>Plan</th><th></th></tr></thead><tbody>
        ${rs.map(({ team, sub }) => `<tr><td>${UI.teamBadge(team, 22)} ${esc(team.name)}</td><td><select class="mini" data-change="assign" data-team="${team.id}" aria-label="Entrenador"><option value="">Sistema</option>${studs.map((u) => UI.opt(u.id, u.name, team.coachId)).join('')}</select></td>
          <td>${sub ? UI.pill((sub.auto ? 'Auto ' : 'v') + sub.version, sub.auto ? '' : 'ok') : team.coachId ? UI.pill('Pendiente', 'warn') : UI.pill('Auto al jugar', '')}</td><td>${sub ? sub.evals.micro.score25 + '/25' : '—'}</td><td>${sub ? sub.evals.plan.score25 + '/25' : '—'}</td><td>${sub ? `<a class="link" href="#profe-entrega" data-go="profe-entrega" data-p='{"sub":"${sub.id}"}'>Abrir</a>` : ''}</td></tr>`).join('')}
        </tbody></table></div></section>
      <section class="card"><h3>Jornada ${n}</h3>
        ${S.matchesOf(comp.id, n).map((m) => `<div class="round-line">${esc(S.getTeam(m.homeId).name)} ${m.status === 'played' ? `<b>${m.result.score.join('-')}</b>` : 'vs'} ${esc(S.getTeam(m.awayId).name)}</div>`).join('')}
        <div class="stack">${rd.status === 'open' ? '<button class="btn primary block" data-act="playRound">Activar jornada y simular partidos</button>' : ''}${rd.status === 'played' && comp.status !== 'finished' ? `<button class="btn primary block" data-act="unlockNext">${n < comp.config.rounds ? 'Desbloquear jornada ' + (n + 1) : 'Cerrar competición'}</button>` : ''}
        <button class="btn ghost block" data-go="profe-jornadas">Gestionar jornadas</button></div></section>
    </div>
    <div class="grid g2">
      <section class="card"><div class="card-head"><h3>Clasificación</h3><a class="link" href="#clasificacion" data-go="clasificacion">Completa</a></div>${UI.miniTable(S.standings(comp.id))}</section>
      <section class="card"><div class="card-head"><h3>Mis competiciones</h3><button class="btn sm" data-go="nueva-comp">Nueva</button></div>${c.comps.map((x) => `<div class="round-line"><b>${esc(x.name)}</b> <span class="muted small">${esc(x.code)} · J${x.currentRound}/${x.config.rounds}</span> ${x.id === comp.id ? UI.pill('Activa', 'ok') : `<button class="btn sm ghost" data-act="pickComp" data-id="${x.id}">Abrir</button>`}</div>`).join('')}
        <button class="btn ghost sm" data-act="autoComp">Generar competición automática</button></section>
    </div>
    <section class="card"><h3>Retos y eventos especiales</h3>${UI.soon(4, 'Retos docentes evaluables (p. ej. «presión alta contra salida en 1-3-2»).')}${UI.soon(3, 'Eventos especiales: lesión, cambio de estructura del rival, fatiga, lluvia, expulsión, calendario exigente.')}</section>`;
  };
  A.copyCode = (el) => { const code = el.dataset.code; try { navigator.clipboard.writeText(code).then(() => UI.toast('Código copiado.'), () => UI.toast('Código: ' + code)); } catch (e) { UI.toast('Código: ' + code); } };
  A.pickComp = (el) => { UI.state.compId = el.dataset.id; UI.render(); };
  A.assign = (el) => { S.assignTeam(el.dataset.team, el.value || null); UI.toast('Asignación guardada.'); UI.render(); };
  A.autoComp = () => { const comp = S.createCompetition({ name: 'Liga automática ' + new Date().toLocaleDateString('es-ES'), config: { teams: 4 } }); UI.state.compId = comp.id; UI.toast(`Competición creada. Código ${comp.code}.`); UI.go('profe'); };
  A.playRound = () => {
    const c = UI.ctx(); const n = c.comp.currentRound; const pend = S.roundStatus(c.comp.id, n).filter((x) => x.team.coachId && !x.sub);
    UI.ask(`Activar la jornada ${n}`, (pend.length ? `${pend.length} alumnos no han entregado: jugarán con su modelo, alineación automática y sin efecto del entrenamiento. ` : '') + 'Se aplicará el aprendizaje de cada microciclo y se simularán todos los partidos con las versiones bloqueadas. No se puede deshacer salvo reiniciando la competición.', 'Simular jornada', () => {
      const r = S.playRound(c.comp.id); UI.toast(`Jornada ${r.round} disputada. Clasificación actualizada.`); UI.go('profe-jornadas');
    });
  };
  A.unlockNext = () => { const c = UI.ctx(); const r = S.unlockNextRound(c.comp.id); UI.toast(r ? `Jornada ${r.number} abierta para entregas.` : 'Competición finalizada.'); UI.render(); };

  /* ───── Nueva competición ───── */
  V['nueva-comp'] = function () {
    return `<div class="page-head"><h1>Configuración de competición</h1><p class="muted">El calendario se genera automáticamente sin enfrentamientos repetidos (salvo segunda vuelta).</p></div>
    <form class="card stack" data-submit="createComp">
      <div class="fields">
        <label class="field"><span>Nombre de la competición</span><input id="nc-name" name="name" required minlength="3" placeholder="Liga 2º CFGM · Grupo A"></label>
        <label class="field"><span>Clase</span><input id="nc-class" name="className" placeholder="2º CFGM Técnico Deportivo en Fútbol"></label>
        <label class="field"><span>Número de participantes</span><input id="nc-teams" type="number" name="teams" value="4" min="2" max="20"></label>
        <label class="field"><span>Formato</span><select id="nc-double" name="doubleRound">${UI.opts([['0', 'Solo ida'], ['1', 'Ida y vuelta']], '0')}</select></label>
        <label class="field"><span>Sesiones semanales a planificar</span><input id="nc-sessions" type="number" name="sessionsPerWeek" value="4" min="2" max="5"></label>
        <label class="field"><span>Nivel de dificultad (equipos del sistema)</span><select id="nc-diff" name="difficulty">${UI.opts([['bajo', 'Bajo'], ['medio', 'Medio'], ['alto', 'Alto']], 'medio')}</select></label>
        <label class="field"><span>Días para entregar planes</span><input id="nc-days" type="number" name="deadlineDays" value="5" min="1" max="14"></label>
        <label class="field"><span>Duración simulada (min)</span><input id="nc-min" type="number" name="minutes" value="90" min="90" max="90" readonly></label>
        <label class="field"><span>Puntos por victoria</span><input id="nc-pw" type="number" name="pointsWin" value="3" min="1" max="5"></label>
        <label class="field"><span>Puntos por empate</span><input id="nc-pd" type="number" name="pointsDraw" value="1" min="0" max="3"></label>
        <label class="field"><span>Modo de competición</span><select id="nc-mode" name="mode">${UI.opts([['asíncrono', 'Asíncrono (instrucciones condicionales)']], 'asíncrono')}</select></label>
        <label class="field"><span>Sistema de evaluación</span><select id="nc-eval" name="evaluation">${UI.opts([['rúbrica 100', 'Rúbrica de 100 puntos por jornada']], 'rúbrica 100')}</select></label>
      </div>
      <p class="note">El modo en directo (intervenir durante pausas tácticas) llegará en la fase 3.</p>
      <div class="row end"><button class="btn ghost" type="button" data-go="profe">Cancelar</button><button class="btn primary" type="submit">Crear competición</button></div>
    </form>`;
  };
  A.createComp = (f) => {
    const d = UI.formData(f);
    const comp = S.createCompetition({ name: d.name, className: d.className, config: { teams: +d.teams, doubleRound: d.doubleRound === '1', sessionsPerWeek: +d.sessionsPerWeek, difficulty: d.difficulty, deadlineDays: +d.deadlineDays, pointsWin: +d.pointsWin, pointsDraw: +d.pointsDraw, mode: d.mode, evaluation: d.evaluation } });
    UI.state.compId = comp.id; UI.toast(`Competición creada: código ${comp.code}.`); UI.go('profe');
  };

  /* ───── Jornadas ───── */
  V['profe-jornadas'] = function (c) {
    const comp = c.comp;
    return `<div class="page-head"><h1>Jornadas</h1><p class="muted">Activa la jornada cuando las entregas estén listas. Después, desbloquea la siguiente.</p></div>
    ${S.roundsOf(comp.id).map((rd) => { const rs = S.roundStatus(comp.id, rd.number); const done = rs.filter((x) => x.sub && !x.sub.auto).length; const humans = rs.filter((x) => x.team.coachId).length; return `<section class="card ${rd.number === comp.currentRound ? 'mine' : ''}"><div class="card-head"><h3>Jornada ${rd.number}</h3><span>${UI.pill(rd.status === 'open' ? 'Abierta' : rd.status === 'played' ? 'Disputada' : 'Bloqueada', rd.status === 'open' ? 'info' : rd.status === 'played' ? 'ok' : '')} ${rd.status !== 'locked' ? `<span class="muted small">${done}/${humans} entregas de alumnos</span>` : ''}</span></div>
      <div class="ms">${S.matchesOf(comp.id, rd.number).map((m) => `<a ${m.status === 'played' ? `href="#informe" data-go="informe" data-p='{"m":"${m.id}"}'` : ''} class="m ${m.status}">${esc(S.getTeam(m.homeId).name)} ${m.status === 'played' ? `<b>${m.result.score.join('-')}</b>` : 'vs'} ${esc(S.getTeam(m.awayId).name)}</a>`).join('')}</div>
      ${rd.alerts && rd.alerts.length ? `<ul class="small warn-t">${rd.alerts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      ${rd.number === comp.currentRound && rd.status === 'open' ? '<button class="btn primary" data-act="playRound">Activar y simular</button>' : ''}${rd.number === comp.currentRound && rd.status === 'played' && comp.status !== 'finished' ? `<button class="btn primary" data-act="unlockNext">${rd.number < comp.config.rounds ? 'Desbloquear jornada ' + (rd.number + 1) : 'Cerrar competición'}</button>` : ''}
    </section>`; }).join('')}`;
  };

  /* ───── Entregas ───── */
  V['profe-entregas'] = function (c) {
    const comp = c.comp; const rounds = S.roundsOf(comp.id).filter((r) => r.status !== 'locked');
    const teams = S.teamsOf(comp.id);
    return `<div class="page-head"><h1>Entregas</h1><p class="muted">Abre cualquier versión bloqueada. Las de los equipos del sistema se generan automáticamente.</p></div>
    <div class="card"><div class="tablewrap"><table class="table"><thead><tr><th>Equipo</th><th>Entrenador</th>${rounds.map((r) => `<th>J${r.number}</th>`).join('')}</tr></thead><tbody>
    ${teams.map((t) => { const coach = S.users().find((u) => u.id === t.coachId); return `<tr><td>${UI.teamBadge(t, 20)} ${esc(t.name)}</td><td>${esc(coach ? coach.name : 'Sistema')}</td>${rounds.map((r) => { const subs = S.submissionsOf(t.id).filter((s) => s.round === r.number); return `<td>${subs.length ? subs.map((s) => `<a class="chip" href="#profe-entrega" data-go="profe-entrega" data-p='{"sub":"${s.id}"}'>${s.auto ? 'auto' : 'v' + s.version}</a>`).join(' ') : '<span class="muted">—</span>'}</td>`; }).join('')}</tr>`; }).join('')}
    </tbody></table></div></div>
    <section class="card"><h3>Registro de la competición</h3><ul class="log">${S.logFor(comp.id).slice(0, 60).map((l) => `<li><time>${UI.fmtDate(l.at)}</time> ${esc(l.text)}</li>`).join('')}</ul></section>`;
  };
  V['profe-entrega'] = function (c, p) {
    const sub = S.load().submissions.find((s) => s.id === (p && p.sub));
    if (!sub) return '<div class="card">Entrega no encontrada.</div>';
    const t = S.getTeam(sub.teamId); const sn = sub.snapshot; const coach = S.users().find((u) => u.id === t.coachId);
    const byId = Object.fromEntries(t.players.map((x) => [x.id, x]));
    const me = TC.evaluateMicrocycle(sn.microcycle, sn.model, { sessionsRequired: c.comp.config.sessionsPerWeek });
    const SECT = { fortalezas: 'A · Fortalezas', debilidades: 'A · Debilidades', habituales: 'A · Comportamientos habituales', amenazas: 'A · Amenazas', objetivos: 'B · Objetivos', espacios: 'B · Espacios', provocar: 'B · Comportamientos a provocar', ofensivo: 'C · Plan ofensivo', defensivo: 'D · Plan defensivo', perdida: 'E · Tras pérdida', recuperacion: 'E · Tras recuperación', abpOf: 'F · ABP ofensiva', abpDef: 'F · ABP defensiva', escenarios: 'G · Escenarios', relacion: 'H · Relación con el entrenamiento' };
    return `<div class="page-head"><a class="link" href="#profe-entregas" data-go="profe-entregas">← Entregas</a><h1>${esc(t.name)} · J${sub.round} · v${sub.version}</h1><p class="muted">${esc(coach ? coach.name : 'Sistema')} · bloqueada ${UI.fmtDate(sub.submittedAt)} ${sub.auto ? '· generada automáticamente' : ''}</p></div>
    <div class="grid g2">
      <section class="card"><h3>Modelo de juego (versión entregada)</h3><p>${esc(sn.model.identity || '—')}</p><div class="chips">${Object.values(TC.MODEL_FIELDS).flatMap((g) => g.fields).map(([k, l]) => `<span class="chip"><small>${esc(l)}:</small> ${esc(sn.model[k])}</span>`).join('')}</div></section>
      <section class="card"><h3>Evaluación automática</h3><div class="crit"><div class="crit-h"><span>Microciclo</span><b>${sub.evals.micro.score25}/25</b></div></div><div class="crit"><div class="crit-h"><span>Plan</span><b>${sub.evals.plan.score25}/25</b></div></div><div class="crit"><div class="crit-h"><span>Coherencia</span><b>${sub.evals.coherence.score20}/20</b></div></div>
        ${sub.learning ? `<h4>Aprendizaje aplicado</h4><div>${sub.learning.log.map((l) => `<span class="chip ${l.delta > 0 ? 'up' : 'down'}">${esc(TC.IND_LABEL[l.k])} ${l.delta > 0 ? '+' : ''}${l.delta}</span>`).join(' ')}</div>` : ''}</section>
    </div>
    <section class="card"><h3>Microciclo</h3><p class="small">${esc(sn.microcycle.justification || '')}</p><div class="tablewrap"><table class="table"><thead><tr><th>Día</th><th>Tipo</th><th>Objetivo</th><th>Carga</th><th>Tareas</th><th>Rival</th><th>Nota</th></tr></thead><tbody>${sn.microcycle.sessions.map((s, i) => `<tr><td>${esc(s.day)}</td><td>${esc(s.type)}</td><td>${esc(TC.IND_LABEL[s.objective] || '—')}</td><td>${s.duration}′ × ${s.intensity}</td><td>${s.tasks.map((tk) => `${esc(tk.name)} <small class="muted">(${TC.evaluateTask(tk).score})</small>`).join('<br>')}</td><td class="small">${esc(s.rivalLink)}</td><td>${me.sessions[i].score}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin sesiones.</td></tr>'}</tbody></table></div></section>
    <section class="card"><h3>Plan de partido</h3><div class="chips">${Object.entries(sn.plan.tactics).map(([k, v]) => `<span class="chip"><small>${esc(k)}:</small> ${esc(v)}</span>`).join('')}</div>
      <dl class="plan-dl">${Object.entries(SECT).filter(([k]) => (sn.plan.sections || {})[k]).map(([k, l]) => `<div><dt>${l}</dt><dd>${esc(sn.plan.sections[k])}</dd></div>`).join('')}</dl>
      <h4>Instrucciones condicionales</h4><ul class="small">${(sn.plan.conditions || []).map((cd) => `<li>${esc(TC.COND_WHEN[cd.when])} desde el ${cd.from}': ${esc(TC.COND_ACTIONS[cd.action].label)}${cd.action === 'sub' ? ` (${esc((byId[cd.out] || {}).name)} → ${esc((byId[cd.in] || {}).name)})` : ''}</li>`).join('') || '<li class="muted">Ninguna.</li>'}</ul>
      <h4>Alineación ${esc(sn.lineup.formation)}</h4><p class="small">${sn.lineup.slots.map((id, i) => `${TC.FORMATIONS[sn.lineup.formation][i][0]} ${esc((byId[id] || {}).name || '—')}`).join(' · ')}</p></section>`;
  };

  /* ───── Evaluaciones ───── */
  V['profe-evaluar'] = function (c, p) {
    const comp = c.comp;
    const all = S.load().evaluations.filter((e) => e.compId === comp.id);
    const rounds = [...new Set(all.map((e) => e.round))].sort((a, b) => a - b);
    const r = (p && p.round) || rounds[rounds.length - 1];
    const list = all.filter((e) => e.round === r);
    const lab = { micro: ['Diseño del microciclo', 25], plan: ['Plan de partido', 25], coherence: ['Coherencia metodológica y táctica', 20], adaptation: ['Adaptación competitiva', 20], analysis: ['Análisis posterior', 10] };
    return `<div class="page-head"><h1>Evaluaciones y rúbricas</h1><p class="muted">Rúbrica de 100 puntos por jornada. El sistema propone una puntuación explicada; tú decides la nota final y la justificación.</p></div>
    <div class="row wrap">${rounds.map((x) => `<button class="btn sm ${x === r ? 'primary' : 'ghost'}" data-go="profe-evaluar" data-p='{"round":${x}}'>Jornada ${x}</button>`).join('') || '<p class="muted">Aún no hay jornadas disputadas con alumnos.</p>'}</div>
    ${list.map((ev) => { const t = S.getTeam(ev.teamId); const coach = S.users().find((u) => u.id === t.coachId); const refl = S.getReflection(t.id, ev.round); const sc = (ev.final || ev.proposal).scores; return `<section class="card"><div class="card-head"><h3>${UI.teamBadge(t, 24)} ${esc(t.name)} · ${esc(coach ? coach.name : '')}</h3>${ev.final ? UI.pill('Revisada · ' + TC.round1(Object.values(ev.final.scores).reduce((a, b) => a + b, 0)) + '/100', 'ok') : UI.pill('Propuesta · ' + TC.round1(Object.values(ev.proposal.scores).reduce((a, b) => a + b, 0)) + '/100', 'warn')}</div>
      <form data-submit="saveEval" class="stack"><input type="hidden" name="id" value="${ev.id}">
      ${Object.entries(lab).map(([k, [l, max]]) => `<details class="rub"><summary><span>${l}</span><span class="rub-in"><small class="muted">propuesta ${TC.round1(ev.proposal.scores[k])}</small><input type="number" name="s.${k}" value="${TC.round1(sc[k])}" min="0" max="${max}" step="any" aria-label="${l}"><i>/${max}</i></span></summary>
        <ul class="small">${(ev.proposal.criteria[k] || []).map((cr) => `<li><b>${esc(cr.label)}</b> ${TC.round1(cr.s * cr.max)}/${cr.max}: ${esc(cr.reason)}</li>`).join('')}</ul>
        <label class="field"><span>Justificación del profesor</span><input name="n.${k}" value="${esc(ev.final && ev.final.notes ? ev.final.notes[k] || '' : '')}"></label></details>`).join('')}
      <div class="refl"><b>Reflexión del alumno:</b> ${refl ? esc(refl.text) : '<span class="muted">Pendiente.</span>'}</div>
      <label class="field"><span>Comentario general</span><textarea name="n.general" rows="2">${esc(ev.final && ev.final.notes ? ev.final.notes.general || '' : '')}</textarea></label>
      <div class="row end"><a class="btn ghost" href="#profe-entrega" data-go="profe-entrega" data-p='{"sub":"${ev.submissionId}"}'>Ver entrega</a><a class="btn ghost" href="#informe" data-go="informe" data-p='{"m":"${ev.matchId}"}'>Ver partido</a><button class="btn primary" type="submit">Guardar evaluación</button></div></form></section>`; }).join('')}`;
  };
  A.saveEval = (f) => {
    const d = UI.formData(f); const scores = {}, notes = {};
    for (const [k, v] of Object.entries(d)) { if (k.startsWith('s.')) scores[k.slice(2)] = +v; if (k.startsWith('n.')) notes[k.slice(2)] = v; }
    S.saveEvaluation(d.id, scores, notes); UI.toast('Evaluación guardada.'); UI.render();
  };

  /* ───── Jugadores ───── */
  V['profe-jugadores'] = function (c, p) {
    const teams = S.teamsOf(c.comp.id); const t = teams.find((x) => x.id === (p && p.team)) || teams[0];
    const pl = t.players.find((x) => x.id === (p && p.player)) || t.players[0];
    return `<div class="page-head"><h1>Modificar atributos</h1><p class="muted">Los cambios quedan registrados. Úsalos con cuidado: los equipos deben seguir siendo comparables.</p></div>
    <div class="row wrap"><label class="field"><span>Equipo</span><select data-change="pjTeam">${teams.map((x) => UI.opt(x.id, x.name, t.id)).join('')}</select></label>
      <label class="field"><span>Jugador</span><select data-change="pjPlayer" data-team="${t.id}">${t.players.map((x) => UI.opt(x.id, `${x.pos} · ${x.name}`, pl.id)).join('')}</select></label>
      <span class="muted">Potencial del equipo: <b>${TC.squadPotential(t.players)}</b></span></div>
    <div class="grid g4">${Object.values(TC.ATTR_GROUPS).map((g) => `<section class="card"><h3>${g.label}</h3>${g.attrs.map(([a, l]) => `<label class="attr-edit"><span>${esc(l)}</span><input type="number" min="1" max="100" value="${pl.attrs[a]}" data-change="pjAttr" data-team="${t.id}" data-player="${pl.id}" data-attr="${a}"></label>`).join('')}</section>`).join('')}</div>`;
  };
  A.pjTeam = (el) => UI.go('profe-jugadores', { team: el.value });
  A.pjPlayer = (el) => UI.go('profe-jugadores', { team: el.dataset.team, player: el.value });
  A.pjAttr = (el) => { S.setPlayerAttr(el.dataset.team, el.dataset.player, el.dataset.attr, el.value); UI.toast('Atributo actualizado.'); };

  /* ───── Configuración ───── */
  V['profe-config'] = function (c) {
    const cf = c.comp.config; const w = cf.weights || TC.DEFAULT_WEIGHTS;
    return `<div class="page-head"><h1>Configuración de competición</h1><p class="muted">${esc(c.comp.name)} · código ${esc(c.comp.code)}</p></div>
    <form class="card stack" data-submit="saveConfig"><h3>Reglas</h3><div class="fields">
      <label class="field"><span>Sesiones semanales</span><input type="number" name="sessionsPerWeek" value="${cf.sessionsPerWeek}" min="2" max="5"></label>
      <label class="field"><span>Dificultad (equipos del sistema)</span><select name="difficulty">${UI.opts([['bajo', 'Bajo'], ['medio', 'Medio'], ['alto', 'Alto']], cf.difficulty)}</select></label>
      <label class="field"><span>Días para entregar</span><input type="number" name="deadlineDays" value="${cf.deadlineDays}" min="1" max="14"></label>
      <label class="field"><span>Puntos por victoria</span><input type="number" name="pointsWin" value="${cf.pointsWin}" min="1" max="5"></label>
      <label class="field"><span>Puntos por empate</span><input type="number" name="pointsDraw" value="${cf.pointsDraw}" min="0" max="3"></label></div>
      <h3>Ponderaciones del motor</h3><p class="small muted">Valores por defecto calibrados para que ningún estilo gane siempre. Afectan a las jornadas que se disputen a partir de ahora.</p><div class="fields">
      <label class="field"><span>Variabilidad (1 = normal)</span><input type="number" step="0.1" min="0.2" max="2" name="w.variance" value="${w.variance}"></label>
      <label class="field"><span>Peso de los indicadores entrenados</span><input type="number" step="0.05" min="0" max="1.5" name="w.indicatorWeight" value="${w.indicatorWeight}"></label>
      <label class="field"><span>Peso de los enfrentamientos tácticos</span><input type="number" step="0.05" min="0" max="1.5" name="w.tacticWeight" value="${w.tacticWeight}"></label>
      <label class="field"><span>Peso de la fatiga</span><input type="number" step="0.05" min="0" max="2" name="w.fatigueWeight" value="${w.fatigueWeight}"></label>
      <label class="field"><span>Ventaja de local</span><input type="number" step="0.005" min="0" max="0.05" name="w.homeAdv" value="${w.homeAdv}"></label></div>
      <div class="row end"><button class="btn primary" type="submit">Guardar configuración</button></div></form>
    <section class="card danger-zone"><h3>Zona de pruebas</h3><p class="small muted">Reiniciar borra resultados, entregas, evaluaciones y regenera las plantillas con la misma semilla. Los alumnos mantienen su equipo.</p>
      <div class="row wrap"><button class="btn danger" data-act="resetComp">Reiniciar competición</button><button class="btn ghost" data-act="deleteComp">Eliminar competición</button></div></section>`;
  };
  A.saveConfig = (f) => {
    const d = UI.formData(f); const c = UI.ctx(); const weights = Object.assign({}, c.comp.config.weights || TC.DEFAULT_WEIGHTS);
    const patch = {};
    for (const [k, v] of Object.entries(d)) { if (k.startsWith('w.')) weights[k.slice(2)] = +v; else patch[k] = isNaN(+v) ? v : +v; }
    patch.weights = weights; S.updateConfig(c.comp.id, patch); UI.toast('Configuración guardada.'); UI.render();
  };
  A.resetComp = () => UI.ask('Reiniciar competición', 'Se perderán todos los resultados, entregas y evaluaciones de esta competición.', 'Reiniciar', () => { S.resetCompetition(UI.ctx().comp.id); UI.toast('Competición reiniciada.'); UI.go('profe'); }, true);
  A.deleteComp = () => UI.ask('Eliminar competición', 'Se eliminará la competición con sus equipos y datos. No se puede deshacer.', 'Eliminar', () => { S.deleteCompetition(UI.ctx().comp.id); UI.state.compId = null; UI.toast('Competición eliminada.'); UI.go('profe'); }, true);
})(window);
