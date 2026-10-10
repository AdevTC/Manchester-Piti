// The one convocatoria's writer (Hoy's peg wall, Convocar): change el siete / the banquillo of a match and
// announce it, through the setConvocatoria callable.
//   · set(next) shows the change at once and writes it (notify:false). Taps in a row are serialized (the
//     last one wins); what is shown stays the local lineup until the match's `convocatoriaAt` reaches the
//     stamp the last write returned (no flash back while the snapshot travels).
//   · publish() — «Convocar y avisar»: the lower third with «Deshacer» first, then setConvocatoria
//     (notify:true) after its 5.2 s; «Deshacer» means nobody gets a notice.
import { useRef, useState } from "react";
import { apiError, setConvocatoria, type SetConvocatoriaResult } from "../../../lib/clubApi";
import { useToast } from "../ui/toastContext";
import type { AdminMatch } from "./adminLogic";
import { convocatoriaStatus, lineupOf, sameLineup, type ConvocatoriaStatus, type Lineup } from "./lineup";

interface Overlay {
  matchId: string;
  lineup: Lineup;
  /** The stamp the last write returned (null while it travels). */
  at: number | null;
}
interface Publishing {
  matchId: string;
  /** The notice's stamp once written (null while it waits behind «Deshacer» or travels). */
  at: number | null;
}
export interface ConvocatoriaApi {
  /** What to show: the local change while it is being written, else the match's. */
  lineup: Lineup;
  status: ConvocatoriaStatus;
  /** Shows and writes a new lineup (quietly). */
  set: (next: Lineup) => void;
  /** «Convocar y avisar»: `message` / `tag` = the lower third (with «Deshacer»). */
  publish: (o: { message: string; tag: string }) => void;
}

export function useConvocatoria(match: AdminMatch | null): ConvocatoriaApi {
  const toast = useToast();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [publishing, setPublishing] = useState<Publishing | null>(null);
  const queue = useRef<{ running: boolean; next: { matchId: string; lineup: Lineup } | null }>({ running: false, next: null });

  const id = match?.id ?? "";
  const serverAt = match?.convocatoriaAt ?? 0;
  const local = overlay && overlay.matchId === id && (overlay.at === null || serverAt < overlay.at) ? overlay.lineup : null;
  const lineup = local ?? lineupOf(match);
  const server = convocatoriaStatus(match);
  const pub = publishing && publishing.matchId === id && (publishing.at === null || (match?.convocatoriaNotifiedAt ?? 0) < publishing.at);
  // Being announced (it carries what is shown): published. A local change after a notice: announce again.
  const status: ConvocatoriaStatus = pub ? { notified: true, published: true, changed: false } : local && server.notified ? { notified: true, published: false, changed: true } : server;

  const write = (matchId: string, l: Lineup) => {
    const q = queue.current;
    if (q.running) {
      q.next = { matchId, lineup: l };
      return;
    }
    q.running = true;
    setConvocatoria({ matchId, starters: l.starters, bench: l.bench, notify: false }).then(
      (res) => {
        q.running = false;
        const more = q.next;
        q.next = null;
        if (more) write(more.matchId, more.lineup);
        else setOverlay((o) => (o && o.matchId === matchId && sameLineup(o.lineup, l) ? { ...o, at: res.data.at } : o));
      },
      (e: unknown) => {
        q.running = false;
        q.next = null;
        setOverlay(null);
        toast.show({ tone: "error", message: `No se ha podido guardar la convocatoria: ${apiError(e)}` });
      },
    );
  };

  const set = (next: Lineup) => {
    if (!match) return;
    setOverlay({ matchId: match.id, lineup: next, at: null });
    // a change after «Convocar y avisar» asks to announce it again
    setPublishing(null);
    write(match.id, next);
  };

  const publish = ({ message, tag }: { message: string; tag: string }) => {
    if (!match) return;
    const matchId = match.id;
    const l = lineup;
    setPublishing({ matchId, at: null });
    toast.defer({
      message,
      tag,
      errorMessage: "No se ha podido avisar",
      commit: () => setConvocatoria({ matchId, starters: l.starters, bench: l.bench, notify: true }),
      onUndo: () => setPublishing(null),
      onError: () => setPublishing(null),
      onDone: (result) => {
        const res = result as { data: SetConvocatoriaResult };
        setPublishing({ matchId, at: res.data.at });
        if (!res.data.notice) toast.show({ tag, message: "Convocatoria al día · el aviso ya había salido" });
      },
    });
  };

  return { lineup, status, set, publish };
}
