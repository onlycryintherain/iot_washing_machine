import { describeError } from '@/lib/errors';
import { processPendingCompletionNotifications, processPickupReminders } from './service';

const INTERVAL_MS = 60_000;

// Both processors are idempotent (reminder_log claims, notification timestamps), so a missed or doubled tick is harmless.
export function startReminderScheduler() {
  const scope = globalThis as { reminderScheduler?: NodeJS.Timeout };
  if (scope.reminderScheduler) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processPendingCompletionNotifications();
      await processPickupReminders();
    } catch (error) {
      console.error('Reminder scheduler failed', describeError(error));
    } finally {
      running = false;
    }
  };
  scope.reminderScheduler = setInterval(tick, INTERVAL_MS);
  console.log(`Reminder scheduler started (every ${INTERVAL_MS / 1000}s)`);
}
