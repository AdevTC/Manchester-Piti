// /vestuario/ficha · «Vincula tu ficha», as the canvas prototype draws it (SalaFicha.dc.html): he finds his shirt in
// the whole squad (the free ones are real radio buttons, the taken ones dimmed with their word), sees his choice on the
// side and asks for it (requestPlayerClaim); a captain approves it (a captain's own links at once). The real states
// stay: the one that looks like his nickname («Se parece a tu nombre»), a request in review (and «elegir otra»), the
// last one rejected, no free ficha left; with his ficha already linked, it says so, lights it in the squad and sends
// him to his profile. Styles: styles/vestuario/ficha.css (vfi-).
import { useMemo, useRef, useState } from "react";
import { playerName } from "../../../lib/clubData";
import { apiError, requestPlayerClaim } from "../../../lib/clubApi";
import { Go } from "../../club/cb/ui";
import "../../../styles/vestuario/ficha.css";
import { useMyClaim, usePlayerLinks } from "../live";
import type { VxCtx } from "./ctx";
import type { VIcon } from "./icons";
import { Ic, PShirt, RoomHead, Tile } from "./kit";
import { fichaChoices, fichaHead, fichaLabel, fichaTiles, matchShirt, type FichaPhase, type TileState } from "./fichaModel";

const BTN = "vd-glass vd-press nx-btn";
const MEANWHILE: [VIcon, string][] = [
  ["check", "¿Vas? al partido del domingo"],
  ["poll", "Encuestas, entrenos y turnos"],
  ["euro", "La caja y «Ya la he pagado»"],
  ["board", "El tablón del vestuario"],
];
const OWNED: [VIcon, string][] = [
  ["shirt", "Tu cartel en 3D lleva tu nombre y tu dorsal"],
  ["chart", "Tus partidos, goles y notas se cuentan solos"],
  ["euro", "Tu saldo de la caja va a tu nombre"],
];
const WORD: Record<TileState, string> = { mine: "Tu ficha", free: "Libre", taken: "Ocupada" };

