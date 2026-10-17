// File storage requires a configured server-side storage provider.
const unavailable = async () => {
  const e = new Error('رفع الملفات غير مهيأ. لا تُعتبر المرفقات مرفوعة قبل إعداد التخزين على الخادم.');
  e.code = 'STORAGE_NOT_CONFIGURED';
  throw e;
};
export const storage = new Proxy({
  status: async () => ({ available: false, configured: false }),
  upload: unavailable,
  uploadFile: unavailable,
  remove: unavailable,
  delete: unavailable,
  getUrl: async () => null,
  download: unavailable,
}, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'then') return undefined;
    return unavailable;
  },
});
