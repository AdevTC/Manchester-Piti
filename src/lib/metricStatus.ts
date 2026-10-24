import type { MetricStatus } from '../../functions/src/narrated/types';

export const METRIC_STATUS_LABELS: Record<MetricStatus, string> = {
  complete: 'Completo', partial: 'Parcial', unknown: 'Sin información',
  not_configured: 'Sin configurar', not_applicable: 'No aplicable', no_sample: 'Sin muestra',
};
