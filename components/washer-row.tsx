import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { WasherSummary } from '@/lib/washer/presentation';
import { WasherStatus } from '@/components/washer-status';

export function WasherRow({ washer }: { washer: WasherSummary }) {
  return <Link className="washer-row" href={`/washer/${washer.id}`}>
    <span className="washer-row-main">
      <span className="washer-name">{washer.name}</span>
      <span className="washer-meta">{washer.location}</span>
    </span>
    <span className="washer-row-end"><WasherStatus state={washer.state} /><ArrowRight size={18} aria-hidden="true" /></span>
  </Link>;
}
