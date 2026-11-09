/* THE COACH — Centro de partido, visor 2D e informe postpartido. */
(function (G) {
  'use strict';
  const TC = G.TC, S = G.TCStore, UI = G.UI, esc = UI.esc;
  const V = UI.views, A = UI.actions;

  const STEP_LABEL = { salida: ['Salida de balón superada', 'Pérdida en la salida ante la presión'], directo: ['Juego directo ganado', 'Balón largo perdido'], progresion: ['Progresión al último tercio', 'Pérdida en la progresión'], presion_tras_perdida: ['¡Recuperación tras pérdida!', ''], creacion: ['Ocasión generada', 'Defensa bien cerrada'], contra: ['Contraataque en marcha', 'Contraataque frenado'], corner: ['Saque de esquina', ''], remate: ['Remate a portería', 'Remate fuera'], parada: ['Parada del portero', ''], gol: ['¡GOL!', ''] };

  /* ───── Centro de partido ───── */
  V.partido = function (c) {
    const team = c.team, comp = c.comp; const w = UI.week(c);
    const played = S.matchesOf(comp.id).filter((m) => m.status === 'played' && (m.homeId === team.id || m.awayId === team.id)).sort((a, b) => b.round - a.round);
    const fr = UI.state.friendly;
    return `<div class="page-head"><h1>Centro de partido</h1><p class="muted">Los partidos oficiales se disputan cuando el profesor activa la jornada, con los planes bloqueados de los dos entrenadores.</p></div>
    <div class="grid g2">
      <section class="card">${w.nm ? `<div class="eyebrow">Próximo partido oficial · Jornada ${w.round}</div>
        <div class="vs small">${UI.teamBadge(S.getTeam(w.nm.match.homeId), 44)}<div class="vs-mid"><b>VS</b><small>${w.rd.status === 'open' ? 'Esperando al profesor' : 'Jornada bloqueada'}</small></div>${UI.teamBadge(S.getTeam(w.nm.match.awayId), 44)}</div>
        <div class="vs-names"><span>${esc(S.getTeam(w.nm.match.homeId).name)}</span><span>${esc(S.getTeam(w.nm.match.awayId).name)}</span></div>
        <p class="center">${w.sub ? UI.pill('Tu plan está entregado (v' + w.sub.version + ')', 'ok') : UI.pill('Aún no has entregado', 'warn')}</p>` : '<p>No quedan partidos.</p>'}
        ${UI.soon(3, 'Modo en directo: intervenir en pausas tácticas cuando los dos entrenadores estén conectados. Hoy se usan las instrucciones condicionales del plan.')}
      </section>
      <section class="card"><h3>Amistoso de prueba</h3><p class="small muted">Simula con tu borrador actual (sin entregar) contra cualquier equipo. No cuenta para la clasificación, no se guarda y no cambia tus indicadores ni la fatiga. Sirve para comprobar cómo se comporta tu plan.</p>
        <div class="row wrap"><label class="field grow"><span>Rival</span><select id="fr-rival">${S.teamsOf(comp.id).filter((t) => t.id !== team.id).map((t) => UI.opt(t.id, t.name, w.rival && w.rival.id)).join('')}</select></label>
        <button class="btn primary" data-act="friendly">Simular amistoso</button></div>
        ${fr ? `<div class="last"><span class="eyebrow">Último amistoso</span><a href="#informe" data-go="informe" data-p='{"friendly":1}' class="result-line">${esc(team.name)} <b>${fr.res.score[0]} - ${fr.res.score[1]}</b> ${esc(S.getTeam(fr.rivalId).name)}</a></div>` : ''}
      </section>
    </div>
    <section class="card"><h3>Partidos disputados</h3>${played.map((m) => `<div class="round-line"><b>J${m.round}</b> ${esc(S.getTeam(m.homeId).name)} <b>${m.result.score[0]}-${m.result.score[1]}</b> ${esc(S.getTeam(m.awayId).name)} <a href="#informe" class="btn sm" data-go="informe" data-p='{"m":"${m.id}"}'>Ver partido e informe</a></div>`).join('') || '<p class="muted">Todavía no has jugado partidos oficiales.</p>'}</section>`;
  };
  A.friendly = () => {
    const c = UI.ctx(); const rivalId = UI.$('#fr-rival').value;
    const seed = 'amistoso:' + Date.now();
    const res = S.friendly(c.team.id, rivalId, seed);
    UI.state.friendly = { res, rivalId, seed, teamId: c.team.id };
    S.addLog(c.comp.id, c.team.id, 'amistoso', `Amistoso de prueba contra ${S.getTeam(rivalId).name}: ${res.score.join('-')}.`); S.save();
    UI.go('informe', { friendly: 1 });
  };

  /* ───── Informe ───── */
  function matchData(p) {
    if (p.friendly && UI.state.friendly) { const f = UI.state.friendly; return { friendly: true, res: f.res, seqs: f.res.sequences, home: S.getTeam(f.teamId), away: S.getTeam(f.rivalId), round: null }; }
    const m = S.getMatch(p.m); if (!m || m.status !== 'played') return null;
    return { m, res: m.result, seqs: S.matchSequences(m.id), home: S.getTeam(m.homeId), away: S.getTeam(m.awayId), round: m.round };
  }
  V.informe = function (c, p) {
    p = p || {};
    const md = matchData(p);
    if (!md) return '<div class="card"><p>Partido no disponible.</p><button class="btn" data-go="partido">Volver</button></div>';
    UI.state.replayData = md;
    const { res, home, away } = md;
    const myKey = c.team ? (c.team.id === home.id ? 'h' : c.team.id === away.id ? 'a' : null) : null;
    const st = res.stats;
    const rows = [['Posesión estimada', 'possession', '%'], ['Remates', 'shots'], ['Remates a portería', 'onTarget'], ['Goles esperados (xG)', 'xg'], ['Entradas en último tercio', 'entries'], ['Recuperaciones', 'recoveries'], ['Recuperaciones en campo rival', 'highRecoveries'], ['Pérdidas', 'losses'], ['Contraataques', 'counters'], ['Saques de esquina', 'corners'], ['Eficacia de presión', 'pressEff', '%']];
    const rep = res.report;
    const byId = Object.assign({}, Object.fromEntries(home.players.map((x) => [x.id, x])), Object.fromEntries(away.players.map((x) => [x.id, x])));
    const refl = c.team && md.m ? S.getReflection(c.team.id, md.round) : null;
    const ev = c.team && md.m ? S.evaluationsFor(c.team.id).find((e) => e.round === md.round) : null;
    const isOwner = c.user.role === 'teacher';
    const learning = md.m && myKey ? (c.team.indicatorHistory || []).find((h) => h.round === md.round) : null;
    const usedTraining = learning ? learning.log.filter((l) => l.delta > 0) : [];
    return `<div class="page-head"><a class="link" href="#partido" data-go="${c.user.role === 'teacher' ? 'profe-jornadas' : 'partido'}">← Volver</a>
      <h1>${md.friendly ? 'Amistoso de prueba' : 'Jornada ' + md.round}</h1></div>
    <section class="card scoreboard"><div class="sb-team">${UI.teamBadge(home, 48)}<b>${esc(home.name)}</b></div><div class="sb-score"><span id="sb-h">${res.score[0]}</span><i>-</i><span id="sb-a">${res.score[1]}</span><small id="sb-min">Final</small></div><div class="sb-team r"><b>${esc(away.name)}</b>${UI.teamBadge(away, 48)}</div></section>
    <section class="card replay">
      <div class="card-head"><h3>Visor 2D</h3>${UI.pill('Fase 3 · versión simplificada', 'info')}</div>
      <p class="small muted">Cada movimiento corresponde a un evento calculado por el simulador (salida, progresión, pérdida, ocasión, remate). Las posiciones intermedias de los jugadores son aproximadas.</p>
      <div class="canvas-wrap"><canvas id="replay" width="1050" height="680" aria-label="Reproducción del partido"></canvas><div id="rp-caption" class="rp-caption"></div></div>
      <div class="rp-controls"><button class="btn primary sm" data-act="rpPlay" id="rp-play">Reproducir</button><button class="btn sm ghost" data-act="rpNextGoal">Siguiente gol</button>
        <label class="field inline"><span>Velocidad</span><select id="rp-speed">${UI.opts([['1', '×1'], ['2', '×2'], ['4', '×4'], ['8', '×8'], ['16', '×16']], '2')}</select></label>
        <input type="range" id="rp-scrub" min="0" max="${md.seqs.length - 1}" value="0" aria-label="Momento del partido"><span id="rp-clock" class="clock">0'</span></div>
    </section>
    <div class="grid g2">
      <section class="card"><h3>Estadísticas</h3><p class="small muted">Derivadas de los ${md.seqs.length} eventos simulados.</p>
        <table class="table stats"><thead><tr><th>${esc(home.short)}</th><th></th><th>${esc(away.short)}</th></tr></thead><tbody>${rows.map(([l, k, u]) => { const a = st.h[k], b = st.a[k]; const tot = a + b || 1; return `<tr><td class="num ${a > b ? 'lead' : ''}">${a}${u || ''}</td><td><span>${l}</span><span class="dual"><i style="width:${(a / tot) * 100}%"></i><em style="width:${(b / tot) * 100}%"></em></span></td><td class="num ${b > a ? 'lead' : ''}">${b}${u || ''}</td></tr>`; }).join('')}</tbody></table>
        <h4>xG acumulado</h4>${xgChart(md)}</section>
      <section class="card"><h3>Situaciones destacadas</h3><ul class="log">${rep.highlights.map((h) => `<li>${esc(h)}</li>`).join('') || '<li class="muted">Sin goles ni ajustes.</li>'}</ul>
        ${res.decisions.length ? `<h4>Decisiones del entrenador activadas</h4><ul class="small">${res.decisions.map((d) => `<li>Min ${d.min} · ${esc(d.team === 'h' ? home.name : away.name)}: ${esc(d.label)} <span class="muted">(${esc(TC.COND_WHEN[d.when])}, ${d.score.join('-')})</span></li>`).join('')}</ul>` : ''}
        ${md.m ? `<div class="row wrap"><button class="btn sm ghost" data-act="verify" data-id="${md.m.id}">Verificar reproducibilidad</button><span class="small muted">Semilla ${esc(md.m.seed)}</span></div>` : ''}</section>
    </div>
    <div class="grid g2">${['h', 'a'].map((k) => { const t = k === 'h' ? home : away; const r = rep[k]; return `<section class="card ${k === myKey ? 'mine' : ''}"><h3>Análisis táctico · ${esc(t.name)}</h3>
      <h4>Qué funcionó</h4><ul class="small">${r.worked.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">Nada destacable por encima de lo esperado.</li>'}</ul>
      <h4>Espacios y superioridades</h4><ul class="small">${r.spaces.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">Sin patrones claros.</li>'}</ul>
      <h4>Problemas</h4><ul class="small">${r.problems.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">Sin problemas destacados.</li>'}</ul>
      <h4>Contenidos a trabajar</h4><div>${r.next.map((x) => `<span class="chip">${esc(TC.IND_LABEL[x])}</span>`).join('')}</div></section>`; }).join('')}</div>
    ${myKey && md.m ? `<section class="card"><h3>Qué se reflejó del microciclo</h3>${usedTraining.length ? `<ul class="small">${usedTraining.map((l) => `<li><b>${esc(TC.IND_LABEL[l.k])}</b> subió de ${l.from} a ${l.to} antes del partido. Fuentes: ${esc(l.sources.join('; ') || 'reglas de tareas')}.</li>`).join('')}</ul>` : '<p class="muted">Esta semana el entrenamiento no mejoró ningún indicador.</p>'}</section>` : ''}
    <section class="card"><h3>Rendimiento de jugadores</h3><div class="grid g2">${['h', 'a'].map((k) => `<div><h4>${esc((k === 'h' ? home : away).name)}</h4><table class="table compact"><thead><tr><th>Jugador</th><th>Nota</th><th>G</th><th>Rem.</th><th>Rec.</th><th>Pérd.</th><th>Energía</th></tr></thead><tbody>${Object.entries(res.playerRatings).filter(([, v]) => v.team === k).sort((a, b) => b[1].rating - a[1].rating).map(([id, v]) => `<tr><td>${esc(byId[id] ? byId[id].name : id)} <small class="muted">${byId[id] ? byId[id].pos : ''}</small></td><td><b class="${v.rating >= 7 ? 'hi' : v.rating < 6 ? 'lo' : ''}">${v.rating}</b></td><td>${v.goals || ''}</td><td>${v.shots || ''}</td><td>${v.recoveries || ''}</td><td>${v.losses || ''}</td><td>${v.energy}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div></section>
    ${myKey && md.m && !isOwner ? `<section class="card"><h3>Reflexión posterior</h3><p class="small muted">Escribe tu análisis antes de ver la evaluación del profesor: qué pasó, por qué y qué cambiarás en la próxima semana.</p>
      <form data-submit="saveReflection" class="stack"><input type="hidden" name="round" value="${md.round}"><textarea id="refl-text" name="text" rows="5" minlength="40" required>${esc(refl ? refl.text : '')}</textarea><div class="row end"><button class="btn primary" type="submit">${refl ? 'Actualizar reflexión' : 'Entregar reflexión'}</button></div></form></section>
      <section class="card"><h3>Evaluación de la jornada</h3>${!refl ? '<p class="muted">Se mostrará cuando entregues tu reflexión.</p>' : ev ? UI.evalSummary(ev) : '<p class="muted">Sin evaluación (no había entrega).</p>'}</section>` : ''}`;
  };
  A.saveReflection = (f) => { const c = UI.ctx(); const d = UI.formData(f); S.saveReflection(c.team.id, +d.round, d.text); UI.toast('Reflexión guardada.'); UI.render(); };
  A.verify = (el) => { const r = S.verifyMatch(el.dataset.id); UI.toast(r.same ? `Reproducible: con la misma semilla y los mismos planes vuelve a salir ${r.score.join('-')} con estadísticas idénticas.` : 'Atención: el recálculo no coincide.', r.same ? 'ok' : 'bad'); };

  UI.evalSummary = function (ev) {
    const sc = (ev.final || ev.proposal).scores;
    const total = TC.round1(Object.values(sc).reduce((a, b) => a + b, 0));
    const lab = { micro: ['Diseño del microciclo', 25], plan: ['Plan de partido', 25], coherence: ['Coherencia metodológica y táctica', 20], adaptation: ['Adaptación competitiva', 20], analysis: ['Análisis posterior', 10] };
    return `<div class="card-head"><span>${ev.final ? UI.pill('Revisada por el profesor', 'ok') : UI.pill('Propuesta automática pendiente de revisión', 'warn')}</span><span class="score">${total}<i>/100</i></span></div>
      ${Object.entries(lab).map(([k, [l, max]]) => `<div class="crit"><div class="crit-h"><span>${l}</span><b>${TC.round1(sc[k])}/${max}</b></div>${UI.bar(sc[k], max, 'mid')}${ev.final && ev.final.notes && ev.final.notes[k] ? `<p class="small">${esc(ev.final.notes[k])}</p>` : ''}</div>`).join('')}
      ${ev.final && ev.final.notes && ev.final.notes.general ? `<p><b>Comentario del profesor:</b> ${esc(ev.final.notes.general)}</p>` : ''}`;
  };

  function xgChart(md) {
    const W = 520, H = 150, P = 28;
    const ptsFor = (k) => { let acc = 0; const pts = [[0, 0]]; for (const s of md.seqs) for (const st of s.steps) if (st.k === 'remate' && s.team === k) { pts.push([s.min, acc]); acc += st.xg; pts.push([s.min, acc]); } pts.push([90, acc]); return { pts, acc }; };
    const h = ptsFor('h'), a = ptsFor('a'); const max = Math.max(1, Math.ceil(Math.max(h.acc, a.acc)));
    const x = (m) => P + (m / 90) * (W - P * 2), y = (v) => H - P + 4 - (v / max) * (H - P * 1.5);
    const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    const goals = []; for (const s of md.seqs) for (const st of s.steps) if (st.k === 'gol') goals.push([s.min, s.team]);
    return `<div class="tablewrap"><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="xG acumulado">
      ${Array.from({ length: max + 1 }, (_, i) => `<line x1="${P}" x2="${W - P}" y1="${y(i)}" y2="${y(i)}" class="grid"/><text x="${P - 6}" y="${y(i) + 4}" text-anchor="end" class="ax">${i}</text>`).join('')}
      ${[0, 15, 30, 45, 60, 75, 90].map((m) => `<text x="${x(m)}" y="${H - 6}" text-anchor="middle" class="ax">${m}'</text>`).join('')}
      <path d="${path(h.pts)}" class="ln h" style="stroke:${esc(md.home.color)}"/><path d="${path(a.pts)}" class="ln a" style="stroke:${esc(md.away.color)}"/>
      ${goals.map(([m, k]) => `<circle cx="${x(m)}" cy="${y((k === 'h' ? h : a).pts.find((p) => p[0] >= m)[1])}" r="4" fill="${esc(k === 'h' ? md.home.color : md.away.color)}" stroke="#fff"/>`).join('')}
      </svg></div><p class="small muted"><span class="dot" style="background:${esc(md.home.color)}"></span>${esc(md.home.short)} ${h.acc.toFixed(2)} xG · <span class="dot" style="background:${esc(md.away.color)}"></span>${esc(md.away.short)} ${a.acc.toFixed(2)} xG</p>`;
  }

  /* ───── Visor 2D ───── */
  let RP = null;
  UI.isReplaying = () => !!(RP && RP.playing);
  UI.stopReplay = () => { if (RP && RP.raf) cancelAnimationFrame(RP.raf); RP = null; };
  function buildFrames(md) {
    // fotogramas: una entrada por paso, con posición del balón en coordenadas de campo (0-100, local ataca a la derecha)
    const frames = [];
    let sh = 0, sa = 0;
    for (let i = 0; i < md.seqs.length; i++) {
      const s = md.seqs[i];
      const toAbs = (x) => (s.team === 'h' ? x : 100 - x);
      const startX = { baja: 15, media: 45, alta: 72 }[s.start] || 20;
      frames.push({ seq: i, bx: toAbs(startX), by: 50, team: s.team, k: 'inicio', min: s.min, cap: '', sh, sa, dur: 0.6 });
      for (const st of s.steps) {
        const ok = st.ok;
        if (st.k === 'gol') { if (s.team === 'h') sh++; else sa++; }
        const lab = STEP_LABEL[st.k] ? STEP_LABEL[st.k][ok ? 0 : 1] || STEP_LABEL[st.k][0] : st.k;
        const tname = s.team === 'h' ? md.home.short : md.away.short;
        const p = st.p ? (md.home.players.concat(md.away.players).find((x) => x.id === st.p) || {}).name : '';
        frames.push({ seq: i, bx: toAbs(st.x), by: st.y, team: s.team, k: st.k, ok, min: s.min, cap: `${s.min}' ${tname} · ${lab}${p ? ' · ' + p : ''}${st.xg ? ` (xG ${st.xg})` : ''}`, sh, sa, dur: st.k === 'gol' ? 2.2 : st.k === 'remate' ? 1.1 : 0.9, goal: st.k === 'gol', press: st.press });
        if (!ok && st.k !== 'remate') break;
      }
    }
    return frames;
  }
  function colorDist(a, b) { const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); try { const x = h(a), y = h(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); } catch (e) { return 999; } }
  UI.after.informe = function () {
    UI.stopReplay();
    const md = UI.state.replayData; const cv = UI.$('#replay'); if (!cv || !md) return;
    const ctx = cv.getContext('2d');
    const frames = buildFrames(md);
    const awayCol = colorDist(md.home.color, md.away.color) < 120 ? '#e8edf5' : md.away.color;
    const res = md.res;
    const lineup = (k) => res.lineups[k].map((p, i) => ({ id: p.id, role: p.role, hx: p.x, hy: p.y, n: i + 1 }));
    RP = { frames, i: 0, t: 0, playing: false, last: 0, raf: 0, H: lineup('h'), A: lineup('a') };
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function teamPos(list, side, ball, poss) {
      // posiciones aproximadas: base de la estructura, desplazada hacia el balón según quién tiene la posesión
      return list.map((p) => {
        let x = side === 'h' ? p.hx : 100 - p.hx; let y = p.hy;
        if (p.role === 'POR') return { x: side === 'h' ? 5 : 95, y: 50 + (ball.y - 50) * 0.15, n: p.n };
        const attacking = poss === side;
        const shift = (ball.x - 50) * (attacking ? 0.55 : 0.45);
        x = x * (attacking ? 1 : 0.85) + (side === 'h' ? 0 : 15) * (attacking ? 0 : 1) + shift + (attacking ? (side === 'h' ? 8 : -8) : 0);
        y = y + (ball.y - 50) * (attacking ? 0.15 : 0.35);
        return { x: TC.clamp(x, 3, 97), y: TC.clamp(y, 4, 96), n: p.n };
      });
    }
    let cur = { x: 50, y: 50 };
    function draw(fi, alpha) {
      const f = frames[fi], prev = frames[Math.max(0, fi - 1)];
      const a = reduce ? 1 : alpha;
      const ball = { x: prev.bx + (f.bx - prev.bx) * a, y: prev.by + (f.by - prev.by) * a };
      cur = ball;
      const W = cv.width, Hh = cv.height; const sx = W / 100, sy = Hh / 100;
      // campo
      ctx.fillStyle = '#1d6b3f'; ctx.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 10; i++) if (i % 2) { ctx.fillStyle = '#1f7445'; ctx.fillRect(i * W / 10, 0, W / 10, Hh); }
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, W - 20, Hh - 20); ctx.beginPath(); ctx.moveTo(W / 2, 10); ctx.lineTo(W / 2, Hh - 10); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, Hh / 2, 91, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(10, Hh * 0.2, 165, Hh * 0.6); ctx.strokeRect(W - 175, Hh * 0.2, 165, Hh * 0.6);
      ctx.strokeRect(10, Hh * 0.365, 55, Hh * 0.27); ctx.strokeRect(W - 65, Hh * 0.365, 55, Hh * 0.27);
      if (f.press) { ctx.fillStyle = 'rgba(239,91,91,.18)'; ctx.beginPath(); ctx.arc(ball.x * sx, ball.y * sy, 110, 0, Math.PI * 2); ctx.fill(); }
      const ph = teamPos(RP.H, 'h', ball, f.team), pa = teamPos(RP.A, 'a', ball, f.team);
      for (const [list, col] of [[ph, md.home.color], [pa, awayCol]]) for (const p of list) {
        ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 15, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = col === '#e8edf5' ? '#0b1220' : '#fff'; ctx.font = '600 14px Barlow, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.n, p.x * sx, p.y * sy + 1);
      }
      // trayectoria
      ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(prev.bx * sx, prev.by * sy); ctx.lineTo(ball.x * sx, ball.y * sy); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(ball.x * sx, ball.y * sy, 8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#0b1220'; ctx.lineWidth = 2; ctx.stroke();
      if (f.goal) { ctx.fillStyle = 'rgba(10,18,32,.55)'; ctx.fillRect(0, Hh / 2 - 50, W, 100); ctx.fillStyle = '#fff'; ctx.font = '700 64px "Barlow Condensed", system-ui, sans-serif'; ctx.fillText('GOL', W / 2, Hh / 2 + 4); }
      UI.$('#rp-caption').textContent = f.cap || `${f.min}' ${f.team === 'h' ? md.home.short : md.away.short} inicia la posesión`;
      UI.$('#rp-clock').textContent = f.min + "'";
      UI.$('#sb-h').textContent = f.sh; UI.$('#sb-a').textContent = f.sa; UI.$('#sb-min').textContent = f.min + "'";
      UI.$('#rp-scrub').value = f.seq;
    }
    RP.draw = draw;
    function tick(ts) {
      if (!RP || !RP.playing) return;
      const dt = RP.last ? (ts - RP.last) / 1000 : 0; RP.last = ts;
      const sp = +UI.$('#rp-speed').value || 2;
      RP.t += dt * sp * 1.6;
      while (RP.i < frames.length - 1 && RP.t >= frames[RP.i + 1].dur) { RP.t -= frames[RP.i + 1].dur; RP.i++; }
      if (RP.i >= frames.length - 1) { RP.playing = false; draw(frames.length - 1, 1); UI.$('#sb-min').textContent = 'Final'; UI.$('#rp-play').textContent = 'Reproducir'; return; }
      draw(RP.i + 1, Math.min(1, RP.t / frames[RP.i + 1].dur));
      RP.raf = requestAnimationFrame(tick);
    }
    RP.tick = tick;
    draw(0, 1);
    UI.$('#sb-h').textContent = res.score[0]; UI.$('#sb-a').textContent = res.score[1]; UI.$('#sb-min').textContent = 'Final';
    UI.$('#rp-scrub').addEventListener('input', (e) => { const seq = +e.target.value; RP.i = frames.findIndex((f) => f.seq === seq); RP.t = 0; draw(RP.i, 1); });
  };
  A.rpPlay = (el) => {
    if (!RP) return;
    RP.playing = !RP.playing; el.textContent = RP.playing ? 'Pausa' : 'Reproducir';
    if (RP.playing) { if (RP.i >= RP.frames.length - 1) RP.i = 0; RP.last = 0; RP.raf = requestAnimationFrame(RP.tick); }
  };
  A.rpNextGoal = () => {
    if (!RP) return;
    const j = RP.frames.findIndex((f, i) => i > RP.i && f.goal);
    if (j < 0) { UI.toast('No hay más goles.'); return; }
    // situarse al inicio de la secuencia del gol
    RP.i = RP.frames.findIndex((f) => f.seq === RP.frames[j].seq); RP.t = 0; RP.draw(RP.i, 1);
    if (!RP.playing) { RP.playing = true; UI.$('#rp-play').textContent = 'Pausa'; RP.last = 0; RP.raf = requestAnimationFrame(RP.tick); }
  };
})(window);
