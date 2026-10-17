import { useEffect, useMemo, useState } from 'react';
import { queryRows, subscribeRows } from './runtimeData';

// Browser-local reactive store used while the Whacka shared-data runtime is unavailable.
// Data is scoped to this browser/device; it is not synchronized between customers or staff.
export function useLiveShared(collection, options = {}) {
  const optionsKey = useMemo(() => JSON.stringify(options || {}), [options]);
  const read = () => {
    try { return queryRows(collection, JSON.parse(optionsKey || '{}')); }
    catch { return []; }
  };
  const [data, setData] = useState(read);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      try {
        const rows = queryRows(collection, JSON.parse(optionsKey || '{}'));
        if (alive) { setData(rows); setError(null); }
      } catch (e) {
        if (alive) { setData([]); setError(e); }
      }
    };
    refresh();
    const unsubscribe = subscribeRows(collection, refresh);
    return () => { alive = false; unsubscribe(); };
  }, [collection, optionsKey]);

  return { data, loading: false, error, refresh: () => setData(read()) };
}

export const useLive = useLiveShared;
