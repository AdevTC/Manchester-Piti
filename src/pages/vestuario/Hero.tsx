import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { dateMillis } from "../../lib/clubData";
import type { ClubMatch } from "../../lib/clubData";
import { apiError, requestPlayerClaim, setAvailability } from "../../lib/clubApi";
import { shareClubPage } from "../../lib/share";
import { calledUp, countdown, greeting, initials, kickoffLabel, MIN_PLAYERS, slotParts, slotTime } from "../../lib/vestuario";
import { Jersey3D, type Jersey3DRef } from "../../components/jersey3d/Jersey3D";
import { Jersey } from "../../components/Jersey";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { matchEvent } from "../../lib/home";
import type { Availability, Claim } from "./live";
import { Icon } from "../../components/celeste/icons";

export interface Me {
  uid: string;
  displayName: string;
  shirtName: string;
  number: string;
  playerId?: string;
}
interface Props {
  me: Me;
  seasonName: string;
  next: ClubMatch | undefined;
  meetingNote: string;
  availability: Availability[];
  now: number;
  theme: "dark" | "light";
  faceName: (a: Availability) => string;
  claim: Claim | null;
  claimable: Ficha[];
  suggestion: Ficha | null;
  admin: boolean;
  /** Admin-only "Modo capitán" strip, shown above the poster. */
  captain?: ReactNode;
  /** Next confirmed training, if any. */
  training?: { at: number; end?: number; place: string };
}
export interface Ficha {
  id: string;
  label: string;
  name: string;
  number: string;
}
const KIT_LABEL = { home: "1ª equipación", away: "2ª equipación" } as const;
const RSVP = [
  { value: "yes", label: "Voy" },
  { value: "maybe", label: "Duda" },
  { value: "no", label: "No puedo" },
] as const;

