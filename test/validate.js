// Escenario de validación (apartado 27) + demo + reproducibilidad
const store={};globalThis.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}};
require('../js/engine.js');require('../js/store.js');require('../js/demo.js');
const TC=globalThis.TC,S=globalThis.TCStore;const assert=require('assert');
// Profesor crea competición con 4 alumnos
const prof=S.register('Profe Marta','teacher');
const comp=S.createCompetition({name:'Liga Validación',config:{teams:4,sessionsPerWeek:3}});
assert.equal(S.roundsOf(comp.id).length,3);assert.equal(S.matchesOf(comp.id,1).length,2);
// no duplicates
const pairs=S.matchesOf(comp.id).map(m=>[m.homeId,m.awayId].sort().join());assert.equal(new Set(pairs).size,pairs.length);
const students=[];
for(let i=0;i<4;i++){const u=S.register('Alumno '+(i+1),'student');const t=S.joinWithCode(comp.code);students.push({u,t});}
// permisos: alumno 2 no puede tocar el equipo 1
S.loginAs(students[1].u.id);assert.throws(()=>S.saveModel(students[0].t.id,{}));
// cada alumno prepara su semana
students.forEach(({u,t},i)=>{S.loginAs(u.id);
  S.saveModel(t.id,Object.assign({},t.model,{blockHeight:['alto','bajo','medio','alto'][i]}));
  const dr=S.getDraft(t.id,1);
  dr.microcycle.sessions.forEach((s,j)=>{s.objective=['salida','presionAlta','abpOf'][j];s.intensity=[4,7,4][j];s.tasks=[Object.assign(S.clone(TC.TASK_LIBRARY[[1,3,9][j]]),{id:'x'+j})];s.rivalLink='Relación con el rival analizada';});
  dr.plan.sections={relacion:'Martes presión alta, lunes salida y viernes estrategia ofensiva.'};dr.plan.linkedSessions=dr.microcycle.sessions.map(s=>s.id);
  S.saveDraft(t.id,1,dr);
  const sub=S.submit(t.id,1);assert.ok(sub.locked);
});
// alumno modifica después de entregar: la versión bloqueada no cambia
S.loginAs(students[0].u.id);const before=JSON.stringify(S.lastSubmission(students[0].t.id,1).snapshot.plan);
const dr0=S.getDraft(students[0].t.id,1);dr0.plan.sections.relacion='CAMBIADO DESPUES';S.saveDraft(students[0].t.id,1,dr0);
assert.equal(JSON.stringify(S.lastSubmission(students[0].t.id,1).snapshot.plan),before);
// profesor inicia la jornada
S.loginAs(prof.id);const ind0=S.clone(S.getTeam(students[0].t.id).indicators);
const res=S.playRound(comp.id);
const ms=S.matchesOf(comp.id,1);assert.ok(ms.every(m=>m.status==='played'));
const ind1=S.getTeam(students[0].t.id).indicators;console.log('salida',ind0.salida,'->',ind1.salida,'presionAlta',ind0.presionAlta,'->',ind1.presionAlta,'ocupacion',ind0.ocupacion,'->',ind1.ocupacion);
assert.ok(ind1.salida>ind0.salida&&ind1.presionAlta>ind0.presionAlta&&ind1.ocupacion<ind0.ocupacion);
ms.forEach(m=>{const r=m.result;console.log(S.getTeam(m.homeId).name,r.score.join('-'),S.getTeam(m.awayId).name,'xG',r.stats.h.xg,r.stats.a.xg);
 // stats from events
 let shots=0;S.matchSequences(m.id).forEach(s=>s.steps.forEach(st=>{if(st.k==='remate'&&s.team==='h')shots++}));assert.equal(shots,r.stats.h.shots);
 assert.ok(S.verifyMatch(m.id).same);});
const st=S.standings(comp.id);console.log(st.map(r=>r.team.name+' '+r.pts).join(' | '));assert.equal(st.reduce((a,r)=>a+r.pj,0),4);
// alumnos consultan informes y reflexionan
S.loginAs(students[0].u.id);S.saveReflection(students[0].t.id,1,'Perdimos balones en salida porque el rival presionó alto; la próxima semana trabajaré progresión ante presión con tareas de superioridad.');
// profesor puntúa
S.loginAs(prof.id);const evs=S.load().evaluations.filter(e=>e.compId===comp.id);assert.equal(evs.length,4);
console.log('propuesta',evs[0].proposal.scores);
S.saveEvaluation(evs[0].id,Object.assign({},evs[0].proposal.scores,{plan:20}),{general:'Buen trabajo'});
assert.ok(S.load().evaluations.find(e=>e.id===evs[0].id).final);
// desbloquear segunda jornada
const n=S.unlockNextRound(comp.id);assert.equal(n.number,2);assert.equal(S.getComp(comp.id).currentRound,2);
console.log('ranking',S.academicRanking(comp.id).map(r=>r.coach.name+' '+r.total).join(' | '));
console.log('scouting',S.scouting(ms[0].awayId).facts.slice(0,2));
// DEMO
const demo=TCDemo.createDemo();const dt=S.teamsOf(demo.comp.id);assert.equal(dt.length,8);assert.ok(dt.every(t=>t.players.length===20));
assert.equal(S.roundsOf(demo.comp.id).length,7);console.log('potenciales',dt.map(t=>TC.squadPotential(t.players)).join(' '));
S.loginAs(demo.coach.id);const errs=S.validateForSubmit(demo.team,S.getDraft(demo.team.id,1));console.log('demo errs',errs);
const me=TC.evaluateMicrocycle(S.getDraft(demo.team.id,1).microcycle,demo.team.model,{sessionsRequired:4});console.log('demo micro',me.score25,me.criteria.map(c=>c.k+':'+Math.round(c.s*100)).join(' '));
S.submit(demo.team.id,1);S.loginAs(demo.teacher.id);S.playRound(demo.comp.id);
for(let r=2;r<=7;r++){S.unlockNextRound(demo.comp.id);S.playRound(demo.comp.id);}
console.log(S.standings(demo.comp.id).map(r=>r.team.short+r.pts+'('+r.gf+':'+r.gc+')').join(' '));
console.log('size KB',Math.round(store['thecoach.db.v1'].length/1024));
console.log('OK');
const D=JSON.parse(store['thecoach.db.v1']);for(const k in D)console.log(k,Math.round(JSON.stringify(D[k]).length/1024));
const m=D.matches.find(x=>x.result);for(const k in m.result)console.log(' r.'+k,Math.round(JSON.stringify(m.result[k]).length/1024));console.log(' input',Math.round(JSON.stringify(m.input).length/1024));
const s=D.submissions[0];for(const k in s)console.log(' s.'+k,Math.round(JSON.stringify(s[k]).length/1024));
