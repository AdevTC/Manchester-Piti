// The bell (V-Integracion «Plantilla y los avisos»): a round glass button in the top bar with a celeste dot while
// something is unread; it opens a glass sheet under it (a sheet over the tab bar on a phone): «Avisos» and how
// many are unread, the five newest (an icon chip, the title, its line, how long ago; the unread marked), «N avisos
// más de hoy y de esta semana · Ver todos», which grows the same sheet into «Todos los avisos» with a filter
// (Todos · Del partido · Del vestuario) and «Cerrar», and «Avisos a medida» at the bottom of both. Members read
// the team's notices, theirs and (a captain) the captains' (useNotices); the dot says something is newer than
// their last look (users/{uid}.noticesSeenAt), and opening writes that look once. A fan gets the bell too, with
// «Avisos a medida» only (the notices are the vestuario's). A dialog: focus moves in and stays, Esc and a click
// outside close it, focus goes back to the bell. Portalled to the body (nothing in the header covers it).
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type Ref } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "../../context/AuthContext";
import { useViewer } from "../../hooks/useViewer";
import { useNotices } from "../../pages/vestuario/live";
import { markNoticesSeen } from "../../pages/vestuario/writes";
import { bellLabel, isUnread, relativeTime, toMillis, unreadCount, type Notice } from "../../lib/derived/notices";
import { capital, plural } from "../../lib/derived/words";
import { VIcon, type VIconName } from "../vidrio/VIcon";
import { AvisosPrefs } from "../vidrio/account/AvisosPrefs";
import "./notices.css";
import "../../styles/vidrio/reading.css";
import "./avisos.css";

/** Where the panel goes: a sheet under the bell (its fixed top and right edge), or the phone's sheet. */
type Anchor = { mode: "pop"; top: number; right: number } | { mode: "sheet" };

/** The page width (the Celeste container) from which the panel hangs under the bell. */
const POPOVER_FROM = 1100;
/** How many the sheet shows before «Ver todos». */
const BELL_ROWS = 5;

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
const EMPTY = "Aquí verás los avisos del equipo: convocatorias, el siete, el MVP…";
const LOADING = "Cargando los avisos…";
const FAILED = "No se han podido cargar los avisos. Comprueba la conexión y vuelve a abrirlos.";

/** The board's two families: what comes from la mesa (the match) and what from the pizarra, the turns, the caja. */
const MATCH_TOPICS = new Set(["start", "goals", "final", "mvp", "lineup", "cards", "dates"]);
type AvisoFilter = "todo" | "partido" | "vestuario";
const avisoKind = (topic: string): Exclude<AvisoFilter, "todo"> => (MATCH_TOPICS.has(topic) ? "partido" : "vestuario");
const FILTERS: { id: AvisoFilter; label: string }[] = [
  { id: "todo", label: "Todos" },
  { id: "partido", label: "Del partido" },
  { id: "vestuario", label: "Del vestuario" },
];

const ICON: Record<string, VIconName> = { goals: "ball", start: "whistle", final: "flag", mvp: "star", lineup: "shirt", dates: "cal", convocatoria: "check", personal: "bell", rota: "wash", polls: "poll", caja: "euro", access: "lock", door: "lock" };

function AvisoIcon({ topic }: { topic: string }) {
  if (topic === "cards") return <i className="vd-av__card" />;
  return <VIcon name={ICON[topic] ?? "bell"} size={19} />;
}

/** A member's bell: his notices (the team's, his, a captain's) and his last look. */
export function NoticesBell() {
  const { user, profile } = useAuth();
  const { admin } = useViewer();
  const uid = user?.uid;
  const notices = useNotices(uid, admin);
  return <Bell member uid={uid} list={notices.data} loading={notices.loading} failed={!!notices.error} serverSeen={toMillis(profile?.noticesSeenAt)} />;
}

/** A fan's bell: only «Avisos a medida» (no listener, no account). */
export function FanBell() {
  return <Bell member={false} uid={undefined} list={[]} loading={false} failed={false} serverSeen={null} />;
}

interface BellProps {
  member: boolean;
  uid: string | undefined;
  list: readonly Notice[];
  loading: boolean;
  failed: boolean;
  serverSeen: number | null;
}

