import { useMemo, useState } from "react";
import { type ClubMatch } from "../../lib/clubData";
import { TECH_LABELS, pct, technicalAnalysis } from "../../lib/technicalAnalysis";
import { emptyTechnical, eventSide, type TechnicalStats } from "../../../functions/src/matchAnalysis";
import "./technical-stats.css";

type Metric = keyof TechnicalStats;
type Person = { id: string; name: string; number?: number | string | null };
const CATEGORIES: Record<string, Metric[]> = {
  "Pases y creación": ["passes", "passesCompleted", "passesFailed", "passesReceived", "keyPasses", "longPasses", "crosses", "crossesCompleted"],
  "Remate": ["shots", "shotsOnTarget", "shotsOffTarget", "shotsBlocked", "shotsWoodwork", "shotGoals", "chancesCreated"],
  "Defensa y duelos": ["recoveries", "interceptions", "turnovers", "tackles", "tacklesWon", "clearances", "blocks", "saves", "dribbles", "dribblesWon", "duels", "duelsWon", "aerialDuels", "aerialDuelsWon"],
  "Balón parado y disciplina": ["cornersTaken", "throwIns", "goalKicks", "kickoffs", "offsides", "fouls", "foulsReceived"],
};

/** The same view consumes a single match, a season, all seasons or one player. */
export function TechnicalStatsPanel({ matches, people, initialPlayer = "" }: { matches: readonly ClubMatch[]; people: Person[]; initialPlayer?: string }) {
  const data = useMemo(() => technicalAnalysis(matches), [matches]);
  const [selected, setSelected] = useState(initialPlayer);
  const [category, setCategory] = useState("Pases y creación");
  const [metric, setMetric] = useState<Metric>("passesCompleted");
  const [side, setSide] = useState<"us" | "opponent">("us");
  const [network, setNetwork] = useState<"passes" | "crosses">("passes");
  const involved = new Set(matches.flatMap(m => [...(m.starters ?? []), ...(m.bench ?? []), ...(m.notCalled ?? []), ...Object.keys(m.ledger ?? {}), ...(m.events ?? []).flatMap(e => [e.playerId, e.receiverId, e.assistPlayerId, e.inPlayerId].filter((id): id is string => !!id))]));
  const roster = people.filter(p => involved.has(p.id));
  const names = new Map(people.map(p => [p.id, p]));
  const person = (id: string) => names.get(id) ?? { id, name: "Jugador", number: "—" };
  const row = selected ? data.players[selected] ?? emptyTechnical() : data.teams.us;
  const knownPasses = row.passesCompleted + row.passesFailed;
  const knownShots = row.shotsOnTarget + row.shotsOffTarget + row.shotsBlocked + row.shotsWoodwork;
  const rankings = [...new Set([...roster.map(p => p.id),...Object.keys(data.players)])].map(id => ({ ...person(id), stats: data.players[id] ?? emptyTechnical() })).sort((a,b) => b.stats[metric] - a.stats[metric] || a.name.localeCompare(b.name));
  const connectedIds = [...new Set(data.links.flatMap(l => [l.from, l.to]))].sort((a,b) => String(person(a).number).localeCompare(String(person(b).number), "es", {numeric:true}));
  const nodes = connectedIds.map((id,i) => ({ ...person(id), x: 180 + 126 * Math.cos(-Math.PI / 2 + i * Math.PI * 2 / Math.max(1,connectedIds.length)), y: 180 + 126 * Math.sin(-Math.PI / 2 + i * Math.PI * 2 / Math.max(1,connectedIds.length)), n: (data.players[id]?.recordedActions ?? 0) + (data.players[id]?.passesReceived ?? 0) }));
  const maxNode = Math.max(1,...nodes.map(n => n.n));
  const byNode = new Map(nodes.map(n => [n.id,n]));
  const edges = data.links.filter(l => !selected || l.from === selected || l.to === selected).map(l => ({ ...l, n: network === "crosses" ? l.crosses : l.count })).filter(l => l.n > 0).sort((a,b) => b.n - a.n);
  const maxEdge = Math.max(1,...edges.map(e => e.n));
  const shots = data.shots.filter(e => eventSide(e) === side && (side === "opponent" || !selected || e.playerId === selected));
  const mapped = shots.filter(e => e.x != null && e.y != null);
  const maxRank = Math.max(1,...rankings.map(r => r.stats[metric]));
  const compare = CATEGORIES[category];
  const binCount = Math.floor(Math.max(50,...matches.map(m => m.duration ?? 50),...shots.map(e => e.minute ?? 0))/5) + 1;
  const bins = Array.from({length: binCount}, (_,i) => ({ minute: i*5, shots: shots.filter(e => e.minute != null && Math.floor(e.minute/5) === i).length }));
  const maxBin = Math.max(1,...bins.map(b => b.shots));
  return <section className="technical-stats" aria-label="Estadísticas detalladas">
    <header className="ts-head"><div><span className="hm-kick">Acciones registradas · {data.games} {data.games === 1 ? "partido" : "partidos"}</span><h2>El juego en detalle</h2></div><label>Jugador<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Todo el equipo</option>{roster.map(p => <option key={p.id} value={p.id}>{p.number ?? "—"} · {p.name}</option>)}</select></label></header>
    <div className="ts-coverage"><b>{data.complete === data.games && data.games > 0 ? "Análisis completo" : "Cobertura parcial"}</b><span>{data.complete} de {data.games} actas con narración completa · {data.unknownTime} acciones sin minuto.</span><p>Se muestran solo acciones registradas. Los goles cuentan como remates a puerta; centros y pases largos forman parte de los pases. Un pase fallado suma una pérdida. Los porcentajes no estiman lo que falta.</p>{matches.length === 1 && matches[0].analysisNotes && <p>{matches[0].analysisNotes}</p>}</div>
    {!data.events.length && <p className="ts-empty">El análisis aparecerá al incorporar las acciones al acta.</p>}
    <div className="ts-kpis">{[["Precisión de pase",pct(row.passesCompleted,knownPasses),`${row.passesCompleted} / ${knownPasses} con resultado conocido · ${row.passesUnknown} sin resultado`],["Remates a puerta",pct(row.shotsOnTarget,knownShots),`${row.shotsOnTarget} / ${knownShots} con destino conocido`],["Conversión",pct(row.shotGoals,row.shots),`${row.shotGoals} goles / ${row.shots} remates registrados`],["Entradas ganadas",pct(row.tacklesWon,row.tackles-row.tacklesUnknown),`${row.tacklesWon} / ${row.tackles-row.tacklesUnknown} con resultado conocido · ${row.tacklesUnknown} sin resultado`]].map(([label,value,sub]) => <article key={label}><span>{label}</span><b>{value}</b><small>{sub}</small></article>)}</div>
    <div className="ts-grid">
      <section className="ts-card ts-network"><div className="ts-title"><h3>La red de {network === "passes" ? "pases" : "centros"}</h3><select aria-label="Tipo de conexiones" value={network} onChange={e => setNetwork(e.target.value as "passes" | "crosses")}><option value="passes">Pases completados</option><option value="crosses">Centros completados</option></select></div><p>Nodo: intervenciones registradas. Línea: entregas completadas entre dos jugadores. Distribución esquemática, sin posiciones inventadas. Selecciona un dorsal.</p>
        {nodes.length ? <svg viewBox="0 0 360 360" role="group" aria-label="Red de pases completados"><circle className="ts-orbit" cx="180" cy="180" r="126" />{edges.map(l => { const a=byNode.get(l.from)!,b=byNode.get(l.to)!; return <g key={`${l.from}>${l.to}`}><title>{a.name} → {b.name}: {l.n}</title><path d={`M ${a.x} ${a.y} Q 180 180 ${b.x} ${b.y}`} fill="none" stroke="currentColor" strokeOpacity=".42" strokeWidth={1+7*l.n/maxEdge} /></g>; })}{nodes.map(n => <g key={n.id} role="button" tabIndex={0} aria-label={`${n.name}, ${n.n} intervenciones`} aria-pressed={selected===n.id} onClick={() => setSelected(selected===n.id ? "" : n.id)} onKeyDown={e => {if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(selected===n.id ? "" : n.id);}}} className={selected===n.id ? "ts-node selected" : "ts-node"}><circle cx={n.x} cy={n.y} r={14+11*Math.sqrt(n.n/maxNode)} /><text x={n.x} y={n.y+5} textAnchor="middle">{n.number ?? "·"}</text><title>{n.name}</title></g>)}</svg> : <div className="ts-empty">Faltan pases completados con emisor y receptor identificados.</div>}
        <div className="ts-table-wrap"><table><caption>Conexiones dirigidas · {edges.length} parejas</caption><thead><tr><th>De</th><th>A</th><th>Completados</th></tr></thead><tbody>{edges.map(l => <tr key={`${l.from}>${l.to}`}><td>{person(l.from).name}</td><td>{person(l.to).name}</td><td>{l.n}</td></tr>)}</tbody></table></div>
      </section>
      <section className="ts-card"><div className="ts-title"><h3>Remates y zonas</h3><select aria-label="Equipo de remates" value={side} onChange={e => setSide(e.target.value as "us" | "opponent")}><option value="us">Piti</option><option value="opponent">Rival</option></select></div><p>{mapped.length} de {shots.length} remates con coordenadas. Ataque hacia arriba.</p>
        {mapped.length ? <svg className="ts-pitch" viewBox="0 0 300 220" role="img" aria-label="Mapa de remates con posición registrada"><rect x="10" y="10" width="280" height="200" rx="12"/><path d="M90 10v50h120V10M120 10v20h60V10M10 150h280" />{mapped.map(e => <g key={e.id}><circle cx={10+e.x!*2.8} cy={10+e.y!*2} r={e.type.startsWith("goal") ? 7 : 4} className={e.type.startsWith("goal") ? "goal" : "shot"}/><title>{e.playerId ? person(e.playerId).name : "Equipo"} · {e.minute == null ? "Sin minuto" : `${e.minute}′`} · {e.type.startsWith("goal") ? "Gol" : e.outcome ?? e.type}</title></g>)}</svg> : <div className="ts-empty">Sin coordenadas registradas. Los remates se muestran en las tablas sin asignarles una posición ficticia.</div>}
        <div className="ts-zone-bars">{(["left","center","right"] as const).map((z,i) => <div key={z}><span>{["Izquierda","Centro","Derecha"][i]}</span><b>{shots.filter(e=>e.zone===z).length}</b></div>)}</div>
        <h4>Remates por tramo de 5 minutos</h4><div className="ts-timeline">{bins.map(b => <div key={b.minute} title={`${b.minute}–${b.minute+5} min: ${b.shots} remates`}><b>{b.shots || ""}</b><i style={{height:`${4+65*b.shots/maxBin}px`}}/><small>{b.minute}′</small></div>)}</div><p>{shots.filter(e=>e.minute==null).length} remates sin tiempo conocido quedan fuera de esta gráfica.</p>
      </section>
    </div>
    <nav className="ts-filters" aria-label="Familias de estadísticas">{Object.keys(CATEGORIES).map(c => <button type="button" key={c} aria-pressed={category===c} onClick={() => {setCategory(c);setMetric(CATEGORIES[c][0]);}}>{c}</button>)}</nav>
    <div className="ts-grid"><section className="ts-card"><h3>{selected ? person(selected).name : "Piti"} y rival</h3>{compare.map(k => {const a=row[k],b=data.teams.opponent[k]; return <div className="ts-compare" key={k}><div><b>{a}</b><span>{TECH_LABELS[k]}</span><b>{b}</b></div><div className="ts-dual"><i style={{width:`${a+b ? a/(a+b)*100 : 50}%`}}/><i style={{width:`${a+b ? b/(a+b)*100 : 50}%`}}/></div></div>;})}<p>Comparación de acciones registradas; no equivale a posesión de balón.</p>{data.teams.us.possessionsSeconds + data.teams.opponent.possessionsSeconds > 0 && <p>Posesión cronometrada: Piti {pct(data.teams.us.possessionsSeconds,data.teams.us.possessionsSeconds+data.teams.opponent.possessionsSeconds)} · {data.teams.us.possessionsSeconds} s / rival {data.teams.opponent.possessionsSeconds} s. Solo tramos registrados.</p>}</section>
      <section className="ts-card"><div className="ts-title"><h3>Quién destaca</h3><select aria-label="Métrica del ranking" value={metric} onChange={e=>setMetric(e.target.value as Metric)}>{compare.map(k=><option key={k} value={k}>{TECH_LABELS[k]}</option>)}</select></div><ol className="ts-rank">{rankings.slice(0,12).map((r) => <li key={r.id}><button type="button" onClick={()=>setSelected(r.id)}><span>{rankings.findIndex(other => other.stats[metric] === r.stats[metric])+1}. {r.name}</span><b>{r.stats[metric]}</b><i style={{width:`${r.stats[metric]/maxRank*100}%`}}/></button></li>)}</ol></section></div>
    <section className="ts-card"><h3>Todos los jugadores · {category.toLocaleLowerCase("es")}</h3><div className="ts-table-wrap"><table><caption>Ordenados por {TECH_LABELS[metric].toLocaleLowerCase("es")}. Desliza para ver todas las columnas.</caption><thead><tr><th scope="col">Jugador</th>{compare.map(k=><th scope="col" key={k}><button type="button" onClick={()=>setMetric(k)}>{TECH_LABELS[k]}{metric===k ? " ↓" : ""}</button></th>)}{category==="Pases y creación" && <th>Precisión</th>}</tr></thead><tbody>{rankings.map(r=><tr key={r.id}><th scope="row"><button type="button" onClick={()=>setSelected(r.id)}>{r.number ?? "—"} · {r.name}</button></th>{compare.map(k=><td key={k}>{r.stats[k]}</td>)}{category==="Pases y creación"&&<td>{pct(r.stats.passesCompleted,r.stats.passesCompleted+r.stats.passesFailed)}</td>}</tr>)}</tbody></table></div></section>
    <details className="ts-method"><summary>Cómo se cuentan las acciones</summary><p>El porcentaje de pase divide completados entre completados y fallados. Los resultados desconocidos se indican aparte. Precisión de remate: a puerta entre remates con destino conocido; los palos y los bloqueados no se cuentan como tiros a puerta. Conversión: goles entre remates registrados. Una intercepción suma una recuperación; un pase fallado o regate perdido suma una pérdida. Los autogoles no se atribuyen como remates del equipo beneficiado.</p><p>Los nodos miden acciones e intervenciones registradas, no todos los toques reales. No se calcula posesión a partir del número de pases ni xG sin información y un modelo adecuados. Corregir el acta recalcula todas estas cifras.</p></details>
  </section>;
}
