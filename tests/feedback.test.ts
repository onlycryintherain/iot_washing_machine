import { describe, expect, it } from 'vitest';
import { feedbackSchema } from '@/lib/validation';
import { FEEDBACK_WINDOW_DAYS, summarizeFeedback, type FeedbackRow } from '@/lib/feedback/summary';

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);
const DAY = 86_400_000;
const machines = [{ id: '1', name: '1번 세탁기' }, { id: '2', name: '2번 세탁기' }];
const row = (washerId: string, rating: number, issues: string[] = [], daysAgo = 1): FeedbackRow => ({ washerId, rating, issues, comment: null, createdAt: new Date(NOW - daysAgo * DAY) });

describe('summarizeFeedback', () => {
  it('averages ratings per machine and ignores answers outside the window', () => {
    const [first, second] = summarizeFeedback(machines, [row('1', 5), row('1', 3), row('1', 1, [], FEEDBACK_WINDOW_DAYS + 1)], NOW);
    expect(first).toMatchObject({ count: 2, average: 4 });
    expect(second).toMatchObject({ count: 0, average: null, flags: [] });
  });

  it('flags a machine when residue shows up in 30% or more of the answers', () => {
    const rows = [row('1', 2, ['RESIDUE']), row('1', 3, ['RESIDUE']), row('1', 5), row('1', 5), row('1', 5)];
    const [summary] = summarizeFeedback(machines, rows, NOW);
    expect(summary.issues).toEqual({ RESIDUE: 2 });
    expect(summary.flags.map((flag) => flag.issue)).toContain('RESIDUE');
    expect(summary.flags.find((flag) => flag.issue === 'RESIDUE')?.message).toContain('필터');
  });

  it('does not flag on too few answers, except for a leak', () => {
    expect(summarizeFeedback(machines, [row('1', 1, ['RESIDUE']), row('1', 1, ['RESIDUE'])], NOW)[0].flags).toEqual([]);
    const [leak] = summarizeFeedback(machines, [row('1', 2, ['LEAK'])], NOW);
    expect(leak.flags).toHaveLength(1);
    expect(leak.flags[0]).toMatchObject({ issue: 'LEAK', urgent: true });
  });

  it('flags a low average and counts a repeated issue once per answer', () => {
    const [summary] = summarizeFeedback(machines, [row('1', 2), row('1', 3), row('1', 3, ['ODOR', 'ODOR'])], NOW);
    expect(summary.issues).toEqual({ ODOR: 1 });
    expect(summary.flags.map((flag) => flag.kind)).toEqual(['LOW_RATING']);
  });

  it('ignores unknown issue keys instead of counting them', () => {
    expect(summarizeFeedback(machines, [row('1', 4, ['SOMETHING_ELSE'])], NOW)[0].issues).toEqual({});
  });
});

describe('feedbackSchema', () => {
  it('accepts a rating with known issues and an optional comment', () => {
    expect(feedbackSchema.parse({ sessionId: 's1', rating: 4, issues: ['ODOR'], comment: ' 좋아요 ' })).toEqual({ sessionId: 's1', rating: 4, issues: ['ODOR'], comment: '좋아요' });
    expect(feedbackSchema.parse({ sessionId: 's1', rating: 5 }).issues).toEqual([]);
  });

  it.each([{ rating: 0 }, { rating: 6 }, { rating: 3.5 }, { rating: 3, issues: ['NOPE'] }, { rating: 3, comment: 'x'.repeat(201) }])('rejects %j', (body) => {
    expect(feedbackSchema.safeParse({ sessionId: 's1', ...body }).success).toBe(false);
  });
});
