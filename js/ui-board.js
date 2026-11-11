/* THE COACH — Pizarra de ejercicios: campo, jugadores, material, flechas, zonas y texto.
   Se abre en una ventana a pantalla completa desde cualquier apartado (tareas, plan, informe del rival,
   trabajo individual) y guarda un objeto { v:2, field, objs:[...] } dentro del propio apartado. */
(function (G) {
  const UI = G.UI, S = G.TCStore, TC = G.TC, V = UI.views, A = UI.actions;
  const esc = UI.esc;

  const FIELDS = {
    full: { w: 1050, h: 680, label: 'Campo completo' },
    half: { w: 545, h: 680, label: 'Medio campo' },
    area: { w: 700, h: 480, label: 'Espacio reducido' },
  };
  const COLORS = [['#ffffff', 'Blanco'], ['#facc15', 'Amarillo'], ['#ef4444', 'Rojo'], ['#3b82f6', 'Azul'], ['#f97316', 'Naranja'], ['#111827', 'Negro']];
  const ITEMS = {
    pA: { g: 'Jugadores', label: 'Equipo A' }, pB: { g: 'Jugadores', label: 'Equipo B' },
    gA: { g: 'Jugadores', label: 'Portero A' }, gB: { g: 'Jugadores', label: 'Portero B' },
    jk: { g: 'Jugadores', label: 'Comodín' }, co: { g: 'Jugadores', label: 'Entrenador' },
    ball: { g: 'Material', label: 'Balón' }, cone: { g: 'Material', label: 'Cono' }, disc: { g: 'Material', label: 'Chino' },
    pole: { g: 'Material', label: 'Pica' }, hurdle: { g: 'Material', label: 'Valla' }, ladder: { g: 'Material', label: 'Escalera' },
    ring: { g: 'Material', label: 'Aro' }, dummy: { g: 'Material', label: 'Maniquí' }, mini: { g: 'Material', label: 'Miniportería' },
    goal: { g: 'Material', label: 'Portería' },
  };
  const LINES = { pass: 'Pase', drive: 'Conducción', run: 'Desplazamiento', shot: 'Tiro', line: 'Línea' };
  const ZONES = { rect: 'Zona rectangular', ellipse: 'Zona circular' };
  const PLAYER = new Set(['pA', 'pB', 'gA', 'gB', 'jk', 'co']);

  /* ───── Dibujo ───── */
  function grass(w, h) { let s = `<rect x="0" y="0" width="${w}" height="${h}" fill="#1d6b3f"/>`; for (let x = 0; x < w; x += 105) s += `<rect x="${x}" y="0" width="52.5" height="${h}" fill="#1f7445"/>`; return s; }
  function fieldSvg(f) {
    const L = 'fill="none" stroke="rgba(255,255,255,.85)" stroke-width="3"';
    if (f === 'half') return grass(545, 680) + `<g ${L}><rect x="10" y="10" width="525" height="660"/><path d="M10 248.5 A91.5 91.5 0 0 1 10 431.5"/><rect x="370" y="138" width="165" height="404"/><rect x="480" y="248" width="55" height="184"/><path d="M370 267 A91.5 91.5 0 0 0 370 413"/><rect x="535" y="303" width="8" height="74"/></g><circle cx="425" cy="340" r="3" fill="#fff"/>`;
    if (f === 'area') return grass(700, 480) + `<rect x="10" y="10" width="680" height="460" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2" stroke-dasharray="10 8"/>`;
    return grass(1050, 680) + `<g ${L}><rect x="10" y="10" width="1030" height="660"/><line x1="525" y1="10" x2="525" y2="670"/><circle cx="525" cy="340" r="91.5"/><rect x="10" y="138" width="165" height="404"/><rect x="875" y="138" width="165" height="404"/><rect x="10" y="248" width="55" height="184"/><rect x="985" y="248" width="55" height="184"/><path d="M175 267 A91.5 91.5 0 0 1 175 413"/><path d="M875 267 A91.5 91.5 0 0 0 875 413"/><rect x="2" y="303" width="8" height="74"/><rect x="1040" y="303" width="8" height="74"/></g><circle cx="525" cy="340" r="3" fill="#fff"/>`;
  }
  function tokenSvg(k, n, color) {
    const circ = (fill, txt, tc) => `<circle r="17" fill="${fill}" stroke="#fff" stroke-width="2.5"/><text y="6" text-anchor="middle" font-family="Barlow, Arial, sans-serif" font-weight="700" font-size="17" fill="${tc || '#fff'}">${esc(txt)}</text>`;
    switch (k) {
      case 'pA': return circ(color || '#c0392b', n);
      case 'pB': return circ('#2563eb', n);
      case 'gA': return circ('#f5b84b', n, '#1f2937');
      case 'gB': return circ('#7c3aed', n);
      case 'jk': return circ('#facc15', 'C', '#1f2937');
      case 'co': return `<rect x="-16" y="-16" width="32" height="32" rx="6" fill="#0b1220" stroke="#fff" stroke-width="2.5"/><text y="6" text-anchor="middle" font-family="Barlow, Arial, sans-serif" font-weight="700" font-size="17" fill="#fff">E</text>`;
      case 'ball': return `<circle r="8" fill="#fff" stroke="#111" stroke-width="1.5"/><path d="M0 -3.5 L3.3 -1 L2 3 L-2 3 L-3.3 -1 Z" fill="#111"/>`;
      case 'cone': return `<path d="M0 -13 L9 9 L-9 9 Z" fill="#f97316" stroke="#7c2d12" stroke-width="1.5"/><rect x="-11" y="8" width="22" height="3" rx="1.5" fill="#7c2d12"/>`;
      case 'disc': return `<ellipse rx="10" ry="5.5" fill="${color || '#facc15'}" stroke="rgba(0,0,0,.45)" stroke-width="1.5"/><ellipse rx="3" ry="1.6" fill="rgba(0,0,0,.35)"/>`;
      case 'pole': return `<ellipse cy="16" rx="7" ry="3" fill="rgba(0,0,0,.35)"/><rect x="-3" y="-20" width="6" height="36" fill="#fff" stroke="#991b1b" stroke-width="1"/><rect x="-3" y="-14" width="6" height="6" fill="#ef4444"/><rect x="-3" y="-2" width="6" height="6" fill="#ef4444"/><rect x="-3" y="10" width="6" height="6" fill="#ef4444"/>`;
      case 'hurdle': return `<path d="M-15 8 L-15 -8 L15 -8 L15 8" fill="none" stroke="#facc15" stroke-width="4" stroke-linejoin="round"/><path d="M-19 8 L-11 8 M11 8 L19 8" stroke="#111" stroke-width="3"/>`;
      case 'ladder': { let r = ''; for (let x = -60; x <= 60; x += 20) r += `<line x1="${x}" y1="-13" x2="${x}" y2="13" stroke="#facc15" stroke-width="3"/>`; return `<rect x="-70" y="-13" width="140" height="26" fill="none" stroke="#111" stroke-width="3"/>${r}`; }
      case 'ring': return `<circle r="14" fill="none" stroke="${color && color !== '#ffffff' ? color : '#ef4444'}" stroke-width="4"/>`;
      case 'dummy': return `<rect x="-9" y="-12" width="18" height="30" rx="7" fill="#1e3a8a" stroke="#fff" stroke-width="1.5"/><circle cy="-18" r="7" fill="#1e3a8a" stroke="#fff" stroke-width="1.5"/>`;
      case 'mini': { let h = ''; for (let x = -18; x <= 18; x += 6) h += `<line x1="${x}" y1="-8" x2="${x}" y2="6" stroke="rgba(255,255,255,.5)" stroke-width="1"/>`; return `<rect x="-24" y="-9" width="48" height="16" fill="rgba(255,255,255,.12)"/>${h}<path d="M-24 8 L-24 -9 L24 -9 L24 8" fill="none" stroke="#fff" stroke-width="4"/>`; }
      case 'goal': { let h = ''; for (let y = -34; y <= 34; y += 8) h += `<line x1="-12" y1="${y}" x2="4" y2="${y}" stroke="rgba(255,255,255,.5)" stroke-width="1"/>`; return `<rect x="-14" y="-40" width="18" height="80" fill="rgba(255,255,255,.12)"/>${h}<path d="M4 -40 L-14 -40 L-14 40 L4 40" fill="none" stroke="#fff" stroke-width="2"/><line x1="4" y1="-40" x2="4" y2="40" stroke="#fff" stroke-width="5"/>`; }
      default: return '';
    }
  }
  function arrowHead(x1, y1, x2, y2, c, size) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = size || 16;
    const p = (ang) => `${(x2 - s * Math.cos(a + ang)).toFixed(1)},${(y2 - s * Math.sin(a + ang)).toFixed(1)}`;
    return `<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${p(0.45)} ${p(-0.45)}" fill="${c}"/>`;
  }
  function wavyPath(x1, y1, x2, y2) {
    const len = Math.hypot(x2 - x1, y2 - y1); if (len < 1) return `M${x1} ${y1}`;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = -uy, ny = ux; const end = Math.max(0, len - 22);
    let d = `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
    for (let t = 4; t <= end; t += 4) { const o = Math.sin(t / 7) * 6; d += ` L${(x1 + ux * t + nx * o).toFixed(1)} ${(y1 + uy * t + ny * o).toFixed(1)}`; }
    return d + ` L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  function objSvg(o, i, color, sel) {
    const hl = sel ? ' data-sel="1"' : '';
    if (o.t === 'zone') {
      const x = Math.min(o.x1, o.x2), y = Math.min(o.y1, o.y2), w = Math.abs(o.x2 - o.x1), h = Math.abs(o.y2 - o.y1);
      const st = `fill="${o.c}" fill-opacity=".22" stroke="${o.c}" stroke-width="3" stroke-dasharray="10 6"`;
      const shape = o.k === 'ellipse' ? `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${st}/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${st}/>`;
      return `<g data-o="${i}"${hl}>${shape}${sel ? `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 4"/>` : ''}</g>`;
    }
    if (o.t === 'line') {
      const { x1, y1, x2, y2 } = o; const c = o.c || '#fff';
      const hit = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="22" stroke-linecap="round"/>`;
      const a = Math.atan2(y2 - y1, x2 - x1); const ex = x2 - Math.cos(a) * 12, ey = y2 - Math.sin(a) * 12;
      let body;
      if (o.k === 'drive') body = `<path d="${wavyPath(x1, y1, ex, ey)}" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>` + arrowHead(x1, y1, x2, y2, c);
      else if (o.k === 'run') body = `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="3" stroke-dasharray="12 8"/>` + arrowHead(x1, y1, x2, y2, c);
      else if (o.k === 'shot') body = `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="7"/>` + arrowHead(x1, y1, x2, y2, c, 22);
      else if (o.k === 'line') body = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="3"/>`;
      else body = `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="3"/>` + arrowHead(x1, y1, x2, y2, c);
      return `<g data-o="${i}"${hl}>${sel ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#38bdf8" stroke-width="12" stroke-opacity=".45" stroke-linecap="round"/>` : ''}${body}${hit}</g>`;
    }
    if (o.t === 'text') {
      return `<g data-o="${i}"${hl} transform="translate(${o.x},${o.y})"><text text-anchor="middle" y="7" font-family="Barlow, Arial, sans-serif" font-weight="700" font-size="22" fill="${o.c || '#fff'}" stroke="rgba(0,0,0,.55)" stroke-width="4" paint-order="stroke">${esc(o.s)}</text>${sel ? `<rect x="${-8 - o.s.length * 6.5}" y="-16" width="${16 + o.s.length * 13}" height="32" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 4"/>` : ''}</g>`;
    }
    return `<g data-o="${i}"${hl} transform="translate(${o.x},${o.y}) rotate(${o.r || 0})">${sel ? `<circle r="${o.k === 'ladder' ? 76 : o.k === 'goal' ? 44 : 24}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="5 4"/>` : ''}${tokenSvg(o.k, o.n, o.k === 'disc' || o.k === 'ring' ? o.c : color)}<circle r="22" fill="transparent"/></g>`;
  }
  const LAYER = { zone: 0, line: 1, item: 2, text: 3 };
  function boardInner(d, color, selIdx) {
    const f = FIELDS[d.field] ? d.field : 'full';
    const order = d.objs.map((o, i) => i).sort((a, b) => LAYER[d.objs[a].t] - LAYER[d.objs[b].t] || a - b);
    return fieldSvg(f) + order.map((i) => objSvg(d.objs[i], i, color, i === selIdx)).join('');
  }
  function svgFor(d, color, cls, attrs) {
    const f = FIELDS[d.field] || FIELDS.full;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f.w} ${f.h}" class="${cls || ''}" ${attrs || ''}>${boardInner(d, color, -1)}</svg>`;
  }

  /* ───── Datos ───── */
  function norm(d, defField) {
    if (d && d.v === 2) return { v: 2, field: FIELDS[d.field] ? d.field : 'full', objs: Array.isArray(d.objs) ? d.objs : [] };
    if (d && d.tokens) { // pizarra antigua
      const objs = d.tokens.map((t) => ({ t: 'item', k: t.side === 'o' ? 'pA' : 'pB', x: t.x, y: t.y, n: String(t.n), r: 0 }));
      for (const s of d.shapes || []) {
        if (s.t === 'run' || s.t === 'pass') objs.push({ t: 'line', k: s.t, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, c: s.t === 'run' ? '#facc15' : '#ffffff' });
        else objs.push({ t: 'zone', k: s.t === 'sup' ? 'ellipse' : 'rect', x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, c: s.t === 'press' ? '#ef4444' : s.t === 'free' ? '#22c55e' : '#facc15' });
      }
      return { v: 2, field: 'full', objs };
    }
    return { v: 2, field: defField || 'full', objs: [] };
  }
  const has = (d) => !!(d && ((d.objs && d.objs.length) || (d.tokens && d.tokens.length)));
  const teamColor = () => '#dc2626'; // equipo A siempre en rojo: se distingue bien sobre el césped

  /* ───── Editor ───── */
  let ed = null; // { d, sel, tool, color, undo, opts, drag }
  function iconFor(k) { return `<svg viewBox="-24 -24 48 48" width="30" height="30" aria-hidden="true">${['mini', 'goal'].includes(k) ? '<rect x="-24" y="-24" width="48" height="48" rx="8" fill="#1f7445"/>' : ''}<g transform="scale(${k === 'ladder' ? 0.3 : k === 'goal' ? 0.5 : 1}) rotate(${k === 'goal' ? 90 : 0})">${tokenSvg(k, PLAYER.has(k) && !['jk', 'co'].includes(k) ? (k[0] === 'g' ? '1' : '') : '', k === 'disc' ? ed.color === '#ffffff' ? '#facc15' : ed.color : teamColor())}</g></svg>`; }
  function lineIcon(k) { const c = '#0b1220'; const o = { t: 'line', k, x1: -18, y1: 12, x2: 18, y2: -12, c }; return `<svg viewBox="-24 -24 48 48" width="30" height="30" aria-hidden="true">${objSvg(o, 0, c, false).replace(/stroke-width="22"/, 'stroke-width="0"')}</svg>`; }
  function zoneIcon(k) { const o = { t: 'zone', k, x1: -18, y1: -13, x2: 18, y2: 13, c: '#0d7a45' }; return `<svg viewBox="-24 -24 48 48" width="30" height="30" aria-hidden="true">${objSvg(o, 0, '', false)}</svg>`; }
  function toolBtn(k, label, icon) { return `<button type="button" class="dtool ${ed.tool === k ? 'on' : ''}" data-act="drillTool" data-k="${k}" title="${esc(label)}">${icon}<span>${esc(label)}</span></button>`; }
  function paletteHtml() {
    const groups = {};
    for (const [k, v] of Object.entries(ITEMS)) (groups[v.g] = groups[v.g] || []).push(toolBtn(k, v.label, iconFor(k)));
    return `<div class="dgroup"><div class="dg-t">Herramienta</div><div class="dg-b">${toolBtn('select', 'Mover / elegir', '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 3 L19 12 L12 13.5 L9 20 Z" fill="#0b1220"/></svg>')}${toolBtn('text', 'Texto', '<svg viewBox="0 0 24 24" width="30" height="30"><text x="12" y="18" text-anchor="middle" font-size="18" font-weight="700" fill="#0b1220">T</text></svg>')}</div></div>
      ${Object.entries(groups).map(([g, b]) => `<div class="dgroup"><div class="dg-t">${g}</div><div class="dg-b">${b.join('')}</div></div>`).join('')}
      <div class="dgroup"><div class="dg-t">Flechas y líneas</div><div class="dg-b">${Object.entries(LINES).map(([k, l]) => toolBtn('L:' + k, l, lineIcon(k))).join('')}</div></div>
      <div class="dgroup"><div class="dg-t">Zonas</div><div class="dg-b">${Object.entries(ZONES).map(([k, l]) => toolBtn('Z:' + k, l, zoneIcon(k))).join('')}</div></div>
      <div class="dgroup"><div class="dg-t">Color (flechas, zonas, chinos, texto)</div><div class="dg-b colors">${COLORS.map(([c, l]) => `<button type="button" class="dcolor ${ed.color === c ? 'on' : ''}" style="background:${c}" data-act="drillColor" data-c="${c}" title="${l}" aria-label="${l}"></button>`).join('')}</div></div>`;
  }
  function selBar() {
    const o = ed.d.objs[ed.sel]; if (!o) return `<span class="muted small">${ed.tool === 'select' ? 'Pulsa un elemento para moverlo o editarlo.' : ed.tool.startsWith('L:') || ed.tool.startsWith('Z:') ? 'Arrastra sobre el campo para dibujar.' : 'Pulsa en el campo para colocar. Vuelve a «Mover» para recolocar.'}</span>`;
    const rot = o.t === 'item' && !PLAYER.has(o.k) && o.k !== 'ball';
    return `<b class="small">${esc(o.t === 'item' ? ITEMS[o.k].label : o.t === 'line' ? LINES[o.k] : o.t === 'zone' ? ZONES[o.k] : 'Texto')}</b>
      ${o.t === 'item' && PLAYER.has(o.k) && !['jk', 'co'].includes(o.k) ? '<button type="button" class="btn sm ghost" data-act="drillNum">Cambiar número</button>' : ''}
      ${o.t === 'text' ? '<button type="button" class="btn sm ghost" data-act="drillEditText">Editar texto</button>' : ''}
      ${rot ? '<button type="button" class="btn sm ghost" data-act="drillRot">Girar 45°</button>' : ''}
      ${o.t === 'line' ? '<button type="button" class="btn sm ghost" data-act="drillFlip">Invertir sentido</button>' : ''}
      <button type="button" class="btn sm ghost" data-act="drillDup">Duplicar</button><button type="button" class="btn sm ghost danger" data-act="drillDel">Borrar</button>`;
  }
  function drawEd() {
    const svg = document.getElementById('drill-svg'); if (!svg) return;
    const f = FIELDS[ed.d.field]; svg.setAttribute('viewBox', `0 0 ${f.w} ${f.h}`);
    svg.innerHTML = boardInner(ed.d, teamColor(), ed.sel);
    const sb = document.getElementById('drill-sel'); if (sb) sb.innerHTML = selBar();
  }
  function drawPalette() { const p = document.getElementById('drill-pal'); if (p) p.innerHTML = paletteHtml(); }
  function pushUndo() { ed.undo.push(JSON.stringify(ed.d)); if (ed.undo.length > 60) ed.undo.shift(); ed.dirty = true; }
  function nextNum(k) { const used = ed.d.objs.filter((o) => o.k === k).map((o) => +o.n || 0); if (k[0] === 'g') return '1'; for (let n = 1; ; n++) if (!used.includes(n)) return String(n); }
  function svgPt(svg, e) { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const r = p.matrixTransform(svg.getScreenCTM().inverse()); const f = FIELDS[ed.d.field]; return { x: TC.clamp(r.x, 0, f.w), y: TC.clamp(r.y, 0, f.h) }; }

  UI.drill = {
    has, norm, svgFor, FIELDS,
    resolvers: {},
    // miniatura para listas
    mini(d) { return has(d) ? `<span class="drill-mini">${svgFor(norm(d), teamColor())}</span>` : ''; },
    // bloque con miniatura + botón para abrir
    slot(key, d, editable, label) {
      const id = 'ds-' + key.replace(/[^a-z0-9]/gi, '_'); const h = has(d);
      if (!h && !editable) return `<div class="drill-slot" id="${id}"></div>`;
      return `<div class="drill-slot" id="${id}">${h ? `<button type="button" class="drill-thumb" data-act="drillOpen" data-key="${esc(key)}" aria-label="Abrir pizarra">${svgFor(norm(d), teamColor())}</button>` : ''}
        <button type="button" class="btn sm ${h ? 'ghost' : ''}" data-act="drillOpen" data-key="${esc(key)}">${h ? (editable ? '✏️ Editar pizarra' : '🔍 Ver pizarra') : '🧩 ' + esc(label || 'Dibujar en la pizarra')}</button></div>`;
    },
    open(opts) {
      ed = { d: norm(S.clone(opts.data || null), opts.field), sel: -1, tool: opts.editable ? 'pA' : 'select', color: '#ffffff', undo: [], opts, drag: null, dirty: false };
      if (!opts.data && opts.field) ed.d.field = opts.field;
      const ro = !opts.editable;
      const wrap = document.createElement('div'); wrap.id = 'drill'; wrap.className = 'drill-modal' + (ro ? ' ro' : ''); wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Pizarra');
      wrap.innerHTML = `<div class="drill-box">
        <header class="drill-head"><div class="drill-title"><b>🧩 ${esc(opts.title || 'Pizarra')}</b>${opts.named ? `<input id="drill-name" class="mini" value="${esc(opts.name || '')}" placeholder="Nombre del ejercicio" ${ro ? 'disabled' : ''}>` : ''}</div>
          <div class="row wrap">${ro ? '' : `<select id="drill-field" class="mini" data-change="drillField" aria-label="Campo">${Object.entries(FIELDS).map(([k, f]) => `<option value="${k}" ${ed.d.field === k ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
            <button type="button" class="btn sm ghost" data-act="drillOnce" data-k="pA">+ Once A</button><button type="button" class="btn sm ghost" data-act="drillOnce" data-k="pB">+ Once B</button>
            <button type="button" class="btn sm ghost" data-act="drillUndo">↶ Deshacer</button><button type="button" class="btn sm ghost" data-act="drillClear">Vaciar</button>`}
            <button type="button" class="btn sm ghost" data-act="drillPng">Descargar imagen</button>
            <button type="button" class="btn sm" data-act="drillClose">${ro ? 'Cerrar' : 'Cancelar'}</button>${ro ? '' : '<button type="button" class="btn sm primary" data-act="drillSave">Guardar pizarra</button>'}</div></header>
        <div class="drill-body">${ro ? '' : `<aside class="drill-pal" id="drill-pal"></aside>`}
          <div class="drill-main"><div class="drill-stage"><svg id="drill-svg" xmlns="http://www.w3.org/2000/svg" role="application" aria-label="Campo de la pizarra"></svg></div>${ro ? '' : '<div class="drill-sel" id="drill-sel"></div>'}</div></div></div>`;
      document.body.appendChild(wrap); document.body.classList.add('drill-open');
      if (!ro) drawPalette(); drawEd(); bind();
    },
  };

  function bind() {
    const svg = document.getElementById('drill-svg'); if (!ed.opts.editable) return;
    svg.addEventListener('pointerdown', (e) => {
      const p = svgPt(svg, e); const g = e.target.closest('[data-o]'); const t = ed.tool;
      if (t === 'select') {
        if (!g) { ed.sel = -1; drawEd(); return; }
        ed.sel = +g.dataset.o; pushUndo(); ed.drag = { p, o: S.clone(ed.d.objs[ed.sel]), moved: false }; svg.setPointerCapture(e.pointerId); drawEd(); return;
      }
      if (t === 'text') { const s = (G.prompt('Texto para la pizarra:') || '').trim().slice(0, 40); if (!s) return; pushUndo(); ed.d.objs.push({ t: 'text', x: p.x, y: p.y, s, c: ed.color }); ed.sel = ed.d.objs.length - 1; drawEd(); return; }
      if (t.startsWith('L:') || t.startsWith('Z:')) {
        pushUndo(); const o = { t: t[0] === 'L' ? 'line' : 'zone', k: t.slice(2), x1: p.x, y1: p.y, x2: p.x, y2: p.y, c: t[0] === 'L' && t.slice(2) === 'shot' && ed.color === '#ffffff' ? '#ef4444' : ed.color };
        ed.d.objs.push(o); ed.sel = ed.d.objs.length - 1; ed.drag = { draw: o }; svg.setPointerCapture(e.pointerId); drawEd(); return;
      }
      if (ITEMS[t]) { pushUndo(); ed.d.objs.push({ t: 'item', k: t, x: Math.round(p.x), y: Math.round(p.y), r: t === 'goal' && ed.d.field !== 'full' ? 0 : 0, n: PLAYER.has(t) ? nextNum(t) : '', c: t === 'disc' || t === 'ring' ? ed.color : undefined }); ed.sel = ed.d.objs.length - 1; drawEd(); }
    });
    svg.addEventListener('pointermove', (e) => {
      if (!ed || !ed.drag) return; const p = svgPt(svg, e);
      if (ed.drag.draw) { ed.drag.draw.x2 = p.x; ed.drag.draw.y2 = p.y; drawEd(); return; }
      const dx = p.x - ed.drag.p.x, dy = p.y - ed.drag.p.y; const o = ed.d.objs[ed.sel], b = ed.drag.o; if (!o) return;
      if (Math.abs(dx) + Math.abs(dy) > 2) ed.drag.moved = true;
      if ('x' in b) { o.x = Math.round(b.x + dx); o.y = Math.round(b.y + dy); } else { o.x1 = b.x1 + dx; o.y1 = b.y1 + dy; o.x2 = b.x2 + dx; o.y2 = b.y2 + dy; }
      drawEd();
    });
    const up = () => {
      if (!ed || !ed.drag) return;
      if (ed.drag.draw) { const o = ed.drag.draw; if (Math.hypot(o.x2 - o.x1, o.y2 - o.y1) < 14) { ed.d.objs.pop(); ed.undo.pop(); ed.sel = -1; } }
      else if (!ed.drag.moved) ed.undo.pop();
      ed.drag = null; drawEd();
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  }
  function onKey(e) {
    if (!ed || !document.getElementById('drill')) return;
    if (e.key === 'Escape') { A.drillClose(); return; }
    if (!ed.opts.editable || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && ed.sel >= 0) { e.preventDefault(); A.drillDel(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); A.drillUndo(); }
  }
  document.addEventListener('keydown', onKey);
  function close() { const m = document.getElementById('drill'); if (m) m.remove(); document.body.classList.remove('drill-open'); ed = null; }

  A.drillTool = (el) => { ed.tool = el.dataset.k; if (ed.tool !== 'select') ed.sel = -1; drawPalette(); drawEd(); };
  A.drillColor = (el) => { ed.color = el.dataset.c; const o = ed.d.objs[ed.sel]; if (o && (o.t !== 'item' || o.k === 'disc' || o.k === 'ring')) { pushUndo(); o.c = ed.color; } drawPalette(); drawEd(); };
  A.drillField = (el) => { pushUndo(); const from = FIELDS[ed.d.field], to = FIELDS[el.value]; const sx = to.w / from.w, sy = to.h / from.h;
    for (const o of ed.d.objs) { if ('x' in o) { o.x = Math.round(o.x * sx); o.y = Math.round(o.y * sy); } else { o.x1 *= sx; o.x2 *= sx; o.y1 *= sy; o.y2 *= sy; } }
    ed.d.field = el.value; drawEd(); };
  A.drillUndo = () => { const s = ed.undo.pop(); if (s) { ed.d = JSON.parse(s); ed.sel = -1; drawEd(); const f = document.getElementById('drill-field'); if (f) f.value = ed.d.field; } };
  A.drillClear = () => { if (!ed.d.objs.length) return; pushUndo(); ed.d.objs = []; ed.sel = -1; drawEd(); };
  A.drillDel = () => { if (ed.sel < 0) return; pushUndo(); ed.d.objs.splice(ed.sel, 1); ed.sel = -1; drawEd(); };
  A.drillDup = () => { const o = ed.d.objs[ed.sel]; if (!o) return; pushUndo(); const c = S.clone(o); if ('x' in c) { c.x += 30; c.y += 30; } else { c.x1 += 30; c.x2 += 30; c.y1 += 30; c.y2 += 30; } if (c.t === 'item' && PLAYER.has(c.k)) c.n = nextNum(c.k); ed.d.objs.push(c); ed.sel = ed.d.objs.length - 1; drawEd(); };
  A.drillRot = () => { const o = ed.d.objs[ed.sel]; if (!o) return; pushUndo(); o.r = ((o.r || 0) + 45) % 360; drawEd(); };
  A.drillFlip = () => { const o = ed.d.objs[ed.sel]; if (!o) return; pushUndo(); [o.x1, o.y1, o.x2, o.y2] = [o.x2, o.y2, o.x1, o.y1]; drawEd(); };
  A.drillNum = () => { const o = ed.d.objs[ed.sel]; if (!o) return; const n = (G.prompt('Número o letra del jugador:', o.n) || '').trim().slice(0, 3); if (!n) return; pushUndo(); o.n = n; drawEd(); };
  A.drillEditText = () => { const o = ed.d.objs[ed.sel]; if (!o) return; const s = (G.prompt('Texto:', o.s) || '').trim().slice(0, 40); if (!s) return; pushUndo(); o.s = s; drawEd(); };
  A.drillOnce = (el) => {
    const k = el.dataset.k; const c = UI.ctx(); const f = FIELDS[ed.d.field];
    const form = k === 'pA' ? ((c.team && c.team.model && TC.FORMATIONS[c.team.model.attStructure]) ? c.team.model.attStructure : '1-4-3-3') : '1-4-4-2';
    const slots = TC.FORMATIONS[form] || TC.FORMATIONS['1-4-4-2']; pushUndo();
    ed.d.objs = ed.d.objs.filter((o) => !(o.t === 'item' && (o.k === k || o.k === (k === 'pA' ? 'gA' : 'gB'))));
    slots.forEach((s, i) => { let x = s[1] / 100 * f.w, y = s[2] / 100 * f.h; if (k === 'pB') x = f.w - x; ed.d.objs.push({ t: 'item', k: i === 0 ? (k === 'pA' ? 'gA' : 'gB') : k, x: Math.round(x), y: Math.round(y), r: 0, n: String(i + 1) }); });
    drawEd();
  };
  A.drillPng = () => {
    const svg = document.getElementById('drill-svg'); const f = FIELDS[ed.d.field];
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgFor(ed.d, teamColor()).replace('<svg ', `<svg width="${f.w * 2}" height="${f.h * 2}" `));
    const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'); cv.width = f.w * 2; cv.height = f.h * 2; cv.getContext('2d').drawImage(img, 0, 0); cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = ((document.getElementById('drill-name') || {}).value || ed.opts.title || 'pizarra').replace(/[^\wáéíóúñ -]/gi, '').trim().replace(/\s+/g, '-') + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }); };
    img.src = src; void svg;
  };
  A.drillClose = () => { if (ed && ed.opts.editable && ed.dirty) { if (!G.confirm('¿Cerrar sin guardar los cambios de la pizarra?')) return; } close(); };
  A.drillSave = () => {
    const name = ((document.getElementById('drill-name') || {}).value || '').trim();
    if (ed.opts.named && !name) { UI.toast('Ponle un nombre al ejercicio.', 'bad'); document.getElementById('drill-name').focus(); return; }
    const data = { v: 2, field: ed.d.field, objs: ed.d.objs.map((o) => { const c = Object.assign({}, o); for (const k of ['x', 'y', 'x1', 'y1', 'x2', 'y2']) if (k in c) c[k] = Math.round(c[k]); if (c.c === undefined) delete c.c; return c; }) };
    const fn = ed.opts.onSave; close(); UI.run ? UI.run(() => fn(data, name)) : fn(data, name);
  };
  A.drillOpen = (el) => {
    const key = el.dataset.key; const i = key.indexOf(':'); const pre = i < 0 ? key : key.slice(0, i), rest = i < 0 ? '' : key.slice(i + 1);
    const r = UI.drill.resolvers[pre] && UI.drill.resolvers[pre](rest); if (!r) return;
    UI.drill.open(r);
  };

  /* ───── Dónde se guarda cada pizarra ───── */
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function setPath(obj, path, val) { const ks = path.split('.'); let o = obj; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = val; }
  const FIELD_FOR = (path) => (/^(plan|scouting)/.test(path) ? 'full' : 'area');
  function titleFor(path) {
    if (path.startsWith('plan.boards.')) return 'Plan de partido';
    if (path.startsWith('scouting.')) { const k = path.split('.')[2]; const m = TC.SCOUT_MOMENTS.find((x) => x[0] === k); return 'Informe del rival · ' + (m ? m[1] : ''); }
    if (path.startsWith('individual.tasks.')) return 'Trabajo individual · Tarea ' + (+path.split('.')[2] + 1);
    if (path.startsWith('microcycle.')) return 'Tarea del microciclo';
    return 'Pizarra';
  }
  // Borrador de la semana: w:<ruta dentro del borrador>
  UI.drill.resolvers.w = (path) => {
    const c = UI.ctx(); const w = UI.week(c);
    return { data: getPath(w.draft, path), editable: w.editable, field: FIELD_FOR(path), title: titleFor(path),
      onSave: (data) => { const y = G.scrollY; const w2 = UI.week(UI.ctx()); setPath(w2.draft, path, data); S.saveDraft(w2.team.id, w2.round, w2.draft); UI.toast('Pizarra guardada.'); UI.render(); G.scrollTo(0, y); } };
  };
  // Entrega del alumno (solo lectura): sub:<id>:<ruta dentro de la entrega>
  UI.drill.resolvers.sub = (rest) => {
    const j = rest.indexOf(':'); const sub = S.load().submissions.find((s) => s.id === rest.slice(0, j)); if (!sub) return null;
    const path = rest.slice(j + 1); return { data: getPath(sub.snapshot, path), editable: false, title: titleFor(path) };
  };
  // Constructor de tareas: se guarda con la tarea
  UI.drill.resolvers.task = () => {
    const te = UI.state.taskEdit; if (!te) return null; const c = UI.ctx();
    const editable = te.mode === 'custom' || UI.week(c).editable;
    return { data: te.t.board, editable, field: 'area', title: 'Ejercicio' + (te.t.name ? ' · ' + te.t.name : ''),
      onSave: (data) => { te.t.board = data; const box = document.getElementById('ds-task'); if (box) box.outerHTML = UI.drill.slot('task', data, true, 'Dibujar el ejercicio'); UI.toast('Pizarra lista: se guardará al guardar la tarea.'); } };
  };
  // Pizarras libres del equipo
  UI.drill.resolvers.free = (id) => {
    const c = UI.ctx(); const b = (c.team.boards || []).find((x) => x.id === id);
    return { data: b ? norm(b) : null, editable: S.canEditTeam(c.user, c.team), field: 'full', title: 'Pizarra', named: true, name: b ? b.name : '',
      onSave: (data, name) => { const c2 = UI.ctx(); const nid = b ? b.id : S.uid('b'); const list = (c2.team.boards || []).filter((x) => x.id !== nid).concat([Object.assign({ id: nid, name, at: S.now() }, data)]); S.saveBoards(c2.team.id, list); UI.toast('Pizarra guardada.'); UI.render(); } };
  };

  /* ───── Página «Pizarra táctica» ───── */
  V.pizarra = function (c) {
    const list = (c.team.boards || []).slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    const can = S.canEditTeam(c.user, c.team);
    return `<div class="page-head"><h1>Pizarra táctica</h1><p class="muted">Diseña ejercicios y situaciones: coloca jugadores, porteros y comodines, añade material (balones, conos, chinos, picas, vallas, escaleras, aros, miniporterías…), y dibuja pases, conducciones, desplazamientos, tiros y zonas. La misma pizarra está en las tareas del microciclo, el plan de partido, el informe del rival y el trabajo individual.</p></div>
      ${can ? '<div class="row"><button class="btn primary" data-act="drillOpen" data-key="free:">+ Nueva pizarra</button></div>' : ''}
      <div class="grid g3 drill-grid">${list.map((b) => `<article class="card drill-card"><button type="button" class="drill-thumb" data-act="drillOpen" data-key="free:${b.id}" aria-label="Abrir ${esc(b.name)}">${svgFor(norm(b), teamColor())}</button>
        <div class="row between"><b>${esc(b.name)}</b>${can ? `<button class="icon" data-act="drillFreeDel" data-id="${b.id}" aria-label="Borrar">×</button>` : ''}</div></article>`).join('') || '<p class="muted">Todavía no tienes pizarras guardadas.</p>'}</div>`;
  };
  A.drillFreeDel = (el) => UI.ask('Borrar pizarra', 'Se borrará esta pizarra.', 'Borrar', () => { const c = UI.ctx(); S.saveBoards(c.team.id, (c.team.boards || []).filter((x) => x.id !== el.dataset.id)); UI.render(); }, true);
  if (UI.after) delete UI.after.pizarra;

  /* ───── Profesor: pizarras de la entrega ───── */
  const baseEntrega = V['profe-entrega'];
  V['profe-entrega'] = function (c, p) {
    const html = baseEntrega(c, p);
    const sub = S.load().submissions.find((s) => s.id === (p && p.sub)); if (!sub) return html;
    const sn = sub.snapshot; const found = [];
    ((sn.microcycle && sn.microcycle.sessions) || []).forEach((s, i) => (s.tasks || []).forEach((t, j) => { if (has(t.board)) found.push([`microcycle.sessions.${i}.tasks.${j}.board`, `${s.day} · ${t.name || 'Tarea'}`]); }));
    Object.keys((sn.plan && sn.plan.boards) || {}).forEach((k) => { if (has(sn.plan.boards[k])) found.push(['plan.boards.' + k, 'Plan de partido · ' + k]); });
    Object.entries((sn.scouting && sn.scouting.moments) || {}).forEach(([k, m]) => { if (m && has(m.board)) { const mm = TC.SCOUT_MOMENTS.find((x) => x[0] === k); found.push([`scouting.moments.${k}.board`, 'Informe del rival · ' + (mm ? mm[1] : k)]); } });
    ((sn.individual && sn.individual.tasks) || []).forEach((t, i) => { if (has(t.board)) found.push([`individual.tasks.${i}.board`, `Trabajo individual · ${t.name || 'Tarea ' + (i + 1)}`]); });
    if (!found.length) return html;
    const team = S.getTeam(sub.teamId);
    return html + `<section class="card"><h3>Pizarras de la entrega</h3><div class="grid g3 drill-grid">${found.map(([path, label]) => `<div><button type="button" class="drill-thumb" data-act="drillOpen" data-key="sub:${sub.id}:${path}">${svgFor(norm(getPath(sn, path)), teamColor())}</button><small>${esc(label)}</small></div>`).join('')}</div></section>`;
  };
})(window);
