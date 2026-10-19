import { describe, expect, it } from "vitest";
import { analyseActions, actionProblem, ratio } from "../../functions/src/matchAnalysis";
import { calculateLedger, matchPhase, type MatchEvent } from "../../functions/src/matchEngine";
import { clockReading, transitionClock } from "../../functions/src/matchClock";
import { technicalAnalysis } from "./technicalAnalysis";
import { matchSnapshot } from "./ficha";
import { mergeMatches, reviewActa } from "../pages/admin/data/adminLogic";
import { previewNarration } from "./narration";
import { defaultSheet, fromMatch, setMinute, toPayload } from "../pages/admin/acta/sheetModel";

const starters = ["a","b","c","d","e","f","g"];
const sheet = defaultSheet("s", { date: 1, rival: "Rival", starters, bench:["h"], duration:50, status:"finished" });
describe("two real halves, one shared clock", () => {
  it("does not start at the scheduled time and does not finish automatically at 25 or 50", () => {
    expect(matchPhase({...sheet,status:"scheduled",version:2}, 5_000_000)).toBe("scheduled");
    const clock = transitionClock(undefined,"start",1000);
    expect(matchPhase({...sheet,status:"scheduled",clock}, 5_000_000)).toBe("playing");
    expect(clockReading(clock, 26*60_000+1000).elapsedSeconds).toBe(1560);
  });
  it("excludes the measured break and retains seconds beyond 25 minutes", () => {
    let c = transitionClock(undefined,"start",1000);
    c = transitionClock(c,"halftime",1_513_000);
    expect(clockReading(c,1_813_000)).toMatchObject({elapsedSeconds:1512,breakSeconds:300,playing:false});
    c = transitionClock(c,"second",1_813_000);
    c = transitionClock(c,"finish",3_320_000);
    expect(clockReading(c,9_000_000)).toMatchObject({elapsedSeconds:3019,firstSeconds:1512,secondSeconds:1507,breakSeconds:300});
    expect(matchPhase({...sheet,status:"scheduled",clock:c},9_000_000)).toBe("awaiting_result");
  });
  it("rejects invalid transitions and never resets recorded events", () => {
    const c = transitionClock(undefined,"start",1000);
    expect(()=>transitionClock(c,"start",2000)).toThrow();
    expect(()=>transitionClock(c,"second",2000)).toThrow();
    expect(()=>transitionClock(c,"reset",2000,[{minute:0}])).toThrow(/jugadas/);
    expect(transitionClock(c,"reset",2000)).toEqual({revision:2,phase:"ready"});
  });
  it("counts the exact played seconds through substitutions, re-entry and red cards", () => {
    const events: MatchEvent[] = [
      {id:"s1",type:"substitution",minute:12,elapsedSeconds:735,playerId:"a",inPlayerId:"h"},
      {id:"s2",type:"substitution",minute:25,elapsedSeconds:1512,playerId:"h",inPlayerId:"a"},
      {id:"r",type:"red_card",minute:40,elapsedSeconds:2421,playerId:"a"},
    ];
    const ledger = calculateLedger({...sheet, duration:51,durationSeconds:3019,events});
    expect(ledger.errors).toEqual([]);
    expect(ledger.players.a.secondsPlayed).toBe(1644);
    expect(ledger.players.h.secondsPlayed).toBe(777);
    expect(ledger.players.b.secondsPlayed).toBe(3019);
    expect(Object.values(ledger.players).reduce((n,p)=>n+p.secondsPlayed!,0)).toBe(6*3019+2421);
  });
});
describe("narrated football actions", () => {
  const events: MatchEvent[] = [
    {id:"1",type:"pass",minute:1,playerId:"a",receiverId:"b",outcome:"complete"},
    {id:"2",type:"cross",minute:2,playerId:"a",receiverId:"b",outcome:"complete",keyPass:true},
    {id:"3",type:"pass",minute:3,playerId:"a",outcome:"incomplete",delivery:"long"},
    {id:"4",type:"pass",minute:4,playerId:"a",outcome:"unknown"},
    {id:"5",type:"goal",minute:5,playerId:"b",assistPlayerId:"a"},
    {id:"6",type:"shot",minute:6,playerId:"b",outcome:"off_target"},
    {id:"7",type:"shot",minute:7,playerId:"b",outcome:"woodwork"},
    {id:"8",type:"shot",minute:8,team:"opponent",outcome:"on_target"},
    {id:"9",type:"interception",minute:9,playerId:"c"},
    {id:"10",type:"dribble",minute:10,playerId:"c",outcome:"lost"},
  ];
  it("counts subsets and derived outcomes once, including network direction", () => {
    const a = analyseActions(events);
    expect(a.players.a).toMatchObject({passes:4,passesCompleted:2,passesFailed:1,passesUnknown:1,crosses:1,keyPasses:1,turnovers:0});
    expect(a.players.b).toMatchObject({passesReceived:2,shots:3,shotsOnTarget:1,shotsOffTarget:1,shotsWoodwork:1,shotGoals:1});
    expect(a.players.c).toMatchObject({interceptions:1,recoveries:0,turnovers:0});
    expect(a.teams.opponent.shotsOnTarget).toBe(1);
    expect(a.links).toEqual([{from:"a",to:"b",count:2,crosses:1}]);
    expect(ratio(0,0)).toBeNull();
  });
  it("deduplicates ids inside a match, while counting same ids from different matches", () => {
    expect(analyseActions([...events,...events]).teams.us.passes).toBe(4);
    expect(technicalAnalysis([{id:"x",events},{id:"y",events}]).teams.us.passes).toBe(8);
  });
  it("requires a narrated loss or recovery instead of guessing the control after a failed action", () => {
    const uncertain: MatchEvent[] = [
      { id: "failed", type: "pass", playerId: "a", outcome: "incomplete" },
      { id: "cut", type: "interception", playerId: "b" },
      { id: "dribble", type: "dribble", playerId: "c", outcome: "lost" },
      { id: "clear", type: "clearance", playerId: "c" },
      { id: "block", type: "block", playerId: "b" },
    ];
    expect(analyseActions(uncertain).teams.us).toMatchObject({ passesFailed: 1, interceptions: 1, dribbles: 1, clearances: 1, blocks: 1, turnovers: 0, recoveries: 0 });
    const explicit = analyseActions([...uncertain,
      { id: "loss", type: "possession_lost", playerId: "a" },
      { id: "control", type: "recovery", playerId: "b" },
    ]);
    expect(explicit.teams.us).toMatchObject({ turnovers: 1, recoveries: 1 });
    expect(explicit.players.a.turnovers).toBe(1);
    expect(explicit.players.b.recoveries).toBe(1);
  });
  it("validates recipients, success and pitch availability", () => {
    expect(actionProblem({id:"x",type:"pass",outcome:"incomplete",receiverId:"a"})).toMatch(/receptor/);
    expect(actionProblem({id:"x",type:"shot",outcome:"complete"})).toMatch(/resultado/);
    expect(calculateLedger({...sheet,events:[{id:"x",type:"pass",minute:1,playerId:"h",receiverId:"a",outcome:"complete"}]}).errors).not.toEqual([]);
    expect(calculateLedger({...sheet,events:[{id:"x",type:"pass",timingUnknown:true,playerId:"h",receiverId:"a",outcome:"complete"}]}).errors).toEqual([]);
  });
  it("retains analysis and second precision through every edit/save conversion", () => {
    const e: MatchEvent = {...events[0],elapsedSeconds:63,source:"narration",zone:"left",x:10,y:20};
    const from = fromMatch({...sheet,events:[e],durationSeconds:3019,duration:51});
    const payload=toPayload(from,false,id=>id??"");
    expect(payload.ok && payload.sheet.events[0]).toEqual(e);
    expect(setMinute(from,"1","2").events[0].elapsedSeconds).toBeUndefined();
  });
  it("previews imports, blocks stale/wrong matches, and re-imports idempotently", () => {
    const bundle = {format:"piti-actions/v1",matchId:"m",baseRevision:0,events,coverage:"partial"};
    const first=previewNarration(JSON.stringify(bundle),"m",sheet);
    expect(first.errors).toEqual([]); expect(first.added).toBe(10);
    const again=previewNarration(JSON.stringify(bundle),"m",first.sheet);
    expect(again.added).toBe(0); expect(again.sheet.events).toHaveLength(10);
    expect(()=>previewNarration(JSON.stringify(bundle),"other",sheet)).toThrow(/otro partido/);
    expect(()=>previewNarration(JSON.stringify(bundle),"m",{...sheet,revision:1})).toThrow(/cambiado/);
    expect(previewNarration(JSON.stringify({...bundle,unresolved:["¿Quién dio el último pase?"]}),"m",sheet).errors).toHaveLength(1);
  });
});


