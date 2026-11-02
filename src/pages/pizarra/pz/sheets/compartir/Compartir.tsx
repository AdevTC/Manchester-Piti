// r14 «La pizarra» · the «Compartir» sheet (PiCompartir): Tú's studio adapted to a board. Three tabs: El cartel
// (Historia 9:16 · Post 4:5; the preview IS the PNG it sends, drawn by posterDraw), La jugada en vídeo (the app's
// real clip export: v2/clip recordClip + drawClipFrame, with B-PZ-10's «caducado» when the play or the speed changed
// since it was recorded) and Enlace y QR (the board's link, the charla's, a real QR, and the fan view: a public,
// read-only page — PZ-D21F, callable setBoardFanLink). Tú's pieces: Seg (palco kit), saveBlob/copyText (fxRuntime),
// shareOut/sharePlan/shareToast (perfil/share), qrPath (acceso).
import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../../firebase";
import "../../../../../styles/pz/charla.css";
import { Seg } from "../../../../stats/palco/kit";
import { copyText, errorMessage, saveBlob } from "../../../../perfil/fxRuntime";
import { shareOut, sharePlan, shareToast, slugOf, type ShareFormat, type ShareNav } from "../../../../perfil/share";
import { qrPath } from "../../../../acceso/qrPath";
import { setBoardFanLink } from "../../../../../lib/clubApi";
import { charlaHref } from "../../../data/boards";
import { fanPath } from "../../../data/fan";
import { momentLabel } from "../../../data/moment";
import { libraryPlays } from "../../../playLibrary";
import type { Play } from "../../../plays";
import { CREST } from "../../../v2/icons";
import { browserClock, CLIP_H, CLIP_W, clipFile, clipLength, clipSupport, drawClipFrame, recordClip, shareClip, type ClipCtx, type ClipJob } from "../../../v2/clip";
import { download } from "../../../v2/cartel";
import { PiCampo } from "../../campo/PiCampo";
import { PzIcon } from "../../campo/Shirt";
import { drawingPath } from "../../store/registry";
import { usePz } from "../../store/context";
import type { PzApi } from "../../store/api";
import type { SheetProps, StageSpec } from "../../store/types";
import { playToPz } from "../../places/charla/charlaView";
import { posterBlob, type PosterModel } from "./posterDraw";

type Tab = "cartel" | "video" | "enlace";
const TABS: [Tab, string][] = [
  ["cartel", "El cartel"],
  ["video", "La jugada en vídeo"],
  ["enlace", "Enlace y QR"],
];
const RATES: [number, string][] = [
  [0.5, "0,5×"],
  [1, "1×"],
  [2, "2×"],
];
const rateT = (r: number) => RATES.find((x) => x[0] === r)?.[1] ?? "1×";
/** What a recorded video was made of (B-PZ-10): when the play or the speed changes, it is stale. */
const playHash =(pl: Play | null): string => {
  const s = JSON.stringify(pl ? pl.frames : "");
  let h = 7;
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0;
  return String(h);
};
interface Studio {
  fmt: ShareFormat;
  rival: boolean;
  notas: boolean;
  trazos: boolean;
  rate: number;
  play: string | null;
}
const STUDIO0: Studio = { fmt: "historia", rival: false, notas: false, trazos: false, rate: 1, play: null };
type Vid = { k: "idle" } | { k: "rec"; pct: number } | { k: "ready"; blob: Blob; file: string; playId: string; rate: number; hash: string; at: number } | { k: "error"; msg: string };
const GAL_W: Record<string, string> = { C: "capitán", V: "vice", P: "penaltis", F: "faltas", E: "córners" };

const origin = (): string => (typeof window === "undefined" ? "" : window.location.origin);

