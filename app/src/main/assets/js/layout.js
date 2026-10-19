// Where the players, the info panel and chat go on the 1920x1080 screen. Pure, so it's unit tested in Node.

export const rect = (x, y, w, h) => ({ x, y, w, h });

/**
 * The layout for a lineup, by how many streams there are:
 *   1: full screen; with chat, the stream top-left, chat on the right, info below
 *   2: side by side with info along the bottom; with chat, chat under its stream and info under the other
 *   3: 2x2, the fourth square shows info or chat
 *   4: focus (the one you hear big, the rest down the side, info or chat below it), or a 2x2 grid
 *
 * Nothing overlaps a player (Twitch pauses an embed that anything is drawn over), and every player
 * stays at least 400x300, Twitch's minimum embed size.
 *
 * @param {{lineup: string[], audio: number, chat: string|null, layout4: 'focus'|'grid'}} view
 * @returns {{tiles: Map<string, object>, info: object|null, chat: object|null, strip: boolean, framed: boolean}}
 */
export function layoutRects({ lineup, audio, chat, layout4 }) {
  const n = lineup.length;
  const heard = lineup[audio];
  const out = { tiles: new Map(), info: null, chat: null, strip: false, framed: n > 1 };
  const cell = (i) => rect((i % 2) * 960, Math.floor(i / 2) * 540, 960, 540);
  if (n === 1 && !chat) {
    out.tiles.set(lineup[0], rect(0, 0, 1920, 1080));
  } else if (n === 1) {
    out.tiles.set(lineup[0], rect(0, 0, 1280, 720));
    out.info = rect(0, 720, 1280, 360);
    out.chat = rect(1280, 0, 640, 1080);
  } else if (n === 2 && !chat) {
    lineup.forEach((login, i) => out.tiles.set(login, rect(i * 960, 270, 960, 540)));
    out.info = rect(0, 810, 1920, 270);
    out.strip = true;
  } else if (n === 2) {
    lineup.forEach((login, i) => out.tiles.set(login, cell(i)));
    const c = lineup.indexOf(chat);
    out.chat = cell(2 + c);
    out.info = cell(3 - c);
  } else if (n === 3) {
    lineup.forEach((login, i) => out.tiles.set(login, cell(i)));
    out[chat ? 'chat' : 'info'] = cell(3);
  } else if (n === 4 && layout4 === 'grid' && !chat) {
    lineup.forEach((login, i) => out.tiles.set(login, cell(i)));
  } else if (n === 4) {
    out.tiles.set(heard, rect(0, 0, 1280, 720));
    lineup.filter((login) => login !== heard).forEach((login, i) => out.tiles.set(login, rect(1280, i * 360, 640, 360)));
    out[chat ? 'chat' : 'info'] = rect(0, 720, 1280, 360);
  }
  return out;
}
