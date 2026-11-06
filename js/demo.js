/* THE COACH — Modo demostración: 8 equipos, 20 jugadores, 7 jornadas a una vuelta. */
(function (G) {
  'use strict';
  const TC = G.TC, S = G.TCStore;

  const MODELS = [
    { identity: 'Juego de posición: dominar con balón y presionar tras pérdida.', attStructure: '1-3-2-5', buildUp: 'corto', fullbacks: 'interiores', width: '5', tempo: 'medio', progression: 'interior', defStructure: '1-4-3-3', blockHeight: 'alto', afterLoss: 'presión inmediata', afterRecovery: 'ataque rápido' },
    { identity: 'Bloque bajo compacto y contraataque vertical.', attStructure: '1-4-4-2', buildUp: 'directo', width: '3', tempo: 'alto', progression: 'exterior', defStructure: '1-5-3-2', blockHeight: 'bajo', afterLoss: 'repliegue', afterRecovery: 'contraataque', finishing: 'centros' },
    { identity: 'Presión alta al hombre y ataques rápidos.', attStructure: '1-4-3-3', buildUp: 'mixto', width: '4', tempo: 'alto', progression: 'mixta', defStructure: '1-4-4-2', blockHeight: 'alto', pressType: 'al hombre', afterLoss: 'presión inmediata', afterRecovery: 'contraataque' },
    { identity: 'Bloque medio y posesión paciente.', attStructure: '1-3-1-4-2', buildUp: 'corto', width: '4', tempo: 'pausado', progression: 'interior', defStructure: '1-4-2-3-1', blockHeight: 'medio', afterLoss: 'mixta', afterRecovery: 'conservación' },
    { identity: 'Juego exterior y centros al área.', attStructure: '1-2-3-5', buildUp: 'mixto', fullbacks: 'profundos', width: '5', tempo: 'medio', progression: 'exterior', finishing: 'centros', defStructure: '1-4-4-2', blockHeight: 'medio', afterLoss: 'mixta', afterRecovery: 'ataque rápido' },
    { identity: 'Tres centrales, carrileros profundos y presión orientada hacia dentro.', attStructure: '1-3-2-5', buildUp: 'corto', width: '5', tempo: 'medio', progression: 'mixta', defStructure: '1-3-4-3', blockHeight: 'alto', pressOrientation: 'hacia dentro', afterLoss: 'mixta', afterRecovery: 'ataque rápido' },
    { identity: 'Equipo directo y fuerte en balón parado.', attStructure: '1-4-4-2', buildUp: 'directo', width: '3', tempo: 'alto', progression: 'exterior', finishing: 'centros', defStructure: '1-4-4-2', blockHeight: 'medio', afterLoss: 'repliegue', afterRecovery: 'contraataque', cornerOf: 'primer palo' },
    { identity: 'Bloque medio-bajo, transiciones y llegada de segunda línea.', attStructure: '1-4-2-4', buildUp: 'mixto', width: '3', tempo: 'medio', progression: 'interior', finishing: 'llegada de segunda línea', defStructure: '1-5-3-2', blockHeight: 'bajo', afterLoss: 'mixta', afterRecovery: 'contraataque' },
  ];

  function lib(name) { const t = TC.TASK_LIBRARY.find((x) => x.name === name); const c = S.clone(t); c.id = S.uid('task'); return c; }

  function demoDraft(team, rivalName) {
    const dr = S.getDraft(team.id, 1);
    const ss = dr.microcycle.sessions;
    const def = [
      { type: 'Análisis y recuperación', objective: 'salida', secondary: ['progPresion'], intensity: 4, duration: 75, contents: 'Vídeo del rival, rondos de activación y salida sin oposición a oposición progresiva.', rivalLink: `${rivalName} defiende en bloque bajo: queremos atraerles con salida limpia.`, tasks: [lib('Rondo 4c2 con transición'), lib('Salida 6c4 + portero a 3 miniporterías')] },
      { type: 'Táctica ofensiva', objective: 'superioridades', secondary: ['ocupacion', 'ataqueBloqueBajo'], intensity: 7, duration: 90, contents: 'Generar superioridades en carril central y atacar el lado débil.', rivalLink: 'Ante bloque bajo, necesitamos fijar por dentro y atacar fuera.', tasks: [lib('Juego de posición 5c5+3 en 3 carriles'), lib('Ataque a bloque bajo 9c7+P')] },
      { type: 'Táctica defensiva', objective: 'transDef', secondary: ['presionAlta'], intensity: 7, duration: 90, contents: 'Reacción tras pérdida y presión alta orientada.', rivalLink: 'Su contraataque es su principal arma: vigilancias y presión inmediata.', tasks: [lib('Reacción tras pérdida 6c6+2'), lib('Partido modificado 8c8 bloque alto')] },
      { type: 'Activación y estrategia', objective: 'abpOf', secondary: ['abpDef'], intensity: 4, duration: 60, contents: 'Activación, córners ofensivos y defensivos.', rivalLink: 'Defienden córners al hombre: bloqueos en primer palo.', tasks: [lib('Córner ofensivo y defensivo')] },
    ];
    ss.forEach((s, i) => Object.assign(s, def[Math.min(i, def.length - 1)]));
    dr.microcycle.justification = 'Semana con carga ondulante: recuperación el lunes, pico martes-miércoles y activación el viernes. Los contenidos derivan del modelo (salida en corto, superioridades interiores, presión tras pérdida) y del informe del rival (bloque bajo y contraataque).';
    dr.plan.sections = {
      fortalezas: 'Defienden muy juntos en bloque bajo con cinco defensores y salen rápido al contraataque por bandas.',
      debilidades: 'Les cuesta defender los cambios de orientación y conceden centros desde el lado débil.',
      habituales: 'Juego directo a su delantero de área, segundas jugadas.',
      amenazas: 'Contraataques tras pérdida nuestra en zona interior y balón parado ofensivo.',
      objetivos: 'Monopolizar la posesión sin perder el equilibrio y llegar al área con tres jugadores.',
      espacios: 'Carril central entre líneas para fijar y el lado débil para finalizar.',
      provocar: 'Que el bloque bascule hacia un lado para cambiar de orientación.',
      ofensivo: 'Salida en 1-3-2-5 con lateral interior. Progresión por dentro con tercer hombre; finalización con llegada al segundo palo y ataque del área con 3 jugadores.',
      defensivo: 'Bloque alto tras pérdida, presión orientada hacia fuera, vigilancias 3+1 para proteger el contraataque.',
      perdida: 'Presión inmediata de los tres más cercanos durante 5 segundos; si no recuperamos, repliegue.',
      recuperacion: 'Primer pase fuera de la zona de presión y ataque rápido.',
      abpOf: 'Córner al primer palo con bloqueo.', abpDef: 'Mixta: zona en primer palo y marcas en rematadores.',
      escenarios: 'Ganando: pausar y conservar. Perdiendo: más amplitud y juego por bandas. Si cambian a cuatro defensas: atacar entre lateral y central. Con diez: bloque medio y transiciones.',
      relacion: 'La sesión del martes (superioridades y ataque a bloque bajo) prepara la creación; la del miércoles (reacción tras pérdida) protege del contraataque; el viernes preparamos los córners.',
    };
    dr.plan.tactics = Object.assign(dr.plan.tactics, { attStructure: team.model.attStructure, buildUp: 'corto', blockHeight: 'alto', progression: 'interior', afterLoss: 'presión inmediata', afterRecovery: 'ataque rápido', risk: 3 });
    dr.plan.linkedSessions = ss.slice(1).map((s) => s.id);
    dr.plan.conditions = [{ when: 'perdiendo', from: 65, action: 'bandas' }, { when: 'ganando', from: 70, action: 'conservar' }, { when: 'empatando', from: 75, action: 'mas_riesgo' }];
    dr.updatedAt = S.now();
    S.save();
  }

  function createDemo() {
    const d = S.load();
    const prev = d.competitions.find((c) => c.demo);
    let teacher = d.users.find((u) => u.demo === 'teacher');
    let coach = d.users.find((u) => u.demo === 'coach');
    if (!teacher) { teacher = { id: S.uid('u'), name: 'Docente demo', role: 'teacher', demo: 'teacher', createdAt: S.now() }; d.users.push(teacher); }
    if (!coach) { coach = { id: S.uid('u'), name: 'Entrenador/a demo', role: 'student', demo: 'coach', createdAt: S.now() }; d.users.push(coach); }
    d.session = { userId: teacher.id, at: S.now() };
    if (prev) S.deleteCompetition(prev.id);
    const comp = S.createCompetition({ name: 'Liga Demo Manager Academy', className: 'CFGM Técnico Deportivo en Fútbol · Nivel 2', demo: true, seed: 'demo-2026', config: { teams: 8, doubleRound: false, sessionsPerWeek: 4, difficulty: 'medio' }, teamNames: ['CF Alameda', 'UD Sierra Norte', 'CD Faro Viejo', 'Racing Valle Verde', 'Atlètic Les Torres', 'SD Ribera Baja', 'CE Molinos', 'Deportivo Cumbres'] });
    const teams = S.teamsOf(comp.id);
    teams.forEach((t, i) => { Object.assign(t.model, MODELS[i], { updatedAt: S.now() }); });
    const my = teams[0];
    my.coachId = coach.id; my.ai = false;
    S.save();
    // entregas de los equipos del sistema (planes completos y bloqueados)
    for (const t of teams.slice(1)) S.makeSubmission(t, 1, S.autoWeek(t, 1, 'medio'), true);
    S.save();
    const nm = S.nextMatch(my);
    demoDraft(my, S.getTeam(nm.rivalId).name);
    d.session = { userId: coach.id, at: S.now() };
    S.save();
    return { comp, teacher, coach, team: my };
  }

  G.TCDemo = { createDemo, MODELS };
})(typeof window !== 'undefined' ? window : globalThis);
