// v0.92 바닷속 잔 버그: 지도 옮길 때 잠수 · 잠수 바꾸기 자리 · 2D 바닷속 · 안내 글 (물고기·쉬는 우산몬 장식은 v0.93에 야생 우산몬으로 바뀜)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const game = readFileSync(new URL('game.js', dist), 'utf8'), world = readFileSync(new URL('world.js', dist), 'utf8');
assert.ok(/keys\.clear\(\); diveWanted = false;/.test(game), '다른 지도로 가면 물 위에서 시작');
assert.ok(/배 밑이라 올라올 수 없어요/.test(game) && /바로 밑에 바위가 있어요/.test(game), '배 밑에서 올라오거나 바위 안으로 잠수하지 않아요');
assert.ok(/if \(map\?\.diving\) order = order\.filter\(n => n\.player \|\| \(\(n\.kind === 'wild'/.test(world), '2D 바닷속: 물 위의 것은 빼요');
assert.ok(/const sw = map\.diving && !busy\(\) \? diveMon\(\) : null/.test(game), '안내 글도 E와 같은 순서');
console.log('PASS v0.92 바닷속 잔 버그: 잠수 상태 · 2D 바닷속 · 안내 글');
