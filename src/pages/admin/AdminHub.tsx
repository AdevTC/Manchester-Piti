import { getRouteApi } from "@tanstack/react-router";
import { Admin } from "../Admin";
import { MatchEditor } from "./MatchEditor";
export function AdminHub() {
  const { tab } = getRouteApi("/admin").useSearch();
  return tab === "matches" ? (
    <MatchEditor />
  ) : (
    <div className="club-page">
      <Admin />
    </div>
  );
}
