// "Añadir al calendario" as one button with a small menu: Google, Apple/.ics and Outlook for an
// event, or a one-tap subscription to the club feed. The viewer's platform goes first.
import { useEffect, useId, useRef, useState } from "react";
import { googleEventUrl, googleSubscribeUrl, outlookEventUrl, preferredCalendar, webcalUrl, type CalendarEvent } from "../../lib/calendarLinks";
import { downloadIcs, eventIcs } from "../../lib/ics";
import { Icon } from "./icons";

type Props = { label: string; className: string; iconName?: "cal" | "calPlus" } & ({ event: CalendarEvent; feed?: never } | { feed: string; event?: never });

interface Item {
  key: "google" | "apple" | "outlook" | "copy";
  label: string;
  hint: string;
  href?: string;
  onSelect?: () => void;
}

export function AddToCalendar({ label, className, iconName = "calPlus", event, feed }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    root.current?.querySelector<HTMLElement>(".cal-menu a, .cal-menu button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const done = () => setOpen(false);
  const items: Item[] = event
    ? [
        { key: "google", label: "Google Calendar", hint: "Se abre con el evento ya relleno", href: googleEventUrl(event) },
        {
          key: "apple",
          label: "Apple Calendar u otro",
          hint: "iPhone, Mac o cualquier app (.ics)",
          onSelect: () => {
            downloadIcs(`${event.uid}.ics`, eventIcs({ uid: event.uid, start: event.start, end: event.end, summary: event.title, location: event.location, url: event.url }));
            done();
          },
        },
        { key: "outlook", label: "Outlook", hint: "Outlook.com o Microsoft 365", href: outlookEventUrl(event) },
      ]
    : [
        { key: "google", label: "Google Calendar", hint: "Se actualiza solo (cada pocas horas)", href: googleSubscribeUrl(feed!) },
        { key: "apple", label: "iPhone o Mac", hint: "Suscripción en Calendario", href: webcalUrl(feed!) },
        {
          key: "copy",
          label: copied ? "Enlace copiado" : "Copiar enlace",
          hint: "Para cualquier otra app de calendario",
          onSelect: () => {
            navigator.clipboard?.writeText(feed!).then(
              () => setCopied(true),
              () => window.prompt("Copia el enlace del calendario:", feed!),
            );
          },
        },
      ];
  const first = typeof navigator !== "undefined" ? preferredCalendar(navigator.userAgent) : "google";
  const ordered = first === "apple" ? [...items].sort((a, b) => Number(b.key === "apple") - Number(a.key === "apple")) : items;

  return (
    <span className="cal" ref={root}>
      <button ref={trigger} type="button" className={className} aria-expanded={open} aria-controls={menuId} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <Icon name={iconName} size={15} stroke={2.2} />
        {label}
        <Icon name="down" size={13} stroke={2.4} />
      </button>
      {open && (
        <div className="cal-menu" id={menuId} role="group" aria-label={label}>
          {ordered.map((it) =>
            it.href ? (
              <a key={it.key} href={it.href} target={it.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" onClick={done}>
                <b>{it.label}</b>
                <span>{it.hint}</span>
              </a>
            ) : (
              <button key={it.key} type="button" onClick={it.onSelect}>
                <b>{it.label}</b>
                <span>{it.hint}</span>
              </button>
            ),
          )}
        </div>
      )}
    </span>
  );
}
