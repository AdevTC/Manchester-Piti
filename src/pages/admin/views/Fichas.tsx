// Fichas (/admin/fichas) — socios who ask for their shirt: a claim card each («@nuevo.socio · quiere el 11 ·
// KEVIN», with the shirt hanging on its peg, when, how they came into the vestuario, the e-mail) with
// Aprobar / Rechazar behind a lower third with «Deshacer» (the call waits for it: nothing is faked). «N
// resueltas» folded below — the backend cannot send a claim back to pending, so an approved one offers
// «Desvincular» (the honest undo: it unlinks) and nothing else. Then «la percha de las fichas»: the season's
// shirts, marked only when something is missing («sin socio», «pedida»), and three notes. No claims: the
// dashed shirt «Fichas al día» + «Invitar desde La puerta ↗».
import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { useClaimsLog, useMembersVia } from "../club/clubLive";
import { LoadError } from "../club/ClubStates";
import { handle, relativeWhen, resolvedText, viaText } from "../club/fichasLogic";
import { nameIn } from "../club/plantillaLogic";
import { useClubWrites } from "../club/useClubWrites";
import { Peg, ShirtBack } from "../kit";
import { useAdmin } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";

interface Decision {
  approve: boolean;
  /** The claim's `at` when decided (a later request of the same member is a new claim). */
  claimAt: number;
  /** Who decided it here (this captain). */
  by: string;
}
interface ResolvedRow {
  key: string;
  uid: string;
  title: string;
  line: string;
  /** «Desvincular»: an approved claim whose account still wears that shirt. */
  unlink: { who: string; player: string } | null;
}

const capital = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

