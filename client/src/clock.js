// Operational timestamps use server time even when the device clock is wrong.
let offset = 0;
export const serverNow = () => Date.now() + offset;
export const clockOffset = () => offset;

export function syncClock(response, started, finished = Date.now()) {
  const value = response.headers.get('X-Server-Time') || response.headers.get('Date');
  const time = value ? Date.parse(value) : NaN;
  if (Number.isFinite(time)) offset = time - (started + finished) / 2;
}
