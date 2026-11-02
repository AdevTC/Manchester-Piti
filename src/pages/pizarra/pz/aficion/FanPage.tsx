// r14 «La pizarra» · la vista de la afición (/aficion/<token>, PZ-D21F): a board's cartel and seven by a link,
// read-only and public (fanBoards/{token}: data/fan.ts useFanBoard). No account, no full names, no notas: what the
// server put in the snapshot (shirt names, dorsales, puestos, the captain, the system, the plan's keys). It looks like
// the web (the real header and sky) and works for a stranger on a phone.
import { useContext } from "react";
import { useParams } from "@tanstack/react-router";
import "../../../../styles/vidrio-paginas.css";
import "../../../../styles/pz/aficion.css";
import { CelesteHeader } from "../../../../components/celeste/Chrome";
import { VidrioSky } from "../../../../components/vidrio";
import { KitStillContext } from "../../../../components/jersey3d/kitStill";
import { useTheme } from "../../../../hooks/useTheme";
import { FAN_TOKEN_RE, useFanBoard, type FanBoard } from "../../data/fan";
import { CREST } from "../../v2/icons";

const TZ = "Europe/Madrid";
function when(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const day = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
  const hm = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
  return day + " · " + hm;
}

/** «J3 · Red Demons · domingo, 8 de noviembre · 18:00 · en casa». */
function fanMatchLine(f: FanBoard): string {
  const m = f.match;
  if (!m) return "";
  return [when(m.date), m.home === true ? "en casa" : m.home === false ? "fuera" : "", m.venue].filter(Boolean).join(" · ");
}

function Shirt({ num }: { num: number | null }) {
  const still = useContext(KitStillContext)("home", num == null ? undefined : String(num));
  return (
    <span className="af-shirt" aria-hidden="true">
      {still?.src ? (
        <img src={still.src} alt="" draggable={false} />
      ) : (
        <svg viewBox="0 0 200 265">
          <path className="b" d="M70 18 C84 30 116 30 130 18 L178 38 C186 42 192 50 194 60 L198 102 L166 108 L160 84 L160 244 C160 250 156 254 150 254 L50 254 C44 254 40 250 40 244 L40 84 L34 108 L2 102 L6 60 C8 50 14 42 22 38 Z" />
          {num != null && (
            <text className="n" x="100" y="190" textAnchor="middle">
              {num}
            </text>
          )}
        </svg>
      )}
    </span>
  );
}

