// The pieces the acta's stations share (board part-partido-acta.html): the printed shirt of a player, the stills
// provider of a station, the acta's own navigation (Lo apuntado · Análisis narrado · Historial), the bars over the
// acta (another captain's change, this device's edits, la mesa's jugadas, the draft) and the minute box.
import { useContext, useMemo, useState, type ReactNode } from "react";
import { KitStillContext, type Kit } from "../../../../components/jersey3d/kitStill";
import { usePageKitStills } from "../../../../components/jersey3d/usePageKitStills";
import { clockTime } from "../../data/adminLogic";
import { useShell } from "../../shell/context";
import { SalaLink } from "../../shell/SalaLink";
import { usePartido } from "../../partido/partidoContext";
import { footReason } from "./actaModel";
import type { SheetSession } from "./sheetSession";

const kitOf = (k: string | undefined): Kit => (k === "away" ? "away" : "home");

/** The three glyphs of the acta's sprite that the Vidrio set does not have (board sprite: vi-edit, vi-trash, vi-download). */
export function AcIcon({ name, size = 18, className }: { name: "edit" | "trash" | "download"; size?: number; className?: string }) {
  const d = name === "edit" ? ["M4 20h4L19 9l-4-4L4 16v4z", "M13 7l4 4"] : name === "trash" ? ["M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"] : ["M12 4v11M7 10l5 5 5-5M5 20h14"];
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {d.map((x) => (
        <path key={x} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={x} />
      ))}
    </svg>
  );
}

/** The printed still of a player's shirt (his name and number), the kit's blank one for a guest or the team. */
export function Shirt({ kit, num, alt = "", size = "xs" }: { kit: string | undefined; num?: string; alt?: string; size?: "xs" | "s" }) {
  const still = useContext(KitStillContext)(kitOf(kit), num && /^\d+$/.test(num) ? num : undefined);
  if (still) return <img className={`sc-shirt sc-shirt--${size}`} src={still.src} alt={alt} draggable={false} />;
  return (
    <svg className={`sc-shirt sc-shirt--${size}`} viewBox="0 0 413 548" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} focusable="false">
      <path d="M120 20 L60 50 L8 150 L70 190 L92 160 L92 530 L321 530 L321 160 L343 190 L405 150 L353 50 L293 20 Q206 70 120 20Z" fill={kitOf(kit) === "away" ? "#1b1d26" : "#9fd0f2"} stroke="rgba(255,255,255,.35)" strokeWidth="6" />
    </svg>
  );
}

/** The stills of the match's squad for every shirt of a station (rendered off the main thread, once per name). */
export function ActaStills({ s, children }: { s: SheetSession; children: ReactNode }) {
  const { theme } = useShell();
  const kit = kitOf(s.sheet.kit);
  const players = useMemo(() => s.roster.filter((p) => p.number != null).map((p) => ({ name: p.name.toLocaleUpperCase("es"), num: String(p.number) })), [s.roster]);
  const stillOf = usePageKitStills({ on: true, theme, kits: [kit], players });
  return <KitStillContext.Provider value={stillOf}>{children}</KitStillContext.Provider>;
}

/** The same, for a station that shows a published match (Después) rather than the acta being edited. */
export function ActaStillsFor({ kit, players, children }: { kit: string | undefined; players: readonly { name: string; number: number | null }[]; children: ReactNode }) {
  const { theme } = useShell();
  const list = useMemo(() => players.filter((p) => p.number != null).map((p) => ({ name: p.name.toLocaleUpperCase("es"), num: String(p.number) })), [players]);
  const stillOf = usePageKitStills({ on: true, theme, kits: [kitOf(kit)], players: list });
  return <KitStillContext.Provider value={stillOf}>{children}</KitStillContext.Provider>;
}

/** The acta's own navigation: Lo apuntado · Análisis narrado · Historial (aria-current on the one on screen). */
export function ActaNav({ on }: { on: "" | "narracion" | "historial" }) {
  const { base } = usePartido();
  const tabs: [typeof on, string][] = [
    ["", "Lo apuntado"],
    ["narracion", "Análisis narrado"],
    ["historial", "Historial"],
  ];
  return (
    <nav className="ac-tabs" aria-label="El acta">
      {tabs.map(([k, t]) => (
        <SalaLink key={k || "acta"} to={`${base}/acta${k ? `/${k}` : ""}`} className={`ac-tab${on === k ? " is-on" : ""}`} aria-current={on === k ? "page" : undefined}>
          {t}
        </SalaLink>
      ))}
    </nav>
  );
}

