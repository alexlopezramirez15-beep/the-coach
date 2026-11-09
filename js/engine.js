/* THE COACH — Motor de juego (puro, sin DOM).
 * Contiene: RNG con semilla, catálogos, generación de plantillas equilibradas,
 * calendario, evaluación metodológica, aprendizaje del equipo y simulador de partidos.
 * Diseñado para poder ejecutarse en servidor (Node) sin cambios: no usa window ni DOM.
 */
(function (G) {
  'use strict';
  const TC = (G.TC = G.TC || {});

  /* ───────────── RNG reproducible ───────────── */
  function hashSeed(str) {
    str = String(str);
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function makeRng(seed) {
    let a = hashSeed(seed);
    const r = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.normal = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    r.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
    return r;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
  const round1 = (v) => Math.round(v * 10) / 10;

  /* ───────────── Catálogos ───────────── */
  const ATTR_GROUPS = {
    tecnicos: { label: 'Técnicos', attrs: [['pase', 'Pase'], ['control', 'Control'], ['conduccion', 'Conducción'], ['regate', 'Regate'], ['finalizacion', 'Finalización'], ['aereo', 'Juego aéreo'], ['entrada', 'Entrada'], ['perfil', 'Perfil corporal']] },
    tacticos: { label: 'Tácticos', attrs: [['espacios', 'Interpretación de espacios'], ['decisiones', 'Toma de decisiones'], ['orientacion', 'Orientación corporal'], ['percepcion', 'Percepción'], ['anticipacion', 'Anticipación'], ['ocupacion', 'Ocupación racional de espacios'], ['asociacion', 'Capacidad de asociación'], ['intDefensiva', 'Interpretación defensiva'], ['superioridad', 'Generar superioridades']] },
    fisicos: { label: 'Físicos', attrs: [['velocidad', 'Velocidad'], ['aceleracion', 'Aceleración'], ['resistencia', 'Resistencia'], ['fuerza', 'Fuerza'], ['agilidad', 'Agilidad'], ['repetir', 'Repetir esfuerzos']] },
    psicologicos: { label: 'Psicológicos', attrs: [['concentracion', 'Concentración'], ['confianzaAttr', 'Confianza'], ['competitividad', 'Competitividad'], ['adaptacion', 'Capacidad de adaptación'], ['colectivo', 'Trabajo colectivo']] },
  };
  const ALL_ATTRS = Object.values(ATTR_GROUPS).flatMap((g) => g.attrs.map((a) => a[0]));
  const ATTR_LABEL = Object.fromEntries(Object.values(ATTR_GROUPS).flatMap((g) => g.attrs));

  const POSITIONS = {
    POR: { label: 'Portero', line: 'gk', sec: [] },
    DFC: { label: 'Defensa central', line: 'def', sec: ['MCD'] },
    LD: { label: 'Lateral derecho', line: 'def', sec: ['LI', 'ED'] },
    LI: { label: 'Lateral izquierdo', line: 'def', sec: ['LD', 'EI'] },
    MCD: { label: 'Mediocentro defensivo', line: 'mid', sec: ['MC', 'DFC'] },
    MC: { label: 'Mediocentro', line: 'mid', sec: ['MCD', 'MCO'] },
    MCO: { label: 'Mediapunta', line: 'mid', sec: ['MC', 'DC'] },
    ED: { label: 'Extremo derecho', line: 'att', sec: ['EI', 'MCO'] },
    EI: { label: 'Extremo izquierdo', line: 'att', sec: ['ED', 'MCO'] },
    DC: { label: 'Delantero centro', line: 'att', sec: ['MCO', 'ED'] },
  };

  // Pesos de cada atributo para la valoración en su puesto
  const POS_KEYS = {
    POR: ['agilidad', 'anticipacion', 'concentracion', 'percepcion', 'aereo', 'pase', 'decisiones'],
    DFC: ['entrada', 'intDefensiva', 'anticipacion', 'aereo', 'fuerza', 'concentracion', 'pase', 'velocidad'],
    LD: ['velocidad', 'resistencia', 'entrada', 'intDefensiva', 'pase', 'conduccion', 'repetir'],
    LI: ['velocidad', 'resistencia', 'entrada', 'intDefensiva', 'pase', 'conduccion', 'repetir'],
    MCD: ['intDefensiva', 'anticipacion', 'pase', 'orientacion', 'ocupacion', 'entrada', 'decisiones'],
    MC: ['pase', 'control', 'decisiones', 'asociacion', 'percepcion', 'resistencia', 'orientacion'],
    MCO: ['pase', 'control', 'regate', 'superioridad', 'espacios', 'decisiones', 'finalizacion'],
    ED: ['velocidad', 'aceleracion', 'regate', 'conduccion', 'superioridad', 'finalizacion', 'espacios'],
    EI: ['velocidad', 'aceleracion', 'regate', 'conduccion', 'superioridad', 'finalizacion', 'espacios'],
    DC: ['finalizacion', 'espacios', 'aereo', 'fuerza', 'aceleracion', 'control', 'perfil'],
  };

  // Arquetipos: desplazamientos sobre la media del jugador (suma ≈ 0 tras normalizar)
  const ARCHETYPES = {
    POR: [['Portero de reflejos', { agilidad: 14, concentracion: 8, pase: -8 }], ['Portero de juego con pies', { pase: 14, decisiones: 10, percepcion: 6, aereo: -8 }], ['Portero dominador del área', { aereo: 14, fuerza: 10, anticipacion: 6, pase: -6 }]],
    DFC: [['Central contundente', { aereo: 14, fuerza: 14, entrada: 10, regate: -12, conduccion: -8 }], ['Central con salida', { pase: 14, control: 10, orientacion: 10, percepcion: 6, aereo: -8, fuerza: -8 }], ['Central rápido de cobertura', { velocidad: 14, anticipacion: 12, intDefensiva: 6, aereo: -10 }]],
    LD: [['Lateral profundo', { velocidad: 12, resistencia: 12, repetir: 8, intDefensiva: -10 }], ['Lateral interior', { pase: 12, asociacion: 12, decisiones: 8, velocidad: -8 }], ['Lateral defensivo', { entrada: 12, intDefensiva: 12, concentracion: 6, regate: -10 }]],
    LI: [['Lateral profundo', { velocidad: 12, resistencia: 12, repetir: 8, intDefensiva: -10 }], ['Lateral interior', { pase: 12, asociacion: 12, decisiones: 8, velocidad: -8 }], ['Lateral defensivo', { entrada: 12, intDefensiva: 12, concentracion: 6, regate: -10 }]],
    MCD: [['Mediocentro posicional', { ocupacion: 14, intDefensiva: 12, orientacion: 8, velocidad: -10, regate: -8 }], ['Pivote organizador', { pase: 14, percepcion: 12, decisiones: 8, entrada: -10, fuerza: -6 }], ['Recuperador', { entrada: 14, competitividad: 12, repetir: 8, pase: -10, control: -6 }]],
    MC: [['Interior técnico', { regate: 12, control: 12, conduccion: 10, decisiones: -10, intDefensiva: -10, ocupacion: -6 }], ['Interior inteligente', { decisiones: 14, asociacion: 12, percepcion: 10, velocidad: -10, regate: -6 }], ['Box to box', { resistencia: 14, repetir: 12, fuerza: 6, pase: -8, percepcion: -6 }]],
    MCO: [['Mediapunta asociativo', { asociacion: 14, pase: 12, percepcion: 6, fuerza: -12 }], ['Llegador', { finalizacion: 12, espacios: 12, aceleracion: 6, pase: -8, intDefensiva: -8 }], ['Creativo individual', { regate: 14, superioridad: 12, colectivo: -12, decisiones: -6 }]],
    ED: [['Extremo desequilibrante', { regate: 14, superioridad: 12, velocidad: 6, intDefensiva: -12, colectivo: -6 }], ['Extremo a pierna cambiada', { finalizacion: 12, conduccion: 10, espacios: 6, aereo: -10 }], ['Extremo trabajador', { resistencia: 12, colectivo: 12, intDefensiva: 8, regate: -10, finalizacion: -6 }]],
    EI: [['Extremo desequilibrante', { regate: 14, superioridad: 12, velocidad: 6, intDefensiva: -12, colectivo: -6 }], ['Extremo a pierna cambiada', { finalizacion: 12, conduccion: 10, espacios: 6, aereo: -10 }], ['Extremo trabajador', { resistencia: 12, colectivo: 12, intDefensiva: 8, regate: -10, finalizacion: -6 }]],
    DC: [['Delantero de área', { finalizacion: 14, aereo: 12, fuerza: 8, velocidad: -10, asociacion: -6 }], ['Delantero de apoyo', { asociacion: 14, control: 12, pase: 8, finalizacion: -6, aereo: -8 }], ['Delantero de ruptura', { velocidad: 14, aceleracion: 12, espacios: 8, aereo: -10, control: -6 }]],
  };

  // Plantilla tipo (18): 11 titulares + 7 suplentes
  const SQUAD_TEMPLATE = [
    ['POR', 66], ['POR', 55], ['DFC', 66], ['DFC', 65], ['DFC', 57], ['LD', 65], ['LD', 56], ['LI', 65], ['MCD', 66], ['MCD', 56],
    ['MC', 66], ['MC', 65], ['MCO', 64], ['ED', 66], ['ED', 56], ['EI', 65], ['DC', 66], ['DC', 57],
  ];

  const FIRST = ['Álex', 'Hugo', 'Mario', 'Iker', 'Pol', 'Unai', 'Leo', 'Nico', 'Dani', 'Rubén', 'Marc', 'Aitor', 'Jon', 'Sergio', 'Adrián', 'Pablo', 'Oriol', 'Gerard', 'Iván', 'Lucas', 'Bruno', 'Raúl', 'Víctor', 'Joel', 'Enzo', 'Ander', 'Gael', 'Eric', 'Samuel', 'Martí', 'Izan', 'Arnau', 'Rayan', 'Thiago', 'Biel', 'Mateo', 'Óscar', 'Asier', 'Jordi', 'Xabi', 'Youssef', 'Kevin', 'Saúl', 'Íñigo', 'Ferran', 'Moha', 'Teo', 'Carles'];
  const LAST = ['Vidal', 'Ferrer', 'Soler', 'Navarro', 'Molina', 'Ortega', 'Castro', 'Lozano', 'Prieto', 'Serra', 'Pons', 'Roca', 'Vega', 'Ibarra', 'Medina', 'Garrido', 'Campos', 'Rey', 'Cano', 'Marín', 'Iglesias', 'Bravo', 'Arias', 'Duran', 'Riera', 'Toledo', 'Peña', 'Sanz', 'Mora', 'Gil', 'Font', 'Mas', 'Herrero', 'Bosch', 'Esteve', 'Llorente', 'Calvo', 'Aguirre', 'Etxeberria', 'Benítez', 'Rivas', 'Salas', 'Crespo', 'Pascual', 'Quintana', 'Busquets', 'Montoya', 'Alonso'];

  const FORMATIONS = {
    '1-4-3-3': [['POR', 5, 50], ['LD', 25, 85], ['DFC', 20, 62], ['DFC', 20, 38], ['LI', 25, 15], ['MCD', 38, 50], ['MC', 50, 70], ['MC', 50, 30], ['ED', 72, 88], ['DC', 78, 50], ['EI', 72, 12]],
    '1-4-4-2': [['POR', 5, 50], ['LD', 24, 85], ['DFC', 20, 62], ['DFC', 20, 38], ['LI', 24, 15], ['ED', 50, 86], ['MC', 45, 60], ['MCD', 45, 40], ['EI', 50, 14], ['DC', 74, 60], ['DC', 74, 40]],
    '1-4-2-3-1': [['POR', 5, 50], ['LD', 25, 85], ['DFC', 20, 62], ['DFC', 20, 38], ['LI', 25, 15], ['MCD', 40, 60], ['MC', 40, 40], ['ED', 62, 85], ['MCO', 62, 50], ['EI', 62, 15], ['DC', 80, 50]],
    '1-3-5-2': [['POR', 5, 50], ['DFC', 20, 72], ['DFC', 18, 50], ['DFC', 20, 28], ['LD', 48, 90], ['MC', 46, 66], ['MCD', 40, 50], ['MC', 46, 34], ['LI', 48, 10], ['DC', 76, 60], ['DC', 76, 40]],
    '1-3-4-3': [['POR', 5, 50], ['DFC', 20, 72], ['DFC', 18, 50], ['DFC', 20, 28], ['LD', 46, 90], ['MC', 44, 60], ['MCD', 44, 40], ['LI', 46, 10], ['ED', 74, 80], ['DC', 80, 50], ['EI', 74, 20]],
    '1-5-3-2': [['POR', 5, 50], ['LD', 28, 90], ['DFC', 18, 70], ['DFC', 16, 50], ['DFC', 18, 30], ['LI', 28, 10], ['MC', 44, 68], ['MCD', 40, 50], ['MC', 44, 32], ['DC', 72, 60], ['DC', 72, 40]],
  };
  // Estructuras con balón (solo afectan a ocupación/amplitud en el simulador y a la pizarra)
  const ATT_STRUCTURES = {
    '1-3-2-5': { width: 0.9, occupation: 0.9, rest: 0.55, label: '1-3-2-5 (cinco carriles ocupados)' },
    '1-2-3-5': { width: 0.95, occupation: 0.95, rest: 0.4, label: '1-2-3-5 (máxima amplitud, poca vigilancia)' },
    '1-4-3-3': { width: 0.7, occupation: 0.65, rest: 0.75, label: '1-4-3-3 (equilibrado)' },
    '1-3-1-4-2': { width: 0.8, occupation: 0.8, rest: 0.6, label: '1-3-1-4-2 (doble punta)' },
    '1-4-2-4': { width: 0.75, occupation: 0.7, rest: 0.65, label: '1-4-2-4 (doble pivote fijo)' },
    '1-4-4-2': { width: 0.6, occupation: 0.55, rest: 0.85, label: '1-4-4-2 (conservador)' },
  };

  const INDICATORS = [
    ['salida', 'Dominio de la salida de balón', 'Organización ofensiva'],
    ['progPresion', 'Progresión ante presión', 'Organización ofensiva'],
    ['superioridades', 'Creación de superioridades', 'Organización ofensiva'],
    ['ocupacion', 'Ocupación de espacios', 'Organización ofensiva'],
    ['ataqueBloqueBajo', 'Ataque a bloque bajo', 'Organización ofensiva'],
    ['presionAlta', 'Presión alta', 'Organización defensiva'],
    ['bloqueMedio', 'Defensa en bloque medio', 'Organización defensiva'],
    ['bloqueBajo', 'Defensa en bloque bajo', 'Organización defensiva'],
    ['transOf', 'Transición ofensiva', 'Transición defensa-ataque'],
    ['transDef', 'Transición defensiva', 'Transición ataque-defensa'],
    ['abpOf', 'Estrategia ofensiva', 'Balón parado'],
    ['abpDef', 'Estrategia defensiva', 'Balón parado'],
  ];
  const IND_LABEL = Object.fromEntries(INDICATORS.map((i) => [i[0], i[1]]));
  const IND_START = 40;

  const TASK_TYPES = {
    rondo: { label: 'Rondo', aff: { progPresion: 0.75, salida: 0.6, transDef: 0.55, superioridades: 0.5 }, repr: 0.35 },
    posicion: { label: 'Juego de posición', aff: { superioridades: 0.9, ocupacion: 0.9, salida: 0.8, progPresion: 0.8, ataqueBloqueBajo: 0.55 }, repr: 0.6 },
    posesion: { label: 'Juego de posesión', aff: { progPresion: 0.75, transDef: 0.7, presionAlta: 0.6, superioridades: 0.6 }, repr: 0.5 },
    reducida: { label: 'Situación reducida', aff: { ataqueBloqueBajo: 0.7, transOf: 0.65, transDef: 0.65, bloqueBajo: 0.6, presionAlta: 0.5 }, repr: 0.65 },
    superioridad: { label: 'Situación de superioridad', aff: { superioridades: 0.9, ataqueBloqueBajo: 0.8, salida: 0.65, transOf: 0.5 }, repr: 0.6 },
    inferioridad: { label: 'Situación de inferioridad', aff: { bloqueBajo: 0.85, bloqueMedio: 0.7, progPresion: 0.55, transOf: 0.5 }, repr: 0.6 },
    igualdad: { label: 'Situación de igualdad', aff: { presionAlta: 0.7, transDef: 0.7, transOf: 0.7, bloqueMedio: 0.6 }, repr: 0.65 },
    condicionado: { label: 'Juego condicionado', aff: { presionAlta: 0.7, transDef: 0.7, transOf: 0.65, salida: 0.6, progPresion: 0.6 }, repr: 0.6 },
    partidoReducido: { label: 'Partido reducido', aff: { transOf: 0.7, transDef: 0.7, presionAlta: 0.6, bloqueMedio: 0.6, ataqueBloqueBajo: 0.55 }, repr: 0.75 },
    partidoModificado: { label: 'Partido modificado', aff: { bloqueMedio: 0.8, presionAlta: 0.8, salida: 0.7, ataqueBloqueBajo: 0.7, transOf: 0.7, ocupacion: 0.7, bloqueBajo: 0.7 }, repr: 0.9 },
    especifica: { label: 'Situación específica por posición', aff: { ataqueBloqueBajo: 0.6, salida: 0.6, superioridades: 0.5 }, repr: 0.5 },
    colectivo: { label: 'Trabajo colectivo', aff: { bloqueMedio: 0.9, bloqueBajo: 0.9, presionAlta: 0.8, ocupacion: 0.8, salida: 0.7 }, repr: 0.8 },
    estrategia: { label: 'Estrategia (balón parado)', aff: { abpOf: 1, abpDef: 1 }, repr: 0.85 },
  };
  const AFF_DEFAULT = 0.3;

  // Perfil ideal según objetivo. players: total en tarea; m2: metros cuadrados por jugador; min: minutos útiles
  const OBJ_PROFILE = {
    salida: { players: [12, 22], m2: [80, 160], min: [12, 30], rules: ['salida_portero', 'toques2', 'pase_linea', 'porteros'] },
    progPresion: { players: [8, 20], m2: [40, 110], min: [12, 30], rules: ['pase_linea', 'toques2', 'comodines'] },
    superioridades: { players: [8, 20], m2: [60, 140], min: [12, 30], rules: ['comodines', 'pase_linea', 'zonas_carril'] },
    ocupacion: { players: [14, 22], m2: [90, 180], min: [12, 30], rules: ['zonas_carril', 'porteros'] },
    ataqueBloqueBajo: { players: [10, 22], m2: [60, 130], min: [12, 30], rules: ['zonas_carril', 'centros', 'comodines', 'porteros'] },
    presionAlta: { players: [10, 22], m2: [70, 150], min: [10, 28], rules: ['recup_alta', 'presion_activa', 'tras_perdida', 'porteros'] },
    bloqueMedio: { players: [14, 22], m2: [90, 180], min: [12, 30], rules: ['presion_activa', 'bloque_zona', 'porteros'] },
    bloqueBajo: { players: [12, 22], m2: [50, 120], min: [12, 30], rules: ['bloque_zona', 'centros', 'porteros'] },
    transOf: { players: [8, 22], m2: [80, 170], min: [10, 25], rules: ['gol_rapido', 'superar_minis', 'porteros'] },
    transDef: { players: [8, 22], m2: [50, 130], min: [10, 25], rules: ['tras_perdida', 'superar_minis', 'porteros'] },
    abpOf: { players: [10, 22], m2: [20, 200], min: [10, 25], rules: ['abp', 'porteros'] },
    abpDef: { players: [10, 22], m2: [20, 200], min: [10, 25], rules: ['abp', 'porteros'] },
  };

  const PROVOCATIONS = [
    ['toques2', 'Máximo dos toques', ['progPresion', 'salida', 'superioridades']],
    ['pase_linea', 'Punto al superar una línea con pase', ['progPresion', 'superioridades', 'salida']],
    ['tras_perdida', '5 s para recuperar tras pérdida (punto doble)', ['transDef', 'presionAlta']],
    ['recup_alta', 'Recuperar en campo rival vale doble', ['presionAlta']],
    ['gol_rapido', 'Gol en menos de 10 s tras recuperar vale doble', ['transOf']],
    ['comodines', 'Comodines ofensivos', ['superioridades', 'salida', 'ataqueBloqueBajo', 'progPresion']],
    ['zonas_carril', 'Ocupación obligatoria de carriles', ['ocupacion', 'ataqueBloqueBajo', 'superioridades']],
    ['bloque_zona', 'Defensores limitados a una zona (bloque)', ['bloqueBajo', 'bloqueMedio']],
    ['porteros', 'Porterías reglamentarias con portero', []],
    ['centros', 'Gol tras centro vale doble', ['ataqueBloqueBajo', 'abpOf']],
    ['salida_portero', 'Inicio obligatorio desde el portero', ['salida']],
    ['presion_activa', 'Presión con orientación obligatoria', ['presionAlta', 'bloqueMedio']],
    ['abp', 'Reinicios a balón parado', ['abpOf', 'abpDef']],
    ['superar_minis', 'Miniporterías de transición tras recuperar', ['transOf', 'transDef']],
  ];
  const PROV = Object.fromEntries(PROVOCATIONS.map((p) => [p[0], { label: p[1], ind: p[2] }]));

  const SESSION_TYPES = ['Recuperación', 'Análisis y recuperación', 'Táctica ofensiva', 'Táctica defensiva', 'Físico-táctica', 'Trabajo sobre el rival', 'Activación y estrategia', 'Descanso'];
  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

  /* ───────────── Modelo de juego: opciones ───────────── */
  const MODEL_FIELDS = {
    ofensiva: { label: 'Organización ofensiva', fields: [
      ['attStructure', 'Estructura con balón', Object.keys(ATT_STRUCTURES)],
      ['buildUp', 'Inicio de juego', ['corto', 'mixto', 'directo']],
      ['cbHeight', 'Altura de centrales en inicio', ['baja', 'media', 'alta']],
      ['fullbacks', 'Participación de laterales', ['profundos', 'interiores', 'conservadores']],
      ['pivots', 'Posicionamiento de mediocentros', ['entre centrales', 'escalonados', 'en paralelo']],
      ['width', 'Amplitud', ['1', '2', '3', '4', '5']],
      ['tempo', 'Ritmo de circulación', ['pausado', 'medio', 'alto']],
      ['progression', 'Progresión', ['interior', 'exterior', 'mixta']],
      ['finishing', 'Comportamiento en zona de finalización', ['centros', 'juego interior', 'llegada de segunda línea']],
    ] },
    defensiva: { label: 'Organización defensiva', fields: [
      ['defStructure', 'Estructura sin balón', Object.keys(FORMATIONS)],
      ['blockHeight', 'Altura del bloque', ['bajo', 'medio', 'alto']],
      ['pressType', 'Tipo de presión', ['zonal', 'al hombre', 'mixta']],
      ['pressOrientation', 'Orientación de la presión', ['hacia fuera', 'hacia dentro']],
      ['coverage', 'Coberturas y permutas', ['coberturas cortas', 'permutas', 'basculación amplia']],
      ['depthControl', 'Control de profundidad', ['línea adelantada', 'línea media', 'línea hundida']],
    ] },
    transAD: { label: 'Transición ataque-defensa', fields: [
      ['afterLoss', 'Reacción tras pérdida', ['presión inmediata', 'mixta', 'repliegue']],
      ['restDefense', 'Vigilancias preventivas', ['2+1', '3+1', '3+2']],
    ] },
    transDA: { label: 'Transición defensa-ataque', fields: [
      ['afterRecovery', 'Tras recuperación', ['contraataque', 'ataque rápido', 'conservación']],
      ['firstPass', 'Primer pase', ['vertical', 'fuera de zona de presión', 'al pivote']],
    ] },
    abp: { label: 'Acciones a balón parado', fields: [
      ['cornerOf', 'Córner ofensivo', ['primer palo', 'segundo palo', 'en corto']],
      ['cornerDef', 'Córner defensivo', ['zonal', 'al hombre', 'mixto']],
      ['freeKicks', 'Faltas laterales/frontales', ['juego directo al área', 'jugada ensayada', 'conservar']],
      ['throwIns', 'Saques de banda', ['largo al área', 'corto y conservar']],
    ] },
  };
  // Cuaderno del modelo de juego que escribe el alumno (fases y momentos)
  const MODEL_MOMENTS = {
    ofensiva: { label: 'Fase ofensiva', fields: 'ofensiva', moments: [['salida', 'Salida de balón'], ['progresion', 'Progresión del juego'], ['ultimo', 'Último tercio']] },
    defensiva: { label: 'Fase defensiva', fields: 'defensiva', moments: [['bloqueAlto', 'Bloque alto'], ['bloqueMedio', 'Bloque medio'], ['bloqueBajo', 'Bloque bajo']] },
    transiciones: { label: 'Transiciones ofensivas y defensivas', fields: 'trans', moments: [['transOf', 'Transición ofensiva (al recuperar)'], ['transDef', 'Transición defensiva (al perder)']] },
  };
  const FUNDAMENTOS = ['Fijar para liberar', 'Atraer para progresar', 'Tercer hombre', 'Pared', 'Apoyo y desmarque', 'Amplitud y profundidad', 'Superioridad numérica', 'Superioridad posicional', 'Superioridad cualitativa', 'Cambio de orientación', 'Juego entre líneas', 'Ataque al espacio', 'Desmarque de ruptura', 'Conducción para fijar', 'Llegada de segunda línea', 'Ocupación de carriles', 'Temporizar', 'Basculación', 'Cobertura', 'Permuta', 'Vigilancias', 'Presión tras pérdida', 'Repliegue intensivo', 'Orientar la presión hacia fuera', 'Cerrar líneas de pase interiores', 'Salto a presionar', 'Basculación y cierre del lado fuerte', 'Contraataque', 'Primer pase fuera de zona de presión', 'Ataque rápido'];
  function blankWork() {
    const moments = {}; for (const g of Object.values(MODEL_MOMENTS)) for (const [k] of g.moments) moments[k] = { fund: '', expl: '', players: [] };
    return { lines: { def: '', mid: '', att: '' }, ideas: ['', '', '', '', ''], systemText: '', moments };
  }
  // Cuaderno de ejemplo (demo y pruebas): usa jugadores reales de la plantilla
  function exampleWork(players) {
    const by = (line) => players.filter((p) => POSITIONS[p.pos].line === line).sort((a, b) => playerRating(b) - playerRating(a)).map((p) => p.id);
    const D = by('def'), M = by('mid'), A = by('att'), P = by('gk');
    const w = blankWork();
    w.lines = { def: 'Centrales rápidos y con buena salida de balón; los laterales suben bien pero sufren defendiendo a la espalda.', mid: 'Un pivote ordenado y dos interiores con mucho recorrido; nos falta un mediocentro que pise área.', att: 'Extremos desequilibrantes en el uno contra uno y un delantero que fija centrales y gana duelos aéreos.' };
    w.ideas = ['Querer el balón y salir jugando desde atrás', 'Atacar por fuera con los extremos abiertos', 'Presionar fuerte tras pérdida durante cinco segundos', 'Defender en bloque medio y juntos', 'Llegar al área con segunda línea', ''];
    w.ideas = w.ideas.slice(0, 5);
    w.systemText = 'Jugamos 1-4-3-3 porque tenemos tres buenos medios y dos extremos rápidos que dan amplitud.';
    const pick = { salida: [P[0], D[0], D[1], M[0]], progresion: [M[0], M[1], D[2]], ultimo: [A[0], A[1], M[1]], bloqueAlto: [A[0], A[1], M[1]], bloqueMedio: [M[0], M[1], D[0]], bloqueBajo: [D[0], D[1], M[0]], transOf: [M[1], A[0], A[1]], transDef: [M[0], D[0], D[1]] };
    for (const [k, ids] of Object.entries(pick)) w.moments[k] = { fund: FUNDAMENTOS[Object.keys(pick).indexOf(k) * 3 % FUNDAMENTOS.length], expl: 'Explicación de ejemplo: qué buscamos en este momento, cómo lo hacemos y por qué encaja con estos jugadores.', players: ids.filter(Boolean) };
    return w;
  }
  function defaultModel() {
    return {
      attStructure: '1-4-3-3', buildUp: 'mixto', cbHeight: 'media', fullbacks: 'profundos', pivots: 'escalonados', width: '3', tempo: 'medio', progression: 'mixta', finishing: 'juego interior',
      defStructure: '1-4-3-3', blockHeight: 'medio', pressType: 'zonal', pressOrientation: 'hacia fuera', coverage: 'coberturas cortas', depthControl: 'línea media',
      afterLoss: 'mixta', restDefense: '3+1', afterRecovery: 'ataque rápido', firstPass: 'fuera de zona de presión',
      cornerOf: 'segundo palo', cornerDef: 'mixto', freeKicks: 'jugada ensayada', throwIns: 'corto y conservar',
      notes: { ofensiva: '', defensiva: '', transAD: '', transDA: '', abp: '' }, identity: '', updatedAt: null, work: blankWork(),
    };
  }
  // Indicadores relevantes según el modelo (para evaluar coherencia)
  function modelRelevance(m) {
    const rel = {};
    const add = (k, w) => (rel[k] = (rel[k] || 0) + w);
    if (m.buildUp === 'corto') { add('salida', 1); add('progPresion', 1); }
    if (m.buildUp === 'mixto') { add('salida', 0.6); add('progPresion', 0.6); }
    if (m.buildUp === 'directo') { add('transOf', 0.5); add('abpOf', 0.3); }
    if (m.progression !== 'exterior') add('superioridades', 0.8);
    if (+m.width >= 4 || ['1-3-2-5', '1-2-3-5'].includes(m.attStructure)) add('ocupacion', 0.8);
    add('ataqueBloqueBajo', m.finishing === 'centros' ? 0.6 : 0.5);
    if (m.blockHeight === 'alto') { add('presionAlta', 1.2); add('transDef', 0.5); }
    if (m.blockHeight === 'medio') add('bloqueMedio', 1.1);
    if (m.blockHeight === 'bajo') { add('bloqueBajo', 1.2); add('transOf', 0.6); }
    if (m.afterLoss === 'presión inmediata') add('transDef', 1);
    if (m.afterLoss === 'mixta') add('transDef', 0.6);
    if (m.afterRecovery === 'contraataque') add('transOf', 1);
    if (m.afterRecovery === 'ataque rápido') add('transOf', 0.6);
    add('abpOf', 0.3); add('abpDef', 0.3);
    return rel;
  }

  /* ───────────── Generación de jugadores y equipos ───────────── */
  function genPlayer(r, pos, level, idx, usedNames) {
    const archList = ARCHETYPES[pos];
    const [archName, offs] = r.pick(archList);
    const attrs = {};
    for (const a of ALL_ATTRS) attrs[a] = level + r.normal() * 5;
    // sesgo por puesto: las claves de su puesto son algo más altas, compensado después
    for (const k of POS_KEYS[pos]) attrs[k] += 5;
    if (pos === 'POR') { attrs.regate -= 20; attrs.finalizacion -= 25; attrs.conduccion -= 15; attrs.superioridad -= 15; }
    for (const [k, v] of Object.entries(offs)) attrs[k] += v;
    // normalizar: la media global de atributos = nivel base → potencial idéntico entre equipos
    const mean = avg(ALL_ATTRS.map((a) => attrs[a]));
    for (const a of ALL_ATTRS) attrs[a] = Math.round(clamp(attrs[a] - mean + level, 22, 96));
    let name;
    do { name = r.pick(FIRST) + ' ' + r.pick(LAST); } while (usedNames.has(name));
    usedNames.add(name);
    const sec = POSITIONS[pos].sec.slice(0, r() < 0.5 ? 1 : 2);
    const heightBase = { POR: 188, DFC: 185, LD: 176, LI: 176, MCD: 180, MC: 177, MCO: 174, ED: 173, EI: 173, DC: 182 }[pos];
    return {
      id: 'p' + idx + '_' + Math.floor(r() * 1e9).toString(36),
      name, age: r.int(17, 33), pos, sec, foot: r() < 0.72 ? 'Derecha' : r() < 0.85 ? 'Izquierda' : 'Ambas',
      height: Math.round(heightBase + r.normal() * 5), profile: archName, attrs,
      fitness: 100, fatigue: r.int(0, 12), confidence: 60, form: [],
    };
  }
  function genSquad(seed, usedNames) {
    const r = makeRng('squad:' + seed);
    return SQUAD_TEMPLATE.map(([pos, level], i) => genPlayer(r, pos, level, i, usedNames));
  }
  function playerRating(p, pos) {
    pos = pos || p.pos;
    return Math.round(avg(POS_KEYS[pos].map((k) => p.attrs[k])));
  }
  function posFit(p, role) {
    if (p.pos === role) return 1;
    if (p.sec.includes(role)) return 0.93;
    if (POSITIONS[p.pos].line === POSITIONS[role].line) return 0.87;
    if (role === 'POR' || p.pos === 'POR') return 0.4;
    return 0.78;
  }
  function squadPotential(players) { return round1(avg(players.map((p) => avg(ALL_ATTRS.map((a) => p.attrs[a]))))); }
  function strengthsWeaknesses(p) {
    const list = ALL_ATTRS.map((a) => [a, p.attrs[a]]).sort((x, y) => y[1] - x[1]);
    return { top: list.slice(0, 3).map((x) => ATTR_LABEL[x[0]]), low: list.slice(-3).reverse().map((x) => ATTR_LABEL[x[0]]) };
  }

  function autoLineup(players, formation) {
    const slots = FORMATIONS[formation] || FORMATIONS['1-4-3-3'];
    const used = new Set();
    const avail = players.filter((p) => !p.injured);
    const res = [];
    // ordenar slots: primero los más específicos
    const order = slots.map((s, i) => i).sort((a, b) => (slots[a][0] === 'POR' ? -1 : 0) - (slots[b][0] === 'POR' ? -1 : 0));
    for (const i of order) {
      const role = slots[i][0];
      let best = null, bestScore = -1;
      for (const p of avail) {
        if (used.has(p.id)) continue;
        const sc = playerRating(p, role) * posFit(p, role) * (1 - p.fatigue / 300);
        if (sc > bestScore) { bestScore = sc; best = p; }
      }
      res[i] = best ? best.id : null; if (best) used.add(best.id);
    }
    const bench = avail.filter((p) => !used.has(p.id)).sort((a, b) => playerRating(b) - playerRating(a)).slice(0, 7).map((p) => p.id);
    return { formation, slots: res, bench };
  }

  /* ───────────── Calendario (método del círculo) ───────────── */
  function roundRobin(teamIds, double) {
    const ids = teamIds.slice();
    if (ids.length % 2) ids.push(null);
    const n = ids.length, rounds = [];
    let arr = ids.slice();
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
      rounds.push(pairs);
      arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
    }
    if (double) { const second = rounds.map((rd) => rd.map(([h, a]) => [a, h])); return rounds.concat(second); }
    return rounds;
  }

  /* ───────────── Evaluación metodológica ───────────── */
  function rangeScore(v, [lo, hi], tol) {
    if (v >= lo && v <= hi) return 1;
    const d = v < lo ? (lo - v) / (tol || lo) : (v - hi) / (tol || hi);
    return clamp(1 - d, 0, 1);
  }
  function taskPlayers(t) { return (+t.attackers || 0) + (+t.defenders || 0) + (+t.jokers || 0) + (+t.goalkeepers || 0); }
  function evaluateTask(t) {
    const obj = t.objective, prof = OBJ_PROFILE[obj], type = TASK_TYPES[t.type];
    if (!prof || !type) return { score: 0, factors: [], recs: ['Define un objetivo y una tipología.'], questions: [], minutes: 0 };
    const factors = [], recs = [], questions = [];
    const players = taskPlayers(t);
    const area = (+t.length || 0) * (+t.width || 0);
    const m2 = players ? area / players : 0;
    const minutes = (+t.duration || 0) * (+t.series || 1);
    const rules = t.rules || [];

    // 1. Respuesta al objetivo: afinidad de la tipología con el objetivo (depende del objetivo, no es universal)
    const aff = type.aff[obj] != null ? type.aff[obj] : AFF_DEFAULT;
    let ruleHits = rules.filter((k) => PROV[k] && PROV[k].ind.includes(obj));
    const f1 = clamp(aff * 0.75 + Math.min(ruleHits.length, 2) * 0.15, 0, 1);
    factors.push({ k: 'objetivo', label: 'Responde al objetivo', s: f1, reason: `La tipología «${type.label}» tiene una afinidad ${Math.round(aff * 100)}% con «${IND_LABEL[obj]}»${ruleHits.length ? ' y las reglas refuerzan el contenido' : ' y ninguna regla lo refuerza'}.` });
    if (aff < 0.5) questions.push(`¿Qué situaciones de «${IND_LABEL[obj]}» aparecerán realmente en un ${type.label.toLowerCase()}? ¿Con qué frecuencia?`);

    // 2. Número de jugadores
    const f2 = players ? rangeScore(players, prof.players, 6) : 0;
    factors.push({ k: 'jugadores', label: 'Número de jugadores', s: f2, reason: `${players} jugadores; el rango que suele favorecer este contenido es ${prof.players[0]}-${prof.players[1]}.` });
    if (f2 < 0.7) recs.push(players < prof.players[0] ? 'Con tan pocos jugadores es difícil que aparezcan las referencias colectivas del contenido.' : 'Hay demasiados jugadores para la cantidad de repeticiones individuales que buscas.');

    // 3. Espacio
    const f3 = m2 ? rangeScore(m2, prof.m2, 40) : 0;
    factors.push({ k: 'espacio', label: 'Espacio y dimensiones', s: f3, reason: m2 ? `${Math.round(m2)} m² por jugador (${t.length}×${t.width} m); rango orientativo ${prof.m2[0]}-${prof.m2[1]} m².` : 'No se han definido las dimensiones.' });
    if (m2 && m2 < prof.m2[0]) questions.push('Con ese espacio por jugador, ¿tendrán tiempo para percibir y decidir, o sólo habrá presión y pérdida?');
    if (m2 && m2 > prof.m2[1]) questions.push('Con tanto espacio, ¿se producirán las distancias y la presión que encontrarán en competición?');

    // 4. Reglas de provocación
    const f4 = clamp(0.3 + ruleHits.length * 0.35, 0, 1);
    factors.push({ k: 'reglas', label: 'Reglas que provocan la conducta', s: f4, reason: ruleHits.length ? `Reglas alineadas: ${ruleHits.map((k) => PROV[k].label).join(', ')}.` : 'Ninguna regla de provocación está vinculada al contenido.' });
    if (!ruleHits.length) questions.push(`¿Qué regla obliga a tus jugadores a repetir comportamientos de «${IND_LABEL[obj]}»?`);

    // 5. Repetición
    const f5 = rangeScore(minutes, prof.min, 10);
    factors.push({ k: 'repeticion', label: 'Repetición del contenido', s: f5, reason: `${minutes} min de trabajo útil (rango orientativo ${prof.min[0]}-${prof.min[1]}).` });
    if (minutes > prof.min[1]) recs.push('El volumen es alto: más minutos no siempre significan más aprendizaje y suman fatiga.');

    // 6. Representatividad
    let repr = type.repr;
    if (rules.includes('porteros')) repr += 0.12;
    if (t.direction === 'si') repr += 0.08;
    if (t.opposition === 'no') repr -= 0.25;
    repr = clamp(repr, 0, 1);
    const f6 = repr;
    factors.push({ k: 'representatividad', label: 'Representatividad', s: f6, reason: `Parecido con la competición: ${Math.round(repr * 100)}% (dirección de juego, oposición, porterías).` });
    if (repr < 0.5) questions.push('¿Qué información del partido real (porterías, dirección, rivales) falta en la tarea?');

    // Texto mínimo: consignas y criterios
    const textOk = (t.cues || '').trim().length > 10 && (t.success || '').trim().length > 5;
    if (!textOk) recs.push('Añade consignas y criterios de éxito observables: así podrás comprobar si la tarea funcionó.');

    const w = [0.25, 0.12, 0.15, 0.2, 0.12, 0.16];
    const fs = [f1, f2, f3, f4, f5, f6];
    let score = fs.reduce((s, f, i) => s + f * w[i], 0) * 100;
    if (!textOk) score *= 0.92;
    score = Math.round(score);
    if (!questions.length) questions.push('¿Cómo sabrás durante la tarea si los jugadores están interpretando la conducta que buscas?');
    return { score, factors, recs, questions, minutes, m2: Math.round(m2), players };
  }

  function evaluateSession(s) {
    const tasks = s.tasks || [];
    const evals = tasks.map(evaluateTask);
    const reasons = [];
    if (!tasks.length) return { score: s.type === 'Descanso' || /Recuperación/.test(s.type) ? 60 : 0, evals, reasons: ['Sesión sin tareas.'], load: load(s) };
    const aligned = tasks.filter((t) => t.objective === s.objective || (s.secondary || []).includes(t.objective)).length / tasks.length;
    reasons.push(`${Math.round(aligned * 100)}% de las tareas trabajan los objetivos de la sesión.`);
    // progresión: complejidad (jugadores) no decreciente en general
    let prog = 1;
    for (let i = 1; i < tasks.length; i++) if (taskPlayers(tasks[i]) < taskPlayers(tasks[i - 1]) - 4) prog -= 0.25;
    prog = clamp(prog, 0, 1);
    reasons.push(prog >= 0.9 ? 'Los contenidos progresan de menor a mayor complejidad.' : 'La complejidad de las tareas no progresa: valora ordenar de lo analítico a lo global.');
    const sumMin = tasks.reduce((x, t) => x + (+t.duration || 0) * (+t.series || 1) + (+t.pause || 0) * Math.max(0, (+t.series || 1) - 1), 0);
    const fitDur = rangeScore(sumMin, [s.duration * 0.55, s.duration * 0.95], 20);
    reasons.push(`${sumMin} min de tareas en una sesión de ${s.duration} min.`);
    const tq = avg(evals.map((e) => e.score)) / 100;
    const score = Math.round((tq * 0.5 + aligned * 0.25 + prog * 0.15 + fitDur * 0.1) * 100);
    return { score, evals, reasons, load: load(s), aligned, prog };
  }
  function load(s) { return Math.round((+s.duration || 0) * (+s.intensity || 0)); }

  // Evalúa el microciclo completo. El último día de la lista es la víspera del partido.
  function evaluateMicrocycle(micro, model, ctx) {
    ctx = ctx || {};
    const sessions = (micro && micro.sessions) || [];
    const required = ctx.sessionsRequired || 4;
    const evals = sessions.map(evaluateSession);
    const criteria = [];
    const rel = modelRelevance(model || defaultModel());
    const mains = sessions.filter((s) => s.type !== 'Descanso').map((s) => s.objective).filter(Boolean);
    // 1. coherencia de objetivos con el modelo y el rival
    const relSum = mains.reduce((x, o) => x + Math.min(1, rel[o] || 0.15), 0);
    const coh = mains.length ? clamp(relSum / mains.length, 0, 1) : 0;
    const rivalLinks = sessions.filter((s) => (s.rivalLink || '').trim().length > 8).length;
    const cohS = clamp(coh * 0.75 + Math.min(rivalLinks, 2) * 0.125, 0, 1);
    criteria.push({ k: 'objetivos', label: 'Coherencia de objetivos', max: 5, s: cohS, reason: `${Math.round(coh * 100)}% de los objetivos principales se relacionan con tu modelo de juego; ${rivalLinks} sesiones justifican su relación con el rival.` });
    // 2. distribución de contenidos
    const distinct = new Set(mains).size;
    const countSess = sessions.length;
    let dist = clamp(distinct / Math.max(2, Math.min(4, mains.length)), 0, 1);
    if (countSess < required) dist *= countSess / required;
    criteria.push({ k: 'distribucion', label: 'Distribución de contenidos', max: 5, s: dist, reason: `${distinct} contenidos principales distintos en ${countSess} sesiones (el profesor pide ${required}).` });
    // 3. adecuación de tareas
    const allTaskEvals = evals.flatMap((e) => e.evals);
    const tq = allTaskEvals.length ? avg(allTaskEvals.map((e) => e.score)) / 100 : 0;
    criteria.push({ k: 'tareas', label: 'Adecuación de tareas', max: 5, s: tq, reason: `${allTaskEvals.length} tareas con una valoración media de ${Math.round(tq * 100)}/100.` });
    // 4. gestión de cargas
    const loads = sessions.map(load);
    const total = loads.reduce((x, y) => x + y, 0);
    const lastI = sessions.length ? +sessions[sessions.length - 1].intensity : 0;
    const firstI = sessions.length ? +sessions[0].intensity : 0;
    const peak = loads.indexOf(Math.max(...loads, 0));
    let ld = 1; const ldR = [];
    if (lastI > 5) { ld -= 0.35; ldR.push('la víspera del partido tiene intensidad alta'); }
    if (firstI > 6 && ctx.afterMatch !== false) { ld -= 0.2; ldR.push('la primera sesión tras el partido no favorece la recuperación'); }
    const ideal = required * 340;
    if (total > ideal * 1.35) { ld -= 0.3; ldR.push('la carga total es excesiva'); }
    if (total < ideal * 0.5) { ld -= 0.2; ldR.push('la carga total es muy baja'); }
    if (sessions.length >= 3 && (peak === 0 || peak === sessions.length - 1)) { ld -= 0.15; ldR.push('el pico de carga no está en mitad de semana'); }
    ld = clamp(ld, 0, 1);
    criteria.push({ k: 'cargas', label: 'Gestión de cargas', max: 5, s: ld, reason: ldR.length ? 'Atención: ' + ldR.join('; ') + '.' : 'Distribución de cargas adecuada: recuperación, pico a mitad de semana y activación previa.' });
    // 5. transferencia a la competición
    const repr = allTaskEvals.length ? avg(allTaskEvals.map((e) => e.factors.find((f) => f.k === 'representatividad').s)) : 0;
    criteria.push({ k: 'transferencia', label: 'Transferencia a la competición', max: 5, s: repr, reason: `Representatividad media de las tareas: ${Math.round(repr * 100)}%.` });
    const score = criteria.reduce((x, c) => x + c.s * c.max, 0); // sobre 25
    const fatigueLoad = total / Math.max(1, ideal); // 1 = normal
    return { score25: round1(score), score100: Math.round(score * 4), criteria, sessions: evals, totalLoad: total, fatigueLoad };
  }

  /* ───────────── Aprendizaje del equipo ───────────── */
  // Devuelve indicadores nuevos y un registro explicable de cada cambio.
  function computeLearning(indicators, micro, microEval) {
    const stim = {}, sources = {};
    (micro.sessions || []).forEach((s, si) => {
      (s.tasks || []).forEach((t, ti) => {
        const e = microEval.sessions[si] && microEval.sessions[si].evals[ti];
        if (!e || !t.objective) return;
        const q = e.score / 100;
        const aff = (TASK_TYPES[t.type] && TASK_TYPES[t.type].aff[t.objective]) || AFF_DEFAULT;
        const minutes = Math.min(e.minutes, 30);
        const s1 = q * (minutes / 25) * (0.5 + aff * 0.5);
        stim[t.objective] = (stim[t.objective] || 0) + s1;
        (sources[t.objective] = sources[t.objective] || []).push(`${s.day}: ${t.name || 'tarea'} (${e.score}/100)`);
        // las reglas que tocan otros contenidos dan un estímulo secundario menor
        for (const rk of t.rules || []) for (const ind of (PROV[rk] && PROV[rk].ind) || []) if (ind !== t.objective) stim[ind] = (stim[ind] || 0) + s1 * 0.15;
      });
    });
    const coh = 0.55 + 0.45 * (microEval.score100 / 100);
    let fatiguePenalty = 1;
    if (microEval.fatigueLoad > 1.35) fatiguePenalty = clamp(1 - (microEval.fatigueLoad - 1.35), 0.5, 1);
    const out = {}, log = [];
    for (const [k] of INDICATORS) {
      const cur = indicators[k] != null ? indicators[k] : IND_START;
      const S = stim[k] || 0;
      let delta;
      if (S > 0) {
        // saturación: acumular estímulos tiene rendimientos decrecientes; techo semanal ~7 puntos
        delta = 8 * (1 - Math.exp(-S / 1.1)) * (1 - cur / 110) * coh * fatiguePenalty;
      } else {
        delta = cur > IND_START - 5 ? -1 : 0; // lo no entrenado se pierde ligeramente
      }
      const nv = round1(clamp(cur + delta, 10, 95));
      out[k] = nv;
      if (Math.abs(nv - cur) >= 0.1) log.push({ k, from: cur, to: nv, delta: round1(nv - cur), sources: sources[k] || [] });
    }
    return { indicators: out, log, coherenceFactor: round1(coh), fatiguePenalty: round1(fatiguePenalty) };
  }

  /* ───────────── Evaluación del plan de partido ───────────── */
  function textLen(s) { return (s || '').trim().length; }
  function evaluatePlan(plan, model, micro, team) {
    const crit = [];
    const sec = (k) => textLen(plan.sections && plan.sections[k]);
    const a = clamp((sec('fortalezas') + sec('debilidades') + sec('amenazas')) / 240, 0, 1);
    crit.push({ k: 'rival', label: 'Interpretación del rival', max: 5, s: a, reason: a > 0.7 ? 'Analiza fortalezas, debilidades y amenazas.' : 'El análisis del rival es breve: concreta fortalezas, debilidades y amenazas.' });
    const b = clamp((sec('objetivos') + sec('espacios')) / 160, 0, 1);
    crit.push({ k: 'objetivos', label: 'Objetivos tácticos', max: 5, s: b, reason: b > 0.7 ? 'Objetivos y espacios a ocupar definidos.' : 'Define qué quieres conseguir y qué espacios ocupar.' });
    const c = clamp((sec('ofensivo') / 150) * 0.8 + (plan.tactics.attStructure ? 0.2 : 0), 0, 1);
    crit.push({ k: 'ofensiva', label: 'Coherencia ofensiva', max: 5, s: c, reason: 'Plan ofensivo: ' + (c > 0.7 ? 'salida, progresión y finalización descritas.' : 'faltan detalles de salida, progresión o finalización.') });
    const d = clamp((sec('defensivo') / 150) * 0.8 + (plan.tactics.blockHeight ? 0.2 : 0), 0, 1);
    crit.push({ k: 'defensiva', label: 'Coherencia defensiva', max: 5, s: d, reason: 'Plan defensivo: ' + (d > 0.7 ? 'bloque, presión y ajustes descritos.' : 'concreta la altura del bloque, la presión y los ajustes.') });
    const conds = (plan.conditions || []).filter((x) => x.action);
    const e = clamp(conds.length * 0.2 + (sec('escenarios') / 200) * 0.6, 0, 1);
    crit.push({ k: 'alternativas', label: 'Alternativas estratégicas', max: 5, s: e, reason: `${conds.length} instrucciones condicionales y escenarios ${sec('escenarios') > 80 ? 'descritos' : 'poco desarrollados'}.` });
    return { score25: round1(crit.reduce((x, y) => x + y.s * y.max, 0)), criteria: crit };
  }
  function evaluateCoherence(plan, model, micro, team, microEval) {
    const crit = [];
    const rel = modelRelevance(model);
    const mains = (micro.sessions || []).map((s) => s.objective).filter(Boolean);
    const m1 = mains.length ? clamp(mains.reduce((x, o) => x + Math.min(1, rel[o] || 0.15), 0) / mains.length, 0, 1) : 0;
    crit.push({ k: 'entreno_modelo', label: 'Entrenamiento ↔ modelo de juego', max: 6, s: m1, reason: `${Math.round(m1 * 100)}% de afinidad entre los contenidos de la semana y el modelo.` });
    const planRel = modelRelevance(Object.assign({}, model, plan.tactics));
    const m2 = mains.length ? clamp(mains.reduce((x, o) => x + Math.min(1, planRel[o] || 0.15), 0) / mains.length, 0, 1) : 0;
    const linked = (plan.linkedSessions || []).length;
    const m2b = clamp(m2 * 0.7 + Math.min(linked, 3) * 0.1, 0, 1);
    crit.push({ k: 'entreno_plan', label: 'Entrenamiento ↔ plan de partido', max: 6, s: m2b, reason: `${linked} sesiones vinculadas en el apartado H; afinidad ${Math.round(m2 * 100)}% con las decisiones del plan.` });
    // adecuación a los jugadores
    const players = team.players;
    const press = avg(players.map((p) => (p.attrs.velocidad + p.attrs.repetir + p.attrs.resistencia) / 3));
    const build = avg(players.filter((p) => ['DFC', 'MCD', 'MC', 'POR'].includes(p.pos)).map((p) => (p.attrs.pase + p.attrs.control + p.attrs.percepcion) / 3));
    let fit = 1; const fr = [];
    if (plan.tactics.blockHeight === 'alto' && press < 60) { fit -= 0.3; fr.push('la presión alta exige un perfil físico que la plantilla no tiene de forma general'); }
    if (plan.tactics.buildUp === 'corto' && build < 60) { fit -= 0.3; fr.push('la salida en corto exige más calidad técnica en defensa y medio'); }
    crit.push({ k: 'jugadores', label: 'Adecuación a los jugadores', max: 4, s: clamp(fit, 0, 1), reason: fr.length ? 'Riesgo: ' + fr.join('; ') + '.' : 'Las decisiones se ajustan al perfil de la plantilla.' });
    const just = clamp((textLen(plan.sections && plan.sections.relacion) + textLen(micro.justification)) / 220, 0, 1);
    crit.push({ k: 'justificacion', label: 'Justificación de decisiones', max: 4, s: just, reason: just > 0.7 ? 'Decisiones justificadas por escrito.' : 'Justifica más por qué has organizado así la semana y el plan.' });
    return { score20: round1(crit.reduce((x, y) => x + y.s * y.max, 0)), criteria: crit };
  }
  // Coherencia contextual de una instrucción condicional (no depende del resultado posterior)
  const COND_ACTIONS = {
    presion_alta: { label: 'Adelantar bloque y presionar alto', fits: ['perdiendo', 'empatando'] },
    bloque_bajo: { label: 'Bajar el bloque y proteger el área', fits: ['ganando'] },
    mas_riesgo: { label: 'Asumir más riesgo en ataque', fits: ['perdiendo'] },
    menos_riesgo: { label: 'Reducir riesgos', fits: ['ganando'] },
    conservar: { label: 'Conservar el balón y pausar', fits: ['ganando', 'empatando'] },
    contraataque: { label: 'Esperar y buscar contraataque', fits: ['ganando', 'empatando'] },
    bandas: { label: 'Atacar por bandas (más amplitud)', fits: ['perdiendo', 'empatando'] },
    dentro: { label: 'Atacar por dentro', fits: ['perdiendo', 'empatando'] },
    directo: { label: 'Juego directo', fits: ['perdiendo'] },
    sub: { label: 'Sustitución', fits: ['perdiendo', 'ganando', 'empatando', 'siempre'] },
  };
  const COND_WHEN = { perdiendo: 'Si vamos perdiendo', ganando: 'Si vamos ganando', empatando: 'Si vamos empatando', siempre: 'En cualquier caso' };
  function evaluateAdaptation(plan, matchLog) {
    const conds = (plan.conditions || []).filter((c) => c.action);
    const crit = [];
    const logic = conds.length ? avg(conds.map((c) => (COND_ACTIONS[c.action] && COND_ACTIONS[c.action].fits.includes(c.when) ? 1 : 0.45))) : 0;
    crit.push({ k: 'problemas', label: 'Interpretación de problemas', max: 5, s: clamp(textLen(plan.sections && plan.sections.escenarios) / 160, 0, 1), reason: 'Anticipa escenarios de partido por escrito.' });
    crit.push({ k: 'ajustes', label: 'Ajustes adecuados', max: 5, s: logic, reason: conds.length ? `Lógica contextual de las instrucciones: ${Math.round(logic * 100)}% (se valora la lógica, no el resultado posterior).` : 'No hay instrucciones condicionales.' });
    const covered = new Set(conds.map((c) => c.when));
    const resp = clamp(covered.size / 2, 0, 1);
    crit.push({ k: 'respuesta', label: 'Capacidad de respuesta', max: 5, s: resp, reason: `Contempla ${covered.size} escenarios de marcador distintos.` });
    const triggered = (matchLog || []).length;
    const ctxS = conds.length ? clamp(0.6 + Math.min(triggered, 2) * 0.2, 0, 1) : 0;
    crit.push({ k: 'contexto', label: 'Coherencia contextual', max: 5, s: ctxS, reason: triggered ? `${triggered} instrucciones se activaron durante el partido.` : 'Ninguna instrucción llegó a activarse (no penaliza si eran coherentes).' });
    return { score20: round1(crit.reduce((x, y) => x + y.s * y.max, 0)), criteria: crit };
  }
  function evaluateReflection(text) {
    const t = (text || '').toLowerCase();
    const len = t.trim().length;
    const keys = ['porque', 'mejorar', 'error', 'presión', 'salida', 'transición', 'bloque', 'entren', 'tarea', 'xg', 'ocasion', 'ocasión', 'pérdida', 'próxima', 'cambiar'];
    const hits = keys.filter((k) => t.includes(k)).length;
    const crit = [
      { k: 'autocritica', label: 'Autocrítica', max: 2.5, s: clamp(len / 300, 0, 1), reason: `${len} caracteres de reflexión.` },
      { k: 'problemas', label: 'Identificación de problemas', max: 2.5, s: clamp(hits / 4, 0, 1), reason: `Menciona ${hits} conceptos tácticos o metodológicos.` },
      { k: 'propuestas', label: 'Propuestas de mejora', max: 2.5, s: /mejor|próxim|trabajar|cambiar/.test(t) ? 1 : 0.2, reason: 'Busca propuestas explícitas para la próxima semana.' },
      { k: 'argumentacion', label: 'Argumentación', max: 2.5, s: /porque|ya que|debido|por eso/.test(t) ? clamp(len / 400, 0.4, 1) : 0.2, reason: 'Valora si se razonan las causas.' },
    ];
    return { score10: round1(crit.reduce((x, y) => x + y.s * y.max, 0)), criteria: crit };
  }

  /* ───────────── Simulador de partidos ───────────── */
  const DEFAULT_WEIGHTS = { seqBase: 46, variance: 1, homeAdv: 0.015, indicatorWeight: 0.85, tacticWeight: 1, fatigueWeight: 1 };

  function tacticsFrom(model, plan) {
    const t = Object.assign({}, model, (plan && plan.tactics) || {});
    return {
      formation: (plan && plan.lineup && plan.lineup.formation) || t.defStructure || '1-4-3-3',
      attStructure: t.attStructure || '1-4-3-3', buildUp: t.buildUp || 'mixto', width: +t.width || 3, tempo: t.tempo || 'medio',
      progression: t.progression || 'mixta', blockHeight: t.blockHeight || 'medio', pressType: t.pressType || 'zonal',
      pressOrientation: t.pressOrientation || 'hacia fuera', afterLoss: t.afterLoss || 'mixta', afterRecovery: t.afterRecovery || 'ataque rápido',
      risk: +t.risk || 3, finishing: t.finishing || 'juego interior',
    };
  }

  function buildSide(team, snap, key) {
    const players = snap.players || team.players;
    const byId = Object.fromEntries(players.map((p) => [p.id, p]));
    const lineup = snap.lineup;
    const slots = FORMATIONS[lineup.formation] || FORMATIONS['1-4-3-3'];
    const onPitch = lineup.slots.map((id, i) => ({ p: byId[id], role: slots[i][0], hx: slots[i][1], hy: slots[i][2] })).filter((x) => x.p);
    const side = {
      key, teamId: team.id, name: team.name, short: team.short, color: team.color,
      tactics: tacticsFrom(snap.model, snap.plan), ind: Object.assign({}, snap.indicators),
      onPitch, bench: (lineup.bench || []).map((id) => byId[id]).filter(Boolean),
      energy: {}, conditions: ((snap.plan && snap.plan.conditions) || []).filter((c) => c.action).map((c) => Object.assign({ fired: false }, c)),
      byId,
    };
    for (const x of onPitch) side.energy[x.p.id] = clamp(100 - (x.p.fatigue || 0) * 0.6, 40, 100);
    for (const p of side.bench) side.energy[p.id] = clamp(100 - (p.fatigue || 0) * 0.6, 40, 100);
    return side;
  }
  function eff(side, x, attr) {
    const e = side.energy[x.p.id] / 100;
    const fit = posFit(x.p, x.role);
    return x.p.attrs[attr] * fit * (0.8 + 0.2 * e) * (0.97 + (x.p.confidence || 60) / 2000);
  }
  function lineAvg(side, lines, attrs) {
    const xs = side.onPitch.filter((x) => lines.includes(POSITIONS[x.role].line));
    if (!xs.length) return 40;
    return avg(xs.map((x) => avg(attrs.map((a) => eff(side, x, a)))));
  }
  function ratings(side) {
    return {
      gk: lineAvg(side, ['gk'], ['agilidad', 'anticipacion', 'concentracion', 'percepcion', 'aereo']),
      def: lineAvg(side, ['def'], ['entrada', 'intDefensiva', 'anticipacion', 'aereo', 'fuerza', 'concentracion']),
      build: lineAvg(side, ['def', 'mid'], ['pase', 'control', 'orientacion', 'percepcion', 'decisiones']),
      mid: lineAvg(side, ['mid'], ['pase', 'control', 'decisiones', 'asociacion', 'espacios', 'ocupacion']),
      att: lineAvg(side, ['att', 'mid'], ['finalizacion', 'regate', 'conduccion', 'superioridad', 'aceleracion', 'espacios']),
      press: lineAvg(side, ['def', 'mid', 'att'], ['velocidad', 'repetir', 'resistencia', 'competitividad', 'anticipacion', 'colectivo']),
      pace: lineAvg(side, ['att'], ['velocidad', 'aceleracion']),
      defPace: lineAvg(side, ['def'], ['velocidad', 'aceleracion']),
      aerial: lineAvg(side, ['def', 'att'], ['aereo', 'fuerza']),
    };
  }
  function pickPlayer(r, side, lines, attr) {
    const xs = side.onPitch.filter((x) => lines.includes(POSITIONS[x.role].line));
    const pool = xs.length ? xs : side.onPitch;
    const ws = pool.map((x) => Math.pow(Math.max(1, x.p.attrs[attr || 'decisiones']), 2));
    let t = r() * ws.reduce((s, w) => s + w, 0);
    for (let i = 0; i < pool.length; i++) { t -= ws[i]; if (t <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  const pressLevel = (t) => ({ alto: 1, medio: 0.5, bajo: 0.15 }[t.blockHeight] * (t.pressType === 'al hombre' ? 1.1 : 1));

  function applyCondition(side, c, minute, score, log) {
    const t = side.tactics;
    const before = JSON.stringify(t);
    switch (c.action) {
      case 'presion_alta': t.blockHeight = 'alto'; t.afterLoss = 'presión inmediata'; break;
      case 'bloque_bajo': t.blockHeight = 'bajo'; t.afterRecovery = 'contraataque'; break;
      case 'mas_riesgo': t.risk = Math.min(5, t.risk + 2); t.tempo = 'alto'; break;
      case 'menos_riesgo': t.risk = Math.max(1, t.risk - 2); break;
      case 'conservar': t.tempo = 'pausado'; t.afterRecovery = 'conservación'; t.risk = Math.max(1, t.risk - 1); break;
      case 'contraataque': t.blockHeight = 'bajo'; t.afterRecovery = 'contraataque'; break;
      case 'bandas': t.progression = 'exterior'; t.width = 5; break;
      case 'dentro': t.progression = 'interior'; t.width = Math.max(2, t.width - 1); break;
      case 'directo': t.buildUp = 'directo'; break;
      case 'sub': {
        const idx = side.onPitch.findIndex((x) => x.p.id === c.out);
        const inP = side.bench.find((p) => p.id === c.in);
        if (idx >= 0 && inP) { const role = side.onPitch[idx].role; const outP = side.onPitch[idx].p; side.onPitch[idx] = Object.assign({}, side.onPitch[idx], { p: inP }); side.bench = side.bench.filter((p) => p.id !== inP.id); side.subs = (side.subs || []).concat([{ min: minute, out: outP.id, in: inP.id, role }]); }
        else return false;
        break;
      }
      default: return false;
    }
    log.push({ min: minute, team: side.key, action: c.action, when: c.when, label: COND_ACTIONS[c.action].label, score: score.slice(), changed: before !== JSON.stringify(t) || c.action === 'sub' });
    return true;
  }

  // Simula un partido completo. Entradas: snapshots bloqueados de ambos equipos.
  function simulateMatch(input) {
    const W = Object.assign({}, DEFAULT_WEIGHTS, input.weights || {});
    const r = makeRng(input.seed);
    const H = buildSide(input.home.team, input.home.snap, 'h');
    const A = buildSide(input.away.team, input.away.snap, 'a');
    const sides = { h: H, a: A };
    const other = (k) => (k === 'h' ? A : H);
    const score = [0, 0];
    const sequences = [], decisions = [], tally = { h: {}, a: {} };
    const pStats = {};
    const bump = (side, k, v) => (tally[side.key][k] = (tally[side.key][k] || 0) + (v == null ? 1 : v));
    const pAdd = (pl, k, v) => { if (!pl) return; const s = (pStats[pl.p.id] = pStats[pl.p.id] || { r: 0, g: 0, sh: 0, rec: 0, loss: 0, inv: 0 }); s[k] = (s[k] || 0) + (v == null ? 1 : v); };
    const matchupNotes = {};
    const note = (k, side, ok) => { const m = (matchupNotes[k] = matchupNotes[k] || { h: [0, 0], a: [0, 0] }); m[side][0] += ok ? 1 : 0; m[side][1] += 1; };

    const total = (input.minutes || 90) * 60;
    let t = 0, possession = r() < 0.5 ? 'h' : 'a', startZone = 'baja', counterFlag = false;
    const tmod = (side) => ({ pausado: 1.25, medio: 1, alto: 0.8 }[side.tactics.tempo]);
    const indW = W.indicatorWeight, tw = W.tacticWeight;
    const iv = (side, k) => 50 + (side.ind[k] - 50) * indW; // indicador ponderado
    const noise = () => r.normal() * 0.04 * W.variance;

    while (t < total) {
      const att = sides[possession], def = other(possession);
      const minute = Math.min(90, Math.floor(t / 60) + 1);
      // instrucciones condicionales
      for (const s of [H, A]) {
        const my = s.key === 'h' ? score[0] - score[1] : score[1] - score[0];
        const state = my > 0 ? 'ganando' : my < 0 ? 'perdiendo' : 'empatando';
        for (const c of s.conditions) if (!c.fired && minute >= (+c.from || 0) && (c.when === state || c.when === 'siempre')) { c.fired = true; applyCondition(s, c, minute, score, decisions); }
      }
      const RA = ratings(att), RD = ratings(def);
      const homeAdv = att.key === 'h' ? W.homeAdv : -W.homeAdv;
      const seq = { t0: t, min: minute, team: att.key, start: startZone, steps: [], counter: counterFlag };
      const P = pressLevel(def.tactics) * tw;
      let zone = startZone, outcome = null, nextStart = 'baja', nextCounter = false;
      const at = att.tactics, dt = def.tactics;
      const riskF = (at.risk - 3) * 0.035;
      const struct = ATT_STRUCTURES[at.attStructure] || ATT_STRUCTURES['1-4-3-3'];
      const press = (pl) => pl; // marcador de legibilidad

      // Contraataque inmediato tras recuperación
      if (counterFlag) {
        const spaceBehind = (startZone === 'alta' ? 0.12 : startZone === 'baja' ? -0.08 : 0) + ({ alto: 0.1, medio: 0.04, bajo: -0.06 }[dt.blockHeight]) + (dt.afterLoss === 'repliegue' ? -0.1 : dt.afterLoss === 'presión inmediata' ? 0.04 : 0);
        const restD = { '2+1': 0.05, '3+1': 0, '3+2': -0.06 }[def.tactics.restDefense || '3+1'] || 0;
        const pc = clamp(0.24 + (iv(att, 'transOf') - iv(def, 'transDef')) / 220 + (RA.pace - RD.defPace) / 260 + spaceBehind * tw + restD + noise(), 0.08, 0.7);
        const pl = pickPlayer(r, att, ['att', 'mid'], 'velocidad');
        const ok = r() < pc;
        note('transicion', att.key, ok);
        seq.steps.push({ k: 'contra', ok, x: 55, y: 30 + r() * 40, p: pl.p.id });
        if (ok) { bump(att, 'counters'); zone = 'chance-contra'; } else { outcome = 'loss'; nextStart = 'media'; bump(att, 'losses'); pAdd(pl, 'loss'); bump(def, 'recoveries'); }
      }

      // 1. Inicio / salida de balón
      if (!outcome && zone === 'baja') {
        if (at.buildUp === 'directo') {
          const pl = pickPlayer(r, att, ['att'], 'aereo');
          const pd = clamp(0.38 + (RA.aerial - RD.aerial) / 200 + (RA.att - RD.def) / 300 + noise(), 0.2, 0.7);
          const ok = r() < pd;
          note('directo', att.key, ok);
          seq.steps.push({ k: 'directo', ok, x: 62, y: 25 + r() * 50, p: pl.p.id });
          if (ok) { if (r() < 0.45) { zone = 'final'; bump(att, 'entries'); } else zone = 'media'; } else { outcome = 'loss'; nextStart = 'media'; bump(att, 'losses'); bump(def, 'recoveries'); }
        } else {
          const skill = RA.build * 0.5 + iv(att, 'salida') * 0.3 + iv(att, 'progPresion') * 0.2;
          const opp = RD.press * 0.5 + iv(def, 'presionAlta') * 0.5;
          const orient = (dt.pressOrientation === 'hacia dentro' && at.progression === 'exterior') || (dt.pressOrientation === 'hacia fuera' && at.progression === 'interior') ? 0.03 : -0.02;
          const p1 = clamp(0.9 - P * (0.34 - (skill - opp) / 140) + (at.buildUp === 'corto' ? -0.02 : 0) + orient + homeAdv + noise(), 0.35, 0.97);
          const pl = pickPlayer(r, att, ['def', 'gk'], 'pase');
          const ok = r() < p1;
          if (P > 0.4) note('salida_vs_presion', att.key, ok);
          seq.steps.push({ k: 'salida', ok, x: 22, y: 20 + r() * 60, p: pl.p.id, press: P > 0.6 });
          if (ok) { zone = 'media'; pAdd(pl, 'inv'); }
          else {
            outcome = 'loss'; nextStart = 'alta'; nextCounter = true; bump(att, 'losses'); pAdd(pl, 'loss');
            bump(def, 'recoveries'); if (P > 0.4) bump(def, 'highRecoveries'); pAdd(pickPlayer(r, def, ['att', 'mid'], 'anticipacion'), 'rec');
          }
          if (P > 0.4) bump(def, 'pressActions');
        }
      }
      if (!outcome && zone === 'alta') zone = 'final';
      // 2. Progresión
      if (!outcome && zone === 'media') {
        const prog = RA.mid * 0.45 + iv(att, 'superioridades') * 0.2 + iv(att, 'ocupacion') * 0.15 * (0.6 + struct.occupation * 0.5) + iv(att, 'progPresion') * 0.2;
        const blockInd = dt.blockHeight === 'alto' ? iv(def, 'presionAlta') : dt.blockHeight === 'medio' ? iv(def, 'bloqueMedio') : iv(def, 'bloqueBajo');
        const blk = RD.def * 0.3 + RD.mid * 0.2 + blockInd * 0.35 + RD.press * 0.15;
        const base = { alto: 0.58, medio: 0.56, bajo: 0.74 }[dt.blockHeight];
        let p2 = base + (prog - blk) / 120 - riskF * 0.6 + (at.tempo === 'alto' ? -0.03 : at.tempo === 'pausado' ? 0.03 : 0) + homeAdv + noise();
        // estructuras: 5 defensores reducen la progresión exterior; orientación hacia dentro reduce la interior
        const fiveBack = (def.tactics.formation || '').startsWith('1-5');
        if (at.progression === 'exterior' && fiveBack) p2 -= 0.04 * tw;
        if (at.progression === 'interior' && dt.pressOrientation === 'hacia dentro') p2 -= 0.04 * tw;
        if (at.progression === 'interior' && dt.pressOrientation === 'hacia fuera') p2 += 0.02 * tw;
        p2 = clamp(p2, 0.25, 0.9);
        const pl = pickPlayer(r, att, ['mid'], 'pase');
        const ok = r() < p2;
        note('progresion', att.key, ok);
        seq.steps.push({ k: 'progresion', ok, x: 50, y: at.progression === 'exterior' ? (r() < 0.5 ? 12 : 88) : 35 + r() * 30, p: pl.p.id });
        if (ok) { zone = 'final'; bump(att, 'entries'); pAdd(pl, 'inv'); }
        else {
          // reacción tras pérdida del atacante
          bump(att, 'losses'); pAdd(pl, 'loss');
          const react = at.afterLoss === 'presión inmediata' ? 1 : at.afterLoss === 'mixta' ? 0.5 : 0;
          const pr = clamp((0.1 + (iv(att, 'transDef') - iv(def, 'transOf')) / 300 + (RA.press - RD.build) / 400) * react * tw + noise() * 0.5, 0, 0.45);
          if (react && r() < pr) {
            seq.steps.push({ k: 'presion_tras_perdida', ok: true, x: 52, y: 30 + r() * 40, p: pickPlayer(r, att, ['mid', 'att'], 'competitividad').p.id });
            bump(att, 'recoveries'); bump(att, 'highRecoveries'); bump(att, 'pressActions'); note('tras_perdida', att.key, true);
            zone = r() < 0.5 ? 'final' : 'media-out';
            if (zone === 'final') bump(att, 'entries');
          } else {
            if (react) { note('tras_perdida', att.key, false); bump(att, 'pressActions'); }
            outcome = 'loss'; nextStart = 'media'; nextCounter = def.tactics.afterRecovery !== 'conservación' && r() < (def.tactics.afterRecovery === 'contraataque' ? 0.6 : 0.4);
            bump(def, 'recoveries'); pAdd(pickPlayer(r, def, ['mid', 'def'], 'anticipacion'), 'rec');
          }
        }
        if (zone === 'media-out') { outcome = 'reset'; nextStart = 'media'; zone = null; }
      }
      // 3. Creación y finalización
      let chanceType = null;
      if (!outcome && zone === 'chance-contra') chanceType = 'contraataque';
      if (!outcome && zone === 'final') {
        const vsLow = dt.blockHeight === 'bajo';
        const create = RA.att * 0.45 + RA.mid * 0.15 + (vsLow ? iv(att, 'ataqueBloqueBajo') : iv(att, 'superioridades')) * 0.3 + iv(att, 'ocupacion') * 0.1;
        const box = RD.def * 0.5 + RD.gk * 0.1 + (vsLow ? iv(def, 'bloqueBajo') : iv(def, 'bloqueMedio')) * 0.4;
        let p3 = 0.25 + (create - box) / 160 + riskF + (struct.width - 0.7) * 0.08 + homeAdv + noise();
        if (vsLow) p3 -= 0.05;
        p3 = clamp(p3, 0.1, 0.62);
        const pl = pickPlayer(r, att, ['att', 'mid'], 'superioridad');
        const ok = r() < p3;
        note('creacion', att.key, ok);
        seq.steps.push({ k: 'creacion', ok, x: 78, y: at.progression === 'exterior' ? (r() < 0.5 ? 15 : 85) : 30 + r() * 40, p: pl.p.id });
        if (ok) {
          pAdd(pl, 'inv');
          chanceType = dt.blockHeight === 'alto' && r() < 0.45 ? 'profundidad' : at.finishing === 'centros' || at.progression === 'exterior' ? 'centro' : at.finishing === 'llegada de segunda línea' ? 'segunda' : 'interior';
        } else {
          const roll = r();
          if (roll < 0.28) chanceType = 'corner';
          else if (roll < 0.43) chanceType = 'lejano';
          else { outcome = 'loss'; nextStart = 'baja'; nextCounter = def.tactics.afterRecovery === 'contraataque' && r() < 0.5; bump(att, 'losses'); bump(def, 'recoveries'); pAdd(pickPlayer(r, def, ['def'], 'intDefensiva'), 'rec'); }
        }
      }
      if (!outcome && chanceType === 'corner') {
        bump(att, 'corners');
        const pc = clamp(0.3 + (iv(att, 'abpOf') - iv(def, 'abpDef')) / 200 + (RA.aerial - RD.aerial) / 250, 0.1, 0.55);
        seq.steps.push({ k: 'corner', ok: true, x: 99, y: r() < 0.5 ? 1 : 99 });
        if (r() < pc) chanceType = 'abp'; else { outcome = 'loss'; nextStart = 'baja'; chanceType = null; bump(def, 'recoveries'); }
      }
      if (!outcome && chanceType) {
        const base = { contraataque: 0.16, profundidad: 0.17, centro: 0.09, interior: 0.14, segunda: 0.11, lejano: 0.035, abp: 0.07 }[chanceType];
        const lines = chanceType === 'abp' || chanceType === 'centro' ? ['att', 'def'] : chanceType === 'segunda' || chanceType === 'lejano' ? ['mid', 'att'] : ['att'];
        const shooter = pickPlayer(r, att, lines, chanceType === 'abp' || chanceType === 'centro' ? 'aereo' : 'finalizacion');
        const fin = chanceType === 'abp' || chanceType === 'centro' ? (eff(att, shooter, 'aereo') + eff(att, shooter, 'finalizacion')) / 2 : eff(att, shooter, 'finalizacion');
        let xg = base * (0.65 + fin / 140) * (1 + riskF) * (1.15 - RD.def / 330) * (1 + noise());
        xg = clamp(xg, 0.015, 0.65);
        const gkF = 1.12 - RD.gk / 260;
        const goal = r() < xg * gkF;
        const onTarget = goal || r() < 0.34 + fin / 300 - 0.1;
        bump(att, 'shots'); bump(att, 'xg', xg); pAdd(shooter, 'sh');
        if (onTarget) bump(att, 'onTarget');
        const sy = 35 + r() * 30;
        seq.steps.push({ k: 'remate', ok: onTarget, x: chanceType === 'lejano' ? 76 : 88, y: sy, p: shooter.p.id, xg: Math.round(xg * 100) / 100, type: chanceType });
        if (goal) {
          score[att.key === 'h' ? 0 : 1]++;
          seq.steps.push({ k: 'gol', ok: true, x: 100, y: 50, p: shooter.p.id });
          pAdd(shooter, 'g'); outcome = 'goal'; nextStart = 'baja'; possession = def.key; bump(att, 'goals');
        } else {
          if (onTarget) seq.steps.push({ k: 'parada', ok: true, x: 98, y: sy });
          outcome = 'shot'; nextStart = 'baja';
        }
      }
      if (!outcome) outcome = 'reset';

      // duración de la secuencia (posesión estimada)
      const stepsN = seq.steps.length;
      let dur = W.seqBase * tmod(att) * (0.55 + stepsN * 0.22) * (0.8 + r() * 0.4);
      if (att.tactics.afterRecovery === 'conservación' && !seq.counter) dur *= 1.12;
      if (seq.counter) dur *= 0.45;
      seq.dur = Math.round(dur);
      seq.outcome = outcome; seq.score = score.slice();
      bump(att, 'possTime', seq.dur);
      sequences.push(seq);
      t += seq.dur;
      // fatiga: los equipos que presionan alto gastan más
      for (const s of [H, A]) {
        const pr = pressLevel(s.tactics);
        for (const x of s.onPitch) {
          const res = x.p.attrs.resistencia;
          s.energy[x.p.id] = clamp(s.energy[x.p.id] - (seq.dur / 60) * 0.42 * W.fatigueWeight * (0.7 + pr * 0.6) * (1.25 - res / 120), 20, 100);
        }
      }
      // siguiente posesión
      if (outcome === 'loss' || outcome === 'shot') possession = def.key;
      if (outcome === 'reset') possession = r() < 0.55 ? att.key : def.key;
      startZone = nextStart; counterFlag = outcome === 'loss' ? nextCounter : false;
    }

    // Estadísticas derivadas SOLO de los eventos
    const stats = {};
    const totalPoss = (tally.h.possTime || 0) + (tally.a.possTime || 0) || 1;
    for (const k of ['h', 'a']) {
      const T = tally[k];
      stats[k] = {
        goals: k === 'h' ? score[0] : score[1], possession: Math.round(((T.possTime || 0) / totalPoss) * 100), shots: T.shots || 0, onTarget: T.onTarget || 0,
        xg: round1((T.xg || 0) * 10) / 10, recoveries: T.recoveries || 0, highRecoveries: T.highRecoveries || 0, losses: T.losses || 0, entries: T.entries || 0,
        corners: T.corners || 0, counters: T.counters || 0, pressActions: T.pressActions || 0,
        pressEff: T.pressActions ? Math.round(((T.highRecoveries || 0) / T.pressActions) * 100) : 0,
      };
      stats[k].xg = Math.round((T.xg || 0) * 100) / 100;
    }
    // valoración de jugadores
    const playerRatings = {};
    for (const s of [H, A]) {
      const ids = s.onPitch.map((x) => x.p.id).concat((s.subs || []).map((x) => x.out));
      for (const id of ids) {
        const st = pStats[id] || {};
        const conc = s.key === 'h' ? score[1] : score[0];
        const line = POSITIONS[(s.byId[id] && s.byId[id].pos) || 'MC'].line;
        let rt = 6.2 + (st.g || 0) * 1.1 + (st.sh || 0) * 0.12 + (st.rec || 0) * 0.18 + (st.inv || 0) * 0.04 - (st.loss || 0) * 0.15 - (line === 'def' || line === 'gk' ? conc * 0.25 : 0) + ((s.key === 'h' ? score[0] - score[1] : score[1] - score[0]) * 0.15);
        playerRatings[id] = { team: s.key, rating: round1(clamp(rt, 3, 10)), goals: st.g || 0, shots: st.sh || 0, recoveries: st.rec || 0, losses: st.loss || 0, energy: Math.round(s.energy[id] || 0) };
      }
    }
    const report = buildReport({ H, A, stats, sequences, decisions, matchupNotes, score, input });
    return {
      score, stats, sequences, decisions, playerRatings, matchups: matchupNotes, report,
      lineups: { h: H.onPitch.map((x) => ({ id: x.p.id, role: x.role, x: x.hx, y: x.hy, num: 0 })), a: A.onPitch.map((x) => ({ id: x.p.id, role: x.role, x: x.hx, y: x.hy })) },
      subs: { h: H.subs || [], a: A.subs || [] }, finalTactics: { h: H.tactics, a: A.tactics }, finalEnergy: { h: H.energy, a: A.energy },
      engineVersion: '1.0.0', seed: input.seed,
    };
  }

  function pct(a) { return a[1] ? Math.round((a[0] / a[1]) * 100) : null; }
  function buildReport(ctx) {
    const { H, A, stats, matchupNotes, decisions, score } = ctx;
    const out = { h: { worked: [], problems: [], next: [], spaces: [] }, a: { worked: [], problems: [], next: [], spaces: [] }, highlights: [] };
    const mapNames = { salida_vs_presion: ['Salida de balón ante presión', ['salida', 'progPresion']], progresion: ['Progresión al último tercio', ['progPresion', 'superioridades', 'ocupacion']], creacion: ['Creación de ocasiones en último tercio', ['ataqueBloqueBajo', 'superioridades']], transicion: ['Contraataques tras recuperación', ['transOf']], tras_perdida: ['Presión tras pérdida', ['transDef']], directo: ['Juego directo', ['abpOf']] };
    for (const k of ['h', 'a']) {
      const me = k === 'h' ? H : A, them = k === 'h' ? A : H;
      for (const [mk, m] of Object.entries(matchupNotes)) {
        const v = m[k]; if (!v || v[1] < 3) continue;
        const p = pct(v); const name = mapNames[mk] ? mapNames[mk][0] : mk;
        const line = `${name}: ${v[0]}/${v[1]} con éxito (${p}%).`;
        const good = { salida_vs_presion: 70, progresion: 62, creacion: 38, transicion: 40, tras_perdida: 30, directo: 45 }[mk] || 50;
        if (p >= good) out[k].worked.push(line); else if (p < good - 12) { out[k].problems.push(line); if (mapNames[mk]) out[k].next.push(...mapNames[mk][1]); }
      }
      const st = stats[k], so = stats[k === 'h' ? 'a' : 'h'];
      if (st.highRecoveries >= 5) out[k].spaces.push(`Recuperó ${st.highRecoveries} balones en campo rival: la presión encontró espacios en la salida contraria.`);
      if (st.counters >= 3) out[k].spaces.push(`Explotó la espalda rival en ${st.counters} contraataques.`);
      if (me.tactics.progression === 'exterior' && st.entries > so.entries) out[k].spaces.push('Encontró superioridades por fuera (progresión exterior).');
      if (me.tactics.progression === 'interior' && st.entries > so.entries) out[k].spaces.push('Encontró superioridades por dentro, entre líneas.');
      if (so.xg > 1.6) out[k].problems.push(`Concedió ${so.xg} xG: el rival generó ocasiones de calidad.`);
      if (st.xg > 0 && st.goals > st.xg + 1.2) out[k].worked.push(`Eficacia superior a la esperada (${st.goals} goles con ${st.xg} xG). No conviene darlo por sistemático.`);
      if (st.xg > 1.5 && st.goals < st.xg - 1) out[k].problems.push(`Falta de acierto: ${st.goals} goles con ${st.xg} xG.`);
      out[k].next = [...new Set(out[k].next)];
      if (!out[k].next.length) out[k].next.push(me.tactics.blockHeight === 'alto' ? 'transDef' : 'ataqueBloqueBajo');
      void them;
    }
    for (const d of decisions) out.highlights.push(`Min ${d.min}: ${(d.team === 'h' ? H : A).name} aplica «${d.label}» (${COND_WHEN[d.when] || d.when}).`);
    for (const s of ctx.sequences) for (const st of s.steps) if (st.k === 'gol') out.highlights.push(`Min ${s.min}: gol de ${(s.team === 'h' ? H : A).byId[st.p].name} (${s.score[0]}-${s.score[1]}).`);
    out.highlights.sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4)));
    void score;
    return out;
  }


  /* ───────────── Espacios de fase (Método Pro) y validación del modelo ───────────── */
  // Intervención: acción directa sobre el balón. Ayuda mutua: apoyos, coberturas, paredes, tercer hombre.
  // Cooperación: sostener la estructura, fijar, amplitud, profundidad y equilibrio.
  const PHASE_SPACES = {
    intervencion: { label: 'Intervención', attrs: ['control', 'regate', 'conduccion', 'perfil', 'entrada', 'fuerza', 'agilidad', 'confianzaAttr'], desc: 'Actuar directamente sobre el balón: recibir presionado, proteger, disputar, recuperar.' },
    ayuda: { label: 'Ayuda mutua', attrs: ['pase', 'asociacion', 'percepcion', 'orientacion', 'anticipacion', 'decisiones'], desc: 'Relación inmediata con la siguiente acción: apoyos, coberturas, paredes y tercer hombre.' },
    cooperacion: { label: 'Cooperación', attrs: ['espacios', 'ocupacion', 'intDefensiva', 'colectivo', 'concentracion', 'superioridad'], desc: 'Sostener la estructura sin balón cerca: fijar, dar amplitud y profundidad, equilibrio y vigilancias.' },
  };
  function spaceValue(p, sp) { return avg(PHASE_SPACES[sp].attrs.map((a) => p.attrs[a])); }
  function squadSpaces(players) {
    const lu = autoLineup(players, '1-4-3-3');
    const xi = lu.slots.map((id) => players.find((p) => p.id === id)).filter(Boolean).filter((p) => p.pos !== 'POR');
    const out = {};
    for (const sp of Object.keys(PHASE_SPACES)) {
      const byLine = {};
      for (const line of ['def', 'mid', 'att']) { const xs = xi.filter((p) => POSITIONS[p.pos].line === line); byLine[line] = Math.round(avg(xs.map((p) => spaceValue(p, sp)))); }
      const ranked = players.filter((p) => p.pos !== 'POR').map((p) => [p, spaceValue(p, sp)]).sort((a, b) => b[1] - a[1]);
      out[sp] = { value: round1(avg(xi.map((p) => spaceValue(p, sp)))), byLine, best: ranked.slice(0, 3).map((x) => x[0].name), worst: ranked.slice(-2).map((x) => x[0].name) };
    }
    return out;
  }
  const LINE_POS = { gk: ['POR'], def: ['DFC', 'LD', 'LI'], cb: ['DFC'], fb: ['LD', 'LI'], piv: ['MCD'], mid: ['MCD', 'MC', 'MCO'], int: ['MC', 'MCO'], wing: ['ED', 'EI'], wide: ['LD', 'LI', 'ED', 'EI'], att: ['ED', 'EI', 'DC', 'MCO'], fw: ['DC'], build: ['POR', 'DFC', 'MCD'], outfield: ['DFC', 'LD', 'LI', 'MCD', 'MC', 'MCO', 'ED', 'EI', 'DC'] };
  // Exigencias de cada decisión del modelo: quién la ejecuta, qué capacidades y en qué espacio de fase
  const MODEL_DEMANDS = {
    buildUp: {
      corto: { who: 'build', attrs: ['control', 'perfil', 'agilidad', 'pase', 'percepcion', 'orientacion'], need: 64, space: 'intervencion+ayuda', why: 'Salir en corto exige que portero, centrales y pivote reciban presionados (intervención) y que haya apoyos y tercer hombre cerca del poseedor (ayuda mutua).' },
      mixto: { who: 'build', attrs: ['pase', 'percepcion', 'decisiones', 'control'], need: 60, space: 'ayuda', why: 'Combinar corto y largo exige leer cuándo hay apoyo libre y cuándo no (percepción y decisión).' },
      directo: { who: 'fw', attrs: ['aereo', 'fuerza', 'control', 'perfil'], need: 62, space: 'intervencion', why: 'El juego directo exige ganar el primer duelo arriba y proteger el balón (intervención) para que lleguen las segundas jugadas.' },
    },
    cbHeight: { alta: { who: 'cb', attrs: ['pase', 'conduccion', 'velocidad', 'orientacion'], need: 62, space: 'ayuda', why: 'Centrales altos en inicio necesitan conducir y dar pases de progresión, y velocidad para corregir si se pierde el balón.' } },
    fullbacks: {
      profundos: { who: 'fb', attrs: ['velocidad', 'resistencia', 'repetir', 'espacios'], need: 64, space: 'cooperacion', why: 'Laterales profundos dan amplitud y profundidad (cooperación) y deben repetir esfuerzos de ida y vuelta.' },
      interiores: { who: 'fb', attrs: ['pase', 'asociacion', 'orientacion', 'decisiones', 'percepcion'], need: 63, space: 'ayuda', why: 'El lateral interior se convierte en apoyo por dentro: perfil, pase y lectura de la presión (ayuda mutua).' },
      conservadores: { who: 'fb', attrs: ['intDefensiva', 'concentracion', 'anticipacion'], need: 60, space: 'cooperacion', why: 'Laterales conservadores sostienen las vigilancias y el equilibrio defensivo (cooperación).' },
    },
    attStructure: {
      '1-3-2-5': { who: 'wide', attrs: ['resistencia', 'velocidad', 'espacios', 'ocupacion'], need: 63, space: 'cooperacion', why: 'Ocupar cinco carriles exige jugadores de banda que fijen y den amplitud constante (cooperación).' },
      '1-2-3-5': { who: 'cb', attrs: ['velocidad', 'anticipacion', 'concentracion', 'intDefensiva'], need: 65, space: 'cooperacion', why: 'Con sólo dos jugadores por detrás del balón, los centrales defienden mucho espacio en vigilancias: velocidad y anticipación.' },
      '1-3-1-4-2': { who: 'int', attrs: ['asociacion', 'espacios', 'pase', 'decisiones'], need: 62, space: 'ayuda', why: 'La doble línea de cuatro exige interiores que se asocien entre líneas.' },
    },
    progression: {
      interior: { who: 'mid', attrs: ['pase', 'asociacion', 'percepcion', 'orientacion', 'control'], need: 64, space: 'ayuda', why: 'Progresar por dentro exige apoyos orientados, paredes y tercer hombre en espacios reducidos (ayuda mutua).' },
      exterior: { who: 'wide', attrs: ['regate', 'velocidad', 'superioridad', 'pase', 'conduccion'], need: 63, space: 'intervencion', why: 'Progresar por fuera exige ganar duelos 1c1 en banda y centrar con calidad (intervención).' },
      mixta: { who: 'outfield', attrs: ['pase', 'decisiones', 'percepcion'], need: 60, space: 'ayuda', why: 'Alternar carriles exige leer dónde está la superioridad.' },
    },
    tempo: {
      alto: { who: 'outfield', attrs: ['pase', 'decisiones', 'velocidad', 'repetir'], need: 63, space: 'ayuda', why: 'Circular rápido exige decidir antes de recibir y desplazarse continuamente para ofrecer apoyos.' },
      pausado: { who: 'mid', attrs: ['control', 'percepcion', 'decisiones', 'concentracion'], need: 62, space: 'intervencion+ayuda', why: 'La posesión paciente exige proteger el balón bajo presión y no precipitarse.' },
    },
    finishing: {
      centros: { who: 'fw', attrs: ['aereo', 'finalizacion', 'fuerza', 'espacios'], need: 63, space: 'intervencion', why: 'Finalizar con centros exige rematadores fuertes por arriba y que ataquen bien los espacios del área.' },
      'juego interior': { who: 'att', attrs: ['control', 'asociacion', 'finalizacion', 'regate'], need: 63, space: 'intervencion+ayuda', why: 'Finalizar por dentro exige paredes y controles en espacios muy reducidos.' },
      'llegada de segunda línea': { who: 'int', attrs: ['finalizacion', 'espacios', 'resistencia'], need: 60, space: 'cooperacion', why: 'La llegada desde segunda línea exige centrocampistas que lean el espacio libre y lleguen al área.' },
    },
    blockHeight: {
      alto: { who: 'outfield', attrs: ['velocidad', 'repetir', 'resistencia', 'competitividad', 'anticipacion'], need: 64, space: 'intervencion', why: 'Presionar arriba exige muchas acciones de intervención seguidas y defender la espalda con velocidad.' },
      medio: { who: 'outfield', attrs: ['colectivo', 'ocupacion', 'intDefensiva', 'concentracion'], need: 60, space: 'cooperacion', why: 'El bloque medio se sostiene con distancias cortas y basculaciones colectivas (cooperación).' },
      bajo: { who: 'def', attrs: ['aereo', 'fuerza', 'concentracion', 'intDefensiva'], need: 61, space: 'intervencion+cooperacion', why: 'Defender cerca del área exige ganar duelos aéreos y no perder la concentración durante mucho tiempo.' },
    },
    pressType: {
      'al hombre': { who: 'outfield', attrs: ['entrada', 'velocidad', 'intDefensiva', 'competitividad'], need: 64, space: 'intervencion', why: 'La presión al hombre convierte el partido en duelos individuales: cada jugador debe ganar su intervención.' },
      zonal: { who: 'outfield', attrs: ['colectivo', 'ocupacion', 'concentracion', 'anticipacion'], need: 60, space: 'cooperacion', why: 'La presión zonal depende de coberturas y basculaciones coordinadas.' },
    },
    depthControl: {
      'línea adelantada': { who: 'cb', attrs: ['velocidad', 'anticipacion', 'concentracion', 'aceleracion'], need: 64, space: 'ayuda', why: 'Defender adelantados exige centrales rápidos que cubran la espalda y coordinen el fuera de juego.' },
    },
    afterLoss: {
      'presión inmediata': { who: 'outfield', attrs: ['repetir', 'competitividad', 'anticipacion', 'agilidad'], need: 63, space: 'intervencion+ayuda', why: 'Presionar tras pérdida exige que los cercanos al balón reaccionen al instante (intervención) y que los de alrededor cierren líneas de pase (ayuda mutua).' },
      repliegue: { who: 'outfield', attrs: ['velocidad', 'colectivo', 'concentracion'], need: 60, space: 'cooperacion', why: 'El repliegue exige volver rápido y juntos a la estructura defensiva.' },
    },
    afterRecovery: {
      contraataque: { who: 'att', attrs: ['velocidad', 'aceleracion', 'conduccion', 'finalizacion'], need: 64, space: 'intervencion', why: 'Contraatacar exige atacantes rápidos que conduzcan y finalicen con poco tiempo.' },
      conservación: { who: 'mid', attrs: ['control', 'pase', 'percepcion'], need: 62, space: 'ayuda', why: 'Conservar tras recuperar exige un primer pase seguro fuera de la zona de presión.' },
    },
    cornerOf: { 'primer palo': { who: 'outfield', top: 5, attrs: ['aereo', 'fuerza'], need: 62, space: 'intervencion', why: 'Los córners al área dependen de tus mejores cabeceadores.' }, 'segundo palo': { who: 'outfield', top: 5, attrs: ['aereo', 'fuerza'], need: 62, space: 'intervencion', why: 'Los córners al área dependen de tus mejores cabeceadores.' } },
  };
  // Incoherencias internas entre decisiones del propio modelo (se plantean como preguntas, no como errores)
  const MODEL_TENSIONS = [
    [(m) => m.blockHeight === 'alto' && m.depthControl === 'línea hundida', 'Bloque alto con la última línea hundida deja un gran espacio entre líneas. ¿Cómo mantendrás las distancias entre líneas?'],
    [(m) => m.blockHeight === 'bajo' && m.afterLoss === 'presión inmediata', 'Defiendes en bloque bajo pero quieres presionar tras pérdida. ¿En qué zonas del campo presionarás y en cuáles replegarás?'],
    [(m) => m.afterRecovery === 'contraataque' && m.tempo === 'pausado', 'Quieres contraatacar pero tu ritmo de circulación es pausado. ¿Qué criterio decide cuándo acelerar?'],
    [(m) => m.buildUp === 'directo' && m.pivots === 'entre centrales', 'Inicias en largo pero el pivote se incrusta entre centrales. ¿Quién disputará las segundas jugadas?'],
    [(m) => ['1-3-2-5', '1-2-3-5'].includes(m.attStructure) && m.restDefense === '2+1', 'Atacas con cinco por delante y vigilancias 2+1. ¿Cómo protegerás las transiciones defensivas?'],
    [(m) => m.fullbacks === 'conservadores' && +m.width >= 5, 'Pides amplitud máxima pero tus laterales son conservadores. ¿Quién ocupará los carriles exteriores?'],
  ];
  function groupPlayers(players, who) { return players.filter((p) => LINE_POS[who].includes(p.pos)); }
  function validateModel(model, players) {
    const lu = autoLineup(players, model.defStructure || '1-4-3-3');
    const xiIds = new Set(lu.slots.filter(Boolean));
    const checks = [];
    for (const [field, opts] of Object.entries(MODEL_DEMANDS)) {
      const d = opts[model[field]]; if (!d) continue;
      let pool = groupPlayers(players, d.who);
      const starters = pool.filter((p) => xiIds.has(p.id));
      if (starters.length >= 2) pool = starters;
      const val = (p) => avg(d.attrs.map((a) => p.attrs[a]));
      let ranked = pool.map((p) => [p, val(p)]).sort((a, b) => b[1] - a[1]);
      if (d.top) ranked = ranked.slice(0, d.top);
      const have = round1(avg(ranked.map((x) => x[1])));
      // relativo: ¿son estas capacidades un punto fuerte o débil de esos mismos jugadores? absoluto: ¿llegan al nivel que exige?
      const own = round1(avg(ranked.map((x) => avg(ALL_ATTRS.map((a) => x[0].attrs[a])))));
      const rel = have - own;
      const fit = clamp(0.55 + (rel - 2) / 8 + (have - d.need) / 30, 0, 1);
      const verdict = fit >= 0.7 ? 'coherente' : fit >= 0.4 ? 'riesgo' : 'incoherente';
      const label = (Object.values(MODEL_FIELDS).flatMap((g) => g.fields).find((f) => f[0] === field) || [field, field])[1];
      checks.push({ field, label, choice: model[field], space: d.space, need: d.need, have, own, rel: round1(rel), fit: round1(fit), verdict, why: d.why, attrs: d.attrs.map((a) => ATTR_LABEL[a]),
        best: ranked.slice(0, 2).map((x) => `${x[0].name} (${Math.round(x[1])})`), weak: ranked.length > 2 ? ranked.slice(-1).map((x) => `${x[0].name} (${Math.round(x[1])})`) : [] });
    }
    const tensions = MODEL_TENSIONS.filter(([f]) => f(model)).map((x) => x[1]);
    const spaces = squadSpaces(players);
    const order = Object.entries(spaces).sort((a, b) => b[1].value - a[1].value);
    const questions = [];
    const bad = checks.filter((c) => c.verdict !== 'coherente').sort((a, b) => a.fit - b.fit);
    for (const c of bad.filter((x) => x.fit < 0.6).slice(0, 3)) {
      const reason = c.rel < -1 ? `es uno de sus puntos débiles (${c.have} frente a ${c.own} de nivel general)` : c.have < c.need ? `no llegan al nivel que exige (${c.have}, orientativo ${c.need})` : `no es un punto fuerte especial de ellos (${c.have})`;
      questions.push(`«${c.choice}» en ${c.label.toLowerCase()} pide ${c.attrs.join(', ').toLowerCase()}, y para los jugadores que lo ejecutarían ${reason}. ¿Quién puede sostenerlo y cómo compensarás a los que no?`);
    }
    questions.push(`Tu plantilla es más fuerte en ${PHASE_SPACES[order[0][0]].label.toLowerCase()} (${order[0][1].value}) y más débil en ${PHASE_SPACES[order[2][0]].label.toLowerCase()} (${order[2][1].value}). ¿Cómo aprovecha tu modelo esa fortaleza?`);
    const weighted = checks.reduce((s2, c) => s2 + c.fit, 0) / Math.max(1, checks.length);
    const score = Math.round(clamp(weighted * 100 - tensions.length * 6, 0, 100));
    return { score, verdict: score >= 70 ? 'coherente' : score >= 45 ? 'riesgo' : 'incoherente', checks, tensions, spaces, questions };
  }

  /* ───────────── Biblioteca de tareas ───────────── */
  const TASK_LIBRARY = [
    { name: 'Rondo 4c2 con transición', type: 'rondo', objective: 'progPresion', attackers: 4, defenders: 2, jokers: 0, goalkeepers: 0, length: 12, width: 12, duration: 4, series: 4, pause: 1, rules: ['toques2', 'tras_perdida'], cues: 'Perfilarse antes de recibir, pase al pie lejano.', expected: 'Apoyos a ambos lados del poseedor.', success: '8 pases seguidos = punto.', variants: 'Añadir un tercer defensor.', opposition: 'si', direction: 'no', phase: 'Organización ofensiva' },
    { name: 'Salida 6c4 + portero a 3 miniporterías', type: 'superioridad', objective: 'salida', attackers: 6, defenders: 4, jokers: 0, goalkeepers: 1, length: 45, width: 40, duration: 5, series: 4, pause: 1.5, rules: ['salida_portero', 'pase_linea', 'porteros'], cues: 'Centrales abiertos, pivote orientado, tercer hombre.', expected: 'Superar primera línea de presión con pase.', success: 'Conducir por una miniportería = punto.', variants: 'Presión al hombre del rival.', opposition: 'si', direction: 'si', phase: 'Organización ofensiva' },
    { name: 'Juego de posición 5c5+3 en 3 carriles', type: 'posicion', objective: 'superioridades', attackers: 5, defenders: 5, jokers: 3, goalkeepers: 0, length: 40, width: 35, duration: 5, series: 4, pause: 1, rules: ['comodines', 'zonas_carril', 'pase_linea'], cues: 'Fijar al par antes de soltar, atacar el lado débil.', expected: 'Generar 3c2 en carril central.', success: 'Pase al jugador entre líneas = punto.', variants: 'Limitar a 2 toques.', opposition: 'si', direction: 'si', phase: 'Organización ofensiva' },
    { name: 'Partido modificado 8c8 bloque alto', type: 'partidoModificado', objective: 'presionAlta', attackers: 8, defenders: 8, jokers: 0, goalkeepers: 2, length: 60, width: 45, duration: 8, series: 3, pause: 2, rules: ['recup_alta', 'presion_activa', 'porteros'], cues: 'Saltar al pase horizontal, cerrar el pase interior.', expected: 'Recuperar en campo rival en < 8 s.', success: 'Recuperación en zona alta = 2 puntos.', variants: 'El rival sale con tres centrales.', opposition: 'si', direction: 'si', phase: 'Organización defensiva' },
    { name: 'Bloque medio 10c8 basculaciones', type: 'colectivo', objective: 'bloqueMedio', attackers: 8, defenders: 10, jokers: 0, goalkeepers: 1, length: 60, width: 65, duration: 6, series: 3, pause: 2, rules: ['bloque_zona', 'presion_activa', 'porteros'], cues: 'Distancias cortas entre líneas, bascular con el balón.', expected: 'Proteger el carril central.', success: 'Rival sin pases entre líneas en 30 s.', variants: 'Rival con extremos muy abiertos.', opposition: 'si', direction: 'si', phase: 'Organización defensiva' },
    { name: 'Defensa del área ante centros 6c5+P', type: 'inferioridad', objective: 'bloqueBajo', attackers: 6, defenders: 5, jokers: 0, goalkeepers: 1, length: 35, width: 50, duration: 4, series: 5, pause: 1, rules: ['bloque_zona', 'centros', 'porteros'], cues: 'Defender el área, vigilar segunda jugada.', expected: 'Despejar y salir en bloque.', success: 'Menos de 2 remates por serie.', variants: 'Centros desde zona de tres cuartos.', opposition: 'si', direction: 'si', phase: 'Organización defensiva' },
    { name: 'Transición 4c4+4 con miniporterías', type: 'igualdad', objective: 'transOf', attackers: 4, defenders: 4, jokers: 4, goalkeepers: 0, length: 40, width: 30, duration: 4, series: 4, pause: 1.5, rules: ['gol_rapido', 'superar_minis'], cues: 'Primer pase fuera de la zona de presión.', expected: 'Finalizar en menos de 10 s.', success: 'Gol en transición = 2 puntos.', variants: 'Sin comodines.', opposition: 'si', direction: 'si', phase: 'Transición defensa-ataque' },
    { name: 'Reacción tras pérdida 6c6+2', type: 'posesion', objective: 'transDef', attackers: 6, defenders: 6, jokers: 2, goalkeepers: 0, length: 35, width: 30, duration: 4, series: 4, pause: 1, rules: ['tras_perdida', 'toques2'], cues: 'Los tres más cercanos presionan, el resto cierra.', expected: 'Recuperar en 5 s o temporizar.', success: 'Recuperar en 5 s = punto.', variants: 'Añadir porterías tras robo.', opposition: 'si', direction: 'no', phase: 'Transición ataque-defensa' },
    { name: 'Ataque a bloque bajo 9c7+P', type: 'superioridad', objective: 'ataqueBloqueBajo', attackers: 9, defenders: 7, jokers: 0, goalkeepers: 1, length: 40, width: 60, duration: 6, series: 3, pause: 1.5, rules: ['zonas_carril', 'centros', 'porteros'], cues: 'Fijar por dentro, atacar el lado débil, llegar al segundo palo.', expected: 'Llegadas con 3 jugadores al área.', success: 'Remate dentro del área.', variants: 'El bloque defensivo con 5 atrás.', opposition: 'si', direction: 'si', phase: 'Organización ofensiva' },
    { name: 'Córner ofensivo y defensivo', type: 'estrategia', objective: 'abpOf', attackers: 7, defenders: 7, jokers: 0, goalkeepers: 1, length: 30, width: 50, duration: 3, series: 5, pause: 1, rules: ['abp', 'porteros'], cues: 'Bloqueos legales, ataque al primer palo.', expected: 'Remate limpio en primer o segundo palo.', success: '3 remates de 10 ensayos.', variants: 'Saque en corto.', opposition: 'si', direction: 'si', phase: 'Balón parado' },
    { name: 'Defensa de ABP mixta', type: 'estrategia', objective: 'abpDef', attackers: 7, defenders: 8, jokers: 0, goalkeepers: 1, length: 30, width: 50, duration: 3, series: 4, pause: 1, rules: ['abp', 'porteros'], cues: 'Zona en primer palo, marcas en los rematadores.', expected: 'Despejar el primer contacto.', success: 'Menos de 2 remates de 10.', variants: 'Rival con bloqueos.', opposition: 'si', direction: 'si', phase: 'Balón parado' },
    { name: 'Ocupación 7c7+2 cinco carriles', type: 'condicionado', objective: 'ocupacion', attackers: 7, defenders: 7, jokers: 2, goalkeepers: 2, length: 55, width: 50, duration: 6, series: 3, pause: 2, rules: ['zonas_carril', 'porteros'], cues: 'Un jugador por carril, no repetir carril con el compañero.', expected: 'Amplitud y profundidad simultáneas.', success: 'Ataques con 5 carriles ocupados.', variants: 'Libre al tercer pase.', opposition: 'si', direction: 'si', phase: 'Organización ofensiva' },
  ];

  Object.assign(TC, {
    makeRng, hashSeed, clamp, avg, round1,
    ATTR_GROUPS, ALL_ATTRS, ATTR_LABEL, POSITIONS, POS_KEYS, ARCHETYPES, FORMATIONS, ATT_STRUCTURES, INDICATORS, IND_LABEL, IND_START,
    TASK_TYPES, OBJ_PROFILE, PROVOCATIONS, PROV, SESSION_TYPES, DAYS, MODEL_FIELDS, COND_ACTIONS, COND_WHEN, TASK_LIBRARY, DEFAULT_WEIGHTS,
    defaultModel, exampleWork, modelRelevance, genSquad, playerRating, posFit, squadPotential, strengthsWeaknesses, autoLineup, roundRobin,
    evaluateTask, evaluateSession, evaluateMicrocycle, computeLearning, evaluatePlan, evaluateCoherence, evaluateAdaptation, evaluateReflection,
    simulateMatch, tacticsFrom, taskPlayers, sessionLoad: load,
    PHASE_SPACES, MODEL_DEMANDS, spaceValue, squadSpaces, validateModel, MODEL_MOMENTS, FUNDAMENTOS, blankWork,
  });
})(typeof window !== 'undefined' ? window : globalThis);
