// /profile › «Tu carta»: Tu nombre → Tu ficha (linked: the mini cromo, Mi página, Copiar enlace;
// pending: the request with Cancelar; none: the picker of free fichas) → Qué significa cada número →
// Tipos de carta → Evoluciones. Copy and structure as designed (pf-g.mjs pCarta).
import { Link } from "@tanstack/react-router";
import type { CardView, Evo, EvoShape } from "./card";
import { TIERS } from "./card";
import { Cromo } from "./CardFaces";
import { vars } from "./fx";
import { CREST, Ic } from "./icons";
import { Nombre, type NickField, type ShirtField } from "./Nombre";
import type { FreeFicha } from "./useProfileData";

const ZONE: Record<string, string> = { Portero: "POR", Defensa: "DEF", Centrocampista: "MED", Delantero: "DEL" };

function AwIcon({ shape }: { shape: EvoShape }) {
  return shape === "shield" ? <Ic n="shirt" w={20} /> : shape === "circle" ? <Ic n="ball" w={20} /> : shape === "star" ? <Ic n="star" w={18} /> : <Ic n="team" w={20} />;
}

export interface FichaProps {
  card: CardView;
  shirt: string;
  fullName: string;
  /** /jugadores/:id link copied («Copiado»). */
  copied: boolean;
  onCopy: () => void;
  onCancel: () => void;
  cancelBusy: boolean;
  free: FreeFicha[];
  picked: string | null;
  onPick: (id: string) => void;
  onClaim: () => void;
  claimBusy: boolean;
  claimError: string | null;
  rejectedNum: string | null;
}

