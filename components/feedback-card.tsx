'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { ISSUES, ISSUE_KEYS, type IssueKey } from '@/lib/feedback/summary';

type Pending = { sessionId: string; washerName: string };

const authHeader = () => ({ authorization: `Bearer ${localStorage.getItem('laundry-token') ?? ''}` });
const skippedKey = (sessionId: string) => `feedback-skipped-${sessionId}`;

export function FeedbackCard() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [rating, setRating] = useState(0);
  const [issues, setIssues] = useState<IssueKey[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState(false);

  const load = useCallback(() => {
    fetch('/api/feedback', { headers: authHeader(), cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const next: Pending | null = data?.pending ?? null;
        if (next && localStorage.getItem(skippedKey(next.sessionId))) return;
        setPending(next);
      })
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  function reset() { setRating(0); setIssues([]); setComment(''); setError(''); }

  async function submit() {
    if (!pending || !rating || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeader() },
        body: JSON.stringify({ sessionId: pending.sessionId, rating, issues, comment: comment.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '평가를 보내지 못했어요.');
      setPending(null);
      reset();
      setThanks(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '평가를 보내지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    if (pending) localStorage.setItem(skippedKey(pending.sessionId), '1');
    setPending(null);
    reset();
  }

  if (thanks) return <p className="notice feedback-thanks" role="status">평가해 주셔서 고마워요. 세탁기 관리에 반영할게요.</p>;
  if (!pending) return null;

  return <section className="feedback-card" aria-label="세탁 만족도 평가">
    <h2>{pending.washerName} 세탁은 어땠어요?</h2>
    <div className="feedback-stars" role="radiogroup" aria-label="만족도">
      {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value}점`} className={value <= rating ? 'on' : ''} onClick={() => setRating(value)}>
        <Star size={30} strokeWidth={1.8} fill={value <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>)}
    </div>
    {rating > 0 && <>
      <p className="feedback-sub">불편한 점이 있었다면 골라 주세요. (여러 개 선택 가능)</p>
      <div className="feedback-chips">{ISSUE_KEYS.map((key) => <button key={key} type="button" aria-pressed={issues.includes(key)} className={issues.includes(key) ? 'on' : ''} onClick={() => setIssues((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}>{ISSUES[key].label}</button>)}</div>
      <textarea className="feedback-comment" aria-label="추가 의견" placeholder="더 알려주실 내용이 있다면 적어 주세요. (선택)" maxLength={200} rows={2} value={comment} onChange={(event) => setComment(event.target.value)} />
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="feedback-actions">
      <button className="button" type="button" disabled={!rating || busy} aria-busy={busy} onClick={() => void submit()}>{busy ? '보내는 중…' : '평가 보내기'}</button>
      <button className="button secondary" type="button" disabled={busy} onClick={skip}>나중에</button>
    </div>
    <p className="feedback-privacy">이름은 관리자에게 보이지 않고, 세탁기별 통계로만 쓰여요.</p>
  </section>;
}
