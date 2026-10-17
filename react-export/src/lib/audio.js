// Speech providers are not part of the exported Whacka SDK.
const unavailable = async () => {
  const e = new Error('خدمة الصوت غير مهيأة حتى يتم ربط مزوّد صوت على الخادم.');
  e.code = 'PROVIDER_UNAVAILABLE';
  throw e;
};
export const audio = {
  record: unavailable,
  speak: unavailable,
  stop: async () => false,
  isAvailable: () => false,
};
