'use client';
/* eslint-disable react-hooks/set-state-in-effect -- read browser-only state after hydration */

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { pushSupported, registerPush } from '@/lib/push/client';

type PushState = 'checking' | 'unsupported' | 'on' | 'off' | 'denied';

const pushText: Record<PushState, string> = {
  checking: '알림 상태를 확인하는 중이에요',
  unsupported: '이 기기에서는 알림을 지원하지 않아요',
  on: '알림이 켜져 있어요',
  off: '알림이 꺼져 있어요',
  denied: '기기 설정에서 이 앱의 알림을 허용해주세요',
};

function authHeaders() {
  return { authorization: `Bearer ${localStorage.getItem('laundry-token') ?? ''}` };
}

export default function SettingsPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [push, setPush] = useState<PushState>('checking');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch('/api/me', { headers: authHeaders(), cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) { setName(data.nickname); setStudentId(data.studentId ?? ''); } })
      .catch(() => {});
    if (!pushSupported()) setPush('unsupported');
    else setPush(Notification.permission === 'granted' ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off');
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ nickname: name.trim(), studentId: studentId.trim() }),
      });
      if (!response.ok) throw new Error('save failed');
      try {
        const saved = JSON.parse(localStorage.getItem('laundry-user') ?? '{}');
        localStorage.setItem('laundry-user', JSON.stringify({ ...saved, nickname: name.trim() }));
      } catch { /* the stored profile is only a cache */ }
      setProfileMessage('저장했어요.');
    } catch {
      setProfileError('저장하지 못했어요. 이름과 학번을 확인하고 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  async function enablePush() {
    setPushBusy(true);
    setPushMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setPush(permission === 'denied' ? 'denied' : 'off'); return; }
      await registerPush(localStorage.getItem('laundry-token') ?? '');
      setPush('on');
      setPushMessage('알림을 켰어요.');
    } catch {
      setPushMessage('알림을 연결하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setPushBusy(false);
    }
  }

  async function testPush() {
    setPushBusy(true);
    setPushMessage('');
    try {
      const response = await fetch('/api/push/test', { method: 'POST', headers: authHeaders() });
      setPushMessage(response.ok ? '테스트 알림을 보냈어요.' : '알림을 보내지 못했어요. 알림 연결을 다시 확인해주세요.');
    } catch {
      setPushMessage('알림을 보내지 못했어요.');
    } finally {
      setPushBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem('laundry-token');
    localStorage.removeItem('laundry-user');
    window.dispatchEvent(new Event('laundry-profile-updated'));
    router.replace('/');
  }

  return <>
    <div className="topline"><span className="brand">설정</span></div>

    <section className="panel" aria-label="내 정보">
      <div className="panel-head"><h2>내 정보</h2></div>
      <form onSubmit={(event) => void saveProfile(event)}>
        <label className="eyebrow" htmlFor="setting-name">이름</label>
        <input className="input" id="setting-name" autoComplete="name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} required />
        <label className="eyebrow" htmlFor="setting-student-id">학번</label>
        <input className="input" id="setting-student-id" autoComplete="off" inputMode="numeric" maxLength={32} value={studentId} onChange={(event) => setStudentId(event.target.value)} required />
        {profileError && <p className="error" role="alert">{profileError}</p>}
        {profileMessage && <p className="muted" role="status">{profileMessage}</p>}
        <button className="button" type="submit" disabled={saving || !name.trim() || !studentId.trim()}>{saving ? '저장하는 중…' : '저장하기'}</button>
      </form>
    </section>

    <section className="panel" aria-label="알림">
      <div className="panel-head"><h2>알림</h2></div>
      <p className={`setting-status ${push}`}>{pushText[push]}</p>
      {pushMessage && <p className="muted" role="status">{pushMessage}</p>}
      <div className="setting-actions">
        {push === 'off' && <button className="button" type="button" disabled={pushBusy} onClick={() => void enablePush()}>{pushBusy ? '연결하는 중…' : '알림 켜기'}</button>}
        {push === 'on' && <button className="button secondary" type="button" disabled={pushBusy} onClick={() => void testPush()}>{pushBusy ? '보내는 중…' : '테스트 알림 보내기'}</button>}
      </div>
    </section>

    <section className="panel" aria-label="이 기기">
      <div className="panel-head"><h2>이 기기</h2></div>
      <p className="lead">로그아웃해도 같은 이름과 학번으로 다시 등록하면 세탁 기록과 알림이 이어져요.</p>
      {confirming
        ? <div className="setting-actions"><button className="button danger" type="button" onClick={logout}>로그아웃하기</button><button className="button secondary" type="button" onClick={() => setConfirming(false)}>취소</button></div>
        : <div className="setting-actions"><button className="button secondary" type="button" onClick={() => setConfirming(true)}>이 기기에서 로그아웃</button></div>}
    </section>
  </>;
}
