'use client';

import { useWasherOverview } from '@/components/use-washer-overview';
import { WasherRow } from '@/components/washer-row';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function WashersPage() {
  const { washers, loaded, error } = useWasherOverview();

  return <>
    <div className="topline"><Link className="back" href="/" aria-label="홈으로 돌아가기"><ArrowLeft size={20} /></Link></div>
    <h1>세탁기</h1>
    <p className="lead">세탁기를 고르거나, 세탁기에 붙은 QR을 스캔해서 바로 열 수 있어요.</p>
    <section className="section" aria-label="세탁기 목록">
      {error && <p className="notice" role="status">{error} <button className="text-link" type="button" onClick={() => location.reload()}>다시 시도</button></p>}
      {washers.map((washer) => <WasherRow key={washer.id} washer={washer} />)}
      {!loaded && <p className="muted" role="status">세탁기 상태를 불러오는 중이에요…</p>}
      {loaded && !error && washers.length === 0 && <p className="muted">등록된 세탁기가 아직 없어요.</p>}
    </section>
  </>;
}
