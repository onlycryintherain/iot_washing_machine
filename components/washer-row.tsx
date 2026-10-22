import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';
import type { WasherSummary } from '@/lib/washer/presentation';
import { washerPresentation } from '@/lib/washer/presentation';
import { WasherTiming } from '@/components/washer-timing';
import { WasherIllustration } from '@/components/washer-illustration';

export function WasherRow({ washer, showTiming = true, index = 0 }: { washer: WasherSummary; showTiming?: boolean; index?: number }) {
  const status = washerPresentation(washer.state);
  return <Link className="washer-row" href={`/washer/${washer.id}`} style={{ '--i': index } as CSSProperties}>
    <span className={`washer-avatar ${status.tone}`} aria-hidden="true"><WasherIllustration state={washer.state} size={46} /></span>
    <span className="washer-row-main">
      <span className="washer-name">{washer.name}</span>
      <span className="statusline"><i className={`dot ${status.tone}`} aria-hidden="true" />{status.label}</span>
      {showTiming && washer.startedAt && (washer.state === 'RUNNING' || washer.state === 'MAYBE_FINISHED') && <WasherTiming startedAt={washer.startedAt} compact />}
    </span>
    <ChevronRight size={20} aria-hidden="true" />
  </Link>;
}
