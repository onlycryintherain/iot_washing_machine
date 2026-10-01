import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { WasherSummary } from '@/lib/washer/presentation';
import { washerPresentation } from '@/lib/washer/presentation';

export function WasherRow({ washer }: { washer: WasherSummary }) {
  const status = washerPresentation(washer.state);
  return <Link className="washer-row" href={`/washer/${washer.id}`}>
    <span className="washer-row-main">
      <span className="washer-name">{washer.name}</span>
      <span className="statusline"><i className={`dot ${status.tone}`} aria-hidden="true" />{status.label}</span>
    </span>
    <ArrowRight size={19} color="#79817a" aria-hidden="true" />
  </Link>;
}
