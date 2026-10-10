// The admin v2's chrome (quiet), as on the canvas (stats-gen/ad-v2-full.mjs `desktop`, `mHead`, `mBar`,
// the «Más» sheet): the 60 px header «Manchester Piti / Sala de control · {sección}» with Buscar ⌘K, the
// theme and «Ver la web ↗»; the 224 px rail (Hoy · Partidos · Convocar · Plantilla + «Club»: Fichas,
// Temporadas, Capitanes, Contenido, La puerta ↗) with exception-only counters and the captain at its foot;
// on phones the header (crest, section, search), the bar Hoy · Partidos · Convocar · Plantilla · Más and
// the «Más» sheet.
import { Link } from "@tanstack/react-router";
import type { CounterKey } from "../data/adminLogic";
import { AdIcon, type AdIconName } from "../ui/icons";
import { Sheet } from "../ui/layers";
import { MAS_SECTIONS, navLabel, SECTION, SECTIONS, type Counter, type SectionKey } from "./nav";

export interface Captain {
  nickname: string;
  initials: string;
  /** «Capitán general», «Capitán». */
  role: string;
}
export type Counters = Record<CounterKey, Counter>;
const counterOf = (counters: Counters, k: SectionKey): Counter | undefined => (k in counters ? counters[k as CounterKey] : undefined);
const themeLabel = (dark: boolean) => (dark ? "Cambiar a tema de día" : "Cambiar a tema de noche");

export function AdminHeader({ title, dark, onSearch, onTheme }: { title: string; dark: boolean; onSearch: () => void; onTheme: () => void }) {
  return (
    <header className="hd">
      <Link className="br" to="/" aria-label="Manchester Piti · ir a la web">
        <img src="/crest-128.webp" alt="" width={34} height={34} />
        Manchester Piti
      </Link>
      <span className="sep" aria-hidden="true">
        /
      </span>
      <span className="sec">Sala de control · {title}</span>
      <button type="button" className="q" onClick={onSearch} aria-label="Buscar (Ctrl K)" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
        <AdIcon name="search" size={18} />
        <span>Buscar partido, jugador o acción</span>
        <kbd>⌘K</kbd>
      </button>
      <button type="button" className="ib" onClick={onTheme} aria-label={themeLabel(dark)}>
        <AdIcon name={dark ? "sun" : "moon"} size={18} />
      </button>
      <Link className="btn sm line" to="/">
        Ver la web
        <AdIcon name="ext" size={14} />
      </Link>
    </header>
  );
}

function RailItem({ k, current, counters }: { k: SectionKey; current: SectionKey; counters: Counters }) {
  const s = SECTION[k];
  const c = counterOf(counters, k);
  return (
    <Link className="it" to={s.path} aria-current={current === k ? "page" : undefined} aria-label={navLabel(s.name, c)}>
      <AdIcon name={s.icon} size={20} />
      <span>{s.name}</span>
      {c && c.n ? (
        <span className="n" aria-hidden="true">
          {c.n}
        </span>
      ) : null}
    </Link>
  );
}

export function Rail({ current, counters, captain }: { current: SectionKey; counters: Counters; captain: Captain }) {
  return (
    <nav className="rail" aria-label="Sala de control">
      {SECTIONS.filter((s) => s.group === "main").map((s) => (
        <RailItem key={s.key} k={s.key} current={current} counters={counters} />
      ))}
      <p className="g">Club</p>
      {SECTIONS.filter((s) => s.group === "club").map((s) => (
        <RailItem key={s.key} k={s.key} current={current} counters={counters} />
      ))}
      <Link className="it" to="/vestuario" hash="puerta" aria-label="La puerta (en el vestuario)">
        <AdIcon name="door" size={20} />
        <span>La puerta</span>
        <span className="x">
          <AdIcon name="ext" size={14} />
        </span>
      </Link>
      <div className="me">
        <span className="av" aria-hidden="true">
          {captain.initials}
        </span>
        <span>
          <b>{captain.nickname}</b>
          <small>{captain.role}</small>
        </span>
      </div>
    </nav>
  );
}

