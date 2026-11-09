// Partido en directo: notas, respuestas, efecto en el resultado y evaluación
const store = {}; globalThis.localStorage = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } };
require('../js/engine.js'); require('../js/live.js'); require('../js/store.js');
const TC = globalThis.TC, S = globalThis.TCStore; const assert = require('assert');
S.adminSetup ? null : null;
const t0 = S.register('Profe', 'teacher'); S.loginAs(t0.id);
const comp = S.createCompetition({ name: 'Liga Directo', config: { teams: 4, sessionsPerWeek: 3 } });
S.openRound(comp.id);
const stu = S.register('Alumna', 'student'); const team = S.joinWithCode(comp.code);
S.loginAs(stu.id); S.markSquadSeen(team.id);
S.loginAs(t0.id);
assert.throws(() => S.startSecondHalf(comp.id));
const rd = S.startLive(comp.id, 1);
assert.equal(rd.status, 'live'); assert.equal(rd.live.status, 'h1');
// avanza la primera parte: 3 notas por equipo
const half = rd.live.halfSec * 1000;
for (const f of [0.2, 0.55, 0.85]) { rd.live.h1At = Date.now() - f * half; S.liveTick(comp.id); }
const notes = rd.live.notes[team.id]; assert.equal(notes.length, 3, 'tres notas en la primera parte');
console.log(notes.map((n) => `${n.min}' ${n.title}`).join(' | '));
// la alumna responde a dos notas (bien) y deja una sin responder
S.loginAs(stu.id);
assert.throws(() => S.answerNote(team.id, notes[0].id, { opt: 0, text: 'corto' }), /consigna/);
for (const n of notes.slice(0, 2)) { const best = n.options.slice().sort((a, b) => b.score - a.score)[0]; n.releasedAt = Date.now(); S.answerNote(team.id, n.id, { opt: best.i, text: 'Ayudas del extremo al lateral, basculación y vigilancias; ' + S.getTeam(team.id).players[3].name + ' cierra por dentro.' }); }
S.loginAs(t0.id);
rd.live.h1At = Date.now() - half - 1000; S.liveTick(comp.id);
assert.equal(rd.live.status, 'ht', 'descanso'); assert.ok(rd.live.notes[team.id].some((n) => n.halftime), 'charla del descanso');
S.startSecondHalf(comp.id);
for (const f of [0.2, 0.55, 0.85, 1.01]) { rd.live.h2At = Date.now() - f * half; S.liveTick(comp.id); }
assert.equal(rd.live.status, 'ft');
const feed = Object.values(rd.live.feed)[0]; console.log('marcador directo', feed.score, feed.events.length, 'eventos');
const fm = Object.keys(rd.live.feed); const liveScores = fm.map((id) => rd.live.feed[id].score.join('-'));
S.playRound(comp.id);
const ms = S.matchesOf(comp.id, 1);
const finals = fm.map((id) => ms.find((m) => m.id === id).result.score.join('-'));
assert.deepEqual(finals, liveScores, 'el resultado final coincide con el marcador del directo');
const myM = ms.find((m) => m.homeId === team.id || m.awayId === team.id); const k = myM.homeId === team.id ? 'h' : 'a';
const lv = myM.result.live[k]; console.log('valoración directo', lv.avg, lv.items.map((x) => x.eval.q));
assert.ok(lv.items.length >= 6 && lv.items.some((x) => !x.answer), 'notas evaluadas, incluidas las no respondidas');
const ev = S.load().evaluations.find((e) => e.teamId === team.id); assert.ok(ev.proposal.criteria.adaptation[0].k === 'directo', 'la evaluación incluye el directo');
// las respuestas cambian el partido: misma jornada con respuestas óptimas frente a ninguna
const notesAll = Object.values(rd.live.notes).flat(); const best = {}; for (const n of notesAll) best[n.id] = { opt: n.options.slice().sort((a, b) => b.score - a.score)[0].i, text: 'Ayudas, basculación, vigilancias, juntar líneas, amplitud y cambio de orientación con nuestros jugadores' };
const players = S.getTeam(team.id).players;
const good = TC.LIVE.effects(rd.live.notes[team.id], best, players, []); const none = TC.LIVE.effects(rd.live.notes[team.id], {}, players, []);
assert.ok(good.filter((x) => x.amount).every((x) => x.amount > 0) && none.filter((x) => x.amount).every((x) => x.amount < 0), 'buenas respuestas suman y no responder resta');
console.log('LIVE OK');
