import React, { useEffect, useMemo, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useSeason } from "../context/SeasonContext";
import { Jersey } from "../components/Jersey";
import { motion } from "motion/react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { X, FileText } from "lucide-react";
import { computeStats, type PlayerStats, type MatchLike } from "../lib/playerStats";
import "./Plantilla.css";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  shirtName: string;
  number: number;
  birthDate: string; // YYYY-MM-DD
  seasons: string[];
  height: number;
  weight: number;
  active: boolean;
  seasonDetails?: Record<string, { shirtName: string; number: number }>;
}

type Mount = "pichichi" | "capitan" | null;
interface Perfil { label: string; color: string; headlineMode: "guardian" | null; rationale: string; }

function rv(i: number): React.CSSProperties { return { "--i": i } as React.CSSProperties; }

function calculateAge(birthDateStr: string): number {
  if (!birthDateStr) return 0;
  const birth = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// The analyst's classification — deterministic, first-match-wins, never fabricated.
function derivePerfil(s: PlayerStats, player: Player, pjQuartile: number): Perfil {
  const age = player.birthDate ? calculateAge(player.birthDate) : 0;
  if (s.penaltySaved >= 2)
    return { label: "Guardián de penaltis", color: "var(--accent-ink)", headlineMode: "guardian", rationale: `${s.penaltySaved} penaltis detenidos en el periodo.` };
  if (s.goals >= 5 && s.goals >= s.assists)
    return { label: "Goleador", color: "var(--accent-ink)", headlineMode: null, rationale: `Clasificación por ${s.goals} goles en ${s.matchesPlayed} partidos.` };
  if (s.assists >= 4 && s.assists > s.goals)
    return { label: "Asistente", color: "var(--accent-ink)", headlineMode: null, rationale: `${s.assists} asistencias de gol registradas.` };
  if (s.goalFreekick >= 2)
    return { label: "Artillero de falta", color: "var(--accent-gold)", headlineMode: null, rationale: `${s.goalFreekick} goles de falta directa.` };
  if (s.woodwork >= 3)
    return { label: "Hombre del palo", color: "var(--accent-gold)", headlineMode: null, rationale: `${s.woodwork} tiros al palo. Mala suerte documentada.` };
  if (s.redCards >= 1 || s.doubleYellows >= 1 || s.yellowCards >= 5)
    return { label: "Polémico", color: "var(--accent-red)", headlineMode: null, rationale: `${s.yellowCards} amarillas y ${s.redCards} rojas. Expediente disciplinario abierto.` };
  if (s.matchesPlayed > 0 && s.matchesPlayed >= pjQuartile)
    return { label: "Fijo del once", color: "var(--accent-ink)", headlineMode: null, rationale: `${s.matchesPlayed} partidos disputados. Presencia constante.` };
  if (player.seasons && player.seasons.length >= 4)
    return { label: "Veterano", color: "var(--accent-gold)", headlineMode: null, rationale: `${player.seasons.length} temporadas en el club.` };
  if (age > 0 && age <= 19)
    return { label: "Promesa", color: "var(--accent-ink)", headlineMode: null, rationale: `${age} años. Proyección en seguimiento.` };
  return { label: "En observación", color: "var(--text-muted)", headlineMode: null, rationale: "Pocos minutos en el periodo. Seguimiento en curso." };
}

interface Norms { g: number; a: number; pj: number; w: number; ps: number; c: number; }
// Six normalised activity axes (0-1) for the huella sparkline: goals, assists,
// PJ, woodwork, penalties saved, cards. All are pure activity, so a player with
// no output reads as a flat low trace (never an artificial rise), and the shape
// only peaks where the player actually does something.
function huellaFor(s: PlayerStats, n: Norms): number[] {
  const f = (v: number, m: number) => (m > 0 ? v / m : 0);
  return [f(s.goals, n.g), f(s.assists, n.a), f(s.matchesPlayed, n.pj), f(s.woodwork, n.w), f(s.penaltySaved, n.ps), f(s.yellowCards + 2 * s.redCards, n.c)];
}

function seasonShort(name: string): string {
  if (/hist/i.test(name)) return "HIST";
  return name.replace(/temporada\s*/i, "T").replace(/\s+/g, "").slice(0, 6).toUpperCase();
}

// Count-up that runs on mount (no IntersectionObserver) — reliable inside the modal.
const CountUpNow: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 800);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return <span className={className}>{shown}</span>;
};

