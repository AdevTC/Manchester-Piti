// CLUB · la oficina del club (/admin/club, M-16; board part-club.html § oficina): one door per room, each with what
// it holds now and, when it asks for something, a word («Por pegar la J3», «Sin guardar», «2 sin leer»). Plus «La
// vitrina», the trophies won outside the league (in Temporadas).
import { useMemo } from "react";
import { VIcon, type VIconName } from "../../../../components/vidrio/VIcon";
import { useAuth } from "../../../../context/AuthContext";
import { useClubContent } from "../../../../lib/clubContent";
import { nameFor } from "../../../../lib/clubData";
import { readKits, readTrophies } from "../../../../lib/clubExtras";
import { jobShort } from "../../../../lib/derived/rota";
import { madridDate } from "../../../../lib/derived/absences";
import { plural } from "../../../../lib/derived/words";
import { useMatchTurns } from "../../../../lib/useRotaTurns";
import { useStandings } from "../../../../lib/useStandings";
import { useAbsences, useBoard, usePolls } from "../../../vestuario/live";
import { applyClub, contentIssues, pendingKeys, storyOf, storyWith } from "../../club/contentModel";
import { webMissCount } from "./webModel";
import { useContentDraftState } from "../../club/contentDraftStore";
import { ScreenError, ScreenLoading, SalaScreen } from "../../shell/Screen";
import { SalaLink } from "../../shell/SalaLink";
import { useAdmin } from "../../shell/context";
import { useFrame } from "../../ui/frame";
import { useHasDraft } from "./drafts";
import { useCaptainInbox } from "./inbox";
import { lastPublishedJornada, seasonJornadas, tableBehind } from "./model";
import { ROOMS, roomPath, useClubCommands, type RoomId } from "./rooms";
import "./club.css";

interface Door {
  id: RoomId | "vitrina";
  to: string;
  name: string;
  icon: VIconName;
  detail: string;
  tag: string;
}

/** What the office and the dock say about the club (shared with count.ts through its parts). */
function useClubDoors(): { doors: Door[]; asks: string[]; loading: boolean; error: boolean } {
  const data = useAdmin();
  const { user, profile } = useAuth();
  const season = data.season;
  const sid = season?.id ?? "";
  const content = useClubContent();
  const me = user ? { uid: user.uid, name: profile?.nickname ?? user.displayName ?? "" } : null;
  const web = useContentDraftState(me);
  const { standings } = useStandings(sid || undefined);
  const nextMatch = data.next?.match;
  const turns = useMatchTurns(nextMatch, data.published, !!nextMatch);
  const polls = usePolls(true);
  const board = useBoard(30);
  const absences = useAbsences(madridDate(data.now), true);
  const inbox = useCaptainInbox();
  const claDirty = useHasDraft(`cla:${sid}`);
  const turDirty = useHasDraft(`tur:${sid}`);

  return useMemo(() => {
    const js = sid ? seasonJornadas(data.matches, sid) : [];
    const pub = js.filter((m) => data.stateOf(m) === "published").length;
    const lastJ = sid ? lastPublishedJornada(data.matches, sid, data.stateOf) : null;
    const behind = tableBehind(standings, lastJ);
    const liveStory = (id: string) => storyOf(data.players.find((p) => p.id === id));
    const pending = pendingKeys(web.drafts, content, liveStory).length;
    // (the same count as the web room's line: each section's missing things and what blocks publishing)
    const cur = applyClub(content, web.drafts);
    const squad = data.players.filter((p) => (p.seasons ?? []).includes(sid));
    const withStory = squad.filter((p) => storyWith(web.drafts, p.id, storyOf(p)).bio.trim()).length;
    const gaps = webMissCount(cur, withStory, squad.length) + contentIssues(cur).length;
    const kits = readKits(content);
    const trophies = readTrophies(content);
    const nameOf = (id: string | null) => (id ? nameFor(data.players.find((p) => p.id === id), sid) : "");
    const turnLine = turns.rota?.jobs.length
      ? nextMatch && turns.turns.length
        ? `${nextMatch.jornada ? `J${nextMatch.jornada}` : "El próximo"}: ${turns.turns.map((t) => `${jobShort(t.job).toLowerCase()} ${nameOf(t.playerId) || "nadie"}`).join(" · ")}`
        : `${plural(turns.rota.jobs.length, "turno", "turnos")} · sin partidos por jugar`
      : "Sin turnos esta temporada";
    const openPolls = polls.data.filter((p) => !p.closedAt && p.closesAt > data.now).length;
    const ves = polls.data.length + board.data.length + absences.data.length;
    const detail: Record<RoomId, string> = {
      temporadas: season ? `${season.name} · ${season.archived ? "archivada" : js.length ? "activa" : "en preparación"} · ${pub} de ${js.length} jugadas` : "Ninguna temporada todavía",
      clasificacion: standings ? (standings.rows.some((r) => r.isUs) ? `${standings.rows.length} equipos · ${saysShort(standings)}` : `${plural(standings.rows.length, "equipo", "equipos")} · sin nuestra fila`) : "Sin tabla todavía",
      web: gaps || pending ? [gaps ? plural(gaps, "cosa por completar", "cosas por completar") : "", pending ? plural(pending, "cambio sin publicar", "cambios sin publicar") : ""].filter(Boolean).join(" · ") : "Todo completo y publicado",
      turnos: turnLine,
      vestuario: ves ? [plural(openPolls, "encuesta abierta", "encuestas abiertas"), plural(board.data.length, "mensaje", "mensajes"), plural(absences.data.length, "ausencia", "ausencias")].join(" · ") : "Nada que moderar en el vestuario",
      avisos: inbox.unread ? `${inbox.unread} sin leer` : inbox.list.length ? "Todo leído" : "Sin avisos todavía",
      equipaciones: kits.home.saved || kits.away.saved ? `1ª ${kits.home.colors[0]?.name.toLowerCase() ?? ""} · 2ª ${kits.away.colors[0]?.name.toLowerCase() ?? ""} · guardadas en la web` : `1ª ${kits.home.colors[0].name.toLowerCase()} · 2ª ${kits.away.colors[0].name.toLowerCase()} · las de siempre`,
    };
    const tag: Record<RoomId, string> = {
      temporadas: "",
      clasificacion: behind ? `Por pegar la J${behind.acta}` : claDirty ? "Sin guardar" : "",
      web: pending ? "Sin publicar" : "",
      turnos: turDirty ? "Sin guardar" : "",
      vestuario: "",
      avisos: inbox.unread ? `${inbox.unread} sin leer` : "",
      equipaciones: "",
    };
    const doors: Door[] = ROOMS.map((r) => ({ id: r.id, to: roomPath(r.id), name: r.name, icon: r.icon, detail: detail[r.id], tag: tag[r.id] }));
    doors.push({
      id: "vitrina",
      to: "/admin/club/temporadas",
      name: "La vitrina",
      icon: "star",
      detail: trophies.length ? `${plural(trophies.length, "trofeo", "trofeos")} fuera de la liga · el último, ${trophies[0].name}` : "Los trofeos de verdad, fuera de la liga · todavía ninguno",
      tag: "",
    });
    const asks = [inbox.unread ? plural(inbox.unread, "aviso sin leer", "avisos sin leer") : "", behind ? `la tabla de la J${behind.acta}` : ""].filter(Boolean);
    return { doors, asks, loading: data.loading, error: data.error };
  }, [data, sid, season, standings, web.drafts, content, turns, nextMatch, polls.data, board.data, absences.data, inbox, claDirty, turDirty]);
}

