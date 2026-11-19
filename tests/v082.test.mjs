// v0.82 「독도 탐험대 v0.81 에셋 팩」: 이야기 건물 12 · 식물 10 · 실내 재질 20 · 바위 지명 4 · 동도 선착장
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const { STORY_ATLAS, STORY_META, INTERIOR_HD } = await import('../dist/story-atlas.js');
const { GLB_MODELS } = await import('../dist/glb-models.js');
const { hd2dCard, cardFrame } = await import('../dist/gl3d.js');
const { createMap } = await import('../dist/world.js');
const { MAP_BY_ID } = await import('../dist/maps.js');
const png = k => { const b = fs.readFileSync(new URL(`assets/${k}.png`, dist)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
assert.deepEqual(png(STORY_ATLAS.key), [STORY_ATLAS.width, STORY_ATLAS.height]); assert.deepEqual(png(INTERIOR_HD.key), [160, 192]);
// 이야기 건물 12장: 최종 크기 + 1px 테두리, 모두 창작 시설
const story = Object.keys(STORY_ATLAS.frames).filter(k => k.startsWith('story_')); assert.equal(story.length, 12);
for (const k of story) { const [x, y, w, h] = STORY_ATLAS.frames[k]; assert.ok(x + w <= STORY_ATLAS.width && y + h <= STORY_ATLAS.height); assert.ok([178, 242].includes(w), `${k} ${w}`); assert.equal(STORY_META[k].fictional, true, `${k} is fictional`); }
// 식물: 다섯 가지 × 여름·가을
for (const f of ['haeguk', 'seomgirincho', 'ttangchaesongwha', 'eoksae', 'galdae']) for (const s of ['summer', 'autumn']) assert.ok(STORY_ATLAS.frames[`fl_${f}_${s}`], `${f} ${s}`);
// 실내: 네 종류 × (벽 3 · 벽 윗면 · 바닥), 벽은 32×48
for (const k of ['home', 'shop', 'lab', 'gym']) { for (const p of ['wall_plain', 'wall_window', 'wall_board']) assert.deepEqual(INTERIOR_HD.rects[`${k}_${p}`].slice(2), [32, 48]); for (const p of ['walltop', 'floor']) assert.deepEqual(INTERIOR_HD.rects[`${k}_${p}`].slice(2), [32, 32]); }
// 모든 이야기 건물이 섬에 맞는 그림(독도의 수호관·연구소·상점·집은 동도 dd · 서도 sd)
for (const id of Object.keys(MAP_BY_ID).filter(k => /^town\d$/.test(k))) { const m = createMap(id);
  for (const b of m.buildings) { const k = hd2dCard(m, b); assert.ok(k.startsWith('story_') && cardFrame(k), `${id} ${b.kind} → ${k}`); const isl = m.def.island === '울릉도' ? 'ul' : m.def.island === '동도' ? 'dd' : 'sd'; assert.ok(k.startsWith(`story_${isl}_`), `${id} ${b.kind} island ${k}`); } }
// GLB: 팩이 정한 지도·자리
for (const [id, map, anchor] of [['bochal', 'route4', [33.5, 21.5]], ['sangjanggun', 'route6', [27, 14.5]], ['hanbando', 'town2', [23.5, 10.5]], ['cheonjanggul', 'town1', [21, 15.5]], ['dongdo_pier', 'route0', [8.5, 21.5]]]) {
  assert.equal(GLB_MODELS[id].map, map); assert.deepEqual(GLB_MODELS[id].anchor, anchor); }
assert.ok(!GLB_MODELS.lighthouse, 'the real lighthouse is not used as a story lab');
// 선착장: 모델이 덮는 # 칸은 지도 그대로 걸을 수 있고, 출구(a <)·안내판(1·2)·몽돌(3) 칸도 그대로
const r0 = createMap('route0'); assert.ok(r0.exits.has('0,24')); assert.equal(r0[24][2], 6);
// 추정 표시: 바위 지명 말 걸기에 모양 확인 수준
const game = fs.readFileSync(new URL('game.js', dist), 'utf8'); assert.match(game, /보찰바위': '실제 지명 · 바위 모양은 추정/); assert.match(game, /지네바위': '실제 지명/); assert.match(game, /이야기 시설/);
console.log('v082 ok');
