// /perfil/posiciones (TU boards isPosiciones): one pitch for what he has played (the minutes on each spot) and
// what he proposes (one tap ✓ también, two ★ preferida, three off), the proposal's state, «Enviar al capitán» as
// the screen's action, «Retirar» in «Más», and the nudge when he plays somewhere he hasn't put.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { POSITIONS, POS_CODES, type PosCode, type PositionSet } from "../../../../lib/positions";
import { cyclePosition } from "../../../../lib/positionsEdit";
import { canSendPositions, positionsNudge } from "../../profileData";
import { secDesc } from "../model";
import type { ScreenProps } from "../MiPagina";
import { Screen, type Act } from "./Head";

/** The board's pitch (data.js POS): where each spot sits, in % of the pitch. */
const AT: Record<PosCode, { x: number; y: number }> = {
  POR: { x: 50, y: 92 },
  DFC: { x: 50, y: 72 },
  LIB: { x: 50, y: 83 },
  LI: { x: 15, y: 66 },
  LD: { x: 85, y: 66 },
  MCD: { x: 50, y: 59 },
  MC: { x: 50, y: 45 },
  MI: { x: 17, y: 42 },
  MD: { x: 83, y: 42 },
  MCO: { x: 50, y: 30 },
  EI: { x: 18, y: 19 },
  ED: { x: 82, y: 19 },
  DC: { x: 50, y: 12 },
};
const name = (c: PosCode) => POSITIONS[c].name;
const same = (a: PositionSet, b: PositionSet) => a.main === b.main && a.also.length === b.also.length && a.also.every((c) => b.also.includes(c));

