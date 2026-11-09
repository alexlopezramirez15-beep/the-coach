/* THE COACH — Partido en directo: notas del banquillo, evaluación de las respuestas y efecto en el partido.
 * Puro y determinista (se puede ejecutar en Node). El profesor actúa como "director de juego": genera las notas
 * a partir de lo que va pasando en la simulación y, al final, el partido se simula con el efecto de cada respuesta. */
(function (G) {
  'use strict';
  const TC = G.TC;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Situaciones: cada una con opciones valoradas (0-1), acción táctica que provoca y por qué
  const TYPES = {
    fuera: { title: 'Te están superando por fuera', inds: ['bloqueMedio', 'bloqueBajo'], kw: ['ayuda', 'basc', 'extremo', 'lateral', 'doblar', 'vigil', 'centro', 'cerrar', 'banda', 'permut', 'cobertura', 'segundo palo'],
      options: [['Ayudas del extremo al lateral y basculación hacia el lado del balón', 1, null, 'Es la respuesta más directa: igualas o superas en número en la banda sin desordenar el bloque.'],
        ['Cerrar por dentro, dejar que centren y defender el área con más gente', 0.6, 'bloque_bajo', 'Reduce el peligro interior, pero regalas metros y centros.'],
        ['Adelantar el bloque y presionar arriba', 0.3, 'presion_alta', 'No ataca el problema: si te superan por fuera, presionar más arriba deja aún más espacio.'],
        ['Atacar más por dentro para que no puedan salir', 0.15, 'dentro', 'Responde a un problema defensivo con un cambio ofensivo.'],
        ['No cambiar nada', 0.05, null, 'El problema seguirá ahí.']] },
    presion: { title: 'Su presión alta te ahoga en la salida', inds: ['salida', 'progPresion'], kw: ['apoyo', 'pivote', 'tercer hombre', 'largo', 'espalda', 'segunda', 'perfil', 'portero', 'abrir', 'amplitud', 'fijar', 'atraer', 'superioridad'],
      options: [['Más apoyos: bajar un mediocentro y abrir mucho a los centrales', 0.9, null, 'Generas superioridad en la primera línea y das líneas de pase seguras.'],
        ['Juego directo a la espalda de su presión y disputar las segundas jugadas', 0.85, 'directo', 'Si presionan con muchos, la espalda queda libre.'],
        ['Portero en largo hacia la banda para saltar la presión', 0.7, 'bandas', 'Evitas la zona de presión, aunque pierdes control.'],
        ['Bajar el ritmo y conservar atrás', 0.35, 'conservar', 'Con presión alta, conservar atrás aumenta el riesgo de pérdida.'],
        ['Seguir saliendo en corto igual, asumiendo el riesgo', 0.15, 'mas_riesgo', 'Insistir sin cambiar nada les da exactamente lo que buscan.']] },
    bloquebajo: { title: 'Tienes el balón pero no generas ocasiones', inds: ['ataqueBloqueBajo', 'superioridades', 'ocupacion'], kw: ['amplitud', 'cambio de orientacion', 'segunda linea', 'frontal', 'centro', 'tercer hombre', 'fijar', 'carril', 'llegada', 'desmarque', 'ruptura'],
      options: [['Más amplitud: extremos pegados a la banda y cambios de orientación rápidos', 0.9, 'bandas', 'Estiras su bloque y abres pasillos interiores.'],
        ['Llegada de segunda línea y disparo desde la frontal', 0.8, null, 'Castigas que defiendan tan atrás.'],
        ['Asumir más riesgo con más gente en el área', 0.6, 'mas_riesgo', 'Generas más, pero te expones a la contra.'],
        ['Más paciencia: conservar y esperar su error', 0.45, 'conservar', 'Puede funcionar, pero no cambia nada de lo que está pasando.'],
        ['Juego directo al delantero', 0.25, 'directo', 'Contra un bloque bajo bien plantado, el balón largo suele perderse.']] },
    contras: { title: 'Te hacen daño a la contra', inds: ['transDef'], kw: ['vigilancia', '3+1', 'presion tras perdida', 'falta', 'equilibrio', 'repliegue', 'cerca del balon', 'temporizar', 'cubrir', 'cinco segundos'],
      options: [['Vigilancias: quedarnos siempre con 3+1 por detrás del balón', 0.9, 'menos_riesgo', 'Proteges el contraataque antes de que suceda.'],
        ['Presión inmediata tras pérdida durante cinco segundos', 0.75, 'presion_alta', 'Si funciona, recuperas arriba; si no, te expones.'],
        ['Falta táctica en campo rival cuando nos superen', 0.55, null, 'Corta la contra, pero acumula tarjetas.'],
        ['Bajar el bloque y defender cerca del área', 0.45, 'bloque_bajo', 'Evitas espacios a la espalda, aunque renuncias a atacar.'],
        ['Seguir atacando con todos', 0.05, 'mas_riesgo', 'Es justo lo que alimenta sus contras.']] },
    entrelineas: { title: 'Reciben solos entre líneas', inds: ['bloqueMedio', 'presionAlta'], kw: ['juntar', 'lineas', 'distancia', 'mediocentro', 'pivote', 'perfil', 'saltar', 'vigilar', 'compact', 'cerrar'],
      options: [['Juntar líneas: defensa más alta y mediocentros más cerca de ella', 0.9, null, 'Reduces el espacio donde reciben.'],
        ['Un mediocentro sigue al hombre que recibe entre líneas', 0.75, null, 'Lo anulas, pero puedes abrir otro hueco.'],
        ['Bajar todo el bloque', 0.5, 'bloque_bajo', 'Desaparece el espacio, pero cedes campo.'],
        ['Presión alta para que no lleguen ahí', 0.4, 'presion_alta', 'Si la presión se supera, el espacio entre líneas será aún mayor.'],
        ['No hacer nada', 0.05, null, 'Seguirán recibiendo cómodos.']] },
    ganando: { title: 'Vas ganando y queda poco', inds: ['bloqueMedio', 'transOf'], kw: ['conservar', 'ritmo', 'gestionar', 'contra', 'compact', 'falta', 'tiempo', 'balon parado', 'cambios'],
      options: [['Conservar el balón, bajar el ritmo y gestionar el partido', 0.85, 'conservar', 'Con el balón no te hacen daño.'],
        ['Bloque medio-bajo compacto y salir a la contra', 0.8, 'contraataque', 'Proteges la ventaja y puedes sentenciar.'],
        ['Encerrarse en el área', 0.45, 'bloque_bajo', 'Invita a que te ataquen sin descanso.'],
        ['Seguir atacando para sentenciar, asumiendo riesgos', 0.35, 'mas_riesgo', 'Puede salir bien, pero arriesgas la ventaja.']] },
    perdiendo: { title: 'Vas perdiendo y queda poco', inds: ['ataqueBloqueBajo', 'presionAlta', 'superioridades'], kw: ['riesgo', 'presion', 'centro', 'area', 'amplitud', 'cambio', 'delantero', 'segunda linea', 'rapido'],
      options: [['Más riesgo: presión alta y más gente en ataque', 0.85, 'presion_alta', 'Necesitas el balón cerca de su portería.'],
        ['Atacar por bandas con centros al área', 0.7, 'bandas', 'Una vía clara para generar ocasiones rápido.'],
        ['Juego directo al delantero', 0.55, 'directo', 'Rápido, aunque poco preciso.'],
        ['Mantener el plan, todavía hay tiempo', 0.35, null, 'Con poco tiempo, no cambiar nada rara vez basta.'],
        ['Bajar el ritmo', 0.05, 'conservar', 'Lo contrario de lo que necesitas.']] },
    abp: { title: 'Te generan peligro en los córneres', inds: ['abpDef'], kw: ['zona', 'marca', 'mixta', 'primer palo', 'rematador', 'bloqueo', 'portero', 'despeje', 'segunda'],
      options: [['Defensa mixta: zona en el primer palo y marca a sus rematadores', 0.9, null, 'Combinas protección de zona y control de los mejores rematadores.'],
        ['Marcaje individual a todos', 0.6, null, 'Útil si tus defensores ganan duelos aéreos.'],
        ['Todos en zona', 0.5, null, 'Protege espacios, pero sus rematadores atacan libres.'],
        ['Dejar a dos arriba para salir a la contra', 0.45, null, 'Te amenaza menos su córner, pero defiendes con menos.']] },
    sistema: { title: 'El rival ha cambiado de sistema', inds: ['bloqueMedio', 'superioridades'], kw: ['referencia', 'marca', 'ajust', 'sistema', 'emparej', 'superioridad', 'linea', 'carril', 'presion'],
      options: [['Ajustar marcas y referencias de presión al nuevo sistema', 0.9, null, 'Mantienes tu idea adaptándote a lo nuevo.'],
        ['Cambiar a su mismo sistema para emparejar', 0.6, null, 'Igualas duelos, pero renuncias a tu estructura.'],
        ['Presionar alto para aprovechar su desorden', 0.55, 'presion_alta', 'Puede castigar el cambio, con riesgo.'],
        ['Mantener la estructura y esperar', 0.45, null, 'No reaccionar puede dejarles en superioridad.']] },
    lesion: { title: 'Lesión: tienes que hacer un cambio', inds: ['bloqueMedio', 'superioridades'], kw: ['posicion', 'recoloc', 'sistema', 'perfil', 'banda', 'cambio', 'consigna'], sub: true,
      options: [['Cambio por posición: entra un jugador del mismo puesto', 0.9, null, 'Mantienes la estructura.'],
        ['Recolocar a varios jugadores y cambiar el sistema', 0.7, null, 'Puede funcionar, pero exige tiempo de adaptación.'],
        ['Meter a un jugador más ofensivo', 0.5, 'mas_riesgo', 'Cambia el equilibrio del equipo.']] },
  };
  TYPES.descanso = { title: 'Charla del descanso', inds: [], kw: [], options: [] };

  // Lo que ha pasado en un tramo, visto por el equipo k
  function metrics(seqs, k, from, to) {
    const o = k === 'h' ? 'a' : 'h'; const m = { ext: 0, salidaKo: 0, ourSeq: 0, ourShots: 0, rivShots: 0, counters: 0, entries: 0, corners: 0, goalsFor: 0, goalsAg: 0 };
    for (const s of seqs) {
      if (s.min < from || s.min > to) continue;
      const mine = s.team === k;
      if (mine) m.ourSeq++;
      for (const st of s.steps) {
        if (!mine && st.k === 'progresion' && st.ok && (st.y < 25 || st.y > 75)) m.ext++;
        if (mine && st.k === 'salida' && !st.ok) m.salidaKo++;
        if (st.k === 'remate' || st.k === 'parada' || st.k === 'gol') { if (mine) m.ourShots++; else m.rivShots++; }
        if (!mine && st.k === 'contra' && st.ok) m.counters++;
        if (!mine && st.k === 'creacion' && st.ok) m.entries++;
        if (!mine && st.k === 'corner') m.corners++;
      }
      if (s.outcome === 'goal') { if (mine) m.goalsFor++; else m.goalsAg++; }
    }
    return m;
  }
  function scoreAt(seqs, minute) { let sc = [0, 0]; for (const s of seqs) { if (s.min > minute) break; sc = s.score || sc; } return sc; }

  // Elige la situación más relevante para el equipo k en este minuto
  function pickType(seqs, k, minute, used, r, opts) {
    const m = metrics(seqs, k, Math.max(1, minute - 15), minute);
    const sc = scoreAt(seqs, minute); const diff = k === 'h' ? sc[0] - sc[1] : sc[1] - sc[0];
    const cand = [
      ['fuera', m.ext * 1.4], ['presion', m.salidaKo * 1.5], ['bloquebajo', m.ourSeq >= 6 && m.ourShots <= 1 ? 3 + m.ourSeq * 0.2 : 0],
      ['contras', m.counters * 2.2], ['entrelineas', m.entries * 1.1], ['abp', m.corners * 1.3],
      ['ganando', minute >= 70 && diff > 0 ? 6 : 0], ['perdiendo', minute >= 65 && diff < 0 ? 6 : 0], ['sistema', 1 + r() * 1.5],
    ];
    if (opts && opts.injury) return { type: 'lesion', m, sc };
    const avail = cand.filter(([t, v]) => !used.includes(t) && v > 0).sort((a, b) => b[1] - a[1] + (r() - 0.5) * 0.8);
    return { type: avail.length ? avail[0][0] : 'sistema', m, sc };
  }
  function describe(type, m, sc, k, minute, side, rivalName) {
    const my = k === 'h' ? sc[0] : sc[1], their = k === 'h' ? sc[1] : sc[0];
    const marc = `Minuto ${minute}, ${my}-${their} en el marcador.`;
    const t = {
      fuera: `${marc} En los últimos minutos ${rivalName} ha progresado ${m.ext} veces por las bandas y llega a línea de fondo con facilidad. Tus laterales se quedan en inferioridad.`,
      presion: `${marc} ${rivalName} presiona muy arriba: has perdido ${m.salidaKo} balones en la salida en los últimos minutos y no consigues pasar del centro del campo.`,
      bloquebajo: `${marc} Tienes el balón (${m.ourSeq} posesiones en el tramo) pero solo ${m.ourShots} remate${m.ourShots === 1 ? '' : 's'}. ${rivalName} defiende muy junto y cerca de su área.`,
      contras: `${marc} ${rivalName} te ha montado ${m.counters} contraataques peligrosos tras tus pérdidas. Cuando pierdes el balón te quedan muy pocos jugadores por detrás.`,
      entrelineas: `${marc} Sus jugadores reciben entre tu línea de medios y la defensa (${m.entries} veces en el tramo) y se giran sin oposición.`,
      ganando: `${marc} Quedan unos ${90 - minute} minutos y ${rivalName} empieza a volcarse.`,
      perdiendo: `${marc} Quedan unos ${90 - minute} minutos y necesitas reaccionar.`,
      abp: `${marc} ${rivalName} ha sacado ${m.corners} córneres en el tramo y cada uno es una ocasión: sus rematadores ganan los duelos.`,
      sistema: `${marc} ${rivalName} ha cambiado su estructura: ahora defiende con línea de cinco y ataca con un jugador más por dentro. Tus referencias de presión ya no funcionan.`,
      lesion: `${marc} ${side.injured ? side.injured.name : 'Un jugador'} se ha lesionado y no puede seguir. Tienes que hacer un cambio ahora.`,
    };
    return t[type];
  }

  /* Genera la nota del banquillo para el equipo k (h/a) en este minuto.
     ctx: { id, seqs (secuencias simuladas), k, minute, half, used:[tipos ya usados], rivalName, onPitch:[{id,name,pos}], bench:[{id,name,pos}], injury, seed } */
  function makeNote(ctx) {
    const r = TC.makeRng('live:' + ctx.seed + ':' + ctx.id);
    const side = {};
    if (ctx.injury) { const outfield = ctx.onPitch.filter((p) => p.pos !== 'POR'); side.injured = outfield[Math.floor(r() * outfield.length)]; }
    const pick = pickType(ctx.seqs, ctx.k, ctx.minute, ctx.used || [], r, { injury: ctx.injury && side.injured && ctx.bench.length });
    const T = TYPES[pick.type];
    const note = { id: ctx.id, type: pick.type, half: ctx.half, min: ctx.minute, title: T.title, text: describe(pick.type, pick.m, pick.sc, ctx.k, ctx.minute, side, ctx.rivalName),
      options: T.options.map(([label, score, action, why], i) => ({ i, label, score, action, why })) };
    // barajar opciones para que la buena no sea siempre la primera
    note.options = r.shuffle(note.options).map((o, i) => Object.assign(o, { i }));
    if (T.sub) { note.sub = true; note.injured = side.injured ? side.injured.id : null; }
    return note;
  }
  // Charla del descanso: el problema principal de la primera parte
  function makeHalftime(ctx) {
    const n = makeNote(Object.assign({}, ctx, { minute: 45, injury: false }));
    n.title = 'Charla del descanso: ' + n.title.charAt(0).toLowerCase() + n.title.slice(1); n.type = n.type; n.halftime = true;
    n.text = n.text.replace(/^Minuto 45, /, 'Descanso, ');
    return n;
  }

  // Valora una respuesta: 60 % el ajuste elegido y 40 % la consigna escrita
  function scoreAnswer(note, ans, players, bench) {
    if (!ans || (ans.opt == null && !(ans.text || '').trim())) return { q: 0, opt: 0, text: 0, feedback: 'Sin respuesta: el equipo siguió igual y lo notó.', answered: false };
    const T = TYPES[note.type] || { kw: [] };
    const o = note.options.find((x) => x.i === +ans.opt);
    const optS = o ? o.score : 0;
    const txt = norm(ans.text);
    const lenS = clamp(txt.length / 140, 0, 1);
    const names = (players || []).filter((p) => txt.includes(norm(p.name.split(' ').slice(-1)[0])) || txt.includes(norm(p.name.split(' ')[0]))).length;
    const nameS = clamp(names / 2, 0, 1);
    const kwHits = T.kw.filter((k) => txt.includes(norm(k))).length;
    const kwS = clamp(kwHits / 3, 0, 1);
    let textS = lenS * 0.35 + nameS * 0.3 + kwS * 0.35;
    let subNote = '';
    if (note.sub) {
      const inP = (bench || []).find((p) => p.id === ans.subIn); const outP = (players || []).find((p) => p.id === note.injured) || {};
      const fit = inP && outP.pos ? TC.posFit(inP, outP.pos) : 0;
      textS = textS * 0.6 + fit * 0.4;
      subNote = inP ? ` Cambio: entra ${inP.name}${fit >= 0.9 ? ' (encaja en el puesto)' : fit >= 0.75 ? ' (puesto parecido)' : ' (fuera de su posición)'}.` : ' No elegiste quién entraba: se hizo el cambio automático.';
    }
    const q = clamp(optS * 0.6 + textS * 0.4, 0, 1);
    const fb = `${o ? `Ajuste: «${o.label}». ${o.why}` : 'No elegiste ningún ajuste.'} Consigna: ${txt.length < 40 ? 'muy breve' : kwS >= 0.6 ? 'concreta y con conceptos tácticos' : 'mejorable, faltan conceptos concretos'}${names ? `, nombras a ${names} jugador${names > 1 ? 'es' : ''}` : ', sin nombres propios'}.${subNote}`;
    return { q: Math.round(q * 100) / 100, opt: optS, text: Math.round(textS * 100) / 100, feedback: fb, answered: true };
  }
  // Convierte notas + respuestas en efectos para el simulador
  function effects(notes, answers, players, bench) {
    const out = [];
    for (const n of notes || []) {
      const ans = (answers || {})[n.id];
      const sc = scoreAnswer(n, ans, players, bench);
      const from = n.halftime ? 46 : n.min + 1;
      const to = n.halftime ? 90 : Math.min(n.half === 1 ? 45 : 90, from + 18);
      const inds = n.halftime ? (TYPES[n.type] || {}).inds || [] : (TYPES[n.type] || {}).inds || [];
      out.push({ min: from, to, inds, amount: Math.round((sc.q - 0.45) * 40) });
      const o = ans && n.options.find((x) => x.i === +ans.opt);
      if (o && o.action) out.push({ min: from, action: o.action });
      if (n.sub && n.injured) {
        const inId = ans && ans.subIn && (bench || []).some((p) => p.id === ans.subIn) ? ans.subIn : ((bench || []).slice().sort((a, b) => TC.posFit(b, ((players || []).find((p) => p.id === n.injured) || {}).pos || 'MC') - TC.posFit(a, ((players || []).find((p) => p.id === n.injured) || {}).pos || 'MC'))[0] || {}).id;
        if (inId) out.push({ min: n.min, action: 'sub', out: n.injured, in: inId });
      }
    }
    return out;
  }
  // Respuesta de un equipo del sistema (según dificultad)
  function aiAnswer(note, level, seed) {
    const r = TC.makeRng('ai:' + seed + ':' + note.id);
    const sorted = note.options.slice().sort((a, b) => b.score - a.score);
    const idx = level === 'alto' ? 0 : level === 'bajo' ? Math.min(sorted.length - 1, Math.floor(r() * 3)) : (r() < 0.6 ? 0 : 1);
    return { opt: sorted[idx].i, text: 'Consigna del cuerpo técnico: ajustar la posición, ayudas y vigilancias.', subIn: null, at: 0, ai: true };
  }

  TC.LIVE = { TYPES, makeNote, makeHalftime, scoreAnswer, effects, aiAnswer, metrics, scoreAt };
})(typeof window !== 'undefined' ? window : globalThis);
