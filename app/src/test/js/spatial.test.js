import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nearest } from '../../main/assets/js/spatial.js';

// A 4-column grid of 100x100 cards with 20px gaps, like the picker.
const cards = Array.from({ length: 8 }, (_, i) => ({ id: i, x: (i % 4) * 120, y: Math.floor(i / 4) * 120, w: 100, h: 100 }));
const rectOf = (c) => c;
const from = (i) => cards[i];
const others = (i) => cards.filter((c) => c.id !== i);
const move = (i, dir) => nearest(from(i), others(i), dir, rectOf)?.id ?? null;

describe('nearest', () => {
  it('moves one card along a row', () => {
    assert.equal(move(1, 'right'), 2);
    assert.equal(move(1, 'left'), 0);
  });

  it('moves straight down and up a column', () => {
    assert.equal(move(1, 'down'), 5);
    assert.equal(move(6, 'up'), 2);
  });

  it('returns null at an edge', () => {
    assert.equal(move(3, 'right'), null);
    assert.equal(move(0, 'up'), null);
  });

  it('starts at the first item when nothing is highlighted', () => {
    assert.equal(nearest(null, cards, 'down', rectOf).id, 0);
    assert.equal(nearest(null, [], 'down', rectOf), null);
  });

  it('prefers what is in line over what is merely close', () => {
    // From a big tile on the left, Right goes to the side tile level with its center.
    const big = { x: 0, y: 0, w: 1280, h: 720 };
    const side = [{ id: 'top', x: 1280, y: 0, w: 640, h: 360 }, { id: 'middle', x: 1280, y: 360, w: 640, h: 360 }, { id: 'bottom', x: 1280, y: 720, w: 640, h: 360 }];
    assert.ok(['top', 'middle'].includes(nearest(big, side, 'right', rectOf).id));
    assert.equal(nearest(side[2], [big, side[0], side[1]], 'left', rectOf), big);
  });
});
