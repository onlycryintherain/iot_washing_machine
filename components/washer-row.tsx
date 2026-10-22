import Link from 'next/link';
import { ChevronRight, WashingMachine } from 'lucide-react';
import type { WasherSummary } from '@/lib/washer/presentation';
import { washerPresentation } from '@/lib/washer/presentation';
import { WasherTiming } from '@/components/washer-timing';

export function WasherRow({ washer, showTiming = true }: { washer: WasherSummary; showTiming?: boolean }) {
  const status = washerPresentation(washer.state);
  return <Link className="washer-row" href={`/washer/${washer.id}`}>
    <span className={`washer-avatar ${status.tone}`} aria-hidden="true"><WashingMachine size={24} strokeWidth={1.75} /></span>
    <span className="washer-row-main">
      <span className="washer-name">{washer.name}</span>
      <span className="statusline"><i className={`dot ${status.tone}`} aria-hidden="true" />{status.label}</span>
      {showTiming && washer.startedAt && (washer.state === 'RUNNING' || washer.state === 'MAYBE_FINISHED') && <WasherTiming startedAt={washer.startedAt} compact />}
    </span>
    <ChevronRight size={20} aria-hidden="true" />
  </Link>;
}
