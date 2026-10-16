// Caja (/admin/caja) — the team's money as a shared ledger: no real payments (Bizum or the bank stay outside;
// «Cómo pagar» says how) and no fines. On top, the jar, what the team owes and the cuota (with «Ajustes»);
// then the captain's actions: «Cobrar cuota», «Coste del partido» (campo y árbitro split to the cent among
// who played; `?coste=<matchId>` opens it, the match workspace's shortcut), «Apuntar pago / gasto /
// ingreso». Below, everyone's balance (who owes first, in words and with an icon, never colour alone) and the
// full movement log with its filters (season, kind, player) and «Anular» — a correction never deletes: it
// asks, then sets `void` and the movement stays in the log, crossed out. The sums are derived/caja's, the
// same the vestuario's «La caja» reads.
import { useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { dateMillis } from "../../../lib/clubData";
import { jornadaOf } from "../../../lib/derived/jornada";
import {
  balanceRows,
  balances,
  balanceText,
  dayLabel,
  filterMovs,
  fmtEuros,
  jarBalance,
  KIND_LABEL,
  movSign,
  owedTotal,
  sortMovs,
  type BalancePlayer,
  type CajaKind,
  type CajaMov,
} from "../../../lib/derived/caja";
import { madridDate } from "../../../lib/derived/madrid";
import { dayOf } from "../partidos/listModel";
import { AjustesModal, CosteModal, CuotaModal, MovModal, type CostOption, type FreeKind } from "../caja/CajaModals";
import { LoadError } from "../club/ClubStates";
import { nameIn, numberIn } from "../club/plantillaLogic";
import { useCaja, useCajaWrites } from "../data/useCaja";
import { useAdmin } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon, type AdIconName } from "../ui/icons";
import { ConfirmModal } from "../ui/layers";
import { useToast } from "../ui/toastContext";
import "../caja/caja.css";

type Ask = { k: "cuota" } | { k: "coste"; matchId: string } | { k: "mov"; kind: FreeKind } | { k: "ajustes" } | { k: "anular"; id: string } | null;
const STATE_ICON: Record<"debe" | "al-dia" | "a-favor", AdIconName> = { debe: "alert", "al-dia": "check", "a-favor": "plus" };
const KIND_OPTIONS: { value: CajaKind | ""; label: string }[] = [
  { value: "", label: "Todos los tipos" },
  { value: "cargo", label: "Cargos" },
  { value: "pago", label: "Pagos" },
  { value: "gasto", label: "Gastos" },
  { value: "ingreso", label: "Ingresos" },
];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const signed = (m: CajaMov) => `${movSign(m.kind) > 0 ? "+" : "−"}${fmtEuros(m.amount)}`;

