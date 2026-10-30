import type { MetricContext } from './operators.js';
import type { AnalysisProfile } from './types.js';

/** Only parameters read by a recipe belong in its compatibility check. Catalogue
 * parameter families also describe how facts were recorded, and are too broad:
 * a change to pass classification cannot invalidate minutes, goals or raw passes.
 * Pass eligibility and completion are evaluated with each observation's profile. */
const PARAMETERS_BY_METRIC: Readonly<Record<string, readonly string[]>> = {
  '028': ['assistPolicy'],
  '098': ['deepPassCriterion'],
  '104': ['wallSeconds'],
  '105': ['assistPolicy'],
  '107': ['bigChanceCriterion'],
  '108': ['assistPolicy'],
  '109': ['assistPolicy'],
  '110': ['scaEligibleKinds', 'scaPhasePolicy'],
  '111': ['scaEligibleKinds', 'scaPhasePolicy'],
  '133': ['retentionSeconds', 'retentionEndPolicy'],
  '177': ['containmentCriterion'],
  '180': ['defensiveCoverCriterion'],
  '182': ['defensiveActionKinds'],
  '185': ['pressureRecoverySeconds'],
  '186': ['pressureRecoverySeconds'],
  '189': ['reactionSeconds'],
  '190': ['ppdaZone', 'ppdaActionKinds'],
  '191': ['defensiveActionKinds'],
  '193': ['counterpressReactionSeconds'],
  '194': ['counterpressRecoverySeconds'],
  '195': ['counterpressRecoverySeconds'],
  '196': ['counterpressShotSeconds'],
  '197': ['gpiMethodVersion', 'gpiEligibleKinds', 'gpiExceptionsReviewed'],
  '205': ['dangerSeconds'],
  '210': ['quickRecoverySeconds'],
  '266': ['retentionSeconds'],
  '267': ['throwInProgressZone'],
  '279': ['reboundSeconds'],
  '305': ['offside'],
  '306': ['offside'],
  '378': ['ratingWeights', 'ratingScaleMin', 'ratingScaleMax', 'ratingBaseline', 'ratingRole', 'ratingMissingPolicy'],
  '398': ['windowSeconds', 'windowKind'],
  '399': ['splitSecond'],
  '400': ['substitutionWindowSeconds', 'substitutionId'],
  'A03': ['quickRecoverySeconds'],
  'A12': ['temporalToleranceSeconds'],
};

const NORMALIZED_RATES = new Set(['182', '382', '383']);

function parameterValue(profile: AnalysisProfile, key: string): unknown {
  const value = profile.parameters[key];
  // Match the recipe's actual fallback, without filling absent mandatory settings.
  if (key === 'windowKind') return value ?? 'shot';
  // These taxonomies are membership sets: ordering and duplicates do not change a rule.
  if (Array.isArray(value)) return [...new Set(value)].sort();
  if (key === 'ratingWeights' && typeof value === 'string') {
    try {
      const weights: unknown = JSON.parse(value);
      if (weights && typeof weights === 'object' && !Array.isArray(weights)) {
        return Object.fromEntries(Object.entries(weights).sort(([a], [b]) => a.localeCompare(b)));
      }
    } catch { /* Invalid configuration is retained for the recipe to explain. */ }
  }
  return value ?? null;
}

function signature(profile: AnalysisProfile, metricId: string, individual: boolean): string {
  const keys = [...(PARAMETERS_BY_METRIC[metricId] ?? [])];
  if (metricId === '275' && individual) {
    keys.push('keeperCleanSheetPolicy');
    if (profile.parameters.keeperCleanSheetPolicy === 'min_minutes') keys.push('keeperCleanSheetMinMinutes');
  }
  return JSON.stringify({
    ...(NORMALIZED_RATES.has(metricId) ? { baseMinutes: profile.baseMinutes } : {}),
    parameters: Object.fromEntries(keys.map(key => [key, parameterValue(profile, key)])),
  });
}

/** Global thresholds/formulas must agree before a pooled reducer can use them.
 * Missing settings are distinct from configured settings: a later match cannot
 * silently inherit the first match's model. Dependencies of a custom rating are
 * checked when the evaluator resolves those metrics, including nested recipes. */
export function compatibleMetricProfiles(ctx: MetricContext, metricId: string): boolean {
  if (ctx.matches.length < 2) return true;
  const individual = !!ctx.filters.playerIds?.length;
  const expected = signature(ctx.matches[0].profile, metricId, individual);
  return ctx.matches.every(match => signature(match.profile, metricId, individual) === expected);
}
