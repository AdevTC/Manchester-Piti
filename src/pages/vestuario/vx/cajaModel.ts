// «La caja» room (/vestuario/caja, the canvas prototype's SalaCaja.dc.html), in words (pure): the room's title (its
// status: «Debes 12,50 €», «Pago avisado», «Al día · 3,00 € a favor», «Estás al día», «La caja del equipo»), his saldo
// card (the amount, its word, its line), the bote, his movements with their sums and the team's balances. The sums are
// derived/caja's (the same as the admin's).
import { balanceOf, balanceRows, balanceState, dayLabel, fmtEuros, jarBalance, KIND_LABEL, movSign, sortMovs, type BalancePlayer, type BalanceState, type CajaMov, type CajaSettings } from "../../../lib/derived/caja";
import { cuotaLine, howToPayText, myMovs, signedAmount } from "../../../lib/derived/cajaMember";

export const CAJA_CLOSED_LINE = "La caja aún no está abierta: la abre un capitán en la sala de control.";
export const CAJA_CLAIMED_LINE = "El capitán lo apunta en la caja y tu saldo se pone al día.";
/** The concept of a «Ya la he pagado» from the vestuario (the same as the account panel's). */
export const CAJA_CLAIM_CONCEPT = "Lo que faltaba de la caja";
export const CAJA_NO_FICHA_LINE = "Cuando tu ficha esté vinculada verás aquí tu saldo y tus movimientos.";

export type CajaStTone = "is-ok" | "is-warn" | "is-off";

export interface CajaMeCard {
  /** `is-debe` while he owes and has not said he paid (the card's amber ring), else "". */
  cls: string;
  /** The big amount: «−12,50 €», «+3,00 €», «0,00 €», «–» without a ficha. */
  amt: string;
  /** The state in a word next to it: «Debes», «Pago avisado», «Al día», «Sin ficha todavía». */
  state: string;
  stCls: CajaStTone;
  line: string;
  /** «Ya la he pagado» is offered (he owes and has not said he paid). */
  canClaim: boolean;
  /** He said he paid and no captain has answered yet. */
  claimed: boolean;
  /** What he owes, in cents (0 when nothing). */
  owed: number;
  /** His balance in cents (0 without a ficha). */
  bal: number;
  /** His last cargo that counts, «Campo de la J2, 25 oct» (null when none). */
  lastCargo: string | null;
}

const lastOf = (movs: readonly CajaMov[], playerId: string, kind: CajaMov["kind"]) => sortMovs(movs.filter((m) => !m.void && m.kind === kind && m.playerId === playerId))[0];

/** His saldo card. `claimed`: a pending «Ya la he pagado» (or one just sent). */
export function cajaMe(movs: readonly CajaMov[], playerId: string | null, claimed: boolean): CajaMeCard {
  if (!playerId) return { cls: "", amt: "–", state: "Sin ficha todavía", stCls: "is-off", line: CAJA_NO_FICHA_LINE, canClaim: false, claimed: false, owed: 0, bal: 0, lastCargo: null };
  const bal = balanceOf(movs, playerId);
  const st = balanceState(bal);
  const cargo = lastOf(movs, playerId, "cargo");
  const lastCargo = cargo ? [cargo.concept || KIND_LABEL.cargo, cargo.date ? dayLabel(cargo.date) : ""].filter(Boolean).join(", ") : null;
  const base = { bal, lastCargo };
  if (st === "debe") {
    const owed = -bal;
    if (claimed) return { ...base, cls: "", amt: `−${fmtEuros(owed)}`, state: "Pago avisado", stCls: "is-ok", line: "Esperando a que el capitán lo apunte.", canClaim: false, claimed: true, owed };
    return { ...base, cls: "is-debe", amt: `−${fmtEuros(owed)}`, state: "Debes", stCls: "is-warn", line: lastCargo ? `${lastCargo}. Págalo cuando puedas.` : "Págalo cuando puedas.", canClaim: true, claimed: false, owed };
  }
  if (st === "a-favor") return { ...base, cls: "", amt: `+${fmtEuros(bal)}`, state: "Al día", stCls: "is-ok", line: `Tienes ${fmtEuros(bal)} a favor.`, canClaim: false, claimed: false, owed: 0 };
  const pago = lastOf(movs, playerId, "pago");
  const paid = pago ? ` Lo último que pagaste: ${fmtEuros(pago.amount)}${pago.date ? `, el ${dayLabel(pago.date)}` : ""}.` : "";
  return { ...base, cls: "", amt: fmtEuros(0), state: "Al día", stCls: "is-ok", line: `No debes nada.${paid}`, canClaim: false, claimed: false, owed: 0 };
}

