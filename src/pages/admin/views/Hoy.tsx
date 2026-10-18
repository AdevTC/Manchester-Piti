// Hoy (/admin) — the hero changes with the moment of the match that matters now (data.hero):
//   · Antes: the peg wall — the J8 plaque with its countdown, who comes (RSVP with names), el siete on the
//     front pegs («Libre» gaps), the banquillo and whoever can come on the back rail. Tap back → it hangs
//     in el siete; tap front → down to the banquillo (each change is written at once: the one convocatoria);
//     «Convocar y avisar» (gold with seven) announces it behind a «Deshacer» lower third.
//   · En juego: the LED scoreboard (live score, running clock, ticker), «Lo que va pasando» and «Abrir la
//     mesa» (/matches/$matchId/mesa: the clock, the plays and the final are written there).
//   · Después: the LED on FINAL · SIN PUBLICAR, the whole log and «Apunta el resultado» (→ the acta);
//     published: FINAL + «Ver la vitrina».
// Beside: «Por hacer» (pending only), «N hechas» folded, «Después: J9». No match at all: the empty shirt.
// Phones: the same moments in one column.
import { useId, useState } from "react";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { scoreOf } from "../../../lib/partidos";
import { jLabel, type AdminMatch } from "../data/adminLogic";
import { enoughCalled, joinNames, place, rsvpGroups, rsvpOf, sevenWhy, SEVEN } from "../data/lineup";
import { countdown, countdownShort, finalSub, isPendingWhistle, isUnwhistled, matchAfter, type MatchMoment } from "../data/moments";
import { PENDING_WHISTLE } from "../../../lib/derived/kickoff";
import { useConvocatoria } from "../data/useConvocatoria";
import { LedBoard, Peg, PegRail, ResultMark, resultLetter, ShirtBack } from "../kit";
import { LiveClock, LiveLog } from "../live/LiveParts";
import { liveLog } from "../live/liveModel";
import { withGuestNames } from "../../../lib/derived/guests";
import { useAdmin, useAdminGo } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import { afterLine, finalLine, hoyLead, pegWall, plaque, shortName, tickerText, type WallPlayer } from "./hoy/hoyModel";
import { nameFor } from "../../../lib/derived/names";
import { SyncChip } from "../../../components/celeste/SyncChip";
import { useSyncChip } from "../../../hooks/useSyncChip";

export function Hoy() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const hero = data.hero;
  const after = matchAfter(data.matches, hero?.match ?? null, data.now);
  const lead = hoyLead(data.now, hero);
  const body = data.loading ? (
    <div className="skel" aria-label="Cargando el partido" role="status">
      <i />
      <i />
      <i />
    </div>
  ) : data.error ? (
    <LoadError />
  ) : !hero ? (
    <NoMatch />
  ) : hero.moment === "antes" ? (
    <Antes match={hero.match} />
  ) : hero.moment === "juego" ? (
    <Juego match={hero.match} />
  ) : (
    <Final match={hero.match} moment={hero.moment} />
  );
  if (!desktop)
    return (
      <div className="msc">
        {body}
        <Side after={null} />
      </div>
    );
  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ttl">Hoy</h1>
          <p className="ld">{lead}</p>
        </div>
      </div>
      <div className="hoy">
        {body}
        <Side after={after} />
      </div>
    </>
  );
}

function useNames() {
  const data = useAdmin();
  const by = new Map(data.roster.map((p) => [p.id, p]));
  // the roster's name is nameFor in the admin's season; a player outside it, the same rule
  const nameOf = (id: string) => by.get(id)?.name ?? nameFor(data.players.find((p) => p.id === id), data.season?.id);
  const numberOf = (id: string) => {
    const n = by.get(id)?.number;
    return n != null ? String(n) : "";
  };
  return { nameOf, numberOf };
}