export function Caja() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const toast = useToast();
  const writes = useCajaWrites();
  const navigate = useNavigate();
  const search: { coste?: unknown } = useSearch({ strict: false });
  const costeParam = typeof search.coste === "string" && search.coste ? search.coste : typeof search.coste === "number" ? String(search.coste) : "";
  const costeMatch = costeParam ? data.matches.find((m) => m.id === costeParam) : undefined;

  const [seasonPick, setSeasonPick] = useState<string | null>(null);
  const seasonId = seasonPick ?? costeMatch?.seasonId ?? data.season?.id ?? data.seasons.find((s) => !s.archived)?.id ?? "";
  const season = data.seasons.find((s) => s.id === seasonId) ?? null;
  const seasonName = season?.name ?? "temporada";
  const caja = useCaja(seasonId || undefined);
  const [kind, setKind] = useState<CajaKind | "">("");
  const [playerFilter, setPlayerFilter] = useState("");
  const [ask, setAsk] = useState<Ask>(null);
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState("");
  // (the shortcut's ?coste= opens its modal once; closing it clears the address)
  const [costeSeen, setCosteSeen] = useState("");
  const costeOpen = !!costeMatch && ask === null && costeSeen !== costeParam;
  const openAsk: Ask = costeOpen ? { k: "coste", matchId: costeParam } : ask;

  const squad: BalancePlayer[] = useMemo(
    () =>
      data.players
        .filter((p) => (p.seasons ?? []).includes(seasonId))
        .map((p) => ({ id: p.id, name: nameIn(p, seasonId), number: numberIn(p, seasonId) }))
        .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "es")),
    [data.players, seasonId],
  );
  const nameOf = useMemo(() => {
    const byId = new Map(data.players.map((p) => [p.id, p]));
    return (id: string) => {
      const p = byId.get(id);
      return p ? nameIn(p, seasonId) : "Jugador";
    };
  }, [data.players, seasonId]);
  const order = useMemo(() => {
    const byId = new Map(data.players.map((p) => [p.id, numberIn(p, seasonId) ?? 999]));
    return (id: string) => byId.get(id) ?? 999;
  }, [data.players, seasonId]);

  const movs = caja.movs;
  const bal = useMemo(() => balances(movs), [movs]);
  const rows = useMemo(() => balanceRows(movs, squad, nameOf), [movs, squad, nameOf]);
  const jar = jarBalance(movs);
  const owed = owedTotal(movs);
  const debtors = rows.filter((r) => r.state === "debe").length;
  const log = useMemo(() => sortMovs(filterMovs(movs, { kind, playerId: playerFilter })), [movs, kind, playerFilter]);
  const filterPlayers = useMemo(() => rows.map((r) => ({ id: r.id, name: r.name, number: r.number })).sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "es")), [rows]);

  const costOptions: CostOption[] = useMemo(
    () =>
      data.matches
        .filter((m) => m.seasonId === seasonId && m.published && m.status !== "cancelled" && m.status !== "postponed")
        .map((m) => {
          const t = dateMillis(m.date);
          const jornada = jornadaOf(data.published, m.id);
          return { ...m, jornada, at: t, day: Number.isFinite(t) ? madridDate(t) : madridDate(data.now), label: `${jornada ? `J${jornada} · ` : ""}${m.rival || "Rival"} · ${dayOf(t)}` };
        })
        .reverse(),
    [data.matches, data.published, seasonId, data.now],
  );
  const defaultCost = () => {
    const played = costOptions.find((m) => m.status === "finished") ?? costOptions.find((m) => m.at <= data.now);
    return played?.id ?? costOptions[0]?.id ?? "";
  };

  const close = () => {
    setAsk(null);
    setVoidError("");
    if (costeParam) {
      setCosteSeen(costeParam);
      void navigate({ to: "/admin/caja", search: {}, replace: true });
    }
  };
  const done = (message: string) => {
    close();
    toast.show({ tag: "CAJA", message });
  };

  const voidTarget = openAsk?.k === "anular" ? movs.find((m) => m.id === openAsk.id) : undefined;
  const confirmVoid = async () => {
    if (!voidTarget || voiding) return;
    setVoiding(true);
    setVoidError("");
    try {
      await writes.voidMov(voidTarget.id);
      done(`Anulado: «${voidTarget.concept}» · ${fmtEuros(voidTarget.amount)}`);
    } catch (e) {
      setVoidError(`No se ha podido anular: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setVoiding(false);
    }
  };
  const whoOf = (m: CajaMov) => (m.playerId ? nameOf(m.playerId) : "El bote");

  const seasonSelect = (
    <label className="cj-season">
      <span className="sr">Temporada</span>
      <select className="inp" value={seasonId} onChange={(e) => setSeasonPick(e.target.value)} aria-label="Temporada">
        {data.seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.archived ? " · archivada" : ""}
          </option>
        ))}
      </select>
    </label>
  );

  const summary = (
    <section className="cj-sum" aria-label={`La caja de la ${seasonName}`}>
      <div className="cj-tile cj-jar">
        <span className="k">En el bote</span>
        <b>{fmtEuros(jar)}</b>
        <small>Pagos e ingresos, menos gastos</small>
      </div>
      <div className="cj-tile">
        <span className="k">Os deben</span>
        <b>{fmtEuros(owed)}</b>
        <small>{debtors ? `${plural(debtors, "jugador debe", "jugadores deben")} dinero` : "Nadie debe nada"}</small>
      </div>
      <div className="cj-tile">
        <span className="k">Cuota</span>
        <b>{caja.settings.cuota ? fmtEuros(caja.settings.cuota) : "Sin cuota"}</b>
        <small>
          {caja.settings.cuota ? (caja.settings.cuotaPeriod === "mensual" ? "Cada mes" : "Por temporada") : "Ponla en Ajustes"}
          {caja.settings.howToPay ? ` · Cómo pagar: ${caja.settings.howToPay}` : " · Falta «Cómo pagar»"}
        </small>
        <button type="button" className="btn sm line" onClick={() => setAsk({ k: "ajustes" })} aria-haspopup="dialog">
          <AdIcon name="pencil" size={15} />
          Ajustes
        </button>
      </div>
    </section>
  );

  const actions = (
    <div className="cj-acts" role="group" aria-label="Apuntar en la caja">
      <button type="button" className="btn gold" onClick={() => setAsk({ k: "cuota" })} aria-haspopup="dialog">
        <AdIcon name="team" size={17} />
        Cobrar cuota
      </button>
      <button type="button" className="btn sky" onClick={() => setAsk({ k: "coste", matchId: defaultCost() })} aria-haspopup="dialog">
        <AdIcon name="whistle" size={17} />
        Coste del partido
      </button>
      <button type="button" className="btn line" onClick={() => setAsk({ k: "mov", kind: "pago" })} aria-haspopup="dialog">
        <AdIcon name="plus" size={17} />
        Apuntar pago
      </button>
      <button type="button" className="btn line" onClick={() => setAsk({ k: "mov", kind: "gasto" })} aria-haspopup="dialog">
        <AdIcon name="minus" size={17} />
        Apuntar gasto
      </button>
      <button type="button" className="btn line" onClick={() => setAsk({ k: "mov", kind: "ingreso" })} aria-haspopup="dialog">
        <AdIcon name="plus" size={17} />
        Apuntar ingreso
      </button>
    </div>
  );

  const balancesCard = (
    <section className="calm cj-bal" aria-labelledby="cj-bal-h">
      <h3 id="cj-bal-h">
        Saldos <em>{plural(rows.length, "jugador", "jugadores")}</em>
      </h3>
      {rows.length ? (
        <ul className="cj-rows" aria-labelledby="cj-bal-h">
          {rows.map((r) => (
            <li key={r.id} className={`cj-row ${r.state}`}>
              <span className="n" aria-hidden="true">
                {r.number ?? "·"}
              </span>
              <b>{r.name}</b>
              <span className="st">
                <AdIcon name={STATE_ICON[r.state]} size={14} />
                {balanceText(r.balance)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Esta temporada no tiene plantilla todavía.</p>
      )}
    </section>
  );

  const logCard = (
    <section className="calm cj-log" aria-labelledby="cj-log-h">
      <h3 id="cj-log-h">
        Movimientos <em>{log.length === movs.length ? movs.length : `${log.length} de ${movs.length}`}</em>
      </h3>
      <div className="cj-filters">
        <select className="inp" value={kind} onChange={(e) => setKind(e.target.value as CajaKind | "")} aria-label="Filtrar por tipo">
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className="inp" value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)} aria-label="Filtrar por jugador">
          <option value="">Todos los jugadores</option>
          {filterPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number != null ? `${p.number} · ` : ""}
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {log.length ? (
        <ul className="cj-movs" aria-label="Movimientos">
          {log.map((m) => (
            <li key={m.id} className={`cj-mov ${m.kind}${m.void ? " void" : ""}`}>
              <span className="d">{dayLabel(m.date)}</span>
              <span className="w">
                <b>{m.concept}</b>
                <small>
                  {KIND_LABEL[m.kind]} · {whoOf(m)}
                </small>
              </span>
              <span className="amt">
                {m.void ? (
                  <>
                    <s aria-label={`${signed(m)}, anulado`}>{signed(m)}</s>
                    <span className="anul">
                      <AdIcon name="x" size={13} />
                      Anulado
                    </span>
                  </>
                ) : (
                  signed(m)
                )}
              </span>
              {!m.void && (
                <button type="button" className="btn sm line" onClick={() => setAsk({ k: "anular", id: m.id })} aria-haspopup="dialog" aria-label={`Anular «${m.concept}» · ${whoOf(m)} · ${fmtEuros(m.amount)}`}>
                  Anular
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{movs.length ? "Ningún movimiento con estos filtros." : "Aún no hay movimientos: empieza por la cuota o el coste de un partido."}</p>
      )}
    </section>
  );

  const body =
    data.error || caja.error ? (
      <LoadError what="la caja" />
    ) : data.loading || caja.loading ? (
      <div className="skel" role="status" aria-label="Cargando la caja">
        <i />
        <i />
        <i />
      </div>
    ) : !seasonId ? (
      <div className="void">
        <h3>Aún no hay temporada</h3>
        <p>La caja va por temporadas: crea una en Temporadas y vuelve.</p>
      </div>
    ) : (
      <div className="cj">
        {!desktop && seasonSelect}
        {summary}
        {actions}
        <div className="cj-cols">
          {balancesCard}
          {logCard}
        </div>
      </div>
    );

  return (
    <>
      {desktop ? (
        <>
          <div className="vh">
            <div>
              <h1 className="ttl">Caja</h1>
              <p className="ld">Cuotas, campo y árbitro, y el bote · todos los socios lo ven igual</p>
            </div>
            {seasonId && <div className="r">{seasonSelect}</div>}
          </div>
          <div className="scr cj-scroll">{body}</div>
        </>
      ) : (
        <div className="msc">{body}</div>
      )}
      {openAsk?.k === "cuota" && <CuotaModal seasonId={seasonId} seasonName={seasonName} settings={caja.settings} squad={squad} movs={movs} now={data.now} onClose={close} onDone={done} addMovs={writes.addMovs} />}
      {openAsk?.k === "coste" && <CosteModal seasonId={seasonId} matches={costOptions} initialId={openAsk.matchId} order={order} nameOf={nameOf} movs={movs} onClose={close} onDone={done} addMovs={writes.addMovs} />}
      {openAsk?.k === "mov" && <MovModal kind={openAsk.kind} seasonId={seasonId} squad={squad} balanceOf={(id) => bal.get(id) ?? 0} initialPlayer={playerFilter} now={data.now} onClose={close} onDone={done} addMovs={writes.addMovs} />}
      {openAsk?.k === "ajustes" && <AjustesModal seasonName={seasonName} settings={caja.settings} onClose={close} onDone={done} save={(s) => writes.saveSettings(seasonId, s)} />}
      <ConfirmModal
        open={!!voidTarget}
        onClose={close}
        title={voidTarget ? `¿Anular «${voidTarget.concept}»?` : ""}
        lede={voidTarget ? `${KIND_LABEL[voidTarget.kind]} · ${whoOf(voidTarget)} · ${fmtEuros(voidTarget.amount)} · ${dayLabel(voidTarget.date)}` : undefined}
        consequences={[voidTarget?.playerId ? "Deja de contar en su saldo y en el bote" : "Deja de contar en el bote", "Se queda en el registro, tachado como anulado", "No se puede deshacer: si te equivocas, apúntalo de nuevo"]}
        confirmLabel="Anular"
        confirmTone="redf"
        busy={voiding}
        error={voidError || undefined}
        onConfirm={() => void confirmVoid()}
      />
    </>
  );
}
