// El centro de avisos: the bell (header on desktop, phone dock) and its panel, for members only (the chrome's
// NoticesGate mounts it once a member is known, never on the server). The panel lists the team's notices,
// yours and, for a captain, the captains' (useNotices: three listeners merged), grouped Hoy / Esta semana /
// Antes. The dot says something is newer than your last look (users/{uid}.noticesSeenAt); opening the panel
// writes that look once, so the dot clears on all your devices.
// On a desktop the panel is a popover under the bell; from the dock, a bottom sheet. Either way it is a
// dialog: focus moves in and stays there, Esc and a click outside close it and focus goes back to the bell.
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type Ref } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "../../context/AuthContext";
import { useViewer } from "../../hooks/useViewer";
import { useNotices } from "../../pages/vestuario/live";
import { markNoticesSeen } from "../../pages/vestuario/writes";
import { bellLabel, groupNotices, isUnread, noticeIcon, relativeTime, toMillis, unreadCount, type Notice } from "../../lib/derived/notices";
import { Icon } from "./icons";
import "./notices.css";

export type NoticesPlace = "top" | "dock";

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
const EMPTY = "Aquí verás los avisos del equipo: convocatorias, el siete, el MVP…";

export function NoticesBell({ place }: { place: NoticesPlace }) {
  const { user, profile } = useAuth();
  const { admin } = useViewer();
  const uid = user?.uid;
  const notices = useNotices(uid, admin);
  const [open, setOpen] = useState(false);
  /** Our own look (`local`), until the server's new timestamp replaces `over`, the one we wrote over (it
   *  reads null while the write is pending). Then the server's clock rules again. */
  const [pending, setPending] = useState<{ local: number; over: number | null } | null>(null);
  /** The look before this opening: what the rows mark «Nuevo» while the panel stays open. */
  const [seenBefore, setSeenBefore] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** Where the dock's sheet goes: the page (the dock's blur would hold a fixed child), so it keeps the Celeste tokens. */
  const [sheetHost, setSheetHost] = useState<Element | null>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const serverSeen = toMillis(profile?.noticesSeenAt);
  const seenAt = pending && (serverSeen === null || serverSeen === pending.over) ? pending.local : serverSeen;
  const list = notices.data;
  const unread = unreadCount(list, seenAt);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) bell.current?.focus();
  }, []);

  const toggle = () => {
    if (open) return close();
    const t = Date.now();
    setNow(t);
    setSeenBefore(seenAt);
    if (place === "dock") setSheetHost(bell.current?.closest(".vx") ?? document.body);
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
      place={place}
      ref={panel}
      titleId={titleId}
      list={list}
      loading={notices.loading}
      seenBefore={seenBefore}
      now={now}
      onKeyDown={onKeyDown}
      onClose={close}
    />
  ) : null;
  const host = place === "dock" ? sheetHost : null;

  return (
    <div className={`nt nt-${place}`}>
      <button
        ref={bell}
        type="button"
        className="nt-bell"
        aria-label={bellLabel(unread)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon name="bell" size={place === "dock" ? 21 : 19} stroke={place === "dock" ? 1.8 : 2} />
        {unread > 0 && <span className="nt-dot" aria-hidden="true" />}
      </button>
      {host ? createPortal(dialog, host) : dialog}
    </div>
  );
}

interface PanelProps {
  place: NoticesPlace;
  ref: Ref<HTMLDivElement>;
  titleId: string;
  list: readonly Notice[];
  loading: boolean;
  seenBefore: number | null;
  now: number;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onClose: (refocus?: boolean) => void;
}

function NoticesPanel({ place, ref, titleId, list, loading, seenBefore, now, onKeyDown, onClose }: PanelProps) {
  const router = useRouter();
  const groups = groupNotices(list, now);
  const follow = (e: MouseEvent<HTMLAnchorElement>, url: string) => {
    onClose(false);
    // The club's own pages go through the router (no reload); anything else is a plain link.
    if (!url.startsWith("/") || url.startsWith("//") || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    void router.navigate({ href: url });
  };
  return (
    <>
      {place === "dock" && <div className="nt-scrim" aria-hidden="true" />}
      <div ref={ref} className={`nt-panel nt-panel-${place}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="nt-head">
          <div>
            <span className="hm-kick">Centro de avisos</span>
            <h2 className="nt-title" id={titleId}>
              Avisos
            </h2>
          </div>
          <button type="button" className="nt-close" aria-label="Cerrar los avisos" onClick={() => onClose()}>
            <Icon name="x" size={18} stroke={2.2} />
          </button>
        </div>
        {groups.length === 0 ? (
          <p className="nt-none">{loading ? "Cargando los avisos…" : EMPTY}</p>
        ) : (
          <div className="nt-list">
            {groups.map((g) => (
              <section key={g.key} className="nt-group">
                <h3 className="nt-day">{g.label}</h3>
                <ul>
                  {g.items.map((n) => {
                    const fresh = isUnread(n, seenBefore);
                    return (
                      <li key={n.id}>
                        <a className={`nt-row${fresh ? " is-new" : ""}`} href={n.url} onClick={(e) => follow(e, n.url)}>
                          <span className="nt-ico" aria-hidden="true">
                            <Icon name={noticeIcon(n.topic)} size={18} stroke={2} />
                          </span>
                          <span className="nt-txt">
                            <span className="nt-top">
                              {fresh && <span className="nt-new">Nuevo</span>}
                              <b className="nt-t">{n.title}</b>
                            </span>
                            <span className="nt-b">{n.body}</span>
                            <time className="nt-when" dateTime={new Date(n.at).toISOString()}>
                              {relativeTime(n.at, now)}
                            </time>
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
