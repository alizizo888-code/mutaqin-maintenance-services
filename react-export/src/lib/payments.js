// Payment fallback: no payment connection is configured. Never mark an order paid here.
const noConnection = () => {
  const e = new Error('الدفع الإلكتروني غير مهيأ.');
  e.code = 'NO_CONNECTION';
  return e;
};
const known = {
  status: async () => ({ available: false, connections: [] }),
  hasPurchased: async () => false,
  checkoutResult: () => null,
  onPayment: () => ({ unsubscribe() {} }),
  checkout: async () => { throw noConnection(); },
  connect: async () => { throw noConnection(); },
  disconnect: async () => ({ ok: false }),
};
export const payments = new Proxy(known, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'then') return undefined;
    return async () => { throw noConnection(); };
  },
});
export const _internal = new Proxy({}, { get: (_t, key) => key === 'then' ? undefined : async () => { throw noConnection(); } });
