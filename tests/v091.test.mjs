// v0.91 잠수: 물 밖은 벽처럼(올라오기는 Q로만) · 잠수 중 야생·친구 우산몬과도 상호작용 · 지도 우산몬은 원래 도트 1:1 · HD-2D 정수 배율
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const { MONSTER_DOTS } = await import('../dist/monster-dots.js');
const { MONSTERS } = await import('../dist/data.js');
const { hdCamera } = await import('../dist/gl3d.js');
const game = readFileSync(new URL('game.js', dist), 'utf8'), world = readFileSync(new URL('world.js', dist), 'utf8'), gl3 = readFileSync(new URL('gl3d.js', dist), 'utf8');
// 물 밖은 벽: 걸음·자유 이동·길 따라가기 모두 diveWall로 막혀요(부딪히는 소리 + 안내), 안내(길 찾기)는 물 위로 올라온 뒤
assert.ok(/function diveWall\(x, y\) \{ return !!map\.diving && map\.kind !== 'room' && map\[y\]\?\.\[x\] !== 0; \}/.test(game));
assert.equal((game.match(/diveWall\(/g) || []).length >= 5, true, '걸음·자유 이동·길 따라가기에 모두');
assert.ok(/if \(map\.diving\) \{ toast\('잠수 중이에요/.test(game), '잠수 중 길 안내는 올라온 뒤');
// 잠수 중 상호작용: 야생·친구 우산몬(바로 앞이면 먼저), 바닥 우산몬은 둘레 한 칸, 물고기는 보이는 자리로도
assert.ok(/function diveMon\(\)/.test(game) && /swimmer\?\.ahead/.test(game) && /if \(!swimmer\) return; n = swimmer\.n;/.test(game));
assert.ok(/around\(i\)/.test(game) && /vy = p\.y - \(f\.lift \|\| 0\) \/ 32 \* 1\.4/.test(game));
// 지도용 우산몬 도트 그림: 107장 모두, 정수 배(512 그림과 98% 넘게 같은 칸 짐작) · 1:1로 그려요
const ids = new Set(MONSTERS.map(m => String(m.id).padStart(3, '0'))); for (const id of ids) assert.ok(MONSTER_DOTS.frames[id], `${id} 도트 그림`);
assert.equal(Object.keys(MONSTER_DOTS.frames).length, 107);
for (const [k, f] of Object.entries(MONSTER_DOTS.frames)) { assert.ok(f[3] <= 56 && f[2] <= 72, `${k} 크기 ${f[2]}×${f[3]}`); assert.ok(f[6] > 300 && f[6] <= 512, `${k} 발 줄`); }
assert.ok(!/drawMonster\(ctx, n\.species/.test(world) && /drawMonsterField\(ctx, n\.species/.test(world), '지도 위 우산몬은 도트 그림');
assert.ok(/fieldMonsterFrame\(id\)/.test(gl3), '바닷속 우산몬도 도트 그림');
// HD-2D: 내 자리에서 지도 1px = 화면 정수 px
for (const [W, H, ps] of [[1280, 800, 1], [960, 520, 1.5], [390, 844, 2], [2560, 1305, 1]]) { const V = hdCamera(500, 500, 0, 0, W, H, ps), a = V.project(500, 500, 22), b = V.project(501, 500, 22), k = (b.x - a.x) * ps; assert.ok(Math.abs(k - Math.round(k)) < .02 && Math.round(k) >= 1, `${W}×${H}: 1px → ${k.toFixed(3)}px`); }
console.log('PASS v0.91 잠수 벽 · 잠수 중 우산몬 상호작용 · 지도 우산몬 도트 1:1 · HD-2D 정수 배율');
