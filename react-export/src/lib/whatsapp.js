// WhatsApp provider/CRM integration is unavailable in standalone mode; direct wa.me links are handled by lib/share.js.
const noServer = async () => ({ available: false, sent: false, mode: 'local-demo' });
export const whatsapp = new Proxy({
  status: async () => ({ available: false, configured: false }),
  send: noServer,
  sendMessage: noServer,
  template: noServer,
}, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'then') return undefined;
    return noServer;
  },
});