export function Posiciones(p: ScreenProps) {
  const { data, say } = p;
  const navigate = useNavigate();
  const info = data.positions;
  const played = data.played;
  const [draft, setDraft] = useState<PositionSet | null>(null);
  const [busy, setBusy] = useState(false);
  const base: PositionSet = info ? (info.state === "pendiente" && info.proposal ? info.proposal : info.approved) : { main: null, also: [] };
  const marks = draft ?? base;
  const mark = (c: PosCode) => (marks.main === c ? "main" : marks.also.includes(c) ? "also" : null);
  const mins = new Map((played?.lines ?? []).map((l) => [l.code, l]));
  const none = !marks.main && !marks.also.length;
  const canSend = !!info && !!draft && canSendPositions(draft, info);
  const one = (played?.matches ?? 0) === 1;

  const send = async () => {
    if (!draft || busy) return;
    setBusy(true);
    try {
      await p.actions.proposePositions(draft);
      setDraft(null);
      say("Propuesta enviada al capitán.");
    } catch {
      say("No se ha podido enviar. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    try {
      await p.actions.proposePositions(null);
      setDraft(null);
      say("Propuesta retirada.");
    } catch {
      say("No se ha podido retirar. Inténtalo otra vez.");
    }
  };

  const pending = info?.state === "pendiente";
  const status = !info?.inSeason
    ? { tone: "", t: "Tu ficha no está en esta temporada", d: "Se pueden proponer posiciones cuando el capitán te ponga en la plantilla." }
    : pending && !draft
      ? { tone: "warn", t: "Enviada: pendiente de que el capitán la vea", d: "Te avisamos en cuanto la mire." }
      : draft && !same(draft, base)
        ? { tone: "", t: "Cambios sin enviar", d: "El capitán los verá cuando los envíes (arriba)." }
        : info.state === "aprobada"
          ? { tone: "ok", t: "El capitán aprobó tu propuesta", d: "Ya está en tu ficha." }
          : info.state === "ajustada"
            ? { tone: "ok", t: "El capitán ajustó tu propuesta", d: "Lo que ves es lo que dejó en tu ficha." }
            : info.state === "rechazada"
              ? { tone: "warn", t: "El capitán no aprobó tu propuesta", d: "Siguen las de tu ficha; puedes proponer otras." }
              : none
                ? { tone: "", t: "Aún no has dicho dónde juegas", d: `Tu ficha dice ${(data.card.posLong ?? "sin posición").toLowerCase()}, sin puesto exacto. Márcalo en el campo y envíaselo al capitán.` }
                : { tone: "ok", t: "Las de tu ficha", d: "Las puso el capitán; si no son, propón las tuyas." };
  const summary =
    [...(marks.main ? [marks.main] : []), ...marks.also]
      .map((c) => `${name(c)}${c === marks.main ? " ★" : " ✓"}`)
      .join(" · ") || "Nada marcado todavía";
  const playedText = played?.lines.length ? played.lines.map((l) => `${name(l.code)}: ${Math.round(l.minutes)}′`).join(" · ") : "Aún en ningún puesto.";
  const estimated = played && played.estimatedMatches > 0 ? "Sin pizarra oficial en alguna acta: ahí cuenta tu posición preferida." : played?.lines.length ? `Según la pizarra oficial${one ? " de tu partido" : " de cada partido"}. Con cambios continuos, cuenta el puesto que ocupaste más tiempo.` : "";
  const nudge = info ? positionsNudge(played, { ...info, approved: marks }) : null;

  const act: Act | null = canSend ? { t: "Enviar al capitán", icon: "arrow", go: () => void send(), busy } : null;
  const more = [
    ...(pending ? [{ t: "Retirar la propuesta", icon: "close" as const, go: () => void withdraw() }] : []),
    ...(draft ? [{ t: "Volver a lo de tu ficha", icon: "replay" as const, go: () => setDraft(null) }] : []),
    { t: "Las posiciones del equipo", icon: "chart" as const, go: () => void navigate({ to: "/numeros/campo/puestos" }) },
  ];
  const tap = (c: PosCode) => {
    if (!info?.inSeason) return;
    setDraft(cyclePosition(marks, c));
  };
  return (
    <Screen title="Posiciones" desc={secDesc("posiciones", "jugador", false)} act={act} more={more}>
      <div className="tu-cols tu-cols--pitch">
        <section className="tu-blk tu-blk--flat" aria-labelledby="tu-pitch-t">
          <h3 className="tu-h3 vd-vh" id="tu-pitch-t">
            El campo
          </h3>
          <div className="tu-pitch" role="group" aria-label="Tus posiciones: toca una para marcarla">
            <span className="tu-pitch__lines" aria-hidden="true" />
            {POS_CODES.map((c) => {
              const m = mark(c);
              const pl = mins.get(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`tu-spot${m === "main" ? " is-main" : m === "also" ? " is-also" : ""}${pl ? " is-played" : ""}`}
                  style={{ left: `${AT[c].x}%`, top: `${AT[c].y}%` }}
                  aria-label={`${name(c)}${m === "main" ? ", tu preferida" : m === "also" ? ", también juegas" : ""}${pl ? `, has jugado ${Math.round(pl.minutes)} minutos` : ""}. Toca para cambiar`}
                  aria-disabled={!info?.inSeason || undefined}
                  onClick={() => tap(c)}
                >
                  <b>{c}</b>
                  {m && <i aria-hidden="true">{m === "main" ? "★" : "✓"}</i>}
                  {pl && <small>{Math.round(pl.minutes)}′</small>}
                </button>
              );
            })}
          </div>
          <p className="tu-legend">
            <span>
              <i className="lg-main" aria-hidden="true">
                ★
              </i>{" "}
              Tu preferida
            </span>
            <span>
              <i className="lg-also" aria-hidden="true">
                ✓
              </i>{" "}
              También juegas
            </span>
            <span>
              <i className="lg-played" aria-hidden="true" /> Donde has jugado
            </span>
          </p>
        </section>
        <section className="tu-blk tu-blk--flat" aria-labelledby="tu-prop-t">
          <h3 className="tu-h3" id="tu-prop-t">
            Tu propuesta
          </h3>
          <p className={`tu-state is-${status.tone}`} role="status">
            <b>{status.t}</b>
            <span>{status.d}</span>
          </p>
          <p className="tu-blk__d">
            <b>Marcadas:</b> {summary}
          </p>
          <p className="tu-small">Un toque: también juegas ahí. Dos: tu preferida. Tres: se quita.</p>
          <h3 className="tu-h3">Dónde has jugado</h3>
          <p className="tu-blk__d">{playedText}</p>
          {estimated && <p className="tu-small">{estimated}</p>}
          {nudge && (
            <p className="tu-state is-warn">
              <b>Has jugado de {name(nudge).toLowerCase()} y no lo tienes puesto.</b>
              <span>Tócalo en el campo para añadirlo a tu propuesta.</span>
            </p>
          )}
        </section>
      </div>
    </Screen>
  );
}
