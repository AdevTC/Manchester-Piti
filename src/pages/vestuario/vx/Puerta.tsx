// «La puerta» (/vestuario/puerta, captains only), as the canvas prototype draws it (SalaPuerta.dc.html): the head says
// who knocks right now, with the push «Avísame cuando alguien llame» beside it; three tabs — «Llamando» (one glass card
// per knock: who, the shirt he asks for, «Cambiar ficha», «Abrir» / «No» with a short undo before it applies),
// «Invitar» (the pass maker: a 7-day link with its ficha and uses, drawn as a tunnel pass, «Copiar», «WhatsApp», and the
// live passes with «Revocar») and «Dentro» (who has access, «Quitar acceso» with a confirm); on the side, the tunnel
// drawn (who waits, who is inside) and how someone gets in. Styles: styles/vestuario/puerta.css (vpu-).
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { inviteUrl } from "../../../lib/door";
import { pushState, savedTopics, toggleTopic } from "../../../lib/push";
import { useCaptainDoor } from "../../acceso/useCaptainDoor";
import "../../../styles/vestuario/puerta.css";
import type { VxCtx } from "./ctx";
import type { VIcon } from "./icons";
import { Ic, PShirt, RoomHead, Tile, Tog } from "./kit";
import {
  ago,
  askWords,
  fichaLabel,
  initials,
  insideLine,
  isToday,
  knockFicha,
  knockNick,
  knockOptions,
  passLine,
  passTitle,
  puertaHead,
  since,
  tunnelAria,
  validUntil,
  waText,
  type DoorTab,
  type SquadShirt,
} from "./puertaModel";

const BTN = "vd-glass vd-press nx-btn";
const TABS = [
  ["llamando", "Llamando"],
  ["invitar", "Invitar"],
  ["dentro", "Dentro"],
] as const;
const DAY = 86_400_000;
const HOW: [VIcon, string, string][] = [
  ["user", "Llama con su Google.", "Sin contraseña del equipo."],
  ["shirt", "Elige su camiseta", "o pide que le hagas la ficha."],
  ["door", "Tú abres", ", o le mandas un pase y entra sin esperar."],
  ["check", "Dentro:", "le llega un aviso y su acceso no caduca."],
];

