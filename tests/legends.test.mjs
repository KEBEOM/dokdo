// 전설의 우산몬(천연기념물) 퀘스트: 자리·조건·만남 장면·변환폼 그림이 맞는지 확인해요.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { LEGENDS, ALL_LEGEND_IDS, legendProgress, legendSpots, legendScene, openFlag, metFlag, countDone } from '../dist/legends.js';
import { createMap, npcs, blocked, pathfind } from '../dist/world.js';
import { getSpecies, ZONES, isUnique } from '../dist/data.js';
import { newState } from '../dist/engine.js';
import { monsterAssetKey } from '../dist/assets.js';
import { facing, look } from '../dist/sprites.js';
import { PHOTO_CREDITS } from '../dist/photo-credits.js';
const await_maps = await import('../dist/maps.js');

test('legend spots are free, reachable tiles that appear only after the quest opens', () => {
  for (const q of LEGENDS) {
    const map = createMap(q.map), sp = getSpecies(q.id);
    assert.ok(sp.legendary && (sp.forms === 2 || q.id === 18), `${q.name} is a legendary (two forms except 사철나무)`);
    assert.ok([1, 2, 3, 4].includes(map[q.y][q.x]), `${q.name} stands on land (${q.map} ${q.x},${q.y})`);
    assert.ok(!map.keepClear.has(`${q.x},${q.y}`) && !map.solid.has(`${q.x},${q.y}`), `${q.name} spot is not a door, exit or wall`);
    const closed = npcs(map, {}, {}); assert.ok(!closed.some(n => n.kind === 'legend'), 'hidden before the quest opens');
    const people = npcs(map, {}, { [openFlag(q.id)]: true }), spot = people.find(n => n.kind === 'legend');
    assert.ok(spot && spot.x === q.x && spot.y === q.y && spot.species === q.id, `${q.name} spot appears`);
    assert.ok(!people.some(n => n !== spot && n.x === q.x && n.y === q.y), 'nobody else on that tile');
    const others = people.filter(n => n !== spot), start = map.spawns.a;
    const reach = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => { const x = q.x + dx, y = q.y + dy; return !blocked(map, x, y, people) && (pathfind(map, start.x, start.y, x, y, people).length > 0 || (x === start.x && y === start.y)); });
    assert.ok(reach, `${q.name} can be reached from the map entrance`);
    for (const ex of map.exits.keys()) { const [x, y] = ex.split(',').map(Number); if (blocked(map, x, y, others)) continue; assert.ok(pathfind(map, start.x, start.y, x, y, people).length > 0 || (x === start.x && y === start.y), `${q.name} does not block the way to ${ex}`); }
    assert.ok(!npcs(map, {}, { [openFlag(q.id)]: true, [metFlag(q.id)]: true }).some(n => n.kind === 'legend'), 'gone after it joins');
  }
});

test('quest conditions count real progress and open in story order', () => {
  const s = newState();
  for (const q of LEGENDS) assert.equal(legendProgress(q, s).done, false, `${q.name} starts locked`);
  s.badges = [0]; assert.ok(legendProgress(LEGENDS[0], s).done, '소쩍새 opens with the 도동항 인증');
  s.flags = { 'route0:6': true, 'route1:6': true }; assert.equal(countDone(s, 'observe'), 2);
  assert.ok(legendProgress(LEGENDS.find(q => q.id === 72), s).done, '황조롱이 opens after two observations');
  // every condition can be met by the time the player reaches the legend's map (maps visited in order)
  const order = ['town0', 'route0', 'town1', 'route1', 'town2', 'route2', 'town3', 'route3', 'town4', 'route4', 'town5', 'route5', 'town6', 'route6', 'town7'];
  const { MAPS } = await_maps;
  for (const q of LEGENDS) {
    if (!['observe', 'trainer', 'trash', 'stone'].includes(q.need.type)) continue;
    const upTo = order.slice(0, order.indexOf(q.map) + 1), avail = MAPS.filter(m => upTo.includes(m.id)).flatMap(m => Object.values(m.objects || {})).filter(o => o.type === q.need.type).length;
    assert.ok(avail >= q.need.n, `${q.name}: ${avail} ${q.need.type} objects before ${q.map} (needs ${q.need.n})`);
  }
  const tree = LEGENDS.find(q => q.id === 18); assert.equal(legendProgress(tree, s).done, false);
  s.progress[7].enemy = true; assert.ok(legendProgress(tree, s).done, '사철나무 returns to 천장굴 길 after 백무 사장 is stopped');
  assert.deepEqual(ALL_LEGEND_IDS, [68, 72, 71, 70, 75, 76, 18]);
});

test('legendaries never show up in grass, gym or 몽땅랜드 teams', () => {
  for (const z of ZONES) for (const id of [...z.wild, ...z.bossTeam]) assert.ok(!isUnique(getSpecies(id)), `${getSpecies(id).name} in zone lists`);
  const src = fs.readFileSync('dist/maps.js', 'utf8');
  for (const m of src.matchAll(/team: \[([0-9, ]+)\]/g)) for (const id of m[1].split(',').map(Number)) assert.ok(!getSpecies(id).legendary, `trainer team has ${id}`);
});

test('meeting scenes, 변환폼 pictures, facing and real photos', () => {
  for (const q of LEGENDS) {
    const sc = legendScene(q).scenes[0];
    assert.ok(sc.cast.some(c => c.who === `monster:${q.id}`) && sc.lines.some(l => l.cue === `show:${'leg'}`), `${q.name} scene`);
    assert.ok(!/이이에요|예요예요|undefined/.test(sc.lines.map(l => l.text).join(' ')), `${q.name} scene text`);
    if (q.id === 18) { assert.ok(sc.lines.some(l => l.text.includes('지정된 나무')), '사철나무 is a tree'); continue; }
    assert.equal(monsterAssetKey(`${q.id}-2`), `monsters/${String(q.id).padStart(3, '0')}-2`);
    assert.ok(fs.existsSync(`dist/assets/${monsterAssetKey(`${q.id}-2`)}.png`), `${q.name} 변환폼 picture`);
    assert.equal(facing(`${q.id}-2`), 'left', '변환폼 looks left, so my side flips it to look right');
  }
  assert.equal(look({ id: 70, form: 2 }), '70-2'); assert.equal(look({ id: 70 }), 70);
  assert.equal(monsterAssetKey(5), 'monsters/005'); assert.equal(monsterAssetKey('68-1'), 'monsters/068');
  assert.equal(facing(22), 'right'); assert.equal(facing(1), 'front'); assert.equal(facing(34), 'left');
  for (let id = 1; id <= 100; id++) {
    assert.ok(PHOTO_CREDITS[id]?.by && PHOTO_CREDITS[id]?.license, `photo credit ${id}`);
    assert.ok(fs.existsSync(`dist/assets/photos/${String(id).padStart(3, '0')}.jpg`), `photo ${id}`);
  }
});
console.log('PASS: 7 legend spots (free, reachable, hidden until unlocked), conditions in story order, no legendaries in teams, scenes, 변환폼 pictures, facing and 100 credited photos.');
