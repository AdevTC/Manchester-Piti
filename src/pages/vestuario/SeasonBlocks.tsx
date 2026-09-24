import type { MedalView, Partner, SeasonSummary, StepState } from "../../lib/vestuario";
import { initials, plural, versusBest } from "../../lib/vestuario";
import { Icon, type IconName } from "../../components/celeste/icons";

const pct = (n: number, of: number) => `${Math.round(Math.min(1, of > 0 ? n / of : 0) * 100)}%`;

export function SeasonFeats({ s, firstName, seasonName, playerName }: { s: SeasonSummary; firstName: string; seasonName: string; playerName: (id: string) => string }) {
  const toGo = s.milestone - s.careerPlayed;
  const playedCopy = [
    s.streak > 1 ? `${s.streak} partidos seguidos.` : "",
    `A ${plural(toGo, "partido", "partidos")} de la medalla de los ${s.milestone}.`,
  ].filter(Boolean).join(" ");
  const assistCopy = s.assistTarget
    ? `${s.assistTarget.count === 1 ? "Una acabó" : `${s.assistTarget.count} acabaron`} en gol de ${playerName(s.assistTarget.playerId)}.`
    : versusBest(s.assists, s.bestAssists, "pases de gol", "Tu primer pase de gol");
  return (
    <section className="vx-block">
      <span className="vx-kick">Tu temporada · {seasonName}</span>
      <h2 className="vx-h2">Lo que llevas, {firstName}</h2>
      <div className="vx-feats">
        <Feat n={s.played} title={s.played === 1 ? "partido jugado" : "partidos jugados"} copy={playedCopy} bar={pct(s.careerPlayed, s.milestone)} />
        <Feat tone="goals" n={s.goals} title={s.goals === 1 ? "gol" : "goles"} copy={versusBest(s.goals, s.bestGoals, "goles", "Tu primer gol")} bar={pct(s.goals, Math.max(s.bestGoals + 1, s.goals, 1))} />
        <Feat n={s.assists} title={s.assists === 1 ? "asistencia" : "asistencias"} copy={assistCopy} bar={pct(s.assists, Math.max(s.bestAssists + 1, s.assists, 1))} />
        <Feat
          tone="mvp"
          n={s.mvps}
          title="MVP"
          copy={s.mvps ? `El vestuario te ha elegido ${plural(s.mvps, "vez", "veces")} esta temporada.` : "El vestuario aún no te ha votado MVP esta temporada."}
          bar={pct(s.mvps, Math.max(s.played, 1))}
        />
      </div>
    </section>
  );
}
function Feat({ n, title, copy, bar, tone }: { n: number; title: string; copy: string; bar: string; tone?: "goals" | "mvp" }) {
  return (
    <div className={`vx-feat${tone ? " " + tone : ""}`}>
      <span className="n">{n}</span>
      <div>
        <div className="t">{title}</div>
        <p>{copy}</p>
        <div className="bar" aria-hidden="true">
          <i style={{ width: bar }} />
        </div>
      </div>
    </div>
  );
}

