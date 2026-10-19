// Multiview: pick Twitch streams (Following, Search, Top live) and watch up to four at once.
//
// The app (MainActivity) forwards the remote here as mv.key(name) and answers requests through
// mv.native (see bridge.js and PageBridge.kt). Each screen is a module that registers itself.

import { native } from './bridge.js';
import { INFO_REFRESH_MS, RESUME_KEY, RETRY_MS, TWITCH_EMBED_SCRIPT, WATCHDOG_MS } from './config.js';
import { hydrateIcons } from './dom.js';
import './picker.js';
import { go, key, showMessage } from './screens.js';
import './signin.js';
import { loadState, refreshAccount, state } from './state.js';
import { safely } from './util.js';
import { refreshInfo, watchdog } from './watch.js';

globalThis.mv = { native, key };

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = script.onerror = resolve;
    document.head.append(script);
  });
}

async function start() {
  hydrateIcons();
  loadState();
  await loadScript(TWITCH_EMBED_SCRIPT);
  if (!globalThis.Twitch?.Player) {
    showMessage("Can't reach Twitch. Trying again…");
    setTimeout(() => location.reload(), RETRY_MS);
    return;
  }
  await refreshAccount();
  setInterval(watchdog, WATCHDOG_MS);
  setInterval(refreshInfo, INFO_REFRESH_MS);
  const resume = safely(() => localStorage.getItem(RESUME_KEY));
  safely(() => localStorage.removeItem(RESUME_KEY));
  if (resume) go('picker', resume);
  else if (state.lineup.length) go('watch');
  else if (!state.account.login && state.account.signInAvailable) go('signin');
  else go('picker', state.account.login ? 'following' : 'search');
}

start();
