'use client';
/* eslint-disable react-hooks/set-state-in-effect -- restore a saved admin session after hydration */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { WasherState } from '@/lib/washer/state-machine';

type Washer = {
  id: string;
  name: string;
  state: WasherState;
  currentUserId: string | null;
  startedAt: string | null;
  lastActivityAt: string | null;
  finishedAt: string | null;
  vibration: number | null;
  current: number | null;
  doorOpen: boolean;
  pushSentAt: string | null;
};
type User = { id: string; nickname: string; userCode: string; hasPush: boolean };
type SimulatorData = { washers: Washer[]; users: User[] };

const stateNames: Record<WasherState, string> = {
  IDLE: '사용 가능',
  RESERVED: '사용자 등록됨',
  RUNNING: '세탁 중',
  MAYBE_FINISHED: '종료 확인 중',
  FINISHED: '세탁 완료',
  WAITING_FOR_PICKUP: '수거 대기',
};

export default function Simulator() {
  const [password, setPassword] = useState('');
  const [ok, setOk] = useState(false);
  const [washers, setWashers] = useState<Washer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState('');
  const [user, setUser] = useState('');
  const [demoName, setDemoName] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(12);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const refreshId = useRef(0);
  const backgroundLoading = useRef(false);

  function showMessage(text: string, isError = false) {
    setMessage(text);
    setMessageIsError(isError);
  }

  const load = useCallback(async (credential: string, silent = false): Promise<boolean> => {
    if (silent && backgroundLoading.current) return true;
    if (silent) backgroundLoading.current = true;
    const id = ++refreshId.current;
    try {
      const response = await fetch('/api/admin/simulator', { headers: { 'x-admin-password': credential }, cache: 'no-store' });
      if (!response.ok) {
        if (id === refreshId.current) {
          setOk(false);
          setMessage('운영자 비밀번호를 확인해주세요.');
          setMessageIsError(true);
        }
        return false;
      }
      const data = await response.json() as SimulatorData;
      if (id !== refreshId.current) return true;
      setWashers(data.washers);
      setUsers(data.users);
      const preferred = new URLSearchParams(window.location.search).get('washer');
      setSelected((current) => current && data.washers.some((washer) => washer.id === current)
        ? current
        : data.washers.find((washer) => washer.id === preferred)?.id ?? data.washers.find((washer) => washer.state === 'IDLE')?.id ?? data.washers[0]?.id ?? '');
      setOk(true);
      return true;
    } catch {
      if (!silent && id === refreshId.current) {
        setMessage('운영 정보를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.');
        setMessageIsError(true);
      }
      return false;
    } finally { if (silent) backgroundLoading.current = false; }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pass');
    if (saved) {
      setPassword(saved);
      void load(saved);
    }
  }, [load]);

  useEffect(() => {
    if (!ok || !password || demoRunning) return;
    const refresh = () => { if (!document.hidden) void load(password, true); };
    const interval = setInterval(refresh, 1500);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [ok, password, demoRunning, load]);

  async function login() {
    if (!password) return;
    if (await load(password)) {
      sessionStorage.setItem('admin-pass', password);
      showMessage('');
    }
  }

  async function request(data: object) {
    refreshId.current++;
    setBusy(true);
    showMessage('');
    try {
      const response = await fetch('/api/admin/simulator', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '요청에 실패했습니다.');
      refreshId.current++;
      if (result.washer) setWashers((current) => current.map((washer) => washer.id === result.washer.id ? result.washer : washer));
      if (result.user) setUsers((current) => [...current, { ...result.user, hasPush: false }]);
      void load(password, true);
      return result;
    } catch (cause) {
      showMessage(cause instanceof Error ? cause.message : '요청에 실패했습니다.', true);
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  async function runAction(data: object, success: string) {
    try { await request(data); showMessage(success); } catch { /* request already shows the error */ }
  }

  async function makeUser() {
    const nickname = demoName.trim();
    if (!nickname) { showMessage('테스트 사용자 이름을 입력해주세요.', true); return; }
    try {
      const result = await request({ action: 'demo-user', nickname });
      setUser(result.user.id);
      setDemoName('');
      showMessage(`${result.user.nickname} 사용자를 만들고 선택했습니다.`);
    } catch { /* request already shows the error */ }
  }

  async function reserve() {
    if (!user) { showMessage('먼저 사용자를 선택하거나 테스트 사용자를 만들어주세요.', true); return; }
    if (!selected) return;
    await runAction({ action: 'reserve', washerId: selected, userId: user }, '사용자를 등록했습니다. 이제 세탁 시작을 누를 수 있습니다.');
  }

  async function demo() {
    if (!selected || washer?.state !== 'RESERVED') return;
    setDemoRunning(true);
    setSecondsLeft(12);
    const started = Date.now();
    const timer = setInterval(() => {
      setSecondsLeft(Math.max(0, 12 - Math.floor((Date.now() - started) / 1000)));
      void load(password);
    }, 1000);
    try {
      await request({ action: 'simulate', washerId: selected });
      showMessage('세탁이 완료되었습니다. 수거 완료 전까지 2분이 지나면 수거 알림이 전송됩니다.');
    } catch { /* request already shows the error */ }
    finally { clearInterval(timer); setDemoRunning(false); }
  }

  function lock() {
    refreshId.current++;
    sessionStorage.removeItem('admin-pass');
    setOk(false);
    setPassword('');
    setWashers([]);
    setUsers([]);
    setSelected('');
    showMessage('');
  }

  const washer = washers.find((item) => item.id === selected);
  const canReserve = washer?.state === 'IDLE';
  const canPickup = washer?.state === 'FINISHED' || washer?.state === 'WAITING_FOR_PICKUP';
  const currentUser = users.find((item) => item.id === washer?.currentUserId);

  return <main className="admin-shell">
    <div className="topline"><Link className="back" href="/admin"><ArrowLeft /></Link><span className="brand">운영 도구</span></div>
    <h1>세탁기 시뮬레이터</h1>
    <p className="lead">사용자를 등록한 뒤 세탁을 시작하면 약 12초 후 자동으로 종료됩니다. 세탁기 상태는 자동으로 갱신됩니다.</p>

    {!ok ? <section className="section">
      <label className="eyebrow" htmlFor="simulator-password">운영자 비밀번호</label>
      <input className="input" id="simulator-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void login(); }} placeholder="운영자 비밀번호" />
      <button className="button" disabled={!password} onClick={() => void login()}>접속</button>
    </section> : <>
      <section className="section">
        <label className="eyebrow" htmlFor="simulator-washer">1. 세탁기 선택</label>
        <select className="input" id="simulator-washer" value={selected} onChange={(event) => setSelected(event.target.value)} disabled={demoRunning}>
          {washers.map((item) => <option key={item.id} value={item.id}>{item.name} · {stateNames[item.state]}</option>)}
        </select>
        {washer && <div className="admin-card">
          <span className={`tag ${washer.state === 'IDLE' || washer.state === 'FINISHED' ? 'done' : 'busy'}`}>{stateNames[washer.state]}</span>
          <div className="detail-list">
            {[
              ['사용자', currentUser?.nickname ?? '—'],
              ['시작', washer.startedAt ? new Date(washer.startedAt).toLocaleString('ko-KR') : '—'],
              ['최근 활동', washer.lastActivityAt ? new Date(washer.lastActivityAt).toLocaleString('ko-KR') : '—'],
              ['완료', washer.finishedAt ? new Date(washer.finishedAt).toLocaleString('ko-KR') : '—'],
              ['진동', String(washer.vibration ?? '—')],
              ['전류', washer.current === null ? '—' : `${washer.current} A`],
              ['문', washer.doorOpen ? '열림' : '닫힘'],
              ['Push', washer.pushSentAt ? '전송됨' : '—'],
            ].map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><span>{value}</span></div>)}
          </div>
        </div>}
      </section>

      <section className="section">
        <h2>2. 사용자 선택</h2>
        <p className="lead simulator-help">목록에서 선택하거나 아래에 이름을 입력해 테스트 사용자를 만드세요.</p>
        <select className="input" aria-label="시뮬레이터 사용자" value={user} onChange={(event) => setUser(event.target.value)} disabled={demoRunning}>
          <option value="">사용자를 선택하세요</option>
          {users.map((item) => <option key={item.id} value={item.id}>{item.nickname} · {item.userCode}{item.hasPush ? ' · 알림 연결' : ''}</option>)}
        </select>
        <div className="simulator-user-create">
          <input className="input" aria-label="테스트 사용자 이름" placeholder="새 테스트 사용자 이름" value={demoName} maxLength={24} onChange={(event) => setDemoName(event.target.value)} disabled={busy || demoRunning} onKeyDown={(event) => { if (event.key === 'Enter') void makeUser(); }} />
          <button className="button small secondary" onClick={() => void makeUser()} disabled={busy || demoRunning}>테스트 사용자 만들기</button>
        </div>
        <button className="button" disabled={busy || demoRunning || !canReserve} aria-busy={busy} onClick={() => void reserve()}>사용자 등록</button>
        {currentUser && !currentUser.hasPush && <p className="notice">이 사용자는 앱 알림이 연결되지 않아 완료·수거 알림을 받을 수 없습니다. 앱에서 알림을 허용한 사용자를 선택하세요.</p>}
      </section>

      <section className="section">
        <h2>3. 시뮬레이션 시작</h2>
        <p className="lead simulator-help">세탁 시작 후 약 12초에 종료 알림이 전송됩니다. 수거하지 않으면 종료 2분 후 수거 알림이 전송됩니다.</p>
        <button className="button" disabled={busy || demoRunning || washer?.state !== 'RESERVED'} aria-busy={demoRunning} onClick={() => void demo()}>{demoRunning ? `세탁 중 · 약 ${secondsLeft}초 남음` : '세탁 시작'}</button>
        <div className="admin-actions">
          <button className="button small secondary" disabled={busy || demoRunning || !canPickup} onClick={() => void runAction({ action: 'event', washerId: selected, event: 'PICKUP' }, '수거를 완료해 세탁기를 비웠습니다.')}>수거 완료</button>
          <button className="button small secondary" disabled={busy || demoRunning || !washer || washer.state === 'IDLE'} onClick={() => void runAction({ action: 'event', washerId: selected, event: 'RESET' }, '세탁기를 초기화했습니다.')}>초기화</button>
        </div>
      </section>
    </>}

    {message && <p className={messageIsError ? 'error' : 'notice'} role="status">{message}</p>}
    {ok && <button className="text-link simulator-lock" onClick={lock}><RotateCcw size={14} /> 잠금</button>}
  </main>;
}
