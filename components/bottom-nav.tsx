'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Settings, WashingMachine } from 'lucide-react';

const tabs = [
  { href: '/', label: '홈', icon: House },
  { href: '/my', label: '내 세탁', icon: WashingMachine },
  { href: '/settings', label: '설정', icon: Settings },
] as const;

// Only the top-level screens show the bar; detail and scan screens keep their own actions at the bottom.
export function BottomNav() {
  const path = usePathname();
  if (!tabs.some((tab) => tab.href === path)) return null;
  return <nav className="bottom-nav" aria-label="주요 메뉴">
    {tabs.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
      <Icon size={22} strokeWidth={path === href ? 2.25 : 1.75} aria-hidden="true" />{label}
    </Link>)}
  </nav>;
}
