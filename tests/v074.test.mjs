// v0.74: 실사 사진 참고 — 여러 층 절벽, 큰 도동항(촘촘한 시가지·터미널·소파블록·보행교), 동도·서도는 배로만, 지도마다 다른 크기
import assert from 'node:assert/strict';
const { createMap, blocked, pathfind, buildingArt, npcs } = await import('../dist/world.js');
const { MAPS, MAP_W, MAP_H } = await import('../dist/maps.js');
const town0 = createMap('town0');
// 큰 지도: 도동항은 42×30보다 커요
assert.ok(town0[0].length > MAP_W && town0.length > MAP_H, `도동항 ${town0[0].length}×${town0.length}`);
// 촘촘한 시가지: 들어가는 건물 4채 + 들어갈 수 없는 집·상가가 많아요, 여객선터미널 하나
const kinds = town0.structures.reduce((o, s) => (o[s.kind] = (o[s.kind] || 0) + 1, o), {});
assert.equal(town0.buildings.length, 4); assert.equal(kinds.terminal, 1); assert.ok(kinds.house + kinds.block >= 35, JSON.stringify(kinds));
// v0.75 이웃 건물 사이에는 골목이 있어요(옆면이 보여요): 같은 줄에서 맞붙은 구조물이 없어요
for (const a of town0.structures) for (const b of town0.structures) if (a !== b && a.y + a.h === b.y + b.h) assert.ok(a.x + a.w < b.x || b.x + b.w < a.x, `${a.kind}@${a.x},${a.y} · ${b.kind}@${b.x},${b.y} 골목`);
// v0.75 그리는 코드가 줄 가운데 주석에 묻히지 않았어요(v0.79: 예전 3D 대신 HD-2D 그리기 줄을 봐요)
{ const src = (await import('node:fs')).readFileSync(new URL('../dist/game.js', import.meta.url), 'utf8'); for (const key of ['hdView = hdCamera(', 'glView.render(', 'glCanvas.style.width =']) { const line = src.split('\n').find(l => l.includes(key)); assert.ok(line && !line.slice(0, line.indexOf(key)).includes('//'), `${key} 살아 있어요`); } }
for (const s of town0.structures) for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) assert.ok(blocked(town0, x, y, [], true), `${s.kind} ${x},${y}: 들어갈 수 없어요`);
assert.equal(buildingArt(town0, town0.structures.find(s => s.kind === 'terminal')), 'ulleung-terminal');
// 소파블록은 물 위에 있어도 못 지나가요 · 여객선은 물 위
const tp = town0.decor.filter(d => d.kind === 'tetrapods'); assert.ok(tp.length >= 20); for (const d of tp) assert.ok(blocked(town0, d.x, d.y, [], true));
assert.ok(town0.decor.some(d => d.kind === 'ferry' && town0[d.y][d.x] === 0));
assert.ok(town0.decor.some(d => d.kind === 'rail') && town0.decor.some(d => d.kind === 'railv'), '해안산책로·보행교 쇠 난간');
// 여러 층 산: 6층까지, 절벽 면은 막혀요
const c = town0.cliff; assert.equal(c.top, 6); for (const k of c.face) assert.equal(town0.solid.has(k), !c.stairs.has(k) && !c.ladders.has(k));
// 시작 자리에서 터미널 앞 출구·몽땅랜드 가림막 언덕까지 걸어가요
const s = town0.spawns.a, ex = [...town0.exits.keys()][0].split(',').map(Number); assert.ok(pathfind(town0, s.x, s.y, ex[0], ex[1]).length);
const enemy = npcs(town0, {}, {}).find(n => n.id === 'enemy'); assert.ok(town0.level.get(`${enemy.x},${enemy.y}`) === 1, '공사장은 1층 언덕 위');
// 동도와 서도: 다리나 땅으로 이어지지 않아요 — 동도 쪽 길(route2)은 부두 끝에서 배를 타요
const r2 = createMap('route2'); assert.equal(r2.def.island, '동도');
const exit = [...r2.exits].find(([, d]) => d === 'next')[0].split(',').map(Number); assert.equal(r2[exit[1]][exit[0]], 6, '서도행 출구는 부두 위');
assert.ok(!r2.def.objects['1'].lines.join('').includes('다리를 건너'));
// 독도 건물: 동도는 등대·경비대, 서도는 주민숙소
const t1 = createMap('town1'), t3 = createMap('town3'), art = (m, k) => buildingArt(m, m.buildings.find(b => b.kind === k));
assert.equal(art(t1, 'lab'), 'dokdo-east-lab'); assert.equal(art(t1, 'gym'), 'dokdo-east-gym'); assert.equal(art(t3, 'shop'), 'dokdo-west-shop'); assert.notEqual(art(t1, 'shop'), art(t3, 'shop'));
// 서도 주민숙소는 선착장 바로 곁
const shop = t3.buildings.find(b => b.kind === 'shop'), dock = [...t3.exits].find(([, d]) => d === 'prev')[0].split(',').map(Number);
assert.ok(Math.abs(shop.x - dock[0]) <= 6 && Math.abs(shop.y - dock[1]) <= 4, '숙소는 선착장 곁');
console.log(`PASS: v0.74 photo-based maps — 도동항 ${town0[0].length}×${town0.length} (${town0.structures.length} structures), 6-level cliffs, tetrapods, ferry, rails; 동도↔서도 by boat; island-specific Dokdo buildings`);
