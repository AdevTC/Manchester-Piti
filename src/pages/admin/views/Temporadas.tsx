// Temporadas (/admin/temporadas) — the season in course as silverware (the vitrina, gold at its foot): its
// name with «Renombrar» inline, Activa / Archivar (modal), V-E-D in big numbers, goals for–against, the
// Pichichi with his shirt, the season's captain (changeable), the shelf of its jornadas (a V/E/D mark per
// published acta, a gap otherwise) and three trophies (mayor victoria, mejor racha, más veces MVP) — all from
// the PUBLISHED actas only, and the foot says so. Beside it the other seasons: in preparation / finished
// (Renombrar, Archivar) and archived, hatched with a lock (Desarchivar, Eliminar behind a red modal); then
// «+ Nueva temporada» (modal: name, copy the plantilla with its dorsals). Renames, captains and
// (un)archiving wait behind a lower third with «Deshacer»; creating and deleting are awaited in the modal.
import { useMemo, useRef, useState } from "react";
import type { SeasonDoc } from "../../../lib/schemas";
import { mvpWinners } from "../../../lib/vestuario";
import { useArchivedCounts, useMvpTally } from "../club/clubLive";
import { LoadError } from "../club/ClubStates";
import { nameIn, numberIn } from "../club/plantillaLogic";
import { archiveImpact, copyRosterPlan, countsNote, nextSeasonName, seasonCards, seasonNameError, seasonShowcase, seasonTag, type SeasonCard } from "../club/seasonsLogic";
import { useClubWrites } from "../club/useClubWrites";
import { ShirtBack } from "../kit";
import { useAdmin } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { ConfirmModal } from "../ui/layers";
import { useToast } from "../ui/toastContext";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const both = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
type ModalState = { k: "arch" | "unarch" | "del" | "cap"; id: string } | { k: "new" } | null;

