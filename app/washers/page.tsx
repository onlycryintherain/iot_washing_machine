'use client';

import { useWasherOverview } from '@/components/use-washer-overview';
import { WasherRow } from '@/components/washer-row';

export default function WashersPage() {
  const { washers, loaded, error } = useWasherOverview();

  return <>
    <div className="topline"><span className="brand">기숙사 세탁실</span></div>
    <h1>세탁기</h1>
    <p className="lead">아래에서 세탁기를 선택하거나 QR 스캔 화면에서 세탁기 코드를 스캔하세요.</p>
    <section className="section" aria-label="세탁기 목록">
      {error && <p className="notice" role="status">{error} <button className="text-link" type="button" onClick={() => location.reload()}>다시 시도</button></p>}
      {washers.map((washer) => <WasherRow key={washer.id} washer={washer} />)}
      {!loaded && <p className="muted" role="status">세탁기 상태를 불러오는 중…</p>}
      {loaded && !error && washers.length === 0 && <p className="muted">등록된 세탁기가 없습니다.</p>}
    </section>
  </>;
}
