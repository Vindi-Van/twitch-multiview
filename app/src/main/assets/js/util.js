export const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/** Runs f and returns its result, or undefined if it throws (Twitch player calls throw until the player is ready). */
export function safely(f) {
  try {
    return f();
  } catch (e) {
    return undefined;
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
