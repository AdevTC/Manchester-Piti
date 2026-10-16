// La caja's forms (views/Caja.tsx opens them): «Cobrar cuota», «Coste del partido», «Apuntar pago / gasto /
// ingreso» and the season's «Ajustes». Each one shows what will be written before it is (the cargos, the
// split to the cent, the concept), refuses a cuota or a match cost already charged (anular first), and
// waits for the write inside the modal (busy, the error above the buttons); the view toasts the result.
import { useId, useState, type ReactNode } from "react";
import {
  balanceText,
  CAJA_LIMITS,
  centsInput,
  chargedAlready,
  cuotaCargos,
  cuotaConcept,
  fmtEuros,
  isPlayerKind,
  madridMonth,
  matchCostConcept,
  matchCostPlayers,
  monthName,
  parseEuros,
  splitCost,
  type BalancePlayer,
  type CajaKind,
  type CajaMov,
  type CajaSettings,
  type CostMatch,
  type CuotaPeriod,
  type NewCajaMov,
} from "../../../lib/derived/caja";
import { madridDate } from "../../../lib/derived/madrid";
import { AdIcon } from "../ui/icons";
import { ConfirmModal } from "../ui/layers";
import { plural } from "../../../lib/derived/words";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The modal's write: busy while it runs, the failure shown in the modal. */
function useSubmit(run: () => Promise<string>, onDone: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onDone(await run());
    } catch (e) {
      setError(`No se ha podido guardar: ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit: () => void submit() };
}

/** An amount in euros, typed as text («12,50»): what it parses to and its live check. */
function AmountField({ label, value, onChange, cents, allowZero = false, hint }: { label: string; value: string; onChange: (v: string) => void; cents: number | null; allowZero?: boolean; hint?: ReactNode }) {
  const id = useId();
  const bad = !!value.trim() && (cents === null || cents > CAJA_LIMITS.amount || (!allowZero && cents === 0));
  return (
    <div className="fld">
      <label htmlFor={id}>{label}</label>
      <div className="cj-amt">
        <input id={id} className={`inp${bad ? " bad" : ""}`} inputMode="decimal" autoComplete="off" value={value} placeholder="0,00" onChange={(e) => onChange(e.target.value)} aria-invalid={bad || undefined} aria-describedby={`${id}-h`} />
        <span aria-hidden="true">€</span>
      </div>
      {bad ? (
        <span className="bad" id={`${id}-h`}>
          <AdIcon name="x" size={13} />
          Escribe un importe en euros, por ejemplo 12,50
        </span>
      ) : (
        <span className="hint" id={`${id}-h`}>
          {hint ?? (cents ? fmtEuros(cents) : "En euros, con coma para los céntimos")}
        </span>
      )}
    </div>
  );
}

/** A refusal shown in the modal (never colour alone: the ⚠ and the words). */
const Already = ({ children }: { children: ReactNode }) => (
  <p className="warn cj-warn" role="status">
    <AdIcon name="alert" size={15} />
    <span>{children}</span>
  </p>
);

// ───────────────────────── Cobrar cuota ─────────────────────────
export function CuotaModal({
  seasonId,
  seasonName,
  settings,
  squad,
  movs,
  now,
  onClose,
  onDone,
  addMovs,
}: {
  seasonId: string;
  seasonName: string;
  settings: CajaSettings;
  squad: readonly BalancePlayer[];
  movs: readonly CajaMov[];
  now: number;
  onClose: () => void;
  onDone: (message: string) => void;
  addMovs: (seasonId: string, movs: readonly NewCajaMov[]) => Promise<void>;
}) {
  const [amount, setAmount] = useState(settings.cuota ? centsInput(settings.cuota) : "");
  const [month, setMonth] = useState(() => madridMonth(now));
  const cents = parseEuros(amount);
  const period = settings.cuotaPeriod;
  const concept = cuotaConcept(period, seasonName, month);
  const cargos = cuotaCargos(cents ?? 0, squad.map((p) => p.id));
  const dup = chargedAlready(movs, concept);
  const ok = !!cargos.length && !dup && (cents ?? 0) <= CAJA_LIMITS.amount;
  const { busy, error, submit } = useSubmit(async () => {
    const date = madridDate(now);
    await addMovs(seasonId, cargos.map((c) => ({ kind: "cargo", playerId: c.playerId, amount: c.amount, concept, date, matchId: null })));
    return `${concept} cobrada · ${plural(cargos.length, "cargo", "cargos")} de ${fmtEuros(cents ?? 0)}`;
  }, onDone);
  const id = useId();
  return (
    <ConfirmModal
      open
      onClose={onClose}
      title="Cobrar cuota"
      lede={`Un cargo por jugador de la plantilla de la ${seasonName}. Lo verán en su saldo del vestuario.`}
      consequences={
        cargos.length
          ? [`${plural(cargos.length, "cargo", "cargos")} de ${fmtEuros(cents ?? 0)} · ${fmtEuros((cents ?? 0) * cargos.length)} en total`, `Concepto: «${concept}»`]
          : []
      }
      confirmLabel={cargos.length ? `Cobrar a ${plural(cargos.length, "jugador", "jugadores")}` : "Cobrar cuota"}
      confirmTone="gold"
      confirmDisabled={!ok}
      busy={busy}
      error={error || undefined}
      onConfirm={submit}
    >
      <AmountField label="Cuota por jugador" value={amount} onChange={setAmount} cents={cents} hint={period === "mensual" ? "Cuota mensual · se cambia en Ajustes" : "Cuota por temporada · se cambia en Ajustes"} />
      {period === "mensual" && (
        <div className="fld">
          <label htmlFor={`${id}-m`}>Mes</label>
          <select id={`${id}-m`} className="inp" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                {monthName(i)}
              </option>
            ))}
          </select>
        </div>
      )}
      {!squad.length && <p className="hint">Esta temporada no tiene plantilla todavía: apunta a los jugadores desde Plantilla.</p>}
      {dup > 0 && (
        <Already>
          «{concept}» ya está cobrada ({plural(dup, "cargo", "cargos")}). Si quieres repetirla, anula antes esos cargos.
        </Already>
      )}
    </ConfirmModal>
  );
}

// ───────────────────────── Coste del partido ─────────────────────────
export interface CostOption extends CostMatch {
  id: string;
  rival?: string;
  jornada: number | null;
  /** «J5 · FUSION 7 · 12 oct». */
  label: string;
  /** Its Madrid date (`YYYY-MM-DD`), the cargos' date. */
  day: string;
  /** Kick-off, ms (NaN without a date). */
  at: number;
}
export function CosteModal({
  seasonId,
  matches,
  initialId,
  order,
  nameOf,
  movs,
  onClose,
  onDone,
  addMovs,
}: {
  seasonId: string;
  matches: readonly CostOption[];
  initialId: string;
  order: (playerId: string) => number;
  nameOf: (playerId: string) => string;
  movs: readonly CajaMov[];
  onClose: () => void;
  onDone: (message: string) => void;
  addMovs: (seasonId: string, movs: readonly NewCajaMov[]) => Promise<void>;
}) {
  const id = useId();
  const [matchId, setMatchId] = useState(initialId);
  const [amount, setAmount] = useState("");
  const match = matches.find((m) => m.id === matchId) ?? null;
  const cents = parseEuros(amount);
  const who = match ? matchCostPlayers(match, order) : { ids: [], source: "convocatoria" as const };
  const cargos = splitCost(cents ?? 0, who.ids);
  const concept = match ? matchCostConcept(match.jornada, match.rival) : "";
  const dup = match ? chargedAlready(movs, concept, match.id) : 0;
  const ok = !!match && !!cargos.length && !dup && (cents ?? 0) <= CAJA_LIMITS.amount;
  const { busy, error, submit } = useSubmit(async () => {
    if (!match) return "";
    await addMovs(seasonId, cargos.map((c) => ({ kind: "cargo", playerId: c.playerId, amount: c.amount, concept, date: match.day, matchId: match.id })));
    return `${concept} · repartido entre ${plural(cargos.length, "jugador", "jugadores")}`;
  }, onDone);
  const base = cargos.length ? cargos[cargos.length - 1].amount : 0;
  const extra = cargos.filter((c) => c.amount > base).length;
  return (
    <ConfirmModal
      open
      onClose={onClose}
      title="Coste del partido"
      lede="Campo y árbitro, a partes iguales entre los que jugaron. Los céntimos que sobran, a los primeros por dorsal."
      consequences={match && cargos.length ? [`Concepto: «${concept}»`, `${fmtEuros(cents ?? 0)} entre ${plural(cargos.length, "jugador", "jugadores")}`] : []}
      confirmLabel={cargos.length ? `Cargar a ${plural(cargos.length, "jugador", "jugadores")}` : "Repartir"}
      confirmTone="gold"
      confirmDisabled={!ok}
      busy={busy}
      error={error || undefined}
      onConfirm={submit}
    >
      {matches.length ? (
        <div className="fld">
          <label htmlFor={`${id}-p`}>Partido</label>
          <select id={`${id}-p`} className="inp" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
            {!match && <option value="">— Elige el partido —</option>}
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="hint">Esta temporada no tiene partidos publicados todavía.</p>
      )}
      <AmountField label="Campo y árbitro (total)" value={amount} onChange={setAmount} cents={cents} />
      {match && (
        <p className="hint" id={`${id}-src`}>
          {who.source === "acta" ? "Del acta: los titulares y los cambios que entraron." : who.ids.length ? "Sin acta todavía: entre los convocados." : "Sin acta ni convocatoria: no hay a quién cargarlo."}
        </p>
      )}
      {cargos.length > 0 && (
        <>
          <p className="cj-split" aria-describedby={`${id}-src`}>
            {extra ? `${plural(extra, "jugador pone", "jugadores ponen")} ${fmtEuros(base + 1)} y ${plural(cargos.length - extra, "jugador", "jugadores")} ${fmtEuros(base)}` : `${fmtEuros(base)} cada uno`}
          </p>
          <ul className="cj-who" aria-label="Reparto">
            {cargos.map((c) => (
              <li key={c.playerId}>
                <span>{nameOf(c.playerId)}</span>
                <b>{fmtEuros(c.amount)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
      {dup > 0 && (
        <Already>
          Este partido ya está cargado ({plural(dup, "cargo", "cargos")}). Si quieres repetirlo, anula antes esos cargos.
        </Already>
      )}
    </ConfirmModal>
  );
}

// ───────────────────────── Apuntar pago / gasto / ingreso ─────────────────────────
export type FreeKind = Exclude<CajaKind, "cargo">;
const FREE_TITLE: Record<FreeKind, string> = { pago: "Apuntar pago", gasto: "Apuntar gasto", ingreso: "Apuntar ingreso" };
const FREE_LEDE: Record<FreeKind, string> = {
  pago: "Un jugador ha pagado: entra en el bote y baja lo que debe.",
  gasto: "Dinero que sale del bote: balones, equipaciones, una cena…",
  ingreso: "Otro dinero que entra en el bote: un patrocinador, una rifa…",
};
const DEFAULT_CONCEPT: Record<FreeKind, string> = { pago: "Pago", gasto: "", ingreso: "" };
export function MovModal({
  kind,
  seasonId,
  squad,
  balanceOf,
  initialPlayer,
  now,
  onClose,
  onDone,
  addMovs,
}: {
  kind: FreeKind;
  seasonId: string;
  squad: readonly BalancePlayer[];
  balanceOf: (playerId: string) => number;
  initialPlayer: string;
  now: number;
  onClose: () => void;
  onDone: (message: string) => void;
  addMovs: (seasonId: string, movs: readonly NewCajaMov[]) => Promise<void>;
}) {
  const id = useId();
  const [playerId, setPlayerId] = useState(initialPlayer);
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState(DEFAULT_CONCEPT[kind]);
  const [date, setDate] = useState(madridDate(now));
  const cents = parseEuros(amount);
  const needsPlayer = isPlayerKind(kind);
  const player = squad.find((p) => p.id === playerId);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const ok = !!cents && cents <= CAJA_LIMITS.amount && !!concept.trim() && dateOk && (!needsPlayer || !!player);
  const { busy, error, submit } = useSubmit(async () => {
    await addMovs(seasonId, [{ kind, playerId: needsPlayer ? playerId : null, amount: cents ?? 0, concept, date, matchId: null }]);
    const amt = fmtEuros(cents ?? 0);
    return kind === "pago" ? `Pago de ${player?.name ?? "Jugador"} · ${amt}` : kind === "gasto" ? `Gasto apuntado · ${amt} fuera del bote` : `Ingreso apuntado · ${amt} al bote`;
  }, onDone);
  return (
    <ConfirmModal
      open
      onClose={onClose}
      title={FREE_TITLE[kind]}
      lede={FREE_LEDE[kind]}
      confirmLabel={FREE_TITLE[kind]}
      confirmDisabled={!ok}
      busy={busy}
      error={error || undefined}
      onConfirm={submit}
    >
      {needsPlayer && (
        <div className="fld">
          <label htmlFor={`${id}-j`}>Jugador</label>
          <select id={`${id}-j`} className="inp" value={playerId} onChange={(e) => setPlayerId(e.target.value)} aria-describedby={player ? `${id}-jh` : undefined}>
            <option value="">— Elige al jugador —</option>
            {squad.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number != null ? `${p.number} · ` : ""}
                {p.name}
              </option>
            ))}
          </select>
          {player && (
            <span className="hint" id={`${id}-jh`}>
              Ahora: {balanceText(balanceOf(player.id))}
            </span>
          )}
        </div>
      )}
      <AmountField label="Importe" value={amount} onChange={setAmount} cents={cents} />
      <div className="fld">
        <label htmlFor={`${id}-c`}>Concepto</label>
        <input id={`${id}-c`} className="inp" value={concept} maxLength={CAJA_LIMITS.concept} placeholder={kind === "gasto" ? "Balones nuevos" : kind === "ingreso" ? "Patrocinio del bar" : "Bizum"} onChange={(e) => setConcept(e.target.value)} autoComplete="off" />
      </div>
      <div className="fld">
        <label htmlFor={`${id}-d`}>Fecha</label>
        <input id={`${id}-d`} className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </ConfirmModal>
  );
}

// ───────────────────────── Ajustes ─────────────────────────
export function AjustesModal({
  seasonName,
  settings,
  onClose,
  onDone,
  save,
}: {
  seasonName: string;
  settings: CajaSettings;
  onClose: () => void;
  onDone: (message: string) => void;
  save: (s: Pick<CajaSettings, "cuota" | "cuotaPeriod" | "howToPay">) => Promise<void>;
}) {
  const id = useId();
  const [amount, setAmount] = useState(settings.cuota ? centsInput(settings.cuota) : "");
  const [period, setPeriod] = useState<CuotaPeriod>(settings.cuotaPeriod);
  const [howToPay, setHowToPay] = useState(settings.howToPay);
  const cents = amount.trim() ? parseEuros(amount) : 0;
  const ok = cents !== null && cents <= CAJA_LIMITS.amount;
  const { busy, error, submit } = useSubmit(async () => {
    await save({ cuota: cents ?? 0, cuotaPeriod: period, howToPay });
    return `Ajustes de la caja guardados · ${seasonName}`;
  }, onDone);
  return (
    <ConfirmModal open onClose={onClose} title={`Ajustes de la caja · ${seasonName}`} lede="La cuota y cómo se paga. Todos los socios lo ven en el vestuario." confirmLabel="Guardar" confirmDisabled={!ok} busy={busy} error={error || undefined} onConfirm={submit}>
      <AmountField label="Cuota por jugador" value={amount} onChange={setAmount} cents={cents} allowZero hint={cents ? fmtEuros(cents) : "Vacía: sin cuota"} />
      <div className="fld">
        <span className="lb" id={`${id}-p`}>
          Cada cuánto
        </span>
        <div className="sgf cj-sgf" role="group" aria-labelledby={`${id}-p`}>
          <button type="button" aria-pressed={period === "temporada"} onClick={() => setPeriod("temporada")}>
            Por temporada
          </button>
          <button type="button" aria-pressed={period === "mensual"} onClick={() => setPeriod("mensual")}>
            Cada mes
          </button>
        </div>
      </div>
      <div className="fld">
        <label htmlFor={`${id}-h`}>Cómo pagar</label>
        <textarea id={`${id}-h`} className="inp cj-ta" value={howToPay} maxLength={CAJA_LIMITS.howToPay} rows={3} placeholder="Bizum al 600 000 000 (Adrián) o en mano al capitán" onChange={(e) => setHowToPay(e.target.value)} />
        <span className="hint">
          {howToPay.length} de {CAJA_LIMITS.howToPay} · fuera de la app: aquí no se paga nada
        </span>
      </div>
    </ConfirmModal>
  );
}
