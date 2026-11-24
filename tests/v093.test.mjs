// v0.93 바닷속 우산몬은 장식이 아니라 데려갈 수 있는 야생 우산몬(잠수하면 깊은 물에 나와요 · 결투 → 정화·동료)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const { createRoamers, deepPool, deepCount, habitatTile } = await import('../dist/roamers.js');
const { seabedLayout } = await import('../dist/seabed.js');
const { createMap, blocked } = await import('../dist/world.js');
const { MAPS } = await import('../dist/maps.js');
const { MONSTERS } = await import('../dist/data.js');
// 바닷속 그림에는 장식 우산몬·장식 물고기가 없어요
for (const d of MAPS.filter(m => m.kind !== 'room')) { const L = seabedLayout(createMap(d.id)); assert.ok(!L.items.some(i => i.mon) && L.fish.length === 0, `${d.id}: 장식 우산몬 없음`); }
// 바닷속 우산몬 후보: 바다 생물 우산몬(갯바위 우산몬·새·전설 빼고)
for (const z of [0, 2, 4, 6, 7]) { const pool = deepPool(z); assert.ok(pool.length >= 4, `${z}장 후보 ${pool.length}`); for (const id of pool) { const m = MONSTERS.find(m => m.id === id); assert.ok(id >= 34 && id <= 66 && ![54, 55, 56].includes(id) && !m.legendary, `${id}`); } }
// 잠수하면 깊은 물에 나오고(길·마을 모두), 물 위로 올라오면 보이지도 부딪히지도 않아요
let rng = 1; const rand = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
let total = 0;
for (const id of ['route0', 'route2', 'town0', 'town3', 'route5']) {
  const m = createMap(id), want = deepCount(m); if (!want) continue; const R = createRoamers(rand), me = { x: m.spawns.a.x, y: m.spawns.a.y };
  R.sync(m, [], me, 0); R.update(m, [], me, 10, false); assert.equal(R.snapshot(10).filter(r => r.deep).length, 0, `${id}: 물 위에선 바닷속 우산몬이 없어요`);
  m.diving = true; R.update(m, [], me, 20, false); const deep = R.list.filter(r => r.deep); assert.equal(deep.length, want, `${id}: 잠수하면 ${want}마리`); total += deep.length;
  for (const r of deep) { assert.ok(habitatTile(m, r.x, r.y, 'deep') && !m.shallow.has(`${r.x},${r.y}`) && !blocked(m, r.x, r.y), `${id} ${r.name} 깊은 물`); assert.equal(r.kind, 'wild'); assert.match(r.name, /^사나워진 /); assert.ok(R.at(r.x, r.y), '잠수 중엔 부딪혀요(결투)'); }
  for (let t = 30; t < 30000; t += 450) R.update(m, [], me, t, false); for (const r of R.list.filter(r => r.deep)) assert.ok(habitatTile(m, r.x, r.y, 'deep'), '헤엄쳐도 깊은 물 안에서만');
  m.diving = false; R.update(m, [], me, 40000, false); const r0 = R.list.find(r => r.deep); if (r0) assert.equal(R.at(r0.x, r0.y), null, '물 위에선 바닷속 우산몬과 부딪히지 않아요'); assert.equal(R.snapshot(40000).filter(r => r.deep).length, 0);
}
assert.ok(total >= 12, `바닷속 야생 우산몬 ${total}마리`);
const game = readFileSync(new URL('game.js', dist), 'utf8');
assert.ok(!/uwMonInfo|uwFish2D/.test(game) && /startBattle\('wild', r\.species, \{ roamer: r\.uid \}\); \} \} \} \/\/ v0\.93/.test(game), '장식 살펴보기는 없고, 바로 밑 우산몬과는 잠수하자마자 만나요');
console.log(`PASS v0.93 바닷속 야생 우산몬 ${total}마리(5개 지도) · 장식 없음`);
