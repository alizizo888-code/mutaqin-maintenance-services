// Honest offline fallback. No external AI provider or API key is embedded in the browser.
const fallbackReply = 'مساعد مُتقِن الذكي غير متصل حاليًا. يمكنك تصفح الخدمات أو حساب السعر وترك تفاصيل الطلب، وسيتم تفعيل المحادثة الذكية بعد ربط مزوّد AI آمن على الخادم.';
const defaultJson = {
  reply: fallbackReply,
  intent: { specialtyId: null, problem: null, priority: 'normal', preferredTime: null, locationText: null, qty: null, acceptedOffer: false },
  escalation: null,
  action: 'none',
  confidence: 1,
  sources: ['none'],
};
export const ai = {
  async run(_prompt, options = {}) {
    const json = options?.json ? { ...defaultJson, intent: { ...defaultJson.intent } } : null;
    return { text: fallbackReply, json };
  },
};