export function PuertaBlock({ c }: { c: VxCtx }) {
  const cap = useCaptainDoor();
  const [tab, setTab] = useState<DoorTab>(0);
  const [asking, setAsking] = useState<string | null>(null);
  const byId = useMemo(() => new Map<string, SquadShirt>(c.squad.map((s) => [s.id, s])), [c.squad]);
  const [doorPush, setDoorPush] = useState(() => savedTopics().includes("door"));
  const pushReady = pushState() === "ready";
  const togglePush = async () => {
    try {
      const t = await toggleTopic("door", !doorPush);
      const on = t.includes("door");
      setDoorPush(on);
      c.say(on ? "Te avisamos en este móvil cuando alguien llame." : "Avisos de la puerta apagados en este móvil.");
    } catch {
      setDoorPush(savedTopics().includes("door"));
    }
  };

  const kN = cap.queue.length;
  const counts = [kN, null, cap.inside.length];
  const pick = (i: DoorTab) => {
    setTab(i);
    setAsking(null);
  };
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    let i: number = tab;
    if (e.key === "ArrowRight") i = (tab + 1) % 3;
    else if (e.key === "ArrowLeft") i = (tab + 2) % 3;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = 2;
    else return;
    e.preventDefault();
    pick(i as DoorTab);
    document.getElementById(`vpu-t-${TABS[i][0]}`)?.focus();
  };
  const head = puertaHead(kN, cap.loading);
  const knockNames = cap.queue.map(knockNick);

  return (
    <section className="vpu" aria-labelledby="ve-room-h">
      <RoomHead
        room="puerta"
        icon="lock"
        kick="La puerta · quién entra al vestuario"
        title={head.title}
        sub={head.sub}
        acts={
          pushReady ? (
            <div className="vd-glass vpu-push">
              <Tog on={doorPush} onToggle={() => void togglePush()}>
                {doorPush ? "Te avisamos cuando llamen" : "Avísame cuando alguien llame"}
              </Tog>
            </div>
          ) : undefined
        }
      />

      <div className="ve-cols">
        <div>
          <div className="vd-glass vd-seg nx-seg vpu-tabs" role="tablist" aria-label="La puerta" style={{ "--n": 3, "--i": tab } as CSSProperties} onKeyDown={onTabKey}>
            <span className="vd-shelf__bead" aria-hidden="true" />
            {TABS.map(([id, t], i) => (
              <button key={id} id={`vpu-t-${id}`} type="button" role="tab" className="vd-seg__b" aria-selected={tab === i} aria-controls={`vpu-p-${id}`} tabIndex={tab === i ? 0 : -1} onClick={() => pick(i as DoorTab)}>
                {counts[i] == null ? t : `${t} · ${counts[i]}`}
              </button>
            ))}
          </div>
          {cap.error && (
            <p className="ve-err" role="alert">
              {cap.error}
            </p>
          )}
          <div className="vpu-panel" id="vpu-p-llamando" role="tabpanel" aria-labelledby="vpu-t-llamando" tabIndex={0} hidden={tab !== 0}>
            <Llamando cap={cap} byId={byId} squad={c.squad} now={c.now} toInvite={() => pick(1)} />
          </div>
          <div className="vpu-panel" id="vpu-p-invitar" role="tabpanel" aria-labelledby="vpu-t-invitar" tabIndex={0} hidden={tab !== 1}>
            <Invitar cap={cap} byId={byId} squad={c.squad} now={c.now} say={c.say} />
          </div>
          <div className="vpu-panel" id="vpu-p-dentro" role="tabpanel" aria-labelledby="vpu-t-dentro" tabIndex={0} hidden={tab !== 2}>
            <Dentro cap={cap} byId={byId} now={c.now} say={c.say} asking={asking} setAsking={setAsking} />
          </div>
        </div>

        <div className="ve-side ve-stack">
          <section className="ve-panel" aria-labelledby="vpu-tun-h">
            <div className="nx-sec__head" style={{ marginBottom: 12 }}>
              <h2 className="nx-h3" id="vpu-tun-h">
                El túnel, ahora
              </h2>
              <p className="nx-meta">Se mueve solo</p>
            </div>
            <div className="vpu-tun" role="img" aria-label={tunnelAria(knockNames, cap.invites.length, cap.inside.length)}>
              <i />
              <i />
              <i />
              <i />
              <i />
              <div className="vpu-tun__in">
                <b>{cap.inside.length}</b>
                <span>dentro</span>
              </div>
              <div className="vpu-tun__q">
                {knockNames.slice(0, 4).map((n, i) => (
                  <span key={cap.queue[i].uid} className="vpu-av">
                    {initials(n)}
                  </span>
                ))}
                <span className="vpu-tun__l">{kN ? (kN === 1 ? "llama" : "llaman") : "Nadie en la puerta"}</span>
              </div>
            </div>
            <div className="ve-figs vpu-figs">
              <div className="ve-fig">
                <b>{kN}</b>
                <span>llamando</span>
              </div>
              <div className="ve-fig">
                <b>{cap.invites.length}</b>
                <span>pases activos</span>
              </div>
              <div className="ve-fig">
                <b>{cap.inside.length}</b>
                <span>cuentas dentro</span>
              </div>
            </div>
          </section>
          <section className="ve-panel" aria-labelledby="vpu-how-h">
            <h2 className="nx-h3" id="vpu-how-h" style={{ marginBottom: 14 }}>
              Cómo entra alguien
            </h2>
            <ol className="vpu-how">
              {HOW.map(([icon, b, t]) => (
                <li key={icon}>
                  <Tile icon={icon} />
                  <span>
                    <b>{b}</b>
                    {t.startsWith(",") ? t : ` ${t}`}
                  </span>
                </li>
              ))}
            </ol>
            <p className="nx-note vpu-rule">Una cuenta, una ficha. Quitar el acceso le cierra la sesión en todos sus móviles, pero su ficha sigue en la plantilla.</p>
          </section>
        </div>
      </div>
    </section>
  );
}

type Cap = ReturnType<typeof useCaptainDoor>;
interface PanelProps {
  cap: Cap;
  byId: ReadonlyMap<string, SquadShirt>;
}

