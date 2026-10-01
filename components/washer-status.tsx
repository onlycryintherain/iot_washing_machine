import type { WasherState } from '@/lib/washer/state-machine';
import { washerPresentation } from '@/lib/washer/presentation';

export function WasherStatus({ state }: { state: WasherState }) {
  const status = washerPresentation(state);
  return <span className={`washer-status ${status.tone}`}><i className="washer-status-dot" aria-hidden="true" />{status.label}</span>;
}