function Ficha(p: FichaProps) {
  const c = p.card;
  const lead =
    c.state === "vinculada"
      ? "Tu carta está unida a tu ficha de la plantilla y a tu página pública."
      : c.state === "pendiente"
        ? "Pediste una carta de la plantilla; falta que el capitán la confirme."
        : "Aún no tienes carta. Elige tu dorsal entre las libres y el capitán la confirma.";
  const picked = p.free.find((f) => f.id === p.picked) ?? null;
  return (
    <div className="bk" id="pe-ficha">
      <h3 className="bk-h">Tu ficha</h3>
      <p className="bk-d">{lead}</p>
      {c.state === "vinculada" && c.playerId && (
        <>
          <div className="fi">
            <span className={"ac" + (c.pos === "POR" ? " gk" : "")}>
              <Cromo rt={c.ratingText} pos={c.pos ?? "?"} num={c.number} name={p.shirt} />
            </span>
            <div className="fi-t">
              <span className="chip ok">
                <Ic n="check" w={12} />
                Vinculada a tu cuenta
              </span>
              <b>{p.shirt}</b>
              <small>{[c.number ? "Dorsal " + c.number : "", c.posLong ?? "", p.fullName].filter(Boolean).join(" · ")}</small>
            </div>
          </div>
          <div className="fi-act">
            <Link className="btn gold" to="/jugadores/$playerId" params={{ playerId: c.playerId }}>
              Mi página <Ic n="arrow" w={16} />
            </Link>
            <button type="button" className="btn" onClick={p.onCopy}>
              <Ic n="copy" w={16} />
              {p.copied ? "Copiado" : "Copiar enlace"}
            </button>
          </div>
          <p className="fi-foot">
            <span className="mono">/jugadores/{c.playerId}</span> · pública, la ve cualquiera. ¿No es tu ficha? <Link to="/vestuario">Díselo al capitán</Link>.
          </p>
        </>
      )}
      {c.state === "pendiente" && (
        <>
          <div className="fi">
            <span className="mpk" aria-hidden="true">
              <img src={CREST} alt="" />
              <b>{c.number || "?"}</b>
            </span>
            <div className="fi-t">
              <span className="chip warn">
                <i />
                Pendiente del capitán
              </span>
              <b>
                {c.name} · {c.number}
              </b>
              <small>Pediste esta carta. El capitán la revisa; te avisamos en cuanto conteste.</small>
            </div>
          </div>
          <div className="fi-act">
            <button type="button" className="btn" disabled={p.cancelBusy} aria-busy={p.cancelBusy || undefined} onClick={p.onCancel}>
              <Ic n="x" />
              {p.cancelBusy ? "Cancelando…" : "Cancelar"}
            </button>
            <Link className="btn" to="/vestuario">
              <Ic n="door" w={17} />
              Hablar con él
            </Link>
          </div>
        </>
      )}
      {c.state === "sin-ficha" && (
        <>
          {p.rejectedNum && (
            <p className="note bad">
              <Ic n="alert" />
              <span>
                <b>El capitán no aprobó el {p.rejectedNum}.</b> Elige otra carta o habla con él.
              </span>
            </p>
          )}
          {p.free.length ? (
            <div className="pick" id="pe-pick" role="group" aria-label="Cartas libres de la plantilla">
              {p.free.map((f) => {
                const sel = f.id === p.picked;
                const pos = f.posLong ? (ZONE[f.posLong] ?? "?") : "?";
                return (
                  <button
                    type="button"
                    key={f.id}
                    className={"ac" + (pos === "POR" ? " gk" : "")}
                    aria-pressed={sel}
                    aria-label={`${f.name}, dorsal ${f.number || "sin número"}, ${f.posLong ?? "sin posición"}${sel ? ", elegida" : ""}`}
                    onClick={() => p.onPick(f.id)}
                  >
                    <Cromo rt={f.rating === null ? "—" : String(f.rating)} pos={pos} num={f.number} name={f.name} />
                    <span className="ac-sel" aria-hidden="true">
                      <Ic n="check" w={14} />
                    </span>
                    <small>{f.posLong ?? ""}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="note" id="pe-pick">
              <Ic n="shirt" w={18} />
              <span>
                <b>No quedan cartas libres.</b> Todas las fichas de la plantilla ya tienen dueño: díselo al capitán.
              </span>
            </p>
          )}
          {p.claimError && (
            <p className="note bad" role="alert">
              <Ic n="alert" />
              <span>{p.claimError}</span>
            </p>
          )}
          <button type="button" className="btn gold wide" disabled={!picked || p.claimBusy} aria-busy={p.claimBusy || undefined} onClick={p.onClaim}>
            <Ic n="shirt" w={18} />
            {p.claimBusy ? "Enviando…" : picked ? `Pedir la carta del ${picked.number || picked.name}` : "Elige una carta"}
          </button>
          <p className="fi-foot">
            Solo salen las cartas que nadie ha reclamado. ¿No estás en la plantilla? <Link to="/vestuario">Díselo al capitán</Link>.
          </p>
        </>
      )}
    </div>
  );
}

function Numeros({ card }: { card: CardView }) {
  const showN = card.showNumbers;
  const txt = showN
    ? "Sale de partidos jugados, goles y asistencias, minutos en las últimas jornadas y MVP. Es la misma que ve el capitán en los cromos de la pizarra."
    : !card.started
      ? "Se calcula con tus partidos: aparece después de la J1. Es la misma que ve el capitán en la pizarra."
      : "En cuanto tengas ficha, sale de tus partidos jugados, goles, asistencias, minutos y MVP.";
  return (
    <div className="bk">
      <h3 className="bk-h">Qué significa cada número</h3>
      <p className="bk-d">Los seis números de tu carta salen de tus partidos de esta temporada.</p>
      <div className="formula">
        <b className="big">{card.ratingText}</b>
        <p>
          <strong>Tu valoración.</strong> {txt}
        </p>
      </div>
      <ul className="at">
        {card.attrs.map((a) => (
          <li key={a.k}>
            <span className="at-k">{a.k}</span>
            <span className="at-t">
              <b>{a.label}</b>
              <small>{a.d}</small>
              <span className="bar" role="img" aria-label={`${a.label}: ${showN ? a.text : "sin datos todavía"}`}>
                <i style={vars({ "--p": a.p.toFixed(2) })} />
              </span>
            </span>
            <span className="at-v">{a.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tipos({ card }: { card: CardView }) {
  const lead = card.showNumbers ? `Tu carta es ${card.tierName}. ${card.tierWhy}` : "El tipo de carta sale de tu valoración; «En racha» es especial y se gana jugando.";
  return (
    <div className="bk">
      <h3 className="bk-h">Tipos de carta</h3>
      <p className="bk-d">{lead}</p>
      <ul className="tiers">
        {TIERS.map((t) => {
          const me = card.showNumbers && card.tierKey === t.k;
          return (
            <li key={t.k} className={"t-" + t.k + (me ? " me" : "")}>
              {me && <span className="you">TU CARTA</span>}
              <span className="tsw" aria-hidden="true">
                <i />
              </span>
              <b>{t.label}</b>
              <small>{t.rule}</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ring = (e: Evo) => (e.done ? "HECHA" : `${e.cur}/${e.goal}`);
const evoAria = (e: Evo) => `${e.k}: ${e.done ? "conseguida" : `${e.cur} de ${e.goal}`}`;

function Evoluciones({ card }: { card: CardView }) {
  const done = card.evo.filter((e) => e.done);
  const todo = card.evo.filter((e) => !e.done);
  const nx = card.nextEvo;
  return (
    <div className="bk" id="pe-evo">
      <h3 className="bk-h">
        Evoluciones <span className="nv">nuevo</span>
      </h3>
      <p className="bk-d">Tu carta mejora cuando cumples objetivos, y la mejora se queda para siempre.</p>
      {nx && (
        <div className="nx">
          <span className={"aw s-" + nx.shape} aria-hidden="true">
            <i />
            <AwIcon shape={nx.shape} />
          </span>
          <span className="nx-t">
            <span className="lbl">Próxima evolución</span>
            <b>{nx.k}</b>
            <small>
              {nx.d}. Premio: {nx.reward}.
            </small>
            <span className="bar" role="img" aria-label={evoAria(nx)}>
              <i style={vars({ "--p": (nx.pct / 100).toFixed(2) })} />
            </span>
            <small className="mono">{nx.text}</small>
          </span>
        </div>
      )}
      <p className="lbl evl">
        <span>Conseguidas</span>
        <span>
          {done.length} de {card.evo.length}
        </span>
      </p>
      {done.length ? (
        <ul className="shelf">
          {done.map((e) => (
            <li key={e.id}>
              <span className={"aw s-" + e.shape} aria-hidden="true">
                <i />
                <AwIcon shape={e.shape} />
              </span>
              <b>{e.k}</b>
              <small>{e.reward}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">
          <Ic n="medal" w={18} />
          <span>Aún ninguna. La primera llega con tu debut.</span>
        </p>
      )}
      <p className="lbl evl">
        <span>En curso</span>
        <span>{todo.length} por conseguir</span>
      </p>
      {todo.length > 0 && (
        <ul className="todo">
          {todo.map((e) => (
            <li key={e.id}>
              <span className={"aw s-" + e.shape} aria-hidden="true">
                <i />
                <AwIcon shape={e.shape} />
                <span className="aw-ring">{ring(e)}</span>
              </span>
              <span className="ev-t">
                <b>{e.k}</b>
                <small>{e.d}</small>
                <span className="bar" role="img" aria-label={evoAria(e)}>
                  <i style={vars({ "--p": (e.pct / 100).toFixed(2) })} />
                </span>
                <span className="rw">
                  <Ic n="gift" w={12} />
                  Premio: {e.reward}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TabCarta({ card, shirt, nick, ficha }: { card: CardView; shirt: ShirtField; nick: NickField; ficha: FichaProps }) {
  return (
    <>
      <Nombre shirt={shirt} nick={nick} />
      <Ficha {...ficha} />
      <Numeros card={card} />
      <Tipos card={card} />
      <Evoluciones card={card} />
    </>
  );
}
