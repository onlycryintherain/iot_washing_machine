import { HttpError } from '@/lib/errors';
export type WasherState = 'IDLE'|'RESERVED'|'RUNNING'|'MAYBE_FINISHED'|'FINISHED'|'WAITING_FOR_PICKUP'|'PAUSED'|'OUT_OF_ORDER';
export type WasherEvent = 'RESERVE'|'START'|'ACTIVITY'|'NO_ACTIVITY'|'RESUME'|'FINISH'|'DOOR_OPEN'|'PICKUP'|'RESET'|'PAUSE';
const transitions: Record<WasherState, Partial<Record<WasherEvent,WasherState>>> = {
  IDLE:{RESERVE:'RESERVED',RESET:'IDLE'}, RESERVED:{START:'RUNNING',RESET:'IDLE'}, RUNNING:{PAUSE:'PAUSED',ACTIVITY:'RUNNING',NO_ACTIVITY:'MAYBE_FINISHED',FINISH:'FINISHED',RESET:'IDLE'}, MAYBE_FINISHED:{PAUSE:'PAUSED',ACTIVITY:'RUNNING',RESUME:'RUNNING',NO_ACTIVITY:'MAYBE_FINISHED',FINISH:'FINISHED',RESET:'IDLE'}, FINISHED:{DOOR_OPEN:'WAITING_FOR_PICKUP',PICKUP:'IDLE',RESET:'IDLE'}, WAITING_FOR_PICKUP:{PICKUP:'IDLE',RESET:'IDLE'},
  // Paused by the owner after authenticating (the door lock releases); only RESUME restarts the cycle.
  PAUSED:{RESUME:'RUNNING',DOOR_OPEN:'PAUSED',RESET:'IDLE'},
  // Out of service (a display-only machine); an admin RESET brings it back.
  OUT_OF_ORDER:{RESET:'IDLE'}
};
export function transition(state:WasherState,event:WasherEvent):WasherState {
  const next=transitions[state][event]; if (!next) throw new HttpError(409,`Invalid washer transition: ${state} → ${event}`); return next;
}
