// v0.88 「가구·표지판·해안 벽 확장팩」 + 「울릉도·독도 지상·수중 v2」 적용
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dist = new URL('../dist/', import.meta.url);
const { FURN_ATLAS, FURN_META, REGION_ATLAS, UW_WALLS } = await import('../dist/furniture-atlas.js');
const { furnitureGroups, furnitureSprite, roomKind, pieceSize, PACK_FURNITURE, MAX_H, CHARACTER_PX } = await import('../dist/furniture.js');
const { signSprite } = await import('../dist/props.js');
const { seabedLayout, UW_INFO, UW_DISABLED, uwGroup } = await import('../dist/seabed.js');
const { createMap, blocked } = await import('../dist/world.js');
const { MAPS } = await import('../dist/maps.js');
const { ROOM_DEFS } = await import('../dist/interiors.js');

// 그림 파일: 가구 16 · 빈 표지판 4 · 소품 4 / 지역 12 / 바닷속 벽 재질 2장
assert.equal(Object.keys(FURN_ATLAS.frames).length, 24); assert.equal(Object.keys(REGION_ATLAS.frames).length, 12);
for (const k of [FURN_ATLAS.key, REGION_ATLAS.key, UW_WALLS.key]) assert.ok(existsSync(new URL(`assets/${k}.png`, dist)), k);
for (const [id, f] of Object.entries(FURN_ATLAS.frames)) { const [w, h] = FURN_META[id].size; assert.deepEqual([f[2], f[3]], [w + 2, h + 2], `${id}: 최종 크기 + 1px 테두리`); }

// 가구: 모든 방에서 같은 가구 칸을 묶어 한 장씩 · 덩어리마다 그리는 칸은 하나 · 막힌 칸은 그대로
let pieces = 0; const used = new Set();
for (const d of ROOM_DEFS) {
  const m = createMap(d.id), G = furnitureGroups(m), solidBefore = [...m.solid].sort().join('|');
  for (const [k, c] of G) { const [x, y] = k.split(',').map(Number);
    assert.ok(m.decor.some(e => e.x === x && e.y === y && PACK_FURNITURE.has(e.kind)) || m.parsed.objects.some(o => o.x === x && o.y === y && PACK_FURNITURE.has(o.furniture)), `${d.id} ${k}: 가구 칸만`);
    if (c.draw) { pieces++; used.add(c.draw.sprite); assert.ok(FURN_ATLAS.frames[c.draw.sprite]); const s = pieceSize(c.draw); assert.ok(s.w <= c.draw.w * 32 + 21, `${d.id} ${c.draw.sprite}: 옆 칸으로 많이 삐져나오지 않아요`); assert.ok(s.h <= (MAX_H[c.draw.sprite] || CHARACTER_PX) && s.h <= CHARACTER_PX * 1.25, `${d.id} ${c.draw.sprite} 키 ${s.h}px: 사람(48px)보다 거대하지 않아요`); }
    else assert.ok(G.get(c.at.join(','))?.draw, `${d.id} ${k}: 대표 칸이 있어요`); }
  assert.equal([...createMap(d.id).solid].sort().join('|'), solidBefore, '가구 그림이 막힌 칸을 바꾸지 않아요');
}
assert.ok(pieces > 300, `가구 ${pieces}장`); assert.ok(used.size >= 14, `쓰는 가구 그림 ${used.size}종: ${[...used].join(' ')}`);
// 방 종류마다 알맞은 가구(상점 계산대 · 수호관 접수대 · 연구소 책상)
for (const k of Object.keys(FURN_ATLAS.frames)) if (!k.startsWith('sign_')) assert.ok(MAX_H[k] && (MAX_H[k] <= CHARACTER_PX * 1.25 || k === 'prop_lamp'), `${k} 키 상한`);
assert.equal(furnitureSprite('counter', 'shop'), 'shop_counter'); assert.equal(furnitureSprite('counter', 'gym'), 'gym_reception'); assert.equal(furnitureSprite('desk', 'lab', { w: 2 }), 'lab_desk'); assert.equal(furnitureSprite('shelf', 'lab', { w: 2, books: true }), 'home_bookshelf');
assert.equal(roomKind(createMap('town0/shop/1')), 'shop'); assert.equal(roomKind(createMap(ROOM_DEFS.find(d => d.building.startsWith('house')).id)), 'home');
{ const m = createMap('town0/shop/1'), G = furnitureGroups(m); const ctr = [17, 18, 19, 20].map(x => G.get(`${x},12`)), drawn = ctr.filter(c => c.draw); assert.ok(drawn.length >= 2 && drawn.every(c => c.draw.sprite === 'shop_counter'), '네 칸 계산대는 늘리지 않고 여러 장');
  const bed = G.get('26,15'); assert.ok(bed.draw && bed.draw.h === 2 && G.get('26,14').skip, '위아래 두 칸 침대(쉼 침대 칸 포함)는 한 장'); }
