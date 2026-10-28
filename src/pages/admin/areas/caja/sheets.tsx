// CAJA · the caja's sheets (board part-caja.html `caja.sh`): «Cobrar la cuota», «Apuntar un pago / gasto /
// ingreso», «Ajustes de la caja», «¿Anular …?» and «¿Rechazar el pago avisado…?». Each says what it will write
// before it does (the cargos, the concept, the consequences) and refuses what the caja would get wrong (a cuota
// already charged: anular first). The money rules are derived/caja's (parseEuros, cuotaCargos, cuotaConcept,
// chargedAlready, CAJA_LIMITS), the same the sala used before r12. The write itself is the screen's (useCajaBook):
// the sheet closes and the franja says it, with «Deshacer» (Anular: no undo, it asked first).
import { useId, useState, type ReactNode } from "react";
import {
  CAJA_LIMITS,
  centsInput,
  chargedAlready,
  cuotaCargos,
  cuotaConcept,
  isPlayerKind,
  madridMonth,
  monthName,
  parseEuros,
  type BalancePlayer,
  type CajaKind,
  type CajaMov,
  type CajaSettings,
  type CuotaPeriod,
  type NewCajaMov,
} from "../../../../lib/derived/caja";
import { CLAIM_REASON_MAX, type CajaClaim } from "../../../../lib/derived/cajaClaims";
import { madridDate } from "../../../../lib/derived/madrid";
import { relativeTime } from "../../../../lib/derived/notices";
import { capital, plural } from "../../../../lib/derived/words";
import { SalaSheet } from "../../shell/Sheet";
import { dayWeek, euros, KIND_WORD, saldoText } from "./model";

/** The sheet's foot: «Cancelar» and its action (aria-disabled while it cannot go: it stays focusable). */
function Foot({ label, off, onGo, onClose }: { label: string; off: boolean; onGo: () => void; onClose: () => void }) {
  return (
    <>
      <button type="button" className="vd-btn vd-glass vd-press" onClick={onClose}>
        Cancelar
      </button>
      <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" aria-disabled={off || undefined} onClick={() => !off && onGo()}>
        {label}
      </button>
    </>
  );
}

/** An amount typed as text («12,50»), its live hint and whether it is wrong (never colour alone: «!» and words). */
function Amount({ label, value, onChange, hint, bad, placeholder = "12,50" }: { label: string; value: string; onChange: (v: string) => void; hint: string; bad: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <label className="sc-field">
      <span id={`${id}-l`}>{label}</span>
      <input className="vd-input" type="text" inputMode="decimal" autoComplete="off" aria-labelledby={`${id}-l`} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={bad || undefined} aria-describedby={`${id}-h`} />
      <small id={`${id}-h`} className={bad ? "is-bad" : ""}>
        {hint}
      </small>
    </label>
  );
}

const Cons = ({ rows }: { rows: { b: string; s?: ReactNode }[] }) => (
  <ul className="sc-rows cj-cons">
    {rows.map((r) => (
      <li className="sc-row" key={r.b}>
        <span className="sc-row__t">
          <b>{r.b}</b>
          {r.s && <span>{r.s}</span>}
        </span>
      </li>
    ))}
  </ul>
);

/** «la Temporada 1» / ««Archivo 2025/26»». */
const seasonPhrase = (name: string) => (/^temporada/i.test(name.trim()) ? `la ${name.trim()}` : `«${name.trim()}»`);

