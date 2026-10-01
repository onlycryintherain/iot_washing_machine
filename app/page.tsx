'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BellRing, ScanLine } from 'lucide-react';

type Washer = { id: string; name: string; state: string; startedAt: string | null; currentUserId: string | null };

function label(state: string) {
  if (state === 'IDLE') return '사용 가능';
  if (state === 'RESERVED') return '등록됨';
  if (state === 'FINISHED' || state === 'WAITING_FOR_PICKUP') return '세탁 완료';
  return '세탁 중';
}

export default function Home() {
  const [list, setList] = useState<Washer[]>([]);
  const [mine, setMine] = useState<Washer | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      fetch('/api/washers', {
        headers: { authorization: `Bearer ${localStorage.getItem('laundry-token') ?? ''}` },
        cache: 'no-store',
      }).then((response) => {
        if (!response.ok) throw Error();
        return response.json();
      }).then((data) => {
        if (live) {
          setList(data.washers);
          setMine(data.myWasher);
          setError('');
        }
      }).catch(() => {
        if (live) setError('세탁기 상태를 불러오지 못했습니다.');
      });
    };
    load();
    const id = setInterval(load, 5000);
    return () => { live = false; clearInterval(id); };
  }, []);

  const available = list.filter((washer) => washer.state === 'IDLE').length;

  return <>
    <div className="topline"><span className="brand">기숙사 세탁실</span><span className="eyebrow">Laundry room</span></div>
    <h1>세탁실 현황</h1>
    <p className="lead">사용 가능한 세탁기를 확인하고, 완료되면 알림을 받으세요.</p>
    <Link className="button home-scan-button" href="/scan"><ScanLine size={19} /> 세탁기 QR 스캔</Link>

    {mine && <section className="section">
      <div className="section-head"><h2>내 세탁</h2><BellRing size={17} color="var(--green)" /></div>
      <Link className="washer-row" href={`/washer/${mine.id}`}>
        <span className="washer-row-main"><span className="washer-name">{mine.name}</span><span className="statusline"><i className="dot busy" />{label(mine.state)}</span></span>
        <ArrowRight size={19} color="#79817a" />
      </Link>
    </section>}

    <div className="summary">
      <div className="summary-item"><span className="summary-label">사용 가능</span><strong className="summary-value">{available}</strong></div>
      <div className="summary-item"><span className="summary-label">사용 중</span><strong className="summary-value">{list.length - available}</strong></div>
    </div>

    <section className="section">
      <div className="section-head"><h2>세탁기</h2><Link href="/washers">전체 보기</Link></div>
      {error ? <div className="notice">{error}<button className="text-link" onClick={() => location.reload()}> 다시 시도</button></div> : list.map((washer) =>
        <Link className="washer-row" href={`/washer/${washer.id}`} key={washer.id}>
          <span className="washer-row-main"><span className="washer-name">{washer.name}</span><span className="statusline"><i className={`dot ${washer.state === 'IDLE' || washer.state === 'FINISHED' || washer.state === 'WAITING_FOR_PICKUP' ? 'done' : 'busy'}`} />{label(washer.state)}</span></span>
          <ArrowRight size={19} color="#79817a" />
        </Link>
      )}
      {!error && !list.length && <p className="notice">세탁기 정보를 준비하고 있습니다.</p>}
    </section>

    <div className="notice use-guide"><strong>이용 방법</strong><span>앱에서 QR을 스캔하거나 세탁기를 선택하세요.</span><span>사용 등록 후 세탁이 끝나면 알림으로 알려드려요.</span></div>
  </>;
}
