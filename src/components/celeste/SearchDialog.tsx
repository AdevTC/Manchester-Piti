// «Buscar»'s data and destinations: what the pages already hold (useClubData, the seasons; a member without a ficha
// also his own request), turned into what this viewer can find (searchModel buildEntries · seasonData), the season's
// printed shirts for the players (usePageKitStills, home kit), and, once chosen, where it leads: a typed navigation
// (replacing /buscar on the phone, so «atrás» goes back past it), «Tú» or «Entrar» (the header's account control),
// or the theme. Loaded only when the search first opens (SearchLauncher) or at /buscar (BuscarPage).
import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { nextFixture, useClubData } from "../../lib/clubData";
import { useSeason } from "../../context/SeasonContext";
import { useAuth } from "../../context/AuthContext";
import { usePublishedViewer } from "../../hooks/viewerSignal";
import { useTheme } from "../../hooks/useTheme";
import { currentSeasonId } from "../../lib/vestuario";
import { voteMatch } from "../../lib/derived/island";
import { jornadaOf } from "../../lib/derived/jornada";
import { useMyClaim } from "../../pages/vestuario/live";
import { usePageKitStills } from "../jersey3d/usePageKitStills";
import { KitStillContext } from "../jersey3d/kitStill";
import { readTuMaqueta } from "../vidrio/tu/maqueta";
import { buildEntries, closesText, searchViewer, seasonData, type SrEntry, type SrScope } from "./searchModel";
import { SearchPanel } from "./SearchPanel";

export interface SearchDialogProps {
  /** Close it: `refocus` false when a result was chosen (the page is on its way there). */
  onClose: (refocus?: boolean) => void;
  /** /buscar: the whole screen, results replace the address. */
  page?: boolean;
  initial?: { q: string; scope: SrScope };
  onState?: (s: { q: string; scope: SrScope }) => void;
}

/** What the last desktop opening left (the board keeps the field between openings). */
let last: { q: string; scope: SrScope } = { q: "", scope: "todo" };

/** «Tú» / «Entrar» is the header's account control: once the page under the search is back, press it (else go to
 *  `href`, the vestuario's door). */
function openAccount(fallback: () => void) {
  let tries = 0;
  const tick = () => {
    const el = document.querySelector<HTMLElement>("header.vx-top :is(.vd-acct,.tu-acct)");
    if (el) el.click();
    else if (++tries < 30) window.setTimeout(tick, 100);
    else fallback();
  };
  window.setTimeout(tick, 80);
}

/** After a move, show the block `id` once the new screen has drawn it («Al calendario»: #tu-cal). */
function showBlock(id: string) {
  let tries = 0;
  const tick = () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
    else if (++tries < 30) window.setTimeout(tick, 100);
  };
  window.setTimeout(tick, 120);
}

export function SearchDialog({ onClose, page, initial, onState }: SearchDialogProps) {
  const { matches, players } = useClubData();
  const { seasons } = useSeason();
  const { user } = useAuth();
  const published = usePublishedViewer();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [maq] = useState(() => readTuMaqueta()?.quien ?? null);
  const claim = useMyClaim(!maq && published.member && !published.playerId ? user?.uid : undefined);
  const viewer = searchViewer(published, claim.data?.status, maq);
  const seasonId = currentSeasonId(nextFixture(matches, now), matches, seasons);

  const data = useMemo(() => seasonData({ matches, players, seasonId, now }), [matches, players, seasonId, now]);
  const vote = useMemo(() => {
    const m = voteMatch(matches, now);
    return m ? { matchId: m.id, j: jornadaOf(matches, m.id), rival: m.rival?.trim() || "el rival", closes: closesText(typeof m.voteClosesAt === "number" ? m.voteClosesAt : NaN) } : null;
  }, [matches, now]);
  const { kind, captain } = viewer;
  const entries = useMemo(() => buildEntries({ viewer: { kind, captain }, dia: theme === "light", players: data.players, games: data.games, next: data.next, vote }), [kind, captain, theme, data, vote]);
  const stills = usePageKitStills({ on: true, theme, kits: ["home"], players: data.players.map((p) => ({ name: p.shirt, num: p.num })) });

  const choose = (e: SrEntry) => {
    const g = e.go;
    if (g.to === "theme") {
      onClose(true);
      toggle();
      return;
    }
    if (g.to === "account") {
      onClose(!!page);
      openAccount(() => void router.navigate({ href: g.href }));
      return;
    }
    onClose(false);
    void router.navigate({ href: g.href, replace: !!page }).then(() => {
      if (g.anchor) showBlock(g.anchor);
    });
  };

  return (
    <KitStillContext.Provider value={stills}>
      <SearchPanel
        entries={entries}
        viewer={kind}
        page={page}
        initial={page ? initial : last}
        onState={(s) => {
          if (page) onState?.(s);
          else last = s;
        }}
        onChoose={choose}
        onClose={() => onClose(true)}
      />
    </KitStillContext.Provider>
  );
}
