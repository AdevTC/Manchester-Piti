// The admin shell's chrome, as designed: the slim header (`.ah`), the side menu with live counters
// (`.sd`, ≥ 1000 px), the phone's bottom bar (`.ab`) and its «Más» sheet.
import { Link } from "@tanstack/react-router";
import { Counter } from "../ui/controls";
import { AdIcon, type AdIconName } from "../ui/icons";
import { Sheet } from "../ui/layers";
import type { CounterKey } from "../data/adminLogic";
import { DOOR_HREF, MAS_SECTIONS, MENU_LABEL, SECTION, SECTIONS, navAria, type Counter as CounterValue, type SectionKey } from "./nav";

export interface Captain {
  nickname: string;
  initials: string;
  /** «Super admin · capitán», «Administrador»… */
  role: string;
  /** «Super admin · capitán de la Temporada 1» (the «Más» sheet). */
  roleLong: string;
}

export function AdminHeader({
  section,
  dark,
  onSearch,
  onTheme,
}: {
  section: SectionKey;
  dark: boolean;
  onSearch: () => void;
  onTheme: () => void;
}) {
  return (
    <header className="ah">
      <Link className="ah-b" to="/" aria-label="Manchester Piti · ir a la web">
        <img src="/crest-128.webp" alt="" width={32} height={32} />
        <span className="nm">Manchester Piti</span>
      </Link>
      <span className="ah-sep" aria-hidden="true">
        /
      </span>
      <span className="ah-t">
        <b>Administración</b>
        <span>{SECTION[section].name}</span>
      </span>
      <button type="button" className="ah-k" onClick={onSearch} aria-label="Buscar en la administración (Ctrl K)" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
        <AdIcon name="search" size={18} />
        <span className="tx">Buscar sección, partido, jugador o acción</span>
        <kbd className="kbd">⌘K</kbd>
      </button>
      <div className="ah-a">
        <button type="button" className="ib" onClick={onTheme} aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}>
          <AdIcon name={dark ? "sun" : "moon"} size={20} />
        </button>
        <Link className="btn sm line ah-web" to="/">
          Ver la web
          <AdIcon name="ext" size={14} />
        </Link>
      </div>
    </header>
  );
}

const GROUPS: (null | "Jornada" | "Club")[] = [null, "Jornada", "Club"];
export function SideNav({
  section,
  counters,
  captain,
  collapsed,
  onToggle,
  onGo,
}: {
  section: SectionKey;
  counters: Record<CounterKey, CounterValue>;
  captain: Captain;
  collapsed: boolean;
  onToggle: () => void;
  onGo: (key: SectionKey) => void;
}) {
  const door = counters.puerta;
  return (
    <nav className="sd" aria-label="Secciones de administración">
      <div className="sd-l scr">
        {GROUPS.map((g) => (
          <div key={g ?? "top"} style={{ display: "contents" }}>
            {g && (
              <>
                <p className="sd-g">{g}</p>
                <span className="sd-sep" aria-hidden="true" />
              </>
            )}
            {SECTIONS.filter((s) => s.group === g).map((s) => {
              const c = counters[s.key];
              return (
                <a
                  key={s.key}
                  className="sn"
                  href={s.path}
                  aria-current={section === s.key ? "page" : undefined}
                  title={MENU_LABEL[s.key]}
                  aria-label={navAria(MENU_LABEL[s.key], c)}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    onGo(s.key);
                  }}
                >
                  <AdIcon name={s.icon} size={20} />
                  <span className="lb">{MENU_LABEL[s.key]}</span>
                  <Counter n={c.n} tone={c.tone} />
                </a>
              );
            })}
          </div>
        ))}
        <p className="sd-g">Vestuario</p>
        <span className="sd-sep" aria-hidden="true" />
        <a className="sn" href={DOOR_HREF} title="La puerta (se abre en el vestuario)" aria-label={`La puerta: ${door.n ? door.label : "nadie llamando"} · se abre en el vestuario`}>
          <AdIcon name="door" size={20} />
          <span className="lb">La puerta</span>
          <Counter n={door.n} tone="hot" />
        </a>
      </div>
      <div className="sd-f">
        <span className="av" aria-hidden="true">
          {captain.initials}
        </span>
        <span className="who">
          <b>{captain.nickname}</b>
          <small>{captain.role}</small>
        </span>
      </div>
      <button type="button" className="sn colb" onClick={onToggle} aria-label={collapsed ? "Desplegar el menú" : "Plegar el menú"} aria-expanded={!collapsed}>
        <AdIcon name="side" size={18} />
        <span className="lb">Plegar menú</span>
      </button>
    </nav>
  );
}


