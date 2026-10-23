// «La caja» block (CL- boards part-vestuario vx.g.caja), in words (pure): his saldo card («Debes 5,00 €» /
// «Pago avisado» / «Al día» / «Sin ficha todavía» and its line), the bote, his movements and the team's
// balances, the way the board says them. The sums are derived/caja's (the same as the admin's).
import { balanceOf, balanceRows, balanceState, dayLabel, fmtEuros, jarBalance, KIND_LABEL, sortMovs, type BalancePlayer, type BalanceState, type CajaMov, type CajaSettings } from "../../../lib/derived/caja";
import { cuotaLine, howToPayText, myBalanceText, myMovs, signedAmount } from "../../../lib/derived/cajaMember";

export const CAJA_CLOSED_LINE = "La caja aún no está abierta: la abre un capitán en la sala de control.";
export const CAJA_CLAIMED_LINE = "Avisado. El capitán lo apunta en la caja y tu saldo se pone al día.";
/** The concept of a «Ya la he pagado» from the vestuario (the same as the account panel's). */
export const CAJA_CLAIM_CONCEPT = "Lo que faltaba de la caja";

export interface CajaMeCard {
  /** `is-debe` while he owes (the board's ring), else "". */
  cls: string;
  state: string;
  line: string;
  /** «Ya la he pagado» is offered (he owes and has not said he paid). */
  canClaim: boolean;
  /** He said he paid and no captain has answered yet. */
  claimed: boolean;
  /** What he owes, in cents (0 when nothing). */
  owed: number;
}

/** His saldo card. `claimed`: a pending «Ya la he pagado» (or one just sent). */
export function cajaMe(movs: readonly CajaMov[], playerId: string | null, claimed: boolean): CajaMeCard {
  if (!playerId) return { cls: "", state: "Sin ficha todavía", line: "Cuando tu ficha esté vinculada verás aquí tu saldo.", canClaim: false, claimed: false, owed: 0 };
  const bal = balanceOf(movs, playerId);
  const st = balanceState(bal);
  if (claimed) return { cls: "", state: "Pago avisado", line: "Esperando a que el capitán lo apunte.", canClaim: false, claimed: true, owed: Math.max(0, -bal) };
  if (st === "debe") {
    const last = sortMovs(movs.filter((m) => !m.void && m.kind === "cargo" && m.playerId === playerId))[0];
    const line = last ? [last.concept || KIND_LABEL.cargo, last.date ? dayLabel(last.date) : ""].filter(Boolean).join(", ") : "Págalo cuando puedas.";
    return { cls: "is-debe", state: myBalanceText(bal), line, canClaim: true, claimed: false, owed: -bal };
  }
  if (st === "a-favor") return { cls: "", state: myBalanceText(bal), line: `Tienes ${fmtEuros(bal)} a favor.`, canClaim: false, claimed: false, owed: 0 };
  return { cls: "", state: "Al día", line: "No debes nada.", canClaim: false, claimed: false, owed: 0 };
}

export interface CajaMovRow {
  id: string;
  t: string;
  a: string;
  d: string;
  void: boolean;
}
/** His movements, newest first (void ones stay, crossed out in the page). */
export const cajaMovRows = (movs: readonly CajaMov[], playerId: string | null): CajaMovRow[] =>
  myMovs(movs, playerId).map((m) => ({ id: m.id, t: m.concept || KIND_LABEL[m.kind], a: signedAmount(m), d: dayLabel(m.date), void: m.void }));

/** A team row's word, as the board says it: «debe 5,00 €», «al día», «a favor 3,00 €». */
export function teamWord(state: BalanceState, cents: number): string {
  if (state === "debe") return `debe ${fmtEuros(-cents)}`;
  return state === "a-favor" ? `a favor ${fmtEuros(cents)}` : "al día";
}
export interface CajaTeamRow {
  id: string;
  name: string;
  word: string;
  you: boolean;
  owes: boolean;
}
export function cajaTeam(movs: readonly CajaMov[], squad: readonly BalancePlayer[], nameOf: (id: string) => string, playerId: string | null) {
  const rows: CajaTeamRow[] = balanceRows(movs, squad, nameOf).map((r) => ({ id: r.id, name: r.name, word: teamWord(r.state, r.balance), you: r.id === playerId, owes: r.state === "debe" }));
  const debtors = rows.filter((r) => r.owes).length;
  const line = debtors ? `${debtors === 1 ? "1 debe" : `${debtors} deben`} · primero quien debe` : "Nadie debe nada";
  return { rows, line };
}

/** The bote: the jar, the cuota line («Cuota: 30,00 € por temporada.») and «Cómo pagar». */
export function cajaPot(movs: readonly CajaMov[], settings: CajaSettings) {
  const cuota = cuotaLine(settings);
  return { bote: fmtEuros(jarBalance(movs)), cuota: cuota ? `${cuota}.` : null, pay: howToPayText(settings) || "Pregunta a un capitán cómo pagar." };
}
