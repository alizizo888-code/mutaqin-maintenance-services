// Standalone white-label branding defaults replacing Whacka's branding service.
const STORAGE_KEY = 'mutqan:demo-branding-hidden';
const EVENT = 'mutqan:branding-changed';

function readHidden() {
  try {
    const value = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return value === 'true';
  } catch { return false; }
}

export let brandingHidden = readHidden();
// In standalone demo mode the default is known and visible (no forced Whacka badge state).
export let brandingKnown = true;
const listeners = new Set();

function emit() {
  for (const callback of [...listeners]) {
    try { callback(brandingHidden); } catch {}
  }
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent(EVENT, { detail: { brandingHidden, brandingKnown } })); } catch {}
  }
}

export function onBrandingChange(callback) {
  if (typeof callback !== 'function') return () => {};
  listeners.add(callback);
  try { callback(brandingHidden); } catch {}
  return () => listeners.delete(callback);
}

export function refreshBranding() {
  brandingHidden = readHidden();
  brandingKnown = true;
  emit();
  return brandingHidden;
}

// Local demo preference only; it does not change a hosted Whacka project.
export function setBrandingHidden(value) {
  brandingHidden = value === true;
  brandingKnown = true;
  try { localStorage.setItem(STORAGE_KEY, String(brandingHidden)); } catch {}
  emit();
  return brandingHidden;
}
