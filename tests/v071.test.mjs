// v0.71: 얕은 물(땅에 맞닿은 물 한 칸)은 내가 걸어 들어가요 → 물속 우산몬에게 다가갈 수 있어요. 마을 사람은 물에 안 들어가요.
import assert from 'node:assert/strict';
const { createMap, blocked, pathfind } = await import('../dist/world.js');
const { MAPS, STARTER_MEADOW } = await import('../dist/maps.js');
const { habitatTile } = await import('../dist/roamers.js');
const K = (x, y) => `${x},${y}`;
for (const def of [...MAPS, STARTER_MEADOW]) {
  if (def.kind === 'room') continue; const map = createMap(def.id);
  for (const k of map.shallow) { const [x, y] = k.split(',').map(Number); assert.equal(map[y][x], 0); assert.ok(!blocked(map, x, y, [], true), `${def.id} ${k}: 나는 걸어 들어가요`); assert.ok(blocked(map, x, y, [], true, false), `${def.id} ${k}: 마을 사람은 못 들어가요`); }
  // 물고기가 사는 칸(얕은 물·깊은 물)은 모두 내가 들어갈 수 있어요(얕은 물은 걷고 깊은 물은 잠수)
  for (let y = 0; y < 30; y++) for (let x = 0; x < 42; x++) if (habitatTile(map, x, y, 'sea')) assert.ok(!blocked(map, x, y, [], true), `${def.id} ${K(x, y)}`);
}
// 초원 연못: 처음 자리에서 연못 속 물고기 자리까지 걸어갈 수 있어요
const meadow = createMap('meadow0'), s = meadow.spawns.a;
const fishSpot = [...meadow.shallow].map(k => k.split(',').map(Number)).find(([x, y]) => x > 28 && y < 9);
assert.ok(pathfind(meadow, s.x, s.y, fishSpot[0], fishSpot[1]).length > 0, '연못 속까지 걸어가요');
// 외부 링크 없음: 새 창으로 나가는 링크가 없어요
{ const fs = await import('node:fs'); for (const f of ['dist/game.js', 'dist/battle-ui.js', 'dist/index.html']) { const t = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'); assert.ok(!/target="_blank"|href="https?:/.test(t), `${f}: 외부 링크`); } }
// v0.72: 가마우지·아비는 물 위의 새(물속엔 없어요)
{ const { habitat } = await import('../dist/roamers.js'); for (const id of [79, 80, 81]) assert.equal(habitat(id), 'surface'); assert.equal(habitat(37), 'sea'); }
console.log('PASS: v0.71 wading into shallow water (player only), every fish spot reachable');
