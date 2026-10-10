// Phones: the bar Hoy · Partidos · Convocar · Plantilla · Más and the «Más» sheet (the Club sections, La
// puerta, Buscar, the theme, Ver la web, and the captain — whose row opens «Mi perfil» and «Salir en este
// dispositivo»).
//
// Motion (transform / opacity; reduced = plain elements, the classic Sheet): a floodlight gliding behind
// the current tab (layoutId), tabs that press in, the current icon lifted, badges that pop and roll; the
// sheet springs up over a fading backdrop and drags down to close (distance or a flick), with a haptic tick
// where the device has one and the tap allows it.
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, LayoutGroup, motion, useDragControls, useIsPresent } from "motion/react";
import { AdIcon } from "../ui/icons";
import { useLayer, useLayerHost, zLayer, zScrim } from "../ui/layerCore";
import { Sheet } from "../ui/layers";
import { CaptainAvatar } from "./CaptainMenu";
import { Count, NavIcon, ThemeIcon } from "./ChromeBits";
import { DISMISS, FLOOD, SHEET, tick, useChromeMotion } from "./chromeMotion";
import { counterOf, DOOR_LABEL, goKeys, MAS_SECTIONS, navLabel, SECTION, themeLabel, type Captain, type Counters, type SectionKey } from "./nav";

const BAR: readonly SectionKey[] = ["hoy", "partidos", "convocar", "plantilla"];

function BarFlood({ animate }: { animate: boolean }) {
  return animate ? <motion.span layoutId="ad-bar-flood" className="fl" aria-hidden="true" transition={FLOOD} /> : <span className="fl" aria-hidden="true" />;
}

/** The phone bar. Badges: Hoy (pending) and Más (Fichas + Contenido). */
export function BottomBar({ current, counters, masOpen, onMas }: { current: SectionKey; counters: Counters; masOpen: boolean; onMas: () => void }) {
  const animate = useChromeMotion();
  const mas = counters.fichas.n + counters.contenido.n;
  const inMas = MAS_SECTIONS.includes(current);
  const nav = (
    <nav className="bar" aria-label="Sala de control" data-motion={animate ? undefined : "off"}>
      {BAR.map((k) => {
        const s = SECTION[k];
        const c = k === "hoy" ? counters.hoy : undefined;
        return (
          <Link key={k} className="fr" to={s.path} aria-current={current === k ? "page" : undefined} aria-label={navLabel(s.name, c)} aria-keyshortcuts={goKeys(k)}>
            {current === k && <BarFlood animate={animate} />}
            <NavIcon name={s.icon} size={22} />
            {s.name}
            <Count n={c?.n ?? 0} className="bd" />
          </Link>
        );
      })}
      <button
        type="button"
        className="fr"
        onClick={() => {
          tick();
          onMas();
        }}
        aria-current={inMas ? "page" : undefined}
        aria-haspopup="dialog"
        aria-expanded={masOpen}
        aria-label={mas ? `Más · ${mas} por hacer` : "Más"}
      >
        {inMas && <BarFlood animate={animate} />}
        <AdIcon name="dots" size={22} />
        Más
        <Count n={mas} className="bd" />
      </button>
    </nav>
  );
  return animate ? <LayoutGroup id="bar">{nav}</LayoutGroup> : nav;
}

export interface MasSheetProps {
  open: boolean;
  onClose: () => void;
  counters: Counters;
  captain: Captain;
  dark: boolean;
  onGo: (k: SectionKey) => void;
  onSearch: () => void;
  onTheme: () => void;
  onLogout: () => void;
}
export function MasSheet(props: MasSheetProps) {
  const animate = useChromeMotion();
  if (!animate)
    return (
      <Sheet open={props.open} onClose={props.onClose} label="Más" className="mas">
        <MasBody {...props} animate={false} />
      </Sheet>
    );
  return <AnimatePresence>{props.open && <MasLayer key="mas" {...props} />}</AnimatePresence>;
}

