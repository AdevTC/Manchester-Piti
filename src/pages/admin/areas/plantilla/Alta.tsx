// PLANTILLA · el alta (/admin/plantilla/alta[?dorsal=N]), as the board's part-plantilla.html § Alta: «Camiseta nueva»,
// the plain kit stamped while you type (the only print that is not a still: law 8, in the kit's Barlow Condensed, the
// web's own drawPrint), the name on the shirt (2–12 capitals) and a free dorsal (the free ones a tap away), the line and
// the map (optional: the first tap is the preferida, the next ones «también»), the seasons, and «Dar de alta» (Enter
// too), which opens his new ficha behind «Deshacer». What is typed stays while you look elsewhere. A guest of the
// convocatorias who comes from Antiguos (M-41) brings his name and, once the ficha is written, his matches as a guest
// pass to it (promoteGuest).
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSearch } from "@tanstack/react-router";
import { apiError, promoteGuest } from "../../../../lib/clubApi";
import { plural } from "../../../../lib/derived/words";
import { lineOf, type Line } from "../../../../lib/positions";
import { drawPrint } from "../../../home/portada/print";
import { dorsalParam, freeDorsals } from "../../club/plantillaBoard";
import { checkPlayerForm, dorsalLine, emptyForm, playerPayload, previewDoc } from "../../club/plantillaLogic";
import { useSalaGo } from "../../shell/salaHref";
import { SalaScreen } from "../../shell/Screen";
import { useStatus } from "../../shell/statusContext";
import { useFrame } from "../../ui/frame";
import { Mapa } from "./Mapa";
import { tapSpot } from "./mapModel";
import { LINE_ONE, liveSeasons } from "./model";
import { PlNav } from "./parts";
import { usePlantilla, type AltaDraft } from "./storeContext";

const EMPTY: AltaDraft = { name: "", num: "", line: "", main: null, also: [], seasons: null, guests: [] };

/** The plain kit with the print over it: what is typed in ink, the empty parts as a ghost («NOMBRE», «00»). */
function Kit({ src, name, num }: { src: string | undefined; name: string; num: string }) {
  const ink = useRef<HTMLCanvasElement>(null);
  const ghost = useRef<HTMLCanvasElement>(null);
  const [fonts, setFonts] = useState(0);
  useEffect(() => {
    let on = true;
    void document.fonts?.load('700 64px "Barlow Condensed"').then(() => on && setFonts((n) => n + 1));
    void document.fonts?.load('600 64px "Barlow Semi Condensed"').then(() => on && setFonts((n) => n + 1));
    return () => {
      on = false;
    };
  }, []);
  useEffect(() => {
    const g = ink.current?.getContext?.("2d");
    const gg = ghost.current?.getContext?.("2d");
    if (!g || !gg || !src) return;
    const img = new Image();
    let on = true;
    img.onload = () => {
      if (!on) return;
      drawPrint(g, img, name, num, "home");
      const clear = document.createElement("canvas");
      clear.width = 540;
      clear.height = 600;
      drawPrint(gg, clear, name ? "" : "NOMBRE", num ? "" : "00", "home");
    };
    img.src = src;
    return () => {
      on = false;
    };
  }, [src, name, num, fonts]);
  return (
    <>
      <canvas ref={ink} className="spl-kit__c" width={540} height={600} aria-hidden="true" />
      <canvas ref={ghost} className="spl-kit__ghost" width={540} height={600} aria-hidden="true" />
    </>
  );
}

