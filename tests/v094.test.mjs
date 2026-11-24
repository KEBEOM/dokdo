// v0.94 한글 입력 상태에서도 Q(잠수)·E(말 걸기)·결투 W/S/E가 먹어요 · 걷는 중 Q도 받아요 · 초원 바닷속에서 갑자기 결투(동료 없음) 오류
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const game = readFileSync(new URL('game.js', dist), 'utf8'), bui = readFileSync(new URL('battle-ui.js', dist), 'utf8');
assert.ok(/const LETTER_KEY = \{ KeyQ: 'q', KeyE: 'e'/.test(game) && /const lk = LETTER_KEY\[e\.code\] \|\| e\.key;/.test(game), '자판 자리(e.code)로 Q·E');
assert.ok(/\(lk === 'q' \|\| lk === 'Q'\)/.test(game) && /\['e', 'E', ' ', 'Enter'\]\.includes\(lk\)/.test(game));
assert.ok(/const key = \{ KeyW: 'w', KeyS: 's', KeyE: 'e' \}\[e\.code\] \|\| e\.key;/.test(bui), '결투 메뉴도');
assert.ok(!/if \(moving\) return;\n  if \(diveWanted/.test(game) && /moving\?\.toX \?\? state\.x/.test(game), '걷는 중 Q도 받아요(도착할 칸 기준)');
// 첫 동료를 고르는 초원: 잠수해도 사나워진 우산몬이 없고, 동료가 없으면 결투가 시작되지 않아요
{ const { deepCount, createRoamers } = await import('../dist/roamers.js'); const { createMap } = await import('../dist/world.js');
  const m = createMap('meadow0'); assert.equal(deepCount(m), 0, '초원 바닷속엔 야생 우산몬 없음');
  const R = createRoamers(() => .5); R.sync(m, [], { x: 0, y: 0 }, 0); m.diving = true; R.update(m, [], { x: 0, y: 0 }, 10, false); assert.ok(!R.list.some(r => r.kind === 'wild')); }
assert.ok(/if \(!state\.party\.length\) \{ if \(opts\.roamer\) roamers\.remove/.test(game), '동료 없이 결투 시작 안 함');
console.log('PASS v0.94 한글 입력 상태의 Q·E · 걷는 중 잠수 · 초원 바닷속');