function Board({ f }: { f: FanBoard }) {
  const line = fanMatchLine(f);
  const captain = f.seven.find((p) => p.captain);
  const aria = "El siete en el campo, " + f.system + ": " + f.seven.map((p) => (p.num != null ? p.num + " " : "") + p.shirt + ", " + p.code + (p.captain ? ", capitán" : "") + (p.guest ? ", invitado" : "")).join("; ") + ".";
  return (
    <>
      <header className="af-hero">
        <p className="af-kick">
          <img src={CREST} alt="" width="28" height="28" />
          La afición · Manchester Piti
        </p>
        <h1 className="af-h1" id="contenido-h">
          {f.official ? "¡Ya es oficial!" : "Los siete"}
        </h1>
        <p className="af-line">
          <b>{f.title}</b>
          {line && <span>{line}</span>}
        </p>
        <ul className="af-stats" aria-label="El siete en cifras">
          <li>
            <b>{f.system}</b>
            <span>El sistema</span>
          </li>
          <li>
            <b>{f.seven.length}</b>
            <span>{f.seven.length === 7 ? "Los siete" : "de 7"}</span>
          </li>
          {captain && (
            <li>
              <b>{captain.shirt}</b>
              <span>Capitán</span>
            </li>
          )}
        </ul>
      </header>
      <section className="af-card vd-glass vd-glass--deep" aria-labelledby="af-pitch-h">
        <h2 className="af-vh" id="af-pitch-h">
          El siete en el campo
        </h2>
        <div className="af-pitch" role="img" aria-label={aria}>
          <span className="af-pitch__lines" aria-hidden="true">
            <i className="af-pitch__half" />
            <i className="af-pitch__circle" />
            <i className="af-pitch__box is-top" />
            <i className="af-pitch__box is-bot" />
          </span>
          <span className="af-pitch__sys" aria-hidden="true">
            {f.system}
          </span>
          {f.seven.map((p, i) => (
            <span key={i} className={"af-p" + (p.guest ? " is-guest" : "")} style={{ left: Math.max(9, Math.min(91, p.x)) + "%", top: 9 + Math.max(0, Math.min(100, p.y)) * 0.8 + "%" }} aria-hidden="true">
              {p.captain && <i className="af-p__c">C</i>}
              <Shirt num={p.num} />
              <b className="af-p__n">{(p.num != null ? p.num + " " : "") + p.shirt}</b>
            </span>
          ))}
        </div>
        {f.rival && (
          <p className="af-rival">
            <span className="af-rival__d" aria-hidden="true" />
            {"Enfrente, " + (f.match?.rival || "el rival") + " en " + f.rival.system + (f.rival.nums.some((n) => n != null) ? " · dorsales " + f.rival.nums.filter((n) => n != null).join(", ") : "")}
          </p>
        )}
      </section>
      {f.claves.length > 0 && (
        <section className="af-sec" aria-labelledby="af-claves-h">
          <h2 id="af-claves-h">Las claves del partido</h2>
          <ol className="af-claves">
            {f.claves.map((c, k) => (
              <li key={k}>
                <span aria-hidden="true">{k + 1}</span>
                {c}
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="af-sec af-foot">
        <p>Una vista de solo lectura que el equipo comparte con su afición: sin apellidos, sin notas, sin cuentas.</p>
        <div className="af-acts">
          {f.matchId && (
            <a className="vd-glass vd-press af-btn af-btn--pri" href={"/partidos/" + encodeURIComponent(f.matchId)}>
              El partido
            </a>
          )}
          <a className="vd-glass vd-press af-btn" href="/partidos">
            Todos los partidos
          </a>
        </div>
      </section>
    </>
  );
}

export function FanPage() {
  const { token } = useParams({ strict: false }) as { token?: string };
  const { theme } = useTheme();
  const valid = !!token && FAN_TOKEN_RE.test(token);
  const q = useFanBoard(valid ? (token ?? null) : null);
  const f = q.data ?? null;
  let body;
  if (!valid || (q.isFetched && !q.isError && !f)) {
    body = (
      <div className="af-state" role="status">
        <p className="af-kick">La afición · Manchester Piti</p>
        <h1 className="af-h1">{valid ? "Este enlace ya no funciona" : "Este enlace no es válido"}</h1>
        <p className="af-line">{valid ? "Quien lo compartió lo ha cambiado o lo ha quitado. Pídele uno nuevo." : "Está mal copiado. Pide a quien te lo pasó el enlace entero."}</p>
        <div className="af-acts">
          <a className="vd-glass vd-press af-btn af-btn--pri" href="/partidos">
            Ver los partidos
          </a>
        </div>
      </div>
    );
  } else if (q.isError) {
    body = (
      <div className="af-state" role="alert">
        <p className="af-kick">La afición · Manchester Piti</p>
        <h1 className="af-h1">No se ha podido abrir</h1>
        <p className="af-line">Sin conexión con el club. Vuelve a intentarlo en un momento.</p>
        <div className="af-acts">
          <button type="button" className="vd-glass vd-press af-btn af-btn--pri" onClick={() => void q.refetch()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  } else if (!f) {
    body = (
      <div className="af-state" role="status" aria-busy="true">
        <p className="af-kick">La afición · Manchester Piti</p>
        <h1 className="af-h1">Abriendo el siete…</h1>
      </div>
    );
  } else body = <Board f={f} />;
  return (
    <div className="vx vd-pg af" lang="es">
      <VidrioSky light={theme === "light" ? "noon" : "noche"} floodlit={theme !== "light"} />
      <CelesteHeader />
      <main id="contenido" className="af-main" aria-labelledby={f ? "contenido-h" : undefined}>
        {body}
      </main>
    </div>
  );
}
