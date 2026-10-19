import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { layoutRects } from '../../main/assets/js/layout.js';

const LOGINS = ['a', 'b', 'c', 'd'];
const view = (n, extra = {}) => ({ lineup: LOGINS.slice(0, n), audio: 0, chat: null, layout4: 'focus', ...extra });

const overlaps = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
const regions = (out) => [...out.tiles.values(), out.info, out.chat].filter(Boolean);

// Every combination the app can show.
const CASES = [1, 2, 3, 4].flatMap((n) => [
  ['no chat', view(n)],
  ['chat on the first stream', view(n, { chat: 'a' })],
  ...(n > 1 ? [['chat on the last stream', view(n, { chat: LOGINS[n - 1] })], ['sound on the last stream', view(n, { audio: n - 1 })]] : []),
  ...(n === 4 ? [['grid', view(n, { layout4: 'grid' })]] : []),
].map(([name, v]) => [`${n} stream${n > 1 ? 's' : ''}, ${name}`, v]));

describe('layoutRects', () => {
  for (const [name, v] of CASES) {
    it(`${name}: places every stream inside the screen, at least 400x300, with nothing overlapping`, () => {
      const out = layoutRects(v);
      assert.equal(out.tiles.size, v.lineup.length);
      for (const r of regions(out)) {
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1920 && r.y + r.h <= 1080, `outside the screen: ${JSON.stringify(r)}`);
      }
      for (const r of out.tiles.values()) {
        // Tiles lose a 7px frame on each side when there's more than one stream.
        const inset = out.framed ? 14 : 0;
        assert.ok(r.w - inset >= 400 && r.h - inset >= 300, `player below Twitch's minimum: ${JSON.stringify(r)}`);
      }
      const all = regions(out);
      all.forEach((p, i) => all.slice(i + 1).forEach((q) => assert.ok(!overlaps(p, q), `overlap: ${JSON.stringify(p)} ${JSON.stringify(q)}`)));
    });
  }

  it('shows chat only when a chat is open', () => {
    assert.equal(layoutRects(view(3)).chat, null);
    assert.ok(layoutRects(view(3, { chat: 'b' })).chat);
  });

  it('one stream fills the screen', () => {
    assert.deepEqual(layoutRects(view(1)).tiles.get('a'), { x: 0, y: 0, w: 1920, h: 1080 });
  });

  it('two streams sit side by side with info along the bottom', () => {
    const out = layoutRects(view(2));
    assert.equal(out.tiles.get('a').y, out.tiles.get('b').y);
    assert.equal(out.strip, true);
  });

  it('focus makes the stream you hear the big one', () => {
    const out = layoutRects(view(4, { audio: 2 }));
    assert.deepEqual(out.tiles.get('c'), { x: 0, y: 0, w: 1280, h: 720 });
    assert.equal(out.tiles.get('a').w, 640);
  });

  it('the grid gives four equal squares', () => {
    const sizes = [...layoutRects(view(4, { layout4: 'grid' })).tiles.values()].map((r) => `${r.w}x${r.h}`);
    assert.deepEqual(sizes, ['960x540', '960x540', '960x540', '960x540']);
  });

  it('opening chat with four streams switches the grid to focus, so chat has room', () => {
    const out = layoutRects(view(4, { layout4: 'grid', chat: 'b' }));
    assert.deepEqual(out.tiles.get('a'), { x: 0, y: 0, w: 1280, h: 720 });
    assert.ok(out.chat);
  });

  it('with two streams, chat goes under the stream it belongs to', () => {
    const out = layoutRects(view(2, { chat: 'b' }));
    assert.equal(out.chat.x, out.tiles.get('b').x);
  });
});
