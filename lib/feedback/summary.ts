export const FEEDBACK_WINDOW_DAYS = 14;
// Fewer answers than this say too little about a machine to flag it.
export const MIN_ANSWERS_TO_FLAG = 3;

export type IssueKey = 'RESIDUE' | 'ODOR' | 'STAIN' | 'DAMP' | 'NOISE' | 'LEAK';

// label is what the student picks; hint is what the admin should check.
export const ISSUES: Record<IssueKey, { label: string; hint: string; urgent?: boolean }> = {
  RESIDUE: { label: '옷에 이물질·보풀이 붙었어요', hint: '필터나 배수구에 이물질이 쌓였을 수 있어요. 필터 청소나 점검이 필요해요.' },
  ODOR: { label: '냄새가 나요', hint: '통 안쪽에 곰팡이나 찌꺼기가 있을 수 있어요. 통세척이 필요해요.' },
  STAIN: { label: '얼룩이 안 빠졌어요', hint: '세제 투입구나 세탁 코스 설정을 확인해 보세요.' },
  DAMP: { label: '물기가 많이 남았어요', hint: '탈수나 배수가 약해졌을 수 있어요. 점검이 필요해요.' },
  NOISE: { label: '소음·진동이 심했어요', hint: '수평이 틀어졌거나 베어링이 마모됐을 수 있어요. 점검이 필요해요.' },
  LEAK: { label: '물이 샜어요', hint: '누수가 있어요. 바로 확인하고 사용을 막아 주세요.', urgent: true },
};
export const ISSUE_KEYS = Object.keys(ISSUES) as IssueKey[];

export type FeedbackRow = { washerId: string; rating: number; issues: string[]; comment: string | null; createdAt: Date };
export type Flag = { kind: 'LOW_RATING' | 'ISSUE'; issue?: IssueKey; message: string; urgent: boolean };
export type WasherFeedbackSummary = {
  washerId: string;
  name: string;
  count: number;
  average: number | null;
  issues: Partial<Record<IssueKey, number>>;
  flags: Flag[];
};

const isIssue = (value: string): value is IssueKey => value in ISSUES;

function flagsFor(count: number, average: number | null, issues: Partial<Record<IssueKey, number>>): Flag[] {
  const flags: Flag[] = [];
  // A leak is urgent even with a single report.
  if (issues.LEAK) flags.push({ kind: 'ISSUE', issue: 'LEAK', urgent: true, message: `${ISSUES.LEAK.hint} (${issues.LEAK}건)` });
  if (count < MIN_ANSWERS_TO_FLAG) return flags;
  for (const key of ISSUE_KEYS) {
    const reports = issues[key] ?? 0;
    if (key === 'LEAK' || reports < 2 || reports / count < 0.3) continue;
    flags.push({ kind: 'ISSUE', issue: key, urgent: false, message: `${ISSUES[key].hint} (${count}건 중 ${reports}건)` });
  }
  if (average !== null && average < 3.5) flags.push({ kind: 'LOW_RATING', urgent: false, message: `평균 만족도가 낮아요 (${average.toFixed(1)}점)` });
  return flags;
}

export function summarizeFeedback(machines: Array<{ id: string; name: string }>, rows: FeedbackRow[], now = Date.now()): WasherFeedbackSummary[] {
  const since = now - FEEDBACK_WINDOW_DAYS * 86_400_000;
  return machines.map(({ id, name }) => {
    const mine = rows.filter((row) => row.washerId === id && row.createdAt.getTime() >= since);
    const issues: Partial<Record<IssueKey, number>> = {};
    for (const row of mine) for (const issue of new Set(row.issues)) if (isIssue(issue)) issues[issue] = (issues[issue] ?? 0) + 1;
    const average = mine.length ? mine.reduce((sum, row) => sum + row.rating, 0) / mine.length : null;
    return { washerId: id, name, count: mine.length, average, issues, flags: flagsFor(mine.length, average, issues) };
  });
}