export function CompartirSheet({ args, layout }: SheetProps) {
  const P = usePz();
  const sl = P.slice<Studio>("compartir", STUDIO0);
  const c = sl.get();
  const S = P.state;
  const b = P.sel.board();
  const v = b ? P.sel.ver(b, "titular") : null;
  const me = P.sel.me();
  const [tab, setTab] = useState<Tab>(() => (args.tab === "video" || args.tab === "enlace" ? args.tab : "cartel"));
  const loading = S.estado === "cargando";
  const error = S.estado === "error";
  const offline = S.estado === "offline";
  if (loading || error || !b || !v) {
    return (
      <div className={"pcs" + (layout === "phone" ? " is-phone" : "")} lang="es">
        <div className="pcs-empty" role="status">
          <b>{loading ? "Preparando el estudio…" : error ? "No se ha podido leer el tablero" : me.socia ? "Aún no hay siete oficial" : "Nada que compartir aún"}</b>
          <p>{loading ? "En un momento." : error ? "Sin conexión con el club. El tablero sigue guardado en el servidor." : "Cuando el capitán publique el siete, aquí sale su cartel."}</p>
          {error && (
            <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => P.act.retry()}>
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className={"pcs" + (layout === "phone" ? " is-phone" : "")} lang="es">
      <div className="vd-glass pcs-tabs" role="tablist" aria-label="Qué compartir">
        {TABS.map(([id, t]) => (
          <button key={id} type="button" role="tab" id={"pcs-tab-" + id} aria-selected={tab === id} aria-controls="pcs-panel" onClick={() => setTab(id)}>
            {t}
          </button>
        ))}
      </div>
      <div id="pcs-panel" role="tabpanel" aria-labelledby={"pcs-tab-" + tab} className="pcs">
        {tab === "cartel" && <Cartel P={P} c={c} set={(p) => sl.set(p, { undoable: false })} offline={offline} />}
        {tab === "video" && <Video P={P} c={c} set={(p) => sl.set(p, { undoable: false })} offline={offline} />}
        {tab === "enlace" && <Enlace P={P} />}
      </div>
    </div>
  );
}

function head(P: PzApi): string {
  const b = P.sel.board();
  const M = b?.matchId ? P.sel.match(b.matchId) : null;
  if (!M) return b?.name ?? "";
  const fmtDay = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" }).format(new Date(M.at)).replace(/\./g, "");
  const hm = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(new Date(M.at));
  return (M.j != null ? "J" + M.j + " · " : "") + M.rival + " · " + fmtDay + " " + hm;
}

// ───────────────────────────── El cartel ─────────────────────────────
function Cartel({ P, c, set, offline }: { P: PzApi; c: Studio; set: (p: Partial<Studio>) => void; offline: boolean }) {
  const b = P.sel.board()!;
  const v = P.sel.ver(b, "titular")!;
  const st = P.sel.status(v);
  const chem = P.sel.chem(v);
  const me = P.sel.me();
  const L = b.lineup;
  const hasRival = !!L.rival && L.rival.players.length > 0;
  const paths = (L.drawings ?? []).map((d) => drawingPath(d)?.pts).filter((x): x is [number, number][] => !!x && x.length > 1);
  const hasDraw = paths.length > 0;
  const R = L.roles ?? {};
  const T = L.takers;
  const gal = (
    [
      ["C", R.captainId],
      ["V", R.viceId],
      ["P", T?.penalties?.[0] ?? R.penaltiesId],
      ["F", T?.freekicks?.[0] ?? R.freekicksId],
      ["E", T?.corners?.[0] ?? R.cornersId],
    ] as [string, string | undefined][]
  )
    .filter((g): g is [string, string] => !!g[1])
    .map(([k, id]) => ({ k, n: P.sel.name(id) }));
  const title = b.isOfficial ? "¡Ya es oficial!" : "Los siete";
  const sub = (v.freeMode ? "Libre" : v.formation) + (b.isOfficial ? " · el oficial" : " · borrador de " + (b.ownerNick ? "@" + b.ownerNick : me.name));
  const foot = "Química " + chem.v + " · " + chem.t.toLowerCase() + (c.notas ? " · con notas" : "");
  const rv = hasRival && c.rival ? (P.sel.view({ source: "siete", boardId: b.id, version: "titular", rival: true }).tokens ?? []).filter((t) => t.kind === "rival") : [];
  const model: PosterModel = {
    fmt: c.fmt,
    head: head(P),
    title,
    sub,
    crest: CREST,
    shirts: v.slots.map((s) => {
      const still = s.playerId ? P.sel.shirt(s.playerId) : null;
      const last = s.playerId ? P.sel.lastNota(s.playerId) : null;
      return { src: still?.src, num: still?.num ?? "", name: s.playerId ? P.sel.name(s.playerId) : "", x: s.x, y: s.y, gal: s.playerId ? P.sel.galones(s.playerId, b, v).map((g) => g.k) : [], nota: c.notas && last ? last.n.toFixed(1).replace(".", ",") : null, empty: !s.playerId };
    }),
    rival: rv.map((t) => ({ x: t.x, y: t.y, num: String(t.num ?? "") })),
    paths: c.trazos ? paths : [],
    gal,
    foot,
  };
  const key = JSON.stringify(model);
  // the PNG is drawn on every change (Safari drops the tap's gesture after an await: «Compartir» uses the ready one)
  const [img, setImg] = useState<{ key: string; blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let off = false;
    const t = window.setTimeout(() => {
      void posterBlob(JSON.parse(key) as PosterModel).then((blob) => {
        if (off || !blob) return;
        const url = URL.createObjectURL(blob);
        setImg((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { key, blob, url };
        });
      });
    }, 120);
    return () => {
      off = true;
      window.clearTimeout(t);
    };
  }, [key]);
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    urlRef.current = img?.url ?? null;
  }, [img]);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );
  const missing = 7 - st.n;
  const blocked = missing > 0;
  const firstHole = v.slots.findIndex((s) => !s.playerId);
  const M = b.matchId ? P.sel.match(b.matchId) : null;
  const fileName = "los-siete-" + (M?.j != null ? "j" + M.j + "-" : "") + slugOf(b.name) + "-" + c.fmt + ".png";
  const aria = "Cartel: " + title + ", " + head(P) + ", " + sub + ", química " + chem.v + ". " + v.slots.map((s) => (s.playerId ? P.sel.name(s.playerId) : "hueco") + " " + s.code).join(", ") + (gal.length ? ". Galones: " + gal.map((g) => GAL_W[g.k] + " " + g.n).join(", ") : "") + (rv.length ? ". Con el siete del rival en coral" : "") + (c.trazos && hasDraw ? ". Con los trazos" : "") + ".";
  const ready = img && img.key === key ? img : null;
  const share = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const file = new File([ready.blob], fileName, { type: "image/png" });
    const nav = navigator as ShareNav;
    const link = origin() + "/pizarra/siete?tablero=" + encodeURIComponent(b.id);
    const out = await shareOut({ nav, file, link, title: title + " · Manchester Piti", text: title + " " + head(P), copy: copyText });
    setBusy(false);
    const t = shareToast(out, sharePlan(nav, file));
    if (t) P.toast(t);
  };
  const togs: { t: string; on: boolean; off: boolean; pick: () => void }[] = [
    { t: "El rival", on: c.rival && hasRival, off: !hasRival, pick: () => set({ rival: !c.rival }) },
    { t: "Las notas", on: c.notas, off: false, pick: () => set({ notas: !c.notas }) },
    { t: "Los trazos", on: c.trazos && hasDraw, off: !hasDraw, pick: () => set({ trazos: !c.trazos }) },
  ];
  const togHint = !hasRival ? "Sin rival en este tablero: añádelo en Plan para sacarlo." : !hasDraw ? "Sin trazos: dibuja sobre el campo para sacarlos." : "";
  return (
    <>
      <div>
        <p className="pcs-k">Formato</p>
        <Seg
          label="Formato"
          opts={[
            { key: "historia", t: "Historia 9:16", on: c.fmt === "historia", pick: () => set({ fmt: "historia" }) },
            { key: "post", t: "Post 4:5", on: c.fmt === "post", pick: () => set({ fmt: "post" }) },
          ]}
        />
      </div>
      <div className="pcs-prev">
        <div className={"pcs-poster pcs-poster--img " + (c.fmt === "historia" ? "is-h" : "is-p")} role="img" aria-label={aria} aria-busy={!ready}>
          {img ? <img src={img.url} alt="" /> : <span className="pcs-poster__wait">Preparando el cartel…</span>}
        </div>
      </div>
      <div>
        <p className="pcs-k">En la imagen</p>
        <div className="pcs-togs">
          {togs.map((t) => (
            <button key={t.t} type="button" className="vx-tog" aria-pressed={t.on} onClick={t.pick} disabled={t.off}>
              <span className="vx-tog__t" aria-hidden="true" />
              {t.t}
            </button>
          ))}
        </div>
        {togHint && <p className="pcs-meta">{togHint}</p>}
      </div>
      {blocked && (
        <div className="pcs-warn" role="note">
          <b>{"Completa el siete para compartir (" + st.n + "/7)"}</b>
          <span>{missing === 1 ? "Falta un " + (st.missing[0] ?? "jugador") + ": el cartel sale cuando estén los siete." : "Faltan " + missing + ": el cartel sale cuando estén los siete."}</span>
          {P.sel.canEdit(b) && firstHole >= 0 && (
            <button
              type="button"
              className="nx-lnk"
              onClick={() => {
                P.act.closeSheet();
                if (P.state.route.place !== "siete") P.nav("/pizarra/siete");
                window.setTimeout(() => P.act.tapSlot(firstHole), 60);
              }}
            >
              {"Ir al hueco" + (st.missing[0] ? " del " + st.missing[0] : "")}
            </button>
          )}
        </div>
      )}
      <div className="pcs-acts">
        <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => void share()} disabled={blocked || offline || !ready || busy}>
          <PzIcon name="share" />
          Compartir
        </button>
        <button
          type="button"
          className="vd-glass vd-press nx-btn"
          disabled={blocked || !ready}
          aria-label={"Descargar el cartel (" + fileName + ")"}
          onClick={() => {
            if (!ready) return;
            saveBlob(ready.blob, fileName);
            P.toast("Cartel guardado: " + fileName);
          }}
        >
          <svg className="nx-ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
          </svg>
          Descargar
        </button>
      </div>
      <p className="pcs-meta">{offline ? "Sin conexión: descárgalo y mándalo cuando vuelva." : "La imagen no lleva correos ni ids: solo lo que ves."}</p>
    </>
  );
}

