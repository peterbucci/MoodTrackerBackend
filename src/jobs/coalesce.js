// Generic coalescing window per key (e.g., userId)
const lastRun = new Map();

/**
 * scheduleCoalesced(key, windowMs, fn)
 * Runs at most once per window per key; if called again within the window,
 * it no-ops (or you could change this to queue and run after the window).
 */
export function scheduleCoalesced(key, windowMs, fn) {
  const now = Date.now();
  const last = lastRun.get(key) || 0;
  if (now - last < windowMs) return;
  lastRun.set(key, now);
  setTimeout(fn, 1000); // brief delay to let upstream settle
}
