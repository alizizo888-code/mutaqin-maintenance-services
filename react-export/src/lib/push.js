// Push delivery requires the missing hosted service worker/backend. This fallback never claims delivery.
const unavailable = async () => ({ ok: false, available: false, mode: 'local-demo' });
const known = {
  status: async () => ({ available: false, configured: false }),
  requestPermission: async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    try { return await Notification.requestPermission(); } catch { return 'denied'; }
  },
  sendToRole: unavailable,
  sendToAdmins: unavailable,
  send: unavailable,
  subscribe: unavailable,
  unsubscribe: unavailable,
};
export const push = new Proxy(known, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'then') return undefined;
    return unavailable;
  },
});