// ───────────────────────── Cobrar la cuota ─────────────────────────
export function CuotaSheet({ seasonName, settings, squad, movs, now, onClose, onGo }: { seasonName: string; settings: CajaSettings; squad: readonly BalancePlayer[]; movs: readonly CajaMov[]; now: number; onClose: () => void; onGo: (movs: NewCajaMov[], concept: string, cents: number) => void }) {
  const [amount, setAmount] = useState(settings.cuota ? centsInput(settings.cuota) : "");
  const [month, setMonth] = useState(() => madridMonth(now));
  const cents = parseEuros(amount);
  const monthly = settings.cuotaPeriod === "mensual";
  const concept = cuotaConcept(settings.cuotaPeriod, seasonName, month);
  const cargos = cuotaCargos(cents ?? 0, squad.map((p) => p.id));
  const already = chargedAlready(movs, concept);
  const ok = cents !== null && cents > 0 && cents <= CAJA_LIMITS.amount && cargos.length > 0 && !already;
  const hint = cents === null ? "Escribe el importe en euros, como «12,50»." : cents <= 0 ? "La cuota tiene que ser mayor que cero." : cents > CAJA_LIMITS.amount ? "Como mucho 100.000 €." : `Por jugador: ${euros(cents)}`;
  const go = () => {
    if (!ok || cents === null) return;
    const date = madridDate(now);
    onGo(cargos.map((c) => ({ kind: "cargo", playerId: c.playerId, amount: c.amount, concept, date, matchId: null })), concept, cents);
  };
  return (
    <SalaSheet open onClose={onClose} title="Cobrar la cuota" className="cj-sheet" footer={<Foot label={`Cobrar a ${plural(squad.length, "jugador", "jugadores")}`} off={!ok} onGo={go} onClose={onClose} />}>
      <p className="sc-p cj-sh-lede">Un cargo por jugador de la plantilla de {seasonPhrase(seasonName)}. Lo verán en su saldo del vestuario.</p>
      <div className="sc-form sc-form--1">
        <Amount label="Cuota por jugador" value={amount} onChange={setAmount} hint={hint} bad={!!amount.trim() && (cents === null || cents <= 0 || cents > CAJA_LIMITS.amount)} />
        {monthly && (
          <label className="sc-field">
            <span>Mes</span>
            <select className="vd-input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {capital(monthName(i))}
                </option>
              ))}
            </select>
          </label>
        )}
        <Cons
          rows={[
            {
              b: squad.length ? `${plural(squad.length, "cargo", "cargos")} de ${cents ? euros(cents) : "—"} · ${cents ? euros(cents * squad.length) : "—"} en total` : "Esta temporada no tiene plantilla todavía: nadie a quien cobrar.",
              s: `Concepto: «${concept}»`,
            },
          ]}
        />
        {already > 0 && (
          <p className="cj-warn" role="alert">
            <span className="sc-tag sc-tag--mal">Ya cobrada</span>«{concept}» ya está cobrada ({plural(already, "cargo", "cargos")}). Si quieres repetirla, anula antes esos cargos.
          </p>
        )}
      </div>
    </SalaSheet>
  );
}

// ───────────────────────── Apuntar un pago / gasto / ingreso ─────────────────────────
export type FreeKind = Exclude<CajaKind, "cargo">;
const MOV_TITLE: Record<FreeKind, string> = { pago: "Apuntar un pago", gasto: "Apuntar un gasto", ingreso: "Apuntar un ingreso" };
const MOV_LEDE: Record<FreeKind, string> = {
  pago: "Lo que un jugador ha pagado: baja su deuda y entra en el bote.",
  gasto: "Lo que sale del bote: balones, petos, el campo de un amistoso…",
  ingreso: "Lo que entra en el bote sin ser de un jugador: un patrocinio, una rifa…",
};
const MOV_GO: Record<FreeKind, string> = { pago: "Apuntar el pago", gasto: "Apuntar el gasto", ingreso: "Apuntar el ingreso" };
const MOV_PH: Record<FreeKind, string> = { pago: "Bizum", gasto: "Balones nuevos", ingreso: "Patrocinio del bar" };
export interface MovPreset {
  who?: string;
  amount?: string;
}
export function MovSheet({ kind, squad, balanceOf, preset, now, onClose, onGo }: { kind: FreeKind; squad: readonly BalancePlayer[]; balanceOf: (id: string) => number; preset?: MovPreset; now: number; onClose: () => void; onGo: (mov: NewCajaMov, who: string) => void }) {
  const id = useId();
  const [who, setWho] = useState(preset?.who ?? "");
  const [amount, setAmount] = useState(preset?.amount ?? "");
  const [concept, setConcept] = useState(kind === "pago" ? "Bizum" : "");
  const [date, setDate] = useState(() => madridDate(now));
  const cents = parseEuros(amount);
  const needsPlayer = isPlayerKind(kind);
  const player = squad.find((p) => p.id === who) ?? null;
  const cpt = concept.trim();
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const ok = cents !== null && cents > 0 && cents <= CAJA_LIMITS.amount && cpt.length >= 1 && concept.length <= CAJA_LIMITS.concept && dateOk && (!needsPlayer || !!player);
  const amountBad = !!amount.trim() && (cents === null || cents <= 0 || cents > CAJA_LIMITS.amount);
  const go = () => {
    if (!ok || cents === null) return;
    onGo({ kind, playerId: needsPlayer ? who : null, amount: cents, concept: cpt, date, matchId: null }, player?.name ?? "");
  };
  return (
    <SalaSheet open onClose={onClose} title={MOV_TITLE[kind]} className="cj-sheet" footer={<Foot label={MOV_GO[kind]} off={!ok} onGo={go} onClose={onClose} />}>
      <p className="sc-p cj-sh-lede">{MOV_LEDE[kind]}</p>
      <div className="sc-form sc-form--1">
        {needsPlayer && (
          <label className="sc-field">
            <span id={`${id}-wl`}>Jugador</span>
            <select className="vd-input" aria-labelledby={`${id}-wl`} value={who} onChange={(e) => setWho(e.target.value)} aria-describedby={`${id}-w`}>
              <option value="">— Elige al jugador —</option>
              {squad.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number != null ? `${p.number} · ` : ""}
                  {p.name} · {saldoText(balanceOf(p.id)).toLowerCase()}
                </option>
              ))}
            </select>
            <small id={`${id}-w`}>{player ? `Su saldo ahora: ${saldoText(balanceOf(player.id)).toLowerCase()}` : squad.length ? "Elige quién ha pagado." : "Esta temporada no tiene plantilla todavía."}</small>
          </label>
        )}
        <Amount label="Importe" value={amount} onChange={setAmount} hint={amountBad ? "Escribe el importe en euros, como «12,50»." : cents ? euros(cents) : "En euros, como «12,50»."} bad={amountBad} />
        <label className="sc-field">
          <span id={`${id}-kl`}>Concepto</span>
          <input className="vd-input" aria-labelledby={`${id}-kl`} type="text" maxLength={CAJA_LIMITS.concept + 10} autoComplete="off" placeholder={MOV_PH[kind]} value={concept} onChange={(e) => setConcept(e.target.value)} aria-describedby={`${id}-k`} aria-invalid={concept.length > CAJA_LIMITS.concept || undefined} />
          <small id={`${id}-k`} className={concept.length > CAJA_LIMITS.concept ? "is-bad" : ""}>
            {cpt.length}/{CAJA_LIMITS.concept} · como mucho {CAJA_LIMITS.concept} letras
          </small>
        </label>
        <label className="sc-field">
          <span>Fecha</span>
          <input className="vd-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
    </SalaSheet>
  );
}

