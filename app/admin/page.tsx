'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { WasherQrCards } from '@/components/washer-qr-cards';
import { BrandLogo } from '@/components/brand-logo';

type Item = {
  id: string;
  name: string;
  state: string;
  currentUserId: string | null;
  startedAt: string | null;
  lastActivityAt: string | null;
  finishedAt: string | null;
  pushSentAt: string | null;
  elapsedMinutes: number | null;
};
type Person = { id: string; nickname: string };
const stateLabel: Record<string, string> = {
  IDLE: '사용 가능', RESERVED: '시작 대기', RUNNING: '세탁 중', MAYBE_FINISHED: '종료 확인 중',
  FINISHED: '세탁 완료', WAITING_FOR_PICKUP: '수거 대기',
};

function timeLabel(value: string | null) {
  return value ? new Date(value).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : '—';
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [qrWashers, setQrWashers] = useState<Array<{ id: string; name: string }>>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const refreshId = useRef(0);
  const backgroundLoading = useRef(false);

  const load = useCallback(async (credential: string, silent = false) => {
    if (!credential) return;
    if (silent && backgroundLoading.current) return;
    if (silent) backgroundLoading.current = true;
    const id = ++refreshId.current;
    if (!silent) setBusy(true);
    try {
      const response = await fetch('/api/admin/simulator', { headers: { 'x-admin-password': credential }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (id !== refreshId.current) return;
      setItems(data.washers);
      setQrWashers((current) => {
        const next = (data.washers as Item[]).map(({ id, name }) => ({ id, name }));
        return current.length === next.length && current.every((washer, index) => washer.id === next[index].id && washer.name === next[index].name) ? current : next;
      });
      setPeople(data.users);
      sessionStorage.setItem('admin-pass', credential);
      setLoaded(true);
      setError('');
    } catch (cause) {
      if (id === refreshId.current) setError(cause instanceof Error ? cause.message : '운영 정보를 불러오지 못했습니다.');
    } finally { if (silent) backgroundLoading.current = false; else setBusy(false); }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pass');
    if (saved) { setPassword(saved); void load(saved); }
  }, [load]);

  useEffect(() => {
    if (!loaded || !password) return;
    const refresh = () => { if (!document.hidden) void load(password, true); };
    const interval = setInterval(refresh, 2000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [loaded, password, load]);

  function lock() {
    refreshId.current++;
    sessionStorage.removeItem('admin-pass');
    setPassword('');
    setItems([]);
    setQrWashers([]);
    setPeople([]);
    setLoaded(false);
  }

  return <main className="admin-shell">
    <div className="topline"><BrandLogo />{loaded && <Link href="/admin/simulator" className="text-link">시뮬레이터 →</Link>}</div>
    <h1>운영 현황</h1>
    <p className="lead">세탁기를 선택해 테스트를 시작하거나 QR 안내 카드를 관리하세요.</p>

    {!loaded && <section className="section">
      <label className="eyebrow" htmlFor="admin-password">운영자 비밀번호</label>
      <input className="input" id="admin-password" type="password" placeholder="운영자 비밀번호" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(password); }} />
      <button className="button" disabled={!password || busy} aria-busy={busy} onClick={() => void load(password)}>{busy ? '불러오는 중…' : '운영 도구 열기'}</button>
    </section>}
    {error && <p className="error">{error}</p>}

    {loaded && <>
      <div className="section-head admin-status-heading"><div><h2>세탁기 상태</h2><span className="admin-live-label">화면이 열려 있는 동안 자동 갱신</span></div><button className="button small secondary" disabled={busy} onClick={() => void load(password)}>{busy ? '갱신 중…' : '새로고침'}</button></div>
      <div className="admin-grid">{items.map((washer) => {
        const person = people.find((item) => item.id === washer.currentUserId);
        return <article className="admin-card admin-washer-card" key={washer.id}>
          <div className="admin-washer-heading"><h3>{washer.name}</h3><span className={`tag ${washer.state === 'IDLE' || washer.state === 'FINISHED' ? 'done' : 'busy'}`}>{stateLabel[washer.state] ?? washer.state}</span></div>
          <p className="admin-washer-owner">{person ? `${person.nickname} 사용 중` : '사용자 없음'}</p>
          <div className="admin-washer-facts">
            <span>시작 <strong>{timeLabel(washer.startedAt)}</strong></span>
            <span>완료 <strong>{timeLabel(washer.finishedAt)}</strong></span>
            <span>완료 알림 <strong>{washer.pushSentAt ? '전송됨' : '—'}</strong></span>
          </div>
          <Link className="button admin-washer-open" href={`/admin/simulator?washer=${encodeURIComponent(washer.id)}`}>{washer.state === 'IDLE' ? '테스트 시작하기' : '상태 보기 · 처리하기'}</Link>
        </article>;
      })}</div>
      <section className="section"><button className="button secondary" type="button" onClick={() => setShowQr((current) => !current)} aria-expanded={showQr}>{showQr ? 'QR 코드 닫기' : 'QR 코드 관리'}</button>{showQr && <WasherQrCards washers={qrWashers} />}</section>
      <div className="admin-bottom"><button className="text-link" onClick={lock}>잠금</button></div>
    </>}
  </main>;
}
