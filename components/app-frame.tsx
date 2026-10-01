'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Onboarding } from '@/components/onboarding';
import { InstallGate, useInstallPrompt } from '@/components/install-prompt';
import { PushRegistration } from '@/components/push-registration';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const admin = path.startsWith('/admin');
  const [initialized, setInitialized] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [notice, setNotice] = useState('');
  const installPrompt = useInstallPrompt();

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);
    if (admin) {
      setNeedsOnboarding(false);
      setInitialized(true);
      return;
    }
    const syncProfile = () => {
      const token = localStorage.getItem('laundry-token');
      let complete = false;
      try {
        const profile = JSON.parse(localStorage.getItem('laundry-user') ?? 'null');
        complete = !!token && profile?.profileComplete === true;
      } catch {
        complete = false;
      }
      setNeedsOnboarding(!complete);
    };
    syncProfile();
    window.addEventListener('laundry-profile-updated', syncProfile);
    setInitialized(true);
    return () => window.removeEventListener('laundry-profile-updated', syncProfile);
  }, [admin]);

  function finishOnboarding(pushNotice?: string) {
    setNotice(pushNotice ?? '');
    setNeedsOnboarding(false);
  }

  if (!admin && (!initialized || !installPrompt.ready)) {
    return <div className="app-startup" aria-label="앱을 여는 중">기숙사 세탁실을 여는 중…</div>;
  }

  if (!admin && installPrompt.platform !== 'other' && !installPrompt.standalone) {
    return <InstallGate prompt={installPrompt} />;
  }

  if (!admin && needsOnboarding) {
    return <Onboarding onComplete={finishOnboarding} />;
  }

  return <>
    <main className={admin ? 'app-main' : 'app-main student-app'}>
      {notice && <div className="notice onboarding-result" role="status">{notice}<button className="text-link" onClick={() => setNotice('')}>확인</button></div>}
      {!admin && <PushRegistration visible={path === '/'} />}
      {children}
    </main>
  </>;
}