// ───────────────────────────── La jugada en vídeo ─────────────────────────────
function Video({ P, c, set, offline }: { P: PzApi; c: Studio; set: (p: Partial<Studio>) => void; offline: boolean }) {
  const b = P.sel.board()!;
  const v = P.sel.ver(b, "titular")!;
  const all: Play[] = [...(b.lineup.plays ?? []), ...libraryPlays(b.lineup)];
  const charlaPick = (P.state.slices.charla as { jugada?: string | null } | undefined)?.jugada ?? null;
  const pl = all.find((x) => x.id === (c.play ?? charlaPick)) ?? b.lineup.plays?.[0] ?? all[0] ?? null;
  const rate = c.rate || 1;
  const [sup] = useState(() => clipSupport());
  const [st, setSt] = useState<Vid>({ k: "idle" });
  const [vStep, setVStep] = useState(0);
  const job = useRef<ClipJob | null>(null);
  useEffect(() => () => job.current?.cancel(), []);
  const n = pl ? pl.frames.length : 1;
  const reduced = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (reduced || !pl) return;
    const t = window.setInterval(() => setVStep((k) => (k + 1) % n), Math.round(1600 / rate) + 500);
    return () => window.clearInterval(t);
  }, [reduced, pl, n, rate]);
  if (!pl) return <p className="pcs-meta">Sin jugadas en este tablero: crea una en Jugadas.</p>;
  const pz = playToPz(pl, v);
  const k = vStep % n;
  const vidSpec: StageSpec = { source: "jugada", play: pz, playId: pl.id, step: k, camera: "grada", rate, caption: "" };
  const hash = playHash(pl);
  const ready = st.k === "ready" && st.playId === pl.id && st.hash === hash && st.rate === rate ? st : null;
  const stale = st.k === "ready" && st.playId === pl.id && !ready ? st : null;
  const other = st.k === "ready" && st.playId !== pl.id ? all.find((x) => x.id === st.playId) : null;
  const M = b.matchId ? P.sel.match(b.matchId) : null;
  const mom = pl.moment ? momentLabel(pl.moment, { jornada: P.sel.match(pl.moment.matchId)?.j ?? null, name: (id) => P.sel.name(id) }) : "";
  const headTxt = mom ? mom : M ? (M.j != null ? "J" + M.j + " · " : "") + M.rival : b.name;
  const secs = Math.round(clipLength(pl.frames.length, rate) / 1000);
  const record = () => {
    if (!sup.ok) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d") as ClipCtx | null;
    if (!ctx) {
      setSt({ k: "error", msg: "Este navegador no puede dibujar el vídeo." });
      return;
    }
    canvas.width = CLIP_W;
    canvas.height = CLIP_H;
    const who: Record<string, { num: number; name: string }> = {};
    v.slots.forEach((s) => {
      if (s.playerId) who[s.playerId] = { num: Number(P.sel.player(s.playerId)?.num ?? 0), name: P.sel.name(s.playerId) };
    });
    const ms = clipLength(pl.frames.length, rate);
    const scene = { play: pl, who, head: headTxt };
    const j = recordClip({ canvas, Recorder: sup.Recorder, mime: sup.mime, ms, clock: browserClock, draw: (t) => drawClipFrame(ctx, scene, t, ms), onProgress: (p) => setSt((s0) => (s0.k === "rec" && s0.pct !== Math.round(p * 100) ? { k: "rec", pct: Math.round(p * 100) } : s0)) });
    job.current = j;
    setSt({ k: "rec", pct: 0 });
    P.say("Grabando el vídeo de la jugada «" + pl.name + "» (" + Math.round(ms / 1000) + " segundos)");
    const recPlay = pl.id;
    j.done.then(
      (blob) => {
        if (job.current !== j) return;
        job.current = null;
        setSt({ k: "ready", blob, file: clipFile(pl.name, sup.mime), playId: recPlay, rate, hash, at: Date.now() });
        P.toast("Vídeo listo: «" + pl.name + "» a " + rateT(rate));
      },
      (err: unknown) => {
        if (job.current !== j) return;
        job.current = null;
        if (err instanceof Error && err.name === "AbortError") {
          setSt({ k: "idle" });
          P.toast("Grabación cancelada");
          return;
        }
        setSt({ k: "error", msg: "No se ha podido grabar el vídeo." });
        P.say("No se ha podido grabar el vídeo");
      },
    );
  };
  const send = (blob: Blob, file: string) => {
    void shareClip(blob, file, "Jugada · " + pl.name).then(
      (r) => {
        if (r === "shared") P.toast("Vídeo listo para el grupo");
        else if (r === "downloaded") P.toast("Vídeo descargado: mándalo al grupo");
      },
      () => P.toast("No se ha podido compartir el vídeo"),
    );
  };
  const fmtName = sup.ok ? (sup.mime.startsWith("video/mp4") ? "MP4" : "WebM") : "";
  return (
    <>
      <div className="pcs-two">
        <label className="pcs-lab">
          <span className="pcs-k">La jugada</span>
          <select
            className="vd-glass pcs-sel"
            value={pl.id}
            onChange={(e) => {
              if (!all.some((x) => x.id === e.target.value)) return;
              set({ play: e.target.value });
              setVStep(0);
            }}
          >
            {all.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name + (x.kind === "propia" ? " · tuya" : "") + (st.k === "ready" && st.playId === x.id ? (playHash(x) !== st.hash || st.rate !== rate ? " · vídeo caducado" : " · vídeo listo") : "")}
              </option>
            ))}
          </select>
        </label>
        <div>
          <p className="pcs-k">Velocidad</p>
          <Seg label="Velocidad del vídeo" opts={RATES.map(([r, t]) => ({ key: t, t, on: rate === r, pick: () => set({ rate: r }) }))} />
        </div>
      </div>
      <div className="pcs-prev">
        <div className="pcs-vid" role="img" aria-label={"Vista previa del vídeo: " + pl.name + ", paso " + (k + 1) + " de " + n + (pz.steps[k] ? ", " + pz.steps[k].title : "")}>
          <div className="pcs-vid__bar" aria-hidden="true">
            <i style={{ width: Math.round(((k + 1) / n) * 100) + "%" }} />
          </div>
          <span className="pcs-vid__badge" aria-hidden="true">
            REPETICIÓN
          </span>
          <PiCampo layout="phone" mini show={vidSpec} camera="grada" />
          <div className="pcs-vid__cap" aria-hidden="true">
            <b>{pl.name}</b>
            <small>{mom ? mom : "Paso " + (k + 1) + " de " + n + " · " + (pz.steps[k]?.title ?? "")}</small>
          </div>
        </div>
      </div>
      <div className="pcs-state" aria-live="polite">
        {!sup.ok ? (
          <p>{sup.why}</p>
        ) : st.k === "rec" ? (
          <>
            <p>
              <b>{"Grabando… " + st.pct + " %"}</b> · {pl.name}
            </p>
            <div className="pcs-prog" role="progressbar" aria-label="Grabando el vídeo de la jugada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={st.pct}>
              <i style={{ width: st.pct + "%" }} />
            </div>
            <div className="pcs-acts">
              <button type="button" className="vd-glass vd-press nx-btn" onClick={() => job.current?.cancel()}>
                Cancelar
              </button>
            </div>
          </>
        ) : ready ? (
          <>
            <p className="pcs-ok">
              <PzIcon name="check" />
              {"Listo · " + pl.name + " a " + rateT(rate)}
            </p>
            <div className="pcs-acts">
              <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => send(ready.blob, ready.file)} disabled={offline}>
                <PzIcon name="share" />
                Compartir el vídeo
              </button>
              <button type="button" className="vd-glass vd-press nx-btn" onClick={() => download(ready.blob, ready.file)} aria-label={"Descargar el vídeo (" + ready.file + ")"}>
                Descargar
              </button>
              <button type="button" className="nx-lnk" onClick={record}>
                Grabar otra vez
              </button>
            </div>
          </>
        ) : stale ? (
          <>
            <div className="pcs-stale" role="alert">
              <b>
                <PzIcon name="warn" />
                Caducado
              </b>
              <span>{stale.rate !== rate ? "Lo grabaste a " + rateT(stale.rate) + " y ahora está a " + rateT(rate) + ". Grábalo otra vez para mandar lo que ves." : "La jugada ha cambiado desde que lo grabaste. Grábalo otra vez para no mandar la versión vieja."}</span>
            </div>
            <div className="pcs-acts">
              <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={record}>
                Grabar otra vez
              </button>
              <button type="button" className="vd-glass vd-press nx-btn" disabled>
                Compartir el vídeo
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              <b>{pl.name}</b> {"· 720p · " + secs + " s · " + fmtName + ". Se graba en este dispositivo, sin subir nada."}
            </p>
            {mom && <p>{"Con el momento del acta: " + mom + "."}</p>}
            {other && (
              <p>
                {"Tienes un vídeo de «" + other.name + "». "}
                <button type="button" className="nx-lnk" onClick={() => set({ play: other.id })}>
                  Verlo
                </button>
              </p>
            )}
            {st.k === "error" && <p className="pcs-err">{st.msg}</p>}
            <div className="pcs-acts">
              <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={record}>
                <svg className="nx-ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 6.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11z" />
                </svg>
                Grabar el vídeo
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ───────────────────────────── Enlace y QR ─────────────────────────────
function fanTokenOf(lineup: unknown): string | null {
  if (!lineup || typeof lineup !== "object") return null;
  const t = (lineup as { fanToken?: unknown }).fanToken;
  return typeof t === "string" && t ? t : null;
}

function Enlace({ P }: { P: PzApi }) {
  const b = P.sel.board()!;
  const me = P.sel.me();
  const season = P.state.W.season.id;
  const draft = b.draft || b.id === "nuevo";
  const link = origin() + "/pizarra/siete?tablero=" + encodeURIComponent(b.id) + (season ? "&season=" + encodeURIComponent(season) : "");
  const charla = origin() + charlaHref(b.id, season);
  const qr = qrPath(link);
  const [fan, setFan] = useState<{ token: string | null; busy: boolean; err: string }>(() => ({ token: fanTokenOf(b.lineup), busy: false, err: "" }));
  // (the board's fan token is the server's: read it once from the stored board)
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (draft || asked) return;
    let off = false;
    void getDoc(doc(db, "lineups", b.id)).then(
      (snap) => {
        if (off) return;
        setAsked(true);
        const t = fanTokenOf(snap.data());
        if (t) setFan((f) => (f.token ? f : { ...f, token: t }));
      },
      () => setAsked(true),
    );
    return () => {
      off = true;
    };
  }, [b.id, draft, asked]);
  const canFan = !draft && (P.sel.canEdit(b) || me.cap || b.ownerUid === me.uid);
  const fanUrl = fan.token ? origin() + fanPath(fan.token) : "";
  const callFan = async (on: boolean, rotate = false) => {
    setFan((f) => ({ ...f, busy: true, err: "" }));
    try {
      const r = await setBoardFanLink({ boardId: b.id, on, ...(rotate ? { rotate: true } : {}) });
      setFan({ token: r.data.token, busy: false, err: "" });
      P.toast(!on ? "La vista de la afición ya no se puede abrir" : rotate ? "Enlace nuevo: el viejo deja de ir" : "Vista de la afición lista: cópiala y pásala");
    } catch (e) {
      setFan((f) => ({ ...f, busy: false, err: errorMessage(e) }));
    }
  };
  const copy = async (url: string, what: string) => P.toast((await copyText(url)) ? what + " copiado: pégalo en el grupo" : "No se ha podido copiar el enlace");
  return (
    <>
      <div className="vd-glass pcs-link">
        <img src={CREST} alt="" />
        <span>
          <b>{b.name + (b.isOfficial ? " · el oficial" : "")}</b>
          <small>{link.replace(/^https?:\/\//, "")}</small>
        </span>
      </div>
      {draft && (
        <p className="pcs-warn">
          <b>Aún sin enlace</b>
          <span>El enlace llega en cuanto el tablero se guarde (con tu primer cambio).</span>
        </p>
      )}
      <div className="pcs-acts">
        <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => void copy(link, "Enlace")} disabled={draft}>
          <PzIcon name="link" />
          Copiar el enlace
        </button>
        <button type="button" className="vd-glass vd-press nx-btn" onClick={() => void copy(charla, "Enlace a la charla")} disabled={draft} aria-label="Copiar el enlace que abre la charla de este tablero">
          <PzIcon name="mic" />
          Enlace a la charla
        </button>
      </div>
      <div className="pcs-qr">
        <div className="pcs-qr__img" role="img" aria-label={"Código QR del enlace al tablero «" + b.name + "»"}>
          {!draft && (
            <svg viewBox={"0 0 " + qr.n + " " + qr.n} shapeRendering="crispEdges" aria-hidden="true">
              <path d={qr.d} />
            </svg>
          )}
        </div>
        <p>{draft ? "El QR llega en cuanto el tablero se guarde." : "Escanéalo con la cámara: abre este tablero tal cual en otro móvil."}</p>
      </div>
      <p className="pcs-meta">Solo para los del vestuario: quien abra el enlace sin cuenta verá la puerta.</p>
      <div className="pcs-prop">
        <button type="button" className="vx-tog" aria-pressed={!!fan.token} disabled={!canFan || fan.busy} onClick={() => void callFan(!fan.token)}>
          <span className="vx-tog__t" aria-hidden="true" />
          Vista para la afición, de solo lectura
        </button>
        <p>{canFan ? "Un enlace público con el cartel y el siete: sin cuenta, sin apellidos ni notas." : draft ? "Guarda el tablero para compartirlo con la afición." : "La abre el dueño del tablero o un capitán."}</p>
        {fan.err && (
          <p className="pcs-err" role="alert">
            {fan.err}
          </p>
        )}
        {fan.token && (
          <div className="pcs-acts">
            <button type="button" className="vd-glass vd-press nx-btn" onClick={() => void copy(fanUrl, "Enlace de la afición")}>
              <PzIcon name="link" />
              Copiar el enlace de la afición
            </button>
            {canFan && (
              <button type="button" className="nx-lnk" disabled={fan.busy} onClick={() => void callFan(true, true)}>
                Cambiar el enlace
              </button>
            )}
          </div>
        )}
      </div>
      <div>
        <p className="pcs-k">Más formas</p>
        <ul className="pcs-more pz-rows">
          <li>
            <button
              type="button"
              className="pz-row"
              onClick={() => {
                P.act.closeSheet();
                P.nav("/pizarra/tableros");
              }}
            >
              <span className="vx-tile">
                <PzIcon name="copy" />
              </span>
              <span className="pz-row__t">
                <b>¿Quieres tu copia del tablero?</b>
                <span>{P.sel.canEdit(b) ? "Duplícalo en Tableros: con su siete, sus trazos y sus jugadas" : "No es tuyo: la copia sí lo será, con su siete, sus trazos y sus jugadas"}</span>
              </span>
              <PzIcon name="chevR" />
            </button>
          </li>
        </ul>
      </div>
    </>
  );
}
