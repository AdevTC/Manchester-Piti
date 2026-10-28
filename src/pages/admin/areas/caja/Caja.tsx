// CAJA · /admin/caja and /admin/caja/coste/<id> (board part-caja.html, caja.js): the team's money as a shared ledger
// — no real payments (Bizum or the bank stay outside; «Cómo pagar» says how) and no fines. Three regions side by
// side on the desktop, each scrolling inside (law 7): el bote with its facts and the actions · the saldos by dorsal ·
// the payment notices to answer and the book of movements. On the tablet and the phone, one at a time under the
// tabs (Resumen · Saldos · Movimientos · Avisos), «Cobrar cuota» pinned above the dock. Writes show at once with
// «Deshacer» (useCajaBook); «Anular» asks first and only crosses the movement out. The cost of a match is its own
// screen: campo y árbitro split to the cent among who played (derived/caja's matchCostPlayers and splitCost, the
// sums the sala always made). The season is the frame's (useAdmin().season, the account menu's picker).
import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useParams } from "@tanstack/react-router";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { KitStillContext } from "../../../../components/jersey3d/kitStill";
import { usePageKitStills } from "../../../../components/jersey3d/usePageKitStills";
import { useDocumentTheme } from "../../../../hooks/useDocumentTheme";
import { dateMillis } from "../../../../lib/clubData";
import { balances, jarBalance, matchCostConcept, matchCostPlayers, owedTotal, parseEuros, centsInput, splitCost, CAJA_LIMITS, sortMovs, type CajaKind, type CajaMov } from "../../../../lib/derived/caja";
import { guestOf, isGuestId } from "../../../../lib/derived/guests";
import { relativeTime } from "../../../../lib/derived/notices";
import { madridDate } from "../../../../lib/derived/madrid";
import { nameFor } from "../../../../lib/derived/names";
import { plural, scoreText } from "../../../../lib/derived/words";
import { rivalCode } from "../../../../lib/eventMeta";
import type { PaletteCommand } from "../../palette/search";
import { useRegisterCommands } from "../../palette/registry";
import { clockTime, shortDate, type AdminMatch } from "../../data/adminLogic";
import { useAdmin } from "../../shell/context";
import { SalaLink } from "../../shell/SalaLink";
import { useSalaGo } from "../../shell/salaHref";
import { SalaScreen, ScreenError, ScreenLoading } from "../../shell/Screen";
import { useStatus } from "../../shell/statusContext";
import { useFrame } from "../../ui/frame";
import { AjustesSheet, AnularSheet, CuotaSheet, MovSheet, RechazarSheet, type FreeKind, type MovPreset } from "./sheets";
import { chargedOf, costMatches, costTarget, cuotaLine, dayWeek, euros, filterBook, bookPage, howLine, KIND_WORD, lastCostTotal, owedLines, resolvedLines, saldoRows, numberIn, saldoText, signedAmount, splitLine, squadOf, WHO_ALL, WHO_BOTE } from "./model";
import { CajaGlyph, RowShirt } from "./parts";
import { useCajaBook } from "./useCajaBook";
import "./caja.css";

type Tab = "resumen" | "saldos" | "movs" | "avisos";
const TABS: readonly { id: Tab; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "saldos", label: "Saldos" },
  { id: "movs", label: "Movimientos" },
  { id: "avisos", label: "Avisos" },
];
type Sheet = { k: "cuota" } | { k: "mov"; kind: FreeKind; preset?: MovPreset } | { k: "ajustes" } | { k: "anular"; id: string } | { k: "rechazar"; id: string } | null;
const KINDS: readonly { v: CajaKind | ""; t: string }[] = [
  { v: "", t: "Todos los tipos" },
  { v: "cargo", t: "Cargos" },
  { v: "pago", t: "Pagos" },
  { v: "gasto", t: "Gastos" },
  { v: "ingreso", t: "Ingresos" },
];

/** «Ver los cargos en Movimientos» from a match's cost: what the caja opens with next time it mounts. */
let nextView: { tab: Tab; kind: CajaKind | ""; who: string } | null = null;

