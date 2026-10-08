// Temporadas — one card per season: name and state (Activa ✓ / Archivada 🔒 / En preparación / Terminada),
// captain (editable), jornadas, players, matches. Renombrar inline; Archivar / Desarchivar (modal with what
// it hides; the setSeasonArchived callable); Eliminar only once archived (red modal, it cannot be undone);
// «Nueva temporada» (modal: name, and optionally the plantilla of an earlier season with its shirts and
// dorsals). Renames, captains and (un)archiving wait behind an undo toast.
import { useMemo, useRef, useState } from "react";
import type { SeasonDoc } from "../../../lib/schemas";
import { useArchivedCounts } from "../club/clubLive";
import { LoadError } from "../club/ClubStates";
import { nameIn, numberIn } from "../club/plantillaLogic";
import { STATE_LABEL, archiveImpact, copyRosterPlan, nextSeasonName, seasonCards, seasonNameError, type SeasonCard } from "../club/seasonsLogic";
import { useClubWrites } from "../club/useClubWrites";
import { AdminView } from "../shell/AdminView";
import { useAdmin } from "../shell/context";
import { Chip, FieldCheck, SkeletonRows, Switch, type ChipTone } from "../ui/controls";
import { AdIcon, type AdIconName } from "../ui/icons";
import { ConfirmModal, type Consequence } from "../ui/layers";
import { useToast } from "../ui/toastContext";
import "../../../styles/admin-club.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
type ModalState = { k: "arch" | "unarch" | "del" | "cap"; id: string } | { k: "new" } | null;
const STATE_CHIP: Record<SeasonCard["state"], { tone: ChipTone; icon: AdIconName }> = {
  active: { tone: "ok", icon: "check" },
  archived: { tone: "", icon: "lock" },
  prep: { tone: "sky", icon: "clock" },
  done: { tone: "", icon: "flag" },
};

