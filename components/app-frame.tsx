'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Home, ScanLine, WashingMachine } from 'lucide-react';
import { Onboarding } from '@/components/onboarding';
import { InstallGate, useInstallPrompt } from '@/components/install-prompt';
import { PushRegistration } from '@/components/push-registration';

const items = [
  { href: '/', label: '홈', Icon: Home },
  { href: '/scan', label: 'QR 스캔', Icon: ScanLine },
  { href: '/washers', label: '세탁기', Icon: WashingMachine },
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
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

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('caches' in window)) return;
    const cacheName = 'dorm-laundry-notification-navigation-v1';
    const cacheKey = '/__laundry_notification_target__';
    const validPath = (value: unknown): value is string => typeof value === 'string' && /^\/washer\/[^/?#]+$/.test(value);
    const open = (target: string) => { if (window.location.pathname !== target) router.push(target); };

    const consume = async () => {
      try {
        const cache = await caches.open(cacheName);
        const response = await cache.match(cacheKey);
        if (!response) return;
        await cache.delete(cacheKey);
        const data = await response.json();
        if (validPath(data.path) && typeof data.at === 'number' && Date.now() - data.at < 120_000) open(data.path);
      } catch (error) {
        console.error('Notification navigation failed', error);
      }
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'LAUNDRY_NOTIFICATION_OPEN' || !validPath(event.data.path)) return;
      open(event.data.path);
      void caches.open(cacheName).then((cache) => cache.delete(cacheKey)).catch(console.error);
    };
    const onVisible = () => { if (!document.hidden) void consume(); };

    void consume();
    navigator.serviceWorker.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [router]);

  function finishOnboarding(pushNotice?: string) {
    setNotice(pushNotice ?? '');
    setNeedsOnboarding(false);
  }

  if (!admin && (!initialized || !installPrompt.ready)) {
    return <div className="app-startup" aria-label="앱을 여는 중">
      <Image src="/icons/brand-mark.png" alt="" width={96} height={96} className="startup-logo" priority unoptimized />
      <span>기숙사 세탁실을 여는 중…</span>
    </div>;
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
      {children}
      {!admin && <PushRegistration visible={path === '/'} />}
    </main>
    {!admin && <nav className="tabbar" aria-label="주 메뉴">{items.map(({ href, label, Icon }) =>
      <Link href={href} key={href} className={path === href ? 'tab active' : 'tab'}><Icon size={20} strokeWidth={1.8} /><span>{label}</span></Link>
    )}</nav>}
  </>;
}
