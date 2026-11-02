// r14 «La pizarra» · La charla: the walkout card (La carta of Tú: the same GLOBAL, position and numbers as the cromo
// everywhere — P.sel.player) and the small printed shirt the strip and the bench use.
import { CREST } from "../../../v2/icons";
import { usePz } from "../../store/context";

/** His printed shirt (the app's kit still) or, while it renders, a drawn one with his dorsal. */
export function Camiseta({ pid, className = "" }: { pid: string; className?: string }) {
  const P = usePz();
  const s = P.sel.shirt(pid);
  return (
    <span className={"pz-shirt" + (className ? " " + className : "")} aria-hidden="true">
      {s.src ? (
        <img src={s.src} alt="" draggable={false} decoding="async" />
      ) : (
        <svg className="pc-drawn" viewBox="0 0 200 265">
          <path className="b" d="M70 18 C84 30 116 30 130 18 L178 38 C186 42 192 50 194 60 L198 102 L166 108 L160 84 L160 244 C160 250 156 254 150 254 L50 254 C44 254 40 250 40 244 L40 84 L34 108 L2 102 L6 60 C8 50 14 42 22 38 Z" />
          {s.num && (
            <text className="n" x="100" y="190" textAnchor="middle">
              {s.num}
            </text>
          )}
        </svg>
      )}
    </span>
  );
}

export function CharlaCard({ pid, phone, shown }: { pid: string; phone: boolean; shown: boolean }) {
  const P = usePz();
  const pl = P.sel.player(pid);
  if (!pl) return null;
  const v = P.sel.ver(P.sel.board(), "titular");
  const slot = v?.slots.find((x) => x.playerId === pl.id);
  const most = Object.keys(pl.playedAt)
    .filter((k) => k !== "?")
    .sort((a, c) => pl.playedAt[c] - pl.playedAt[a])[0];
  const pos = pl.main || most || pl.also[0] || slot?.code || "—";
  const js = pl.notas.map((n) => n.j).filter((j): j is number => j != null);
  const g = pl.global == null ? "—" : String(pl.global);
  const prov = pl.provisional && pl.global != null;
  const attrs: [string, string][] = [
    ["GOL", String(pl.goals)],
    ["MVP", String(pl.mvp)],
    ["ASI", String(pl.assists)],
    ["PJ", String(pl.pj)],
    ["MIN", String(pl.min)],
    ["FOR", pl.forma == null ? "—" : String(pl.forma)],
  ];
  const club = pl.guest ? "Invitado" + (pl.by ? " · lo trae " + P.sel.name(pl.by) : "") : "Manchester Piti · " + P.state.W.season.name.replace(/^Temporada\s*/i, "T") + (js.length ? " · J" + js[0] + (js.length > 1 ? "–J" + js[js.length - 1] : "") : "");
  const tier = pl.guest ? "is-inv" : pl.type === "Oro" ? "is-oro" : pl.type === "Plata" ? "is-plata" : "";
  const aria = "La carta de " + pl.shirt + ": " + g + (prov ? " provisional" : "") + ", " + pos + ", " + (pl.guest ? "invitado" : pl.type) + ". " + attrs.map((a) => a[0] + " " + a[1]).join(", ");
  return (
    <div className={["pc-card", tier, shown ? "is-in" : ""].filter(Boolean).join(" ")} role="img" aria-label={aria}>
      <div className="pc-card__face">
        <div className="pc-card__fr">
          <div className="pc-card__ft">
            <div className="pc-card__rate">
              <b>{g}</b>
              <span>{pos}</span>
              {prov && <small>provisional</small>}
            </div>
            <img className="pc-card__crest" src={CREST} alt="" width="40" height="40" />
          </div>
          <div className="pc-card__art">
            <Camiseta pid={pl.id} />
          </div>
          <p className="pc-card__name">{pl.shirt}</p>
          {!phone && <p className="pc-card__club">{club}</p>}
          {!phone && (
            <div className="pc-card__attrs">
              {attrs.map(([k, val]) => (
                <span key={k}>
                  <b>{val}</b>
                  <small>{k}</small>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
