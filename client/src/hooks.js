import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from './api';
import { subscribeDataChanges } from './events';

// Ambil data JSON, reaktif terhadap perubahan data global & polling berkala tanpa manual reload
export function useApi(path, { interval = 0, params, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null, resource: '' });
  const mounted = useRef(true);
  const generation = useRef(0);
  const controller = useRef(null);
  const key = JSON.stringify(params || {});
  const resource = `${path}:${key}`;

  const load = useCallback(async () => {
    if (!enabled || (controller.current && !controller.current.signal.aborted)) return;
    const currentGeneration = generation.current;
    const currentController = new AbortController();
    controller.current = currentController;
    try {
      const result = await apiGet(path, JSON.parse(key), { signal: currentController.signal });
      if (result == null) throw new Error('Server belum mengembalikan data. Silakan coba lagi.');
      if (mounted.current && generation.current === currentGeneration) setState({ data: result, loading: false, error: null, resource });
    } catch (err) {
      if (mounted.current && generation.current === currentGeneration && !currentController.signal.aborted) {
        setState(previous => ({ ...previous, loading: false, error: err, resource }));
      }
    } finally {
      if (controller.current === currentController) controller.current = null;
    }
  }, [path, key, enabled, resource]);

  useEffect(() => {
    mounted.current = true;
    generation.current++;
    setState(previous => previous.resource === resource ? previous : { data: null, loading: enabled, error: null, resource });
    load();

    // 1. Polling berkala jika ada interval
    let timer = null;
    if (interval > 0 && enabled) timer = setInterval(load, interval);

    // 2. Refresh instan saat ada mutasi data global (tanpa reload halaman)
    const unsubscribe = subscribeDataChanges(() => {
      if (mounted.current && enabled) {
        load();
      }
    });

    // 3. Refresh saat tab kembali aktif
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && mounted.current && enabled) {
        load();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted.current = false;
      generation.current++;
      controller.current?.abort();
      controller.current = null;
      if (timer) clearInterval(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load, interval, enabled]);

  const current = state.resource === resource ? state : { data: null, loading: enabled, error: null };
  return { ...current, stale: Boolean(current.data && current.error), reload: load };
}

// Sederhana: simpan objek di localStorage dan sinkronkan ke state.
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue];
}