// ───────────────────────── Antes: the peg wall ─────────────────────────
function Antes({ match }: { match: AdminMatch }) {
  const data = useAdmin();
  const go = useAdminGo();
  const toast = useToast();
  const { desktop } = useFrame();
  const now = data.now;
  const conv = useConvocatoria(match);
  const [hung, setHung] = useState<string | null>(null);
  const isNext = data.next?.match.id === match.id;
  const roster: WallPlayer[] = data.roster;
  const ids = roster.map((p) => p.id);
  const rsvp = rsvpOf(isNext ? (data.next?.answers ?? []) : [], ids);
  const groups = rsvpGroups(ids, rsvp);
  const names = (list: string[]) => list.map((id) => roster.find((p) => p.id === id)?.name ?? "").filter(Boolean);
  const wall = pegWall(conv.lineup, roster, rsvp);
  const status = conv.status;
  // (seven called is enough to publish: the seven itself is optional, often decided in la mesa)
  const full = enoughCalled(conv.lineup);
  const why = sevenWhy(conv.lineup, status, names(groups.duda));
  const j = jLabel(match);
  const pl = plaque(match, isNext ? (data.next?.note ?? "") : "");
  const kick = dateMillis(match.date);
  // The date has come and the clock is still ready: no «FALTAN 0m».
  const pending = isPendingWhistle(match, now);
  const called = conv.lineup.starters.length + conv.lineup.bench.length;

  const toBench = (id: string) => {
    const r = place(conv.lineup, id, "B");
    if (r.ok) conv.set(r.lineup);
  };
  const hang = (id: string, name: string) => {
    const before = conv.lineup;
    const r = place(before, id, "T");
    if (!r.ok) {
      toast.show({ tag: "7/7", message: "Ya hay siete: baja uno al banquillo antes" });
      return;
    }
    conv.set(r.lineup);
    setHung(id);
    toast.show({ tag: j, message: `${name} al siete · la pizarra y el acta ya lo ven${status.notified ? " · falta avisar" : ""}`, undo: () => conv.set(before) });
  };
  const free = () => toast.show({ tag: j, message: "Toca una camiseta del banquillo para colgarla aquí" });
  const publish = () => {
    if (!full) {
      toast.show({ tag: "!", message: "Faltan convocados: hacen falta siete para jugar" });
      return;
    }
    conv.publish({ tag: j, message: `Convocatoria ${j} publicada · avisamos a los ${called} convocados${conv.lineup.starters.length < SEVEN ? " · el siete, en la mesa" : ""}` });
  };
  const chips = (
    <div className="rs">
      <span>Vienen {groups.si.length}</span>
      <span>
        Duda {groups.duda.length} <em>{joinNames(names(groups.duda))}</em>
      </span>
      <span>
        No {groups.no.length} <em>{joinNames(names(groups.no))}</em>
      </span>
      <span>
        Sin responder {groups.sin.length} <em>{joinNames(names(groups.sin))}</em>
      </span>
    </div>
  );
  const convocatoriaCta = status.published ? (
    <span className="okk">
      <AdIcon name="check" size={16} />
      Convocatoria publicada
    </span>
  ) : (
    <button type="button" className={desktop ? "btn gold" : "btn gold xl"} onClick={publish} disabled={!full}>
      <AdIcon name="shirt" size={18} />
      Convocar y avisar
    </button>
  );
  const cta = <>{convocatoriaCta}<button type="button" className="btn sky" onClick={() => go({ section: "enjuego", matchId: match.id })}>Abrir la mesa</button></>;
  const openConvocar = () => go({ section: "convocar", matchId: match.id });

  if (!desktop)
    return (
      <section className="mdug" aria-label={`El siete de la ${j}`}>
        <div className="mplq">
          <span>
            <span className="ttl">{pl.title}</span>
            <br />
            <small>{pl.short}</small>
          </span>
          <span className="ck">
            {pending ? (
              PENDING_WHISTLE
            ) : (
              <>
                FALTAN
                <br />
                {countdownShort(kick, now)}
              </>
            )}
          </span>
        </div>
        <div className="mrail">
          <div className="pegs">
            {wall.front.map((p, i) => (
              <Peg
                key={p.id ?? `free-${i}`}
                num={p.num}
                label={p.id ? shortName(p.name) : "Libre"}
                size={44}
                state={p.id ? "" : "empty"}
                fresh={!!p.id && p.id === hung}
                onClick={p.id ? () => toBench(p.id as string) : free}
                ariaLabel={p.id ? `${p.name} en el siete: tocar para bajarlo al banquillo` : "Hueco libre en el siete"}
              />
            ))}
          </div>
        </div>
        {chips}
        {cta}
        <p className="hint">
          {why} ·{" "}
          <button type="button" className="lnk" onClick={openConvocar} style={{ minHeight: 0 }}>
            Abrir Convocar
          </button>
        </p>
      </section>
    );
  return (
    <section className="dug" aria-label={`El banquillo de la ${j}: el siete colgado`}>
      <div className="plaque">
        <span className="ttl">{pl.title}</span>
        <small>
          {pl.line}
          {pl.note ? (
            <>
              <br />
              {pl.note}
            </>
          ) : null}
        </small>
        <span className="r">
          {pending ? (
            PENDING_WHISTLE
          ) : (
            <>
              FALTAN<b>{countdown(kick, now)}</b>
            </>
          )}
        </span>
      </div>
      {chips}
      <PegRail
        label={
          <>
            El siete · {conv.lineup.starters.length} de 7 {full ? <span className="okk">{why}</span> : <span className="warn">{why}</span>}
          </>
        }
      >
        {wall.front.map((p, i) => (
          <Peg
            key={p.id ?? `free-${i}`}
            num={p.num}
            shirtName={p.id ? p.name : ""}
            label={p.id ? p.name : "Libre"}
            sub={p.sub}
            subTone={p.duda ? "duda" : ""}
            size={96}
            big
            state={p.id ? "" : "empty"}
            fresh={!!p.id && p.id === hung}
            onClick={p.id ? () => toBench(p.id as string) : free}
            ariaLabel={p.id ? `${p.name} en el siete: tocar para bajarlo al banquillo` : "Hueco libre en el siete"}
          />
        ))}
      </PegRail>
      <PegRail label="Banquillo y quien puede venir · toca una camiseta para colgarla delante" variant="back" start>
        {wall.back.map((p) => (
          <Peg key={p.id} num={p.num} label={p.name} sub={p.sub} subTone={p.duda ? "duda" : ""} size={66} state={p.bench ? "" : "dim"} onClick={() => hang(p.id, p.name)} ariaLabel={`Colgar a ${p.name} en el siete`} />
        ))}
      </PegRail>
      <div className="cta-row end" style={{ marginTop: "auto" }}>
        <button type="button" className="btn line" onClick={openConvocar}>
          Abrir Convocar
        </button>
        {cta}
      </div>
    </section>
  );
}