// 안내판: 빈 판 + 이름표(판 면에 글자를 그리지 않아요)
assert.equal(signSprite('길 안내판'), 'sign_direction'); assert.equal(signSprite('작은 부두 안내판'), 'sign_harbor'); assert.equal(signSprite('천장굴 안내판'), 'sign_information'); assert.equal(signSprite('갯바위 안내판'), 'sign_warning');
const game = readFileSync(new URL('game.js', dist), 'utf8'), gl3 = readFileSync(new URL('gl3d.js', dist), 'utf8'), css = readFileSync(new URL('style.css', dist), 'utf8');
assert.ok(/'sign-label'/.test(game) && /n\.sign \? n === signNear/.test(game) && /\.sign-label\{/.test(css), '가까운 안내판 하나에 이름표');
// 바닷속: v2 안내 — 확인 못 한 그림(연산호·전복·가리비·육각 기둥)은 기본 배치에서 빼고, 이름은 일반 이름
assert.equal(UW_DISABLED.size, 7);
for (const d of MAPS.filter(m => m.kind !== 'room')) for (const it of seabedLayout(createMap(d.id)).items) assert.ok(!UW_DISABLED.has(it.id), `${d.id}: ${it.id}`);
assert.ok(!UW_INFO.coral && !UW_INFO.columns && !UW_INFO.abalone, '확인 못 한 무리는 설명도 없어요');
assert.equal(UW_INFO.rock.name, '수중 바위'); assert.ok(!/현무암|주상절리/.test(JSON.stringify(UW_INFO)), '모든 바위를 현무암·주상절리로 말하지 않아요');
assert.ok(/정하지 않았어요/.test(UW_INFO.kelp.lines.join('')) && !/대황·감태 같은 갈조류가 숲을/.test(UW_INFO.kelp.lines.join('')), '바닷말 그림의 종을 정하지 않아요');
assert.ok(/uwWall\('cliff'\)/.test(gl3) && /uwWall\('quay'\)/.test(gl3), '바닷속 안벽·암벽은 팩 재질');
// 실제 시설: 동도 등대는 관찰용 외관(문 없음 · 지명 칸만 막힘)
{ const m = createMap('town1'), o = m.parsed.objects.find(o => o.name === '독도 등대'); assert.ok(o && o.type === 'landmark' && o.region === 'dongdo_lighthouse' && !o.room);
  for (let y = o.rock[1]; y <= o.rock[3]; y++) for (let x = o.rock[0]; x <= o.rock[2]; x++) assert.ok(blocked(m, x, y)); assert.ok(!blocked(m, o.x, o.y + 1), '앞에서 살펴봐요');
  assert.ok(/1954년 8월/.test(o.lines.join('')) && /1998년 12월/.test(o.lines.join('')) && /들어갈 수 없어요/.test(o.lines.join(''))); }
assert.ok(/rg: true/.test(gl3) && /\[scene\.cards\.region, REGION_ATLAS\.key\]/.test(gl3), '지역 그림 판');
for (const f of ['game.js', 'gl3d.js', 'props.js', 'furniture.js', 'interior-art.js', 'seabed.js']) execFileSync(process.execPath, ['--check', new URL(f, dist).pathname]);
console.log(`PASS v0.88 가구 ${pieces}장(${used.size}종) · 안내판 4종 · 바닷속 벽 재질 · 동도 등대 관찰용 외관`);
