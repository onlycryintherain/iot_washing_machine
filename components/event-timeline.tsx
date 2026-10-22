'use client';

import { useEffect, useState } from 'react';
import { eventLabels } from '@/lib/stats/overview';

type WasherEvent = { id: string; type: string; vibration: number | null; current: number | null; doorOpen: boolean | null; createdAt: string };

function detail(event: WasherEvent) {
  const parts: string[] = [];
  if (event.vibration != null) parts.push(`진동 ${event.vibration}`);
  if (event.current != null) parts.push(`전류 ${event.current} A`);
  return parts.join(' · ');
}

export function EventTimeline({ washerId }: { washerId: string }) {
  const [events, setEvents] = useState<WasherEvent[] | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      fetch(`/api/washers/${washerId}/events`, { headers: { authorization: `Bearer ${localStorage.getItem('laundry-token') ?? ''}` }, cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => { if (live && data) setEvents(data.events); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 6000);
    document.addEventListener('visibilitychange', load);
    return () => { live = false; clearInterval(interval); document.removeEventListener('visibilitychange', load); };
  }, [washerId]);

  if (events === null) return null;
  return <section className="panel" aria-label="최근 활동">
    <div className="panel-head"><h2>최근 활동</h2><span className="panel-note">센서 기록</span></div>
    {events.length === 0 ? <p className="panel-empty">아직 기록이 없어요.</p> : <ol className="timeline">
      {events.map((event) => <li key={event.id}>
        <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' })}</time>
        <span><strong>{eventLabels[event.type] ?? event.type}</strong>{detail(event) && <small>{detail(event)}</small>}</span>
      </li>)}
    </ol>}
  </section>;
}
