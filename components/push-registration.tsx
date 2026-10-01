'use client';

import { useEffect, useState } from 'react';
import { pushSupported, registerPush } from '@/lib/push/client';

type PushState = 'ready' | 'default' | 'denied' | 'connecting' | 'error' | 'unsupported';

export function PushRegistration({ visible }: { visible: boolean }) {
  const [state, setState] = useState<PushState>('ready');

  async function connect() {
    const token = localStorage.getItem('laundry-token');
    if (!token) return;
    setState('connecting');
    try {
      await registerPush(token);
      setState('ready');
    } catch (error) {
      console.error('Push registration failed', error instanceof Error ? error.message : 'Unknown error');
      setState('error');
    }
  }

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!pushSupported()) setState('unsupported');
      else if (Notification.permission === 'granted') void connect();
      else setState(Notification.permission === 'denied' ? 'denied' : 'default');
    });
    return () => { active = false; };
  }, []);

  async function enable() {
    if (state === 'error') {
      await connect();
      return;
    }
    // The permission prompt must start directly from this button tap.
    try {
      const permissionRequest = Notification.requestPermission();
      setState('connecting');
      const permission = await permissionRequest;
      if (permission === 'granted') await connect();
      else setState(permission === 'denied' ? 'denied' : 'default');
    } catch {
      setState('error');
    }
  }

  if (!visible || state === 'ready' || state === 'unsupported' || state === 'connecting') return null;

  return <div className="push-registration" role="status">
    <span>{state === 'denied'
      ? '완료·미수거 알림을 받으려면 기기 설정에서 이 앱의 알림을 허용해주세요.'
      : state === 'error'
        ? '알림 연결이 완료되지 않았어요.'
        : '세탁 완료·미수거 알림을 받아보세요.'}</span>
    {state !== 'denied' && <button type="button" className="text-link" onClick={() => void enable()}>
      {state === 'error' ? '다시 연결' : '알림 허용'}
    </button>}
  </div>;
}
