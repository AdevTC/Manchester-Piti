// «La puerta», the tunnel's control room inside the vestuario (captains only): the monitor, who is
// knocking (a swipeable stack with undo), invitation links (copy, WhatsApp, QR, a poster for the real
// door), who is inside (remove access) and the live passes. Same LED language as the door.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Icon } from "../../components/celeste/icons";
import { inviteUrl } from "../../lib/door";
import { pushState, savedTopics, toggleTopic } from "../../lib/push";
import { useCaptainDoor, UNDO_MS } from "./useCaptainDoor";
import { useSeasonSquad } from "./useDoor";
import { Tunnel } from "./Tunnel";
import { DIcon, MiniShirt } from "./icons";
import { Qr } from "./Qr";
import "../../styles/acceso.css";
import "../../styles/acceso-app.css";

const ago = (ms: number) => {
  if (!ms) return "";
  const m = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};
const daysLeft = (ms: number) => {
  const d = Math.ceil((ms - Date.now()) / 86_400_000);
  return d <= 1 ? "Caduca hoy" : `Caduca en ${d} días`;
};
const since = (ms: number) => (ms ? `Dentro desde el ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" }).format(ms)}` : "Dentro");
const mag = {
  onPointerMove: (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--tx", (((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(1));
    e.currentTarget.style.setProperty("--ty", (((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(1));
  },
  onPointerLeave: (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.style.removeProperty("--tx");
    e.currentTarget.style.removeProperty("--ty");
  },
};
const buzz = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not on this device */
  }
};
const TABS = ["Llamando", "Invitar", "Dentro", "Pases"] as const;

export function CaptainDoor() {
  const cap = useCaptainDoor();
  const { squad } = useSeasonSquad();
  const byId = new Map(squad.map((s) => [s.id, s]));
  const [tab, setTab] = useState(0);
  const [chg, setChg] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<{ uid: string; ok: boolean } | null>(null);
  const [uk, setUk] = useState(0);
  const [fixed, setFixed] = useState<Record<string, string>>({});
  // invite builder
  const [invF, setInvF] = useState("");
  const [uses, setUses] = useState<0 | 1>(1);
  const [made, setMade] = useState<{ code: string; expiresAt: number; playerId: string; uses: 0 | 1 } | null>(null);
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [doorPush, setDoorPush] = useState(() => savedTopics().includes("door"));
  const card = useRef<HTMLElement>(null);
  const drag = useRef({ on: false, x0: 0, dx: 0 });

  // «Ir a La puerta» (/vestuario#puerta, from the profile's Capitanía): this panel loads lazily, after
  // the browser looked for the anchor, so it brings itself into view once it is there.
  useEffect(() => {
    if (!cap.admin || window.location.hash !== "#puerta") return;
    const t = window.setTimeout(() => document.getElementById("puerta")?.scrollIntoView?.({ block: "start" }), 60);
    return () => window.clearTimeout(t);
  }, [cap.admin]);

  if (!cap.admin) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const free = squad.filter((s) => !cap.linked.has(s.id));
  const pend = cap.queue.map((r) => {
    const fid = fixed[r.uid] ?? r.playerId ?? "";
    const p = fid ? byId.get(fid) : undefined;
    const name = p?.name ?? r.playerName ?? (r.name || r.googleName || "Sin nombre").toUpperCase();
    return { r, fid, name, num: p?.num ?? (fid ? "" : "?"), note: fid ? `Eligió el ${p?.num || p?.name || "dorsal"}` : "No está en la plantilla" };
  });
  const top = pend[0];
  const act = (ok: boolean) => {
    if (!top || leaving) return;
    setLeaving({ uid: top.r.uid, ok });
    buzz(ok ? [20, 40, 20] : 40);
    window.setTimeout(() => {
      cap.decide(top.r, ok, top.fid || undefined);
      setLeaving(null);
      setChg(null);
      setUk((u) => u + 1);
      card.current?.style.setProperty("--dx", "0");
    }, 420);
  };
  const swipe = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button > 0) return;
      drag.current = { on: true, x0: e.clientX, dx: 0 };
      e.currentTarget.setAttribute("data-drag", "");
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* older browsers */
      }
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!drag.current.on) return;
      drag.current.dx = e.clientX - drag.current.x0;
      e.currentTarget.style.setProperty("--dx", drag.current.dx.toFixed(1));
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => end(e.currentTarget),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e.currentTarget),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        act(true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        act(false);
      }
    },
  };
  function end(el: HTMLElement) {
    if (!drag.current.on) return;
    drag.current.on = false;
    el.removeAttribute("data-drag");
    const w = Math.max(90, el.offsetWidth * 0.3);
    if (drag.current.dx > w) act(true);
    else if (drag.current.dx < -w) act(false);
    else el.style.setProperty("--dx", "0");
  }

  const linkOf = (code: string) => inviteUrl(origin, code);
  const share = made ? linkOf(made.code) : "";
  const madeFor = made?.playerId ? byId.get(made.playerId) : undefined;
  const create = async () => {
    const out = await cap.invite({ ...(invF ? { playerId: invF } : {}), maxUses: uses, days: 7 });
    if (out) {
      setMade({ ...out, playerId: invF, uses });
      setCopied(false);
      buzz(20);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const waText = madeFor ? `¡${madeFor.name}! Te abro el vestuario del Manchester Piti: entra con tu Google aquí: ${share}` : `Te abro el vestuario del Manchester Piti: entra con tu Google aquí: ${share}`;
  const pending = cap.pending;
  const counts = [cap.queue.length, 0, cap.inside.length, cap.invites.length];
  const togglePush = async () => {
    try {
      const t = await toggleTopic("door", !doorPush);
      setDoorPush(t.includes("door"));
    } catch {
      setDoorPush(savedTopics().includes("door"));
    }
  };

  return (
    <section className="tl tl-cap" id="puerta" aria-labelledby="cc-t">
      <div className="cc">
        <div className="cc-head">
          <p className="tl-k">
            <i />
            Vestuario · sala de control
          </p>
          <h2 className="tl-h1" id="cc-t">
            <span className="w">
              La <em>puerta</em>
            </span>
          </h2>
          <p className="tl-lead">Quién llama, quién está dentro y quién tiene pase. Un toque y abres; otro y cierras.</p>
          {pushState() === "ready" && (
            <button type="button" className="push mag" {...mag} aria-pressed={doorPush} onClick={() => void togglePush()}>
              <span className="lbl">
                <DIcon name="bell" size={20} />
                <span>{doorPush ? "Te avisamos cuando llamen" : "Avísame cuando alguien llame"}</span>
              </span>
              <span className="sw" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="cc-left cc-top">
          <div className="mon">
            <Tunnel k={pending?.approve ? "capok" : "cap"} take={uk} monitor led={{ a: "SALA DE CONTROL", a2: "LA PUERTA", b: `${cap.queue.length} LLAMANDO · ${cap.inside.length} DENTRO`, end: "LA PUERTA", ceil: squad.slice(0, 8).map((s) => `${s.name}${s.num ? " " + s.num : ""}`) }} />
            <div className="mon-hud t">
              <span>
                <span className="rec" />
                REC · CAM 1 · TÚNEL
              </span>
              <span className="tc" />
            </div>
            <div className="mon-hud b">
              <span>{cap.queue.length ? `${cap.queue.length} LLAMANDO` : "TÚNEL VACÍO"}</span>
              <span>EN VIVO</span>
            </div>
          </div>
          <div className="cnts">
            <div className="cnt hot">
              <b key={`p${cap.queue.length}`}>{cap.queue.length}</b>
              <small>LLAMANDO</small>
            </div>
            <div className="cnt">
              <b key={`m${cap.inside.length}`}>{cap.inside.length}</b>
              <small>DENTRO</small>
            </div>
            <div className="cnt">
              <b key={`i${cap.invites.length}`}>{cap.invites.length}</b>
              <small>PASES</small>
            </div>
          </div>
          <div className="nt-wrap">
            <span className="k">
              Así te llega al móvil <span className="nv">nuevo</span>
            </span>
            <div className="nt" role="group" aria-label="Vista previa del aviso">
              <div className="nt-h">
                <img src="/crest-128.webp" alt="" />
                <span>MANCHESTER PITI · LA PUERTA</span>
                <span>{top ? ago(top.r.at) : "ahora"}</span>
              </div>
              {top ? (
                <>
                  <div className="nt-b">
                    <div>
                      <b>{top.name} llama a la puerta</b>
                      <p>
                        {top.note}
                        {top.r.email ? ` · ${top.r.email}` : ""}
                      </p>
                    </div>
                    <MiniShirt num={top.num || "·"} tone={top.fid ? "" : "off"} />
                  </div>
                  <div className="nt-acts">
                    <button type="button" onClick={() => act(true)}>
                      Aprobar
                    </button>
                    <button type="button" onClick={() => act(false)}>
                      Rechazar
                    </button>
                  </div>
                </>
              ) : (
                <p className="nt-empty">Sin avisos: nadie llamando a la puerta.</p>
              )}
            </div>
          </div>
        </div>
        <div className="cc-right">
          <div className="tabs" role="tablist" aria-label="Herramientas de la puerta">
            {TABS.map((t, i) => (
              <button key={t} type="button" role="tab" aria-selected={tab === i} aria-controls={`cp${i + 1}`} onClick={() => setTab(i)}>
                {t}
                {counts[i]! > 0 && i !== 1 && <i>{counts[i]}</i>}
              </button>
            ))}
          </div>
          {cap.error && (
            <p className="tl-note warn" role="alert">
              <DIcon name="alert" size={18} />
              <span>{cap.error}</span>
            </p>
          )}
          <div className="cps">
            <section className={`cp rqp${tab === 0 ? " on" : ""}`} id="cp1" aria-labelledby="cp1-t">
              <h2 id="cp1-t">
                Llamando <span className="n">{cap.queue.length} {cap.queue.length === 1 ? "PETICIÓN" : "PETICIONES"}</span>
                <span className="nv">nuevo</span>
              </h2>
              <p id="sw-help">Desliza la tarjeta: a la derecha abres, a la izquierda no. O usa los botones.</p>
              {top ? (
                <>
                  <div className="sk">
                    {pend.slice(1, 3).map((x, i) => (
                      <span key={x.r.uid} className="sk-back" style={{ "--i": i + 1 } as CSSProperties} aria-hidden="true" />
                    ))}
                    <article
                      ref={card}
                      key={top.r.uid}
                      className={`sw-card ${leaving?.uid === top.r.uid ? (leaving.ok ? "go-ok" : "go-no") : uk ? (uk % 2 ? "pa" : "pb") : ""}`}
                      tabIndex={0}
                      aria-roledescription="tarjeta deslizable"
                      aria-label={`Petición de ${top.name}, ${top.note}${top.r.email ? `, ${top.r.email}` : ""}. Flecha derecha abre, flecha izquierda rechaza.`}
                      aria-describedby="sw-help"
                      {...swipe}
                    >
                      <span className="sw-tint ok" aria-hidden="true" />
                      <span className="sw-tint no" aria-hidden="true" />
                      <div className="sw-hd">
                        <span>
                          <span className="rec" />
                          LLAMANDO · 1 DE {pend.length}
                        </span>
                        <span>{ago(top.r.at)}</span>
                      </div>
                      <div className="sw-who">
                        <MiniShirt num={top.num || "?"} tone={top.fid ? "" : "off"} />
                        <div>
                          <small>QUIERE LA FICHA</small>
                          <strong>{top.name}</strong>
                          <span>{top.note}</span>
                        </div>
                      </div>
                      <dl className="sw-id">
                        <div>
                          <dt>GOOGLE</dt>
                          <dd>{top.r.googleName || "—"}</dd>
                        </div>
                        <div>
                          <dt>CORREO</dt>
                          <dd>{top.r.email || "—"}</dd>
                        </div>
                      </dl>
                      <div className="sw-led" aria-hidden="true">
                        <span className="mq">
                          <b>{`QUIERE ENTRAR · ${top.name} · ${top.num && top.num !== "?" ? "DORSAL " + top.num : "SIN DORSAL"} · `}</b>
                          <b>{`QUIERE ENTRAR · ${top.name} · ${top.num && top.num !== "?" ? "DORSAL " + top.num : "SIN DORSAL"} · `}</b>
                        </span>
                      </div>
                      <span className="sw-st ok" aria-hidden="true">
                        ABRIR
                      </span>
                      <span className="sw-st no" aria-hidden="true">
                        NO
                      </span>
                    </article>
                  </div>
                  <div className="sw-acts">
                    <button type="button" className="no" onClick={() => act(false)}>
                      <Icon name="x" size={16} />
                      Rechazar
                    </button>
                    <button type="button" className="chg" onClick={() => setChg(chg === top.r.uid ? null : top.r.uid)} aria-expanded={chg === top.r.uid}>
                      <Icon name="swap" size={15} />
                      Ficha
                    </button>
                    <button type="button" className="ok" onClick={() => act(true)}>
                      <Icon name="check" size={16} />
                      Aprobar
                    </button>
                  </div>
                  {chg === top.r.uid && (
                    <div className="rq-chg" role="group" aria-label="Cambiar ficha">
                      {free.map((x) => (
                        <button
                          key={x.id}
                          type="button"
                          aria-pressed={x.id === top.fid}
                          onClick={() => {
                            setFixed((f) => ({ ...f, [top.r.uid]: x.id }));
                            setChg(null);
                          }}
                        >
                          {x.num ? `${x.num} · ` : ""}
                          {x.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {pend.length > 1 && (
                    <p className="sw-q">
                      <span>EN COLA</span>
                      {pend
                        .slice(1)
                        .map((x) => `${x.name}${x.num && x.num !== "?" ? " · " + x.num : ""}`)
                        .join("   ")}
                    </p>
                  )}
                </>
              ) : (
                <div className="empty">
                  <b>Túnel en silencio</b>
                  {cap.loading ? "Mirando quién llama…" : "Nadie llamando. Cuando alguien pida acceso te llega un aviso."}
                </div>
              )}
              {pending && (
                <div key={pending.until} className={`ut ${uk % 2 ? "ua" : "ub"}`} role="status" style={{ "--ut": `${UNDO_MS}ms` } as CSSProperties}>
                  <span className={`ut-ic${pending.approve ? "" : " no"}`} aria-hidden="true">
                    {pending.approve ? <Icon name="check" size={15} /> : <Icon name="x" size={14} />}
                  </span>
                  <span className="ut-t">{pending.approve ? `${(pending.playerId && byId.get(pending.playerId)?.name) || pending.row.name || pending.row.googleName} entra · le llega un aviso` : `Petición de ${pending.row.playerName || pending.row.name || pending.row.googleName} rechazada`}</span>
                  <button type="button" onClick={cap.undo}>
                    <DIcon name="undo" size={15} />
                    Deshacer
                  </button>
                  <i className="ut-bar" aria-hidden="true" />
                </div>
              )}
            </section>

            <section className={`cp${tab === 1 ? " on" : ""}`} id="cp2" aria-labelledby="cp2-t">
              <h2 id="cp2-t">Invitar a alguien</h2>
              <p>Un enlace y entra sin esperar. Caduca solo.</p>
              <div className="ib">
                <div>
                  <label className="lab" htmlFor="ib-f">
                    Ficha reservada · opcional
                  </label>
                  <select id="ib-f" value={invF} onChange={(e) => setInvF(e.target.value)}>
                    <option value="">Sin ficha · que elija al entrar</option>
                    {free.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.num ? `${x.num} · ` : ""}
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="lab">Usos</span>
                  <div className="seg2" role="group" aria-label="Usos del enlace">
                    <button type="button" aria-pressed={uses === 1} onClick={() => setUses(1)}>
                      1 uso
                    </button>
                    <button type="button" aria-pressed={uses === 0} onClick={() => setUses(0)}>
                      Ilimitado
                    </button>
                  </div>
                </div>
                <p className="exp">
                  <DIcon name="clock" size={16} />
                  Caduca en 7 días · lo puedes revocar cuando quieras
                </p>
                <button type="button" className="tl-cta mag" {...mag} onClick={() => void create()} disabled={cap.busy === "invite"} aria-busy={cap.busy === "invite"}>
                  <span>{cap.busy === "invite" ? "Creando…" : made ? "Crear otro enlace" : "Crear enlace"}</span>
                  <DIcon name="link" size={20} />
                </button>
                {made && (
                  <div className="link">
                    <span className="meta">
                      {madeFor ? `PARA ${madeFor.name}${madeFor.num ? " · " + madeFor.num : ""}` : "SIN FICHA"} · {made.uses === 0 ? "ILIMITADO" : "1 USO"} · 7 DÍAS
                    </span>
                    <code>{share}</code>
                    <div className="acts">
                      <button type="button" onClick={() => void copy()}>
                        <DIcon name="copy" size={16} />
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                      <a className="wa" href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer">
                        <DIcon name="chat" size={16} />
                        WhatsApp
                      </a>
                      <button type="button" onClick={() => setQr((q) => !q)} aria-expanded={qr}>
                        <DIcon name="qr" size={16} />
                        QR
                      </button>
                    </div>
                    {qr && (
                      <div className="qrbox">
                        <div className="qr">
                          <Qr text={share} label="Código QR del enlace de invitación" />
                        </div>
                        <p>Que lo escanee con la cámara del móvil y entra directo al túnel.</p>
                      </div>
                    )}
                    <div className="poster">
                      <div className="pst" aria-hidden="true">
                        <img src="/crest-128.webp" alt="" />
                        <b>LLAMA AL VESTUARIO</b>
                        <span className="qr">
                          <Qr text={share} />
                        </span>
                        <small>ESCANEA · ENTRA</small>
                      </div>
                      <div>
                        <b>
                          Cartel para la puerta <span className="nv">nuevo</span>
                        </b>
                        <p>Un A4 con el QR para pegar en el vestuario de verdad{made.uses === 1 ? " (mejor con un enlace ilimitado)" : ""}.</p>
                        <button type="button" className="tl-ghost" onClick={() => window.print()}>
                          <DIcon name="print" size={16} />
                          Imprimir cartel
                        </button>
                      </div>
                    </div>
                    <div className="tl-poster-print" aria-hidden="true">
                      <img src="/crest-128.webp" alt="" />
                      <b>LLAMA AL VESTUARIO</b>
                      <p>Manchester Piti · solo plantilla</p>
                      <div className="qr">
                        <Qr text={share} />
                      </div>
                      <small>Escanea con el móvil, entra con tu Google y elige tu camiseta</small>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className={`cp${tab === 2 ? " on" : ""}`} id="cp3" aria-labelledby="cp3-t">
              <h2 id="cp3-t">
                Dentro <span className="n">{cap.inside.length} CON ACCESO</span>
              </h2>
              <p>El acceso no caduca: dura hasta que lo quites.</p>
              <ul className="mem-list">
                {cap.inside.map((m) => {
                  const p = m.person!;
                  const shirt = p.playerId ? byId.get(p.playerId) : undefined;
                  const name = shirt?.name ?? (p.displayName || p.nickname || p.email).toUpperCase();
                  const captain = p.role === "admin" || p.role === "superadmin";
                  return (
                    <li key={m.uid} className={`mem${m.me ? " me" : ""}`}>
                      <MiniShirt num={captain && !shirt?.num ? "C" : shirt?.num || "·"} tone={captain ? "navy" : ""} />
                      <div>
                        <b>{name}</b>
                        <small>
                          {m.me && <i />}
                          {m.me ? "Tú" : since(m.joinedAt)}
                        </small>
                      </div>
                      {m.me || p.role === "superadmin" ? (
                        <em>{captain ? "CAPITÁN" : ""}</em>
                      ) : (
                        <button type="button" onClick={() => setConfirm(confirm === m.uid ? null : m.uid)} aria-expanded={confirm === m.uid} disabled={cap.busy === `mem:${m.uid}`}>
                          Quitar acceso
                        </button>
                      )}
                      {confirm === m.uid && (
                        <div className="cf" role="alert">
                          <span>
                            ¿Quitar a <b>{name}</b>? Se le cierra en todos sus móviles.
                          </span>
                          <button
                            type="button"
                            className="yes"
                            onClick={() => {
                              setConfirm(null);
                              buzz(40);
                              void cap.removeMember(m.uid);
                            }}
                          >
                            Quitar
                          </button>
                          <button type="button" className="non" onClick={() => setConfirm(null)}>
                            Cancelar
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className={`cp${tab === 3 ? " on" : ""}`} id="cp4" aria-labelledby="cp4-t">
              <h2 id="cp4-t">
                Pases activos <span className="n">{cap.invites.length} ENLACES</span>
              </h2>
              <p>Revoca un enlace y deja de funcionar al momento.</p>
              {cap.invites.length ? (
                <ul className="inv-list">
                  {cap.invites.map((v) => {
                    const p = v.playerId ? byId.get(v.playerId) : undefined;
                    return (
                      <li key={v.code} className="invr">
                        <span className="ic">
                          <DIcon name="ticket" size={18} />
                        </span>
                        <div>
                          <b>{p ? `Para ${p.name}${p.num ? " · " + p.num : ""}` : v.playerName ? `Para ${v.playerName}` : "Enlace abierto · sin ficha"}</b>
                          <small>
                            {v.maxUses === 0 ? "Ilimitado" : "1 uso"} · {daysLeft(v.expiresAt)} · {v.uses ? `${v.uses} ${v.uses === 1 ? "entrada" : "entradas"}` : "Sin usar"}
                          </small>
                        </div>
                        <button type="button" onClick={() => void cap.revokeInvite(v.code)} disabled={cap.busy === `inv:${v.code}`}>
                          Revocar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="empty">
                  <b>Sin pases</b>Crea uno en «Invitar».
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
