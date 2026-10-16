// Turnos del equipo on the public pages (members only): the one line of «Hoy» and the vestuario's hero
// («Te toca: lavar la equipación» / «Lava: Hugo · Balones: Dani») and the list of the match page's
// Vestuario tab. Each job wears its icon AND its name (never colour or icon alone); «tú» is said in words.
import type { ClubMatch } from "../../lib/clubData";
import { turnsLine, type RotaIconId, type Turn } from "../../lib/derived/rota";
import { useMatchTurns } from "../../lib/useRotaTurns";
import "./turnos.css";

const PATHS: Record<RotaIconId, React.ReactNode> = {
  shirt: <path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" />,
  ball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 4 3-1.5 4.5h-5L8 10Z" />
    </>
  ),
  car: (
    <>
      <path d="M5 16V11l2-5h10l2 5v5" />
      <path d="M3 16h18v3H3z" />
      <circle cx="7.5" cy="19" r="1.5" />
      <circle cx="16.5" cy="19" r="1.5" />
    </>
  ),
  bottle: <path d="M10 2h4v3l2 3v13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8l2-3Z" />,
  bag: (
    <>
      <path d="M4 8h16l-1 12H5Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l3 3" />
    </>
  ),
};

/** A job's icon (decorative: its name always goes with it). */
export function RotaIcon({ icon, size = 16 }: { icon: RotaIconId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[icon]}
    </svg>
  );
}

/** «Te toca: lavar la equipación» (highlighted, with a «Te toca» word) or «Lava: Hugo · Balones: Dani». */
export function TurnsLine({ turns, nameOf, me, className }: { turns: readonly Turn[]; nameOf: (id: string) => string; me: string | null | undefined; className?: string }) {
  const line = turnsLine(turns, nameOf, me);
  if (!line) return null;
  const icon = (line.mine ? turns.find((t) => t.playerId === me) : turns.find((t) => t.playerId))?.job.icon ?? "shirt";
  return (
    <p className={["tn-line", line.mine && "mine", className].filter(Boolean).join(" ")}>
      <RotaIcon icon={icon} />
      <span>{line.text}</span>
    </p>
  );
}

/** The host reads the turns of `match` (members only) and shows the one line. */
export function MatchTurnsLine({ match, matches, nameOf, me, enabled, className }: { match: ClubMatch | undefined; matches: readonly ClubMatch[]; nameOf: (id: string) => string; me: string | null | undefined; enabled: boolean; className?: string }) {
  const { turns } = useMatchTurns(match, matches, enabled);
  return <TurnsLine turns={turns} nameOf={nameOf} me={me} className={className} />;
}

/** The match page's Vestuario tab: every job of the match, who does it, and whether a captain changed it. */
export function TurnsList({ match, matches, nameOf, me, enabled }: { match: ClubMatch; matches: readonly ClubMatch[]; nameOf: (id: string) => string; me: string | null | undefined; enabled: boolean }) {
  // (a cancelled or postponed match has no turns: nothing is read for it)
  const off = match.status === "cancelled" || match.status === "postponed";
  const { turns, rota, error } = useMatchTurns(match, matches, enabled && !off);
  // (a failed read is said: never just a missing list, which would read as «no turns»)
  if (off || (!error && (!rota?.jobs.length || !turns.length))) return null;
  return (
    <section className="fc-sec tn-list" aria-labelledby={`tn-${match.id}`}>
      <span className="hm-kick">Turnos del equipo</span>
      <h2 className="hm-h2" id={`tn-${match.id}`}>
        ¿A quién le toca?
      </h2>
      {error && !turns.length ? (
        <p className="fc-note">No se han podido cargar los turnos. Prueba a recargar la página.</p>
      ) : (
      <ul>
        {turns.map((t) => (
          <li key={t.job.id} className={t.playerId && t.playerId === me ? "mine" : undefined}>
            <RotaIcon icon={t.job.icon} size={18} />
            <span className="tn-job">{t.job.name}</span>
            <b className="tn-who">
              {t.playerId ? nameOf(t.playerId) : "Nadie disponible"}
              {t.playerId && t.playerId === me && <small> · te toca</small>}
            </b>
            {t.pinned && t.swappedFrom && <small className="tn-note">Cambio del capitán (le tocaba a {nameOf(t.swappedFrom)})</small>}
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}
