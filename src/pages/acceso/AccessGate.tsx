// The vestuario door (Celeste · "elegida", Design canvas "Acceso al vestuario · elegida"): a full-bleed
// LED tunnel that every step reprograms. Puerta → (invitación) → ¿Quién eres? → en la puerta /
// dentro → the walkout to the pitch. No team key: Google + your shirt, and a captain opens.
import { useEffect, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../firebase";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon, type IconName } from "../../components/celeste/icons";
import { ThemeToggle } from "../../components/ThemeToggle";
import { Jersey3D } from "../../components/jersey3d/Jersey3D";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { inviteUrl } from "../../lib/door";
import { useDoor, type Door } from "./useDoor";
import { Tunnel, type LedKey, type LedTexts } from "./Tunnel";
import { DIcon, GoogleLogo, MiniShirt, ShirtBack, type DoorIconName } from "./icons";
import { Qr } from "./Qr";
import "../../styles/acceso.css";
import "../../styles/acceso-app.css";

// ---------- small interaction helpers (no React state: CSS variables on the element)
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
const tilt = {
  onPointerMove: (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--rx", (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
    e.currentTarget.style.setProperty("--ry", (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
  },
  onPointerLeave: (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.style.removeProperty("--rx");
    e.currentTarget.style.removeProperty("--ry");
  },
};
const METER = Array.from({ length: 18 }, (_, i) => ({ "--d": (-(i * 0.37) % 1.3).toFixed(2) + "s", "--t": (0.9 + ((i * 7) % 5) / 10).toFixed(2) + "s" }) as CSSProperties);
const INSIDE: { k: string; d: string; ic: IconName | DoorIconName }[] = [
  { k: "Convocatorias", d: "¿Vas el domingo?", ic: "cal" },
  { k: "La porra", d: "Clava el resultado", ic: "target" },
  { k: "MVP", d: "Vota al mejor", ic: "star" },
  { k: "La pizarra", d: "La táctica del finde", ic: "flag" },
  { k: "El tablón", d: "Lo que se cuece", ic: "bell" },
  { k: "Tu cartel", d: "Tu ficha, en 3D", ic: "shirt" },
];
const COMO = [
  ["Entras con tu Google", "Sin contraseña del equipo: tu cuenta es tu llave y no caduca."],
  ["Eliges tu camiseta", "Tu ficha de la plantilla, o tu nombre si aún no estás en ella."],
  ["El capitán abre", "Con invitación, entras directo. Si no, un toque suyo y dentro."],
];
const DOOR_ICONS = new Set<string>(["target", "bell", "back", "clock", "route", "wall", "alert"]);
const AnyIcon = ({ name, size }: { name: IconName | DoorIconName; size: number }) =>
  DOOR_ICONS.has(name) ? <DIcon name={name as DoorIconName} size={size} /> : <Icon name={name as IconName} size={size} />;
const rep = (s: string, n: number) => Array.from({ length: n }, () => s).join("  ·  ") + "  ·  ";
const ago = (ms: number) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  return m < 1 ? "AHORA" : m < 60 ? `HACE ${m} MIN` : m < 1440 ? `HACE ${Math.round(m / 60)} H` : `HACE ${Math.round(m / 1440)} D`;
};
const longDate = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" }).format(ms);
const askLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

// ---------- pieces
function GoogleCta({ door, label }: { door: Door; label?: string }) {
  const busy = door.busy === "google";
  return (
    <button type="button" className={`tl-cta mag${busy ? " busy" : ""}`} {...mag} onClick={() => void door.signIn()} disabled={busy} aria-busy={busy}>
      <span className="g">
        <GoogleLogo />
      </span>
      <span>{busy ? "Abriendo Google…" : (label ?? (door.iphone ? "Seguir a Google" : "Entrar con Google"))}</span>
    </button>
  );
}
function Avisos({ door }: { door: Door }) {
  return (
    <>
      {door.error && (
        <div className="tl-note warn" role="alert">
          <DIcon name="alert" size={18} />
          <div>
            {door.error.popup ? (
              <>
                <b>Se cerró la ventana de Google.</b> No has entrado todavía. Si tu navegador bloquea ventanas emergentes, permite las de esta web y vuelve a probar.
              </>
            ) : (
              door.error.text
            )}
            {door.error.popup && (
              <div className="tl-row">
                <button type="button" className="tl-ghost" onClick={() => void door.signIn()}>
                  <DIcon name="replay" size={16} />
                  Reintentar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {door.iphone && !door.error && door.busy !== "google" && (
        <div className="tl-note">
          <DIcon name="phone" size={18} />
          <div>
            <b>Abriremos Google en esta ventana.</b> Con la app instalada en el iPhone no se pueden abrir ventanas nuevas: eliges tu cuenta y vuelves aquí solo.
          </div>
        </div>
      )}
      {door.busy === "google" && (
        <p className="tl-chip wide" role="status">
          <DIcon name="wifi" size={14} />
          Conectando con Google… no cierres esta pantalla
        </p>
      )}
      <DevSignIn />
    </>
  );
}
/** Emulator only: sign in as the seeded captain or as a new face, without Google. */
function DevSignIn() {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_FIREBASE_EMULATOR !== "1" || auth.currentUser) return null;
  const go = (sub: string, email: string, name: string) => {
    const enc = (v: object) => btoa(JSON.stringify(v)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const token = enc({ alg: "none", typ: "JWT" }) + "." + enc({ sub, email, email_verified: true, name, aud: "demo", iss: "https://accounts.google.com" }) + ".";
    void signInWithCredential(auth, GoogleAuthProvider.credential(token)).catch(() => undefined);
  };
  return (
    <div className="tl-row">
      <button type="button" className="tl-link" onClick={() => go("preview-admin", "admin@piti.test", "Administrador de pruebas")}>
        Google de prueba · Solo emulador
      </button>
      <button type="button" className="tl-link" onClick={() => go("preview-fan", "fichaje@piti.test", "Erik de pruebas")}>
        Fichaje de prueba · Solo emulador
      </button>
    </div>
  );
}
function Meter({ door, roar, light }: { door: Door; roar?: boolean; light?: boolean }) {
  return (
    <div className={`gm${roar ? " roar" : ""}${light ? " lt" : ""}`}>
      <div className="gm-bars" aria-hidden="true">
        {METER.map((s, i) => (
          <i key={i} style={s} />
        ))}
      </div>
      <div className="gm-lab">
        <b>{door.inside ?? "—"}</b>
        <small>CON ACCESO</small>
      </div>
    </div>
  );
}
function H1({ a, b }: { a: ReactNode; b: ReactNode }) {
  return (
    <h1 className="tl-h1" id="tl-t">
      <span className="w">
        {a} <em>{b}</em>
      </span>
    </h1>
  );
}
function Ticket({ dead, name, num, by, until, link, problem }: { dead: boolean; name: string; num: string; by: string; until: string; link: string; problem?: string }) {
  return (
    <div className="tk-wrap">
      <span className="tk-lan" aria-hidden="true" />
      <article className={`tk${dead ? " dead" : ""}`} {...tilt} aria-label={dead ? "Invitación no válida" : "Pase de túnel: invitación al vestuario"}>
        <span className="tk-hole" aria-hidden="true" />
        <div className="tk-head">
          <img src="/crest-128.webp" alt="" />
          <div>
            <small>PASE DE TÚNEL · INVITACIÓN</small>
            <b>Manchester Piti</b>
          </div>
        </div>
        <div className="tk-name">
          <div>
            <small>{num ? "FICHA RESERVADA" : "FICHA"}</small>
            <strong>{name}</strong>
          </div>
          {num && (
            <span className="num" aria-hidden="true">
              {num}
            </span>
          )}
        </div>
        <dl className="tk-grid">
          {dead ? (
            <div>
              <dt>ESTADO</dt>
              <dd>{problem}</dd>
            </div>
          ) : (
            <>
              <div>
                <dt>INVITA</dt>
                <dd>{by}</dd>
              </div>
              <div>
                <dt>VÁLIDA HASTA</dt>
                <dd>{until}</dd>
              </div>
              <div>
                <dt>ACCESO</dt>
                <dd>Sin esperas</dd>
              </div>
              <div>
                <dt>DURA</dt>
                <dd>Hasta que el capitán diga</dd>
              </div>
            </>
          )}
        </dl>
        <div className="tk-perf" aria-hidden="true" />
        <div className="tk-foot">
          <div className="tk-bars" aria-hidden="true" />
          <div className="qr">
            <Qr text={link} />
          </div>
        </div>
        {dead && <div className="tk-tear" aria-hidden="true" />}
      </article>
      {dead && (
        <span className="stamp" aria-hidden="true">
          CADUCADA
        </span>
      )}
    </div>
  );
}
function Fold({ id, kicker, title, sub, icon, extra, full, children }: { id: string; kicker: string; title: string; sub: string; icon: IconName | DoorIconName; extra?: ReactNode; full?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`fold${full ? " full" : ""}${open ? " open" : ""}`} aria-labelledby={id}>
      <div className="sec-h">
        <div>
          <span className="k">{kicker}</span>
          <h2 id={id}>{title}</h2>
        </div>
        {extra}
      </div>
      <button type="button" className="fold-b" aria-expanded={open} aria-controls={`${id}-p`} onClick={() => setOpen((o) => !o)}>
        <span className="fi">
          <AnyIcon name={icon} size={20} />
        </span>
        <span className="ft">
          <b>{title}</b>
          <small>{sub}</small>
        </span>
        {extra}
        <span className="chev">
          <DIcon name="chev" />
        </span>
      </button>
      <div className="fold-p" id={`${id}-p`}>
        {children}
      </div>
    </section>
  );
}

// ---------- the screens
function Puerta({ door }: { door: Door }) {
  const inside = door.shirts.filter((s) => s.taken);
  const names = inside.slice(0, 3).map((s) => s.name);
  return (
    <div className="tl-band">
      <div className="tl-copy">
        <p className="tl-k">
          <i />
          Túnel de vestuarios · acceso privado
        </p>
        <H1 a="Solo" b="plantilla" />
        <p className="tl-lead">
          Al otro lado se cuece el domingo: <b>convocatorias, la porra, el MVP, la pizarra y el tablón</b>. Entras con tu Google y te quedas dentro hasta que el capitán diga lo contrario.
        </p>
        <div className="tl-acts">
          <GoogleCta door={door} />
          <Link className="tl-link" to="/">
            <DIcon name="back" size={17} />
            Volver a la web
          </Link>
        </div>
        <Avisos door={door} />
        <div className="tl-chips">
          <span className="tl-chip">
            <Icon name="lock" size={14} />
            Sin contraseña del equipo
          </span>
          <span className="tl-chip">
            <DIcon name="clock" size={14} />
            No caduca
          </span>
          <span className="tl-chip">
            <Icon name="shirt" size={14} />
            Una cuenta, una ficha
          </span>
        </div>
      </div>
      <aside className="led-card" aria-label="Desde dentro del vestuario">
        <div className="bd-top">
          <span className="live">
            <span className="live-dot" />
            DESDE DENTRO
          </span>
          <span className="nv">nuevo</span>
        </div>
        <div className="bd-pres">
          {inside.length > 0 && (
            <span className="stack">
              {inside.slice(0, 3).map((s) => (
                <MiniShirt key={s.id} num={s.num || "·"} />
              ))}
            </span>
          )}
          <p>
            <b>{door.inside == null ? "—" : `${door.inside} ${door.inside === 1 ? "compañero" : "compañeros"}`}</b>
            con acceso al vestuario
            {names.length > 0 && (
              <>
                <br />
                <small>
                  {names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : names[0]}
                  {inside.length > names.length ? ` y ${inside.length - names.length} más` : ""}
                </small>
              </>
            )}
          </p>
        </div>
        {door.next && (
          <div className="bd-teaser">
            <small>PRÓXIMO PARTIDO · CONVOCATORIA</small>
            <b>
              {door.next.rival} · {door.next.home ? "en casa" : "fuera"}
            </b>
            <small>{door.next.when}</small>
            <div className="bd-blur" aria-hidden="true">
              <i style={{ width: "75%", background: "#6CABDD" }} />
              <i style={{ width: "17%", background: "#FFC659" }} />
              <i style={{ width: "8%", background: "#9fb3d3" }} />
            </div>
            <span className="bd-lock">
              <Icon name="lock" size={14} />
              Quién va y quién no, solo dentro
            </span>
          </div>
        )}
        <Meter door={door} />
      </aside>
    </div>
  );
}

function Invitacion({ door }: { door: Door }) {
  const inv = door.invite?.state === "valid" ? door.invite : null;
  const reserved = inv?.playerId ? door.squad.find((s) => s.id === inv.playerId) : undefined;
  const link = typeof window !== "undefined" && door.code ? inviteUrl(window.location.origin, door.code) : "";
  return (
    <div className="tl-band">
      <div className="tl-copy">
        <p className="tl-k">
          <i />
          Invitación · pase de túnel
        </p>
        <H1 a="Te han" b="invitado" />
        <p className="tl-lead">
          <b>{inv?.by ?? "El capitán"}</b> te ha abierto la puerta del vestuario{reserved ? (
            <>
              {" "}
              y te ha guardado el <b>{reserved.num || reserved.name}</b>
            </>
          ) : null}
          . Entra con tu Google y estás dentro: sin esperar a nadie.
        </p>
        <div className="tl-acts">
          <GoogleCta door={door} />
          <Link className="tl-link" to="/">
            <DIcon name="back" size={17} />
            Volver a la web
          </Link>
        </div>
        <Avisos door={door} />
        <p className="tl-chip wide">
          <DIcon name="ticket" size={14} />
          El enlace es personal: si no es para ti, pídele otro al capitán
        </p>
      </div>
      <Ticket dead={false} name={reserved?.name ?? inv?.playerName ?? "NUEVO FICHAJE"} num={reserved?.num ?? ""} by={inv?.by ?? "El capitán"} until={inv ? longDate(inv.expiresAt) : ""} link={link} />
    </div>
  );
}

function Caducada({ door }: { door: Door }) {
  const problem = door.invite && door.invite.state !== "valid" ? door.invite.problem : "Esta invitación no sirve.";
  const link = typeof window !== "undefined" && door.code ? inviteUrl(window.location.origin, door.code) : "";
  return (
    <div className="tl-band">
      <div className="tl-copy">
        <p className="tl-k">
          <i />
          Invitación · no válida
        </p>
        <H1 a="Pase" b="caducado" />
        <p className="tl-lead">
          {problem} <b>No pasa nada</b>: pide acceso con tu Google y el capitán te abre con un toque.
        </p>
        <div className="tl-acts">
          {door.user ? (
            <button type="button" className="tl-cta mag" {...mag} onClick={door.choose}>
              <span>Pedir acceso</span>
              <Icon name="send" size={20} />
            </button>
          ) : (
            <GoogleCta door={door} label="Pedir acceso con Google" />
          )}
          <a className="tl-ghost" href={askLink("¿Me mandas otro enlace para entrar al vestuario del Manchester Piti? El mío ha caducado.")} target="_blank" rel="noreferrer">
            <DIcon name="chat" size={17} />
            Pedir otro enlace
          </a>
        </div>
        <Avisos door={door} />
      </div>
      <Ticket dead name="NUEVO FICHAJE" num="" by="" until="" link={link} problem={problem} />
    </div>
  );
}

function QuienEres({ door }: { door: Door }) {
  const inv = door.invite?.state === "valid" ? door.invite : null;
  const [pick, setPick] = useState<string | null>(() => inv?.playerId ?? null);
  const [q, setQ] = useState("");
  const [oname, setOname] = useState("");
  const query = q.trim().toLowerCase();
  const cards = door.shirts.filter((s) => !query || s.name.toLowerCase().includes(query) || s.num === query);
  const chosen = pick && pick !== "otro" ? door.shirts.find((s) => s.id === pick) : undefined;
  const name = pick === "otro" ? oname.trim().toUpperCase() : (chosen?.name ?? "");
  const num = chosen?.num ?? "";
  const can = pick === "otro" ? oname.trim().length >= 2 : !!chosen;
  const [take, setTake] = useState(0);
  const choose = (id: string) => {
    setPick(id);
    setTake((t) => t + 1);
    try {
      navigator.vibrate?.(15);
    } catch {
      /* not on this device */
    }
  };
  // The LED walls engrave the chosen shirt too.
  useEffect(() => {
    pickBus.emit({ name, num, take });
  }, [name, num, take]);
  const sug = door.suggestion && !inv && pick !== door.suggestion.id ? door.suggestion : null;
  const pickedTxt = !pick ? "Aún no has elegido camiseta." : pick === "otro" ? (oname.trim() ? `Entrarás como ${oname.trim()}, sin ficha de la plantilla.` : "Escribe el nombre que verá el equipo.") : `Elegida: ${name} · dorsal ${num}`;
  return (
    <div className="tl-band q-band">
      <div className="tl-copy q-l">
        <div className="me">
          <span className="av">{door.user?.photoURL ? <img src={door.user.photoURL} alt="" referrerPolicy="no-referrer" /> : <Icon name="user" size={20} />}</span>
          <div>
            <b>{door.user?.displayName || "Tu cuenta de Google"}</b>
            <span>{door.user?.email}</span>
          </div>
          <button type="button" className="tl-link" onClick={() => void door.exit()}>
            <DIcon name="out" size={16} />
            Salir
          </button>
        </div>
        <p className="tl-k">
          <i />
          Paso 2 · tu ficha
        </p>
        <H1 a="¿Quién" b="eres?" />
        <p className="tl-lead">
          {inv?.playerId
            ? `${inv.by} te ha reservado ${inv.playerName ?? "una ficha"}. Si no eres tú, elige tu camiseta: entras sin esperar.`
            : inv
              ? "Elige tu camiseta y entras sin esperar: vienes con invitación."
              : "Elige tu camiseta. El capitán la confirma junto con tu acceso, de un toque."}
        </p>
        <div className="mk-dock">
          <div className={`mk${pick ? ` on ${take % 2 ? "pa" : "pb"}` : ""}`} aria-hidden="true">
            <span className="mk-num">{num || (pick === "otro" ? "+" : "?")}</span>
            <div className="mk-row">
              <span className="mq">
                <b>{name ? rep(`${name}${num ? " · " + num : ""}`, 2) : rep("ELIGE TU CAMISETA", 2)}</b>
                <b>{name ? rep(`${name}${num ? " · " + num : ""}`, 2) : rep("ELIGE TU CAMISETA", 2)}</b>
              </span>
            </div>
            <span className="mk-scan" />
            <span className="mk-flash" />
          </div>
          <p className="mk-cap" aria-hidden="true">
            <span>{pick && name ? `Grabado en el túnel: ${name}${num ? " · " + num : ""}` : "Tu nombre y dorsal se graban en el túnel"}</span>
            <span className="nv">nuevo</span>
          </p>
          <p className="sr" aria-live="polite">
            {pickedTxt}
          </p>
          {door.error && (
            <p className="tl-note warn" role="alert">
              <DIcon name="alert" size={18} />
              <span>{door.error.text}</span>
            </p>
          )}
          <button type="button" className="tl-cta mag" {...mag} disabled={!can || door.busy === "send"} aria-busy={door.busy === "send"} onClick={() => void door.send(pick === "otro" ? { name: oname.trim() } : { playerId: pick! })}>
            <span>{door.busy === "send" ? "Enviando…" : inv ? "Entrar" : "Pedir acceso"}</span>
            <Icon name="send" size={20} />
          </button>
        </div>
        {sug && (
          <div className="sug">
            <MiniShirt num={sug.num || "·"} tone="gold" />
            <p>
              <b>¿Eres {sug.name}?</b>Tu nombre de Google se parece
            </p>
            <button type="button" className="tl-ghost mag" {...mag} onClick={() => choose(sug.id)}>
              Soy yo
            </button>
          </div>
        )}
        <label className="srch">
          <span className="sr">Busca tu nombre o dorsal</span>
          <Icon name="search" size={18} />
          <input type="search" placeholder="Busca tu nombre o dorsal" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="tl-copy">
        <div className="car" role="group" aria-label="Camisetas de la plantilla">
          {cards.map((s, i) => {
            const sel = pick === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className="fc"
                style={{ "--dl": (i * 0.05 + 0.3).toFixed(2) + "s" } as CSSProperties}
                aria-pressed={sel}
                disabled={s.taken}
                onClick={() => choose(s.id)}
                aria-label={`${s.name}${s.num ? `, dorsal ${s.num}` : ""}${s.taken ? ", ocupada" : sel ? ", elegida" : ""}`}
              >
                {sel && (
                  <span className="tag mine">
                    <Icon name="check" size={12} />
                    TU FICHA
                  </span>
                )}
                {s.taken && (
                  <span className="tag own">
                    <Icon name="lock" size={11} />
                    Ocupada
                  </span>
                )}
                <ShirtBack name={s.name} num={s.num} scale={0.5} />
                <b>{s.name}</b>
                <small>
                  {s.position ? `${s.position.slice(0, 3).toUpperCase()} · ` : ""}
                  {s.num || "sin dorsal"}
                </small>
              </button>
            );
          })}
          <button type="button" className="fc otro" aria-pressed={pick === "otro"} onClick={() => choose("otro")}>
            <span className="pl">
              <Icon name="plus" size={24} />
            </span>
            <b>No estoy en la plantilla</b>
            <small>Escribe tu nombre</small>
          </button>
        </div>
        {!cards.length && <p className="picked">Nadie con «{q}». ¿Eres nuevo? Pulsa «No estoy en la plantilla».</p>}
        {pick === "otro" && (
          <div className="oname">
            <label className="lab" htmlFor="tl-oname">
              Nombre que verá el equipo
            </label>
            <input id="tl-oname" className="tl-in" type="text" maxLength={24} placeholder="Cómo te llamamos en el vestuario" value={oname} onChange={(e) => setOname(e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}

function EnLaPuerta({ door, ok }: { door: Door; ok: boolean }) {
  const inside = door.shirts.filter((s) => s.taken && !(ok && s.name === door.me.name && s.num === door.me.num)).slice(0, 5);
  const at = door.asked?.at;
  return (
    <div className="tl-band">
      <div className="tl-copy">
        <p className="tl-k">
          <i />
          {ok ? "Puerta abierta · en directo" : "Petición enviada · en directo"}
        </p>
        <H1 a={ok ? "Estás" : "En la"} b={ok ? "dentro" : "puerta"} />
        <p className="tl-lead">
          {ok ? (
            <>
              El capitán te ha abierto. <b>Tu percha ya está en el muro</b>: sal al campo cuando quieras.
            </>
          ) : (
            <>
              Tu petición está con el capitán y le ha llegado un aviso. <b>En cuanto te abra, esta pantalla cambia sola</b>: no hace falta recargar.
            </>
          )}
        </p>
        {ok ? (
          <div className="tl-acts">
            <button type="button" className="tl-cta mag" {...mag} onClick={door.walkOut}>
              <span>Salir al campo</span>
              <Icon name="send" size={20} />
            </button>
          </div>
        ) : (
          <>
            {door.pushable === "ready" && (
              <button type="button" className="push mag" {...mag} onClick={() => void door.togglePush()} aria-pressed={door.push} disabled={door.busy === "push"}>
                <span className="lbl">
                  <DIcon name="bell" size={20} />
                  <span>{door.push ? "Te avisaremos en este móvil" : "Avísame cuando me acepten"}</span>
                </span>
                <span className="sw" aria-hidden="true" />
              </button>
            )}
            {door.error && (
              <p className="tl-note warn" role="alert">
                <DIcon name="alert" size={18} />
                <span>{door.error.text}</span>
              </p>
            )}
            <div className="tl-row">
              <button type="button" className="tl-ghost" onClick={door.choose}>
                <Icon name="swap" size={16} />
                Cambiar ficha
              </button>
              <button type="button" className="tl-ghost" onClick={() => void door.cancel()} disabled={door.busy === "send"}>
                <Icon name="x" size={15} />
                Cancelar petición
              </button>
              <button type="button" className="tl-link" onClick={() => void door.exit()}>
                <DIcon name="out" size={16} />
                Salir en este dispositivo
              </button>
            </div>
          </>
        )}
      </div>
      <aside className={`led-card st-board ${ok ? "okd" : "wait"}`} aria-label="Estado de tu petición">
        <div className="bd-top">
          <span className="live">
            <span className="live-dot" />
            ESTADO EN DIRECTO
          </span>
          <span>SIN RECARGAR</span>
        </div>
        <div className="st-who">
          <MiniShirt num={door.me.num || "·"} tone="gold" />
          <div>
            <small>TU FICHA</small>
            <strong>{door.me.name || "SIN FICHA"}</strong>
            <small>{door.user?.displayName}</small>
          </div>
        </div>
        <div className="mw">
          <div className="mw-h">
            <small>EL MURO · TU PERCHA</small>
            <span className="nv">nuevo</span>
          </div>
          <div className="mw-row">
            <span className="stack" aria-hidden="true">
              {inside.map((s) => (
                <MiniShirt key={s.id} num={s.num || "·"} />
              ))}
            </span>
            <span className={`mw-me ${ok ? "lit" : "call"}`}>
              <span className="mw-shirt">
                <MiniShirt num={door.me.num || "·"} tone={ok ? "gold" : "off"} />
              </span>
              <b>
                <i />
                {ok ? "Dentro" : "Llamando"}
              </b>
            </span>
          </div>
        </div>
        <ol className="tline">
          <li className="done">
            <span className="dot">
              <Icon name="check" size={15} />
            </span>
            <div>
              <b>Petición enviada</b>
              <small>Con tu ficha y tu Google</small>
            </div>
            <em>{at ? ago(at) : "HECHO"}</em>
          </li>
          <li className="done">
            <span className="dot">
              <DIcon name="bell" size={15} />
            </span>
            <div>
              <b>Aviso entregado</b>
              <small>Al móvil de los capitanes</small>
            </div>
            <em>HECHO</em>
          </li>
          <li className={ok ? "done" : "now"}>
            <span className="dot">{ok ? <Icon name="check" size={15} /> : <DIcon name="hour" size={15} />}</span>
            <div>
              <b>El capitán decide</b>
              <small>{ok ? "Te ha abierto" : "Un toque y estás dentro"}</small>
            </div>
            <em>{ok ? "HECHO" : "AHORA"}</em>
          </li>
          <li className={ok ? "now" : ""}>
            <span className="dot">
              <DIcon name="door" size={15} />
            </span>
            <div>
              <b>Puerta abierta</b>
              <small>Salida al campo</small>
            </div>
            <em>{ok ? "AHORA" : "DESPUÉS"}</em>
          </li>
        </ol>
        <div className="steward">
          <span className="live-dot" />
          <p>{ok ? <><b>Bienvenido</b>: el vestuario ya es tuyo.</> : <><b>Los capitanes</b> tienen tu petición en el móvil.</>}</p>
          <span className="nv">nuevo</span>
        </div>
      </aside>
    </div>
  );
}

function Rechazada({ door, removed }: { door: Door; removed: boolean }) {
  return (
    <div className="tl-band">
      <div className="tl-copy">
        <p className="tl-k">
          <i />
          {removed ? "Sin acceso · retirado" : "Sin acceso · petición rechazada"}
        </p>
        <H1 a="Puerta" b="cerrada" />
        <p className="tl-lead">
          {removed
            ? "Tu acceso al vestuario se ha retirado. Si crees que es un error, habla con el capitán: te puede volver a abrir."
            : "El capitán no ha aceptado esta vez. Suele ser una ficha equivocada: vuelve a pedir con la tuya o escríbele."}
        </p>
        <div className="tl-acts">
          <button type="button" className="tl-cta mag" {...mag} onClick={door.choose}>
            <span>Volver a pedir</span>
            <DIcon name="replay" size={20} />
          </button>
          <a className="tl-ghost" href={askLink("¿Me abres el vestuario del Manchester Piti?")} target="_blank" rel="noreferrer">
            <DIcon name="chat" size={17} />
            Escribir al capitán
          </a>
        </div>
        <div className="tl-row">
          <button type="button" className="tl-link" onClick={() => void door.exit()}>
            <DIcon name="out" size={16} />
            Salir en este dispositivo
          </button>
          <Link className="tl-link" to="/">
            <DIcon name="back" size={16} />
            Volver a la web
          </Link>
        </div>
      </div>
      <aside className="led-card red plate" aria-label="Estado del acceso">
        <div className="bd-top">
          <span>ESTADO DEL ACCESO</span>
          <span>{removed ? "RETIRADO" : "RECHAZADO"}</span>
        </div>
        <div className="big">
          <span>
            <DIcon name="ban" size={26} />
          </span>
          <div>
            <b>{removed ? "Acceso retirado" : "Petición rechazada"}</b>
            <small>{removed ? "Se cerró en todos tus móviles" : "Puedes volver a pedir cuando quieras"}</small>
          </div>
        </div>
        <p>{removed ? "Ya no ves convocatorias, porra ni tablón. La web pública sigue abierta para todos." : "Tu cuenta de Google no se queda dentro: si vuelves a pedir, empiezas de cero."}</p>
        <div className="steward">
          <MiniShirt num="C" tone="navy" />
          <p>
            Lo más rápido: un mensaje al <b>capitán</b> y vuelves a pedir con la ficha buena.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Bienvenida({ door, take, onReplay }: { door: Door; take: number; onReplay: () => void }) {
  const theme = useDocumentTheme();
  const leave = () => door.finishWelcome();
  return (
    <div className="tl-band bw">
      <div className="tl-copy">
        <p className="tl-k">
          <i />
          Salida al campo · primera vez
        </p>
        <p className="bw-pre">Bienvenido al vestuario,</p>
        <h1 className="tl-h1" id="tl-t">
          <span className="w">
            <em>{door.me.name}</em>
          </span>
        </h1>
        <p className="tl-lead">
          Ya eres de dentro. <b>Tu acceso no caduca</b>: entra desde cualquier móvil con tu Google y sigue ahí hasta que el capitán diga lo contrario.
        </p>
        <div className="tl-acts">
          <button type="button" className="tl-cta mag" {...mag} onClick={leave}>
            <span>Entrar al vestuario</span>
            <Icon name="send" size={20} />
          </button>
          <button type="button" className="tl-ghost" onClick={onReplay}>
            <DIcon name="replay" size={16} />
            Repetir la salida
          </button>
        </div>
        <Meter door={door} roar light />
      </div>
      <div className="tl-copy">
        <div className="bw-kit" role="img" aria-label={`Tu camiseta: ${door.me.name}${door.me.num ? `, dorsal ${door.me.num}` : ""}`}>
          {door.me.num && (
            <span className="ghost" aria-hidden="true">
              {door.me.num}
            </span>
          )}
          <span className="pod" />
          <div className="k3d" key={take}>
            <Jersey3D kit="home" theme={theme} name={door.me.name} num={door.me.num} view="back" reveal zoom={1} lift={0.04} label={`Tu camiseta: ${door.me.name}`} />
          </div>
        </div>
        <div className="nxt">
          {door.next && (
            <Link className="nxt-i" to="/vestuario" onClick={leave} style={{ "--dl": "3.2s" } as CSSProperties}>
              <Icon name="cal" size={18} />
              <b>¿Vas a {door.next.rival}?</b>
              <small>{door.next.when}</small>
            </Link>
          )}
          <Link className="nxt-i" to="/vestuario" onClick={leave} style={{ "--dl": "3.3s" } as CSSProperties}>
            <DIcon name="target" size={18} />
            <b>Tu porra</b>
            <small>Abierta hasta el pitido</small>
          </Link>
          <Link className="nxt-i" to="/vestuario" onClick={leave} style={{ "--dl": "3.4s" } as CSSProperties}>
            <Icon name="shirt" size={18} />
            <b>Tu cartel</b>
            <small>Tu ficha, en 3D</small>
          </Link>
        </div>
      </div>
    </div>
  );
}

// The chosen shirt travels from «¿Quién eres?» to the tunnel walls without re-rendering the page.
type Pick = { name: string; num: string; take: number };
const pickBus = (() => {
  let last: Pick = { name: "", num: "", take: 0 };
  const subs = new Set<(p: Pick) => void>();
  return {
    emit: (p: Pick) => {
      last = p;
      subs.forEach((s) => s(p));
    },
    last: () => last,
    subscribe: (s: (p: Pick) => void) => {
      subs.add(s);
      return () => void subs.delete(s);
    },
  };
})();
function usePicked() {
  const [p, set] = useState(pickBus.last);
  useEffect(() => pickBus.subscribe(set), []);
  return p;
}

function ledFor(door: Door, k: LedKey, picked: Pick): LedTexts {
  const names = door.squad.map((p) => `${p.name}${p.num ? " " + p.num : ""}`);
  const me = door.me.name ? `${door.me.name}${door.me.num ? " " + door.me.num : ""}` : "";
  const mine = picked.name ? `${picked.name}${picked.num ? " " + picked.num : ""}` : "";
  const by = (door.invite?.state === "valid" ? door.invite.by : "El capitán").toUpperCase();
  const inv = door.invite?.state === "valid" ? (door.invite.playerName ?? "NUEVO FICHAJE") : "";
  const L: Record<LedKey, [string, string, string, string]> = {
    puerta: ["SOLO PLANTILLA", "VESTUARIO PRIVADO", "SOLO PLANTILLA", "VESTUARIO"],
    load: ["CONECTANDO", "ABRIENDO GOOGLE", "UN SEGUNDO", "CONECTANDO"],
    inv: [`BIENVENIDO, ${inv}`, `INVITADO POR ${by}`, "PASE VÁLIDO", "BIENVENIDO"],
    cad: ["PASE CADUCADO", "PIDE ACCESO AL CAPITÁN", "PASE CADUCADO", "CADUCADO"],
    quien: ["¿QUIÉN ERES?", door.squad.map((p) => p.num).filter(Boolean).join("  ·  ") || "ELIGE TU CAMISETA", "ELIGE TU CAMISETA", "¿QUIÉN?"],
    pick: [mine, rep(mine, 1), mine, picked.num || picked.name],
    pend: ["EN ESPERA", "EL CAPITÁN TIENE TU PETICIÓN", "EN ESPERA", "EN ESPERA"],
    okd: [`${me}`, "PUERTA ABIERTA", "DENTRO", "DENTRO"],
    rech: ["SIN ACCESO", "PUERTA CERRADA", "SIN ACCESO", "CERRADO"],
    bien: [me, "BIENVENIDO AL VESTUARIO", `SALE ${door.me.name}`, door.me.num || door.me.name],
    cap: ["SALA DE CONTROL", "LA PUERTA", "LA PUERTA", "LA PUERTA"],
    capok: ["PUERTA ABIERTA", "DENTRO", "PUERTA ABIERTA", "DENTRO"],
  };
  const l = L[k];
  const ceil = k === "bien" || k === "pick" || k === "okd" ? Array.from({ length: 3 }, () => [k === "pick" ? picked.name : door.me.name, k === "pick" ? picked.num : door.me.num]).flat().filter(Boolean) : k === "puerta" ? names.slice(0, 8) : [l[0], l[1], l[0], l[1], l[0], l[1]];
  return { a: l[0], a2: l[2], b: l[1], end: l[3], ceil: ceil.length ? ceil : ["MANCHESTER PITI"] };
}

export function AccessGate() {
  const door = useDoor();
  const picked = usePicked();
  const [take, setTake] = useState(0);
  const step = door.step;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const k: LedKey =
    door.busy === "google"
      ? "load"
      : step === "invitacion"
        ? "inv"
        : step === "invitacion-caducada"
          ? "cad"
          : step === "quien-eres"
            ? picked.name
              ? "pick"
              : "quien"
            : step === "pendiente"
              ? "pend"
              : step === "aprobada"
                ? "okd"
                : step === "rechazada"
                  ? "rech"
                  : step === "bienvenida"
                    ? "bien"
                    : "puerta";
  const led = ledFor(door, k, picked);
  const at = { puerta: 0, invitacion: 0, "invitacion-caducada": 0, "quien-eres": 1, pendiente: 2, aprobada: 3, rechazada: 2, bienvenida: 3, dentro: 3 }[step];
  const withInvite = door.invite?.state === "valid";
  const track = [
    ["01", "Puerta"],
    ["02", "Tu ficha"],
    ["03", withInvite ? "Pase" : "Capitán"],
    ["04", "Dentro"],
  ];
  const parallax = {
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const t = e.currentTarget.closest<HTMLElement>(".tl");
      if (!t || e.pointerType !== "mouse") return;
      const r = e.currentTarget.getBoundingClientRect();
      t.style.setProperty("--mx", (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
      t.style.setProperty("--my", (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      const t = e.currentTarget.closest<HTMLElement>(".tl");
      t?.style.removeProperty("--mx");
      t?.style.removeProperty("--my");
    },
  };
  const wall = door.shirts.map((s) => {
    const mineNow = (step === "pendiente" || step === "aprobada") && door.asked?.playerId === s.id;
    const okNow = step === "aprobada" && door.me.num === s.num && door.me.name === s.name;
    return { ...s, in: s.taken || okNow, call: mineNow && !okNow, ok: okNow };
  });
  // Shirts with an owner first, like pegs with a shirt hanging.
  wall.sort((a, b) => Number(b.in) - Number(a.in) || Number(b.call) - Number(a.call));
  const wallIn = wall.filter((w) => w.in).length;

  return (
    <div className="vx tl">
      <CelesteBackdrop />
      <CelesteHeader active="vestuario" sub="Vestuario" actions={<ThemeToggle />} />
      <Tunnel k={k} led={led} take={k === "pick" ? picked.take : take} />
      <div key={`${step}-${take}`} className="tl-wipe wa" aria-hidden="true">
        <i />
      </div>
      <section className="tl-stage" data-p={step} aria-labelledby="tl-t" {...parallax}>
        <div className="tl-hud">
          <ol className="tl-track" aria-label="Pasos para entrar">
            {track.map(([n, label], i) => (
              <li key={n} className={i < at ? "done" : i === at ? "now" : undefined} aria-current={i === at ? "step" : undefined}>
                <b>{i < at ? "HECHO" : i === at ? "AHORA" : n}</b>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </div>
        {door.inviteLoading ? (
          <p className="tl-chip wide" role="status">
            <DIcon name="ticket" size={14} />
            Comprobando tu invitación…
          </p>
        ) : step === "puerta" ? (
          <Puerta door={door} />
        ) : step === "invitacion" ? (
          <Invitacion door={door} />
        ) : step === "invitacion-caducada" ? (
          <Caducada door={door} />
        ) : step === "quien-eres" ? (
          <QuienEres door={door} />
        ) : step === "pendiente" || step === "aprobada" ? (
          <EnLaPuerta door={door} ok={step === "aprobada"} />
        ) : step === "rechazada" ? (
          <Rechazada door={door} removed={door.removed} />
        ) : step === "bienvenida" ? (
          <Bienvenida door={door} take={take} onReplay={() => setTake((t) => t + 1)} />
        ) : null}
      </section>

      <div className="tl-more">
        <Fold id="in-t" kicker="Lo que hay al otro lado" title="Dentro del túnel" sub="Convocatorias, porra, MVP, pizarra, tablón y tu cartel" icon="lock" full>
          <ul className="inside">
            {INSIDE.map((x, i) => (
              <li key={x.k} style={{ "--dl": (i * 0.35).toFixed(2) + "s" } as CSSProperties}>
                <span className="ic">
                  <AnyIcon name={x.ic} size={20} />
                </span>
                <b>{x.k}</b>
                <small>{x.d}</small>
              </li>
            ))}
          </ul>
        </Fold>
        <Fold id="como-t" kicker="Sin contraseña del equipo" title="Cómo se entra" sub="Google, tu camiseta y el capitán abre" icon="route" full>
          <ol className="como">
            {COMO.map(([b, s], i) => (
              <li key={b}>
                <span className="n">0{i + 1}</span>
                <div>
                  <b>{b}</b>
                  <small>{s}</small>
                </div>
              </li>
            ))}
          </ol>
        </Fold>
        {wall.length > 0 && (
          <Fold id="wall-t" kicker="El muro · quién tiene acceso" title="Ya están dentro" sub={`${wallIn} de ${wall.length} camisetas con dueño`} icon="wall" extra={<span className="nv">nuevo</span>}>
            <div className="wall">
              {wall.map((w) =>
                w.in ? (
                  <div key={w.id} className={`peg${w.ok ? " lit" : ""}`}>
                    <ShirtBack name={w.name} num={w.num} scale={0.42} />
                    <b>{w.name}</b>
                    <small>
                      {w.ok && <i />}
                      {w.ok ? "recién" : "dentro"}
                    </small>
                  </div>
                ) : (
                  <div key={w.id} className={`peg free${w.call ? " call" : ""}`}>
                    <span className="hook" aria-hidden="true">
                      {w.num || "·"}
                    </span>
                    <b>{w.name}</b>
                    <small>
                      {w.call && <i />}
                      {w.call ? "Llamando" : "Libre"}
                    </small>
                  </div>
                ),
              )}
            </div>
          </Fold>
        )}
        <Fold id="help-t" kicker="Por si acaso" title="Si algo falla" sub="Ventana de Google, iPhone, móvil prestado" icon="alert">
          <ul className="help">
            <li>
              <span>
                <DIcon name="alert" size={18} />
              </span>
              <div>
                <b>¿Se cerró la ventana de Google?</b> Vuelve a pulsar. Si el navegador la bloquea, permite las ventanas de esta web.
              </div>
            </li>
            <li>
              <span>
                <DIcon name="phone" size={18} />
              </span>
              <div>
                <b>¿App instalada en el iPhone?</b> Google se abre en esta misma ventana y vuelves aquí solo.
              </div>
            </li>
            <li>
              <span>
                <DIcon name="out" size={18} />
              </span>
              <div>
                <b>¿Móvil prestado?</b> «Salir en este dispositivo» cierra solo aquí; en tus otros móviles sigues dentro.
              </div>
            </li>
          </ul>
        </Fold>
      </div>
      <div className={`tl-toast${door.notice ? " on" : ""}`} role="status" aria-live="polite">
        <Icon name="check" size={18} />
        <span>{door.notice}</span>
      </div>
      <CelesteFooter />
      <CelesteDock active="vestuario" />
    </div>
  );
}
