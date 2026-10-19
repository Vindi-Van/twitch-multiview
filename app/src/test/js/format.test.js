import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { channelName, colorFor, loginQuery, previewUrl, streamThumb, uptime, viewers } from '../../main/assets/js/format.js';

describe('channelName', () => {
  it('accepts names, links and pasted URLs', () => {
    assert.equal(channelName('Summit1G'), 'summit1g');
    assert.equal(channelName('  esl_dota2 '), 'esl_dota2');
    assert.equal(channelName('twitch.tv/xqc'), 'xqc');
    assert.equal(channelName('https://www.twitch.tv/Gaules/videos?filter=all'), 'gaules');
  });

  it('rejects anything that is not a Twitch login', () => {
    for (const bad of ['', 'a', 'has space', 'semi;colon', 'x'.repeat(26), 'https://example.com']) {
      assert.equal(channelName(bad), null, bad);
    }
  });
});

describe('viewers', () => {
  it('formats counts like Twitch does', () => {
    assert.equal(viewers(980), '980');
    assert.equal(viewers(1400), '1.4K');
    assert.equal(viewers(12440), '12K');
  });
});

describe('uptime', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  it('shows minutes, then hours and minutes', () => {
    assert.equal(uptime('2026-10-19T11:15:00Z', now), '45m');
    assert.equal(uptime('2026-10-19T08:48:00Z', now), '3h 12m');
    assert.equal(uptime('2026-10-19T12:05:00Z', now), '0m');
  });
});

describe('image URLs', () => {
  const now = 1_800_000_000_000;
  it('builds previews that change every five minutes', () => {
    assert.match(previewUrl('xqc', now), /live_user_xqc-440x248\.jpg\?t=\d+$/);
    assert.notEqual(previewUrl('xqc', now), previewUrl('xqc', now + 300_000));
    assert.equal(previewUrl('xqc', now), previewUrl('xqc', now + 1000));
  });

  it('fills in the size placeholders of a Helix thumbnail', () => {
    const url = streamThumb({ thumbnail_url: 'https://cdn/x-{width}x{height}.jpg' }, now);
    assert.match(url, /^https:\/\/cdn\/x-440x248\.jpg\?t=\d+$/);
  });
});

describe('loginQuery and colorFor', () => {
  it('builds a Helix query for several logins', () => {
    assert.equal(loginQuery(['a', 'b c']), 'user_login=a&user_login=b%20c');
  });

  it('gives each channel a stable color', () => {
    assert.equal(colorFor('xqc'), colorFor('xqc'));
    assert.match(colorFor('xqc'), /^#[0-9a-f]{6}$/);
  });
});
