// CLUB · Equipaciones (/admin/club/equipaciones; board part-club.html § equipaciones, M-19): the two kits as the web
// shows them (El club › El equipo: their line and their colours), editable — saved in clubContent.kits, read by the web
// at once; with nothing saved the web shows the ones in its code («las de siempre»), and «Volver a las de siempre»
// takes the saved ones away. Saved with «Guardar las equipaciones» (the draft stays if you leave: B-CLUB-09).
import { useState } from "react";
import { deleteField, doc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase";
import { useShirtStills } from "../../../../components/jersey3d/useShirtStills";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { apiError } from "../../../../lib/clubApi";
import { useClubContent } from "../../../../lib/clubContent";
import type { ClubKit } from "../../../../lib/clubContentDefaults";
import { DEFAULT_KITS, readKits, type KitId } from "../../../../lib/clubExtras";
import { SalaSheet } from "../../shell/Sheet";
import { useShell } from "../../shell/context";
import { useStatus } from "../../shell/statusContext";
import { useUnsavedGuard } from "../../ui/guard";
import { useRoomDraft } from "./drafts";
import { RoomScreen } from "./Room";

const IDS: KitId[] = ["home", "away"];
const WORD: Record<KitId, { name: string; line: string }> = { home: { name: "1ª equipación", line: "En casa · la de los stills de la plantilla" }, away: { name: "2ª equipación", line: "Fuera · cuando el rival viste parecido" } };
const HEX = /^#[0-9a-fA-F]{6}$/;
type EqDraft = Record<KitId, ClubKit>;

function kitErrors(k: ClubKit): string[] {
  const e: string[] = [];
  if (!k.note.trim()) e.push("falta la línea que la describe");
  if (k.note.length > 200) e.push("la línea pasa de 200 letras");
  if ((k.name ?? "").length > 30) e.push("el nombre pasa de 30 letras");
  if (!k.colors.length || k.colors.length > 4) e.push("entre 1 y 4 colores");
  if (k.colors.some((c) => !c.name.trim() || c.name.length > 20)) e.push("cada color con su nombre (hasta 20 letras)");
  if (k.colors.some((c) => !HEX.test(c.hex))) e.push("un color no es #rrggbb");
  return e;
}
const clean = (k: ClubKit): ClubKit => ({ ...(k.name?.trim() ? { name: k.name.trim() } : {}), note: k.note.trim(), colors: k.colors.map((c) => ({ name: c.name.trim(), hex: c.hex.toLowerCase() })) });

export function EquipacionesScreen() {
  const status = useStatus();
  const { theme } = useShell();
  const content = useClubContent();
  const kits = readKits(content);
  const saved = kits.home.saved || kits.away.saved;
  const [draft, setDraft] = useRoomDraft<EqDraft>("eq");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [reset, setReset] = useState(false);
  const cur: EqDraft = draft ?? { home: { name: kits.home.name, note: kits.home.note, colors: kits.home.colors }, away: { name: kits.away.name, note: kits.away.note, colors: kits.away.colors } };
  const still = useShirtStills(IDS.map((kit) => ({ kit, theme, name: "", num: "" })));
  const errs = IDS.flatMap((id) => kitErrors(cur[id]).map((x) => `${WORD[id].name}: ${x}`));

  const edit = (id: KitId, patch: Partial<ClubKit>) => setDraft({ ...cur, [id]: { ...cur[id], ...patch } });
  const save = async (): Promise<boolean> => {
    if (!draft) return false;
    if (errs.length) {
      setErr(`Falta para guardar: ${errs[0]}`);
      return false;
    }
    setSaving(true);
    setErr("");
    const sending = draft;
    try {
      await setDoc(doc(db, "clubContent", "main"), { kits: { home: clean(sending.home), away: clean(sending.away) } }, { merge: true });
      setDraft((d) => (d === sending ? null : d));
      status.show({ tag: "Equipaciones", message: "Equipaciones guardadas · El club ya las enseña" });
      return true;
    } catch (e) {
      setErr(`No se han podido guardar las equipaciones: ${apiError(e).replace(/.$/, "")}. Tus cambios siguen aquí.`);
      status.show({ tone: "error", message: "No se han podido guardar las equipaciones", retry: () => void save() });
      return false;
    } finally {
      setSaving(false);
    }
  };
  useUnsavedGuard(!!draft, { what: "las equipaciones", alt: { label: "Guardar y salir", run: () => save() } });
  const backToDefault = async () => {
    setReset(false);
    try {
      await setDoc(doc(db, "clubContent", "main"), { kits: deleteField() }, { merge: true });
      setDraft(null);
      status.show({ tag: "Equipaciones", message: "La web vuelve a enseñar las equipaciones de siempre" });
    } catch (e) {
      status.show({ tone: "error", message: `No se ha podido: ${apiError(e)}` });
    }
  };

  return (
    <RoomScreen
      room="equipaciones"
      lede={saved ? "Guardadas en la web · El club › El equipo las enseña" : "Las de siempre: viven en el código de la web hasta que guardes unas"}
      primary={draft ? { label: saving ? "Guardando…" : "Guardar las equipaciones", onClick: () => void save(), disabled: saving || errs.length > 0, why: errs[0] } : null}
    >
      {err && (
        <p className="cl-alert" role="alert">
          {err}
        </p>
      )}
      {draft && (
        <p className="cl-dirty">
          <span className="sc-tag sc-tag--toca">Sin guardar</span>
          <span>La web sigue enseñando las de antes.</span>
          <button type="button" className="vd-link" onClick={() => { setDraft(null); setErr(""); }}>
            Descartar los cambios
          </button>
        </p>
      )}
      <div className="cl-grid cl-eq">
        {IDS.map((id) => {
          const k = cur[id];
          const src = still({ kit: id, theme, name: "", num: "" });
          return (
            <section key={id} className="cl-kit cl-col sc-scroll" aria-labelledby={`cl-kit-${id}`}>
              {src ? <img className="sc-shirt sc-shirt--xl" src={src} alt={`La ${WORD[id].name}, por detrás`} width={540} height={600} /> : <span className="sc-shirt sc-shirt--xl" role="img" aria-label={`La ${WORD[id].name}`} />}
              <div>
                <h2 className="sc-h2" id={`cl-kit-${id}`}>
                  {WORD[id].name}
                </h2>
                <p className="sc-small">
                  {WORD[id].line} · {kits[id].saved && !draft ? "guardada" : draft ? "sin guardar" : "la de siempre"}
                </p>
                <ul className="cl-colors" aria-label={`Colores de la ${WORD[id].name}`}>
                  {k.colors.map((c, i) => (
                    <li key={i}>
                      <i className="cl-sw" style={{ background: HEX.test(c.hex) ? c.hex : "transparent" }} aria-hidden="true" />
                      {c.name || "Sin nombre"}
                    </li>
                  ))}
                </ul>
                <div className="sc-form sc-form--1" style={{ marginTop: 14 }}>
                  <label className="sc-field">
                    <span>Cómo es (sale en El club › El equipo)</span>
                    <textarea className="vd-input" maxLength={200} value={k.note} onChange={(e) => edit(id, { note: e.target.value })} aria-invalid={!k.note.trim() || undefined} />
                    <small className={!k.note.trim() ? "is-bad" : ""}>{k.note.trim() ? `${k.note.length}/200` : "Escribe cómo es"}</small>
                  </label>
                </div>
                <h3 className="sc-h3 cl-sub">Colores</h3>
                {k.colors.map((c, i) => (
                  <div key={i} className="cl-color">
                    <input type="color" value={HEX.test(c.hex) ? c.hex : "#000000"} aria-label={`Color ${i + 1} de la ${WORD[id].name}`} onChange={(e) => edit(id, { colors: k.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)) })} />
                    <label className="sc-field">
                      <span>Nombre del color {i + 1}</span>
                      <input className="vd-input" type="text" maxLength={20} value={c.name} onChange={(e) => edit(id, { colors: k.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    </label>
                    <label className="sc-field cl-hex">
                      <span>Código</span>
                      <input className="vd-input" type="text" maxLength={7} value={c.hex} onChange={(e) => edit(id, { colors: k.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value.trim() } : x)) })} aria-invalid={!HEX.test(c.hex) || undefined} />
                    </label>
                    <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={`Quitar el color ${c.name || i + 1}`} aria-disabled={k.colors.length <= 1 || undefined} onClick={() => k.colors.length > 1 && edit(id, { colors: k.colors.filter((_, j) => j !== i) })}>
                      <VIcon name="close" size={16} />
                    </button>
                  </div>
                ))}
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm cl-addrow" aria-disabled={k.colors.length >= 4 || undefined} onClick={() => k.colors.length < 4 && edit(id, { colors: [...k.colors, { name: "", hex: DEFAULT_KITS[id].colors[0].hex }] })}>
                  <VIcon name="plus" size={16} />
                  Añadir un color
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {saved && (
        <p className="sc-small cl-foot">
          <button type="button" className="vd-link" aria-haspopup="dialog" onClick={() => setReset(true)}>
            Volver a las de siempre
          </button>
        </p>
      )}
      <SalaSheet
        open={reset}
        onClose={() => setReset(false)}
        title="¿Volver a las equipaciones de siempre?"
        center
        className="cl-sheet"
        footer={
          <>
            <button type="button" className="vd-btn vd-glass vd-press" onClick={() => setReset(false)}>
              Cancelar
            </button>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={() => void backToDefault()}>
              Volver a las de siempre
            </button>
          </>
        }
      >
        <p className="sc-p">Se quitan las guardadas: la web vuelve a enseñar las del código («Celeste de la casa…», «Negra de fuera…»).</p>
      </SalaSheet>
    </RoomScreen>
  );
}
