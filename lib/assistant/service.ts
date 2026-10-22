import { and, gte, inArray, isNotNull } from 'drizzle-orm';
import { equivalentUserIds } from '@/lib/auth/identity';
import { getDb } from '@/lib/db';
import { sessions, washers } from '@/lib/db/schema';
import {
  HISTORY_DAYS,
  answerAvailability,
  answerBestTime,
  answerMyStatus,
  helpReply,
  type AssistantIntent,
  type AssistantReply,
  type AssistantWasher,
} from './answers';

async function loadWashers() {
  const rows = await getDb().select().from(washers);
  return rows.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })) as (AssistantWasher & { currentUserId: string | null })[];
}

export async function answerIntent(intent: AssistantIntent, userId: string, now = Date.now()): Promise<AssistantReply> {
  if (intent === 'help') return helpReply;
  const all = await loadWashers();
  if (intent === 'availability') return answerAvailability(all, now);
  if (intent === 'my_status') {
    const owners = await equivalentUserIds(userId);
    return answerMyStatus(all.find((washer) => washer.currentUserId && owners.includes(washer.currentUserId)) ?? null, now);
  }
  const since = new Date(now - HISTORY_DAYS * 86_400_000);
  const history = await getDb().select({ startedAt: sessions.startedAt }).from(sessions)
    .where(and(isNotNull(sessions.startedAt), gte(sessions.startedAt, since), inArray(sessions.status, ['RUNNING', 'FINISHED', 'PICKED_UP']))).limit(5000);
  const { reply, enoughData } = answerBestTime(history.flatMap((row) => (row.startedAt ? [row.startedAt] : [])), now);
  if (enoughData) return reply;
  return { text: `${reply.text}\n\n대신 지금 세탁기 상황을 알려드릴게요.\n${answerAvailability(all, now).text}`, links: [{ label: '세탁기 목록 보기', href: '/washers' }] };
}