// ───────────────────────── Ajustes de la caja ─────────────────────────
export function AjustesSheet({ seasonName, settings, onClose, onGo }: { seasonName: string; settings: CajaSettings; onClose: () => void; onGo: (s: Pick<CajaSettings, "cuota" | "cuotaPeriod" | "howToPay">) => void }) {
  const id = useId();
  const [amount, setAmount] = useState(settings.cuota ? centsInput(settings.cuota) : "");
  const [period, setPeriod] = useState<CuotaPeriod>(settings.cuotaPeriod);
  const [how, setHow] = useState(settings.howToPay);
  const cents = amount.trim() ? parseEuros(amount) : 0;
  const ok = cents !== null && cents <= CAJA_LIMITS.amount && how.length <= CAJA_LIMITS.howToPay;
  const bad = cents === null || cents > CAJA_LIMITS.amount;
  const go = () => ok && cents !== null && onGo({ cuota: cents, cuotaPeriod: period, howToPay: how });
  return (
    <SalaSheet open onClose={onClose} title={`Ajustes de la caja · ${seasonName}`} className="cj-sheet" footer={<Foot label="Guardar los ajustes" off={!ok} onGo={go} onClose={onClose} />}>
      <p className="sc-p cj-sh-lede">La cuota y cómo se paga: los socios lo ven igual en su caja del vestuario.</p>
      <div className="sc-form sc-form--1">
        <Amount label="Cuota por jugador" placeholder="25" value={amount} onChange={setAmount} bad={bad} hint={!amount.trim() ? "Vacía: sin cuota" : bad ? "Escribe el importe en euros, como «25»." : `Por jugador: ${euros(cents ?? 0)}`} />
        <div className="sc-field">
          <span id={`${id}-p`}>Periodo</span>
          <div className="sc-chips" role="group" aria-labelledby={`${id}-p`}>
            <button type="button" className="sc-chip vd-glass vd-press" aria-pressed={period === "temporada"} onClick={() => setPeriod("temporada")}>
              Por temporada
            </button>
            <button type="button" className="sc-chip vd-glass vd-press" aria-pressed={period === "mensual"} onClick={() => setPeriod("mensual")}>
              Mensual
            </button>
          </div>
        </div>
        <label className="sc-field">
          <span id={`${id}-hl`}>Cómo pagar</span>
          <textarea className="vd-input" aria-labelledby={`${id}-hl`} placeholder="Bizum al 600 000 000 (Adrián) o en mano al capitán" value={how} onChange={(e) => setHow(e.target.value)} aria-describedby={`${id}-h`} aria-invalid={how.length > CAJA_LIMITS.howToPay || undefined} />
          <small id={`${id}-h`} className={how.length > CAJA_LIMITS.howToPay ? "is-bad" : ""}>
            {how.length}/{CAJA_LIMITS.howToPay} · lo ven los socios al pagar (aquí no se paga nada)
          </small>
        </label>
      </div>
    </SalaSheet>
  );
}