function Llamando({ cap, byId, squad, now, toInvite }: PanelProps & { squad: readonly SquadShirt[]; now: number; toInvite: () => void }) {
  // the ficha a captain changed before opening (by the request's uid)
  const [fixed, setFixed] = useState<Record<string, string>>({});
  const free = squad.filter((s) => !cap.linked.has(s.id));
  const p = cap.pending;
  const pendingName = p ? (p.playerId && byId.get(p.playerId)?.name) || knockNick(p.row) : "";
  return (
    <>
      {cap.queue.length > 0 && (
        <>
          <p className="vpu-lead">
            Llamando a la puerta. <b>Abrir</b> le deja entrar con la ficha que ves; <b>No</b> cierra su petición. Un toque, y puedes deshacerlo.
          </p>
          <ul className="vpu-knocks" aria-label="Llamando a la puerta">
            {cap.queue.map((r) => {
              const wants = r.playerId ?? "";
              const fid = fixed[r.uid] ?? wants;
              const nick = knockNick(r);
              const wantsLabel = knockFicha(wants || null, r.playerName, byId);
              const pickLabel = knockFicha(fid || null, fid === wants ? r.playerName : null, byId);
              const ask = askWords({ pick: fid, pickLabel, wants, wantsLabel, wantsTaken: !!wants && cap.linked.has(wants) });
              const num = fid ? (byId.get(fid)?.num ?? "") : "";
              return (
                <li key={r.uid} className="vd-glass ve-card vpu-knock">
                  <div className="vpu-who">
                    <span className="vpu-av" aria-hidden="true">
                      {initials(nick)}
                    </span>
                    <span className="vpu-who__t">
                      <b>{nick}</b>
                      <span>
                        Entra con su Google
                        {r.email ? <span className="nx-vh"> · {r.email}</span> : null}
                      </span>
                    </span>
                    <small>{ago(r.at, now)}</small>
                  </div>
                  <div className="vpu-ask">
                    <PShirt n={fid ? num || "?" : "?"} className={fid ? undefined : "vpu-none"} />
                    <span className="vpu-ask__t">
                      <small>{ask.k}</small> <b>{ask.t}</b> <span>{ask.s}</span>
                    </span>
                  </div>
                  <div className="vpu-ctl">
                    <div className="ve-lab">
                      <label htmlFor={`vpu-f-${r.uid}`}>
                        Cambiar ficha <span className="nx-vh">· ficha para {nick}</span>
                      </label>
                      <select id={`vpu-f-${r.uid}`} className="ve-in" value={fid} onChange={(e) => setFixed((f) => ({ ...f, [r.uid]: e.target.value }))}>
                        {knockOptions(free, wants, wantsLabel).map((o) => (
                          <option key={o.v} value={o.v}>
                            {o.t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="vpu-btns">
                      <button type="button" className={`${BTN} nx-btn--pri`} aria-label={`Abrir a ${nick}`} onClick={() => cap.decide(r, true, fid || undefined)}>
                        <Ic name="door" />
                        Abrir
                      </button>
                      <button type="button" className={BTN} aria-label={`No abrir a ${nick}`} onClick={() => cap.decide(r, false)}>
                        No
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {!cap.queue.length &&
        (cap.loading ? (
          <p className="vpu-lead">Mirando quién llama…</p>
        ) : (
          <div className="ve-empty">
            <Tile icon="door" />
            <h2>Túnel en silencio: nadie llamando a la puerta.</h2>
            <p>Cuando alguien pida entrar con su Google aparecerá aquí, con la camiseta que pide. ¿Esperas a alguien? Mándale un pase y entra sin esperar.</p>
            <div className="ve-acts">
              <button type="button" className={`${BTN} nx-btn--pri`} onClick={toInvite}>
                <Ic name="link" />
                Crear un pase
              </button>
            </div>
          </div>
        ))}
      {p && (
        <p className="vd-glass vpu-undo" role="status">
          <Ic name={p.approve ? "check" : "close"} />
          <span>{p.approve ? `${pendingName} entra · le llega un aviso.` : `Petición de ${pendingName} rechazada.`}</span>
          <button type="button" className="nx-lnk" onClick={cap.undo}>
            Deshacer
          </button>
        </p>
      )}
    </>
  );
}

function Invitar({ cap, byId, squad, now, say }: PanelProps & { squad: readonly SquadShirt[]; now: number; say: (t: string) => void }) {
  const [ficha, setFicha] = useState("");
  const [uses, setUses] = useState<0 | 1>(1);
  const [made, setMade] = useState<{ code: string; playerId: string; uses: 0 | 1; expiresAt: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const free = squad.filter((s) => !cap.linked.has(s.id));
  const link = made ? inviteUrl(typeof window !== "undefined" ? window.location.origin : "", made.code) : "";
  const madeFor = made?.playerId ? byId.get(made.playerId) : undefined;
  const chosen = ficha ? byId.get(ficha) : undefined;
  const usesT = (u: 0 | 1) => (u === 0 ? "Ilimitado" : "1 uso");
  const create = async () => {
    const out = await cap.invite({ ...(ficha ? { playerId: ficha } : {}), maxUses: uses, days: 7 });
    if (out) {
      setMade({ code: out.code, playerId: ficha, uses, expiresAt: out.expiresAt || now + 7 * DAY });
      setCopied(false);
      say("Enlace creado: caduca en 7 días.");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      say("Enlace copiado.");
    } catch {
      setCopied(false);
      say("No se pudo copiar: mantén pulsado el enlace para copiarlo.");
    }
  };
  const busy = cap.busy === "invite";
  const forT = madeFor ? `Para ${fichaLabel(madeFor)}` : "Enlace abierto · sin ficha";
  return (
    <>
      <section className="vd-glass vd-glass--deep ve-card vpu-make" aria-labelledby="vpu-make-h">
        <div>
          <p className="ve-card__k">Un pase de túnel</p>
          <h2 id="vpu-make-h">Invitar con un enlace</h2>
          <p>Un enlace y entra sin esperar. Caduca solo en 7 días.</p>
        </div>
        <div className="vpu-make__row">
          <label className="ve-lab">
            Ficha reservada · opcional
            <select className="ve-in" value={ficha} onChange={(e) => setFicha(e.target.value)}>
              <option value="">Sin ficha · que elija al entrar</option>
              {free.map((s) => (
                <option key={s.id} value={s.id}>
                  {fichaLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <div className="ve-lab">
            <span id="vpu-uses-l">Usos del enlace</span>
            <div className="vd-glass vd-seg nx-seg vpu-uses" role="radiogroup" aria-labelledby="vpu-uses-l" style={{ "--n": 2, "--i": uses === 1 ? 0 : 1 } as CSSProperties}>
              <span className="vd-shelf__bead" aria-hidden="true" />
              {([1, 0] as const).map((u) => (
                <button key={u} type="button" role="radio" className="vd-seg__b" aria-checked={uses === u} onClick={() => setUses(u)}>
                  {usesT(u)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="vpu-make__go">
          <button type="button" className={`${BTN} nx-btn--pri`} onClick={() => void create()} disabled={busy} aria-busy={busy || undefined}>
            <Ic name="link" />
            {busy ? "Creando…" : made ? "Crear otro enlace" : "Crear enlace"}
          </button>
          <p>
            {chosen ? `Para ${fichaLabel(chosen)}` : "Sin ficha"} · {usesT(uses)} · 7 días
          </p>
        </div>
        {!made ? (
          <div className="vpu-tk vpu-tk--blank">Aún no has creado ningún enlace.</div>
        ) : (
          <>
            <div className="vpu-tk" role="group" aria-label={`Pase de túnel: ${madeFor ? `para ${fichaLabel(madeFor)}` : "enlace abierto sin ficha"}, ${usesT(made.uses)}, válido 7 días`}>
              <div className="vpu-tk__stub">
                <PShirt n={madeFor ? madeFor.num || "?" : "?"} className={madeFor ? undefined : "vpu-none"} />
                <small>PASE DE TÚNEL</small>
              </div>
              <div className="vpu-tk__body">
                <span className="vpu-tk__k">Manchester Piti · el vestuario</span>
                <b>{forT}</b>
                <p className="vpu-tk__dl">
                  <span>
                    Usos <b>{usesT(made.uses)}</b>
                  </span>
                  <span>
                    Válido hasta <b>{validUntil(made.expiresAt)}</b>
                  </span>
                  <span>
                    Acceso <b>Sin esperas</b>
                  </span>
                </p>
                <code className="vpu-tk__url">{link}</code>
              </div>
            </div>
            <div className="vpu-share">
              <button type="button" className={BTN} onClick={() => void copy()}>
                <Ic name="copy" />
                {copied ? "Copiado" : "Copiar"}
              </button>
              <a className={BTN} href={`https://wa.me/?text=${encodeURIComponent(waText(link, madeFor?.name))}`} target="_blank" rel="noreferrer">
                <Ic name="chat" />
                WhatsApp
              </a>
            </div>
            <p className="vpu-msg">
              <b>Lo que le llega:</b> {waText(link, madeFor?.name)}
            </p>
          </>
        )}
      </section>

      <section className="nx-sec" aria-labelledby="vpu-passes-h" style={{ marginTop: 22 }}>
        <div className="nx-sec__head">
          <h2 className="nx-h3" id="vpu-passes-h">
            Pases activos · {cap.invites.length}
          </h2>
          <p className="nx-meta">Revocar lo deja sin efecto al momento</p>
        </div>
        {cap.invites.length ? (
          <ul className="vpu-passes" aria-label="Pases activos">
            {cap.invites.map((v) => {
              const title = passTitle(v, byId);
              const shirt = v.playerId ? byId.get(v.playerId) : undefined;
              return (
                <li key={v.code} className="vpu-pass">
                  <div className="vpu-tk">
                    <div className="vpu-tk__stub">
                      <PShirt n={shirt ? shirt.num || "?" : "?"} className={shirt ? undefined : "vpu-none"} />
                      <small>PASE</small>
                    </div>
                    <div className="vpu-tk__body">
                      <b>{title}</b>
                      <p className="vpu-tk__dl">
                        <span>{passLine(v, now)}</span>
                        {made?.code === v.code && <span className="vpu-new">Nuevo</span>}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`${BTN} nx-btn--danger`}
                    onClick={() =>
                      void cap.revokeInvite(v.code).then((ok) => {
                        if (!ok) return;
                        if (made?.code === v.code) setMade(null);
                        say("Enlace revocado: deja de funcionar al momento.");
                      })
                    }
                    disabled={cap.busy === `inv:${v.code}`}
                    aria-label={`Revocar el pase ${title}`}
                  >
                    <Ic name="close" />
                    Revocar
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="nx-meta">Sin pases activos: crea uno con «Crear enlace».</p>
        )}
      </section>
    </>
  );
}

function Dentro({ cap, byId, now, say, asking, setAsking }: PanelProps & { now: number; say: (t: string) => void; asking: string | null; setAsking: (uid: string | null) => void }) {
  return (
    <section className="nx-sec nx-sec--first" aria-labelledby="vpu-in-h">
      <div className="nx-sec__head">
        <h2 className="nx-h3" id="vpu-in-h">
          {insideLine(cap.inside.length)}
        </h2>
        <p className="nx-meta">Quitar el acceso no borra a nadie de la plantilla.</p>
      </div>
      <ul className="ve-list vpu-in" aria-label="Dentro del vestuario">
        {cap.inside.map((m) => {
          const p = m.person!;
          const shirt = p.playerId ? byId.get(p.playerId) : undefined;
          const name = shirt?.name ?? (p.nickname || p.displayName || p.email);
          const captain = p.role === "admin" || p.role === "superadmin";
          const line = since(m.joinedAt, now);
          const fresh = isToday(m.joinedAt, now);
          const open = asking === m.uid;
          const can = !m.me && p.role !== "superadmin";
          const confirmT = `¿Quitar a ${name}? Se le cierra en todos sus móviles.`;
          return (
            <li key={m.uid} className={`ve-row${m.me ? " is-me" : ""}${fresh ? " is-fresh" : ""}`}>
              <PShirt n={shirt ? shirt.num || "?" : "?"} className={shirt ? undefined : "vpu-none"} />
              <span className="ve-row__t">
                <b>
                  {name}
                  {m.me && <span className="ve-you">tú</span>}
                </b>
                <span>{captain ? `Capitán · ${line.charAt(0).toLowerCase()}${line.slice(1)}` : line}</span>
              </span>
              {m.me && <span className="vpu-in__mine">Tu cuenta</span>}
              {can && (
                <button type="button" className={BTN} onClick={() => setAsking(open ? null : m.uid)} disabled={cap.busy === `mem:${m.uid}`} aria-expanded={open} aria-label={`Quitar acceso a ${name}`}>
                  Quitar acceso
                </button>
              )}
              {can && open && (
                <div className="ve-confirm" role="alertdialog" aria-label={confirmT}>
                  <p>
                    ¿Quitar a <b>{name}</b>? Se le cierra en todos sus móviles.
                  </p>
                  <div className="ve-acts">
                    <button
                      type="button"
                      className={`${BTN} nx-btn--danger`}
                      onClick={() => {
                        setAsking(null);
                        void cap.removeMember(m.uid).then((ok) => ok && say("Acceso quitado. Su ficha sigue en la plantilla."));
                      }}
                    >
                      Quitar
                    </button>
                    <button type="button" className="nx-lnk" onClick={() => setAsking(null)}>
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
  );
}
