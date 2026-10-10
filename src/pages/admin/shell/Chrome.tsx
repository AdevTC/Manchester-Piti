// The admin v2's chrome (quiet), as on the canvas (stats-gen/ad-v2-full.mjs `desktop`, `mHead`): the 60 px
// header «Manchester Piti / Sala de control · {sección}» with Buscar ⌘K, the theme (sun ↔ moon) and «Ver
// la web ↗»; on phones the header (crest, section, search). The rail is Rail.tsx; the phone bar and the
// «Más» sheet are Phone.tsx.
import { Link } from "@tanstack/react-router";
import { AdIcon } from "../ui/icons";
import { ThemeIcon } from "./ChromeBits";
import { themeLabel } from "./nav";

export function AdminHeader({ title, dark, onSearch, onTheme }: { title: string; dark: boolean; onSearch: () => void; onTheme: () => void }) {
  return (
    <header className="hd">
      <Link className="br fr" to="/" aria-label="Manchester Piti · ir a la web">
        <img src="/crest-128.webp" alt="" width={34} height={34} />
        Manchester Piti
      </Link>
      <span className="sep" aria-hidden="true">
        /
      </span>
      <span className="sec">Sala de control · {title}</span>
      <button type="button" className="q fr" onClick={onSearch} aria-label="Buscar (Ctrl K)" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
        <AdIcon name="search" size={18} />
        <span>Buscar partido, jugador o acción</span>
        <kbd>⌘K</kbd>
      </button>
      <button type="button" className="ib fr" onClick={onTheme} aria-label={themeLabel(dark)}>
        <ThemeIcon dark={dark} />
      </button>
      <Link className="btn sm line fr" to="/">
        Ver la web
        <AdIcon name="ext" size={14} />
      </Link>
    </header>
  );
}

export function MobileHeader({ title, onSearch }: { title: string; onSearch: () => void }) {
  return (
    <header className="mh">
      <img src="/crest-128.webp" alt="" width={32} height={32} />
      <h1 className="t">{title}</h1>
      <button type="button" className="ib fr" onClick={onSearch} aria-label="Buscar" aria-haspopup="dialog">
        <AdIcon name="search" size={18} />
      </button>
    </header>
  );
}
