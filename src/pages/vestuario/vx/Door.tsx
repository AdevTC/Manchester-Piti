// /vestuario without a session (and /invitacion/<código>): the fourth room's door (CL- boards, part-vestuario «the door
// (afición)»): the track «1 Puerta · 2 Tu ficha · 3 El capitán · 4 Dentro», the tunnel with its sign and, beside
// it, each step of the real door (acceso/useDoor): Puerta, Con invitación, Invitación caducada, ¿Quién eres?, En la
// puerta (live, it changes by itself when the captain opens), Puerta cerrada and Bienvenida. Shown by AccessGate on
// these addresses; the other private pages keep their LED tunnel.
import { useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDoor } from "../../acceso/useDoor";
import { DevSignIn } from "../../acceso/AccessGate";
import { useDocumentTheme } from "../../../hooks/useDocumentTheme";
import { useShirtStills } from "../../../components/jersey3d/useShirtStills";
import { CelesteDock, CelesteHeader } from "../../../components/celeste/Chrome";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { Bokeh, CREST, I, RoomEnd, RoomHead, Sky, Sprite, Toast } from "../../club/cb/ui";
import { useClubNav } from "../../club/cb/nav";
import "../../../styles/vidrio/tokens.css";
import "../../../styles/vidrio/glass.css";
import "../../../styles/vidrio/components.css";
import "../../../styles/vidrio/reading.css";
import "../../../styles/vidrio/sky.css";
import "../../../styles/vidrio/field.css";
import "../../../styles/club-vidrio.css";

type D = "puerta" | "invitacion" | "caducada" | "quien" | "espera" | "abierta" | "rechazada" | "dentro";
const askLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
const longDay = (ms: number) => {
  const s = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" }).format(ms).replace(",", "");
  return s.charAt(0).toLocaleUpperCase("es") + s.slice(1);
};

