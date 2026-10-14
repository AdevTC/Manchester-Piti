// Isolated demo-only integration: real callable transactions and Auth emulator tokens.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
const { clockReading } = await import("../lib/matchClock.js");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore(), suffix = Date.now().toString(36);
let checks = 0;
async function person(label, role = "user") {
  const enc = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = enc({alg:"none",typ:"JWT"})+"."+enc({sub:`${label}-${suffix}`,email:`${label}-${suffix}@example.test`,email_verified:true,name:label,aud:"demo",iss:"https://accounts.google.com"})+".";
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({postBody:new URLSearchParams({id_token:jwt,providerId:"google.com"}).toString(),requestUri:"http://localhost",returnSecureToken:true})});
  const u = await r.json(); assert.ok(u.idToken);
  await db.doc(`users/${u.localId}`).set({role,nickname:label});
  await db.doc(`teamMembers/${u.localId}`).set({expiresAt:Timestamp.fromMillis(Date.now()+86_400_000)});
  return {uid:u.localId,token:u.idToken};
}
async function call(name, who, data) {
  const r = await fetch(`http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/${name}`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${who.token}`},body:JSON.stringify({data})});
  return r.json();
}
async function ok(name,who,data) {const r=await call(name,who,data);assert.ok(!r.error,JSON.stringify(r));checks++;return r.result;}
async function denied(name,who,data,status) {const r=await call(name,who,data);assert.equal(r.error?.status,status,JSON.stringify(r));checks++;}
const admin=await person("clock-admin","admin"), scorer=await person("scorer"), outsider=await person("viewer");
const seasonId=`analysis-season-${suffix}`, matchId=`analysis-match-${suffix}`, ids=Array.from({length:8},(_,i)=>`analysis-${suffix}-${i}`);
await db.doc(`seasons/${seasonId}`).set({name:"Análisis · pruebas"});
await Promise.all(ids.map(id=>db.doc(`players/${id}`).set({firstName:id,seasons:[seasonId]})));
let sheet={version:2,revision:0,seasonId,rival:"Rival de prueba",competition:"Amistoso",date:Date.now()+3600_000,duration:50,venue:"Pruebas",home:true,status:"scheduled",starters:ids.slice(0,7),bench:[ids[7]],notCalled:[],events:[],report:""};
const ref=db.doc(`matches/${matchId}`);
const snap=async()=> (await ref.get()).data();
await ok("saveMatchSheet",admin,{id:matchId,sheet});
await denied("controlMatchClock",outsider,{matchId,action:"start",revision:0},"PERMISSION_DENIED");
await denied("setMatchScorers",scorer,{matchId,uids:[scorer.uid]},"PERMISSION_DENIED");
await ok("setMatchScorers",admin,{matchId,uids:[scorer.uid]});
// Two people start at once: exactly one succeeds, no reset of the timestamp.
const race=await Promise.all([admin,scorer].map(who=>call("controlMatchClock",who,{matchId,action:"start",revision:0})));
assert.equal(race.filter(r=>!r.error).length,1);assert.equal(race.find(r=>r.error).error.status,"ABORTED");checks+=2;
let m=await snap();assert.equal(m.clock.phase,"first");checks++;
{const t0=Date.now();const r=await ok("controlMatchClock",scorer,{matchId,action:"reset",revision:m.clock.revision});
// The answer carries the server's clock (phones estimate their offset from it) and the new clock.
assert.equal(typeof r.serverNow,"number");assert.ok(Math.abs(r.serverNow-t0)<60_000);assert.equal(r.clock.phase,"ready");checks+=3;}
m=await snap();assert.equal(m.clock.phase,"ready");checks++;
await ok("controlMatchClock",admin,{matchId,action:"start",revision:m.clock.revision});
m=await snap();
await ref.update({"clock.firstStartedAt":Date.now()-1512_000});
const add=(id,type="corner",extra={})=>({action:"add",matchId,clockRevision:m.clock.revision,requestId:id,event:{type,minute:0,...extra}});
// Concurrent writers append to the same acta without losing either contribution.
await Promise.all(Array.from({length:12},(_,i)=>ok("liveEvent",i%2?admin:scorer,add(`parallel-${i}`,i%2?"opponent_corner":"corner"))));
assert.equal((await snap()).events.length,12);checks++;
const same=await Promise.all([admin,scorer].map(who=>ok("liveEvent",who,add("same-request","chance",{playerId:ids[1]}))));
// A retried request (already written) answers with the server's clock too.
assert.ok(same.every(r=>typeof r.serverNow==="number"));checks++;
assert.equal((await snap()).events.length,13);checks++;
await denied("controlMatchClock",scorer,{matchId,action:"reset",revision:m.clock.revision},"FAILED_PRECONDITION");
await ok("liveEvent",scorer,{...add("sub-1","substitution",{playerId:ids[0],inPlayerId:ids[7]}),manualTime:true,event:{type:"substitution",minute:10,playerId:ids[0],inPlayerId:ids[7]}});
await denied("liveEvent",scorer,add("bad-goal","goal",{playerId:ids[0]}),"FAILED_PRECONDITION");
await ok("controlMatchClock",scorer,{matchId,action:"halftime",revision:m.clock.revision});
m=await snap();const first=clockReading(m.clock,Date.now()).firstSeconds;
await denied("liveEvent",scorer,add("break-goal","goal",{playerId:ids[7]}),"FAILED_PRECONDITION");
await ok("liveEvent",scorer,add("break-sub","substitution",{playerId:ids[7],inPlayerId:ids[0]}));
assert.equal((await snap()).events.at(-1).elapsedSeconds,first);checks++;
await ref.update({"clock.firstEndedAt":Date.now()-300_000,"clock.firstStartedAt":Date.now()-300_000-first*1000});
await ok("controlMatchClock",admin,{matchId,action:"second",revision:m.clock.revision});
const oldRevision=m.clock.revision;m=await snap();
await denied("liveEvent",scorer,{...add("stale"),clockRevision:oldRevision},"ABORTED");
await ref.update({"clock.secondStartedAt":Date.now()-1507_000});
await ok("liveEvent",scorer,add("goal-1","goal",{playerId:ids[0],assistPlayerId:ids[1]}));
await ok("liveEvent",admin,add("undo-me","opponent_chance"));
await ok("liveEvent",scorer,{action:"undo",matchId,eventId:"live-undo-me"});
await denied("liveEvent",admin,{action:"undo",matchId,eventId:"live-undo-me"},"ABORTED");
assert.ok((await snap()).events.some(e=>e.id==="live-goal-1"));checks++;
await ok("controlMatchClock",scorer,{matchId,action:"finish",revision:m.clock.revision});
m=await snap();assert.equal(m.clock.phase,"ended");assert.equal(m.durationSeconds,clockReading(m.clock,Date.now()).elapsedSeconds);checks+=2;
await denied("saveMatchSheet",scorer,{id:matchId,sheet:{...sheet,revision:m.revision}},"PERMISSION_DENIED");
// Advanced events are post-match, editable, and counted only once after corrections.
const more=[
 {id:"pass-1",type:"pass",minute:1,elapsedSeconds:65,playerId:ids[0],receiverId:ids[1],outcome:"complete",source:"narration"},
 {id:"pass-2",type:"pass",minute:2,playerId:ids[0],outcome:"incomplete",source:"narration"},
 {id:"center",type:"cross",minute:3,playerId:ids[1],receiverId:ids[0],outcome:"complete",keyPass:true},
 {id:"shot",type:"shot",minute:3,playerId:ids[0],outcome:"off_target",x:40,y:22,zone:"left"},
 {id:"defense",type:"interception",playerId:ids[2],timingUnknown:true},
 {id:"rival-shot",type:"shot",minute:4,team:"opponent",outcome:"on_target"},
];
sheet={...sheet,duration:m.duration,durationSeconds:m.durationSeconds,revision:m.revision,status:"finished",events:[...m.events,...more],goalsFor:1,goalsAgainst:0,analysisCoverage:"partial"};
// The scheduled start is still in the future, but the real clock has ended.
await denied("saveMatchSheet",admin,{id:matchId,sheet:{...sheet,events:[...sheet.events,{id:"wrong-team",type:"goal",minute:5,playerId:ids[1],team:"opponent"}]}},"INVALID_ARGUMENT");
await denied("saveMatchSheet",admin,{id:matchId,sheet:{...sheet,events:[...sheet.events,{id:"wrong-assist",type:"shot",minute:5,playerId:ids[1],assistPlayerId:ids[2],outcome:"off_target"}]}},"INVALID_ARGUMENT");
await ok("saveMatchSheet",admin,{id:matchId,sheet});m=await snap();
assert.equal(m.ledger[ids[0]].passesCompleted,1);assert.equal(m.ledger[ids[0]].passesFailed,1);assert.equal(m.ledger[ids[2]].recoveries,1);checks+=3;
assert.deepEqual((await db.doc(`matchPrivate/${matchId}`).get()).get("scorerUids"),[scorer.uid]);checks++;
for(let i=0;i<2;i++){sheet={...sheet,revision:m.revision,events:sheet.events.filter(e=>e.id!=="pass-2")};await ok("saveMatchSheet",admin,{id:matchId,sheet});m=await snap();}
const totals=await db.collection("playerSeasonStats").where("seasonId","==",seasonId).get();const total=totals.docs.find(d=>d.get("playerId")===ids[0]).get("totals");
assert.equal(total.passesCompleted,1);assert.equal(total.passesFailed,0);assert.equal(total.turnovers,0);assert.equal(total.shots,2);assert.equal(total.secondsPlayed,m.ledger[ids[0]].secondsPlayed);checks+=5;
console.log(`${checks} comprobaciones: reloj, concurrencia, permisos, reintentos, descanso, segundos, importación y acumulados correctos.`);
await db.terminate();
