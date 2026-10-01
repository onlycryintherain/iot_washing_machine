function applicationServerKey(encoded: string) {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'Notification' in window &&
    'PushManager' in window && 'serviceWorker' in navigator;
}

async function publicKey() {
  const response = await fetch('/api/push/subscribe', { cache: 'no-store' });
  if (!response.ok) throw new Error('알림 설정을 불러오지 못했습니다.');
  const data: unknown = await response.json();
  const key = typeof data === 'object' && data !== null && 'publicKey' in data
    ? data.publicKey : null;
  if (typeof key !== 'string' || !key) throw new Error('알림 키가 설정되지 않았습니다.');
  return key;
}

export async function getPushSubscription(knownPublicKey?: string) {
  await navigator.serviceWorker.register('/sw.js');
  const registration = await navigator.serviceWorker.ready;
  const key = applicationServerKey(knownPublicKey || await publicKey());
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const oldKey = existing.options.applicationServerKey;
    if (oldKey) {
      const oldBytes = new Uint8Array(oldKey);
      if (oldBytes.length === key.length && oldBytes.every((byte, index) => byte === key[index])) return existing;
    }
    await existing.unsubscribe();
  }
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

export async function savePushSubscription(token: string, subscription: PushSubscription) {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error('알림 연결을 완료하지 못했습니다.');
}

export async function registerPush(token: string) {
  const subscription = await getPushSubscription();
  await savePushSubscription(token, subscription);
}
