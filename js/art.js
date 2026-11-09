/* THE COACH — Gráficos generados: logotipo, escudos de club y retratos de jugadores (SVG).
 * Todo es determinista: el mismo equipo o jugador produce siempre el mismo dibujo. */
(function (G) {
  'use strict';
  const TC = G.TC;
  const rng = (seed) => TC.makeRng('art:' + seed);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let uidN = 0; const uid = (p) => p + (++uidN).toString(36);

  /* ───── Color ───── */
  function hex2rgb(h) { h = String(h || '#12804a').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const rgb2hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function mix(a, b, t) { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  function lum(h) { const [r, g, b] = hex2rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  const onColor = (h) => (lum(h) > 0.6 ? '#13233a' : '#ffffff');

  /* ───── Logotipo de la app ───── */
  // Escudo azul marino con un esquema táctico: una X (jugador), una flecha de desmarque y el balón.
  function logo(size) {
    const s = size || 40; const id = uid('lg');
    return `<svg class="tc-logo" width="${s}" height="${Math.round(s * 1.12)}" viewBox="0 0 64 72" role="img" aria-label="THE COACH">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16406e"/><stop offset="1" stop-color="#0b2240"/></linearGradient>
      <marker id="${id}a" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#3ddc84"/></marker></defs>
      <path d="M32 2L60 10V34C60 52 47.5 63.5 32 70C16.5 63.5 4 52 4 34V10Z" fill="url(#${id})"/>
      <path d="M32 7.5L55 14V34C55 49 45 58.5 32 64C19 58.5 9 49 9 34V14Z" fill="none" stroke="#3ddc84" stroke-width="1.6" opacity=".85"/>
      <path d="M9 36H55" stroke="#ffffff" stroke-opacity=".18" stroke-width="1.2"/><circle cx="32" cy="36" r="7" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="1.2"/>
      <path d="M17 44l7 7M24 44l-7 7" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <path d="M23 41C23 27 32 22 41 22.5" fill="none" stroke="#3ddc84" stroke-width="2.6" stroke-dasharray="4 3.2" stroke-linecap="round" marker-end="url(#${id}a)"/>
      <circle cx="46" cy="22.5" r="4.6" fill="#ffffff"/><path d="M46 19.6l1.9 1.4-.7 2.2h-2.4l-.7-2.2z" fill="#0b2240"/>
    </svg>`;
  }
  function brand(big) {
    return `<span class="brand-mark">${logo(big ? 54 : 36)}<span class="brand-t"><b>THE COACH</b><small>Manager Academy</small></span></span>`;
  }

  /* ───── Escudos de club ───── */
  const SHAPES = {
    clasico: 'M50 4L92 14V52C92 82 72 101 50 112C28 101 8 82 8 52V14Z',
    redondeado: 'M14 8H86Q92 8 92 14V58C92 86 72 104 50 112C28 104 8 86 8 58V14Q8 8 14 8Z',
    apuntado: 'M50 3L94 18C94 60 80 92 50 112C20 92 6 60 6 18Z',
    ingles: 'M8 8H92V60C92 88 70 106 50 112C30 106 8 88 8 60Z',
    circular: 'M50 8A48 48 0 1 1 49.9 8Z',
  };
  const SYMBOLS = {
    estrella: '<path d="M50 30l6.5 13.2 14.5 2.1-10.5 10.2 2.5 14.5L50 63.2 37 70l2.5-14.5L29 45.3l14.5-2.1z"/>',
    torre: '<path d="M38 72V44h-4v-12h6v5h5v-5h10v5h5v-5h6v12h-4v28z"/><rect x="46" y="58" width="8" height="14" rx="4" class="cut"/>',
    ola: '<path d="M26 54c6-8 12-8 18 0s12 8 18 0 12-8 14-4v8c-2-4-8-4-14 4s-12 8-18 0-12-8-18 0z"/><path d="M26 42c6-8 12-8 18 0s12 8 18 0 12-8 14-4v6c-2-4-8-4-14 4s-12 8-18 0-12-8-18 0z"/>',
    pino: '<path d="M50 26l14 18h-7l11 14h-8l11 14H29l11-14h-8l11-14h-7z"/><rect x="46" y="72" width="8" height="8"/>',
    sol: '<circle cx="50" cy="52" r="11"/><path d="M50 30v8M50 66v8M28 52h8M64 52h8M34.5 36.5l5.6 5.6M59.9 61.9l5.6 5.6M34.5 67.5l5.6-5.6M59.9 42.1l5.6-5.6" stroke-width="4" stroke-linecap="round" class="st"/>',
    montana: '<path d="M22 72l18-28 8 11 9-15 21 32z"/><path d="M57 40l5 7.5-5-2-4 4z" class="cut"/>',
    balon: '<circle cx="50" cy="52" r="20"/><path d="M50 42l8 6-3 9.5h-10L42 48z" class="cut"/><path d="M50 32v10M58 48l10-3M55 57.5l6 8M45 57.5l-6 8M42 48l-10-3" class="st cutst" stroke-width="2.4"/>',
    corona: '<path d="M28 66l-4-26 13 11 13-17 13 17 13-11-4 26z"/><rect x="28" y="68" width="44" height="6" rx="2"/>',
    hoja: '<path d="M50 28C70 36 72 60 50 76 28 60 30 36 50 28z"/><path d="M50 34V74" class="st cutst" stroke-width="2.4"/>',
    puente: '<path d="M22 70V62C30 46 70 46 78 62v8h-8v-6c-6-9-34-9-40 0v6z"/><rect x="20" y="58" width="60" height="5"/>',
  };
  const SECONDS = ['#ffffff', '#0f2a4a', '#f2c14e', '#111827', '#ffffff', '#c8102e'];
  function crestSpec(team) {
    const r = rng('crest:' + team.id);
    const shape = r.pick(Object.keys(SHAPES));
    let second = r.pick(SECONDS); if (Math.abs(lum(second) - lum(team.color)) < 0.18) second = lum(team.color) > 0.5 ? '#0f2a4a' : '#ffffff';
    return { shape, second, pattern: r.pick(['liso', 'franjas', 'banda', 'cuartos', 'chevron', 'faja', 'mitades']), symbol: r.pick(Object.keys(SYMBOLS)), founded: 1898 + Math.floor(r() * 75), stars: r() < 0.3 ? r.int(1, 3) : 0 };
  }
  function crest(team, size) {
    if (!team) return '';
    const sp = crestSpec(team); const id = uid('cr'); const s = size || 34;
    const c1 = team.color, c2 = sp.second;
    const P = { liso: '', franjas: [16, 40, 64, 88].map((x) => `<rect x="${x - 6}" y="0" width="12" height="120" fill="${c2}"/>`).join(''),
      banda: `<path d="M-10 30L30 -10L110 70L70 110z" fill="${c2}"/>`, cuartos: `<rect x="0" y="0" width="50" height="58" fill="${c2}"/><rect x="50" y="58" width="50" height="62" fill="${c2}"/>`,
      chevron: `<path d="M0 70L50 40L100 70V90L50 60L0 90z" fill="${c2}"/>`, faja: `<rect x="0" y="44" width="100" height="22" fill="${c2}"/>`, mitades: `<rect x="50" y="0" width="50" height="120" fill="${c2}"/>` }[sp.pattern];
    const symColor = ['liso', 'faja'].includes(sp.pattern) ? c2 : '#ffffff';
    const plate = ['liso', 'faja', 'chevron'].includes(sp.pattern) ? '' : `<circle cx="50" cy="52" r="27" fill="${c1}" stroke="${c2}" stroke-width="3"/>`;
    const short = esc((team.short || '').slice(0, 3));
    return `<svg class="crest-svg" width="${s}" height="${Math.round(s * 1.16)}" viewBox="0 0 100 116" role="img" aria-label="Escudo de ${esc(team.name)}">
      <defs><clipPath id="${id}"><path d="${SHAPES[sp.shape]}"/></clipPath></defs>
      <g clip-path="url(#${id})"><rect width="100" height="120" fill="${c1}"/>${P}${plate}
        <g fill="${symColor}" stroke="${symColor}" stroke-width="0" class="sym" style="--cut:${c1}">${SYMBOLS[sp.symbol].replace(/class="cut"/g, `fill="${c1}"`).replace(/class="st cutst"/g, `fill="none" stroke="${c1}"`).replace(/class="st"/g, `fill="none" stroke="${symColor}"`)}</g>
        <rect x="0" y="82" width="100" height="16" fill="${c2}"/><text x="50" y="94.5" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="700" font-size="13" letter-spacing="1.5" fill="${onColor(c2)}">${short}</text>
      </g>
      <path d="${SHAPES[sp.shape]}" fill="none" stroke="${mix(c1, '#000000', 0.35)}" stroke-width="3"/>
      ${sp.stars ? Array.from({ length: sp.stars }, (_, i) => `<path transform="translate(${50 + (i - (sp.stars - 1) / 2) * 11 - 4},-1) scale(.16)" d="M50 0l14 30 32 4-24 22 6 32-28-16-28 16 6-32L4 34l32-4z" fill="#f2c14e"/>`).join('') : ''}
    </svg>`;
  }

  /* ───── Retratos de jugador ───── */
  const SKINS = ['#f6d7c3', '#eac0a1', '#d9a47e', '#c18a63', '#9b6a47', '#6e4a32'];
  const HAIRS = ['#1b1512', '#2e2119', '#4a3324', '#6b4a2f', '#a4774b', '#d2b07a', '#131313'];
  function portraitSpec(p) {
    const r = rng('face:' + p.id);
    const skin = r.int(0, SKINS.length - 1);
    const darkHairBias = skin >= 3;
    return { skin: SKINS[skin], hair: darkHairBias ? r.pick([HAIRS[0], HAIRS[1], HAIRS[6]]) : r.pick(HAIRS), style: r.pick(['corto', 'rapado', 'rizado', 'flequillo', 'tupe', 'largo', 'degradado', 'calvo']),
      beard: p.age >= 22 ? r.pick(['no', 'no', 'sombra', 'barba', 'perilla']) : r.pick(['no', 'no', 'no', 'sombra']), brow: r.pick([0, 1, 2]), jaw: r.pick([0, 1, 2]), eye: r.pick(['#3b2a1e', '#2b4b6f', '#4c6b3a', '#1b1b1b', '#5a3d22']), ear: r() < 0.5, headband: r() < 0.07 };
  }
  function portrait(p, team, size) {
    const sp = portraitSpec(p); const s = size || 96; const id = uid('pt');
    const shirt = team ? team.color : '#12804a'; const shirt2 = mix(shirt, '#000000', 0.25);
    const skinD = mix(sp.skin, '#000000', 0.16), skinL = mix(sp.skin, '#ffffff', 0.18);
    const hairD = mix(sp.hair, '#000000', 0.25);
    const jaw = [['M34 62C34 84 44 96 60 96C76 96 86 84 86 62'], ['M33 62C33 86 46 98 60 98C74 98 87 86 87 62'], ['M35 62C35 82 42 94 60 96C78 94 85 82 85 62']][sp.jaw][0];
    const hair = {
      corto: `<path d="M33 56C31 34 44 22 60 22C77 22 90 33 87 56C84 46 78 40 70 39C62 44 48 44 40 40C36 44 34 50 33 56Z" fill="${sp.hair}"/>`,
      rapado: `<path d="M34 54C33 36 45 25 60 25C75 25 87 36 86 54C83 44 74 36 60 36C46 36 37 44 34 54Z" fill="${sp.hair}" opacity=".75"/>`,
      rizado: `<g fill="${sp.hair}">${[[36, 44], [42, 34], [52, 28], [62, 26], [72, 29], [81, 36], [85, 46], [46, 38], [58, 34], [70, 36], [33, 54], [87, 54]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('')}</g>`,
      flequillo: `<path d="M32 58C30 34 44 21 61 21C78 21 90 34 88 58C86 48 82 43 76 41C70 48 52 50 40 44C36 48 33 52 32 58Z" fill="${sp.hair}"/><path d="M40 44C48 50 62 50 76 41" stroke="${hairD}" stroke-width="2" fill="none"/>`,
      tupe: `<path d="M33 56C31 36 40 18 62 16C80 16 91 30 87 56C85 46 80 40 72 38C64 41 50 41 40 40C36 44 34 50 33 56Z" fill="${sp.hair}"/><path d="M46 24C54 14 70 14 78 22" stroke="${hairD}" stroke-width="2" fill="none"/>`,
      largo: `<path d="M30 76C26 40 40 20 61 20C82 20 94 40 90 76C88 62 86 50 80 42C70 46 50 46 40 42C34 50 32 62 30 76Z" fill="${sp.hair}"/>`,
      degradado: `<path d="M34 50C33 32 46 22 61 22C76 22 88 32 86 50C82 42 74 38 60 38C46 38 38 42 34 50Z" fill="${sp.hair}"/><path d="M34 52C34 46 35 44 37 42M86 52C86 46 85 44 83 42" stroke="${sp.hair}" stroke-width="3" opacity=".45"/>`,
      calvo: `<path d="M35 52C35 38 46 28 60 28C74 28 85 38 85 52" fill="none" stroke="${skinL}" stroke-width="3" opacity=".7"/>`,
    }[sp.style];
    const beard = { no: '', sombra: `<path d="${jaw}C80 80 74 76 60 78C46 76 40 80 34 62Z" fill="${sp.hair}" opacity=".18"/>`, barba: `<path d="${jaw}C82 76 76 74 70 80C64 84 56 84 50 80C44 74 38 76 34 62Z" fill="${sp.hair}" opacity=".9"/><path d="M52 82C56 80 64 80 68 82" stroke="${skinD}" stroke-width="2"/>`, perilla: `<path d="M52 86C54 94 66 94 68 86C64 88 56 88 52 86Z" fill="${sp.hair}"/><path d="M50 78C54 76 66 76 70 78" stroke="${sp.hair}" stroke-width="3" fill="none"/>` }[sp.beard];
    const browY = [0, -1.5, 1][sp.brow];
    return `<svg class="portrait" width="${s}" height="${Math.round(s * 1.15)}" viewBox="0 0 120 138" role="img" aria-label="Retrato de ${esc(p.name)}">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(shirt, '#ffffff', 0.82)}"/><stop offset="1" stop-color="${mix(shirt, '#ffffff', 0.6)}"/></linearGradient></defs>
      <rect width="120" height="138" rx="10" fill="url(#${id})"/>
      <path d="M8 138C10 116 26 106 46 102L60 110L74 102C94 106 110 116 112 138Z" fill="${shirt}"/>
      <path d="M46 102L60 118L74 102" fill="none" stroke="${shirt2}" stroke-width="5"/>
      <path d="M50 92V104C54 110 66 110 70 104V92Z" fill="${skinD}"/>
      ${sp.style === 'largo' ? hair : ''}
      <ellipse cx="33" cy="64" rx="5" ry="8" fill="${skinD}"/><ellipse cx="87" cy="64" rx="5" ry="8" fill="${skinD}"/>
      <path d="${jaw}V56C86 36 74 26 60 26C46 26 34 36 34 56Z" fill="${sp.skin}"/>
      ${beard}
      <path d="M43 ${54 + browY}C47 ${51 + browY} 52 ${51 + browY} 55 ${53 + browY}M65 ${53 + browY}C68 ${51 + browY} 73 ${51 + browY} 77 ${54 + browY}" stroke="${hairD}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="49" cy="61" rx="4.4" ry="3" fill="#fff"/><ellipse cx="71" cy="61" rx="4.4" ry="3" fill="#fff"/>
      <circle cx="49.5" cy="61.3" r="2.2" fill="${sp.eye}"/><circle cx="71.5" cy="61.3" r="2.2" fill="${sp.eye}"/>
      <path d="M60 62C59 68 57 72 56 74C58 76 62 76 64 74" stroke="${skinD}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M52 82C56 85 64 85 68 82" stroke="${mix(sp.skin, '#7a2b2b', 0.55)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      ${sp.style !== 'largo' ? hair : `<path d="M40 42C50 46 70 46 80 42C76 32 68 28 60 28C52 28 44 32 40 42Z" fill="${sp.hair}"/>`}
      ${sp.headband ? `<rect x="34" y="40" width="52" height="6" rx="3" fill="${shirt}"/>` : ''}
    </svg>`;
  }

  G.TCArt = { logo, brand, crest, crestSpec, portrait, mix, onColor };
})(typeof window !== 'undefined' ? window : globalThis);
