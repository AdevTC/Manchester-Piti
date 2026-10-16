// Isolated demo-only integration: invitados en el acta through the real callables (saveMatchSheet,
// setConvocatoria, liveEvent) and the Auth emulator. A guest scores and assists for the team; no member row,
// no season total and no MVP candidate ever names him; a guest off the list, or a fifth one, is refused.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
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

const admin=await person("guest-admin","admin");
const seasonId=`guests-season-${suffix}`, ids=Array.from({length:8},(_,i)=>`guests-${suffix}-${i}`);
await db.doc(`seasons/${seasonId}`).set({name:"Invitados · pruebas"});
await Promise.all(ids.map(id=>db.doc(`players/${id}`).set({firstName:id,seasons:[seasonId]})));
const RAFA="guest:g1", guests=[{id:"g1",name:"Rafa"}];
const five=[1,2,3,4,5].map(n=>({id:`g${Math.min(n,4)}`,name:`Invitado ${n}`}));

// ---- the acta: Rafa comes on, scores (assisted by a member) and assists a member's goal
const actaId=`guests-acta-${suffix}`;
const events=[
  {id:"s1",type:"substitution",minute:10,playerId:ids[6],inPlayerId:RAFA},
  {id:"g1",type:"goal",minute:15,playerId:RAFA,assistPlayerId:ids[1],assistReviewed:true},
  {id:"g2",type:"goal",minute:20,playerId:ids[0],assistPlayerId:RAFA,assistReviewed:true},
  {id:"y1",type:"yellow_card",minute:25,playerId:RAFA},
  {id:"o1",type:"opponent_goal",minute:30},
];
const acta={version:2,revision:0,seasonId,rival:"Rival invitado",competition:"Amistoso",date:Date.now()-3*3600_000,duration:50,venue:"Pruebas",home:true,status:"finished",starters:ids.slice(0,7),bench:[ids[7],RAFA],notCalled:[],guests,events,goalsFor:2,goalsAgainst:1,report:""};
// a guest off the list, a fifth guest, a guest «no convocado», a name too long: refused before anything is written
await denied("saveMatchSheet",admin,{id:actaId,sheet:{...acta,guests:[]}},"INVALID_ARGUMENT");
await denied("saveMatchSheet",admin,{id:actaId,sheet:{...acta,guests:undefined}},"INVALID_ARGUMENT");
await denied("saveMatchSheet",admin,{id:actaId,sheet:{...acta,guests:[...guests,{id:"g2",name:"B"},{id:"g3",name:"C"},{id:"g4",name:"D"},{id:"g4",name:"E"}]}},"INVALID_ARGUMENT");
await denied("saveMatchSheet",admin,{id:actaId,sheet:{...acta,guests:[{id:"g1",name:"x".repeat(31)}]}},"INVALID_ARGUMENT");
await denied("saveMatchSheet",admin,{id:actaId,sheet:{...acta,events:[...events,{id:"g3",type:"goal",minute:40,playerId:"guest:g2",assistReviewed:true}],goalsFor:3}},"INVALID_ARGUMENT");
assert.equal((await db.doc(`matches/${actaId}`).get()).exists,false);checks++;
await ok("saveMatchSheet",admin,{id:actaId,sheet:acta});
const m=(await db.doc(`matches/${actaId}`).get()).data();
assert.deepEqual(m.guests,guests);checks++;
assert.equal(m.goalsFor,2);checks++;
assert.ok(!Object.keys(m.ledger).some(id=>id.startsWith("guest:")),"no guest row in the stored ledger");checks++;
assert.equal(m.ledger[ids[1]].assists,1);assert.equal(m.ledger[ids[1]].goals,0);checks+=2;
assert.equal(m.ledger[ids[0]].goals,1);assert.equal(m.ledger[ids[0]].assists,0);checks+=2;
const stats=await db.collection("playerSeasonStats").where("seasonId","==",seasonId).get();
assert.ok(stats.docs.every(d=>!String(d.get("playerId")).startsWith("guest:")),"no season stats for a guest");checks++;
const seasonGoals=stats.docs.reduce((s,d)=>s+(d.get("totals").goals??0),0);
assert.equal(seasonGoals,1,"the members' goals: only the member's goal");checks++;
assert.equal(stats.docs.find(d=>d.get("playerId")===ids[1]).get("totals").assists,1);checks++;

// ---- convocar: guests travel with the lineup; one off the list, or a fifth, is refused
const liveId=`guests-live-${suffix}`;
await ok("saveMatchSheet",admin,{id:liveId,sheet:{...acta,status:"scheduled",date:Date.now()+3600_000,starters:[],bench:[],notCalled:ids,guests:undefined,events:[],goalsFor:undefined,goalsAgainst:undefined}});
await denied("setConvocatoria",admin,{matchId:liveId,starters:ids.slice(0,7),bench:[ids[7],RAFA]},"INVALID_ARGUMENT");
await denied("setConvocatoria",admin,{matchId:liveId,starters:ids.slice(0,7),bench:[ids[7]],guests:five},"INVALID_ARGUMENT");
await ok("setConvocatoria",admin,{matchId:liveId,starters:ids.slice(0,7),bench:[ids[7],RAFA],guests});
const ref=db.doc(`matches/${liveId}`);
let live=(await ref.get()).data();
assert.deepEqual(live.guests,guests);assert.deepEqual(live.bench,[ids[7],RAFA]);assert.ok(!live.notCalled.includes(RAFA));checks+=3;
// a convocatoria without `guests` (the pizarra's seven, a seat change) leaves the match's guests as they are
await ok("setConvocatoria",admin,{matchId:liveId,starters:ids.slice(0,7),bench:[RAFA,ids[7]]});
live=(await ref.get()).data();
assert.deepEqual(live.guests,guests);assert.deepEqual(live.bench,[RAFA,ids[7]]);checks+=2;

