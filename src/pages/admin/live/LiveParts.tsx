// En juego's pieces, as on the canvas: the picker (`.lpk` dialog on desktop, `.sheet` on phones: the
// question, the dorsal grids — on the pitch first, then the banquillo — and the extra buttons), the log
// «Lo que va pasando» (`.evl`), the pads (`.pads`: GOL in gold, Gol rival, Tarjeta, Cambio, «Pitar el
// final y repasar el acta») and the running clock.
import { useId, useState } from "react";
import { useClock } from "../../../hooks/useClock";
import { clockText } from "../data/moments";
import { AdIcon } from "../ui/icons";
import { CloseButton, Dialog, Sheet } from "../ui/layers";
import type { LogRow, PickerView, PickOption, Step } from "./liveModel";

function Grid({ list, bench, onChoose, disabled }: { list: PickOption[]; bench?: boolean; onChoose: (s: Step) => void; disabled: boolean }) {
  return (
    <div className="pg">
      {list.map((o) => (
        <button key={o.id} type="button" className={bench ? "pp bench" : "pp"} onClick={() => onChoose(o.next)} aria-label={o.aria} disabled={disabled}>
          <b>{o.num}</b>
          <small>{o.name}</small>
        </button>
      ))}
    </div>
  );
}
function PickerBody({ view, onChoose, onClose, tid, disabled }: { view: PickerView; onChoose: (s: Step) => void; onClose: () => void; tid: string; disabled: boolean }) {
  return (
    <>
      <div className="pkh">
        <span>
          <small>{view.step}</small>
          <b id={tid}>{view.question}</b>
        </span>
        <CloseButton onClick={onClose} />
      </div>
      {view.label ? <p className="pk-lb">{view.label}</p> : null}
      {view.options.length ? <Grid list={view.options} onChoose={onChoose} disabled={disabled} /> : null}
      {view.bench ? (
        <>
          <p className="pk-lb">Banquillo</p>
          <Grid list={view.bench} bench onChoose={onChoose} disabled={disabled} />
        </>
      ) : null}
      {view.extras.length ? (
        <div className="pkx">
          {view.extras.map((x) => (
            <button key={x.key} type="button" onClick={() => onChoose(x.next)} disabled={disabled}>
              {x.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
/** The pads' picker: a centred dialog on desktop, a bottom sheet on phones. */
export function LivePicker({ view, onChoose, onClose, mobile, disabled = false }: { view: PickerView | null; onChoose: (s: Step) => void; onClose: () => void; mobile: boolean; disabled?: boolean }) {
  const tid = useId();
  if (!view) return null;
  const body = <PickerBody view={view} onChoose={onChoose} onClose={onClose} tid={tid} disabled={disabled} />;
  return mobile ? (
    <Sheet open onClose={onClose} labelledBy={tid}>
      {body}
    </Sheet>
  ) : (
    <Dialog open onClose={onClose} className="lpk" labelledBy={tid}>
      {body}
    </Dialog>
  );
}

/** `.evl`: the events, newest first; rows written after it mounted rise in. */
export function LiveLog({ rows, label }: { rows: LogRow[]; label?: string }) {
  const [initial] = useState(() => new Set(rows.map((r) => r.id)));
  return (
    <ul className="evl" aria-label={label}>
      {rows.map((e) => (
        <li key={e.id} className={[e.cls, initial.has(e.id) ? "" : "fresh"].filter(Boolean).join(" ") || undefined}>
          <span className="m">{e.minute}′</span>
          <span className="ic">{e.icon ? <AdIcon name={e.icon} size={18} /> : null}</span>
          <span>
            {e.text} {e.detail ? <small>{e.detail}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** `.pads`: the one-tap buttons. GOL is gold (THE action of the moment). */
export function LivePads({ onGol, onRival, onTarjeta, onCambio, onPitar, disabled = false }: { onGol: () => void; onRival: () => void; onTarjeta: () => void; onCambio: () => void; onPitar: () => void; disabled?: boolean }) {
  return (
    <div className="pads">
      <button type="button" className="pad gol" onClick={onGol} disabled={disabled}>
        <AdIcon name="ball" size={24} />
        GOL
      </button>
      <button type="button" className="pad" onClick={onRival} disabled={disabled}>
        Gol rival
      </button>
      <button type="button" className="pad" onClick={onTarjeta} disabled={disabled}>
        <AdIcon name="card" size={20} />
        Tarjeta
      </button>
      <button type="button" className="pad" onClick={onCambio} disabled={disabled}>
        <AdIcon name="swap" size={20} />
        Cambio
      </button>
      <button type="button" className="pad fin" onClick={onPitar}>
        <AdIcon name="whistle" size={20} />
        Pitar el final y repasar el acta
      </button>
    </div>
  );
}

/** «31:12» since kick-off, ticking every second (only this text re-renders). */
export function LiveClock({ start }: { start: number }) {
  const now = useClock(1000);
  return <span>{clockText(start, now)}</span>;
}
