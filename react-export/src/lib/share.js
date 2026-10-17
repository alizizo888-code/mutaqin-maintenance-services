import { db } from './db';

function openWhatsApp(phone, text = '') {
  if (typeof window === 'undefined') return null;
  const digits = String(phone || '').replace(/\D/g, '');
  const base = digits ? 'https://wa.me/' + digits : 'https://wa.me/';
  const url = base + (text ? '?text=' + encodeURIComponent(text) : '');
  return window.open(url, '_blank', 'noopener,noreferrer');
}

async function copy(text) {
  const value = String(text ?? '');
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  if (typeof document === 'undefined') throw new Error('النسخ غير مدعوم في هذا المتصفح.');
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('تعذر نسخ النص.');
  return true;
}

async function whatsappOrder({ phone, text = '', collection, groupId, record } = {}) {
  // Open from the click handler before the async local write, to reduce popup blocking.
  openWhatsApp(phone, text);
  if (collection && record) {
    try { await db.insertShared(collection, { ...record, groupId: groupId || record.groupId }); } catch {}
  }
  return { opened: true, savedLocally: !!(collection && record) };
}

export const isInAppBrowser = () => typeof navigator !== 'undefined' && /FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent || '');
export const share = { copy, whatsapp: openWhatsApp, whatsappOrder, isInAppBrowser };
