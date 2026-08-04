function applicationServerKey(value, environment = globalThis) {
  const padding = '='.repeat((4 - String(value || '').length % 4) % 4);
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/') + padding;
  const raw = (environment.atob || globalThis.atob)(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function createPushClient({ url, anonKey, accessToken, fetchImpl = globalThis.fetch } = {}) {
  const endpoint = new URL('/functions/v1/zos-reminder-dispatch', `${String(url || '').replace(/\/$/, '')}/`);
  const request = async (body) => {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`push_subscription_failed_${response.status}`);
    return response.json();
  };
  return {
    status: () => request({ action: 'status' }),
    register: (subscription) => request({ action: 'subscribe', subscription }),
    unregister: (subscription) => request({ action: 'unsubscribe', subscription }),
  };
}

export function pushCapabilityState(environment = globalThis) {
  const Notification = environment?.Notification;
  if (!Notification) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'permission_required';
  if (!environment?.navigator?.serviceWorker) return 'unsupported';
  return 'ready';
}

export async function enablePushNotifications({
  environment = globalThis,
  publicKey,
  registerSubscription = async () => {},
} = {}) {
  const Notification = environment?.Notification;
  if (!Notification) return { state: 'unsupported' };
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return { state: permission === 'denied' ? 'denied' : 'permission_required' };
  if (!publicKey) return { state: 'pending_configuration' };
  const registration = await environment?.navigator?.serviceWorker?.ready;
  if (!registration?.pushManager) return { state: 'unsupported' };
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(publicKey, environment),
    });
  }
  await registerSubscription(subscription.toJSON ? subscription.toJSON() : subscription);
  return { state: 'enabled' };
}
