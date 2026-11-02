// r14 «La pizarra» · La ficha (PiFicha.dc.html, PZ-M15): La carta (the same numbers as Tú's La carta and the
// cromo: GLOBAL, puesto, the six numbers, the tier's metal), his last notas, where he has played (minutes per F7
// puesto on a mini pitch), his química with his neighbours in this seven, his answer to the convocatoria, «Jugar
// de…» on this board, and the actions (Mover a…, Quitar del siete, el brazalete, Ver su página).
import { Link } from "@tanstack/react-router";
import { usePz } from "../../store/context";
import type { SheetProps } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import { fmt } from "../../store/fmt";
import { POSITIONS, type PosCode } from "../../../../../lib/positions";
import { RowShirt } from "../../places/siete/RowShirt";
import { POS_XY, convLine, tierCls } from "../../places/siete/sieteView";
import { useSieteApi } from "../../places/siete/sieteApi";
import "../../../../../styles/pz/siete.css";

const xy = (k: string): [number, number] => POS_XY[k] ?? [50, 50];

export function FichaSheet({ args, layout }: SheetProps) {
  const P = usePz();
  useSieteApi(P);
  const pid = typeof args.pid === "string" ? args.pid : typeof args.jugador === "string" ? args.jugador : (P.state.fichaPid ?? "");
  const pl = P.sel.player(pid);
  if (!pl) return <p className="pz-line">Ese jugador ya no está en la plantilla de esta temporada.</p>;
  const b = P.sel.board();
  const v = P.sel.ver();
  const M = P.sel.match();
  const ed = P.sel.canEdit(b);
  const slotI = v ? v.slots.findIndex((s) => s.playerId === pid) : -1;
  const slot = slotI >= 0 && v ? v.slots[slotI] : null;
  const pa = pl.playedAt ?? {};
  const codes = Object.keys(pa)
    .filter((k) => k !== "?" && pa[k] > 0)
    .sort((a, c) => pa[c] - pa[a]);
  const most = codes[0];
  const pos = pl.main || most || pl.also[0] || pl.line || "—";
  const js = pl.notas.map((n) => n.j).filter((j): j is number => j != null);
  const g = pl.global == null ? "—" : String(pl.global);
  const prov = pl.provisional && pl.global != null;
  const attrs: [string, string][] = [
    ["GOL", String(pl.goals)],
    ["MVP", String(pl.mvp || 0)],
    ["ASI", String(pl.assists)],
    ["PJ", String(pl.pj)],
    ["MIN", String(pl.min)],
    ["FOR", pl.forma == null ? "—" : String(pl.forma)],
  ];
  const tN = /\d+/.exec(P.state.W.season.name)?.[0];
  const club = pl.guest ? "Invitado" + (pl.by ? " · lo trae " + P.sel.name(pl.by) : "") : "Manchester Piti" + (tN ? " · T" + tN : "") + (js.length ? " · J" + js[0] + (js.length > 1 ? "–J" + js[js.length - 1] : "") : "");
  const r = P.sel.rsvp(pid);
  const chips: { t: string; icon: string; tone: string }[] = [{ t: r.t, icon: r.icon, tone: r.tone }];
  if (slot) chips.push({ t: "En el siete · " + slot.code, icon: "shirt", tone: "guest" });
  P.sel.galones(pid).forEach((x) => chips.push({ t: x.t, icon: "armband", tone: "" }));
  const full = [pl.first, pl.last.split(" ")[0]].filter(Boolean).join(" ");
  const idLine = [full, pl.num ? "dorsal " + pl.num : "", pl.guest ? "invitado" : pl.type + " · " + (pl.global == null ? "sin nota" : pl.global) + (prov ? " provisional" : "")].filter(Boolean).join(" · ");
  const notas = pl.notas.slice(-5).reverse();
  const max = Math.max(1, ...codes.map((k) => pa[k]));
  const spots = codes.map((k) => ({ code: k, x: xy(k)[0], y: xy(k)[1], d: Math.round(24 + (16 * pa[k]) / max), cls: k === pl.main || k === codes[0] ? "is-main" : "" }));
  if (pl.main && !codes.includes(pl.main)) spots.push({ code: pl.main, x: xy(pl.main)[0], y: xy(pl.main)[1], d: 26, cls: "is-dim" });
  if (slot && !codes.includes(slot.code) && slot.code !== pl.main) spots.push({ code: slot.code, x: xy(slot.code)[0], y: xy(slot.code)[1], d: 26, cls: "is-dim" });
  const sub = pa["?"] ?? 0;
  const links = slot && v ? P.sel.links(v).filter((l) => l.a === pid || l.b === pid) : [];
  const line = slot ? POSITIONS[slot.code].line : pl.line;
  const lineCodes = (Object.keys(POSITIONS) as PosCode[]).filter((c) => POSITIONS[c].line === line);
  const cur = b?.lineup.playerPositions[pid];
  const isCap = b?.lineup.roles.captainId === pid;
  const mapAria = codes.length ? "Ha jugado de " + codes.map((k) => k + " " + pa[k] + " minutos").join(", ") : "Aún no ha jugado" + (pl.main ? "; su puesto es " + pl.main : "");
  return (
    <div className={`pz-f${layout === "phone" ? " is-phone" : ""}`}>
      <div className="pz-f__top">
        <div className={`pz-f__card ${tierCls(pl)}`} role="img" aria-label={`La carta de ${pl.shirt}: ${g}${prov ? " provisional" : ""}, ${pos}, ${pl.guest ? "invitado" : pl.type}. ${attrs.map((a) => a[0] + " " + a[1]).join(", ")}`}>
          <div className="pz-f__face">
            <div className="pz-f__front">
              <div className="pz-f__ft">
                <div className="pz-f__rate">
                  <b>{g}</b>
                  <span>{pos}</span>
                  {prov && <small>provisional</small>}
                </div>
                <img className="pz-f__crest" src="/crest-128.webp" alt="" width="40" height="40" />
              </div>
              <div className="pz-f__art">
                <RowShirt still={P.sel.shirt(pid)} />
              </div>
              <p className="pz-f__name">{pl.shirt}</p>
              <p className="pz-f__club">{club}</p>
              <div className="pz-f__attrs">
                {attrs.map(([k, val]) => (
                  <span key={k}>
                    <b>{val}</b>
                    <small>{k}</small>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="pz-f__id">
          <p>{idLine}</p>
          <div className="pz-f__chips">
            {chips.map((c) => (
              <span key={c.t} className={`pz-chip${c.tone ? " is-" + c.tone : ""}`}>
                <PzIcon name={c.icon} />
                {c.t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="pz-f__sec" aria-labelledby="pzf-n">
        <h3 id="pzf-n">
          Sus últimas notas<small>{notas.length ? "la última, primero" : ""}</small>
        </h3>
        {notas.length ? (
          <ul className="pz-f__notas">
            {notas.map((n) => (
              <li key={n.matchId} className={`pz-f__nota${n.n >= 7.5 ? " t-top" : n.n < 5 ? " t-bad" : ""}`} aria-label={`${n.j ? "J" + n.j + " " : ""}contra ${n.rival}: ${fmt.nota(n.n)}, ${P.sel.notaWord(n.n).toLowerCase()}`}>
                <b>{fmt.nota(n.n)}</b>
                <span>{P.sel.notaWord(n.n)}</span>
                <small>{n.j ? "J" + n.j : n.rival}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pz-meta">{pl.guest ? "No ha jugado con nosotros: sin notas." : "Aún sin partidos con nota esta temporada."}</p>
        )}
      </section>

      <section className="pz-f__sec" aria-labelledby="pzf-m">
        <h3 id="pzf-m">
          Dónde ha jugado<small>{pl.min ? pl.min + "′ en " + fmt.plural(pl.pj, "partido", "partidos") : "sin minutos aún"}</small>
        </h3>
        <div className="pz-f__map">
          <div className="pz-f__f7" role="img" aria-label={mapAria}>
            {spots.map((s) => (
              <span key={s.code} className={s.cls || undefined} style={{ left: s.x + "%", top: s.y + "%", width: s.d, height: s.d }}>
                {s.code}
              </span>
            ))}
          </div>
          {codes.length || sub ? (
            <ul className="pz-f__mins">
              {codes.map((k) => (
                <li key={k}>
                  <b>{k}</b>
                  <i aria-hidden="true">
                    <em style={{ width: Math.round((pa[k] / max) * 100) + "%" }} />
                  </i>
                  <span>{pa[k]}′</span>
                </li>
              ))}
              {sub > 0 && (
                <li>
                  <b>Otros</b>
                  <i aria-hidden="true">
                    <em style={{ width: Math.round((sub / Math.max(max, sub)) * 100) + "%" }} />
                  </i>
                  <span>{sub}′</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="pz-meta">{pl.min ? "Aún no sabemos en qué puesto jugó sus minutos." : pl.main ? "Aún no ha jugado. Su puesto: " + P.sel.posName(pl.main).toLowerCase() + "." : "Aún no ha jugado."}</p>
          )}
        </div>
      </section>

      {links.length > 0 && slot && v && (
        <section className="pz-f__sec" aria-labelledby="pzf-q">
          <h3 id="pzf-q">
            Química en este siete<small>de {slot.code} en el {v.formation}</small>
          </h3>
          <ul className="pz-rows">
            {links.map((l) => {
              const o = l.a === pid ? l.b : l.a;
              return (
                <li key={o} className="pz-row pz-f__chem">
                  <RowShirt still={P.sel.shirt(o)} size={26} />
                  <span className="pz-row__t">
                    <b>con {P.sel.name(o)}</b>
                    <span>{l.why}</span>
                  </span>
                  <span className={`pz-chip is-${l.t === 3 ? "ok" : l.t === 2 ? "guest" : "mute"}`}>{l.word}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="pz-f__sec" aria-labelledby="pzf-c">
        <h3 id="pzf-c">{M?.j ? "La convocatoria de la J" + M.j : "La convocatoria"}</h3>
        <p className="pz-f__conv">{convLine(P, r)}</p>
      </section>

      {ed && slot && (
        <section className="pz-f__sec" aria-labelledby="pzf-j">
          <h3 id="pzf-j">
            Jugar de…<small>solo en este tablero</small>
          </h3>
          <div className="pz-f__playas" role="group" aria-label="Jugar de">
            <button type="button" className="vd-glass vd-press" aria-pressed={!cur} onClick={() => P.act.setPlayAs(pid, null)} aria-label="Como siempre">
              Como siempre
            </button>
            {lineCodes.map((c) => (
              <button key={c} type="button" className="vd-glass vd-press" aria-pressed={cur === c} onClick={() => P.act.setPlayAs(pid, c)} aria-label={"Jugar de " + P.sel.posName(c).toLowerCase()}>
                {c}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="pz-f__sec" aria-label="Acciones">
        <div className="pz-f__acts">
          {ed && (
            <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.openSheet("mover", { jugador: pid, pid })} aria-keyshortcuts="M">
              <PzIcon name="move" />
              Mover a…
            </button>
          )}
          {ed && slot && (
            <button
              type="button"
              className="vd-glass vd-press pz-btn"
              onClick={() => {
                P.act.remove(slotI);
                P.act.closeSheet();
              }}
              aria-keyshortcuts="Delete"
            >
              <PzIcon name="bench" />
              Quitar del siete
            </button>
          )}
          {ed && slot && (
            <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.setRole("captainId", pid)}>
              <PzIcon name="armband" />
              {isCap ? "Quitar el brazalete" : "Darle el brazalete"}
            </button>
          )}
          {!pl.guest && (
            <Link to="/jugadores/$playerId" params={{ playerId: pid }} className="vd-glass vd-press pz-btn">
              <PzIcon name="user" />
              Ver su página
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