/** The bars over the acta: the clash (B-ACTA-01, with its way out), this device's edits, la mesa, the saved draft. */
export function ActaBars({ s, onPublishTo }: { s: SheetSession; onPublishTo: () => void }) {
  const [open, setOpen] = useState(false);
  const c = s.clash;
  const draftBar = s.serverDraft && !s.dirty && !c;
  return (
    <div className="ac-bars">
      {c && c.kind !== "mesa" && (
        <div className="ac-bar is-mal" role="alert">
          <p className="ac-bar__t">
            <b>{c.kind === "draft" ? "Lo publicado ha cambiado desde que se guardó este borrador" : "Otro capitán ha cambiado este partido mientras editabas"}</b>
            <span>Tus cambios siguen aquí: recarga y se conservan, o descarta el borrador y vuelve a lo {s.published ? "publicado" : "guardado"}.</span>
          </p>
          <div className="ac-bar__a">
            {c.lines.length > 0 && (
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                Ver qué cambió
              </button>
            )}
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri" onClick={s.takeIn}>
              Recargar y conservar mis cambios
            </button>
            {(s.serverDraft || s.dirty) && (
              <button type="button" className="vd-link ac-link" onClick={() => void s.discardDraft()} aria-disabled={s.busy === "discard" || undefined}>
                {s.serverDraft && s.match.published ? "Descartar borrador" : "Descartar mis cambios"}
              </button>
            )}
          </div>
          {open && (
            <ul className="ac-bar__list">
              {c.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {s.offer && (
        <div className="ac-bar" role="status">
          <p className="ac-bar__t">
            <b>Hay cambios sin guardar en este dispositivo</b>
            <span>{s.offer.line}</span>
          </p>
          <div className="ac-bar__a">
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri" onClick={s.recover}>
              Recuperar cambios sin guardar de las {clockTime(s.offer.at)}
            </button>
            <button type="button" className="vd-link ac-link" onClick={s.dismissOffer}>
              Descartar
            </button>
          </div>
        </div>
      )}
      {c?.kind === "mesa" && (
        <div className="ac-bar" role="status">
          <p className="ac-bar__t">
            <b>Hay {c.count === 1 ? "1 jugada nueva" : `${c.count} jugadas nuevas`} de la mesa</b>
            <span>Llegaron mientras editabas. Se incorporan y se conservan tus cambios.</span>
          </p>
          <div className="ac-bar__a">
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri" onClick={s.takeIn}>
              Incorporar
            </button>
          </div>
        </div>
      )}
      {draftBar && (
        <div className="ac-bar" role="status">
          <p className="ac-bar__t">
            <b>{s.published ? "Borrador encima de lo publicado" : "Borrador guardado"}</b>
            <span>
              {s.draftAt ? `Guardado ${clockTime(s.draftAt)} · ` : ""}
              {s.published ? "la web sigue enseñando lo publicado." : "solo lo ven los capitanes."}
            </span>
          </p>
          <div className="ac-bar__a">
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={onPublishTo}>
              {s.published ? "Publicar la corrección" : "Ir a publicar"}
            </button>
            {s.match.published && (
              <button type="button" className="vd-link ac-link" onClick={() => void s.discardDraft()} aria-disabled={s.busy === "discard" || undefined}>
                Descartar borrador
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** A minute box (digits only, ≤ 150): «12′». */
export function MinuteBox({ value, label, onChange, id }: { value: number | undefined; label: string; onChange: (text: string) => void; id?: string }) {
  return (
    <span className="ac-min">
      <input className="vd-input ac-min__in" data-minute={id} aria-label={label} type="text" inputMode="numeric" maxLength={3} placeholder="min" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      <span className="ac-min__u" aria-hidden="true">
        ′
      </span>
    </span>
  );
}

/** «Ir a los datos del partido», «Abrir la mesa»… the empty states of a station. */
export function ActaEmpty({ title, body, kicker, children }: { title: string; body: string; kicker?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ac-empty">
      {kicker}
      <h2 className="sc-h2">{title}</h2>
      <p className="sc-p">{body}</p>
      {children && <div className="sc-btnrow">{children}</div>}
    </div>
  );
}

/** The acta's foot: where it stands, «Guardar borrador» and the one primary action. */
export function ActaFoot({ s, onPublishTo }: { s: SheetSession; onPublishTo: () => void }) {
  const reason = footReason(s.review, s.published, s.dirty);
  const priOff = s.published ? !s.dirty && !s.serverDraft : false;
  return (
    <footer className="ac-foot sc-primary sc-primary--pin" role="status" aria-live="polite">
      <p className="ac-foot__s">
        <b className="ac-foot__line">{s.saveLine}</b>
        <span>{reason}</span>
      </p>
      <button type="button" className="vd-btn vd-glass vd-press" onClick={() => void s.saveDraft()} aria-disabled={!!s.busy || undefined}>
        {s.busy === "draft" ? "Guardando…" : "Guardar borrador"}
      </button>
      {s.published ? (
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" aria-disabled={priOff || !!s.busy || undefined} onClick={() => (priOff ? s.saveDraft() : void s.publish())}>
          {s.busy === "publish" ? "Guardando…" : "Guardar cambios"}
        </button>
      ) : (
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={onPublishTo}>
          Ir a publicar
        </button>
      )}
    </footer>
  );
}
