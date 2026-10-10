// Convocatorias — partido a partido (the next three to play, J8 / J9 / J10, as a segmented control; the
// one in ?j= too): the sticky counters (titulares x/7, suplentes, no, sin asignar) with rival · fecha ·
// RSVP from the members' answers, and a row per player with their answer and Titular / Suplente / No
// (max seven titulares, unassigned rows outlined amber). «Publicar y avisar» publishes the convocatoria
// (saveMatchSheet) behind an undo window; the backend then sends the «Ya está la convocatoria» notice
// once per match. «Guardar borrador» keeps it private; edits are mirrored on this device (recovery).
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { apiError, saveMatchSheet } from "../../../lib/clubApi";
import { clockTime, jLabel, rsvpCounts, shortDate, type AdminMatch } from "../data/adminLogic";
import type { AdminData } from "../data/useAdminData";
import { AdminView } from "../shell/AdminView";
import { useAdmin, useAdminGo } from "../shell/context";
import { EmptyState, Segmented, SkeletonRows } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { useUnsavedGuard } from "../ui/guard";
import { useToast } from "../ui/toastContext";
import { assign, lineupCounts, lineupProblem, lineupReady, previousLineup, type Lineup, type Role } from "../acta/convocatoria";
import { rosterFor } from "../acta/roster";
import { fromMatch, toPayload } from "../acta/sheetModel";
import { ConvocatoriaRows } from "../partidos/ConvocatoriaRows";
import { upcomingMatches } from "../partidos/listModel";
import { useMatchNote, useMatchRsvp } from "../partidos/live";
import { LineupTools } from "../partidos/TabConvocatoria";
import { useEditBuffer } from "../partidos/useEditBuffer";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const isLineup = (v: unknown): v is Lineup => {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const ids = (x: unknown) => Array.isArray(x) && x.every((i) => typeof i === "string");
  return ids(o.starters) && ids(o.bench) && ids(o.notCalled);
};
const lineupOf = (m: Pick<AdminMatch, "starters" | "bench" | "notCalled">): Lineup => ({ starters: [...(m.starters ?? [])], bench: [...(m.bench ?? [])], notCalled: [...(m.notCalled ?? [])] });
const LEAD = "Titular, suplente o no convocado, partido a partido. Máximo siete titulares.";

function Shell({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <AdminView kicker="Jornada" title="Convocatorias" lead={LEAD} actions={actions}>
      {children}
    </AdminView>
  );
}

