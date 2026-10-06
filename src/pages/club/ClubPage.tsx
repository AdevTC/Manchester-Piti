// El club (Celeste · "elegida"): the crest in its vitrina, the team photo as a cinema band, the story,
// the trophy room, the kits' dressing room, the history train, the squad in numbers, the ground on a
// night map with the next match, the gallery, the classified ads to get in touch and the sponsors.
// From the Design canvas "El club · elegida"; pure logic in lib/club.ts (+ clubMedals in lib/home.ts).
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useClubContent } from "../../lib/clubContent";
import { formatDate, nextFixture, playerForSeason, playerName, useClubData } from "../../lib/clubData";
import { clubMedals, playerLines, seasonPulse, type SquadMember } from "../../lib/home";
import { currentSeasonId } from "../../lib/vestuario";
import { classifieds, historyTrain, mapsUrl, mailto, sponsorWall, squadNumbers } from "../../lib/club";
import { useSeason } from "../../context/SeasonContext";
import { useClock } from "../../hooks/useClock";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon, type IconName } from "../../components/celeste/icons";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { Jersey3D, type Jersey3DRef } from "../../components/jersey3d/Jersey3D";
import { Vitrina } from "./Vitrina";
import "../../styles/home.css";
import "../../styles/partidos.css";
import "../../styles/stats.css";
import "../../styles/club-celeste.css";

const origin = () => (typeof location === "undefined" ? "" : location.origin);
const KITS = {
  home: { label: "1ª equipación", note: "Celeste de la casa, con el oro en el cuello y el bajo.", swatches: [["Celeste", "#8AC8F5"], ["Tinta", "#051330"], ["Oro", "#CFA862"]] },
  away: { label: "2ª equipación", note: "Negra de fuera, con la franja roja en diagonal.", swatches: [["Noche", "#1D1D22"], ["Tiza", "#F5F5F5"], ["Rojo", "#D6161F"]] },
} as const;
const MEDAL_ICON: Record<string, IconName> = { debut: "shirt", goal: "ball", win: "trophy", pichichi: "crown", assist: "send", record: "flame" };
const ZONE_LABEL = { POR: "Porteros", DEF: "Defensas", MED: "Medios", DEL: "Delanteros" } as const;

function Head({ kick, title, id, isNew, children }: { kick: string; title: string; id: string; isNew?: boolean; children?: React.ReactNode }) {
  return (
    <div className="cl-hd">
      <span className="hm-kick" style={{ margin: 0 }}>
        {kick} {isNew && <span className="st-new">nuevo</span>}
      </span>
      <h2 className="cl-h2" id={id}>
        {title}
      </h2>
      {children}
    </div>
  );
}