export function AltaScreen() {
  const st = usePlantilla();
  const { data, season, squad, players, writes, write, blank } = st;
  const go = useSalaGo();
  const status = useStatus();
  const { desktop } = useFrame();
  const uid = useId();
  const dorsal = dorsalParam(useSearch({ strict: false, select: (s) => (s as { dorsal?: unknown }).dorsal }));
  const a: AltaDraft = st.alta ?? { ...EMPTY, num: dorsal ? String(dorsal) : "" };
  const set = (patch: Partial<AltaDraft>) => st.setAlta({ ...a, ...patch });
  const live = liveSeasons(data.seasons);
  const seasons = a.seasons ?? (season && !season.archived ? [season.id] : []);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (desktop) nameRef.current?.focus();
  }, [desktop]);

  const name = a.name.trim().toLocaleUpperCase("es");
  const num = a.num.trim();
  const form = { ...emptyForm(seasons), shirtName: name, number: num, position: a.line };
  const check = checkPlayerForm(form, { players, seasons: data.seasons, editingId: null });
  const nameOk = name.length >= 2 && name.length <= 12;
  const dl = dorsalLine(check, form, null);
  const numOk = !!num && dl.tone === "ok";
  const ready = nameOk && numOk && check.ok;
  const sName = season?.name ?? "la temporada";
  const free = freeDorsals(squad, 10);
  const nameHint = !a.name ? "2 a 12 letras · en mayúsculas" : nameOk ? `${name.length}/12` : name.length < 2 ? "Mínimo 2 letras" : "Máximo 12 letras";
  const numHint = !num ? `Del 1 al 99, libre en la ${sName}` : dl.text;
  const why = ready ? "Foto, nacimiento, altura y peso, después en su ficha." : !nameOk ? "Falta el nombre en la camiseta (2 a 12 letras)." : !numOk ? "Falta un dorsal libre." : (check.errors[0] ?? "Revisa lo marcado.");

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!ready) {
      status.show({ tag: "Alta", message: why, tone: "error" });
      return;
    }
    const id = writes.newPlayerId();
    const positions = { main: a.main, also: a.also };
    const payload = playerPayload(form, { createdAt: new Date(), positions });
    const guests = a.guests;
    write({
      id,
      doc: previewDoc(null, id, payload),
      tag: "Alta",
      message: `${name} entra en la plantilla con el ${num}${guests.length ? ` · sus ${plural(guests.length, "partido", "partidos")} de invitado pasan a su ficha` : ""}`,
      error: `No se ha podido dar de alta a ${name}`,
      commit: () => writes.savePlayer(id, payload),
      onUndo: () => {
        if (window.location.pathname.endsWith(`/${encodeURIComponent(id)}`)) go("/admin/plantilla");
      },
      onDone: guests.length
        ? () => {
            const promote = () =>
              promoteGuest({ playerId: id, guests }).then(
                (r) => status.show({ tag: "Alta", message: `${name}: ${plural(r.data.matches, "partido de invitado pasa", "partidos de invitado pasan")} a su ficha` }),
                (err: unknown) => status.show({ tone: "error", message: `${name} ya está en la plantilla, pero sus partidos de invitado no han pasado a su ficha: ${apiError(err)}`, retry: () => void promote() }),
              );
            void promote();
          }
        : undefined,
    });
    st.setAlta(null);
    go(`/admin/plantilla/${encodeURIComponent(id)}`);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit(e);
  };
  const cancel = () => {
    st.setAlta(null);
    go("/admin/plantilla");
  };

  const kitLabel = `La camiseta nueva: ${name || "sin nombre"}${num ? `, el ${num}` : ", sin dorsal"}`;
  const posLine = a.main || a.also.length ? `${a.main ?? "Sin preferida"}${a.also.length ? ` · también ${a.also.join(", ")}` : ""}` : "Opcional · el primer toque es la preferida, los siguientes «también»; tocar otra vez la cambia";
  return (
    <SalaScreen title="Camiseta nueva" lede="La camiseta se estampa mientras escribes" headSub={`Alta de jugador · ${sName}`} back={{ to: "/admin/plantilla", label: "Volver a la plantilla" }} actions={desktop ? <PlNav at="jugadores" /> : undefined} fit className="sc-pl pl--alta pl--sub">
      <div className="spl-alta sc-scroll">
        <figure className="spl-kit" role="img" aria-label={kitLabel}>
          <Kit src={blank} name={name} num={num} />
          <figcaption className="sc-small">La camiseta se estampa mientras escribes</figcaption>
        </figure>
        <form className="spl-altaf" aria-label="Alta de jugador" onSubmit={submit} noValidate>
          {a.guests.length > 0 && (
            <p className="spl-altag" role="status">
              <span className="sc-tag sc-tag--toca">Invitado</span>
              <span>
                {a.guestName ?? name} vino de invitado {plural(a.guests.length, "vez", "veces")}: al darle de alta, esos partidos pasan a su ficha (sus minutos, goles y notas).
              </span>
            </p>
          )}
          <div className="sc-form">
            <div className="sc-field">
              <label className="spl-lab" htmlFor={`${uid}-n`}>
                Nombre en la camiseta
              </label>
              <input ref={nameRef} className="vd-input vd-glass" id={`${uid}-n`} type="text" maxLength={12} placeholder="PABLO" value={a.name} aria-invalid={!!a.name && !nameOk} aria-describedby={`${uid}-nh`} autoComplete="off" onChange={(e) => set({ name: e.currentTarget.value.toLocaleUpperCase("es") })} onKeyDown={onKey} />
              <small className={a.name && !nameOk ? "is-bad" : ""} id={`${uid}-nh`}>
                {nameHint}
              </small>
            </div>
            <div className="sc-field">
              <label className="spl-lab" htmlFor={`${uid}-d`}>
                Dorsal en la {sName}
              </label>
              <input className="vd-input vd-glass" id={`${uid}-d`} type="text" inputMode="numeric" maxLength={2} placeholder="1–99" value={a.num} aria-invalid={!!num && !numOk} aria-describedby={`${uid}-dh`} autoComplete="off" onChange={(e) => set({ num: e.currentTarget.value.replace(/\D/g, "").slice(0, 2) })} onKeyDown={onKey} />
              <small className={num && !numOk ? "is-bad" : ""} id={`${uid}-dh`}>
                {numHint}
              </small>
            </div>
          </div>
          <div className="spl-free" role="group" aria-label="Dorsales libres">
            <span className="spl-lab">Libres</span>
            {free.map((d) => (
              <button key={d} type="button" className="sc-chip vd-glass vd-press spl-free__d" aria-pressed={String(d) === num} aria-label={`Dorsal ${d}`} onClick={() => set({ num: String(d) })}>
                {d}
              </button>
            ))}
          </div>
          <section className="spl-altapos" aria-labelledby={`${uid}-pos`}>
            <h2 className="sc-h3" id={`${uid}-pos`}>
              Posiciones · opcional
            </h2>
            <div className="sc-chips" role="group" aria-label="Su línea">
              {(["POR", "DEF", "MED", "DEL"] as const).map((l: Line) => (
                <button key={l} type="button" className="sc-chip vd-glass vd-press" aria-pressed={a.line === l} onClick={() => set({ line: a.line === l ? "" : l, main: a.main && lineOf(a.main) !== l ? null : a.main })}>
                  {LINE_ONE[l]}
                </button>
              ))}
            </div>
            <Mapa
              alta
              value={{ main: a.main, also: a.also }}
              mode="cycle"
              label="Mapa de posiciones del jugador nuevo"
              onTap={(c) => {
                const r = tapSpot({ main: a.main, also: a.also }, c, "cycle", name || "El jugador nuevo");
                if (typeof r === "string") return;
                set({ main: r.main, also: r.also, line: r.main ? lineOf(r.main) : a.line });
              }}
            />
            <p className="sc-small">{posLine}</p>
          </section>
          <div className="spl-seasons" role="group" aria-label="Temporadas">
            <p className="spl-lab">Temporadas</p>
            {live.map((s) => (
              <button key={s.id} type="button" className="vd-switch" role="switch" aria-checked={seasons.includes(s.id)} onClick={() => set({ seasons: seasons.includes(s.id) ? seasons.filter((x) => x !== s.id) : [...seasons, s.id] })}>
                <span className="vd-switch__track" aria-hidden="true">
                  <span className="vd-switch__knob" />
                </span>
                {s.name}
              </button>
            ))}
            {!live.length && <p className="sc-small">No hay ninguna temporada visible: entra en la plantilla sin temporada (Club › Temporadas crea una).</p>}
          </div>
          <p className="sc-small" id={`${uid}-why`}>
            {why}
          </p>
          <div className="sc-primary sc-primary--pin spl-altaa">
            <button type="submit" className="vd-btn vd-glass vd-press vd-btn--pri" aria-disabled={!ready || undefined} aria-describedby={`${uid}-why`}>
              Dar de alta
            </button>
            <button type="button" className="vd-btn vd-glass vd-press" onClick={cancel}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </SalaScreen>
  );
}
