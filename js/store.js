/* THE COACH — Capa de datos y operaciones (servicio).
 * Toda la lógica de negocio pasa por aquí: permisos, versiones bloqueadas, jornadas,
 * simulación y clasificación. Hoy persiste en localStorage; la interfaz `API` está pensada
 * para sustituirse por llamadas a un servidor (p. ej. Supabase/Postgres) sin cambiar las pantallas.
 */
(function (G) {
  'use strict';
  const TC = G.TC;
  const KEY = 'thecoach.db.v1';
  let mem = null; // copia en memoria si localStorage no está disponible

  const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString();
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function emptyDb() {
    return { schema: 1, users: [], session: null, competitions: [], teams: [], rounds: [], matches: [], drafts: {}, submissions: [], evaluations: [], reflections: [], log: [] };
  }
  let db = null;
  // Servidor compartido: si hay un "backend" conectado, los datos viven en memoria y se sincronizan con él.
  let backend = null;
  function useBackend(b, initial) { backend = b || null; db = b ? (initial || emptyDb()) : null; mem = null; }
  const isRemote = () => !!backend;
  function load() {
    if (db) return db;
    if (backend) { db = emptyDb(); return db; }
    try { const raw = G.localStorage && G.localStorage.getItem(KEY); if (raw) db = JSON.parse(raw); } catch (e) { db = null; }
    if (!db && mem) db = mem;
    if (!db) db = emptyDb();
    return db;
  }
  function save() {
    if (backend) { backend.changed(); return true; }
    mem = db;
    try { G.localStorage && G.localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; }
  }
  function err(msg) { const e = new Error(msg); e.userFacing = true; throw e; }

  /* ───────── Usuarios y sesión ───────── */
  function currentUser() { const d = load(); return d.session ? d.users.find((u) => u.id === d.session.userId) || null : null; }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normEmail = (e) => (e || '').trim().toLowerCase();
  function hashCode(code, salt) { return 'h' + TC.hashSeed('tc:' + salt + ':' + String(code).trim().toUpperCase()).toString(36) + TC.hashSeed(String(code).trim().toUpperCase() + ':' + salt).toString(36); }
  function randomCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let out = '';
    const buf = new Uint32Array(8);
    try { (G.crypto || require('crypto').webcrypto).getRandomValues(buf); } catch (e) { for (let i = 0; i < 8; i++) buf[i] = Math.floor(Math.random() * 4294967296); }
    for (let i = 0; i < 8; i++) out += A[buf[i] % A.length];
    return out.slice(0, 4) + '-' + out.slice(4);
  }
  const findByEmail = (email) => load().users.find((u) => u.email && u.email === normEmail(email));
  // Alumno: solicita acceso con nombre y email; queda pendiente hasta que el administrador le genere un código.
  function requestAccess(name, email) {
    name = (name || '').trim(); email = normEmail(email);
    if (name.length < 3) err('Escribe tu nombre y apellido.');
    if (!EMAIL_RE.test(email)) err('Escribe un email válido.');
    const ex = findByEmail(email);
    if (ex && ex.status === 'pending') err('Ya hay una solicitud pendiente con este email. Espera a que tu profesor te pase el código.');
    if (ex) err('Este email ya tiene cuenta. Entra con tu código.');
    const u = { id: uid('u'), name, email, role: 'student', status: 'pending', requestedAt: now(), createdAt: now() };
    load().users.push(u); addLog(null, null, 'solicitud', `${name} (${email}) solicita acceso.`); save();
    return u;
  }
  function loginWithCode(email, code) {
    const u = findByEmail(email);
    if (!u || u.role !== 'student') err('No hay ninguna cuenta de alumno con ese email. Solicita acceso primero.');
    if (u.status === 'pending') err('Tu solicitud está pendiente. Tu profesor te pasará el código cuando la apruebe.');
    if (u.status === 'revoked') err('Tu acceso está desactivado. Habla con tu profesor.');
    if (!u.codeHash || u.codeHash !== hashCode(code, u.id)) err('El código no es correcto. Revisa que lo has copiado bien (formato ABCD-EFGH).');
    const d = load(); d.session = { userId: u.id, at: now() }; u.lastLoginAt = now(); save(); return u;
  }
  const realAdmin = () => load().users.find((u) => u.superadmin && !u.demo);
  function adminExists() { return !!realAdmin(); }
  function adminSetup(name, email, password) {
    if (adminExists()) err('Ya existe un superadministrador.');
    name = (name || '').trim(); email = normEmail(email);
    if (name.length < 3) err('Escribe tu nombre.'); if (!EMAIL_RE.test(email)) err('Escribe un email válido.');
    if ((password || '').length < 8) err('La contraseña debe tener al menos 8 caracteres.');
    const u = { id: uid('u'), name, email, role: 'teacher', superadmin: true, status: 'active', createdAt: now() };
    u.passHash = hashCode(password, u.id);
    const d = load(); d.users.push(u); d.session = { userId: u.id, at: now() }; save(); return u;
  }
  function adminLogin(email, password) {
    const u = findByEmail(email);
    if (!u || u.role !== 'teacher' || !u.passHash || u.passHash !== hashCode(password, u.id)) err('Email o contraseña incorrectos.');
    const d = load(); d.session = { userId: u.id, at: now() }; save(); return u;
  }
  // En local se guarda el hash; con servidor, el código viaja una vez y se cifra allí (bcrypt).
  function setSecret(u, field, secret) { if (backend) { delete u[field]; backend.secret(u.id, secret); } else u[field] = hashCode(secret, u.id); }
  function assertAdmin() { const u = currentUser(); if (!u || u.role !== 'teacher') err('Sólo el profesor o el superadministrador puede hacerlo.'); return u; }
  // Aprueba la solicitud, asigna equipo y devuelve el código en claro (sólo se muestra una vez; se guarda cifrado).
  function approveStudent(userId, teamId) {
    const admin = assertAdmin(); const d = load();
    const u = d.users.find((x) => x.id === userId); if (!u || u.role !== 'student') err('Solicitud no encontrada.');
    const team = getTeam(teamId); if (!team) err('Elige un equipo libre.');
    const comp = getComp(team.compId); if (!isOwner(admin, comp)) err('No gestionas esa competición.');
    if (team.coachId && team.coachId !== u.id) err('Ese equipo ya tiene entrenador.');
    if (d.teams.some((t) => t.compId === comp.id && t.coachId === u.id && t.id !== team.id)) err('Este alumno ya dirige otro equipo de esa competición.');
    const code = randomCode();
    setSecret(u, 'codeHash', code); u.status = 'active'; u.approvedAt = now(); u.approvedBy = admin.id;
    team.coachId = u.id; team.ai = false;
    addLog(comp.id, team.id, 'alta', `${admin.name} aprueba a ${u.name} y le asigna ${team.name}.`);
    save(); return code;
  }
  function regenerateCode(userId) {
    const admin = assertAdmin(); const u = load().users.find((x) => x.id === userId); if (!u || u.role !== 'student') err('Alumno no encontrado.');
    const code = randomCode(); setSecret(u, 'codeHash', code); if (u.status === 'revoked') u.status = 'active';
    addLog(null, null, 'acceso', `${admin.name} genera un nuevo código para ${u.name}.`); save(); return code;
  }
  function setStudentStatus(userId, status) {
    const admin = assertAdmin(); const d = load(); const u = d.users.find((x) => x.id === userId); if (!u) err('Alumno no encontrado.');
    if (status === 'rejected') { d.users = d.users.filter((x) => x.id !== userId); addLog(null, null, 'acceso', `${admin.name} rechaza la solicitud de ${u.name}.`); save(); return; }
    u.status = status; if (d.session && d.session.userId === u.id) d.session = null;
    addLog(null, null, 'acceso', `${admin.name} ${status === 'revoked' ? 'desactiva' : 'reactiva'} a ${u.name}.`); save();
  }
  function register(name, role) {
    name = (name || '').trim();
    if (name.length < 2) err('Escribe un nombre de al menos 2 letras.');
    if (!['teacher', 'student'].includes(role)) err('Elige un rol.');
    const d = load();
    const u = { id: uid('u'), name, role, createdAt: now() };
    d.users.push(u); d.session = { userId: u.id, at: now() }; save();
    return u;
  }
  function loginAs(userId) { const d = load(); if (!d.users.find((u) => u.id === userId)) err('Perfil no encontrado.'); d.session = { userId, at: now() }; save(); }
  function logout() { const d = load(); d.session = null; save(); }

  /* ───────── Permisos ───────── */
  function isOwner(user, comp) { return !!(user && comp && user.role === 'teacher' && (user.superadmin || comp.ownerId === user.id)); }
  function canEditTeam(user, team) { return !!(user && team && team.coachId === user.id); }
  function assertTeam(team) { const u = currentUser(); if (!canEditTeam(u, team)) err('Sólo el entrenador de este equipo puede modificarlo.'); return u; }
  function assertOwner(comp) { const u = currentUser(); if (!isOwner(u, comp)) err('Sólo el profesor de esta competición puede hacerlo.'); return u; }

  /* ───────── Consultas ───────── */
  const getComp = (id) => load().competitions.find((c) => c.id === id);
  const getTeam = (id) => load().teams.find((t) => t.id === id);
  const teamsOf = (compId) => load().teams.filter((t) => t.compId === compId);
  const roundsOf = (compId) => load().rounds.filter((r) => r.compId === compId).sort((a, b) => a.number - b.number);
  const matchesOf = (compId, round) => load().matches.filter((m) => m.compId === compId && (round == null || m.round === round));
  const getMatch = (id) => load().matches.find((m) => m.id === id);
  function myTeams(user) { user = user || currentUser(); return user ? load().teams.filter((t) => t.coachId === user.id) : []; }
  function myCompetitions(user) { user = user || currentUser(); if (!user) return []; const d = load(); return user.role === 'teacher' ? d.competitions.filter((c) => user.superadmin || c.ownerId === user.id) : d.competitions.filter((c) => d.teams.some((t) => t.compId === c.id && t.coachId === user.id)); }
  function nextMatch(team) {
    const comp = getComp(team.compId);
    const ms = matchesOf(team.compId).filter((m) => (m.homeId === team.id || m.awayId === team.id) && m.status !== 'played').sort((a, b) => a.round - b.round);
    const m = ms[0];
    if (!m) return null;
    return { match: m, rivalId: m.homeId === team.id ? m.awayId : m.homeId, home: m.homeId === team.id, round: m.round, open: comp.currentRound === m.round && roundOf(comp.id, m.round).status === 'open' };
  }
  function roundOf(compId, n) { return load().rounds.find((r) => r.compId === compId && r.number === n); }
  function lastSubmission(teamId, round) { return load().submissions.filter((s) => s.teamId === teamId && s.round === round).sort((a, b) => b.version - a.version)[0] || null; }

  /* ───────── Competiciones ───────── */
  const COLORS = ['#2fbf71', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#f97316', '#e11d48', '#84cc16', '#06b6d4', '#eab308', '#8b5cf6', '#10b981', '#f43f5e', '#0ea5e9', '#d946ef', '#22c55e', '#fb7185', '#38bdf8', '#facc15'];
  const NAMES = ['CF Alameda', 'UD Sierra Norte', 'CD Faro Viejo', 'Racing Valle Verde', 'Atlètic Les Torres', 'SD Ribera Baja', 'CE Molinos', 'Deportivo Cumbres', 'CF Arenales', 'UD Pinares', 'CD Vientos del Sur', 'Atlético Puente Alto', 'SD Robledal', 'CE Barranc', 'Racing Olivar', 'UD Mirador', 'CF Las Dunas', 'CD Encinar', 'SD Rocafort Nou', 'Unión Albada'];
  function genCode(r) { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(r() * A.length)]; return s; }

  function defaultConfig(over) {
    return Object.assign({ teams: 4, doubleRound: false, minutes: 90, difficulty: 'medio', sessionsPerWeek: 4, deadlineDays: 5, pointsWin: 3, pointsDraw: 1, mode: 'asíncrono', evaluation: 'rúbrica 100', weights: clone(TC.DEFAULT_WEIGHTS) }, over || {});
  }
  function createCompetition(opts) {
    const u = currentUser();
    if (!u || u.role !== 'teacher') err('Sólo un profesor puede crear competiciones.');
    const d = load();
    const cfg = defaultConfig(opts.config);
    cfg.teams = Math.max(2, Math.min(20, +cfg.teams || 4));
    const name = (opts.name || '').trim(); if (name.length < 3) err('Pon un nombre a la competición.');
    const seed = opts.seed || uid('s');
    const r = TC.makeRng('comp:' + seed);
    let code; do code = genCode(r); while (d.competitions.some((c) => c.code === code));
    const comp = { id: uid('c'), name, className: opts.className || '', code, ownerId: u.id, config: cfg, status: 'active', currentRound: 1, createdAt: now(), demo: !!opts.demo, seed, events: [], challenges: [] };
    d.competitions.push(comp);
    const usedNames = new Set();
    const names = r.shuffle(NAMES);
    for (let i = 0; i < cfg.teams; i++) {
      const tname = (opts.teamNames && opts.teamNames[i]) || names[i % names.length] + (i >= names.length ? ' B' : '');
      const team = {
        id: uid('t'), compId: comp.id, name: tname, short: tname.replace(/^(CF|UD|CD|SD|CE)\s/, '').slice(0, 3).toUpperCase(), color: COLORS[i % COLORS.length],
        coachId: null, ai: true, players: TC.genSquad(seed + ':' + i, usedNames), model: TC.defaultModel(), boards: [], customTasks: [],
        indicators: Object.fromEntries(TC.INDICATORS.map((x) => [x[0], TC.IND_START])), indicatorHistory: [], createdAt: now(),
      };
      d.teams.push(team);
    }
    // calendario
    const ids = teamsOf(comp.id).map((t) => t.id);
    const sched = TC.roundRobin(r.shuffle(ids), cfg.doubleRound);
    cfg.rounds = sched.length;
    sched.forEach((pairs, i) => {
      d.rounds.push({ id: uid('r'), compId: comp.id, number: i + 1, status: i === 0 ? 'open' : 'locked', openedAt: i === 0 ? now() : null, challenge: null });
      pairs.forEach(([h, a]) => d.matches.push({ id: uid('m'), compId: comp.id, round: i + 1, homeId: h, awayId: a, status: 'scheduled', seed: comp.seed + ':' + (i + 1) + ':' + h.slice(-5) + a.slice(-5), result: null }));
    });
    addLog(comp.id, null, 'competicion', `Competición «${name}» creada con ${cfg.teams} equipos y ${cfg.rounds} jornadas.`);
    save();
    return comp;
  }
  function updateConfig(compId, patch) {
    const comp = getComp(compId); assertOwner(comp);
    Object.assign(comp.config, patch); save(); return comp;
  }
  function joinWithCode(code, teamId) {
    const u = currentUser(); if (!u || u.role !== 'student') err('Entra como alumno para unirte con un código.');
    const d = load();
    const comp = d.competitions.find((c) => c.code === (code || '').trim().toUpperCase());
    if (!comp) err('No existe ninguna competición con ese código.');
    if (d.teams.some((t) => t.compId === comp.id && t.coachId === u.id)) err('Ya diriges un equipo en esta competición.');
    let team = teamId ? d.teams.find((t) => t.id === teamId && t.compId === comp.id) : d.teams.find((t) => t.compId === comp.id && !t.coachId);
    if (!team || team.coachId) err('No quedan equipos libres en esta competición.');
    team.coachId = u.id; team.ai = false;
    addLog(comp.id, team.id, 'alta', `${u.name} toma el mando de ${team.name}.`);
    save(); return team;
  }
  function assignTeam(teamId, userId) {
    const team = getTeam(teamId); const comp = getComp(team.compId); assertOwner(comp);
    const d = load();
    if (userId && d.teams.some((t) => t.compId === comp.id && t.coachId === userId && t.id !== teamId)) err('Ese alumno ya dirige otro equipo de esta competición.');
    team.coachId = userId || null; team.ai = !userId; save();
  }
  function freeTeams(code) { const d = load(); const comp = d.competitions.find((c) => c.code === (code || '').trim().toUpperCase()); return comp ? { comp, teams: d.teams.filter((t) => t.compId === comp.id && !t.coachId) } : null; }

  /* ───────── Gestión del equipo ───────── */
  function updateTeamIdentity(teamId, patch) {
    const team = getTeam(teamId); assertTeam(team);
    if (patch.name != null) { const n = patch.name.trim(); if (n.length < 3) err('El nombre del equipo es demasiado corto.'); team.name = n; }
    if (patch.short != null) team.short = patch.short.trim().slice(0, 3).toUpperCase();
    if (patch.color) team.color = patch.color;
    save(); return team;
  }
  function saveModel(teamId, model) {
    const team = getTeam(teamId); assertTeam(team);
    team.model = Object.assign(TC.defaultModel(), model, { updatedAt: now(), submittedAt: team.model.submittedAt || null, validation: team.model.validation || null });
    team.modelVersions = (team.modelVersions || []).concat([{ at: now(), model: clone(team.model) }]).slice(-20);
    addLog(team.compId, team.id, 'modelo', 'Modelo de juego guardado.');
    save(); return team.model;
  }
  function markSquadSeen(teamId) { const team = getTeam(teamId); assertTeam(team); if (!team.squadSeenAt) { team.squadSeenAt = now(); addLog(team.compId, team.id, 'plantilla', 'Ha revisado la presentación de su plantilla.'); save(); } }
  // Qué falta en el cuaderno del modelo para poder presentarlo
  function modelMissing(m) {
    const w = Object.assign(TC.blankWork(), m.work || {}); m.work = w;
    const out = []; const len = (x) => (x || '').trim().length;
    const LN = { def: 'línea defensiva', mid: 'línea de medios', att: 'línea de delanteros' };
    for (const k of ['def', 'mid', 'att']) if (len(w.lines[k]) < 40) out.push(`Características de la ${LN[k]} (mínimo 40 caracteres)`);
    if (w.ideas.filter((x) => len(x) >= 5).length < 3) out.push('Idea de juego: al menos 3 de las 5 ideas');
    if (len(w.systemText) < 20) out.push('Sistema de juego: explica por qué este sistema (mínimo 20 caracteres)');
    for (const g of Object.values(TC.MODEL_MOMENTS)) for (const [k, l] of g.moments) {
      const items = TC.momentItems(w.moments[k]);
      const filled = (x) => len(x.fund) || len(x.expl) || (x.players || []).length;
      const used = items.filter(filled); const check = used.length ? used : [items[0]];
      const miss = [];
      check.forEach((mo, j) => { const pre = check.length > 1 ? `nº ${j + 1} ` : ''; if (len(mo.fund) < 3) miss.push(pre + 'fundamento'); if (len(mo.expl) < 30) miss.push(pre + 'explicación (mín. 30)'); if (!(mo.players || []).length) miss.push(pre + 'jugadores'); });
      if (miss.length) out.push(`${l}: ${miss.join(', ')}`);
    }
    return out;
  }
  // Cuaderno del alumno: DAFO de cada jugador y su pizarra de plantilla (se guarda aparte del equipo)
  const NB = (teamId) => teamId + ':0';
  function getNotebook(teamId) { const d = load(); return d.drafts[NB(teamId)] || { dafo: {}, board: { formation: null, slots: [] }, updatedAt: null }; }
  function saveNotebook(teamId, patch) {
    const team = getTeam(teamId); assertTeam(team);
    const d = load(); const cur = getNotebook(teamId);
    d.drafts[NB(teamId)] = Object.assign({}, cur, clone(patch), { updatedAt: now() });
    save(); return d.drafts[NB(teamId)];
  }
  function saveDafo(teamId, playerId, dafo) {
    const nb = getNotebook(teamId); const all = Object.assign({}, nb.dafo || {});
    all[playerId] = { f: dafo.f || '', d: dafo.d || '', a: dafo.a || '', o: dafo.o || '', at: now() };
    return saveNotebook(teamId, { dafo: all });
  }
  // Presentar el modelo: exige justificación y guarda la validación contra la plantilla real
  function submitModel(teamId, model) {
    const team = getTeam(teamId); assertTeam(team);
    const m = Object.assign(TC.defaultModel(), model);
    const missing = modelMissing(m);
    if (missing.length) err('Para presentar el modelo falta:\n• ' + missing.slice(0, 12).join('\n• ') + (missing.length > 12 ? `\n• … y ${missing.length - 12} apartados más` : ''));
    m.identity = m.work.ideas.filter((x) => x.trim()).join(' · ');
    const validation = TC.validateModel(m, team.players);
    m.updatedAt = now(); m.submittedAt = now(); m.validation = validation;
    team.model = m;
    team.modelVersions = (team.modelVersions || []).concat([{ at: now(), model: clone(m), submitted: true }]).slice(-20);
    addLog(team.compId, team.id, 'modelo', `Modelo de juego presentado (validación ${validation.score}/100).`);
    save(); return validation;
  }
  function saveBoards(teamId, boards) { const team = getTeam(teamId); assertTeam(team); team.boards = boards; save(); }
  function saveCustomTask(teamId, task) {
    const team = getTeam(teamId); assertTeam(team);
    const t = clone(task); t.id = t.id && team.customTasks.some((x) => x.id === t.id) ? t.id : uid('task');
    team.customTasks = team.customTasks.filter((x) => x.id !== t.id).concat([t]); save(); return t;
  }
  function deleteCustomTask(teamId, id) { const team = getTeam(teamId); assertTeam(team); team.customTasks = team.customTasks.filter((x) => x.id !== id); save(); }
  function setPlayerAttr(teamId, playerId, attr, value) {
    const team = getTeam(teamId); const comp = getComp(team.compId); assertOwner(comp);
    const p = team.players.find((x) => x.id === playerId); if (!p) err('Jugador no encontrado.');
    p.attrs[attr] = Math.max(1, Math.min(100, Math.round(+value)));
    addLog(comp.id, team.id, 'profesor', `Atributo ${TC.ATTR_LABEL[attr]} de ${p.name} ajustado a ${p.attrs[attr]}.`); save();
  }

  /* ───────── Borradores semanales ───────── */
  function blankDraft(team, round) {
    const comp = getComp(team.compId);
    const n = comp.config.sessionsPerWeek;
    const days = n >= 5 ? TC.DAYS : n === 4 ? ['Lunes', 'Martes', 'Miércoles', 'Viernes'] : n === 3 ? ['Martes', 'Miércoles', 'Viernes'] : TC.DAYS.slice(0, n);
    return {
      microcycle: { sessions: days.map((day) => ({ id: uid('s'), day, type: 'Táctica ofensiva', objective: '', secondary: [], contents: '', duration: 90, intensity: 5, rivalLink: '', modelLink: '', tasks: [] })), justification: '' },
      plan: { tactics: { attStructure: team.model.attStructure, buildUp: team.model.buildUp, blockHeight: team.model.blockHeight, pressType: team.model.pressType, pressOrientation: team.model.pressOrientation, progression: team.model.progression, width: team.model.width, tempo: team.model.tempo, afterLoss: team.model.afterLoss, afterRecovery: team.model.afterRecovery, risk: 3 }, sections: {}, conditions: [], linkedSessions: [] },
      lineup: TC.autoLineup(team.players, team.model.defStructure),
      updatedAt: null, round,
    };
  }
  function getDraft(teamId, round) {
    const d = load(); const team = getTeam(teamId); const k = teamId + ':' + round;
    if (!d.drafts[k]) { d.drafts[k] = blankDraft(team, round); }
    return d.drafts[k];
  }
  function saveDraft(teamId, round, patch) {
    const team = getTeam(teamId); assertTeam(team);
    const comp = getComp(team.compId); const rd = roundOf(comp.id, round);
    if (!rd || rd.status === 'played') err('Esta jornada ya se ha disputado: el plan no se puede modificar.');
    const dr = getDraft(teamId, round);
    Object.assign(dr, clone(patch), { updatedAt: now() });
    save(); return dr;
  }
  function validateForSubmit(team, dr) {
    const errs = [];
    const comp = getComp(team.compId);
    const sessions = dr.microcycle.sessions || [];
    if (sessions.length < comp.config.sessionsPerWeek) errs.push(`El profesor pide ${comp.config.sessionsPerWeek} sesiones.`);
    sessions.forEach((s) => { if (s.type !== 'Descanso' && !s.objective) errs.push(`${s.day}: falta el objetivo principal.`); });
    if (!sessions.some((s) => (s.tasks || []).length)) errs.push('Ninguna sesión tiene tareas.');
    if (!(dr.plan.linkedSessions || []).length || ((dr.plan.sections || {}).relacion || '').trim().length < 20) errs.push('Plan de partido, apartado H: vincula sesiones y explica la relación con el entrenamiento (obligatorio).');
    const ids = dr.lineup.slots.filter(Boolean);
    if (ids.length < 11 || new Set(ids).size < 11) errs.push('La alineación necesita 11 jugadores distintos.');
    return errs;
  }
  // Entrega definitiva: crea una versión bloqueada que es la que usará el simulador.
  function submit(teamId, round) {
    const team = getTeam(teamId); const u = assertTeam(team);
    const comp = getComp(team.compId); const rd = roundOf(comp.id, round);
    if (!rd || rd.status !== 'open') err('La jornada no está abierta para entregas.');
    const dr = getDraft(teamId, round);
    const errs = validateForSubmit(team, dr);
    if (errs.length) err('No se puede entregar todavía:\n• ' + errs.join('\n• '));
    const sub = makeSubmission(team, round, dr, false);
    addLog(comp.id, team.id, 'entrega', `${u.name} entrega la jornada ${round} (versión ${sub.version}).`);
    save(); return sub;
  }
  function makeSubmission(team, round, dr, auto, noTraining) {
    const d = load();
    const prev = lastSubmission(team.id, round);
    const micro = clone(dr.microcycle);
    const microEval = TC.evaluateMicrocycle(micro, team.model, { sessionsRequired: getComp(team.compId).config.sessionsPerWeek, afterMatch: round > 1 });
    const sub = {
      id: uid('sub'), teamId: team.id, compId: team.compId, round, version: prev ? prev.version + 1 : 1, submittedAt: now(), locked: true, auto: !!auto, noTraining: !!noTraining,
      snapshot: { model: clone(team.model), microcycle: micro, plan: clone(dr.plan), lineup: clone(dr.lineup) },
      evals: {
        micro: Object.assign({}, microEval, { sessions: undefined }),
        plan: TC.evaluatePlan(dr.plan, team.model, micro, team),
        coherence: TC.evaluateCoherence(dr.plan, team.model, micro, team, microEval),
      },
    };
    d.submissions.push(sub); return sub;
  }

  /* ───────── Equipos gestionados por el sistema ───────── */
  function autoWeek(team, round, quality) {
    const comp = getComp(team.compId);
    const dr = blankDraft(team, round);
    const r = TC.makeRng('auto:' + team.id + ':' + round);
    const rel = TC.modelRelevance(team.model);
    const ranked = Object.entries(rel).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const lib = TC.TASK_LIBRARY;
    dr.microcycle.sessions.forEach((s, i) => {
      const last = i === dr.microcycle.sessions.length - 1;
      const obj = last ? (r() < 0.5 ? 'abpOf' : 'abpDef') : quality === 'basico' ? r.pick(TC.INDICATORS)[0] : ranked[i % Math.min(4, ranked.length)];
      s.objective = obj; s.type = last ? 'Activación y estrategia' : i === 0 && round > 1 ? 'Análisis y recuperación' : /presion|bloque|transDef/.test(obj) ? 'Táctica defensiva' : 'Táctica ofensiva';
      s.intensity = last ? 4 : i === 0 && round > 1 ? 4 : 7; s.duration = last ? 70 : 90;
      s.rivalLink = quality === 'avanzado' ? 'Ajustado al rival según el informe de scouting.' : '';
      const cands = lib.filter((t) => t.objective === obj);
      const pool = cands.length ? cands : lib;
      const n = last ? 1 : 2;
      s.tasks = [];
      for (let k = 0; k < n; k++) { const t = clone(quality === 'basico' ? r.pick(lib) : pool[k % pool.length]); t.id = uid('task'); s.tasks.push(t); }
    });
    dr.microcycle.justification = 'Planificación generada automáticamente a partir del modelo de juego del equipo.';
    dr.plan.sections = { fortalezas: 'Equipo gestionado por el sistema.', objetivos: 'Aplicar el modelo de juego propio.', relacion: 'Sesiones de la semana vinculadas al modelo.', escenarios: 'Instrucciones estándar.' };
    dr.plan.linkedSessions = dr.microcycle.sessions.map((s) => s.id);
    dr.plan.conditions = [{ when: 'perdiendo', from: 65, action: 'mas_riesgo' }, { when: 'ganando', from: 75, action: 'menos_riesgo' }];
    void comp;
    return dr;
  }

  /* ───────── Jornadas ───────── */
  function roundStatus(compId, n) {
    const ms = matchesOf(compId, n);
    const teams = teamsOf(compId);
    return teams.filter((t) => ms.some((m) => m.homeId === t.id || m.awayId === t.id)).map((t) => ({ team: t, sub: lastSubmission(t.id, n) }));
  }
  function snapshotFor(team, sub) {
    const s = clone(sub.snapshot);
    s.players = clone(team.players);
    s.indicators = clone(team.indicators);
    return s;
  }
  function playRound(compId) {
    const comp = getComp(compId); assertOwner(comp);
    const d = load();
    const n = comp.currentRound; const rd = roundOf(compId, n);
    if (!rd || rd.status !== 'open') err('No hay ninguna jornada abierta.');
    const quality = comp.config.difficulty === 'alto' ? 'avanzado' : comp.config.difficulty === 'bajo' ? 'basico' : 'medio';
    const ms = matchesOf(compId, n);
    const alerts = [];
    // 1) asegurar entregas (equipos del sistema o sin entrega)
    for (const team of teamsOf(compId)) {
      if (!ms.some((m) => m.homeId === team.id || m.awayId === team.id)) continue;
      if (!lastSubmission(team.id, n)) {
        if (team.ai) makeSubmission(team, n, autoWeek(team, n, quality), true);
        else {
          const dr = blankDraft(team, n); dr.microcycle.sessions = []; dr.plan.sections = { relacion: 'Sin entrega del alumno.' };
          makeSubmission(team, n, dr, true, true);
          alerts.push(`${team.name} no entregó: juega con su modelo, alineación automática y sin efecto de entrenamiento.`);
        }
      }
    }
    // 2) aplicar aprendizaje del microciclo y fatiga
    for (const team of teamsOf(compId)) {
      const sub = lastSubmission(team.id, n); if (!sub) continue;
      const before = clone(team.indicators);
      const microEval = TC.evaluateMicrocycle(sub.snapshot.microcycle, sub.snapshot.model, { sessionsRequired: comp.config.sessionsPerWeek, afterMatch: n > 1 });
      const learn = TC.computeLearning(team.indicators, sub.snapshot.microcycle, microEval);
      team.indicators = learn.indicators;
      team.indicatorHistory.push({ round: n, before, after: clone(team.indicators), log: learn.log, coherenceFactor: learn.coherenceFactor, fatiguePenalty: learn.fatiguePenalty });
      sub.learning = { before, after: clone(team.indicators), log: learn.log };
      const wl = sub.evals.micro.fatigueLoad || 0.6;
      for (const p of team.players) p.fatigue = Math.round(TC.clamp(p.fatigue * 0.35 + wl * 14, 0, 100));
    }
    // 3) simular
    for (const m of ms) {
      const home = getTeam(m.homeId), away = getTeam(m.awayId);
      const hs = lastSubmission(home.id, n), as = lastSubmission(away.id, n);
      const input = { seed: m.seed, minutes: 90, weights: comp.config.weights, home: { team: home, snap: snapshotFor(home, hs) }, away: { team: away, snap: snapshotFor(away, as) } };
      const res = TC.simulateMatch(input);
      m.input = { home: slimSnap(input.home.snap), away: slimSnap(input.away.snap), weights: clone(input.weights) }; // copia exacta para reproducir
      const stored = Object.assign({}, res); delete stored.sequences; seqCache[m.id] = res.sequences;
      m.result = stored; m.status = 'played'; m.playedAt = now(); m.submissionIds = { h: hs.id, a: as.id };
      postMatchUpdate(home, res, 'h'); postMatchUpdate(away, res, 'a');
      for (const [team, sub, k] of [[home, hs, 'h'], [away, as, 'a']]) proposeEvaluation(comp, team, sub, m, k);
      addLog(compId, null, 'partido', `J${n}: ${home.name} ${res.score[0]}-${res.score[1]} ${away.name}`);
    }
    rd.status = 'played'; rd.playedAt = now(); rd.alerts = alerts;
    save();
    return { round: n, alerts };
  }
  // Copia mínima de lo que usa el simulador (los jugadores, en formato compacto)
  function slimSnap(s) {
    const ids = new Set(s.lineup.slots.concat(s.lineup.bench || []));
    return { model: s.model, plan: { tactics: s.plan.tactics, conditions: s.plan.conditions }, lineup: s.lineup, indicators: s.indicators,
      players: s.players.filter((p) => ids.has(p.id)).map((p) => [p.id, p.name, p.pos, p.sec, TC.ALL_ATTRS.map((a) => p.attrs[a]), p.fatigue, p.confidence]) };
  }
  function expandSnap(s) {
    return Object.assign({}, s, { players: s.players.map((a) => (Array.isArray(a) ? { id: a[0], name: a[1], pos: a[2], sec: a[3], attrs: Object.fromEntries(TC.ALL_ATTRS.map((k, i) => [k, a[4][i]])), fatigue: a[5], confidence: a[6] } : a)) });
  }
  const seqCache = {};
  function rerun(m) {
    const home = getTeam(m.homeId), away = getTeam(m.awayId);
    return TC.simulateMatch({ seed: m.seed, minutes: 90, weights: m.input.weights, home: { team: home, snap: expandSnap(m.input.home) }, away: { team: away, snap: expandSnap(m.input.away) } });
  }
  // Las secuencias no se guardan: se regeneran de forma exacta a partir de la entrada bloqueada y la semilla.
  function matchSequences(matchId) {
    const m = getMatch(matchId); if (!m || !m.input) return [];
    if (!seqCache[m.id]) seqCache[m.id] = rerun(m).sequences;
    return seqCache[m.id];
  }
  function postMatchUpdate(team, res, k) {
    const energy = res.finalEnergy[k];
    for (const p of team.players) {
      const pr = res.playerRatings[p.id];
      if (pr) {
        p.fatigue = Math.round(TC.clamp(p.fatigue + (100 - (energy[p.id] || 70)) * 0.5, 0, 100));
        p.form = (p.form || []).concat([pr.rating]).slice(-5);
        p.confidence = Math.round(TC.clamp(p.confidence + (pr.rating - 6.5) * 4, 20, 95));
      } else p.fatigue = Math.round(p.fatigue * 0.6);
    }
  }
  function unlockNextRound(compId) {
    const comp = getComp(compId); assertOwner(comp);
    const rd = roundOf(compId, comp.currentRound);
    if (!rd || rd.status !== 'played') err('Primero hay que disputar la jornada actual.');
    const next = roundOf(compId, comp.currentRound + 1);
    if (!next) { comp.status = 'finished'; addLog(compId, null, 'competicion', 'Competición finalizada.'); save(); return null; }
    comp.currentRound++; next.status = 'open'; next.openedAt = now();
    addLog(compId, null, 'jornada', `Jornada ${next.number} abierta para entregas.`);
    save(); return next;
  }
  function resetCompetition(compId) {
    const comp = getComp(compId); assertOwner(comp);
    const d = load();
    const teamIds = new Set(teamsOf(compId).map((t) => t.id));
    d.submissions = d.submissions.filter((s) => s.compId !== compId);
    d.evaluations = d.evaluations.filter((e) => e.compId !== compId);
    d.reflections = d.reflections.filter((r) => !teamIds.has(r.teamId));
    for (const k of Object.keys(d.drafts)) if (teamIds.has(k.split(':')[0])) delete d.drafts[k];
    for (const m of matchesOf(compId)) { m.status = 'scheduled'; m.result = null; m.input = null; }
    for (const r of roundsOf(compId)) { r.status = r.number === 1 ? 'open' : 'locked'; r.alerts = null; }
    let i = 0;
    const usedNames = new Set();
    for (const t of teamsOf(compId)) { t.indicators = Object.fromEntries(TC.INDICATORS.map((x) => [x[0], TC.IND_START])); t.indicatorHistory = []; t.players = TC.genSquad(comp.seed + ':' + i++, usedNames); }
    comp.currentRound = 1; comp.status = 'active';
    addLog(compId, null, 'competicion', 'Competición reiniciada.');
    save();
  }
  function deleteCompetition(compId) {
    const comp = getComp(compId); assertOwner(comp);
    const d = load(); const teamIds = new Set(teamsOf(compId).map((t) => t.id));
    d.competitions = d.competitions.filter((c) => c.id !== compId);
    d.teams = d.teams.filter((t) => t.compId !== compId);
    d.rounds = d.rounds.filter((r) => r.compId !== compId);
    d.matches = d.matches.filter((m) => m.compId !== compId);
    d.submissions = d.submissions.filter((s) => s.compId !== compId);
    d.evaluations = d.evaluations.filter((e) => e.compId !== compId);
    d.reflections = d.reflections.filter((r) => !teamIds.has(r.teamId));
    for (const k of Object.keys(d.drafts)) if (teamIds.has(k.split(':')[0])) delete d.drafts[k];
    save();
  }
  // Repite el cálculo con los mismos datos y semilla para demostrar reproducibilidad
  function verifyMatch(matchId) {
    const m = getMatch(matchId); if (!m || !m.input) err('El partido no se ha disputado.');
    const res = rerun(m);
    return { same: JSON.stringify(res.stats) === JSON.stringify(m.result.stats) && res.score.join() === m.result.score.join(), score: res.score };
  }
  // Partido amistoso de prueba: usa los borradores actuales, no cuenta para la clasificación ni se guarda.
  function friendly(teamId, rivalId, seed) {
    const team = getTeam(teamId), rival = getTeam(rivalId);
    const comp = getComp(team.compId);
    const n = comp.currentRound;
    const dr = getDraft(teamId, n);
    const mine = { model: team.model, plan: dr.plan, lineup: dr.lineup, players: team.players, indicators: team.indicators };
    const quality = 'medio';
    const rs = lastSubmission(rivalId, n);
    const rdr = rs ? rs.snapshot : autoWeek(rival, n, quality);
    const theirs = { model: rival.model, plan: rdr.plan, lineup: rdr.lineup, players: rival.players, indicators: rival.indicators };
    return TC.simulateMatch({ seed: seed || 'amistoso:' + Date.now(), minutes: 90, weights: comp.config.weights, home: { team, snap: mine }, away: { team: rival, snap: theirs } });
  }

  /* ───────── Clasificación y ranking ───────── */
  function standings(compId) {
    const comp = getComp(compId);
    const rows = Object.fromEntries(teamsOf(compId).map((t) => [t.id, { team: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0, form: [] }]));
    for (const m of matchesOf(compId).filter((x) => x.status === 'played').sort((a, b) => a.round - b.round)) {
      const [hg, ag] = m.result.score; const H = rows[m.homeId], A = rows[m.awayId];
      H.pj++; A.pj++; H.gf += hg; H.gc += ag; A.gf += ag; A.gc += hg;
      if (hg > ag) { H.g++; A.p++; H.pts += comp.config.pointsWin; H.form.push('V'); A.form.push('D'); }
      else if (hg < ag) { A.g++; H.p++; A.pts += comp.config.pointsWin; A.form.push('V'); H.form.push('D'); }
      else { H.e++; A.e++; H.pts += comp.config.pointsDraw; A.pts += comp.config.pointsDraw; H.form.push('E'); A.form.push('E'); }
    }
    return Object.values(rows).map((r) => ((r.dg = r.gf - r.gc), r)).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
  }
  function academicRanking(compId) {
    const d = load();
    return teamsOf(compId).filter((t) => t.coachId).map((t) => {
      const evs = d.evaluations.filter((e) => e.teamId === t.id);
      const sc = (e) => (e.final ? e.final.scores : e.proposal.scores);
      const avgK = (k) => (evs.length ? TC.round1(TC.avg(evs.map((e) => sc(e)[k] || 0))) : 0);
      const total = evs.length ? TC.round1(TC.avg(evs.map((e) => Object.values(sc(e)).reduce((x, y) => x + y, 0)))) : 0;
      const coach = d.users.find((u) => u.id === t.coachId);
      return { team: t, coach, n: evs.length, reviewed: evs.filter((e) => e.final).length, micro: avgK('micro'), plan: avgK('plan'), coherence: avgK('coherence'), adaptation: avgK('adaptation'), analysis: avgK('analysis'), total };
    }).sort((a, b) => b.total - a.total);
  }
  const LEVELS = [[0, 'Entrenador principiante'], [45, 'Entrenador en desarrollo'], [60, 'Entrenador táctico'], [72, 'Entrenador avanzado'], [85, 'Entrenador experto']];
  function coachLevel(total) { let l = LEVELS[0][1]; for (const [min, name] of LEVELS) if (total >= min) l = name; return l; }

  /* ───────── Evaluación ───────── */
  function proposeEvaluation(comp, team, sub, match, k) {
    if (!team.coachId) return;
    const d = load();
    const adapt = TC.evaluateAdaptation(sub.snapshot.plan, match.result.decisions.filter((x) => x.team === k));
    const refl = d.reflections.find((r) => r.teamId === team.id && r.round === sub.round);
    const analysis = TC.evaluateReflection(refl ? refl.text : '');
    const ev = {
      id: uid('ev'), compId: comp.id, teamId: team.id, round: sub.round, submissionId: sub.id, matchId: match.id, createdAt: now(),
      proposal: {
        scores: { micro: sub.evals.micro.score25, plan: sub.evals.plan.score25, coherence: sub.evals.coherence.score20, adaptation: adapt.score20, analysis: refl ? analysis.score10 : 0 },
        criteria: { micro: sub.evals.micro.criteria, plan: sub.evals.plan.criteria, coherence: sub.evals.coherence.criteria, adaptation: adapt.criteria, analysis: analysis.criteria },
      },
      final: null,
    };
    d.evaluations = d.evaluations.filter((e) => !(e.teamId === team.id && e.round === sub.round));
    d.evaluations.push(ev);
  }
  function saveReflection(teamId, round, text) {
    const team = getTeam(teamId); assertTeam(team);
    if ((text || '').trim().length < 40) err('La reflexión debe tener al menos 40 caracteres.');
    const d = load();
    d.reflections = d.reflections.filter((r) => !(r.teamId === teamId && r.round === round));
    d.reflections.push({ teamId, round, text, at: now() });
    const ev = d.evaluations.find((e) => e.teamId === teamId && e.round === round);
    if (ev) { const a = TC.evaluateReflection(text); ev.proposal.scores.analysis = a.score10; ev.proposal.criteria.analysis = a.criteria; }
    addLog(team.compId, teamId, 'reflexion', `Reflexión de la jornada ${round} entregada.`);
    save();
  }
  function getReflection(teamId, round) { return load().reflections.find((r) => r.teamId === teamId && r.round === round) || null; }
  function saveEvaluation(evId, scores, notes) {
    const d = load(); const ev = d.evaluations.find((e) => e.id === evId); const comp = getComp(ev.compId); const u = assertOwner(comp);
    const max = { micro: 25, plan: 25, coherence: 20, adaptation: 20, analysis: 10 };
    const s = {}; for (const k of Object.keys(max)) s[k] = Math.max(0, Math.min(max[k], +scores[k] || 0));
    ev.final = { scores: s, notes: notes || {}, teacherId: u.id, at: now() };
    addLog(comp.id, ev.teamId, 'evaluacion', `Evaluación de la jornada ${ev.round} revisada por el profesor (${Object.values(s).reduce((a, b) => a + b, 0)}/100).`);
    save(); return ev;
  }
  function evaluationsFor(teamId) { return load().evaluations.filter((e) => e.teamId === teamId).sort((a, b) => a.round - b.round); }

  /* ───────── Scouting (datos observados vs hipótesis) ───────── */
  function scouting(rivalId) {
    const rival = getTeam(rivalId);
    const played = matchesOf(rival.compId).filter((m) => m.status === 'played' && (m.homeId === rivalId || m.awayId === rivalId)).sort((a, b) => a.round - b.round);
    const facts = [], hyp = [], key = [];
    const results = played.map((m) => { const k = m.homeId === rivalId ? 'h' : 'a'; const o = k === 'h' ? 'a' : 'h'; const opp = getTeam(k === 'h' ? m.awayId : m.homeId); return { round: m.round, opp: opp.name, gf: m.result.stats[k].goals, gc: m.result.stats[o].goals, k, m }; });
    if (played.length) {
      const S = (k2) => TC.avg(results.map((x) => x.m.result.stats[x.k][k2]));
      const So = (k2) => TC.avg(results.map((x) => x.m.result.stats[x.k === 'h' ? 'a' : 'h'][k2]));
      const forms = results.map((x) => (x.m.input ? x.m.input[x.k === 'h' ? 'home' : 'away'].lineup.formation : '?'));
      facts.push(`Estructura de inicio observada: ${[...new Set(forms)].join(', ')}.`);
      facts.push(`Posesión media: ${Math.round(S('possession'))}%. Remates por partido: ${TC.round1(S('shots'))} (${TC.round1(S('xg'))} xG).`);
      facts.push(`Recuperaciones en campo rival por partido: ${TC.round1(S('highRecoveries'))}. Contraataques: ${TC.round1(S('counters'))}.`);
      facts.push(`Concede ${TC.round1(So('shots'))} remates y ${TC.round1(So('xg'))} xG por partido.`);
      facts.push(`Saques de esquina a favor por partido: ${TC.round1(S('corners'))}.`);
      // tendencias derivadas de secuencias
      let ext = 0, int = 0, direct = 0, startShort = 0;
      for (const x of results) for (const s of matchSequences(x.m.id)) if (s.team === x.k) for (const st of s.steps) { if (st.k === 'progresion') { if (st.y < 25 || st.y > 75) ext++; else int++; } if (st.k === 'directo') direct++; if (st.k === 'salida') startShort++; }
      facts.push(`Progresa ${ext > int ? 'preferentemente por fuera' : 'preferentemente por dentro'} (${ext} acciones exteriores, ${int} interiores). Juego directo en ${Math.round((direct / Math.max(1, direct + startShort)) * 100)}% de los inicios.`);
      if (S('highRecoveries') >= 4) hyp.push('Es probable que vuelva a presionar alto: prepara la salida ante presión o el juego directo.');
      if (S('counters') >= 3) hyp.push('Sus contraataques son peligrosos: protege la vigilancia tras pérdida.');
      if (So('xg') > 1.4) hyp.push('Su defensa concede ocasiones de calidad: atacar los espacios que deja puede ser rentable.');
      if (S('possession') < 45) hyp.push('Podría ceder el balón y defender en bloque medio o bajo.');
      // jugadores destacados
      const tally = {};
      for (const x of results) for (const [pid, pr] of Object.entries(x.m.result.playerRatings)) if (pr.team === x.k) { tally[pid] = tally[pid] || []; tally[pid].push(pr); }
      Object.entries(tally).map(([pid, arr]) => ({ p: rival.players.find((p) => p.id === pid), r: TC.avg(arr.map((a) => a.rating)), g: arr.reduce((s2, a) => s2 + a.goals, 0) })).filter((x) => x.p).sort((a, b) => b.r - a.r).slice(0, 3).forEach((x) => key.push({ name: x.p.name, pos: x.p.pos, note: `Valoración media ${TC.round1(x.r)}${x.g ? `, ${x.g} goles` : ''} · ${x.p.profile}` }));
    } else {
      facts.push('Aún no ha disputado partidos oficiales en esta competición.');
      const m = rival.model;
      hyp.push(`En los amistosos de pretemporada se le vio con estructura ${m.defStructure} sin balón; puede cambiar.`);
      hyp.push(m.blockHeight === 'alto' ? 'Indicios de presión alta tras pérdida.' : m.blockHeight === 'bajo' ? 'Indicios de bloque bajo y salidas rápidas.' : 'Indicios de bloque medio.');
      hyp.push(m.buildUp === 'directo' ? 'Tiende a iniciar en largo.' : m.buildUp === 'corto' ? 'Intenta iniciar en corto desde el portero.' : 'Combina inicio corto y largo.');
      [...rival.players].sort((a, b) => TC.playerRating(b) - TC.playerRating(a)).slice(0, 3).forEach((p) => key.push({ name: p.name, pos: p.pos, note: `${p.profile}. Destaca en ${TC.strengthsWeaknesses(p).top.slice(0, 2).join(' y ').toLowerCase()}.` }));
    }
    return { rival, results: results.map(({ m, ...rest }) => rest), facts, hyp, key };
  }

  /* ───────── Registro de decisiones ───────── */
  function addLog(compId, teamId, kind, text) { const d = load(); d.log.push({ id: uid('l'), compId, teamId, kind, text, at: now(), by: d.session ? d.session.userId : null }); if (d.log.length > 2000) d.log = d.log.slice(-2000); }
  function logFor(compId, teamId) { return load().log.filter((l) => l.compId === compId && (!teamId || l.teamId === teamId)).slice().reverse(); }

  /* ───────── Demo ───────── */
  function resetAll() { db = emptyDb(); save(); }

  G.TCStore = {
    load, save, uid, now, clone, err, useBackend, isRemote, emptyDb,
    currentUser, register, loginAs, logout, users: () => load().users,
    requestAccess, loginWithCode, getNotebook, saveNotebook, saveDafo, modelMissing, adminExists, adminSetup, adminLogin, approveStudent, regenerateCode, setStudentStatus, markSquadSeen, submitModel,
    isOwner, canEditTeam,
    getComp, getTeam, teamsOf, roundsOf, roundOf, matchesOf, getMatch, myTeams, myCompetitions, nextMatch, lastSubmission,
    createCompetition, updateConfig, joinWithCode, assignTeam, freeTeams, deleteCompetition,
    updateTeamIdentity, saveModel, saveBoards, saveCustomTask, deleteCustomTask, setPlayerAttr,
    getDraft, saveDraft, validateForSubmit, submit, makeSubmission, autoWeek, blankDraft,
    roundStatus, playRound, matchSequences, unlockNextRound, resetCompetition, verifyMatch, friendly,
    standings, academicRanking, coachLevel, LEVELS,
    saveReflection, getReflection, saveEvaluation, evaluationsFor,
    scouting, addLog, logFor, resetAll, submissionsOf: (teamId) => load().submissions.filter((s) => s.teamId === teamId).sort((a, b) => b.round - a.round || b.version - a.version),
  };
})(typeof window !== 'undefined' ? window : globalThis);
