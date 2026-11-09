/* THE COACH — Club, ficha de jugador con DAFO, pizarra de plantilla y cuaderno del modelo de juego. */
(function (G) {
  'use strict';
  const TC = G.TC, S = G.TCStore, UI = G.UI, ART = G.TCArt, ST = G.TCStories;
  const V = UI.views, A = UI.actions, esc = UI.esc;
  const DAFO = [['f', 'Fortalezas', 'Internas · positivas', 'Qué hace bien y le diferencia. Búscalo en «Lo que aporta en el campo» y en su perfil.'],
    ['d', 'Debilidades', 'Internas · negativas', 'Qué le limita a él mismo. Pistas en «Lo que le cuesta» y en el carácter.'],
    ['a', 'Amenazas', 'Externas · negativas', 'Qué del entorno puede perjudicarle: competencia en el puesto, lesiones, contrato, edad, ofertas…'],
    ['o', 'Oportunidades', 'Externas · positivas', 'Qué del entorno puede aprovechar: puestos sin dueño, posiciones secundarias, un modelo que le encaje, minutos…']];
  const lineOf = (p) => TC.POSITIONS[p.pos].line;
  const ORDER = Object.keys(TC.POSITIONS);
  const sortPlayers = (ps) => ps.slice().sort((a, b) => ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos) || TC.playerRating(b) - TC.playerRating(a));
  const dafoCount = (d) => (d ? ['f', 'd', 'a', 'o'].filter((k) => (d[k] || '').trim().length >= 3).length : 0);

  // Escudos en toda la app
  UI.teamBadge = (t, size) => (t ? `<span class="crest-wrap" title="${esc(t.name)}">${ART.crest(t, size || 28)}</span>` : '');

  /* ───── Historia del club ───── */
  V.club = function (c) {
    const t = c.team; const text = ST.clubHistory(t, c.comp);
    return `<div class="page-head club-head">${ART.crest(t, 96)}<div><div class="eyebrow">Historia del club</div><h1>${esc(t.name)}</h1><p class="muted">Fundado en ${ART.crestSpec(t).founded} · ${ST.words(text).toLocaleString('es-ES')} palabras · Léela antes de analizar a tus jugadores: el club tiene una identidad y unas expectativas.</p></div></div>
    <article class="card story">${ST.toHtml(text, esc)}</article>`;
  };

  /* ───── Ficha del jugador ───── */
  V.jugador = function (c, p) {
    const t = c.team; const list = sortPlayers(t.players);
    const pl = t.players.find((x) => x.id === (p && p.id)) || list[0];
    const i = list.indexOf(pl); const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    const r = TC.playerRating(pl); const groups = Object.entries(TC.ATTR_GROUPS);
    const gAvg = (g) => Math.round(TC.avg(g.attrs.map((a) => pl.attrs[a[0]])));
    const nb = S.getNotebook(t.id); const d = (nb.dafo || {})[pl.id] || {};
    const editable = S.canEditTeam(c.user, t);
    const story = ST.playerStory(pl, t);
    return `<div class="page-head row between wrap"><a href="#plantilla" data-go="plantilla" class="link">← Plantilla</a>
      <span class="row"><button class="btn sm ghost" data-go="jugador" data-p='{"id":"${prev.id}"}'>← ${esc(prev.name)}</button><button class="btn sm ghost" data-go="jugador" data-p='{"id":"${next.id}"}'>${esc(next.name)} →</button></span></div>
    <section class="card player-hero">
      <div class="ph-photo">${ART.portrait(pl, t, 150)}</div>
      <div class="ph-main"><div class="row wrap">${UI.teamBadge(t, 26)}<span class="muted small">${esc(t.name)}</span></div>
        <h1>${esc(pl.name)}</h1><p class="muted">${esc(TC.POSITIONS[pl.pos].label)}${pl.sec.length ? ' · también ' + pl.sec.map((s) => TC.POSITIONS[s].label.toLowerCase()).join(', ') : ''} · ${esc(pl.profile)}</p>
        <dl class="facts"><div><dt>Edad</dt><dd>${pl.age}</dd></div><div><dt>Altura</dt><dd>${pl.height} cm</dd></div><div><dt>Pierna</dt><dd>${pl.foot}</dd></div><div><dt>Valoración</dt><dd><span class="rt ${UI.attrClass(r)}">${r}</span></dd></div><div><dt>Fatiga</dt><dd>${pl.fatigue}</dd></div><div><dt>DAFO</dt><dd>${dafoCount(d)}/4</dd></div></dl>
        <div class="gsum">${groups.map(([k, g]) => `<div><small>${g.label}</small><b class="${UI.attrClass(gAvg(g))}">${gAvg(g)}</b></div>`).join('')}</div></div>
    </section>
    <div class="grid g-player">
      <article class="card story"><h2>Informe del jugador</h2><p class="small muted">${ST.words(story)} palabras. Lee con atención: las fortalezas, debilidades, amenazas y oportunidades están en el texto, pero no te las damos hechas.</p>${ST.toHtml(story, esc)}</article>
      <div class="stack">
        <form class="card dafo-card" data-submit="saveDafo"><input type="hidden" name="pid" value="${pl.id}">
          <div class="card-head"><h3>DAFO de ${esc(pl.name.split(' ')[0])}</h3>${UI.pill(dafoCount(d) + '/4', dafoCount(d) === 4 ? 'ok' : dafoCount(d) ? 'warn' : '')}</div>
          <div class="dafo">${DAFO.map(([k, l, sub, hint]) => `<label class="dafo-q q-${k}"><span><b>${l}</b><small>${sub}</small></span><textarea name="${k}" rows="5" placeholder="${esc(hint)}" ${editable ? '' : 'disabled'}>${esc(d[k] || '')}</textarea></label>`).join('')}</div>
          ${editable ? `<div class="row between wrap"><span class="small muted">${d.at ? 'Guardado ' + UI.fmtDate(d.at) : 'Sin guardar'}</span><button class="btn primary" type="submit">Guardar DAFO</button></div>` : ''}
        </form>
        ${groups.map(([k, g]) => `<section class="card"><h3>${g.label}</h3>${g.attrs.map(([a, l]) => `<div class="attr"><span>${esc(l)}</span>${UI.bar(pl.attrs[a], 100, UI.attrClass(pl.attrs[a]))}<b class="${UI.attrClass(pl.attrs[a])}">${pl.attrs[a]}</b></div>`).join('')}</section>`).join('')}
      </div>
    </div>`;
  };
  A.saveDafo = (f) => {
    const d = UI.formData(f); const t = UI.ctx().team;
    S.saveDafo(t.id, d.pid, d); UI.toast('DAFO guardado.');
    if (UI.state.view === 'plantilla') { UI.closeModal(); UI.render(); } else UI.render();
  };

  /* ───── Pizarra de plantilla ───── */
  function boardOf(t) {
    const nb = S.getNotebook(t.id); const b = nb.board || {};
    const formation = b.formation && TC.FORMATIONS[b.formation] ? b.formation : (TC.FORMATIONS[t.model.defStructure] ? t.model.defStructure : '1-4-3-3');
    const n = TC.FORMATIONS[formation].length;
    const slots = Array.from({ length: n }, (_, i) => ((b.slots || [])[i] && t.players.some((p) => p.id === b.slots[i]) ? b.slots[i] : null));
    return { formation, slots };
  }
  V.plantilla = function (c) {
    const t = c.team; const b = boardOf(t); const nb = S.getNotebook(t.id);
    const slots = TC.FORMATIONS[b.formation];
    const placed = new Set(b.slots.filter(Boolean));
    const done = t.players.filter((p) => dafoCount((nb.dafo || {})[p.id]) === 4).length;
    const pid = (id) => t.players.find((p) => p.id === id);
    return `<div class="page-head"><h1>Plantilla</h1><p class="muted">Sitúa a tus jugadores en el campo según tu idea. Pulsa sobre cualquiera para ver el DAFO que has creado y su informe. DAFO completos: <b>${done}/${t.players.length}</b>.</p></div>
    <div class="grid g-board">
      <section class="card"><div class="card-head"><h3>Mi once</h3><label class="row small">Sistema <select class="mini" data-change="boardFormation">${Object.keys(TC.FORMATIONS).map((f) => UI.opt(f, f, b.formation)).join('')}</select></label></div>
        <div class="board-pitch" role="group" aria-label="Campo">
          <div class="bp-lines"><i class="bp-half"></i><i class="bp-circle"></i><i class="bp-box top"></i><i class="bp-box bottom"></i></div>
          ${slots.map(([role, x, y], i) => { const p = pid(b.slots[i]); const top = 95 - (x / 86) * 86; const left = y; return `<button class="bp-slot ${p ? 'on' : ''}" style="top:${top.toFixed(1)}%;left:${left}%" data-act="boardSlot" data-i="${i}" aria-label="${role}">${p ? `<span class="bp-face">${ART.portrait(p, t, 40)}</span><b>${esc(p.name.split(' ').slice(-1)[0])}</b><small>${role} · DAFO ${dafoCount((nb.dafo || {})[p.id])}/4</small>` : `<span class="bp-empty">+</span><small>${role}</small>`}</button>`; }).join('')}
        </div>
        <div class="row wrap"><button class="btn sm ghost" data-act="boardAuto">Colocar automáticamente</button><button class="btn sm ghost" data-act="boardClear">Vaciar</button></div>
      </section>
      <section class="card"><h3>Sin situar en el once</h3><div class="bench">${sortPlayers(t.players).filter((p) => !placed.has(p.id)).map((p) => `<button class="bench-p" data-act="boardPlayer" data-id="${p.id}"><span class="bp-face">${ART.portrait(p, t, 34)}</span><span><b>${esc(p.name)}</b><small>${p.pos} · DAFO ${dafoCount((nb.dafo || {})[p.id])}/4</small></span></button>`).join('') || '<p class="muted small">Todos están en el campo.</p>'}</div></section>
    </div>
    <section class="card"><h3>Todos los jugadores</h3><div class="tablewrap"><table class="table squad"><thead><tr><th></th><th>Pos</th><th>Jugador</th><th>Edad</th><th>Pie</th><th>Val.</th><th>Técnica</th><th>Táctica</th><th>Físico</th><th>Psicológico</th><th>DAFO</th></tr></thead><tbody>
      ${sortPlayers(t.players).map((p) => { const r = TC.playerRating(p); const ga = (g) => Math.round(TC.avg(TC.ATTR_GROUPS[g].attrs.map((a) => p.attrs[a[0]]))); const dc = dafoCount((nb.dafo || {})[p.id]); return `<tr class="click" data-go="jugador" data-p='{"id":"${p.id}"}'><td class="mini-face">${ART.portrait(p, t, 28)}</td><td><span class="pos ${lineOf(p)}">${p.pos}</span></td><td><b>${esc(p.name)}</b><small class="muted"> ${esc(p.profile)}</small></td><td>${p.age}</td><td>${p.foot[0]}</td><td><span class="rt ${UI.attrClass(r)}">${r}</span></td>${['tecnicos', 'tacticos', 'fisicos', 'psicologicos'].map((g) => `<td class="${UI.attrClass(ga(g))}">${ga(g)}</td>`).join('')}<td>${UI.pill(dc + '/4', dc === 4 ? 'ok' : dc ? 'warn' : '')}</td></tr>`; }).join('')}
    </tbody></table></div></section>`;
  };
  function saveBoard(t, b) { S.saveNotebook(t.id, { board: { formation: b.formation, slots: b.slots } }); }
  A.boardFormation = (el) => { const t = UI.ctx().team; const b = boardOf(t); const n = TC.FORMATIONS[el.value].length; saveBoard(t, { formation: el.value, slots: Array.from({ length: n }, (_, i) => b.slots[i] || null) }); UI.render(); };
  A.boardAuto = () => { const t = UI.ctx().team; const b = boardOf(t); const lu = TC.autoLineup(t.players, b.formation); saveBoard(t, { formation: b.formation, slots: lu.slots }); UI.render(); };
  A.boardClear = () => { const t = UI.ctx().team; const b = boardOf(t); saveBoard(t, { formation: b.formation, slots: b.slots.map(() => null) }); UI.render(); };
  function dafoModal(t, p, slotIdx) {
    const nb = S.getNotebook(t.id); const d = (nb.dafo || {})[p.id] || {};
    UI.modal(`<div class="row">${ART.portrait(p, t, 72)}<div><h3>${esc(p.name)}</h3><p class="small muted">${esc(TC.POSITIONS[p.pos].label)} · ${p.age} años · ${esc(p.profile)}</p></div></div>
      <form data-submit="saveDafo" class="stack"><input type="hidden" name="pid" value="${p.id}"><div class="dafo">${DAFO.map(([k, l, sub]) => `<label class="dafo-q q-${k}"><span><b>${l}</b><small>${sub}</small></span><textarea name="${k}" rows="3">${esc(d[k] || '')}</textarea></label>`).join('')}</div>
      <div class="row between wrap"><span class="row">${slotIdx != null ? `<button class="btn sm ghost" type="button" data-act="boardPick" data-i="${slotIdx}">Cambiar jugador</button><button class="btn sm ghost" type="button" data-act="boardRemove" data-i="${slotIdx}">Quitar del once</button>` : ''}<button class="btn sm ghost" type="button" data-act="openPlayer" data-id="${p.id}">Ver informe completo</button></span><button class="btn primary" type="submit">Guardar DAFO</button></div></form>`, { wide: true });
  }
  function pickModal(t, i) {
    const b = boardOf(t); const role = TC.FORMATIONS[b.formation][i][0];
    const list = t.players.slice().sort((x, y) => TC.playerRating(y, role) * TC.posFit(y, role) - TC.playerRating(x, role) * TC.posFit(x, role));
    UI.modal(`<h3>Elige jugador para ${role}</h3><p class="small muted">Ordenados por encaje en el puesto. Los que ya están en el once se intercambian.</p><div class="bench">${list.map((p) => `<button class="bench-p" data-act="boardSet" data-i="${i}" data-id="${p.id}"><span class="bp-face">${ART.portrait(p, t, 34)}</span><span><b>${esc(p.name)}</b><small>${p.pos}${p.sec.length ? ' (' + p.sec.join(', ') + ')' : ''} · ${TC.playerRating(p, role)} en ${role}${b.slots.includes(p.id) ? ' · en el once' : ''}</small></span></button>`).join('')}</div>`, { wide: true });
  }
  A.boardSlot = (el) => { const t = UI.ctx().team; const b = boardOf(t); const i = +el.dataset.i; const p = t.players.find((x) => x.id === b.slots[i]); if (p) dafoModal(t, p, i); else pickModal(t, i); };
  A.boardPick = (el) => pickModal(UI.ctx().team, +el.dataset.i);
  A.boardPlayer = (el) => { const t = UI.ctx().team; dafoModal(t, t.players.find((x) => x.id === el.dataset.id), null); };
  A.boardSet = (el) => { const t = UI.ctx().team; const b = boardOf(t); const i = +el.dataset.i; const j = b.slots.indexOf(el.dataset.id); if (j >= 0) b.slots[j] = b.slots[i]; b.slots[i] = el.dataset.id; saveBoard(t, b); UI.closeModal(); UI.render(); };
  A.boardRemove = (el) => { const t = UI.ctx().team; const b = boardOf(t); b.slots[+el.dataset.i] = null; saveBoard(t, b); UI.closeModal(); UI.render(); };
  A.openPlayer = (el) => { UI.closeModal(); UI.go('jugador', { id: el.dataset.id }); };

  /* ───── Cuaderno del modelo de juego ───── */
  const workOf = (m) => { const w = Object.assign(TC.blankWork(), (m && m.work) || {}); w.moments = Object.assign(TC.blankWork().moments, w.moments || {}); w.lines = Object.assign({ def: '', mid: '', att: '' }, w.lines || {}); w.ideas = (w.ideas || []).concat(['', '', '', '', '']).slice(0, 5); return w; };
  const FIELDS = (key) => Object.fromEntries(Object.entries(TC.MODEL_FIELDS).map(([k, g]) => [k, g.fields]))[key] || [];
  const selects = (fields, m, editable, skip) => `<div class="fields compact">${fields.filter(([f]) => !(skip || []).includes(f)).map(([f, l, opts]) => `<label class="field"><span>${esc(l)}</span><select name="${f}" ${editable ? '' : 'disabled'}>${UI.opts(opts, m[f])}</select></label>`).join('')}</div>`;
  V.modelo = function (c) {
    const t = c.team; const m = t.model; const w = workOf(m);
    const editable = S.canEditTeam(c.user, t);
    const live = TC.validateModel(m, t.players);
    const gated = UI.state.gated; UI.state.gated = null;
    const missing = S.modelMissing(Object.assign({}, m, { work: workOf(m) }));
    const dis = editable ? '' : 'disabled';
    const players = sortPlayers(t.players);
    const moment = (k, label) => { const mo = w.moments[k]; return `<div class="moment"><h4>${esc(label)}</h4>
      <label class="field"><span>Fundamento de juego</span><input name="w.m.${k}.fund" list="fundamentos" value="${esc(mo.fund)}" placeholder="Ej. Tercer hombre, fijar para liberar…" ${dis}></label>
      <label class="field"><span>Explicación</span><textarea name="w.m.${k}.expl" rows="3" placeholder="¿Qué queremos que pase y cómo? ¿Por qué con estos jugadores?" ${dis}>${esc(mo.expl)}</textarea></label>
      <fieldset class="field"><legend>Jugadores principales que intervienen</legend><div class="pick">${players.map((p) => `<label class="pchip"><input type="checkbox" name="w.m.${k}.players" value="${p.id}" ${(mo.players || []).includes(p.id) ? 'checked' : ''} ${dis}><span>${p.pos} ${esc(p.name.split(' ').slice(-1)[0])}</span></label>`).join('')}</div></fieldset></div>`; };
    const phase = (key) => { const g = TC.MODEL_MOMENTS[key]; const fields = key === 'ofensiva' ? FIELDS('ofensiva') : key === 'defensiva' ? FIELDS('defensiva') : FIELDS('transAD').concat(FIELDS('transDA'));
      return `<section class="card phase"><h2 class="phase-t">${esc(g.label)}</h2><details class="decisions"><summary>Decisiones tácticas (las usa el simulador)</summary>${selects(fields, m, editable, ['defStructure', 'attStructure'])}</details>${g.moments.map(([k, l]) => moment(k, l)).join('')}</section>`; };
    return `<div class="page-head">${!m.submittedAt ? '<div class="eyebrow">Paso 2 de 2 antes de competir</div>' : ''}<h1>Modelo de juego</h1><p class="muted">Construye tu modelo a partir de la plantilla que te ha tocado. Apóyate en el DAFO de tus jugadores: cada decisión debe poder explicarse con nombres propios.</p></div>
    ${gated ? '<div class="notice warn">Antes de planificar la semana tienes que presentar tu modelo de juego.</div>' : ''}
    ${m.submittedAt ? `<div class="notice ok">Modelo presentado el ${UI.fmtDate(m.submittedAt)} con una validación de ${m.validation ? m.validation.score : '—'}/100. Puedes ajustarlo y volver a presentarlo cuando quieras.</div>` : ''}
    <datalist id="fundamentos">${TC.FUNDAMENTOS.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
    <div class="grid g-task"><form data-submit="saveModel" data-change="modelLive" id="model-form" class="stack">
      <section class="card"><h2 class="phase-t">Características generales de nuestra plantilla</h2><p class="small muted">Describe cada línea: qué la hace fuerte, qué le falta y qué jugadores marcan la diferencia.</p>
        ${[['def', 'Línea defensiva'], ['mid', 'Línea de medios'], ['att', 'Línea de delanteros']].map(([k, l]) => `<label class="field"><span>${l}</span><textarea name="w.lines.${k}" rows="3" ${dis}>${esc(w.lines[k])}</textarea></label>`).join('')}</section>
      <section class="card"><h2 class="phase-t">Idea de juego</h2><p class="small muted">Cinco ideas que definan cómo quieres que juegue tu equipo (mínimo tres).</p>
        <ol class="ideas">${w.ideas.map((x, i) => `<li><input name="w.ideas.${i}" value="${esc(x)}" placeholder="Idea ${i + 1}" ${dis}></li>`).join('')}</ol></section>
      <section class="card"><h2 class="phase-t">Sistema de juego</h2>
        <div class="fields compact"><label class="field"><span>Sistema (sin balón y alineación)</span><select name="defStructure" ${dis}>${UI.opts(Object.keys(TC.FORMATIONS), m.defStructure)}</select></label><label class="field"><span>Estructura con balón</span><select name="attStructure" ${dis}>${UI.opts(Object.keys(TC.ATT_STRUCTURES), m.attStructure)}</select></label></div>
        <label class="field"><span>¿Por qué este sistema con esta plantilla?</span><textarea name="w.systemText" rows="3" ${dis}>${esc(w.systemText)}</textarea></label></section>
      ${phase('ofensiva')}${phase('defensiva')}${phase('transiciones')}
      <section class="card"><h2 class="phase-t">Acciones a balón parado</h2>${selects(FIELDS('abp'), m, editable)}</section>
      ${editable ? `<div class="sticky-actions"><span class="muted small">${m.updatedAt ? 'Guardado ' + UI.fmtDate(m.updatedAt) : 'Sin guardar'}</span><span class="row"><button class="btn ghost" type="submit">Guardar borrador</button><button class="btn primary" type="button" data-act="presentModel">${m.submittedAt ? 'Volver a presentar' : 'Presentar modelo'}</button></span></div>` : ''}
    </form>
    <aside class="stack sticky" id="model-val"><section class="card" id="model-missing">${missingHtml(missing)}</section>${UI.validationPanel(live)}</aside></div>`;
  };
  function missingHtml(missing) { return missing.length ? `<h3>Te falta</h3><ul class="small">${missing.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<h3>Listo para presentar</h3><p class="small muted">Todos los apartados están completos.</p>`; }
  function readModel() {
    const f = UI.$('#model-form'); const d = UI.formData(f); const t = UI.ctx().team;
    const w = workOf(t.model); const out = Object.assign({}, t.model);
    for (const [k, v] of Object.entries(d)) {
      if (!k.startsWith('w.')) { out[k] = v; continue; }
      const parts = k.split('.');
      if (parts[1] === 'lines') w.lines[parts[2]] = v;
      else if (parts[1] === 'ideas') w.ideas[+parts[2]] = v;
      else if (parts[1] === 'systemText') w.systemText = v;
      else if (parts[1] === 'm') { const mo = w.moments[parts[2]]; if (parts[3] === 'players') continue; mo[parts[3]] = v; }
    }
    for (const k of Object.keys(w.moments)) w.moments[k].players = UI.$$(`input[name="w.m.${k}.players"]:checked`, f).map((x) => x.value);
    out.work = w; return out;
  }
  A.modelLive = () => { const m = readModel(); const box = UI.$('#model-val'); if (!box) return; box.querySelector('#model-missing').innerHTML = missingHtml(S.modelMissing(Object.assign({}, m, { work: workOf(m) }))); const vEl = box.lastElementChild; vEl.outerHTML = UI.validationPanel(TC.validateModel(m, UI.ctx().team.players)); };
  A.saveModel = () => { S.saveModel(UI.ctx().team.id, readModel()); UI.toast('Borrador del modelo guardado.'); UI.render(); };
  A.presentModel = () => {
    const c = UI.ctx(); const m = readModel(); S.saveModel(c.team.id, m);
    const v = S.submitModel(c.team.id, m);
    UI.toast(`Modelo presentado: validación ${v.score}/100. Ya puedes planificar la semana.`); UI.render();
  };

  /* ───── Vista del profesor: DAFO y cuaderno del alumno ───── */
  UI.workSummary = function (t) {
    const w = workOf(t.model); const nb = S.getNotebook(t.id); const pn = (id) => { const p = t.players.find((x) => x.id === id); return p ? p.name : '?'; };
    const moments = Object.values(TC.MODEL_MOMENTS).map((g) => `<h4>${esc(g.label)}</h4>${g.moments.map(([k, l]) => { const mo = w.moments[k]; return `<p class="small"><b>${esc(l)}</b> · <i>${esc(mo.fund || '—')}</i><br>${esc(mo.expl || '—')}<br><span class="muted">Jugadores: ${esc((mo.players || []).map(pn).join(', ') || '—')}</span></p>`; }).join('')}`).join('');
    return `<section class="card"><h3>Cuaderno del modelo de juego</h3>
      <h4>Características por líneas</h4><p class="small"><b>Defensa:</b> ${esc(w.lines.def || '—')}<br><b>Medios:</b> ${esc(w.lines.mid || '—')}<br><b>Delanteros:</b> ${esc(w.lines.att || '—')}</p>
      <h4>Idea de juego</h4><ol class="small">${w.ideas.filter((x) => x.trim()).map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ol>
      <h4>Sistema: ${esc(t.model.defStructure)}</h4><p class="small">${esc(w.systemText || '—')}</p>${moments}</section>
    <section class="card"><h3>DAFO de los jugadores</h3><div class="tablewrap"><table class="table"><thead><tr><th>Jugador</th><th>Fortalezas</th><th>Debilidades</th><th>Amenazas</th><th>Oportunidades</th></tr></thead><tbody>
      ${sortPlayers(t.players).map((p) => { const d = (nb.dafo || {})[p.id] || {}; return `<tr><td><b>${esc(p.name)}</b><br><small class="muted">${p.pos}</small></td>${['f', 'd', 'a', 'o'].map((k) => `<td class="small">${esc(d[k] || '—')}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div></section>`;
  };
  const baseProfe = V['profe-alumno'];
  V['profe-alumno'] = function (c, p) { const t = S.getTeam(p && p.team); const html = baseProfe(c, p); return t ? html.replace('<section class="card"><h3>Perfil de la plantilla</h3>', UI.workSummary(t) + '<section class="card"><h3>Perfil de la plantilla</h3>') : html; };
})(window);
