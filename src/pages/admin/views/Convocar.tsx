// Convocar (/admin/convocar?j=) — the one convocatoria: Hoy, the match's tab, the pizarra and the acta all
// read what is set here. The match switcher (the next three to play: «J8 · MAD SKY», full names); left, the
// squad grouped by answer (Vienen / En duda / No vienen / Sin responder) with «Siete» / «Banq.»; right, «El
// siete · J8 · MAD SKY» on the front pegs («Libre» gaps), the banquillo's shirts, «Una sola convocatoria»,
// its three readers and «Publicar y avisar» (gold with seven) through setConvocatoria. Each change is
// written at once (useConvocatoria); an eighth for el siete is refused with «Ya hay siete»; a change after
// the notice asks to announce it again; «Copiar la convocatoria de la Jn» with «Deshacer».
// Phones: the switcher, el siete on a small rail, the pool, and a sticky «Publicar y avisar».
import { useId, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { rosterFor } from "../acta/roster";
import { LoadError } from "../club/ClubStates";
import { benchOf, convocables, copyFrom, matchLead, matchTitle, poolGroups, type PoolGroup } from "../convocar/convocarModel";
import { useMatchAnswers } from "../convocar/live";
import { jLabel, type AdminMatch } from "../data/adminLogic";
import { place, rsvpGroups, rsvpOf, sevenWhy, SEVEN, type Slot } from "../data/lineup";
import { useConvocatoria } from "../data/useConvocatoria";
import { Peg, PegRail, ShirtBack } from "../kit";
import { useAdmin, useAdminGo } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import { pegWall, shortName } from "./hoy/hoyModel";

const searchId = (v: unknown) => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined);

export function Convocar() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const go = useAdminGo();
  const search: { j?: unknown } = useSearch({ strict: false });
  const wanted = searchId(search.j);
  const list = useMemo(() => convocables(data.matches, data.now, wanted), [data.matches, data.now, wanted]);
  const match = list.find((m) => m.id === wanted) ?? list[0] ?? null;
  const pick = (id: string) => go({ section: "convocar", matchId: id });

  if (data.loading || data.error || !match) {
    const body = data.loading ? (
      <div className="skel" aria-label="Cargando la convocatoria" role="status">
        <i />
        <i />
        <i />
      </div>
    ) : data.error ? (
      <LoadError what="la convocatoria" />
    ) : (
      <div className="void">
        <ShirtBack size={90} big state="empty" />
        <h3>Sin partidos por jugar</h3>
        <p>Cuando programéis el siguiente, aquí colgaréis el siete y el banquillo, y avisaréis a los convocados.</p>
        <button type="button" className="btn gold" onClick={() => go({ section: "partidos", nuevo: true })}>
          <AdIcon name="plus" size={18} />
          Nuevo partido
        </button>
      </div>
    );
    if (!desktop) return <div className="msc">{body}</div>;
    return (
      <>
        <div className="vh">
          <div>
            <h1 className="ttl">Convocar</h1>
            <p className="ld">El siete y el banquillo de cada partido · una sola convocatoria</p>
          </div>
        </div>
        {body}
      </>
    );
  }
  return <ConvocarMatch key={match.id} match={match} list={list} onPick={pick} />;
}

function Switcher({ list, match, onPick, mobile }: { list: AdminMatch[]; match: AdminMatch; onPick: (id: string) => void; mobile: boolean }) {
  return (
    <div className={mobile ? "mfil seg2" : "seg2"} role="group" aria-label="Partido">
      {list.map((m) => (
        <button key={m.id} type="button" aria-pressed={m.id === match.id} onClick={() => m.id !== match.id && onPick(m.id)}>
          {matchTitle(m)}
        </button>
      ))}
    </div>
  );
}

