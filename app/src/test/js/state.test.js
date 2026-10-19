import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeSaved } from '../../main/assets/js/state.js';

describe('normalizeSaved', () => {
  it('starts empty with nothing saved', () => {
    assert.deepEqual(normalizeSaved(null), { lineup: [], audio: 0, layout4: 'focus', chat: null, query: '' });
  });

  it('keeps a valid saved lineup and choices', () => {
    const saved = { lineup: ['a1', 'b2'], audio: 1, layout4: 'grid', chat: 'b2', query: 'dota' };
    assert.deepEqual(normalizeSaved(saved), saved);
  });

  it('cleans names, drops duplicates and invalid entries, and keeps at most four', () => {
    const out = normalizeSaved({ lineup: ['One', 'one', 'bad name', 'twitch.tv/two', 'three', 'four', 'five'] });
    assert.deepEqual(out.lineup, ['one', 'two', 'three', 'four']);
  });

  it('keeps the sound and chat pointing at streams that exist', () => {
    const out = normalizeSaved({ lineup: ['aa', 'bb'], audio: 7, chat: 'gone' });
    assert.equal(out.audio, 1);
    assert.equal(out.chat, null);
  });

  it('treats anything but "grid" as the focus layout', () => {
    assert.equal(normalizeSaved({ layout4: 'weird' }).layout4, 'focus');
  });

  it('lets the launch intent replace the saved lineup', () => {
    const out = normalizeSaved({ lineup: ['aa', 'bb'], audio: 1 }, 'xx,yy,zz');
    assert.deepEqual(out.lineup, ['xx', 'yy', 'zz']);
    assert.equal(out.audio, 0);
  });

  it('survives garbage', () => {
    assert.deepEqual(normalizeSaved({ lineup: 'nope', audio: 'x', query: 5 }).lineup, []);
    assert.equal(normalizeSaved('string').lineup.length, 0);
  });
});
