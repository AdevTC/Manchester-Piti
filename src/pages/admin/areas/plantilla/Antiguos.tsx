// PLANTILLA · Antiguos (/admin/plantilla/antiguos, M-14), as the board's part-plantilla.html § Antiguos: who does not
// play the season, never deleted — «De una temporada archivada» (even when that season was deleted: B-CLUB-01) and «De
// baja» — each with «Su ficha» and «Volver a darle de alta» (warning when his dorsal is worn now), and «Invitados»: the
// guests of the convocatorias with how many times they came; «Darle de alta» opens the alta with his name and, once
// the ficha is written, his matches as a guest pass to it (M-41, promoteGuest).
import { formFromPlayer, nameIn, playerPayload, previewDoc, dorsalHolder } from "../../club/plantillaLogic";
import type { BoardRow } from "../../club/plantillaBoard";
import { SalaLink } from "../../shell/SalaLink";
import { useSalaGo } from "../../shell/salaHref";
import { SalaScreen, ScreenError, ScreenLoading } from "../../shell/Screen";
import { useFrame } from "../../ui/frame";
import { plural } from "../../../../lib/derived/words";
import { guestLine, guestRows, shirtFromName } from "./model";
import { PlNav, Shirt } from "./parts";
import { usePlantilla } from "./storeContext";
import "./plantilla.css";

