// La pizarra ⇄ la mesa, on screen: the strip under the header («Mesa al día» / «Mesa: otro siete», «Mandar
// a la mesa», «Volver a la mesa»: the read-only strip's place and idiom), the «Mandar a la mesa» dialog
// (what changes, row by row: igual / cambia in words and a mark, never colour alone) with its confirmation,
// and in play the «En el campo ahora · 34′» slab at the head of the sheet with «Traer aquí».
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./icons";
import { MESA_STATE_TXT, type DiffRow, type MesaState } from "./mesaLogic";
import "./mesa.css";

// ── the strip ──
export interface MesaStripProps {
  /** The mesa against the board, or «en juego» once the match has kicked off. */
  state: MesaState | "vivo" | "fin";
  /** «Mandar a la mesa» (null: not offered here — no rights, not a match board, or kicked off). */
  onSend: (() => void) | null;
  /** «Volver a la mesa»: a router link dressed as a chip (PizarraPage makes it). */
  back: ReactNode;
}

const STRIP_TXT: Record<MesaStripProps["state"], string> = { ...MESA_STATE_TXT, vivo: "Mesa · en juego", fin: "Mesa · partido terminado" };
/** The plate's value under «MESA»: «Al día», «Otro siete»… */
const STRIP_V: Record<MesaStripProps["state"], string> = { "al-dia": "Al día", otro: "Otro siete", sin: "Sin siete", vivo: "En juego", fin: "Terminado" };

export function MesaStrip({ state, onSend, back }: MesaStripProps) {
  const txt = STRIP_TXT[state];
  return (
    // (a group, not a live region: the board's announcer says when the mesa changes)
    <div className={"mzs mz-" + state} role="group" aria-label={"La mesa del partido: " + txt.toLowerCase()}>
      {/* (a plate: «MESA» over its state, as MEDIA / QUÍMICA / SISTEMA) */}
      <b className="mzs-p" aria-hidden="true">
        {state === "vivo" ? <i className="mz-live" /> : <Icon n={state === "al-dia" ? "check" : state === "fin" ? "whistle" : "alert"} w={16} />}
        <span>
          <small>Mesa</small>
          {STRIP_V[state]}
        </span>
      </b>
      <span className="mzs-a">
        {onSend && (
          <button type="button" className={"b3 mzs-go" + (state === "al-dia" ? "" : " gold")} onClick={onSend} aria-label="Mandar a la mesa">
            <Icon n="whistle" w={16} />
            Mandar<span className="mzs-w"> a la mesa</span>
          </button>
        )}
        {back}
      </span>
    </div>
  );
}

// ── the dialog ──
export interface MesaSendProps {
  /** «J7 · Atlético Demo». */
  matchShort: string;
  rows: DiffRow[] | null;
  /** Why it can't go (not seven, read-only…); null = it can. */
  block: string | null;
  /** The mesa has a lineup to compare with. */
  hasLineup: boolean;
  busy: boolean;
  error: string | null;
  /** After a send: changed or not (null = not sent yet). */
  done: { changed: boolean } | null;
  onSend: () => void;
  onClose: () => void;
  back: ReactNode;
}

const TAG: Record<DiffRow["state"], { n: "check" | "swap"; t: string }> = { igual: { n: "check", t: "Igual" }, cambia: { n: "swap", t: "Cambia" } };

function RowValue({ r }: { r: DiffRow }) {
  if (r.out.length || r.in.length) {
    return (
      <span className="mzr-v">
        {r.out.length > 0 && (
          <span className="mzr-o">
            <small>Sale</small> <s>{r.out.join(", ")}</s>
          </span>
        )}
        {r.in.length > 0 && (
          <span className="mzr-i">
            <small>Entra</small> <b>{r.in.join(", ")}</b>
          </span>
        )}
        {r.note && <em>{r.note}</em>}
      </span>
    );
  }
  return (
    <span className="mzr-v">
      {r.now && <b>{r.now}</b>}
      {r.note && <em>{r.note}</em>}
    </span>
  );
}

