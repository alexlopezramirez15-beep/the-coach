/* THE COACH — Pantallas del entrenador (alumno). */
(function (G) {
  'use strict';
  const TC = G.TC, S = G.TCStore, UI = G.UI, esc = UI.esc;
  const V = UI.views, A = UI.actions;

  // Contexto de la semana: qué jornada se prepara y si se puede editar
  UI.week = function (c) {
    const team = c.team, comp = c.comp;
    const nm = S.nextMatch(team);
    const round = nm ? nm.round : comp.currentRound;
    const rd = S.roundOf(comp.id, round);
    const editable = !!(rd && rd.status === 'open' && round === comp.currentRound && S.canEditTeam(c.user, team));
    const draft = S.getDraft(team.id, round);
    const sub = S.lastSubmission(team.id, round);
    const rival = nm ? S.getTeam(nm.rivalId) : null;
    return { team, comp, nm, round, rd, editable, draft, sub, rival };
  };
  function lockNote(w) {
    if (w.editable) return w.sub ? `<div class="notice ok">Entregado (versión ${w.sub.version}, ${UI.fmtDate(w.sub.submittedAt)}). Puedes modificar y volver a entregar mientras la jornada siga abierta: el partido usará la última versión bloqueada.</div>` : '';
    if (!w.nm) return '<div class="notice">La competición ha terminado.</div>';
    return `<div class="notice warn">La jornada ${w.round} todavía no está abierta. Puedes consultar, pero no modificar, hasta que el profesor la desbloquee.</div>`;
  }
  function saveDraft(w, mut) { mut(w.draft); S.saveDraft(w.team.id, w.round, w.draft); }

  /* ───── Inicio ───── */
  V.inicio = function (c) {
    const w = UI.week(c);
    const team = c.team, comp = c.comp;
    const st = S.standings(comp.id);
    const pos = st.findIndex((r) => r.team.id === team.id) + 1;
    const lastPlayed = S.matchesOf(comp.id).filter((m) => m.status === 'played' && (m.homeId === team.id || m.awayId === team.id)).sort((a, b) => b.round - a.round)[0];
    const dr = w.draft;
    const ev = TC.evaluateMicrocycle(dr.microcycle, team.model, { sessionsRequired: comp.config.sessionsPerWeek });
    const errs = S.validateForSubmit(team, dr);
    const steps = [
      ['modelo', 'Modelo de juego', !!team.model.updatedAt],
      ['microciclo', 'Microciclo', dr.microcycle.sessions.every((s) => s.objective)],
      ['microciclo', 'Tareas en sesiones', dr.microcycle.sessions.some((s) => s.tasks.length)],
      ['rival', 'Análisis del rival', ((dr.plan.sections || {}).fortalezas || '').length > 10],
      ['plan', 'Plan de partido (A–H)', ((dr.plan.sections || {}).relacion || '').length >= 20 && dr.plan.linkedSessions.length > 0],
      ['alineacion', 'Alineación', dr.lineup.slots.filter(Boolean).length === 11],
    ];
    const evs = S.evaluationsFor(team.id);
    const tot = evs.length ? TC.avg(evs.map((e) => Object.values((e.final || e.proposal).scores).reduce((a, b) => a + b, 0))) : 0;
    return `
    <div class="page-head"><h1>Hola, ${esc(c.user.name.split(' ')[0])}</h1><p class="muted">${esc(team.name)} · ${pos}º en la clasificación · ${esc(S.coachLevel(tot))}</p></div>
    <div class="grid g-hero">
      <section class="card match-hero">
        ${w.nm ? `<div class="eyebrow">Jornada ${w.round} · ${w.home ? '' : ''}${w.nm.home ? 'En casa' : 'Fuera'}</div>
        <div class="vs">${UI.teamBadge(team, 56)}<div class="vs-mid"><b>VS</b><small>${w.rd && w.rd.status === 'open' ? 'Entregas abiertas' : 'Pendiente de apertura'}</small></div>${UI.teamBadge(w.rival, 56)}</div>
        <div class="vs-names"><span>${esc(team.name)}</span><span>${esc(w.rival.name)}</span></div>
        <div class="row wrap center">
          ${w.sub ? UI.pill('Entregado v' + w.sub.version, 'ok') : UI.pill('Sin entregar', 'warn')}
          <button class="btn primary" data-go="plan">Preparar y entregar</button>
          <button class="btn" data-go="rival">Ver scouting</button>
          <button class="btn ghost" data-go="partido">Centro de partido</button>
        </div>` : '<h2>Temporada terminada</h2><button class="btn" data-go="clasificacion">Ver clasificación final</button>'}
      </section>
      <section class="card">
        <h3>Preparación de la semana</h3>
        <ul class="checklist">${steps.map(([v, l, ok]) => `<li class="${ok ? 'done' : ''}"><a href="#${v}" data-go="${v}"><span class="tick">${ok ? '✓' : ''}</span>${esc(l)}</a></li>`).join('')}</ul>
        <div class="kpis"><div><small>Coherencia del microciclo</small><b>${ev.score25}<i>/25</i></b></div><div><small>Pendientes para entregar</small><b>${errs.length}</b></div></div>
      </section>
    </div>
    <div class="grid g2">
      <section class="card"><div class="card-head"><h3>Indicadores colectivos</h3><a href="#equipo" data-go="equipo" class="link">Evolución</a></div>${UI.indicatorBars(team.indicators)}</section>
      <section class="card"><div class="card-head"><h3>Clasificación</h3><a href="#clasificacion" data-go="clasificacion" class="link">Completa</a></div>${UI.miniTable(st, team.id)}
        ${lastPlayed ? `<div class="last"><span class="eyebrow">Último partido · J${lastPlayed.round}</span><a href="#informe" data-go="informe" data-p='${JSON.stringify({ m: lastPlayed.id })}' class="result-line">${esc(S.getTeam(lastPlayed.homeId).name)} <b>${lastPlayed.result.score[0]} - ${lastPlayed.result.score[1]}</b> ${esc(S.getTeam(lastPlayed.awayId).name)}</a></div>` : ''}
      </section>
    </div>`;
  };
  UI.indicatorBars = function (ind, proj) {
    let grp = '';
    return `<div class="ind-list">${TC.INDICATORS.map(([k, l, g]) => {
      const head = g !== grp ? `<div class="ind-grp">${esc((grp = g))}</div>` : '';
      const v = ind[k], p = proj ? proj[k] : null;
      const d = p != null ? TC.round1(p - v) : 0;
      return `${head}<div class="ind"><span>${esc(l)}</span><span class="ibar"><i style="width:${v}%"></i>${p != null && d > 0 ? `<em style="left:${v}%;width:${d}%"></em>` : ''}${p != null && d < 0 ? `<u style="left:${p}%;width:${-d}%"></u>` : ''}</span><b>${Math.round(v)}${p != null && Math.abs(d) >= 0.1 ? `<small class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</small>` : ''}</b></div>`;
    }).join('')}</div>`;
  };
  UI.miniTable = function (st, myId) {
    return `<table class="table compact"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>Pts</th></tr></thead><tbody>${st.map((r, i) => `<tr class="${r.team.id === myId ? 'me' : ''}"><td>${i + 1}</td><td>${UI.teamBadge(r.team, 20)} ${esc(r.team.name)}</td><td>${r.pj}</td><td>${r.dg > 0 ? '+' : ''}${r.dg}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>`;
  };

  /* ───── Mi equipo ───── */
  V.equipo = function (c) {
    const t = c.team;
    const hist = t.indicatorHistory || [];
    const evs = S.evaluationsFor(t.id);
    const tot = evs.length ? TC.avg(evs.map((e) => Object.values((e.final || e.proposal).scores).reduce((a, b) => a + b, 0))) : 0;
    return `<div class="page-head"><h1>Mi equipo</h1><p class="muted">Identidad del club e indicadores colectivos. Los indicadores sólo cambian con el entrenamiento que entregas.</p></div>
    <div class="grid g2">
      <section class="card"><h3>Identidad</h3>
        <form data-submit="saveIdentity" class="stack">
          <div class="row">${UI.teamBadge(t, 64)}<div class="grow stack">
            <label class="field"><span>Nombre del equipo</span><input id="team-name" name="name" value="${esc(t.name)}" required></label>
            <div class="row"><label class="field"><span>Siglas</span><input id="team-short" name="short" value="${esc(t.short)}" maxlength="3"></label>
            <label class="field"><span>Color</span><input id="team-color" type="color" name="color" value="${esc(t.color)}"></label></div></div></div>
          <button class="btn primary" type="submit">Guardar identidad</button>
        </form>
        <div class="kpis"><div><small>Potencial medio de la plantilla</small><b>${TC.squadPotential(t.players)}</b></div><div><small>Nivel de entrenador</small><b class="sm">${esc(S.coachLevel(tot))}</b></div><div><small>Nota académica media</small><b>${evs.length ? TC.round1(tot) : '—'}<i>/100</i></b></div></div>
        <p class="note">Todos los equipos empiezan con el mismo potencial medio; cambian los perfiles de los jugadores.</p>
      </section>
      <section class="card"><h3>Indicadores colectivos</h3>${UI.indicatorBars(t.indicators)}</section>
    </div>
    <section class="card"><h3>Evolución por jornada</h3>${hist.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Jornada</th><th>Cambios por el entrenamiento</th><th>Factor de coherencia</th></tr></thead><tbody>${hist.map((h) => `<tr><td>J${h.round}</td><td>${h.log.filter((l) => l.delta > 0).map((l) => `<span class="chip up">${esc(TC.IND_LABEL[l.k])} +${l.delta}</span>`).join(' ') || '<span class="muted">Sin mejoras</span>'} ${h.log.filter((l) => l.delta < 0).map((l) => `<span class="chip down">${esc(TC.IND_LABEL[l.k])} ${l.delta}</span>`).join(' ')}</td><td>${h.coherenceFactor}${h.fatiguePenalty < 1 ? ` · fatiga ×${h.fatiguePenalty}` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aún no se ha disputado ninguna jornada.</p>'}</section>
    <section class="card">${UI.soon(4, 'Logros, palmarés e historial de temporadas.')}</section>`;
  };
  A.saveIdentity = (f) => { const d = UI.formData(f); S.updateTeamIdentity(UI.ctx().team.id, d); UI.toast('Identidad guardada.'); UI.render(); };

  /* ───── Plantilla ───── */
  V.plantilla = function (c, p) {
    const t = c.team;
    const order = Object.keys(TC.POSITIONS);
    const sort = (p && p.sort) || 'pos';
    const list = t.players.slice().sort((a, b) => (sort === 'pos' ? order.indexOf(a.pos) - order.indexOf(b.pos) || TC.playerRating(b) - TC.playerRating(a) : sort === 'rating' ? TC.playerRating(b) - TC.playerRating(a) : b.fatigue - a.fatigue));
    return `<div class="page-head"><h1>Plantilla</h1><p class="muted">20 jugadores. Pulsa en un jugador para ver su ficha completa.</p></div>
    <div class="card"><div class="row wrap"><span class="muted">Ordenar:</span>${[['pos', 'Posición'], ['rating', 'Valoración'], ['fatiga', 'Fatiga']].map(([k, l]) => `<button class="btn sm ${sort === k ? 'primary' : 'ghost'}" data-go="plantilla" data-p='{"sort":"${k}"}'>${l}</button>`).join('')}</div>
    <div class="tablewrap"><table class="table squad"><thead><tr><th>Pos</th><th>Jugador</th><th>Perfil</th><th>Edad</th><th>Pie</th><th>Val.</th><th>Fortalezas</th><th>Fatiga</th><th>Confianza</th><th>Forma</th></tr></thead><tbody>
    ${list.map((pl) => { const sw = TC.strengthsWeaknesses(pl); const r = TC.playerRating(pl); return `<tr class="click" data-go="jugador" data-p='{"id":"${pl.id}"}'><td><span class="pos ${TC.POSITIONS[pl.pos].line}">${pl.pos}</span></td><td><b>${esc(pl.name)}</b><small class="muted"> ${pl.sec.join(', ')}</small></td><td class="muted">${esc(pl.profile)}</td><td>${pl.age}</td><td>${pl.foot[0]}</td><td><span class="rt ${UI.attrClass(r)}">${r}</span></td><td class="muted small">${esc(sw.top.slice(0, 2).join(', '))}</td><td>${UI.bar(pl.fatigue, 100, pl.fatigue > 50 ? 'bad' : pl.fatigue > 30 ? 'warn' : '')}</td><td>${pl.confidence}</td><td>${(pl.form || []).map((x) => `<span class="fm ${x >= 7 ? 'hi' : x < 6 ? 'lo' : ''}">${x}</span>`).join('') || '<span class="muted">—</span>'}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
  };
  V.jugador = function (c, p) {
    const t = c.team; const pl = t.players.find((x) => x.id === (p && p.id)) || t.players[0];
    const sw = TC.strengthsWeaknesses(pl); const r = TC.playerRating(pl);
    const groups = Object.entries(TC.ATTR_GROUPS);
    const gAvg = (g) => Math.round(TC.avg(g.attrs.map((a) => pl.attrs[a[0]])));
    return `<div class="page-head"><a href="#plantilla" data-go="plantilla" class="link">← Plantilla</a></div>
    <section class="card player-head">
      <div class="pcard"><span class="pc-r">${r}</span><span class="pc-pos">${pl.pos}</span><b>${esc(pl.name)}</b><small>${esc(pl.profile)}</small></div>
      <dl class="facts"><div><dt>Posición</dt><dd>${esc(TC.POSITIONS[pl.pos].label)}</dd></div><div><dt>Secundarias</dt><dd>${pl.sec.join(', ') || '—'}</dd></div><div><dt>Edad</dt><dd>${pl.age}</dd></div><div><dt>Pierna</dt><dd>${pl.foot}</dd></div><div><dt>Altura</dt><dd>${pl.height} cm</dd></div><div><dt>Estado físico</dt><dd>${100 - Math.round(pl.fatigue * 0.6)}%</dd></div><div><dt>Fatiga</dt><dd>${pl.fatigue}</dd></div><div><dt>Confianza</dt><dd>${pl.confidence}</dd></div><div><dt>Rendimiento reciente</dt><dd>${(pl.form || []).join(' · ') || '—'}</dd></div></dl>
      <div class="sw"><div><h4>Fortalezas</h4>${sw.top.map((x) => `<span class="chip up">${esc(x)}</span>`).join('')}</div><div><h4>Debilidades</h4>${sw.low.map((x) => `<span class="chip down">${esc(x)}</span>`).join('')}</div>
      <div class="gsum">${groups.map(([k, g]) => `<div><small>${g.label}</small><b class="${UI.attrClass(gAvg(g))}">${gAvg(g)}</b></div>`).join('')}</div></div>
    </section>
    <div class="grid g4">${groups.map(([k, g]) => `<section class="card"><h3>${g.label}</h3>${g.attrs.map(([a, l]) => `<div class="attr"><span>${esc(l)}</span>${UI.bar(pl.attrs[a], 100, UI.attrClass(pl.attrs[a]))}<b class="${UI.attrClass(pl.attrs[a])}">${pl.attrs[a]}</b></div>`).join('')}</section>`).join('')}</div>`;
  };

  /* ───── Modelo de juego ───── */
  V.modelo = function (c) {
    const m = c.team.model;
    const rel = Object.entries(TC.modelRelevance(m)).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return `<div class="page-head"><h1>Modelo de juego</h1><p class="muted">Define comportamientos colectivos en cada fase y momento. Justifica las decisiones importantes.</p></div>
    <form data-submit="saveModel" class="stack">
      <section class="card"><label class="field"><span>Identidad del equipo (una frase)</span><input id="m-identity" name="identity" value="${esc(m.identity)}" placeholder="Ej. Dominar con balón y recuperar rápido tras pérdida"></label>
        <div class="row wrap"><span class="muted small">Contenidos prioritarios según tu modelo:</span>${rel.map(([k]) => `<span class="chip">${esc(TC.IND_LABEL[k])}</span>`).join('')}</div></section>
      <div class="grid g2">
      ${Object.entries(TC.MODEL_FIELDS).map(([k, grp]) => `<section class="card"><h3>${esc(grp.label)}</h3><div class="fields">
        ${grp.fields.map(([f, l, opts]) => `<label class="field"><span>${esc(l)}</span><select id="m-${f}" name="${f}">${UI.opts(opts, m[f])}</select></label>`).join('')}</div>
        <label class="field"><span>Justificación</span><textarea id="m-notes-${k}" name="notes.${k}" rows="3" placeholder="¿Por qué este comportamiento encaja con tu plantilla?">${esc((m.notes || {})[k] || '')}</textarea></label></section>`).join('')}
      </div>
      <div class="sticky-actions"><span class="muted small">${m.updatedAt ? 'Guardado ' + UI.fmtDate(m.updatedAt) + ` · ${(c.team.modelVersions || []).length} versiones` : 'Aún no guardado'}</span><button class="btn primary" type="submit">Guardar modelo</button></div>
    </form>`;
  };
  A.saveModel = (f) => {
    const d = UI.formData(f); const notes = {};
    for (const k of Object.keys(d)) if (k.startsWith('notes.')) { notes[k.slice(6)] = d[k]; delete d[k]; }
    d.notes = notes; S.saveModel(UI.ctx().team.id, d); UI.toast('Modelo de juego guardado.'); UI.render();
  };

  /* ───── Microciclo ───── */
  V.microciclo = function (c) {
    const w = UI.week(c); const mc = w.draft.microcycle; const ed = w.editable;
    const dis = ed ? '' : 'disabled';
    return `<div class="page-head"><h1>Microciclo · Jornada ${w.round}</h1><p class="muted">Planifica la semana antes del partido contra ${esc(w.rival ? w.rival.name : '—')}. El profesor pide ${w.comp.config.sessionsPerWeek} sesiones.</p></div>
    ${lockNote(w)}
    <div class="week">
      ${mc.sessions.map((s, i) => {
        const se = TC.evaluateSession(s);
        return `<article class="day card">
          <div class="day-head"><select ${dis} data-change="sessField" data-s="${i}" data-f="day" class="mini" aria-label="Día">${UI.opts(TC.DAYS, s.day)}</select>${UI.pill(se.score + '/100', se.score >= 70 ? 'ok' : se.score >= 45 ? 'warn' : 'bad')}${ed ? `<button class="icon" data-act="removeSession" data-s="${i}" title="Eliminar sesión" aria-label="Eliminar sesión">×</button>` : ''}</div>
          <label class="field"><span>Tipo de sesión</span><select ${dis} data-change="sessField" data-s="${i}" data-f="type">${UI.opts(TC.SESSION_TYPES, s.type)}</select></label>
          <label class="field"><span>Objetivo principal</span><select ${dis} data-change="sessField" data-s="${i}" data-f="objective"><option value="">— Elige —</option>${UI.opts(TC.INDICATORS.map((x) => [x[0], x[1]]), s.objective)}</select></label>
          <label class="field"><span>Objetivos secundarios</span><select ${dis} multiple size="3" data-change="sessMulti" data-s="${i}">${TC.INDICATORS.map((x) => `<option value="${x[0]}" ${(s.secondary || []).includes(x[0]) ? 'selected' : ''}>${esc(x[1])}</option>`).join('')}</select></label>
          <div class="row"><label class="field"><span>Duración (min)</span><input ${dis} type="number" min="0" max="150" value="${s.duration}" data-change="sessField" data-s="${i}" data-f="duration"></label>
          <label class="field"><span>Intensidad (1-10)</span><input ${dis} type="number" min="1" max="10" value="${s.intensity}" data-change="sessField" data-s="${i}" data-f="intensity"></label></div>
          <div class="load">Carga estimada <b>${TC.sessionLoad(s)}</b> UA</div>
          <label class="field"><span>Contenidos</span><textarea ${dis} rows="2" data-change="sessField" data-s="${i}" data-f="contents">${esc(s.contents)}</textarea></label>
          <label class="field"><span>Relación con el rival</span><textarea ${dis} rows="2" data-change="sessField" data-s="${i}" data-f="rivalLink" placeholder="¿Qué del rival justifica esta sesión?">${esc(s.rivalLink)}</textarea></label>
          <label class="field"><span>Relación con el modelo</span><textarea ${dis} rows="2" data-change="sessField" data-s="${i}" data-f="modelLink">${esc(s.modelLink || '')}</textarea></label>
          <div class="tasks"><div class="eyebrow">Tareas</div>
            ${s.tasks.map((t, j) => { const e = TC.evaluateTask(t); return `<div class="task-row">${UI.drill.mini(t.board)}<a href="#tarea" data-go="tarea" data-p='{"s":${i},"t":${j}}'><b>${esc(t.name || 'Tarea sin nombre')}</b><small>${esc((TC.TASK_TYPES[t.type] || {}).label || '')} · ${esc(TC.IND_LABEL[t.objective] || 'sin objetivo')} · ${e.minutes} min</small></a>${UI.pill(e.score, e.score >= 70 ? 'ok' : e.score >= 45 ? 'warn' : 'bad')}${ed ? `<button class="icon" data-act="removeTask" data-s="${i}" data-t="${j}" aria-label="Quitar tarea">×</button>` : ''}</div>`; }).join('') || '<p class="muted small">Sin tareas.</p>'}
            ${ed ? `<div class="row wrap"><button class="btn sm" data-go="tarea" data-p='{"s":${i},"t":"new"}'>Nueva tarea</button><button class="btn sm ghost" data-go="biblioteca" data-p='{"s":${i}}'>Desde biblioteca</button></div>` : ''}
          </div>
        </article>`;
      }).join('')}
      <article class="day card fixed"><div class="day-head"><b>Sábado</b></div><div class="match-day">PARTIDO<small>vs ${esc(w.rival ? w.rival.name : '—')}</small></div></article>
      <article class="day card fixed rest"><div class="day-head"><b>Domingo</b></div><div class="match-day">Descanso</div></article>
    </div>
    ${ed ? `<div class="row"><button class="btn ghost" data-act="addSession">Añadir sesión</button></div>` : ''}
    <section class="card"><label class="field"><span>Justificación de la distribución semanal</span><textarea ${dis} rows="3" data-change="microJust" placeholder="Explica por qué ordenas así cargas y contenidos.">${esc(mc.justification)}</textarea></label></section>
    <div id="micro-eval">${UI.microEvalPanel(c, w)}</div>`;
  };
  UI.microEvalPanel = function (c, w) {
    const ev = TC.evaluateMicrocycle(w.draft.microcycle, c.team.model, { sessionsRequired: c.comp.config.sessionsPerWeek, afterMatch: w.round > 1 });
    const proj = TC.computeLearning(c.team.indicators, w.draft.microcycle, ev);
    const maxL = Math.max(1, ...w.draft.microcycle.sessions.map(TC.sessionLoad));
    return `<div class="grid g2">
      <section class="card"><div class="card-head"><h3>Coherencia del microciclo</h3><span class="score">${ev.score25}<i>/25</i></span></div>
        ${ev.criteria.map((cr) => `<div class="crit"><div class="crit-h"><span>${esc(cr.label)}</span><b>${TC.round1(cr.s * cr.max)}/${cr.max}</b></div>${UI.bar(cr.s * 100, 100, cr.s >= 0.7 ? 'hi' : cr.s >= 0.45 ? 'mid' : 'lo')}<p class="small muted">${esc(cr.reason)}</p></div>`).join('')}
        <h4>Carga por día</h4><div class="loadchart">${w.draft.microcycle.sessions.map((s) => `<div><i style="height:${(TC.sessionLoad(s) / maxL) * 100}%" class="${s.intensity > 6 ? 'hi' : ''}"></i><small>${esc(s.day.slice(0, 3))}</small></div>`).join('')}<div><i style="height:100%" class="match"></i><small>Sáb</small></div></div>
        <p class="small muted">Carga total ${ev.totalLoad} UA (${Math.round(ev.fatigueLoad * 100)}% de la referencia para ${c.comp.config.sessionsPerWeek} sesiones).</p>
      </section>
      <section class="card"><div class="card-head"><h3>Proyección de aprendizaje</h3>${UI.pill('Cálculo real del motor', 'info')}</div>
        <p class="small muted">Así cambiarían los indicadores si entregas esta semana. Más sesiones del mismo contenido rinden cada vez menos; la fatiga y la incoherencia reducen la mejora. Factor de coherencia ×${proj.coherenceFactor}${proj.fatiguePenalty < 1 ? `, penalización por fatiga ×${proj.fatiguePenalty}` : ''}.</p>
        ${UI.indicatorBars(c.team.indicators, proj.indicators)}
      </section></div>`;
  };
  function refreshMicroEval() { const c = UI.ctx(); const box = UI.$('#micro-eval'); if (box) box.innerHTML = UI.microEvalPanel(c, UI.week(c)); }
  A.sessField = (el) => {
    const c = UI.ctx(); const w = UI.week(c); const i = +el.dataset.s, f = el.dataset.f;
    saveDraft(w, (d) => { d.microcycle.sessions[i][f] = ['duration', 'intensity'].includes(f) ? Math.max(0, +el.value) : el.value; });
    if (['objective', 'type', 'day', 'duration', 'intensity'].includes(f)) UI.render(); else refreshMicroEval();
  };
  A.sessMulti = (el) => { const c = UI.ctx(); const w = UI.week(c); const vals = Array.from(el.selectedOptions).map((o) => o.value); saveDraft(w, (d) => { d.microcycle.sessions[+el.dataset.s].secondary = vals; }); refreshMicroEval(); };
  A.microJust = (el) => { const c = UI.ctx(); const w = UI.week(c); saveDraft(w, (d) => { d.microcycle.justification = el.value; }); refreshMicroEval(); };
  A.addSession = () => { const c = UI.ctx(); const w = UI.week(c); saveDraft(w, (d) => { d.microcycle.sessions.push({ id: S.uid('s'), day: 'Jueves', type: 'Trabajo sobre el rival', objective: '', secondary: [], contents: '', duration: 80, intensity: 5, rivalLink: '', modelLink: '', tasks: [] }); }); UI.render(); };
  A.removeSession = (el) => UI.ask('Eliminar sesión', 'Se borrará la sesión y sus tareas de este microciclo.', 'Eliminar', () => { const c = UI.ctx(); const w = UI.week(c); saveDraft(w, (d) => { const s = d.microcycle.sessions.splice(+el.dataset.s, 1)[0]; d.plan.linkedSessions = d.plan.linkedSessions.filter((x) => x !== s.id); }); UI.render(); }, true);
  A.removeTask = (el) => { const c = UI.ctx(); const w = UI.week(c); saveDraft(w, (d) => { d.microcycle.sessions[+el.dataset.s].tasks.splice(+el.dataset.t, 1); }); UI.render(); };

  /* ───── Constructor de tareas ───── */
  function blankTask() { return { name: '', type: 'posicion', objective: '', phase: 'Organización ofensiva', attackers: 6, defenders: 4, jokers: 0, goalkeepers: 1, length: 40, width: 35, duration: 5, series: 4, pause: 1, rules: [], cues: '', expected: '', success: '', variants: '', organization: '', opposition: 'si', direction: 'si' }; }
  V.tarea = function (c, p) {
    const w = UI.week(c); p = p || {};
    let t, mode;
    if (p.custom) { t = S.clone(c.team.customTasks.find((x) => x.id === p.custom) || blankTask()); mode = 'custom'; }
    else if (p.s != null) { const s = w.draft.microcycle.sessions[p.s]; t = p.t === 'new' ? Object.assign(blankTask(), { objective: s ? s.objective : '' }) : S.clone(s.tasks[p.t]); mode = 'session'; }
    else { t = blankTask(); mode = 'custom'; }
    UI.state.taskEdit = { mode, p, t };
    const ed = mode === 'custom' || w.editable;
    const dis = ed ? '' : 'disabled';
    const sess = p.s != null ? w.draft.microcycle.sessions[p.s] : null;
    const num = (n, l, v, min, max, step) => `<label class="field"><span>${l}</span><input ${dis} type="number" name="${n}" id="t-${n}" value="${esc(v)}" min="${min}" max="${max}" step="${step || 1}"></label>`;
    return `<div class="page-head"><a href="#microciclo" data-go="${mode === 'session' ? 'microciclo' : 'biblioteca'}" class="link">← ${mode === 'session' ? 'Microciclo' : 'Biblioteca'}</a><h1>Constructor de tareas</h1>${sess ? `<p class="muted">Sesión del ${esc(sess.day)} · objetivo de la sesión: ${esc(TC.IND_LABEL[sess.objective] || '—')}</p>` : ''}</div>
    <div class="grid g-task">
      <form class="card stack" data-submit="saveTask" data-input="taskLive" data-change="taskLive" id="task-form">
        <div class="row"><label class="field grow"><span>Nombre</span><input ${dis} id="t-name" name="name" value="${esc(t.name)}" required placeholder="Ej. Salida 6c4 ante presión"></label></div>
        <div class="drill-in"><div class="eyebrow">Pizarra del ejercicio</div>${UI.drill.slot('task', t.board, ed, 'Dibujar el ejercicio')}</div>
        <div class="fields">
          <label class="field"><span>Tipología</span><select ${dis} name="type" id="t-type">${UI.opts(Object.entries(TC.TASK_TYPES).map(([k, v]) => [k, v.label]), t.type)}</select></label>
          <label class="field"><span>Objetivo (contenido entrenado)</span><select ${dis} name="objective" id="t-objective"><option value="">— Elige —</option>${UI.opts(TC.INDICATORS.map((x) => [x[0], x[1]]), t.objective)}</select></label>
          <label class="field"><span>Fase o momento</span><select ${dis} name="phase" id="t-phase">${UI.opts(['Organización ofensiva', 'Organización defensiva', 'Transición ataque-defensa', 'Transición defensa-ataque', 'Balón parado'], t.phase)}</select></label>
          <label class="field"><span>Contenido táctico</span><input ${dis} name="content" id="t-content" value="${esc(t.content || '')}" placeholder="Ej. fijar y atacar lado débil"></label>
        </div>
        <h4>Jugadores y espacio</h4>
        <div class="fields f4">${num('attackers', 'Atacantes', t.attackers, 0, 11)}${num('defenders', 'Defensores', t.defenders, 0, 11)}${num('jokers', 'Comodines', t.jokers, 0, 6)}${num('goalkeepers', 'Porteros', t.goalkeepers, 0, 2)}
        ${num('length', 'Largo (m)', t.length, 5, 105)}${num('width', 'Ancho (m)', t.width, 5, 68)}
        <label class="field"><span>Oposición</span><select ${dis} name="opposition" id="t-opposition">${UI.opts([['si', 'Con oposición'], ['no', 'Sin oposición']], t.opposition)}</select></label>
        <label class="field"><span>Dirección de juego</span><select ${dis} name="direction" id="t-direction">${UI.opts([['si', 'Con dirección'], ['no', 'Sin dirección']], t.direction)}</select></label></div>
        <h4>Volumen</h4>
        <div class="fields f4">${num('duration', 'Duración por serie (min)', t.duration, 1, 30)}${num('series', 'Series', t.series, 1, 10)}${num('pause', 'Pausa (min)', t.pause, 0, 5, 0.5)}</div>
        <h4>Reglas de provocación</h4>
        <div class="checks">${TC.PROVOCATIONS.map(([k, l]) => `<label class="check"><input ${dis} type="checkbox" name="rules" value="${k}" ${(t.rules || []).includes(k) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
        <label class="field"><span>Otras reglas y organización</span><textarea ${dis} name="organization" id="t-organization" rows="2">${esc(t.organization || '')}</textarea></label>
        <div class="fields">
          <label class="field"><span>Consignas del entrenador</span><textarea ${dis} name="cues" id="t-cues" rows="2">${esc(t.cues)}</textarea></label>
          <label class="field"><span>Comportamientos esperados</span><textarea ${dis} name="expected" id="t-expected" rows="2">${esc(t.expected)}</textarea></label>
          <label class="field"><span>Criterios de éxito</span><textarea ${dis} name="success" id="t-success" rows="2">${esc(t.success)}</textarea></label>
          <label class="field"><span>Variantes</span><textarea ${dis} name="variants" id="t-variants" rows="2">${esc(t.variants)}</textarea></label>
        </div>
        ${ed ? `<div class="row wrap end">${mode === 'session' ? '<label class="check"><input type="checkbox" name="toLibrary" value="1"><span>Guardar también en mi biblioteca</span></label>' : ''}<button class="btn primary" type="submit">${mode === 'session' ? 'Guardar en la sesión' : 'Guardar en mi biblioteca'}</button></div>` : ''}
      </form>
      <aside id="task-eval" class="stack">${UI.taskEvalPanel(t)}</aside>
    </div>`;
  };
  UI.taskEvalPanel = function (t) {
    const e = TC.evaluateTask(t);
    return `<section class="card"><div class="card-head"><h3>Evaluación metodológica</h3><span class="score">${e.score}<i>/100</i></span></div>
      <p class="small muted">${e.players} jugadores · ${e.m2} m²/jugador · ${e.minutes} min útiles. Ninguna tipología es mejor en sí misma: todo depende del objetivo.</p>
      ${e.factors.map((f) => `<div class="crit"><div class="crit-h"><span>${esc(f.label)}</span><b>${Math.round(f.s * 100)}</b></div>${UI.bar(f.s * 100, 100, f.s >= 0.7 ? 'hi' : f.s >= 0.45 ? 'mid' : 'lo')}<p class="small muted">${esc(f.reason)}</p></div>`).join('')}
      ${e.recs.length ? `<h4>Recomendaciones</h4><ul class="small">${e.recs.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</section>
      <section class="card tutor"><div class="card-head"><h3>Tutor metodológico</h3>${UI.pill('Por reglas · sin IA', 'info')}</div><p class="small muted">No te da la solución: te hace preguntas para revisar la tarea.</p><ul>${e.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></section>`;
  };
  function readTask(f) {
    const d = UI.formData(f); const base = UI.state.taskEdit.t;
    const t = Object.assign({}, base, d);
    t.rules = [].concat(d.rules || []);
    for (const k of ['attackers', 'defenders', 'jokers', 'goalkeepers', 'length', 'width', 'duration', 'series', 'pause']) t[k] = +d[k] || 0;
    delete t.toLibrary;
    return t;
  }
  A.taskLive = (el) => { const f = el.closest('form') || el; const box = UI.$('#task-eval'); if (box) box.innerHTML = UI.taskEvalPanel(readTask(f)); };
  A.saveTask = (f) => {
    const c = UI.ctx(); const te = UI.state.taskEdit; const t = readTask(f); const toLib = !!UI.formData(f).toLibrary;
    if (!t.objective) S.err('Elige el objetivo de la tarea.');
    if (te.mode === 'custom') { S.saveCustomTask(c.team.id, t); UI.toast('Tarea guardada en tu biblioteca.'); UI.go('biblioteca'); return; }
    const w = UI.week(c);
    saveDraft(w, (d) => { const s = d.microcycle.sessions[te.p.s]; if (!t.id) t.id = S.uid('task'); if (te.p.t === 'new') s.tasks.push(t); else s.tasks[te.p.t] = t; });
    if (toLib) S.saveCustomTask(c.team.id, Object.assign({}, t, { id: null }));
    UI.toast('Tarea guardada en la sesión.'); UI.go('microciclo');
  };

  /* ───── Biblioteca ───── */
  V.biblioteca = function (c, p) {
    const w = UI.week(c); p = p || {};
    const target = p.s != null ? w.draft.microcycle.sessions[p.s] : null;
    const card = (t, src) => { const e = TC.evaluateTask(t); return `<article class="card lib"><div class="card-head"><h4>${esc(t.name)}</h4>${UI.pill(e.score, e.score >= 70 ? 'ok' : e.score >= 45 ? 'warn' : 'bad')}</div>
      <p class="small muted">${esc(TC.TASK_TYPES[t.type].label)} · ${esc(TC.IND_LABEL[t.objective])} · ${TC.taskPlayers(t)} jug. · ${t.length}×${t.width} m · ${e.minutes} min</p>
      <p class="small">${esc(t.cues)}</p>
      <div class="row wrap">${target && w.editable ? `<button class="btn sm primary" data-act="libAdd" data-src="${src}" data-s="${p.s}">Añadir al ${esc(target.day)}</button>` : ''}${src.startsWith('c:') ? `<button class="btn sm ghost" data-go="tarea" data-p='{"custom":"${t.id}"}'>Editar</button><button class="btn sm ghost" data-act="libDel" data-id="${t.id}">Borrar</button>` : ''}</div></article>`; };
    return `<div class="page-head"><h1>Biblioteca de tareas</h1><p class="muted">${target ? `Elige una tarea para la sesión del <b>${esc(target.day)}</b>. Después puedes adaptarla.` : 'Tareas reutilizables. Copia y adapta, o crea las tuyas.'}</p></div>
    <div class="row wrap"><button class="btn" data-go="tarea" data-p='{}'>Crear tarea personalizada</button>${target ? '<a class="btn ghost" href="#microciclo" data-go="microciclo">Volver al microciclo</a>' : ''}</div>
    <h2 class="sec">Mis tareas (${c.team.customTasks.length})</h2>
    <div class="grid g3">${c.team.customTasks.map((t) => card(t, 'c:' + t.id)).join('') || '<p class="muted">Todavía no has guardado tareas propias.</p>'}</div>
    <h2 class="sec">Biblioteca de la academia</h2>
    <div class="grid g3">${TC.TASK_LIBRARY.map((t, i) => card(t, 'l:' + i)).join('')}</div>`;
  };
  A.libAdd = (el) => {
    const c = UI.ctx(); const w = UI.week(c); const src = el.dataset.src;
    const t = S.clone(src.startsWith('l:') ? TC.TASK_LIBRARY[+src.slice(2)] : c.team.customTasks.find((x) => x.id === src.slice(2)));
    t.id = S.uid('task');
    saveDraft(w, (d) => d.microcycle.sessions[+el.dataset.s].tasks.push(t));
    UI.toast('Tarea añadida. Revisa su adecuación a tu objetivo.'); UI.go('microciclo');
  };
  A.libDel = (el) => { S.deleteCustomTask(UI.ctx().team.id, el.dataset.id); UI.render(); };

  /* ───── Análisis del rival ───── */
  V.rival = function (c) {
    const w = UI.week(c);
    if (!w.rival) return '<div class="card"><p>No hay próximo rival.</p></div>';
    const sc = S.scouting(w.rival.id);
    return `<div class="page-head"><h1>Análisis del rival</h1><p class="muted">Informe de scouting de ${esc(w.rival.name)} antes de la jornada ${w.round}. Su plan de partido para esta jornada no es visible.</p></div>
    <div class="grid g2">
      <section class="card"><div class="card-head"><h3>Hechos observados</h3>${UI.pill('Datos de partidos', 'ok')}</div><ul class="facts-list">${sc.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        ${sc.results.length ? `<h4>Últimos resultados</h4><div class="results">${sc.results.map((r) => `<span class="res ${r.gf > r.gc ? 'w' : r.gf < r.gc ? 'l' : 'd'}">J${r.round} ${r.gf}-${r.gc} vs ${esc(r.opp)}</span>`).join('')}</div>` : ''}</section>
      <section class="card"><div class="card-head"><h3>Hipótesis</h3>${UI.pill('A confirmar', 'warn')}</div><ul class="facts-list hyp">${sc.hyp.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <h4>Jugadores destacados</h4>${sc.key.map((k) => `<div class="kp"><span class="pos">${k.pos}</span><b>${esc(k.name)}</b><small class="muted">${esc(k.note)}</small></div>`).join('')}</section>
    </div>
    <section class="card"><h3>¿Qué es lo más importante para tu planificación?</h3><p class="muted small">Escríbelo en el apartado A del plan de partido. Distingue lo que has visto de lo que supones.</p><button class="btn primary" data-go="plan">Ir al plan de partido</button></section>`;
  };

  /* ───── Plan de partido ───── */
  const PLAN_SECTIONS = [
    ['A', 'Análisis del rival', [['fortalezas', 'Fortalezas'], ['debilidades', 'Debilidades'], ['habituales', 'Comportamientos habituales'], ['amenazas', 'Amenazas principales']]],
    ['B', 'Objetivos propios', [['objetivos', 'Qué queremos conseguir'], ['espacios', 'Qué espacios queremos ocupar'], ['provocar', 'Qué comportamientos queremos provocar']]],
    ['C', 'Plan ofensivo', [['ofensivo', 'Estructura, salida, progresión, creación, finalización y ataque de espacios vulnerables']]],
    ['D', 'Plan defensivo', [['defensivo', 'Estructura, altura del bloque, presión, orientación, ajustes y protección de espacios']]],
    ['E', 'Transiciones', [['perdida', 'Tras pérdida'], ['recuperacion', 'Tras recuperación']]],
    ['F', 'Estrategia', [['abpOf', 'Acciones ofensivas'], ['abpDef', 'Acciones defensivas']]],
    ['G', 'Escenarios alternativos', [['escenarios', 'Si vamos ganando, perdiendo, si el rival cambia de estructura o si jugamos con diez']]],
  ];
  V.plan = function (c) {
    const w = UI.week(c); const pl = w.draft.plan; const ed = w.editable; const dis = ed ? '' : 'disabled';
    const tf = [['attStructure', 'Estructura con balón', Object.keys(TC.ATT_STRUCTURES)], ['buildUp', 'Salida de balón', ['corto', 'mixto', 'directo']], ['progression', 'Progresión', ['interior', 'exterior', 'mixta']], ['width', 'Amplitud', ['1', '2', '3', '4', '5']], ['tempo', 'Ritmo', ['pausado', 'medio', 'alto']], ['blockHeight', 'Altura del bloque', ['bajo', 'medio', 'alto']], ['pressType', 'Tipo de presión', ['zonal', 'al hombre', 'mixta']], ['pressOrientation', 'Orientación de la presión', ['hacia fuera', 'hacia dentro']], ['afterLoss', 'Tras pérdida', ['presión inmediata', 'mixta', 'repliegue']], ['afterRecovery', 'Tras recuperación', ['contraataque', 'ataque rápido', 'conservación']], ['risk', 'Riesgo asumido (1-5)', ['1', '2', '3', '4', '5']]];
    const byId = Object.fromEntries(c.team.players.map((p) => [p.id, p]));
    return `<div class="page-head"><h1>Plan de partido · Jornada ${w.round}</h1><p class="muted">vs ${esc(w.rival ? w.rival.name : '—')} · ${w.nm && w.nm.home ? 'en casa' : 'fuera'}. El plan se bloquea al entregarlo y el partido usa esa versión.</p></div>
    ${lockNote(w)}
    <div class="grid g-plan"><div class="stack">
    <section class="card"><h3>Decisiones tácticas del partido</h3><p class="small muted">Parten de tu modelo de juego; ajústalas al rival.</p>
      <div class="fields f3">${tf.map(([k, l, o]) => `<label class="field"><span>${l}</span><select ${dis} data-change="planTactic" data-k="${k}">${UI.opts(o, pl.tactics[k])}</select></label>`).join('')}</div></section>
    ${PLAN_SECTIONS.map(([L, title, fields]) => `<section class="card"><h3><span class="sec-l">${L}</span>${esc(title)}</h3>${fields.map(([k, l]) => `<label class="field"><span>${esc(l)}</span><textarea ${dis} rows="${fields.length === 1 ? 4 : 2}" data-change="planSection" data-k="${k}">${esc((pl.sections || {})[k] || '')}</textarea></label>`).join('')}
      ${L === 'A' ? '' : UI.drill.slot('w:plan.boards.' + L, (pl.boards || {})[L], ed, 'Dibujarlo en la pizarra')}
      ${L === 'G' ? `<h4>Instrucciones condicionales (modo asíncrono)</h4><p class="small muted">Se aplican solas durante el partido cuando se cumple la condición.</p>
        <div class="conds">${(pl.conditions || []).map((cd, i) => `<div class="cond"><select ${dis} data-change="condField" data-i="${i}" data-k="when">${UI.opts(Object.entries(TC.COND_WHEN), cd.when)}</select><span>desde el min</span><input ${dis} type="number" min="1" max="89" value="${cd.from}" data-change="condField" data-i="${i}" data-k="from" class="num"><select ${dis} data-change="condField" data-i="${i}" data-k="action">${UI.opts(Object.entries(TC.COND_ACTIONS).map(([k, v]) => [k, v.label]), cd.action)}</select>
          ${cd.action === 'sub' ? `<select ${dis} data-change="condField" data-i="${i}" data-k="out" aria-label="Sale"><option value="">Sale…</option>${w.draft.lineup.slots.filter(Boolean).map((id) => UI.opt(id, byId[id].name + ' (' + byId[id].pos + ')', cd.out)).join('')}</select><select ${dis} data-change="condField" data-i="${i}" data-k="in" aria-label="Entra"><option value="">Entra…</option>${(w.draft.lineup.bench || []).map((id) => UI.opt(id, byId[id].name + ' (' + byId[id].pos + ')', cd.in)).join('')}</select>` : ''}
          ${ed ? `<button class="icon" data-act="condDel" data-i="${i}" aria-label="Quitar">×</button>` : ''}</div>`).join('')}</div>
        ${ed ? '<button class="btn sm" data-act="condAdd">Añadir instrucción</button>' : ''}` : ''}</section>`).join('')}
    <section class="card required"><h3><span class="sec-l">H</span>Relación con el entrenamiento <small class="req">Obligatorio</small></h3>
      <p class="small muted">Marca qué sesiones de la semana prepararon los comportamientos que vas a utilizar.</p>
      <div class="checks">${w.draft.microcycle.sessions.map((s) => `<label class="check"><input ${dis} type="checkbox" data-change="planLink" value="${s.id}" ${pl.linkedSessions.includes(s.id) ? 'checked' : ''}><span><b>${esc(s.day)}</b> · ${esc(TC.IND_LABEL[s.objective] || 'sin objetivo')} · ${s.tasks.length} tareas</span></label>`).join('')}</div>
      <label class="field"><span>Explica la relación</span><textarea ${dis} rows="3" data-change="planSection" data-k="relacion">${esc((pl.sections || {}).relacion || '')}</textarea></label></section>
    </div>
    <aside class="stack sticky" id="plan-aside">${UI.planAside(c, w)}    </aside></div>`;
  };
  UI.planAside = function (c, w) {
    const pl = w.draft.plan, ed = w.editable;
    const pe = TC.evaluatePlan(pl, c.team.model, w.draft.microcycle, c.team);
    const ce = TC.evaluateCoherence(pl, c.team.model, w.draft.microcycle, c.team, null);
    const errs = S.validateForSubmit(c.team, w.draft);
    return `      <section class="card"><h3>Entrega</h3>
        ${errs.length ? `<ul class="errs">${errs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="ok-t">Todo listo para entregar.</p>'}
        ${ed ? `<button class="btn primary block" data-act="submitWeek" ${errs.length ? 'disabled' : ''}>${w.sub ? 'Entregar nueva versión' : 'Entregar jornada ' + w.round}</button>` : ''}
        <p class="small muted">Se guardará una versión bloqueada con tu modelo, microciclo, plan y alineación.</p>
        ${S.submissionsOf(c.team.id).filter((s) => s.round === w.round).map((s) => `<div class="small">v${s.version} · ${UI.fmtDate(s.submittedAt)} ${s.auto ? '(automática)' : ''}</div>`).join('')}
      </section>
      <section class="card"><div class="card-head"><h3>Orientación</h3>${UI.pill('No es la nota', 'info')}</div>
        <div class="crit"><div class="crit-h"><span>Plan de partido</span><b>${pe.score25}/25</b></div>${UI.bar(pe.score25, 25, 'mid')}</div>
        <div class="crit"><div class="crit-h"><span>Coherencia metodológica y táctica</span><b>${ce.score20}/20</b></div>${UI.bar(ce.score20, 20, 'mid')}</div>
        <ul class="small">${pe.criteria.concat(ce.criteria).filter((x) => x.s < 0.7).map((x) => `<li>${esc(x.reason)}</li>`).join('') || '<li>Sin avisos.</li>'}</ul>
      </section>`;
  };
  function refreshPlan() { const c = UI.ctx(); const box = UI.$('#plan-aside'); if (box) box.innerHTML = UI.planAside(c, UI.week(c)); }
  A.planTactic = (el) => { const w = UI.week(UI.ctx()); saveDraft(w, (d) => { d.plan.tactics[el.dataset.k] = el.value; }); refreshPlan(); };
  A.planSection = (el) => { const w = UI.week(UI.ctx()); saveDraft(w, (d) => { d.plan.sections = d.plan.sections || {}; d.plan.sections[el.dataset.k] = el.value; }); refreshPlan(); };
  A.planLink = (el) => { const w = UI.week(UI.ctx()); saveDraft(w, (d) => { d.plan.linkedSessions = d.plan.linkedSessions.filter((x) => x !== el.value); if (el.checked) d.plan.linkedSessions.push(el.value); }); refreshPlan(); };
  A.condAdd = () => { const w = UI.week(UI.ctx()); saveDraft(w, (d) => d.plan.conditions.push({ when: 'perdiendo', from: 65, action: 'mas_riesgo' })); UI.render(); };
  A.condDel = (el) => { const w = UI.week(UI.ctx()); saveDraft(w, (d) => d.plan.conditions.splice(+el.dataset.i, 1)); UI.render(); };
  A.condField = (el) => { const w = UI.week(UI.ctx()); saveDraft(w, (d) => { d.plan.conditions[+el.dataset.i][el.dataset.k] = el.dataset.k === 'from' ? +el.value : el.value; }); if (el.dataset.k === 'action') UI.render(); else refreshPlan(); };
  A.submitWeek = () => { const c = UI.ctx(); const w = UI.week(c); UI.ask('Entregar jornada ' + w.round, 'Se creará una versión bloqueada. El partido usará la última versión que entregues antes de que el profesor active la jornada.', 'Entregar', () => { const s = S.submit(c.team.id, w.round); UI.toast(`Entregado: versión ${s.version}.`); UI.render(); }); };

  /* ───── Alineación ───── */
  V.alineacion = function (c) {
    const w = UI.week(c); const lu = w.draft.lineup; const ed = w.editable; const dis = ed ? '' : 'disabled';
    const slots = TC.FORMATIONS[lu.formation];
    const byId = Object.fromEntries(c.team.players.map((p) => [p.id, p]));
    const used = new Set(lu.slots.filter(Boolean));
    const bench = new Set(lu.bench || []);
    return `<div class="page-head"><h1>Alineación y convocatoria · Jornada ${w.round}</h1><p class="muted">11 titulares y hasta 7 suplentes. Jugar fuera de posición reduce el rendimiento; la fatiga también.</p></div>
    ${lockNote(w)}
    <div class="grid g-lineup">
      <section class="card"><div class="row wrap"><label class="field"><span>Estructura base (sin balón)</span><select ${dis} data-change="luFormation">${UI.opts(Object.keys(TC.FORMATIONS), lu.formation)}</select></label>${ed ? '<button class="btn" data-act="luAuto">Alineación automática</button>' : ''}</div>
        <div class="pitch-wrap">${UI.pitchSvg(slots.map((s, i) => ({ x: s[1], y: s[2], label: byId[lu.slots[i]] ? byId[lu.slots[i]].name.split(' ')[0] : '?', num: i + 1, role: s[0], warn: byId[lu.slots[i]] && TC.posFit(byId[lu.slots[i]], s[0]) < 0.9 })), c.team.color)}</div></section>
      <section class="card"><h3>Titulares</h3>
        ${slots.map((s, i) => { const cur = byId[lu.slots[i]]; return `<div class="slot"><span class="pos ${TC.POSITIONS[s[0]].line}">${s[0]}</span><select ${dis} data-change="luSlot" data-i="${i}"><option value="">—</option>${c.team.players.slice().sort((a, b) => TC.playerRating(b, s[0]) * TC.posFit(b, s[0]) - TC.playerRating(a, s[0]) * TC.posFit(a, s[0])).map((p) => UI.opt(p.id, `${p.name} · ${p.pos} · ${Math.round(TC.playerRating(p, s[0]) * TC.posFit(p, s[0]))}${p.fatigue > 40 ? ' · fatiga ' + p.fatigue : ''}${used.has(p.id) && p.id !== lu.slots[i] ? ' (ya alineado)' : ''}`, lu.slots[i])).join('')}</select>${cur && TC.posFit(cur, s[0]) < 0.9 ? UI.pill('Fuera de posición', 'warn') : ''}</div>`; }).join('')}
        <h3>Suplentes</h3><div class="checks">${c.team.players.filter((p) => !used.has(p.id)).map((p) => `<label class="check"><input ${dis} type="checkbox" data-change="luBench" value="${p.id}" ${bench.has(p.id) ? 'checked' : ''}><span>${esc(p.name)} <small class="muted">${p.pos} · ${TC.playerRating(p)}</small></span></label>`).join('')}</div>
      </section></div>`;
  };
  UI.pitchSvg = function (tokens, color, opts) {
    opts = opts || {};
    return `<svg viewBox="0 0 1050 680" class="pitch" role="img" aria-label="Campo">${UI.pitchLines()}${tokens.map((t) => `<g transform="translate(${t.x * 10.5},${t.y * 6.8})"><circle r="24" fill="${esc(color)}" stroke="${t.warn ? '#f5b84b' : '#fff'}" stroke-width="${t.warn ? 4 : 2}"/><text y="7" text-anchor="middle" class="tk-n">${esc(t.role || t.num)}</text>${t.label ? `<text y="48" text-anchor="middle" class="tk-l">${esc(t.label)}</text>` : ''}</g>`).join('')}</svg>`;
  };
  UI.pitchLines = () => `<rect x="0" y="0" width="1050" height="680" class="grass"/>${Array.from({ length: 10 }, (_, i) => `<rect x="${i * 105}" y="0" width="52.5" height="680" class="stripe"/>`).join('')}<g class="lines" fill="none"><rect x="10" y="10" width="1030" height="660"/><line x1="525" y1="10" x2="525" y2="670"/><circle cx="525" cy="340" r="91.5"/><rect x="10" y="138" width="165" height="404"/><rect x="875" y="138" width="165" height="404"/><rect x="10" y="248" width="55" height="184"/><rect x="985" y="248" width="55" height="184"/><path d="M175 267 A91.5 91.5 0 0 1 175 413"/><path d="M875 267 A91.5 91.5 0 0 0 875 413"/></g>`;
  A.luFormation = (el) => { const c = UI.ctx(); const w = UI.week(c); saveDraft(w, (d) => { d.lineup = TC.autoLineup(c.team.players, el.value); }); UI.render(); };
  A.luAuto = () => { const c = UI.ctx(); const w = UI.week(c); saveDraft(w, (d) => { d.lineup = TC.autoLineup(c.team.players, d.lineup.formation); }); UI.toast('Alineación automática aplicada: revísala.'); UI.render(); };
  A.luSlot = (el) => { const w = UI.week(UI.ctx()); saveDraft(w, (d) => { const i = +el.dataset.i; const prev = d.lineup.slots.indexOf(el.value); if (prev >= 0 && prev !== i) d.lineup.slots[prev] = d.lineup.slots[i]; d.lineup.slots[i] = el.value || null; d.lineup.bench = (d.lineup.bench || []).filter((x) => !d.lineup.slots.includes(x)); }); UI.render(); };
  A.luBench = (el) => { const w = UI.week(UI.ctx()); saveDraft(w, (d) => { d.lineup.bench = (d.lineup.bench || []).filter((x) => x !== el.value); if (el.checked) { if (d.lineup.bench.length >= 7) S.err('Máximo 7 suplentes.'); d.lineup.bench.push(el.value); } }); UI.render(); };

  /* ───── Clasificación, ranking, historial ───── */
  V.clasificacion = function (c) {
    const comp = c.comp; const st = S.standings(comp.id); const my = c.team && c.team.id;
    return `<div class="page-head"><h1>Clasificación deportiva</h1><p class="muted">${esc(comp.name)} · se actualiza automáticamente con cada resultado. Independiente del ranking académico.</p></div>
    <div class="card"><div class="tablewrap"><table class="table standings"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th><th>Racha</th></tr></thead><tbody>
    ${st.map((r, i) => `<tr class="${r.team.id === my ? 'me' : ''}"><td>${i + 1}</td><td>${UI.teamBadge(r.team, 22)} ${esc(r.team.name)} ${r.team.ai ? '<small class="muted">· sistema</small>' : ''}</td><td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td><td>${r.gf}</td><td>${r.gc}</td><td>${r.dg > 0 ? '+' : ''}${r.dg}</td><td><b>${r.pts}</b></td><td>${r.form.slice(-5).map((x) => `<span class="res ${x === 'V' ? 'w' : x === 'D' ? 'l' : 'd'}">${x}</span>`).join('')}</td></tr>`).join('')}
    </tbody></table></div></div>
    <section class="card"><h3>Resultados por jornada</h3>${S.roundsOf(comp.id).map((rd) => `<div class="round-line"><b>J${rd.number}</b> ${UI.pill(rd.status === 'played' ? 'Disputada' : rd.status === 'open' ? 'Abierta' : 'Bloqueada', rd.status === 'played' ? 'ok' : rd.status === 'open' ? 'info' : '')}<div class="ms">${S.matchesOf(comp.id, rd.number).map((m) => `<a ${m.status === 'played' ? `href="#informe" data-go="informe" data-p='{"m":"${m.id}"}'` : ''} class="m ${m.status}">${esc(S.getTeam(m.homeId).short)} ${m.status === 'played' ? `<b>${m.result.score[0]}-${m.result.score[1]}</b>` : 'vs'} ${esc(S.getTeam(m.awayId).short)}</a>`).join('')}</div></div>`).join('')}</section>`;
  };
  V.ranking = function (c) {
    const rk = S.academicRanking(c.comp.id);
    return `<div class="page-head"><h1>${c.user.role === 'teacher' ? 'Ranking académico' : 'Ranking de entrenadores'}</h1><p class="muted">Media de las rúbricas de 100 puntos por jornada. Se usa la nota del profesor cuando existe; si no, la propuesta automática.</p></div>
    <div class="card"><div class="tablewrap"><table class="table"><thead><tr><th>#</th><th>Entrenador</th><th>Equipo</th><th>Microciclo /25</th><th>Plan /25</th><th>Coherencia /20</th><th>Adaptación /20</th><th>Análisis /10</th><th>Total</th><th>Nivel</th><th>Revisadas</th></tr></thead><tbody>
    ${rk.map((r, i) => `<tr class="${c.team && r.team.id === c.team.id ? 'me' : ''}"><td>${i + 1}</td><td><b>${esc(r.coach ? r.coach.name : '—')}</b></td><td>${UI.teamBadge(r.team, 20)} ${esc(r.team.name)}</td><td>${r.micro}</td><td>${r.plan}</td><td>${r.coherence}</td><td>${r.adaptation}</td><td>${r.analysis}</td><td><b>${r.total}</b></td><td>${esc(S.coachLevel(r.total))}</td><td>${r.reviewed}/${r.n}</td></tr>`).join('') || '<tr><td colspan="11" class="muted">Sin alumnos asignados o sin jornadas evaluadas.</td></tr>'}
    </tbody></table></div></div>`;
  };
  V.historial = function (c) {
    const subs = S.submissionsOf(c.team.id); const log = S.logFor(c.comp.id, c.team.id);
    const ms = S.matchesOf(c.comp.id).filter((m) => m.homeId === c.team.id || m.awayId === c.team.id).sort((a, b) => a.round - b.round);
    return `<div class="page-head"><h1>Historial de jornadas</h1></div>
    <section class="card"><h3>Partidos</h3>${ms.map((m) => `<div class="round-line"><b>J${m.round}</b> ${esc(S.getTeam(m.homeId).name)} ${m.status === 'played' ? `<b>${m.result.score[0]}-${m.result.score[1]}</b>` : 'vs'} ${esc(S.getTeam(m.awayId).name)} ${m.status === 'played' ? `<a href="#informe" class="link" data-go="informe" data-p='{"m":"${m.id}"}'>Informe</a>` : ''}</div>`).join('')}</section>
    <section class="card"><h3>Entregas (versiones bloqueadas)</h3><div class="tablewrap"><table class="table"><thead><tr><th>Jornada</th><th>Versión</th><th>Fecha</th><th>Microciclo</th><th>Plan</th><th>Coherencia</th></tr></thead><tbody>${subs.map((s) => `<tr><td>J${s.round}</td><td>v${s.version}${s.auto ? ' (automática)' : ''}</td><td>${UI.fmtDate(s.submittedAt)}</td><td>${s.evals.micro.score25}/25</td><td>${s.evals.plan.score25}/25</td><td>${s.evals.coherence.score20}/20</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin entregas.</td></tr>'}</tbody></table></div></section>
    <section class="card"><h3>Registro de decisiones</h3><ul class="log">${log.map((l) => `<li><time>${UI.fmtDate(l.at)}</time> ${esc(l.text)}</li>`).join('') || '<li class="muted">Sin registros.</li>'}</ul></section>`;
  };

  /* ───── Pizarra táctica ───── */
  const TOOLS = [['move', 'Mover'], ['run', 'Desplazamiento'], ['pass', 'Pase'], ['press', 'Zona de presión'], ['free', 'Espacio libre'], ['sup', 'Superioridad'], ['erase', 'Borrar']];
  function boardFromFormation(f, rival) {
    const own = TC.FORMATIONS[f].map((s, i) => ({ id: 'o' + i, n: i + 1, x: s[1] * 10.5, y: s[2] * 6.8, side: 'o' }));
    const opp = rival ? TC.FORMATIONS['1-4-4-2'].map((s, i) => ({ id: 'r' + i, n: i + 1, x: 1050 - s[1] * 10.5, y: s[2] * 6.8, side: 'r' })) : [];
    return own.concat(opp);
  }
  V.pizarra = function (c) {
    const b = UI.state.board || (UI.state.board = { id: null, name: 'Nueva situación', phase: 'con balón', formation: c.team.model.attStructure in TC.FORMATIONS ? c.team.model.attStructure : '1-4-3-3', tokens: boardFromFormation(c.team.model.defStructure || '1-4-3-3', true), shapes: [], tool: 'move' });
    return `<div class="page-head"><h1>Pizarra táctica</h1><p class="muted">Arrastra jugadores, dibuja desplazamientos y pases, marca zonas. Guarda situaciones con y sin balón.</p></div>
    <div class="grid g-board">
      <section class="card">
        <div class="toolbar">${TOOLS.map(([k, l]) => `<button class="btn sm ${b.tool === k ? 'primary' : 'ghost'}" data-act="boardTool" data-k="${k}">${l}</button>`).join('')}</div>
        <div class="board-wrap"><svg id="board" viewBox="0 0 1050 680" class="pitch board" role="application" aria-label="Pizarra táctica">
          <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#fff"/></marker><marker id="ahy" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#f5b84b"/></marker></defs>
          ${UI.pitchLines()}<g id="b-shapes"></g><g id="b-tokens"></g></svg></div>
        <div class="row wrap"><label class="field"><span>Estructura</span><select data-change="boardFormation">${UI.opts(Object.keys(TC.FORMATIONS), b.formation)}</select></label>
          <label class="field"><span>Momento</span><select data-change="boardPhase">${UI.opts(['con balón', 'sin balón', 'transición ofensiva', 'transición defensiva', 'balón parado'], b.phase)}</select></label>
          <label class="field grow"><span>Nombre de la situación</span><input id="board-name" value="${esc(b.name)}" data-change="boardName"></label></div>
        <div class="row wrap"><button class="btn primary" data-act="boardSave">Guardar situación</button><button class="btn ghost" data-act="boardNew">Nueva</button><button class="btn ghost" data-act="boardClear">Borrar dibujos</button><label class="check"><input type="checkbox" data-change="boardRival" ${b.tokens.some((t) => t.side === 'r') ? 'checked' : ''}><span>Mostrar rival</span></label></div>
      </section>
      <aside class="card"><h3>Situaciones guardadas</h3>${(c.team.boards || []).map((s) => `<div class="task-row"><a href="#pizarra" data-act="boardLoad" data-id="${s.id}"><b>${esc(s.name)}</b><small>${esc(s.phase)} · ${esc(s.formation)} · ${s.shapes.length} trazos</small></a><button class="icon" data-act="boardDel" data-id="${s.id}" aria-label="Borrar">×</button></div>`).join('') || '<p class="muted small">Ninguna todavía.</p>'}
        <p class="note">Ejemplo: defender en 1-4-4-2 y atacar en 1-3-2-5. Guarda una situación para cada momento.</p></aside>
    </div>`;
  };
  function drawBoard() {
    const b = UI.state.board; const svg = UI.$('#board'); if (!svg) return;
    const color = UI.ctx().team.color;
    UI.$('#b-shapes').innerHTML = b.shapes.map((s, i) => {
      if (s.t === 'run') return `<line data-i="${i}" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" class="sh-run" marker-end="url(#ahy)"/>`;
      if (s.t === 'pass') return `<line data-i="${i}" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" class="sh-pass" marker-end="url(#ah)"/>`;
      const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2), w = Math.abs(s.x2 - s.x1), h = Math.abs(s.y2 - s.y1);
      if (s.t === 'press') return `<rect data-i="${i}" x="${x}" y="${y}" width="${w}" height="${h}" rx="10" class="sh-press"/>`;
      if (s.t === 'free') return `<rect data-i="${i}" x="${x}" y="${y}" width="${w}" height="${h}" rx="10" class="sh-free"/>`;
      if (s.t === 'sup') return `<g data-i="${i}"><ellipse cx="${(s.x1 + s.x2) / 2}" cy="${(s.y1 + s.y2) / 2}" rx="${Math.max(20, w / 2)}" ry="${Math.max(20, h / 2)}" class="sh-sup"/><text x="${(s.x1 + s.x2) / 2}" y="${(s.y1 + s.y2) / 2 + 8}" text-anchor="middle" class="sh-sup-t">+1</text></g>`;
      return '';
    }).join('');
    UI.$('#b-tokens').innerHTML = b.tokens.map((t) => `<g data-tok="${t.id}" transform="translate(${t.x},${t.y})" class="tok ${t.side}"><circle r="22" fill="${t.side === 'o' ? esc(color) : '#e8edf5'}" stroke="${t.side === 'o' ? '#fff' : '#0b1220'}" stroke-width="2"/><text y="7" text-anchor="middle" class="${t.side === 'o' ? 'tk-n' : 'tk-n dark'}">${t.n}</text></g>`).join('');
  }
  UI.after.pizarra = function () {
    drawBoard();
    const svg = UI.$('#board'); let drag = null, draft = null;
    const pt = (e) => { const r = svg.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 1050, y: ((e.clientY - r.top) / r.height) * 680 }; };
    svg.addEventListener('pointerdown', (e) => {
      const b = UI.state.board; const p = pt(e);
      if (b.tool === 'move') { const g = e.target.closest('[data-tok]'); if (g) { drag = b.tokens.find((t) => t.id === g.dataset.tok); svg.setPointerCapture(e.pointerId); } return; }
      if (b.tool === 'erase') { const sh = e.target.closest('[data-i]'); if (sh) { b.shapes.splice(+sh.dataset.i, 1); drawBoard(); } return; }
      draft = { t: b.tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y }; b.shapes.push(draft); svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => { const p = pt(e); if (drag) { drag.x = TC.clamp(p.x, 15, 1035); drag.y = TC.clamp(p.y, 15, 665); drawBoard(); } else if (draft) { draft.x2 = p.x; draft.y2 = p.y; drawBoard(); } });
    const up = () => { if (draft && Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) < 12) { UI.state.board.shapes.pop(); drawBoard(); } drag = null; draft = null; };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  };
  A.boardTool = (el) => { UI.state.board.tool = el.dataset.k; UI.render(); };
  A.boardFormation = (el) => { const b = UI.state.board; const rival = b.tokens.some((t) => t.side === 'r'); b.formation = el.value; const opp = b.tokens.filter((t) => t.side === 'r'); b.tokens = boardFromFormation(el.value, false).concat(rival ? opp : []); drawBoard(); };
  A.boardPhase = (el) => { UI.state.board.phase = el.value; };
  A.boardName = (el) => { UI.state.board.name = el.value; };
  A.boardRival = (el) => { const b = UI.state.board; b.tokens = b.tokens.filter((t) => t.side === 'o').concat(el.checked ? boardFromFormation('1-4-4-2', true).filter((t) => t.side === 'r') : []); drawBoard(); };
  A.boardClear = () => { UI.state.board.shapes = []; drawBoard(); };
  A.boardNew = () => { UI.state.board = null; UI.render(); };
  A.boardSave = () => {
    const c = UI.ctx(); const b = UI.state.board; const name = (UI.$('#board-name').value || '').trim() || 'Situación';
    b.name = name; if (!b.id) b.id = S.uid('b');
    const list = (c.team.boards || []).filter((x) => x.id !== b.id).concat([{ id: b.id, name, phase: b.phase, formation: b.formation, tokens: S.clone(b.tokens), shapes: S.clone(b.shapes), at: S.now() }]);
    S.saveBoards(c.team.id, list); UI.toast('Situación guardada.'); UI.render();
  };
  A.boardLoad = (el) => { const s = UI.ctx().team.boards.find((x) => x.id === el.dataset.id); UI.state.board = Object.assign(S.clone(s), { tool: 'move' }); UI.render(); };
  A.boardDel = (el) => { const c = UI.ctx(); S.saveBoards(c.team.id, c.team.boards.filter((x) => x.id !== el.dataset.id)); if (UI.state.board && UI.state.board.id === el.dataset.id) UI.state.board = null; UI.render(); };
})(window);
