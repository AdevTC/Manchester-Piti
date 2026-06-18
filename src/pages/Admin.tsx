import React, { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import {
  useUpsertSeason,
  useDeleteSeason,
  useUpsertPlayer,
  useDeletePlayer,
  useUpsertMatch,
  useDeleteMatch,
} from "./admin/useAdminMutations";
import {
  PlusCircle,
  Trash2,
  Calendar,
  Users,
  Trophy,
  AlertTriangle,
  CheckCircle,
  Shield
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  seasonFormSchema,
  type SeasonFormValues,
  matchFormSchema,
  type MatchFormValues,
  playerFormSchema,
  type PlayerFormValues,
  parseDocs,
  dropNullFields,
  seasonSchema,
  playerSchema,
  userDocSchema,
  seasonMatchSchema,
} from "../lib/schemas";

interface Season {
  id: string;
  name: string;
  captainPlayerId?: string;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  shirtName: string;
  number: number;
  birthDate?: string;
  seasons?: string[];
  height?: number;
  weight?: number;
  seasonDetails?: Record<string, { shirtName: string; number: number }>;
}

interface MatchEventForm {
  type: "goal" | "yellow_card" | "red_card" | "woodwork" | "assist" | "double_yellow" | "penalty_saved" | "goal_penalty" | "goal_freekick" | "penalty_missed" | "own_goal" | "match_played";
  playerId: string;
  assistPlayerId?: string;
}

interface UserDoc {
  uid: string;
  nickname: string;
  email: string;
  role: string;
}

interface MatchDoc {
  id: string;
  seasonId?: string;
  rival?: string;
  competition?: string;
  date: (string | number) & { seconds?: number };
  goalsFor?: number;
  goalsAgainst?: number;
  events?: MatchEventForm[];
}

export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"seasons" | "roster" | "matches" | "admins">("matches");
  const { updateUserRole } = useAuth();
  
  // Real-time collections loaded for form dropdowns
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [usersList, setUsersList] = useState<UserDoc[]>([]);
  
  // Action notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const upsertSeason = useUpsertSeason();
  const deleteSeason = useDeleteSeason();
  const upsertPlayer = useUpsertPlayer();
  const deletePlayer = useDeletePlayer();
  const upsertMatch  = useUpsertMatch();
  const deleteMatch  = useDeleteMatch();

  // --- Form States ---
  // Season Form (name field via RHF; captain select stays as plain state)
  const {
    register: registerSeason,
    handleSubmit: handleSeasonSubmit,
    reset: resetSeason,
    formState: { errors: seasonErrors, isSubmitting: seasonSubmitting },
  } = useForm<SeasonFormValues>({
    resolver: zodResolver(seasonFormSchema),
    defaultValues: { name: "" },
  });
  const [seasonCaptainId, setSeasonCaptainId] = useState("");

  // Match Form (RHF + Zod). Goals use setValueAs to map empty→undefined so an
  // empty number input shows a required error and a filled one validates as int≥0.
  const {
    register: registerMatch,
    handleSubmit: handleMatchSubmit,
    reset: resetMatch,
    setError: setMatchError,
    control: matchControl,
    formState: { errors: matchErrors, isSubmitting: matchSubmitting },
  } = useForm<MatchFormValues>({
    resolver: zodResolver(matchFormSchema),
    defaultValues: { seasonId: "", rival: "", competition: "Liga", date: "", goalsFor: undefined, goalsAgainst: undefined },
  });
  // The events workspace resolves per-season shirt names/numbers from the
  // currently selected season; track it reactively from the match form.
  const matchSeasonId = useWatch({ control: matchControl, name: "seasonId" });

  // Player Form (RHF + Zod). Scalar fields via RHF; number/height/weight use
  // setValueAs to map empty→undefined (mirrors the match form's goals handling).
  const {
    register: registerPlayer,
    handleSubmit: handlePlayerSubmit,
    reset: resetPlayer,
    setError: setPlayerError,
    getValues: getPlayerValues,
    formState: { errors: playerErrors, isSubmitting: playerSubmitting },
  } = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: { firstName: "", lastName: "", shirtName: "", number: undefined, birthDate: "", height: undefined, weight: undefined },
  });
  // Per-season checkboxes + per-season shirt/number details stay as useState:
  // they are dynamic/data-dependent (depend on the seasons list and pre-fill
  // from the scalar shirt/number RHF fields).
  const [playerSeasons, setPlayerSeasons] = useState<string[]>([]);
  const [seasonDetailsState, setSeasonDetailsState] = useState<Record<string, { shirtName: string; number: number | "" }>>({});
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchDoc[]>([]);

  // Match Events state
  const [matchEvents, setMatchEvents] = useState<MatchEventForm[]>([]);
  const [currentEventType, setCurrentEventType] = useState<MatchEventForm["type"]>("goal");
  const [currentEventPlayer, setCurrentEventPlayer] = useState("");
  const [currentEventAssistant, setCurrentEventAssistant] = useState("");

  // Load Seasons, Players and Users
  useEffect(() => {
    const unsubscribeSeasons = onSnapshot(
      query(collection(db, "seasons"), orderBy("name", "asc")),
      (snapshot) => {
        // Validate at the edge; Admin maps captainPlayerId || "" (not undefined)
        const validated = parseDocs(seasonSchema, snapshot.docs, "seasons");
        setSeasons(validated.map((s) => ({ id: s.id, name: s.name, captainPlayerId: s.captainPlayerId || "" })));
      }
    );

    const unsubscribePlayers = onSnapshot(
      query(collection(db, "players")),
      (snapshot) => {
        // Validate at the edge; keep existing field-by-field mapping + defaults
        const validated = parseDocs(playerSchema, snapshot.docs, "players");
        const loadedPlayers: Player[] = validated.map((p) => ({
          id: p.id,
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          shirtName: p.shirtName || "",
          number: p.number || 0,
          birthDate: p.birthDate || "",
          seasons: p.seasons || [],
          height: p.height,
          weight: p.weight,
          seasonDetails: p.seasonDetails as Player["seasonDetails"],
        }));
        loadedPlayers.sort((a, b) => a.number - b.number);
        setPlayers(loadedPlayers);
      }
    );

    const unsubscribeUsers = onSnapshot(
      query(collection(db, "users"), orderBy("nickname", "asc")),
      (snapshot) => {
        // UserDoc uses `uid` (not `id`); build the object manually so the
        // schema's `uid` key matches instead of using the generic parseDocs.
        // dropNullFields: same null→absent normalization parseDocs applies.
        const items: UserDoc[] = [];
        for (const d of snapshot.docs) {
          const r = userDocSchema.safeParse({ uid: d.id, ...dropNullFields(d.data() as object) });
          if (r.success) items.push(r.data);
          else console.error(`[schema] doc inválido en users/${d.id}:`, r.error.issues);
        }
        setUsersList(items);
      }
    );

    const unsubscribeMatches = onSnapshot(
      query(collection(db, "matches"), orderBy("date", "desc")),
      (snapshot) => {
        // looseObject preserves passthrough fields (competition, events, date); the
        // single cast bridges the schema's loose extras to MatchDoc's precise typing
        // (date/events are modeled precisely in the Phase 6 match-form work, not here).
        setMatches(parseDocs(seasonMatchSchema, snapshot.docs, "matches") as MatchDoc[]);
      }
    );

    return () => {
      unsubscribeSeasons();
      unsubscribePlayers();
      unsubscribeUsers();
      unsubscribeMatches();
    };
  }, []);

  // Utility to clear notification messages after timeout
  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const notifyError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg(null);
    setTimeout(() => setErrorMsg(null), 6000);
  };

  // --- ACTIONS ---
  
  // Add/Edit Season (RHF-driven; data.name already trimmed by schema)
  const onSeasonSubmit = async (data: SeasonFormValues) => {
    const isEditing = !!editingSeasonId;
    const docData: Record<string, unknown> = isEditing
      ? { name: data.name, captainPlayerId: seasonCaptainId || "" }
      : { name: data.name, captainPlayerId: "", createdAt: new Date() };
    try {
      await upsertSeason.mutateAsync({ id: editingSeasonId, data: docData });
      if (isEditing) {
        setEditingSeasonId(null);
        notifySuccess("¡Temporada actualizada correctamente!");
      } else {
        notifySuccess("¡Temporada creada correctamente!");
      }
      resetSeason({ name: "" });
      setSeasonCaptainId("");
    } catch (err: unknown) {
      notifyError("Error al guardar temporada: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Add/Edit Player (RHF-driven; data already validated by playerFormSchema —
  // firstName/lastName/shirtName trimmed, number int≥0). The per-season details
  // and dorsal-duplicate checks stay imperative (data-dependent).
  const onPlayerSubmit = async (data: PlayerFormValues) => {
    // Parse and validate season details (fallback to the scalar shirt/number)
    const parsedSeasonDetails: Record<string, { shirtName: string; number: number }> = {};
    for (const seasonId of playerSeasons) {
      const details = seasonDetailsState[seasonId];
      const sName = details?.shirtName?.trim().toUpperCase() || data.shirtName.trim().toUpperCase();
      const sNum = (details?.number !== undefined && details.number !== "") ? Number(details.number) : data.number;

      if (!sName || isNaN(sNum)) {
        const seasonName = seasons.find(s => s.id === seasonId)?.name || "la temporada";
        notifyError(`Por favor completa el nombre en camiseta y dorsal para la temporada: ${seasonName}.`);
        return;
      }
      parsedSeasonDetails[seasonId] = {
        shirtName: sName,
        number: sNum
      };
    }

    // Check if dorsal is already in use in any of the selected seasons
    for (const seasonId of playerSeasons) {
      const currentNumber = parsedSeasonDetails[seasonId].number;
      const duplicate = players.some(p => {
        if (editingPlayerId && p.id === editingPlayerId) return false;
        if (p.seasons?.includes(seasonId)) {
          const otherNumber = p.seasonDetails?.[seasonId]?.number ?? p.number;
          return otherNumber === currentNumber;
        }
        return false;
      });

      if (duplicate) {
        const seasonName = seasons.find(s => s.id === seasonId)?.name || "la temporada";
        setPlayerError("number", {
          type: "manual",
          message: `El dorsal #${currentNumber} ya está registrado en ${seasonName} por otro jugador.`,
        });
        return;
      }
    }

    const wasEditingPlayer = !!editingPlayerId;
    const playerData: Record<string, unknown> = {
      firstName: data.firstName,
      lastName: data.lastName || "",
      shirtName: data.shirtName.toUpperCase(),
      number: data.number,
      birthDate: data.birthDate || "",
      seasons: playerSeasons || [],
      seasonDetails: parsedSeasonDetails || {},
      height: data.height ?? null,
      weight: data.weight ?? null,
      active: true,
      createdAt: new Date()
    };

    upsertPlayer.mutate({ id: editingPlayerId, data: playerData }, {
      onSuccess: () => {
        notifySuccess(wasEditingPlayer ? "¡Jugador actualizado correctamente!" : "¡Jugador registrado en la plantilla!");
        // Clear fields
        resetPlayer({ firstName: "", lastName: "", shirtName: "", number: undefined, birthDate: "", height: undefined, weight: undefined });
        setPlayerSeasons([]);
        setSeasonDetailsState({});
        setEditingPlayerId(null);
      },
      onError: (err: unknown) => {
        notifyError("Error al registrar jugador: " + (err instanceof Error ? err.message : String(err)));
      },
    });
  };

  // Add event to temporary match events array
  const handleAddEventToMatch = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentEventPlayer) {
      notifyError("Selecciona un jugador para el evento.");
      return;
    }

    // Unassisted check
    const assistId = (currentEventType === "goal" && currentEventAssistant) 
      ? currentEventAssistant 
      : undefined;

    const newEvent: MatchEventForm = {
      type: currentEventType,
      playerId: currentEventPlayer,
      assistPlayerId: assistId
    };

    setMatchEvents([...matchEvents, newEvent]);
    
    // Reset selection fields
    setCurrentEventPlayer("");
    setCurrentEventAssistant("");
  };

  // Remove event from temporary match events array
  const handleRemoveEventFromMatch = (index: number) => {
    const updated = [...matchEvents];
    updated.splice(index, 1);
    setMatchEvents(updated);
  };

  // Save Match (RHF-driven; data already validated by matchFormSchema, rival trimmed)
  const onMatchSubmit = async (data: MatchFormValues) => {
    // Verify event counts vs score:
    // Registered goals in Piti events shouldn't exceed goalsFor!
    const pitiGoalsEventCount = matchEvents.filter(e => ["goal", "goal_penalty", "goal_freekick"].includes(e.type)).length;
    if (pitiGoalsEventCount > data.goalsFor) {
      setMatchError("goalsFor", {
        type: "manual",
        message: `Conflicto de Goles: Has registrado ${pitiGoalsEventCount} goles de jugadores del Piti en la lista de eventos, pero el marcador indica que el equipo marcó ${data.goalsFor} goles.`,
      });
      return;
    }

    const wasEditing = !!editingMatchId;
    const matchDoc: Record<string, unknown> = {
      seasonId: data.seasonId,
      rival: data.rival,
      competition: data.competition,
      date: Timestamp.fromDate(new Date(data.date)),
      goalsFor: data.goalsFor,
      goalsAgainst: data.goalsAgainst,
      events: matchEvents.map(ev => ({
        type: ev.type,
        playerId: ev.playerId,
        assistPlayerId: ev.assistPlayerId || null
      }))
    };

    upsertMatch.mutate({ id: editingMatchId, data: matchDoc }, {
      onSuccess: () => {
        if (wasEditing) {
          setEditingMatchId(null);
          notifySuccess("¡Partido actualizado con éxito!");
        } else {
          notifySuccess("¡Partido registrado con éxito!");
        }
        setMatchEvents([]);
        // Preserve original reset semantics: it ALWAYS cleared rival+goals+events
        // and left competition as chosen; it cleared seasonId+date ONLY when
        // editing (on create they stay so the admin can log another match in the
        // same session/date).
        resetMatch({
          seasonId: wasEditing ? "" : data.seasonId,
          rival: "",
          competition: data.competition,
          date: wasEditing ? "" : data.date,
          goalsFor: undefined,
          goalsAgainst: undefined,
        });
      },
      onError: (err: unknown) => {
        notifyError("Error al registrar el partido: " + (err instanceof Error ? err.message : String(err)));
      },
    });
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Editorial header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, textTransform: "uppercase", fontSize: "clamp(2.2rem, 6vw, 3.4rem)", lineHeight: 0.9, letterSpacing: "0.01em", color: "var(--text-primary)" }}>
            Administración
          </h2>
          <span style={{ display: "block", width: "84px", height: "6px", background: "var(--accent-cyan)", margin: "0.9rem 0 0.75rem" }} />
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Gestiona temporadas, plantilla y partidos del club.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,198,89,0.12)", border: "1px solid rgba(255,198,89,0.4)", padding: "0.5rem 0.9rem", borderRadius: "4px", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-gold)" }}>
          <Shield size={15} />
          Modo administrador
        </div>
      </div>

      {/* Action alerts */}
      {successMsg && (
        <div style={{
          background: "rgba(108, 171, 221, 0.12)",
          border: "1px solid rgba(108, 171, 221, 0.4)",
          color: "var(--accent-ink)",
          padding: "0.9rem 1rem",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          fontSize: "0.92rem",
          fontWeight: 600
        }}>
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div style={{
          background: "rgba(196, 47, 35, 0.1)",
          border: "1px solid rgba(196, 47, 35, 0.4)",
          color: "var(--accent-red)",
          padding: "0.9rem 1rem",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          fontSize: "0.92rem",
          fontWeight: 600
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs — segmented control */}
      <div role="tablist" style={{ display: "flex", borderBottom: "1px solid var(--border-color)", gap: "0.25rem", overflowX: "auto" }}>
        {([
          { id: "matches", icon: Trophy, label: "Registrar partido" },
          { id: "roster", icon: Users, label: "Inscribir jugador" },
          { id: "seasons", icon: Calendar, label: "Temporadas" },
          { id: "admins", icon: Shield, label: "Admins" },
        ] as const).map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                whiteSpace: "nowrap",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--accent-cyan)" : "2px solid transparent",
                marginBottom: "-1px",
                padding: "0.7rem 0.9rem",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "0.85rem",
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: active ? "var(--accent-ink)" : "var(--text-secondary)",
                transition: "color 0.2s var(--mp-ease)",
              }}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: 1. REGISTRAR PARTIDO */}
      {activeTab === "matches" && (
        <div className="card fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.25rem" }}>
              Insertar Partido & Eventos
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              Ingresa el marcador final y asocia los goles, asistencias y tarjetas a los jugadores de la plantilla.
            </p>
          </div>

          {seasons.length === 0 ? (
            <div style={{ background: "rgba(255,198,89,0.05)", border: "1px solid rgba(255,198,89,0.2)", borderRadius: "0.75rem", padding: "1.25rem", color: "var(--accent-gold)", fontSize: "0.9rem" }}>
              Para registrar un partido, primero debes crear al menos una temporada en la pestaña <strong>"Gestionar Temporadas"</strong>.
            </div>
          ) : players.length === 0 ? (
            <div style={{ background: "rgba(255,198,89,0.05)", border: "1px solid rgba(255,198,89,0.2)", borderRadius: "0.75rem", padding: "1.25rem", color: "var(--accent-gold)", fontSize: "0.9rem" }}>
              Para asociar goleadores o asistentes, registra jugadores en la plantilla en la pestaña <strong>"Inscribir Jugador"</strong>.
            </div>
          ) : (
            <>
              <form onSubmit={handleMatchSubmit(onMatchSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Match Header fields */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>

                {/* Season selection */}
                <div className="form-group">
                  <label className="form-label">Temporada</label>
                  <select
                    className="form-input"
                    {...registerMatch("seasonId")}
                    aria-invalid={!!matchErrors.seasonId}
                    aria-describedby={matchErrors.seasonId ? "match-season-error" : undefined}
                  >
                    <option value="">Selecciona la Temporada</option>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {matchErrors.seasonId && (
                    <span id="match-season-error" role="alert" style={{ display: "block", fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "0.25rem" }}>
                      {matchErrors.seasonId.message}
                    </span>
                  )}
                </div>

                {/* Rival Name */}
                <div className="form-group">
                  <label className="form-label">Equipo Rival</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ej: Barrio F.C."
                    {...registerMatch("rival")}
                    aria-invalid={!!matchErrors.rival}
                    aria-describedby={matchErrors.rival ? "match-rival-error" : undefined}
                  />
                  {matchErrors.rival && (
                    <span id="match-rival-error" role="alert" style={{ display: "block", fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "0.25rem" }}>
                      {matchErrors.rival.message}
                    </span>
                  )}
                </div>

                {/* Competition */}
                <div className="form-group">
                  <label className="form-label">Competición</label>
                  <select
                    className="form-input"
                    {...registerMatch("competition")}
                  >
                    <option value="Liga">Liga</option>
                    <option value="Copa">Copa</option>
                    <option value="Torneo">Torneo</option>
                    <option value="Amistoso">Amistoso</option>
                  </select>
                </div>

                {/* Date */}
                <div className="form-group">
                  <label className="form-label">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    {...registerMatch("date")}
                    aria-invalid={!!matchErrors.date}
                    aria-describedby={matchErrors.date ? "match-date-error" : undefined}
                  />
                  {matchErrors.date && (
                    <span id="match-date-error" role="alert" style={{ display: "block", fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "0.25rem" }}>
                      {matchErrors.date.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Goals For / Against */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: "var(--accent-cyan)" }}>Goles Favor (Piti)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    {...registerMatch("goalsFor", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })}
                    aria-invalid={!!matchErrors.goalsFor}
                    aria-describedby={matchErrors.goalsFor ? "match-goalsfor-error" : undefined}
                  />
                  {matchErrors.goalsFor && (
                    <span id="match-goalsfor-error" role="alert" style={{ display: "block", fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "0.25rem" }}>
                      {matchErrors.goalsFor.message}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: "var(--accent-red)" }}>Goles Rival</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    {...registerMatch("goalsAgainst", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })}
                    aria-invalid={!!matchErrors.goalsAgainst}
                    aria-describedby={matchErrors.goalsAgainst ? "match-goalsagainst-error" : undefined}
                  />
                  {matchErrors.goalsAgainst && (
                    <span id="match-goalsagainst-error" role="alert" style={{ display: "block", fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "0.25rem" }}>
                      {matchErrors.goalsAgainst.message}
                    </span>
                  )}
                </div>
              </div>

              {/* --- EVENTS CREATOR WORKSPACE --- */}
              <div 
                style={{ 
                  background: "rgba(0,0,0,0.2)", 
                  padding: "1.25rem", 
                  borderRadius: "0.75rem", 
                  border: "1px solid var(--border-color)",
                  marginTop: "0.5rem"
                }}
              >
                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                  Añadir Evento del Partido
                </h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", alignItems: "flex-end" }}>
                  {/* Event Type */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Tipo de Acción</label>
                    <select
                      className="form-input"
                      value={currentEventType}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const val = e.target.value as MatchEventForm["type"];
                        setCurrentEventType(val);
                        if (!["goal", "goal_penalty", "goal_freekick"].includes(val)) {
                          setCurrentEventAssistant("");
                        }
                      }}
                    >
                      <option value="goal">Gol de Jugada</option>
                      <option value="assist">Asistencia (Individual)</option>
                      <option value="goal_penalty">Gol de Penalti</option>
                      <option value="goal_freekick">Gol de Falta</option>
                      <option value="own_goal">Autogol</option>
                      <option value="penalty_saved">Penalti Parado</option>
                      <option value="penalty_missed">Penalti Fallado</option>
                      <option value="woodwork">Tiro al Palo</option>
                      <option value="yellow_card">Tarjeta Amarilla</option>
                      <option value="red_card">Tarjeta Roja</option>
                      <option value="double_yellow">Doble Amarilla</option>
                      <option value="match_played">Partido Jugado (Participación)</option>
                    </select>
                  </div>

                  {/* Player */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Jugador Implicado</label>
                    <select
                      className="form-input"
                      value={currentEventPlayer}
                      onChange={(e) => setCurrentEventPlayer(e.target.value)}
                    >
                      <option value="">Selecciona Jugador</option>
                      {players.map(p => {
                        let resolvedShirtName = p.shirtName;
                        let resolvedNumber = p.number;
                        if (matchSeasonId && p.seasonDetails?.[matchSeasonId]) {
                          resolvedShirtName = p.seasonDetails[matchSeasonId].shirtName;
                          resolvedNumber = p.seasonDetails[matchSeasonId].number;
                        } else if (p.seasons && p.seasons.length > 0 && p.seasonDetails) {
                          const activeSeasonsInList = seasons.filter(s => p.seasons?.includes(s.id));
                          if (activeSeasonsInList.length > 0) {
                            const latestPlayerSeason = activeSeasonsInList[activeSeasonsInList.length - 1];
                            if (p.seasonDetails[latestPlayerSeason.id]) {
                              resolvedShirtName = p.seasonDetails[latestPlayerSeason.id].shirtName;
                              resolvedNumber = p.seasonDetails[latestPlayerSeason.id].number;
                            }
                          }
                        }
                        return (
                          <option key={p.id} value={p.id}>
                            #{resolvedNumber} - {resolvedShirtName} ({p.firstName})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Assistant (Goals only) */}
                  {currentEventType === "goal" && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Asistente (Opcional)</label>
                      <select
                        className="form-input"
                        value={currentEventAssistant}
                        onChange={(e) => setCurrentEventAssistant(e.target.value)}
                      >
                        <option value="">Sin Asistente</option>
                        {players
                          .filter(p => p.id !== currentEventPlayer) // Can't assist yourself
                          .map(p => {
                            let resolvedShirtName = p.shirtName;
                            let resolvedNumber = p.number;
                            if (matchSeasonId && p.seasonDetails?.[matchSeasonId]) {
                              resolvedShirtName = p.seasonDetails[matchSeasonId].shirtName;
                              resolvedNumber = p.seasonDetails[matchSeasonId].number;
                            } else if (p.seasons && p.seasons.length > 0 && p.seasonDetails) {
                              const activeSeasonsInList = seasons.filter(s => p.seasons?.includes(s.id));
                              if (activeSeasonsInList.length > 0) {
                                const latestPlayerSeason = activeSeasonsInList[activeSeasonsInList.length - 1];
                                if (p.seasonDetails[latestPlayerSeason.id]) {
                                  resolvedShirtName = p.seasonDetails[latestPlayerSeason.id].shirtName;
                                  resolvedNumber = p.seasonDetails[latestPlayerSeason.id].number;
                                }
                              }
                            }
                            return (
                              <option key={p.id} value={p.id}>
                                #{resolvedNumber} - {resolvedShirtName} ({p.firstName})
                              </option>
                            );
                          })
                        }
                      </select>
                    </div>
                  )}

                  {/* Add Event Button */}
                  <button
                    type="button"
                    onClick={handleAddEventToMatch}
                    className="btn btn-secondary"
                    style={{ gap: "0.35rem", padding: "0.75rem" }}
                  >
                    <PlusCircle size={16} />
                    Agregar
                  </button>
                </div>

                {/* Event Temporary list */}
                <div style={{ marginTop: "1.25rem" }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                    Acciones añadidas en este encuentro ({matchEvents.length})
                  </p>
                  
                  {matchEvents.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                      No se han agregado eventos. Añade goleadores y tarjetas arriba.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {matchEvents.map((ev, index) => {
                        const player = players.find(p => p.id === ev.playerId);
                        const assistant = ev.assistPlayerId ? players.find(p => p.id === ev.assistPlayerId) : null;
                        
                        let eventTag = "Gol de Jugada";
                        let dotColor = "var(--accent-cyan)";
                        if (ev.type === "goal_penalty") { eventTag = "Gol de Penalti"; dotColor = "var(--accent-cyan)"; }
                        else if (ev.type === "goal_freekick") { eventTag = "Gol de Falta"; dotColor = "var(--accent-cyan)"; }
                        else if (ev.type === "own_goal") { eventTag = "Autogol"; dotColor = "var(--accent-red)"; }
                        else if (ev.type === "assist") { eventTag = "Asistencia"; dotColor = "var(--accent-cyan)"; }
                        else if (ev.type === "yellow_card") { eventTag = "Amarilla"; dotColor = "#FFC659"; }
                        else if (ev.type === "red_card") { eventTag = "Roja"; dotColor = "var(--accent-red)"; }
                        else if (ev.type === "double_yellow") { eventTag = "Doble Amarilla"; dotColor = "#FFC659"; }
                        else if (ev.type === "penalty_saved") { eventTag = "Penalti Parado"; dotColor = "var(--accent-cyan)"; }
                        else if (ev.type === "penalty_missed") { eventTag = "Penalti Fallado"; dotColor = "var(--accent-red)"; }
                        else if (ev.type === "woodwork") { eventTag = "Tiro al Palo"; dotColor = "#FFC659"; }
                        else if (ev.type === "match_played") { eventTag = "Partido Jugado"; dotColor = "var(--text-muted)"; }

                        return (
                          <div
                            key={index}
                            style={{
                              background: "var(--bg-tertiary)",
                              border: "1px solid var(--border-color)",
                              borderRadius: "4px",
                              padding: "0.5rem 0.85rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.75rem",
                              fontSize: "0.85rem"
                            }}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
                              <span aria-hidden="true" style={{ flexShrink: 0, width: "9px", height: "9px", borderRadius: "2px", background: dotColor }} />
                              <span><strong>{eventTag}</strong>: #{player?.number} - {player?.shirtName}
                              {assistant && ` (Asistencia de: #${assistant.number} - ${assistant.shirtName})`}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveEventFromMatch(index)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--accent-red)",
                                cursor: "pointer"
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Form */}
              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={upsertMatch.isPending || matchSubmitting}
                  style={{ flex: 1 }}
                >
                  {editingMatchId ? "Guardar Cambios" : "Guardar Partido Registrado"}
                </button>
                {editingMatchId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ border: "1px solid var(--accent-red)", color: "var(--accent-red)" }}
                    onClick={() => {
                      setEditingMatchId(null);
                      setMatchEvents([]);
                      resetMatch({ seasonId: "", rival: "", competition: "Liga", date: "", goalsFor: undefined, goalsAgainst: undefined });
                    }}
                  >
                    Cancelar Edición
                  </button>
                )}
              </div>
            </form>

            {/* List of existing matches */}
            <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                Partidos Registrados ({matches.length})
              </h4>
              {matches.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                  No hay partidos registrados aún.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {matches.map(m => {
                    const matchDate = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date(m.date);
                    const formattedDate = matchDate.toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    });
                    const seasonName = seasons.find(s => s.id === m.seasonId)?.name || "Sin Temp.";
                    
                    return (
                      <div 
                        key={m.id} 
                        style={{ 
                          padding: "0.75rem 1rem", 
                          background: "rgba(255,255,255,0.01)", 
                          border: "1px solid var(--border-color)", 
                          borderRadius: "0.5rem",
                          fontSize: "0.85rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                          <div>
                            <strong style={{ color: "var(--text-primary)" }}>vs {m.rival}</strong>
                            <span className="badge badge-info" style={{ marginLeft: "0.5rem", fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
                              {seasonName}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {formattedDate} • Marcador: {m.goalsFor} - {m.goalsAgainst} ({m.competition})
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMatchId(m.id);

                              // Format date for datetime-local
                              const dateObj = m.date?.seconds ? new Date(m.date.seconds * 1000) : new Date(m.date);
                              const pad = (num: number) => String(num).padStart(2, "0");
                              const formatted = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;

                              resetMatch({
                                seasonId: m.seasonId || "",
                                rival: m.rival || "",
                                competition: m.competition || "Liga",
                                date: formatted,
                                goalsFor: m.goalsFor ?? undefined,
                                goalsAgainst: m.goalsAgainst ?? undefined,
                              });
                              setMatchEvents(m.events || []);

                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", background: "rgba(108, 171, 221, 0.1)", border: "1px solid rgba(108, 171, 221, 0.3)", color: "var(--accent-cyan)" }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={deleteMatch.isPending}
                            onClick={() => {
                              if (window.confirm(`¿Estás seguro de que quieres eliminar el partido contra "${m.rival}"?`)) {
                                deleteMatch.mutate(m.id, {
                                  onSuccess: () => {
                                    notifySuccess("¡Partido eliminado correctamente!");
                                    if (editingMatchId === m.id) {
                                      setEditingMatchId(null);
                                      setMatchEvents([]);
                                      resetMatch({ seasonId: "", rival: "", competition: "Liga", date: "", goalsFor: undefined, goalsAgainst: undefined });
                                    }
                                  },
                                  onError: (err: unknown) => {
                                    notifyError("Error al eliminar el partido: " + (err instanceof Error ? err.message : String(err)));
                                  },
                                });
                              }
                            }}
                            className="btn btn-secondary"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", background: "rgba(196, 47, 35, 0.1)", border: "1px solid rgba(196, 47, 35, 0.3)", color: "var(--accent-red)" }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
          )}
        </div>
      )}

      {/* TAB CONTENT: 2. INSCRIBIR JUGADOR (ROSTER) */}
      {activeTab === "roster" && (
        <div className="card fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.25rem" }}>
              Inscribir Jugador en Plantilla
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              Registra un nuevo miembro del Manchester Piti con sus datos personales y dorsal.
            </p>
          </div>

          <form onSubmit={handlePlayerSubmit(onPlayerSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Name fields */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ej: Adrián"
                  {...registerPlayer("firstName")}
                  aria-invalid={!!playerErrors.firstName}
                  aria-describedby={playerErrors.firstName ? "player-firstname-error" : undefined}
                />
                {playerErrors.firstName && (
                  <span id="player-firstname-error" role="alert" style={{ display: "block", fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "0.25rem" }}>
                    {playerErrors.firstName.message}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Apellidos</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ej: Gómez"
                  {...registerPlayer("lastName")}
                />
              </div>
            </div>

            {/* Shirt details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Nombre en Camiseta (Por Defecto)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ej: ADRI"
                  maxLength={12}
                  {...registerPlayer("shirtName")}
                  aria-invalid={!!playerErrors.shirtName}
                  aria-describedby={playerErrors.shirtName ? "player-shirtname-error" : undefined}
                />
                {playerErrors.shirtName && (
                  <span id="player-shirtname-error" role="alert" style={{ display: "block", fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "0.25rem" }}>
                    {playerErrors.shirtName.message}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Dorsal (Por Defecto)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="ej: 10"
                  {...registerPlayer("number", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })}
                  aria-invalid={!!playerErrors.number}
                  aria-describedby={playerErrors.number ? "player-number-error" : undefined}
                />
                {playerErrors.number && (
                  <span id="player-number-error" role="alert" style={{ display: "block", fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "0.25rem" }}>
                    {playerErrors.number.message}
                  </span>
                )}
              </div>
            </div>

            {/* DOB & Seasons Selector */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Fecha de Nacimiento</label>
                <input
                  type="date"
                  className="form-input"
                  {...registerPlayer("birthDate")}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Temporadas en que participa</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.5rem 0" }}>
                  {seasons.map(s => {
                    const isSelected = playerSeasons.includes(s.id);
                    return (
                      <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "0.5rem" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPlayerSeasons([...playerSeasons, s.id]);
                                // Pre-fill with global defaults if available
                                setSeasonDetailsState(prev => ({
                                  ...prev,
                                  [s.id]: prev[s.id] || { shirtName: getPlayerValues("shirtName") || "", number: getPlayerValues("number") ?? "" }
                                }));
                              } else {
                                setPlayerSeasons(playerSeasons.filter(id => id !== s.id));
                              }
                            }}
                          />
                          <span>{s.name}</span>
                        </label>
                        {isSelected && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.25rem", paddingLeft: "1.25rem" }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Nombre en Camiseta</label>
                              <input
                                type="text"
                                className="form-input"
                                style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem" }}
                                placeholder="ej: ADRI"
                                value={seasonDetailsState[s.id]?.shirtName || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSeasonDetailsState(prev => ({
                                    ...prev,
                                    [s.id]: {
                                      ...prev[s.id] || { number: 0 },
                                      shirtName: val
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Dorsal</label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem" }}
                                placeholder="ej: 10"
                                value={seasonDetailsState[s.id]?.number ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : parseInt(e.target.value);
                                  setSeasonDetailsState(prev => ({
                                    ...prev,
                                    [s.id]: {
                                      ...prev[s.id] || { shirtName: "" },
                                      number: val
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {seasons.length === 0 && (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                      No hay temporadas creadas.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Physical parameters */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Altura (cm)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="178"
                  {...registerPlayer("height", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Peso (kg)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="72"
                  {...registerPlayer("weight", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={upsertPlayer.isPending || playerSubmitting}
                style={{ flex: 1 }}
              >
                {editingPlayerId ? "Guardar Cambios" : "Registrar Jugador"}
              </button>
              {editingPlayerId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ border: "1px solid var(--accent-red)", color: "var(--accent-red)" }}
                  onClick={() => {
                    setEditingPlayerId(null);
                    resetPlayer({ firstName: "", lastName: "", shirtName: "", number: undefined, birthDate: "", height: undefined, weight: undefined });
                    setPlayerSeasons([]);
                    setSeasonDetailsState({});
                  }}
                >
                  Cancelar Edición
                </button>
              )}
            </div>
          </form>

          {/* Roster Listing for fast review */}
          <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              Miembros Registrados ({players.length})
            </h4>
            {players.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                Sin jugadores en el equipo.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {players.map(p => (
                  <div 
                    key={p.id}
                    style={{
                      background: "rgba(255, 255, 255, 0.01)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "0.5rem",
                      padding: "0.5rem 1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <span 
                      style={{ 
                        fontSize: "0.85rem", 
                        textTransform: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem"
                      }}
                    >
                      <strong style={{ color: "var(--accent-cyan)", fontSize: "0.95rem" }}>#{p.number}</strong> 
                      <span style={{ fontWeight: 700 }}>{p.firstName} {p.lastName}</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>("{p.shirtName}")</span>
                    </span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPlayerId(p.id);
                          resetPlayer({
                            firstName: p.firstName || "",
                            lastName: p.lastName || "",
                            shirtName: p.shirtName || "",
                            number: p.number ?? undefined,
                            birthDate: p.birthDate || "",
                            height: p.height ?? undefined,
                            weight: p.weight ?? undefined,
                          });
                          setPlayerSeasons(p.seasons || []);

                          const details: Record<string, { shirtName: string; number: number | "" }> = {};
                          if (p.seasonDetails) {
                            Object.entries(p.seasonDetails).forEach(([sId, data]: [string, { shirtName: string; number: number }]) => {
                              details[sId] = {
                                shirtName: data.shirtName || "",
                                number: data.number ?? ""
                              };
                            });
                          }
                          setSeasonDetailsState(details);
                          
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", background: "rgba(108, 171, 221, 0.1)", border: "1px solid rgba(108, 171, 221, 0.3)", color: "var(--accent-cyan)" }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={deletePlayer.isPending}
                        onClick={() => {
                          if (window.confirm(`¿Estás seguro de que quieres eliminar a ${p.firstName} ${p.lastName} de la plantilla?`)) {
                            deletePlayer.mutate(p.id, {
                              onSuccess: () => {
                                notifySuccess("¡Jugador eliminado correctamente!");
                                if (editingPlayerId === p.id) {
                                  setEditingPlayerId(null);
                                  resetPlayer({ firstName: "", lastName: "", shirtName: "", number: undefined, birthDate: "", height: undefined, weight: undefined });
                                  setPlayerSeasons([]);
                                  setSeasonDetailsState({});
                                }
                              },
                              onError: (err: unknown) => {
                                notifyError("Error al eliminar jugador: " + (err instanceof Error ? err.message : String(err)));
                              },
                            });
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", background: "rgba(196, 47, 35, 0.1)", border: "1px solid rgba(196, 47, 35, 0.3)", color: "var(--accent-red)" }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB CONTENT: 3. GESTIONAR TEMPORADAS */}
      {activeTab === "seasons" && (
        <div className="card fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.25rem" }}>
              {editingSeasonId ? "Editar Temporada" : "Crear Nueva Temporada"}
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              {editingSeasonId ? "Modifica el nombre de la temporada seleccionada." : "Agrega una temporada para agrupar partidos y ver estadísticas segmentadas."}
            </p>
          </div>

          <form onSubmit={handleSeasonSubmit(onSeasonSubmit)} style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0, minWidth: "200px" }}>
              <label className="form-label">Nombre de la Temporada</label>
              <input
                type="text"
                className="form-input"
                placeholder="ej: Temporada 1, Temporada 2026..."
                {...registerSeason("name")}
                aria-invalid={!!seasonErrors.name}
                aria-describedby={seasonErrors.name ? "season-name-error" : undefined}
              />
              {seasonErrors.name && (
                <span id="season-name-error" role="alert" style={{ display: "block", fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "0.25rem" }}>
                  {seasonErrors.name.message}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={seasonSubmitting}
                style={{ gap: "0.35rem" }}
              >
                {editingSeasonId ? "Guardar Cambios" : <><PlusCircle size={16} />Crear Temporada</>}
              </button>
              {editingSeasonId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ border: "1px solid var(--accent-red)", color: "var(--accent-red)" }}
                  onClick={() => {
                    setEditingSeasonId(null);
                    resetSeason({ name: "" });
                    setSeasonCaptainId("");
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {editingSeasonId && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="season-captain">Capitán de la temporada</label>
              <select
                id="season-captain"
                className="form-input"
                value={seasonCaptainId}
                onChange={(e) => setSeasonCaptainId(e.target.value)}
              >
                <option value="">— Sin capitán —</option>
                {players
                  .filter((p) => (p.seasons || []).includes(editingSeasonId!))
                  .map((p) => ({ p, num: p.seasonDetails?.[editingSeasonId!]?.number ?? p.number }))
                  .sort((a, b) => a.num - b.num)
                  .map(({ p, num }) => (
                    <option key={p.id} value={p.id}>#{num} · {p.firstName} {p.lastName}</option>
                  ))}
              </select>
              <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                Recibe la mención dorada en la Plantilla cuando la temporada aún no tiene goleador. Recuerda pulsar "Guardar Cambios".
              </span>
            </div>
          )}

          {/* List of existing seasons */}
          <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              Temporadas Registradas ({seasons.length})
            </h4>
            {seasons.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                No hay temporadas configuradas aún.
              </p>
            ) : (
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {seasons.map(s => (
                  <li 
                    key={s.id} 
                    style={{ 
                      padding: "0.75rem 1rem", 
                      background: "rgba(255,255,255,0.02)", 
                      border: "1px solid var(--border-color)", 
                      borderRadius: "0.5rem",
                      fontSize: "0.9rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <strong>{s.name}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.75rem" }}>ID: {s.id}</span>
                      {(() => {
                        const cap = s.captainPlayerId ? players.find((p) => p.id === s.captainPlayerId) : null;
                        return cap ? (
                          <span style={{ display: "block", fontSize: "0.75rem", color: "var(--accent-gold)", marginTop: "0.2rem", fontWeight: 600 }}>
                            Capitán: {cap.firstName} {cap.lastName}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSeasonId(s.id);
                          resetSeason({ name: s.name });
                          setSeasonCaptainId(s.captainPlayerId || "");
                        }}
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", background: "rgba(108, 171, 221, 0.1)", border: "1px solid rgba(108, 171, 221, 0.3)", color: "var(--accent-cyan)" }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={deleteSeason.isPending}
                        onClick={() => {
                          if (window.confirm(`¿Estás seguro de que quieres eliminar la temporada "${s.name}"? Los partidos e inscripciones asociados a ella quedarán huérfanos.`)) {
                            deleteSeason.mutate(s.id, {
                              onSuccess: () => {
                                notifySuccess("¡Temporada eliminada correctamente!");
                                if (editingSeasonId === s.id) {
                                  setEditingSeasonId(null);
                                  resetSeason({ name: "" });
                                  setSeasonCaptainId("");
                                }
                              },
                              onError: (err: unknown) => {
                                notifyError("Error al eliminar temporada: " + (err instanceof Error ? err.message : String(err)));
                              },
                            });
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", background: "rgba(196, 47, 35, 0.1)", border: "1px solid rgba(196, 47, 35, 0.3)", color: "var(--accent-red)" }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      )}

      {/* TAB CONTENT: 4. GESTIONAR ADMINS */}
      {activeTab === "admins" && (
        <div className="card fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.25rem" }}>
              Asignación de Administradores
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              El Administrador Supremo y los administradores pueden promover otros usuarios para gestionar el club.
            </p>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nickname</th>
                  <th>Correo Electrónico</th>
                  <th>Rol Actual</th>
                  <th style={{ textAlign: "center" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((usr) => {
                  const isSuperAdmin = usr.email === "adriantomascv@gmail.com";
                  
                  return (
                    <tr key={usr.uid}>
                      <td style={{ fontWeight: 700 }}>@{usr.nickname}</td>
                      <td>{usr.email}</td>
                      <td>
                        {isSuperAdmin ? (
                          <span className="badge badge-warning" style={{ border: "1px solid var(--accent-gold)" }}>Super Admin</span>
                        ) : usr.role === "admin" ? (
                          <span className="badge badge-info">Admin</span>
                        ) : (
                          <span className="badge badge-secondary" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>Usuario</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {isSuperAdmin ? (
                          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>Protegido</span>
                        ) : (
                          <select
                            value={usr.role === "admin" ? "admin" : "user"}
                            onChange={async (e) => {
                              try {
                                const newRole = e.target.value as "admin" | "user";
                                await updateUserRole(usr.uid, usr.email, newRole);
                                notifySuccess(`Rol de @${usr.nickname} actualizado a ${newRole === "admin" ? "Administrador" : "Usuario"}.`);
                              } catch (err: unknown) {
                                notifyError((err instanceof Error ? err.message : "") || "Error al actualizar rol.");
                              }
                            }}
                            style={{
                              background: "var(--bg-tertiary)",
                              border: "1px solid var(--border-color)",
                              borderRadius: "0.375rem",
                              padding: "0.25rem 0.5rem",
                              color: "var(--text-primary)",
                              fontFamily: "var(--font-sans)",
                              fontSize: "0.85rem",
                              cursor: "pointer"
                            }}
                          >
                            <option value="user">Usuario</option>
                            <option value="admin">Administrador</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {usersList.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                      No hay usuarios registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
