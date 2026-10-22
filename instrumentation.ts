export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.ENABLE_SCHEDULER !== 'true') return;
  const { startReminderScheduler } = await import('@/lib/washer/scheduler');
  startReminderScheduler();
}