function Bell({ member, uid, list, loading, failed, serverSeen }: BellProps) {
  const [open, setOpen] = useState(false);
  /** Our own look (`local`), until the server's new timestamp replaces `over`, the one we wrote over (it
   *  reads null while the write is pending). Then the server's clock rules again. */
  const [pending, setPending] = useState<{ local: number; over: number | null } | null>(null);
  /** The look before this opening: what the rows mark new while the panel stays open. */
  const [seenBefore, setSeenBefore] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** Under the bell or the phone's sheet, measured on opening and on every resize while open. */
  const [anchor, setAnchor] = useState<Anchor>({ mode: "sheet" });
  const bell = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const seenAt = pending && (serverSeen === null || serverSeen === pending.over) ? pending.local : serverSeen;
  const unread = member ? unreadCount(list, seenAt) : 0;

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) bell.current?.focus();
  }, []);

  const measure = useCallback((): Anchor => {
    const el = bell.current;
    const width = el?.closest(".vx")?.clientWidth ?? window.innerWidth;
    if (!el || width < POPOVER_FROM) return { mode: "sheet" };
    const r = el.getBoundingClientRect();
    return { mode: "pop", top: Math.round(r.bottom + 6), right: Math.max(16, Math.round(document.documentElement.clientWidth - r.right - 60)) };
  }, []);

  const toggle = () => {
    if (open) return close();
    const t = Date.now();
    setNow(t);
    setSeenBefore(seenAt);
    setAnchor(measure());
    setOpen(true);
    if (uid && (unread > 0 || serverSeen === null)) {
      setPending({ local: t, over: serverSeen });
      markNoticesSeen(uid).catch((e: unknown) => console.error("No se pudo marcar los avisos como vistos:", e));
    }
  };

  // Focus moves into the panel; the relative times stay fresh while it is open.
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, [open]);

  // The sheet follows the bell when the window changes size (and becomes the phone's sheet below 1100px).
  useEffect(() => {
    if (!open) return;
    const onResize = () => setAnchor(measure());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, measure]);

  // A click (or touch) outside the panel and the bell closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (panel.current?.contains(t) || bell.current?.contains(t))) return;
      close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return e.preventDefault();
    const first = items[0];
    const last = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === panel.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const dialog = open ? (
    <NoticesPanel
      anchor={anchor}
      ref={panel}
      titleId={titleId}
      member={member}
      list={list}
      // (what was unread when it opened: the header says the same as the rows it marks, not «Al día» once the look is written)
      unread={member ? unreadCount(list, seenBefore) : 0}
      loading={member && loading}
      failed={member && failed}
      seenBefore={seenBefore}
      now={now}
      onKeyDown={onKeyDown}
      onClose={close}
    />
  ) : null;

  return (
    <div className="nt">
      <button ref={bell} type="button" className="nt-bell" aria-label={bellLabel(unread)} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        <VIcon name="bell" size={20} />
        {unread > 0 && <span className="nt-dot" aria-hidden="true" />}
      </button>
      {dialog && createPortal(<div className="nt-portal">{dialog}</div>, document.body)}
    </div>
  );
}

interface PanelProps {
  anchor: Anchor;
  ref: Ref<HTMLDivElement>;
  titleId: string;
  member: boolean;
  list: readonly Notice[];
  unread: number;
  loading: boolean;
  /** A listener failed: said in words instead of the empty line (the list keeps whatever did arrive). */
  failed: boolean;
  seenBefore: number | null;
  now: number;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onClose: (refocus?: boolean) => void;
}

