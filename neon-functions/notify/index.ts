const ENDPOINT = 'https://iotwashingmachine.vercel.app/api/internal/process-reminders';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST' || !request.headers.get('x-neon-trigger-invocation-id')) {
      return new Response('Not found', { status: 404 });
    }

    const secret = process.env.DEVICE_API_SECRET;
    if (!secret) return new Response('Missing notification secret', { status: 500 });

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        console.error('Notification processing failed:', response.status);
        return new Response('Notification processing failed', { status: 502 });
      }
      return new Response('OK');
    } catch (error) {
      console.error('Notification processing request failed:', error instanceof Error ? error.message : 'Unknown error');
      return new Response('Notification processing failed', { status: 502 });
    }
  },
};
