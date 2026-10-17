// La mesa's view contract: what useMesa (the data: match, scorers, presence, offline queue, clock) hands to
// every screen (Antes, En juego, Lo que va pasando, Descanso, Final). The screens are presentational: they
// read a `MesaView` and call its `actions`; nothing in them talks to Firestore or the callables.
import type { EventType } from "../../../functions/src/matchEngine";
import type { MesaType } from "../../../functions/src/liveRules";
import type { ClockAction } from "../../../functions/src/matchClock";

export type { MesaType, ClockAction };
export type MesaPhase = "ready" | "first" | "halftime" | "second" | "ended";
/** Which screen la mesa shows: the phase picks it, `?vista=cronica` asks for «Lo que va pasando». */
export type MesaScreen = "antes" | "enjuego" | "descanso" | "final" | "cronica";

/** The server clock as la mesa reads it (functions/src/matchClock clockReading, plus the mesa's hold). */
export interface MesaClock {
  phase: MesaPhase;
  /** The ball is rolling: a half is on and it is not held. */
  playing: boolean;
  /** «Pausa» inside a half (`clock.heldAt`): the clock stands still, subs and cards still go in. */
  held: boolean;
  /** Seconds of play in the whole match (holds and the break never count). */
  elapsedSeconds: number;
  /** Seconds of play in the current half (the first one until the 2ª starts). */
  periodSeconds: number;
  period: 1 | 2;
  /** The configured length of a half, in seconds (the progress bar runs to it; «Fin de la 1ª» is suggested there). */
  halfSeconds: number;
  /** The stoppage-time label of the current half, in minutes (0 = none). A label only. */
  added: number;
  /** The minute people read now (football's, 1-based). */
  minute: number;
  /** «18:42», the half's own clock as the LED shows it. */
  text: string;
  revision: number;
}

export interface MesaMatch {
  id: string;
  seasonId: string;
  rival: string;
  /** «ATL»: `rivalShort` or the first 3 letters of the rival's main word. */
  rivalShort: string;
  /** The rival crest's letters («AD»). */
  rivalInitials: string;
  competition: string;
  home: boolean;
  /** Kick-off (ms), as scheduled. */
  date: number;
  /** The score as everyone sees it: duplicates pending a decision count once; queued plays not included. */
  score: { us: number; them: number };
  /** Goals still in this phone's queue (shown as a mark on the score, not in it). */
  queuedGoals: { us: number; them: number };
  clock: MesaClock;
  /** The acta is published (status finished): only an admin reopens it. */
  published: boolean;
  /** Some duplicate is still waiting for «Es el mismo» / «Son dos» (publishing is blocked). */
  pendingDuplicates: number;
}

export interface MesaStickers {
  goals: number;
  assists: number;
  yellow: boolean;
  red: boolean;
  injured: boolean;
}

/** One stint on the pitch, in seconds of play (`to` null = still on). Descanso's «Quién ha jugado». */
export interface MesaStint {
  from: number;
  to: number | null;
}

export interface MesaPlayer {
  id: string;
  name: string;
  /** The dorsal as printed («7»; "" when none). */
  number: string;
  guest: boolean;
  keeper: boolean;
  /** Whole minutes played so far. */
  minutes: number;
  stickers: MesaStickers;
  /** Plays about him still in this phone's queue (the «↓N» badge). */
  pending: number;
  /** Has played at all (bench: «fuera N′» vs «sin jugar»). */
  played: boolean;
  /** Bench only: the minute he came off (null if never on). */
  offAt: number | null;
  /** Sent off: on the bench list but cannot come back. */
  sentOff: boolean;
  stints: MesaStint[];
  /** Field only: where his shirt stands, in % of the pitch (x 0 → 100 left → right, y 0 = their goal → 100 = ours). */
  spot: { x: number; y: number } | null;
}

export interface MesaEvent {
  id: string;
  type: EventType;
  side: "us" | "them";
  /** The minute shown (football's), null when unknown. */
  minute: number | null;
  elapsedSeconds: number | null;
  period: 1 | 2;
  playerId: string | null;
  playerName: string | null;
  assistId: string | null;
  assistName: string | null;
  inPlayerId: string | null;
  inName: string | null;
  /** «Gol de Mario, asistencia de Pablo», «Entra Hugo, sale Pablo», «Falta de Atlético». */
  text: string;
  /** The lower third's key: «GOL», «FALTA», «GOL ATL». */
  tag: string;
  /** A goal of ours / theirs (counts on the score). */
  goal: "us" | "them" | null;
  /** «Lo apunto luego»: a goal of ours without its scorer yet. */
  pendingScorer: boolean;
  byUid: string | null;
  byName: string | null;
  editedByUid: string | null;
  editedByName: string | null;
  editedAt: number | null;
  /** The earlier event this one may duplicate, while nobody has said «Son dos». */
  dupOf: string | null;
  /** Uploaded later from a phone's offline queue. */
  queued: boolean;
  /** Still only on this phone (in the queue, not on the server yet). */
  local: boolean;
  /** Written by me (this uid). */
  mine: boolean;
}

