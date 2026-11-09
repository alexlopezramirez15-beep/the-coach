/* THE COACH — Partido en directo: pantalla del profesor (director de juego) y del entrenador (notas del banquillo). */
(function (G) {
  'use strict';
  const TC = G.TC, S = G.TCStore, UI = G.UI;
  const V = UI.views, A = UI.actions, esc = UI.esc;
  const Y = () => G.TCSync && G.TCSync.remote;
  const curRound = (c) => (c.comp ? S.roundOf(c.comp.id, c.comp.currentRound) : null);
  const mmss = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const typing = () => { const a = document.activeElement; return (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || document.getElementById('modal'); };
  const phaseLabel = (rd) => ({ h1: 'Primera parte', ht: 'Descanso', h2: 'Segunda parte', ft: 'Final' }[rd.live.status] || '');

  // Aviso en todas las pantallas mientras hay partido en directo
  UI.liveBanner = function (c, view) {
    const rd = curRound(c); if (!rd || rd.status !== 'live' || !rd.live || view === 'directo' || view === 'profe-directo') return '';
    if (c.user.role === 'teacher') return `<a class="live-banner" href="#profe-directo" data-go="profe-directo"><span class="dot-live"></span> Partidos en directo · ${phaseLabel(rd)} · abrir panel</a>`;
    const open = c.team ? ((rd.live.notes || {})[c.team.id] || []).filter((n) => S.noteOpen(rd, n) && !(S.liveAnswersOf(rd, c.team.id) || {})[n.id]).length : 0;
    return `<a class="live-banner ${open ? 'alert' : ''}" href="#directo" data-go="directo"><span class="dot-live"></span> Partido en directo · ${phaseLabel(rd)}${open ? ` · <b>${open} nota${open > 1 ? 's' : ''} del banquillo sin responder</b>` : ''}</a>`;
  };

  function scoreboard(c, rd, m) {
    const f = (rd.live && rd.live.feed && rd.live.feed[m.id]) || { min: 0, score: [0, 0], events: [] };
    const h = S.getTeam(m.homeId), a = S.getTeam(m.awayId);
    return `<div class="live-sb"><div class="sb-t">${UI.teamBadge(h, 34)}<b>${esc(h.name)}</b></div><div class="sb-s"><b>${f.score[0]} - ${f.score[1]}</b><small data-livemin>${f.min}'</small></div><div class="sb-t r"><b>${esc(a.name)}</b>${UI.teamBadge(a, 34)}</div></div>
      <ul class="live-ev">${f.events.slice().reverse().map((e) => `<li class="${e.kind}"><time>${e.min}'</time> ${esc(e.text)}</li>`).join('') || '<li class="muted">Todavía no ha pasado nada destacable.</li>'}</ul>`;
  }
  function clockHtml(rd) {
    const clk = S.liveClock(rd);
    return `<div class="live-clock"><span class="dot-live"></span><b>${phaseLabel(rd)}</b>${rd.live.status === 'h1' || rd.live.status === 'h2' ? ` · minuto <b data-liveclock>${clk.minute}'</b> · quedan <span data-liveleft>${mmss(clk.left)}</span>` : ''}</div>`;
  }

  /* ───── Entrenador ───── */
  V.directo = function (c) {
    const team = c.team; const rd = curRound(c);
    const m = S.matchesOf(c.comp.id, c.comp.currentRound).find((x) => x.homeId === team.id || x.awayId === team.id);
    const lastPlayed = S.matchesOf(c.comp.id).filter((x) => x.status === 'played' && (x.homeId === team.id || x.awayId === team.id) && x.result.live).sort((a, b) => b.round - a.round)[0];
    if (!rd || rd.status !== 'live') {
      return `<div class="page-head"><h1>Partido en directo</h1><p class="muted">Cuando el profesor pulse «Iniciar partidos», aquí verás el marcador minuto a minuto y te llegarán notas del banquillo con situaciones del partido. Tendrás unos minutos para elegir un ajuste táctico y escribir la consigna para tus jugadores. Tus respuestas cambian lo que pasa en el campo.</p></div>
        ${lastPlayed ? reviewHtml(c, lastPlayed) : '<div class="card"><p class="muted">No hay ningún partido en directo ahora mismo.</p></div>'}`;
    }
    const notes = ((rd.live.notes || {})[team.id] || []).slice().reverse();
    const ans = S.liveAnswersOf(rd, team.id) || {};
    UI._liveSeen = notes.length;
    return `<div class="page-head"><div class="eyebrow">Jornada ${rd.number}</div><h1>Partido en directo</h1>${clockHtml(rd)}</div>
      <div class="grid g-live"><section class="card">${m ? scoreboard(c, rd, m) : ''}</section>
      <section class="stack"><h2 class="phase-t">Notas del banquillo</h2>${notes.map((n) => noteCard(c, rd, n, ans[n.id])).join('') || '<div class="card"><p class="muted">Todavía no hay notas. Atento: llegarán durante el partido.</p></div>'}</section></div>`;
  };
  function noteCard(c, rd, n, a) {
    const open = S.noteOpen(rd, n); const team = c.team;
    const lu = (S.lastSubmission(team.id, rd.number) || {}).snapshot; const byId = Object.fromEntries(team.players.map((p) => [p.id, p]));
    const bench = lu ? (lu.lineup.bench || []).map((id) => byId[id]).filter(Boolean) : [];
    const head = `<div class="card-head"><h3>${esc(n.title)}</h3>${a ? UI.pill('Respondida', 'ok') : open ? `<span class="pill warn" data-noteleft="${n.halftime ? '' : n.releasedAt + (n.window + 20) * 1000}">${n.halftime ? 'Hasta que empiece la 2.ª parte' : 'Responde ya'}</span>` : UI.pill('Tiempo agotado', 'bad')}</div><p>${esc(n.text)}</p>`;
    if (a) { const o = n.options.find((x) => x.i === a.opt); return `<article class="card note done">${head}<p class="small"><b>Tu ajuste:</b> ${esc(o ? o.label : '—')}${a.subIn && byId[a.subIn] ? `<br><b>Entra:</b> ${esc(byId[a.subIn].name)}` : ''}<br><b>Tu consigna:</b> ${esc(a.text)}</p></article>`; }
    if (!open) return `<article class="card note late">${head}<p class="small muted">No respondiste a tiempo: el equipo siguió igual.</p></article>`;
    return `<form class="card note open" data-submit="answerNote"><input type="hidden" name="note" value="${esc(n.id)}">${head}
      <fieldset class="field"><legend>¿Qué ajuste táctico haces?</legend><div class="opts">${n.options.map((o) => `<label class="opt"><input type="radio" name="opt" value="${o.i}" required><span>${esc(o.label)}</span></label>`).join('')}</div></fieldset>
      ${n.sub ? `<label class="field"><span>¿Quién entra por ${esc((byId[n.injured] || {}).name || 'el lesionado')}?</span><select name="subIn" required><option value="">Elige un suplente…</option>${bench.map((p) => `<option value="${p.id}">${esc(p.name)} · ${p.pos}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>Consigna a tus jugadores (qué tienen que hacer y quién)</span><textarea name="text" rows="3" required minlength="15" placeholder="Ej.: nombra a los jugadores y di exactamente qué cambian"></textarea></label>
      <div class="row end"><button class="btn primary" type="submit">Enviar al campo</button></div></form>`;
  }
  A.answerNote = async (f) => {
    const d = UI.formData(f); const c = UI.ctx();
    S.answerNote(c.team.id, d.note, { opt: d.opt, text: d.text, subIn: d.subIn });
    if (Y()) await G.TCSync.flushNow();
    UI.toast('Consigna enviada al campo.'); document.activeElement && document.activeElement.blur(); UI.render();
  };
  function reviewHtml(c, m) {
    const k = m.homeId === c.team.id ? 'h' : 'a'; const lv = m.result.live[k];
    if (!lv) return '';
    return `<section class="card"><div class="card-head"><h3>Tus decisiones en la jornada ${m.round}</h3>${lv.avg != null ? UI.pill(Math.round(lv.avg * 100) + '/100', lv.avg >= 0.7 ? 'ok' : lv.avg >= 0.45 ? 'warn' : 'bad') : ''}</div>
      <p class="muted small">Resultado: ${esc(S.getTeam(m.homeId).name)} ${m.result.score.join('-')} ${esc(S.getTeam(m.awayId).name)}. Cada respuesta cambió los minutos siguientes del partido.</p>
      ${lv.items.map((x) => `<div class="moment"><div class="entry-h"><b>${x.note.halftime ? 'Descanso' : x.note.min + "'"} · ${esc(x.note.title)}</b>${UI.pill(Math.round(x.eval.q * 100) + '/100', x.eval.q >= 0.7 ? 'ok' : x.eval.q >= 0.45 ? 'warn' : 'bad')}</div><p class="small">${esc(x.eval.feedback)}</p>${x.answer ? `<p class="small muted">Tu consigna: ${esc(x.answer.text)}</p>` : ''}</div>`).join('')}</section>`;
  }

  /* ───── Profesor ───── */
  V['profe-directo'] = function (c) {
    const comp = c.comp; const rd = curRound(c);
    if (!rd || rd.status !== 'live') {
      return `<div class="page-head"><h1>Partido en directo</h1><p class="muted">Cuando la semana esté abierta y los alumnos hayan entregado, pulsa «Iniciar partidos». Los partidos se juegan en dos partes y, mientras tanto, cada entrenador recibe notas del banquillo con situaciones del partido que debe responder. La app evalúa cada respuesta y su efecto decide el resultado.</p></div>
        ${rd && rd.status === 'open' ? '<div class="card"><button class="btn primary" data-act="liveStart">Iniciar partidos en directo</button></div>' : '<div class="card"><p class="muted">No hay partidos en directo. La semana tiene que estar abierta.</p></div>'}`;
    }
    const L = rd.live; const teams = S.teamsOf(comp.id);
    const rows = teams.filter((t) => t.coachId).map((t) => { const notes = (L.notes[t.id] || []); const ans = S.liveAnswersOf(rd, t.id) || {}; const u = S.users().find((x) => x.id === t.coachId); return `<tr><td>${UI.teamBadge(t, 20)} ${esc(t.name)}</td><td>${esc(u ? u.name : '')}</td><td>${notes.map((n) => `<span class="pill ${ans[n.id] ? 'ok' : S.noteOpen(rd, n) ? 'warn' : 'bad'}" title="${esc(n.title)}">${n.halftime ? 'D' : n.min + "'"}</span>`).join(' ') || '—'}</td></tr>`; }).join('');
    return `<div class="page-head"><div class="eyebrow">Jornada ${rd.number} · partes de ${Math.round(L.halfSec / 60)} min</div><h1>Partido en directo</h1>${clockHtml(rd)}
        <p class="small muted">Deja esta pantalla abierta (puedes proyectarla en clase): desde aquí se generan las notas y se actualizan los marcadores.</p></div>
      <div class="row wrap">${L.status === 'h1' || L.status === 'h2' ? `<button class="btn ghost" data-act="liveEndHalf">Terminar ${L.status === 'h1' ? 'la primera' : 'la segunda'} parte ya</button>` : ''}${L.status === 'ht' ? '<button class="btn primary" data-act="liveSecond">Empezar la segunda parte</button>' : ''}${L.status === 'ft' ? '<button class="btn primary" data-act="liveFinish">Final: guardar resultados y evaluaciones</button>' : ''}</div>
      <div class="grid g2">${S.matchesOf(comp.id, rd.number).map((m) => `<section class="card">${scoreboard(c, rd, m)}</section>`).join('')}</div>
      ${rows ? `<section class="card"><h3>Respuestas de los entrenadores</h3><p class="small muted">Verde: respondida · Ámbar: abierta · Rojo: sin responder a tiempo.</p><div class="tablewrap"><table class="table"><thead><tr><th>Equipo</th><th>Entrenador</th><th>Notas</th></tr></thead><tbody>${rows}</tbody></table></div></section>` : ''}`;
  };
  A.liveStart = () => {
    UI.modal(`<h3>Iniciar partidos en directo</h3><p class="small muted">Se bloquean las entregas de la semana. Los equipos sin entrega juegan con alineación automática y sin efecto del entrenamiento.</p>
      <form data-submit="liveStartGo" class="stack"><label class="field"><span>Duración de cada parte</span><select name="half"><option value="15">15 minutos</option><option value="10">10 minutos</option><option value="5">5 minutos</option><option value="2">2 minutos (prueba)</option></select></label>
      <button class="btn primary" type="submit">Empezar la primera parte</button></form>`);
  };
  A.liveStartGo = async (f) => { const d = UI.formData(f); const c = UI.ctx(); S.startLive(c.comp.id, +d.half); UI.closeModal(); if (Y()) await G.TCSync.flushNow(); UI.toast('¡Empiezan los partidos!'); UI.go('profe-directo'); };
  A.liveSecond = async () => { const c = UI.ctx(); S.startSecondHalf(c.comp.id); if (Y()) await G.TCSync.flushNow(); UI.render(); };
  A.liveEndHalf = () => { const c = UI.ctx(); UI.ask('Terminar la parte', 'Se adelanta el final de esta parte. Las notas que falten se generan ahora.', 'Terminar', async () => { S.endFirstHalfNow(c.comp.id); if (Y()) await G.TCSync.flushNow(); UI.render(); }); };
  A.liveFinish = async () => { const c = UI.ctx(); const r = S.playRound(c.comp.id); if (Y()) await G.TCSync.flushNow(); UI.toast(`Jornada ${r.round} terminada. Resultados y evaluaciones guardados.`); UI.go('profe-jornadas'); };

  /* ───── Reloj: actualiza minutos y cuenta atrás; el profesor además dirige el partido ───── */
  let lastTick = 0;
  setInterval(() => {
    let c; try { c = UI.ctx(); } catch (e) { return; }
    if (!c || !c.user || !c.comp) return;
    const rd = curRound(c); const live = rd && rd.status === 'live' && rd.live;
    if (G.TCSync && G.TCSync.setPollSeconds) G.TCSync.setPollSeconds(live ? 5 : (G.TC_CONFIG || {}).pollSeconds || 15);
    if (!live) return;
    const clk = S.liveClock(rd);
    document.querySelectorAll('[data-liveclock]').forEach((el) => { el.textContent = clk.minute + "'"; });
    document.querySelectorAll('[data-liveleft]').forEach((el) => { el.textContent = mmss(clk.left); });
    document.querySelectorAll('[data-noteleft]').forEach((el) => { const end = +el.dataset.noteleft; if (end) el.textContent = 'Quedan ' + mmss((end - Date.now()) / 1000); });
    if (c.user.role === 'teacher' && Date.now() - lastTick > 4000) {
      lastTick = Date.now();
      let ch = false; try { ch = S.liveTick(c.comp.id); } catch (e) { console.error(e); }
      if (ch && !typing()) { const y = window.scrollY; UI.render(); window.scrollTo(0, y); }
    }
    if (c.user.role === 'student' && c.team) {
      const n = ((rd.live.notes || {})[c.team.id] || []).length;
      if (UI._liveNotes != null && n > UI._liveNotes) { UI.toast('📣 Nueva nota del banquillo: responde antes de que se acabe el tiempo.'); if (!typing()) { const y = window.scrollY; UI.render(); window.scrollTo(0, y); } }
      UI._liveNotes = n;
      // una nota caducada cambia de estado: refrescar si no se está escribiendo
      if (UI.state.view === 'directo' && !typing() && document.querySelector('form.note.open [data-noteleft]')) {
        const exp = [...document.querySelectorAll('form.note.open [data-noteleft]')].some((el) => +el.dataset.noteleft && +el.dataset.noteleft < Date.now());
        if (exp) UI.render();
      }
    }
  }, 1000);
})(window);
