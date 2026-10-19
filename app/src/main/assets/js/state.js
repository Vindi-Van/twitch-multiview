// What the page remembers: the lineup, which stream you hear, layout and chat choices, the account.
// Saved in the WebView's localStorage; the account itself (tokens) lives in the app.

import { native } from './bridge.js';
import { ACCOUNT_TIMEOUT_MS, MAX_STREAMS, STORE_KEY } from './config.js';
import { channelName } from './format.js';
import { clamp, safely, sleep } from './util.js';

export const state = {
  screen: null,
  lineup: [],            // channel logins, in slot order
  audio: 0,              // the lineup index you hear
  layout4: 'focus',      // four streams: 'focus' or 'grid'
  chat: null,            // the login whose chat is open
  query: '',             // the last search
  tab: 'following',
  replacing: null,       // lineup index being swapped from the stream menu
  account: { login: null, userId: null, player: false, signInAvailable: false },
};

/**
 * Turns whatever was saved (possibly old or hand-edited) into a valid lineup. A `channels` list from
 * the launch intent (comma separated, a debugging aid) replaces the saved lineup.
 */
export function normalizeSaved(saved, fromIntent = null) {
  const out = { lineup: [], audio: 0, layout4: 'focus', chat: null, query: '' };
  if (saved && typeof saved === 'object') {
    if (Array.isArray(saved.lineup)) out.lineup = saved.lineup;
    out.audio = Number(saved.audio) || 0;
    out.layout4 = saved.layout4 === 'grid' ? 'grid' : 'focus';
    out.chat = saved.chat ?? null;
    out.query = typeof saved.query === 'string' ? saved.query : '';
  }
  if (fromIntent !== null) {
    out.lineup = fromIntent.split(',');
    out.audio = 0;
  }
  out.lineup = [...new Set(out.lineup.map(channelName).filter(Boolean))].slice(0, MAX_STREAMS);
  out.audio = clamp(out.audio, 0, Math.max(out.lineup.length - 1, 0));
  if (!out.lineup.includes(out.chat)) out.chat = null;
  return out;
}

export function loadState() {
  const saved = safely(() => JSON.parse(localStorage.getItem(STORE_KEY) || 'null'));
  const fromIntent = new URLSearchParams(location.search).get('channels');
  if (fromIntent !== null) history.replaceState(null, '', location.pathname);
  Object.assign(state, normalizeSaved(saved, fromIntent));
}

export function saveState() {
  const { lineup, audio, layout4, chat, query } = state;
  safely(() => localStorage.setItem(STORE_KEY, JSON.stringify({ lineup, audio, layout4, chat, query })));
}

/** Removes a stream from the lineup, keeping the sound and chat on the right streams. */
export function removeFromLineup(index) {
  const [login] = state.lineup.splice(index, 1);
  if (login === undefined) return;
  if (state.chat === login) state.chat = null;
  if (state.audio === index) state.audio = 0;
  else if (state.audio > index) state.audio -= 1;
  saveState();
}

export async function refreshAccount() {
  const timeout = sleep(ACCOUNT_TIMEOUT_MS).then(() => ({ status: 0, body: '{}' }));
  const { body } = await Promise.race([native.call('account'), timeout]);
  safely(() => Object.assign(state.account, JSON.parse(body)));
}
