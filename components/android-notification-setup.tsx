'use client';

import { useState } from 'react';
import { pushSupported } from '@/lib/push/client';

const STORAGE_KEY = 'laundry-android-notification-asked';

export function shouldShowAndroidNotificationSetup() {
  if (typeof window === 'undefined' || !/Android/i.test(navigator.userAgent) || !pushSupported()) return false;
  const installed = window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return installed && Notification.permission === 'default' && localStorage.getItem(STORAGE_KEY) !== 'true';
}

export function AndroidNotificationSetup({ onComplete }: { onComplete: (permission: NotificationPermission | 'skipped') => void }) {
  const [busy, setBusy] = useState(false);

  async function requestPermission() {
    // Keep the browser permission request in the direct button handler.
    let permission: NotificationPermission = 'default';
    setBusy(true);
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = 'default';
    } finally {
      localStorage.setItem(STORAGE_KEY, 'true');
      setBusy(false);
      onComplete(permission);
    }
  }

  function skip() {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete('skipped');
  }

  return <div className="onboarding-backdrop">
    <section className="onboarding-card" aria-labelledby="notification-setup-title">
      <h1 id="notification-setup-title">세탁 완료 알림을 받아보세요</h1>
      <p className="lead">세탁이 끝나거나 수거를 잊으면 알려드려요.</p>
      <div className="action-stack">
        <button className="button" type="button" disabled={busy} onClick={() => void requestPermission()}>{busy ? '권한 확인 중…' : '알림 허용하고 시작하기'}</button>
        <button className="button secondary" type="button" disabled={busy} onClick={skip}>나중에 하기</button>
      </div>
    </section>
  </div>;
}
