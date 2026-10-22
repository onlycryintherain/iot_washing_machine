export const SIMULATION_DURATION_SECONDS = 12;
export const SIMULATED_CYCLE_MINUTES = 48;
export function cycleProgress(startedAt: number, now: number) {
  const duration = SIMULATION_DURATION_SECONDS * 1000;
  const elapsed = Math.max(0, now - startedAt);
  const progress = Math.min(1, elapsed / duration);
  return { minutesLeft: Math.max(0, Math.ceil(SIMULATED_CYCLE_MINUTES * (1 - progress))), waiting: elapsed >= duration, endsAt: startedAt + duration };
}

// The UI shows the cycle compressed (SIMULATED_CYCLE_MINUTES in SIMULATION_DURATION_SECONDS), so recorded durations are scaled the same way.
export function toDisplayMinutes(durationMs: number) {
  return Math.max(1, Math.round((durationMs / 1000 / SIMULATION_DURATION_SECONDS) * SIMULATED_CYCLE_MINUTES));
}

export const ENDING_SOON_MINUTES = 5;

// Real milliseconds after a cycle starts at which "about 5 minutes left" is reached, on the same compressed scale the UI shows.
export function endingSoonDelayMs(minutesBefore = ENDING_SOON_MINUTES) {
  const shown = Math.max(0, SIMULATED_CYCLE_MINUTES - minutesBefore);
  return Math.round((shown / SIMULATED_CYCLE_MINUTES) * SIMULATION_DURATION_SECONDS * 1000);
}
