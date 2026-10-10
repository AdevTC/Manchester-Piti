// The publish peak (/admin/partidos/$matchId?vitrina), as on the canvas (stats-gen/ad-v2-full.mjs `publicado`,
// shots-adv2f/publicado.png): the whistle «Final del partido · J8» → the scoreboard locks on FINAL with a
// gold flash → the vitrina rises (the seven shirts with their stickers and the plaque «V · J8 · MAD SKY 2–1
// · 8 nov · fuera») → the season's shelf gains the result (unpublished actas stay as gaps) → the caption
// «Acta publicada · la web ya lo cuenta» → the hand-off: Compartir el cartel (gold), MVP abierto 48 h +
// Corregir el acta, Volver a Hoy, Ver el partido en la web ↗. The CSS plays it once, when it mounts;
// with prefers-reduced-motion everything is simply there (admin.css switches the animations off).
import { useState } from "react";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { shareClubPage } from "../../../lib/share";
import { mvpWinners } from "../../../lib/vestuario";
import { type AdminMatch } from "../data/adminLogic";
import { useWhistled } from "../data/whistleStore";
import { ResultMark, ShirtBack, Stickers } from "../kit";
import { useAdmin, useAdminGo } from "../shell/context";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import { mvpStatus } from "../acta/publish";
import { namesFor, rosterFor } from "../acta/roster";
import { useMatchMvp } from "../partidos/live";
import { vitrinaOf } from "./vitrinaModel";

const isAbort = (e: unknown) => !!e && typeof e === "object" && (e as { name?: unknown }).name === "AbortError";

export function Publicado({ match }: { match: AdminMatch }) {
  const data = useAdmin();
  const go = useAdminGo();
  const toast = useToast();
  const whistled = useWhistled();
  const [sharing, setSharing] = useState(false);
  const roster = rosterFor(data.players, data.seasons, match.seasonId);
  const names = namesFor(data.players, data.seasons, match.seasonId);
  const nameOf = (id: string) => names(id);
  const numberOf = (id: string) => {
    const n = roster.find((p) => p.id === id)?.number;
    return n != null ? String(n) : "";
  };
  const mvpResult = useMatchMvp(match.id);
  const closes = dateMillis(match.voteClosesAt);
  const winIds = mvpWinners(match, mvpResult, data.now);
  const closed = mvpStatus(
    { finished: true, published: true, voteClosesAt: Number.isFinite(closes) ? closes : null, winners: winIds.map(nameOf), votes: winIds.length && mvpResult ? (mvpResult.counts[winIds[0]] ?? 0) : 0, total: mvpResult?.total ?? 0 },
    data.now,
  );
  const season = data.seasons.find((s) => s.id === match.seasonId);
  const v = vitrinaOf({
    match,
    matches: data.matches,
    seasonName: season?.name ?? "",
    now: data.now,
    whistled,
    nameOf,
    numberOf,
    closedMvp: closed.charAt(0).toUpperCase() + closed.slice(1),
  });

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    const native = typeof navigator !== "undefined" && typeof navigator.share === "function";
    try {
      await shareClubPage("partido", match.id, `Manchester Piti ${v.gf}–${v.ga} ${v.rival}`);
      toast.show({ tag: v.j, message: native ? `Cartel ${v.j} listo · compártelo en el grupo` : `Enlace del cartel ${v.j} copiado · pégalo en el grupo` });
    } catch (e) {
      if (!isAbort(e)) toast.show({ tone: "error", message: "No se ha podido compartir el cartel. Vuelve a intentarlo." });
    } finally {
      setSharing(false);
    }
  };

  return (
    <section className="pubv" aria-label="Acta publicada">
      <div className="flash" aria-hidden="true" />
      <span className="wh">
        <AdIcon name="whistle" size={20} />
        Final del partido · {v.j} · el acta sale a la web
      </span>
      <div className="sb">
        <div className="pn" aria-label={`Final: PITI ${v.gf}, ${v.rival} ${v.ga}`} role="img">
          <span className="tm">
            <img src="/crest-128.webp" alt="" width={44} height={44} />
            PITI
          </span>
          <div className="mid">
            <span className="led big lock">
              {v.gf}-{v.ga}
            </span>
            <span className="sub gd lock">FINAL</span>
          </div>
          <span className="tm">
            <span className="rc">{match.rivalLogoUrl && /^https:\/\//i.test(match.rivalLogoUrl) ? <img src={match.rivalLogoUrl} alt="" width={30} height={30} /> : <AdIcon name="shield" size={24} />}</span>
            {v.rival}
          </span>
        </div>
      </div>
      <div className="vit" role="group" aria-label="La vitrina">
        <div className="s7">
          {v.seven.map((p) => (
            <span key={p.id} className="peg" style={{ position: "relative" }}>
              <ShirtBack num={p.num} size={56} />
              <Stickers list={p.stickers} />
              <span className="nm">{p.name}</span>
            </span>
          ))}
        </div>
        <div className="pq lock">
          <ResultMark r={v.r} />
          {v.j} · {v.rival} {v.gf}–{v.ga}
          <small>
            {v.date} · {v.where}
          </small>
        </div>
      </div>
      <div className="shelf" role="group" aria-label={`La vitrina de la ${season?.name ?? "temporada"}`}>
        <span className="lb">{v.shelfLabel}</span>
        {v.shelf.map((x) => (
          <span key={x.id} className={["ved", x.r ?? "o", x.fresh ? "nw" : ""].filter(Boolean).join(" ")} role="img" aria-label={x.aria}>
            {x.r ?? "·"}
          </span>
        ))}
      </div>
      <div className="l3p" role="status">
        <span className="k">
          <AdIcon name="check" size={18} />
        </span>
        <span className="t">
          Acta publicada · la web ya lo cuenta
          <small>Calendario, perfiles y estadísticas al día · la vitrina suma la {v.j}</small>
        </span>
      </div>
      <div className="ho">
        <div className="hc">
          <span className="cartel" aria-hidden="true">
            <span>{v.j}</span>
            <b>
              {v.gf}–{v.ga}
            </b>
            <span>{v.rival}</span>
          </span>
          <span>
            <b>El cartel del partido</b>
            <small>{v.scorers ? `Resultado, goleadores y los cromos de ${v.scorers}` : "Resultado y el siete del partido"}</small>
          </span>
          <button type="button" className="btn gold" onClick={() => void share()} aria-disabled={sharing}>
            <AdIcon name="share" size={18} />
            Compartir el cartel
          </button>
        </div>
        <div className="hc">
          <span className="mvp" aria-hidden="true">
            <AdIcon name="star" size={26} />
          </span>
          <span>
            <b>{v.mvp.title}</b>
            <small>{v.mvp.detail}</small>
          </span>
          <button type="button" className="btn line" onClick={() => go({ section: "partidos", matchId: match.id, tab: "acta" })}>
            Corregir el acta
          </button>
        </div>
        <div className="lk">
          <button type="button" className="btn line" onClick={() => go({ section: "hoy" })}>
            Volver a Hoy
          </button>
          <a className="btn line" href={`/matches/${match.id}`} target="_blank" rel="noreferrer">
            Ver el partido en la web
            <AdIcon name="ext" size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
