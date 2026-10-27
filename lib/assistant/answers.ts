import type { WasherState } from '@/lib/washer/state-machine';
import { cycleProgress } from '@/lib/washer/simulation';

export const assistantIntents = ['availability', 'my_status', 'best_time', 'help'] as const;
export type AssistantIntent = (typeof assistantIntents)[number];

export const suggestedQuestions: { intent: AssistantIntent; label: string }[] = [
  { intent: 'availability', label: '남는 세탁기 있어?' },
  { intent: 'my_status', label: '내 세탁 언제 끝나?' },
  { intent: 'best_time', label: '세탁 추천 시간' },
  { intent: 'help', label: '사용 방법' },
];

export type AssistantReply = { text: string; links?: { label: string; href: string }[] };
export type AssistantWasher = { id: string; name: string; location: string; state: WasherState; startedAt: Date | null; finishedAt: Date | null };

export const MIN_HISTORY_FOR_RECOMMENDATION = 10;
export const HISTORY_DAYS = 30;
const KST_OFFSET_MS = 9 * 3600_000;
const RECOMMEND_FROM_HOUR = 7;

const keywords: [AssistantIntent, string[]][] = [
  ['best_time', ['추천', '한산', '붐비', '혼잡', '시간대', '언제 쓰', '언제 돌', '언제 하']],
  ['my_status', ['내 세탁', '내 빨래', '끝나', '끝날', '완료 예정', '진행', '남았']],
  ['help', ['사용법', '사용 방법', '방법', '어떻게', '도움', '알림']],
  ['availability', ['남는', '빈 ', '비어', '사용 가능', '사용가능', '쓸 수', '자리', '있어']],
];

export function matchIntent(text: string): AssistantIntent | null {
  const normalized = `${text.trim().toLowerCase()} `;
  return keywords.find(([, words]) => words.some((word) => normalized.includes(word)))?.[0] ?? null;
}

function kst(timestamp: number) {
  return new Date(timestamp + KST_OFFSET_MS);
}

export function clockLabel(timestamp: number) {
  const date = kst(timestamp);
  return `${hourLabel(date.getUTCHours())} ${String(date.getUTCMinutes()).padStart(2, '0')}분`;
}