// ───────────────────────── ¿Anular …? ─────────────────────────
export function AnularSheet({ mov, who, onClose, onGo }: { mov: CajaMov | null; who: string; onClose: () => void; onGo: () => void }) {
  if (!mov) {
    return (
      <SalaSheet open center alert onClose={onClose} title="Ese movimiento ya no está" className="cj-sheet" footer={<Foot label="Anular" off onGo={onClose} onClose={onClose} />}>
        <p className="sc-p cj-sh-lede">Puede que otro capitán lo haya anulado ya.</p>
      </SalaSheet>
    );
  }
  return (
    <SalaSheet open center alert onClose={onClose} title={`¿Anular «${mov.concept}»?`} className="cj-sheet" footer={<Foot label="Anular" off={mov.void} onGo={onGo} onClose={onClose} />}>
      <p className="sc-p cj-sh-lede">
        {KIND_WORD[mov.kind]} · {who} · {euros(mov.amount)} · {dayWeek(mov.date)}
      </p>
      <Cons
        rows={[
          { b: mov.playerId ? "Deja de contar en su saldo y en el bote" : "Deja de contar en el bote" },
          { b: "Se queda en el libro, tachado como anulado", s: "La caja es un libro de solo anotar: nada se borra." },
          { b: "No se puede deshacer", s: "Si te equivocas, apúntalo de nuevo." },
        ]}
      />
    </SalaSheet>
  );
}

// ───────────────────────── ¿Rechazar el pago avisado…? (M-20: con su motivo) ─────────────────────────
export function RechazarSheet({ claim, who, now, onClose, onGo }: { claim: CajaClaim | null; who: string; now: number; onClose: () => void; onGo: (reason: string) => void }) {
  const id = useId();
  const [why, setWhy] = useState("");
  if (!claim || claim.status !== "pendiente") {
    return (
      <SalaSheet open center alert onClose={onClose} title="Ese aviso ya está resuelto" className="cj-sheet" footer={<Foot label="Rechazar" off onGo={onClose} onClose={onClose} />}>
        <p className="sc-p cj-sh-lede">Otro capitán lo ha confirmado o rechazado ya: está en «Resueltos».</p>
      </SalaSheet>
    );
  }
  const long = why.length > CLAIM_REASON_MAX;
  return (
    <SalaSheet open center alert onClose={onClose} title={`¿Rechazar el pago avisado de ${who}?`} className="cj-sheet" footer={<Foot label="Rechazar el aviso" off={long} onGo={() => onGo(why)} onClose={onClose} />}>
      <p className="sc-p cj-sh-lede">
        {claim.concept || "Pago avisado"} · {euros(claim.amount)} · avisó {claim.at ? relativeTime(claim.at, now) : "ahora"}
      </p>
      <Cons
        rows={[
          { b: "No se apunta nada en la caja", s: "Su deuda sigue como estaba." },
          { b: "Lo verá en su caja del vestuario", s: "Y le llega un aviso: «Tu aviso de pago no se ha confirmado», con el motivo si lo escribes." },
        ]}
      />
      <label className="sc-field cj-why">
        <span id={`${id}-wl`}>Motivo · opcional</span>
        <input className="vd-input" aria-labelledby={`${id}-wl`} type="text" maxLength={CLAIM_REASON_MAX + 20} autoComplete="off" placeholder="No me ha llegado el Bizum" value={why} onChange={(e) => setWhy(e.target.value)} aria-describedby={`${id}-w`} aria-invalid={long || undefined} />
        <small id={`${id}-w`} className={long ? "is-bad" : ""}>
          {why.length}/{CLAIM_REASON_MAX}
          {long ? " · demasiado largo" : ""}
        </small>
      </label>
    </SalaSheet>
  );
}
