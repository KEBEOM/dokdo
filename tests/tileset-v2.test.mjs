import assert from 'node:assert/strict';
import fs from 'node:fs';
import { V2_TERRAIN, V2_OBJECTS, V2_DETAILS, V2_CHARACTERS, v2TileRect } from '../dist/tileset-v2.js';
import { seaDepth, v2Tile, v2Rock, v2Detail } from '../dist/terrain.js';
import { createMap } from '../dist/world.js';
import { MAPS } from '../dist/maps.js';
// 타일셋 v2(v0.67): 그림 크기·좌표가 manifest와 같고, 땅 그림을 바꿔도 충돌 규칙(지도 칸)은 그대로예요.
const manifest = JSON.parse(fs.readFileSync(new URL('../art/tileset-v2/tileset_manifest.json', import.meta.url)));
const png = key => { const b = fs.readFileSync(new URL(`../dist/assets/${key}.png`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
assert.deepEqual(png(V2_TERRAIN.key), [384, 256]); assert.deepEqual(png(V2_OBJECTS.key), [512, 416]); assert.deepEqual(png(V2_DETAILS.key), [256, 128]); assert.deepEqual(png(V2_CHARACTERS.key), [320, 432]);
for (const [name, t] of Object.entries(manifest.terrain.tiles)) { assert.equal(V2_TERRAIN.ids[name], t.id); assert.deepEqual(v2TileRect(t.id), [t.col * 32, t.row * 32, 32, 32]); }
for (const [name, o] of Object.entries(manifest.objects.sprites)) assert.deepEqual(V2_OBJECTS.sprites[name], [o.x, o.y, o.width, o.height]);
assert.deepEqual(V2_CHARACTERS.rows, manifest.characters.rowsByDirection); assert.deepEqual(V2_CHARACTERS.foot, manifest.characters.footOffset);
const collides = Object.fromEntries(Object.values(manifest.terrain.tiles).map(t => [t.id, !!t.collides]));
const used = new Set(); let tiles = 0;
for (const def of MAPS) {
  if (def.kind === 'room') continue;
  const map = createMap(def.id), depth = seaDepth(map);
  for (let y = 0; y < map.length; y++) for (let x = 0; x < map[0].length; x++) {
    const rock = map.rockTiles?.has(`${x},${y}`), id = rock ? v2Rock(map, x, y) : v2Tile(map, x, y, depth), water = map[y][x] === 0; used.add(id); tiles++;
    assert.ok(Number.isInteger(id) && id >= 0 && id < 96, `${def.id} ${x},${y}`);
    if (rock || water) assert.equal(collides[id], true, `${def.id} ${x},${y}: 물·바위 덩어리는 막힌 그림`);
    else assert.equal(collides[id], false, `${def.id} ${x},${y}: 걸을 수 있는 칸은 막히지 않은 그림`);
    if (water) assert.ok(depth[y][x] >= 1);
    const d = v2Detail(map, x, y); if (d != null) assert.ok(d >= 0 && d < 32);
  }
}
assert.ok(used.size >= 30, `여러 무늬를 섞어 써요 (${used.size}가지)`);
console.log(`PASS: tileset v2 — image sizes and coordinates match the manifest, ${tiles} map tiles use ${used.size} kinds, walkable tiles never get a blocking picture and water/rock always do.`);