const BAR: { key: SectionKey; label: string; icon: AdIconName }[] = [
  { key: "inicio", label: "Inicio", icon: "home" },
  { key: "partidos", label: "Partidos", icon: "cal" },
  { key: "plantilla", label: "Plantilla", icon: "team" },
  { key: "contenido", label: "Club", icon: "doc" },
];
export function BottomBar({
  section,
  counters,
  masOpen,
  onGo,
  onMas,
}: {
  section: SectionKey;
  counters: Record<CounterKey, CounterValue>;
  masOpen: boolean;
  onGo: (key: SectionKey) => void;
  onMas: () => void;
}) {
  const badge = (k: SectionKey) => (k === "partidos" || k === "contenido" ? counters[k] : null);
  const masN = counters.fichas.n + (counters.convocatorias.n ? 1 : 0);
  const masLabel = [counters.fichas.n ? counters.fichas.label : "", counters.convocatorias.n ? `convocatoria con ${counters.convocatorias.label}` : ""].filter(Boolean).join(" · ");
  return (
    <nav className="ab" aria-label="Administración">
      {BAR.map((b) => {
        const c = badge(b.key);
        const name = b.key === "contenido" ? "Club: contenido" : b.label;
        return (
          <button key={b.key} type="button" aria-current={section === b.key && !masOpen ? "page" : undefined} onClick={() => onGo(b.key)} aria-label={navAria(name, c ?? undefined)}>
            <span className="ic">
              <AdIcon name={b.icon} size={21} />
            </span>
            {b.label}
            <Counter n={c?.n ?? 0} tone={c?.tone ?? ""} className="bd" />
          </button>
        );
      })}
      <button
        type="button"
        aria-current={MAS_SECTIONS.includes(section) || masOpen ? "page" : undefined}
        aria-haspopup="dialog"
        aria-expanded={masOpen}
        onClick={onMas}
        aria-label={masN ? `Más secciones · ${masLabel}` : "Más secciones"}
      >
        <span className="ic">
          <AdIcon name="dots" size={21} />
        </span>
        Más
        <Counter n={masN} className="bd" />
      </button>
    </nav>
  );
}

export function MasSheet({
  open,
  onClose,
  section,
  counters,
  captain,
  dark,
  convText,
  seasonsText,
  onGo,
  onSearch,
  onTheme,
}: {
  open: boolean;
  onClose: () => void;
  section: SectionKey;
  counters: Record<CounterKey, CounterValue>;
  captain: Captain;
  dark: boolean;
  /** «2 sin asignar en la convocatoria». */
  convText: string;
  /** «T1 activa · 1 archivada». */
  seasonsText: string;
  onGo: (key: SectionKey) => void;
  onSearch: () => void;
  onTheme: () => void;
}) {
  const tile = (key: SectionKey, icon: AdIconName, small: string, showCount: boolean) => {
    const c = counters[key];
    return (
      <button type="button" className="tl" aria-current={section === key ? "page" : undefined} onClick={() => onGo(key)} aria-label={navAria(MENU_LABEL[key], showCount ? c : undefined)}>
        <AdIcon name={icon} size={20} />
        <b>
          {MENU_LABEL[key]} {showCount && <Counter n={c.n} tone={c.tone} />}
        </b>
        <small>{small}</small>
      </button>
    );
  };
  return (
    <Sheet open={open} onClose={onClose} title="Más secciones" className="mas">
      <div className="me">
        <span className="av" aria-hidden="true">
          {captain.initials}
        </span>
        <span className="w">
          <b>{captain.nickname}</b>
          <small>{captain.roleLong}</small>
        </span>
      </div>
      <div className="mtl">
        {tile("convocatorias", "list", convText, true)}
        {tile("fichas", "inbox", counters.fichas.n ? counters.fichas.label : "Al día", true)}
        {tile("temporadas", "flag", seasonsText, false)}
        {tile("capitanes", "shield", counters.capitanes.label || "Sin administradores", false)}
        <a className="tl" href={DOOR_HREF}>
          <AdIcon name="door" size={20} />
          <b>
            La puerta
            <AdIcon name="ext" size={12} />
          </b>
          <small>{counters.puerta.n ? `${counters.puerta.label} · en el vestuario` : "Nadie llamando · en el vestuario"}</small>
        </a>
        <button type="button" className="tl" onClick={onSearch}>
          <AdIcon name="search" size={20} />
          <b>Buscar</b>
          <small>Sección, partido, jugador o acción</small>
        </button>
      </div>
      <div className="mrow">
        <button type="button" className="btn line" onClick={onTheme}>
          <AdIcon name={dark ? "sun" : "moon"} size={17} />
          {dark ? "Tema de día" : "Tema de noche"}
        </button>
        <Link className="btn line" to="/">
          Ver la web
          <AdIcon name="ext" size={14} />
        </Link>
      </div>
    </Sheet>
  );
}
