// Central surface for documents discarded at the Firestore read boundary.
//
// Every per-collection mapper (firestoreMappers.ts), `parseDocs`/`safeParseDoc`
// (schemas.ts) and the bespoke `users` mapper (Admin.tsx) drop+log invalid docs
// instead of throwing, so the UI stays resilient. Historically each call site
// did its own `console.error("[schema] ...")`, which scattered the only signal
// of data corruption across the console with no way to count or monitor it.
//
// `reportDroppedDoc` unifies that signal so corruption is VISIBLE:
//   1. keeps a per-collection counter readable in DEV (`getDroppedDocStats`),
//   2. logs in DEV exactly as before (`import.meta.env.DEV`), stripped in prod,
//   3. forwards to an optional, pluggable monitor (`setDroppedDocReporter`) so a
//      real service (Sentry-style) can be wired later WITHOUT adding a dep now.
//
// Resilience contract: this module NEVER throws. A throwing reporter handler is
// swallowed (logged in DEV) so telemetry can never take down a read.

import type { z } from "zod";

/** Zod v4 public issue type (`z.core.$ZodIssue`); `error.issues` is `$ZodIssue[]`. */
export type DroppedDocIssue = z.core.$ZodIssue;

/** Optional monitor handler. Receives the same payload `reportDroppedDoc` gets. */
export type DroppedDocReporter = (info: {
  collection: string;
  id: string;
  issues: DroppedDocIssue[];
}) => void;

/** Per-collection discard counts since process start (or last reset). */
const droppedCounts: Record<string, number> = {};

/** Pluggable monitor; null until a real monitor opts in via setDroppedDocReporter. */
let reporter: DroppedDocReporter | null = null;

/**
 * Wire a monitoring handler (e.g. Sentry) to receive dropped-doc events. Pass
 * `null` to detach. Returns the previous handler so callers can restore it.
 */
export function setDroppedDocReporter(fn: DroppedDocReporter | null): DroppedDocReporter | null {
  const prev = reporter;
  reporter = fn;
  return prev;
}

/** Snapshot of per-collection discard counts. DEV visibility / assertions. */
export function getDroppedDocStats(): Record<string, number> {
  return { ...droppedCounts };
}

/** Total docs dropped across all collections. */
export function getTotalDroppedDocs(): number {
  let total = 0;
  for (const c in droppedCounts) total += droppedCounts[c];
  return total;
}

/** Reset all counters. Primarily for tests / a DEV "clear" affordance. */
export function resetDroppedDocStats(): void {
  for (const c in droppedCounts) delete droppedCounts[c];
}

/**
 * Record a discarded Firestore doc. Called by every read-boundary mapper in
 * place of the old `console.error`. Increments the per-collection counter, logs
 * in DEV, and forwards to the pluggable monitor. NEVER throws — the caller still
 * drops the doc / returns its fallback regardless of what happens here.
 */
export function reportDroppedDoc(collection: string, id: string, issues: DroppedDocIssue[]): void {
  droppedCounts[collection] = (droppedCounts[collection] ?? 0) + 1;

  if (import.meta.env.DEV) {
    console.error(`[schema] doc inválido en ${collection}/${id}:`, issues);
  }

  if (reporter) {
    try {
      reporter({ collection, id, issues });
    } catch (err) {
      // A faulty monitor must never break a read. Surface it in DEV only.
      if (import.meta.env.DEV) {
        console.error("[docTelemetry] reporter handler threw (ignored):", err);
      }
    }
  }
}
