export type WasherState = 'IDLE'|'RESERVED'|'RUNNING'|'MAYBE_FINISHED'|'FINISHED'|'WAITING_FOR_PICKUP';
export type WasherEvent = 'RESERVE'|'START'|'ACTIVITY'|'NO_ACTIVITY'|'RESUME'|'FINISH'|'DOOR_OPEN'|'PICKUP'|'RESET';
const transitions: Record<WasherState, Partial<Record<WasherEvent,WasherState>>> = {
  IDLE:{RESERVE:'RESERVED',RESET:'IDLE'}, RESERVED:{START:'RUNNING',RESET:'IDLE'}, RUNNING:{ACTIVITY:'RUNNING',NO_ACTIVITY:'MAYBE_FINISHED',FINISH:'FINISHED',RESET:'IDLE'}, MAYBE_FINISHED:{ACTIVITY:'RUNNING',RESUME:'RUNNING',NO_ACTIVITY:'MAYBE_FINISHED',FINISH:'FINISHED',RESET:'IDLE'}, FINISHED:{DOOR_OPEN:'WAITING_FOR_PICKUP',PICKUP:'IDLE',RESET:'IDLE'}, WAITING_FOR_PICKUP:{PICKUP:'IDLE',RESET:'IDLE'}
};
export function transition(state:WasherState,event:WasherEvent):WasherState {
  const next=transitions[state][event]; if (!next) throw new Error(`Invalid washer transition: ${state} → ${event}`); return next;
}
