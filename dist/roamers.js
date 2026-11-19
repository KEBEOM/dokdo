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
// v0.70 사는 곳: 물고기·바다 생물은 물가 가까운 바다(물속), 갯바위 생물(홍합·바위게·거북손)은 물가 땅, 나머지는 풀밭
// v0.72: 가마우지·아비(79~81)는 물 위에 떠 있는 새(surface) — 물속에는 없어요
const SEA = new Set(Array.from({ length: 33 }, (_, i) => 34 + i)), SHORE = new Set([54, 55, 56]), SURFACE = new Set([79, 80, 81]);
export const habitat = id => SHORE.has(Number(id)) ? 'shore' : SURFACE.has(Number(id)) ? 'surface' : SEA.has(Number(id)) ? 'sea' : 'land';
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
// 그 사는 곳에 맞는 칸인지(막힘·사람은 따로 봐요)
export function habitatTile(map, x, y, hab) {
  const t = map[y]?.[x]; if (t === undefined) return false;
  if (map.solid?.has(`${x},${y}`)) return false; // v0.74 소파블록·물 위 바위 칸에는 살지 않아요
  if (map.hull?.has(`${x},${y}`)) return false; // v0.87 배 밑 칸에도 살지 않아요(물 위에선 배가 막아요)
  if ((hab === 'sea' || hab === 'surface') && map.shallow) return t === 0; // v0.71: 얕은 물(걸어서)과 깊은 물(잠수해서) 모두 — 나도 들어가서 만날 수 있어요
  if (hab === 'sea' || hab === 'surface') return t === 0 && N4.some(([a, b]) => { const n = map[y + b]?.[x + a]; return n !== undefined && n !== 0 && !map.solid?.has(`${x + a},${y + b}`); }); // 물가에서 한 칸 안쪽 물(부딪혀 만날 수 있게)
  if (hab === 'shore') return (t === 4 || t === 1 || t === 3) && N8.some(([a, b]) => map[y + b]?.[x + a] === 0);
  return FIELD_TILES.has(t);
}
const DIRS = [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']];

// v0.69 때를 타는 우산몬: 실제 생물이 활동하는 때를 따라 밤에만·낮에만·한 계절에만 길에 나와요.
//   time 'night' | 'day' · season: 그 계절에만 · why: 도감에 보이는 까닭(실제 생물 이야기)
export const WHEN = {
  37: { time: 'night', why: '볼락은 낮에는 바위 그늘에 머물다가 밤에 먹이를 찾아 나와요.' },
  39: { time: 'night', why: '개볼락은 밤에 더 활발하게 움직여요.' },
  52: { time: 'night', why: '참문어는 낮에는 바위 틈에 숨고 밤에 사냥해요.' },
  57: { time: 'night', why: '돌기해삼은 밤에 바닥을 기어 다니며 먹이를 먹어요.' },
  69: { time: 'night', why: '슴새는 낮에는 먼바다에 있다가 밤에 섬의 둥지(굴)로 돌아와요.' },
  97: { time: 'night', why: '호랑지빠귀는 밤에 ‘휘-’ 하고 가늘게 우는 새예요.' },
  27: { time: 'day', why: '무당벌레는 햇볕이 드는 낮에 날아다녀요.' },
  28: { time: 'day', why: '노랑나비는 낮에 꽃을 찾아 날아다녀요.' },
  30: { time: 'day', why: '꽃등에는 낮에 꽃가루와 꿀을 찾아다녀요.' },
  31: { time: 'day', why: '꽃등에는 낮에 꽃가루와 꿀을 찾아다녀요.' },
  33: { time: 'day', why: '무당벌레는 햇볕이 드는 낮에 날아다녀요.' },
  12: { season: 'spring', why: '섬괴불나무는 봄(5월쯤)에 흰 꽃이 펴요.' },
  89: { season: 'spring', time: 'day', why: '후투티는 봄에 찾아오는 여름 철새예요.' },
  10: { season: 'summer', why: '술패랭이꽃은 여름에 분홍 꽃이 펴요.' },
  13: { season: 'summer', why: '참나리는 여름(7~8월)에 주황 꽃이 펴요.' },
  24: { season: 'summer', time: 'day', why: '된장잠자리는 여름에 바다를 건너 날아와요.' },
  1: { season: 'autumn', why: '해국은 가을에 바닷가 바위틈에서 연보라 꽃을 피워요.' },
  99: { season: 'autumn', why: '되새는 가을에 무리 지어 찾아오는 겨울 철새예요.' },
  19: { season: 'winter', why: '동백나무는 추운 겨울에 붉은 꽃을 피워요.' },
  50: { season: 'winter', why: '방어는 겨울에 살이 올라 동해를 따라 내려와요.' },
  98: { season: 'winter', why: '개똥지빠귀는 겨울을 나러 오는 겨울 철새예요.' }
};
const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
export function whenNote(id) {
  const w = WHEN[id]; if (!w) return '';
  const t = [w.season && `${SEASON_KO[w.season]}에만`, w.time === 'night' ? '밤에만' : w.time === 'day' ? '낮에만' : ''].filter(Boolean).join(' · ');
  return `${t} 길에 나와요. ${w.why}`;
}
export const fitsNow = (id, now) => { const w = WHEN[id]; if (!w || !now) return true; return (!w.season || w.season === now.season) && (!w.time || (w.time === 'night') === !!now.night); };

// 그 길에 나오는 우산몬: 이 장과 다음 장의 야생 우산몬 (전설·스타팅 제외). now({ season, night })를 주면 때가 맞는 것만
export function roamerPool(zone, now = null) {
  const hi = Math.min(6, zone + 1);
  const all = MONSTERS.filter(m => m.stage === 1 && !isUnique(m) && m.zone >= zone && m.zone <= hi).map(m => m.id), fit = all.filter(id => fitsNow(id, now));
  return fit.length ? fit : all;
}

// v0.69 마을 사람의 첫인사: 밤이면 밤 이야기, 낮이면 계절 이야기(그때만 나오는 우산몬 귀띔)
const TALK = {
  night: ['벌써 밤이네! 밤에는 볼락이나 참문어처럼 밤에 움직이는 우산몬이 길에 나온대.', '깜깜하지? 밤바다 쪽에서 슴새가 둥지로 돌아오는 소리가 들려.', '밤이 깊었어. 숲길에서 ‘휘-’ 소리가 나면 호랑지빠귀일 거야.'],
  spring: ['봄이 왔어! 후투티가 날아오고, 섬괴불나무 흰 꽃이 피는 철이야.', '따뜻한 봄이야. 이맘때만 볼 수 있는 우산몬을 찾아봐!'],
  summer: ['여름이야! 참나리 주황 꽃이 피고, 된장잠자리가 바다를 건너와.', '햇볕이 뜨겁지? 낮에는 나비랑 꽃등에 우산몬이 많이 보여.'],
  autumn: ['가을이네. 해국이 바닷가 바위틈에 연보라 꽃을 피웠어.', '바람이 선선해졌지? 되새 무리가 찾아오는 철이야.'],
  winter: ['겨울이야, 춥지? 동백꽃이 피고 살 오른 방어가 내려온대.', '눈이 왔네! 개똥지빠귀가 겨울을 나러 왔대.']
};
export function timeTalk(name, season, night) {
  const list = night ? TALK.night : TALK[season] || TALK.summer, h = [...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return list[h % list.length];
}

const walksHere = map => map.kind === 'route' || map.kind === 'meadow';
export function createRoamers(rng = Math.random, when = () => null) {
  let list = [], mapId = null, nextSpawn = 0, seq = 0, pausedAt = 0, pausedTotal = 0, friends = [];
  // 멈춘 시간을 뺀 시계: 결투·대화 중에는 흐르지 않아요
  const T = now => (pausedAt || now) - pausedTotal;
  const between = ([a, b]) => a + rng() * (b - a);
  const near = (a, b, r) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= r;
  const isFree = (map, x, y, others, player, self = null, hab = 'land') =>
    habitatTile(map, x, y, hab) && (hab === 'sea' || hab === 'surface' ? !others.some(n => n.x === x && n.y === y) : !blocked(map, x, y, others)) && !map.exits.has(`${x},${y}`) &&
    !list.some(r => r !== self && ((r.x === x && r.y === y) || (r.fromX === x && r.fromY === y && r.moving))) &&
    !(player && ((player.x === x && player.y === y) || (player.toX === x && player.toY === y)));

  function spawn(map, others, player, t, fixed = null) { const now = t;
    const keep = Object.values(map.spawns || {});
    // 사는 곳마다 빈자리를 찾아, 자리가 있는 우산몬만 골라요(물이 없는 길엔 물고기가 안 나와요)
    const spotsFor = hab => { const out = []; for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      if (!isFree(map, x, y, others, player, null, hab)) continue;
      if (player && near({ x, y }, player, fixed ? 3 : 5)) continue; // 플레이어 눈앞에서 갑자기 생기지 않게
      if (keep.some(s => near({ x, y }, s, 2))) continue;        // 길 입구는 비워 둬요
      out.push({ x, y });
    } return out; };
    const byHab = { land: spotsFor('land'), sea: spotsFor('sea'), shore: spotsFor('shore'), surface: spotsFor('surface') };
    const pool = (fixed ? [fixed] : roamerPool(map.zone, when())).filter(id => byHab[habitat(id)].length || fixed);
    if (!pool.length) return null;
    const species = pool[Math.floor(rng() * pool.length)]; let spots = byHab[habitat(species)].length ? byHab[habitat(species)] : byHab.land;
    if ((habitat(species) === 'sea' || habitat(species) === 'surface') && map.shallow) { const near = spots.filter(p => map.shallow.has(`${p.x},${p.y}`)); if (near.length && rng() < .5) spots = near; } // 절반은 물가 가까이, 절반은 깊은 바닷속
    if (!spots.length) return null;
    const p = spots[Math.floor(rng() * spots.length)];
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
    // v0.69 때가 지난 우산몬(밤이 끝난 볼락 등)은 내게서 멀리 있을 때 조용히 떠나요. 빈자리는 지금 때에 맞는 우산몬이 채워요.
    if (map.kind === 'route') { const w = when(); const gone = list.filter(r => r.kind === 'wild' && !r.moving && !fitsNow(r.species, w) && !(player && near(r, player, 6))); if (gone.length) list = list.filter(r => !gone.includes(r)); }
    for (const r of list) {
      if (r.moving && now - r.moving.t0 >= STEP_MS) r.moving = null;
      if (r.moving || now < r.nextMove) continue;
      const order = DIRS.slice().sort(() => rng() - .5);
      const step = order.find(([dx, dy]) => isFree(map, r.x + dx, r.y + dy, others, player, r, habitat(r.species)));
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
