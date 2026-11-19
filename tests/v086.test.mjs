// v0.86 독도 지명 고증: 국토지리정보원 고시 좌표에 맞춘 바위 자리·이름·세계 지도
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { createMap, blocked } = await import('../dist/world.js');
const { MAPS } = await import('../dist/maps.js');
const game = readFileSync(new URL('../dist/game.js', import.meta.url), 'utf8'), legends = readFileSync(new URL('../dist/legends.js', import.meta.url), 'utf8'), maps = readFileSync(new URL('../dist/maps.js', import.meta.url), 'utf8');
const lm = (id, name) => createMap(id).parsed.objects.find(o => o.type === 'landmark' && o.name === name);
// 숫돌바위: 언덕 위가 아니라 동도 선착장 옆 바다. 바위 칸은 물이고 막혀요, 말 걸기는 선착장 난간에서
{ const m = createMap('route0'), o = lm('route0', '숫돌바위'); assert.ok(o?.rock, '숫돌바위 바다 자리');
  for (let y = o.rock[1]; y <= o.rock[3]; y++) for (let x = o.rock[0]; x <= o.rock[2]; x++) { assert.equal(m[y][x], 0, `숫돌바위 ${x},${y}는 바다`); assert.ok(blocked(m, x, y), '바위라 헤엄쳐 지나가지 못해요'); }
  assert.ok(o.x >= 2 && o.x <= 20 && o.y >= 15 && o.y <= 28, '선착장 둘레'); assert.ok(!blocked(m, o.x, o.y + 1), '선착장 위에서 말 걸어요');
  assert.ok(!m.rockTiles.has('34,15'), '예전 언덕 위 바위 칸은 없어요'); }
// 삼형제굴바위: 서도 북동쪽 → 촛대바위 해안 북쪽 바다 · 그 자리 길은 군함바위 해안
{ const o = lm('route3', '삼형제굴바위'), m = createMap('route3'); assert.ok(o?.rock && o.rock[1] <= 4, '촛대바위 해안 북쪽 바다'); assert.equal(m[o.rock[1]][o.rock[0]], 0);
  assert.equal(MAPS.find(d => d.id === 'route5').name, '군함바위 해안'); assert.ok(lm('route5', '군함바위'), '군함바위');
  assert.ok(!lm('route5', '삼형제굴바위'), '서쪽 길에는 삼형제굴바위가 없어요'); }
// 상장군바위(고시되지 않은 이름)는 없어요 → 물골 오르막 · 지네바위
assert.ok(!/상장군/.test(maps + legends + game.replace(/sangjanggun/g, '')), '상장군바위라는 이름은 쓰지 않아요');
assert.equal(MAPS.find(d => d.id === 'route6').name, '물골 오르막'); { const o = lm('route6', '지네바위'); assert.ok(o?.rock && o.rock[0] <= 3, '지네바위: 북서쪽 바다'); }
// 보찰바위: 서도 남서쪽 끝 → 갯바위 길 남서쪽 바다
{ const o = lm('route4', '보찰바위'); assert.ok(o.rock && o.rock[2] < 10 && o.rock[1] >= 18, '보찰바위 남서쪽'); }
// 세계 지도: 고시 좌표 26곳 · 방향(동도는 서도 동쪽, 가제바위는 가장 북쪽, 보찰바위는 가장 서남쪽)
const names = [...game.matchAll(/\['([가-힣]+)', (-?[\d.]+), (-?[\d.]+)\]/g)].map(m => [m[1], +m[2], +m[3]]); const at = Object.fromEntries(names.map(([n, lo, la]) => [n, [lo, la]]));
assert.ok(names.length >= 26, `고시 지명 ${names.length}`);
assert.deepEqual(at['숫돌바위'], [24.3, 1.4]); assert.deepEqual(at['대한봉'], [14.6, 10.6]); assert.deepEqual(at['우산봉'], [30.4, 6.8]);
assert.ok(at['우산봉'][0] > at['대한봉'][0], '동도는 서도 동쪽'); assert.ok(at['큰가제바위'][1] === Math.max(...names.map(n => n[2])), '가제바위가 가장 북쪽');
assert.ok(at['보찰바위'][0] <= Math.min(...names.map(n => n[1])) + .2, '보찰바위가 가장 서쪽');
assert.ok(/route5: WM_AT\['군함바위'\]/.test(game) && /route0: WM_AT\['숫돌바위'\]/.test(game), '길 표시는 대표 바위 자리에');
console.log(`PASS v0.86 지명 고증: 숫돌바위 선착장 옆 바다 · 삼형제굴바위 서도 북동쪽 · 군함바위 해안 · 지네바위 · 보찰바위 남서쪽 · 세계 지도 고시 좌표 ${names.length}곳`);