it("keeps live playing seconds beyond the nominal duration and freezes them at halftime", () => {
  const clock = {phase:"second" as const,revision:3,firstStartedAt:1000,firstEndedAt:1_513_000,secondStartedAt:1_813_000};
  expect(matchSnapshot({...sheet,clock},3_520_000).players.a.secondsPlayed).toBe(3219);
  expect(matchSnapshot({...sheet,clock:{...clock,phase:"halftime",secondStartedAt:undefined}},3_520_000).players.a.secondsPlayed).toBe(1512);
});
it("does not let a stale draft hide live actions or restart the authoritative clock", () => {
  const publicMatch={...sheet,id:"m",status:"scheduled" as const,revision:10,events:[{id:"live-1",type:"goal" as const,minute:1,playerId:"a"}],clock:{phase:"first" as const,revision:1,firstStartedAt:1000}};
  const merged=mergeMatches([publicMatch],[{...sheet,id:"m",revision:2,events:[],clock:{phase:"ready",revision:0}}])[0];
  expect(merged.clock).toEqual(publicMatch.clock);
  expect(merged.events).toEqual(publicMatch.events);
  expect(merged.revision).toBe(10);
});
it("reviews an early finish and exact duration rather than rejecting the scheduled date", () => {
  const r=reviewActa({...sheet,date:9_000_000,clock:{phase:"ended",revision:4},duration:51,durationSeconds:3001,goalsFor:0,goalsAgainst:0},[...starters,"h"],5_000_000);
  expect(r.cuadra).toBe(true);
  const invalid=reviewActa({...sheet,duration:51,durationSeconds:3001,events:[{id:"late",type:"pass",minute:50,elapsedSeconds:3002,playerId:"a",receiverId:"b",outcome:"complete"}]},[...starters,"h"],5_000_000);
  expect(invalid.ledgerErrors.length).toBeGreaterThan(0);
});


it("keeps unknown tackle outcomes out of a success-rate denominator", () => {
  const stats=analyseActions([{id:"t",type:"tackle",outcome:"unknown"}]).teams.us;
  expect(stats.tackles).toBe(1);
  expect(stats.tacklesUnknown).toBe(1);
  expect(ratio(stats.tacklesWon,stats.tackles-stats.tacklesUnknown)).toBeNull();
});