function ConvocarMatch({ match, list, onPick }: { match: AdminMatch; list: AdminMatch[]; onPick: (id: string) => void }) {
  const data = useAdmin();
  const toast = useToast();
  const { desktop } = useFrame();
  const conv = useConvocatoria(match);
  const answers = useMatchAnswers(match.id);
  const [hung, setHung] = useState<string | null>(null);
  const hid = useId();
  const roster = useMemo(
    () => (match.seasonId && match.seasonId === data.season?.id ? data.roster : rosterFor(data.players, data.seasons, match.seasonId)),
    [match.seasonId, data.season?.id, data.roster, data.players, data.seasons],
  );
  const ids = roster.map((p) => p.id);
  const rsvp = rsvpOf(answers.data, ids);
  const groups = rsvpGroups(ids, rsvp);
  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name ?? "Jugador";
  const lineup = conv.lineup;
  const status = conv.status;
  const n = lineup.starters.length;
  const full = n >= SEVEN;
  const called = n + lineup.bench.length;
  const j = jLabel(match);
  const front = pegWall(lineup, roster, rsvp).front;
  const pool = poolGroups(roster, lineup, rsvp);
  const bench = benchOf(roster, lineup);
  const copy = copyFrom(data.matches, match, lineup, ids);
  const why = full && !match.published ? "El partido aún no está en el calendario: publícalo en Partidos para avisar" : sevenWhy(lineup, status, groups.duda.map(nameOf));
  const warn = full ? "" : `Falta ${SEVEN - n} para el siete`;

  const setSlot = (id: string, slot: Slot) => {
    const before = lineup;
    const r = place(before, id, slot);
    if (!r.ok) {
      toast.show({ tag: "7/7", message: "Ya hay siete: baja uno al banquillo antes" });
      return;
    }
    conv.set(r.lineup);
    const hangs = slot === "T" && r.lineup.starters.includes(id);
    setHung(hangs ? id : null);
    if (hangs) toast.show({ tag: j, message: `${nameOf(id)} al siete · la pizarra y el acta ya lo ven${status.notified ? " · falta avisar" : ""}`, undo: () => conv.set(before) });
  };
  const free = () => toast.show({ tag: j, message: "Toca «Siete» en un jugador de la lista para colgarlo aquí" });
  const publish = () => {
    if (!full) {
      toast.show({ tag: "!", message: "Faltan jugadores para el siete" });
      return;
    }
    conv.publish({ tag: j, message: `Convocatoria ${j} publicada · avisamos a los ${called} convocados` });
  };
  const copyIt = () => {
    if (!copy) return;
    const before = lineup;
    conv.set(copy.lineup);
    setHung(null);
    toast.show({ tag: j, message: `Convocatoria de la ${copy.label} copiada · la pizarra y el acta ya lo ven`, undo: () => conv.set(before) });
  };

  const cta = status.published ? (
    <span className="okk">
      <AdIcon name="check" size={16} />
      Publicada
    </span>
  ) : (
    <button type="button" className="btn gold" onClick={publish} disabled={!full || !match.published}>
      {desktop && <AdIcon name="shirt" size={18} />}
      Publicar y avisar
    </button>
  );
  const copyBtn = copy ? (
    <button type="button" className="btn sm line" onClick={copyIt}>
      <AdIcon name="list" size={16} />
      Copiar la convocatoria de la {copy.label}
    </button>
  ) : null;
  const frontAria = (id: string | null) => (id ? `${nameOf(id)} en el siete: tocar para bajarlo al banquillo` : "Hueco libre en el siete");

  if (!desktop)
    return (
      <>
        <div className="msc">
          <Switcher list={list} match={match} onPick={onPick} mobile />
          <section className="mdug" aria-label={`El siete de la ${j}`}>
            <p className="ch3">
              El siete · {n} de 7 {warn && <span className="warn">{warn}</span>}
            </p>
            <div className="mrail">
              <div className="pegs">
                {front.map((p, i) => (
                  <Peg
                    key={p.id ?? `free-${i}`}
                    num={p.num}
                    label={p.id ? shortName(p.name) : "Libre"}
                    size={44}
                    state={p.id ? "" : "empty"}
                    fresh={!!p.id && p.id === hung}
                    onClick={p.id ? () => setSlot(p.id as string, "B") : free}
                    ariaLabel={frontAria(p.id)}
                  />
                ))}
              </div>
            </div>
            <p className="hint">
              Banquillo:{" "}
              {bench.length
                ? bench.map((p) => (
                    <span key={p.id} className="bqi">
                      {p.number ?? ""} {p.name}
                    </span>
                  ))
                : "nadie todavía"}
            </p>
          </section>
          {copyBtn}
          <Pool groups={pool} onSet={setSlot} empty={!roster.length} />
          <SourceNote />
        </div>
        <div className="msticky">
          <span className="why">{why}</span>
          {cta}
        </div>
      </>
    );

  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ttl">Convocar</h1>
          <p className="ld">{matchLead(match)} · toca un jugador para el siete o el banquillo</p>
        </div>
        <div className="r">
          <Switcher list={list} match={match} onPick={onPick} mobile={false} />
        </div>
      </div>
      <div className="cvv">
        <Pool groups={pool} onSet={setSlot} empty={!roster.length} />
        <section className="sv" aria-labelledby={hid}>
          <div className="cta-row">
            <h2 className="ttl" id={hid}>
              El siete · {matchTitle(match)}
            </h2>
            {warn && <span className="warn">{warn}</span>}
          </div>
          <PegRail label={`Ganchos delanteros · ${n} de 7`}>
            {front.map((p, i) => (
              <Peg
                key={p.id ?? `free-${i}`}
                num={p.num}
                shirtName={p.id ? p.name : ""}
                label={p.id ? p.name : "Libre"}
                sub={p.id ? p.sub : "toca «Siete»"}
                subTone={p.duda ? "duda" : ""}
                size={80}
                big
                state={p.id ? "" : "empty"}
                fresh={!!p.id && p.id === hung}
                onClick={p.id ? () => setSlot(p.id as string, "B") : free}
                ariaLabel={frontAria(p.id)}
              />
            ))}
          </PegRail>
          <div>
            <p className="ch3" style={{ marginBottom: 8 }}>
              Banquillo <em>{bench.length}</em>
            </p>
            <div className="bq">
              {bench.length ? (
                bench.map((p) => <Peg key={p.id} num={p.number} label={p.name} size={52} className="nop" onClick={() => setSlot(p.id, "B")} ariaLabel={`Quitar a ${p.name} del banquillo`} />)
              ) : (
                <p className="hint">Nadie en el banquillo todavía.</p>
              )}
            </div>
          </div>
          <SourceNote />
          <div className="rdrs">
            <div>
              <b>
                <AdIcon name="check" size={14} />
                La pizarra
              </b>
              El siete oficial · {n} de 7
            </div>
            <div>
              <b>
                <AdIcon name="check" size={14} />
                El acta
              </b>
              Titulares y suplentes
            </div>
            <div>
              <b>
                <AdIcon name="check" size={14} />
                Los avisos
              </b>
              Push a los convocados al publicar
            </div>
          </div>
          <div className="cta-row end" style={{ marginTop: "auto" }}>
            {copyBtn}
            <span className="why">{why}</span>
            {cta}
          </div>
        </section>
      </div>
    </>
  );
}

