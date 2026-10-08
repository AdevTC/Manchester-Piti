// Small controls of the admin kit (round-3 canvas): chips (icon + word, never colour alone), the segmented
// control, labelled fields, toggles and the live counters. They only render the kit's classes; the look
// lives in admin.css.
import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { AdIcon, type AdIconName } from "./icons";

export type ChipTone = "" | "ok" | "warn" | "bad" | "sky" | "gold";
const TONE_ICON: Partial<Record<ChipTone, AdIconName>> = { ok: "check", warn: "alert", bad: "x" };

/** `.chip`: a status word with its icon. `icon` overrides the tone's default (✓ ok, ⚠ warn, ✕ bad); `null` hides it. */
export function Chip({ tone = "", icon, children, className = "" }: { tone?: ChipTone; icon?: AdIconName | null; children: ReactNode; className?: string }) {
  const name = icon === null ? undefined : (icon ?? TONE_ICON[tone]);
  return (
    <span className={`chip ${tone} ${className}`.trim()}>
      {name && <AdIcon name={name} size={12} />}
      {children}
    </span>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** A small counter after the label (`<small>`), e.g. the filter totals. */
  count?: ReactNode;
  disabled?: boolean;
}
/** `.sg`: a row of aria-pressed buttons (one value). `label` names the group for screen readers. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  labelledBy,
  className = "",
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  label?: string;
  labelledBy?: string;
  className?: string;
}) {
  return (
    <div className={`sg ${className}`.trim()} role="group" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count != null && <small>{o.count}</small>}
        </button>
      ))}
    </div>
  );
}

/** `.tgl`: independent on/off buttons with a check box (e.g. «Temporadas en que juega»). */
export function Toggles<T extends string>({
  options,
  selected,
  onToggle,
  labelledBy,
}: {
  options: { value: T; label: ReactNode }[];
  selected: readonly T[];
  onToggle: (v: T) => void;
  labelledBy?: string;
}) {
  return (
    <div className="tgl" role="group" aria-labelledby={labelledBy}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onToggle(o.value)}>
            <span className="bx" aria-hidden="true">
              <AdIcon name="check" size={12} />
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A labelled single on/off toggle button (one `.tgl` button, aria-pressed). */
export function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className="tgl">
      <button type="button" aria-pressed={checked} onClick={() => onChange(!checked)}>
        <span className="bx" aria-hidden="true">
          <AdIcon name="check" size={12} />
        </span>
        {children}
      </button>
    </div>
  );
}

export type CheckTone = "ok" | "bad" | "mut";
/** A live check under a field (`.chk`): ✓ ok / ✕ bad / muted hint. Announced politely. */
export function FieldCheck({ id, tone, children }: { id?: string; tone: CheckTone; children: ReactNode }) {
  return (
    <span className={`chk ${tone}`} id={id} aria-live="polite">
      {tone === "ok" && <AdIcon name="check" size={13} />}
      {tone === "bad" && <AdIcon name="x" size={13} />}
      {children}
    </span>
  );
}

interface FieldBase {
  label: ReactNode;
  /** Spans both columns of a `.fg`/`.fg2` grid. */
  wide?: boolean;
  /** Text under the input (`.hint`) or a live check (`check`). */
  hint?: ReactNode;
  check?: { tone: CheckTone; text: ReactNode };
  /** Marks the input `.bad` / `.good`. */
  state?: "bad" | "good";
}
/** `.fld` + `.inp`: a labelled text input; the hint/check is wired with aria-describedby. */
export function TextField({ label, wide, hint, check, state, className = "", ...input }: FieldBase & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const described = hint || check ? `${id}-h` : undefined;
  return (
    <label className={`fld${wide ? " w2" : ""}`}>
      <span className="lbl">{label}</span>
      <input className={`inp ${state ?? ""} ${className}`.trim()} aria-describedby={described} aria-invalid={state === "bad" || undefined} {...input} />
      {check ? (
        <FieldCheck id={described} tone={check.tone}>
          {check.text}
        </FieldCheck>
      ) : hint ? (
        <span className="hint" id={described}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}
/** `.fld` + `textarea.inp`. */
export function TextAreaField({ label, wide, hint, state, className = "", ...area }: Omit<FieldBase, "check"> & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <label className={`fld${wide ? " w2" : ""}`}>
      <span className="lbl">{label}</span>
      <textarea className={`inp ${state ?? ""} ${className}`.trim()} aria-describedby={hint ? `${id}-h` : undefined} {...area} />
      {hint && (
        <span className="hint" id={`${id}-h`}>
          {hint}
        </span>
      )}
    </label>
  );
}

export type CounterTone = "" | "w" | "hot";
/** A live counter: `.ct` (side menu) — amber `w` = por revisar, red `hot` = pendiente de alguien. Decorative:
 *  the owner puts the same information in its aria-label. Empty when n is 0. */
export function Counter({ n, tone = "", className = "ct" }: { n: number; tone?: CounterTone; className?: string }) {
  return (
    <span className={`${className} ${tone}`.trim()} aria-hidden="true">
      {n ? String(n) : ""}
    </span>
  );
}

/** `.empty`: the dashed empty state (icon, title, line). */
export function EmptyState({ icon = "check", title, children, className = "" }: { icon?: AdIconName; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={`empty ${className}`.trim()}>
      <AdIcon name={icon} size={22} />
      <b>{title}</b>
      {children && <small>{children}</small>}
    </div>
  );
}

/** Skeleton rows for a `.scr` list while its data loads. */
export function SkeletonRows({ rows = 4, label = "Cargando…" }: { rows?: number; label?: string }) {
  return (
    <div className="ad-skel" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="ad-skel-row" />
      ))}
    </div>
  );
}
