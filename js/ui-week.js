/* THE COACH — Semana: resumen, rival, informe de scouting fase a fase y trabajo individual. */
(function (G) {
  'use strict';
  const TC = G.TC, S = G.TCStore, UI = G.UI, ART = G.TCArt, ST = G.TCStories;
  const V = UI.views, A = UI.actions, esc = UI.esc;
  const ORDER = Object.keys(TC.POSITIONS);
  const sortPlayers = (ps) => ps.slice().sort((a, b) => ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos) || TC.playerRating(b) - TC.playerRating(a));
  const gAvg = (p, g) => Math.round(TC.avg(TC.ATTR_GROUPS[g].attrs.map((a) => p.attrs[a[0]])));
  const short = (p) => p.name.split(' ').slice(-1)[0];
  function save(w, mut) { mut(w.draft); S.saveDraft(w.team.id, w.round, w.draft); }
  function weekHead(w, title, sub) {
    return `<div class="page-head"><div class="eyebrow">Semana ${w.round}${w.rival ? ' · vs ' + esc(w.rival.name) : ''}</div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>
      ${w.editable ? (w.sub ? `<div class="notice ok">Semana entregada (versión ${w.sub.version}). Puedes cambiar cosas y volver a entregar mientras siga abierta.</div>` : '') : w.rd && w.rd.status === 'played' ? '<div class="notice">Esta semana ya se ha disputado: puedes consultarla, pero no modificarla.</div>' : ''}`;
  }
  // Agrupa los avisos de entrega por apartado de la semana
  const STEPS = [
    ['rival', 'Rival', 'Conoce al rival: club, plantilla y resultados.', null],
    ['scouting', 'Informe del rival', 'Scouting fase a fase y cómo vas a responder.', /^Informe del rival/],
    ['plan', 'Plan de partido', 'Decisiones tácticas y plan por fases.', /^Plan de partido/],
    ['microciclo', 'Microciclo semanal', 'Sesiones, objetivos, cargas y tareas.', /sesion|tareas|objetivo principal/i],
    ['alineacion', 'Once titular', 'Once inicial y suplentes.', /alineación/i],
    ['individual', 'Trabajo individual', 'Plan de mejora para el jugador asignado.', /^Trabajo individual/],
  ];

  /* ───── Resumen de la semana ───── */
  V.semana = function (c) {
    const w = UI.week(c);
    const rd = w.rd;
    if (rd && rd.status === 'locked') {
      return `<div class="page-head"><div class="eyebrow">Semana ${w.round}</div><h1>Semana cerrada</h1></div>
        <section class="card week-closed"><div class="lock-big" aria-hidden="true">🔒</div><h2>La semana ${w.round} todavía no está abierta</h2>
        <p class="muted">Tu profesor la abrirá cuando toque. Entonces aparecerán aquí el rival, el informe del rival, el plan de partido, el microciclo semanal, el once titular y tu trabajo individual.</p>
        <p class="muted">Mientras tanto, repasa la <a href="#plantilla" data-go="plantilla">plantilla</a>, completa los DAFO y afina tu <a href="#modelo" data-go="modelo">modelo de juego</a>.</p></section>`;
    }
    const errs = S.validateForSubmit(c.team, w.draft);
    const ip = c.team.players.find((p) => p.id === (w.draft.individual || {}).playerId);
    return `${weekHead(w, 'Resumen de la semana', w.rival ? `Jornada ${w.round} contra ${esc(w.rival.name)} (${w.nm && w.nm.home ? 'en casa' : 'fuera'}). Prepara los seis apartados y entrega la semana antes del partido.` : '')}
      ${w.rival ? `<section class="card week-vs">${UI.teamBadge(c.team, 56)}<div><b>${esc(c.team.name)}</b><small>${w.nm && w.nm.home ? 'Local' : 'Visitante'}</small></div><span class="vs-x">vs</span><div class="r"><b>${esc(w.rival.name)}</b><small>${w.nm && w.nm.home ? 'Visitante' : 'Local'}</small></div>${UI.teamBadge(w.rival, 56)}</section>` : ''}
      <div class="grid g3 week-steps">${STEPS.map(([k, l, d, re], i) => { const mine = re ? errs.filter((e) => re.test(e)) : []; const ok = re ? !mine.length : true; return `<a class="card step ${ok ? 'done' : ''}" href="#${k}" data-go="${k}"><div class="card-head"><span class="step-n">${i + 1}</span>${re ? UI.pill(ok ? 'Completo' : mine.length + ' pendiente' + (mine.length > 1 ? 's' : ''), ok ? 'ok' : 'warn') : UI.pill('Consulta', 'info')}</div><h3>${esc(l)}</h3><p class="small muted">${esc(d)}${k === 'individual' && ip ? ` Esta semana: <b>${esc(ip.name)}</b>.` : ''}</p></a>`; }).join('')}</div>
      <section class="card"><div class="card-head"><h3>Entrega de la semana</h3>${w.sub ? UI.pill('Entregada v' + w.sub.version, 'ok') : UI.pill('Sin entregar', '')}</div>
        ${errs.length ? `<ul class="errs">${errs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="ok-t">Todo listo para entregar.</p>'}
        ${w.editable ? `<button class="btn primary" data-act="submitWeek" ${errs.length ? 'disabled' : ''}>${w.sub ? 'Entregar nueva versión' : 'Entregar semana ' + w.round}</button>` : ''}</section>`;
  };

  /* ───── Rival ───── */
  V.rival = function (c) {
    const w = UI.week(c); const r = w.rival;
    if (!r) return '<div class="card"><p>No hay próximo rival.</p></div>';
    const sc = S.scouting(r.id);
    const st = S.standings(c.comp.id); const pos = st.findIndex((x) => x.team.id === r.id) + 1; const row = st[pos - 1];
    const lines = [['def', 'Defensa'], ['mid', 'Medio campo'], ['att', 'Ataque']].map(([l, n]) => { const ps = r.players.filter((p) => TC.POSITIONS[p.pos].line === l); return [n, Math.round(TC.avg(ps.map((p) => TC.playerRating(p))))]; });
    return `${weekHead(w, 'Rival', '')}
      <section class="card rival-hero">${ART.crest(r, 92)}<div class="grow"><div class="eyebrow">Próximo rival · jornada ${w.round} · ${w.nm && w.nm.home ? 'en casa' : 'fuera'}</div><h2>${esc(r.name)}</h2>
        <p class="muted small">Fundado en ${ART.crestSpec(r).founded}${pos ? ` · ${pos}.º en la clasificación${row ? ` (${row.pts} pts)` : ''}` : ''} · ${r.coachId ? 'Entrenado por un compañero' : 'Equipo del sistema'}</p>
        <div class="lines3">${lines.map(([n, v]) => `<div><small>${n}</small><b class="${UI.attrClass(v)}">${v}</b></div>`).join('')}</div></div>
        <button class="btn primary" data-go="scouting">Abrir informe del rival</button></section>
      <div class="grid g2">
        <section class="card"><div class="card-head"><h3>Datos de partidos</h3>${UI.pill('Hechos', 'ok')}</div><ul class="facts-list">${sc.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          ${sc.results.length ? `<h4>Últimos resultados</h4><div class="results">${sc.results.map((x) => `<span class="res ${x.gf > x.gc ? 'w' : x.gf < x.gc ? 'l' : 'd'}">J${x.round} ${x.gf}-${x.gc} vs ${esc(x.opp)}</span>`).join('')}</div>` : ''}</section>
        <section class="card"><div class="card-head"><h3>Hipótesis</h3>${UI.pill('A confirmar', 'warn')}</div><ul class="facts-list hyp">${sc.hyp.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>
      </div>
      <section class="card"><h3>Plantilla de ${esc(r.name)}</h3><div class="tablewrap"><table class="table"><thead><tr><th></th><th>Pos</th><th>Jugador</th><th>Edad</th><th>Altura</th><th>Pie</th><th>Val.</th><th>Técnica</th><th>Táctica</th><th>Físico</th><th>Psicológico</th></tr></thead><tbody>
        ${sortPlayers(r.players).map((p) => { const v = TC.playerRating(p); return `<tr><td class="mini-face">${ART.portrait(p, r, 28)}</td><td><span class="pos ${TC.POSITIONS[p.pos].line}">${p.pos}</span></td><td><b>${esc(p.name)}</b><small class="muted"> ${esc(p.profile)}</small></td><td>${p.age}</td><td>${p.height}</td><td>${p.foot[0]}</td><td><span class="rt ${UI.attrClass(v)}">${v}</span></td>${['tecnicos', 'tacticos', 'fisicos', 'psicologicos'].map((g) => `<td class="${UI.attrClass(gAvg(p, g))}">${gAvg(p, g)}</td>`).join('')}</tr>`; }).join('')}
      </tbody></table></div></section>`;
  };

  /* ───── Informe del rival (scouting) ───── */
  V.scouting = function (c) {
    const w = UI.week(c); const r = w.rival;
    if (!r) return '<div class="card"><p>No hay próximo rival.</p></div>';
    const rep = ST.scoutReport(r, w.round); const sc = w.draft.scouting; const dis = w.editable ? '' : 'disabled';
    const phases = Object.entries(TC.SCOUT_PHASES);
    return `${weekHead(w, 'Informe del rival', `${esc(rep.intro)}`)}
      <section class="card"><h2 class="phase-t">Visión general de ${esc(r.name)}</h2>
        <div class="fields">
          <label class="field"><span>Sistema y estructura (con y sin balón)</span><input data-change="scTop" data-k="system" value="${esc(sc.system)}" ${dis}></label>
          <span></span>
          <label class="field"><span>Fortalezas del rival</span><textarea rows="3" data-change="scTop" data-k="strengths" ${dis}>${esc(sc.strengths)}</textarea></label>
          <label class="field"><span>Debilidades del rival</span><textarea rows="3" data-change="scTop" data-k="weaknesses" ${dis}>${esc(sc.weaknesses)}</textarea></label>
        </div>
        <fieldset class="field"><legend>Jugadores clave del rival (marca al menos 2)</legend><div class="pick">${sortPlayers(r.players).map((p) => `<label class="pchip"><input type="checkbox" data-change="scKey" value="${p.id}" ${(sc.keyPlayers || []).includes(p.id) ? 'checked' : ''} ${dis}><span>${p.pos} ${esc(short(p))}</span></label>`).join('')}</div></fieldset>
      </section>
      ${phases.map(([ph, label]) => `<section class="card phase"><h2 class="phase-t">${esc(label)}</h2>
        ${TC.SCOUT_MOMENTS.filter((x) => x[2] === ph).map(([k, l]) => { const mo = sc.moments[k] || {}; return `<div class="moment scout-m"><h4>${esc(l)}</h4>
          <div class="scout-grid"><div class="scout-rep"><span class="eyebrow">Lo que dice el informe</span><p>${esc(rep.moments[k])}</p></div>
          <div class="stack"><label class="field"><span>Lo que observo o confirmo</span><textarea rows="2" data-change="scMoment" data-k="${k}" data-f="obs" ${dis}>${esc(mo.obs)}</textarea></label>
          <label class="field"><span>Cómo lo aprovechamos o neutralizamos</span><textarea rows="3" data-change="scMoment" data-k="${k}" data-f="plan" ${dis}>${esc(mo.plan)}</textarea></label>${UI.drill.slot('w:scouting.moments.' + k + '.board', mo.board, w.editable, 'Dibujarlo en la pizarra')}</div></div></div>`; }).join('')}</section>`).join('')}
      <div class="row end"><button class="btn primary" data-go="plan">Siguiente: plan de partido →</button></div>`;
  };
  A.scTop = (el) => { const w = UI.week(UI.ctx()); save(w, (d) => { d.scouting[el.dataset.k] = el.value; }); };
  A.scKey = (el) => { const w = UI.week(UI.ctx()); save(w, (d) => { const k = (d.scouting.keyPlayers || []).filter((x) => x !== el.value); if (el.checked) k.push(el.value); d.scouting.keyPlayers = k; }); };
  A.scMoment = (el) => { const w = UI.week(UI.ctx()); save(w, (d) => { d.scouting.moments[el.dataset.k] = Object.assign({ obs: '', plan: '' }, d.scouting.moments[el.dataset.k], { [el.dataset.f]: el.value }); }); };

  /* ───── Trabajo individual ───── */
  V.individual = function (c) {
    const w = UI.week(c); const iv = w.draft.individual; const dis = w.editable ? '' : 'disabled';
    const p = c.team.players.find((x) => x.id === iv.playerId);
    if (!p) return `${weekHead(w, 'Trabajo individual', '')}<div class="card"><p>No hay jugador asignado esta semana.</p></div>`;
    const days = w.draft.microcycle.sessions.map((s) => s.day);
    const groups = Object.entries(TC.ATTR_GROUPS);
    return `${weekHead(w, 'Trabajo individual', 'Cada semana se te asigna un jugador. Detecta sus carencias a partir de su informe, su DAFO y sus capacidades, y prepárale un plan de trabajo individual.')}
      <section class="card player-hero"><div class="ph-photo">${ART.portrait(p, c.team, 120)}</div><div class="ph-main"><div class="eyebrow">Jugador asignado esta semana</div><h2>${esc(p.name)}</h2>
        <p class="muted">${esc(TC.POSITIONS[p.pos].label)} · ${p.age} años · ${esc(p.profile)}</p>
        <div class="gsum">${groups.map(([k, g]) => `<div><small>${g.label}</small><b class="${UI.attrClass(gAvg(p, k))}">${gAvg(p, k)}</b></div>`).join('')}</div>
        <div class="row wrap"><button class="btn sm" data-go="jugador" data-p='{"id":"${p.id}"}'>Ver su informe, capacidades y DAFO</button></div></div></section>
      <section class="card"><h2 class="phase-t">Diagnóstico</h2>
        <label class="field"><span>Carencias detectadas (qué le falta y cómo lo sabes)</span><textarea rows="3" data-change="ivField" data-k="deficits" ${dis}>${esc(iv.deficits)}</textarea></label>
        <div class="fields"><label class="field"><span>Objetivo del trabajo individual</span><textarea rows="2" data-change="ivField" data-k="objective" ${dis}>${esc(iv.objective)}</textarea></label>
        <label class="field"><span>Contenidos que vas a trabajar</span><textarea rows="2" data-change="ivField" data-k="contents" ${dis}>${esc(iv.contents)}</textarea></label></div></section>
      <section class="card"><h2 class="phase-t">Tareas</h2>
        ${iv.tasks.map((t, i) => `<div class="moment"><div class="entry-h"><b>Tarea ${i + 1}</b>${w.editable && iv.tasks.length > 1 ? `<button type="button" class="icon" data-act="ivTaskDel" data-i="${i}" aria-label="Quitar tarea">×</button>` : ''}</div>
          <div class="fields"><label class="field"><span>Nombre</span><input data-change="ivTask" data-i="${i}" data-k="name" value="${esc(t.name)}" ${dis}></label><label class="field"><span>Duración (min)</span><input type="number" min="5" max="90" data-change="ivTask" data-i="${i}" data-k="dur" value="${t.dur}" ${dis}></label></div>
          <label class="field"><span>Descripción: organización, normas, series y repeticiones, y qué debe corregir el jugador</span><textarea rows="3" data-change="ivTask" data-i="${i}" data-k="desc" ${dis}>${esc(t.desc)}</textarea></label>${UI.drill.slot('w:individual.tasks.' + i + '.board', t.board, w.editable, 'Dibujar la tarea')}</div>`).join('')}
        ${w.editable ? '<button type="button" class="btn sm ghost add-entry" data-act="ivTaskAdd">+ Añadir tarea</button>' : ''}</section>
      <section class="card"><h2 class="phase-t">Planificación y evaluación</h2>
        <fieldset class="field"><legend>Días del microciclo en los que lo hará</legend><div class="pick">${days.map((d) => `<label class="pchip"><input type="checkbox" data-change="ivDay" value="${esc(d)}" ${(iv.days || []).includes(d) ? 'checked' : ''} ${dis}><span>${esc(d)}</span></label>`).join('')}</div></fieldset>
        <label class="field"><span>Cómo medirás si mejora</span><textarea rows="2" data-change="ivField" data-k="evaluation" ${dis}>${esc(iv.evaluation)}</textarea></label></section>
      <div class="row end"><button class="btn primary" data-go="semana">Volver al resumen de la semana</button></div>`;
  };
  function keep(fn) { const y = window.scrollY; fn(); UI.render(); window.scrollTo(0, y); }
  A.ivField = (el) => { const w = UI.week(UI.ctx()); save(w, (d) => { d.individual[el.dataset.k] = el.value; }); };
  A.ivTask = (el) => { const w = UI.week(UI.ctx()); save(w, (d) => { d.individual.tasks[+el.dataset.i][el.dataset.k] = el.dataset.k === 'dur' ? Math.max(0, +el.value || 0) : el.value; }); };
  A.ivTaskAdd = () => keep(() => { const w = UI.week(UI.ctx()); save(w, (d) => d.individual.tasks.push({ name: '', desc: '', dur: 15 })); });
  A.ivTaskDel = (el) => keep(() => { const w = UI.week(UI.ctx()); save(w, (d) => d.individual.tasks.splice(+el.dataset.i, 1)); });
  A.ivDay = (el) => { const w = UI.week(UI.ctx()); save(w, (d) => { const k = (d.individual.days || []).filter((x) => x !== el.value); if (el.checked) k.push(el.value); d.individual.days = k; }); };

  /* ───── Profesor: informe y trabajo individual en la entrega ───── */
  const baseEntrega = V['profe-entrega'];
  V['profe-entrega'] = function (c, p) {
    const html = baseEntrega(c, p);
    const sub = S.load().submissions.find((s) => s.id === (p && p.sub)); if (!sub) return html;
    const t = S.getTeam(sub.teamId); const sn = sub.snapshot; let extra = '';
    if (sn.scouting) {
      const m = S.matchesOf(t.compId, sub.round).find((x) => x.homeId === t.id || x.awayId === t.id); const rival = m ? S.getTeam(m.homeId === t.id ? m.awayId : m.homeId) : null;
      const rn = (id) => { const q = rival && rival.players.find((x) => x.id === id); return q ? q.name : '?'; };
      extra += `<section class="card"><h3>Informe del rival${rival ? ' · ' + esc(rival.name) : ''}</h3><p class="small"><b>Sistema:</b> ${esc(sn.scouting.system || '—')}<br><b>Fortalezas:</b> ${esc(sn.scouting.strengths || '—')}<br><b>Debilidades:</b> ${esc(sn.scouting.weaknesses || '—')}<br><b>Jugadores clave:</b> ${esc((sn.scouting.keyPlayers || []).map(rn).join(', ') || '—')}</p>
        ${TC.SCOUT_MOMENTS.map(([k, l]) => { const mo = (sn.scouting.moments || {})[k] || {}; return `<p class="small entry-sum"><b>${esc(l)}</b><br>${mo.obs ? esc(mo.obs) + '<br>' : ''}<i>${esc(mo.plan || '—')}</i></p>`; }).join('')}</section>`;
    }
    if (sn.individual) {
      const iv = sn.individual; const q = t.players.find((x) => x.id === iv.playerId);
      extra += `<section class="card"><h3>Trabajo individual${q ? ' · ' + esc(q.name) : ''}</h3>${q ? `<p class="small muted">Capacidades más bajas del jugador: ${TC.weakestAttrs(q, 3).map((a) => `${esc(TC.ATTR_LABEL[a])} (${q.attrs[a]})`).join(', ')}</p>` : ''}
        <p class="small"><b>Carencias:</b> ${esc(iv.deficits || '—')}<br><b>Objetivo:</b> ${esc(iv.objective || '—')}<br><b>Contenidos:</b> ${esc(iv.contents || '—')}<br><b>Días:</b> ${esc((iv.days || []).join(', ') || '—')}<br><b>Evaluación:</b> ${esc(iv.evaluation || '—')}</p>
        ${(iv.tasks || []).map((x, i) => `<p class="small entry-sum"><b>Tarea ${i + 1}: ${esc(x.name || '—')}</b> · ${x.dur} min<br>${esc(x.desc || '—')}</p>`).join('')}</section>`;
    }
    return html + extra;
  };
})(window);
