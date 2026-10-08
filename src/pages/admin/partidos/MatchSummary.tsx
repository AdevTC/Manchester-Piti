// A match that needs nothing now (published, or still to be played) opens as its summary with its
// action: «Corregir el acta» for a published one, «Preparar convocatoria» / «Editar el encuentro» for one
// to be played — and «Ver ficha pública ↗».
import { dateMillis } from "../../../../functions/src/matchEngine";
import { mvpWinners } from "../../../lib/vestuario";
import { clockTime, convocatoriaState, jLabel, rsvpCounts, shortDate, type AdminMatch, type AdminMatchState } from "../data/adminLogic";
import type { AdminData } from "../data/useAdminData";
import type { MatchTab } from "../shell/nav";
import { Chip, type ChipTone } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { mvpStatus } from "../acta/publish";
import { namesFor, rosterFor } from "../acta/roster";
import { goalRows, fromMatch } from "../acta/sheetModel";
import { useMatchMvp, useMatchRsvp } from "./live";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function MatchSummary({ match, data, state, onEdit, onConvocatoria, onBack }: { match: AdminMatch; data: AdminData; state: AdminMatchState; onEdit: (tab: MatchTab) => void; onConvocatoria: () => void; onBack: () => void }) {
  const t = dateMillis(match.date);
  const roster = rosterFor(data.players, data.seasons, match.seasonId);
  const ids = roster.map((p) => p.id);
  const nameOf = namesFor(data.players, data.seasons, match.seasonId);
  const played = state === "published";
  const off = state === "cancelled" || state === "postponed";
  const rsvp = useMatchRsvp(played || off ? undefined : match.id);
  const mvpResult = useMatchMvp(played ? match.id : undefined);
  const rival = match.rival?.trim() || "Rival por confirmar";
  const conv = convocatoriaState(match, ids, match.published && !match.draft);
  const j = jLabel(match);
  const chip: { tone: ChipTone; text: string; icon: "check" | "clock" | "x" } = played
    ? { tone: "ok", text: "Acta publicada", icon: "check" }
    : state === "cancelled"
      ? { tone: "", text: "Cancelado", icon: "x" }
      : state === "postponed"
        ? { tone: "", text: "Aplazado", icon: "clock" }
        : { tone: "sky", text: state === "next" ? "Próximo partido" : "Programado", icon: "clock" };

  let lines: { ok: boolean; text: string }[];
  let lead: string;
  if (played) {
    const sheet = fromMatch(match);
    const by = new Map<string, number>();
    let own = 0;
    for (const g of goalRows(sheet)) {
      if (g.kind === "og") own++;
      else if (g.scorer) by.set(g.scorer, (by.get(g.scorer) ?? 0) + 1);
    }
    const scorers = [...by.entries()].map(([id, n]) => `${nameOf(id)}${n > 1 ? ` ×${n}` : ""}`);
    if (own) scorers.push(`autogol de ${rival}${own > 1 ? ` ×${own}` : ""}`);
    lead = scorers.length ? `Goles: ${scorers.join(", ")}.` : "Sin goles del Piti.";
    const winIds = mvpWinners(match, mvpResult, data.now);
    const closes = dateMillis(match.voteClosesAt);
    const mvp = mvpStatus(
      {
        finished: true,
        published: true,
        voteClosesAt: Number.isFinite(closes) ? closes : null,
        winners: winIds.map((id) => nameOf(id)),
        votes: winIds.length && mvpResult ? (mvpResult.counts[winIds[0]] ?? 0) : 0,
        total: mvpResult?.total ?? 0,
      },
      data.now,
    );
    lines = [
      { ok: true, text: "Calendario, perfiles y estadísticas al día" },
      { ok: true, text: `MVP: ${mvp}` },
      { ok: true, text: `Convocatoria: ${plural(match.starters?.length ?? 0, "titular", "titulares")} y ${plural(match.bench?.length ?? 0, "suplente", "suplentes")}` },
    ];
  } else {
    const c = rsvpCounts(rsvp.data, ids);
    const answers = c.yes + c.maybe + c.no;
    lead = off
      ? state === "cancelled"
        ? "Partido cancelado: no cuenta para las estadísticas."
        : "Partido aplazado: pon la nueva fecha en «Encuentro»."
      : `${answers ? `${plural(c.yes, "viene", "vienen")}, ${c.maybe} en duda, ${c.no} no.` : "Aún sin respuestas de los socios."} ${match.kit === "away" ? "2ª equipación." : "1ª equipación."}`;
    lines = [
      { ok: !!match.rival && Number.isFinite(t), text: match.venue ? "Encuentro: rival, fecha, hora y campo" : "Encuentro: rival, fecha y hora · campo pendiente" },
      { ok: conv.ready, text: conv.text },
      { ok: false, text: "El acta se abre al acabar el partido" },
    ];
  }
  return (
    <>
      <div className="dp-h">
        <button type="button" className="bk" onClick={onBack} aria-label="Volver a la lista de partidos">
          <AdIcon name="back" />
        </button>
        <div className="t">
          <p className="kk">
            <i />
            {[j, Number.isFinite(t) ? shortDate(t) : "sin fecha", Number.isFinite(t) ? clockTime(t) : "", match.home === false ? "fuera" : "en casa"].filter(Boolean).join(" · ")}
          </p>
          <h2 className="edt">
            Piti <span className="tn">{played ? `${match.goalsFor ?? 0}–${match.goalsAgainst ?? 0}` : "vs"}</span> {rival}
          </h2>
        </div>
        <div className="meta">
          <Chip tone={chip.tone} icon={chip.icon}>
            {chip.text}
          </Chip>
        </div>
      </div>
      <div className="dp-b scr">
        <div className="pnl">
          <p className="hint">{lead}</p>
          <ul className="cq">
            {lines.map((l) => (
              <li key={l.text}>
                <span className={`ic ${l.ok ? "ok" : ""}`.trim()} aria-hidden="true">
                  {l.ok ? "✓" : "i"}
                </span>
                <span>
                  <b>{l.text}</b>
                </span>
              </li>
            ))}
          </ul>
          <div className="row">
            {played ? (
              <button type="button" className="btn sm pri" onClick={() => onEdit("acta")}>
                <AdIcon name="pencil" size={16} />
                Corregir el acta
              </button>
            ) : (
              <>
                {!off && (
                  <button type="button" className="btn sm pri" onClick={onConvocatoria}>
                    <AdIcon name="list" size={16} />
                    Preparar convocatoria
                  </button>
                )}
                <button type="button" className={`btn sm ${off ? "pri" : "line"}`} onClick={() => onEdit("encuentro")}>
                  <AdIcon name="pencil" size={16} />
                  Editar el encuentro
                </button>
              </>
            )}
            {match.published && (
              <a className="btn sm line" href={`/matches/${match.id}`} target="_blank" rel="noreferrer">
                Ver ficha pública
                <AdIcon name="ext" size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
