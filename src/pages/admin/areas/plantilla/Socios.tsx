// PLANTILLA · Socios (/admin/plantilla/socios[?ver=fichas|dentro|invitaciones]): la puerta dentro de la sala (M-12;
// board part-plantilla.html § socios). Llaman a la puerta (Abrir, with «¿Con una ficha? · opcional», or Rechazar),
// Piden su ficha (Aprobar / Rechazar; «N resueltas» folded, «Desvincular» on the approved ones still linked), Dentro
// (shirt or initial, role, how he came in; «Quitar el acceso» asks in place with its three consequences — M-13: the
// ficha goes free and the brazalete goes too; M-40: another captain's only for the capitán general — and «N sin
// acceso» below, with «Liberar la ficha» for an old removal that still holds one), Invitaciones (for a ficha or
// open, 1 uso or ilimitada, the days; copy the link, revoke) and La percha de las cuentas. On the phone the ?ver=
// chips pick one section; on the desktop all of them are in the grid (plantilla.css). Every write waits 5 s behind
// «Deshacer» in the franja (useStatus().defer), the screen showing it at once; undone or failed, it goes back.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearch } from "@tanstack/react-router";
import { useShirtStills } from "../../../../components/jersey3d/useShirtStills";
import { useAuth } from "../../../../context/AuthContext";
import { useDocumentTheme } from "../../../../hooks/useDocumentTheme";
import { apiError, createInvite, resolveAccess, revokeInvite, revokeMember } from "../../../../lib/clubApi";
import { madridDay } from "../../../../lib/derived/madrid";
import { capital, plural } from "../../../../lib/derived/words";
import { inviteUrl } from "../../../../lib/door";
import { useDoorRequests, useInvites, useTeamMembers, type DoorRequestRow, type InviteRow, type PersonRow } from "../../../vestuario/live";
import { knockNick } from "../../../vestuario/vx/puertaModel";
import { useClaimsLog, useMembersVia } from "../../club/clubLive";
import { handle as claimHandle, relativeWhen, resolvedText, viaText } from "../../club/fichasLogic";
import { accountOf, type Account } from "../../club/plantillaBoard";
import { useClubWrites } from "../../club/useClubWrites";
import type { AdminData } from "../../data/useAdminData";
import { useRegisterCommands } from "../../palette/registry";
import type { PaletteCommand } from "../../palette/search";
import { useAdmin } from "../../shell/context";
import { SalaLink } from "../../shell/SalaLink";
import { useSalaGo } from "../../shell/salaHref";
import { SalaScreen, ScreenError, ScreenLoading } from "../../shell/Screen";
import { useStatus } from "../../shell/statusContext";
import { Icon, PlNav, Shirt } from "./parts";
import {
  handleOf,
  initialOf,
  INVITE_DAYS,
  inviteDead,
  inviteLine,
  isGeneral,
  quitConsequences,
  quitMessage,
  RANK,
  removedLine,
  ROLE_WORD,
  roleOf,
  shirtLabel,
  shirtLookup,
  shirtOption,
  SOCIOS_TABS,
  sociosVer,
  stillHolds,
  type ShirtOf,
} from "./sociosModel";
import "./plantilla.css";

const LEDE = "Quién llama, quién pide su ficha, quién está dentro y las invitaciones: todo aquí, sin salir al vestuario.";

export function SociosScreen() {
  const data = useAdmin();
  if (data.loading) return <ScreenLoading label="Cargando los socios" />;
  if (data.error) return <ScreenError what="los socios" onRetry={() => window.location.reload()} />;
  return <Socios data={data} />;
}

/** A person's change waiting behind «Deshacer» (or written, until the listener brings it). */
type Patch = Partial<Pick<PersonRow, "removed" | "removedBy" | "playerId" | "role">>;
interface Decision {
  approve: boolean;
  /** The claim's `at` when decided (a later request of the same member is a new claim). */
  claimAt: number;
  by: string;
}
interface Removal {
  had: string;
  wasCap: boolean;
  at: number;
  by: string;
}
const ACCOUNT_CLS: Record<Account, string> = { vinculada: "is-vinculada", pide: "is-pide", fuera: "is-fuera", sin: "is-sin" };
const without = <T,>(o: Record<string, T>, k: string): Record<string, T> => {
  if (!(k in o)) return o;
  const n = { ...o };
  delete n[k];
  return n;
};
const fits = (row: PersonRow, p: Patch) => (Object.keys(p) as (keyof Patch)[]).every((k) => (row[k] ?? null) === (p[k] ?? null));

