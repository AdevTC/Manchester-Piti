// La pizarra · Bloque 5 — «Pachanga» (Gestión, tecla 9): who came (the convocatoria's «voy», or a tap
// each), 2 or 3 teams, porteros fijos or portería por turnos, «X e Y juntos / separados», «Otro reparto»
// and the teams to the group (WhatsApp text, copy, image). The split itself is pachanga.ts. What was picked
// is remembered on this device (a convenience: private mode just starts afresh).
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icons";
import { PanelHead } from "./SheetPanels";
import type { Squad } from "./model";
import { makeTeams, MIN_PLAYERS, pachangaPlayers, pachangaSay, pachangaText, PAIRS_MAX, type KeeperMode, type Pachanga, type PachangaInput, type Pair, type PairKind } from "./pachanga";
import { pachangaBlob } from "./pachangaCard";
import { shareCartel } from "./cartel";
import "../../../styles/pizarra-equipo.css";

const KEY = "mp_pizarra_pachanga";

/** The last split, by its input (the same input gives the very same object: no work on a re-render). */
let last: { key: string; p: Pachanga } | null = null;
function teamsFor(inp: PachangaInput): Pachanga {
  const key = JSON.stringify(inp);
  if (last?.key !== key) last = { key, p: makeTeams(inp) };
  return last.p;
}

interface Saved {
  picked: string[] | null;
  teams: 2 | 3;
  keepers: KeeperMode;
  pairs: Pair[];
  seed: number;
}

