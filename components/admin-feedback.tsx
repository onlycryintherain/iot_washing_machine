'use client';

import { useEffect, useState } from 'react';
import { ISSUES, ISSUE_KEYS, type Flag, type IssueKey } from '@/lib/feedback/summary';

type Summary = {
  windowDays: number;
  washers: Array<{ washerId: string; name: string; count: number; average: number | null; issues: Partial<Record<IssueKey, number>>; flags: Flag[] }>;
  recent: Array<{ washerId: string; rating: number; issues: string[]; comment: string; createdAt: string }>;
};

export function AdminFeedback({ password }: { password: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      fetch('/api/admin/feedback', { headers: { 'x-admin-password': password }, cache: 'no-store' })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          if (live) { setSummary(data); setError(''); }
        })
        .catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : '만족도를 불러오지 못했습니다.'); });
    };
    load();
    const interval = setInterval(load, 20_000);
    return () => { live = false; clearInterval(interval); };
  }, [password]);

  const names = new Map(summary?.washers.map((washer) => [washer.washerId, washer.name]));
  const flagged = summary?.washers.filter((washer) => washer.flags.length) ?? [];

  return <section className="section admin-feedback" aria-labelledby="admin-feedback-title">
    <div className="admin-users-heading"><div><h2 id="admin-feedback-title">세탁 만족도</h2><p className="lead">최근 {summary?.windowDays ?? 14}일 동안 사용자가 남긴 평가예요. 사용자 이름은 보이지 않아요.</p></div></div>
    {error && <p className="error" role="alert">{error}</p>}
    {flagged.length > 0 && <div className="admin-feedback-alerts" role="status">{flagged.map((washer) => <article key={washer.washerId} className={washer.flags.some((flag) => flag.urgent) ? 'urgent' : ''}>
      <strong>{washer.name} 점검 필요</strong>
      <ul>{washer.flags.map((flag) => <li key={`${flag.kind}-${flag.issue ?? ''}`}>{flag.message}</li>)}</ul>
    </article>)}</div>}
    {summary && flagged.length === 0 && <p className="notice" role="status">지금은 점검이 필요해 보이는 세탁기가 없어요.</p>}
    <div className="admin-grid">{summary?.washers.map((washer) => <article className="admin-card" key={washer.washerId}>
      <div className="admin-washer-heading"><h3>{washer.name}</h3><span className="tag">{washer.count}건</span></div>
      <p className="admin-feedback-score">{washer.average === null ? '아직 평가가 없어요' : <><strong>{washer.average.toFixed(1)}</strong> / 5점</>}</p>
      <div className="feedback-chips static">{ISSUE_KEYS.filter((key) => washer.issues[key]).map((key) => <span key={key}>{ISSUES[key].label} · {washer.issues[key]}건</span>)}</div>
    </article>)}</div>
    {summary && summary.recent.length > 0 && <>
      <h3 className="admin-feedback-sub">최근 의견</h3>
      <ul className="admin-feedback-comments">{summary.recent.map((item, index) => <li key={`${item.createdAt}-${index}`}>
        <span>{names.get(item.washerId) ?? item.washerId} · {item.rating}점 · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</span>
        <p>{item.comment}</p>
      </li>)}</ul>
    </>}
  </section>;
}
