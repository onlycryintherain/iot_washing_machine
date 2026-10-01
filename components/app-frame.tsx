'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, ScanLine, WashingMachine } from 'lucide-react';
import { Onboarding } from '@/components/onboarding';
import { InstallGate, useInstallPrompt } from '@/components/install-prompt';

const items = [
  { href: '/', label: '홈', Icon: Home },
  { href: '/scan', label: 'QR 스캔', Icon: ScanLine },
  { href: '/washers', label: '세탁기', Icon: WashingMachine },
];

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
    const token = localStorage.getItem('laundry-token');
    let complete = false;
    try {
      const profile = JSON.parse(localStorage.getItem('laundry-user') ?? 'null');
      complete = !!token && profile?.profileComplete === true;
    } catch {
      complete = false;
    }
    setNeedsOnboarding(!complete);
    setInitialized(true);
  }, [admin]);

  function finishOnboarding(pushNotice?: string) {
    setNotice(pushNotice ?? '');
    setNeedsOnboarding(false);
  }

  if (!admin && (!initialized || !installPrompt.ready)) {
    return <div className="app-startup" aria-label="앱을 여는 중">기숙사 세탁실을 여는 중…</div>;
  }

  if (!admin && !installPrompt.standalone) {
    return <InstallGate prompt={installPrompt} />;
  }

  if (!admin && needsOnboarding) {
    return <Onboarding onComplete={finishOnboarding} />;
  }

  return <>
    <main className={admin ? 'app-main' : 'app-main student-app'}>
      {notice && <div className="notice onboarding-result" role="status">{notice}<button className="text-link" onClick={() => setNotice('')}>확인</button></div>}
      {children}
    </main>
    {!admin && <nav className="tabbar student-tabbar" aria-label="주 메뉴">{items.map(({ href, label, Icon }) =>
      <Link href={href} key={href} className={path === href ? 'tab active' : 'tab'}><Icon size={20} strokeWidth={1.8}/><span>{label}</span></Link>
    )}</nav>}
  </>;
}
