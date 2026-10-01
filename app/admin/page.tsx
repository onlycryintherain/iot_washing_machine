'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { WasherQrCards } from '@/components/washer-qr-cards';

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

export default function Admin() {
  const [password, setPassword] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!password) return;
    try {
      const response = await fetch('/api/admin/simulator', { headers: { 'x-admin-password': password } });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setItems(data.washers);
      setPeople(data.users);
      sessionStorage.setItem('admin-pass', password);
      setLoaded(true);
      setError('');
    } catch (cause) {
      setLoaded(false);
      setError(cause instanceof Error ? cause.message : '운영 정보를 불러오지 못했습니다.');
    }
  }, [password]);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pass');
    if (saved) setPassword(saved);
  }, []);
  useEffect(() => { if (password) void load(); }, [password, load]);

  function lock() {
    sessionStorage.removeItem('admin-pass');
    setPassword('');
    setItems([]);
    setPeople([]);
    setLoaded(false);
  }

  return <main className="admin-shell">
    <div className="topline"><span className="brand">기숙사 세탁실 · 운영</span><Link href="/admin/simulator" className="text-link">시뮬레이터 →</Link></div>
    <h1>운영 현황</h1>
    <p className="lead">세탁기 상태를 확인하고, QR 안내 카드를 만들어 세탁기 앞에 붙이세요.</p>

    {!loaded && <section className="section">
      <label className="eyebrow" htmlFor="admin-password">운영자 비밀번호</label>
      <input className="input" id="admin-password" type="password" placeholder="운영자 비밀번호" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(); }} />
      <button className="button" disabled={!password} onClick={() => void load()}>운영 도구 열기</button>
    </section>}
    {error && <p className="error">{error}</p>}

    {loaded && <>
      <div className="section-head admin-status-heading"><h2>세탁기 상태</h2><button className="button small secondary" onClick={() => void load()}>새로고침</button></div>
      <div style={{ overflowX: 'auto' }}><table className="admin-table"><thead><tr><th>세탁기</th><th>상태</th><th>사용자</th><th>시작</th><th>경과</th><th>최근 활동</th><th>완료</th><th>알림</th></tr></thead><tbody>
        {items.map((washer) => <tr key={washer.id}>
          <td>{washer.name}</td><td>{washer.state}</td><td>{people.find((person) => person.id === washer.currentUserId)?.nickname ?? '—'}</td>
          <td>{washer.startedAt ? new Date(washer.startedAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : '—'}</td>
          <td>{washer.elapsedMinutes !== null ? `${washer.elapsedMinutes}분` : '—'}</td>
          <td>{washer.lastActivityAt ? new Date(washer.lastActivityAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : '—'}</td>
          <td>{washer.finishedAt ? new Date(washer.finishedAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : '—'}</td>
          <td>{washer.pushSentAt ? '전송됨' : '—'}</td>
        </tr>)}
      </tbody></table></div>
      <WasherQrCards washers={items.map(({ id, name }) => ({ id, name }))} />
      <div className="admin-bottom"><button className="text-link" onClick={lock}>잠금</button></div>
    </>}
  </main>;
}
