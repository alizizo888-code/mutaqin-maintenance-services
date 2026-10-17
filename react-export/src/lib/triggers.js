// Scheduled/server-side triggers must be implemented on the trusted backend.
const unavailable = async () => ({ available: false, mode: 'local-demo' });
export const triggers = new Proxy({
  status: async () => ({ available: false, configured: false }),
  run: unavailable,
  schedule: unavailable,
  cancel: unavailable,
  register: unavailable,
}, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'then') return undefined;
    return unavailable;
  },
});
export default triggers;
