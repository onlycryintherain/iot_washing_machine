'use client';
/* eslint-disable react-hooks/set-state-in-effect -- restore a saved admin session after hydration */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, RotateCcw } from 'lucide-react';
import { transition, type WasherEvent, type WasherState } from '@/lib/washer/state-machine';

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
type User = { id: string; nickname: string; userCode: string };
type SimulatorData = { washers: Washer[]; users: User[] };

const stateNames: Record<WasherState, string> = {
  IDLE: '사용 가능',
  RESERVED: '사용자 등록됨',
  RUNNING: '세탁 중',
  MAYBE_FINISHED: '종료 확인 중',
  FINISHED: '세탁 완료',
  WAITING_FOR_PICKUP: '수거 대기',
};

const sensorEvents: Array<{ event: Exclude<WasherEvent, 'RESERVE'>; label: string }> = [
  { event: 'START', label: '세탁 시작' },
  { event: 'ACTIVITY', label: '진동 발생' },
  { event: 'NO_ACTIVITY', label: '종료 후보' },
  { event: 'RESUME', label: '다시 동작' },
  { event: 'FINISH', label: '세탁 종료' },
  { event: 'DOOR_OPEN', label: '문 열기' },
  { event: 'PICKUP', label: '수거 완료' },
  { event: 'RESET', label: '초기화' },
];

function canApply(state: WasherState, event: WasherEvent) {
  if (state === 'IDLE' && event === 'RESET') return false;
  try { transition(state, event); return true; } catch { return false; }
}