export interface MesaPresence {
  uid: string;
  name: string;
  /** Last heartbeat (ms, server time). */
  at: number;
  /** Heartbeat within the last 75 s. */
  fresh: boolean;
  me: boolean;
}

export interface MesaQueueItem {
  requestId: string;
  type: MesaType;
  text: string;
  playerId: string | null;
  minute: number;
  createdAt: number;
  status: "pending" | "sending";
}

/** A queued play the server refused: fix player/minute and resend, or discard. */
export interface MesaReviewItem {
  requestId: string;
  type: MesaType;
  text: string;
  playerId: string | null;
  minute: number;
  /** The server's reason, in Spanish. */
  reason: string;
}

export interface MesaQueueState {
  online: boolean;
  /** Plays waiting to go up (items.length). */
  pending: number;
  /** Pending plays per player id. */
  byPlayer: Record<string, number>;
  items: MesaQueueItem[];
  /** «Por revisar». */
  review: MesaReviewItem[];
  /** When it last tried to upload (ms), null if never. */
  lastTryAt: number | null;
}

export interface MesaAddOpts {
  playerId?: string;
  assistPlayerId?: string;
  inPlayerId?: string;
}

export interface MesaEditPatch {
  type?: MesaType;
  playerId?: string;
  assistPlayerId?: string;
  inPlayerId?: string;
  elapsedSeconds?: number;
  dupOk?: boolean;
}

export interface MesaActions {
  /** Enters a play now (offline-safe: through the queue). Returns its event id (`live-${requestId}`). */
  add(type: MesaType, opts?: MesaAddOpts): string;
  /** Fixes any play (player, assist, who came in, type, minute; «Son dos» = { dupOk: true }). */
  edit(id: string, patch: MesaEditPatch): Promise<void>;
  /** Deletes any play («Borrar», «Es el mismo»). A play still in the queue is just dropped. */
  remove(id: string): Promise<void>;
  /** The lower third's «Deshacer»: deletes the play I just entered. */
  undo(): Promise<void>;
  clock(action: ClockAction, value?: number): Promise<void>;
  /** Publishes the acta from the live record; `assists` answers «¿Le dio el pase alguien?» (eventId → playerId, "" = nadie). */
  publish(assists?: Record<string, string>): Promise<void>;
  /** «Reabrir el partido»: undoes the final whistle (before the acta is published). */
  reopen(): Promise<void>;
  /** «Por revisar»: resend with a fixed player and/or minute, or discard. */
  resend(requestId: string, fix: { playerId?: string; minute?: number }): void;
  discard(requestId: string): void;
  /** «Sin red» chip: try the upload now. */
  retryNow(): void;
}

/** Where la mesa can take you (router navigation, kept out of the screens). */
export interface MesaNav {
  /** «Lo que va pasando» (`?vista=cronica`). */
  cronica(): void;
  /** Back to the phase's own screen (drops `vista`). */
  mesa(): void;
  /** Leave la mesa for the match page. */
  exit(): void;
  /** The pizarra of this match («Preparar el siete de la 2ª»). */
  pizarra(): void;
}

export interface MesaView {
  match: MesaMatch;
  /** On the pitch now, in formation order (keeper first when known). */
  field: MesaPlayer[];
  /** Called up and not on the pitch (sent-off players included, flagged). */
  bench: MesaPlayer[];
  /** Every play, oldest first, this phone's queued ones included (`local`). */
  events: MesaEvent[];
  /** Everyone with la mesa open (me included, flagged). */
  presence: MesaPresence[];
  me: { uid: string; name: string; admin: boolean };
  queue: MesaQueueState;
  /** The play I just entered (the lower third), null when none. */
  lastOwn: MesaEvent | null;
  /** The pizarra's next planned sub («Toca: entra Hugo por Pablo»), null when none. */
  nextSub: { inId: string; outId: string; inName: string; outName: string } | null;
  nameOf(id: string): string;
  /** A short message to show (a refused clock action, a failed publish); "" when none. */
  notice: string;
  actions: MesaActions;
  nav: MesaNav;
}

/** Every mesa screen takes the view and nothing else. */
export interface MesaScreenProps {
  view: MesaView;
}
