// The match's «Convocatoria» tab — read only, as on the canvas (stats-gen/ad-v2-full.mjs `cvT`): el siete in
// shirts, the banquillo, the «Una sola convocatoria» note and «Cambiarla en Convocar» (→ /admin/convocar?j=)
// while the match is still to play; once played the convocatoria is closed (the acta's changes adjust the
// minutes) — unless it was never completed (a played acta without its seven: «Completarla en Convocar»).
// There is ONE convocatoria: Convocar writes it; this tab, the pizarra and the acta read it.
import { Peg } from "../kit";
import { AdIcon } from "../ui/icons";
import { positionCode } from "../acta/roster";

const SEVEN = 7;

export function TabConvocatoria({
  starters,
  bench,
  info,
  mode,
  onConvocar,
}: {
  starters: readonly string[];
  bench: readonly string[];
  info: (id: string) => { name: string; number: number | null; position: string };
  /** cambiar = still to play · completar = played without its seven · cerrada = played · cancelado. */
  mode: "cambiar" | "completar" | "cerrada" | "cancelado";
  onConvocar: () => void;
}) {
  const seven = [...starters.slice(0, SEVEN), ...Array.from({ length: Math.max(0, SEVEN - starters.length) }, () => null)];
  return (
    <div className="cvr">
      <div className="s7r" role="group" aria-label={`El siete · ${Math.min(starters.length, SEVEN)} de ${SEVEN}`}>
        {seven.map((id, i) => {
          if (!id) return <Peg key={`free-${i}`} label="Libre" size={64} big state="empty" />;
          const p = info(id);
          return <Peg key={id} num={p.number ?? ""} shirtName={p.name} label={p.name} sub={positionCode(p.position)} size={64} big />;
        })}
      </div>
      <p className="ch3">
        Banquillo{" "}
        <em>
          {bench.length
            ? bench.map((id) => {
                const p = info(id);
                return (
                  <span key={id} className="bqi">
                    {p.number ?? ""} {p.name}
                  </span>
                );
              })
            : "nadie todavía"}
        </em>
      </p>
      <div className="src">
        <AdIcon name="shirt" size={20} />
        <span>
          <b>Una sola convocatoria.</b> Esta pestaña lee de Convocar, igual que la pizarra (el siete oficial) y el acta (titulares y suplentes).
        </span>
      </div>
      {mode === "cambiar" || mode === "completar" ? (
        <div className="cta-row">
          <button type="button" className="btn line" onClick={onConvocar}>
            <AdIcon name="shirt" size={18} />
            {mode === "cambiar" ? "Cambiarla en Convocar" : "Completarla en Convocar"}
          </button>
          {mode === "completar" && <span className="warn">Sin el siete completo el acta no se puede publicar</span>}
        </div>
      ) : (
        <p className="hint">{mode === "cancelado" ? "Partido cancelado: no hay convocatoria que cambiar." : "Partido jugado: la convocatoria queda cerrada; los cambios del acta ajustan los minutos."}</p>
      )}
    </div>
  );
}
