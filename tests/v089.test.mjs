// v0.89 바닷속 생물 → 바다 생물 우산몬 · 서도 주민숙소(관찰용 외관)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const { seabedLayout, UW_INFO, UW_FISH, UW_BOTTOM, UW_MON_NOTE } = await import('../dist/seabed.js');
const { createMap, blocked } = await import('../dist/world.js');
const { MAPS } = await import('../dist/maps.js');
const { getSpecies } = await import('../dist/data.js');
// 바닷속 생물 그림(성게·소라·게·문어·물고기 떼·볼락·방어)은 쓰지 않고, 그 자리에 바다 생물 우산몬
const OLD = /^(sea_urchin|crab_|octopus|fish_school|rockfish|yellowtail)/;
let mons = 0, fish = 0; const kinds = new Set();
for (const d of MAPS.filter(m => m.kind !== 'room')) { const L = seabedLayout(createMap(d.id));
  for (const it of L.items) { assert.ok(!OLD.test(it.id), `${d.id}: ${it.id}`); if (it.mon) { mons++; kinds.add(it.mon); assert.ok(UW_BOTTOM.includes(it.mon), `${it.mon} 바닥 생물`); } }
  for (const f of L.fish) { assert.ok(f.mon && UW_FISH.includes(f.mon), `${d.id} 물고기 우산몬`); fish++; kinds.add(f.mon); } }
for (const id of [...UW_FISH, ...UW_BOTTOM]) { const sp = getSpecies(id); assert.ok(sp && sp.area === '바다' && !sp.legendary, `${id} 바다 생물 우산몬`); }
assert.ok(!UW_BOTTOM.some(id => [63, 64, 65].includes(id)), '바닷말 우산몬(미역·감태·대황)은 넣지 않고 바다숲 그림은 그대로');
assert.ok(mons > 200 && fish > 30 && kinds.size >= 25, `바닥 우산몬 ${mons} · 물고기 우산몬 ${fish} · ${kinds.size}종`);
assert.deepEqual(Object.keys(UW_INFO).sort(), ['algae', 'cave', 'kelp', 'pebbles', 'rock', 'shell'], '살아 있는 것 설명은 우산몬 쪽으로');
assert.match(UW_MON_NOTE[58], /갯녹음/); assert.match(UW_MON_NOTE[53], /해녀/);
const game = readFileSync(new URL('game.js', dist), 'utf8'), gl3 = readFileSync(new URL('gl3d.js', dist), 'utf8');
assert.ok(/function uwMonInfo/.test(game) && /싸우지 않아요/.test(game) && /state\.seen\.push\(s\.mon\)/.test(game), '살펴보면 도감에 본 우산몬으로');
assert.ok(/function uwMonAtlas/.test(gl3) && /\[scene\.cards\.mon, uwMon\?\.c\]/.test(gl3) && /uwMon\.frames\[fsh\.mon\]/.test(gl3), '바닷속 우산몬 그림 판 · 물고기 우산몬');
// 서도 주민숙소: 선착장 옆 바닷가(땅을 조금 넓힘) · 들어가는 문 없이 관찰만
{ const m = createMap('town3'), o = m.parsed.objects.find(o => o.name === '서도 주민숙소'); assert.ok(o && o.type === 'landmark' && o.region === 'seodo_residence');
  for (let y = o.rock[1]; y <= o.rock[3]; y++) for (let x = o.rock[0]; x <= o.rock[2]; x++) { assert.notEqual(m[y][x], 0, '땅 위'); assert.ok(blocked(m, x, y)); }
  assert.ok(!blocked(m, o.x, o.y + 1) && m[o.y + 1][o.x] === 6, '선착장에서 살펴봐요'); assert.ok(/들어갈 수 없어요/.test(o.lines.join(''))); }
console.log(`PASS v0.89 바닷속 우산몬: 바닥 ${mons} · 물고기 ${fish} · ${kinds.size}종 · 서도 주민숙소`);
