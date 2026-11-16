// ─────────────────────────────────────────────────────────────────────────────
// v0.47: 나리분지 초원(kind 'meadow')에서는 김박사가 데려다 놓은 순한 우산몬(setFriends로 받은 목록)이
// 한 마리씩 걸어 다녀요. 검은 기운이 없고, 부딪혀도 결투하지 않고, 말을 걸면 동료로 고를 수 있어요.
// 길 위를 걸어 다니는 야생 우산몬 (v0.43)
//
// 마을에는 야생 우산몬이 나오지 않아요. 마을과 마을 사이의 길(route)에서만, 잔디와 풀숲 위를
// 사나워진 우산몬이 눈에 보이게 걸어 다녀요. 부딪히거나 눌러서 다가가면 결투가 시작돼요.
// 결투가 끝나면(정화·동료·물러나기) 그 우산몬은 사라지고, 잠시 뒤 다른 자리에 새로 나타나요(리젠).
//
//   ROAMER_COUNT  한 길에 동시에 걸어 다니는 수
//   RESPAWN_MS    사라진 뒤 새로 나타나기까지 걸리는 시간(무작위 범위)
//   STEP_MS       한 칸 걷는 시간 · WAIT_MS 한 걸음 쉬는 시간(무작위 범위)
// v0.59: 한 길에 10마리가 걸어 다녀요(전에는 4마리). 리젠 시간은 ‘멈춰 있던 시간(결투·대화·메뉴)’을 뺀 시계로 재요.
//        전에는 결투가 길수록 다음 우산몬이 그만큼 늦게 나와서, 거의 다시 나타나지 않는 것처럼 보였어요.
// ─────────────────────────────────────────────────────────────────────────────
import { MONSTERS, isUnique } from './data.js';
import { blocked } from './world.js';

export const ROAMER_COUNT = 10, RESPAWN_MS = [3000, 6000], STEP_MS = 420, WAIT_MS = [700, 2200];
export const FIELD_TILES = new Set([1, 3]); // 1 잔디(평야) · 3 풀숲(들판)
const DIRS = [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']];

// 그 길에 나오는 우산몬: 이 장과 다음 장의 야생 우산몬 (전설·스타팅 제외)
export function roamerPool(zone) {
  const hi = Math.min(6, zone + 1);
  return MONSTERS.filter(m => m.stage === 1 && !isUnique(m) && m.zone >= zone && m.zone <= hi).map(m => m.id);
}

const walksHere = map => map.kind === 'route' || map.kind === 'meadow';
export function createRoamers(rng = Math.random) {
  let list = [], mapId = null, nextSpawn = 0, seq = 0, pausedAt = 0, pausedTotal = 0, friends = [];
  // 멈춘 시간을 뺀 시계: 결투·대화 중에는 흐르지 않아요
  const T = now => (pausedAt || now) - pausedTotal;
  const between = ([a, b]) => a + rng() * (b - a);
  const near = (a, b, r) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= r;
  const isFree = (map, x, y, others, player, self = null) =>
    FIELD_TILES.has(map[y]?.[x]) && !blocked(map, x, y, others) && !map.exits.has(`${x},${y}`) &&
    !list.some(r => r !== self && ((r.x === x && r.y === y) || (r.fromX === x && r.fromY === y && r.moving))) &&
    !(player && ((player.x === x && player.y === y) || (player.toX === x && player.toY === y)));

  function spawn(map, others, player, t, fixed = null) { const now = t;
    const pool = fixed ? [fixed] : roamerPool(map.zone), spots = [];
    const keep = Object.values(map.spawns || {});
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      if (!isFree(map, x, y, others, player)) continue;
      if (player && near({ x, y }, player, fixed ? 3 : 5)) continue; // 플레이어 눈앞에서 갑자기 생기지 않게
      if (keep.some(s => near({ x, y }, s, 2))) continue;        // 길 입구는 비워 둬요
      spots.push({ x, y });
    }
    if (!spots.length || !pool.length) return null;
    const p = spots[Math.floor(rng() * spots.length)], species = pool[Math.floor(rng() * pool.length)];
    const m = MONSTERS.find(m => m.id === species);
    const kind = fixed ? 'friend' : 'wild';
    const r = { uid: `${map.id}:${kind}-${++seq}`, id: kind, kind, species, name: fixed ? m.name : `사나워진 ${m.name}`, x: p.x, y: p.y, fromX: p.x, fromY: p.y, dir: 'down', moving: null, nextMove: now + between(WAIT_MS), bornAt: now };
    list.push(r); return r;
  }

  // 지도가 바뀌면 새로 채워요. 마을·건물 안에서는 아무도 없어요.
  function sync(map, others, player, time) {
    if (map.id === mapId) return;
    const now = T(time);
    mapId = map.id; list = []; nextSpawn = now + between(RESPAWN_MS);
    if (map.kind === 'route') for (let i = 0; i < ROAMER_COUNT; i++) spawn(map, others, player, now);
    if (map.kind === 'meadow') for (const id of friends) spawn(map, others, player, now, id);
  }

  function update(map, others, player, now, paused) {
    if (!walksHere(map)) { list = []; return; }
    if (paused) { if (!pausedAt) pausedAt = now; return; }
    if (pausedAt) { pausedTotal += now - pausedAt; pausedAt = 0; }
    now = T(now);
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
    if (map.kind === 'route' && list.length < ROAMER_COUNT && now >= nextSpawn) { spawn(map, others, player, now); nextSpawn = now + between(RESPAWN_MS); }
  }

  // 그릴 위치(칸 사이를 부드럽게)와 함께
  function snapshot(time) {
    const now = T(time);
    return list.map(r => {
      const p = r.moving ? Math.min(1, (now - r.moving.t0) / STEP_MS) : 1;
      return { ...r, drawX: r.fromX + (r.x - r.fromX) * p, drawY: r.fromY + (r.y - r.fromY) * p, walking: p < 1 };
    });
  }
  const at = (x, y) => list.find(r => r.x === x && r.y === y) || null;
  // 결투가 끝난 우산몬은 사라지고, 잠시 뒤 다른 자리에 새로 나타나요.
  function remove(uid, time = 0) { const now = T(time); list = list.filter(r => r.uid !== uid); nextSpawn = now + between(RESPAWN_MS); }
  function reset() { list = []; mapId = null; pausedAt = 0; pausedTotal = 0; }
  // 초원의 우산몬 목록(종 번호). 바꾸면 다음 sync 때 새로 놓여요.
  function setFriends(ids) { friends = [...ids]; mapId = null; }
  return { sync, update, snapshot, at, remove, reset, setFriends, get count() { return list.length; }, get list() { return list; } };
}