export function hourLabel(hour: number) {
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}시`;
}

function etaText(washer: AssistantWasher, now: number) {
  if (!washer.startedAt) return '곧 끝날 예정이에요';
  const { minutesLeft, waiting, endsAt } = cycleProgress(washer.startedAt.getTime(), now);
  return waiting ? '종료 신호를 확인하고 있어요' : `약 ${minutesLeft}분 뒤(${clockLabel(endsAt)})에 끝나요`;
}

function describe(washer: AssistantWasher, now: number) {
  switch (washer.state) {
    case 'IDLE': return '지금 바로 사용할 수 있어요';
    case 'RESERVED': return '사용자가 등록되어 세탁 시작을 기다리고 있어요';
    case 'RUNNING':
    case 'MAYBE_FINISHED': return etaText(washer, now);
    case 'PAUSED': return '주인이 세탁을 잠시 멈춘 상태예요';
    case 'OUT_OF_ORDER': return '지금은 사용할 수 없어요';
    default: return '세탁은 끝났고 세탁물 수거를 기다리고 있어요';
  }
}

export function answerAvailability(washers: AssistantWasher[], now = Date.now()): AssistantReply {
  if (!washers.length) return { text: '등록된 세탁기가 아직 없어요.' };
  const idle = washers.filter((washer) => washer.state === 'IDLE');
  const lines = washers.map((washer) => `• ${washer.name}(${washer.location}): ${describe(washer, now)}`);
  const headline = idle.length
    ? `지금 사용할 수 있는 세탁기가 ${idle.length}대 있어요.`
    : '지금은 모든 세탁기가 사용 중이에요.';
  return { text: [headline, ...lines].join('\n'), links: [{ label: '세탁기 목록 보기', href: '/washers' }] };
}

export function answerMyStatus(washer: AssistantWasher | null, now = Date.now()): AssistantReply {
  if (!washer) {
    return { text: '지금 등록된 내 세탁이 없어요. 세탁기에 붙은 QR을 스캔해서 등록해주세요.', links: [{ label: 'QR 스캔하기', href: '/scan' }] };
  }
  const link = [{ label: `${washer.name} 자세히 보기`, href: `/washer/${washer.id}` }];
  if (washer.state === 'FINISHED' || washer.state === 'WAITING_FOR_PICKUP') {
    const minutes = washer.finishedAt ? Math.max(0, Math.floor((now - washer.finishedAt.getTime()) / 60_000)) : null;
    return { text: `${washer.name}의 세탁이 끝났어요${minutes === null ? '' : `(${minutes}분 전)`}. 세탁물을 가져가 주세요.`, links: link };
  }
  if (washer.state === 'RESERVED') return { text: `${washer.name}에 등록됐어요. 세탁이 시작되길 기다리고 있어요.`, links: link };
  return { text: `${washer.name}: ${etaText(washer, now)}.`, links: link };
}

export function answerBestTime(startTimes: Date[], now = Date.now()): { reply: AssistantReply; enoughData: boolean } {
  if (startTimes.length < MIN_HISTORY_FOR_RECOMMENDATION) {
    return {
      enoughData: false,
      reply: { text: `최근 ${HISTORY_DAYS}일 이용 기록이 ${startTimes.length}건뿐이라 시간대를 추천하기엔 아직 부족해요. 기록이 ${MIN_HISTORY_FOR_RECOMMENDATION}건 이상 쌓이면 한산한 시간대를 알려드릴게요.` },
    };
  }
  const counts = Array.from({ length: 24 }, () => 0);
  for (const start of startTimes) counts[kst(start.getTime()).getUTCHours()]++;
  // Hours nobody used (dorm closed, no entry) are not "quiet", so only hours with recorded usage are candidates.
  const candidates = counts.map((count, hour) => ({ count, hour })).filter(({ hour, count }) => hour >= RECOMMEND_FROM_HOUR && count > 0);
  const busiest = candidates.reduce((best, item) => (item.count > best.count ? item : best));
  const quiet = candidates.filter((item) => item.hour !== busiest.hour).sort((a, b) => a.count - b.count || a.hour - b.hour).slice(0, 3).sort((a, b) => a.hour - b.hour);
  const currentHour = kst(now).getUTCHours();
  const lines = [
    `최근 ${HISTORY_DAYS}일 이용 기록 ${startTimes.length}건을 기준으로 봤어요.`,
    `• 비교적 한산한 시간대: ${quiet.map(({ hour }) => hourLabel(hour)).join(', ')}`,
    `• 가장 붐비는 시간대: ${hourLabel(busiest.hour)}(${busiest.count}건)`,
    counts[currentHour] > 0 && currentHour === busiest.hour ? '지금이 가장 붐비는 시간대예요.' : '',
  ];
  return { enoughData: true, reply: { text: lines.filter(Boolean).join('\n') } };
}

export const helpReply: AssistantReply = {
  text: [
    '사용 방법이에요.',
    '1. 세탁기에 붙은 QR을 스캔하고 사용자 등록을 눌러요.',
    '2. 세탁기를 작동시키면 앱이 자동으로 상태를 감지해요.',
    '3. 세탁이 끝나면 알림이 오고, 세탁물을 수거하면 수거 완료를 눌러요.',
    '알림이 오지 않으면 설정에서 알림 권한을 확인해 주세요.',
  ].join('\n'),
  links: [{ label: 'QR 스캔하기', href: '/scan' }],
};

export const unknownReply: AssistantReply = {
  text: '아직 그 질문은 이해하지 못해요. 아래 추천 질문 중에서 골라 주세요.',
};

// Related questions offered after an answer, most useful first.
const followUps: Record<AssistantIntent, AssistantIntent[]> = {
  availability: ['best_time', 'my_status', 'help'],
  my_status: ['availability', 'best_time', 'help'],
  best_time: ['availability', 'my_status', 'help'],
  help: ['availability', 'my_status', 'best_time'],
};

export function chipsAfter(intent: AssistantIntent | null) {
  const order = intent ? followUps[intent] : suggestedQuestions.map((item) => item.intent);
  return order.flatMap((next) => suggestedQuestions.filter((item) => item.intent === next));
}

export type ReplyItem = { title?: string; body: string };
export type ReplyBlock = { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: ReplyItem[] };

// Turns the plain-text reply into paragraphs and lists so the UI can lay it out instead of showing raw line breaks.
export function splitReply(text: string): ReplyBlock[] {
  const blocks: ReplyBlock[] = [];
  for (const line of text.split('\n').map((value) => value.trim()).filter(Boolean)) {
    const bullet = /^•\s*(.+)$/.exec(line);
    const numbered = /^\d+\.\s*(.+)$/.exec(line);
    const content = bullet?.[1] ?? numbered?.[1];
    if (content === undefined) {
      blocks.push({ kind: 'p', text: line });
      continue;
    }
    const kind = bullet ? 'ul' : 'ol';
    const separator = content.indexOf(': ');
    const item: ReplyItem = separator > 0 ? { title: content.slice(0, separator), body: content.slice(separator + 2) } : { body: content };
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind) last.items.push(item);
    else blocks.push({ kind, items: [item] });
  }
  return blocks;
}
