import { auth } from './auth';
const ANON_KEY = 'mutqan:demo-anonymous-id';
function randomId() {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch {}
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}
export function getAppUserId() {
  return auth.getCurrentUser()?.id || getAnonymousId();
}
export function getAnonymousId() {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) { id = 'anon-' + randomId(); localStorage.setItem(ANON_KEY, id); }
    return id;
  } catch { return 'anon-session'; }
}
