// /perfil «Tu carta» (TU boards shell.html isCarta): the big card beside what it says.
//   · a player: his rating and tier in one line, the tiers, his estreno (the next match's convocatoria, answered
//     here) while the card has no numbers, the six numbers, the eight evoluciones and his ficha's public page;
//   · a new account: pick a dorsal among the free fichas (their printed shirts) and ask the captain, or his request;
//   · a socio: his carné, what is his in the vestuario and «¿Juegas en el Piti?».
// One primary action (Compartir mi carta) and «Más».
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { TuIcon, Seg } from "../../../../components/vidrio/tu/ui";
import { setAvailability as setAvisoAvailability, useMe } from "../../../vestuario/writes";
import { TIERS } from "../../card";
import { copyText } from "../../fxRuntime";
import { Shirt, type CardModel } from "../TuCard";
import { secDesc, secLabel, pl } from "../model";
import type { ScreenProps } from "../MiPagina";
import { wantedNumber } from "../view";
import { matchDay, matchTime } from "../../lines";
import { Screen, type Act } from "./Head";
import type { MenuItem } from "../../../../components/vidrio/tu/ui";

/** The tier's reason, as the board words it. */
const WHY: Record<string, string> = { oro: "Valoración de 80 o más", plata: "Valoración entre 65 y 79", bronce: "Valoración por debajo de 65", racha: "Gol o asistencia en las 3 últimas" };
const TIER_RULE: Record<string, string> = { bronce: "Valoración menos de 65", plata: "De 65 a 79", oro: "80 o más", racha: "Gol o asistencia en las 3 últimas" };
const RSVP: { v: "yes" | "maybe" | "no"; t: string }[] = [
  { v: "yes", t: "Voy" },
  { v: "maybe", t: "Duda" },
  { v: "no", t: "No voy" },
];
const ANSWERED = { yes: "Has dicho que vas.", maybe: "Has dicho que tienes duda.", no: "Has dicho que no vas." };

