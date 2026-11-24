// v0.89 서도 주민숙소(관찰용 외관) · (바닷속 우산몬은 v0.93부터 장식이 아니라 야생 우산몬 — v093.test.mjs)
import assert from 'node:assert/strict';
const { createMap, blocked } = await import('../dist/world.js');
{ const m = createMap('town3'), o = m.parsed.objects.find(o => o.name === '서도 주민숙소'); assert.ok(o && o.type === 'landmark' && o.region === 'seodo_residence');
  for (let y = o.rock[1]; y <= o.rock[3]; y++) for (let x = o.rock[0]; x <= o.rock[2]; x++) { assert.notEqual(m[y][x], 0, '땅 위'); assert.ok(blocked(m, x, y)); }
  assert.ok(!blocked(m, o.x, o.y + 1) && m[o.y + 1][o.x] === 6, '선착장에서 살펴봐요'); assert.ok(/들어갈 수 없어요/.test(o.lines.join(''))); }
console.log('PASS v0.89 서도 주민숙소');