export function MobileHeader({ title, onSearch }: { title: string; onSearch: () => void }) {
  return (
    <header className="mh">
      <img src="/crest-128.webp" alt="" width={32} height={32} />
      <h1 className="t">{title}</h1>
      <button type="button" className="ib" onClick={onSearch} aria-label="Buscar" aria-haspopup="dialog">
        <AdIcon name="search" size={18} />
      </button>
    </header>
  );
}

const BAR: readonly SectionKey[] = ["hoy", "partidos", "convocar", "plantilla"];
/** The phone bar. Badges: Hoy (pending) and Más (Fichas + Contenido). */
export function BottomBar({ current, counters, masOpen, onMas }: { current: SectionKey; counters: Counters; masOpen: boolean; onMas: () => void }) {
  const mas = counters.fichas.n + counters.contenido.n;
  const inMas = MAS_SECTIONS.includes(current);
  return (
    <nav className="bar" aria-label="Sala de control">
      {BAR.map((k) => {
        const s = SECTION[k];
        const c = k === "hoy" ? counters.hoy : undefined;
        return (
          <Link key={k} to={s.path} aria-current={current === k ? "page" : undefined} aria-label={navLabel(s.name, c)}>
            <AdIcon name={s.icon} size={22} />
            {s.name}
            {c && c.n ? (
              <span className="bd" aria-hidden="true">
                {c.n}
              </span>
            ) : null}
          </Link>
        );
      })}
      <button type="button" onClick={onMas} aria-current={inMas ? "page" : undefined} aria-haspopup="dialog" aria-expanded={masOpen} aria-label={mas ? `Más · ${mas} por hacer` : "Más"}>
        <AdIcon name="dots" size={22} />
        Más
        {mas ? (
          <span className="bd" aria-hidden="true">
            {mas}
          </span>
        ) : null}
      </button>
    </nav>
  );
}

const MAS_ICON: Record<string, AdIconName> = { fichas: "inbox", temporadas: "flag", capitanes: "shield", contenido: "doc" };
export function MasSheet({
  open,
  onClose,
  counters,
  captain,
  dark,
  onGo,
  onSearch,
  onTheme,
}: {
  open: boolean;
  onClose: () => void;
  counters: Counters;
  captain: Captain;
  dark: boolean;
  onGo: (k: SectionKey) => void;
  onSearch: () => void;
  onTheme: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Más">
      <div className="mcap">
        <span className="av" aria-hidden="true">
          {captain.initials}
        </span>
        <span>
          <b>{captain.nickname}</b>
          <small>{captain.role}</small>
        </span>
      </div>
      <ul className="msl">
        {MAS_SECTIONS.map((k) => {
          const c = counterOf(counters, k);
          return (
            <li key={k}>
              <button type="button" onClick={() => onGo(k)} aria-label={navLabel(SECTION[k].name, c)}>
                <AdIcon name={MAS_ICON[k]} size={20} />
                {SECTION[k].name}
                {c && c.n ? (
                  <span className="n" aria-hidden="true">
                    {c.n}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
        <li>
          <Link to="/vestuario" hash="puerta" onClick={onClose}>
            <AdIcon name="door" size={20} />
            La puerta
            <span className="x2">
              <AdIcon name="ext" size={14} />
            </span>
          </Link>
        </li>
        <li>
          <button type="button" onClick={onSearch}>
            <AdIcon name="search" size={20} />
            Buscar
          </button>
        </li>
        <li>
          <button type="button" onClick={onTheme}>
            <AdIcon name={dark ? "sun" : "moon"} size={20} />
            {themeLabel(dark)}
          </button>
        </li>
        <li>
          <Link to="/" onClick={onClose}>
            <AdIcon name="home" size={20} />
            Ver la web
            <span className="x2">
              <AdIcon name="ext" size={14} />
            </span>
          </Link>
        </li>
      </ul>
    </Sheet>
  );
}
