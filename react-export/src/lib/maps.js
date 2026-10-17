function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('تحديد الموقع غير مدعوم في هذا المتصفح.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

function distance(a, b) {
  const latA = Number(a?.lat ?? a?.latitude);
  const lngA = Number(a?.lng ?? a?.lon ?? a?.longitude);
  const latB = Number(b?.lat ?? b?.latitude);
  const lngB = Number(b?.lng ?? b?.lon ?? b?.longitude);
  if (![latA, lngA, latB, lngB].every(Number.isFinite)) return null;
  const rad = (v) => v * Math.PI / 180;
  const dLat = rad(latB - latA);
  const dLng = rad(lngB - lngA);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const known = {
  getCurrentLocation,
  // Reverse geocoding needs a configured service; never fabricate an address.
  reverseGeocode: async () => ({ address: '' }),
  distance,
  openCoordinates: (lat, lng) => {
    if (typeof window === 'undefined') return null;
    const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(String(lat) + ',' + String(lng));
    return window.open(url, '_blank', 'noopener,noreferrer');
  },
};
export const maps = new Proxy(known, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'then') return undefined;
    return async () => null;
  },
});
