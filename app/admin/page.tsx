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
type Person = { id: string; nickname: string; studentId: string | null; createdAt: string; hasPush: boolean; pushDevices: number };
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
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'connected' | 'disconnected'>('all');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftStudentId, setDraftStudentId] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [userError, setUserError] = useState('');
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
    setEditingUserId(null);
    setUserMessage('');
    setUserError('');
  }

  function editUser(person: Person) {
    setEditingUserId(person.id);
    setDraftName(person.nickname);
    setDraftStudentId(person.studentId ?? '');
    setUserMessage('');
    setUserError('');
  }

  async function saveUser() {
    if (!editingUserId || !draftName.trim() || savingUser) return;
    setSavingUser(true);
    setUserError('');
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(editingUserId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ nickname: draftName.trim(), studentId: draftStudentId.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '사용자 정보를 저장하지 못했습니다.');
      setPeople((current) => current.map((person) => person.id === editingUserId ? { ...person, ...data.user } : person));
      setEditingUserId(null);
      setUserMessage('사용자 정보를 저장했습니다.');
      void load(password, true);
    } catch (cause) {
      setUserError(cause instanceof Error ? cause.message : '사용자 정보를 저장하지 못했습니다.');
    } finally { setSavingUser(false); }
  }

  const availableCount = items.filter((washer) => washer.state === 'IDLE').length;
  const connectedCount = people.filter((person) => person.hasPush).length;
  const query = search.trim().toLocaleLowerCase('ko-KR');
  const visiblePeople = people.filter((person) => {
    if (userFilter === 'connected' && !person.hasPush) return false;
    if (userFilter === 'disconnected' && person.hasPush) return false;
    return !query || [person.nickname, person.studentId ?? ''].some((value) => value.toLocaleLowerCase('ko-KR').includes(query));
  });

  return <div className="admin-shell">
    <div className="admin-topbar"><BrandLogo />{loaded && <div className="admin-topbar-actions"><Link href="/admin/simulator" className="button small secondary">시뮬레이터 열기</Link><button className="button small secondary" type="button" onClick={lock}>잠금</button></div>}</div>
    <div className="admin-page-heading"><div><p className="eyebrow">OPERATIONS</p><h1>운영 패널</h1><p className="lead">세탁기 상태와 사용자 등록 현황을 확인하고 관리하세요.</p></div></div>

    {!loaded && <section className="section admin-login">
      <label className="eyebrow" htmlFor="admin-password">운영자 비밀번호</label>
      <input className="input" id="admin-password" type="password" placeholder="운영자 비밀번호" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(password); }} />
      <button className="button" disabled={!password || busy} aria-busy={busy} onClick={() => void load(password)}>{busy ? '불러오는 중…' : '운영 도구 열기'}</button>
    </section>}
    {error && <p className="error">{error}</p>}

    {loaded && <>
      <div className="admin-overview" aria-label="운영 요약">
        <div className="admin-overview-item"><span>사용 가능</span><strong>{availableCount}<small> / {items.length}대</small></strong></div>
        <div className="admin-overview-item"><span>사용 중 · 수거 대기</span><strong>{items.length - availableCount}<small>대</small></strong></div>
        <div className="admin-overview-item"><span>등록 사용자</span><strong>{people.length}<small>명</small></strong></div>
        <div className="admin-overview-item"><span>알림 연결</span><strong>{connectedCount}<small>명</small></strong></div>
      </div>
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
      <section className="section admin-users-section" aria-labelledby="admin-users-title">
        <div className="admin-users-heading"><div><h2 id="admin-users-title">사용자 관리</h2><p className="lead">이름·학번을 검색하고 등록 정보를 수정하세요.</p></div><span className="admin-count">{visiblePeople.length}명 표시</span></div>
        <div className="admin-user-toolbar">
          <input className="input" type="search" aria-label="사용자 검색" placeholder="이름 또는 학번 검색" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="input" aria-label="알림 연결 필터" value={userFilter} onChange={(event) => setUserFilter(event.target.value as typeof userFilter)}><option value="all">전체 사용자</option><option value="connected">알림 연결</option><option value="disconnected">알림 미연결</option></select>
        </div>
        {userMessage && <p className="notice" role="status">{userMessage}</p>}
        {userError && <p className="error" role="alert">{userError}</p>}
        <div className="admin-table-scroll"><table className="admin-table admin-users-table"><thead><tr><th>사용자</th><th>학번</th><th>현재 세탁기</th><th>알림</th><th>등록일</th><th>관리</th></tr></thead><tbody>
          {visiblePeople.map((person) => {
            const activeWasher = items.find((washer) => washer.currentUserId === person.id);
            const editing = editingUserId === person.id;
            return <tr key={person.id}>
              <td>{editing ? <input className="input admin-table-input" aria-label={`${person.nickname} 이름`} maxLength={60} value={draftName} onChange={(event) => setDraftName(event.target.value)} /> : <strong>{person.nickname}</strong>}</td>
              <td>{editing ? <input className="input admin-table-input" aria-label={`${person.nickname} 학번`} placeholder="학번 없음" maxLength={32} value={draftStudentId} onChange={(event) => setDraftStudentId(event.target.value)} /> : person.studentId ?? <span className="muted">학번 없음</span>}</td>
              <td>{activeWasher ? <span className="admin-active-washer">{activeWasher.name} · {stateLabel[activeWasher.state] ?? activeWasher.state}</span> : <span className="muted">—</span>}</td>
              <td><span className={person.hasPush ? 'admin-push connected' : 'admin-push'}>{person.hasPush ? `${person.pushDevices}대 연결` : '미연결'}</span></td>
              <td>{new Date(person.createdAt).toLocaleDateString('ko-KR')}</td>
              <td>{editing ? <div className="admin-inline-actions"><button className="button small" type="button" disabled={savingUser || !draftName.trim()} onClick={() => void saveUser()}>{savingUser ? '저장 중…' : '저장'}</button><button className="button small secondary" type="button" disabled={savingUser} onClick={() => setEditingUserId(null)}>취소</button></div> : <button className="text-link admin-edit" type="button" onClick={() => editUser(person)}>수정</button>}</td>
            </tr>;
          })}
          {visiblePeople.length === 0 && <tr><td colSpan={6} className="admin-empty">조건에 맞는 사용자가 없습니다.</td></tr>}
        </tbody></table></div>
      </section>
      <section className="section admin-qr-section"><button className="button secondary" type="button" onClick={() => setShowQr((current) => !current)} aria-expanded={showQr}>{showQr ? 'QR 코드 닫기' : 'QR 코드 관리'}</button>{showQr && <WasherQrCards washers={qrWashers} />}</section>
    </>}
  </div>;
}
