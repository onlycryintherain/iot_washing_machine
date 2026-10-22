'use client';

import { useEffect, useState } from 'react';

export type Overview = {
  today: { count: number; avgMinutes: number | null };
  hourly: number[];
  totalSessions: number;
  history: { id: string; washerName: string; startedAt: string; minutes: number | null }[];
};

export function useOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      fetch('/api/overview', { headers: { authorization: `Bearer ${localStorage.getItem('laundry-token') ?? ''}` }, cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => { if (live && data) setOverview(data); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30_000);
    document.addEventListener('visibilitychange', load);
    return () => { live = false; clearInterval(interval); document.removeEventListener('visibilitychange', load); };
  }, []);

  return overview;
}
