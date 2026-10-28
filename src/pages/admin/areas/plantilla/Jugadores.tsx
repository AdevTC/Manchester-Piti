// PLANTILLA · Jugadores (/admin/plantilla) and la ficha (/admin/plantilla/<id>), as the board's part-plantilla.html:
// the season in rows by line («Sin posición» first, POR · DEF · MED · DEL one tap away), each with his printed
// shirt, dorsal, names, line, state, what he lacks and his account; «Qué falta» (chips with their count, only what
// something matches), the search (name or dorsal, «/»; searching also shows the other seasons), «Filas · Cromos»,
// the birthdays, «Exportar CSV» and the way to Antiguos. On the desktop the ficha sits beside the list (the first one
// that still lacks something when none is open) and, ≥ 1800, «El equipo de un vistazo»; on the phone the list is the
// screen and a player opens his ficha full screen with «‹». ← → and ↑ ↓ walk the list (B-CLUB-10).
// `PlantillaArea` is the route of /admin/plantilla: it keeps the area's store (the pending writes, the search) for
// all its screens and draws the list + ficha, the cromos and the alta itself (Socios, Capitanes and Antiguos come
// through the router's outlet).
import { useEffect, useRef, useState } from "react";
import { Outlet, useRouterState, useSearch } from "@tanstack/react-router";
import { plural } from "../../../../lib/derived/words";
import { proposalState } from "../../../../lib/positionsEdit";
import { boardGroups, listOrder, nextIncomplete, stepIn, type BoardRow } from "../../club/plantillaBoard";
import { linePickPayload, type Position } from "../../club/plantillaLogic";
import { useSalaGo } from "../../shell/salaHref";
import { SalaLink } from "../../shell/SalaLink";
import { SalaScreen, ScreenError, ScreenLoading } from "../../shell/Screen";
import { screenOf } from "../../shell/places";
import { isTypingTarget } from "../../shell/shortcuts";
import { useFrame } from "../../ui/frame";
import { vtName } from "../../ui/viewTransition";
import { AltaScreen } from "./Alta";
import { CromosScreen } from "./Cromos";
import { Ficha } from "./Ficha";
import { ListTools } from "./ListTools";
import { useCsv, useListView } from "./listView";
import { accountWords, birthdays, birthdayWords, gapWords, LINE_ONE, LINE_TO, lineWords } from "./model";
import { Icon, PlNav, Shirt } from "./parts";
import { PlantillaProvider } from "./store";
import { usePlantilla } from "./storeContext";
import "./plantilla.css";

export function PlantillaArea() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const screen = screenOf(pathname).screen;
  return (
    <PlantillaProvider>
      {screen === "jugadores" || screen === "ficha" ? <JugadoresScreen /> : screen === "alta" ? <AltaScreen /> : screen === "cromos" ? <CromosScreen /> : <Outlet />}
    </PlantillaProvider>
  );
}

