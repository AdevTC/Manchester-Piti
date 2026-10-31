// Tu vitrina (TuCarta B «vitrina»): the head («Bronce, camino de Plata») with «Compartir mi carta» (the studio,
// /perfil/compartir) and «Ver tus cromos» (the viewer, /perfil/vitrina/cromos); «El camino» (the Bronce · Plata ·
// Oro scale with him on it, the stations, why he is Bronce and what makes him Plata, the tier chips); ONE reward
// wall from me.rewards; «Tu temporada en cromos» (tu/cromosModel: the season recap, the single model) with his album
// count. A socio's vitrina is his carné and his porra; a new account's, the sobre and what it will hold. The words
// and the stations are tu/places/vitrinaView (pure).
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { albumLine, albumOf } from "../../../../lib/derived/album";
import { Shirt } from "../TuCard";
import { tierCls } from "../shell/tierCls";
import { sinceLong } from "../model";
import { cromoStart, cromosMeta, cromosOfData, cromoWords } from "../cromosModel";
import type { PlaceProps } from "./types";
import { albumWords, headOf, porraWords, roadMeta, roadOf, scaleOf, wallOf, whysOf } from "./vitrinaView";
import { VIc } from "./vitrina/icons";

export function Vitrina(p: PlaceProps) {
  const { me, who, data } = p;
  const player = who.kind === "jugador";
  const pack = data.ficha.state === "pendiente";
  const head = headOf(who.kind, me.tier, pack);
  const cromos = player ? cromosOfData(data, p.now) : null;
  const pid = player ? data.ficha.playerId : null;
  const { matches, players } = data.raw;
  const seasonId = data.seasonId;
  const album = useMemo(() => {
    if (!pid) return null;
    const ids = players.filter((x) => x.seasons?.includes(seasonId)).map((x) => x.id);
    return albumOf(pid, matches, ids, seasonId);
  }, [pid, matches, players, seasonId]);
  const open = (o: "compartir" | "cromos", at = 0) => {
    if (o === "cromos") cromoStart.set(at);
    p.go({ page: "perfil", sec: "vitrina", aj: null, open: o });
  };

  return (
    <section className="tc-vi" aria-labelledby="tc-vi-h">
      <header className="tc-head">
        <div className="tc-head__t">
          <p className="tc-kick">Tu vitrina</p>
          <h2 className="nx-h2" id="tc-vi-h">
            {head.title}
          </h2>
          <p className="nx-sub">{head.sub}</p>
        </div>
        <div className="tk-head__acts">
          <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => open("compartir")}>
            <VIc name="share" />
            {head.share}
          </button>
          {cromos && (
            <button type="button" className="vd-glass vd-press nx-btn" onClick={() => open("cromos")}>
              Ver tus cromos
            </button>
          )}
        </div>
      </header>

      {player ? <PlayerVitrina {...p} cromos={cromos} album={album} onCromo={(i) => open("cromos", i)} /> : who.kind === "socio" ? <SocioVitrina {...p} /> : <NuevoVitrina {...p} pack={pack} />}
    </section>
  );
}