function SourceNote() {
  return (
    <div className="src">
      <AdIcon name="shirt" size={20} />
      <span>
        <b>Una sola convocatoria.</b> La pizarra coloca a estos siete como el siete oficial y el acta los toma como titulares; el banquillo son los suplentes. Se cambia aquí y se ve en los tres sitios.
      </span>
    </div>
  );
}

function Pool({ groups, onSet, empty }: { groups: PoolGroup[]; onSet: (id: string, slot: Slot) => void; empty: boolean }) {
  const base = useId();
  return (
    <div className="pool scr" role="group" aria-label="Jugadores por respuesta">
      {empty ? <p className="hint">Nadie en la plantilla de esta temporada: dalos de alta en Plantilla.</p> : null}
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`${base}-${g.key}`}>
          <h3 id={`${base}-${g.key}`}>
            {g.title} <em>{g.rows.length}</em>
          </h3>
          <div className="gw">
            {g.rows.map((r) => (
              <div key={r.id} className={g.key === "no" ? "pr no" : "pr"}>
                <span className="nb">{r.num}</span>
                <span>
                  <b>{r.name}</b>
                  <small>{r.line}</small>
                </span>
                <span className="ac">
                  <button type="button" className={`btn sm ${r.slot === "T" ? "sky" : "line"}`} onClick={() => onSet(r.id, "T")} aria-pressed={r.slot === "T"} aria-label={`${r.name} en el siete`}>
                    Siete
                  </button>
                  <button type="button" className={`btn sm ${r.slot === "B" ? "sky" : "line"}`} onClick={() => onSet(r.id, "B")} aria-pressed={r.slot === "B"} aria-label={`${r.name} en el banquillo`}>
                    Banq.
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
