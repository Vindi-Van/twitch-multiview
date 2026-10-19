// The pick screen: Following / Search / Top live / Account on the left, stream cards in the middle,
// and the lineup tray along the bottom.

import { api, native } from './bridge.js';
import { DIRECTIONS, MAX_STREAMS, RESUME_KEY } from './config.js';
import { $, h, icon } from './dom.js';
import { focusables, focused, moveFocus, restoreFocus, setFocus } from './focus.js';
import { channelName, colorFor, loginQuery, previewUrl, streamThumb, viewers } from './format.js';
import { go, register, toast } from './screens.js';
import { refreshAccount, removeFromLineup, saveState, state } from './state.js';
import { safely } from './util.js';

const TAB_TITLES = { following: 'Live now', search: 'Search', top: 'Top live', account: 'Account' };
const results = { following: null, search: null, top: null };   // null: loading; { error }: failed
const cardInfo = new Map();   // login → card, for names and thumbnails in the tray
let lastMainFocus = null;     // where Right from the menu returns to
let focusFirstCard = false;   // on arrival, move to the first card once it loads (until a key is pressed)

/** Forgets loaded lists, e.g. after signing in or out. */
export function clearResults() {
  Object.assign(results, { following: null, search: null, top: null });
}

function enter(tab = state.tab) {
  focusFirstCard = true;
  setTab(tab);
}

function focusIn(el) {
  setFocus(el);
  if (el?.closest('#content, #tray')) lastMainFocus = el;
}

// ---------- Data ----------

function remember(card) {
  cardInfo.set(card.login, card);
  return card;
}

const fromStream = (s) => remember({
  login: s.user_login, name: s.user_name, title: s.title, game: s.game_name, viewers: s.viewer_count, live: true, thumb: streamThumb(s),
});

const fromChannel = (c) => remember({
  login: c.broadcaster_login, name: c.display_name, title: c.title, game: c.game_name, viewers: null, live: c.is_live,
  thumb: c.is_live ? previewUrl(c.broadcaster_login) : c.thumbnail_url,
});

function setTab(tab) {
  state.tab = tab;
  render();
  loadTab(tab);
}

async function loadTab(tab) {
  const { userId } = state.account;
  try {
    if (tab === 'following' && userId) results.following = (await api(`streams/followed?user_id=${userId}&first=100`)).map(fromStream);
    else if (tab === 'top' && userId) results.top = (await api('streams?first=40')).map(fromStream);
    else if (tab === 'search' && state.query && !results.search) return search(state.query);
    else return;
  } catch (e) {
    results[tab] = { error: e.message };
  }
  if (state.screen === 'picker' && state.tab === tab) render();
}

async function search(query) {
  state.query = query;
  saveState();
  results.search = null;
  if (state.tab === 'search') render();
  try {
    if (!state.account.userId) {
      // Without an account there's no search API: take what was typed as a channel name.
      const login = channelName(query);
      const card = login && remember({ login, name: login, title: 'Added by name', game: '', viewers: null, live: true, thumb: previewUrl(login) });
      results.search = card ? [card] : [];
    } else {
      const channels = (await api(`search/channels?query=${encodeURIComponent(query)}&first=40`)).map(fromChannel);
      const live = channels.filter((c) => c.live);
      if (live.length) {
        for (const s of await api(`streams?${loginQuery(live.map((c) => c.login))}&first=100`)) {
          const card = live.find((c) => c.login === s.user_login);
          if (card) Object.assign(card, { viewers: s.viewer_count, title: s.title, game: s.game_name, thumb: streamThumb(s) });
        }
      }
      live.sort((a, b) => (b.viewers || 0) - (a.viewers || 0));
      results.search = [...live, ...channels.filter((c) => !c.live)];
    }
  } catch (e) {
    results.search = { error: e.message };
  }
  if (state.screen === 'picker' && state.tab === 'search') render();
}

// ---------- Rendering ----------

function subtitle() {
  const list = results[state.tab];
  if (state.tab === 'account') return state.account.login ? `Signed in as ${state.account.login}` : '';
  if (!Array.isArray(list)) return '';
  if (state.tab === 'following') {
    const n = list.length;
    return `${n} channel${n === 1 ? '' : 's'} you follow ${n === 1 ? 'is' : 'are'} live · most viewers first`;
  }
  if (state.tab === 'search' && state.account.userId) {
    const live = list.filter((c) => c.live).length;
    return `${live} live · ${list.length - live} offline`;
  }
  return state.tab === 'top' ? 'Most watched on Twitch right now' : '';
}

const emptyState = (text, button = null) => h('div', { class: 'empty-state' }, h('span', { text }), button);

function signInButton() {
  if (!state.account.signInAvailable) return null;
  return h('button', { class: 'btn primary focusable', data: { key: 'empty:signin', action: 'signin' }, text: 'Sign in with a code' });
}

