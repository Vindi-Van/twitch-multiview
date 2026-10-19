// Pure helpers for Twitch names, numbers and image URLs. No DOM, so they're unit tested in Node.

/** A Twitch login from what someone typed or pasted ("Name", "twitch.tv/name", a full URL), or null. */
export function channelName(text) {
  const name = String(text).trim().replace(/^.*twitch\.tv\//i, '').split(/[/?#]/)[0].toLowerCase();
  return /^[a-z0-9_]{2,25}$/.test(name) ? name : null;
}

/** Twitch's preview images refresh every few minutes; this changes with them so the WebView doesn't cache old ones. */
const freshness = (now) => Math.floor(now / 300000);

export const previewUrl = (login, now = Date.now()) =>
  `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-440x248.jpg?t=${freshness(now)}`;

/** The preview for a Helix stream object, whose thumbnail_url has {width} and {height} placeholders. */
export const streamThumb = (stream, now = Date.now()) =>
  `${stream.thumbnail_url.replace('{width}', '440').replace('{height}', '248')}?t=${freshness(now)}`;

export const loginQuery = (logins) => logins.map((login) => `user_login=${encodeURIComponent(login)}`).join('&');

/** Viewer counts the way Twitch shows them: 980, 1.4K, 12K. */
export function viewers(n) {
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** How long a stream has been live: "45m", "3h 12m". */
export function uptime(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

const AVATAR_COLORS = ['#3f5f8f', '#4f7a5e', '#7a5f3f', '#664a8a', '#8a4b52', '#4b7a7d', '#5e5272', '#6d6d46'];

/** A stable color per channel for its initial-letter avatar. */
export function colorFor(login) {
  let n = 0;
  for (const ch of login) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}
