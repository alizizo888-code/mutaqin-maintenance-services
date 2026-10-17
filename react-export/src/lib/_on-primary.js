// Resolve readable text color over the app's configurable primary background.
export function onPrimaryColor() {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    if (!raw) return '#ffffff';
    if (raw.startsWith('#') || /^rgba?\(/i.test(raw) || /^hsla?\(/i.test(raw)) return raw;
    if (/^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/.test(raw)) {
      return `rgb(${raw})`;
    }
    return raw;
  } catch {
    return '#ffffff';
  }
}