// The player's stat "huella" (fingerprint): a compact sparkline of 6 normalised
// axes — the recognisable shape of their game. Decorative (aria-hidden); the
// ledger carries the real numbers.
const HuellaSparkline: React.FC<{ points: number[]; tone: "sky" | "gold" | "muted" }> = ({ points, tone }) => {
  const W = 94, H = 34, pad = 4;
  const color = tone === "gold" ? "var(--accent-gold)" : tone === "muted" ? "var(--text-muted)" : "var(--accent-ink)";
  const step = (W - 2 * pad) / (points.length - 1);
  const xs = points.map((_, i) => pad + i * step);
  const ys = points.map((v) => (H - pad) - Math.max(0.08, Math.min(1, v)) * (H - 2 * pad));
  const poly = points.map((_, i) => `${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return (
    <svg className="exp-huella" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <line x1="0" y1={H - pad} x2={W} y2={H - pad} stroke="var(--border-color)" strokeWidth="1" />
      <polyline points={poly} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="1.7" fill={color} />)}
    </svg>
  );
};

const ExpedienteCard: React.FC<{
  player: Player;
  shirtName: string;
  number: number;
  refCode: string;
  periodoShort: string;
  stats: PlayerStats;
  perfil: Perfil;
  mount: Mount;
  isInactive: boolean;
  index: number;
  morph: boolean;
  huella: number[];
  onOpen: () => void;
}> = ({ player, shirtName, number, refCode, periodoShort, stats, perfil, mount, isInactive, index, morph, huella, onOpen }) => {
  const age = player.birthDate ? calculateAge(player.birthDate) : null;
  const goalNote = stats.goalPenalty > 0 || stats.goalFreekick > 0 ? `(${stats.goalPenalty}p · ${stats.goalFreekick}tl)` : null;

  // Effective tab / headline / stamp resolve the gold mount over the analyst perfil.
  const tab = mount === "pichichi"
    ? { cls: "gold", word: "★ Pichichi" }
    : mount === "capitan"
      ? { cls: "gold", word: "© Cap" }
      : isInactive
        ? { cls: "baja", word: "Baja" }
        : { cls: "activo", word: "Activo" };

  const headline = mount === "pichichi"
    ? { l1: "Máximo goleador", l2: `Goles · ${periodoShort}`, fig: stats.goals, gold: true }
    : perfil.headlineMode === "guardian"
      ? { l1: "Especialista", l2: `Pen. parados · ${periodoShort}`, fig: stats.penaltySaved, gold: true }
      : { l1: "Producción", l2: `G+A · ${periodoShort}`, fig: stats.goals + stats.assists, gold: false };

  const stamp = mount === "pichichi"
    ? { label: "Máximo goleador", color: "var(--accent-gold)" }
    : mount === "capitan"
      ? { label: "El capitán", color: "var(--accent-gold)" }
      : { label: perfil.label, color: perfil.color };

  const seasonChips = (player.seasons || []).length;

  const ledgerVal = (v: number, tone?: "gold" | "red") =>
    `v ${v === 0 ? "zero" : tone || ""}`.trim();

  // Pointer-reactive tilt + parallax + lamp sheen (desk-lamp feel; pointer:fine + motion only).
  const tiltable = typeof window !== "undefined"
    && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches
    && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!tiltable) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(px - 0.5) * 9}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 7}deg`);
    el.style.setProperty("--gx", `${(0.5 - px) * 16}px`);
    el.style.setProperty("--gy", `${(0.5 - py) * 11}px`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  };
  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--gx", "0px");
    el.style.setProperty("--gy", "0px");
  };

  return (
    <motion.button
      type="button"
      className={`exp-card${isInactive ? " bench" : ""}${mount ? " gold" : ""}`}
      style={{ ...rv(index), viewTransitionName: morph ? "dossier-morph" : undefined } as React.CSSProperties}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.45, delay: Math.min(index, 16) * 0.034, ease: "easeOut" }}
      onClick={onOpen}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      aria-label={`Abrir expediente de ${player.firstName} ${player.lastName}, dorsal ${number}`}
    >
      <span className={`exp-tab ${tab.cls}`}>{tab.word}</span>
      <div className="exp-card-inner">
        <span className="exp-sheen" aria-hidden="true" />

        {/* ZONE A — cover: the first name is the monument */}
        <div className="exp-cover">
          <span className="exp-ghost" aria-hidden="true">{number}</span>
          <div className="exp-cover-meta">
            <span className="lbl">Expediente</span>
            <span className="ref">{refCode}</span>
          </div>
          <div className={`exp-name${(player.firstName || "").length > 9 ? " long" : ""}`}>
            {player.firstName || player.lastName || "—"}
          </div>
          <span className="exp-registro" aria-hidden="true" />
          <div className="exp-namesub">
            {player.lastName && <span className="sur">{player.lastName}</span>}
            {player.lastName && shirtName && <span className="sep" aria-hidden="true" />}
            {shirtName && <span className="alias"><b>Alias</b> · {shirtName}</span>}
          </div>
        </div>

        {/* ZONE B — evidence: the jersey, notarized */}
        <div className="exp-evidence">
          <div className="exp-evcol">
            <div className="exp-well">
              <Jersey name={shirtName} number={number} size="sm" style={{ filter: "none" }} />
              {isInactive && <span className="exp-archivado" aria-hidden="true">Archivado</span>}
              {mount && (
                <svg className="exp-seal" viewBox="0 0 56 56" aria-hidden="true">
                  <circle cx="28" cy="28" r="26" fill="#FFC659" />
                  <circle cx="28" cy="28" r="26" fill="none" stroke="#0c1733" strokeWidth="1.5" opacity="0.35" />
                  <circle cx="28" cy="28" r="20.5" fill="none" stroke="#0c1733" strokeWidth="1" opacity="0.28" />
                  <path d="M28 13 l3.9 7.9 8.7 1.3 -6.3 6.1 1.5 8.7 -7.8 -4.1 -7.8 4.1 1.5 -8.7 -6.3 -6.1 8.7 -1.3 Z" fill="#0c1733" />
                </svg>
              )}
            </div>
            <span className="exp-evcap">Prueba · Nº{number}{shirtName ? ` · ${shirtName}` : ""}</span>
          </div>
          <div className="exp-bio-mini">
            <div className="r"><span className="k">Edad</span><span className="v">{age !== null ? age : "—"}{age !== null && <i>años</i>}</span></div>
            <div className="r"><span className="k">Altura</span><span className="v">{player.height || "—"}{player.height ? <i>cm</i> : null}</span></div>
            <div className="r"><span className="k">Peso</span><span className="v">{player.weight || "—"}{player.weight ? <i>kg</i> : null}</span></div>
          </div>
        </div>

        {/* ZONE C — hero finding + huella */}
        <div className={`exp-finding${headline.gold ? " gold" : ""}`}>
          <div className="lbl"><span className="l1">Hallazgo principal</span><span className="l2">{headline.l2}</span></div>
          <HuellaSparkline points={huella} tone={mount ? "gold" : isInactive ? "muted" : "sky"} />
          <span className="fig">{headline.fig}</span>
        </div>

        {/* (F) attribute ledger */}
        <div className="exp-ledger">
          <div className="row"><span className="k">PJ</span><span className={ledgerVal(stats.matchesPlayed)}>{stats.matchesPlayed}</span></div>
          <div className="row"><span className="k">Goles</span><span className={ledgerVal(stats.goals)}>{stats.goals}{goalNote && <span className="sub">{goalNote}</span>}</span></div>
          <div className="row"><span className="k">Asist</span><span className={ledgerVal(stats.assists)}>{stats.assists}</span></div>
          <div className="row"><span className="k">Palos</span><span className={ledgerVal(stats.woodwork, "gold")}>{stats.woodwork}</span></div>
          <div className="row"><span className="k">Amarillas</span><span className={ledgerVal(stats.yellowCards, "gold")}>{stats.yellowCards}</span></div>
          <div className="row"><span className="k">Rojas</span><span className={ledgerVal(stats.redCards, "red")}>{stats.redCards}</span></div>
        </div>

        {(stats.penaltySaved > 0 || stats.penaltyMissed > 0 || stats.ownGoals > 0) && (
          <div className="exp-addenda">
            {stats.penaltySaved > 0 && <span className="a sky">✓ {stats.penaltySaved} penalti{stats.penaltySaved > 1 ? "s" : ""} parado{stats.penaltySaved > 1 ? "s" : ""}</span>}
            {stats.penaltyMissed > 0 && <span className="a red">✗ {stats.penaltyMissed} penalti{stats.penaltyMissed > 1 ? "s" : ""} fallado{stats.penaltyMissed > 1 ? "s" : ""}</span>}
            {stats.ownGoals > 0 && <span className="a red">⊘ {stats.ownGoals} autogol{stats.ownGoals > 1 ? "es" : ""}</span>}
          </div>
        )}

        {/* (G) veredicto + provenance */}
        <div className="exp-foot">
          <span className="exp-stamp" style={{ color: stamp.color, borderColor: stamp.color }}>{stamp.label}</span>
          <div className="exp-prov">
            <div className="lbl">Observado</div>
            <div className="v">{seasonChips} temp.</div>
          </div>
        </div>
        <div className="exp-conf">MP · Confidencial</div>
      </div>
    </motion.button>
  );
};

