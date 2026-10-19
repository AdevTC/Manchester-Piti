// Números: the season in figures (our goals, conceded, the difference, the place, what is left), the scorers
// and the assisters (a few, then «Ver todos» grows the full list), when the goals fall (by five-minute
// stretch: ours up, theirs down) and the clean sheets and cards. Tonight's provisional goals count, marked.
import type { CSSProperties } from "react";
import { region, SeeAll } from "../../../components/vidrio";
import type { LeaderRow, SeasonLeaders } from "../../../lib/derived/vidrio/leaders";
import type { Totals } from "./model";
import { Glyph, Shirt } from "./bits";

export interface NumerosProps {
  totals: Totals;
  leaders: SeasonLeaders;
  stretch: { us: number[]; them: number[] };
  /** The keeper with the most clean sheets (the live match at nil counts «de momento»). */
  keeper: { name: string; num: string; clean: number; provisional: boolean } | null;
  /** Our yellow cards, tonight's live ones included. */
  cards: { cards: number; provisional: boolean };
  /** «Por jugar · 6 · Seis jornadas, la primera hoy» (the cockpit, where the totals keep three). */
  left: { value: number; text: string } | null;
  /** A jornada is played today (the empty lists say «esta noche»). */
  today: boolean;
  onGrow: (k: "gol" | "asi") => void;
  growVt: "gol" | "asi" | null;
  nice: (name: string) => string;
  /** The league's match length (the axis's end). */
  duration: number;
}

const CAP = 5;

export function LeaderItem({ r, nice, pos }: { r: LeaderRow; nice: (name: string) => string; pos?: boolean }) {
  const sub = r.provisional ? (r.value === r.provisional ? "Esta noche" : `+${r.provisional} esta noche`) : r.num ? `Dorsal ${r.num}` : "";
  return (
    <li className={r.provisional ? "prov" : undefined}>
      {pos && <span className="vp-rank__pos">{r.shared ? `${r.rank}º=` : `${r.rank}º`}</span>}
      <Shirt num={r.num} size={30} />
      <div>
        <b>{nice(r.name)}</b>
        {sub && <small>{sub}</small>}
      </div>
      <em>{r.value}</em>
    </li>
  );
}

function Ranked({ title, line, rows, empty, label, short, onOpen, vt, nice }: { title: string; line: string; rows: LeaderRow[]; empty: string; label: string; short: string; onOpen: () => void; vt: boolean; nice: (n: string) => string }) {
  return (
    <div className="vp-rankcol vd-grow-src" style={vt ? ({ viewTransitionName: "vp-grow" } as CSSProperties) : undefined}>
      <h3>{title}</h3>
      {/* (an empty list says it once, below) */}
      {rows.length > 0 && <p className="vd-small">{line}</p>}
      {rows.length ? (
        <ol className="vp-rank">
          {rows.slice(0, CAP).map((r) => (
            <LeaderItem key={r.id} r={r} nice={nice} />
          ))}
        </ol>
      ) : (
        <p className="vp-empty">{empty}</p>
      )}
      {/* (how many more depends on how many rows the layout shows: 3 on a desktop, 4 in the cockpit, 5 below) */}
      <div className="vp-moreset" data-n={rows.length}>
        {[3, 4, 5].map((cap) => (
          <div key={cap} className={`vp-more vp-more--${cap}`}>
            <SeeAll
              summary={<b>{rows.length - cap} más</b>}
              count={rows.length - cap}
              label={cap === 4 ? short : label}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Numeros({ totals, leaders, stretch, keeper, cards, left, today, onGrow, growVt, nice, duration }: NumerosProps) {
  const mx = Math.max(1, ...stretch.us, ...stretch.them);
  const any = stretch.us.some(Boolean) || stretch.them.some(Boolean);
  const aria = `Goles nuestros por tramos de cinco minutos: ${stretch.us.join(", ")}. Suyos: ${stretch.them.join(", ")}.`;
  return (
    <section className={`vp-num ${region(4)}`} aria-label="Números de la temporada">
      <ul className="vp-totals" aria-label="La temporada en cifras">
        {totals.items.map((t) => (
          <li key={t.label} className={t.provisional ? "prov" : undefined}>
            <b>{t.value}</b>
            <span>{t.label}</span>
          </li>
        ))}
      </ul>
      <div className="vp-numc">
        <Ranked
          title="Goleadores"
          line={leaders.goalsLine}
          rows={leaders.goals}
          empty={`Aún sin goles. El primero puede caer ${today ? "esta noche" : "en la próxima"}.`}
          label={`Ver todos los goleadores (${leaders.goals.length})`}
          short={`Ver todos (${leaders.goals.length})`}
          onOpen={() => onGrow("gol")}
          vt={growVt === "gol"}
          nice={nice}
        />
        <Ranked
          title="Asistencias"
          line={leaders.assistsLine}
          rows={leaders.assists}
          empty="Nadie ha dado un pase de gol todavía."
          label={`Ver todas (${leaders.assists.length})`}
          short={`Ver todas (${leaders.assists.length})`}
          onOpen={() => onGrow("asi")}
          vt={growVt === "asi"}
          nice={nice}
        />
      </div>
      <div className="vp-numx">
        <h3>Cuándo caen los goles</h3>
        <p className="vd-small">{any ? "Por tramos de cinco minutos: arriba los nuestros, abajo los suyos." : "Aquí irán cayendo, minuto a minuto."}</p>
        <div className="vp-gpm" role="img" aria-label={aria}>
          <svg viewBox="0 0 500 70" preserveAspectRatio="none" aria-hidden="true">
            <line className="ax" x1="0" y1="35" x2="500" y2="35" />
            <line className="ax" x1="250" y1="22" x2="250" y2="48" strokeDasharray="2 3" />
          </svg>
          {stretch.us.map((v, b) =>
            v ? <span key={`u${b}`} className="vp-gpm__b us" style={{ left: `${b * 10 + 5}%`, height: `${(v / mx) * 46}%` }} /> : null,
          )}
          {stretch.them.map((v, b) =>
            v ? <span key={`t${b}`} className="vp-gpm__b them" style={{ left: `${b * 10 + 5}%`, height: `${(v / mx) * 46}%` }} /> : null,
          )}
          <span className="lab" style={{ left: 0, transform: "none" }}>
            0′
          </span>
          <span className="lab" style={{ left: "50%" }}>
            Descanso
          </span>
          <span className="lab" style={{ left: "100%", transform: "translateX(-100%)" }}>
            {duration}′
          </span>
        </div>
        <ul className="vp-rank vp-extra">
          <li className={keeper?.provisional ? "prov" : undefined}>
            <span className="vd-ico">
              <Glyph name="glove" />
            </span>
            <div>
              <b>{keeper ? nice(keeper.name) : "Porterías a cero"}</b>
              <small>{keeper ? `Porterías a cero${keeper.provisional ? ", de momento" : ""}` : "Ninguna todavía"}</small>
            </div>
            <em>{keeper?.clean ?? 0}</em>
          </li>
          <li className={cards.provisional ? "prov" : undefined}>
            <span className="vd-ico">
              <Glyph name="whistle" />
            </span>
            <div>
              <b>Amarillas</b>
              <small>{cards.provisional ? "En toda la temporada, con las de esta noche" : "En toda la temporada"}</small>
            </div>
            <em>{cards.cards}</em>
          </li>
          {left && (
            <li className="vp-extra__left">
              <span className="vd-ico">
                <Glyph name="cal" />
              </span>
              <div>
                <b>Por jugar</b>
                <small>{left.text}</small>
              </div>
              <em>{left.value}</em>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