export function Carta(p: ScreenProps & { cardNode: ReactNode; card: CardModel }) {
  const { data, who, go, say, card } = p;
  const navigate = useNavigate();
  const me = useMe();
  const [evoAll, setEvoAll] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rsvp, setRsvp] = useState<"yes" | "maybe" | "no" | null>(null);
  const c = data.card;
  const pid = data.ficha.playerId;
  const share = () => go({ page: "perfil", sec: "carta", open: "compartir" });
  const copyPage = async () => {
    const ok = await copyText(`${p.origin}/jugadores/${pid ?? ""}`);
    say(ok ? "Enlace a tu página copiado." : "No se ha podido copiar el enlace.");
  };

  let act: Act | null = null;
  let more: MenuItem[] = [];
  if (card.kind === "face") {
    act = { t: "Compartir mi carta", icon: "share", go: share };
    more = [
      { t: p.flip ? "Ver el frente" : "Ver el dorso: tu carné", icon: "flip", go: () => p.setFlip(!p.flip) },
      { t: "Repetir la salida de la carta", icon: "replay", go: p.replay },
      { t: "Abrir mi página pública", icon: "arrow", go: () => void navigate({ to: "/jugadores/$playerId", params: { playerId: pid ?? "" } }) },
      { t: "Copiar el enlace de mi página", icon: "copy", go: () => void copyPage() },
    ];
  } else if (card.kind === "pack") {
    more = [
      { t: "Mi póster de fichaje", icon: "share", go: share },
      { t: "Hablar con el capitán", icon: "door", go: () => void navigate({ to: "/vestuario" }) },
      {
        t: "Cancelar la petición",
        icon: "close",
        go: () =>
          void p.actions
            .cancelClaim()
            .then(() => say("Petición cancelada. Puedes pedir otra carta cuando quieras."))
            .catch(() => say("No se ha podido cancelar la petición. Inténtalo otra vez.")),
      },
    ];
  } else if (card.kind === "down") {
    more = [
      { t: "Mi póster de socio", icon: "share", go: share },
      { t: "No estoy en la plantilla", icon: "door", go: () => void navigate({ to: "/vestuario" }) },
    ];
  } else {
    more = [
      {
        t: "Copiar el enlace del club",
        icon: "copy",
        go: () => void copyText(`${p.origin}/club`).then((ok) => say(ok ? `Enlace copiado: ${p.origin.replace(/^https?:\/\//, "")}/club` : "No se ha podido copiar el enlace.")),
      },
    ];
  }

  // ── the estreno: a card without numbers yet, the next match to play
  const started = c.started;
  const rated = card.kind === "face" && c.showNumbers && c.rating !== null;
  const nx = data.next;
  const answer = rsvp ?? data.stuff.convocatorias.next;
  const estreno = card.kind === "face" && !rated && started && nx;
  const pickRsvp = (v: "yes" | "maybe" | "no") => {
    if (!me || !nx) return;
    setRsvp(v);
    setAvisoAvailability(me, nx.id, v)
      .then(() => say({ yes: "Apuntado: vas.", maybe: "Apuntado: tienes duda.", no: "Apuntado: no vas." }[v] + " El capitán ya lo ve."))
      .catch(() => {
        setRsvp(null);
        say("No se ha guardado tu respuesta. Inténtalo otra vez.");
      });
  };
  const why = rated
    ? `${WHY[c.tier ?? "bronce"]}. Sale de tus partidos, goles, asistencias, minutos y MVP: la misma que ve el capitán en la pizarra.`
    : !started
      ? c.first
        ? `La ${data.seasonName} aún no ha empezado: tus números salen en la J1, el ${matchDay(c.first.dateMs)} contra ${c.first.rival}.`
        : `La ${data.seasonName} aún no ha empezado: tus números salen en la J1.`
      : `Tus números salen con tu primer partido.${c.last5.length ? ` La ${c.last5[c.last5.length - 1].j} la viste desde fuera.` : ""}`;

  // ── the evoluciones
  const evo = c.evo;
  const next = evo.find((e) => !e.done) ?? null;
  const done = evo.filter((e) => e.done).length;

  // ── a dorsal to ask for
  const free = data.freeFichas;
  const claim = async () => {
    if (!picked || busy) return;
    setBusy(true);
    try {
      const r = await p.actions.requestClaim(picked);
      say(r.linked ? "¡Carta revelada! Tu ficha está vinculada." : "Petición enviada al capitán. Te avisamos en cuanto conteste.");
      setPicked(null);
    } catch {
      say("No se ha podido enviar la petición. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  };
  const pickGrid = (small: boolean) => (
    <div className={`tu-pick${small ? " tu-pick--sm" : ""}`} role="group" aria-label="Fichas libres de la plantilla">
      {free.map((f) => {
        const on = picked === f.id;
        return (
          <button key={f.id} type="button" className={`tu-pick__b${on ? " is-on" : ""}`} aria-pressed={on} aria-label={`${f.name}, dorsal ${f.number}, ${f.posLong ?? "sin posición"}${on ? ", elegida" : ""}`} onClick={() => setPicked(on ? null : f.id)}>
            <Shirt num={f.number} className="tu-pick__img" />
            <b>{f.name}</b>
            <small>{f.posLong ?? `Dorsal ${f.number}`}</small>
            <span className="tu-pick__ok" aria-hidden="true">
              <TuIcon name="check" />
            </span>
          </button>
        );
      })}
    </div>
  );
  const claimRow = (
    <div className="tu-row">
      <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" aria-disabled={!picked || busy} onClick={() => void claim()}>
        <TuIcon name="shirt" />
        {picked ? `Pedir la carta del ${free.find((f) => f.id === picked)?.number ?? ""}` : "Elige una carta"}
      </button>
    </div>
  );
  const wanted = data.shirt.squad.find((s) => s.id === (data.ficha.claim?.playerId ?? data.ficha.playerId));
  const rejected = data.ficha.rejectedPlayerId ? data.shirt.squad.find((s) => s.id === data.ficha.rejectedPlayerId) : null;
  const porra = data.stuff.porra;

  return (
    <Screen title={secLabel("carta", who.kind)} desc={secDesc("carta", who.kind, card.kind === "pack")} act={act} more={more}>
      <div className="tu-carta">
        <div className="tu-hero">
          <div className="tu-hero__card">{p.cardNode}</div>
          <p className="tu-hero__hint">{card.kind === "face" ? "Toca la carta para darle la vuelta" : card.kind === "down" ? "Toca la carta para elegir tu dorsal" : ""}</p>
        </div>
        <div className="tu-carta__main">
          {card.kind === "face" && (
            <>
              <section className="tu-rate" aria-labelledby="tu-rate-t">
                <div className="tu-rate__n">
                  {rated && <b>{c.rating}</b>}
                  <span id="tu-rate-t">{rated ? `Carta ${c.tierName.toLowerCase()}` : "Carta nueva"}</span>
                </div>
                <div className="tu-rate__t">
                  <p>{why}</p>
                  <ul className="tu-tiers2" aria-label="Tipos de carta">
                    {TIERS.map((t) => (
                      <li key={t.k} className={`t-${t.k}${rated && c.tier === t.k ? " is-mine" : ""}`}>
                        <i aria-hidden="true" />
                        <b>{t.label}</b>
                        <small>{TIER_RULE[t.k]}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
              {estreno && (
                <section className="tu-call" aria-labelledby="tu-call-t">
                  <div>
                    <h3 className="tu-h3" id="tu-call-t">
                      ¿Vas el {matchDay(nx.dateMs)} a {nx.rival}?
                    </h3>
                    <p className="tu-blk__d">
                      Tu estreno puede ser la J{nx.j ?? ""}: {matchTime(nx.dateMs)}
                      {nx.home === null ? "" : nx.home ? ", en casa" : ", fuera"}.{answer ? ` ${ANSWERED[answer]}` : ""}
                    </p>
                  </div>
                  <Seg opts={RSVP} value={answer} onPick={pickRsvp} labelledBy="tu-call-t" bead={!!answer} />
                </section>
              )}
              <section className="tu-blk" aria-labelledby="tu-num-t">
                <h3 className="tu-h3" id="tu-num-t">
                  Los seis números
                </h3>
                <ul className="tu-six">
                  {c.attrs.map((a) => (
                    <li key={a.k}>
                      <span className="tu-six__k">{a.k}</span>
                      <b className="tu-six__v">{a.text}</b>
                      <span className="tu-six__l">{a.label}</span>
                      <span className="tu-bar" role="img" aria-label={`${a.label}: ${a.text}`}>
                        <i style={{ width: `${Math.round((a.value === null ? 0 : Math.max(0.04, Math.min(1, a.p))) * 100)}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="tu-blk" aria-labelledby="tu-evo-t">
                <div className="tu-blk__hd">
                  <h3 className="tu-h3" id="tu-evo-t">
                    Evoluciones
                  </h3>
                  <span className="tu-small">
                    {done} de {evo.length}
                  </span>
                </div>
                {next && (
                  <div className="tu-next">
                    <span>
                      <small>Lo próximo para tu carta</small>
                      <b>{next.k}</b>
                      <span>
                        {next.d}. Premio: {next.reward}.
                      </span>
                    </span>
                    <span className="tu-next__p">
                      <span className="tu-bar" role="img" aria-label={`${next.k}: ${next.cur} de ${next.goal}`}>
                        <i style={{ width: `${Math.max(4, next.pct)}%` }} />
                      </span>
                      <small>
                        {next.cur} de {next.goal}
                      </small>
                    </span>
                  </div>
                )}
                <ul className="tu-evo8" aria-label="Las ocho evoluciones">
                  {evo.map((e) => (
                    <li key={e.id} className={`s-${e.shape}${e.done ? " is-done" : ""}`} aria-label={`${e.k}: ${e.done ? "conseguida" : `${e.cur} de ${e.goal}`}. Premio: ${e.reward}`}>
                      <span className={`tu-aw s-${e.shape}${e.done ? " is-done" : ""}`} aria-hidden="true" />
                      <b>{e.k}</b>
                      <small>{e.done ? "Conseguida" : `${e.cur} de ${e.goal}`}</small>
                    </li>
                  ))}
                </ul>
                <button type="button" className="tu-disc" aria-expanded={evoAll} onClick={() => setEvoAll(!evoAll)}>
                  {evoAll ? "Ocultar el detalle" : "Ver qué da cada una"}
                  <TuIcon name="chev-r" />
                </button>
                {evoAll && (
                  <ul className="tu-evol">
                    {evo.map((e) => (
                      <li key={e.id}>
                        <b>{e.k}</b>
                        <span>
                          {e.d} · premio: {e.reward}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <p className="tu-small tu-ficha">
                Tu ficha: {[`Dorsal ${c.number}`, c.posLong, data.shirt.fullName].filter(Boolean).join(" · ")} ·{" "}
                <Link className="vd-link" to="/jugadores/$playerId" params={{ playerId: pid ?? "" }}>
                  /jugadores/{pid}
                </Link>
              </p>
            </>
          )}

          {card.kind === "down" && (
            <section className="tu-blk" aria-labelledby="tu-pick-t">
              <h3 className="tu-h3" id="tu-pick-t">
                Elige tu dorsal
              </h3>
              <p className="tu-blk__d">
                {rejected ? `El capitán no aprobó el ${rejected.number ?? ""}. Elige otra carta o habla con él. ` : ""}
                {free.length ? "Solo salen las fichas que nadie ha reclamado, cada una con su camiseta de verdad. El capitán lo confirma." : "No quedan fichas libres: habla con el capitán en el vestuario."}
              </p>
              {free.length > 0 && pickGrid(false)}
              {free.length > 0 && claimRow}
            </section>
          )}
          {card.kind === "pack" && (
            <section className="tu-blk tu-req" aria-labelledby="tu-req-t">
              <Shirt num={wantedNumber(data)} className="tu-req__img" />
              <div>
                <h3 className="tu-h3" id="tu-req-t">
                  Tu petición: la ficha de {wanted?.name ?? data.ficha.claim?.playerName ?? ""}, dorsal {wantedNumber(data)}
                </h3>
                <p className="tu-blk__d">
                  <span className="tu-pill is-warn">Pendiente del capitán</span> Te avisamos en cuanto conteste: en la campana y, si lo tienes activado, en el móvil. Lo demás, en «Más».
                </p>
              </div>
            </section>
          )}
          {card.kind === "carne" && (
            <>
              <section className="tu-blk" aria-labelledby="tu-so-t">
                <h3 className="tu-h3" id="tu-so-t">
                  Lo tuyo como socio
                </h3>
                <ul className="tu-lines">
                  <li>
                    <TuIcon name="star" />
                    <span>
                      <b>La porra</b>
                      {porra ? `${pl(porra.predictions, "pronóstico", "pronósticos")} · ${pl(porra.exact, "exacto", "exactos")} · vas ${porra.rank}.º de ${porra.of}.` : "Se abre antes del pitido de cada jornada."}
                    </span>
                  </li>
                  <li>
                    <TuIcon name="poll" />
                    <span>
                      <b>El MVP</b>
                      Votas al MVP cuando acaba cada partido, durante 48 horas.
                    </span>
                  </li>
                  <li>
                    <TuIcon name="bell" />
                    <span>
                      <b>Tus avisos</b>
                      Los del vestuario, en la campana; los del móvil, en Avisos a medida.
                    </span>
                  </li>
                </ul>
              </section>
              <section className="tu-blk" aria-labelledby="tu-juegas-t">
                <h3 className="tu-h3" id="tu-juegas-t">
                  ¿Juegas en el Piti?
                </h3>
                <p className="tu-blk__d">Si te toca ficha, la pides aquí y el capitán la confirma. Pedirla no cambia nada más de tu cuenta.</p>
                {free.length > 0 ? pickGrid(true) : <p className="tu-small">No quedan fichas libres: habla con el capitán en el vestuario.</p>}
                {picked && claimRow}
              </section>
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}