const ExpedienteModal: React.FC<{
  player: Player;
  shirtName: string;
  number: number;
  refCode: string;
  stats: PlayerStats;
  perfil: Perfil;
  mount: Mount;
  activeSeasonName: string;
  trajectory: string[];
  onClose: () => void;
}> = ({ player, shirtName, number, refCode, stats, perfil, mount, activeSeasonName, trajectory, onClose }) => {
  const age = player.birthDate ? calculateAge(player.birthDate) : null;
  const bd = player.birthDate ? new Date(player.birthDate) : null;
  const bdStr = !bd || isNaN(bd.getTime()) ? null : bd.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
  const goalNote = stats.goalPenalty > 0 || stats.goalFreekick > 0 ? `${stats.goalPenalty} de penalti · ${stats.goalFreekick} de falta` : null;

  const stamp = mount === "pichichi"
    ? { label: "Máximo goleador", color: "var(--accent-gold)", rationale: `Máximo goleador del club con ${stats.goals} goles.` }
    : mount === "capitan"
      ? { label: "El capitán", color: "var(--accent-gold)", rationale: "Capitán del equipo." }
      : { label: perfil.label, color: perfil.color, rationale: perfil.rationale };

  return (
    <div className="exp-modal-scrim" role="dialog" aria-modal="true" aria-label={`Expediente de ${player.firstName} ${player.lastName}`} onClick={onClose}>
      <div className="exp-modal" style={{ viewTransitionName: "dossier-morph" } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="exp-modal-close" aria-label="Cerrar expediente" onClick={onClose}><X size={18} /></button>

        <div className="exp-modal-head">
          <div className="exp-modal-fhrow"><span className="lbl">Expediente · Confidencial</span><span className="ref">{refCode}</span></div>
          <div className="exp-modal-idrow">
            <div className="exp-well" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.2)" }}>
              <Jersey name={shirtName} number={number} size="md" style={{ filter: "none" }} />
            </div>
            <div>
              <div className="exp-modal-redact">{player.firstName || player.lastName}</div>
              <div className="exp-modal-alias">
                {player.lastName && <span>{player.lastName}</span>}
                {player.lastName && shirtName ? " · " : ""}
                {shirtName && <span><b style={{ fontStyle: "normal", letterSpacing: "0.08em" }}>Alias:</b> {shirtName}</span>}
              </div>
              <div className="exp-modal-tag" style={{ color: stamp.color, borderColor: stamp.color }}>{stamp.label}</div>
            </div>
          </div>
        </div>

        <div className="exp-modal-body">
          <div className="exp-modal-section-label">Biometría</div>
          <div className="exp-fledger">
            <div className="row"><span className="k">Edad</span><span className="v">{age !== null ? `${age}` : "—"}</span></div>
            <div className="row"><span className="k">Altura</span><span className="v">{player.height ? `${player.height}` : "—"}</span></div>
            <div className="row"><span className="k">Peso</span><span className="v">{player.weight ? `${player.weight}` : "—"}</span></div>
            <div className="row"><span className="k">Temporadas</span><span className="v">{(player.seasons || []).length}</span></div>
          </div>
          {bdStr && <p className="exp-bd">Nació el <strong style={{ color: "var(--text-secondary)" }}>{bdStr}</strong></p>}

          <div className="exp-modal-section-label">Producción · {activeSeasonName}</div>
          <div className="exp-fledger">
            <div className="row wide"><span className="k">Goles + Asistencias</span><span className="v sky"><CountUpNow value={stats.goals + stats.assists} /></span></div>
            <div className="row"><span className="k">Partidos</span><span className="v"><CountUpNow value={stats.matchesPlayed} /></span></div>
            <div className="row"><span className="k">Goles</span><span className="v sky"><CountUpNow value={stats.goals} /></span></div>
            <div className="row"><span className="k">Asistencias</span><span className="v sky"><CountUpNow value={stats.assists} /></span></div>
            <div className="row"><span className="k">Tiros al palo</span><span className="v gold"><CountUpNow value={stats.woodwork} /></span></div>
            <div className="row"><span className="k">Amarillas</span><span className="v gold"><CountUpNow value={stats.yellowCards} /></span></div>
            <div className="row"><span className="k">Rojas</span><span className="v red"><CountUpNow value={stats.redCards} /></span></div>
            {goalNote && <div className="row wide"><span className="k">Desglose de goles</span><span className="v" style={{ fontSize: "0.82rem", fontFamily: "var(--font-sans)", color: "var(--text-secondary)" }}>{goalNote}</span></div>}
            {stats.penaltySaved > 0 && <div className="row"><span className="k">Pen. parados</span><span className="v sky"><CountUpNow value={stats.penaltySaved} /></span></div>}
            {stats.penaltyMissed > 0 && <div className="row"><span className="k">Pen. fallados</span><span className="v red"><CountUpNow value={stats.penaltyMissed} /></span></div>}
            {stats.ownGoals > 0 && <div className="row"><span className="k">Autogoles</span><span className="v red"><CountUpNow value={stats.ownGoals} /></span></div>}
            {stats.doubleYellows > 0 && <div className="row"><span className="k">Dobles amarillas</span><span className="v gold"><CountUpNow value={stats.doubleYellows} /></span></div>}
          </div>

          <div className="exp-modal-section-label">Veredicto</div>
          <p className="exp-rationale">{stamp.rationale}</p>

          {trajectory.length > 0 && (
            <>
              <div className="exp-modal-section-label">Trayectoria</div>
              <div className="exp-chips">{trajectory.map((n, i) => <span key={i} className="exp-chip">{n}</span>)}</div>
            </>
          )}

          <Link
            to="/jugadores/$playerId"
            params={{ playerId: player.id }}
            className="btn btn-primary"
            style={{ display: "block", width: "100%", marginTop: "1.5rem", textAlign: "center", textDecoration: "none" }}
          >
            Ver ficha completa
          </Link>
          <button type="button" className="btn" style={{ width: "100%", marginTop: "0.6rem" }} onClick={onClose}>Cerrar expediente</button>
        </div>
      </div>
    </div>
  );
};