/** The page's printed shirts (the squad's own stills, home and away kits). */
function Stills({ squad, children }: { squad: readonly { name: string; number: number | null }[]; children: ReactNode }) {
  const theme = useDocumentTheme();
  const printed = useMemo(() => squad.filter((p) => p.number != null).map((p) => ({ name: p.name.toLocaleUpperCase("es"), num: String(p.number) })), [squad]);
  const stillOf = usePageKitStills({ on: true, theme, kits: ["home", "away"], players: printed });
  return <KitStillContext.Provider value={stillOf}>{children}</KitStillContext.Provider>;
}

/** Who a uid is, in words: his nickname (the people of the club), else «un capitán». */
function useNickOf() {
  const { people } = useAdmin();
  return useMemo(() => {
    const by = new Map(people.map((p) => [p.uid, p.nickname || p.displayName || ""]));
    return (uid: string) => by.get(uid) || "un capitán";
  }, [people]);
}

// ───────────────────────── /admin/caja ─────────────────────────
export function CajaScreen() {
  const data = useAdmin();
  if (data.error && !data.players.length) return <CajaShell><ScreenError what="la caja" onRetry={() => window.location.reload()} /></CajaShell>;
  if (data.loading) return <CajaShell><ScreenLoading label="Cargando la caja" /></CajaShell>;
  if (!data.season) {
    return (
      <SalaScreen title="Caja" lede="La caja va por temporadas.">
        <p className="sc-p">Aún no hay temporada: crea una en Temporadas y vuelve.</p>
        <p className="sc-btnrow" style={{ marginTop: 14 }}>
          <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to="/admin/club/temporadas">
            Ir a Temporadas
          </SalaLink>
        </p>
      </SalaScreen>
    );
  }
  return <CajaHome key={data.season.id} seasonId={data.season.id} />;
}

/** The caja's frame title while it loads or fails. */
function CajaShell({ children }: { children: ReactNode }) {
  return (
    <SalaScreen title="Caja" lede="Cuotas, campo y árbitro, y el bote · todos los socios lo ven igual en su caja del vestuario.">
      {children}
    </SalaScreen>
  );
}

