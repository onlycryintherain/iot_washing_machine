export const SIMULATION_DURATION_SECONDS = 12;
export const SIMULATED_CYCLE_MINUTES = 48;
export function cycleProgress(startedAt: number, now: number) {
  const duration = SIMULATION_DURATION_SECONDS * 1000;
  const elapsed = Math.max(0, now - startedAt);
  const progress = Math.min(1, elapsed / duration);
  return { minutesLeft: Math.max(0, Math.ceil(SIMULATED_CYCLE_MINUTES * (1 - progress))), waiting: elapsed >= duration, endsAt: startedAt + duration };
}