interface Step {
  t: string;
  w: string;
  cls: "" | "is-now" | "is-done";
  icon: VIcon;
}
function Steps({ steps, row, label }: { steps: Step[]; row?: boolean; label?: string }) {
  return (
    <ol className={`vfi-steps${row ? " vfi-steps--row" : ""}`} aria-label={label}>
      {steps.map((s) => (
        <li key={s.t} className={s.cls || undefined}>
          <span className="vfi-dot" aria-hidden="true">
            <Ic name={s.icon} />
          </span>
          <span className="vfi-step">
            <b>{s.t}</b>
            <small>{s.w}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
function IconList({ items }: { items: [VIcon, string][] }) {
  return (
    <ul>
      {items.map(([icon, t]) => (
        <li key={t}>
          <Tile icon={icon} />
          {t}
        </li>
      ))}
    </ul>
  );
}

export function FichaBlock({ c }: { c: VxCtx }) {
  const linked = !!c.playerId;
  const claim = useMyClaim(linked ? undefined : c.uid || undefined).data;
  // (also once linked: the squad below lights his shirt among the taken and the free ones)
  const links = usePlayerLinks(true);
  const nick = c.me?.name ?? "";
  const { options, suggestion } = useMemo(
    () =>
      fichaChoices(c.squad, links.data, nick, (id) => {
        const p = c.players.find((x) => x.id === id);
        return p ? [p.shirtName ?? "", p.firstName ?? "", playerName(p)] : [];
      }),
    [c.squad, c.players, links.data, nick],
  );
  const tiles = useMemo(() => fichaTiles(c.squad, links.data, c.playerId), [c.squad, links.data, c.playerId]);
  const byId = useMemo(() => new Map(c.squad.map((s) => [s.id, s])), [c.squad]);
  const [picking, setPicking] = useState(false);
  const [sel, setSel] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const search = useRef<HTMLInputElement>(null);

  const pending = claim?.status === "pending";
  const rejected = claim?.status === "rejected";
  const offer = suggestion && !pending ? suggestion : null;
  const phase: FichaPhase = linked ? "done" : pending && !picking ? "wait" : "pick";
  const loadingLinks = links.loading && !options.length;
  const noFree = !links.loading && !options.length;
  const labelOf = (id: string) => {
    const s = byId.get(id);
    return s ? fichaLabel(s.name, s.num) : c.nameOf(id);
  };
  const head = fichaHead(phase, { admin: c.admin, noFree, linkedName: c.nameOf(c.playerId ?? "") });

  const send = async (id: string) => {
    if (!id) {
      c.say("Elige tu nombre primero.");
      return;
    }
    setBusy(id);
    setError("");
    try {
      const r = await requestPlayerClaim({ playerId: id });
      setPicking(false);
      setSel("");
      c.say(r.data.linked ? "Ficha vinculada." : "Solicitud enviada: tu ficha, en revisión.");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy("");
    }
  };
  const errorLine = error ? (
    <p className="ve-err" role="alert">
      {error}
    </p>
  ) : null;

  return (
    <section className="vfi" aria-labelledby="ve-room-h">
      <RoomHead
        room="ficha"
        icon="shirt"
        kick={head.kick}
        title={head.title}
        sub={
          phase === "pick" && rejected ? (
            <>
              <b>Tu última solicitud no se aprobó. </b>
              {head.sub}
            </>
          ) : (
            head.sub
          )
        }
      />

      {phase === "done" && (
        <div className="ve-cols">
          <div className="ve-stack">
            <section className="vd-glass vd-glass--deep ve-card vfi-wait vfi-done" aria-labelledby="vfi-done-h">
              <div className="vfi-wait__top">
                <PShirt n={byId.get(c.playerId ?? "")?.num ?? ""} />
                <div>
                  <span className="ve-st is-ok">
                    <Ic name="check" />
                    Vinculada
                  </span>
                  <h2 id="vfi-done-h">{labelOf(c.playerId ?? "")}</h2>
                  <p>Tu nombre y tu dorsal ya van en tu cartel, y tus partidos, goles y notas se cuentan solos.</p>
                  <div className="ve-acts">
                    <Go className={`${BTN} nx-btn--pri`} href="/perfil">
                      Ir a mi ficha
                      <Ic name="arrow" />
                    </Go>
                  </div>
                </div>
              </div>
            </section>
            <section className="nx-sec" aria-labelledby="vfi-all-h" style={{ marginTop: 26 }}>
              <div className="nx-sec__head">
                <h2 className="nx-h3" id="vfi-all-h">
                  La plantilla
                </h2>
                <p className="nx-meta">La tuya, encendida · {options.length === 1 ? "1 libre" : `${options.length} libres`} para los que faltan</p>
              </div>
              <ul className="vfi-grid" aria-label="Las camisetas de la plantilla">
                {tiles.map((s) => (
                  <li key={s.id}>
                    <Still s={s} word={WORD[s.state]} cls={s.state === "mine" ? "is-mine" : s.state === "free" ? "is-idle" : "is-taken"} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="ve-side ve-stack">
            <section className="ve-panel vfi-meanwhile" aria-labelledby="vfi-own-h">
              <h2 className="nx-h3" id="vfi-own-h">
                Una cuenta, una ficha
              </h2>
              <IconList items={OWNED} />
              <p className="nx-note">¿No es la tuya? Díselo a un capitán: la cambia desde la puerta.</p>
            </section>
          </div>
        </div>
      )}

      {phase === "wait" && claim && (
        <div className="ve-cols">
          <div className="ve-stack">
            {errorLine}
            <section className="vd-glass vd-glass--deep ve-card vfi-wait" aria-labelledby="vfi-wait-h">
              <div className="vfi-wait__top">
                <PShirt n={byId.get(claim.playerId)?.num || "?"} />
                <div>
                  <span className="ve-st is-warn">
                    <Ic name="clock" />
                    En revisión
                  </span>
                  <h2 id="vfi-wait-h">{byId.has(claim.playerId) ? labelOf(claim.playerId) : claim.playerName || c.nameOf(claim.playerId)}</h2>
                  <p>
                    Has pedido la ficha de <b>{claim.playerName || c.nameOf(claim.playerId)}</b>. En cuanto un capitán la apruebe, tu cartel llevará tu nombre y tu dorsal.
                  </p>
                </div>
              </div>
              <div className="vfi-wait__steps">
                <Steps
                  row
                  label="Cómo va tu solicitud"
                  steps={[
                    { t: "Solicitud enviada", w: "Hecho", cls: "is-done", icon: "check" },
                    { t: "El capitán decide", w: "Ahora · le ha llegado un aviso", cls: "is-now", icon: "flag" },
                    { t: "Ficha vinculada", w: "Después · tu cartel con tu nombre", cls: "", icon: "shirt" },
                  ]}
                />
              </div>
              <div className="ve-acts">
                <button type="button" className="nx-lnk" onClick={() => setPicking(true)}>
                  No es esa, elegir otra
                </button>
              </div>
            </section>
          </div>
          <div className="ve-side ve-stack">
            <section className="ve-panel vfi-meanwhile" aria-labelledby="vfi-mw2-h">
              <h2 className="nx-h3" id="vfi-mw2-h">
                Mientras tanto
              </h2>
              <p className="nx-meta">Todo el vestuario funciona igual mientras el capitán decide:</p>
              <IconList items={MEANWHILE} />
              <div className="ve-acts" style={{ marginTop: 6 }}>
                <button type="button" className={BTN} onClick={() => c.go("/vestuario")}>
                  <Ic name="left" />
                  Volver al vestuario
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {phase === "pick" && (
        <div className="ve-cols">
          <div className="ve-stack">
            {offer && !picking && (
              <section className="vd-glass vd-glass--deep ve-card vfi-sug" aria-labelledby="vfi-sug-h">
                <PShirt n={byId.get(offer.id)?.num || "?"} />
                <div className="vfi-sug__t">
                  <p className="ve-card__k">Se parece a tu nombre</p>
                  <h2 id="vfi-sug-h">{offer.label}</h2>
                  <p>{nick ? `En el vestuario eres «${nick}» y esta ficha está libre. ¿Es la tuya?` : "Esta ficha está libre. ¿Es la tuya?"}</p>
                </div>
                <div className="ve-acts">
                  <button type="button" className={`${BTN} nx-btn--pri`} disabled={!!busy} aria-busy={busy === offer.id || undefined} onClick={() => void send(offer.id)}>
                    <Ic name="check" />
                    {busy === offer.id ? "Vinculando…" : "Sí, es mi ficha"}
                  </button>
                  <button
                    type="button"
                    className={BTN}
                    disabled={!!busy}
                    onClick={() => {
                      setPicking(true);
                      setTimeout(() => search.current?.focus(), 0);
                    }}
                  >
                    Elegir otra
                  </button>
                </div>
              </section>
            )}

            {noFree && (
              <div className="ve-empty">
                <Tile icon="shirt" />
                <h2>Ninguna ficha libre esta temporada</h2>
                <p>No queda ninguna ficha libre esta temporada: pídesela a un capitán. Te hace la ficha con tu nombre y tu dorsal, y aparece aquí para que la elijas.</p>
                <div className="ve-acts">
                  <button type="button" className={`${BTN} nx-btn--pri`} onClick={() => c.go("/vestuario/tablon")}>
                    <Ic name="board" />
                    Pedírsela en el tablón
                  </button>
                  <button type="button" className="nx-lnk" onClick={() => c.go("/vestuario")}>
                    Volver al vestuario
                  </button>
                </div>
              </div>
            )}

            {errorLine}

            <section className="nx-sec nx-sec--first" aria-labelledby="vfi-grid-h">
              <div className="nx-sec__head">
                <h2 className="nx-h3" id="vfi-grid-h">
                  {noFree ? "La plantilla · todas ocupadas" : "Toda la plantilla"}
                </h2>
                <p className="nx-meta">{loadingLinks ? "Cargando las fichas…" : noFree ? `${c.squad.length} camisetas, ninguna libre` : `${options.length === 1 ? "1 libre" : `${options.length} libres`} de ${c.squad.length} · toca la tuya`}</p>
              </div>
              <div className="vfi-find">
                <div className="ve-lab vfi-q">
                  <label htmlFor="vfi-q">Busca tu nombre o dorsal</label>
                  <div className="vfi-q__box">
                    <Ic name="search" />
                    <input ref={search} id="vfi-q" className="ve-in" type="search" autoComplete="off" placeholder="Pellete, 20…" value={q} onChange={(e) => setQ(e.target.value)} />
                  </div>
                </div>
                <ul className="vfi-key" aria-label="Qué significa cada camiseta">
                  {(noFree
                    ? [["", "Ocupada: ya tiene dueño"]]
                    : [
                        ["is-free", "Libre: tócala"],
                        ["", "Ocupada: ya tiene dueño"],
                        ["is-on", "Elegida"],
                      ]
                  ).map(([cls, t]) => (
                    <li key={t}>
                      <i className={cls || undefined} aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <Grid tiles={tiles} q={q} sel={sel} busy={!!busy} loading={loadingLinks} onPick={setSel} onClear={() => setQ("")} />
            </section>
          </div>

          <div className="ve-side ve-stack">
            {!noFree && (
              <>
                <section className="vd-glass ve-card vfi-pick" aria-labelledby="vfi-pick-h">
                  <p className="ve-card__k">Tu elección</p>
                  <div className="vfi-pick__top">
                    <PShirt n={sel ? byId.get(sel)?.num || "?" : "?"} className={sel ? undefined : "vfi-q-shirt"} />
                    <div>
                      <h2 id="vfi-pick-h">{sel ? labelOf(sel) : "Toca tu camiseta"}</h2>
                      <p>{sel ? (c.admin ? "Como capitán, se vincula al instante." : "Se la pides a un capitán. Mientras la aprueba, todo el vestuario funciona igual.") : "Elígela en la plantilla: solo las libres se pueden tocar."}</p>
                    </div>
                  </div>
                  <div className="ve-acts">
                    <button type="button" className={`${BTN} nx-btn--pri`} disabled={!!busy} aria-busy={(!!sel && busy === sel) || undefined} onClick={() => void send(sel)}>
                      <Ic name="check" />
                      {sel && busy === sel ? "Vinculando…" : "Es mi ficha"}
                    </button>
                    {(sel || picking) && (
                      <button
                        type="button"
                        className="nx-lnk"
                        disabled={!!busy}
                        onClick={() => {
                          setSel("");
                          setPicking(false);
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </section>
                <section className="ve-panel" aria-labelledby="vfi-next-h">
                  <h2 className="nx-h3" id="vfi-next-h" style={{ marginBottom: 14 }}>
                    Qué pasa después
                  </h2>
                  <Steps
                    steps={[
                      { t: "Eliges tu camiseta", w: sel ? `Ahora · ${byId.get(sel)?.name ?? c.nameOf(sel)}` : "Ahora", cls: "is-now", icon: "shirt" },
                      ...(c.admin
                        ? [{ t: "Ficha vinculada", w: "Al instante: eres capitán", cls: "" as const, icon: "check" as const }]
                        : [
                            { t: "El capitán decide", w: "Le llega un aviso", cls: "" as const, icon: "flag" as const },
                            { t: "Ficha vinculada", w: "Tu cartel con tu nombre y tu dorsal", cls: "" as const, icon: "check" as const },
                          ]),
                    ]}
                  />
                </section>
              </>
            )}
            {noFree && (
              <section className="ve-panel vfi-meanwhile" aria-labelledby="vfi-mw-h">
                <h2 className="nx-h3" id="vfi-mw-h">
                  Mientras tanto
                </h2>
                <p className="nx-meta">Todo el vestuario funciona igual sin ficha:</p>
                <IconList items={MEANWHILE} />
              </section>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

type ShirtTile = ReturnType<typeof fichaTiles>[number];

/** A shirt nobody can pick here (taken, or the done squad): a picture with its word. */
function Still({ s, word, cls }: { s: ShirtTile; word: string; cls: string }) {
  return (
    <div className={`vfi-tile ${cls}`} role="img" aria-label={`${s.name}${s.num ? `, dorsal ${s.num}` : ""}: ${word.toLowerCase()}`}>
      <PShirt n={s.num || "?"} />
      <b>{s.name}</b>
      <small>{word}</small>
    </div>
  );
}

/** The squad to pick from: the free shirts are one native radio group («Elige tu nombre»), the rest are pictures. */
function Grid({ tiles, q, sel, busy, loading, onPick, onClear }: { tiles: ShirtTile[]; q: string; sel: string; busy: boolean; loading: boolean; onPick: (id: string) => void; onClear: () => void }) {
  if (loading)
    return (
      <p className="nx-meta" role="status">
        Cargando las fichas…
      </p>
    );
  const shown = tiles.filter((s) => matchShirt(q, s.name, s.num));
  if (!shown.length)
    return (
      <div className="vfi-none" role="status">
        <p>Nadie con «{q.trim()}». Si no estás en la plantilla, pídele a un capitán que te haga la ficha.</p>
        <button type="button" className="nx-lnk" onClick={onClear}>
          Borrar la búsqueda
        </button>
      </div>
    );
  return (
    <fieldset className="vfi-set">
      <legend className="nx-vh">Elige tu nombre</legend>
      <ul className="vfi-grid" aria-label="Las camisetas de la plantilla">
        {shown.map((s) => (
          <li key={s.id}>
            {s.state === "free" ? (
              <label className={`vd-glass vd-press vfi-tile is-free${sel === s.id ? " is-on" : ""}`}>
                <input className="nx-vh" type="radio" name="vfi-pick" value={s.id} checked={sel === s.id} disabled={busy} onChange={() => onPick(s.id)} aria-label={`${s.name}${s.num ? `, dorsal ${s.num}` : ""}`} />
                <PShirt n={s.num || "?"} />
                <b>{s.name}</b>
                <small>{sel === s.id ? "Elegida" : "Libre"}</small>
              </label>
            ) : (
              <Still s={s} word={WORD[s.state]} cls={s.state === "mine" ? "is-mine" : "is-taken"} />
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
