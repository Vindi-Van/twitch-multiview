// The watch screen: up to four Twitch players, the info panel and chat.
//
// Rules learned the hard way (see README "Why it works the way it does"):
// - Tiles are positioned absolutely, so a layout change only moves and resizes them; moving an iframe
//   in the DOM would reload the stream.
// - Nothing is ever drawn over a player: Twitch pauses an embed it thinks is covered.
// - Players start muted (Twitch won't autoplay with sound) and the one you hear is unmuted once playing.
// - Never call setQuality: doing it while an ad plays freezes that player for good. "auto" sizes
//   each stream to its tile on its own.

import { api, native } from './bridge.js';
import { CHAT_HEADER, CHAT_ZOOM, DIRECTIONS, MAX_STREAMS, STALL_MS, START_GAP_MS, UI_MS } from './config.js';
import { $, h, icon } from './dom.js';
import { loginQuery, uptime, viewers } from './format.js';
import { layoutRects } from './layout.js';
import { go, register } from './screens.js';
import { nearest } from './spatial.js';
import { removeFromLineup, saveState, state } from './state.js';
import { clamp, safely } from './util.js';

const host = location.hostname;
const tiles = new Map();      // login → { login, el, player, started, offline, lastTime, lastProgress }
const startQueue = [];
const streams = new Map();    // login → Helix stream (title, game, viewers) for the info panel
let startTimer = 0;
let selected = 0;             // the highlighted lineup index
let uiTimer = 0;
let rects = { tiles: new Map() };
let chatLogin = null;

function enter() {
  if (!state.lineup.length) return go('picker', 'following');
  state.replacing = null;
  selected = clamp(selected, 0, state.lineup.length - 1);
  syncTiles();
  layout();
  applyAudio();
  const now = Date.now();
  for (const tile of tiles.values()) {
    tile.lastProgress = now;
    if (tile.started) safely(() => tile.player.play());
  }
  showUi();
  refreshInfo();
}

function leave() {
  for (const tile of tiles.values()) safely(() => tile.player.pause());
}

// ---------- Players ----------

/** Drops tiles that left the lineup and queues players for new ones, a few seconds apart. */
function syncTiles() {
  for (const [login, tile] of tiles) {
    if (state.lineup.includes(login)) continue;
    tile.el.remove();
    tiles.delete(login);
  }
  for (const login of state.lineup) if (!tiles.has(login) && !startQueue.includes(login)) startQueue.push(login);
  if (!startTimer) startNext();
}

function startNext() {
  startTimer = 0;
  if (state.screen !== 'watch') return;  // enter() picks the queue up again
  let login;
  do login = startQueue.shift(); while (login && (tiles.has(login) || !state.lineup.includes(login)));
  if (!login) return;
  addTile(login);
  if (startQueue.length) startTimer = setTimeout(startNext, START_GAP_MS);
}

function addTile(login) {
  const el = h('div', { class: 'tile' }, h('div', { class: 'player' }));
  $('#stage').append(el);
  const tile = { login, el, player: null, started: false, offline: false, lastTime: -1, lastProgress: Date.now() };
  tiles.set(login, tile);
  // Twitch only autoplays an embed that is visible when it starts, so the tile gets its place first.
  layout();
  tile.player = new globalThis.Twitch.Player(el.firstElementChild, {
    channel: login, parent: [host], width: '100%', height: '100%', autoplay: true, muted: true,
  });
  const events = globalThis.Twitch.Player;
  tile.player.addEventListener(events.PLAYING, () => {
    Object.assign(tile, { started: true, offline: false, lastProgress: Date.now() });
    applyAudio();
    renderInfo();
  });
  tile.player.addEventListener(events.ONLINE, () => { tile.offline = false; renderInfo(); });
  tile.player.addEventListener(events.OFFLINE, () => { tile.offline = true; renderInfo(); });
}

function applyAudio() {
  const heard = state.lineup[state.audio];
  for (const tile of tiles.values()) {
    safely(() => {
      const muted = !(tile.login === heard && tile.started);
      if (tile.player.getMuted() !== muted) tile.player.setMuted(muted);
      if (!muted) tile.player.setVolume(1);
    });
  }
}

/** Keeps every tile live: resumes one Twitch paused, and reloads one whose clock hasn't moved for STALL_MS. */
export function watchdog() {
  if (state.screen !== 'watch') return;
  const now = Date.now();
  for (const tile of tiles.values()) {
    if (tile.offline) continue;
    safely(() => {
      if (tile.started && tile.player.isPaused()) tile.player.play();
      const time = tile.player.getCurrentTime();
      if (time !== tile.lastTime) {
        tile.lastTime = time;
        tile.lastProgress = now;
      } else if (now - tile.lastProgress > STALL_MS) {
        console.warn(`reloading stalled stream: ${tile.login}`);
        Object.assign(tile, { started: false, lastProgress: now });
        tile.player.setChannel(tile.login);
      }
    });
  }
}

// ---------- Layout, info and chat ----------

function place(el, r) {
  el.hidden = !r;
  if (r) Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
}

function layout() {
  rects = layoutRects(state);
  for (const [login, tile] of tiles) {
    place(tile.el, rects.tiles.get(login));
    tile.el.classList.toggle('framed', rects.framed);
  }
  place($('#info'), rects.info);
  $('#info').classList.toggle('strip', rects.strip);
  place($('#chat'), rects.chat);
  syncChat();
  renderMarks();
  renderInfo();
}

