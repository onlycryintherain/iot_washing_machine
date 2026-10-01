import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { WasherSummary } from '@/lib/washer/presentation';
import { washerPresentation } from '@/lib/washer/presentation';
import { WasherTiming } from '@/components/washer-timing';

export function WasherRow({ washer, showTiming = true }: { washer: WasherSummary; showTiming?: boolean }) {
  const status = washerPresentation(washer.state);
  return <Link className="washer-row" href={`/washer/${washer.id}`}>
    <span className="washer-row-main">
      <span className="washer-name">{washer.name}</span>
      <span className="statusline"><i className={`dot ${status.tone}`} aria-hidden="true" />{status.label}</span>
      {showTiming && washer.startedAt && (washer.state === 'RUNNING' || washer.state === 'MAYBE_FINISHED') && <WasherTiming startedAt={washer.startedAt} compact />}
    </span>
    <ArrowRight size={19} color="#79817a" aria-hidden="true" />
  </Link>;
}
