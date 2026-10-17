// MUTQAN runtime fallback for the exported React UI.
// IMPORTANT: this is a browser-local demo store, not a shared or production database.
const PREFIX = 'mutqan-demo-data-v1:';
const CHANGE_EVENT = 'mutqan:demo-data-changed';
const ID_PREFIX = 'demo';

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const newId = () => {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch {}
  return ID_PREFIX + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
};
const keyFor = (table) => PREFIX + String(table || 'default');

export function getRows(table) {
  if (typeof localStorage === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(table)) || '[]');
    return Array.isArray(value) ? value.filter(isPlainObject) : [];
  } catch { return []; }
}

function notifyChanged(table) {
  if (typeof window === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { table: String(table) } })); } catch {}
}

function saveRows(table, rows) {
  if (typeof localStorage === 'undefined') throw new Error('المتصفح لا يدعم التخزين المحلي.');
  try {
    localStorage.setItem(keyFor(table), JSON.stringify(rows));
    notifyChanged(table);
  } catch (e) {
    const err = new Error('تعذر حفظ البيانات على هذا الجهاز. قد تكون مساحة التخزين ممتلئة.');
    err.cause = e;
    throw err;
  }
}

function compareValue(actual, expected) {
  if (isPlainObject(expected)) {
    return Object.entries(expected).every(([op, value]) => {
      switch (op) {
        case 'in': return Array.isArray(value) && value.includes(actual);
        case 'ne': return actual !== value;
        case 'eq': return actual === value;
        case 'gte': return actual != null && String(actual) >= String(value);
        case 'gt': return actual != null && String(actual) > String(value);
        case 'lte': return actual != null && String(actual) <= String(value);
        case 'lt': return actual != null && String(actual) < String(value);
        case 'contains': return String(actual ?? '').includes(String(value ?? ''));
        default: return true;
      }
    });
  }
  if (Array.isArray(expected)) return expected.includes(actual);
  return actual === expected;
}

function matches(row, filters) {
  if (!isPlainObject(filters)) return true;
  return Object.entries(filters).every(([key, value]) => compareValue(row?.[key], value));
}

export function queryRows(table, options = {}) {
  const opts = isPlainObject(options) ? options : {};
  const filters = opts.filters || opts.where || {};
  let rows = getRows(table).filter((row) => matches(row, filters));
  if (typeof opts.order === 'string' && opts.order) {
    const desc = opts.order.startsWith('-');
    const field = desc ? opts.order.slice(1) : opts.order;
    rows = rows.slice().sort((a, b) => {
      const av = a?.[field] ?? '';
      const bv = b?.[field] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return desc ? -cmp : cmp;
    });
  }
  const limit = Number(opts.limit);
  if (Number.isFinite(limit) && limit >= 0) rows = rows.slice(0, limit);
  return rows;
}

export function subscribeRows(table, callback) {
  if (typeof window === 'undefined') return () => {};
  const wanted = String(table);
  const onLocalChange = (event) => {
    if (!event?.detail?.table || event.detail.table === wanted) callback();
  };
  const onStorage = (event) => {
    if (!event.key || event.key === keyFor(wanted)) callback();
  };
  window.addEventListener(CHANGE_EVENT, onLocalChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocalChange);
    window.removeEventListener('storage', onStorage);
  };
}

function withMeta(row, id, options = {}) {
  const out = { ...(isPlainObject(row) ? row : {}) };
  out.id = id || out.id || newId();
  if (options?.groupId && !out.groupId) out.groupId = options.groupId;
  return out;
}

async function select(table, filters = {}, options = {}) {
  return queryRows(table, { ...options, filters });
}
async function insert(table, row, id, options = {}) {
  const rows = getRows(table);
  const created = withMeta(row, id, options);
  rows.push(created);
  saveRows(table, rows);
  return created;
}
async function update(table, id, patch) {
  const rows = getRows(table);
  const index = rows.findIndex((row) => String(row.id) === String(id));
  if (index < 0) throw new Error('السجل المطلوب غير موجود في التخزين المحلي.');
  rows[index] = { ...rows[index], ...(isPlainObject(patch) ? patch : {}), id: rows[index].id };
  saveRows(table, rows);
  return rows[index];
}
async function remove(table, id) {
  const rows = getRows(table);
  const next = rows.filter((row) => String(row.id) !== String(id));
  saveRows(table, next);
  return next.length !== rows.length;
}
async function upsert(table, row, id, options = {}) {
  const rows = getRows(table);
  const effectiveId = id || row?.id || newId();
  const index = rows.findIndex((item) => String(item.id) === String(effectiveId));
  const next = withMeta({ ...(index >= 0 ? rows[index] : {}), ...(row || {}) }, effectiveId, options);
  if (index >= 0) rows[index] = next; else rows.push(next);
  saveRows(table, rows);
  return next;
}

export const db = {
  select: (table, filters = {}, options = {}) => select(table, filters, options),
  insert: (table, row) => insert(table, row),
  update: (table, id, patch) => update(table, id, patch),
  delete: (table, id) => remove(table, id),
  count: async (table, filters = {}) => queryRows(table, { filters }).length,
  selectShared: (table, filters = {}, options = {}) => select(table, filters, options),
  insertShared: (table, row, id, options = {}) => insert(table, row, id, options),
  updateShared: (table, id, patch) => update(table, id, patch),
  deleteShared: (table, id) => remove(table, id),
  upsertShared: (table, row, id, options = {}) => upsert(table, row, id, options),
  countShared: async (table, filters = {}) => queryRows(table, { filters: filters?.filters || filters }).length,
  sumShared: async (table, field, filters = {}) => queryRows(table, { filters: filters?.filters || filters }).reduce((sum, row) => sum + (Number(row?.[field]) || 0), 0),
  groupByShared: async (table, field, options = {}) => {
    const rows = queryRows(table, { filters: options?.filters || {}, limit: options?.limit });
    const groups = new Map();
    for (const row of rows) {
      const value = row?.[field] ?? 'غير محدد';
      const current = groups.get(value) || 0;
      groups.set(value, current + 1);
    }
    return [...groups.entries()].map(([value, count]) => ({ [field]: value, key: value, value: count, count }));
  },
};

export const runtimeMode = 'local-demo';
