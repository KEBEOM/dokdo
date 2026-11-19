// v0.84 문 표시: 들어가는 칸 = 그림 속 문 · 문 앞 발판 · 문 위 간판
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { createMap, doorColumns } = await import('../dist/world.js');
const { hd2dCard, cardFrame, CARD_DOOR_DX, DOOR_MAT } = await import('../dist/gl3d.js');
const T = 32;
// 그림 속 문 가운데(그림 왼쪽에서 px, 그림을 4배로 키워 눈으로 잰 값) — 그림이 바뀌면 이 표도 다시 재요
const PAINTED = { ul_house_a: 72.5, ul_house_b: 83.5, ul_house_c: 77, ul_shop_a: 103 };
let checked = 0;
for (const id of ['town0', 'town1', 'town2', 'town3', 'town4', 'town5', 'town6', 'town7']) {
  let m; try { m = createMap(id); } catch { continue; }
  for (const b of [...m.buildings, ...(m.structures || [])]) {
    const cols = doorColumns(b); assert.ok(cols.every(c => c >= b.x && c < b.x + b.w), `${id} ${b.name}: 문은 건물 아랫줄 안에`);
    const k = hd2dCard(m, b); if (!(k in PAINTED)) continue;
    const f = cardFrame(k), left = (b.x + b.w / 2) * T + (CARD_DOOR_DX[k] || 0) - f[2] / 2, painted = left + PAINTED[k], door = ((cols[0] + cols[cols.length - 1]) / 2) * T + 16;
    assert.ok(Math.abs(painted - door) <= 8, `${id} ${b.name}(${k}): 그림 속 문(${painted.toFixed(1)})과 들어가는 칸(${door})이 8px 안 (${(painted - door).toFixed(1)})`); checked++;
  }
}
assert.ok(checked >= 30, `도동 골목 집·가게 ${checked}채 확인`);
assert.deepEqual(doorColumns({ kind: 'house', x: 10, y: 5, w: 3, h: 3 }), [12], '집 3종은 오른쪽 칸이 문');
assert.deepEqual(doorColumns({ kind: 'gym', x: 10, y: 5, w: 7, h: 5 }), [13], '이야기 건물은 가운데');
assert.ok(DOOR_MAT.w >= 24 && DOOR_MAT.w <= 32, '발판은 문 폭 정도');
const game = readFileSync(new URL('../dist/game.js', import.meta.url), 'utf8'), css = readFileSync(new URL('../dist/style.css', import.meta.url), 'utf8');
assert.ok(/const doorCols = b => doorColumns\(b\)/.test(game), '들어가기·나오기·길 찾기가 같은 문 자리를 써요');
assert.ok(/enterable\(\) : \[\]\)\.map[\s\S]{0,240}lift: 44/.test(game), '간판은 집·가게·터미널까지 문 바로 위에');
assert.ok(/\.building-label \.door-ico/.test(css), '간판에 작은 도트 문 그림');
const gl3 = readFileSync(new URL('../dist/gl3d.js', import.meta.url), 'utf8');
assert.ok(/capH\.set\(k, map\[y\]\[x\] === 0 \? 16/.test(gl3) && /rims\.push\(\[x, y, cl\.rim\.get\(k\)\]\)/.test(gl3), '바위 칸 · 절벽 끝 턱에 바위 덩어리');
assert.ok(/uCutG < \.5 \|\| vWP\.y > uCutY/.test(gl3), '앞 언덕(내 발보다 높은 땅)도 도트 무늬로 비쳐요');
assert.ok(!/\/\/[^\n`]*uCutG/.test(gl3.split('FS_MESH')[1]?.slice(0, 3000) || ''), '셰이더 줄 가운데 주석 없음');
// 막힌 칸 중 보이는 것이 없던 칸(절벽 끝 턱·바위 칸) 수
const { createMap: cm } = await import('../dist/world.js'); const r0 = cm('route0'); let caps = 0;
for (const k of r0.solid) { const [x, y] = k.split(',').map(Number); if (r0[y][x] !== 0 && (r0.rockTiles.has(k) || (r0.cliff.rim.has(k) && !r0.cliff.face.has(k) && !r0.cliff.stairs.has(k)))) caps++; }
assert.ok(caps > 200, `숫돌바위 길: 바위로 그릴 막힌 칸 ${caps}`);
// v0.84 1인칭 관찰 · 해돋이(동도 동쪽 끝)·해넘이(서도 서쪽 비탈) 보는 곳
const { MAPS } = await import('../dist/maps.js');
const spots = MAPS.flatMap(d => { const m = cm(d.id); return (m.parsed.objects || []).filter(o => o.view).map(o => ({ id: d.id, o, m })); });
assert.deepEqual(spots.map(s => `${s.id}:${s.o.view}`).sort(), ['town1:sunrise', 'town7:sunset'], '해돋이·해넘이 보는 곳 두 군데');
for (const { o, m } of spots) { const east = o.view === 'sunrise'; let sea = 0; for (let k = 1; k <= 4; k++) if (m[o.y]?.[o.x + (east ? k : -k)] === 0 || m[o.y]?.[o.x + (east ? k : -k)] === undefined) sea++; assert.ok(sea >= 1, `${o.name}: ${east ? '동' : '서'}쪽이 바다`); }
assert.ok(/export function fpCamera/.test(gl3) && /if \(n\.player && V\.fp\) continue/.test(gl3), '1인칭 카메라 · 내 몸은 안 그려요');
assert.ok(/startFirstPerson/.test(game) && /'🌅 해돋이 보기'/.test(game) && /\|\| !!fp;/.test(game), '말을 다 들으면 1인칭 단추 · 1인칭 중엔 걷지 않아요');
console.log(`PASS v0.84 doors: ${checked} painted doors line up with the door tile, mats, signs above doors`);
