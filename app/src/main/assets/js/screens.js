// The three screens (watch, picker, signin) and switching between them. A screen registers
// { enter(...args), key(name), leave?() }; its root element has the same id as its name.

import { TOAST_MS } from './config.js';
import { $ } from './dom.js';
import { state } from './state.js';

const screens = new Map();

export function register(name, screen) {
  screens.set(name, screen);
}

export function go(name, ...args) {
  const previous = state.screen;
  if (previous && previous !== name) screens.get(previous)?.leave?.();
  state.screen = name;
  for (const id of screens.keys()) $(`#${id}`).hidden = id !== name;
  $('#message').hidden = true;
  screens.get(name).enter(...args);
}

/** A key from the remote ('left', 'right', 'up', 'down', 'ok', 'hold', 'back', 'play'), for the current screen. */
export function key(name) {
  screens.get(state.screen)?.key(name);
}

export function showMessage(text) {
  $('#message').textContent = text;
  $('#message').hidden = false;
}

let toastTimer = 0;
export function toast(text) {
  $('#toast').textContent = text;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, TOAST_MS);
}
