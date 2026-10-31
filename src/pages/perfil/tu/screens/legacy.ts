// Today's screens (Carta, Temporada, Posiciones, Nombre, Ajustes, Cuenta, Capitanía, Porra) while the four places
// replace them: the props they were written for and their old titles/lines. The placeholder places
// (tu/places/*) mount them through `legacyProps`; each place agent ports its screen's logic into its place and
// deletes what it no longer uses. Nothing new should import this file.
import type { Kind } from "../model";
import type { PlaceProps } from "../places/types";

/** What every one of today's screens gets (the old MiPagina's ScreenProps). */
export type ScreenProps = Pick<PlaceProps, "data" | "who" | "go" | "actions" | "now" | "maq"> & {
  say: (t: string) => void;
  /** The card's flip and walkout (the shell owns them now). */
  flip: boolean;
  setFlip: (f: boolean) => void;
  replay: () => void;
  run: number;
  /** «Tu nombre» prints what you type on the card too, until it is stamped. */
  typed: string | null;
  setTyped: (t: string | null) => void;
  origin: string;
};

/** A place's props as today's screens want them. */
export function legacyProps(p: PlaceProps): ScreenProps {
  return {
    data: p.data,
    who: p.who,
    go: p.go,
    actions: p.actions,
    now: p.now,
    maq: p.maq,
    say: (t) => p.say(t),
    flip: p.card.flip,
    setFlip: p.card.setFlip,
    replay: p.card.replay,
    run: p.card.run,
    typed: p.card.typed,
    setTyped: p.card.setTyped,
    origin: p.card.origin,
  };
}

type OldSec = "carta" | "temporada" | "posiciones" | "nombre" | "ajustes" | "cuenta" | "capitania";

/** The old screens' names (the socio's carta is his carné, his «nombre» his apodo). */
export function secLabel(id: OldSec, kind: Kind): string {
  switch (id) {
    case "carta":
      return kind === "socio" ? "Tu carné" : "Tu carta";
    case "temporada":
      return "Temporada";
    case "posiciones":
      return "Posiciones";
    case "nombre":
      return kind === "socio" ? "Tu apodo" : "Tu nombre";
    case "ajustes":
      return "Ajustes";
    case "cuenta":
      return "Cuenta";
    case "capitania":
      return "Capitanía";
  }
}

/** The old screens' line under their title. */
export function secDesc(id: OldSec, kind: Kind, pack: boolean): string {
  switch (id) {
    case "carta":
      return kind === "socio" ? "Lo que el club sabe de ti y desde cuándo." : kind === "nuevo" ? (pack ? "Tu petición, mientras el capitán la mira." : "Elige tu dorsal: el capitán lo confirma.") : "Lo que dice tu carta y cómo mejora.";
    case "temporada":
      return "Tus partidos, tus minutos y lo tuyo en el vestuario.";
    case "posiciones":
      return "Dónde has jugado y dónde quieres jugar.";
    case "nombre":
      return kind === "socio" ? "Así te ven en la porra, el MVP y el vestuario." : "El que llevas a la espalda y el que usas en el vestuario.";
    case "ajustes":
      return "Cómo se ve y cómo suena la web en este móvil. Se guarda solo.";
    case "cuenta":
      return "Tu Google, tu acceso, salir y tus datos.";
    case "capitania":
      return "Lo que solo ves tú como capitán.";
  }
}
