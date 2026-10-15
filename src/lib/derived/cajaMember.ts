// The vestuario's «La caja», in words (pure): what a member reads about the team's money. The sums are
// derived/caja's (the same the admin's Caja section reads, so both add up to the cent); this only says
// them the way the vestuario does — «Debes 12,50 €», «Al día · +3,00 €» — and picks the reader's own
// movements. A state is always a word (and an icon in the page), never a colour alone.
import { balanceState, fmtEuros, movSign, sortMovs, type BalanceState, type CajaMov, type CajaSettings } from "./caja";

/** The reader's own balance, big: «Debes 12,50 €», «Al día» or «Al día · +3,00 €» (money in his favour). */
export function myBalanceText(cents: number): string {
  const st = balanceState(cents);
  if (st === "debe") return `Debes ${fmtEuros(-cents)}`;
  return st === "a-favor" ? `Al día · +${fmtEuros(cents)}` : "Al día";
}

/** The word of a balance row (with its icon in the page): «Debe», «Al día», «A favor». */
export const STATE_WORD: Record<BalanceState, string> = { debe: "Debe", "al-dia": "Al día", "a-favor": "A favor" };

/** A row's amount next to its word: what he owes («12,50 €»), what he has in favour («+3,00 €»), or
 *  nothing when he is square. */
export function rowAmount(cents: number): string {
  const st = balanceState(cents);
  if (st === "debe") return fmtEuros(-cents);
  return st === "a-favor" ? `+${fmtEuros(cents)}` : "";
}

/** A movement as its player reads it: «+20,00 €» for a pago, «−12,50 €» for a cargo. */
export const signedAmount = (m: Pick<CajaMov, "kind" | "amount">): string => `${movSign(m.kind) > 0 ? "+" : "−"}${fmtEuros(m.amount)}`;

/** A player's own movements (void ones included: they show crossed out), newest first. */
export const myMovs = (movs: readonly CajaMov[], playerId: string | null | undefined): CajaMov[] =>
  playerId ? sortMovs(movs.filter((m) => m.playerId === playerId)) : [];

/** Has a captain opened the caja: saved its settings once, or written any movement. */
export const cajaOpen = (settings: CajaSettings, movs: readonly CajaMov[]): boolean =>
  movs.length > 0 || settings.updatedAt > 0 || settings.cuota > 0 || settings.howToPay.trim() !== "";

/** «Cuota: 30,00 € por temporada» / «Cuota: 10,00 € al mes»; null without a cuota. */
export function cuotaLine(settings: Pick<CajaSettings, "cuota" | "cuotaPeriod">): string | null {
  if (settings.cuota <= 0) return null;
  return `Cuota: ${fmtEuros(settings.cuota)} ${settings.cuotaPeriod === "mensual" ? "al mes" : "por temporada"}`;
}

/** «Cómo pagar» as the captain wrote it: plain text, its line breaks kept (\r\n → \n), trimmed. */
export const howToPayText = (settings: Pick<CajaSettings, "howToPay">): string => settings.howToPay.replace(/\r\n?/g, "\n").trim();