function PlayerVitrina(p: PlaceProps & { cromos: ReturnType<typeof cromosOfData>; album: ReturnType<typeof albumOf> | null; onCromo: (i: number) => void }) {
  const { me, cromos, album } = p;
  const scale = scaleOf(me.tier);
  const road = roadOf(me);
  const why = whysOf(me, p.data.card.tierWhy);
  const shelves = wallOf(me.rewards);
  const model = p.card.model;
  return (
    <>
      <section aria-labelledby="tc-road-h">
        <div className="nx-sec__head">
          <h3 className="nx-h3" id="tc-road-h">
            El camino · Bronce, Plata, Oro
          </h3>
          <p className="nx-meta">{roadMeta(me.rewards)}</p>
        </div>
        <div className={`tc-scale${scale ? "" : " is-empty"}`} role="img" aria-label={scale ? scale.aria : `Aún sin valoración. Plata empieza en ${me.tier.plata} y Oro en ${me.tier.oro}.`}>
          {scale && (
            <div className="tc-scale__you" style={{ left: `${scale.left}%` }}>
              <span className={`tc-mini ${tierCls(model)}`} aria-hidden="true">
                <b>{me.tier.rating}</b>
                <Shirt num={model.kind === "face" ? model.num : undefined} className="tc-mini__shirt" />
              </span>
              <span className="tc-scale__lbl">Tú, hoy</span>
            </div>
          )}
          <div className="tc-scale__bar" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="tc-scale__labs" aria-hidden="true">
            <span>
              <b>Bronce</b>menos de {me.tier.plata}
            </span>
            <span>
              <b>Plata</b>
              {me.tier.plata}–{me.tier.oro - 1}
            </span>
            <span>
              <b>Oro</b>
              {me.tier.oro} o más
            </span>
          </div>
        </div>
        <ol className="tc-road" aria-label="Las paradas de tu camino">
          {road.map((s) => (
            <li key={s.key} className={`tc-st ${s.cls}`}>
              <span className="tc-st__dot" aria-hidden="true">
                <VIc name={s.icon} />
              </span>
              <span className="tc-st__t">
                <b>{s.t}</b>
                {s.s && <span>{s.s}</span>}
                {s.bar && (
                  <span className="tc-bar" role="img" aria-label={s.bar.aria}>
                    <i style={{ width: `${s.bar.pct}%` }} />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
        <div className="tc-whys">
          <div>
            <h3>{why.whyH}</h3>
            <p>{why.whyT}</p>
          </div>
          <div>
            <h3>{why.upH}</h3>
            <p>{why.upT}</p>
          </div>
        </div>
        <ul className="tc-tiers" aria-label="Tipos de carta">
          {me.tier.tiers.map((t) => (
            <li key={t.k} className={`tc-tier${t.mine ? " is-mine" : ""}`}>
              <b>{t.label}</b>
              {t.rule}
              {t.mine && <span className="tc-pill">La tuya</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="nx-sec" aria-labelledby="tc-wall-h">
        <div className="nx-sec__head">
          <h3 className="nx-h3" id="tc-wall-h">
            La vitrina
          </h3>
          <p className="nx-meta">Evoluciones, logros, MVP y récords: un solo sistema. Ninguno suma puntos a tu valoración.</p>
        </div>
        <div className="tc-wall">
          {shelves.map((sh) => (
            <section key={sh.key} className="tc-shelf" aria-labelledby={`tc-shelf-${sh.key}`}>
              <div className="tc-shelf__h">
                <h3 id={`tc-shelf-${sh.key}`}>{sh.t}</h3>
                <p className="nx-meta">{sh.meta}</p>
              </div>
              {sh.items.length ? (
                <ul className="tc-pcs">
                  {sh.items.map((x) => (
                    <li key={x.key} className={`tc-pc ${x.cls}`}>
                      <span className="tc-pc__obj" aria-hidden="true">
                        <VIc name={x.icon} />
                      </span>
                      <small>
                        {x.kind}
                        <span className="nx-vh">{sh.key === "ganadas" ? ", ganada:" : ", por ganar:"}</span>
                      </small>
                      <b>{x.t}</b>
                      <span className="tc-pc__s">{x.s}</span>
                      {x.bar && (
                        <span className="tc-bar" role="img" aria-label={x.bar.aria}>
                          <i style={{ width: `${x.bar.pct}%` }} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tv-shelf__empty">{sh.empty}</p>
              )}
            </section>
          ))}
        </div>
      </section>

      <section className="nx-sec" aria-labelledby="tc-story-h">
        <div className="nx-sec__head">
          <h3 className="nx-h3" id="tc-story-h">
            Tu temporada en cromos
          </h3>
          <p className="nx-meta">{cromos ? cromosMeta(cromos) : "Tus cromos salen con tu primer partido de la temporada."}</p>
        </div>
        {cromos && (
          <ul className="tc-cromos" aria-label="Tus cromos">
            {cromos.cards.map((c, i) => {
              const w = cromoWords(c, cromos.closed);
              return (
                <li key={`${c.kind}-${i}`}>
                  <button type="button" className={`tc-cr${w.gold ? " is-gold" : ""}`} onClick={() => p.onCromo(i)} aria-label={`Cromo ${i + 1} de ${cromos.cards.length}: ${w.k}, ${w.t}. Abrir`}>
                    <small>{w.k}</small>
                    <b>{w.t}</b>
                    <span>{w.s}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {album && album.total > 0 && (
          <div className="tv-album">
            <span className="tv-album__ic" aria-hidden="true">
              <VIc name="album" />
            </span>
            <p>
              <b>Tu álbum: {albumWords(album.owned.length, album.total)} cromos</b>
              <span>{albumLine(album, [])}</span>
            </p>
            <Link to="/plantilla/album" className="vd-glass vd-press nx-btn">
              Abrir el álbum
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

function SocioVitrina(p: PlaceProps) {
  const porra = porraWords(p.data.stuff.porra);
  const since = p.data.access.sinceText;
  return (
    <>
      <div className="tc-whys">
        <div>
          <h3>Tu carné</h3>
          <p>{since && since !== "—" ? `Socio desde ${sinceLong(since)}. ` : ""}Lo compartes como póster «Nuevo socio» desde el estudio, con el escudo del club.</p>
        </div>
        <div>
          <h3>Tu recorrido en la porra</h3>
          <p>{porra ?? "Aún no has jugado la porra esta temporada: tu primer pronóstico la estrena."}</p>
        </div>
      </div>
      <div className="tk-empty tv-wait">
        <h3>Tu carta te espera</h3>
        <p>Cuando tengas ficha, aquí sale tu camino de Bronce a Oro y la vitrina con cada cosa que ganes, con el partido que te la dio.</p>
        <div className="tk-acts">
          <Link to="/vestuario/ficha" className="vd-glass vd-press nx-btn">
            Elegir mi ficha
          </Link>
        </div>
      </div>
    </>
  );
}

function NuevoVitrina(p: PlaceProps & { pack: boolean }) {
  const porra = porraWords(p.data.stuff.porra);
  return (
    <>
      <div className="tc-whys">
        <div>
          <h3>{p.pack ? "Tu sobre" : "Tu ficha"}</h3>
          <p>{p.pack ? "Tu petición está con el capitán. En cuanto la acepte, el sobre se abre y tu carta sale con su metal: Bronce, Plata u Oro." : "El capitán no aceptó esa ficha: elige otra y, cuando la acepte, tu carta sale aquí."}</p>
        </div>
        <div>
          <h3>Tu recorrido en la porra</h3>
          <p>{porra ?? "Aún no has jugado la porra esta temporada: tu primer pronóstico la estrena."}</p>
        </div>
      </div>
      <div className="tk-empty tv-wait">
        <h3>Lo que guardará</h3>
        <p>El camino de Bronce a Oro con tus próximas paradas, las evoluciones y los logros que ganes (cada uno con el partido que te lo dio), tus MVP y tu temporada en cromos.</p>
        <div className="tk-acts">
          {p.pack ? (
            <button type="button" className="vd-glass vd-press nx-btn" onClick={() => p.go({ page: "perfil", sec: "tu", aj: null, open: null })}>
              Ver mi petición
            </button>
          ) : (
            <Link to="/vestuario/ficha" className="vd-glass vd-press nx-btn">
              Elegir otra ficha
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
