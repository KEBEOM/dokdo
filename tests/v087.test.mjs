// v0.87 바닷속: 「바닷속 HD-2D 에셋 v1」 바닥 타일·바다숲·생물·바위 지형·물고기
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const { UW_ATLAS, UW_FLOOR } = await import('../dist/uw-atlas.js');
const { seabedLayout, UW_INFO, uwGroup } = await import('../dist/seabed.js');
const { createMap, blocked } = await import('../dist/world.js');
const { MAPS } = await import('../dist/maps.js');
// 그림: 바닥 12장(32×32) · 판 그림(바다풀 10·바위 8·생물 13·물고기 5·물가 바위벽 12)
assert.equal(UW_FLOOR.ids.length, 12); assert.ok(existsSync(new URL('assets/scenery/uw-floor.png', dist)) && existsSync(new URL('assets/scenery/uw-atlas.png', dist)));
const cats = Object.values(UW_ATLAS.cat).reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {});
assert.deepEqual(cats, { cliff_edges: 12, landmarks: 8, flora: 10, seafloor_props: 13, marine_life: 5 }, JSON.stringify(cats));
for (const [k, [x, y, w, h]] of Object.entries(UW_ATLAS.frames)) assert.ok(x + w <= UW_ATLAS.width && y + h <= UW_ATLAS.height && w <= 140, `${k} 크기`);
assert.ok(UW_ATLAS.frames.kelp_tall_01[3] <= 64 && UW_ATLAS.frames.kelp_tall_01[3] >= 40, '바다풀 키는 캐릭터(48px)와 비슷하게');
// 지도마다: 같은 자리(다시 불러도 같음) · 물 칸에만 · 바위 지형은 바닥 닿는 칸만 막혀요(잠수했을 때만)
let total = 0;
for (const d of MAPS.filter(m => m.kind !== 'room')) {
  const m = createMap(d.id), L = seabedLayout(m), L2 = seabedLayout(createMap(d.id)); assert.equal(L, L2, '같은 지도는 같은 바닷속');
  for (const it of L.items) { assert.equal(m[it.y][it.x], 0, `${d.id} ${it.id} 물 칸`); if (it.mon) { assert.ok(it.mon >= 34 && it.mon <= 66, '바닷속 생물은 바다 생물 우산몬(v0.89)'); continue; } assert.ok(UW_ATLAS.frames[it.id], it.id); if (!it.edge) assert.ok(UW_INFO[uwGroup(it.id)], `${it.id} 설명`); }
  for (const k of L.solid) { const [x, y] = k.split(',').map(Number); assert.ok(!blocked(m, x, y) || m.solid.has(k) || m.hull.has(k), '물 위에선 막히지 않아요(배 칸 빼고)'); m.diving = true; assert.ok(blocked(m, x, y), '잠수하면 바위 바닥 칸은 막혀요'); m.diving = false; }
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m[0].length; x++) if (m[y][x] === 0) assert.ok(L.floor[y][x], '물 칸마다 바닥 타일'); else assert.equal(L.floor[y][x], null);
  total += L.items.length;
}
assert.ok(total > 300, `바닷속 판 ${total}개`);
const r0 = seabedLayout(createMap('route0')); assert.ok(r0.items.some(i => i.big) && r0.items.some(i => i.group === 'kelp'), '숫돌바위 길 바닷속: 바위 지형·바닷말 숲');
// 설명: 동해·독도 이야기와 이어지고, 검수 안내가 붙어요
assert.match(UW_INFO.kelp.lines.join(''), /갯녹음/); assert.match(UW_INFO.rock.lines.join(''), /해녀/); assert.match(UW_INFO.algae.lines.join(''), /미역바위/);
const game = readFileSync(new URL('game.js', dist), 'utf8'), gl3 = readFileSync(new URL('gl3d.js', dist), 'utf8');
assert.ok(/UW_NOTE/.test(game) && /seabedAhead\(\)/.test(game), 'E로 살펴보기');
assert.ok(/scene\.dive !== !!map\.diving/.test(gl3), '잠수하면 장면을 바닷속으로 다시 만들어요');
// 배: 헤엄쳐 배 위를 지나가지 않아요(작은 배·여객선 칸이 막혀요) · 바닷속엔 배와 사람이 보이지 않아요
for (const id of ['town0', 'route0', 'route2', 'town3']) { const m = createMap(id); for (const d of m.decor.filter(d => d.kind === 'boat' || d.kind === 'ferry')) { const [x, y] = d.kind === 'boat' ? [d.x, d.y] : [d.x, d.y + 4]; assert.ok(blocked(m, x, y), `${id} ${d.kind} 칸은 막혀요`); } }
assert.ok(/if \(d\.kind === 'ferry' && !map\.diving\)/.test(gl3) && /if \(map\.diving\) continue; \/\* v0\.87 바닷속엔 배가 없어요/.test(gl3), '바닷속엔 배를 그리지 않아요');
assert.ok(/!\(map\.diving && !n\.player && \(n\.actor \|\|/.test(gl3) && /map\.diving \? people\.filter\(n => !n\.actor\)/.test(game), '바닷속엔 사람을 그리지 않아요');
// 바닷속 장면: 물 위의 것(나무·건물 판·바위 지명 GLB·안내판) 없이 바닥·섬 밑동 바위벽·항구 콘크리트 안벽만
assert.ok(/function buildUnderwater/.test(gl3) && /if \(map\.diving && o\.hd2d && map\.kind !== 'room'\) return buildUnderwater/.test(gl3) && /models: null, hideStatic/.test(gl3), '바닷속 장면은 따로 만들어요');
{ const { uwBlock, uwQuay } = await import('../dist/seabed.js'); const r0 = createMap('route0'); assert.ok(uwQuay(r0, 5, 24) && uwBlock(r0, 5, 24), '선착장은 바닷속에서 콘크리트 안벽'); const sut = r0.parsed.objects.find(o => o.name === '숫돌바위'); assert.ok(uwBlock(r0, sut.rock[0], sut.rock[1]), '숫돌바위 자리는 바닷속에서 바위 밑동'); assert.ok(!uwBlock(r0, 8, 31) && r0.hull.has('8,31'), '여객선 칸은 바닷속에서 지나가요(배 밑)'); }
const { execFileSync } = await import('node:child_process'); for (const f of ['game.js', 'gl3d.js', 'battle-ui.js', 'terrain.js']) execFileSync(process.execPath, ['--check', new URL(f, dist).pathname]); // 줄 가운데 주석이 뒤 코드를 끄지 않았는지(문법 검사)
console.log(`PASS v0.87 바닷속: 바닥 12종 · 판 ${Object.keys(UW_ATLAS.frames).length}장 · 지도 판 ${total}개 · 살펴보기`);
