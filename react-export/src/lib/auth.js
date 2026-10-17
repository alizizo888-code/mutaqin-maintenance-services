// Authentication is intentionally fail-closed until a real identity provider is configured.
const KEY = 'mutqan:demo-auth-user';
const EVENT = 'mutqan:auth-changed';

function currentUser() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function notify(user) {
  if (typeof window === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: { user } })); } catch {}
}

export const auth = {
  getCurrentUser: currentUser,
  isAppOwner() {
    const user = currentUser();
    const ownerId = import.meta.env.VITE_APP_OWNER_ID;
    return !!ownerId && !!user?.id && user.id === ownerId;
  },
  onAuthChange(callback) {
    if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};
    const listener = (event) => callback(event.detail?.user ?? currentUser());
    window.addEventListener(EVENT, listener);
    window.addEventListener('storage', listener);
    return () => {
      window.removeEventListener(EVENT, listener);
      window.removeEventListener('storage', listener);
    };
  },
  async signIn() {
    const e = new Error('تسجيل الدخول غير مهيأ: يلزم ربط مزوّد هوية وخادم موثوق قبل تفعيل الحسابات.');
    e.code = 'AUTH_NOT_CONFIGURED';
    throw e;
  },
  async signOut() {
    try { localStorage.removeItem(KEY); } catch {}
    notify(null);
  },
};

// Used only by local adapters/tests; it does not authenticate a user with a server.
export function adoptSession(user) {
  if (!user || !user.id) return null;
  const safe = { id: String(user.id), displayName: String(user.displayName || user.name || ''), email: user.email || null };
  try { localStorage.setItem(KEY, JSON.stringify(safe)); } catch {}
  notify(safe);
  return safe;
}