export function AntiguosScreen() {
  const st = usePlantilla();
  const { data, season, rows, players, writes, write, still, blank } = st;
  const go = useSalaGo();
  const { desktop } = useFrame();
  if (data.loading || data.archivesLoading) return <ScreenLoading label="Cargando los antiguos" />;
  if (data.error && !rows.length) return <ScreenError what="los antiguos" onRetry={() => window.location.reload()} />;

  const outs = rows.filter((r) => !r.inSeason);
  const arch = outs.filter((r) => r.doc.archived);
  const baja = outs.filter((r) => !r.doc.archived);
  const archNames = data.seasons.filter((s) => s.archived).map((s) => s.name);
  const guests = guestRows([...data.matches, ...data.archivedMatches]);
  const sName = season?.name ?? "la temporada";

  const restore = (r: BoardRow) => {
    if (!season) return;
    const f = formFromPlayer(r.doc);
    const next = { ...f, seasons: [...new Set([...f.seasons, season.id])] };
    const payload = { ...playerPayload(next, { stored: r.doc }), archived: false };
    const num = Number(f.number);
    const clash = f.number && Number.isFinite(num) ? dorsalHolder(players, season.id, num, r.id) : null;
    write({ id: r.id, doc: { ...previewDoc(r.doc, r.id, payload), archived: false }, tag: "Alta", message: `${r.name} vuelve a la ${season.name}${clash ? ` · el ${num} ya lo lleva ${nameIn(clash, season.id)}: cámbiale el dorsal en su ficha` : f.number ? ` con el ${f.number}` : ""}`, error: `No se ha podido dar de alta a ${r.name}`, commit: () => writes.savePlayer(r.id, payload) });
  };
  const oldRow = (r: BoardRow) => {
    const holder = season && r.number != null ? dorsalHolder(players, season.id, r.number, r.id) : null;
    const where = r.doc.archived ? `Jugó en ${(r.doc.seasons ?? []).map((s) => data.seasons.find((x) => x.id === s)?.name).filter(Boolean).join(", ") || "una temporada que ya no existe"}${(r.doc.seasons ?? []).some((s) => data.seasons.some((x) => x.id === s)) ? " · archivada" : ""}` : season ? `De baja de la ${season.name}` : "Sin temporada visible";
    return (
      <li className="sc-row pl-orow" key={r.id}>
        <Shirt src={still(r) ?? blank} size="s" alt={`Camiseta de ${r.name}`} />
        <span className="sc-row__t">
          <b>
            <span className="sc-num">{r.number ?? "—"}</span> {r.name}
          </b>
          <span>{r.full === "Sin nombre" ? "Sin nombre completo" : r.full}</span>
          <span>{where}</span>
          {holder && season && <span className="pl-clash">El {r.number} lo lleva ahora {nameIn(holder, season.id)}</span>}
        </span>
        <span className="sc-btnrow">
          <SalaLink className="vd-btn vd-glass vd-press vd-btn--sm" to={`/admin/plantilla/${encodeURIComponent(r.id)}`}>
            Su ficha
          </SalaLink>
          {season && (
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Volver a dar de alta a ${r.name} en la ${season.name}`} onClick={() => restore(r)}>
              Volver a darle de alta
            </button>
          )}
        </span>
      </li>
    );
  };

  return (
    <SalaScreen
      title="Antiguos"
      lede={`Los que no juegan la ${sName}: de baja o de una temporada archivada. Ninguno se ha borrado.`}
      headSub={`${plural(outs.length, "ficha", "fichas")} fuera de la ${sName}`}
      back={{ to: "/admin/plantilla", label: "Volver a la plantilla" }}
      actions={desktop ? <PlNav at="jugadores" /> : undefined}
      primary={{ label: "Alta de jugador", icon: "plus", onClick: () => go("/admin/plantilla/alta") }}
      fit
      className="sc-pl pl--antiguos pl--sub"
    >
      <div className="pl-old sc-scroll">
        {!outs.length && <p className="pl-empty">Nadie fuera: todos los jugadores juegan la {sName}.</p>}
        {arch.length > 0 && (
          <section className="sc-sec" aria-labelledby="pl-o-arch">
            <header className="sc-sec__h">
              <h2 className="sc-h2" id="pl-o-arch">
                De una temporada archivada
              </h2>
              <span className="sc-small">{archNames.length ? `${archNames.join(", ")} · archivada` : "Temporadas que ya no existen"}</span>
            </header>
            <ul className="sc-rows">{arch.map(oldRow)}</ul>
          </section>
        )}
        {baja.length > 0 && (
          <section className="sc-sec" aria-labelledby="pl-o-baja">
            <header className="sc-sec__h">
              <h2 className="sc-h2" id="pl-o-baja">
                De baja
              </h2>
            </header>
            <ul className="sc-rows">{baja.map(oldRow)}</ul>
          </section>
        )}
        <section className="sc-sec" aria-labelledby="pl-o-inv">
          <header className="sc-sec__h">
            <h2 className="sc-h2" id="pl-o-inv">
              Invitados
            </h2>
            <span className="sc-small">Los de fuera que jugaron algún partido</span>
          </header>
          {guests.length ? (
            <ul className="sc-rows">
              {guests.map((g) => (
                <li className="sc-row" key={g.key}>
                  <span className="sc-row__t">
                    <b>{g.name}</b>
                    <span>{guestLine(g)}</span>
                  </span>
                  <button
                    type="button"
                    className="vd-btn vd-glass vd-press vd-btn--sm"
                    aria-label={`Dar de alta a ${g.name} en la plantilla`}
                    onClick={() => {
                      st.setAlta({ name: shirtFromName(g.name), num: "", line: "", main: null, also: [], seasons: null, guests: g.matches.map((m) => ({ matchId: m.matchId, guestId: m.guestId })), guestName: g.name });
                      go("/admin/plantilla/alta");
                    }}
                  >
                    Darle de alta
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sc-small pl-quiet">Ningún invitado todavía. Los que se apuntan en una convocatoria salen aquí.</p>
          )}
          <p className="sc-small pl-note">Al darle de alta, sus partidos de invitado pasan a su ficha: sus minutos, goles y notas cuentan como suyos.</p>
        </section>
        <p className="sc-small pl-note">Archivar una temporada esconde a quien solo jugó en ella, y eliminarla ya no los deja perdidos: siguen aquí, con sus actas.</p>
      </div>
    </SalaScreen>
  );
}
