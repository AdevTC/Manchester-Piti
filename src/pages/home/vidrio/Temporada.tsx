// La temporada: the table in focus mode (the leader … us ±3 …, «N equipos más arriba/abajo») with «Antes del
// pitido / Si acaba así» while a match is live and «Ver la tabla entera» that grows into the whole table; the
// form; scorers and assisters with «Ver los N»; and the season strip: every jornada painted with the light of
// its kick-off (tiles for a short season, slivers for a long one), each one a link to its match.
import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { GrowWindow, SeeAll, type Grow } from "../../../components/vidrio";
import { tableFocus } from "../../../lib/derived/vidrio/table";
import type { LeaderRow } from "../../../lib/derived/vidrio/leaders";
import type { StripSegment } from "../../../lib/derived/vidrio/strip";
import type { LightKey } from "../../../lib/derived/sun";
import { madridTime, MONTHS_SHORT, madridDate } from "../../../lib/derived/madrid";
import { niceName, type FormLetter } from "../hoyModel";
import { Ico } from "./icons";
import { Shirt } from "./Siete";

export interface TableRowV {
  team: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  dg: number;
  pts: number;
  isUs: boolean;
  /** Places up (+) or down (−) with the live score. */
  move: number;
}

const dg = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export function TableView({ rows, around, full, caption }: { rows: readonly TableRowV[]; around: number | null; full?: boolean; caption: string }) {
  const items = around === null ? rows.map((row, i) => ({ kind: "row" as const, pos: i + 1, row, us: row.isUs, tied: false })) : tableFocus(rows, null, around);
  return (
    <table className={`vi-table${full ? " vi-table--full" : ""}`}>
      <caption className="vd-vh">{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className="p">
            #
          </th>
          <th scope="col" className="t">
            Equipo
          </th>
          <th scope="col">
            <abbr title="Partidos jugados">PJ</abbr>
          </th>
          <th scope="col" className="hm">
            <abbr title="Ganados">G</abbr>
          </th>
          <th scope="col" className="hm">
            <abbr title="Empatados">E</abbr>
          </th>
          <th scope="col" className="hm">
            <abbr title="Perdidos">P</abbr>
          </th>
          <th scope="col">
            <abbr title="Diferencia de goles">DG</abbr>
          </th>
          <th scope="col">
            <abbr title="Puntos">Pts</abbr>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) =>
          it.kind === "gap" ? (
            <tr key={`gap-${it.side}`} className="gap">
              <td colSpan={8}>{it.text}</td>
            </tr>
          ) : (
            <tr key={it.row.team} className={it.us ? "us" : undefined} aria-current={it.us ? "true" : undefined}>
              <td className="p">{it.pos}</td>
              <th scope="row" className="t">
                {it.row.team}
                {it.us && it.row.move > 0 && (
                  <span className="vd-move">
                    <Ico id="up" />
                    sube al {it.pos}º
                  </span>
                )}
              </th>
              <td>{it.row.pj}</td>
              <td className="hm">{it.row.g}</td>
              <td className="hm">{it.row.e}</td>
              <td className="hm">{it.row.p}</td>
              <td>{dg(it.row.dg)}</td>
              <td className="pts">{it.row.pts}</td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

/** «Antes del pitido · Si acaba así» (pressed buttons). */
export function SiSeg({ projected, onChange }: { projected: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="vd-glass vd-seg vi-siseg" role="group" aria-label="Qué tabla ver" style={{ "--n": 2, "--i": projected ? 1 : 0 } as CSSProperties}>
      <span className="vd-shelf__bead" aria-hidden="true" />
      <button type="button" className="vd-seg__b" aria-pressed={!projected} onClick={() => onChange(false)}>
        Antes del pitido
      </button>
      <button type="button" className="vd-seg__b" aria-pressed={projected} onClick={() => onChange(true)}>
        Si acaba así
      </button>
    </div>
  );
}

export function Forma({ letters }: { letters: readonly FormLetter[] }) {
  return (
    <ul className="vd-form" aria-label="La forma, de la más antigua a la última">
      {letters.map((f, i) => (
        <li key={i} className={`vd-form__l vd-form__l--${f.tone}`} aria-label={f.label}>
          <span aria-hidden="true">{f.l}</span>
        </li>
      ))}
    </ul>
  );
}

export function Rank({ rows, kind }: { rows: readonly LeaderRow[]; kind: "goles" | "asistencias" }) {
  return (
    <ol className="vi-rank">
      {rows.map((r) => (
        <li key={r.id}>
          <span className="n">{r.rank}</span>
          <Shirt num={r.num} size={28} />
          <Link className="nm" to="/jugadores/$playerId" params={{ playerId: r.id }}>
            {niceName(r.name)}
          </Link>
          <span className="c" aria-label={`${r.value} ${kind === "goles" ? (r.value === 1 ? "gol" : "goles") : r.value === 1 ? "asistencia" : "asistencias"}${r.provisional ? `, ${r.provisional} de hoy` : ""}`}>
            {r.value}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ───────────── the season strip

const SKY: Record<LightKey, string> = {
  dia: "linear-gradient(180deg,#7FBCEB,#A9D5F4 60%,#DCEEFB)",
  tarde: "linear-gradient(180deg,#5E8FC8,#A6C3E0 60%,#E8D3B8)",
  dorada: "linear-gradient(180deg,#1C2B5E,#5E6FA8 50%,#C99A86 88%)",
  ocaso: "linear-gradient(180deg,#141F48,#3D4F8E 60%,#7A6A9A)",
  noche: "linear-gradient(180deg,#060F24,#14275A 60%,#22457F)",
};
const INK: ReadonlySet<LightKey> = new Set(["dia", "tarde"]);

function segLabel(s: StripSegment): string {
  const j = s.jornada ? `J${s.jornada}` : "Jornada";
  const at = s.at !== null ? `${Number(madridDate(s.at).slice(8))} ${MONTHS_SHORT[Number(madridDate(s.at).slice(5, 7)) - 1] ?? ""}, ${madridTime(s.at)}` : "fecha por confirmar";
  const what =
    s.state === "jugado" && s.score
      ? `${s.letter === "G" ? "ganado" : s.letter === "P" ? "perdido" : "empate"} ${s.score.gf}–${s.score.ga}${s.provisional ? ", acta pendiente" : ""}`
      : s.state === "directo" && s.score
        ? `en directo, ${s.score.gf}–${s.score.ga}`
        : s.state === "hoy"
          ? `hoy a las ${s.at !== null ? madridTime(s.at) : "hora por confirmar"}`
          : s.state === "aplazado"
            ? "aplazado"
            : s.state === "suspendido"
              ? "suspendido"
              : s.state === "pendiente"
                ? "pendiente del acta"
                : at;
  return `${j}, ${s.home ? "contra" : "en casa de"} ${s.rival}: ${what}`;
}

export function SeasonTiles({ segments, now }: { segments: readonly StripSegment[]; now: number }) {
  return (
    <ul className="vi-tiles" aria-label="Las jornadas, pintadas con la luz de cada pitido" style={{ "--tiles": segments.length } as CSSProperties}>
      {segments.map((s) => {
        const light = s.light?.light ?? "noche";
        const when =
          s.state === "directo" && s.score
            ? `${s.score.gf}–${s.score.ga}, en directo`
            : s.state === "jugado" && s.score
              ? `${s.letter === "G" ? "Ganado" : s.letter === "P" ? "Perdido" : "Empate"} ${s.score.gf}–${s.score.ga}`
              : s.state === "hoy" && s.at !== null
                ? `Hoy, ${madridTime(s.at)}`
                : s.state === "aplazado"
                  ? "Aplazado"
                  : s.at !== null
                    ? `${madridDate(s.at) === madridDate(now) ? "Hoy" : new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" }).format(s.at)}, ${madridTime(s.at)}`
                    : "Por fecha";
        const now_ = s.state === "directo" || s.state === "hoy";
        return (
          <li key={s.id}>
            <Link className={`vi-tile${INK.has(light) ? " vi-tile--ink" : ""}${now_ ? " vi-tile--now" : ""}`} to="/matches/$matchId" params={{ matchId: s.id }} style={{ "--sky": SKY[light] } as CSSProperties} aria-label={segLabel(s)}>
              <b aria-hidden="true">{s.jornada ? `J${s.jornada}` : "·"}</b>
              <span className="vi-tile__txt" aria-hidden="true">
                <span>{s.rival}</span>
                <small>{when}</small>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SeasonSlivers({ segments }: { segments: readonly StripSegment[] }) {
  return (
    <ul className="vi-strip" aria-label={`Las ${segments.length} jornadas de la temporada`} style={{ "--n": segments.length } as CSSProperties}>
      {segments.map((s) => {
        const cls =
          s.state === "jugado" && s.letter
            ? `vi-sl--${s.letter}`
            : s.state === "aplazado" || s.state === "suspendido"
              ? "vi-sl--apl"
              : s.state === "directo" || s.state === "hoy"
                ? "vi-sl--hoy"
                : s.state === "pendiente"
                  ? "vi-sl--apl"
                  : "vi-sl--pro";
        const bot =
          s.state === "jugado" && s.letter
            ? s.letter
            : s.state === "aplazado"
              ? "Apl."
              : s.state === "suspendido"
                ? "Susp."
                : s.state === "directo" && s.score
                  ? `${s.score.gf}–${s.score.ga}`
                  : s.state === "hoy" && s.at !== null
                    ? madridTime(s.at)
                    : "";
        return (
          <li key={s.id}>
            <Link className={`vi-sl ${cls}`} to="/matches/$matchId" params={{ matchId: s.id }} aria-label={segLabel(s)} title={segLabel(s)}>
              <b aria-hidden="true">{s.jornada ?? "·"}</b>
              <small aria-hidden="true">{bot}</small>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SeasonStripView({ segments, legend, now }: { segments: readonly StripSegment[]; legend: string; now: number }) {
  if (!segments.length) return null;
  return (
    <nav className="vi-season" aria-label="La temporada, jornada a jornada">
      {segments.length <= 8 ? <SeasonTiles segments={segments} now={now} /> : <SeasonSlivers segments={segments} />}
      <p className="vi-season__legend">
        <span>{legend}</span>
        <Link className="vd-link" to="/partidos">
          {segments.length === 1 ? "La jornada, en Partidos" : `Las ${segments.length} jornadas, en Partidos`}
        </Link>
      </p>
    </nav>
  );
}

// ───────────── the place

export interface TemporadaData {
  /** «Jornada 17 de 26. Todo se mueve con cada gol hasta el acta.» */
  sub: string;
  /** The zone's short one at 1920 («Jornada 17 de 26»). */
  subShort: string;
  rows: readonly TableRowV[];
  /** The table with tonight's score as final (null when nothing is live). */
  projected: readonly TableRowV[] | null;
  /** «antes del pitido», «con el acta»… */
  note: string;
  forma: readonly FormLetter[];
  formaNote: string;
  goals: readonly LeaderRow[];
  assists: readonly LeaderRow[];
  segments: readonly StripSegment[];
  legend: string;
  hasTable: boolean;
}

export interface TemporadaProps {
  d: TemporadaData;
  now: number;
  tabla: Grow;
  goles: Grow;
  /** The 1920 zone, not focused: the narrow version (focus ±2, top 3, no assists). */
  compact?: boolean;
  /** The 1920 zone, focused: the whole table and every list, no «Ver todo». */
  wide?: boolean;
  region?: (n: 1 | 2 | 3 | 4) => string;
  /** «Si acaba así» (true) or the table before the whistle, while a match is live. */
  asi: boolean;
  onAsi: (v: boolean) => void;
}

export function Temporada({ d, now, tabla, goles, compact, wide, region = () => "", asi, onAsi }: TemporadaProps) {
  const live = !!d.projected;
  const rows = live && asi ? d.projected! : d.rows;
  const note = live ? (asi ? "si acaba así" : "antes del pitido") : d.note;
  const around = wide ? null : compact ? 2 : 3;
  const hidden = around === null ? 0 : rows.length - tableFocus(rows, null, around).filter((x) => x.kind === "row").length;
  const top = compact ? 3 : 3;
  const tableHead: ReactNode = (
    <div className="vi-segrow">
      <h3 className="vi-sub">
        Clasificación <span>{note}</span>
      </h3>
      {live && <SiSeg projected={asi} onChange={onAsi} />}
    </div>
  );
  return (
    <>
      <div className={`vi-temp${wide ? " vi-temp--wide" : ""}${compact ? " vi-temp--compact" : ""}`}>
        <div className={`vi-tablap ${region(2)} ${tabla.summaryProps.className}`} style={tabla.summaryProps.style}>
          {d.hasTable ? (
            <>
              {tableHead}
              <TableView rows={rows} around={around} caption={`La clasificación, ${note}`} />
              {hidden > 0 && <SeeAll summary={compact ? `Los ${rows.length} equipos` : `Los ${rows.length} equipos, con la jornada de cada uno`} count={hidden} label={`Ver la tabla entera (${rows.length})`} onOpen={tabla.grow} />}
            </>
          ) : (
            <p className="vi-empty">La clasificación sale aquí en cuanto el capitán la ponga.</p>
          )}
        </div>
        <div className={`vi-golesp ${region(3)} ${goles.summaryProps.className}`} style={goles.summaryProps.style}>
          {!compact && (
            <div className="vi-formabox">
              <h3 className="vi-sub">
                Forma <span>{d.formaNote}</span>
              </h3>
              <Forma letters={d.forma} />
            </div>
          )}
          <div className="vi-ranks">
            <div>
              <h3 className="vi-sub">
                Goleadores {compact && <span>{d.formaNote}</span>}
              </h3>
              {d.goals.length ? <Rank rows={wide ? d.goals : d.goals.slice(0, top)} kind="goles" /> : <p className="vi-empty">Por estrenar: el primero que marque abre la lista.</p>}
            </div>
            {!compact && (
              <div>
                <h3 className="vi-sub">Asistencias</h3>
                {d.assists.length ? <Rank rows={wide ? d.assists : d.assists.slice(0, top)} kind="asistencias" /> : <p className="vi-empty">Ni un pase de gol todavía.</p>}
              </div>
            )}
          </div>
          {!wide && <SeeAll summary={`${Math.max(0, d.goals.length - top) === 1 ? "1 goleador más" : `${Math.max(0, d.goals.length - top)} goleadores más`}`} count={Math.max(d.goals.length, d.assists.length) - top} label={`Ver los ${d.goals.length}`} onOpen={goles.grow} />}
        </div>
      </div>
      <div className={`vi-seasonbox ${region(4)}`}>
        <SeasonStripView segments={d.segments} legend={d.legend} now={now} />
      </div>
    </>
  );
}

/** The two grown windows of Temporada (the whole table, every scorer and assister). */
export function TemporadaGrows({ d, tabla, goles, asi, onAsi }: { d: TemporadaData; tabla: Grow; goles: Grow; asi: boolean; onAsi: (v: boolean) => void }) {
  const live = !!d.projected;
  const rows = live && asi ? d.projected! : d.rows;
  return (
    <>
      <GrowWindow
        open={tabla.open}
        title="La clasificación entera"
        sub={`${rows.length} equipos${d.subShort ? `, ${d.subShort.toLocaleLowerCase("es")}` : ""}.`}
        onClose={tabla.close}
        name={tabla.windowProps.name}
        className="vi-grow vi-grow--tabla"
        filters={live ? <SiSeg projected={asi} onChange={onAsi} /> : undefined}
      >
        <TableView rows={rows} around={null} full caption="La clasificación entera" />
      </GrowWindow>
      <GrowWindow open={goles.open} title="Goleadores y asistencias" sub={live ? "La temporada, contando el partido de hoy si acaba así." : "La temporada, con las actas publicadas."} onClose={goles.close} name={goles.windowProps.name} className="vi-grow vi-grow--goles">
        <div className="vi-ranks vi-ranks--grow">
          <div>
            <p className="vd-grow__sec">Goleadores</p>
            {d.goals.length ? <Rank rows={d.goals} kind="goles" /> : <p className="vi-empty">Aún sin goles.</p>}
          </div>
          <div>
            <p className="vd-grow__sec">Asistencias</p>
            {d.assists.length ? <Rank rows={d.assists} kind="asistencias" /> : <p className="vi-empty">Ni un pase de gol todavía.</p>}
          </div>
        </div>
      </GrowWindow>
    </>
  );
}
