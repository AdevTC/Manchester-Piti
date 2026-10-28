// ACTA · the acta's history (/admin/partidos/<id>/acta/historial), as its board (part-partido-acta.html § historial,
// H-PAR-05): who changed what and when (Madrid time), newest first, from matchAudit — every publication and
// correction, the draft discarded, the MVP moved by hand, the notas recalculated, the convocatoria, la mesa's
// jugadas and its clock — each with «Ver esta versión» (its revision, who and the exact time). Only captains read it.
// The frame's «‹» goes back to the acta.
import { useMemo, useState } from "react";
import type { DocumentData } from "firebase/firestore";
import { dateMillis } from "../../../../../functions/src/matchEngine";
import { useMatchAudit } from "../../../vestuario/live";
import { clockTime, shortDate } from "../../data/adminLogic";
import { usePartido } from "../../partido/partidoContext";
import { useAdmin } from "../../shell/context";
import { ScreenLoading } from "../../shell/Screen";
import { auditWhat, type AuditDoc } from "./actaModel";
import { ActaNav } from "./parts";
import { useSheetSession } from "./sheetSession";
import "./acta.css";

const toAudit = (id: string, d: DocumentData): AuditDoc => {
  const { at, updatedBy, revision, matchId: _m, ...fields } = d as Record<string, unknown>;
  void _m;
  const ms = dateMillis(at);
  return { id, at: Number.isFinite(ms) ? ms : 0, by: typeof updatedBy === "string" ? updatedBy : "", ...(typeof revision === "number" ? { revision } : {}), fields };
};

export function HistorialScreen() {
  const { match } = usePartido();
  const data = useAdmin();
  // (the acta's edits stay open here, and leaving with them unsaved still asks)
  useSheetSession();
  const q = useMatchAudit(match.id, true, toAudit);
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => [...q.data].sort((a, b) => b.at - a.at), [q.data]);
  const who = (uid: string) => {
    const p = data.people.find((x) => x.uid === uid);
    return p ? `@${p.nickname || p.displayName || "capitán"}` : uid ? "Un capitán" : "El servidor";
  };
  const time = (ms: number) => (ms ? `${shortDate(ms)} · ${clockTime(ms)}` : "Ahora mismo");
  return (
    <section className="ac ac-acta" aria-label="El historial del acta">
      <ActaNav on="historial" />
      <div className="ac-hist">
        <header className="sc-sec__h">
          <h2 className="sc-h2">Historial del acta</h2>
          <span className="sc-sec__n">{rows.length || ""}</span>
        </header>
        <p className="sc-p">Quién cambió qué y cuándo (hora de Madrid). Solo lo ven los capitanes.</p>
        {q.loading && !rows.length ? (
          <ScreenLoading label="Cargando el historial" />
        ) : q.error && !rows.length ? (
          <p className="ac-err" role="alert">
            No se ha podido cargar el historial del acta. Vuelve a intentarlo en un momento.
          </p>
        ) : !rows.length ? (
          <p className="ac-none">Nadie ha tocado el acta todavía.</p>
        ) : (
          <ol className="sc-rows ac-hist__list">
            {rows.map((h) => {
              const w = auditWhat(h);
              const on = open === h.id;
              return (
                <li key={h.id} className="ac-hrow">
                  <div className="ac-hrow__r">
                    <span className="ac-hrow__w sc-small">{time(h.at)}</span>
                    <span className="sc-row__t">
                      <b>{w.what}</b>
                      <span>{who(h.by)}</span>
                    </span>
                    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-expanded={on} aria-label={`Ver esta versión: ${w.what}`} onClick={() => setOpen(on ? null : h.id)}>
                      Ver esta versión
                    </button>
                  </div>
                  {on && (
                    <p className="ac-hrow__d">
                      {[typeof h.revision === "number" ? `Revisión ${h.revision}` : "", w.detail, h.at ? `${who(h.by)} el ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(h.at)}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
