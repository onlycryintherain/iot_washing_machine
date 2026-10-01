'use client';

import { useState, type FormEvent } from 'react';
import { WashingMachine } from 'lucide-react';
import { getPushSubscription, pushSupported, savePushSubscription } from '@/lib/push/client';

type Profile = { id: string; nickname: string; userCode: string; profileComplete: true };

function isInstalled() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function requestPermissionFromTap(): { result: Promise<NotificationPermission> | null; unavailableReason: string | null } {
  if (!pushSupported()) {
    return { result: null, unavailableReason: '이 브라우저에서는 푸시 알림을 지원하지 않습니다.' };
  }
  if (isIos() && !isInstalled()) {
    return { result: null, unavailableReason: 'iPhone/iPad에서는 Safari에서 홈 화면에 추가한 뒤 앱을 열면 알림을 받을 수 있습니다.' };
  }
  if (Notification.permission === 'granted') return { result: Promise.resolve('granted'), unavailableReason: null };
  if (Notification.permission === 'denied') return { result: Promise.resolve('denied'), unavailableReason: null };
  try {
    return { result: Notification.requestPermission(), unavailableReason: null };
  } catch {
    return { result: null, unavailableReason: '알림 권한을 요청할 수 없는 환경입니다.' };
  }
}

export function Onboarding({ onComplete }: { onComplete: (notice?: string) => void }) {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [existingToken] = useState(() => typeof window === 'undefined' ? '' : localStorage.getItem('laundry-token') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !studentId.trim()) {
      setError('이름과 학번을 모두 입력해주세요.');
      return;
    }

    // Request permission before any network wait so the browser sees this as a direct tap.
    const permissionRequest = requestPermissionFromTap();
    setBusy(true);
    setError('');
    try {
      let notice = permissionRequest.unavailableReason ?? undefined;
      let permission: NotificationPermission | null = null;
      try {
        permission = permissionRequest.result ? await permissionRequest.result : null;
      } catch {
        notice = '알림 권한창을 열지 못했습니다.';
      }
      let subscription: PushSubscription | null = null;
      if (permission === 'granted') {
        try {
          subscription = await getPushSubscription();
        } catch {
          notice = '알림 허용은 완료했지만 기기 등록에 실패했습니다.';
        }
      } else if (permission === 'denied') {
        notice = '알림이 허용되지 않았습니다. 알림을 원하면 기기의 앱 또는 브라우저 알림 설정에서 허용해주세요.';
      } else if (permission === 'default' && !notice) {
        notice = '알림 권한을 선택하지 않았습니다. 세탁 완료 알림을 받으려면 브라우저에서 허용해주세요.';
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(existingToken ? { authorization: `Bearer ${existingToken}` } : {}) },
        body: JSON.stringify({ nickname: name.trim(), studentId: studentId.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '사용자 등록에 실패했습니다.');
      const token = data.token ?? existingToken;
      if (!token) throw new Error('사용자 인증 정보를 저장하지 못했습니다. 다시 시도해주세요.');

      const profile: Profile = { ...data.user, profileComplete: true };
      localStorage.setItem('laundry-token', token);
      localStorage.setItem('laundry-user', JSON.stringify(profile));
      window.dispatchEvent(new Event('laundry-profile-updated'));

      if (subscription) {
        try {
          await savePushSubscription(token, subscription);
        } catch {
          notice = '사용자 등록은 완료했지만 알림 연결에 실패했습니다.';
        }
      }
      onComplete(notice);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '등록 중 문제가 생겼습니다. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="onboarding-backdrop">
    <section className="onboarding-card" aria-labelledby="onboarding-title">
      <div className="onboarding-icon"><WashingMachine size={24}/></div>
      <p className="brand">기숙사 세탁실</p>
      <h1 id="onboarding-title">처음 한 번만 등록해주세요</h1>
      <p className="lead">이름과 학번을 등록하면 세탁기를 사용할 수 있어요.</p>
      <form onSubmit={submit}>
        <label className="eyebrow" htmlFor="student-name">이름</label>
        <input className="input" id="student-name" autoComplete="name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="실명을 입력하세요" required />
        <label className="eyebrow" htmlFor="student-id">학번</label>
        <input className="input" id="student-id" autoComplete="off" inputMode="numeric" maxLength={32} value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="학번을 입력하세요" required />
        <p className="onboarding-privacy">학번은 이용자 확인을 위해 저장되며, 세탁기 화면에 표시하지 않습니다.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button" type="submit" disabled={busy || !name.trim() || !studentId.trim()}>{busy ? '등록 중…' : '등록하고 시작하기'}</button>
        <p className="onboarding-permission-note">등록할 때 세탁 완료 알림 허용창이 열립니다.</p>
      </form>
    </section>
  </div>;
}