export function Temporadas() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const toast = useToast();
  const writes = useClubWrites();
  const mvpTally = useMvpTally();
  const [pending, setPending] = useState<Record<string, Partial<SeasonDoc>>>({});
  const [ren, setRen] = useState<{ id: string; value: string } | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [newName, setNewName] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [cap, setCap] = useState("");
  const renRef = useRef<HTMLInputElement>(null);

  const seasons = useMemo(() => data.seasons.map((s) => (pending[s.id] ? { ...s, ...pending[s.id] } : s)), [data.seasons, pending]);
  const archivedIds = useMemo(() => seasons.filter((s) => s.archived).map((s) => s.id), [seasons]);
  const hidden = useArchivedCounts(archivedIds);
  const activeId = data.season?.id;
  const active = activeId ? (seasons.find((s) => s.id === activeId) ?? null) : null;
  const cards = seasonCards({ seasons, players: data.players, matches: data.matches, stateOf: data.stateOf, activeId, now: data.now, hidden });
  const byId = (id: string) => seasons.find((s) => s.id === id);
  const shirtOf = (playerId: string, seasonId: string) => {
    const p = data.players.find((x) => x.id === playerId);
    return p ? { name: nameIn(p, seasonId), num: numberIn(p, seasonId) } : { name: "—", num: null };
  };
  const showcaseOf = (seasonId: string) =>
    seasonShowcase({
      seasonId,
      matches: data.matches,
      stateOf: data.stateOf,
      now: data.now,
      mvpOf: (m) => mvpWinners(m, mvpTally.get(m.id), data.now),
      nameOf: (id) => shirtOf(id, seasonId).name,
    });

  const patch = (id: string, p: Partial<SeasonDoc>) => setPending((all) => ({ ...all, [id]: { ...all[id], ...p } }));
  const unpatch = (id: string, keys: (keyof SeasonDoc)[]) => () =>
    setPending((all) => {
      const cur = { ...all[id] };
      for (const k of keys) delete cur[k];
      const n = { ...all };
      if (Object.keys(cur).length) n[id] = cur;
      else delete n[id];
      return n;
    });
  const closeModal = () => {
    if (busy) return;
    setModal(null);
    setModalError("");
  };

  // ── rename (inline) ──
  const startRename = (s: SeasonCard) => {
    setRen({ id: s.id, value: s.name });
    requestAnimationFrame(() => {
      renRef.current?.focus({ preventScroll: true });
      renRef.current?.select();
    });
  };
  const renError = ren ? seasonNameError(ren.value, seasons, ren.id) : null;
  const saveRename = () => {
    if (!ren || renError) return;
    const s = byId(ren.id);
    const name = ren.value.trim();
    setRen(null);
    if (!s || name === s.name) return;
    patch(s.id, { name });
    const done = unpatch(s.id, ["name"]);
    toast.defer({ tag: seasonTag(s.name), message: `Ahora se llama «${name}»`, commit: () => writes.saveSeason(s.id, { name }), onUndo: done, onError: done, onDone: done, errorMessage: "No se ha podido renombrar la temporada" });
  };
  const renameRow = (s: SeasonCard) =>
    ren?.id === s.id ? (
      <div className="fld">
        <div className="ren">
          <input
            ref={renRef}
            className={`inp ${renError ? "bad" : ""}`.trim()}
            value={ren.value}
            maxLength={40}
            onChange={(e) => setRen({ id: s.id, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setRen(null);
              }
            }}
            aria-label="Nombre de la temporada"
            aria-invalid={!!renError || undefined}
            autoComplete="off"
          />
          <button type="button" className="btn sm sky" aria-disabled={!!renError} onClick={saveRename}>
            Guardar
          </button>
          <button type="button" className="btn sm line" onClick={() => setRen(null)}>
            Cancelar
          </button>
        </div>
        {renError && (
          <span className="bad">
            <AdIcon name="x" size={13} />
            {renError}
          </span>
        )}
      </div>
    ) : null;

  // ── modals ──
  const target = modal && "id" in modal ? byId(modal.id) : undefined;
  const confirm = async () => {
    if (!modal) return;
    if (modal.k === "new") {
      const err = seasonNameError(newName, seasons, null);
      if (err) {
        setModalError(err);
        return;
      }
      const name = newName.trim();
      const copy = copyFrom ? copyRosterPlan(data.players, copyFrom) : [];
      setBusy(true);
      setModalError("");
      try {
        await writes.createSeason(name, copy);
        setModal(null);
        toast.show({ tag: seasonTag(name), message: `${name} creada en preparación${copy.length ? ` · plantilla copiada (${plural(copy.length, "jugador", "jugadores")})` : ""}` });
      } catch (e) {
        setModalError(`No se ha podido crear: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!target) return;
    const s = target;
    if (modal.k === "del") {
      setBusy(true);
      setModalError("");
      try {
        await writes.deleteSeason(s.id);
        setModal(null);
        toast.show({ tag: seasonTag(s.name), message: `${s.name} eliminada` });
      } catch (e) {
        setModalError(`No se ha podido eliminar: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
      return;
    }
    setModal(null);
    if (modal.k === "cap") {
      const captainPlayerId = cap;
      patch(s.id, { captainPlayerId });
      const done = unpatch(s.id, ["captainPlayerId"]);
      toast.defer({
        tag: seasonTag(s.name),
        message: captainPlayerId ? `Capitán de la ${s.name}: ${shirtOf(captainPlayerId, s.id).name}` : `La ${s.name} se queda sin capitán`,
        commit: () => writes.saveSeason(s.id, { captainPlayerId }),
        onUndo: done,
        onError: done,
        onDone: done,
        errorMessage: "No se ha podido cambiar el capitán",
      });
      return;
    }
    const archive = modal.k === "arch";
    patch(s.id, { archived: archive });
    const done = unpatch(s.id, ["archived"]);
    toast.defer({
      tag: seasonTag(s.name),
      message: archive ? `${s.name} archivada · oculta en la web` : `${s.name} visible otra vez`,
      commit: () => writes.setArchived(s.id, archive),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: archive ? "No se ha podido archivar" : "No se ha podido desarchivar",
    });
  };

  const copySources = seasons.filter((s) => data.players.some((p) => (p.seasons ?? []).includes(s.id)));
  const defaultSource = () => (active && copySources.some((s) => s.id === active.id) ? active.id : (copySources.at(-1)?.id ?? ""));
  const openNew = () => {
    setNewName(nextSeasonName(seasons));
    setCopyFrom(defaultSource());
    setModalError("");
    setModal({ k: "new" });
  };
  const openCap = (s: SeasonCard) => {
    setCap(s.captainId);
    setModal({ k: "cap", id: s.id });
  };

  // ── what each modal says ──
  const newNameError = modal?.k === "new" ? seasonNameError(newName, seasons, null) : null;
  const modalView = (() => {
    if (!modal) return null;
    if (modal.k === "new") return { title: "Nueva temporada", list: [] as string[], yes: "Crear temporada", tone: "sky" as const, disabled: !!newNameError };
    const s = target;
    if (!s) return null;
    if (modal.k === "cap") return { title: `Capitán de la ${s.name}`, list: [], yes: "Guardar capitán", tone: "sky" as const, disabled: cap === (s.captainPlayerId ?? "") };
    const impact = archiveImpact(s.id, data.seasons, data.players, data.matches);
    const h = hidden[s.id];
    if (modal.k === "arch")
      return {
        title: `¿Archivar ${s.name}?`,
        list: [
          `Sus ${plural(impact.matches, "partido", "partidos")} y las estadísticas de ${plural(impact.players, "jugador", "jugadores")} se ocultan en la web`,
          ...(impact.hiddenPlayers ? [`${plural(impact.hiddenPlayers, "jugador que solo juega", "jugadores que solo juegan")} esta temporada ${impact.hiddenPlayers === 1 ? "sale" : "salen"} también de la plantilla de aquí`] : []),
          ...(s.id === activeId ? ["Es la temporada en curso: la web se queda sin temporada activa"] : []),
          "Las actas y la plantilla no se pierden",
          "Se puede desarchivar cuando queráis",
        ],
        yes: "Archivar",
        tone: "sky" as const,
        disabled: false,
      };
    if (modal.k === "unarch")
      return {
        title: `¿Desarchivar ${s.name}?`,
        list: [
          h ? `Sus ${plural(h.matches, "partido", "partidos")} y las estadísticas de ${plural(h.players, "jugador", "jugadores")} vuelven a verse en la web` : "Sus partidos y estadísticas vuelven a verse en la web",
          ...(active && active.id !== s.id ? [`La ${active.name} sigue siendo la temporada en curso`] : []),
        ],
        yes: "Desarchivar",
        tone: "sky" as const,
        disabled: false,
      };
    return {
      title: `¿Eliminar ${s.name} para siempre?`,
      list: [
        "Se borran la temporada, su nombre y su capitán",
        h ? `Sus ${plural(h.matches, "partido", "partidos")} se quedan sin temporada: no se borran, pero ya no salen en ninguna` : "Sus partidos se quedan sin temporada: no se borran, pero ya no salen en ninguna",
        "Los jugadores siguen en la plantilla",
        "No se puede deshacer",
      ],
      yes: "Eliminar temporada",
      tone: "redf" as const,
      disabled: false,
    };
  })();
  const capOptions = target
    ? data.players
        .filter((p) => (p.seasons ?? []).includes(target.id))
        .map((p) => ({ id: p.id, num: numberIn(p, target.id), name: nameIn(p, target.id) }))
        .sort((a, b) => (a.num ?? 999) - (b.num ?? 999))
    : [];
  const copyName = copyFrom ? (byId(copyFrom)?.name ?? "") : "";
  const copyCount = copyFrom ? copyRosterPlan(data.players, copyFrom).length : 0;

  // ── the vitrina ──
  const vitrinaCard = active ? cards.find((c) => c.id === active.id) : undefined;
  const vitrina = (() => {
    if (!vitrinaCard) return null;
    const s = vitrinaCard;
    const arch = s.state === "archived";
    const sc = showcaseOf(s.id);
    const pich = sc.pichichi ? { ...shirtOf(sc.pichichi.id, s.id), goals: sc.pichichi.goals } : null;
    const mvpNames = sc.mvp ? both(sc.mvp.ids.slice(0, 2).map((id) => shirtOf(id, s.id).name)) : "";
    const trophies = [
      { k: "Mayor victoria", v: sc.biggest ? `${sc.biggest.gf}–${sc.biggest.ga}` : "—", d: sc.biggest ? `a ${sc.biggest.rival} · ${sc.biggest.label}` : "Todavía sin victorias" },
      { k: "Mejor racha", v: sc.streak ? plural(sc.streak, "victoria", "victorias") : "—", d: sc.streak > 1 ? "seguidas" : sc.streak ? "sin racha todavía" : "Todavía sin victorias" },
      { k: "Más veces MVP", v: sc.mvp ? mvpNames : "—", d: sc.mvp ? plural(sc.mvp.times, "jornada", "jornadas") : "Sin votaciones cerradas" },
    ];
    return (
      <section className="cab" aria-label={s.name}>
        <div className="top">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            {renameRow(s) ?? <h2 className="ttl">{s.name}</h2>}
            {arch ? (
              <span className="tag mu" style={{ alignSelf: "flex-start" }}>
                <AdIcon name="lock" size={13} />
                Archivada · oculta en la web
              </span>
            ) : (
              <span className="tag sk" style={{ alignSelf: "flex-start" }}>
                ● Activa · se ve en la web
              </span>
            )}
          </div>
          <div className="r">
            {ren?.id !== s.id && (
              <button type="button" className="btn sm line" onClick={() => startRename(s)} aria-label={`Renombrar «${s.name}»`}>
                <AdIcon name="pencil" size={16} />
                Renombrar
              </button>
            )}
            {arch ? (
              <button type="button" className="btn sm line" onClick={() => setModal({ k: "unarch", id: s.id })} aria-haspopup="dialog" aria-label={`Desarchivar «${s.name}»`}>
                Desarchivar
              </button>
            ) : (
              <button type="button" className="btn sm line" onClick={() => setModal({ k: "arch", id: s.id })} aria-haspopup="dialog" aria-label={`Archivar «${s.name}»`}>
                <AdIcon name="lock" size={14} />
                Archivar
              </button>
            )}
          </div>
        </div>
        <div className="rec">
          {(
            [
              ["V", "Victorias", sc.v],
              ["E", "Empates", sc.e],
              ["D", "Derrotas", sc.d],
            ] as const
          ).map(([r, k, n]) => (
            <div key={r}>
              <span className="k">
                <span className={`ved ${r} sm`} aria-hidden="true">
                  {r}
                </span>
                {k}
              </span>
              <span className="v">{n}</span>
            </div>
          ))}
          <div>
            <span className="k">
              <AdIcon name="ball" size={14} />
              Goles
            </span>
            <span className="v" aria-label={`${sc.gf} a favor, ${sc.ga} en contra`}>
              {sc.gf}
              <small> – {sc.ga}</small>
            </span>
          </div>
        </div>
        <div className="pich">
          <ShirtBack num={pich?.num ?? ""} name={pich?.name} size={70} big state={pich ? "" : "empty"} />
          <span>
            <small>Pichichi</small>
            <b>{pich?.name ?? "—"}</b>
            <small>{pich ? plural(pich.goals, "gol", "goles") : "Todavía sin goles"}</small>
          </span>
          <button
            type="button"
            className="capb"
            style={{ marginLeft: "auto", textAlign: "right" }}
            onClick={() => openCap(s)}
            aria-haspopup="dialog"
            aria-label={`Cambiar el capitán de la ${s.name} (ahora: ${s.captain})`}
          >
            <small>Capitán de la temporada</small>
            <b>
              {s.captain} <AdIcon name="pencil" size={14} />
            </b>
            <small>{s.players == null ? "—" : `${s.players} en la plantilla`}</small>
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="k" style={{ fontSize: 13, fontWeight: 600, color: "#9fb3d3" }}>
            {sc.total ? `La balda · jornadas ${sc.published} de ${sc.total}` : "La balda · sin partidos en el calendario"}
          </span>
          {sc.total ? (
            <div className="jshelf" role="list" aria-label="La balda">
              {sc.shelf.map((x) => (
                <span key={x.id} role="listitem" className={`ved ${x.r ?? "o"}`} aria-label={x.aria}>
                  {x.r ?? ""}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="troph">
          {trophies.map((t) => (
            <div key={t.k}>
              <small>{t.k}</small>
              <b>{t.v}</b>
              <span>{t.d}</span>
            </div>
          ))}
        </div>
        <p className="fot">{countsNote(sc.waiting)}</p>
      </section>
    );
  })();

  // ── the other seasons ──
  const others = cards.filter((c) => c.id !== vitrinaCard?.id);
  const otherCard = (s: SeasonCard) => {
    const arch = s.state === "archived";
    const h = hidden[s.id];
    const sc = arch ? null : showcaseOf(s.id);
    const rr = arch
      ? h
        ? [plural(h.matches, "jornada", "jornadas"), plural(h.players, "jugador", "jugadores")]
        : ["Contando…"]
      : [sc && sc.published ? `${sc.v} V · ${sc.e} E · ${sc.d} D` : "Sin partidos publicados", `${s.played} de ${s.total} jornadas`, plural(s.players ?? 0, "jugador", "jugadores")];
    return (
      <article key={s.id} className={`arch ${arch ? "isA" : ""}`.trim()} aria-label={s.name}>
        <div className="top">
          {renameRow(s) ?? <h3>{s.name}</h3>}
          {arch ? (
            <span className="tag mu" style={{ marginLeft: "auto" }}>
              <AdIcon name="lock" size={13} />
              Archivada · oculta
            </span>
          ) : s.state === "done" ? (
            <span className="tag mu" style={{ marginLeft: "auto" }}>
              Terminada
            </span>
          ) : (
            <span className="tag am" style={{ marginLeft: "auto" }}>
              En preparación
            </span>
          )}
        </div>
        <div className="rr">
          {rr.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        {s.state === "prep" && <p className="hint">Pasa a ser la temporada en curso con su primer partido.</p>}
        <div className="cta-row">
          {arch ? (
            <>
              <button type="button" className="btn sm line" onClick={() => setModal({ k: "unarch", id: s.id })} aria-haspopup="dialog" aria-label={`Desarchivar «${s.name}»`}>
                Desarchivar
              </button>
              <button type="button" className="btn sm red" onClick={() => setModal({ k: "del", id: s.id })} aria-haspopup="dialog" aria-label={`Eliminar «${s.name}»`}>
                <AdIcon name="trash" size={16} />
                Eliminar
              </button>
            </>
          ) : (
            <>
              {ren?.id !== s.id && (
                <button type="button" className="btn sm line" onClick={() => startRename(s)} aria-label={`Renombrar «${s.name}»`}>
                  <AdIcon name="pencil" size={16} />
                  Renombrar
                </button>
              )}
              <button type="button" className="btn sm line" onClick={() => setModal({ k: "arch", id: s.id })} aria-haspopup="dialog" aria-label={`Archivar «${s.name}»`}>
                <AdIcon name="lock" size={14} />
                Archivar
              </button>
            </>
          )}
        </div>
      </article>
    );
  };

  const body = data.error ? (
    <LoadError what="las temporadas" />
  ) : data.loading ? (
    <div className="skel" role="status" aria-label="Cargando las temporadas">
      <i />
      <i />
      <i />
    </div>
  ) : (
    <div className="tg">
      {vitrina ?? (
        <div className="void">
          <ShirtBack num="?" size={110} big state="empty" />
          <h3>Ninguna temporada en curso</h3>
          <p>Crea una temporada y su primer partido: la vitrina se llena sola con las actas publicadas.</p>
        </div>
      )}
      <div className="tcol scr">
        {others.map(otherCard)}
        <button type="button" className="newS" onClick={openNew} aria-haspopup="dialog">
          <b>
            <AdIcon name="plus" /> Nueva temporada
          </b>
          <small>Empieza en preparación, sin partidos. Puedes copiar la plantilla con sus dorsales.</small>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {desktop ? (
        <>
          <div className="vh">
            <div>
              <h1 className="ttl">Temporadas</h1>
              <p className="ld">Cada temporada, a la vitrina · activa, en preparación o archivada</p>
            </div>
          </div>
          {body}
        </>
      ) : (
        <div className="msc">{body}</div>
      )}
      {modalView && (
        <ConfirmModal
          open
          onClose={closeModal}
          title={modalView.title}
          consequences={modalView.list}
          confirmLabel={modalView.yes}
          confirmTone={modalView.tone}
          confirmDisabled={modalView.disabled}
          busy={busy}
          error={modalError || undefined}
          onConfirm={() => void confirm()}
        >
          {modal?.k === "new" && (
            <>
              <div className="fld">
                <label htmlFor="ns-name">Nombre</label>
                <input id="ns-name" className={`inp ${newNameError ? "bad" : ""}`.trim()} value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} aria-invalid={!!newNameError || undefined} autoComplete="off" />
                {newNameError && (
                  <span className="bad">
                    <AdIcon name="x" size={13} />
                    {newNameError}
                  </span>
                )}
              </div>
              {copySources.length > 0 && (
                <div className="fld">
                  <span className="lb" id="ns-copy">
                    {copySources.length > 1 ? "¿Copiar la plantilla de otra temporada?" : `¿Copiar la plantilla de la ${copySources[0].name}?`}
                  </span>
                  <div className="sgf" role="group" aria-labelledby="ns-copy">
                    <button type="button" aria-pressed={!!copyFrom} onClick={() => setCopyFrom(copyFrom || defaultSource())}>
                      Sí, con sus dorsales
                    </button>
                    <button type="button" aria-pressed={!copyFrom} onClick={() => setCopyFrom("")}>
                      No, empieza vacía
                    </button>
                  </div>
                  {copyFrom && copySources.length > 1 && (
                    <select className="inp" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} aria-label="Copiar de">
                      {copySources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <p className="hint">
                {copyFrom ? `${plural(copyCount, "jugador", "jugadores")} de la ${copyName} entran con su nombre en camiseta y su dorsal. ` : ""}
                Empieza «En preparación», sin partidos: pasa a ser la temporada en curso con su primer partido.
              </p>
            </>
          )}
          {modal?.k === "cap" && (
            <div className="fld">
              <label htmlFor="cap-sel">Capitán</label>
              <select id="cap-sel" className="inp" value={cap} onChange={(e) => setCap(e.target.value)}>
                <option value="">— Sin capitán —</option>
                {capOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.num != null ? `${p.num} · ` : ""}
                    {p.name}
                  </option>
                ))}
              </select>
              {!capOptions.length && <span className="hint">Nadie juega esta temporada todavía: apúntalos desde la plantilla.</span>}
            </div>
          )}
        </ConfirmModal>
      )}
    </>
  );
}
