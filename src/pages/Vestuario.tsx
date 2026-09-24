import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { doc, onSnapshot, collection } from "firebase/firestore";
import {
  ArrowUpRight,
  LockKeyhole,
  Check,
  LogOut,
  ClipboardList,
  Trophy,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTeam } from "../context/TeamContext";
import { db } from "../firebase";
import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { apiError, setAvailability, voteMvp } from "../lib/clubApi";
import {
  useClubData,
  nextFixture,
  playerName,
  formatDate,
  type ClubMatch,
} from "../lib/clubData";
import { useClock } from "../hooks/useClock";
import { Crest } from "../components/Crest";
import { NicknameSetup } from "./NicknameSetup";
import { FixtureCard, SectionTitle } from "../components/club/ClubUI";

export function TeamGate() {
  const { user, loading, loginWithGoogle, logout } = useAuth();
  const { unlock } = useTeam();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (user) {
        await unlock(password);
        setPassword("");
      } else await loginWithGoogle();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="club-gate">
      <div className="club-gate-art">
        <Crest size={120} />
        <h1>
          ÁREA DEL
          <br />
          <span>EQUIPO.</span>
        </h1>
        <p>Convocatorias, alineaciones y votaciones.</p>
        <div>
          <ClipboardList />
          La pizarra
          <Trophy />
          El MVP
          <CalendarDays />
          Convocatorias
        </div>
      </div>
      <div className="club-gate-form">
        <span className="club-kicker">
          <LockKeyhole size={16} /> ÁREA DEL EQUIPO
        </span>
        <h2>
          Bienvenido
          <br />
          al vestuario.
        </h2>
        <p>Identifícate con Google y utiliza la clave compartida del equipo.</p>
        <ol className="club-gate-steps">
          <li className={user ? "done" : "active"}>
            <b>{user ? <Check size={14} /> : "1"}</b>Tu cuenta de Google
          </li>
          <li className={user ? "active" : ""}>
            <b>2</b>La clave del equipo
          </li>
        </ol>
        <form onSubmit={submit}>
          {user ? (
            <>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={user.email || user.uid}
                readOnly
                hidden
              />
              <div className="club-identity">
                <ShieldCheck size={18} />
                <span>
                  {user.displayName || user.email}
                  <small>Identidad verificada con Google</small>
                </span>
              </div>
              <label className="club-field">
                Clave del vestuario
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="La clave que comparte el equipo"
                />
              </label>
            </>
          ) : null}
          {error && (
            <p className="club-error" role="alert">
              {error}
            </p>
          )}
          <button className="club-button" disabled={busy || loading}>
            {busy || loading
              ? "Un momento…"
              : user
                ? "Entrar al vestuario"
                : "Continuar con Google"}
            <ArrowUpRight size={18} />
          </button>
        </form>
        {import.meta.env.DEV &&
          import.meta.env.VITE_USE_FIREBASE_EMULATOR === "1" &&
          !user && (
            <button
              className="club-text-link"
              onClick={async () => {
                setError("");
                const encode = (v: object) =>
                  btoa(JSON.stringify(v))
                    .replace(/=/g, "")
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_");
                const token =
                  encode({ alg: "none", typ: "JWT" }) +
                  "." +
                  encode({
                    sub: "preview-admin",
                    email: "admin@piti.test",
                    email_verified: true,
                    name: "Administrador de pruebas",
                    aud: "demo",
                    iss: "https://accounts.google.com",
                  }) +
                  ".";
                try {
                  await signInWithCredential(
                    auth,
                    GoogleAuthProvider.credential(token),
                  );
                } catch (e) {
                  setError(apiError(e));
                }
              }}
            >
              Google de prueba · Solo emulador
            </button>
          )}
        {user && (
          <button className="club-text-link" onClick={() => void logout()}>
            Utilizar otra cuenta
          </button>
        )}
        <Link className="club-text-link" to="/">
          Volver a la web del club →
        </Link>
      </div>
    </section>
  );
}
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const vote = async () => {
    setBusy(true);
    setError("");
    try {
      await voteMvp({ matchId: match.id, playerId: selection });
      setSaved(selection);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
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
                disabled={!open || !member || busy}
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
            disabled={!selection || busy || saved === selection}
            onClick={vote}
          >
            {busy
              ? "Guardando…"
              : saved === selection && saved
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
function Availability({ match }: { match: ClubMatch }) {
  const { user } = useAuth();
  const [responses, setResponses] = useState<
    { id: string; name: string; response: string }[]
  >([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        collection(db, "matchPrivate", match.id, "availability"),
        (snap) =>
          setResponses(
            snap.docs.map(
              (d) =>
                ({ id: d.id, ...d.data() }) as {
                  id: string;
                  name: string;
                  response: string;
                },
            ),
          ),
        () => setError("No se han podido cargar las respuestas."),
      ),
    [match.id],
  );
  useEffect(
    () =>
      onSnapshot(
        doc(db, "matchPrivate", match.id),
        (snap) => setNote(snap.data()?.meetingNote ?? ""),
        () => {},
      ),
    [match.id],
  );
  const answer = responses.find((r) => r.id === user?.uid)?.response;
  const save = async (response: string) => {
    setBusy(true);
    setError("");
    try {
      await setAvailability({ matchId: match.id, response });
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="club-panel">
      <span className="club-kicker">NOS VEMOS EN EL CAMPO</span>
      <h2>¿Cuentan contigo?</h2>
      <p>
        Manchester Piti vs {match.rival} · {formatDate(match.date, true)}
      </p>
      {note && <blockquote>{note}</blockquote>}
      <div className="club-segments">
        {[
          ["yes", "Voy"],
          ["maybe", "Pendiente"],
          ["no", "No puedo"],
        ].map(([v, t]) => (
          <button
            disabled={busy}
            aria-pressed={answer === v}
            className={answer === v ? "active" : ""}
            onClick={() => void save(v)}
            key={v}
          >
            {t}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="club-error">
          {error}
        </p>
      )}
      <div className="club-response-list">
        {responses.map((r) => (
          <span key={r.id}>
            {r.name}
            <b>
              {r.response === "yes"
                ? "Voy"
                : r.response === "no"
                  ? "No puedo"
                  : "Pendiente"}
            </b>
          </span>
        ))}
      </div>
    </section>
  );
}
export function VestuarioPage() {
  const { profile, logout } = useAuth();
  const { lock } = useTeam();
  const { matches } = useClubData();
  const now = useClock();
  const next = nextFixture(matches, now);
  const last = matches.find((m) => m.status === "finished");
  if (!profile) return <NicknameSetup />;
  const admin = ["admin", "superadmin"].includes(profile.role);
  return (
    <div className="club-page">
      <header className="club-page-head">
        <span className="club-kicker">ÁREA DEL EQUIPO</span>
        <h1>
          Tu vestuario,
          <br />
          <em>{profile.nickname}.</em>
        </h1>
        <p>El siguiente partido empieza aquí.</p>
      </header>
      <div className="club-toolbar">
        <div className="club-actions">
          <Link className="club-button" to="/pizarra">
            Abrir la pizarra <ClipboardList size={17} />
          </Link>
          {admin && (
            <>
              <Link className="club-button secondary" to="/admin">
                Administrar el club
              </Link>
              <Link className="club-button secondary" to="/admin/contenido">
                Contenido y fotos
              </Link>
            </>
          )}
        </div>
        <button
          className="club-text-link"
          onClick={async () => {
            try {
              await lock();
            } finally {
              await logout();
            }
          }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
      {next && (
        <div className="club-grid-2">
          <FixtureCard match={next} />
          <Availability key={next.id} match={next} />
        </div>
      )}
      {!next && (
        <div className="club-empty">
          La próxima convocatoria aparecerá cuando se publique el calendario.
        </div>
      )}
      {last && <MvpVote match={last} />}
      <SectionTitle title="Tu equipo, también entre semana" />
      <div className="club-grid-3">
        <Link className="club-panel" to="/pizarra">
          <ClipboardList />
          <h3>Tu siete ideal</h3>
          <p>Prepara la alineación y compártela con el equipo.</p>
        </Link>
        <Link className="club-panel" to="/stats">
          <Trophy />
          <h3>La carrera del Piti</h3>
          <p>Récords, sociedades y estadísticas de cada temporada.</p>
        </Link>
        <Link className="club-panel" to="/profile">
          <ShieldCheck />
          <h3>Mi perfil</h3>
          <p>Tu identidad dentro del vestuario.</p>
        </Link>
      </div>
    </div>
  );
}