export function MesaSend(p: MesaSendProps) {
  const hid = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(p.onClose);
  useEffect(() => {
    close.current = p.onClose;
  });
  // A dialog (as «Mover a…»): focus inside, Tab stays inside, Escape closes, the focus goes back after.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const prev = document.activeElement as HTMLElement | null;
    node.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const f = Array.from(node.querySelectorAll<HTMLElement>("button:not([disabled]):not([tabindex='-1']), a[href]"));
      if (!f.length) return;
      const a = f[0];
      const z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || !node.contains(document.activeElement) || document.activeElement?.tagName === "H3")) {
        e.preventDefault();
        z.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus({ preventScroll: true });
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
  }, []);

  const changes = p.rows?.filter((r) => r.state === "cambia").length ?? 0;
  const lead = !p.hasLineup
    ? "La mesa aún no tiene siete. Al mandarlo, la mesa, la web y el vestuario pasan a este."
    : changes
      ? "La mesa tiene otro siete. Al mandarlo, la mesa, la web y el vestuario pasan a este."
      : "La mesa ya tiene este siete.";
  return (
    <div ref={ref} className="mva mzd" role="dialog" aria-modal="true" aria-labelledby={hid}>
      <button type="button" className="mva-bk" onClick={p.onClose} aria-label="Cerrar" tabIndex={-1} />
      <div className="mva-p mzd-p">
        {p.done ? (
          <div className="mzd-ok" role="status">
            <span className="mzd-ok-i" aria-hidden="true">
              <Icon n="check" w={30} />
            </span>
            <h3 className="lg-h" id={hid} tabIndex={-1}>
              {p.done.changed ? "Siete en la mesa" : "La mesa ya tiene este siete"}
            </h3>
            <p>{p.done.changed ? "La mesa, la web y el vestuario tienen ya este siete. Hasta el pitido, puedes volver a mandarlo." : "No había nada que cambiar: no se ha avisado a nadie."}</p>
            <div className="mzd-a">
              {p.back}
              <button type="button" className="b3" onClick={p.onClose}>
                Seguir en la pizarra
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="lg-h" id={hid} tabIndex={-1}>
              Mandar a la mesa
              <small>{p.matchShort}</small>
            </h3>
            <p className="mzd-s">{p.block ?? lead}</p>
            {p.rows && (
              <ul className="mzd-r" aria-label="Lo que cambia en la mesa">
                {p.rows.map((r) => (
                  <li key={r.k} className={"mzr " + r.state}>
                    <span className="mzr-k">{r.label}</span>
                    <RowValue r={r} />
                    <span className={"mzr-t " + r.state}>
                      <Icon n={TAG[r.state].n} w={13} />
                      {TAG[r.state].t}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {p.error && (
              <p className="mzd-e" role="alert">
                <Icon n="alert" w={15} />
                {p.error}
              </p>
            )}
            <button type="button" className="chb mzd-go" onClick={p.onSend} disabled={!!p.block || p.busy} aria-describedby={p.block ? undefined : hid + "-f"}>
              <span>{p.busy ? "Mandando…" : "Mandar a la mesa"}</span>
              <i aria-hidden="true">
                <Icon n="chevR" w={18} />
              </i>
            </button>
            <p className="mzd-f" id={hid + "-f"}>
              Hasta el pitido. Si alguien lo cambia en la mesa, aquí lo verás al momento.
            </p>
            <button type="button" className="b3 mzd-x" onClick={p.onClose}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── en partido ──
export interface CampoAhoraProps {
  /** «34′», or «Descanso». */
  minute: string;
  /** Who came on for whom (play order). */
  lines: string[];
  /** The seven on the pitch now, «POR Álex · DFC Dani · …». */
  seven: string;
  /** The open board already has the pitch. */
  same: boolean;
  ro: boolean;
  onBring: () => void;
  /** «Volver a la mesa». */
  back: ReactNode;
}

export function CampoAhora({ minute, lines, seven, same, ro, onBring, back }: CampoAhoraProps) {
  return (
    <section className="mzf" aria-label={"En el campo ahora, " + minute.replace("′", " minutos")}>
      <p className="mzf-h">
        <i className="mz-live" aria-hidden="true" />
        <b>En el campo ahora · {minute}</b>
      </p>
      {lines.length ? (
        <ul className="mzf-l">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="mzf-l0">El siete del pitido, sin cambios aún.</p>
      )}
      <p className="mzf-7">{seven}</p>
      <div className="mzf-b">
        <button type="button" className={"b3" + (same ? "" : " gold")} onClick={onBring} disabled={ro || same}>
          <Icon n={same ? "check" : "download"} w={15} />
          {same ? "Ya está aquí" : "Traer aquí"}
        </button>
        {back}
      </div>
    </section>
  );
}