export function Convocatorias() {
  const data = useAdmin();
  const search = useSearch({ strict: false }) as { j?: string | number };
  const wanted = search.j === undefined ? undefined : String(search.j);
  const navigate = useNavigate();
  const go = useAdminGo();
  const list = useMemo(() => upcomingMatches(data.matches, data.now, wanted), [data.matches, data.now, wanted]);
  const match = list.find((m) => m.id === wanted) ?? list[0];
  if (data.loading)
    return (
      <Shell>
        <div className="vb cd tbl">
          <div className="scr ad-cvpad">
            <SkeletonRows rows={6} label="Cargando las convocatorias…" />
          </div>
        </div>
      </Shell>
    );
  if (!match)
    return (
      <Shell>
        <div className="vb cd tbl">
          <div className="scr ad-cvpad">
            <EmptyState icon="cal" title="No hay partidos por jugar">
              Programa el siguiente y aquí podrás convocar.
            </EmptyState>
            <div className="row ad-ml-new">
              <button type="button" className="btn sm gold" onClick={() => go({ section: "partidos", nuevo: true })}>
                <AdIcon name="plus" size={16} />
                Nuevo partido
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  return <ConvPanel key={match.id} match={match} list={list} data={data} onPick={(id) => void navigate({ to: "/admin/convocatorias", search: { j: id } })} />;
}

function ConvPanel({ match, list, data, onPick }: { match: AdminMatch; list: AdminMatch[]; data: AdminData; onPick: (id: string) => void }) {
  const note = useMatchNote(match.id);
  const rsvp = useMatchRsvp(match.id);
  const toast = useToast();
  const server = useMemo(() => lineupOf(match), [match]);
  const buf = useEditBuffer(server, "conv", match.id, isLineup);
  const lineup = buf.value;
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const roster = useMemo(() => rosterFor(data.players, data.seasons, match.seasonId), [data.players, data.seasons, match.seasonId]);
  const ids = roster.map((p) => p.id);
  const c = lineupCounts(lineup, ids);
  const ready = lineupReady(c);
  const live = !buf.dirty && ((match.published && !match.draft && ready) || sent);
  const j = jLabel(match);
  const t = dateMillis(match.date);
  const r = rsvpCounts(rsvp.data, ids);
  const answers = r.yes + r.maybe + r.no;
  const prev = previousLineup(data.matches, match);

  const payloadFor = (l: Lineup, draft: boolean) => toPayload({ ...fromMatch(match, note.data), ...l }, draft, () => "");
  const save = async (fromGuard = false): Promise<boolean> => {
    if (note.loading) return false;
    const saved = lineup;
    const p = payloadFor(saved, true);
    if (!p.ok) {
      toast.show({ tone: "error", message: `No se puede guardar: ${p.error}` });
      if (fromGuard) buf.keepMirror();
      return false;
    }
    setBusy(true);
    try {
      await saveMatchSheet({ id: match.id, sheet: p.sheet, draft: true });
      buf.commit(saved);
      toast.show({ message: `Convocatoria de la ${j} guardada en borrador · solo la ven los capitanes.` });
      return true;
    } catch (e) {
      if (fromGuard) buf.keepMirror();
      toast.show({ tone: "error", message: `No se ha podido guardar la convocatoria: ${apiError(e)}${fromGuard ? " Los cambios siguen en este dispositivo." : ""}`, retry: fromGuard ? undefined : () => void save() });
      return false;
    } finally {
      setBusy(false);
    }
  };
  useUnsavedGuard(buf.dirty, {
    what: `la convocatoria de la ${j}`,
    alt: {
      label: "Guardar borrador y salir",
      run: async () => {
        await save(true);
      },
    },
  });

  const setRole = (id: string, role: Role) => {
    const res = assign(lineup, id, role, roster.find((p) => p.id === id)?.name);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg("");
    setSent(false);
    buf.set(res.lineup);
  };

  const publish = () => {
    if (busy || note.loading || live) return;
    if (!ready) {
      setMsg(lineupProblem(c));
      return;
    }
    const saved = lineup;
    const p = payloadFor(saved, false);
    if (!p.ok) {
      toast.show({ tone: "error", message: `No se puede publicar: ${p.error}` });
      return;
    }
    const before = buf.base;
    const already = match.published && !match.draft && (match.starters?.length ?? 0) > 0;
    const back = () => {
      setSent(false);
      buf.commit(before);
    };
    setMsg("");
    // Shown as published at once; the write (and with it the notice) waits behind «Deshacer».
    buf.commit(saved);
    setSent(true);
    toast.defer({
      message: already ? `Convocatoria de la ${j} actualizada · el aviso ya había salido.` : `Convocatoria de la ${j} publicada · aviso enviado.`,
      commit: () => saveMatchSheet({ id: match.id, sheet: p.sheet, draft: false }),
      onUndo: back,
      onError: back,
      errorMessage: "No se ha podido publicar la convocatoria",
    });
  };

  const options = list.map((m) => ({ value: m.id, label: `${jLabel(m)} · ${(m.rivalInitials || m.rival || "?").slice(0, 3).toUpperCase()}` }));
  const pubOff = !ready || live || busy || note.loading;
  return (
    <Shell
      actions={
        <>
          <button type="button" className="btn sm line" onClick={() => buf.dirty && !busy && void save()} aria-disabled={!buf.dirty || busy || note.loading}>
            {busy ? "Guardando…" : "Guardar borrador"}
          </button>
          <button type="button" className="btn sm gold" onClick={publish} aria-disabled={pubOff}>
            <AdIcon name="bell" size={16} />
            {live ? "Publicada y avisada" : "Publicar y avisar"}
          </button>
        </>
      }
    >
      <div className="vb cd tbl">
        <div className="tools">
          <Segmented label="Partido" value={match.id} options={options} onChange={(id) => id !== match.id && onPick(id)} />
        </div>
        <div className="cvh" role="group" aria-label="Recuento">
          <span className={`chip ${c.starters === 7 ? "ok" : "warn"}`}>{c.starters} de 7 titulares</span>
          <span className="chip">{plural(c.bench, "suplente", "suplentes")}</span>
          <span className="chip">{c.notCalled} no</span>
          <span className={`chip ${c.unassigned ? "warn" : "ok"}`}>{c.unassigned} sin asignar</span>
          <span className="cnt">
            {match.rival ?? "Rival"} · {Number.isFinite(t) ? `${shortDate(t)} · ${clockTime(t)}` : "sin fecha"} · {answers ? `${plural(r.yes, "viene", "vienen")}, ${r.maybe} en duda, ${r.no} no` : "aún sin respuestas"}
            {live ? " · publicada" : buf.dirty ? " · cambios sin guardar" : match.draft ? " · borrador" : ""}
          </span>
        </div>
        {msg && (
          <p className="note ad-cvmsg" role="alert">
            <AdIcon name="alert" size={15} />
            {msg}
          </p>
        )}
        <div className="scr ad-cvpad">
          {buf.offer && !buf.dirty && (
            <div className="ad-rec" role="status">
              <AdIcon name="undo" size={16} />
              <span>
                <b>Hay cambios sin guardar en este dispositivo</b>
                <small>De las {clockTime(buf.offer.at)}.</small>
              </span>
              <span className="row">
                <button type="button" className="btn sm pri" onClick={buf.recover}>
                  Recuperar cambios sin guardar de {clockTime(buf.offer.at)}
                </button>
                <button type="button" className="btn sm line" onClick={buf.dismissOffer}>
                  Descartar
                </button>
              </span>
            </div>
          )}
          <LineupTools
            lineup={lineup}
            roster={roster}
            previous={prev ? { label: jLabel(prev), lineup: lineupOf(prev) } : null}
            onChange={(l) => {
              setSent(false);
              buf.set(l);
            }}
          />
          {roster.length ? (
            <ConvocatoriaRows roster={roster} lineup={lineup} onSet={setRole} rsvp={rsvp.data} forWhat={`para la ${j}`} />
          ) : (
            <p className="hint">Nadie en la plantilla de esta temporada: asocia jugadores desde Plantilla.</p>
          )}
        </div>
      </div>
    </Shell>
  );
}
