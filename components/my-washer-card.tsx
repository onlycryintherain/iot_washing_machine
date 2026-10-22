import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { WasherSummary } from '@/lib/washer/presentation';
import { washerPresentation } from '@/lib/washer/presentation';
import { WasherStatus } from '@/components/washer-status';
import { WasherTiming } from '@/components/washer-timing';

function message(washer: WasherSummary) {
  switch (washer.state) {
    case 'RESERVED': return '사용 등록을 마쳤어요. 세탁기의 시작 버튼을 눌러주세요.';
    case 'FINISHED':
    case 'WAITING_FOR_PICKUP': return '세탁이 끝났어요. 세탁물을 꺼낸 뒤 수거 완료를 눌러주세요.';
    default: return washerPresentation(washer.state).headline;
  }
}

export function MyWasherCard({ washer }: { washer: WasherSummary }) {
  const status = washerPresentation(washer.state);
  const running = !!washer.startedAt && (washer.state === 'RUNNING' || washer.state === 'MAYBE_FINISHED');
  return <Link className={`my-card ${status.tone}`} href={`/washer/${washer.id}`} aria-label={`내 세탁 ${washer.name} 자세히 보기`}>
    <span className="my-card-top"><span className="my-card-label">내 세탁</span><WasherStatus state={washer.state} /></span>
    <strong className="my-card-name">{washer.name}</strong>
    {running ? <WasherTiming startedAt={washer.startedAt!} /> : <p className="my-card-text">{message(washer)}</p>}
    <span className="my-card-cta">자세히 보기<ChevronRight size={16} aria-hidden="true" /></span>
  </Link>;
}
