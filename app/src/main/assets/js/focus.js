// The remote's highlight on the picker and sign-in screens: one element with the `focused` class.
// (The watch screen highlights tiles itself.) Elements that can take it have the `focusable` class
// and a `data-key` that survives re-renders, so the highlight stays put when a screen redraws.

import { nearest } from './spatial.js';

let focusKey = null;

export const focusables = (root) => [...root.querySelectorAll('.focusable')].filter((el) => !el.disabled && el.offsetParent !== null);
export const focused = () => document.querySelector('.focused');

export function domRect(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export function setFocus(el) {
  if (!el) return;
  document.querySelectorAll('.focused').forEach((other) => other.classList.remove('focused'));
  el.classList.add('focused');
  focusKey = el.dataset.key;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** Puts the highlight back on the element with the remembered key; false if it's gone. */
export function restoreFocus(root) {
  const el = focusKey && root.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
  if (!el || el.disabled || el.offsetParent === null) return false;
  setFocus(el);
  return true;
}

/** Moves the highlight one step among `candidates`; returns the new element, or null if nothing lies that way. */
export function moveFocus(candidates, dir) {
  const current = focused();
  const next = nearest(current && domRect(current), candidates.filter((el) => el !== current), dir, domRect);
  if (next) setFocus(next);
  return next;
}