// ───────────────────────── En juego: the LED + the log; scoring is la mesa's ─────────────────────────
function Juego({ match }: { match: AdminMatch }) {
  const data = useAdmin();
  const go = useAdminGo();
  const { desktop } = useFrame();
  const { nameOf } = useNames();
  // the connection chip on the LED (the score may not be the latest)
  const syncChip = useSyncChip(true, data.now);
  const status = <SyncChip chip={syncChip} variant="led" announce />;
  const { gf, ga } = scoreOf(match);
  const j = jLabel(match);
  const note = data.next?.match.id === match.id ? data.next.note : "";
  const start = dateMillis(match.date);
  const sub = (
    <>
      <LiveClock start={start} match={match} /> · EN JUEGO
    </>
  );
  const mesa = (cls: string) => (
    <button type="button" className={cls} onClick={() => go({ section: "enjuego", matchId: match.id })}>
      <AdIcon name="ball" size={20} />
      Abrir la mesa
    </button>
  );
  if (!desktop)
    return (
      <>
        <LedBoard rival={match.rival ?? "Rival"} gf={gf} ga={ga} sub={sub} size="mob" status={status} />
        {mesa("btn gold xl")}
      </>
    );
  const rows = liveLog(match.events, match.rival ?? "el rival", withGuestNames(match, nameOf));
  return (
    <section className="hB" aria-label={`El marcador de la ${j} en juego`}>
      <LedBoard rival={match.rival ?? "Rival"} rivalLogoUrl={match.rivalLogoUrl} gf={gf} ga={ga} sub={sub} ticker={tickerText(match, note)} status={status} />
      <div className="calm" style={{ flex: 1 }}>
        <h3>
          Lo que va pasando <em>Se apunta en la mesa: el reloj, las jugadas y el final.</em>
        </h3>
        <div className="scr" style={{ flex: 1 }}>
          <LiveLog rows={rows} label="Lo que va pasando" />
        </div>
        <div className="cta-row end">{mesa("btn gold")}</div>
      </div>
    </section>
  );
}

