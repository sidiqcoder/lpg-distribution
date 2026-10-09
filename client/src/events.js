// Global event bus for real-time reactivity without manual page reloads
const listeners = new Set();

export function subscribeDataChanges(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function notifyDataChanged(context = {}) {
  listeners.forEach((callback) => {
    try {
      callback(context);
    } catch (e) {
      console.warn('Error in data change listener:', e);
    }
  });
}