function load(): Partial<Saved> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!v || typeof v !== "object") return {};
    const o = v as Record<string, unknown>;
    const ids = (x: unknown) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === "string") : null);
    const pairs = Array.isArray(o.pairs)
      ? o.pairs.filter((p): p is Pair => !!p && typeof p === "object" && typeof (p as Pair).a === "string" && typeof (p as Pair).b === "string" && ((p as Pair).kind === "juntos" || (p as Pair).kind === "separados"))
      : [];
    return {
      picked: ids(o.picked),
      teams: o.teams === 3 ? 3 : 2,
      keepers: o.keepers === "turnos" ? "turnos" : "fijos",
      pairs: pairs.slice(0, PAIRS_MAX),
      seed: typeof o.seed === "number" && Number.isFinite(o.seed) ? o.seed : 1,
    };
  } catch {
    return {};
  }
}
function save(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

export interface PachangaPanelProps {
  sq: Squad;
  /** The day, for the text and the image («mar 14 oct»). */
  when: string;
  onBack: () => void;
  /** The board's one announcer. */
  say: (msg: string) => void;
}

export function PachangaPanel({ sq, when, onBack, say }: PachangaPanelProps) {
  const all = useMemo(() => pachangaPlayers(sq), [sq]);
  const voy = useMemo(() => sq.list.filter((c) => c.cv === "voy" && !c.baja).map((c) => c.id), [sq]);
  const [st, setSt] = useState<Saved>(() => {
    const s = load();
    return { picked: s.picked ?? null, teams: s.teams ?? 2, keepers: s.keepers ?? "fijos", pairs: s.pairs ?? [], seed: s.seed ?? 1 };
  });
  const set = (patch: Partial<Saved>) => {
    const next = { ...st, ...patch };
    setSt(next);
    save(next);
  };
  // (nothing picked on this device yet: the ones who said «voy»)
  const known = new Set(all.map((p) => p.id));
  const picked = (st.picked ?? voy).filter((id) => known.has(id));
  const pickedSet = new Set(picked);
  const players = all.filter((p) => pickedSet.has(p.id));
  const name = (id: string) => sq.byId.get(id)?.name ?? id;
  const enough = players.length >= MIN_PLAYERS[st.teams];
  const result = enough ? teamsFor({ players, teams: st.teams, keepers: st.keepers, pairs: st.pairs, seed: st.seed }) : null;
  const text = result ? pachangaText(result, name, when) : "";

  // The image is drawn as soon as the teams are there, so the tap shares it at once (see cartel.ts).
  const [img, setImg] = useState<{ text: string; blob: Blob } | null>(null);
  useEffect(() => {
    if (!result) return;
    let live = true;
    pachangaBlob(result, (id) => sq.byId.get(id)?.name ?? id, when ? "Pachanga · " + when : "Pachanga")
      .then((blob) => {
        if (live && blob) setImg({ text, blob });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [result, sq, when, text]);
  const blob = img && img.text === text ? img.blob : null;

  const [pa, setPa] = useState<{ a: string; b: string; kind: PairKind }>({ a: "", b: "", kind: "juntos" });
  const pairOk = !!pa.a && !!pa.b && pa.a !== pa.b && pickedSet.has(pa.a) && pickedSet.has(pa.b) && st.pairs.length < PAIRS_MAX;

  const toggle = (id: string) => set({ picked: pickedSet.has(id) ? picked.filter((x) => x !== id) : [...picked, id] });
  const reroll = () => {
    const seed = st.seed + 1;
    set({ seed });
    const p = enough ? teamsFor({ players, teams: st.teams, keepers: st.keepers, pairs: st.pairs, seed }) : null;
    if (p) say(pachangaSay(p));
  };
  const copy = () => {
    const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clip) {
      say("Este navegador no deja copiar: usa WhatsApp o la imagen.");
      return;
    }
    clip.writeText(text).then(
      () => say("Equipos copiados: pégalos en el grupo"),
      () => say("No se ha podido copiar el texto"),
    );
  };
  const image = () => {
    if (!blob) return;
    void shareCartel(blob, "pachanga.png", "Pachanga", text).then((r) => {
      if (r === "downloaded") say("Imagen de los equipos descargada");
    });
  };

  return (
    <>
      <PanelHead kick="Equipos para el entreno" title="Pachanga" onBack={onBack} />
      <div className="b5e-pa">
        <div className="b5e-row">
          <div className="b5e-seg" role="group" aria-label="Número de equipos">
            {([2, 3] as const).map((n) => (
              <button key={n} type="button" onClick={() => set({ teams: n })} aria-pressed={st.teams === n}>
                {n} equipos
              </button>
            ))}
          </div>
          <div className="b5e-seg" role="group" aria-label="Porteros">
            <button type="button" onClick={() => set({ keepers: "fijos" })} aria-pressed={st.keepers === "fijos"}>
              Porteros fijos
            </button>
            <button type="button" onClick={() => set({ keepers: "turnos" })} aria-pressed={st.keepers === "turnos"}>
              Portería por turnos
            </button>
          </div>
        </div>

        <h3>
          ¿Quién ha venido? <small>{picked.length}</small>
        </h3>
        <div className="b5e-sugg">
          {voy.length > 0 && (
            <button type="button" onClick={() => set({ picked: voy })}>
              Los que van ({voy.length})
            </button>
          )}
          <button type="button" onClick={() => set({ picked: all.map((p) => p.id) })}>
            Todos
          </button>
          <button type="button" onClick={() => set({ picked: [] })}>
            Nadie
          </button>
        </div>
        <ul className="b5e-ppl" aria-label="Jugadores">
          {all.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => toggle(p.id)} aria-pressed={pickedSet.has(p.id)}>
                <Icon n={pickedSet.has(p.id) ? "check" : "plus"} w={13} />
                <b>{p.name}</b>
                <small>{(p.pos ?? "—") + " · " + p.rt}</small>
              </button>
            </li>
          ))}
        </ul>

        <h3>Juntos o separados</h3>
        <div className="b5e-pair">
          <select value={pa.a} onChange={(e) => setPa({ ...pa, a: e.target.value })} aria-label="Primer jugador">
            <option value="">Jugador…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={pa.kind} onChange={(e) => setPa({ ...pa, kind: e.target.value === "separados" ? "separados" : "juntos" })} aria-label="Juntos o separados">
            <option value="juntos">juntos</option>
            <option value="separados">separados</option>
          </select>
          <select value={pa.b} onChange={(e) => setPa({ ...pa, b: e.target.value })} aria-label="Segundo jugador">
            <option value="">Jugador…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="b3"
            disabled={!pairOk}
            onClick={() => {
              set({ pairs: [...st.pairs, { a: pa.a, b: pa.b, kind: pa.kind }] });
              say(name(pa.a) + " y " + name(pa.b) + " " + pa.kind);
              setPa({ a: "", b: "", kind: pa.kind });
            }}
          >
            Añadir
          </button>
        </div>
        {st.pairs.length > 0 && (
          <ul className="b5e-pairs">
            {st.pairs.map((p, i) => (
              <li key={p.a + p.kind + p.b + i}>
                <span>
                  <b>{name(p.a)}</b> y <b>{name(p.b)}</b>, {p.kind}
                </span>
                <button type="button" onClick={() => set({ pairs: st.pairs.filter((_, j) => j !== i) })} aria-label={"Quitar: " + name(p.a) + " y " + name(p.b) + " " + p.kind}>
                  <Icon n="x" w={12} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {result ? (
          <>
            <h3>Los equipos</h3>
            <div className={"b5e-teams t" + st.teams}>
              {result.teams.map((t, i) => (
                <section key={t.name} className={"b5e-team p" + i} aria-label={t.name + ", media " + t.avg}>
                  <header>
                    <b>{t.name}</b>
                    <small>media {t.avg}</small>
                  </header>
                  <ol>
                    {t.ids.map((id) => (
                      <li key={id}>
                        {name(id)}
                        {id === t.keeper && <em> · portero</em>}
                      </li>
                    ))}
                  </ol>
                  {t.turns.length > 0 && <p className="b5e-turns">Portería por turnos: {t.turns.map(name).join(" › ")}</p>}
                </section>
              ))}
            </div>
            <p className="b5e-d">{result.diff ? "Diferencia de media: " + result.diff + (result.diff === 1 ? " punto" : " puntos") : "Misma media en todos los equipos"}</p>
            {result.broken.length > 0 && (
              <p className="b5e-warn">
                <Icon n="alert" w={14} />
                No se ha podido cumplir: {result.broken.map((p) => name(p.a) + " y " + name(p.b) + " " + p.kind).join("; ")}.
              </p>
            )}
            <div className="row">
              <button type="button" className="b3 gold" onClick={reroll}>
                <Icon n="reset" w={14} />
                Otro reparto
              </button>
              <a className="b3" href={"https://wa.me/?text=" + encodeURIComponent(text)} target="_blank" rel="noopener noreferrer">
                <Icon n="share" w={14} />
                Mandar por WhatsApp
              </a>
              <button type="button" className="b3" onClick={copy}>
                <Icon n="copy" />
                Copiar texto
              </button>
              <button type="button" className="b3" onClick={image} disabled={!blob}>
                <Icon n="download" />
                {blob ? "Imagen" : "Preparando imagen…"}
              </button>
            </div>
          </>
        ) : (
          <p className="empty">
            Marca a quién ha venido: hacen falta al menos {MIN_PLAYERS[st.teams]} para {st.teams} equipos{picked.length ? " (llevas " + picked.length + ")" : ""}.
          </p>
        )}
      </div>
    </>
  );
}