export function JugadoresScreen() {
  const view = useListView();
  const { data, squad, season, groups, others, chips, count, empty, write, writes, still } = view;
  const { desktop } = useFrame();
  const go = useSalaGo();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fromCromos = useSearch({ strict: false, select: (s) => (s as { vista?: unknown }).vista === "cromos" });
  const info = screenOf(pathname);
  const openId = info.screen === "ficha" ? (info.playerId ?? null) : null;
  const csv = useCsv();

  // the order ← → walk (what is shown, the other seasons at the end) and «Siguiente sin completar» (the whole season)
  const order = [...listOrder(groups), ...others.map((r) => r.id)];
  const fullOrder = listOrder(boardGroups(squad));
  // desktop with no ficha open: the first one that still lacks something, kept while you complete it
  const [pin, setPin] = useState<string | null>(null);
  const fallback = nextIncomplete(fullOrder, squad, null) ?? fullOrder[0] ?? null;
  if (!openId && desktop && fallback && pin !== fallback && (!pin || !squad.some((r) => r.id === pin))) setPin(fallback);
  const curId = openId ?? (desktop ? pin : null);
  const cur = curId ? (view.rows.find((r) => r.id === curId) ?? null) : null;
  const inOrder = cur ? (order.includes(cur.id) ? order : cur.inSeason ? fullOrder : [...order, cur.id]) : order;
  const byId = (id: string | null) => (id ? (view.rows.find((r) => r.id === id) ?? null) : null);
  const prev = cur && inOrder.length > 1 ? byId(stepIn(inOrder, cur.id, -1)) : null;
  const next = cur && inOrder.length > 1 ? byId(stepIn(inOrder, cur.id, 1)) : null;
  const nextGap = byId(nextIncomplete(fullOrder, squad, cur?.id ?? null));
  const allDone = !squad.some((r) => r.gaps.length);
  const open = (id: string) => go(`/admin/plantilla/${encodeURIComponent(id)}${fromCromos && !desktop ? "?vista=cromos" : ""}`);

  // ← → ↑ ↓ (never while typing, with a modifier, or in a menu or a group of radios)
  const keys = useRef({ prev, next, open, on: desktop || !!openId });
  useEffect(() => {
    keys.current = { prev, next, open, on: desktop || !!openId };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (!k.on || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.closest('[role="dialog"],[role="menu"],[role="listbox"],[role="radiogroup"],[role="alertdialog"]')) return;
      const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const to = d > 0 ? k.next : k.prev;
      if (!to) return;
      e.preventDefault();
      k.open(to.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // the open row stays in view in the list
  const listRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!curId) return;
    listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(curId)}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [curId]);

  const setLine = (r: BoardRow, p: Position) => {
    const w = linePickPayload(r.doc, p);
    write({ id: r.id, doc: { ...r.doc, ...w }, tag: "Línea", message: `${r.name} pasa ${LINE_TO[p]}`, error: `No se ha podido cambiar la línea de ${r.name}`, commit: () => writes.savePlayer(r.id, w) });
  };
  const bdays = birthdays(squad, data.now);
  const outs = view.rows.filter((r) => !r.inSeason).length;

  if (data.loading) return <ScreenLoading label="Cargando la plantilla" />;
  if (data.error && !squad.length) return <ScreenError what="la plantilla" onRetry={() => window.location.reload()} />;

  const ficha = openId !== null;
  const back = { to: fromCromos ? "/admin/plantilla/cromos" : "/admin/plantilla", label: fromCromos ? "Volver a los cromos" : "Volver a la plantilla" };
  const idx = cur ? inOrder.indexOf(cur.id) + 1 : 0;
  const kicker = cur ? (cur.inSeason ? `Ficha ${idx} de ${inOrder.length} · ${cur.position ? LINE_ONE[cur.position] : "sin posición"}` : cur.doc.archived ? "De una temporada archivada" : season ? `Fuera de la ${season.name}` : "Sin temporada") : "";
  const row = (r: BoardRow, out: boolean) => {
    const sel = r.id === curId;
    const state = [r.injured ? "Lesionado" : "", r.sanctioned ? "Sancionado" : "", !out && r.number != null && view.dup.has(r.number) ? "Dorsal repetido" : "", proposalState(r.doc) === "pendiente" ? "Propone sus posiciones" : ""].filter(Boolean);
    const sanc = view.suspended.get(r.id);
    if (sanc && r.sanctioned) state[state.indexOf("Sancionado")] = `Sancionado · ${sanc.left === 1 ? "queda 1" : `quedan ${sanc.left}`}`;
    const line = out ? (r.doc.archived ? "De una temporada archivada" : season ? `Fuera de la ${season.name}` : "Sin temporada") : lineWords(r);
    return (
      <li key={r.id} className={`spl-row${out ? " is-out" : ""}`} data-id={r.id}>
        <SalaLink
          className="spl-row__main"
          to={`/admin/plantilla/${encodeURIComponent(r.id)}`}
          aria-current={sel ? "true" : undefined}
          aria-label={`${r.name}, ${r.number != null ? `dorsal ${r.number}, ` : ""}${state.length ? `${state.join(", ")}, ` : ""}${gapWords(r.gaps)}`}
        >
          <Shirt src={still(r) ?? view.blank} size="s" vt={sel && (desktop || ficha) ? undefined : vtName("spl-shirt", r.id)} />
          <span className="spl-row__num sc-num" aria-hidden="true">
            {r.number ?? "—"}
          </span>
          <span className="spl-row__t" aria-hidden="true">
            <b>{r.name}</b>
            <span className="spl-row__full">{r.full === "Sin nombre" ? "Nombre y apellidos sin poner" : r.full}</span>
            <span className="spl-row__meta">
              <span>{line}</span>
              {state.length > 0 && <span className="spl-row__state">{state.join(" · ")}</span>}
              <span className={`spl-row__gap ${r.gaps.length ? "is-gap" : "is-full"}`}>{gapWords(r.gaps)}</span>
            </span>
          </span>
          {!out && (
            <span className={`spl-row__acct is-${r.account}`} aria-hidden="true">
              {accountWords(r)}
            </span>
          )}
        </SalaLink>
        {!out && !r.position && (
          <div className="spl-place" role="group" aria-label={`Colocar a ${r.name}`}>
            {(["POR", "DEF", "MED", "DEL"] as const).map((p) => (
              <button key={p} type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Colocar a ${r.name} en ${LINE_ONE[p].toLocaleLowerCase("es")}`} onClick={() => setLine(r, p)}>
                {p}
              </button>
            ))}
          </div>
        )}
      </li>
    );
  };

  return (
    <SalaScreen
      title="Plantilla"
      lede={<span aria-live="polite">{count}</span>}
      headTitle={ficha && cur ? cur.name : "Plantilla"}
      headSub={ficha ? kicker : count}
      back={ficha ? back : undefined}
      actions={!ficha || desktop ? <PlNav at="jugadores" /> : undefined}
      primary={!ficha || desktop ? { label: "Alta de jugador", icon: "plus", onClick: () => go("/admin/plantilla/alta") } : null}
      fit
      className={`sc-pl ${ficha ? "pl--ficha pl--sub" : "pl--jug"}`}
    >
      <div className="spl-jug">
        <section className="spl-listcol sc-scroll" aria-label="La plantilla" ref={listRef}>
          <ListTools view="rows" chips={chips} />
          {bdays.length > 0 && (
            <p className="spl-bdays">
              <Icon name="cake" />
              <span>Cumpleaños:</span>
              {bdays.map((b) => (
                <SalaLink key={b.id} className="vd-link spl-bdays__b" to={`/admin/plantilla/${encodeURIComponent(b.id)}`}>
                  <b>{b.name}</b> {birthdayWords(b)}
                </SalaLink>
              ))}
            </p>
          )}
          <nav className="spl-list" aria-label="Jugadores por línea">
            {empty && <p className="spl-empty">{empty}</p>}
            {groups.map((g) => (
              <section key={g.key} className="spl-group" aria-label={g.title}>
                <h3 className="spl-group__h">
                  <span>{g.title}</span>
                  <span className="sc-sec__n">{g.rows.length}</span>
                  {g.key === "none" && <small>Colócalos con un toque</small>}
                </h3>
                <ul className="sc-rows spl-rows">{g.rows.map((r) => row(r, false))}</ul>
              </section>
            ))}
            {others.length > 0 && (
              <section className="spl-group spl-group--out" aria-label="Otras temporadas">
                <h3 className="spl-group__h">
                  <span>Otras temporadas</span>
                  <small>Ábrele la ficha para volver a darle de alta</small>
                </h3>
                <ul className="sc-rows spl-rows">{others.map((r) => row(r, true))}</ul>
              </section>
            )}
            <div className="spl-listfoot">
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={csv} aria-disabled={!squad.length || undefined} aria-label="Exportar la plantilla (CSV)">
                <Icon name="download" />
                Exportar CSV
              </button>
              <SalaLink className="vd-link" to="/admin/plantilla/antiguos">
                {outs ? `${plural(outs, "antiguo", "antiguos")} · bajas y temporadas archivadas` : "Antiguos · bajas y temporadas archivadas"} ›
              </SalaLink>
            </div>
          </nav>
        </section>
        <section className="spl-fichacol sc-scroll" aria-label="La ficha">
          {cur ? (
            <Ficha key={cur.id} row={cur} index={idx || 1} total={inOrder.length || squad.length} prev={prev} next={next} nextGap={nextGap} allDone={allDone} open={(id) => open(id)} vt />
          ) : (
            <div className="spl-none">
              <p className="sc-p">{openId ? `No hay ninguna ficha «${openId}». Puede que la hayan borrado o que el enlace sea viejo.` : squad.length ? "Elige un jugador de la lista para ver su ficha." : "Todavía no hay nadie en la plantilla."}</p>
              <div className="sc-btnrow">
                {openId && (
                  <SalaLink className="vd-btn vd-glass vd-press" to="/admin/plantilla">
                    Volver a la plantilla
                  </SalaLink>
                )}
                <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to="/admin/plantilla/alta">
                  Alta de jugador
                </SalaLink>
              </div>
            </div>
          )}
        </section>
        <Glance rows={squad} />
      </div>
    </SalaScreen>
  );
}

/** «El equipo de un vistazo» (≥ 1800): how many in each line, who is injured or suspended, accounts, birthdays. */
function Glance({ rows }: { rows: BoardRow[] }) {
  const { data, suspended } = usePlantilla();
  const groups = boardGroups(rows);
  const injured = rows.filter((r) => r.injured).map((r) => r.name);
  const sanc = rows.filter((r) => r.sanctioned).map((r) => `${r.name} · ${(suspended.get(r.id)?.left ?? 1) === 1 ? "queda 1" : `quedan ${suspended.get(r.id)?.left}`}`);
  const linked = rows.filter((r) => r.account === "vinculada").length;
  const without = rows.filter((r) => r.account === "sin" || r.account === "fuera").length;
  const bdays = birthdays(rows, data.now, 42, 6);
  return (
    <aside className="spl-glance sc-scroll" aria-labelledby="spl-g-t">
      <h2 className="sc-h3" id="spl-g-t">
        El equipo de un vistazo
      </h2>
      <dl className="spl-glance__dl">
        {groups.map((g) => (
          <div key={g.key}>
            <dt>{g.title}</dt>
            <dd className="sc-num">{g.rows.length}</dd>
          </div>
        ))}
      </dl>
      <ul className="sc-rows spl-glance__rows">
        <li className="sc-row">
          <span className="sc-row__t">
            <b>Lesionados</b>
            <span>{injured.join(" · ") || "Nadie"}</span>
          </span>
        </li>
        <li className="sc-row">
          <span className="sc-row__t">
            <b>Sancionados</b>
            <span>{sanc.join(" · ") || "Nadie"}</span>
          </span>
        </li>
        <li className="sc-row">
          <span className="sc-row__t">
            <b>Con su socio</b>
            <span>
              {linked} de {rows.length} · {without} sin cuenta
            </span>
          </span>
        </li>
      </ul>
      <h3 className="sc-h3 spl-glance__h">Próximos cumpleaños</h3>
      {bdays.length ? (
        <ul className="sc-rows">
          {bdays.map((b) => (
            <li key={b.id}>
              <SalaLink className="sc-row sc-row--btn" to={`/admin/plantilla/${encodeURIComponent(b.id)}`}>
                <span className="sc-row__t">
                  <b>{b.name}</b>
                  <span>{birthdayWords(b)}</span>
                </span>
                <Icon name="cake" />
              </SalaLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sc-small">Ninguno en las próximas seis semanas.</p>
      )}
    </aside>
  );
}
