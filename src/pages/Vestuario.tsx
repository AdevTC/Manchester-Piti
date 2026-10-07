import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { doc, onSnapshot, collection } from "firebase/firestore";
import { ArrowUpRight, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTeam } from "../context/TeamContext";
import { db } from "../firebase";
import { apiError } from "../lib/clubApi";
import { useMe, voteMvp } from "./vestuario/writes";
import {
  useClubData,
  playerName,
  formatDate,
  type ClubMatch,
} from "../lib/clubData";
import { useClock } from "../hooks/useClock";
import "../styles/analytics.css";

export function MvpVote({ match }: { match: ClubMatch }) {
  const { member } = useTeam();
  const { user, profile } = useAuth();
  const { players } = useClubData();
  const now = useClock();
  const isAdmin =
    member && ["admin", "superadmin"].includes(profile?.role ?? "");
  const [voters, setVoters] = useState<
    { id: string; voterName: string; playerId: string }[]
  >([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selection, setSelection] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const me = useMe();
  useEffect(
    () =>
      onSnapshot(
        doc(db, "mvpResults", match.id),
        (s) => setCounts(s.data()?.counts ?? {}),
        () => {},
      ),
    [match.id],
  );
  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(
      collection(db, "matches", match.id, "votes"),
      (s) =>
        setVoters(
          s.docs.map(
            (d) =>
              ({ id: d.id, ...d.data() }) as {
                id: string;
                voterName: string;
                playerId: string;
              },
          ),
        ),
      () => {},
    );
  }, [isAdmin, match.id]);
  useEffect(() => {
    if (!member || !user) return;
    return onSnapshot(
      doc(db, "matches", match.id, "votes", user.uid),
      (s) => {
        setSaved(s.data()?.playerId ?? "");
        setSelection(s.data()?.playerId ?? "");
      },
      () => {},
    );
  }, [member, user, match.id]);
  const candidates = players.filter((p) => match.ledger?.[p.id]?.played);
  const open = match.status === "finished" && (match.voteClosesAt ?? 0) > now;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  // Written straight to Firestore: "tu voto" updates at once, the tally follows in realtime.
  const vote = () => {
    if (!me) return;
    setError("");
    voteMvp(me, match.id, selection).catch((e: unknown) => setError(apiError(e)));
  };
  if (!match.voteClosesAt) return null;
  return (
    <section className="club-panel club-mvp">
      <span className="club-kicker">
        <Trophy size={16} /> EL MVP DEL VESTUARIO
      </span>
      <h2>¿Quién se salió?</h2>
      <p>
        {open
          ? `Votación abierta hasta ${formatDate(match.voteClosesAt, true)}.`
          : "Votación cerrada."}{" "}
        Un voto por cuenta del equipo.
      </p>
      <div className="club-vote-list">
        {candidates
          .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
          .map((p) => (
            <label key={p.id}>
              <input
                type="radio"
                name={`mvp-${match.id}`}
                value={p.id}
                checked={selection === p.id}
                disabled={!open || !member}
                onChange={() => setSelection(p.id)}
              />
              <span>
                {playerName(p)}
                <i
                  style={{
                    width: `${total ? ((counts[p.id] ?? 0) / total) * 100 : 0}%`,
                  }}
                />
              </span>
              <b>{counts[p.id] ?? 0}</b>
            </label>
          ))}
      </div>
      {error && (
        <p className="club-error" role="alert">
          {error}
        </p>
      )}
      {open &&
        (member ? (
          <button
            className="club-button"
            disabled={!selection || saved === selection}
            onClick={vote}
          >
            {saved === selection && saved
              ? "Voto guardado"
              : saved
                ? "Cambiar mi voto"
                : "Votar al MVP"}
          </button>
        ) : (
          <Link to="/vestuario" className="club-button">
            Entra al vestuario para votar <ArrowUpRight size={16} />
          </Link>
        ))}
      <p className="club-muted">
        {total} {total === 1 ? "voto del equipo" : "votos del equipo"}
      </p>
      {isAdmin && voters.length > 0 && (
        <details>
          <summary>Ver quién ha votado · Solo administradores</summary>
          <div className="club-response-list">
            {voters.map((v) => (
              <span key={v.id}>
                {v.voterName}
                <b>{playerName(players.find((p) => p.id === v.playerId))}</b>
              </span>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