// ---- a draft names only guests on its list too (saveMatchSheet checks drafts as well)
const draftId=`guests-draft-${suffix}`;
await denied("saveMatchSheet",admin,{id:draftId,draft:true,sheet:{...acta,status:"scheduled",guests:[]}},"INVALID_ARGUMENT");
await denied("saveMatchSheet",admin,{id:draftId,draft:true,sheet:{...acta,status:"scheduled",events:[...events,{id:"p9",type:"pass",minute:41,outcome:"complete",playerId:ids[0],receiverId:"guest:g3"}]}},"INVALID_ARGUMENT");
assert.equal((await db.doc(`matchDrafts/${draftId}`).get()).exists,false);checks++;

// ---- convocar can't take away a guest the acta names: published events, then a draft's
const keepId=`guests-keep-${suffix}`;
const upcomingSheet={...acta,status:"scheduled",date:Date.now()+3600_000,events:[],goalsFor:undefined,goalsAgainst:undefined};
await ok("saveMatchSheet",admin,{id:keepId,sheet:{...upcomingSheet,events:[{id:"s1",type:"substitution",minute:2,playerId:ids[6],inPlayerId:RAFA}]}});
let r=await call("setConvocatoria",admin,{matchId:keepId,starters:ids.slice(0,7),bench:[ids[7]],guests:[]});
assert.equal(r.error?.status,"FAILED_PRECONDITION",JSON.stringify(r));assert.match(r.error.message,/Rafa sale en el acta/);checks+=2;
// nor hand his id to someone else
r=await call("setConvocatoria",admin,{matchId:keepId,starters:ids.slice(0,7),bench:[ids[7]],guests:[{id:"g2",name:"Iván"}]});
assert.equal(r.error?.status,"FAILED_PRECONDITION",JSON.stringify(r));checks++;
assert.deepEqual((await db.doc(`matches/${keepId}`).get()).get("guests"),guests);checks++;
// the published acta without Rafa's play, but its draft still names him: still refused
const pubKeep=(await db.doc(`matches/${keepId}`).get()).data();
await ok("saveMatchSheet",admin,{id:keepId,sheet:{...upcomingSheet,revision:pubKeep.revision??0,events:[]}});
await ok("saveMatchSheet",admin,{id:keepId,draft:true,sheet:{...upcomingSheet,revision:(await db.doc(`matches/${keepId}`).get()).get("revision")??0,events:[{id:"g9",type:"goal",minute:5,playerId:RAFA,assistReviewed:true}]}});
r=await call("setConvocatoria",admin,{matchId:keepId,starters:ids.slice(0,7),bench:[ids[7]],guests:[]});
assert.equal(r.error?.status,"FAILED_PRECONDITION",JSON.stringify(r));checks++;
// a guest no event names can go
const freeId=`guests-free-${suffix}`;
await ok("saveMatchSheet",admin,{id:freeId,sheet:upcomingSheet});
await ok("setConvocatoria",admin,{matchId:freeId,starters:ids.slice(0,7),bench:[ids[7]],guests:[]});
assert.deepEqual((await db.doc(`matches/${freeId}`).get()).get("guests"),[]);checks++;

// ---- liveEvent: Rafa comes on and scores; a guest off the list is refused
await ok("controlMatchClock",admin,{matchId:liveId,action:"start",revision:live.clock?.revision??0});
live=(await ref.get()).data();
await ref.update({"clock.firstStartedAt":Date.now()-600_000});
const add=(id,type,extra={})=>({action:"add",matchId:liveId,clockRevision:live.clock.revision,requestId:id,event:{type,minute:0,...extra}});
await ok("liveEvent",admin,add("sub","substitution",{playerId:ids[6],inPlayerId:RAFA}));
await ok("liveEvent",admin,add("goal","goal",{playerId:RAFA,assistPlayerId:ids[1]}));
await denied("liveEvent",admin,add("ghost","goal",{playerId:"guest:g2"}),"FAILED_PRECONDITION");
live=(await ref.get()).data();
assert.ok(live.events.some(e=>e.id==="live-goal"&&e.playerId===RAFA&&e.assistPlayerId===ids[1]));checks++;
assert.equal(live.events.length,2);checks++;

console.log(`${checks} comprobaciones: el invitado marca y asiste en el acta y en directo, sin cifras de socio; invitados fuera de lista o de más, rechazados (también en borrador); un invitado con jugadas no sale de la lista.`);
await db.terminate();