export function VestuarioDoor() {
  const door = useDoor();
  const theme = useDocumentTheme();
  const day = theme === "light";
  const navigate = useNavigate();
  const go = useClubNav();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [oname, setOname] = useState("");
  const [hint, setHint] = useState(false);

  const s = door.step;
  const D: D = s === "invitacion" ? "invitacion" : s === "invitacion-caducada" ? "caducada" : s === "quien-eres" ? "quien" : s === "pendiente" ? "espera" : s === "aprobada" ? "abierta" : s === "rechazada" ? "rechazada" : s === "bienvenida" || s === "dentro" ? "dentro" : "puerta";
  const inv = door.invite?.state === "valid" ? door.invite : null;
  const reserved = inv?.playerId ?? null;
  const chosen = pick ?? reserved;
  const chosenShirt = chosen ? door.shirts.find((x) => x.id === chosen) : undefined;
  const stepN = { puerta: 1, invitacion: 1, caducada: 1, quien: 2, espera: 3, abierta: 3, rechazada: 3, dentro: 4 }[D];
  const askedName = door.asked?.playerId ? door.squad.find((x) => x.id === door.asked?.playerId)?.name : (door.asked?.name ?? "");
  const nice = (n: string) => n.charAt(0) + n.slice(1).toLocaleLowerCase("es");
  const reservedShirt = reserved ? door.shirts.find((x) => x.id === reserved) : undefined;
  const nextVas = door.next ? `¿Vas ${door.next.home ? "contra" : "a"} ${door.next.rival}?` : "";
  const TXT: Record<D, [string, string, string, string]> = {
    puerta: ["Túnel de vestuarios · acceso privado", "Solo plantilla", "Al otro lado se cuece el domingo: convocatorias, la porra, el MVP, la pizarra y el tablón. Entras con tu Google y eliges tu camiseta.", "Solo plantilla"],
    invitacion: ["Invitación · pase de túnel", "Te han invitado", `${inv?.by ?? "El capitán"} te ha abierto la puerta del vestuario${reservedShirt?.num ? ` y te ha guardado el ${reservedShirt.num}` : ""}. Entra con tu Google y estás dentro: sin esperar a nadie.`, "Pase de túnel"],
    caducada: ["Invitación · no válida", "Pase caducado", `${door.invite && door.invite.state !== "valid" ? `${door.invite.problem} ` : ""}No pasa nada: pide acceso y el capitán te abre.`, "Pase caducado"],
    quien: ["Paso 2 · tu ficha", "¿Quién eres?", reservedShirt ? `Tu invitación trae el ${reservedShirt.num} reservado: tócalo y entras.` : "Elige tu camiseta. Si no estás en la plantilla, escribe tu nombre: el capitán te hace la ficha.", "¿Quién eres?"],
    espera: ["Petición enviada · en directo", "En la puerta", `Tu petición está con el capitán${askedName ? `, como ${nice(askedName)}` : ""}. Esta pantalla cambia sola cuando abra.`, "En espera"],
    abierta: ["Puerta abierta · en directo", "Estás dentro", "El capitán te ha abierto. Tu percha ya está en el muro: sal al campo cuando quieras.", "Puerta abierta"],
    rechazada: ["Petición · cerrada", "Puerta cerrada", door.removed ? "El capitán te ha quitado el acceso. Si es un error, escríbele." : "El capitán no ha abierto esta vez. Si es un error, escríbele o vuelve a pedirlo.", "Puerta cerrada"],
    dentro: ["Salida al campo · primera vez", `Bienvenido al vestuario, ${nice(door.me.name || "fichaje")}`, `Ya estás dentro.${door.next ? ` Lo primero: ¿vas ${door.next.home ? "contra" : "a"} ${door.next.rival}?` : ""}`, "Bienvenido"],
  };
  const [kicker, h, lead, sign] = TXT[D];

  // the printed stills of the squad (¿Quién eres?) and of the welcome shirt
  const reqs = D === "quien" ? door.shirts.filter((x) => x.num).map((x) => ({ kit: "home" as const, theme, name: x.name, num: x.num })) : D === "dentro" && door.me.num ? [{ kit: "home" as const, theme, name: door.me.name, num: door.me.num }] : [];
  const still = useShirtStills(reqs, { offMainThread: true });
  const query = q.trim().toLowerCase();
  const shirts = door.shirts.filter((x) => !query || x.name.toLowerCase().includes(query) || x.num === query);
  const welcomeSrc = door.me.num ? still({ kit: "home", theme, name: door.me.name, num: door.me.num }) : undefined;
  const send = () => (other ? door.send({ name: oname.trim() }) : chosen ? door.send({ playerId: chosen }) : undefined);
  const canSend = other ? oname.trim().length >= 2 : !!chosenShirt && !chosenShirt.taken;
  const google = (label: string) => (
    <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={() => void door.signIn()} aria-busy={door.busy === "google" || undefined}>
      <I n="arrow" />
      {door.busy === "google" ? "Abriendo Google…" : door.iphone ? "Seguir a Google" : label}
    </button>
  );
  const error = door.error && (
    <p className="cb-small" role="alert">
      {door.error.text}
    </p>
  );

  return (
    <div className={`vx vd-pg cb q-fan s-vestuario${day ? " is-dia" : ""}`} style={{ "--vd-sky-h": "1100px" } as CSSProperties}>
      <Sky day={day} />
      <Bokeh day={day} />
      <Sprite />
      <CelesteHeader active="club" actions={<ThemeToggle />} />
      <main className="cb-main" id="cb-main">
        <div className="cb-room cb-room--vestuario has-door">
          <RoomHead vt="cb-room-vestuario" back={() => go("/club", { out: true, from: "vestuario" })} title="El vestuario" sub="La puerta del equipo. La web pública sigue abierta para todos." />
          <ol className="cb-steps" aria-label="Cómo se entra">
            {[
              ["1", "Puerta"],
              ["2", "Tu ficha"],
              ["3", "El capitán"],
              ["4", "Dentro"],
            ].map(([n, t], i) => (
              <li key={n} className={i + 1 < stepN ? "is-done" : i + 1 === stepN ? "is-now" : undefined}>
                <span className="cb-steps__n" aria-hidden="true">
                  {n}
                </span>
                <span className="cb-steps__t">{t}</span>
                {i + 1 === stepN && <span className="vd-vh">, ahora</span>}
              </li>
            ))}
          </ol>

          <div className="cb-door">
            <div className={`cb-tunnel is-${D === "abierta" ? "espera" : D}`} aria-hidden="true">
              <span className="cb-tunnel__arch" />
              <span className="cb-tunnel__floor" />
              <span className="cb-tunnel__light" />
              <p className="cb-tunnel__sign">{sign}</p>
            </div>

            <div className="cb-door__txt">
              <p className="cb-door__k">{kicker}</p>
              <h3 className="cb-door__h">{h}</h3>
              <p className="cb-door__lead">{lead}</p>

              {D === "puerta" && (
                <>
                  <div className="cb-row-acts">
                    {google("Entrar con Google")}
                    <button type="button" className="vd-glass vd-press vd-btn" onClick={() => setHint(!hint)} aria-expanded={hint}>
                      Tengo una invitación
                    </button>
                  </div>
                  {hint && <p className="cb-small">Abre el enlace que te pasó el capitán: te trae aquí con tu pase y entras sin esperar.</p>}
                  {error}
                  <ul className="cb-chips">
                    <li>Sin contraseña del equipo</li>
                    <li>No caduca</li>
                    <li>Una cuenta, una ficha</li>
                  </ul>
                  <div className="cb-inside">
                    <h4>Dentro del túnel</h4>
                    <ul>
                      <li>
                        <I n="check" className={null} />
                        La convocatoria: ¿vas o no vas?
                      </li>
                      <li>
                        <I n="euro" className={null} />
                        La caja y «Ya la he pagado»
                      </li>
                      <li>
                        <I n="poll" className={null} />
                        Encuestas, entrenos y turnos
                      </li>
                      <li>
                        <I n="star" className={null} />
                        La porra, el MVP y tu carta
                      </li>
                    </ul>
                    {door.inside !== null && <p className="cb-inside__n">{door.inside === 1 ? "1 compañero ya tiene" : `${door.inside} compañeros ya tienen`} acceso. Quién va y quién no, solo dentro.</p>}
                  </div>
                </>
              )}

              {D === "invitacion" && inv && (
                <>
                  <div className="cb-ticket">
                    <div className="cb-ticket__top">
                      <img src={CREST} alt="" width={28} height={28} />
                      <b>Pase de túnel · invitación</b>
                    </div>
                    <dl>
                      <div>
                        <dt>Ficha reservada</dt>
                        <dd>{reservedShirt ? `${nice(reservedShirt.name)} · ${reservedShirt.num}` : "Eliges al entrar"}</dd>
                      </div>
                      <div>
                        <dt>Invita</dt>
                        <dd>{inv.by}</dd>
                      </div>
                      <div>
                        <dt>Válida hasta</dt>
                        <dd>{longDay(inv.expiresAt)}</dd>
                      </div>
                      <div>
                        <dt>Acceso</dt>
                        <dd>Sin esperas</dd>
                      </div>
                    </dl>
                  </div>
                  <p className="cb-door__chip">El enlace es personal: si no es para ti, pídele otro al capitán.</p>
                  <div className="cb-row-acts">
                    {google("Entrar con Google")}
                    <button type="button" className="vd-link" onClick={() => void navigate({ to: "/vestuario" })}>
                      Volver
                    </button>
                  </div>
                  {error}
                </>
              )}
              {door.inviteLoading && D === "puerta" && <p className="cb-small">Comprobando tu invitación…</p>}

              {D === "caducada" && (
                <>
                  <div className="cb-ticket cb-ticket--torn">
                    <div className="cb-ticket__top">
                      <img src={CREST} alt="" width={28} height={28} />
                      <b>Pase de túnel</b>
                    </div>
                    <p className="cb-ticket__stamp">Caducada</p>
                  </div>
                  <div className="cb-row-acts">
                    {door.user ? (
                      <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={door.choose}>
                        Pedir acceso
                      </button>
                    ) : (
                      google("Pedir acceso con Google")
                    )}
                    <a className="vd-link" href={askLink("Hola, mi invitación al vestuario del Manchester Piti ha caducado. ¿Me pasas otra?")} target="_blank" rel="noopener noreferrer">
                      Pedir otro enlace
                    </a>
                  </div>
                  {error}
                </>
              )}

              {D === "quien" && (
                <>
                  <p className="cb-acctrow">
                    <span className="cb-acctrow__ava" aria-hidden="true">
                      {(door.user?.displayName || door.user?.email || "?").charAt(0).toLocaleUpperCase("es")}
                    </span>
                    {door.user?.email || door.user?.displayName || "Tu cuenta de Google"}
                    <button type="button" className="vd-link" onClick={() => void door.exit()}>
                      Salir
                    </button>
                  </p>
                  <label className="cb-search">
                    <span className="vd-label">Busca tu nombre o dorsal</span>
                    <input className="vd-input" type="search" value={q} onChange={(e) => setQ(e.currentTarget.value)} placeholder="Nombre o dorsal" autoComplete="off" />
                  </label>
                  {door.suggestion && !inv && !pick && !query && (
                    <p className="cb-suggest">
                      ¿Eres {nice(door.suggestion.name)}? Tu nombre de Google se parece.{" "}
                      <button type="button" className="vd-link" onClick={() => setPick(door.suggestion?.id ?? null)}>
                        Soy yo
                      </button>
                    </p>
                  )}
                  <ul className="cb-shirts" aria-label="Elige tu camiseta">
                    {shirts.map((x) => {
                      const on = !other && chosen === x.id;
                      const res = reserved === x.id;
                      const src = x.num ? still({ kit: "home", theme, name: x.name, num: x.num }) : undefined;
                      return (
                        <li key={x.id}>
                          <button
                            type="button"
                            className={["cb-shirt", x.taken ? "is-taken" : "", on ? "is-on" : "", res ? "is-res" : ""].filter(Boolean).join(" ")}
                            aria-pressed={on}
                            disabled={x.taken}
                            onClick={() => {
                              setOther(false);
                              setPick(x.id);
                            }}
                            aria-label={`${nice(x.name)}${x.num ? `, dorsal ${x.num}` : ", sin dorsal"}${x.taken ? ", ocupada" : res ? ", reservada para ti" : ", libre"}`}
                          >
                            {src ? <img className="cb-shirt__img" src={src} alt="" width={540} height={600} loading="lazy" /> : <span className="cb-shirt__img" />}
                            <b>{nice(x.name)}</b>
                            <span>{x.taken ? "Ocupada" : res ? "Reservada para ti" : on ? "Tu ficha" : "Libre"}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {shirts.length === 0 && <p className="cb-empty">Nadie con «{q}». ¿Eres nuevo? Pulsa «No estoy en la plantilla».</p>}
                  {other && (
                    <label className="cb-search">
                      <span className="vd-label">Nombre que verá el equipo</span>
                      <input className="vd-input" type="text" value={oname} onChange={(e) => setOname(e.currentTarget.value.slice(0, 24))} placeholder="Tu nombre" autoComplete="off" />
                    </label>
                  )}
                  <div className="cb-row-acts">
                    <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={() => void send()} disabled={!canSend || door.busy === "send"}>
                      {door.busy === "send" ? "Enviando…" : inv && chosen === reserved && !other ? "Entrar" : inv ? "Entrar" : "Pedir acceso"}
                    </button>
                    <button type="button" className="vd-link" onClick={() => setOther(true)} aria-pressed={other}>
                      No estoy en la plantilla
                    </button>
                  </div>
                  {error}
                </>
              )}

              {(D === "espera" || D === "abierta") && (
                <>
                  <ol className="cb-tl" aria-label="Tu petición">
                    <li className="is-done">Petición enviada</li>
                    <li className="is-done">Aviso entregado al capitán</li>
                    <li className={D === "abierta" ? "is-done" : "is-now"}>El capitán decide</li>
                    <li className={D === "abierta" ? "is-now" : undefined}>Puerta abierta</li>
                  </ol>
                  {D === "abierta" ? (
                    <div className="cb-row-acts">
                      <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={door.walkOut}>
                        Salir al campo
                      </button>
                    </div>
                  ) : (
                    <>
                      {door.pushable === "ready" && (
                        <button type="button" className="vd-switch" role="switch" aria-checked={door.push} onClick={() => void door.togglePush()} disabled={door.busy === "push"}>
                          <span className="vd-switch__track" aria-hidden="true">
                            <span className="vd-switch__knob" />
                          </span>
                          {door.push ? "Te avisaremos en este móvil" : "Avísame cuando me acepten"}
                        </button>
                      )}
                      <div className="cb-row-acts">
                        <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={door.choose}>
                          Cambiar ficha
                        </button>
                        <button type="button" className="vd-link" onClick={() => void door.cancel()}>
                          Cancelar petición
                        </button>
                        <button type="button" className="vd-link" onClick={() => void door.exit()}>
                          Salir en este dispositivo
                        </button>
                      </div>
                    </>
                  )}
                  {error}
                </>
              )}

              {D === "rechazada" && (
                <>
                  <div className="cb-plate">
                    <b>{door.removed ? "Acceso retirado" : "Petición rechazada"}</b>
                    <span>Ya no ves convocatorias, porra ni tablón. La web pública sigue abierta para todos.</span>
                  </div>
                  <div className="cb-row-acts">
                    <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={door.choose}>
                      Volver a pedir
                    </button>
                    <a className="vd-link" href={askLink("Hola, he pedido entrar al vestuario del Manchester Piti y no me ha llegado. ¿Me abres?")} target="_blank" rel="noopener noreferrer">
                      Escribir al capitán
                    </a>
                  </div>
                </>
              )}

              {D === "dentro" && (
                <>
                  <div className="cb-welcome">
                    {welcomeSrc ? (
                      <img className="cb-welcome__kit" src={welcomeSrc} alt={`Tu camiseta: ${nice(door.me.name)}${door.me.num ? `, dorsal ${door.me.num}` : ""}`} width={540} height={600} />
                    ) : (
                      <span className="cb-welcome__kit" role="img" aria-label={`Tu camiseta: ${nice(door.me.name)}`} />
                    )}
                    <p>Ya eres de dentro. Tu acceso no caduca: entras con tu Google desde cualquier móvil.</p>
                  </div>
                  <div className="cb-row-acts">
                    <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={door.finishWelcome}>
                      Entrar al vestuario
                    </button>
                  </div>
                  <ul className="cb-next">
                    {door.next && (
                      <li>
                        {nextVas} <span>{door.next.when}</span>
                      </li>
                    )}
                    <li>
                      Tu porra <span>Abierta hasta el pitido</span>
                    </li>
                    <li>
                      Tu cartel <span>Tu ficha, en 3D</span>
                    </li>
                  </ul>
                </>
              )}
              <DevSignIn />
            </div>
          </div>
          <RoomEnd label="Volver" title="El club" line="La vitrina y las cuatro puertas" go={() => go("/club", { out: true, from: "vestuario" })} />
        </div>
      </main>
      <CelesteDock active="club" />
      <Toast say={door.notice} on={!!door.notice} />
    </div>
  );
}
