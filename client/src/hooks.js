import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from './api';
import { subscribeDataChanges } from './events';

// Ambil data JSON, reaktif terhadap perubahan data global & polling berkala tanpa manual reload
export function useApi(path, { interval = 0, params, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const controller = useRef(null);
  const key = JSON.stringify(params || {});

  const load = useCallback(async () => {
    if (!enabled || (controller.current && !controller.current.signal.aborted)) return;
    const currentGeneration = generation.current;
    const currentController = new AbortController();
    controller.current = currentController;
    try {
      const result = await apiGet(path, JSON.parse(key), { signal: currentController.signal });
      if (mounted.current && generation.current === currentGeneration) { setData(result); setError(null); }
    } catch (err) {
      if (mounted.current && generation.current === currentGeneration && !currentController.signal.aborted) setError(err);
    } finally {
      if (controller.current === currentController) controller.current = null;
      if (mounted.current && generation.current === currentGeneration) setLoading(false);
    }
  }, [path, key, enabled]);

  useEffect(() => {
    mounted.current = true;
    generation.current++;
    setLoading(enabled);
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
      if (timer) clearInterval(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load, interval, enabled]);

  return { data, loading, error, reload: load };
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
