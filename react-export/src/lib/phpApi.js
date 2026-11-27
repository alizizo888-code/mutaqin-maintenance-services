const API_ROOT = '/backend/api';
let csrfToken = null;
let currentUser = null;
let bootstrapPromise = null;
const listeners = new Set();

function emit() { for (const fn of listeners) { try { fn(currentUser); } catch {} } }
async function request(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (options.method && options.method.toUpperCase() !== 'GET') {
    if (!csrfToken) await bootstrap();
    headers['X-CSRF-Token'] = csrfToken;
  }
  const response = await fetch(`${API_ROOT}/${path}`, {
    ...options, headers, credentials: 'same-origin', cache: 'no-store',
  });
  let payload;
  try { payload = await response.json(); } catch { throw new Error('استجابة الخادم غير صالحة. تحقق من مسار PHP وإعداد الخادم.'); }
  if (payload?.csrf_token) csrfToken = payload.csrf_token;
  if (!response.ok || payload?.status === 'error') {
    const error = new Error(payload?.message || `تعذر تنفيذ الطلب (HTTP ${response.status}).`);
    error.status = response.status; error.payload = payload; throw error;
  }
  return payload;
}
export async function bootstrap(force = false) {
  if (bootstrapPromise && !force) return bootstrapPromise;
  bootstrapPromise = request('auth.php?action=bootstrap').then((data) => {
    currentUser = data.user || null; csrfToken = data.csrf_token || csrfToken; emit();
    return currentUser;
  }).catch((error) => { currentUser = null; emit(); throw error; }).finally(() => { bootstrapPromise = null; });
  return bootstrapPromise;
}
export const phpAuth = {
  getCurrentUser: () => currentUser,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async login(username, password) {
    await bootstrap();
    const data = await request('auth.php?action=login', { method: 'POST', body: JSON.stringify({ username, password }) });
    currentUser = data.user || null; csrfToken = data.csrf_token || csrfToken; emit();
    return currentUser;
  },
  async logout() {
    const data = await request('auth.php?action=logout', { method: 'POST', body: '{}' });
    currentUser = null; csrfToken = data.csrf_token || null; emit();
  },
};
export async function pricingApi(action, { method = 'GET', params = {}, body } = {}) {
  const query = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).filter(([,v]) => v !== undefined && v !== null && v !== '')) });
  return request(`pricing.php?${query.toString()}`, { method, ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }) });
}

export async function financeApi(action, { method = 'GET', params = {}, body } = {}) {
  const query = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).filter(([,v]) => v !== undefined && v !== null && v !== '')) })
  return request(`finance.php?${query.toString()}`, { method, ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }) })
}
/** Multipart upload (invoice + part photos). Content-Type is left to the browser for the boundary. */
export async function financeUpload(action, formData) {
  if (!csrfToken) await bootstrap()
  const response = await fetch(`${API_ROOT}/finance.php?action=${encodeURIComponent(action)}`, {
    method: 'POST', body: formData, credentials: 'same-origin', cache: 'no-store',
    headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken },
  })
  let payload
  try { payload = await response.json() } catch { throw new Error('استجابة الخادم غير صالحة.') }
  if (!response.ok || payload?.status === 'error') { const e = new Error(payload?.message || `HTTP ${response.status}`); e.status = response.status; e.payload = payload; throw e }
  return payload
}