/** The sheet with motion: springs up, drags down to close; while it leaves it is already off the layer stack. */
function MasLayer(props: MasSheetProps) {
  const { onClose } = props;
  const present = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  const host = useLayerHost();
  const drag = useDragControls();
  const { depth, isTop } = useLayer({ modal: true, trap: true, onClose, ref, active: present });
  const node = (
    <>
      <motion.div
        className="scrim mscrim"
        style={{ zIndex: zScrim(depth) }}
        onClick={isTop && present ? onClose : undefined}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.22 } }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
      />
      <motion.div
        ref={ref}
        className="sheet mas"
        role={present ? "dialog" : undefined}
        aria-modal={present ? true : undefined}
        aria-label="Más"
        aria-hidden={present ? undefined : true}
        tabIndex={-1}
        style={{ zIndex: zLayer(depth) }}
        initial={{ y: "100%" }}
        animate={{ y: 0, transition: SHEET }}
        exit={{ y: "100%", transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.8 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > DISMISS.offset || info.velocity.y > DISMISS.velocity) {
            tick();
            onClose();
          }
        }}
      >
        <div className="mgrab" aria-hidden="true" onPointerDown={(e) => {
            // a mouse drag would otherwise select the sheet's text on its way down
            e.preventDefault();
            drag.start(e);
          }}
        >
          <span className="gb" />
        </div>
        <MasBody {...props} animate />
      </motion.div>
    </>
  );
  return host ? createPortal(node, host) : null;
}

function MasBody({ counters, captain, dark, onGo, onSearch, onTheme, onClose, onLogout, animate }: MasSheetProps & { animate: boolean }) {
  const [mine, setMine] = useState(false);
  const listId = useId();
  const own = (
    <ul className="msl mine" id={listId} aria-label="Tu cuenta">
      <li>
        <Link className="fr" to="/profile" onClick={onClose}>
          <AdIcon name="card" size={20} />
          Mi perfil
        </Link>
      </li>
      <li>
        <button
          type="button"
          className="fr"
          onClick={() => {
            onClose();
            onLogout();
          }}
        >
          <AdIcon name="back" size={20} />
          Salir en este dispositivo
        </button>
      </li>
    </ul>
  );
  return (
    <>
      <button type="button" className="mcap fr" aria-expanded={mine} aria-controls={listId} onClick={() => setMine(!mine)}>
        <CaptainAvatar captain={captain} />
        <span className="who">
          <b>{captain.nickname}</b>
          <small>{captain.role}</small>
        </span>
        <span className="chev" aria-hidden="true">
          <AdIcon name="down" size={18} />
        </span>
      </button>
      {animate ? (
        <AnimatePresence initial={false}>
          {mine && (
            <motion.div key="mine" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}>
              {own}
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        mine && own
      )}
      <ul className="msl">
        {MAS_SECTIONS.map((k) => {
          const c = counterOf(counters, k);
          return (
            <li key={k}>
              <button type="button" className="fr" onClick={() => onGo(k)} aria-label={navLabel(SECTION[k].name, c)}>
                <NavIcon name={SECTION[k].icon} />
                {SECTION[k].name}
                <Count n={c?.n ?? 0} className="n" />
              </button>
            </li>
          );
        })}
        <li>
          <Link className="fr" to="/vestuario" hash="puerta" onClick={onClose} aria-label={DOOR_LABEL}>
            <NavIcon name="door" />
            La puerta
            <span className="x2">
              <AdIcon name="ext" size={14} />
            </span>
          </Link>
        </li>
        <li>
          <button type="button" className="fr" onClick={onSearch}>
            <AdIcon name="search" size={20} />
            Buscar
          </button>
        </li>
        <li>
          <button type="button" className="fr" onClick={onTheme}>
            <ThemeIcon dark={dark} size={20} />
            {themeLabel(dark)}
          </button>
        </li>
        <li>
          <Link className="fr" to="/" onClick={onClose}>
            <AdIcon name="home" size={20} />
            Ver la web
            <span className="x2">
              <AdIcon name="ext" size={14} />
            </span>
          </Link>
        </li>
      </ul>
    </>
  );
}
