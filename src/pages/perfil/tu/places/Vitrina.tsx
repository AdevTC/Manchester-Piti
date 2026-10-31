// Tu vitrina (B Vitrina) — PLACEHOLDER until the Vitrina place agent builds it: «Compartir mi carta» and «Ver
// tus cromos» (the shell mounts the studio and the cromos over this place: /perfil/compartir,
// /perfil/vitrina/cromos) and the reward wall as a plain list from `p.me.rewards`. The place builds «El camino»
// (`p.me.tier`), the wall and «Tu temporada en cromos».
import type { PlaceProps } from "./types";

export function Vitrina(p: PlaceProps) {
  const { earned, next } = p.me.rewards;
  const open = (o: "compartir" | "cromos") => p.go({ page: "perfil", sec: "vitrina", aj: null, open: o });
  return (
    <section className="tc-vi" aria-labelledby="tc-vi-h">
      <header className="tc-head">
        <div className="tc-head__t">
          <p className="tc-kick">Tu vitrina</p>
          <h2 className="nx-h2" id="tc-vi-h">
            {p.who.kind === "jugador" ? `${p.me.tier.name}${p.me.tier.next ? `, camino de ${p.me.tier.next.name}` : ""}` : "Tu carné y lo tuyo"}
          </h2>
        </div>
        <div className="tk-acts">
          <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => open("compartir")}>
            {p.who.kind === "jugador" ? "Compartir mi carta" : "Compartir mi póster"}
          </button>
          {p.who.kind === "jugador" && p.me.figures.played > 0 && (
            <button type="button" className="vd-glass vd-press nx-btn" onClick={() => open("cromos")}>
              Ver tus cromos
            </button>
          )}
        </div>
      </header>
      {p.who.kind === "jugador" && (
        <ul className="tc-shelf">
          {[...earned, ...next].map((r) => (
            <li key={r.id} className={r.earned ? "is-lit" : "is-off"}>
              <b>{r.t}</b> {r.earned ? (r.match?.label ?? "") : `${r.need}${r.progress ? ` · ${r.progress.cur} de ${r.progress.goal}` : ""}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