/** One chat at a time: Twitch's own chat embed, scaled up to be readable from the couch. */
function syncChat() {
  const box = $('#chat');
  const frame = box.querySelector('.chat-frame');
  const login = rects.chat ? state.chat : null;
  if (login !== chatLogin) {
    chatLogin = login;
    frame.replaceChildren();
    if (login) {
      const src = `https://www.twitch.tv/embed/${encodeURIComponent(login)}/chat?parent=${host}&darkpopout`;
      frame.append(h('iframe', { src, title: `${login} chat` }));
    }
  }
  if (login) box.querySelector('.chat-name').textContent = `${streams.get(login)?.user_name || login} chat`;
  const iframe = frame.firstElementChild;
  if (iframe && rects.chat) {
    Object.assign(iframe.style, {
      width: `${rects.chat.w / CHAT_ZOOM}px`,
      height: `${(rects.chat.h - CHAT_HEADER) / CHAT_ZOOM}px`,
      transform: `scale(${CHAT_ZOOM})`,
    });
  }
}

function renderMarks() {
  const chosen = state.lineup[selected];
  const heard = state.lineup[state.audio];
  for (const [login, tile] of tiles) {
    tile.el.classList.toggle('selected', login === chosen);
    tile.el.classList.toggle('audio', login === heard);
  }
}

function renderInfo() {
  const box = $('#info');
  if (box.hidden || state.screen !== 'watch') return;
  const heard = state.lineup[state.audio];
  if (!heard) return box.replaceChildren();
  const s = streams.get(heard);
  const nameOf = (login) => streams.get(login)?.user_name || login;
  // replaceChildren would print a null as the word "null", so optional lines are filtered out first.
  box.replaceChildren(...[
    h('div', { class: 'now' }, h('span', { class: 'name', text: nameOf(heard) }), h('span', { class: 'chip-sound' }, icon('sound'), 'Sound')),
    h('div', { class: 'title', text: s ? s.title : tiles.get(heard)?.offline ? 'Offline right now' : '' }),
    s ? h('div', { class: 'meta', text: `${s.game_name} · ${viewers(s.viewer_count)} viewers · live ${uptime(s.started_at)}` }) : null,
    state.lineup.length > 1 ? h('ol', { class: 'lineup' }, state.lineup.map((login, i) => h('li', {
      class: [i === state.audio && 'audio', tiles.get(login)?.offline && 'offline'].filter(Boolean).join(' '),
      text: nameOf(login),
    }))) : null,
    h('div', { class: 'fill' }),
    h('div', { class: 'hint' }, h('b', { text: 'OK' }), ' listen · ', h('b', { text: 'Hold OK' }), ' options · ', h('b', { text: 'Back' }), ' pick streams'),
  ].filter(Boolean));
}

/** Titles, games and viewer counts for the info panel (needs a signed-in account). */
export async function refreshInfo() {
  if (state.screen !== 'watch' || !state.account.userId || !state.lineup.length) return;
  try {
    const data = await api(`streams?${loginQuery(state.lineup)}`);
    streams.clear();
    for (const s of data) streams.set(s.user_login, s);
    renderInfo();
    syncChat();
  } catch (e) {
    console.warn(`stream info: ${e.message}`);
  }
}

// ---------- Remote ----------

function showUi() {
  document.body.classList.add('ui');
  clearTimeout(uiTimer);
  uiTimer = setTimeout(() => document.body.classList.remove('ui'), UI_MS);
}

function setAudio(index) {
  if (index === state.audio) return;
  state.audio = index;
  saveState();
  layout();
  applyAudio();
}

function setChat(login) {
  state.chat = login;
  saveState();
  layout();
}

function moveSelection(dir) {
  const current = state.lineup[selected];
  const others = state.lineup.filter((login) => login !== current && rects.tiles.has(login));
  const next = nearest(rects.tiles.get(current), others, dir, (login) => rects.tiles.get(login));
  if (next) selected = state.lineup.indexOf(next);
}

/** Hold OK: the native menu for the highlighted stream. */
async function streamMenu(index) {
  const login = state.lineup[index];
  const items = [];
  if (index !== state.audio) items.push(['Listen to this one', () => setAudio(index)]);
  items.push(state.chat === login ? ['Hide chat', () => setChat(null)] : ['Show chat for this stream', () => setChat(login)]);
  items.push(['Swap for another channel', () => { state.replacing = index; go('picker'); }]);
  items.push(['Remove from lineup', () => {
    removeFromLineup(index);
    selected = clamp(selected, 0, Math.max(state.lineup.length - 1, 0));
    syncTiles();
    if (!state.lineup.length) return go('picker');
    layout();
    applyAudio();
  }]);
  if (state.lineup.length === MAX_STREAMS && !state.chat) {
    const toGrid = state.layout4 === 'focus';
    items.push([toGrid ? 'Layout: four equal squares' : 'Layout: big one you hear', () => {
      state.layout4 = toGrid ? 'grid' : 'focus';
      saveState();
      layout();
    }]);
  }
  items.push(['Pick streams', () => go('picker')]);
  const { body } = await native.call('menu', streams.get(login)?.user_name || login, items.map(([label]) => label));
  const chosen = items[Number(body)];
  if (chosen && state.screen === 'watch') chosen[1]();
}

function key(name) {
  showUi();
  if (name === 'back') return go('picker');
  if (!state.lineup.length) return;
  if (DIRECTIONS.includes(name)) moveSelection(name);
  else if (name === 'ok') setAudio(selected);
  else if (name === 'hold') streamMenu(selected);
  renderMarks();
}

register('watch', { enter, leave, key });
