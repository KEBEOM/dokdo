// v0.79 HD-2D 하나로 · 에셋팩 그림 판 · 땅 재질 · 나무
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const png = f => { const b = fs.readFileSync(new URL(`assets/${f}.png`, dist)); assert.equal(b.toString('ascii', 1, 4), 'PNG', f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const { HD2D_ATLAS, HD2D_TEXTURES, HD2D_META } = await import('../dist/hd2d-atlas.js');
const { HD2D_GROUND, HD2D_TREES } = await import('../dist/hd2d-nature.js');
const { hd2dCard, hd2dMap, cardFrame } = await import('../dist/gl3d.js');
const { MAP_BY_ID } = await import('../dist/maps.js');
const { createMap } = await import('../dist/world.js');

// 그림 모음: 영문 이름(한 파일 판에 들어가요) · 자리가 그림 안 · 파일 크기와 같아요
for (const [key, w, h] of [[HD2D_ATLAS.key, HD2D_ATLAS.width, HD2D_ATLAS.height], [HD2D_GROUND.key, 512, 512], [HD2D_GROUND.noise, 128, 128], [HD2D_TREES.key, HD2D_TREES.width, HD2D_TREES.height]]) {
  assert.match(key, /^scenery\/[a-z0-9-]+$/); const d = png(key); assert.deepEqual([d.w, d.h], [w, h], key);
}
for (const [k, [x, y, w, h]] of [...Object.entries(HD2D_ATLAS.frames), ...Object.entries(HD2D_TREES.frames)]) {
  assert.match(k, /^[a-z0-9_]+$/); assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0, k);
  const W = HD2D_ATLAS.frames[k] ? HD2D_ATLAS.width : HD2D_TREES.width, H = HD2D_ATLAS.frames[k] ? HD2D_ATLAS.height : HD2D_TREES.height; assert.ok(x + w <= W && y + h <= H, `${k} inside its sheet`);
}
assert.ok(Object.keys(HD2D_ATLAS.frames).length >= 60 && Object.keys(HD2D_META).length === Object.keys(HD2D_ATLAS.frames).length);
for (const k of Object.values(HD2D_TEXTURES)) { const d = png(k); assert.ok([64, 128, 256].includes(d.w) && d.w === d.h, `${k} is a power-of-two square (repeats in WebGL)`); }
assert.deepEqual(Object.values(HD2D_GROUND.slots).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'ten ground materials'); assert.equal(HD2D_GROUND.cols * HD2D_GROUND.rows, 16);
for (const sp of ['pine', 'broad', 'camellia']) assert.ok(Object.keys(HD2D_TREES.frames).some(k => k.startsWith(sp)), sp);
for (const k of ['fl_hydrangea', 'fl_wild', 'fl_grass']) assert.ok(HD2D_ATLAS.frames[k], k);
// 계절 색: 나무·땅 재질도 바뀌어요
const season = fs.readFileSync(new URL('season.js', dist), 'utf8'); assert.match(season, /hd2d-trees\|hd2d-ground/);

// 모든 바깥 지도: 집·가게·터미널·이야기 건물·독도 건물이 모두 그림 판(건물 칸 폭에 맞춘 크기)
for (const id of Object.keys(MAP_BY_ID).filter(k => !k.includes('/'))) {
  const m = createMap(id); assert.ok(hd2dMap(m), id);
  for (const b of [...m.buildings, ...(m.structures || [])]) { const k = hd2dCard(m, b), f = cardFrame(k); assert.ok(f, `${id} ${b.kind} has a card`); assert.ok(f[2] >= b.w * 32 && f[2] <= b.w * 32 + 56, `${id} ${b.kind}: card ${f[2]} fits ${b.w} tiles`); }
}
assert.equal(hd2dMap(createMap('town0/home/1')), false, 'rooms keep their own floor art');
const t0 = createMap('town0');
for (const s of t0.structures) assert.ok(hd2dCard(t0, s) && cardFrame(hd2dCard(t0, s)), `${s.name} has a card`);
assert.equal(hd2dCard(t0, t0.structures.find(s => s.kind === 'terminal')), 'ul_terminal');
assert.equal(hd2dCard(createMap('town1'), createMap('town1').buildings.find(b => b.kind === 'lab')), 'story_dd_lab', 'v0.82 동도 연구소는 이야기 시설 그림(실제 등대와 섞지 않아요)');
assert.equal(hd2dCard(createMap('town3'), createMap('town3').buildings.find(b => b.kind === 'home')), 'story_sd_home', '서도의 집');
// 충돌·이야기 자리는 그대로: 그림 판은 칸을 막지 않아요(건물 칸 수 = 막힌 건물 칸)
assert.equal(t0.structures.reduce((n, s) => n + s.w * s.h, 0) + t0.buildings.reduce((n, b) => n + b.w * b.h, 0), [...t0].flat().filter(v => v === 5).length);

// 보기는 HD-2D 하나: 2D·3D 단추와 3D 방식 메뉴가 없어요. 품질 메뉴가 있어요
const html = fs.readFileSync(new URL('index.html', dist), 'utf8'), game = fs.readFileSync(new URL('game.js', dist), 'utf8');
assert.ok(!html.includes('viewBtn') && !game.includes('viewBtn') && !game.includes('glPick'));
assert.match(game, /id="gfxPick"/); assert.match(game, /dokdo-gq/);
// 줄 가운데 주석이 코드를 끄지 않아요(v0.75·v0.79에 있었던 실수)
for (const line of game.split('\n')) { const i = line.indexOf('// '); if (i < 0) continue; const after = line.slice(i); assert.ok(!/glCanvas\.style\.width\s*=/.test(after) && !/project\.(seen|box)\s*=/.test(after), `code hidden in a comment: ${line.slice(0, 120)}`); }
// 셰이더(그림 그리는 작은 프로그램) 줄 가운데 // 주석이 뒤 코드를 끄지 않아요(v0.80에 한 번 있었어요: WebGL이 꺼지고 2D로 그려졌어요)
{ const gsrc = fs.readFileSync(new URL('gl3d.js', dist), 'utf8'); for (const line of gsrc.split('\n')) { const i = line.indexOf('// '); if (i < 0) continue; const after = line.slice(i + 3); assert.ok(!/\breturn\b|gl_FragColor|gl_Position|discard;/.test(after), `shader code hidden in a comment: ${line.trim().slice(0, 120)}`); } }
console.log('v079 ok');