export default function Simulator() {
  const [password, setPassword] = useState('');
  const [ok, setOk] = useState(false);
  const [washers, setWashers] = useState<Washer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState('');
  const [user, setUser] = useState('');
  const [demoName, setDemoName] = useState('');
  const [speed, setSpeed] = useState(10);
  const [busy, setBusy] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  function showMessage(text: string, isError = false) {
    setMessage(text);
    setMessageIsError(isError);
  }

  const load = useCallback(async (credential: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/simulator', { headers: { 'x-admin-password': credential }, cache: 'no-store' });
      if (!response.ok) {
        setOk(false);
        setMessage('운영자 비밀번호를 확인해주세요.');
        setMessageIsError(true);
        return false;
      }
      const data = await response.json() as SimulatorData;
      setWashers(data.washers);
      setUsers(data.users);
      setSelected((current) => current && data.washers.some((washer) => washer.id === current)
        ? current
        : data.washers.find((washer) => washer.state === 'IDLE')?.id ?? data.washers[0]?.id ?? '');
      setOk(true);
      return true;
    } catch {
      setOk(false);
      setMessage('운영 정보를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.');
      setMessageIsError(true);
      return false;
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pass');
    if (saved) {
      setPassword(saved);
      void load(saved);
    }
  }, [load]);

  async function login() {
    if (!password) return;
    if (await load(password)) {
      sessionStorage.setItem('admin-pass', password);
      showMessage('');
    }
  }

  async function request(data: object) {
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
      await load(password);
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
    if (!user) { showMessage('데모에 사용할 사용자를 먼저 선택해주세요.', true); return; }
    if (!selected) return;
    setDemoRunning(true);
    setProgress('사용자를 등록하는 중…');
    try {
      await request({ action: 'reserve', washerId: selected, userId: user });
      const sequence: Array<[number, Exclude<WasherEvent, 'RESERVE'>, string]> = [
        [5, 'START', '세탁 시작'],
        [20, 'ACTIVITY', '진동 발생'],
        [30, 'NO_ACTIVITY', '잠시 멈춤'],
        [38, 'RESUME', '다시 동작'],
        [55, 'NO_ACTIVITY', '잠시 멈춤'],
        [65, 'RESUME', '다시 동작'],
        [85, 'NO_ACTIVITY', '잠시 멈춤'],
        [95, 'RESUME', '다시 동작'],
        [120, 'FINISH', '세탁 완료'],
      ];
      let previousSecond = 0;
      for (const [second, event, label] of sequence) {
        await new Promise((resolve) => setTimeout(resolve, (second - previousSecond) * 1000 / speed));
        previousSecond = second;
        setProgress(`진행 중: ${label} (${second}/120초)`);
        await request({ action: 'event', washerId: selected, event });
      }
      showMessage('데모가 끝났습니다. 완료 상태를 확인한 뒤 수거 완료 또는 초기화를 눌러주세요.');
    } catch { /* request already shows the error */ }
    finally { setDemoRunning(false); setProgress(''); }
  }

  function lock() {
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
  const canRemind = washer?.state === 'FINISHED' || washer?.state === 'WAITING_FOR_PICKUP';
  const currentUser = users.find((item) => item.id === washer?.currentUserId);

  return <main className="admin-shell">
    <div className="topline"><Link className="back" href="/admin"><ArrowLeft /></Link><span className="brand">운영 도구</span></div>
    <h1>세탁기 시뮬레이터</h1>
    <p className="lead">세탁기 상태를 선택하고 센서 이벤트를 재현합니다.</p>

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
          <span className={`tag ${washer.state === 'IDLE' || washer.state === 'FINISHED' ? 'done' : 'busy'}`}>{stateNames[washer.state]} ({washer.state})</span>
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
        {!canReserve && washer && <p className="notice">{washer.name}는 현재 {stateNames[washer.state]} 상태입니다. 새 사용자를 등록하려면 사용 가능한 세탁기를 선택하세요.</p>}
      </section>

      <section className="section">
        <h2>2. 사용자 선택</h2>
        <p className="lead simulator-help">목록에서 선택하거나 아래에 이름을 입력해 테스트 사용자를 만드세요.</p>
        <select className="input" aria-label="시뮬레이터 사용자" value={user} onChange={(event) => setUser(event.target.value)} disabled={demoRunning}>
          <option value="">사용자를 선택하세요</option>
          {users.map((item) => <option key={item.id} value={item.id}>{item.nickname} · {item.userCode}</option>)}
        </select>
        <div className="simulator-user-create">
          <input className="input" aria-label="테스트 사용자 이름" placeholder="새 테스트 사용자 이름" value={demoName} maxLength={24} onChange={(event) => setDemoName(event.target.value)} disabled={busy || demoRunning} onKeyDown={(event) => { if (event.key === 'Enter') void makeUser(); }} />
          <button className="button small secondary" onClick={() => void makeUser()} disabled={busy || demoRunning}>테스트 사용자 만들기</button>
        </div>
        <button className="button" disabled={busy || demoRunning || !canReserve} aria-busy={busy} onClick={() => void reserve()}>사용자 등록</button>
        {canReserve && !user && <p className="lead simulator-help">사용자 등록을 누르면 먼저 사용자를 선택하라는 안내가 표시됩니다.</p>}
      </section>

      <section className="section">
        <h2>3. 센서 이벤트</h2>
        <p className="lead simulator-help">현재 상태에서 실행할 수 있는 이벤트만 활성화됩니다.</p>
        <div className="admin-actions">{sensorEvents.map(({ event, label }) =>
          <button className="button small secondary" key={event} disabled={busy || demoRunning || !washer || !canApply(washer.state, event)} onClick={() => void runAction({ action: 'event', washerId: selected, event }, `${label} 이벤트를 적용했습니다.`)}>{label}</button>
        )}</div>
      </section>

      <section className="section">
        <div className="section-head"><h2>중간 정지 확인 데모</h2><Play size={17} /></div>
        <p className="lead">세탁 중 잠시 멈췄다가 다시 움직이는 2분 흐름을 재생합니다. 완료 후에는 수거 완료 또는 초기화로 비울 수 있습니다.</p>
        <div className="speed-row">{[1, 2, 5, 10].map((value) => <button className={`button small ${speed === value ? '' : 'secondary'}`} key={value} onClick={() => setSpeed(value)} disabled={busy || demoRunning}>{value}×</button>)}</div>
        <button className="button" disabled={busy || demoRunning || !canReserve} aria-busy={demoRunning} onClick={() => void demo()}>{demoRunning ? '데모 실행 중…' : '2분 데모 실행'}</button>
        {progress && <p className="notice" role="status">{progress}</p>}
        <div className="admin-actions">
          <button className="button small secondary" disabled={busy || demoRunning || !canRemind} onClick={() => void runAction({ action: 'reminder', washerId: selected, minutes: 10 }, '10분 경과 알림을 처리했습니다.')}>10분 경과 시뮬레이션</button>
          <button className="button small secondary" disabled={busy || demoRunning || !canRemind} onClick={() => void runAction({ action: 'reminder', washerId: selected, minutes: 20 }, '20분 경과 알림을 처리했습니다.')}>20분 경과 시뮬레이션</button>
        </div>
      </section>
    </>}

    {message && <p className={messageIsError ? 'error' : 'notice'} role="status">{message}</p>}
    {ok && <button className="text-link simulator-lock" onClick={lock}><RotateCcw size={14} /> 잠금</button>}
  </main>;
}