export const CAJA_READ_ONLY = "Solo la lees: la llevan los capitanes.";

/** The room's title and the line under it: the caja's status for him, in words. */
export function cajaHead(me: CajaMeCard, opts: { open: boolean; socio: boolean }): { title: string; sub: string } {
  if (!opts.open) return { title: "La caja aún no está abierta", sub: CAJA_READ_ONLY };
  const sub = `${CAJA_READ_ONLY} Aquí ves lo tuyo, el bote y cómo pagar.`;
  if (opts.socio) return { title: "La caja del equipo", sub };
  if (me.claimed) return { title: "Pago avisado", sub: "Esperando a que el capitán lo apunte. Mientras, tu saldo sigue como estaba." };
  if (me.canClaim) return { title: `Debes ${fmtEuros(me.owed)}`, sub: `${me.lastCargo ? `Lo último: ${me.lastCargo}. ` : ""}Cuando pagues, avisa con «Ya la he pagado» y el capitán lo apunta.` };
  if (me.bal > 0) return { title: `Al día · ${fmtEuros(me.bal)} a favor`, sub };
  return { title: "Estás al día", sub };
}

export interface CajaMovRow {
  id: string;
  t: string;
  a: string;
  d: string;
  void: boolean;
  /** Money in (a pago): the check tile and the celeste amount. */
  plus: boolean;
}
/** His movements, newest first (void ones stay, crossed out in the page). */
export const cajaMovRows = (movs: readonly CajaMov[], playerId: string | null): CajaMovRow[] =>
  myMovs(movs, playerId).map((m) => ({ id: m.id, t: m.concept || KIND_LABEL[m.kind], a: signedAmount(m), d: dayLabel(m.date), void: m.void, plus: movSign(m.kind) > 0 }));

/** «Cargado: 37,50 €» · «Pagado: 25,00 €»: his movements that count (not the void ones). */
export function cajaMovSums(movs: readonly CajaMov[], playerId: string | null): { charged: string; paid: string } {
  let charged = 0;
  let paid = 0;
  for (const m of myMovs(movs, playerId)) {
    if (m.void) continue;
    if (movSign(m.kind) > 0) paid += m.amount;
    else charged += m.amount;
  }
  return { charged: fmtEuros(charged), paid: fmtEuros(paid) };
}

/** A team row's word, as the board says it: «debe 5,00 €», «al día», «a favor 3,00 €». */
export function teamWord(state: BalanceState, cents: number): string {
  if (state === "debe") return `debe ${fmtEuros(-cents)}`;
  return state === "a-favor" ? `a favor ${fmtEuros(cents)}` : "al día";
}
export interface CajaTeamRow {
  id: string;
  name: string;
  /** The dorsal for the printed shirt ("" when none). */
  num: string;
  word: string;
  state: BalanceState;
  you: boolean;
  owes: boolean;
}
export function cajaTeam(movs: readonly CajaMov[], squad: readonly BalancePlayer[], nameOf: (id: string) => string, playerId: string | null) {
  const rows: CajaTeamRow[] = balanceRows(movs, squad, nameOf).map((r) => ({ id: r.id, name: r.name, num: r.number == null ? "" : String(r.number), word: teamWord(r.state, r.balance), state: r.state, you: r.id === playerId, owes: r.state === "debe" }));
  const debtors = rows.filter((r) => r.owes).length;
  const line = debtors ? `${debtors === 1 ? "1 debe" : `${debtors} deben`} · primero quien debe` : "Nadie debe nada";
  return { rows, line };
}

/** The bote: the jar, the cuota line («Cuota: 30,00 € por temporada.») and «Cómo pagar». */
export function cajaPot(movs: readonly CajaMov[], settings: CajaSettings) {
  const cuota = cuotaLine(settings);
  return { bote: fmtEuros(jarBalance(movs)), cuota: cuota ? `${cuota}.` : null, pay: howToPayText(settings) || "Pregunta a un capitán cómo pagar." };
}
