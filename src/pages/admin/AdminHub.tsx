import { getRouteApi } from "@tanstack/react-router";
import { Admin } from "../Admin";
import { MatchEditor } from "./MatchEditor";
import { PlayerClaims } from "./PlayerClaims";
export function AdminHub() {
  const { tab } = getRouteApi("/admin").useSearch();
  return tab === "matches" ? (
    <>
      <div className="club-page">
        <PlayerClaims pendingOnly />
      </div>
      <MatchEditor />
    </>
  ) : (
    <div className="club-page">
      <Admin />
      <PlayerClaims />
    </div>
  );
}
