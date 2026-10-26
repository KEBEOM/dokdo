// Map data: shapes, the town → route → town chain, exits, objects and real place names.
import assert from 'node:assert/strict';
import { MAPS, parseMap, nextMapId, prevMapId, MAP_W, MAP_H, TOWN_ROLES } from '../dist/maps.js';
import { createMap, npcs, pathfind, blocked } from '../dist/world.js';
import { ZONES, EXTRA_NPCS, getSpecies, MONSTERS } from '../dist/data.js';

const towns = MAPS.filter(m => m.kind === 'town'), routes = MAPS.filter(m => m.kind === 'route');
assert.equal(towns.length, 8); assert.equal(routes.length, 7);
assert.deepEqual(MAPS.map(m => m.id), ['town0', 'route0', 'town1', 'route1', 'town2', 'route2', 'town3', 'route3', 'town4', 'route4', 'town5', 'route5', 'town6', 'route6', 'town7']);

// Real Dokdo place names, one per map, all different.
const REAL = ['동도 선착장', '숫돌바위 길', '우산봉', '천장굴 길', '한반도바위', '독립문바위 바닷길', '탕건봉', '촛대바위 해안', '가제바위', '보찰바위 갯바위', '코끼리바위', '삼형제굴바위 해안', '물골', '상장군바위 오르막', '대한봉'];
assert.deepEqual(MAPS.map(m => m.name), REAL);
towns.forEach(t => assert.equal(ZONES[t.zone].name, t.name, 'chapter title uses the town name'));

// Every town has its own shape.
const shapes = new Set(towns.map(t => t.art.map(r => r.replace(/[^~]/g, '#')).join('')));
assert.equal(shapes.size, 8, 'eight different coastlines');

for (const def of MAPS) {
  assert.equal(def.art.length, MAP_H); def.art.forEach(r => assert.equal(r.length, MAP_W, `${def.id} row width`));
  const p = parseMap(def.id), map = createMap(def.id);
  // exits sit on the map edges and lead to the neighbouring map
  for (const [k, dir] of p.exits) {
    const [x] = k.split(',').map(Number);
    assert.equal(x, dir === 'prev' ? 0 : MAP_W - 1, `${def.id}: ${dir} exit on its edge`);
    assert.ok(dir === 'prev' ? prevMapId(def.id) : nextMapId(def.id), `${def.id}: ${dir} exit has a destination`);
  }
  const dirs = new Set(p.exits.values());
  assert.equal(dirs.has('prev'), def.id !== 'town0'); assert.equal(dirs.has('next'), def.id !== 'town7');
  // arriving from either side: you can walk from that arrival point to both exits
  for (const key of ['a', 'z']) {
    const s = p.spawns[key];
    for (const [k] of p.exits) { const [x, y] = k.split(',').map(Number); assert.ok(pathfind(map, s.x, s.y, x, y, npcs(map, {}, {})).length, `${def.id}: ${key} → exit ${k}`); }
  }
  if (def.kind === 'town') {
    for (const role of ['history', 'guide', 'board', 'enemy', 'boss', 'shop', 'prof', 'wild0', 'wild1']) assert.ok(p.roles[role], `${def.id}: ${role} placed`);
    assert.equal(Object.keys(p.residents).length, 5);
    assert.equal(p.buildings.length, 4); assert.deepEqual(p.buildings.map(b => b.kind).sort(), ['gym', 'home', 'lab', 'shop']);
    const extras = EXTRA_NPCS.filter(n => n.zone === def.zone).length;
    assert.equal(['extra0', 'extra1'].filter(r => p.roles[r]).length, extras, `${def.id}: room for every historical figure`);
    assert.ok(p.objects.some(o => o.type === 'sign'), `${def.id}: a place-name sign`);
  } else {
    const types = p.objects.map(o => o.type).sort();
    for (const t of ['box', 'landmark', 'person', 'sign', 'stone', 'trainer']) assert.ok(types.includes(t), `${def.id}: has a ${t}`);
    assert.ok(types.includes('observe') || types.includes('legend'), `${def.id}: has an observation point`);
    assert.ok(map.some(r => r.includes(3)), `${def.id}: tall grass for wild encounters`);
  }
  for (const o of p.objects) {
    assert.ok(o.name && Array.isArray(o.lines) && o.lines.length, `${def.id}:${o.key} has text`);
    assert.ok(!blocked(map, o.x, o.y, [], true) || o.type === 'landmark', `${def.id}:${o.key} stands on land`);
    if (o.type === 'observe') assert.ok(MONSTERS.some(m => m.id === o.species && !m.legendary));
    if (o.type === 'legend') assert.ok(MONSTERS.some(m => m.id === o.species && m.legendary));
    if (o.type === 'trainer') { assert.ok(o.team.length >= 1); o.team.forEach(id => assert.ok(!getSpecies(id).legendary && getSpecies(id).id === id)); assert.ok(o.after?.length); }
    if (o.type === 'box' || (o.type === 'person' && o.give)) assert.ok(Object.values(o.give).every(n => Number.isInteger(n) && n > 0));
  }
}
assert.ok(Object.values(TOWN_ROLES).includes('history'));
console.log('PASS: 8 towns with different coastlines + 7 routes, real place names, edge exits in a chain, both arrival points reach every exit, roles, objects and items.');