function cards() {
  const { tab } = state;
  if (tab === 'account') return [];
  if ((tab === 'following' || tab === 'top') && !state.account.userId) {
    const text = !state.account.signInAvailable ? "This build can't sign in to Twitch, so use Search to add channels by name."
      : tab === 'following' ? 'Sign in to see who you follow that is live.' : 'Sign in to see the top live streams.';
    return [emptyState(text, signInButton())];
  }
  if (tab === 'search' && !state.query) return [emptyState('Search for a channel or a game.')];
  const list = results[tab];
  if (list === null) return [emptyState('Loading…')];
  if (!Array.isArray(list)) {
    return [emptyState(`Couldn't load this (${list.error}).`, h('button', { class: 'btn focusable', data: { key: 'empty:retry', action: 'retry' }, text: 'Try again' }))];
  }
  if (!list.length) return [emptyState(tab === 'following' ? 'Nobody you follow is live right now.' : 'No channels found.')];
  return list.map(card);
}

function card(c) {
  const slot = state.lineup.indexOf(c.login);
  return h('button', { class: `card focusable${c.live ? '' : ' offline'}`, data: { key: `card:${c.login}`, action: 'card', login: c.login } },
    h('span', { class: 'thumb' },
      c.thumb ? h('img', { src: c.thumb, alt: '' }) : null,
      c.live ? h('span', { class: 'badge live', text: 'LIVE' }) : h('span', { class: 'thumb-empty', text: 'Offline' }),
      c.viewers != null ? h('span', { class: 'badge viewers', text: viewers(c.viewers) }) : null,
      slot >= 0 ? h('span', { class: 'badge slot', text: String(slot + 1) }) : null),
    h('span', { class: 'meta' },
      h('span', { class: 'avatar', style: { background: colorFor(c.login) }, text: c.name[0].toUpperCase() }),
      h('span', { class: 'lines' },
        h('span', { class: 'name', text: c.name }),
        h('span', { class: 'title', text: c.title || '' }),
        h('span', { class: 'game', text: c.game || '' }))));
}

function contentTop() {
  if (state.tab === 'search') {
    const note = !state.account.userId ? "Not signed in: type a channel's exact name to add it."
      : 'OK opens the keyboard. Its mic key lets you speak instead.';
    return [
      h('button', { class: 'searchbox focusable', data: { key: 'search:box', action: 'search' } },
        icon('search'),
        state.query ? h('span', { text: state.query }) : h('span', { class: 'placeholder', text: 'Search Twitch channels' })),
      h('p', { class: 'note', text: note }),
    ];
  }
  if (state.tab === 'account') {
    const { login, player, signInAvailable } = state.account;
    const row = (label, value, button) => h('div', { class: 'setting' },
      h('div', { class: 'lines' }, h('span', { class: 'label', text: label }), h('span', { class: 'value', text: value })),
      button ? h('button', { class: 'btn focusable', data: { key: `acct:${button.action}`, action: button.action }, text: button.text }) : null);
    const accountRow = !signInAvailable && !login
      ? row('Twitch account', "This build has no Twitch Client ID, so it can't sign in (see the README).", null)
      : row('Twitch account', login ? `Signed in as ${login}` : 'Not signed in. Following and search need it.',
        login ? { action: 'signout', text: 'Sign out' } : { action: 'signin', text: 'Sign in with a code' });
    return [h('div', { class: 'settings' },
      accountRow,
      row('Video player', player ? 'Signed in on twitch.tv: Turbo and subscriptions apply' : 'Not signed in: streams play ads',
        player ? null : { action: 'player', text: 'Sign in to the player' }),
      row('Four streams', state.layout4 === 'focus' ? 'Focus: the one you hear is big' : 'Grid: four equal squares',
        { action: 'layout', text: state.layout4 === 'focus' ? 'Use the grid' : 'Use focus' }))];
  }
  return [];
}

function tray() {
  const n = state.lineup.length;
  const slots = Array.from({ length: MAX_STREAMS }, (_, i) => {
    const login = state.lineup[i];
    if (!login) {
      return h('div', { class: 'slot empty' }, h('span', { class: 'mini', text: 'Empty' }), h('span', { class: 'slot-name', text: i === n ? 'Pick one more' : '' }));
    }
    const known = cardInfo.get(login);
    return h('button', { class: 'slot focusable', data: { key: `slot:${login}`, action: 'slot', login } },
      h('span', { class: 'mini' }, h('img', { src: known?.thumb || previewUrl(login), alt: '' }), h('span', { class: 'badge slot', text: String(i + 1) })),
      h('span', { class: 'slot-name', text: known?.name || login }));
  });
  return [
    h('div', { class: 'tray-label' }, h('b', { text: 'Lineup' }), h('span', { text: `${n} of ${MAX_STREAMS} picked` })),
    ...slots,
    h('div', { class: 'tray-fill' }),
    h('div', { class: 'tray-go' },
      h('button', { class: 'btn primary focusable', data: { key: 'watch', action: 'watch' }, disabled: n === 0, text: n ? `Watch ${n} stream${n === 1 ? '' : 's'}` : 'Pick a stream' }),
      h('span', { text: 'OK adds or removes · ▶❚❚ starts watching' })),
  ];
}

