import { describe, expect, it } from 'vitest';
import { personalMatchSummary, porraHistory, monthOf } from './postMatch';
import { analysisCoverage, recordedValue } from './technicalAnalysis';
import type { ClubMatch } from './clubData';
import { calculateLedger } from '../../functions/src/matchEngine';
import { scorePrediction } from '../../functions/src/predictions';
import { defaultSheet, setAssist, setScorer } from '../pages/admin/acta/sheetModel';
const starters = ['a','b','c','d','e','f','g'];
function game(id:string,date:number,minute:number):ClubMatch {
  const sheet=defaultSheet('s',{starters,bench:['h'],date,status:'finished',duration:50,events:[{id:'sub',type:'substitution',minute,playerId:'a',inPlayerId:'h'}]});
  return {...sheet,id,goalsFor:0,goalsAgainst:0,ledger:calculateLedger(sheet).players};
}
describe('resumen personal',()=>{
  it('compara solo partidos jugados anteriores de la misma temporada y conserva los minutos del acta',()=>{
    const old=game('old',1,20), now=game('now',2,35), later=game('later',3,40);
    const s=personalMatchSummary(now,[later,now,old,{...old,id:'other',seasonId:'other'}],'a');
    expect(s.minutes).toBe(35);expect(s.delta).toBe(15);expect(s.seasonMinutes).toBe(55);expect(s.seasonStats.matchesPlayed).toBe(2);
    expect(s.previous?.id).toBe('old');expect(s.role).toBe('Titular');
  });
  it('no inventa minutos para actas antiguas ni duplica asistencias en destacados',()=>{
    const m:ClubMatch={id:'old',date:1,seasonId:'s',status:'finished',events:[{id:'g',type:'goal',playerId:'b',assistPlayerId:'a'}]};
    const s=personalMatchSummary(m,[m],'a');
    expect(s.minutes).toBeNull();expect(s.seasonMinutes).toBeNull();expect(s.unknownMinutes).toBe(1);expect(s.highlights).toHaveLength(1);
  });
});
describe('historial de porra',()=>{
  const jan:ClubMatch={id:'j',date:Date.parse('2026-01-20T20:00Z'),seasonId:'s',status:'finished',goalsFor:1,goalsAgainst:0,events:[{id:'g',type:'goal',playerId:'a'}]};
  const feb:ClubMatch={...jan,id:'f',date:Date.parse('2026-01-31T23:30Z'),goalsFor:0,events:[]};
  const bets=[{matchId:'j',uid:'u',name:'Uno',goalsFor:1,goalsAgainst:0,goals:[{playerId:'a',assistPlayerId:null}]},{matchId:'f',uid:'v',name:'Dos',goalsFor:0,goalsAgainst:0}];
  it('usa el mes en Madrid, separa meses y conserva jornadas sin apuesta',()=>{
    expect(monthOf(feb.date)).toBe('2026-02');
    const s=porraHistory([feb,jan],bets,'u');expect(s.total).toBe(8);expect(s.timeline.map(t=>t.total)).toEqual([8,8]);expect(s.timeline[1].mine).toBeUndefined();expect(s.best?.match.id).toBe('j');
    const month=porraHistory([jan,feb],bets,'u','2026-02');expect(month.total).toBe(0);expect(month.rows[0].uid).toBe('v');
  });
  it('recalcula correcciones sin conservar puntos antiguos y excluye partidos abiertos',()=>{
    const corrected={...jan,events:[{id:'g',type:'goal' as const,playerId:'b'}]};
    expect(porraHistory([corrected,{...feb,status:'scheduled'}],bets,'u').total).toBe(3);
    expect(porraHistory([corrected,{...feb,status:'scheduled'}],bets,'u').rows).toHaveLength(1);
  });
  it('no premia una jugada sin asistencia todavía pendiente',()=>{
    const pick={goalsFor:1,goalsAgainst:0,goals:[{playerId:'a',assistPlayerId:null}]};
    expect(scorePrediction(pick,pick,[{id:'g',type:'goal',playerId:'a',assistReviewed:false}]).actions).toBe(0);
    expect(scorePrediction(pick,pick,[{id:'g',type:'goal',playerId:'a',assistReviewed:true}]).actions).toBe(1);
  });
});
describe('revisión de asistencia',()=>{
  it('un gol rápido permite seguir en vivo, pero exige revisión para publicar',()=>{
    const s=defaultSheet('s',{starters,events:[{id:'g',type:'goal',minute:10,playerId:'a',assistReviewed:false}]});
    expect(calculateLedger(s,false).errors).toEqual([]);
    expect(calculateLedger(s,true).errors.join()).toContain('Revisa la asistencia');
    const reviewed=setAssist(s,'g',null);
    expect(calculateLedger(reviewed,true).errors).toEqual([]);
    expect(reviewed.events[0].assistReviewed).toBe(true);
    expect(setScorer(reviewed,'g','b').events[0].assistReviewed).toBe(false);
  });
  it('las sustituciones imposibles siguen bloqueando la publicación',()=>{
    const s=defaultSheet('s',{starters,bench:['h'],events:[{id:'sub',type:'substitution',minute:10,playerId:'h',inPlayerId:'a'}]});
    expect(calculateLedger(s,true).errors.length).toBeGreaterThan(0);
  });
});
it('separa cero real de ausencia de registro, incluso con filtros vacíos',()=>{
  const empty:ClubMatch={id:'m',events:[]};
  const partial={...empty,id:'p',events:[{id:'g',type:'goal' as const,playerId:'a'}]};
  const complete={...empty,id:'c',analysisCoverage:'complete' as const};
  expect(analysisCoverage([empty,partial,complete])).toMatchObject({complete:1,partial:1,none:1,zeroKnown:false});
  expect(recordedValue(0,analysisCoverage([empty]).zeroKnown)).toBe('—');
  expect(recordedValue(0,analysisCoverage([complete]).zeroKnown)).toBe('0');
  expect(recordedValue(0,analysisCoverage([]).zeroKnown)).toBe('—');
  const unknown = analysisCoverage([{...complete,events:[{id:'p',type:'pass',outcome:'unknown'}]}]);
  expect(unknown.unassigned).toBe(1);
  expect(unknown.uncertain.has('passesFailed')).toBe(true);
  expect(unknown.uncertain.has('passes')).toBe(false);
});
