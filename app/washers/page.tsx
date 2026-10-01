'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useWasherOverview } from '@/components/use-washer-overview';
import { WasherRow } from '@/components/washer-row';

export default function WashersPage() {
  const { washers, loaded, error } = useWasherOverview();

  return <>
    <div className="topline"><Link className="back" href="/" aria-label="홈으로 돌아가기"><ArrowLeft size={20} /></Link><span className="brand">기숙사 세탁실</span></div>
    <h1>세탁기 상태</h1>
    <p className="lead">사용할 세탁기를 선택하세요.</p>
    <section className="section" aria-label="세탁기 목록">
      {error && <p className="notice" role="status">{error} <button className="text-link" type="button" onClick={() => location.reload()}>다시 시도</button></p>}
      {washers.map((washer) => <WasherRow key={washer.id} washer={washer} />)}
      {!loaded && <p className="muted" role="status">세탁기 상태를 불러오는 중…</p>}
      {loaded && !error && washers.length === 0 && <p className="muted">등록된 세탁기가 없습니다.</p>}
    </section>
  </>;
}
