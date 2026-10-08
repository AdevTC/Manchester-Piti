// Fichas — socios who ask to link their account to a player of the plantilla. Pending first (who, the
// ficha with its dorsal, when, how they came into the vestuario, e-mail) with Aprobar / Rechazar behind an
// undo toast: the backend cannot take an approval back (rejecting unlinks, but leaves the claim
// «rechazada»), so «Deshacer» holds the call for the toast's window instead — nothing is faked. Resolved
// below (who resolved it, when), then the linked accounts with «Desvincular» (the old PlayerClaims list).
import { useMemo, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { playerName } from "../../../lib/clubData";
import { useClaimsLog, useMembersVia, type ClaimLogRow } from "../club/clubLive";
import { handle, relativeWhen, resolvedText, viaText } from "../club/fichasLogic";
import { nameIn, numberIn } from "../club/plantillaLogic";
import { useClubWrites } from "../club/useClubWrites";
import { AdminView } from "../shell/AdminView";
import { useAdmin } from "../shell/context";
import { Chip, EmptyState, SkeletonRows } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import { LoadError } from "../club/ClubStates";
import "../../../styles/admin-club.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const RESOLVED_SHOWN = 12;

interface Decision {
  approve: boolean;
  /** The claim's `at` when decided (a later request of the same member is a new claim). */
  claimAt: number;
}

export function Fichas() {
  const data = useAdmin();
  const toast = useToast();
  const writes = useClubWrites();
  const { profile } = useAuth();
  const log = useClaimsLog();
  const members = useMembersVia();
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [unlinked, setUnlinked] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const me = profile?.nickname || "ti";
  const nickOf = useMemo(() => {
    const byUid = new Map(data.people.map((p) => [p.uid, p.nickname || p.email]));
    return (uid: string) => byUid.get(uid) || "un capitán";
  }, [data.people]);
  const memberOf = useMemo(() => new Map(members.data.map((m) => [m.uid, m])), [members.data]);
  const logOf = useMemo(() => new Map(log.data.map((c) => [c.uid, c])), [log.data]);
  const sid = data.season?.id;
  const playerOf = (id: string) => {
    const p = data.players.find((x) => x.id === id);
    if (!p) return null;
    const s = sid && (p.seasons ?? []).includes(sid) ? sid : undefined;
    return { num: numberIn(p, s), name: nameIn(p, s) };
  };

  const isDecided = (uid: string) => {
    const d = decided[uid];
    return !!d && (d.claimAt === 0 || d.claimAt === (logOf.get(uid)?.at ?? 0));
  };
  const pending = data.claims.filter((c) => !isDecided(c.uid));
  const optimistic = data.claims.filter((c) => isDecided(c.uid));
  const resolved = log.data.filter((c) => c.status !== "pending").sort((a, b) => b.resolvedAt - a.resolvedAt);
  const linked = data.people
    .filter((p) => !p.removed && p.playerId && !unlinked.has(p.uid))
    .map((p) => ({ person: p, claim: logOf.get(p.uid) }))
    .sort((a, b) => (a.person.nickname || a.person.email).localeCompare(b.person.nickname || b.person.email, "es"));

  const nP = pending.length;
  const chip = nP ? { tone: "gold" as const, text: plural(nP, "pendiente", "pendientes") } : { tone: "ok" as const, text: "Al día" };

  // The row leaves: the focus moves to the next decision (or to the empty state).
  const focusNext = () =>
    requestAnimationFrame(() => {
      const next = listRef.current?.querySelector<HTMLElement>(".fc:not(.res) .fa .btn") ?? listRef.current?.querySelector<HTMLElement>("#fc-pend");
      next?.focus({ preventScroll: true });
    });

  const decide = (uid: string, approve: boolean) => {
    const c = data.claims.find((x) => x.uid === uid);
    if (!c) return;
    const who = handle(c);
    const num = c.player?.number != null ? ` (${c.player.number})` : "";
    const claimAt = logOf.get(uid)?.at ?? 0;
    const back = () =>
      setDecided((d) => {
        const n = { ...d };
        delete n[uid];
        return n;
      });
    setDecided((d) => ({ ...d, [uid]: { approve, claimAt } }));
    toast.defer({
      message: approve ? `Ficha aprobada · ${who} ya es ${c.playerLabel}${num}.` : `Petición de ${who} rechazada · puede volver a pedirla.`,
      commit: () => writes.resolveClaim(uid, approve),
      onUndo: back,
      onError: back,
      errorMessage: approve ? "No se ha podido aprobar la ficha" : "No se ha podido rechazar la petición",
    });
    focusNext();
  };

  const unlink = (uid: string, who: string, player: string) => {
    const back = () =>
      setUnlinked((s) => {
        const n = new Set(s);
        n.delete(uid);
        return n;
      });
    setUnlinked((s) => new Set(s).add(uid));
    toast.defer({
      message: `${who} ya no es ${player} · su cuenta sigue en el vestuario.`,
      commit: () => writes.resolveClaim(uid, false),
      onUndo: back,
      onError: back,
      errorMessage: "No se ha podido desvincular la cuenta",
    });
  };

  const shownResolved = showAll ? resolved : resolved.slice(0, RESOLVED_SHOWN);

  return (
    <AdminView
      kicker="Jornada"
      title="Fichas"
      lead="Socios que piden unir su cuenta a un jugador de la plantilla. Aprobar le deja votar el MVP."
      chips={
        <li>
          <Chip tone={chip.tone} icon="inbox">
            {chip.text}
          </Chip>
        </li>
      }
    >
      {data.error ? (
        <LoadError what="las fichas" />
      ) : data.loading ? (
        <div className="vb scr">
          <SkeletonRows rows={3} label="Cargando las fichas…" />
        </div>
      ) : (
        <div className="vb scr">
          <div className="mfc ad-fichas" ref={listRef}>
            <h2 className="lbl ad-lbl" id="fc-pend" tabIndex={-1}>
              Pendientes
            </h2>
            {pending.length ? (
              <ul className="ad-list" aria-labelledby="fc-pend">
                {pending.map((c) => {
                  const l = logOf.get(c.uid);
                  const who = handle(c);
                  return (
                    <li key={c.uid} className="fc">
                      <span className="av" aria-hidden="true">
                        @
                      </span>
                      <span className="ft">
                        <span>
                          <b>{who}</b> pide la ficha de{" "}
                          <span className="pchip">
                            {c.player?.number != null && <i>{c.player.number}</i>}
                            {c.playerLabel}
                          </span>
                        </span>
                        <small>{[l?.at ? relativeWhen(l.at, data.now) : "", viaText(memberOf.get(c.uid), nickOf), c.email].filter(Boolean).join(" · ")}</small>
                      </span>
                      <div className="fa">
                        <button type="button" className="btn sm gold" onClick={() => decide(c.uid, true)} aria-label={`Aprobar: ${who} es ${c.playerLabel}`}>
                          <AdIcon name="check" size={16} />
                          Aprobar
                        </button>
                        <button type="button" className="btn sm red" onClick={() => decide(c.uid, false)} aria-label={`Rechazar la petición de ${who}`}>
                          <AdIcon name="x" size={16} />
                          Rechazar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="No hay fichas pendientes">Cuando un socio pida su ficha, aparece aquí con su cuenta y quién le abrió la puerta.</EmptyState>
            )}

            <h2 className="lbl ad-lbl" id="fc-res">
              Resueltas
            </h2>
            {optimistic.length || resolved.length ? (
              <ul className="ad-list" aria-labelledby="fc-res">
                {optimistic.map((c) => {
                  const d = decided[c.uid];
                  return (
                    <ResolvedRow
                      key={`now-${c.uid}`}
                      who={handle(c)}
                      num={c.player?.number ?? null}
                      name={c.playerLabel}
                      approved={d.approve}
                      line={`ahora mismo · ${d.approve ? "aprobada" : "rechazada"} por ${me}`}
                    />
                  );
                })}
                {shownResolved.map((c) => (
                  <ResolvedClaim key={c.uid} c={c} now={data.now} player={playerOf(c.playerId)} nickOf={nickOf} />
                ))}
              </ul>
            ) : (
              <p className="hint ad-pad">{log.loading ? "Cargando…" : "Todavía no se ha resuelto ninguna."}</p>
            )}
            {resolved.length > RESOLVED_SHOWN && (
              <button type="button" className="btn sm line ad-self" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                {showAll ? "Ver menos" : `Ver las ${resolved.length} resueltas`}
              </button>
            )}

            <h2 className="lbl ad-lbl" id="fc-link">
              Cuentas vinculadas
            </h2>
            {linked.length ? (
              <ul className="ad-list" aria-labelledby="fc-link">
                {linked.map(({ person, claim }) => {
                  const p = data.players.find((x) => x.id === person.playerId);
                  const shown = p ? playerOf(p.id) : null;
                  const label = shown?.name ?? (p ? playerName(p) : "Ficha borrada");
                  const who = person.nickname ? `@${person.nickname}` : person.email;
                  const canUnlink = !!claim && claim.status === "approved" && claim.playerId === person.playerId;
                  return (
                    <li key={person.uid} className="fc res ad-linked">
                      <span className="av" aria-hidden="true">
                        @
                      </span>
                      <span className="ft">
                        <span>
                          <b>{who}</b> es{" "}
                          <span className="pchip">
                            {shown?.num != null && <i>{shown.num}</i>}
                            {label}
                          </span>
                        </span>
                        <small>{canUnlink ? (claim.resolvedAt ? `ficha aprobada ${relativeWhen(claim.resolvedAt, data.now)}` : "ficha aprobada") : "vinculada al entrar en el vestuario"}</small>
                      </span>
                      {canUnlink && (
                        <button type="button" className="btn sm line ad-unlink" onClick={() => unlink(person.uid, who, label)} aria-label={`Desvincular a ${who} de ${label}`}>
                          Desvincular
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="hint ad-pad">Ninguna cuenta tiene ficha todavía.</p>
            )}
          </div>
        </div>
      )}
    </AdminView>
  );
}

function ResolvedRow({ who, num, name, approved, line }: { who: string; num: number | null; name: string; approved: boolean; line: string }) {
  return (
    <li className="fc res">
      <span className="av" aria-hidden="true">
        @
      </span>
      <span className="ft">
        <span>
          <b>{who}</b> · ficha de{" "}
          <span className="pchip">
            {num != null && <i>{num}</i>}
            {name}
          </span>{" "}
          <Chip tone={approved ? "ok" : "bad"}>{approved ? "Aprobada" : "Rechazada"}</Chip>
        </span>
        <small>{line}</small>
      </span>
    </li>
  );
}

function ResolvedClaim({ c, now, player, nickOf }: { c: ClaimLogRow; now: number; player: { num: number | null; name: string } | null; nickOf: (uid: string) => string }) {
  const approved = c.status === "approved";
  return (
    <ResolvedRow
      who={handle(c)}
      num={player?.num ?? null}
      name={player?.name ?? (c.playerName || "Jugador")}
      approved={approved}
      line={[c.resolvedAt ? relativeWhen(c.resolvedAt, now) : "", resolvedText(approved, c.uid, c.resolvedBy, nickOf)].filter(Boolean).join(" · ")}
    />
  );
}