const saysShort = (s: { rows: { isUs: boolean; pts: number }[]; jornada: number | null }) => {
  const i = s.rows.findIndex((r) => r.isUs);
  return `vamos ${i + 1}.º · ${s.rows[i].pts} pts${s.jornada ? ` · J${s.jornada}` : ""}`;
};

export function OficinaScreen() {
  const { desktop } = useFrame();
  const data = useAdmin();
  const { doors, asks } = useClubDoors();
  useClubCommands();
  const line = asks.length ? `Pide algo: ${asks.join(" · ")}` : "Nada pendiente en el club";
  return (
    <SalaScreen
      className="cl cl-room"
      kicker="Club"
      title={<span className="sc-morph" style={{ viewTransitionName: "cl-office" }}>La oficina del club</span>}
      headTitle="Club"
      headSub="La oficina del club"
      lede={`Una puerta por sala, cada una con lo que tiene dentro · ${line}`}
      fit={desktop}
    >
      {data.loading ? (
        <ScreenLoading label="Cargando la oficina del club" />
      ) : data.error ? (
        <ScreenError what="la oficina del club" onRetry={() => window.location.reload()} />
      ) : (
        <ul className="cl-doors sc-scroll" aria-label="Las salas del club">
          {doors.map((d) => (
            <li key={d.id}>
              <SalaLink className="cl-door" to={d.to} aria-label={`${d.name}: ${d.detail}${d.tag ? ` · ${d.tag}` : ""}`}>
                <span className="cl-door__i vd-glass" aria-hidden="true">
                  <VIcon name={d.icon} size={19} />
                </span>
                <span className="cl-door__t">
                  <b>
                    <span className="sc-morph" style={{ viewTransitionName: d.id === "vitrina" ? "none" : `cl-door-${d.id}` }}>
                      {d.name}
                    </span>
                  </b>
                  <span>{d.detail}</span>
                </span>
                {d.tag ? (
                  <span className="sc-tag sc-tag--toca" aria-hidden="true">
                    {d.tag}
                  </span>
                ) : (
                  <span aria-hidden="true" />
                )}
                <VIcon name="chevR" size={18} className="cl-door__go" />
              </SalaLink>
            </li>
          ))}
        </ul>
      )}
    </SalaScreen>
  );
}
