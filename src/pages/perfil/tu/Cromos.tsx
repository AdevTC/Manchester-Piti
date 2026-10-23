// /perfil/temporada/cromos (TU boards tu-story): his season in cromos, at his own pace — the bars on top, ← →
// (keys, buttons or a tap on either half), «Compartir este» and «Descargar todos». Esc, × or «atrás» close it.
import { useContext, useEffect, useRef, useState } from "react";
import { isCompleted } from "../../../../functions/src/matchEngine";
import { useClubData } from "../../../lib/clubData";
import { KitStillContext } from "../../../components/jersey3d/kitStill";
import { TuIcon, TuLayer } from "../../../components/vidrio/tu/ui";
import { copyText, saveBlob } from "../fxRuntime";
import { shareOut, type ShareNav } from "../share";
import { seasonCalendar } from "../card";
import { matchDay, matchTime } from "../lines";
import { pl } from "./model";
import type { ScreenProps } from "./MiPagina";
import { cromoImage, cromosOf, type Cromo } from "./cromosModel";
import { goalClock, minutesTogether, stretchesOf, winsWith } from "./season";

const CLOCK = ["0–10′", "10–20′", "20–30′", "30–40′", "40–50′"];

export function Cromos(p: ScreenProps & { onClose: () => void }) {
  const { data, say, onClose } = p;
  const { matches, players } = useClubData();
  const still = useContext(KitStillContext);
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const c = data.card;
  const pid = data.ficha.playerId ?? "";
  const nameOf = (id: string) => {
    const x = players.find((q) => q.id === id);
    return x ? x.shirtName || x.firstName || "" : "";
  };
  const cal = seasonCalendar(matches, data.seasonId);
  const games = cal.filter((m) => isCompleted(m));
  const finished = games.length > 0 && games.length === cal.filter((m) => m.status !== "cancelled").length;
  const jOf = new Map(c.series.map((s) => [s.id, s.j]));
  const one = games.length === 1 ? games[0] : null;
  const st = one ? stretchesOf(one, jOf.get(one.id) ?? 1, pid, c.posLong, nameOf) : null;
  const clock = goalClock(games, pid);
  const best = clock.indexOf(Math.max(...clock));
  const firstGoal = c.series.find((s) => s.goals > 0);
  const firstGoalMatch = firstGoal ? games.find((m) => m.id === firstGoal.id) : null;
  const partner = c.partner;
  const nx = data.next;
  const lastRes = c.last5.length ? c.last5[c.last5.length - 1].l : null;
  const medals = (data.logros?.list ?? []).filter((m) => m.earned);
  const nextM = data.logros?.next[0];
  const list: Cromo[] = cromosOf({
    seasonName: data.seasonName,
    finished,
    played: c.totals.played,
    minutes: c.totals.minutes,
    goals: c.totals.goals,
    assists: c.totals.assists,
    wins: winsWith(games, c.series),
    firstJ: c.series[0]?.label ?? "J1",
    lastJ: c.series[c.series.length - 1]?.label ?? "J1",
    firstGoal: firstGoal && firstGoalMatch ? `${firstGoal.label} contra ${firstGoalMatch.rival}` : null,
    stints: st ? st.stints.length : null,
    oneLine: one ? `La J${jOf.get(one.id) ?? 1}, ${one.home === false ? "fuera" : "en casa"} contra ${one.rival}.` : null,
    myNum: c.number,
    partner: partner ? { name: partner.name, num: partner.number, line: one ? `${minutesTogether(one, pid, partner.playerId, nameOf)}′ juntos` : pl(partner.together, "partido juntos", "partidos juntos") } : null,
    bestClock: clock[best] ? { label: CLOCK[best], goals: clock[best] } : null,
    pos: c.posLong ?? "—",
    medals: medals.map((m) => m.label),
    nextMedal: nextM ? { t: nextM.label, left: nextM.progress ? String(Math.max(0, nextM.progress.goal - nextM.progress.now)) : "" } : null,
    rating: c.rating === null ? "" : String(c.rating),
    tier: c.tierName,
    next: nx ? { j: nx.j ? `J${nx.j}` : "Lo próximo", where: nx.home === false ? `en casa de ${nx.rival}` : `en casa contra ${nx.rival}`, when: `${matchDay(nx.dateMs)} a las ${matchTime(nx.dateMs)}`, revancha: lastRes === "P" } : null,
  });
  const n = list.length;
  const k = Math.min(i, n - 1);
  const cur = list[k];
  const src = (cr: Cromo) => (cr.shirt ? (still("home", cr.shirt)?.src ?? null) : null);
  const next = () => (k < n - 1 ? setI(k + 1) : onClose());
  const prev = () => setI(Math.max(0, k - 1));

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      before?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  const file = (cr: Cromo, j: number) => `cromo-${j + 1}-${cr.k.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`;
  const shareOne = async () => {
    const blob = await cromoImage(cur, src(cur), "/crest-128.webp").catch(() => null);
    const f = blob ? new File([blob], file(cur, k), { type: "image/png" }) : null;
    const link = `${p.origin}/jugadores/${pid}`;
    const out = await shareOut({ nav: navigator as ShareNav, file: f, link, title: `${cur.k} · Manchester Piti`, text: `${cur.k}: ${cur.big} ${cur.t}.`, copy: copyText });
    if (out === "shared-file") say(`Compartiendo el cromo «${cur.k}».`);
    else if (out === "copied") say("Este navegador no comparte imágenes: te hemos copiado el enlace.");
  };
  const all = async () => {
    say(`Descargando los ${n} cromos.`);
    for (const [j, cr] of list.entries()) {
      const blob = await cromoImage(cr, src(cr), "/crest-128.webp").catch(() => null);
      if (blob) saveBlob(blob, file(cr, j));
    }
  };
  const alt = `${cur.k}: ${cur.big} ${cur.t}. ${cur.d} Cromo ${k + 1} de ${n}.`;
  const shirt = src(cur);
  return (
    <TuLayer cls="o-cromos">
      <div
        ref={box}
        className="tu-story"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tu-st-t"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            if (k < n - 1) setI(k + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            prev();
          }
        }}
      >
        <div className="tu-story__in">
          <div className="tu-story__bars" aria-hidden="true">
            {list.map((cr, j) => (
              <i key={cr.k} className={j < k ? "is-done" : j === k ? "is-on" : ""} />
            ))}
          </div>
          <header className="tu-story__head">
            <h2 id="tu-st-t">Tu temporada en cromos</h2>
            <span>
              {k + 1} de {n}
            </span>
            <button type="button" className="tu-x2" aria-label="Cerrar los cromos" onClick={onClose}>
              <TuIcon name="close" />
            </button>
          </header>
          <div className={`tu-cromo${cur.gold ? " is-gold" : ""}`} role="group" aria-roledescription="cromo" aria-label={alt}>
            <img className="tu-cromo__crest" src="/crest-128.webp" alt="" />
            <small className="tu-cromo__k">{cur.k}</small>
            {shirt && <img className="tu-cromo__img" src={shirt} alt="" />}
            <b className="tu-cromo__big">{cur.big}</b>
            <span className="tu-cromo__t">{cur.t}</span>
            <p className="tu-cromo__d">{cur.d}</p>
          </div>
          <div className="tu-story__nav">
            <button type="button" className="vd-glass vd-press vd-ibtn" aria-label="Cromo anterior" aria-disabled={k === 0} onClick={prev}>
              <TuIcon name="chev-l" />
            </button>
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => void shareOne()}>
              <TuIcon name="share" />
              Compartir este
            </button>
            <button type="button" className="vd-link tu-story__all" onClick={() => void all()}>
              Descargar todos
            </button>
            <button type="button" className="vd-glass vd-press vd-ibtn" aria-label={k < n - 1 ? "Siguiente cromo" : "Cerrar los cromos"} onClick={next}>
              <TuIcon name="chev-r" />
            </button>
          </div>
        </div>
      </div>
    </TuLayer>
  );
}
