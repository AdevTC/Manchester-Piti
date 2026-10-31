import type { CardModel } from "../TuCard";

/** The class of the card's metal (`is-bronce`, `is-oro`, `is-racha`, `is-nuevo`; a carné or a sobre `is-socio`). */
export const tierCls = (card: CardModel): string => (card.kind === "face" ? `is-${card.tier === "down" || card.tier === "pack" ? "nuevo" : card.tier}` : "is-socio");
