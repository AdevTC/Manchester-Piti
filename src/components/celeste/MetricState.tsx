import type { MetricStatus } from '../../../functions/src/narrated/types';
import { METRIC_STATUS_LABELS } from '../../lib/metricStatus';

export function MetricState({ status }: { status: MetricStatus }) {
  return <span className={`an-status an-status--${status}`}>{METRIC_STATUS_LABELS[status]}</span>;
}