export function Temporadas() {
  const data = useAdmin();
  const toast = useToast();
  const writes = useClubWrites();
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
  const active = data.season ? (seasons.find((s) => s.id === data.season?.id) ?? null) : null;
  const cards = seasonCards({ seasons, players: data.players, matches: data.matches, stateOf: data.stateOf, activeId: active?.id, now: data.now, hidden });
  const byId = (id: string) => seasons.find((s) => s.id === id);

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
    toast.defer({ message: `Renombrada: «${name}».`, commit: () => writes.saveSeason(s.id, { name }), onUndo: done, onError: done, onDone: done, errorMessage: "No se ha podido renombrar la temporada" });
  };

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
      const copy = copyFrom ? copyRosterPlan(data.players, copyFrom) : [];
      setBusy(true);
      setModalError("");
      try {
        await writes.createSeason(newName.trim(), copy);
        setModal(null);
        toast.show({ message: `«${newName.trim()}» creada · en preparación${copy.length ? ` con ${plural(copy.length, "jugador", "jugadores")}` : ""}.` });
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
        toast.show({ message: `«${s.name}» eliminada.` });
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
      const who = data.players.find((p) => p.id === cap);
      patch(s.id, { captainPlayerId });
      const done = unpatch(s.id, ["captainPlayerId"]);
      toast.defer({
        message: who ? `Capitán de la ${s.name}: ${nameIn(who, s.id)}.` : `La ${s.name} se queda sin capitán.`,
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
      message: archive ? `«${s.name}» archivada · oculta en la web.` : `«${s.name}» vuelve a salir en la web.`,
      commit: () => writes.setArchived(s.id, archive),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: archive ? "No se ha podido archivar" : "No se ha podido desarchivar",
    });
  };

  const openNew = () => {
    setNewName(nextSeasonName(seasons));
    setCopyFrom("");
    setModalError("");
    setModal({ k: "new" });
  };
  const openCap = (s: SeasonCard) => {
    setCap(s.captainId);
    setModal({ k: "cap", id: s.id });
  };

  // ── what each modal says ──
  const copySources = seasons.filter((s) => data.players.some((p) => (p.seasons ?? []).includes(s.id)));
  const modalView = (() => {
    if (!modal) return null;
    if (modal.k === "new") {
      const n = copyFrom ? copyRosterPlan(data.players, copyFrom).length : 0;
      const from = copyFrom ? byId(copyFrom)?.name : "";
      const list: Consequence[] = [
        { tone: "", text: copyFrom ? "Luego eliges capitán; los dorsales se pueden cambiar jugador a jugador" : "Luego eliges plantilla (dorsales por temporada) y capitán" },
        ...(copyFrom ? [{ tone: "o" as const, text: `${plural(n, "jugador", "jugadores")} de la ${from} entran con su nombre en camiseta y su dorsal` }] : []),
        ...(active ? [{ tone: "o" as const, text: `La ${active.name} sigue activa mientras tanto` }] : []),
      ];
      return {
        kicker: "Temporadas",
        title: "Nueva temporada",
        lede: "Empieza sin partidos y en preparación; sale en el selector de temporadas de la web.",
        list,
        yes: "Crear temporada",
        tone: "gold" as const,
        disabled: !!seasonNameError(newName, seasons, null),
      };
    }
    const s = target;
    if (!s) return null;
    if (modal.k === "cap") return { kicker: `Temporadas · ${s.name}`, title: `Capitán de la ${s.name}`, lede: "Recibe la mención dorada en la plantilla cuando la temporada aún no tiene goleador.", list: [], yes: "Guardar capitán", tone: "pri" as const, disabled: cap === (s.captainPlayerId ?? "") };
    const impact = archiveImpact(s.id, data.seasons, data.players, data.matches);
    const h = hidden[s.id];
    if (modal.k === "arch")
      return {
        kicker: "Temporadas",
        title: `¿Archivar «${s.name}»?`,
        lede: "Se oculta de la web, pero no se borra nada.",
        list: [
          { tone: "r", text: `Sus ${plural(impact.matches, "partido", "partidos")} y las estadísticas de ${plural(impact.players, "jugador", "jugadores")} dejan de salir en la web` },
          ...(impact.hiddenPlayers ? [{ tone: "r" as const, text: `${plural(impact.hiddenPlayers, "jugador que solo juega", "jugadores que solo juegan")} esa temporada ${impact.hiddenPlayers === 1 ? "deja" : "dejan"} de salir también aquí, en la plantilla` }] : []),
          { tone: "o", text: "Todo se conserva: se puede desarchivar cuando quieras" },
          s.id === active?.id ? { tone: "r", text: "Es la temporada activa: la web se quedará sin temporada en curso" } : { tone: "", text: "No afecta a la temporada activa" },
        ] as Consequence[],
        yes: "Archivar",
        tone: "pri" as const,
        disabled: false,
      };
    if (modal.k === "unarch")
      return {
        kicker: "Temporadas",
        title: `¿Desarchivar «${s.name}»?`,
        lede: "Vuelve a salir en la web tal y como estaba.",
        list: [
          { tone: "o", text: h ? `${plural(h.matches, "partido", "partidos")} y las estadísticas de ${plural(h.players, "jugador", "jugadores")} vuelven a ser públicos` : "Sus partidos y estadísticas vuelven a ser públicos" },
          ...(active ? [{ tone: "" as const, text: `La ${active.name} sigue siendo la activa` }] : []),
        ] as Consequence[],
        yes: "Desarchivar",
        tone: "pri" as const,
        disabled: false,
      };
    return {
      kicker: "Temporadas · no se puede deshacer",
      title: `¿Eliminar «${s.name}»?`,
      lede: "Se borra para siempre. Si solo quieres ocultarla, déjala archivada.",
      list: [
        { tone: "r", text: "Se borran la temporada, su nombre y su capitán" },
        { tone: "r", text: h ? `Sus ${plural(h.matches, "partido", "partidos")} se quedan sin temporada: no se borran, pero ya no salen en ninguna` : "Sus partidos se quedan sin temporada: no se borran, pero ya no salen en ninguna" },
        { tone: "o", text: "Los jugadores siguen en la plantilla" },
      ] as Consequence[],
      yes: "Eliminar para siempre",
      tone: "red solid" as const,
      disabled: false,
    };
  })();
  const capOptions = target
    ? data.players
        .filter((p) => (p.seasons ?? []).includes(target.id))
        .map((p) => ({ id: p.id, num: numberIn(p, target.id), name: nameIn(p, target.id) }))
        .sort((a, b) => (a.num ?? 999) - (b.num ?? 999))
    : [];

  return (
    <AdminView
      kicker="Club"
      title="Temporadas"
      lead="Archivar oculta partidos y estadísticas en la web; se puede deshacer. Eliminar no."
      actions={
        <button type="button" className="btn sm" onClick={openNew} aria-haspopup="dialog">
          <AdIcon name="plus" size={16} />
          Nueva temporada
        </button>
      }
    >
      {data.error ? (
        <LoadError what="las temporadas" />
      ) : data.loading ? (
        <div className="vb scr">
          <SkeletonRows rows={3} label="Cargando las temporadas…" />
        </div>
      ) : (
        <div className="vb scr">
          <div className="ssg">
            {cards.map((s) => {
              const renaming = ren?.id === s.id;
              const arch = s.state === "archived";
              const chip = STATE_CHIP[s.state];
              return (
                <article key={s.id} className={`ssn ${arch ? "arch" : ""}`.trim()} aria-label={s.name}>
                  {renaming ? (
                    <div className="ren">
                      <label className="fld">
                        <span className="lbl">Nuevo nombre</span>
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
                          aria-invalid={!!renError || undefined}
                          autoComplete="off"
                        />
                        {renError && <FieldCheck tone="bad">{renError}</FieldCheck>}
                      </label>
                      <div className="row">
                        <button type="button" className="btn sm pri" aria-disabled={!!renError} onClick={saveRename}>
                          <AdIcon name="check" size={16} />
                          Guardar
                        </button>
                        <button type="button" className="btn sm line" onClick={() => setRen(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="hd">
                      <b>{s.name}</b>
                      <Chip tone={chip.tone} icon={chip.icon}>
                        {STATE_LABEL[s.state]}
                      </Chip>
                    </div>
                  )}
                  <dl>
                    <div>
                      <dt>Capitán</dt>
                      <dd>
                        {arch ? (
                          s.captain
                        ) : (
                          <button type="button" className="ad-cap" onClick={() => openCap(s)} aria-haspopup="dialog" aria-label={`Cambiar el capitán de la ${s.name} (ahora: ${s.captain})`}>
                            {s.captain}
                            <AdIcon name="pencil" size={13} />
                          </button>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Jornadas</dt>
                      <dd>{s.jornadas}</dd>
                    </div>
                    <div>
                      <dt>Jugadores</dt>
                      <dd>{s.players ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Partidos</dt>
                      <dd>{s.matches}</dd>
                    </div>
                  </dl>
                  <div className="row">
                    {!renaming && (
                      <button type="button" className="btn sm line" onClick={() => startRename(s)} aria-label={`Renombrar «${s.name}»`}>
                        <AdIcon name="pencil" size={16} />
                        Renombrar
                      </button>
                    )}
                    <button type="button" className="btn sm line" onClick={() => setModal({ k: arch ? "unarch" : "arch", id: s.id })} aria-haspopup="dialog" aria-label={`${arch ? "Desarchivar" : "Archivar"} «${s.name}»`}>
                      <AdIcon name="arch" size={16} />
                      {arch ? "Desarchivar" : "Archivar"}
                    </button>
                    {arch && (
                      <button type="button" className="btn sm red" onClick={() => setModal({ k: "del", id: s.id })} aria-haspopup="dialog" aria-label={`Eliminar «${s.name}»`}>
                        <AdIcon name="trash" size={16} />
                        Eliminar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            <button type="button" className="ssn new" onClick={openNew} aria-haspopup="dialog">
              <AdIcon name="plus" size={24} />
              Nueva temporada
              <small className="hint ad-block">{cards.length ? "Empieza vacía · eliges plantilla y capitán" : "Todavía no hay ninguna: crea la primera"}</small>
            </button>
          </div>
        </div>
      )}
      {modalView && (
        <ConfirmModal
          open
          onClose={closeModal}
          tone={modalView.tone.startsWith("red") ? "red" : ""}
          kicker={modalView.kicker}
          title={modalView.title}
          lede={modalView.lede}
          consequences={modalView.list}
          confirmLabel={modalView.yes}
          confirmTone={modalView.tone}
          confirmDisabled={modalView.disabled}
          cancelLabel={modal?.k === "del" ? "Mejor no" : "Cancelar"}
          busy={busy}
          error={modalError || undefined}
          onConfirm={() => void confirm()}
        >
          {modal?.k === "new" && (
            <div className="fg2 ad-mt">
              <label className="fld w2">
                <span className="lbl">Nombre</span>
                <input className={`inp ${seasonNameError(newName, seasons, null) ? "bad" : ""}`.trim()} value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} autoComplete="off" />
                {seasonNameError(newName, seasons, null) && <FieldCheck tone="bad">{seasonNameError(newName, seasons, null)}</FieldCheck>}
              </label>
              {copySources.length > 0 && (
                <div className="fld w2">
                  <Switch checked={!!copyFrom} onChange={(on) => setCopyFrom(on ? (active && copySources.some((s) => s.id === active.id) ? active.id : copySources[copySources.length - 1].id) : "")}>
                    Copiar la plantilla de una temporada anterior
                  </Switch>
                  {copyFrom && copySources.length > 1 && (
                    <label className="fld">
                      <span className="lbl">Copiar de</span>
                      <select className="inp" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                        {copySources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}
          {modal?.k === "cap" && (
            <label className="fld ad-mt">
              <span className="lbl">Capitán</span>
              <select className="inp" value={cap} onChange={(e) => setCap(e.target.value)}>
                <option value="">— Sin capitán —</option>
                {capOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.num != null ? `#${p.num} · ` : ""}
                    {p.name}
                  </option>
                ))}
              </select>
              {!capOptions.length && <span className="hint">Nadie juega esta temporada todavía: apúntalos desde la plantilla.</span>}
            </label>
          )}
        </ConfirmModal>
      )}
    </AdminView>
  );
}