// ───────────────────────── Después: FINAL ─────────────────────────
function Final({ match, moment }: { match: AdminMatch; moment: MatchMoment }) {
  const data = useAdmin();
  const go = useAdminGo();
  const { desktop } = useFrame();
  const { nameOf } = useNames();
  const { gf, ga } = scoreOf(match);
  const pub = moment === "publicado";
  // Nobody started the clock and its window is over: no whistle and no result to celebrate.
  const unwhistled = !pub && isUnwhistled(match, data.now);
  const j = jLabel(match);
  const note = data.next?.match.id === match.id ? data.next.note : "";
  const sub = finalSub(match, moment, data.now);
  const apunta = () => go({ section: "partidos", matchId: match.id, tab: "acta" });
  const vitrina = () => go({ section: "partidos", matchId: match.id, vitrina: true });
  if (!desktop)
    return (
      <>
        <LedBoard rival={match.rival ?? "Rival"} gf={gf} ga={ga} sub={sub} subTone="gd" size="mob" flip={false} />
        {pub ? (
          <button type="button" className="btn line" onClick={vitrina}>
            Ver la vitrina
          </button>
        ) : (
          <button type="button" className="btn gold xl" onClick={apunta}>
            <AdIcon name="pencil" size={18} />
            Apunta el resultado
          </button>
        )}
      </>
    );
  const rows = liveLog(match.events, match.rival ?? "el rival", withGuestNames(match, nameOf));
  return (
    <section className="hB" aria-label={`El marcador de la ${j}: final`}>
      <LedBoard rival={match.rival ?? "Rival"} rivalLogoUrl={match.rivalLogoUrl} gf={gf} ga={ga} sub={sub} subTone="gd" ticker={tickerText(match, note)} flip={false} />
      <div className="calm" style={{ flex: 1 }}>
        <h3>
          {unwhistled ? (
            <>
              Sin pitido <em>El reloj no llegó a arrancar: apunta el resultado en el acta.</em>
            </>
          ) : (
            <>
              Pitado el final <ResultMark r={resultLetter(gf, ga)} /> <em>{finalLine(match, gf, ga)}</em>
            </>
          )}
        </h3>
        <div className="scr" style={{ flex: 1 }}>
          <LiveLog rows={rows} label="Lo que pasó" />
        </div>
        <div className="cta-row end">
          {pub ? (
            <>
              <span className="okk">
                <AdIcon name="check" size={16} />
                Acta publicada · la web ya lo cuenta
              </span>
              <button type="button" className="btn line" onClick={vitrina}>
                Ver la vitrina
              </button>
            </>
          ) : (
            <>
              <span className="why">Al publicar, el marcador se queda en FINAL y se abre el MVP 48 h</span>
              <button type="button" className="btn gold" onClick={apunta}>
                <AdIcon name="pencil" size={18} />
                Apunta el resultado
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── empty / error ─────────────────────────
function NoMatch() {
  const go = useAdminGo();
  return (
    <div className="void">
      <ShirtBack size={90} big state="empty" />
      <h3>Sin partidos a la vista</h3>
      <p>Cuando programéis el siguiente, aquí estará su percha: el siete, quién viene y el aviso. El día del partido, el marcador.</p>
      <button type="button" className="btn gold" onClick={() => go({ section: "partidos", nuevo: true })}>
        <AdIcon name="plus" size={18} />
        Nuevo partido
      </button>
    </div>
  );
}
function LoadError() {
  return (
    <div className="void" role="alert">
      <h3>No se ha podido cargar</h3>
      <p>Revisa la conexión y vuelve a intentarlo.</p>
      <button type="button" className="btn line" onClick={() => window.location.reload()}>
        Reintentar
      </button>
    </div>
  );
}

// ───────────────────────── beside: Por hacer · N hechas · Después ─────────────────────────
function Side({ after }: { after: AdminMatch | null }) {
  const data = useAdmin();
  const go = useAdminGo();
  const hid = useId();
  const [open, setOpen] = useState(false);
  const { pending, done } = data.overview;
  return (
    <aside className="side" aria-labelledby={hid}>
      <h2 id={hid}>
        Por hacer {pending.length ? <span className="n">{pending.length}</span> : null}
      </h2>
      {pending.length ? (
        <ol className="pl">
          {pending.map((t) => (
            <li key={t.key} className="pi">
              <b>{t.title}</b>
              <span className="d">
                {t.ved ? <ResultMark r={t.ved} /> : null}
                {t.detail}
              </span>
              <button type="button" className="btn sm line" onClick={() => go(t.action.target)} aria-label={`${t.action.label}: ${t.title}`}>
                {t.action.label}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dn" style={{ boxShadow: "none" }}>
          <span className="ck">
            <AdIcon name="check" size={14} />
          </span>
          Nada pendiente. Todo al día.
        </p>
      )}
      {done.length ? (
        <>
          <button type="button" className="dn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span className="ck">
              <AdIcon name="check" size={14} />
            </span>
            {done.length === 1 ? "1 hecha" : `${done.length} hechas`}
            <span className="ch">
              <AdIcon name="down" size={16} />
            </span>
          </button>
          {open ? (
            <ul className="dl">
              {done.map((x) => (
                <li key={x}>
                  <AdIcon name="check" size={14} />
                  {x}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {after ? (
        <div className="nx">
          <b>Después</b>
          <span>{afterLine(after)}</span>
        </div>
      ) : null}
    </aside>
  );
}
