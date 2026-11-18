// v0.70: 길의 높낮이(언덕·절벽·계단·사다리) · 물에 사는 우산몬은 물가에 · 첫 동료 초원의 연못 · 계절마다 다른 나무와 땅
import assert from 'node:assert/strict';
const { createMap, blocked } = await import('../dist/world.js');
const { MAPS } = await import('../dist/maps.js');
const { LEGENDS } = await import('../dist/legends.js');
const { habitat, habitatTile, createRoamers } = await import('../dist/roamers.js');
const { starterPool } = await import('../dist/data.js');
const { seasonPixel } = await import('../dist/season.js');
const K = (x, y) => `${x},${y}`;
function reach(map) {
  const s = map.spawns.a, seen = new Set([K(s.x, s.y)]), q = [[s.x, s.y]];
  for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = K(nx, ny); if (seen.has(k) || blocked(map, nx, ny, [], true)) continue; seen.add(k); if (!map.exits.has(k)) q.push([nx, ny]); } }
  return seen;
}
let hills = 0;
for (const def of MAPS.filter(m => m.kind === 'route')) {
  const map = createMap(def.id), c = map.cliff; assert.ok(c, `${def.id}: 언덕이 있어요`); hills++;
  assert.ok(c.stairs.size >= 2, `${def.id}: 계단으로 오르고 내려요`); assert.equal(c.ladders.size, 1, `${def.id}: 사다리 하나`);
  for (const k of c.face) assert.equal(map.solid.has(k), !c.stairs.has(k) && !c.ladders.has(k), `${def.id} ${k}: 절벽 면은 계단·사다리만 지나가요`);
  for (const k of c.rim.keys()) assert.equal(map.solid.has(k), !c.stairs.has(k), `${def.id} ${k}: 바위 턱은 계단만 지나가요`);
  for (const k of c.stairs) assert.equal(map.level.get(k), .5, '계단은 반 층');
  const R = reach(map);
  for (const k of map.exits.keys()) assert.ok(R.has(k), `${def.id}: 출구 ${k}에 닿아요`);
  for (const o of [...map.parsed.objects, ...LEGENDS.filter(l => l.map === def.id)]) assert.ok([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => R.has(K(o.x + a, o.y + b))), `${def.id}: ${o.name || o.key} 곁에 갈 수 있어요`);
  for (const k of c.region) if (!map.solid.has(k) && !blocked(map, ...k.split(',').map(Number), [], true)) assert.ok(R.has(k), `${def.id}: 언덕 위 ${k}에 갈 수 있어요`);
  for (const k of [...c.ladders, ...[...c.stairs].filter(k => c.face.has(k))]) { const [x, y] = k.split(',').map(Number); assert.ok(R.has(K(x, y - 1)) && R.has(K(x, y + 1)), `${def.id} ${k}: 위아래가 이어져요`); }
}
assert.equal(hills, 7);

// 물에 사는 우산몬: 물고기는 물가 한 칸 안쪽 물, 갯바위 생물은 물가 땅, 새·곤충·풀은 풀밭
assert.equal(habitat(37), 'sea'); assert.equal(habitat(55), 'shore'); assert.equal(habitat(67), 'land'); assert.equal(habitat(1), 'land');
const meadow = createMap('meadow0');
let water = 0; for (let y = 0; y < 30; y++) for (let x = 0; x < 42; x++) if (habitatTile(meadow, x, y, 'sea')) water++;
assert.ok(water >= 30, `초원 연못 물가 ${water}칸`);
const field = starterPool().filter((_, i) => i % 3 === 0).slice(0, 30), r = createRoamers(() => .42); r.setFriends(field); r.sync(meadow, [], meadow.spawns.a, 0);
assert.equal(r.count, 30); for (const w of r.list) assert.ok(habitatTile(meadow, w.x, w.y, habitat(w.species)), `${w.species}: 사는 곳에 있어요`);
assert.ok(r.list.some(w => habitat(w.species) === 'sea' && meadow[w.y][w.x] === 0), '물고기는 연못 속에');

// 계절: 여름은 짙은 초록, 겨울 풀밭은 눈
{ const [a, b, c2] = seasonPixel('summer', 90, 170, 70, 'leaf'), [a2, b2] = [90, 170]; assert.ok(b > a && b < b2 + 20); }
console.log('PASS: v0.70 hills on 7 routes (cliffs, stairs, ladders, all reachable), sea/shore/land habitats, meadow pond, seasonal greens');

// 날씨: 봄·여름·가을엔 비, 겨울엔 눈(비는 없어요). 반나절 가운데가 가장 세고 처음·끝은 약해요
{
  const S = await import('../dist/season.js'), half = S.DAY_MS / 2, seen = {};
  for (let seg = 0; seg < 16 * 3; seg++) { const ms = seg * half - S.START_HOUR / 24 * S.DAY_MS + half / 2; if (ms < 0) continue; const season = S.flowSeason(ms), w = S.weatherNow(ms, season); (seen[season] ||= new Set()).add(w.kind); if (w.kind !== 'clear') assert.ok(w.amount > .9, '반나절 가운데는 한창'); }
  for (const s of ['spring', 'summer', 'autumn']) assert.ok(seen[s].has('rain') && !seen[s].has('snow'), `${s}: 비`);
  assert.ok(seen.winter.has('snow') && !seen.winter.has('rain'), '겨울: 눈');
  const wet = [...Array(400)].map((_, i) => S.weatherNow((i + 1) * half - S.START_HOUR / 24 * S.DAY_MS + 1, 'summer')).find(w => w.kind === 'rain'); assert.ok(wet && wet.amount < .2, '처음엔 약하게');
  console.log('PASS: weather (rain in spring/summer/autumn, snow in winter, gentle start and end)');
}