export function ClubPage() {
  const c = useClubContent();
  const { matches, players, loading } = useClubData();
  const { seasons } = useSeason();
  const now = useClock(60_000);
  const theme = useDocumentTheme();
  const [kit, setKit] = useState<"home" | "away">("home");
  const shirt = useRef<Jersey3DRef>(null);
  const [photo, setPhoto] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const train = useRef<HTMLOListElement>(null);

  const next = nextFixture(matches, now);
  const seasonId = currentSeasonId(next, matches, seasons);
  const season = seasons.find((s) => s.id === seasonId);
  const inSeason = players.filter((p) => p.seasons?.includes(seasonId)).map((p) => playerForSeason(p, seasonId, seasons));
  const squad: SquadMember[] = inSeason.map((p) => ({ id: p.id, name: playerName(p), num: p.number != null ? String(p.number) : "" }));
  const pulse = seasonPulse(matches, seasonId, now);
  const lines = playerLines(squad, pulse.played);
  const nameOf = (id: string) => lines.find((l) => l.id === id)?.name ?? playerName(players.find((p) => p.id === id));
  const medals = clubMedals(pulse, lines, nameOf, (d) => formatDate(d).replace(/^[^,]*,\s*/, ""));
  const won = medals.filter((m) => m.earned).length;
  const stops = historyTrain(c.milestones, matches);
  const nums = squadNumbers(inSeason, new Date(now));
  const captain = season?.captainPlayerId ? nameOf(season.captainPlayerId) : null;
  const ads = classifieds(c.email ?? "");
  const sponsors = sponsorWall(c.sponsors);
  const gallery = (c.gallery ?? []).filter((g) => g && /^https:\/\//.test(g.url ?? ""));
  const faq = (c.faq ?? []).filter((f) => f && f.q?.trim() && f.a?.trim());
  const nextWhen = next ? formatDate(next.date) : "";

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (photo !== null && !d.open) d.showModal();
    if (photo === null && d.open) d.close();
  }, [photo]);

  const share = async () => {
    const url = `${origin()}/club`;
    try {
      if (typeof navigator.share === "function") await navigator.share({ title: "Manchester Piti · El club", url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice("Enlace copiado. Pásalo al grupo.");
      }
    } catch {
      setNotice("");
    }
  };
  const slide = (dir: 1 | -1) => train.current?.scrollBy({ left: dir * Math.max(240, (train.current.clientWidth || 300) * 0.8), behavior: "smooth" });

  return (
    <div className="vx hm st cl" aria-busy={loading}>
      <CelesteBackdrop />
      <CelesteHeader
        active="club"
        sub="El club"
        actions={
          <>
            <ThemeToggle />
            <Link className="hm-cta-top" to="/vestuario">
              <Icon name="padlock" size={16} stroke={2.2} />
              <span className="t">Vestuario</span>
              <span className="hm-sr">Entrar al vestuario</span>
            </Link>
          </>
        }
      />

      <section className="cl-hero" aria-labelledby="cl-t">
        <div className="st-stars" aria-hidden="true" />
        <div className="cl-hero-in">
          <div className="cl-intro pt-rise">
            <span className="hm-kick" style={{ margin: 0 }}>
              ESTO ES MANCHESTER PITI
            </span>
            <h1 className="cl-h1" id="cl-t">
              El club
            </h1>
            <p className="cl-lead">{c.intro}</p>
            <dl className="cl-placard">
              <div>
                <dt>Desde</dt>
                <dd className={c.founded ? undefined : "gap"}>{c.founded || "año por publicar"}</dd>
              </div>
              <div>
                <dt>Dónde</dt>
                <dd className={c.location ? undefined : "gap"}>{c.location || "localidad por publicar"}</dd>
              </div>
              <div className="sw">
                <dt>Colores</dt>
                <dd>
                  <i style={{ background: "#6CABDD" }} title="Celeste #6CABDD" />
                  <i style={{ background: "#0C1733" }} title="Marino #0C1733" />
                  <i style={{ background: "#FFC659" }} title="Oro #FFC659" />
                  <span className="hm-sr">Celeste, marino y oro</span>
                </dd>
              </div>
            </dl>
            <div className="cl-acts">
              <button type="button" className="hm-btn cl-share" onClick={() => void share()}>
                <Icon name="share" size={16} stroke={2.2} />
                Compartir el club
              </button>
              <Link className="hm-ghostbtn st-sm" to="/partidos">
                Ver los partidos
              </Link>
            </div>
            {notice && (
              <p className="st-mono" role="status">
                {notice}
              </p>
            )}
          </div>
          <Vitrina />
        </div>
      </section>

      <main className="cl-main">
        <section className="cl-band" aria-label="Foto de equipo">
          {c.photoUrl ? (
            <img src={c.photoUrl} alt="Foto de equipo del Manchester Piti" loading="lazy" />
          ) : (
            <div className="cl-band-empty">
              <img src="/crest-128.webp" alt="" width="72" height="72" />
              <span>La próxima foto de equipo va aquí</span>
            </div>
          )}
          <i className="bars" aria-hidden="true" />
        </section>

        <section className="cl-story" aria-labelledby="cl-story">
          <Head kick="Quiénes somos" title="Manchester Piti" id="cl-story" />
          <p className="cl-copy">{c.story}</p>
          <p className="cl-meta">
            {c.founded && <span>Desde {c.founded}</span>}
            {c.location && (
              <span>
                <Icon name="flag" size={15} /> {c.location}
              </span>
            )}
          </p>
          {c.crestStory?.trim() && (
            <aside className="cl-crest-story" aria-labelledby="cl-crest">
              <img src="/crest-128.webp" alt="" width="56" height="56" />
              <div>
                <h3 id="cl-crest">
                  La historia del escudo <span className="st-new">nuevo</span>
                </h3>
                <p className="cl-copy sm">{c.crestStory}</p>
              </div>
            </aside>
          )}
        </section>

        <section className="cl-sec" aria-labelledby="cl-trophies">
          <Head kick={`${season?.name ?? "La temporada"} · ${won} de ${medals.length}`} title="La sala de trofeos" id="cl-trophies" isNew>
            <p className="st-mono">Se ilumina sola a medida que llegan los primeros goles, victorias y récords.</p>
          </Head>
          <ul className="cl-trophies">
            {medals.map((m, i) => (
              <li key={m.id} className={`${m.earned ? "on" : "off"} ${m.tone}`} style={{ animationDelay: `${i * 0.08}s` }}>
                <span className="cup" aria-hidden="true">
                  <Icon name={MEDAL_ICON[m.id] ?? "trophy"} size={30} />
                </span>
                <span className="ped" aria-hidden="true" />
                <small>{m.kicker}</small>
                <b>{m.title}</b>
                <span className="det">{m.detail}</span>
                <span className={`state${m.earned ? " won" : ""}`}>
                  <Icon name={m.earned ? "check" : "lock"} size={13} stroke={2.4} />
                  {m.earned ? "Conseguido" : "Por conseguir"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="cl-sec cl-kits" aria-labelledby="cl-kits">
          <div className="cl-kit-stage">
            <i className="floor" aria-hidden="true" />
            <Jersey3D ref={shirt} className="cl-kit3d" kit={kit} theme={theme} name="PITI" num="1" view="front" zoom={0.95} lift={0.12} label={`${KITS[kit].label} del Manchester Piti. Arrástrala o usa las flechas para girarla.`} />
          </div>
          <div className="cl-kit-copy">
            <Head kick="El vestidor" title="Las equipaciones" id="cl-kits" isNew />
            <div className="st-seg" role="group" aria-label="Equipación">
              {(["home", "away"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={kit === k} onClick={() => setKit(k)}>
                  {KITS[k].label}
                </button>
              ))}
            </div>
            <p className="cl-copy sm">{KITS[kit].note}</p>
            <ul className="cl-swatches" key={kit}>
              {KITS[kit].swatches.map(([n, hex], i) => (
                <li key={hex} style={{ animationDelay: `${i * 0.08}s` }}>
                  <i style={{ background: hex }} />
                  <b>{n}</b>
                  <small>{hex}</small>
                </li>
              ))}
            </ul>
            <button type="button" className="hm-ghostbtn st-sm" onClick={() => shirt.current?.turn()}>
              <Icon name="turn" size={16} />
              Darle la vuelta
            </button>
          </div>
        </section>

        <section className="cl-sec" aria-labelledby="cl-history">
          <Head kick="Del primer balón a hoy" title="Historia del equipo" id="cl-history" />
          {stops.length ? (
            <div className="cl-train-wrap">
              <ol className="cl-train" ref={train} tabIndex={0} aria-label="Momentos del club, desliza para recorrerlos">
                {stops.map((s, i) => (
                  <li key={s.key} className={s.match ? "ticket" : undefined} style={{ animationDelay: `${i * 0.07}s` }}>
                    <span className="yr">{s.year || "—"}</span>
                    <b>{s.title}</b>
                    {s.match ? (
                      <>
                        <span className="tk">
                          {formatDate(s.match.date)} · Manchester Piti {s.match.goalsFor}–{s.match.goalsAgainst} {s.match.rival ?? "Rival"}
                        </span>
                        <Link to="/matches/$matchId" params={{ matchId: s.match.id }}>
                          Ver partido →
                        </Link>
                      </>
                    ) : (
                      s.text && <p>{s.text}</p>
                    )}
                  </li>
                ))}
              </ol>
              {stops.length > 1 && (
                <div className="cl-train-nav">
                  <button type="button" className="cl-iconbtn" aria-label="Momento anterior" onClick={() => slide(-1)}>
                    <Icon name="left" size={18} stroke={2.2} />
                  </button>
                  <button type="button" className="cl-iconbtn" aria-label="Momento siguiente" onClick={() => slide(1)}>
                    <Icon name="right" size={18} stroke={2.2} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="st-empty">La historia del equipo se actualizará aquí.</p>
          )}
        </section>

        <section className="cl-sec" aria-labelledby="cl-nums">
          <Head kick={season?.name ?? "La plantilla"} title="La plantilla en números" id="cl-nums" isNew />
          <dl className="cl-nums">
            <div className="big">
              <dt>Jugadores</dt>
              <dd>{nums.size}</dd>
            </div>
            {(Object.keys(ZONE_LABEL) as (keyof typeof ZONE_LABEL)[]).map((z) => (
              <div key={z}>
                <dt>{ZONE_LABEL[z]}</dt>
                <dd>
                  {nums.byZone[z]}
                  <span className="dots" aria-hidden="true">
                    {Array.from({ length: nums.byZone[z] }, (_, i) => (
                      <i key={i} style={{ animationDelay: `${i * 0.05}s` }} />
                    ))}
                  </span>
                </dd>
              </div>
            ))}
            <div>
              <dt>Edad media</dt>
              <dd className={nums.averageAge === null ? "gap" : undefined}>{nums.averageAge === null ? "por publicar" : String(nums.averageAge).replace(".", ",")}</dd>
            </div>
            <div>
              <dt>Capitán</dt>
              <dd className={captain ? "name" : "gap"}>{captain ?? "por elegir"}</dd>
            </div>
            <div>
              <dt>Temporadas</dt>
              <dd>{seasons.length}</dd>
            </div>
          </dl>
          {nums.other > 0 && <p className="st-mono">{nums.other === 1 ? "1 jugador" : `${nums.other} jugadores`} aún sin posición en su ficha.</p>}
        </section>

        <section className="cl-sec cl-barrio" aria-labelledby="cl-ground">
          <div className="cl-map" aria-hidden="true">
            <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice">
              <path className="blk" d="M0 40h120v70H0zM150 0h90v90h-90zM270 30h130v60H270zM0 150h90v130H0zM120 140h110v60H120zM260 130h140v150H260zM120 230h110v50H120z" />
              <path className="st" d="M0 125h400M135 0v280M250 0v280M0 215h250" />
              <path className="route" pathLength={1} d="M20 260 C 60 220, 90 215, 135 205 S 200 140, 200 125 S 240 118, 300 104" />
              <rect className="pitch" x="276" y="70" width="70" height="44" rx="4" />
              <path className="pitch" d="M311 70v44" />
            </svg>
            <span className="pin" style={{ left: "75%", top: "37%" }}>
              <i />
            </span>
          </div>
          <div className="cl-ground-copy">
            <Head kick="El barrio" title="Nuestro campo" id="cl-ground" />
            <p className={`cl-venue${c.venue ? "" : " gap"}`}>{c.venue || "Campo y dirección por publicar"}</p>
            {c.location && <p className="st-mono">{c.location}</p>}
            <div className="cl-acts">
              {c.venue && (
                <a className="hm-btn cl-go" href={mapsUrl(c.venue)} target="_blank" rel="noopener noreferrer">
                  Cómo llegar ↗
                </a>
              )}
              <AddToCalendar className="hm-ghostbtn st-sm" label="Calendario del club" feed={`${origin()}/calendario.ics`} />
            </div>
            <div className="cl-next">
              <span className="st-mono">Próximo partido</span>
              {next ? (
                <Link to="/matches/$matchId" params={{ matchId: next.id }}>
                  <b>{next.rival ?? "Rival"}</b>
                  <span>
                    {nextWhen} · {next.home === false ? "fuera" : "en casa"}
                  </span>
                </Link>
              ) : (
                <span className="gap">Fecha por publicar</span>
              )}
            </div>
          </div>
        </section>

        {gallery.length > 0 && (
          <section className="cl-sec" aria-labelledby="cl-gallery">
            <Head kick="Del vestuario al campo" title="Galería" id="cl-gallery" />
            <ul className="cl-gallery">
              {gallery.map((g, i) => (
                <li key={g.url + i}>
                  <button type="button" onClick={() => setPhoto(i)} aria-label={`Ampliar: ${g.caption || `foto ${i + 1}`}`}>
                    <img src={g.url} alt={g.caption || ""} loading="lazy" />
                  </button>
                  {g.caption && <span>{g.caption}</span>}
                </li>
              ))}
            </ul>
            <dialog ref={dialog} className="cl-lightbox" onClose={() => setPhoto(null)} aria-label="Foto ampliada">
              {photo !== null && gallery[photo] && (
                <figure>
                  <img src={gallery[photo].url} alt={gallery[photo].caption || ""} />
                  {gallery[photo].caption && <figcaption>{gallery[photo].caption}</figcaption>}
                </figure>
              )}
              <div className="cl-lb-nav">
                <button type="button" className="cl-iconbtn" aria-label="Foto anterior" onClick={() => setPhoto(((photo ?? 0) - 1 + gallery.length) % gallery.length)}>
                  <Icon name="left" size={18} stroke={2.2} />
                </button>
                <button type="button" className="hm-ghostbtn st-sm" onClick={() => setPhoto(null)}>
                  Cerrar
                </button>
                <button type="button" className="cl-iconbtn" aria-label="Foto siguiente" onClick={() => setPhoto(((photo ?? 0) + 1) % gallery.length)}>
                  <Icon name="right" size={18} stroke={2.2} />
                </button>
              </div>
            </dialog>
          </section>
        )}

        {faq.length > 0 && (
          <section className="cl-sec" aria-labelledby="cl-faq">
            <Head kick="Antes de escribirnos" title="Preguntas de vestuario" id="cl-faq" isNew />
            <div className="cl-faq">
              {faq.map((f, i) => (
                <details key={f.q + i} open={i === 0}>
                  <summary>
                    <span className="q">P.</span>
                    {f.q}
                    <Icon name="down" size={18} />
                  </summary>
                  <p>
                    <span className="q">R.</span>
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="cl-sec" aria-labelledby="cl-contact">
          <Head kick="Contacto" title="Clasificados" id="cl-contact">
            {!c.email && <p className="st-mono">Contacto del club pendiente de publicar.</p>}
          </Head>
          <ul className="cl-ads">
            {ads.map((a, i) => (
              <li key={a.id} style={{ animationDelay: `${i * 0.08}s` }}>
                <span className="wanted">{a.wanted}</span>
                <b>{a.title}</b>
                <p>{a.text}</p>
                <span className="fringe">
                  {a.href ? (
                    <a href={a.href}>
                      <Icon name="send" size={14} stroke={2.2} />
                      Hablemos
                    </a>
                  ) : (
                    <span className="pend">Pendiente</span>
                  )}
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                </span>
              </li>
            ))}
          </ul>
          {/^https:\/\//.test(c.instagram ?? "") && (
            <a className="cl-sticker" href={c.instagram} target="_blank" rel="noopener noreferrer">
              El Piti en Instagram ↗
            </a>
          )}
        </section>

        <section className="cl-sec" aria-labelledby="cl-sponsors">
          <Head kick="Nos apoyan" title="Patrocinadores" id="cl-sponsors" />
          <ul className="cl-sponsors">
            {sponsors.map((s) => (
              <li key={s.name}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.logo && <img src={s.logo} alt="" loading="lazy" />}
                    <b>{s.name}</b>
                  </a>
                ) : (
                  <span>
                    {s.logo && <img src={s.logo} alt="" loading="lazy" />}
                    <b>{s.name}</b>
                  </span>
                )}
              </li>
            ))}
            <li className="rent">
              <span className="st-new">nuevo</span>
              <b>Este hueco se alquila</b>
              <p>Tu marca en la camiseta, en la web y en el campo.</p>
              {c.email ? <a href={mailto(c.email, "Patrocinio")}>Escríbenos ↗</a> : <span className="st-mono">Correo por publicar</span>}
            </li>
          </ul>
        </section>
      </main>
      <CelesteFooter />
      <CelesteDock active="club" />
    </div>
  );
}

export default ClubPage;
