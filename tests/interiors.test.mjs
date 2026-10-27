// Buildings you can walk into: every town has 연구소(3층)·수호관(3층)·쉼터(2층)·집(2층).
import assert from 'node:assert/strict';
import { ROOM_TEMPLATES, ROOM_DEFS, roomId, parseRoomId } from '../dist/interiors.js';
import { MAPS, MAP_BY_ID, parseMap } from '../dist/maps.js';
import { createMap, blocked, npcs, pathfind } from '../dist/world.js';
import { validateSave, newState, createMonster, addMonster } from '../dist/engine.js';

const TYPES = new Set(['shopkeeper', 'storage', 'dex', 'rest', 'badges', 'sign', 'landmark', 'person', 'box', 'stone', 'observe']);
for (const [kind, floors] of Object.entries(ROOM_TEMPLATES)) floors.forEach((f, i) => {
  const w = f.art[0].length;
  f.art.forEach((row, y) => assert.equal(row.length, w, `${kind} ${i + 1}층 row ${y}: every row is ${w} wide`));
  const text = f.art.join('');
  assert.equal((text.match(/D/g) || []).length, i === 0 ? 1 : 0, `${kind} ${i + 1}층: one door, on the ground floor only`);
  assert.equal(text.includes('U'), i < floors.length - 1, `${kind} ${i + 1}층: stairs up unless top floor`);
  assert.equal(text.includes('N'), i > 0, `${kind} ${i + 1}층: stairs down above the ground floor`);
  assert.ok(f.art[0].split('').every(c => 'wy0123456789'.includes(c)) && f.art.at(-1).split('').every(c => 'wD'.includes(c)), `${kind} ${i + 1}층: walled in`);
});
assert.equal(ROOM_DEFS.length, 8 * (2 + 3 + 3 + 2), '8 towns × 10 floors');
assert.deepEqual(parseRoomId('town3/lab/2'), { zone: 3, kind: 'lab', floor: 2 }); assert.equal(roomId(3, 'lab', 2), 'town3/lab/2');

const walk = (map, x, y) => !blocked(map, x, y, npcs(map, {}, {})) && !(map[y][x] >= 13 && map[y][x] <= 15);
for (const def of ROOM_DEFS) {
  assert.ok(MAP_BY_ID[def.id], `${def.id} is a known map`);
  const map = createMap(def.id), start = map.spawns.a, people = npcs(map, {}, {});
  assert.ok(start && walk(map, start.x, start.y), `${def.id}: a free place to stand`);
  // everything reachable from where you come in
  const seen = new Set([`${start.x},${start.y}`]), q = [[start.x, start.y]];
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (!seen.has(k) && walk(map, x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); } } }
  const near = p => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${p.x + dx},${p.y + dy}`));
  for (const d of map.doors) assert.ok(near(d), `${def.id}: door reachable`);
  for (const s of map.stairs) { assert.ok(near(s) && s.land, `${def.id}: ${s.dir} stairs reachable`); assert.ok(pathfind(map, start.x, start.y, s.x, s.y, people).length, `${def.id}: a path onto the stairs`); }
  for (const n of people) { assert.ok(TYPES.has(n.kind), `${def.id}: known object ${n.kind}`); assert.ok(near(n), `${def.id}: ${n.name} reachable`); if (n.kind === 'person' || n.kind === 'shopkeeper') assert.ok(n.actor && n.lines.length); if (['sign', 'landmark'].includes(n.kind)) assert.ok(n.lines.every(l => typeof l === 'string' && l.length > 3 && l.length < 200), `${def.id}: ${n.name} text`); }
  // stairs lead to a floor that has the matching stairs back
  for (const s of map.stairs) { const other = createMap(roomId(def.zone, def.building, def.floor + (s.dir === 'up' ? 1 : -1))); assert.ok(other.stairs.some(t => t.dir === (s.dir === 'up' ? 'down' : 'up'))); }
}
// every building in every town has a door you can walk up to
for (const def of MAPS.filter(m => m.kind === 'town')) {
  const town = createMap(def.id), people = npcs(town, {}, {}), s = town.spawns.a;
  for (const b of town.buildings) {
    const cols = b.w % 2 ? [b.x + Math.floor(b.w / 2)] : [b.x + b.w / 2 - 1, b.x + b.w / 2];
    const fronts = cols.map(x => ({ x, y: b.y + b.h })).filter(p => !blocked(town, p.x, p.y, people));
    assert.ok(fronts.length, `${def.id}: the ${b.kind} door has a free step in front`);
    assert.ok(fronts.some(f => (f.x === s.x && f.y === s.y) || pathfind(town, s.x, s.y, f.x, f.y, people).length), `${def.id}: the ${b.kind} door can be reached`);
    assert.ok(MAP_BY_ID[roomId(def.zone, b.kind, 1)], `${def.id}: ${b.kind} has an inside`);
  }
}
// a save made inside a building loads inside it
const st = newState(); addMonster(st, createMonster(1, 5)); st.started = true; st.map = 'town2/gym/3'; st.zone = 2; st.visited = [0, 1, 2]; st.x = createMap('town2/gym/3').spawns.a.x; st.y = createMap('town2/gym/3').spawns.a.y;
const back = validateSave(JSON.parse(JSON.stringify(st))); assert.equal(back.map, 'town2/gym/3'); assert.equal(back.x, st.x);
console.log(`interiors: ${ROOM_DEFS.length} floors in 32 buildings — doors, stairs and everything inside reachable`);