function Socios({ data }: { data: AdminData }) {
  const status = useStatus();
  const writes = useClubWrites();
  const go = useSalaGo();
  const { user, profile } = useAuth();
  const me = user?.uid ?? "";
  const meNick = profile?.nickname || "ti";
  const general = isGeneral(profile);
  const ver = sociosVer(useSearch({ strict: false, select: (s) => (s as { ver?: unknown }).ver }));
  const requestsQ = useDoorRequests(true);
  const invitesQ = useInvites(true);
  const membersQ = useTeamMembers(true);
  const log = useClaimsLog();
  const vias = useMembersVia();
  const theme = useDocumentTheme();

  const [patches, setPatches] = useState<Record<string, { from: Patch; to: Patch }>>({});
  const [removedNow, setRemovedNow] = useState<Record<string, Removal>>({});
  const [goneReq, setGoneReq] = useState<Record<string, number>>({});
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [revoked, setRevoked] = useState<ReadonlySet<string>>(new Set());
  const [made, setMade] = useState<InviteRow[]>([]);
  const [door, setDoor] = useState("");
  const [doorPick, setDoorPick] = useState("");
  const [quit, setQuit] = useState("");
  const [resOpen, setResOpen] = useState(false);
  // «Invitar con esta ficha» (the ficha's Cuenta y web) comes with ?para=<playerId>: the invitation starts for that ficha
  const para = useSearch({ strict: false, select: (s) => (s as { para?: unknown }).para });
  const [invFor, setInvFor] = useState(typeof para === "string" ? para : "");
  const [uses, setUses] = useState<0 | 1>(1);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  // where the focus goes once a confirm closes or a row leaves (never dropped to <body>)
  const root = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const key = focusNext.current;
    if (!key) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-focus="${key}"]`);
    if (!el) return;
    el.focus();
    if (document.activeElement === el) focusNext.current = null;
  });

  // a change is shown while the listener still has the row it was made on (written, the listener brings it)
  const people = useMemo(
    () =>
      data.people.map((p) => {
        const pt = patches[p.uid];
        return pt && fits(p, pt.from) ? { ...p, ...pt.to } : p;
      }),
    [data.people, patches],
  );
  const shirtOf = useMemo(() => shirtLookup({ roster: data.roster, players: data.players, archivedPlayers: data.archivedPlayers, season: data.season }), [data.roster, data.players, data.archivedPlayers, data.season]);
  const nickOf = useMemo(() => {
    const byUid = new Map(data.people.map((p) => [p.uid, p.nickname || p.email]));
    return (uid: string) => byUid.get(uid) || "un capitán";
  }, [data.people]);
  const logOf = useMemo(() => new Map(log.data.map((c) => [c.uid, c])), [log.data]);
  const viaOf = useMemo(() => new Map(vias.data.map((m) => [m.uid, m])), [vias.data]);
  const joinedOf = useMemo(() => new Map(membersQ.data.map((m) => [m.uid, m.joinedAt])), [membersQ.data]);

  // the claims: pending, and those decided here (behind «Deshacer», or written and not yet gone from the listener)
  const isDecided = (uid: string) => {
    const d = decided[uid];
    return !!d && (d.claimAt === 0 || d.claimAt === (logOf.get(uid)?.at ?? 0));
  };
  const claims = data.claims.filter((c) => !isDecided(c.uid));
  const justDecided = data.claims.filter((c) => isDecided(c.uid));
  const requests = requestsQ.data.filter((r) => goneReq[r.uid] !== r.at).sort((a, b) => a.at - b.at);
  // (an approval behind «Deshacer» already wears its shirt, even before his users doc reaches the listener)
  const wearing = [
    ...people,
    ...justDecided.filter((c) => decided[c.uid]?.approve && !people.some((p) => p.uid === c.uid)).map((c) => ({ uid: c.uid, nickname: c.nickname, playerId: c.playerId, removed: false })),
  ];
  const accountOfId = (id: string) => accountOf(id, { people: wearing, claims });
  const free = data.roster.filter((r) => accountOfId(r.id).state === "sin").map((r) => shirtOf(r.id)).filter((s): s is ShirtOf => !!s);

  // the printed stills: the squad, every shirt a row shows, and the plain kit's
  const shot = (s: ShirtOf) => ({ kit: "home" as const, theme, name: s.name.toLocaleUpperCase("es"), num: s.num });
  const shown = new Map<string, ShirtOf>();
  for (const r of data.roster) {
    const s = shirtOf(r.id);
    if (s) shown.set(s.id, s);
  }
  for (const id of [...people.map((p) => p.playerId), ...data.claims.map((c) => c.playerId)]) {
    const s = shirtOf(id);
    if (s) shown.set(s.id, s);
  }
  const plain = { kit: "home" as const, theme, name: "", num: "" };
  const stillOf = useShirtStills([plain, ...[...shown.values()].map(shot)], { offMainThread: true });
  const still = (s: ShirtOf | null) => (s ? stillOf(shot(s)) : stillOf(plain));

  const patch = (uid: string, p: Patch | null) => {
    if (!p) return setPatches((ps) => without(ps, uid));
    // (`from`: what the listener has now for those fields — once it has anything else, the patch is done)
    const row = data.people.find((x) => x.uid === uid);
    const from = Object.fromEntries((Object.keys(p) as (keyof Patch)[]).map((k) => [k, row ? (row[k] ?? null) : null])) as Patch;
    setPatches((ps) => ({ ...ps, [uid]: { from: { ...from, ...ps[uid]?.from }, to: { ...ps[uid]?.to, ...p } } }));
  };

  // ---------- Llaman a la puerta
  const askDoor = (r: DoorRequestRow) => {
    if (door === r.uid) {
      setDoor("");
      focusNext.current = `door-${r.uid}`;
      return;
    }
    setDoor(r.uid);
    setDoorPick(r.playerId && free.some((s) => s.id === r.playerId) ? r.playerId : "");
  };
  const decideDoor = (r: DoorRequestRow, approve: boolean) => {
    const name = knockNick(r);
    const pid = approve && doorPick && door === r.uid ? doorPick : "";
    const shirt = shirtOf(pid);
    setDoor("");
    setGoneReq((g) => ({ ...g, [r.uid]: r.at }));
    focusNext.current = "puerta-h";
    const back = () => setGoneReq((g) => without(g, r.uid));
    status.defer({
      tag: "Puerta",
      message: approve ? `${name} ya está dentro ${shirt ? `como ${shirt.name}` : "como socio"} · se le avisa «¡Ya estás dentro!»` : `${name} no entra · lo verá si vuelve a llamar`,
      commit: () => resolveAccess({ uid: r.uid, approve, ...(pid ? { playerId: pid } : {}) }),
      onUndo: back,
      onError: back,
      errorMessage: approve ? "No se ha podido abrir la puerta" : "No se ha podido rechazar la entrada",
    });
  };

  // ---------- Piden su ficha
  const decideClaim = (uid: string, approve: boolean) => {
    const c = data.claims.find((x) => x.uid === uid);
    if (!c) return;
    const who = claimHandle(c);
    setDecided((d) => ({ ...d, [uid]: { approve, claimAt: logOf.get(uid)?.at ?? 0, by: meNick } }));
    if (approve) patch(uid, { playerId: c.playerId });
    focusNext.current = "fichas-h";
    const back = () => {
      setDecided((d) => without(d, uid));
      if (approve) patch(uid, null);
    };
    status.defer({
      tag: "Ficha",
      message: approve ? `${who} ya es ${c.playerLabel} · su carta y su voto, activos` : `Petición de ${who} rechazada · lo verá en su vestuario`,
      commit: () => writes.resolveClaim(uid, approve),
      onUndo: back,
      onError: back,
      errorMessage: approve ? "No se ha podido aprobar la ficha" : "No se ha podido rechazar la ficha",
    });
  };
  const unlink = (uid: string, who: string, player: string) => {
    patch(uid, { playerId: null });
    focusNext.current = "res-fold";
    const back = () => patch(uid, null);
    status.defer({
      tag: "Ficha",
      message: `${who} ya no es ${player} · su cuenta sigue en el vestuario`,
      commit: () => writes.resolveClaim(uid, false),
      onUndo: back,
      onError: back,
      errorMessage: "No se ha podido desvincular la cuenta",
    });
  };
  const owner = new Map<string, string>();
  for (const p of wearing) if (!p.removed && p.playerId) owner.set(p.playerId, p.uid);
  const resolved = [
    ...justDecided.map((c) => {
      const d = decided[c.uid];
      return { key: `now-${c.uid}`, uid: c.uid, title: `${claimHandle(c)} → ${c.playerLabel}`, line: `${d.approve ? "Aprobada" : "Rechazada"} por ${d.by} · ahora mismo`, unlink: null as { who: string; player: string } | null };
    }),
    ...log.data
      .filter((c) => c.status !== "pending" && !justDecided.some((x) => x.uid === c.uid))
      .sort((a, b) => b.resolvedAt - a.resolvedAt)
      .map((c) => {
        const approved = c.status === "approved";
        const name = shirtOf(c.playerId)?.name ?? (c.playerName || "Jugador");
        return {
          key: c.uid,
          uid: c.uid,
          title: `${claimHandle(c)} → ${name}`,
          line: [capital(resolvedText(approved, c.uid, c.resolvedBy, nickOf)), c.resolvedAt ? relativeWhen(c.resolvedAt, data.now) : ""].filter(Boolean).join(" · "),
          unlink: approved && owner.get(c.playerId) === c.uid ? { who: claimHandle(c), player: name } : null,
        };
      }),
  ];

  // ---------- Dentro
  const inside = people
    .filter((p) => !p.removed)
    .sort((a, b) => RANK[roleOf(a)] - RANK[roleOf(b)] || (joinedOf.get(a.uid) ?? 0) - (joinedOf.get(b.uid) ?? 0) || (a.nickname || a.email).localeCompare(b.nickname || b.email, "es"));
  const out = people.filter((p) => p.removed).sort((a, b) => (removedNow[b.uid]?.at ?? b.removedAt ?? 0) - (removedNow[a.uid]?.at ?? a.removedAt ?? 0));
  const askQuit = (uid: string) => {
    setQuit((q) => (q === uid ? "" : uid));
    if (quit === uid) focusNext.current = `quit-${uid}`;
  };
  const cancelQuit = (uid: string) => {
    setQuit("");
    focusNext.current = `quit-${uid}`;
  };
  const removeAccess = (p: PersonRow) => {
    const shirt = shirtOf(p.playerId);
    const cap = roleOf(p) === "admin";
    const who = handleOf(p);
    setQuit("");
    focusNext.current = "dentro-h";
    patch(p.uid, { removed: true, removedBy: me, playerId: null, role: "user" });
    setRemovedNow((r) => ({ ...r, [p.uid]: { had: shirt?.name ?? "", wasCap: cap, at: data.now, by: meNick } }));
    const back = () => {
      patch(p.uid, null);
      setRemovedNow((r) => without(r, p.uid));
    };
    status.defer({ tag: "Acceso", message: quitMessage(who, shirt, cap), commit: () => revokeMember({ uid: p.uid }), onUndo: back, onError: back, errorMessage: "No se ha podido quitar el acceso" });
  };
  const freeFicha = (p: PersonRow) => {
    const shirt = shirtOf(p.playerId);
    patch(p.uid, { playerId: null, removedBy: me });
    focusNext.current = "out-h";
    const back = () => patch(p.uid, null);
    status.defer({
      tag: "Ficha",
      message: `${shirt?.name ?? "Su ficha"} queda libre · ${handleOf(p)} sigue sin acceso`,
      commit: () => revokeMember({ uid: p.uid }),
      onUndo: back,
      onError: back,
      errorMessage: "No se ha podido liberar la ficha",
    });
  };

  // ---------- Invitaciones
  const invites = [...invitesQ.data, ...made.filter((m) => !invitesQ.data.some((x) => x.code === m.code))]
    .map((v) => (revoked.has(v.code) ? { ...v, revoked: true } : v))
    .sort((a, b) => Number(inviteDead(a, data.now)) - Number(inviteDead(b, data.now)) || b.expiresAt - a.expiresAt);
  const liveN = invites.filter((v) => !inviteDead(v, data.now)).length;
  const linkOf = (code: string) => inviteUrl(typeof window !== "undefined" ? window.location.origin : "", code);
  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(linkOf(code));
      return true;
    } catch {
      return false;
    }
  };
  const copy = async (code: string) => {
    const ok = await copyLink(code);
    status.show({ tag: "Invitación", message: ok ? `Enlace copiado · ${linkOf(code)}` : `No se ha podido copiar: ${linkOf(code)}` });
  };
  const markRevoked = (code: string, on: boolean) =>
    setRevoked((s) => {
      const n = new Set(s);
      if (on) n.add(code);
      else n.delete(code);
      return n;
    });
  const revoke = (code: string) => {
    markRevoked(code, true);
    focusNext.current = "inv-h";
    const back = () => markRevoked(code, false);
    status.defer({ tag: "Invitación", message: `${code} revocada · el enlace ya no abre`, commit: () => revokeInvite({ code }), onUndo: back, onError: back, errorMessage: "No se ha podido revocar la invitación" });
  };
  const create = async () => {
    if (busy) return;
    setBusy(true);
    const pid = invFor;
    const shirt = shirtOf(pid);
    const n = days;
    const u = uses;
    try {
      const res = await createInvite({ ...(pid ? { playerId: pid } : {}), maxUses: u, days: n });
      const { code, expiresAt } = res.data;
      setMade((m) => [...m, { code, byName: meNick, expiresAt, maxUses: u, uses: 0, revoked: false, playerId: pid || null, playerName: shirt?.name ?? null }]);
      setInvFor("");
      const copied = await copyLink(code);
      // (it exists already: «Deshacer» revokes it)
      status.show({
        tag: "Invitación",
        message: `${code} creada${shirt ? ` para ${shirt.name}` : ", abierta"} · caduca en ${plural(n, "día", "días")} · ${copied ? "enlace copiado" : "copia el enlace"}`,
        undo: () => {
          markRevoked(code, true);
          revokeInvite({ code }).catch((e: unknown) => {
            markRevoked(code, false);
            status.show({ tone: "error", message: `No se ha podido revocar la invitación: ${apiError(e)}` });
          });
        },
      });
    } catch (e) {
      status.show({ tone: "error", message: `No se ha podido crear la invitación: ${apiError(e)}`, retry: () => void create() });
    } finally {
      setBusy(false);
    }
  };

  // ⌘K: «Crear una invitación» (to the invitations, the «Para» field focused)
  const cmds = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "socios:invitar",
        group: "Acciones",
        icon: "+",
        title: "Crear una invitación",
        description: "Para una ficha o abierta, con su enlace",
        hint: "acción",
        keywords: "invitacion invitar enlace puerta socio vestuario",
        run: () => {
          focusNext.current = "inv-for";
          go("/admin/plantilla/socios?ver=invitaciones");
        },
      },
    ],
    [go],
  );
  useRegisterCommands(cmds);

  // ---------- La percha de las cuentas
  const percha = data.roster.map((r) => {
    const s = shirtOf(r.id) ?? { id: r.id, name: r.name, num: "" };
    const a = accountOfId(r.id);
    return { s, state: a.state, d: a.state === "vinculada" ? `@${a.who}` : a.state === "pide" ? "pedida" : a.state === "fuera" ? `la guarda @${a.who}` : "sin socio" };
  });
  const withSocio = percha.filter((x) => x.state === "vinculada").length;

  const todo = requests.length + claims.length;
  const counts: Record<string, number> = { puerta: requests.length, fichas: claims.length, dentro: 0, invitaciones: 0 };
  const on = (k: string) => (ver === k ? " is-on" : "");

  return (
    <SalaScreen title="Socios" lede={LEDE} headSub={`La puerta del vestuario${todo ? ` · ${plural(todo, "cosa por hacer", "cosas por hacer")}` : ""}`} actions={<PlNav at="socios" />} fit className="sc-pl pl--socios">
      <div className="spl-so" ref={root}>
        <nav className="spl-so__tabs" aria-label="Secciones de socios">
          {SOCIOS_TABS.map((t) => (
            <SalaLink key={t.key} to={t.to} replace className="sc-chip vd-glass vd-press" aria-current={ver === t.key ? "page" : undefined} aria-label={counts[t.key] ? `${t.t} · ${counts[t.key]} por hacer` : undefined}>
              {t.t}
              {counts[t.key] > 0 && (
                <i className="sc-count" aria-hidden="true">
                  {counts[t.key]}
                </i>
              )}
            </SalaLink>
          ))}
        </nav>
        <div className="spl-so__grid">
          <div className="spl-so__col">
            {/* ---------- Llaman a la puerta */}
            <section className={`spl-so__sec${on("puerta")}`} aria-labelledby="spl-so-door">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="spl-so-door" tabIndex={-1} data-focus="puerta-h">
                  Llaman a la puerta
                </h2>
                <span className="sc-sec__n">{requests.length}</span>
              </header>
              {!requestsQ.loading && !requests.length && <p className="sc-small spl-quiet">{requestsQ.error ? "No se ha podido cargar quién llama." : "Nadie llamando. Quien pide entrar desde el vestuario aparece aquí y en Hoy."}</p>}
              <ul className="sc-rows">
                {requests.map((r) => {
                  const name = knockNick(r);
                  const open = door === r.uid;
                  const said = shirtOf(r.playerId);
                  const says = said ? `Dice que es ${shirtLabel(said)}` : r.playerName ? `Dice que es ${r.playerName}` : "";
                  return (
                    <li key={r.uid} className="spl-req">
                      <div className="sc-row">
                        <span className="sc-row__t">
                          <b>{name}</b>
                          {says && <span>{says}</span>}
                          {r.email && <span>{r.email}</span>}
                          <span>{relativeWhen(r.at, data.now)}</span>
                        </span>
                        <span className="sc-btnrow">
                          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-expanded={open} aria-label={`Abrir la puerta a ${name}`} data-focus={`door-${r.uid}`} onClick={() => askDoor(r)}>
                            Abrir
                          </button>
                          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`No abrir a ${name}`} onClick={() => decideDoor(r, false)}>
                            Rechazar
                          </button>
                        </span>
                      </div>
                      {open && (
                        <div className="spl-confirm" role="group" aria-label={`Abrir la puerta a ${name}`}>
                          <label className="sc-field">
                            <span>¿Con una ficha? · opcional</span>
                            <select className="vd-input vd-glass" value={doorPick} onChange={(e) => setDoorPick(e.target.value)}>
                              <option value="">Sin ficha · entra como socio</option>
                              {free.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {shirtOption(s)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <p className="sc-small">Entra como socio (sin brazalete). Si le das una ficha, queda unida a su cuenta.</p>
                          <div className="sc-btnrow">
                            <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri vd-btn--sm" onClick={() => decideDoor(r, true)}>
                              Abrir la puerta
                            </button>
                            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => askDoor(r)}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ---------- Piden su ficha */}
            <section className={`spl-so__sec${on("fichas")}`} aria-labelledby="spl-so-fichas">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="spl-so-fichas" tabIndex={-1} data-focus="fichas-h">
                  Piden su ficha
                </h2>
                <span className="sc-sec__n">{claims.length}</span>
              </header>
              {!claims.length && <p className="sc-small spl-quiet">Cuentas al día. Cuando alguien entre y pida su camiseta, aparece aquí para aprobarla.</p>}
              <ul className="sc-rows">
                {claims.map((c) => {
                  const who = claimHandle(c);
                  const s = shirtOf(c.playerId);
                  const l = logOf.get(c.uid);
                  const title = s?.num ? `${who} quiere el ${s.num} · ${c.playerLabel}` : `${who} quiere la de ${c.playerLabel}`;
                  return (
                    <li key={c.uid} className="sc-row spl-claim" aria-label={`${who} pide la ficha de ${c.playerLabel}`}>
                      <Shirt src={still(s)} size="s" alt={s ? `Camiseta de ${s.name}` : "Camiseta sin ficha"} />
                      <span className="sc-row__t">
                        <b>{title}</b>
                        <span>{[l?.at ? relativeWhen(l.at, data.now) : "", viaText(viaOf.get(c.uid), nickOf)].filter(Boolean).join(" · ")}</span>
                        {c.email && <span>{c.email}</span>}
                      </span>
                      <span className="sc-btnrow">
                        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Aprobar: ${who} es ${c.playerLabel}`} onClick={() => decideClaim(c.uid, true)}>
                          Aprobar
                        </button>
                        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Rechazar la petición de ${who}`} onClick={() => decideClaim(c.uid, false)}>
                          Rechazar
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {resolved.length > 0 && (
                <>
                  <button type="button" className="spl-fold" aria-expanded={resOpen} data-focus="res-fold" onClick={() => setResOpen((o) => !o)}>
                    <span className="sc-tag sc-tag--hecho">{plural(resolved.length, "resuelta", "resueltas")}</span>
                  </button>
                  {resOpen && (
                    <ul className="sc-rows" aria-label="Fichas resueltas">
                      {resolved.map((r) => (
                        <li key={r.key} className="sc-row">
                          <span className="sc-row__t">
                            <b>{r.title}</b>
                            <span>{r.line}</span>
                          </span>
                          {r.unlink && (
                            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Desvincular a ${r.unlink.who} de ${r.unlink.player}`} onClick={() => r.unlink && unlink(r.uid, r.unlink.who, r.unlink.player)}>
                              Desvincular
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          </div>

          {/* ---------- Dentro */}
          <section className={`spl-so__sec spl-so__col${on("dentro")}`} aria-labelledby="spl-so-in">
            <header className="sc-sec__h">
              <h2 className="sc-h2" id="spl-so-in" tabIndex={-1} data-focus="dentro-h">
                Dentro
              </h2>
              <span className="sc-sec__n">{inside.length}</span>
            </header>
            <ul className="sc-rows" aria-labelledby="spl-so-in">
              {inside.map((u) => {
                const role = roleOf(u);
                const mine = u.uid === me;
                const shirt = shirtOf(u.playerId);
                const who = handleOf(u);
                const open = quit === u.uid;
                const joined = joinedOf.get(u.uid) ?? 0;
                const lock =
                  role === "superadmin" ? (mine ? "Eres tú · protegido" : "Protegido · capitán general") : mine ? "Eres tú" : role === "admin" && !general ? "Solo el capitán general" : "";
                const label = `Quitar el acceso a ${who}`;
                const [q1, q2, q3] = quitConsequences(shirt, role === "admin");
                return (
                  <li key={u.uid} className="spl-person">
                    <div className="sc-row">
                      {shirt ? (
                        <Shirt src={still(shirt)} size="s" alt={`Camiseta de ${shirt.name}`} />
                      ) : (
                        <span className="spl-ini" aria-hidden="true">
                          {initialOf(u)}
                        </span>
                      )}
                      <span className="sc-row__t">
                        <b>
                          {who}
                          {mine ? " · tú" : ""} <span className={`spl-role is-${role}`}>{ROLE_WORD[role]}</span>
                        </b>
                        <span>{[u.displayName, shirt ? shirtLabel(shirt) : "Sin ficha"].filter(Boolean).join(" · ")}</span>
                        <span>
                          {capital(viaText(viaOf.get(u.uid), nickOf))}
                          {joined ? ` · desde el ${madridDay(joined)}` : ""}
                        </span>
                      </span>
                      {lock ? (
                        <span className="spl-lock">
                          <Icon name="lock" size={16} />
                          {lock}
                        </span>
                      ) : (
                        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-expanded={open} aria-label={label} data-focus={`quit-${u.uid}`} onClick={() => askQuit(u.uid)}>
                          Quitar el acceso
                        </button>
                      )}
                    </div>
                    {open && !lock && (
                      <div className="spl-confirm" role="group" aria-label={label}>
                        <p className="sc-h3">¿Quitar el acceso a {who}?</p>
                        <ul className="spl-conseq">
                          <li>{q1}</li>
                          <li>{q2}</li>
                          <li>{q3}</li>
                        </ul>
                        <div className="sc-btnrow">
                          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm spl-danger" onClick={() => removeAccess(u)}>
                            Quitar el acceso
                          </button>
                          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => cancelQuit(u.uid)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {out.length > 0 && (
              <>
                <h3 className="sc-h3 spl-sub" id="spl-so-out" tabIndex={-1} data-focus="out-h">
                  {plural(out.length, "sin acceso", "sin acceso")}
                </h3>
                <ul className="sc-rows" aria-labelledby="spl-so-out">
                  {out.map((p) => {
                    const holds = stillHolds(p);
                    const shirt = holds ? shirtOf(p.playerId) : null;
                    const now = removedNow[p.uid];
                    const when = relativeWhen(now?.at ?? p.removedAt ?? 0, data.now);
                    const canFree = holds && p.uid !== me && (roleOf(p) !== "admin" || general) && roleOf(p) !== "superadmin";
                    return (
                      <li key={p.uid} className="sc-row">
                        <span className="sc-row__t">
                          <b>{handleOf(p)}</b>
                          <span>{removedLine(p, nickOf, when, now)}</span>
                          {holds && <span>se quedó con {shirt?.name ?? "su ficha"}</span>}
                        </span>
                        {holds &&
                          (canFree ? (
                            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Liberar la ficha de ${shirt?.name ?? handleOf(p)}`} onClick={() => freeFicha(p)}>
                              Liberar la ficha
                            </button>
                          ) : (
                            <span className="spl-lock">
                              <Icon name="lock" size={16} />
                              Solo el capitán general
                            </span>
                          ))}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <div className="spl-so__col">
            {/* ---------- Invitaciones */}
            <section className={`spl-so__sec${on("invitaciones")}`} aria-labelledby="spl-so-inv">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="spl-so-inv" tabIndex={-1} data-focus="inv-h">
                  Invitaciones
                </h2>
                <span className="sc-sec__n">{liveN}</span>
              </header>
              <div className="spl-invf">
                <label className="sc-field">
                  <span>Para</span>
                  <select className="vd-input vd-glass" value={invFor} data-focus="inv-for" onChange={(e) => setInvFor(e.target.value)}>
                    <option value="">Abierta · para cualquiera</option>
                    {free.map((s) => (
                      <option key={s.id} value={s.id}>
                        La ficha de {shirtLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sc-field">
                  <span className="spl-lab">Usos</span>
                  <div className="vd-seg vd-glass" role="group" aria-label="Usos de la invitación" style={{ "--n": 2, "--i": uses === 0 ? 1 : 0 } as CSSProperties}>
                    <span className="vd-shelf__bead" aria-hidden="true" />
                    <button type="button" className="vd-seg__b" aria-pressed={uses === 1} onClick={() => setUses(1)}>
                      1 uso
                    </button>
                    <button type="button" className="vd-seg__b" aria-pressed={uses === 0} onClick={() => setUses(0)}>
                      Ilimitada
                    </button>
                  </div>
                </div>
                <label className="sc-field">
                  <span>Caduca en</span>
                  <select className="vd-input vd-glass" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
                    {INVITE_DAYS.map((d) => (
                      <option key={d} value={String(d)}>
                        {plural(d, "día", "días")}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri" aria-disabled={busy || undefined} onClick={() => void create()}>
                  <Icon name="plus" size={18} />
                  {busy ? "Creando la invitación…" : "Crear la invitación"}
                </button>
              </div>
              {!invitesQ.loading && !invites.length && <p className="sc-small spl-quiet">{invitesQ.error ? "No se han podido cargar las invitaciones." : "Ninguna invitación todavía. Crea una para una ficha (la cuenta queda unida a esa camiseta) o abierta."}</p>}
              <ul className="sc-rows" aria-labelledby="spl-so-inv">
                {invites.map((v) => {
                  const dead = inviteDead(v, data.now);
                  const s = shirtOf(v.playerId);
                  const who = s ? `Para la ficha de ${s.name}` : v.playerName ? `Para la ficha de ${v.playerName}` : "Abierta · para cualquiera";
                  return (
                    <li key={v.code} className={`sc-row spl-inv${dead ? " is-dead" : ""}`}>
                      <span className="sc-row__t">
                        <span className="spl-codew">
                          <code className="spl-code">{v.code}</code>
                        </span>
                        <b>{who}</b>
                        <span>{inviteLine(v, data.now)}</span>
                      </span>
                      {dead ? (
                        <span className="sc-tag sc-tag--quiet">Ya no abre</span>
                      ) : (
                        <span className="sc-btnrow">
                          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Copiar el enlace de ${v.code}`} onClick={() => void copy(v.code)}>
                            Copiar el enlace
                          </button>
                          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Revocar ${v.code}`} onClick={() => revoke(v.code)}>
                            Revocar
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ---------- La percha de las cuentas */}
            <section className={`spl-so__sec spl-percha${on("fichas")}`} aria-labelledby="spl-so-per">
              <header className="sc-sec__h">
                <h2 className="sc-h3" id="spl-so-per">
                  La percha de las cuentas
                </h2>
                <span className="sc-small">
                  {withSocio} de {plural(percha.length, "camiseta ya tiene su socio", "camisetas ya tienen su socio")}
                </span>
              </header>
              <ul className="spl-percha__l">
                {percha.map((x) => (
                  <li key={x.s.id} className={ACCOUNT_CLS[x.state]}>
                    <Shirt src={still(x.s)} size="s" alt={`Camiseta de ${x.s.name}`} />
                    <small>{x.d}</small>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </SalaScreen>
  );
}
