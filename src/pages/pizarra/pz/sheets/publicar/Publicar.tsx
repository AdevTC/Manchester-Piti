// r14 «La pizarra» · «Publicar el siete» (PZ-M14): publishing always confirms, with its consequences in words
// (the titular and the versions that go with it, the notice, the official it replaces), the convocatoria as a
// switch, the titular's warnings; then «Publicado» with «Preparar la charla».
import { useEffect, useState } from "react";
import { usePz } from "../../store/context";
import { PzIcon } from "../../campo/Shirt";
import { conseq, publishCheck } from "../../places/siete/sieteView";
import "../../../../../styles/pz/siete.css";

export function PublicarSheet() {
  const P = usePz();
  const [conv, setConv] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ boardId: string; started: boolean; conv: boolean } | null>(null);
  useEffect(
    () =>
      P.on("publish", (d) => {
        const x = d as { boardId?: string; started?: boolean };
        setDone({ boardId: x.boardId ?? "", started: !!x.started, conv: false });
      }),
    [P],
  );
  const b = P.sel.board();
  const pub = publishCheck(P);
  const M = pub.M;
  const J = M?.j ? "J" + M.j : "";
  const m = P.sel.me();
  // (a draft gets its real id when it is published: the sheet that published it says so whatever the id)
  if (done) {
    return (
      <div className="pz-sh pz-7 is-flow">
        <div className="pz-7__done" role="status">
          <span className="vx-tile">
            <PzIcon name="check" />
          </span>
          <b>{J ? "Publicado · el oficial de la " + J : "Publicado · el siete oficial"}</b>
          <p className="pz-line">{done.started ? "Sin aviso: el partido ya había empezado." : "El equipo recibe «Ya está el siete»" + (done.conv ? " y la convocatoria es este siete." : ".")}</p>
          <div className="pz-acts">
            <button
              type="button"
              className="vd-glass vd-press pz-btn pz-btn--pri"
              onClick={() => {
                P.act.closeSheet();
                P.nav("/pizarra/charla");
              }}
            >
              <PzIcon name="mic" />
              Preparar la charla
            </button>
            <button type="button" className="nx-lnk" onClick={() => P.act.closeSheet()}>
              Volver al siete
            </button>
          </div>
        </div>
      </div>
    );
  }
  const block = !m.cap ? "Solo los capitanes publican el siete oficial." : pub.block;
  const convOk = !!M && !pub.started && m.cap;
  const go = async () => {
    if (busy || block) return;
    setBusy(true);
    const want = convOk && conv;
    try {
      await P.act.publish({ convocatoria: want });
      setDone((d) => (d ? { ...d, conv: want && !d.started } : d));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pz-sh pz-7 is-flow">
      {block && (
        <div className="pz-7__warn" role="alert">
          <b>Aún no se puede publicar</b>
          <span>{block}</span>
        </div>
      )}
      <ul className="pz-7__conseq">
        {conseq(P).map((c) => (
          <li key={c.t}>
            <span className="vx-tile">
              <PzIcon name={c.icon} />
            </span>
            <div>
              <b>{c.t}</b>
              <span>{c.s}</span>
            </div>
          </li>
        ))}
      </ul>
      {convOk && (
        <button type="button" className="vx-tog" aria-pressed={conv} onClick={() => setConv(!conv)}>
          <span className="vx-tog__t" aria-hidden="true" />
          {conv ? "La convocatoria de la " + (J || "jornada") + " pasa a ser este siete" : "La convocatoria se queda como está"}
        </button>
      )}
      {pub.warns.length > 0 && (
        <div className="pz-7__warn">
          <b>Avisos del titular</b>
          {pub.warns.map((w) => (
            <span key={w.t}>{w.t}</span>
          ))}
        </div>
      )}
      <div className="pz-acts">
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => void go()} disabled={!!block || busy} aria-busy={busy}>
          <PzIcon name="send" />
          {busy ? "Publicando…" : b?.isOfficial ? "Avisar del cambio" : pub.warns.length ? "Publicar igualmente" : "Publicar"}
        </button>
        <button type="button" className="nx-lnk" onClick={() => P.act.closeSheet()}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
