// «Vidrio» · el cartel de la jornada: what the generated poster says about one match — the jornada, the
// rival, when and where, the big line (the score once played, the time before, «Aplazado»…), who scored,
// the MVP, the light it was played in and its signature. Pure: the canvas drawing lives with the page.
import type { ClubMatch } from "../../clubData";
import { dateParts, scoreOf, scorersLine } from "../../partidos";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { AWAITING_ACTA } from "../kickoff";
import { norm } from "../../standings";
import { resultLetter, type ResultLetter } from "../result";
import { matchSignature, type MatchSignature } from "./signature";
import { lightAt, stripStateOf, type MatchLight, type StripState } from "./strip";

export interface CartelContext {
  jornada: number | null;
  /** «Temporada 1». */
  seasonName: string;
  /** Names our players (the match's guests are named on top of it). */
  nameOf: (id: string) => string;
  now: number;
  /** The MVP's name, once the vote has one. */
  mvp?: string | null;
}

export interface Cartel {
  id: string;
  jornada: number | null;
  /** «J17», or "". */
  jornadaLabel: string;
  rival: string;
  home: boolean;
  /** «En casa» / «Fuera». */
  side: string;
  venue: string;
  /** «Domingo, 17 ene»; «Fecha por confirmar» undated. */
  dateLine: string;
  /** «19:00», or "" undated. */
  time: string;
  state: StripState;
  /** The poster's big line: «3–1» · «2–1» (live) · «19:00» · «Aplazado» · «Suspendido» · «Pendiente del acta». */
  big: string;
  played: boolean;
  score: { gf: number; ga: number } | null;
  letter: ResultLetter | null;
  /** «Ganamos 3–1», «Empate 2–2», «Perdimos 1–2»; "" without a result. */
  resultLine: string;
  /** «ALCIDES ×2, ADRIÁN T.C.» (scorersLine, the names as `nameOf` gives them); "" without goals. */
  scorers: string;
  mvp: string | null;
  seasonName: string;
  light: MatchLight | null;
  /** The poster's lines-only signature (size «p»), for a played or live match. */
  signature: MatchSignature | null;
  /** The whole poster in one sentence, for its alt text. */
  aria: string;
  /** «piti-j17-orduna-fc.png». */
  fileName: string;
}

const RESULT_LINE = { G: "Ganamos", E: "Empate", P: "Perdimos" } as const;

/** The cartel of `match` at `ctx.now`. */
export function cartelOf(match: ClubMatch, ctx: CartelContext): Cartel {
  const state = stripStateOf(match, ctx.now);
  const at = dateMillis(match.date);
  const dated = Number.isFinite(at);
  const parts = dateParts(match.date);
  const rival = match.rival ?? "Rival";
  const home = match.home !== false;
  const played = state === "jugado";
  const sc = played || state === "directo" ? scoreOf(match) : null;
  const letter = played && sc ? resultLetter(sc.gf, sc.ga) : null;
  const scoreText = sc ? `${sc.gf}–${sc.ga}` : "";
  const time = dated ? parts.time : "";
  const big =
    played || state === "directo"
      ? scoreText
      : state === "aplazado"
        ? "Aplazado"
        : state === "suspendido"
          ? "Suspendido"
          : state === "pendiente"
            ? AWAITING_ACTA
            : time || "Por confirmar";
  const jLabel = ctx.jornada ? `J${ctx.jornada}` : "";
  const when = dated ? `${parts.long} a las ${time}` : "fecha por confirmar";
  const tail = played ? `. Resultado ${scoreText}` : state === "directo" ? `. En directo, ${scoreText}` : state === "aplazado" ? ". Aplazado" : state === "suspendido" ? ". Suspendido" : state === "pendiente" ? `. ${AWAITING_ACTA}` : "";
  const slug = norm(rival).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rival";
  return {
    id: match.id,
    jornada: ctx.jornada,
    jornadaLabel: jLabel,
    rival,
    home,
    side: home ? "En casa" : "Fuera",
    venue: match.venue ?? "",
    dateLine: dated ? parts.longCap : parts.long,
    time,
    state,
    big,
    played,
    score: sc,
    letter,
    resultLine: letter ? `${RESULT_LINE[letter]} ${scoreText}` : "",
    scorers: sc && sc.gf > 0 ? scorersLine(match.events, ctx.nameOf, match) : "",
    mvp: played ? (ctx.mvp ?? null) : null,
    seasonName: ctx.seasonName,
    light: dated ? lightAt(at, match.duration ?? 50) : null,
    signature: matchSignature(match, ctx.now, "p"),
    aria: `Cartel de la ${jLabel || "jornada"}: Manchester Piti contra ${rival}, ${when}${tail}.`,
    fileName: `piti-${jLabel ? `${jLabel.toLowerCase()}-` : ""}${slug}.png`,
  };
}
