// The one contract every place of «Tú» is mounted with (tu/places/<Place>.tsx): the shell (ProfilePage → Member)
// builds it once and passes it whole. A place draws its body only: the frame, the card stage / masthead, the bar
// (PlaceNav), the seal, the loading and error states and the toast are the shell's.
import type { PositionSet } from "../../../../lib/positions";
import type { TuMaqueta } from "../../../../components/vidrio/tu/maqueta";
import type { AttrKey } from "../../../../lib/derived/card";
import type { ProfileData } from "../../useProfileData";
import type { Me } from "../me";
import type { Pending } from "../usePending";
import type { CardModel } from "../TuCard";
import type { Screen, Who } from "../model";

/** The member's writes the places use (callables and Firestore writes; errors are thrown to the caller). */
export interface TuActions {
  setShirtName: (name: string) => Promise<{ shirtName: string; previous: string }>;
  setNickname: (nickname: string) => Promise<string>;
  nicknameTaken: (nick: string) => Promise<boolean>;
  cancelClaim: () => Promise<void>;
  requestClaim: (playerId: string) => Promise<{ linked: boolean }>;
  proposePositions: (set: PositionSet | null) => Promise<void>;
  signOut: () => Promise<void>;
  leaveVestuario: () => Promise<void>;
}

/** Moves to another screen (a place, an Ajustes section, or the studio / the cromos over a place): a View
 *  Transition with the address as a history entry. `search`: the new address's query (?temporada=, ?j=, ?salir=);
 *  `hash`: its #fragment (#porra). */
export type Go = (to: Screen, opts?: { replace?: boolean; search?: Record<string, string>; hash?: string }) => void;

/** The toast: `say(text)`; with `undo` it carries «Deshacer» (the toast calls it once if tapped). */
export type Say = (text: string, undo?: () => void) => void;

/** The card the shell draws (the stage on Tú, the mini card elsewhere) and what a place may ask of it. */
export interface CardState {
  model: CardModel;
  /** Its accessible name (cardAria). */
  aria: string;
  flip: boolean;
  setFlip: (f: boolean) => void;
  /** Plays the walkout again («Repetir la salida de la carta»). */
  replay: () => void;
  /** The walkout's run counter (a change restarts it). */
  run: number;
  /** The name being typed in Ajustes › Tu nombre, printed on the card until it is stamped (null: none). */
  typed: string | null;
  setTyped: (t: string | null) => void;
  /** window.location.origin (the QR and the share links). */
  origin: string;
  /** The attribute sheet «De qué está hecho» the card's buttons open (GOL ASI MIN PJ MVP FOR); null: closed. */
  attr: AttrKey | null;
  setAttr: (k: AttrKey | null) => void;
}

/** The address's query a place reads (already validated by the router). */
export interface PlaceQuery {
  /** Tus partidos: another season (?temporada=); undefined: the current one. */
  temporada?: string;
  /** Tus partidos: the jornada in focus (?j=). */
  j?: number;
  /** Ajustes › Cuenta: open the «Salir» confirmation (?salir=1). */
  salir?: boolean;
  /** The #fragment (#porra). */
  hash: string;
}

/** What every place gets. */
export interface PlaceProps {
  /** The profile (useProfileData): identity, ficha, card, positions, access, captain, raw reads (`data.raw`). */
  data: ProfileData;
  /** His derived season (tu/me buildMe) for the CURRENT season; a place showing another season builds its own
   *  with buildMe({ …, seasonId, matches: data.raw.matches, … }). */
  me: Me;
  /** «Lo que te toca» (tu/usePending): the items with their writes, the open count, la bandeja's inbox. */
  pending: Pending;
  /** Who looks: kind (fan · socio · nuevo · jugador) and captain. */
  who: Who;
  /** The screen shown (place, Ajustes section, open surface). */
  screen: Screen;
  go: Go;
  actions: TuActions;
  say: Say;
  /** The page's clock (ms, ticks every minute). */
  now: number;
  /** DEV only: the ?quien= maqueta (components/vidrio/tu/maqueta). */
  maq: TuMaqueta | null;
  card: CardState;
  query: PlaceQuery;
}
