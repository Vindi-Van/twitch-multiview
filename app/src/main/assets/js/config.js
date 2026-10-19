// Tunables, each with the reason for its value. Most come from testing on an NVIDIA Shield (Android 11, WebView 155).

export const MAX_STREAMS = 4;
export const STORE_KEY = 'multiview.state';
export const RESUME_KEY = 'multiview.resume';      // where to land after Twitch's sign-in page closes
export const START_GAP_MS = 4000;                  // starting four players at once crashes the Shield's 32-bit renderer
export const WATCHDOG_MS = 10000;
export const STALL_MS = 180000;                    // a player whose clock hasn't moved for this long is reloaded
export const INFO_REFRESH_MS = 60000;
export const UI_MS = 4000;                         // how long the highlight frames stay up after a key press
export const RETRY_MS = 15000;
export const TOAST_MS = 3000;
export const ACCOUNT_TIMEOUT_MS = 3000;
export const CHAT_ZOOM = 1.6;                      // Twitch's chat is sized for a monitor; scale it up for the couch
export const CHAT_HEADER = 72;
export const TWITCH_EMBED_SCRIPT = 'https://player.twitch.tv/js/embed/v1.js';
export const DIRECTIONS = ['left', 'right', 'up', 'down'];