function CajaHome({ seasonId }: { seasonId: string }) {
  const data = useAdmin();
  const { desktop, width } = useFrame();
  const go = useSalaGo();
  const status = useStatus();
  const nickOf = useNickOf();
  const season = data.seasons.find((s) => s.id === seasonId) ?? data.season!;
  const book = useCajaBook(seasonId, data.now);
  // (read once; cleared after the first render, so a re-render or a second mount in development reads it too)
  const [start] = useState(() => nextView);
  useEffect(() => {
    nextView = null;
  }, []);
  const [tab, setTab] = useState<Tab>(start?.tab ?? "resumen");
  const [kind, setKind] = useState<CajaKind | "">(start?.kind ?? "");
  const [who, setWho] = useState(start?.who ?? WHO_ALL);
  const [all, setAll] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);

  const squad = useMemo(() => squadOf(data.players, seasonId), [data.players, seasonId]);
  const nameOf = useMemo(() => {
    const byId = new Map([...data.players, ...data.archivedPlayers].map((p) => [p.id, p]));
    const sq = new Map(squad.map((p) => [p.id, p.name]));
    return (id: string) => {
      const p = byId.get(id);
      return sq.get(id) ?? (p ? nameFor(p, seasonId) : "Jugador");
    };
  }, [data.players, data.archivedPlayers, squad, seasonId]);
  const numOf = useMemo(() => new Map(squad.map((p) => [p.id, p.number])), [squad]);

  const movs = book.movs;
  const settings = book.settings;
  const bal = useMemo(() => balances(movs), [movs]);
  const rows = useMemo(() => saldoRows(movs, squad, nameOf), [movs, squad, nameOf]);
  const jar = jarBalance(movs);
  const owed = owedLines(rows, owedTotal(movs), squad.length);
  const sorted = useMemo(() => sortMovs(movs), [movs]);
  const shown = useMemo(() => filterBook(sorted, kind, who), [sorted, kind, who]);
  const page = bookPage(width >= 1800);
  const visible = all ? shown : shown.slice(0, page);
  const pending = book.claims.filter((c) => c.status === "pendiente");
  const resolved = resolvedLines(book.claims, nameOf, nickOf, data.now);
  const target = costTarget(data.matches, seasonId, data.now, movs);
  const cobrar = () => setSheet({ k: "cuota" });
  const costeGo = () => (target ? go(`/admin/caja/coste/${target.id}`) : status.show({ tag: "Coste del partido", message: "Aún no se ha jugado ningún partido esta temporada." }));
  const openMov = (k: FreeKind, preset?: MovPreset) => setSheet({ k: "mov", kind: k, preset });

  const cmds = useMemo<PaletteCommand[]>(
    () => [
      { id: "caja:cuota", group: "Acciones", icon: "€", title: "Cobrar la cuota", description: `Caja · ${season.name}`, hint: "acción", keywords: "cuota cobrar caja", run: () => setSheet({ k: "cuota" }) },
      { id: "caja:pago", group: "Acciones", icon: "+", title: "Apuntar un pago", description: "Caja", hint: "acción", keywords: "pago bizum caja", run: () => setSheet({ k: "mov", kind: "pago" }) },
      ...(target ? [{ id: "caja:coste", group: "Acciones" as const, icon: target.jornada ? `J${target.jornada}` : "€", title: `Coste del partido${target.jornada ? ` J${target.jornada}` : ""}`, description: "Campo y árbitro · Caja", hint: "ir", keywords: "coste campo arbitro", run: () => go(`/admin/caja/coste/${target.id}`) }] : []),
    ],
    [season.name, target, go],
  );
  useRegisterCommands(cmds);

  if (book.error) return <CajaShell><ScreenError what="la caja" onRetry={() => window.location.reload()} /></CajaShell>;

  const hasMovs = movs.length > 0;
  const headSub = `${season.name} · ${hasMovs ? `en el bote ${euros(jar)}` : "sin movimientos"}`;
  const panel = (t: Tab) => (desktop ? {} : { role: "tabpanel" as const, id: `cj-p-${t}`, "aria-labelledby": `cj-tab-${t}` });
  const isTab = (t: Tab) => (tab === t ? " is-tab" : "");
  const tabI = TABS.findIndex((t) => t.id === tab);
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = (tabI + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[n].id);
    document.getElementById(`cj-tab-${TABS[n].id}`)?.focus();
  };

  const anularMov = sheet?.k === "anular" ? movs.find((m) => m.id === sheet.id) ?? null : null;
  const rechazarClaim = sheet?.k === "rechazar" ? book.claims.find((c) => c.id === sheet.id) ?? null : null;
  const whoOf = (m: CajaMov) => (m.playerId ? nameOf(m.playerId) : "El bote");

  return (
    <Stills squad={squad}>
      <SalaScreen
        className="cj"
        fit
        title="Caja"
        kicker={season.name}
        lede="Cuotas, campo y árbitro, y el bote · todos los socios lo ven igual en su caja del vestuario."
        headSub={headSub}
        primary={{ label: "Cobrar cuota", onClick: cobrar, popup: true }}
      >
        {book.loading ? (
          <ScreenLoading label="Cargando la caja" />
        ) : (
          <>
            {season.archived && <p className="cj-arch sc-small">«{season.name}» está archivada: su caja se puede leer y anotar, pero la web no la enseña.</p>}
            {!desktop && (
              <div className="vd-seg vd-glass cj-tabs" role="tablist" aria-label="Partes de la caja" style={{ "--n": TABS.length, "--i": tabI } as CSSProperties} onKeyDown={onTabKey}>
                <span className="vd-shelf__bead" aria-hidden="true" />
                {TABS.map((t) => (
                  <button key={t.id} type="button" className="vd-seg__b" role="tab" id={`cj-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`cj-p-${t.id}`} tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)}>
                    {t.label}
                    {t.id === "avisos" && pending.length ? ` ${pending.length}` : ""}
                  </button>
                ))}
              </div>
            )}
            <div className="cj-grid">
              {/* el bote */}
              <section className={`cj-reg cj-part cj-bote${isTab("resumen")}`} aria-labelledby="cj-bote-t" {...panel("resumen")}>
                <p className="sc-k" id="cj-bote-t">
                  El bote · {season.name}
                </p>
                <p className="cj-bote__n sc-num" aria-label={`En el bote: ${euros(jar)}`}>
                  {euros(jar)}
                </p>
                <ul className="sc-rows cj-facts">
                  <li className="sc-row">
                    <span className="sc-row__t">
                      <b>{owed.owed}</b>
                      {owed.who && <span>{owed.who}</span>}
                    </span>
                  </li>
                  <li className="sc-row">
                    <span className="sc-row__t">
                      <b>{cuotaLine(settings)}</b>
                      <span>{howLine(settings)}</span>
                    </span>
                    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" onClick={() => setSheet({ k: "ajustes" })}>
                      Ajustes
                    </button>
                  </li>
                </ul>
                <div className="cj-acts" role="group" aria-label="Apuntar en la caja">
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri cj-acts__main" aria-haspopup="dialog" onClick={cobrar}>
                    <VIcon name="euro" size={20} />
                    Cobrar cuota
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press" onClick={costeGo}>
                    <VIcon name="ball" size={20} />
                    <span className="cj-acts__l">
                      Coste del partido{" "}
                      <small>{target ? `${target.jornada ? `J${target.jornada} · ` : ""}${target.rival || "Rival"}` : "Sin partidos jugados"}</small>
                    </span>
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press" aria-haspopup="dialog" onClick={() => openMov("pago")}>
                    <VIcon name="plus" size={20} />
                    Apuntar pago
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press" aria-haspopup="dialog" onClick={() => openMov("gasto")}>
                    <CajaGlyph name="minus" />
                    Apuntar gasto
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press" aria-haspopup="dialog" onClick={() => openMov("ingreso")}>
                    <VIcon name="plus" size={20} />
                    Apuntar ingreso
                  </button>
                </div>
                <p className="cj-note sc-small">Se apunta al momento, con «Deshacer» 5 s; anular pide confirmación y deja el movimiento tachado.</p>
              </section>

              {/* saldos */}
              <section className={`cj-reg cj-part cj-saldos${isTab("saldos")}`} aria-labelledby="cj-saldos-t" {...panel("saldos")}>
                <header className="sc-sec__h cj-reg__h">
                  <h2 className="sc-h2" id="cj-saldos-t">
                    Saldos
                  </h2>
                  <span className="sc-sec__n">{plural(squad.length, "jugador", "jugadores")}</span>
                </header>
                {!rows.length && <p className="sc-p cj-empty">Esta temporada no tiene plantilla todavía.</p>}
                <ul className="sc-rows cj-bal" aria-label="Saldos">
                  {rows.map((r) => {
                    const b = bal.get(r.id) ?? 0;
                    const inSquad = numOf.has(r.id);
                    return (
                      <li key={r.id} className={`sc-row cj-bal__r is-${r.state === "debe" ? "debe" : r.state === "a-favor" ? "favor" : "ok"}`}>
                        <RowShirt num={r.number != null ? String(r.number) : undefined} />
                        <span className="sc-row__t">
                          <b>{r.name}</b>
                          {!inSquad && <span className="cj-bal__out">Ya no está en la plantilla</span>}
                        </span>
                        <span className="cj-bal__v">
                          {r.state === "debe" ? <CajaGlyph name="warn" size={17} /> : <VIcon name={r.state === "a-favor" ? "plus" : "check"} size={17} />}
                          {saldoText(b)}
                        </span>
                        <button type="button" className="vd-ibtn vd-glass vd-press cj-bal__pay" aria-haspopup="dialog" aria-label={`Apuntar un pago de ${r.name}`} onClick={() => openMov("pago", { who: r.id, amount: b < 0 ? centsInput(-b) : "" })}>
                          <VIcon name="plus" size={20} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <div className="cj-reg cj-col3">
                {/* pagos avisados */}
                <section className={`cj-part cj-avisos${isTab("avisos")}`} aria-labelledby="cj-avisos-t" {...panel("avisos")}>
                  <header className="sc-sec__h cj-reg__h">
                    <h2 className="sc-h2" id="cj-avisos-t">
                      Pagos avisados por confirmar
                    </h2>
                    <span className="sc-sec__n">{pending.length}</span>
                  </header>
                  {pending.length ? (
                    <>
                      <ul className="sc-rows" aria-label="Pagos avisados por confirmar">
                        {pending.map((c) => {
                          const n = nameOf(c.playerId);
                          const aria = `${n}, ${c.concept || "Pago avisado"}, ${euros(c.amount)}`;
                          return (
                            <li key={c.id} className="sc-row cj-claim">
                              <RowShirt num={numOf.get(c.playerId) != null ? String(numOf.get(c.playerId)) : undefined} />
                              <span className="sc-row__t">
                                <b>
                                  {n} · {euros(c.amount)}
                                </b>
                                <span>{c.concept || "Pago avisado"} · dice que lo ha pagado</span>
                                <span>{c.at ? relativeTime(c.at, data.now) : "ahora"}</span>
                              </span>
                              <span className="cj-claim__a">
                                <button
                                  type="button"
                                  className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri"
                                  aria-label={`Confirmar: ${aria}`}
                                  onClick={() => book.confirmClaim({ tag: "Caja", message: `Pago de ${n} confirmado · ${euros(c.amount)} en su saldo`, errorMessage: `No se ha podido confirmar el pago de ${n}` }, c)}
                                >
                                  Confirmar
                                </button>
                                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" aria-label={`Rechazar: ${aria}`} onClick={() => setSheet({ k: "rechazar", id: c.id })}>
                                  Rechazar
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="sc-small cj-hint">Confirmar lo apunta como pago en su saldo (con «Deshacer»); rechazar no apunta nada y lo verá en su caja.</p>
                    </>
                  ) : (
                    <p className="sc-p cj-clear">Nadie ha avisado de un pago. Cuando alguien toque «Ya la he pagado» en su caja, sale aquí.</p>
                  )}
                  {resolved.length > 0 && (
                    <>
                      <h3 className="sc-h3 cj-sub">Resueltos</h3>
                      <ul className="sc-rows" aria-label="Pagos avisados resueltos">
                        {resolved.map((x) => (
                          <li key={x.id} className="sc-row">
                            <span className="sc-row__t">
                              <b>{x.title}</b>
                              <span>{x.detail}</span>
                            </span>
                            <span className={`sc-tag ${x.word === "Confirmado" ? "sc-tag--hecho" : "sc-tag--quiet"}`}>{x.word}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>

                {/* movimientos */}
                <section className={`cj-part cj-libro${isTab("movs")}`} aria-labelledby="cj-movs-t" {...panel("movs")}>
                  <header className="sc-sec__h cj-reg__h">
                    <h2 className="sc-h2" id="cj-movs-t">
                      Movimientos
                    </h2>
                    <span className="sc-sec__n" aria-live="polite">
                      {shown.length === movs.length ? movs.length : `${shown.length} de ${movs.length}`}
                    </span>
                  </header>
                  <div className="cj-filters">
                    <label className="sc-field">
                      <span>Tipo</span>
                      <select className="vd-input" value={kind} onChange={(e) => setKind(e.target.value as CajaKind | "")}>
                        {KINDS.map((k) => (
                          <option key={k.v} value={k.v}>
                            {k.t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="sc-field">
                      <span>Jugador</span>
                      <select className="vd-input" value={who} onChange={(e) => setWho(e.target.value)}>
                        <option value={WHO_ALL}>Todos los jugadores</option>
                        <option value={WHO_BOTE}>El bote (sin jugador)</option>
                        {rows.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.number != null ? `${r.number} · ` : ""}
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {!movs.length && <p className="sc-p cj-empty">Aún no hay movimientos: empieza por la cuota o el coste de un partido.</p>}
                  {movs.length > 0 && !shown.length && (
                    <p className="sc-p cj-empty">
                      Ningún movimiento con estos filtros.{" "}
                      <button type="button" className="vd-link" onClick={() => (setKind(""), setWho(WHO_ALL))}>
                        Quitar los filtros
                      </button>
                    </p>
                  )}
                  {visible.length > 0 && (
                    <ul className="sc-rows cj-movs" aria-label="Movimientos">
                      {visible.map((m) => {
                        const w = whoOf(m);
                        return (
                          <li key={m.id} className={`sc-row cj-mov is-${m.kind}${m.void ? " is-void" : ""}`}>
                            <span className="cj-mov__d">{dayWeek(m.date)}</span>
                            <span className="sc-row__t">
                              <b>{m.concept}</b>
                              <span>
                                {KIND_WORD[m.kind]} · {w}
                              </span>
                            </span>
                            <span className="cj-mov__a" aria-label={`${m.void ? "Anulado: " : ""}${signedAmount(m)}`}>
                              {signedAmount(m)}
                            </span>
                            {m.void ? (
                              <span className="sc-tag sc-tag--quiet cj-mov__x">Anulado{m.voidedBy ? ` por ${nickOf(m.voidedBy)}` : ""}</span>
                            ) : (
                              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm cj-mov__x" aria-haspopup="dialog" aria-label={`Anular ${m.concept}, ${KIND_WORD[m.kind].toLowerCase()} de ${w}, ${euros(m.amount)}`} onClick={() => setSheet({ k: "anular", id: m.id })}>
                                Anular
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {shown.length > visible.length && (
                    <p className="sc-small cj-hint">
                      Se ven los {visible.length} más recientes de {shown.length}.{" "}
                      <button type="button" className="vd-link" onClick={() => setAll(true)}>
                        Ver todos
                      </button>
                    </p>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </SalaScreen>

      {sheet?.k === "cuota" && (
        <CuotaSheet
          seasonName={season.name}
          settings={settings}
          squad={squad}
          movs={movs}
          now={data.now}
          onClose={close}
          onGo={(list, concept, cents) => {
            close();
            book.addMovs({ tag: "Cuota", message: `${concept} cobrada · ${plural(list.length, "cargo", "cargos")} de ${euros(cents)}`, errorMessage: "No se ha podido cobrar la cuota" }, list);
          }}
        />
      )}
      {sheet?.k === "mov" && (
        <MovSheet
          kind={sheet.kind}
          squad={squad}
          balanceOf={(id) => bal.get(id) ?? 0}
          preset={sheet.preset}
          now={data.now}
          onClose={close}
          onGo={(mov, name) => {
            close();
            const amt = euros(mov.amount);
            const k = mov.kind;
            book.addMovs(
              { tag: KIND_WORD[k], message: k === "pago" ? `Pago de ${name} · ${amt}` : k === "gasto" ? `Gasto apuntado · ${amt} fuera del bote` : `Ingreso apuntado · ${amt} al bote`, errorMessage: `No se ha podido apuntar el ${k}` },
              [mov],
            );
          }}
        />
      )}
      {sheet?.k === "ajustes" && (
        <AjustesSheet
          seasonName={season.name}
          settings={settings}
          onClose={close}
          onGo={(s) => {
            close();
            book.saveSettings({ tag: "Caja", message: `Ajustes guardados · ${s.cuota ? `${euros(s.cuota)} ${s.cuotaPeriod === "mensual" ? "al mes" : "por temporada"}` : "sin cuota"}`, errorMessage: "No se han podido guardar los ajustes" }, s);
          }}
        />
      )}
      {sheet?.k === "anular" && (
        <AnularSheet
          mov={anularMov}
          who={anularMov ? whoOf(anularMov) : ""}
          onClose={close}
          onGo={() => {
            if (!anularMov) return;
            close();
            book.voidMov(anularMov, { tag: "Anulado", message: `«${anularMov.concept}» tachado en el libro · deja de contar`, errorMessage: `No se ha podido anular «${anularMov.concept}»` });
          }}
        />
      )}
      {sheet?.k === "rechazar" && (
        <RechazarSheet
          claim={rechazarClaim}
          who={rechazarClaim ? nameOf(rechazarClaim.playerId) : ""}
          now={data.now}
          onClose={close}
          onGo={(reason) => {
            if (!rechazarClaim) return;
            close();
            const n = nameOf(rechazarClaim.playerId);
            book.rejectClaim({ tag: "Caja", message: `Aviso de ${n} rechazado · no se apunta nada; lo verá en su caja`, errorMessage: `No se ha podido rechazar el aviso de ${n}` }, rechazarClaim, reason);
          }}
        />
      )}
    </Stills>
  );
}

// ───────────────────────── /admin/caja/coste/<id> ─────────────────────────
/** /admin/caja/coste/<id>: el coste del partido, a partes iguales entre los que jugaron. */
export function CosteScreen() {
  const data = useAdmin();
  const { matchId = "" } = useParams({ strict: false }) as { matchId?: string };
  const back = { to: "/admin/caja", label: "Volver a la caja" };
  if (data.error && !data.matches.length) {
    return (
      <SalaScreen title="Coste del partido" back={back}>
        <ScreenError what="el partido" onRetry={() => window.location.reload()} />
      </SalaScreen>
    );
  }
  if (data.loading) {
    return (
      <SalaScreen title="Coste del partido" back={back}>
        <ScreenLoading label="Cargando el partido" />
      </SalaScreen>
    );
  }
  const match = data.matches.find((m) => m.id === matchId) ?? null;
  if (!match || !match.seasonId) {
    return (
      <SalaScreen title="Coste del partido" back={back} kicker={<SalaLink className="vd-link cj-back" to="/admin/caja">‹ La caja</SalaLink>}>
        <p className="sc-p">{match ? "Este partido no tiene temporada: su coste no va a ninguna caja." : "No hay ningún partido con esa dirección. Puede que se haya archivado o borrado."}</p>
      </SalaScreen>
    );
  }
  return <Coste key={match.id} match={match} />;
}

function Coste({ match }: { match: AdminMatch }) {
  const data = useAdmin();
  const go = useSalaGo();
  const seasonId = match.seasonId!;
  const book = useCajaBook(seasonId, data.now);
  const movs = book.movs;
  const squad = useMemo(() => squadOf(data.players, seasonId), [data.players, seasonId]);
  const numOf = useMemo(() => {
    const byId = new Map([...data.players, ...data.archivedPlayers].map((p) => [p.id, p]));
    return (id: string): number => {
      const p = byId.get(id);
      return (p && numberIn(p, seasonId)) ?? 999;
    };
  }, [data.players, data.archivedPlayers, seasonId]);
  const nameOf = useMemo(() => {
    const byId = new Map([...data.players, ...data.archivedPlayers].map((p) => [p.id, p]));
    return (id: string) => {
      const p = byId.get(id);
      return p ? nameFor(p, seasonId) : "Jugador";
    };
  }, [data.players, data.archivedPlayers, seasonId]);

  const charged = chargedOf(movs, match.id);
  const done = charged.n > 0;
  const [total, setTotal] = useState<string | null>(null);
  const suggested = lastCostTotal(movs);
  const typed = total ?? (suggested ? centsInput(suggested) : "");
  const cents = typed.trim() ? parseEuros(typed) : null;
  const who = matchCostPlayers(match, numOf);
  const cargos = splitCost(cents ?? 0, who.ids);
  const concept = matchCostConcept(match.jornada, match.rival);
  const ok = !done && cents !== null && cents > 0 && cents <= CAJA_LIMITS.amount && cargos.length > 0;
  const base = cargos.length ? Math.min(...cargos.map((c) => c.amount)) : 0;
  const guests = useMemo(() => {
    const ids = [...(match.starters ?? []), ...(match.bench ?? []), ...Object.keys(match.ledger ?? {})].filter(isGuestId);
    return [...new Set(ids)].map((id) => guestOf(match, id)?.name).filter((n): n is string => !!n);
  }, [match]);
  const fromActa = who.source === "acta";
  const t = dateMillis(match.date);
  const review = data.reviewOf(match);
  const played = match.status === "finished";
  const meta = [Number.isFinite(t) ? `${shortDate(t)} · ${clockTime(t)}` : "sin fecha", match.home === false ? "fuera" : "en casa", ...(played ? [scoreText(review.goalsFor, review.goalsAgainst)] : [])].join(" · ");
  const title = `${match.jornada ? `J${match.jornada}` : "Partido"} · ${match.rival || "Rival"}`;
  const picks = costMatches(data.matches, seasonId, data.now, match);
  const pickLabel = (m: AdminMatch) => {
    const tt = dateMillis(m.date);
    return `${m.jornada ? `J${m.jornada} · ` : ""}${rivalCode(m.rival || "Rival", m.rivalShort)} · ${Number.isFinite(tt) ? shortDate(tt) : "sin fecha"}${chargedOf(movs, m.id).n ? " · cargado" : ""}`;
  };
  const submit = () => {
    if (!ok || cents === null) return;
    const date = Number.isFinite(t) ? madridDate(t) : madridDate(data.now);
    book.addMovs({ tag: match.jornada ? `Coste J${match.jornada}` : "Coste", message: `${euros(cents)} cargados a ${plural(cargos.length, "jugador", "jugadores")} · «${concept}»`, errorMessage: `No se ha podido cargar el coste de${match.jornada ? ` la J${match.jornada}` : "l partido"}` }, cargos.map((c) => ({ kind: "cargo", playerId: c.playerId, amount: c.amount, concept, date, matchId: match.id })), () => setTotal(null));
  };
  const why = done ? undefined : !cargos.length && cents ? "Nadie a quien cargarlo todavía." : cents === null ? "Escribe el total de campo y árbitro." : undefined;
  const toMovs = () => {
    nextView = { tab: "movs", kind: "cargo", who: WHO_ALL };
    go("/admin/caja");
  };
  const morph = `cj-m-${match.id.replace(/[^A-Za-z0-9_-]/g, "")}`;

  return (
    <Stills squad={squad}>
      <SalaScreen
        className="cj"
        fit
        title="Coste del partido"
        headSub={title}
        kicker={
          <SalaLink className="vd-link cj-back" to="/admin/caja">
            ‹ La caja
          </SalaLink>
        }
        lede="Campo y árbitro, a partes iguales entre los que jugaron. Los céntimos que sobran, a los primeros por dorsal."
        back={{ to: "/admin/caja", label: "Volver a la caja" }}
        actions={
          <label className="sc-field cj-coste__pick">
            <span>Partido</span>
            <select className="vd-input" value={match.id} onChange={(e) => go(`/admin/caja/coste/${e.target.value}`, { replace: true })}>
              {picks.map((m) => (
                <option key={m.id} value={m.id}>
                  {pickLabel(m)}
                </option>
              ))}
            </select>
          </label>
        }
        primary={done ? null : { label: `Cargar a ${plural(cargos.length || who.ids.length, "jugador", "jugadores")}`, onClick: submit, disabled: !ok, why }}
      >
        {book.loading ? (
          <ScreenLoading label="Cargando la caja" />
        ) : book.error ? (
          <ScreenError what="la caja" onRetry={() => window.location.reload()} />
        ) : (
          <div className="cj-coste">
            <section className="cj-coste__m" aria-labelledby="cj-coste-t">
              <h2 className="sc-h2" id="cj-coste-t">
                <span className="sc-morph" style={{ viewTransitionName: morph }}>
                  {title}
                </span>
              </h2>
              <p className="sc-small">{meta}</p>
              {done ? (
                <>
                  <p className="cj-done" role="status">
                    <span className="sc-tag sc-tag--hecho">Cargado</span>
                    <span>
                      Ya está cargado: {plural(charged.n, "cargo", "cargos")} · {euros(charged.total)}
                      {charged.date ? ` el ${dayWeek(charged.date)}` : ""}. Para repetirlo, anula antes esos cargos en Movimientos.
                    </span>
                  </p>
                  <p>
                    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={toMovs}>
                      Ver los cargos en Movimientos
                    </button>
                  </p>
                </>
              ) : (
                <label className="sc-field cj-total">
                  <span id="cj-total-l">Campo y árbitro (total)</span>
                  <input className="vd-input" aria-labelledby="cj-total-l" type="text" inputMode="decimal" autoComplete="off" placeholder="80" value={typed} onChange={(e) => setTotal(e.target.value)} aria-describedby="cj-total-h" aria-invalid={(!!typed.trim() && cents === null) || undefined} />
                  <small id="cj-total-h" className={typed.trim() && cents === null ? "is-bad" : ""}>
                    {typed.trim() && cents === null ? "Escribe el total en euros, como «80» o «72,50»." : cents ? splitLine(cents, cargos.map((c) => c.amount)) : suggested ? `El último partido costó ${euros(suggested)}.` : "En euros, como «80» o «72,50»."}
                  </small>
                </label>
              )}
              <p className="sc-p">{fromActa ? `Del acta: los ${who.ids.length} que jugaron (titulares y los cambios que entraron).` : who.ids.length ? `Aún sin acta: sale de la convocatoria (${who.ids.length}).` : "Ni acta ni convocatoria: no hay nadie a quien cargarlo todavía."}</p>
              <p className="sc-small">{guests.length ? `Los invitados no pagan: ${guests.join(", ")}.` : "Los invitados no pagan (esta vez no hubo)."}</p>
              <p className="sc-small">Concepto: «{concept}»</p>
            </section>
            <section className="cj-coste__r" aria-labelledby="cj-rep-t">
              <header className="sc-sec__h">
                <h2 className="sc-h3" id="cj-rep-t">
                  El reparto
                </h2>
                <span className="sc-sec__n">{who.ids.length}</span>
              </header>
              <ul className="sc-rows" aria-label="El reparto">
                {who.ids.map((pid, i) => {
                  const part = cargos[i];
                  const n = numOf(pid);
                  return (
                    <li key={pid} className="sc-row cj-rep">
                      <RowShirt kit={match.kit === "away" ? "away" : "home"} num={n !== 999 ? String(n) : undefined} />
                      <span className="sc-row__t">
                        <b>{nameOf(pid)}</b>
                        {part && part.amount > base && <span>+1 céntimo</span>}
                      </span>
                      <span className="cj-rep__v">{part ? euros(part.amount) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </SalaScreen>
    </Stills>
  );
}

