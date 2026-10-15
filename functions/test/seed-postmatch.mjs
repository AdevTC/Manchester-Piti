// Isolated, deterministic fixtures. This script can only talk to local emulators.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const { initializeApp } = await import('firebase-admin/app');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');
const { calculateLedger } = await import('../lib/matchEngine.js');
initializeApp({projectId:'demo-manchester-piti'});
const db = getFirestore();
const uid = (await getAuth().getUserByEmail('admin@piti.test')).uid;
if (process.argv.includes('--cleanup')) {
  await db.doc('matches/preview-bench').update({status:'cancelled'});
  await db.terminate();
  process.exit(0);
}
const seasonId='preview-improvements-season';
const ids=Array.from({length:9},(_,i)=>`improvement-player-${i}`);
const names=['Álex','Dani','Marcos','Pablo','Sergio','David','Mario','Hugo','Lucas'];
await db.doc(`seasons/${seasonId}`).set({name:'Prueba de mejoras'});
await Promise.all(ids.map((id,i)=>db.doc(`players/${id}`).set({firstName:names[i],shirtName:names[i],number:i+1,active:true,seasons:[seasonId]})));
await db.doc(`users/${uid}`).update({playerId:ids[6]});
const base={version:2,revision:0,seasonId,rival:'Rival de prueba',date:Timestamp.fromMillis(Date.now()-7200000),duration:50,venue:'Campo de prueba',competition:'Amistoso',home:true,status:'finished',starters:ids.slice(0,7),bench:ids.slice(7),notCalled:[],events:[],goalsFor:0,goalsAgainst:0,report:''};
for(const [id,over] of [
  ['preview-balance-previous',{date:Timestamp.fromMillis(Date.parse('2026-09-20T10:00Z')),analysisCoverage:'complete',events:[{id:'s',type:'substitution',minute:30,playerId:ids[6],inPlayerId:ids[7]}]}],
  ['preview-balance',{date:Timestamp.fromMillis(Date.parse('2026-10-10T10:00Z')),goalsFor:2,analysisCoverage:'partial',events:[{id:'p1',type:'pass',minute:5,playerId:ids[3],receiverId:ids[6],outcome:'complete'},{id:'g1',type:'goal',minute:10,playerId:ids[6],assistPlayerId:ids[3]},{id:'g2',type:'goal',minute:20,playerId:ids[6],assistReviewed:true}]}],
  ['preview-bench',{status:'scheduled',date:Timestamp.fromMillis(Date.now()-600000),clock:{phase:'first',revision:1,firstStartedAt:Date.now()-600000}}],
]) {
  const match={...base,...over};
  await db.doc(`matches/${id}`).set({...match,...(match.status==='finished' ? {ledger:calculateLedger(match).players} : {})});
  await db.doc(`matchDrafts/${id}`).delete();
  await db.doc(`matchPrivate/${id}`).set({scorerUids:[]});
}
await db.doc(`matchPrivate/preview-balance/predictions/${uid}`).set({name:'Capitán',goalsFor:2,goalsAgainst:0,goals:[{playerId:ids[6],assistPlayerId:ids[3]},{playerId:ids[6],assistPlayerId:null}]});
await db.doc('matchPrivate/preview-balance-previous/predictions/another-member').set({name:'Otro socio',goalsFor:0,goalsAgainst:0});
console.log('Pruebas locales preparadas: resumen, historial y banquillo.');
await db.terminate();