export function Hero({ me, seasonName, next, meetingNote, availability, now, theme, faceName, claim, claimable, suggestion, admin, captain, training }: Props) {
  const shirt = useRef<Jersey3DRef>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Opens on the next match's kit; the player can try the other one on.
  const [kitPick, setKitPick] = useState<"home" | "away" | null>(null);
  const kit = kitPick ?? next?.kit ?? "home";
  const mine = availability.find((a) => a.uid === me.uid)?.response;
  const answer = pending ?? mine;
  const going = availability.filter((a) => a.response === "yes");
  const open = !!next && dateMillis(next.date) > now;
  const stamp = calledUp(next, me.playerId) ? "CONVOCADO" : answer === "yes" && open ? "CONFIRMADO" : null;
  const nameScale = Math.min(1, 6 / Math.max(6, me.displayName.length));
  const answerIndex = RSVP.findIndex((r) => r.value === answer);

  const respond = async (value: string) => {
    if (!next) return;
    setPending(value);
    setError("");
    try {
      await setAvailability({ matchId: next.id, response: value });
    } catch (e) {
      setError(apiError(e));
    } finally {
      setPending(null);
    }
  };
  return (
    <section className="vx-hero" aria-label="Tu cartel del partido">
      {captain}
      <div className="vx-hero-in">
        <div className="vx-poster">
          <div className={`vx-num${me.number ? "" : " q"}`} data-digits={(me.number || "?").length} aria-hidden="true">
            {me.number || "?"}
          </div>
          <div className="vx-meta-l">
            <b>{me.number ? `Nº ${me.number}` : "Sin dorsal"}</b>
            {seasonName}
            <br />
            {KIT_LABEL[kit]}
            <br />
            {greeting(now)}
          </div>
          <div className="vx-vert" aria-hidden="true">
            MANCHESTER PITI · MATCHDAY
          </div>
          <Jersey3D
            ref={shirt}
            className="vx-shirt"
            kit={kit}
            theme={theme}
            name={me.shirtName}
            num={me.number}
            zoom={0.84}
            lift={0.3}
            label={`Tu camiseta: ${me.shirtName || me.displayName}${me.number ? `, dorsal ${me.number}` : ""}, ${KIT_LABEL[kit]}. Arrástrala o usa las flechas para girarla.`}
          />
          {stamp ? (
            <span className="vx-stamp">
              <Icon name="check" size={16} stroke={3.2} />
              {stamp}
            </span>
          ) : (
            !me.number && (
              <span className="vx-hint">
                <Icon name="shirt" size={15} stroke={2} />
                Tu dorsal, al vincular tu ficha
              </span>
            )
          )}
          <div className="vx-kit" role="group" aria-label="Equipación">
            <button type="button" aria-pressed={kit === "home"} onClick={() => setKitPick("home")}>
              1ª
            </button>
            <button type="button" aria-pressed={kit === "away"} onClick={() => setKitPick("away")}>
              2ª
            </button>
          </div>
          <button type="button" className="vx-photo" onClick={() => shirt.current?.turn()}>
            <Icon name="turn" size={14} />
            Gírala
          </button>
        </div>
        <div className="vx-hero-text">
          <h1 className="vx-name" style={{ ["--vx-name-k" as string]: nameScale }}>
            {me.displayName}
          </h1>
          <div className="vx-hero-copy">
            {next ? (
              <>
                <p className="vx-epic">
                  {kickoffLabel(next.date)}. {next.rival}.{" "}
                  <em>
                    {answer === "no"
                      ? "Esta vez te toca animar."
                      : me.number
                        ? `El ${me.number} vuelve a salir al campo.`
                        : "Vuelves a salir al campo."}
                  </em>
                </p>
                <p className="vx-count">
                  {open ? (
                    <>
                      Faltan <b>{countdown(dateMillis(next.date), now)}</b>
                    </>
                  ) : (
                    <b>En juego</b>
                  )}{" "}
                  · {next.venue || "Campo por confirmar"}
                  {meetingNote ? ` · ${meetingNote}` : ""}
                </p>
                {open && (
                  <div className="vx-rsvp" id="vx-rsvp" role="radiogroup" aria-label="Tu respuesta a la convocatoria">
                    {answerIndex >= 0 && <span className="vx-rsvp-thumb" style={{ transform: `translateX(${answerIndex * 100}%)` }} />}
                    {RSVP.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={answer === r.value}
                        disabled={pending !== null}
                        onClick={() => void respond(r.value)}
                      >
                        {answer === r.value && <Icon name="check" size={15} stroke={3} />}
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
                {error && (
                  <p className="vx-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="vx-hero-actions">
                  <button
                    type="button"
                    className="vx-ghost"
                    onClick={() => void shareClubPage("partido", next.id, `Manchester Piti vs ${next.rival}`).catch(() => {})}
                  >
                    <Icon name="share" size={17} />
                    Compartir mi cartel
                  </button>
                  <AddToCalendar className="vx-ghost" label="Al calendario" event={matchEvent(next, location.origin)} />
                </div>
                <div className="vx-attend">
                  {going.length > 0 && (
                    <div className="vx-faces" aria-hidden="true">
                      {going.slice(0, 4).map((a, i) => (
                        <span key={a.uid} className={`vx-face ${["g-sky", "g-gold", "g-grey"][i % 3]}`}>
                          {initials(faceName(a))}
                        </span>
                      ))}
                      {going.length > 4 && <span className="vx-face more">+{going.length - 4}</span>}
                    </div>
                  )}
                  <span>
                    <b>
                      {going.length === 0
                        ? "Nadie ha confirmado todavía."
                        : mine === "yes"
                          ? `Contigo, ${going.length}.`
                          : `${going.length} ${going.length === 1 ? "confirmado" : "confirmados"}.`}
                    </b>{" "}
                    {going.length >= MIN_PLAYERS ? "Hay partido." : `Con ${MIN_PLAYERS} hay partido.`}
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="vx-epic">
                  {me.playerId ? (
                    <>
                      Sin partido a la vista. <em>Tu cartel se actualiza solo en cuanto se publique el próximo.</em>
                    </>
                  ) : (
                    <>
                      Bienvenido al vestuario. <em>Tu cartel está a un paso.</em>
                    </>
                  )}
                </p>
                <p className="vx-count">
                  Sin partido a la vista · <b>{admin ? "publícalo desde el modo capitán" : "el capitán lo publicará aquí"}</b>
                </p>
              </>
            )}
            {training && (
              <a className="vx-train-chip" href="#vx-train">
                <Icon name="cal" size={16} stroke={2.2} />
                <span>
                  Entreno confirmado · <b>{slotParts(training.at).day} {slotParts(training.at).date}, {slotTime(training)}</b>
                  {training.place ? ` · ${training.place}` : ""}
                </span>
              </a>
            )}
            {!me.playerId && <FichaCard claim={claim} claimable={claimable} suggestion={suggestion} admin={admin} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function FichaCard({ claim, claimable, suggestion, admin }: { claim: Claim | null; claimable: Ficha[]; suggestion: Ficha | null; admin: boolean }) {
  const pending = claim?.status === "pending";
  const offer = suggestion && !pending ? suggestion : null;
  const [picking, setPicking] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const claimFicha = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await requestPlayerClaim({ playerId: id });
      setPicking(false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void claimFicha(playerId);
  };
  const showPicker = picking || (!offer && !pending);
  return (
    <div className="vx-ficha" id="vx-ficha" tabIndex={-1} role={pending ? "status" : undefined}>
      <span className="k">
        {pending ? "Solicitud enviada" : claim?.status === "rejected" ? "Tu última solicitud no se aprobó" : "Primer paso · recomendado"}
      </span>
      <h2>{pending ? "Tu ficha, en revisión" : "Vincula tu ficha"}</h2>
      <p>
        {pending
          ? `Has pedido la ficha de ${claim.playerName}. En cuanto un administrador la apruebe, tu cartel llevará tu nombre y tu dorsal.`
          : "Tu nombre y tu dorsal se imprimen en la camiseta y aparecen tus números, tu vitrina y tu mejor socio."}
      </p>
      {offer && !picking && (
        <>
          <div className="vx-sug">
            <span className="mini" aria-hidden="true">
              <Jersey name={offer.name} number={offer.number} size="sm" />
            </span>
            <span className="w">
              <span>Se parece a tu nombre</span>
              <b>{offer.label}</b>
            </span>
          </div>
          <div className="vx-row">
            <button type="button" className="vx-yes" disabled={busy} onClick={() => void claimFicha(offer.id)}>
              <Icon name="check" size={16} stroke={3} />
              {busy ? "Vinculando…" : "Sí, es mi ficha"}
            </button>
            <button type="button" className="vx-other" onClick={() => setPicking(true)}>
              Elegir otra
              <Icon name="down" size={14} stroke={2.2} />
            </button>
          </div>
        </>
      )}
      {pending && !picking && (
        <div className="vx-row">
          <button type="button" className="vx-other" onClick={() => setPicking(true)}>
            No es esa, elegir otra
          </button>
        </div>
      )}
      {showPicker && (
        <form className="vx-row" onSubmit={submit}>
          <label className="vx-sr" htmlFor="vx-claim-player">
            Tu ficha de jugador
          </label>
          <select id="vx-claim-player" value={playerId} onChange={(e) => setPlayerId(e.target.value)} required>
            <option value="">Elige tu nombre</option>
            {claimable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button className="vx-yes" disabled={!playerId || busy}>
            {busy ? "Vinculando…" : "Es mi ficha"}
          </button>
          {(offer || pending) && (
            <button type="button" className="vx-link-btn" onClick={() => setPicking(false)}>
              Cancelar
            </button>
          )}
        </form>
      )}
      {error && (
        <p className="vx-error" role="alert">
          {error}
        </p>
      )}
      {!pending && (
        <small>{admin ? "Como capitán, se vincula al instante." : "La aprueba un administrador. Mientras tanto, todo el vestuario funciona igual."}</small>
      )}
    </div>
  );
}