const MEDAL_ICON: Record<string, IconName> = { debut: "star", goal: "ball", assist: "boot", mvp: "crown", ten: "flame", hat: "ball" };
export function Vitrina({ medals }: { medals: MedalView[] }) {
  const earned = medals.filter((m) => m.earned).length;
  return (
    <section className="vx-block">
      <span className="vx-kick">
        Tus logros · {earned} de {medals.length}
      </span>
      <h2 className="vx-h2">{earned ? "Tu vitrina" : "Tu vitrina te espera"}</h2>
      <ul className="vx-medals">
        {medals.map((m) => (
          <li key={m.id} className={`vx-medal ${m.earned ? (m.tone === "gold" ? "on" : "sky") : "off"}`}>
            <span className="m">
              <Icon name={m.earned || m.id !== "hat" ? MEDAL_ICON[m.id] : "lock"} size={m.earned ? 30 : 26} stroke={2} />
            </span>
            <b>{m.label}</b>
            <span>
              {m.detail}
              <span className="vx-sr">{m.earned ? " · conseguido" : " · pendiente"}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BestPartner({ partner, meName, partnerName }: { partner: Partner | null; meName: string; partnerName: string }) {
  return (
    <section className="vx-block">
      <span className="vx-kick">Química</span>
      <h2 className="vx-h2">Tu mejor socio</h2>
      {partner ? (
        <div className="vx-partner">
          <div className="vx-duo" aria-hidden="true">
            <span className="g-sky">{initials(meName)}</span>
            <i>+</i>
            <span className="g-gold">{initials(partnerName)}</span>
          </div>
          <p>
            <b>{partnerName}</b> y tú: {plural(partner.together, "partido", "partidos")} juntos, {plural(partner.wins, "victoria", "victorias")}
            {partner.theirGoalsFromYou ? ` y ${plural(partner.theirGoalsFromYou, "gol suyo", "goles suyos")} con pase tuyo` : ""}
            {partner.yourGoalsFromThem ? `${partner.theirGoalsFromYou ? "; " : " y "}${plural(partner.yourGoalsFromThem, "gol tuyo", "goles tuyos")} con pase suyo` : ""}.
          </p>
        </div>
      ) : (
        <p className="vx-empty">Juega tu primer partido y aquí aparecerá con quién haces mejor pareja.</p>
      )}
    </section>
  );
}

/** Before the ficha is linked: the same four numbers, outlined, each saying how it will fill. */
export function SeasonPlaceholder({ firstName, seasonName }: { firstName: string; seasonName: string }) {
  const feats = [
    { title: "partidos jugados", copy: "Se cuentan solos desde tu primera convocatoria." },
    { tone: "goals", title: "goles", copy: "Cada gol del acta suma aquí y en tu ficha." },
    { title: "asistencias", copy: "Y sabrás a quién le das más pases de gol." },
    { tone: "mvp", title: "MVP", copy: "El vestuario vota tras cada partido." },
  ] as const;
  return (
    <section className="vx-block">
      <span className="vx-kick">Tu temporada · {seasonName}</span>
      <h2 className="vx-h2">Lo que llevarás{firstName ? `, ${firstName}` : ""}</h2>
      <div className="vx-feats">
        {feats.map((f) => (
          <div key={f.title} className={`vx-feat ph${"tone" in f ? " " + f.tone : ""}`}>
            <span className="n" aria-hidden="true">
              0
            </span>
            <div>
              <div className="t">
                <span className="vx-sr">0 </span>
                {f.title}
              </div>
              <p>{f.copy}</p>
              <div className="bar" aria-hidden="true">
                <i />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface Step {
  id: string;
  state: StepState;
}
const STEP_COPY: Record<string, { title: string; sub: (o: StepContext) => string; target?: string; go?: string }> = {
  enter: { title: "Entraste al vestuario", sub: () => "" },
  ficha: { title: "Vincula tu ficha", sub: (o) => (o.claimPending ? "Pendiente de aprobar" : "Tu dorsal en la camiseta"), target: "vx-ficha", go: "Arriba ↑" },
  rsvp: { title: "Responde a la convocatoria", sub: (o) => (o.matchOpen ? "¿Vas al próximo partido?" : "Cuando se publique el partido"), target: "vx-rsvp", go: "Arriba ↑" },
  board: { title: "Saluda en el tablón", sub: () => "Un toque, abajo", target: "vx-board", go: "Ir ↓" },
};
interface StepContext {
  claimPending: boolean;
  matchOpen: boolean;
}
function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  const focusable = el.matches("button, input, [tabindex]") ? el : el.querySelector<HTMLElement>("button:not([disabled]), input");
  focusable?.focus({ preventScroll: true });
}
/** "Primeros pasos": a guide, never a gate — every step is optional and can be hidden. */
export function FirstSteps({ steps, onHide, ...ctx }: { steps: Step[]; onHide: () => void } & StepContext) {
  const done = steps.filter((s) => s.state === "done").length;
  return (
    <section className="vx-block">
      <span className="vx-kick">Primeros pasos</span>
      <h2 className="vx-h2">Tu primera semana</h2>
      <div className="vx-steps-card">
        <div className="vx-steps-head">
          <b>
            {done} de {steps.length} hechos
          </b>
          <button type="button" className="vx-link-btn" onClick={onHide}>
            Ocultar
          </button>
        </div>
        <div className="vx-pbar" aria-hidden="true">
          <i style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        <ol className="vx-stepl">
          {steps.map((s, i) => {
            const c = STEP_COPY[s.id];
            const sub = c.sub(ctx);
            return (
              <li key={s.id} className={s.state}>
                <span className="c" aria-hidden="true">
                  {s.state === "done" ? <Icon name="check" size={14} stroke={3} /> : i + 1}
                </span>
                <span className="t">
                  {c.title}
                  <span className="vx-sr">{s.state === "done" ? " · hecho" : " · pendiente"}</span>
                  {sub && s.state !== "done" && <span>{sub}</span>}
                </span>
                {s.state === "now" && c.target ? (
                  <button type="button" className="go" onClick={() => jumpTo(c.target!)}>
                    {c.go}
                    <span className="vx-sr"> · {c.title}</span>
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
