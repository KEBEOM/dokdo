// v0.68: 입체 건물(box3d) · 사계절(season) · 세워 그리는 들꽃 · 3D에서 눕히는 배
import assert from 'node:assert/strict';
const { buildingBox, boxDepth, EAVE, BH } = await import('../dist/box3d.js');
const { seasonOfMonth, seasonPixel, seasonColor, SEASONS } = await import('../dist/season.js');
const { createMap, sceneDrawOrder, drawActors } = await import('../dist/world.js');
const { ISLAND_ATLAS } = await import('../dist/island-atlas.js');
const { makeChase } = await import('../dist/view3d.js');

// 건물 상자: 앞벽이 2D 그림과 같은 줄(건물 칸 아래 끝)에, 가로는 그림의 벽 폭, 깊이는 건물 칸 안쪽
for (const key of Object.keys(EAVE)) assert.ok(ISLAND_ATLAS.frames[key], `${key} 그림이 있어요`);
const b = { x: 10, y: 5, w: 5, h: 4, kind: 'home' }, kit = { sw: 176, u0: 10, wallW: 156, wallH: 68, depth: 112, rise: 38 };
const box = buildingBox(b, kit);
assert.equal(box.yF, (b.y + b.h) * 32); assert.equal(box.x1 - box.x0, 156); assert.ok(box.yB >= b.y * 32, '뒷벽은 건물 칸 안쪽'); assert.equal(box.h, 68 * BH); assert.equal(box.top, 68 * BH + 38 * 1.4); assert.ok(68 * BH / 2 > 48, 'v0.75 3D에서 한 층이 사람 키(48)보다 높아요');
assert.ok(Math.abs((box.x0 + box.x1) / 2 - (b.x + b.w / 2) * 32) <= 6, '가운데가 2D 그림과 같아요');
const P = makeChase(800, 500), front = P.camera(12.5 * 32, 15 * 32, 0, 0), behind = P.camera(12.5 * 32, 2 * 32, Math.PI, 0);
assert.ok(boxDepth(box, front) > 0 && boxDepth(box, behind) > 0, '앞에서도 뒤에서도 보여요');

// 계절: 달력 → 계절, 초록만 바뀌고 물·흙·벽은 그대로
assert.deepEqual([0, 2, 5, 8, 11].map(seasonOfMonth), ['winter', 'spring', 'summer', 'autumn', 'winter']);
{ const [r0, g0, b0] = seasonPixel('summer', 80, 160, 60, 'leaf'); assert.ok(g0 > r0 && g0 > b0, '여름은 더 짙은 초록'); }
for (const s of SEASONS) { assert.equal(seasonPixel(s, 40, 120, 200), null, `${s}: 바다는 그대로`); assert.equal(seasonPixel(s, 200, 170, 120), null, `${s}: 모래는 그대로`); }
const [r, g] = seasonPixel('autumn', 80, 160, 60, 'leaf'); assert.ok(r > g, '가을 잎은 붉어요');
const w = seasonPixel('winter', 120, 200, 100, 'ground'); assert.ok(Math.min(...w) > 170, '겨울 풀밭은 눈');
assert.match(seasonColor('#6ab04c', 'winter'), /^#[0-9a-f]{6}$/);

// 들꽃: 땅에 그리지 않고 세워 그려요. 막힌 칸·문 앞·출입구에는 없어요
for (const id of ['town0', 'meadow0', 'town3']) {
  const map = createMap(id), fl = map.decor.filter(d => d.kind === 'flower');
  assert.ok(fl.length > 3, `${id}: 들꽃 ${fl.length}곳`);
  for (const f of fl) { const k = `${f.x},${f.y}`; assert.ok(!map.solid.has(k) && !map.keepClear.has(k), `${id} ${k}: 막힌 칸이나 출입구가 아니에요`); assert.equal(map[f.y][f.x], 1, `${id} ${k}: 풀밭`); }
  assert.equal(new Set(fl.map(f => `${f.x},${f.y}`)).size, fl.length);
}

// 배: 3D에서는 세워 그리는 목록에서 빠져요(땅 그림에 눕혀요). 2D에서는 그대로 세워 그려요
const town0 = createMap('town0'), state = { map: 'town0', zone: 0, progress: [{}], flags: {}, avatar: 'girl', dir: 'down' }, people = [];
assert.ok(sceneDrawOrder(people, { x: 20, y: 20 }, town0).some(i => i.scenery === 'boat'));
const seen = []; const fakeCtx = { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), setTransform() {}, save() {}, restore() {}, drawImage() {}, fillRect() {}, beginPath() {}, ellipse() {}, fill() {}, translate() {}, transform() {}, scale() {}, set fillStyle(v) {}, set globalAlpha(v) {}, set imageSmoothingEnabled(v) {}, fillText() {}, measureText: () => ({ width: 10 }) };
const project = (x, y) => { seen.push([x, y]); return { x: 400, y: 300, k: 1, z: 100 }; };
project.box = { depth: () => 50, draw: () => true };
drawActors(fakeCtx, state, { x: 20, y: 20 }, 0, undefined, people, town0, project);
const boat = town0.decor.find(d => d.kind === 'boat'); assert.ok(!seen.some(([x, y]) => x === boat.x * 32 + 16 && y === boat.y * 32 + 70), '3D에서는 배를 세우지 않아요');
console.log('PASS: v0.68 boxed buildings, four seasons, standing wild flowers, boats lie flat in 3D');