function render() {
  const { tab, account } = state;
  document.querySelectorAll('#rail [data-tab]').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
  $('#rail-avatar').textContent = (account.login || '?')[0].toUpperCase();
  $('#rail-avatar').style.background = account.login ? colorFor(account.login) : '';
  $('#rail-login').textContent = account.login || 'Not signed in';
  $('#rail-status').textContent = account.login ? (account.player ? 'Player signed in too' : 'Signed in') : 'Account';
  $('#banner').hidden = state.replacing == null;
  if (state.replacing != null) $('#banner').textContent = `Pick a channel to replace ${state.lineup[state.replacing]}. Back cancels.`;
  $('#content-title').textContent = TAB_TITLES[tab];
  $('#content-sub').textContent = subtitle();
  $('#content-top').replaceChildren(...contentTop());
  $('#cards').replaceChildren(...cards());
  $('#tray').replaceChildren(...tray());
  if (!restoreFocus($('#picker'))) {
    focusIn(focusables($('#cards'))[0] || focusables($('#content'))[0] || $(`#rail [data-tab="${tab}"]`));
  }
  const firstCard = focusables($('#cards'))[0];
  if (focusFirstCard && firstCard && focused()?.closest('#rail')) focusIn(firstCard);
}

// ---------- Remote ----------

function move(dir) {
  const current = focused();
  const inRail = !!current?.closest('#rail');
  const pool = focusables($('#picker')).filter((el) => !!el.closest('#rail') === inRail);
  let next = moveFocus(pool, dir);
  if (!next && inRail && dir === 'right') {
    next = lastMainFocus?.isConnected && lastMainFocus.offsetParent ? lastMainFocus : focusables($('#content'))[0] || focusables($('#tray'))[0];
    if (next) focusIn(next);
  } else if (!next && !inRail && dir === 'left') {
    focusIn($(`#rail [data-tab="${state.tab}"]`));
  } else if (next) {
    focusIn(next);
  }
}

function toggleChannel(login) {
  if (state.replacing != null) {
    const index = state.replacing;
    const existing = state.lineup.indexOf(login);
    if (existing >= 0 && existing !== index) return toast('Already in your lineup');
    if (state.chat === state.lineup[index]) state.chat = null;
    state.lineup[index] = login;
    saveState();
    return go('watch');
  }
  const index = state.lineup.indexOf(login);
  if (index >= 0) removeFromLineup(index);
  else if (state.lineup.length >= MAX_STREAMS) return toast('Your lineup is full. Remove one first.');
  else {
    state.lineup.push(login);
    saveState();
  }
  render();
}

/** The app reloads the page when Twitch's sign-in page closes; RESUME_KEY says which tab to land on. */
export function startPlayerSignIn(resumeTab) {
  safely(() => localStorage.setItem(RESUME_KEY, resumeTab));
  native.send('playerSignIn');
}

async function activate(el) {
  if (!el) return;
  const { action, login, tab } = el.dataset;
  if (action === 'tab') setTab(tab);
  else if (action === 'card') toggleChannel(login);
  else if (action === 'slot') {
    removeFromLineup(state.lineup.indexOf(login));
    render();
  } else if (action === 'watch') go('watch');
  else if (action === 'search') {
    const { status, body } = await native.call('prompt', 'Search Twitch', state.query, 'Channel name');
    if (status === 200 && body.trim()) search(body.trim());
  } else if (action === 'signin') go('signin');
  else if (action === 'signout') {
    await native.call('signOut');
    await refreshAccount();
    clearResults();
    render();
    toast('Signed out');
  } else if (action === 'player') startPlayerSignIn('account');
  else if (action === 'layout') {
    state.layout4 = state.layout4 === 'focus' ? 'grid' : 'focus';
    saveState();
    render();
  } else if (action === 'retry') {
    results[state.tab] = null;
    render();
    loadTab(state.tab);
  }
}

function key(name) {
  focusFirstCard = false;
  if (DIRECTIONS.includes(name)) return move(name);
  if (name === 'ok' || name === 'hold') return activate(focused());
  if (name === 'play') return state.lineup.length && go('watch');
  if (name === 'back') return state.replacing != null ? go('watch') : native.send('exit');
}

register('picker', { enter, key });
