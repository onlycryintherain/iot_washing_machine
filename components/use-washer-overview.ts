'use client';

import { useEffect, useState } from 'react';
import type { WasherSummary } from '@/lib/washer/presentation';

export function useWasherOverview() {
  const [washers, setWashers] = useState<WasherSummary[]>([]);
  const [myWasher, setMyWasher] = useState<WasherSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      fetch('/api/washers', {
        headers: { authorization: `Bearer ${localStorage.getItem('laundry-token') ?? ''}` },
        cache: 'no-store',
      }).then((response) => {
        if (response.status === 401) {
          localStorage.removeItem('laundry-token');
          localStorage.removeItem('laundry-user');
          window.dispatchEvent(new Event('laundry-profile-updated'));
        }
        if (!response.ok) throw new Error('세탁기 상태를 불러오지 못했습니다.');
        return response.json();
      }).then((data) => {
        if (!live) return;
        setWashers(data.washers);
        setMyWasher(data.myWasher ?? null);
        setError('');
        setLoaded(true);
      }).catch(() => {
        if (!live) return;
        setError('세탁기 상태를 불러오지 못했습니다.');
        setLoaded(true);
      });
    };
    load();
    const interval = setInterval(load, 5000);
    document.addEventListener('visibilitychange', load);
    return () => {
      live = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  return { washers, myWasher, loaded, error };
}