export function Fichas() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const toast = useToast();
  const writes = useClubWrites();
  const { profile } = useAuth();
  const log = useClaimsLog();
  const members = useMembersVia();
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [unlinked, setUnlinked] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const me = profile?.nickname || "ti";
  const nickOf = useMemo(() => {
    const byUid = new Map(data.people.map((p) => [p.uid, p.nickname || p.email]));
    return (uid: string) => byUid.get(uid) || "un capitán";
  }, [data.people]);
  const memberOf = useMemo(() => new Map(members.data.map((m) => [m.uid, m])), [members.data]);
  const logOf = useMemo(() => new Map(log.data.map((c) => [c.uid, c])), [log.data]);
  const sid = data.season?.id;
  const shirtName = (playerId: string, fallback: string) => {
    const r = data.roster.find((x) => x.id === playerId);
    if (r) return r.name;
    const p = data.players.find((x) => x.id === playerId);
    return p ? nameIn(p, sid && (p.seasons ?? []).includes(sid) ? sid : undefined) : fallback || "Jugador";
  };

  const isDecided = (uid: string) => {
    const d = decided[uid];
    return !!d && (d.claimAt === 0 || d.claimAt === (logOf.get(uid)?.at ?? 0));
  };
  const pending = data.claims.filter((c) => !isDecided(c.uid));
  const justDecided = data.claims.filter((c) => isDecided(c.uid));

  // Who wears each shirt now (the decisions and unlinks waiting behind «Deshacer» included).
  const owner = new Map<string, string>();
  for (const p of data.people) if (!p.removed && p.playerId && !unlinked.has(p.uid)) owner.set(p.playerId, p.uid);
  for (const c of justDecided) if (decided[c.uid]?.approve) owner.set(c.playerId, c.uid);

  const resolved: ResolvedRow[] = [
    ...justDecided.map((c): ResolvedRow => {
      const d = decided[c.uid];
      return { key: `now-${c.uid}`, uid: c.uid, title: `${handle(c)} → ${c.playerLabel}`, line: `${d.approve ? "Aprobada" : "Rechazada"} por ${d.by} · ahora mismo`, unlink: null };
    }),
    ...log.data
      .filter((c) => c.status !== "pending" && !justDecided.some((x) => x.uid === c.uid))
      .sort((a, b) => b.resolvedAt - a.resolvedAt)
      .map((c): ResolvedRow => {
        const approved = c.status === "approved";
        const name = shirtName(c.playerId, c.playerName);
        return {
          key: c.uid,
          uid: c.uid,
          title: `${handle(c)} → ${name}`,
          line: [capital(resolvedText(approved, c.uid, c.resolvedBy, nickOf)), c.resolvedAt ? relativeWhen(c.resolvedAt, data.now) : ""].filter(Boolean).join(" · "),
          unlink: approved && owner.get(c.playerId) === c.uid ? { who: handle(c), player: name } : null,
        };
      }),
  ];

  const owners = data.roster.map((p) => {
    const has = owner.has(p.id);
    const asked = pending.some((c) => c.playerId === p.id);
    return { id: p.id, num: p.number, name: p.name, has, sub: has ? "" : asked ? "pedida" : "sin socio" };
  });
  const withOwner = owners.filter((o) => o.has).length;

  // The card leaves: the focus moves to the next decision (or to the invitation).
  const focusNext = () =>
    requestAnimationFrame(() => {
      const next = bodyRef.current?.querySelector<HTMLElement>(".fc .ac .btn") ?? bodyRef.current?.querySelector<HTMLElement>(".void .btn");
      next?.focus({ preventScroll: true });
    });

  const decide = (uid: string, approve: boolean) => {
    const c = data.claims.find((x) => x.uid === uid);
    if (!c) return;
    const who = handle(c);
    const claimAt = logOf.get(uid)?.at ?? 0;
    const back = () =>
      setDecided((d) => {
        const n = { ...d };
        delete n[uid];
        return n;
      });
    setDecided((d) => ({ ...d, [uid]: { approve, claimAt, by: me } }));
    toast.defer({
      tag: "FICHA",
      message: approve ? `${who} ya es ${c.playerLabel} · su carta y su voto, activos` : `Ficha de ${who} rechazada · no se le avisa`,
      commit: () => writes.resolveClaim(uid, approve),
      onUndo: back,
      onError: back,
      errorMessage: approve ? "No se ha podido aprobar la ficha" : "No se ha podido rechazar la ficha",
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
      tag: "FICHA",
      message: `${who} ya no es ${player} · su cuenta sigue en el vestuario`,
      commit: () => writes.resolveClaim(uid, false),
      onUndo: back,
      onError: back,
      errorMessage: "No se ha podido desvincular la cuenta",
    });
  };

  const body = data.error ? (
    <LoadError what="las fichas" />
  ) : data.loading ? (
    <div className="skel" aria-label="Cargando las fichas" role="status">
      <i />
      <i />
    </div>
  ) : (
    <div className="scr" ref={bodyRef} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
      {pending.length ? (
        <section className="fcg" aria-label="Fichas pendientes">
          {pending.map((c) => {
            const l = logOf.get(c.uid);
            const who = handle(c);
            const num = c.player?.number ?? null;
            return (
              <article key={c.uid} className="fc" aria-label={`${who} pide la ficha de ${c.playerLabel}`}>
                <div className="hang">
                  <ShirtBack num={num ?? "?"} name={c.playerLabel} size={112} big />
                </div>
                <div className="tx">
                  <span className="who">{who}</span>
                  <h3>{num != null ? `quiere el ${num} · ${c.playerLabel}` : `quiere la de ${c.playerLabel}`}</h3>
                  <div className="meta">
                    <span>{[l?.at ? relativeWhen(l.at, data.now) : "", viaText(memberOf.get(c.uid), nickOf)].filter(Boolean).join(" · ")}</span>
                    {c.email ? <span>{c.email}</span> : null}
                  </div>
                  <div className="ac">
                    <button type="button" className="btn sky" onClick={() => decide(c.uid, true)} aria-label={`Aprobar: ${who} es ${c.playerLabel}`}>
                      <AdIcon name="check" size={16} />
                      Aprobar
                    </button>
                    <button type="button" className="btn line" onClick={() => decide(c.uid, false)} aria-label={`Rechazar la ficha de ${who}`}>
                      Rechazar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="void">
          <ShirtBack num="?" size={110} big state="empty" />
          <h3>Fichas al día</h3>
          <p>Cuando alguien entre por La puerta y pida su camiseta, aparece aquí para aprobarla.</p>
          <Link className="btn line" to="/vestuario" hash="puerta">
            Invitar desde La puerta
            <AdIcon name="ext" size={14} />
          </Link>
        </div>
      )}
      {resolved.length ? (
        <>
          <button type="button" className="dn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span className="ck">
              <AdIcon name="check" size={14} />
            </span>
            {resolved.length === 1 ? "1 resuelta" : `${resolved.length} resueltas`}
            <span className="ch">
              <AdIcon name="down" size={16} />
            </span>
          </button>
          {open ? (
            <ul className="rsl" aria-label="Fichas resueltas">
              {resolved.map((r) => (
                <li key={r.key}>
                  <span>
                    <b>{r.title}</b> · {r.line}
                  </span>
                  {r.unlink ? (
                    <button type="button" className="btn sm line" onClick={() => r.unlink && unlink(r.uid, r.unlink.who, r.unlink.player)} aria-label={`Desvincular a ${r.unlink.who} de ${r.unlink.player}`}>
                      Desvincular
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {owners.length ? (
        <section className="owners" aria-label="Camisetas y socios">
          <p className="lbr">
            La percha de las fichas · {withOwner} de {owners.length} camisetas ya tienen su socio
          </p>
          <div className="rail2">
            <div className="pegs">
              {owners.map((o) => (
                <Peg key={o.id} num={o.num} label={o.name} sub={o.sub} subTone={o.sub ? "duda" : ""} size={52} state={o.has ? "" : "dim"} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
      <div className="expl">
        <div>
          <b>Qué pasa al aprobar</b>Su cuenta queda unida a la ficha: ve su carta, vota el MVP y recibe las convocatorias.
        </div>
        <div>
          <b>Si no es él</b>Rechaza: no se le avisa y puede volver a pedirla.
        </div>
        <div>
          <b>¿Falta alguien?</b>Invítale desde La puerta, en el vestuario.
        </div>
      </div>
    </div>
  );

  if (!desktop) return <div className="msc">{body}</div>;
  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ttl">Fichas</h1>
          <p className="ld">Socios que piden su camiseta · al aprobar, su cuenta queda unida a esa ficha</p>
        </div>
      </div>
      {body}
    </>
  );
}
