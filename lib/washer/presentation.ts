import type { WasherState } from './state-machine';

export type WasherSummary = {
  id: string;
  name: string;
  location: string;
  state: WasherState;
  currentUserId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

const states: Record<WasherState, { label: string; tone: string; headline: string }> = {
  IDLE: { label: '사용 가능', tone: 'available', headline: '지금 사용할 수 있어요' },
  RESERVED: { label: '시작 대기', tone: 'reserved', headline: '세탁 시작을 기다리고 있어요' },
  RUNNING: { label: '세탁 중', tone: 'running', headline: '세탁이 진행 중이에요' },
  MAYBE_FINISHED: { label: '상태 확인 중', tone: 'checking', headline: '세탁 상태를 확인하고 있어요' },
  FINISHED: { label: '세탁 완료', tone: 'finished', headline: '세탁이 끝났어요' },
  WAITING_FOR_PICKUP: { label: '수거 대기', tone: 'pickup', headline: '세탁물을 가져가 주세요' },
};

export function washerPresentation(state: WasherState) {
  return states[state];
}
