// v0.81 울릉도·독도 맵 에셋 팩 v1(GLB): 모델 데이터 · 표면 무늬 · 바위 지명 · 실내 벽 칸 확인
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const { GLB_MODELS, GLB_SURF, glbModel } = await import('../dist/glb-models.js');
const { createMap } = await import('../dist/world.js');
const need = ['sutdol', 'independence', 'candle', 'elephant', 'three_caves', 'tanggeon', 'stairs', 'railing', 'helipad', 'tetrapod', 'bochal', 'sangjanggun', 'hanbando', 'cheonjanggul', 'dongdo_pier'];
for (const id of need) {
  const m = glbModel(id); assert.ok(m, id); assert.equal(m.pos.length, m.n * 3); assert.equal(m.nrm.length, m.n * 3); assert.equal(m.col.length, m.n * 4); assert.equal(m.n % 3, 0, `${id}: whole triangles`);
  assert.ok(m.pos.every(Number.isFinite), `${id}: finite`); assert.ok(m.min[1] >= -1 && m.max[1] > m.min[1], `${id}: Y up`);
  for (let i = 0; i < m.n; i++) assert.ok(m.col[i * 4 + 3] <= 5, 'material class');
}
assert.ok(Object.keys(GLB_MODELS).every(k => need.includes(k)), 'only models the game places');
// 표면 무늬 4칸(층리 절벽·응회암·콘크리트·황토 바위)
const b = fs.readFileSync(new URL(`assets/${GLB_SURF}.png`, dist)); assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [320, 64]); assert.match(GLB_SURF, /^scenery\/[a-z0-9-]+$/);
// 바위 지명이 지도에 있어요(말 걸기 자리는 지도 칸 그대로)
for (const [id, name] of [['route0', '숫돌바위'], ['route2', '독립문바위'], ['route3', '촛대바위'], ['town5', '코끼리바위'], ['route5', '삼형제굴바위']]) assert.ok(createMap(id).parsed.objects.some(o => o.type === 'landmark' && o.name === name), `${id} ${name}`);
// 지형은 덮어쓰지 않아요: 지도 크기·출구·막힌 칸 수가 v0.80과 같아요
const KEEP = { route0: [52, 34], town0: [72, 58], town3: [42, 30] };
for (const [id, [w, h]] of Object.entries(KEEP)) { const m = createMap(id); assert.deepEqual([m[0].length, m.length], [w, h]); }
// 실내 GLB 10종 × 80곳: 벽 칸이 지금 건물 안과 같아요(import-glb-pack.py가 확인한 표)
const doc = fs.readFileSync(new URL('../docs/GLB-적용.md', import.meta.url), 'utf8');
const rows = [...doc.matchAll(/^\| (\w+_\d) \| [^|]+ \| (\d+) \| (\d+) \|$/gm)]; assert.equal(rows.length, 10); assert.ok(rows.every(r => r[2] === r[3] && r[2] === '8'), 'all 80 rooms match');
// 셰이더·HD-2D 그리기에 GLB 그리기가 있어요
const gsrc = fs.readFileSync(new URL('gl3d.js', dist), 'utf8'); assert.match(gsrc, /VS_MODEL/); assert.match(gsrc, /hideLandmarks/);
console.log('v081 ok');
