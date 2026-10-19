// D-pad navigation: which item the remote moves to. Pure, so it's unit tested in Node.

/**
 * The closest item whose center lies in direction `dir` from `from`, favoring items in line with it
 * (distance across the direction counts double). Returns the first item when there's no `from` yet,
 * and null when nothing lies that way.
 *
 * @template T
 * @param {{x: number, y: number, w: number, h: number}|null} from
 * @param {T[]} items
 * @param {'left'|'right'|'up'|'down'} dir
 * @param {(item: T) => {x: number, y: number, w: number, h: number}} rectOf
 * @returns {T|null}
 */
export function nearest(from, items, dir, rectOf) {
  if (!from) return items[0] ?? null;
  const a = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  let best = null;
  let bestScore = Infinity;
  for (const item of items) {
    const r = rectOf(item);
    const b = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    const along = { left: a.x - b.x, right: b.x - a.x, up: a.y - b.y, down: b.y - a.y }[dir];
    if (along <= 1) continue;
    const across = dir === 'left' || dir === 'right' ? Math.abs(b.y - a.y) : Math.abs(b.x - a.x);
    const score = along + across * 2;
    if (score < bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}
