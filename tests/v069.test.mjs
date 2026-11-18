// v0.69: 빠른 게임 시계(하루 2분 30초 · 한 계절 2일) · 낮과 밤 · 때를 타는 우산몬 · 밤 노래 · 때에 맞는 첫인사
import assert from 'node:assert/strict';
const S = await import('../dist/season.js');
const { roamerPool, WHEN, whenNote, fitsNow, timeTalk, createRoamers } = await import('../dist/roamers.js');
const { MONSTERS } = await import('../dist/data.js');
const { TRACKS } = await import('../dist/music-data.js');
const { createMap } = await import('../dist/world.js');
const H = S.DAY_MS / 24;

// 시계: 0에서 아침 8시 · 봄. 밤 12시를 지나면 다음 날, 이틀마다 다음 계절, 8일이면 한 해가 돌아요
assert.equal(Math.round(S.hourOf(0)), 8); assert.equal(S.flowSeason(0), 'spring');
assert.equal(S.dayOf(H * 15.9), 0); assert.equal(S.dayOf(H * 16.1), 1);
const seen = []; for (let d = 0; d < 8; d++) seen.push(S.flowSeason(H + d * S.DAY_MS));
assert.deepEqual(seen, ['spring', 'spring', 'summer', 'summer', 'autumn', 'autumn', 'winter', 'winter']);
assert.equal(S.flowSeason(H + 8 * S.DAY_MS), 'spring', '한 해가 지나면 다시 봄');
assert.equal(S.DAY_MS * 2 * 4 / 60000, 20, '한 해는 20분');
// 빛: 낮 12시 밝음 · 밤 11시 어두움 · 노을과 새벽은 주황빛
const at = h => ((h - 8 + 24) % 24) * H;
assert.equal(S.daylight(at(12)).night, 0); assert.equal(S.daylight(at(23)).night, 1); assert.ok(S.daylight(at(18.4)).warm > .8 && S.daylight(at(5.6)).warm > .8);
assert.ok(S.isNight(at(2)) && !S.isNight(at(9))); assert.equal(S.clockLabel(at(15)), '오후 3시'); assert.equal(S.clockLabel(at(23)), '밤 11시');

// 때를 타는 우산몬: 모두 실제 종, 이유가 있고, 그때가 아니면 길에 안 나와요
for (const [id, w] of Object.entries(WHEN)) { assert.ok(MONSTERS.find(m => m.id === Number(id)), id); assert.ok(w.why && (w.season || w.time)); assert.ok(whenNote(Number(id)).includes('길에 나와요')); }
for (const s of S.SEASONS) assert.ok(Object.values(WHEN).some(w => w.season === s), `${s}에만 나오는 우산몬이 있어요`);
assert.ok(roamerPool(0, { season: 'summer', night: true }).includes(37), '밤엔 볼락'); assert.ok(!roamerPool(0, { season: 'summer', night: false }).includes(37), '낮엔 볼락 없음');
assert.ok(roamerPool(0, { season: 'autumn', night: false }).includes(1) && !roamerPool(0, { season: 'spring', night: false }).includes(1), '해국은 가을에만');
assert.deepEqual(roamerPool(3), roamerPool(3, null), '때를 안 주면 예전과 같아요');
for (let z = 0; z <= 6; z++) for (const season of S.SEASONS) for (const night of [false, true]) { const p = roamerPool(z, { season, night }); assert.ok(p.length >= 4, `${z} ${season} ${night}`); assert.ok(p.every(id => fitsNow(id, { season, night }))); }
// 밤이 되면 때가 지난 우산몬은 멀리 있을 때 떠나고, 새로 나오는 건 밤 우산몬 차례예요
let night = false; const r = createRoamers(() => .37, () => ({ season: 'summer', night })), map = createMap('route0');
r.sync(map, [], { x: 1, y: 1 }, 0); assert.ok(r.list.every(x => fitsNow(x.species, { season: 'summer', night: false })));
night = true; r.update(map, [], { x: 1, y: 1 }, 10, false); assert.ok(r.list.every(x => fitsNow(x.species, { season: 'summer', night: true }) || Math.abs(x.x - 1) + Math.abs(x.y - 1) <= 6));

// 밤 노래와 첫인사
assert.ok(TRACKS.night && TRACKS.nightsea);
assert.match(timeTalk('미소 아줌마', 'summer', true), /밤/); assert.match(timeTalk('준', 'autumn', false), /가을/); assert.match(timeTalk('준', 'winter', false), /겨울/);
console.log('PASS: v0.69 fast clock (day 2.5 min, season 2 days, year 20 min), day/night light, time-and-season 우산몬, night music, greetings');
