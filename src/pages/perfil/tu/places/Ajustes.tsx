// Ajustes (B Ajustes) — PLACEHOLDER until the Ajustes place agent builds it: the index of his sections (the
// phone's list; on a desktop the first section beside it) and each section with today's screen (Tu nombre,
// Apariencia = today's Ajustes, Cuenta, Capitanía); Avisos links to «A medida» until the place embeds it.
import { Link } from "@tanstack/react-router";
import type { PlaceProps } from "./types";
import { ajLabel, ajSecsOf, type AjSec } from "../model";
import { legacyProps } from "../screens/legacy";
import { Nombre } from "../screens/Nombre";
import { Ajustes as Apariencia } from "../screens/Ajustes";
import { Cuenta } from "../screens/Cuenta";
import { Capitania } from "../screens/Capitania";

export function Ajustes(p: PlaceProps) {
  const secs = ajSecsOf(p.who);
  const aj: AjSec = p.screen.aj ?? secs[0];
  const lp = legacyProps(p);
  return (
    <div className="tc-aj">
      <nav className="tc-aj__ix" aria-label="Ajustes">
        <ul>
          {secs.map((s) => (
            <li key={s}>
              <button type="button" className="tc-aj__b" aria-current={s === p.screen.aj ? "page" : undefined} onClick={() => p.go({ page: "perfil", sec: "ajustes", aj: s, open: null })}>
                {ajLabel(s, p.who.kind)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section className="tc-aj__sec">
        {aj === "nombre" && <Nombre {...lp} />}
        {aj === "avisos" && (
          <p>
            <Link className="nx-lnk" to="/avisos/a-medida">
              Elegir tus avisos
            </Link>
          </p>
        )}
        {aj === "apariencia" && <Apariencia {...lp} />}
        {aj === "cuenta" && <Cuenta {...lp} />}
        {aj === "capitania" && <Capitania {...lp} />}
      </section>
    </div>
  );
}
