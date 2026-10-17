// Standalone language helpers replacing Whacka's runtime-provided language facade.
const RTL_LANGS = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv']);

function candidateLanguage(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = candidateLanguage(item);
      if (result) return result;
    }
    return '';
  }
  if (value && typeof value === 'object') {
    for (const key of ['lang', 'language', 'locale', 'faceLang', 'preferredLanguage']) {
      const result = candidateLanguage(value[key]);
      if (result) return result;
    }
    return '';
  }
  if (typeof value !== 'string') return '';
  const raw = value.trim().replace(/_/g, '-');
  if (!raw) return '';
  const base = raw.split('-')[0].toLowerCase();
  return /^[a-z]{2,3}$/.test(base) ? base : '';
}

export function resolveFaceLangFrom(...values) {
  for (const value of values) {
    const result = candidateLanguage(value);
    if (result) return result;
  }
  return '';
}

export function resolveFaceLang() {
  if (typeof document !== 'undefined') {
    const explicit = resolveFaceLangFrom(document.documentElement?.lang);
    if (explicit) return explicit;
  }
  if (typeof navigator !== 'undefined') {
    const preferred = resolveFaceLangFrom(navigator.languages, navigator.language);
    if (preferred) return preferred;
  }
  return 'ar';
}

export function isRtlLang(language = resolveFaceLang()) {
  return RTL_LANGS.has(resolveFaceLangFrom(language) || 'ar');
}

export function onFaceLangChange(callback) {
  if (typeof callback !== 'function' || typeof window === 'undefined') return () => {};
  const emit = () => {
    try { callback(resolveFaceLang()); } catch {}
  };
  let observer;
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement) {
    observer = new MutationObserver(emit);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
  }
  window.addEventListener('languagechange', emit);
  return () => {
    observer?.disconnect();
    window.removeEventListener('languagechange', emit);
  };
}