function Rows({ list, seenBefore, now, follow }: { list: readonly Notice[]; seenBefore: number | null; now: number; follow: (e: MouseEvent<HTMLAnchorElement>, url: string) => void }) {
  return (
    <ol className="vd-avs">
      {list.map((n) => {
        const fresh = isUnread(n, seenBefore);
        return (
          <li key={n.id}>
            <a className={`vd-av${fresh ? " is-new" : ""}`} href={n.url} onClick={(e) => follow(e, n.url)}>
              <span className="vd-av__i" aria-hidden="true">
                <AvisoIcon topic={n.topic} />
              </span>
              <span className="vd-av__t">
                <b>
                  {fresh && <span className="vd-vh">Nuevo: </span>}
                  {n.title}
                </b>
                <span>{n.body}</span>
              </span>
              <time dateTime={new Date(n.at).toISOString()}>{capital(relativeTime(n.at, now))}</time>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

function NoticesPanel({ anchor, ref, titleId, member, list, unread, loading, failed, seenBefore, now, onKeyDown, onClose }: PanelProps) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const [filter, setFilter] = useState<AvisoFilter>("todo");
  const follow = (e: MouseEvent<HTMLAnchorElement>, url: string) => {
    onClose(false);
    // The club's own pages go through the router (no reload); anything else is a plain link.
    if (!url.startsWith("/") || url.startsWith("//") || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    void router.navigate({ href: url });
  };
  const more = list.length - BELL_ROWS;
  const shown = all ? list.filter((n) => filter === "todo" || avisoKind(n.topic) === filter) : list.slice(0, BELL_ROWS);
  const fi = FILTERS.findIndex((f) => f.id === filter);
  const empty = (
    // (one polite region: «Cargando…» turning into the list, the empty line or the error is said once)
    <p className="vd-av-none" role="status">
      {loading ? LOADING : failed ? FAILED : EMPTY}
    </p>
  );
  return (
    <>
      {anchor.mode === "sheet" && <div className="nt-scrim" aria-hidden="true" />}
      <div
        ref={ref}
        className={`vd-glass vd-glass--deep vd-bell ${anchor.mode === "pop" ? "vd-bell--pop" : "vd-bell--sheet"}${all ? " is-all" : ""}`}
        style={anchor.mode === "pop" ? ({ top: anchor.top, right: anchor.right, "--vd-bell-top": `${anchor.top}px` } as CSSProperties) : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="vd-bell__head">
          <h2 id={titleId}>{all ? "Todos los avisos" : "Avisos"}</h2>
          {!all && member && <span>{unread > 0 ? (unread <= 2 ? (unread === 1 ? "El primero, sin leer" : "Los dos primeros, sin leer") : `${unread} sin leer`) : "Al día"}</span>}
          {all && (
            <div className="vd-glass vd-seg vd-bell__seg" style={{ "--n": FILTERS.length, "--i": fi } as CSSProperties} role="group" aria-label="Qué avisos">
              <span className="vd-shelf__bead" aria-hidden="true" />
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className="vd-seg__b" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="vd-glass vd-press vd-bell__x"
            aria-label={all ? "Cerrar todos los avisos" : "Cerrar los avisos"}
            onClick={() => {
              if (!all) return onClose();
              setAll(false);
              setFilter("todo");
            }}
          >
            <VIcon name={all ? "collapse" : "close"} size={16} />
            {all && <span>Cerrar</span>}
          </button>
        </div>
        {all && <p className="vd-bell__sub">{plural(list.length, "aviso")} en total. Los del partido llegan de la mesa; los del vestuario, de la pizarra, los turnos y la caja.</p>}
        <div className="vd-bell__body">
          <div className="vd-bell__list">
            {!member ? (
              <p className="vd-av-none">Los avisos del vestuario son de los socios. Desde aquí eliges qué te avisamos del partido en este dispositivo.</p>
            ) : list.length === 0 ? (
              empty
            ) : (
              <>
                <Rows list={shown} seenBefore={seenBefore} now={now} follow={follow} />
                {all && shown.length === 0 && <p className="vd-av-none">Ninguno de este tipo todavía.</p>}
              </>
            )}
            {!all && member && more > 0 && (
              <div className="vd-more vd-bell__more">
                <span>
                  <b>{plural(more, "aviso")} más</b> de hoy y de esta semana
                </span>
                <button type="button" className="vd-more__btn" onClick={() => setAll(true)}>
                  Ver todos
                  <VIcon name="expand" size={16} />
                </button>
              </div>
            )}
          </div>
          <AvisosPrefs className="vd-bell__prefs" />
        </div>
      </div>
    </>
  );
}
