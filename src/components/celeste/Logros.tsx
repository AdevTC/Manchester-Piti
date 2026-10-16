// «Logros»: a player's medals as a catalogue (shared by /jugadores/$id «Sus medallas» and the perfil's
// Temporada). The earned ones as small crests with their tier (shape + word, never colour alone) and the
// match where each was won; the next three to chase with a bar and «7 / 10» in words; the rest folded.
// Pure render: every date is read in Madrid from the `now` the host passes (no clock here), so the
// server-rendered jugador page and the client draw the same markup.
import { Link } from "@tanstack/react-router";
import type { Achievement, AchievementFamily } from "../../lib/derived/achievements";
import { groupLogros, medalDay, progressText, TIER_WORD } from "./logrosView";
import { Icon, type IconName } from "./icons";
import "./logros.css";

const FAMILY_ICON: Record<AchievementFamily, IconName> = {
  partidos: "shirt",
  goles: "ball",
  asistencias: "send",
  mvp: "crown",
  hattrick: "ball",
  doblete: "ball",
  cero: "shield",
  invicto: "flag",
  racha: "flame",
  comodin: "shuffle",
  minutos: "boot",
  debut: "star",
};

const TIER_CLASS: Record<Achievement["tier"], string> = { 0: "uno", 1: "bronce", 2: "plata", 3: "oro" };

/** The crest: a shield in the tier's metal with the family's mark, and one pip per tier (the shape says it too). */
function Crest({ a, on }: { a: Achievement; on: boolean }) {
  return (
    <span className={`lg-crest ${TIER_CLASS[a.tier]}${on ? " on" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 40 46" width="40" height="46">
        <path className="lg-shield" d="M20 2.5 36.5 8v13.6c0 10.6-7.2 17.6-16.5 21.9C10.7 39.2 3.5 32.2 3.5 21.6V8Z" />
        <path className="lg-band" d="M3.5 30.5h33" />
      </svg>
      <span className="lg-ic">
        <Icon name={FAMILY_ICON[a.family]} size={18} stroke={2} />
      </span>
      {a.tier > 0 && (
        <span className="lg-pips">
          {Array.from({ length: a.tier }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      )}
    </span>
  );
}

function Tier({ a }: { a: Achievement }) {
  return a.tier > 0 ? <span className={`lg-tier ${TIER_CLASS[a.tier]}`}>{TIER_WORD[a.tier]}</span> : null;
}

function Progress({ a }: { a: Achievement }) {
  if (!a.progress) return <small className="lg-detail">{a.detail}</small>;
  const pct = a.progress.goal > 0 ? Math.min(100, Math.round((a.progress.now / a.progress.goal) * 100)) : 0;
  return (
    <span className="lg-prog">
      <span className="lg-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
      <small className="lg-num">
        {progressText(a.progress)}
        <span className="hm-sr"> ({a.detail})</span>
      </small>
    </span>
  );
}

export function Logros({ list, next, now, self = false }: { list: Achievement[]; next: Achievement[]; now: number; self?: boolean }) {
  const g = groupLogros(list, next);
  return (
    <div className="lg">
      <p className="lg-sum">
        <b>{g.earned.length}</b> de {list.length} {list.length === 1 ? "logro" : "logros"}
      </p>
      {g.earned.length ? (
        <ul className="lg-won" aria-label={self ? "Tus logros" : "Sus logros"}>
          {g.earned.map((a) => (
            <li key={a.id}>
              <Crest a={a} on />
              <span className="lg-t">
                <b>{a.label}</b>
                <Tier a={a} />
              </span>
              {a.at ? (
                <Link className="lg-at" to="/matches/$matchId" params={{ matchId: a.at.matchId }}>
                  {`${medalDay(a.at.date, now)} · vs ${a.at.rival}`}
                </Link>
              ) : (
                <small className="lg-detail">{a.detail}</small>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="lg-empty">{self ? "Aún no has ganado ninguno: el primero llega con tu debut." : "Aún no ha ganado ninguno."}</p>
      )}

      {g.next.length > 0 && (
        <section className="lg-next" aria-label="Lo próximo">
          <h3 className="lg-h">Lo próximo</h3>
          <ul>
            {g.next.map((a) => (
              <li key={a.id}>
                <Crest a={a} on={false} />
                <span className="lg-t">
                  <b>{a.label}</b>
                  <Tier a={a} />
                </span>
                <Progress a={a} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {g.rest.length > 0 && (
        <details className="lg-all">
          <summary>
            Todos los logros <span className="lg-count">· {g.rest.length} por conseguir</span>
          </summary>
          <ul>
            {g.rest.map((a) => (
              <li key={a.id}>
                <Crest a={a} on={false} />
                <span className="lg-t">
                  <b>{a.label}</b>
                  <Tier a={a} />
                </span>
                <Progress a={a} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
