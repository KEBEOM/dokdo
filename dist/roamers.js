// ─────────────────────────────────────────────────────────────────────────────
// 길 위를 걸어 다니는 야생 우산몬 (v0.43)
//
// 마을에는 야생 우산몬이 나오지 않아요. 마을과 마을 사이의 길(route)에서만, 잔디와 풀숲 위를
// 사나워진 우산몬이 눈에 보이게 걸어 다녀요. 부딪히거나 눌러서 다가가면 결투가 시작돼요.
// 결투가 끝나면(정화·동료·물러나기) 그 우산몬은 사라지고, 잠시 뒤 다른 자리에 새로 나타나요(리젠).
//
//   ROAMER_COUNT  한 길에 동시에 걸어 다니는 수
//   RESPAWN_MS    사라진 뒤 새로 나타나기까지 걸리는 시간(무작위 범위)
//   STEP_MS       한 칸 걷는 시간 · WAIT_MS 한 걸음 쉬는 시간(무작위 범위)
// ─────────────────────────────────────────────────────────────────────────────
import { MONSTERS, isUnique } from './data.js';
import { blocked } from './world.js';

export const ROAMER_COUNT = 4, RESPAWN_MS = [5000, 11000], STEP_MS = 420, WAIT_MS = [700, 2200];
export const FIELD_TILES = new Set([1, 3]); // 1 잔디(평야) · 3 풀숲(들판)
const DIRS = [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']];

// 그 길에 나오는 우산몬: 이 장과 다음 장의 야생 우산몬 (전설·스타팅 제외)
export function roamerPool(zone) {
  const hi = Math.min(6, zone + 1);
  return MONSTERS.filter(m => m.stage === 1 && !isUnique(m) && m.zone >= zone && m.zone <= hi).map(m => m.id);
}

export function createRoamers(rng = Math.random) {
  let list = [], mapId = null, nextSpawn = 0, seq = 0, pausedAt = 0;
  const between = ([a, b]) => a + rng() * (b - a);
  const near = (a, b, r) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= r;
  const isFree = (map, x, y, others, player, self = null) =>
    FIELD_TILES.has(map[y]?.[x]) && !blocked(map, x, y, others) && !map.exits.has(`${x},${y}`) &&
    !list.some(r => r !== self && ((r.x === x && r.y === y) || (r.fromX === x && r.fromY === y && r.moving))) &&
    !(player && ((player.x === x && player.y === y) || (player.toX === x && player.toY === y)));

  function spawn(map, others, player, now) {
    const pool = roamerPool(map.zone), spots = [];
    const keep = Object.values(map.spawns || {});
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      if (!isFree(map, x, y, others, player)) continue;
      if (player && near({ x, y }, player, 5)) continue;         // 플레이어 눈앞에서 갑자기 생기지 않게
      if (keep.some(s => near({ x, y }, s, 2))) continue;        // 길 입구는 비워 둬요
      spots.push({ x, y });
    }
    if (!spots.length || !pool.length) return null;
    const p = spots[Math.floor(rng() * spots.length)], species = pool[Math.floor(rng() * pool.length)];
    const m = MONSTERS.find(m => m.id === species);
    const r = { uid: `${map.id}:wild-${++seq}`, id: 'wild', kind: 'wild', species, name: `사나워진 ${m.name}`, x: p.x, y: p.y, fromX: p.x, fromY: p.y, dir: 'down', moving: null, nextMove: now + between(WAIT_MS), bornAt: now };
    list.push(r); return r;
  }

  // 지도가 바뀌면 새로 채워요. 마을·건물 안에서는 아무도 없어요.
  function sync(map, others, player, now) {
    if (map.id === mapId) return;
    mapId = map.id; list = []; nextSpawn = now + between(RESPAWN_MS);
    if (map.kind === 'route') for (let i = 0; i < ROAMER_COUNT; i++) spawn(map, others, player, now);
  }

  function update(map, others, player, now, paused) {
    if (map.kind !== 'route') { list = []; return; }
    if (paused) { if (!pausedAt) pausedAt = now; return; }
    if (pausedAt) { const d = now - pausedAt; pausedAt = 0; nextSpawn += d; for (const r of list) { r.nextMove += d; if (r.moving) r.moving.t0 += d; } }
    for (const r of list) {
      if (r.moving && now - r.moving.t0 >= STEP_MS) r.moving = null;
      if (r.moving || now < r.nextMove) continue;
      const order = DIRS.slice().sort(() => rng() - .5);
      const step = order.find(([dx, dy]) => isFree(map, r.x + dx, r.y + dy, others, player, r));
      r.nextMove = now + STEP_MS + between(WAIT_MS);
      if (!step || rng() < .25) continue;                        // 가끔은 제자리에서 두리번
      const [dx, dy, dir] = step;
      r.dir = dir; r.fromX = r.x; r.fromY = r.y; r.x += dx; r.y += dy; r.moving = { t0: now };
    }
    if (list.length < ROAMER_COUNT && now >= nextSpawn) { spawn(map, others, player, now); nextSpawn = now + between(RESPAWN_MS); }
  }

  // 그릴 위치(칸 사이를 부드럽게)와 함께
  function snapshot(now) {
    return list.map(r => {
      const p = r.moving ? Math.min(1, (now - r.moving.t0) / STEP_MS) : 1;
      return { ...r, drawX: r.fromX + (r.x - r.fromX) * p, drawY: r.fromY + (r.y - r.fromY) * p, walking: p < 1 };
    });
  }
  const at = (x, y) => list.find(r => r.x === x && r.y === y) || null;
  // 결투가 끝난 우산몬은 사라지고, 잠시 뒤 다른 자리에 새로 나타나요.
  function remove(uid, now = 0) { list = list.filter(r => r.uid !== uid); nextSpawn = Math.max(nextSpawn, now + between(RESPAWN_MS)); }
  function reset() { list = []; mapId = null; pausedAt = 0; }
  return { sync, update, snapshot, at, remove, reset, get count() { return list.length; }, get list() { return list; } };
}
