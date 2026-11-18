// 길 위를 걸어 다니는 야생 우산몬: 잔디·풀숲에서만, 겹치지 않게, 결투 뒤 다시 나타나는지 확인해요.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoamers, roamerPool, ROAMER_COUNT, FIELD_TILES, STEP_MS, habitat, habitatTile } from '../dist/roamers.js';
import { createMap, npcs } from '../dist/world.js';
import { MAPS } from '../dist/maps.js';
import { getSpecies, isUnique } from '../dist/data.js';

const seeded = (s = 7) => () => (s = (s * 16807) % 2147483647) / 2147483647;

test('no wild 우산몬 in towns or inside buildings', () => {
  for (const def of MAPS.filter(m => m.kind === 'town')) {
    const map = createMap(def.id), r = createRoamers(seeded());
    r.sync(map, npcs(map), map.spawns.a, 0); r.update(map, npcs(map), map.spawns.a, 99999, false);
    assert.equal(r.count, 0, `${def.name} has no wild 우산몬`);
  }
});

test('on every route they walk on grass and fields only, never overlap, never step on the player, and respawn', () => {
  for (const def of MAPS.filter(m => m.kind === 'route')) {
    const map = createMap(def.id), people = npcs(map), player = { ...map.spawns.a }, r = createRoamers(seeded(def.zone + 3));
    r.sync(map, people, player, 0);
    assert.equal(r.count, ROAMER_COUNT, `${def.name}: ${ROAMER_COUNT} walking`);
    const pool = roamerPool(def.zone);
    let moved = 0;
    const start = r.list.map(w => `${w.x},${w.y}`).join('|');
    for (let t = 0; t < 60000; t += 100) {
      r.update(map, people, player, t, false);
      const tiles = r.list.map(w => `${w.x},${w.y}`);
      assert.equal(new Set(tiles).size, tiles.length, 'no two on one tile');
      for (const w of r.list) {
        assert.ok(habitatTile(map, w.x, w.y, habitat(w.species)), `${def.name}: where it lives (${habitat(w.species)} ${w.x},${w.y})`); // v0.70: 물고기는 물가 물속, 갯바위 생물은 물가, 나머지는 풀밭
        assert.ok(!(w.x === player.x && w.y === player.y), 'never on the player');
        assert.ok(!people.some(n => n.x === w.x && n.y === w.y), 'never on a person or object');
        assert.ok(pool.includes(w.species) && !isUnique(getSpecies(w.species)), 'a wild species of this area (no legendaries or starters)');
      }
    }
    moved = r.list.map(w => `${w.x},${w.y}`).join('|') !== start;
    assert.ok(moved, `${def.name}: they walk around`);
    const gone = r.list[0].uid; r.remove(gone, 60000);
    assert.equal(r.count, ROAMER_COUNT - 1, 'the one you met disappears');
    for (let t = 60000; t < 80000; t += 100) r.update(map, people, player, t, false);
    assert.equal(r.count, ROAMER_COUNT, `${def.name}: a new one appears somewhere else`);
    assert.ok(!r.list.some(w => w.uid === gone));
  }
});

test('they pause during talks and battles, and glide between tiles', () => {
  const map = createMap('route1'), people = npcs(map), r = createRoamers(seeded(3));
  r.sync(map, people, map.spawns.a, 0);
  const before = r.list.map(w => `${w.x},${w.y}`).join('|');
  for (let t = 0; t < 20000; t += 100) r.update(map, people, map.spawns.a, t, true);
  assert.equal(r.list.map(w => `${w.x},${w.y}`).join('|'), before, 'frozen while paused');
  let half = null;
  for (let t = 20000; t < 40000 && !half; t += 50) { r.update(map, people, map.spawns.a, t, false); half = r.snapshot(t).find(s => s.walking && s.drawX !== Math.round(s.drawX) || s.walking && s.drawY !== Math.round(s.drawY)); }
  assert.ok(half, 'drawn halfway between two tiles while walking');
  assert.ok(STEP_MS > 0);
});


test('v0.47 나리분지 초원: the 30 friends 김박사 brought walk on the grass, never fight, never respawn', async () => {
  const { pickStarterField, starterPool } = await import('../dist/data.js');
  const { MAP_BY_ID } = await import('../dist/maps.js');
  const def = MAP_BY_ID.meadow0; assert.equal(def.kind, 'meadow'); assert.equal(def.island, '울릉도');
  assert.ok(!MAPS.includes(def), 'not part of the town → route chain');
  const map = createMap('meadow0'), people = npcs(map), r = createRoamers(seeded(5)), field = pickStarterField(seeded(9));
  assert.equal(map.exits.size, 0, 'no way out until you pick a friend');
  assert.ok(people.some(n => n.name === '김박사' && n.actor === 'professor') && people.some(n => n.kind === 'sign'), '김박사 and the 나리분지 sign');
  r.setFriends(field); r.sync(map, people, map.spawns.a, 0);
  assert.equal(r.count, 30); assert.deepEqual(r.list.map(w => w.species).sort((a, b) => a - b), [...field].sort((a, b) => a - b), 'exactly the field list, once each');
  assert.ok(r.list.every(w => w.kind === 'friend' && !w.name.startsWith('사나워진') && starterPool().includes(w.species)));
  const start = r.list.map(w => `${w.x},${w.y}`).join('|');
  for (let t = 0; t < 30000; t += 100) {
    r.update(map, people, map.spawns.a, t, false);
    for (const w of r.list) assert.ok(habitatTile(map, w.x, w.y, habitat(w.species)), `where it lives (${w.species} ${habitat(w.species)})`);
  }
  assert.notEqual(r.list.map(w => `${w.x},${w.y}`).join('|'), start, 'they wander around');
  r.remove(r.list[0].uid, 30000); for (let t = 30000; t < 60000; t += 100) r.update(map, people, map.spawns.a, t, false);
  assert.equal(r.count, 29, 'the one you take along does not come back');
});
console.log(`PASS: no wild 우산몬 in towns; ${ROAMER_COUNT} walking on every route over grass/fields only, no overlaps, never on the player or objects, area species only, respawn after a battle, pause and smooth steps; 나리분지 초원 holds the 30 friends.`);