export const Expedientes: React.FC = () => {
  const { selectedSeasonId, seasons } = useSeason();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchLike[]>([]);
  // Loading is derived from whether matches for the active season have arrived,
  // so we never call setState synchronously in an effect (set-state-in-effect).
  const [loadedKey, setLoadedKey] = useState<string>("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [morphingId, setMorphingId] = useState<string | null>(null);

  // File -> dossier morph via the View Transitions API (graceful fallback to a plain open).
  const openFile = (p: Player) => {
    const d = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (d.startViewTransition && !reduce) {
      flushSync(() => setMorphingId(p.id)); // tag the clicked file before the snapshot
      d.startViewTransition(() => flushSync(() => setSelectedPlayer(p))).finished.finally(() => setMorphingId(null));
    } else {
      setSelectedPlayer(p);
    }
  };
  const closeFile = () => {
    const cur = selectedPlayer;
    const d = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (cur && d.startViewTransition && !reduce) {
      d.startViewTransition(() => flushSync(() => { setMorphingId(cur.id); setSelectedPlayer(null); })).finished.finally(() => setMorphingId(null));
    } else {
      setSelectedPlayer(null);
    }
  };

  useEffect(() => {
    if (!selectedPlayer) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedPlayer(null); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [selectedPlayer]);

  useEffect(() => {
    const playersRef = collection(db, "players");
    const unsubPlayers = onSnapshot(playersRef, (snap) => {
      const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Player[];
      setAllPlayers(loaded.sort((a, b) => a.number - b.number));
    });
    const matchesRef = collection(db, "matches");
    const matchesQuery = selectedSeasonId !== "all"
      ? query(matchesRef, where("seasonId", "==", selectedSeasonId))
      : query(matchesRef);
    const unsubMatches = onSnapshot(matchesQuery, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MatchLike[]);
      setLoadedKey(selectedSeasonId);
    });
    return () => { unsubPlayers(); unsubMatches(); };
  }, [selectedSeasonId]);

  const loading = loadedKey !== selectedSeasonId;

  const displayedPlayers = useMemo(() => {
    let filtered = [...allPlayers];
    if (selectedSeasonId !== "all") filtered = filtered.filter((p) => p.seasons && p.seasons.includes(selectedSeasonId));
    const numFor = (player: Player) => {
      if (selectedSeasonId !== "all" && player.seasonDetails?.[selectedSeasonId]) return player.seasonDetails[selectedSeasonId].number;
      if (player.seasons && player.seasons.length > 0 && player.seasonDetails) {
        const inList = seasons.filter((s) => player.seasons.includes(s.id));
        if (inList.length > 0) {
          const latest = inList[inList.length - 1];
          if (player.seasonDetails[latest.id]) return player.seasonDetails[latest.id].number;
        }
      }
      return player.number || 0;
    };
    filtered.sort((a, b) => numFor(a) - numFor(b));
    return filtered;
  }, [allPlayers, selectedSeasonId, seasons]);

  const statsByPlayer = useMemo(() => {
    const map = new Map<string, PlayerStats>();
    allPlayers.forEach((p) => map.set(p.id, computeStats(p.id, matches)));
    return map;
  }, [allPlayers, matches]);

  const activeSeasonName = selectedSeasonId === "all" ? "Histórico Total" : seasons.find((s) => s.id === selectedSeasonId)?.name || "Temporada";
  const periodoShort = selectedSeasonId === "all" ? "Total" : seasonShort(activeSeasonName);
  const latestSeason = seasons.length > 0 ? seasons[seasons.length - 1] : null;
  const isAllTime = selectedSeasonId === "all" && !!latestSeason;

  const activePlayers = isAllTime ? displayedPlayers.filter((p) => p.seasons && p.seasons.includes(latestSeason!.id)) : displayedPlayers;
  const inactivePlayers = isAllTime ? displayedPlayers.filter((p) => !p.seasons || !p.seasons.includes(latestSeason!.id)) : [];

  const getResolved = (player: Player) => {
    let shirtName = player.shirtName || "";
    let number = player.number || 0;
    if (selectedSeasonId !== "all" && player.seasonDetails?.[selectedSeasonId]) {
      shirtName = player.seasonDetails[selectedSeasonId].shirtName;
      number = player.seasonDetails[selectedSeasonId].number;
    } else if (player.seasons && player.seasons.length > 0 && player.seasonDetails) {
      const inList = seasons.filter((s) => player.seasons.includes(s.id));
      if (inList.length > 0) {
        const latest = inList[inList.length - 1];
        if (player.seasonDetails[latest.id]) { shirtName = player.seasonDetails[latest.id].shirtName; number = player.seasonDetails[latest.id].number; }
      }
    }
    return { shirtName, number };
  };

  // PJ top-quartile threshold for the "Fijo del once" perfil (relative to the board).
  const pjQuartile = useMemo(() => {
    const pjs = displayedPlayers.map((p) => statsByPlayer.get(p.id)?.matchesPlayed ?? 0).filter((n) => n > 0).sort((a, b) => b - a);
    if (pjs.length === 0) return Infinity;
    return pjs[Math.floor(pjs.length * 0.25)] ?? pjs[0];
  }, [displayedPlayers, statsByPlayer]);

  // Per-axis maxima across the board, for normalising each player's huella.
  const norms = useMemo<Norms>(() => {
    let g = 0, a = 0, pj = 0, w = 0, ps = 0, c = 0;
    displayedPlayers.forEach((p) => {
      const s = statsByPlayer.get(p.id);
      if (!s) return;
      g = Math.max(g, s.goals); a = Math.max(a, s.assists); pj = Math.max(pj, s.matchesPlayed);
      w = Math.max(w, s.woodwork); ps = Math.max(ps, s.penaltySaved); c = Math.max(c, s.yellowCards + 2 * s.redCards);
    });
    return { g, a, pj, w, ps, c };
  }, [displayedPlayers, statsByPlayer]);

  // Single gold mount: top scorer (pichichi). If no one has scored this period,
  // fall back to the season's designated captain (set in Admin), not a dorsal guess.
  let mountId: string | null = null;
  let mountKind: Mount = "pichichi";
  let mountGoals = 0;
  displayedPlayers.forEach((p) => {
    const g = statsByPlayer.get(p.id)?.goals ?? 0;
    if (g > mountGoals) { mountGoals = g; mountId = p.id; }
  });
  if (!mountId && selectedSeasonId !== "all") {
    const captainId = seasons.find((s) => s.id === selectedSeasonId)?.captainPlayerId;
    if (captainId && displayedPlayers.some((p) => p.id === captainId)) {
      mountKind = "capitan";
      mountId = captainId;
    }
  }

  const playerLastSeasonName = (player: Player) => {
    const inList = seasons.filter((s) => player.seasons?.includes(s.id));
    return inList.length ? inList[inList.length - 1].name : activeSeasonName;
  };

  const renderCard = (p: Player, i: number, isInactive: boolean) => {
    const { shirtName, number } = getResolved(p);
    const st = statsByPlayer.get(p.id) ?? computeStats(p.id, matches);
    const perfil = derivePerfil(st, p, pjQuartile);
    const periodoForRef = isInactive ? seasonShort(playerLastSeasonName(p)) : (isAllTime ? "HIST" : seasonShort(activeSeasonName));
    const refCode = `Nº${String(number).padStart(2, "0")} · ${periodoForRef}`;
    return (
      <ExpedienteCard
        key={p.id}
        player={p}
        shirtName={shirtName}
        number={number}
        refCode={refCode}
        periodoShort={periodoShort}
        stats={st}
        perfil={perfil}
        mount={p.id === mountId ? mountKind : null}
        isInactive={isInactive}
        index={i}
        morph={morphingId === p.id && !selectedPlayer}
        huella={huellaFor(st, norms)}
        onOpen={() => openFile(p)}
      />
    );
  };

  // Modal data for the selected player.
  const selResolved = selectedPlayer ? getResolved(selectedPlayer) : null;
  const selStats = selectedPlayer ? (statsByPlayer.get(selectedPlayer.id) ?? computeStats(selectedPlayer.id, matches)) : null;
  const selPerfil = selectedPlayer && selStats ? derivePerfil(selStats, selectedPlayer, pjQuartile) : null;
  const selTrajectory = selectedPlayer ? seasons.filter((s) => selectedPlayer.seasons?.includes(s.id)).map((s) => s.name) : [];
  const selRefCode = selectedPlayer && selResolved
    ? `Nº${String(selResolved.number).padStart(2, "0")} · ${selectedPlayer.seasons?.includes(latestSeason?.id ?? "") || !isAllTime ? (isAllTime ? "HIST" : seasonShort(activeSeasonName)) : seasonShort(playerLastSeasonName(selectedPlayer))}`
    : "";

  return (
    <>
      <div className="exp-page fade-in">
        {/* File-room header (classified cover) */}
        <div className="exp-head">
          <div className="exp-head-left">
            <span className="exp-head-kicker">Departamento de análisis · {activeSeasonName}</span>
            <h2 className="exp-head-title">Plantilla</h2>
            <span className="exp-head-rule" />
          </div>
          <div className="exp-head-right">
            <div className="exp-resumen" aria-label="Resumen de plantilla">
              <div className="cell"><div className="v"><CountUpNow value={displayedPlayers.length} /></div><div className="k">En plantilla</div></div>
              {isAllTime ? (
                <>
                  <div className="cell"><div className="v sky"><CountUpNow value={activePlayers.length} /></div><div className="k">Activos</div></div>
                  <div className="cell"><div className="v muted"><CountUpNow value={inactivePlayers.length} /></div><div className="k">Bajas</div></div>
                  <div className="cell"><div className="v gold"><CountUpNow value={seasons.length} /></div><div className="k">Temporadas</div></div>
                </>
              ) : (
                <div className="cell"><div className="v gold"><CountUpNow value={seasons.length} /></div><div className="k">Temporadas</div></div>
              )}
            </div>
          </div>
        </div>

        {/* Files (season switch lives in the shared Plantilla header) */}
        {loading ? (
          <div className="exp-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="exp-skel"><div className="exp-skel-inner" /></div>)}</div>
        ) : displayedPlayers.length === 0 ? (
          <div className="exp-empty">
            <FileText size={40} style={{ color: "var(--text-muted)" }} />
            <span className="redact">Sin registros</span>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "380px" }}>No hay expedientes para <strong>{activeSeasonName}</strong>.</p>
          </div>
        ) : isAllTime ? (
          <div key={selectedSeasonId} style={{ display: "flex", flexDirection: "column", gap: "2.25rem" }}>
            {activePlayers.length > 0 && (
              <div className="exp-drawer">
                <div className="exp-drawer-head"><span className="rule" /><h3>Expedientes activos</h3><span className="count">{activePlayers.length}</span></div>
                <div className="exp-grid">{activePlayers.map((p, i) => renderCard(p, i, false))}</div>
              </div>
            )}
            {inactivePlayers.length > 0 && (
              <div className="exp-drawer">
                <div className="exp-drawer-head"><span className="rule gold" /><h3>Archivo histórico</h3><span className="count">{inactivePlayers.length}</span></div>
                <div className="exp-grid">{inactivePlayers.map((p, i) => renderCard(p, i, true))}</div>
              </div>
            )}
          </div>
        ) : (
          <div key={selectedSeasonId} className="exp-drawer">
            <div className="exp-drawer-head"><span className="rule" /><h3>Expedientes</h3><span className="count">{displayedPlayers.length}</span></div>
            <div className="exp-grid">{displayedPlayers.map((p, i) => renderCard(p, i, false))}</div>
          </div>
        )}
      </div>

      {selectedPlayer && selResolved && selStats && selPerfil && createPortal(
        <ExpedienteModal
          player={selectedPlayer}
          shirtName={selResolved.shirtName}
          number={selResolved.number}
          refCode={selRefCode}
          stats={selStats}
          perfil={selPerfil}
          mount={selectedPlayer.id === mountId ? mountKind : null}
          activeSeasonName={activeSeasonName}
          trajectory={selTrajectory}
          onClose={closeFile}
        />,
        document.body,
      )}
    </>
  );
};
