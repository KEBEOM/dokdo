import { ZONES, EXTRA_NPCS, getSpecies, keeperName } from './data.js';
import { drawHuman, drawMonster, drawMonsterField, facing } from './sprites.js';
import { drawScenery, drawIslandArt } from './scenery.js';
import { drawTerrain, flowerTiles } from './terrain.js';
import { seabedLayout } from './seabed.js';
import { seasonFlowers, seasonColor, currentSeason as seasonName } from './season.js';
import { drawExplorer, drawResident, CHARACTER_SIZE } from './characters.js';
import { parseMap, getMapDef, MAP_W, MAP_H } from './maps.js';
import { drawProp, drawGround, propArt } from './props.js';
import { CUTSCENE_ATLAS } from './cutscene-atlas.js';
import { assetImage } from './assets.js';
import { drawInterior, drawFurniture, FURNITURE_DEPTH } from './interior-art.js';
import { legendSpots } from './legends.js';
import { V2_OBJECTS } from './tileset-v2.js';

export const TILE = 32, W = MAP_W, H = MAP_H;
export const PROP_KINDS = ['sign', 'landmark', 'box', 'trash', 'observe', 'stone', 'legend'];
const SURFACE_BIRDS = new Set([79, 80, 81]); // 가마우지·아비: 물 위에 떠 있어요

// A tile grid (rows of tile codes) carrying the parsed map: buildings, decor, exits, spawns.
// v0.84 문 자리: 건물 아랫줄의 어느 칸이 문인지(들어가기·나오기·문 앞 발판·간판이 모두 여기서 읽어요).
// 기본은 가운데(짝수 폭이면 가운데 두 칸). 도동 골목 집 그림 3종은 문이 오른쪽에 그려져 있어서 오른쪽 칸(+2)이 문이에요.
export function doorColumns(b) {
  if (b.kind === 'house' && b.w === 3) return [b.x + 2];
  return b.w % 2 ? [b.x + Math.floor(b.w / 2)] : [b.x + b.w / 2 - 1, b.x + b.w / 2];
}
export function createMap(ref = 0) {
  const parsed = parseMap(ref), def = parsed.def;
  const grid = parsed.grid.map(row => row.slice());
  for (const d of parsed.decor || []) { const hull = d.kind === 'boat' ? [[0, 0], [0, 1]] : d.kind === 'ferry' ? [-3, -2, -1, 0, 1, 2, 3].flatMap(i => [[i, 3], [i, 4]]) : []; for (const [i, j] of hull) if (parsed.grid[d.y + j]?.[d.x + i] === 0) (parsed.hull ||= new Set()).add(`${d.x + i},${d.y + j}`); } // v0.87 배는 물 위에서 막혀요(헤엄쳐 배 위를 지나가지 않게, 잠수하면 배 밑으로)
  for (const o of parsed.objects || []) if (o.rock) for (let y = o.rock[1]; y <= o.rock[3]; y++) for (let x = o.rock[0]; x <= o.rock[2]; x++) parsed.solid.add(`${x},${y}`); // v0.86 바다의 바위(지명 고증 자리)
  const keepClear = new Set([...parsed.exits.keys(), ...Object.values(parsed.spawns).map(p => `${p.x},${p.y}`)]);
  for (const b of parsed.buildings) keepClear.add(`${b.x + Math.floor(b.w / 2)},${b.y + b.h}`);
  const map = Object.assign(grid, {
    id: def.id, def, zone: def.zone, kind: def.kind, name: def.name,
    solid: parsed.solid, exits: parsed.exits, spawns: parsed.spawns,
    hull: parsed.hull || new Set(), buildings: parsed.buildings, structures: parsed.structures || [], decor: parsed.decor, ground: parsed.ground || [], rockTiles: parsed.rockTiles, keepClear, parsed,
    doors: parsed.doors || [], stairs: parsed.stairs || [], focus: parsed.focus || null,
    level: parsed.level || null, cliff: parsed.cliff || null // v0.70 높낮이(언덕·절벽·계단·사다리)
  });
  // v0.71 얕은 물: 걸을 수 있는 땅(풀·길·풀숲·모래·부두)에 맞닿은 물 칸
  map.shallow = new Set(); if (map.kind !== 'room') for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) if (map[y][x] === 0 && !map.solid.has(`${x},${y}`) && !map.hull.has(`${x},${y}`) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => [1, 2, 3, 4, 6].includes(map[y + b]?.[x + a]) && !map.solid.has(`${x + a},${y + b}`))) map.shallow.add(`${x},${y}`);
  map.uwSolid = map.kind === 'room' ? null : seabedLayout(map).solid; // v0.87 바닷속 바위 지형 칸
  map.decor = [...map.decor, ...flowerTiles(map).map(([x, y, common]) => ({ kind: 'flower', x, y, common }))]; // v0.68: 세워 그리는 들꽃(3D에서도 서 있어요)
  return map;
}
// Buildings of the first town (kept for older code and tests).
export const BUILDINGS = parseMap('town0').buildings;

export function villageResidents(zone) {
  const z = ZONES[zone], ul = zone === 0; // 1장 도동항(울릉도) 주민은 몽땅랜드 공사 이야기를 해요
  return [
    { key: '1', actor: 'child-boy', name: '남자아이 준', lines: ['나는 준! 방금 배운 내용을 보지 않고 말해 보는 연습을 해.', '문제를 틀렸다면 해설을 읽고, 다음 만남에서 다시 떠올려 봐!'] },
    { key: '2', actor: 'child-girl', name: '여자아이 솔', lines: ['나는 솔이야. 이번 지역에서 기억할 내용을 함께 읽어 볼까?', z.fact, '수첩을 잠깐 닫고 네 말로 설명해 봐!'] },
    { key: '3', actor: 'child-girl-ribbon', name: '여자아이 봄', lines: ['나는 봄! 탐험 수첩에 지금까지 배운 내용을 모아 두었어.', '각 지역의 기록판을 다시 만나면 지난 개념도 함께 복습할 수 있어.'] },
    { key: '4', actor: 'man', name: '도윤 아저씨', lines: [...(ul ? ['요즘 뒷산에 몽땅랜드 공사 가림막이 생겼어. 후박나무 숲을 밀고 리조트를 짓는다나.', '울릉도만이 아니래. 독도까지 개발한다는 소문이 돌더구나.'] : []), `이번 조사 주제는 ‘${z.histTitle}’란다.`, '자료를 읽을 때 누가, 언제 만들었는지 살펴보렴. 출처도 직접 확인하면 좋겠지?', z.hint] },
    { key: '5', actor: 'woman', name: '미소 아줌마', lines: [...(ul ? ['울릉도에 온 걸 환영해! 요즘 공사 소리 때문에 우산몬들이 잠을 못 잔대.'] : []), '반가워! 탐험하다 지치면 쉼터지기에게 가 보렴.', '동료 하트를 채우고, 수첩에서 헷갈린 개념을 천천히 다시 읽어 봐.'] }
  ];
}

// 몽땅랜드: 수집원·조사원·기록 관리자는 대원, 먹선·쇄도·무음은 팀장, 마지막은 백무 사장.
export const VILLAIN_BY_ZONE = ['villain-grunt-m', 'villain-grunt-f', 'villain-grunt-m', 'villain-exec-ink', 'villain-exec-crimson', 'villain-grunt-f', 'villain-exec-indigo', 'villain-leader'];
export const ROLE_ACTOR = zone => ({
  history: zone === 0 ? 'professor' : zone === 4 || zone === 7 ? 'child-girl' : 'man',
  guide: 'child-boy', enemy: VILLAIN_BY_ZONE[zone],
  boss: zone % 2 ? 'woman' : 'man', shop: 'woman', prof: 'woman', extra: 'man'
});

// Everyone and everything you can talk to on a map. `flags` records one-time objects.
export function npcs(ref = 0, progress = {}, flags = {}) {
  const map = Array.isArray(ref) && ref.def ? ref : createMap(ref);
  const parsed = map.parsed, zone = map.zone, z = ZONES[zone], actors = ROLE_ACTOR(zone), list = [];
  const at = role => parsed.roles[role];
  if (map.kind === 'town') {
    const roles = [
      ['history', { name: z.npc, kind: zone === 0 ? 'normal' : 'history' }],
      ['guide', { name: '나루' }],
      ['board', { name: '탐험 기록판', kind: 'board' }],
      ['enemy', { name: z.enemy, kind: 'enemy', hidden: !!progress.enemy }],
      ['boss', { name: keeperName(z) }],
      ['shop', { name: '쉼터지기' }],
      ['prof', { name: '연구 안내원' }]
    ];
    roles.forEach(([id, info], i) => { const p = at(id); if (p) list.push({ id, x: p.x, y: p.y, sprite: `npc/${String(zone + 1).padStart(2, '0')}/${String(i + 1).padStart(2, '0')}`, ...info }); });
    EXTRA_NPCS.filter(n => n.zone === zone).forEach((n, i) => { const p = at(`extra${i}`); if (p) list.push({ ...n, id: 'extra', kind: 'history', x: p.x, y: p.y }); });
    // 풀숲 위에 서 있는 야생 우산몬은 두지 않아요. 사나워진 우산몬은 풀숲을 걸을 때 갑자기 나타나요.
    for (const r of villageResidents(zone)) { const p = parsed.residents[r.key]; if (p) list.push({ ...r, id: 'resident', kind: 'resident', x: p.x, y: p.y }); }
  }
  // 전설의 우산몬(천연기념물): 조건을 채우면 정해진 칸에 금빛 기운이 나타나요 (legends.js)
  for (const o of [...parsed.objects, ...legendSpots(map.id, flags)]) {
    const flag = `${map.id}:${o.key}`, used = !!flags[flag];
    if (o.type === 'trash' && used) continue;
    list.push({ ...o, id: o.type, kind: o.type, flag, used, objectKey: o.key });
  }
  return list.filter(n => !n.hidden).map(n => ({
    ...n,
    uid: `${map.id}:${n.objectKey ? 'obj' + n.objectKey : n.id}:${n.actor || n.name}`,
    actor: n.actor || actors[n.id] || null
  }));
}

// v0.71 물: 땅에 맞닿은 얕은 물은 첨벙첨벙 걷고, 그보다 깊은 물에선 잠수해요(바닷속). 마을 사람들은 물에 들어가지 않아요(wade = false).
export function blocked(map, x, y, people = [], ignorePeople = false, wade = true) {
  if (x < 0 || y < 0 || y >= map.length || x >= map[0].length) return true;
  const t = map[y][x];
  if (map.solid?.has(`${x},${y}`)) return true; // v0.74 물 위에 놓인 소파블록·바위도 막혀요
  if (map.diving && map.uwSolid?.has(`${x},${y}`)) return true; // v0.87 바닷속 바위 지형(바닥 닿는 칸만)
  if (!map.diving && map.hull?.has(`${x},${y}`)) return true; // v0.87 배(물 위에서만)
  if (t === 0 && wade && map.kind !== 'room') return !ignorePeople && people.some(n => (n.occupied || [n]).some(p => p.x === x && p.y === y)); // v0.71 물속까지(얕은 물은 걷고, 깊은 물은 잠수)
  if (t === 0 || t === 5 || t === 7 || t === 8 || t === 9 || map.solid?.has(`${x},${y}`)) return true;
  return !ignorePeople && people.some(n => (n.occupied || [n]).some(p => p.x === x && p.y === y));
}

export function pathfind(map, sx, sy, tx, ty, people = []) {
  if (blocked(map, tx, ty, people)) return [];
  const key = (x, y) => `${x},${y}`, queue = [[sx, sy]], seen = new Set([key(sx, sy)]), prev = new Map();
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    if (x === tx && y === ty) {
      const out = []; let k = key(x, y);
      while (k !== key(sx, sy)) { out.push(k.split(',').map(Number)); k = prev.get(k); if (!k) return []; }
      return out.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      const portal = map[ny]?.[nx] >= 13 && map[ny]?.[nx] <= 15 && !(nx === tx && ny === ty); // doors and stairs only as the goal
      if (!seen.has(k) && !portal && !blocked(map, nx, ny, people)) { seen.add(k); prev.set(k, key(x, y)); queue.push([nx, ny]); }
    }
  }
  return [];
}

function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.floor(x), Math.floor(y), w, h); }
// 울릉도: 후박나무·동백나무 / 독도: 키 큰 나무 없이 사철나무 덤불과 해국 (소나무는 쓰지 않아요)
const ulleung = map => map?.def?.island === '울릉도';
// 건물 그림 이름(2D·3D 같이 써요). v0.74: 동도(등대·경비대)와 서도(주민숙소)를 나눠 그려요(art/실사-참고표.md)
export const buildingArt = (map, b) => {
  if (b.kind === 'terminal') return 'ulleung-terminal'; if (b.kind === 'house') return `ulleung-house${b.v || 1}`; if (b.kind === 'block') return `ulleung-block${(b.v || 1) % 3 + 1}`;
  if (ulleung(map)) return `ulleung-${b.kind}`;
  const west = (map?.def?.island || '').includes('서도');
  return b.kind === 'home' ? 'dokdo-home' : b.kind === 'gym' && west ? 'dokdo-gym' : `dokdo-${west ? 'west' : 'east'}-${b.kind}`;
};
// v0.67 타일셋 v2의 물건 그림(나무·덤불·바위). 그림이 아직 없으면 false를 돌려줘서 예전 그림으로 그려요.
function drawV2(ctx, name, dx, dy) {
  const img = assetImage(V2_OBJECTS.key), r = V2_OBJECTS.sprites[name]; if (!img || !r) return false;
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, r[0], r[1], r[2], r[3], Math.round(dx), Math.round(dy), r[2], r[3]); ctx.restore(); return true;
}
// 나무는 바람에 살랑살랑 흔들려요(v0.64): 밑동은 그대로 두고 위로 갈수록 옆으로 기울여요. 나무마다 박자가 조금씩 달라요.
// v0.67: 울릉도는 타일셋 v2의 바늘잎나무·넓은잎나무(64×64), 독도는 키 작은 덤불·꽃 덤불(32×32). 아랫변 가운데가 칸의 발 자리예요.
function tree(ctx, x, y, map, time = 0) {
  const k = ((x / 32) * 7 + (y / 32) * 13) % 3, isle = ulleung(map);
  const key = isle ? ['tree-dongbaek', 'tree-hubak', 'tree-pine'][k] : (k === 0 ? 'shrub-haeguk' : 'shrub-saecheol');
  const v2 = isle ? (k === 1 ? 'ul_leaf_tree' : 'ul_pine_tree') : (k === 0 ? 'ul_flowering_bush' : 'ul_bush');
  const sway = Math.sin(time / 760 + x * .045 + y * .03) * (isle ? .028 : .012) + Math.sin(time / 240 + x * .11) * .006, base = y + 30;
  ctx.save(); ctx.transform(1, 0, sway, 1, -sway * base, 0);
  if (!(isle ? drawV2(ctx, v2, x - 16, y + 32 - 64) : drawV2(ctx, v2, x, y)) && !drawIslandArt(ctx, key, x - 24, y - 56, 80, 88)) drawTreeDefault(ctx, x, y);
  ctx.restore();
}
export function drawTreeDefault(ctx, x, y) {
  const r = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  r(-9, 15, 29, 8, '#375e4a22'); r(4, 0, 7, 24, '#816f50'); r(-8, -22, 30, 27, '#427e65'); r(-13, -14, 40, 20, '#427e65'); r(-3, -29, 20, 10, '#73a97a');
}
// Buildings look like the island they stand on (울릉도: 투막집·너와집·터미널 / 독도: 등대·경비대 숙소·주민숙소).
// Each picture is exactly as wide as its plot plus 8px eaves on both sides, with the door above the middle tile.
function house(ctx, b, labels = true, map = null) {
  const key = buildingArt(map, b);
  if (!drawIslandArt(ctx, key, b.x * TILE - 8, b.y * TILE - 40, b.w * TILE + 16, b.h * TILE + 40) && !drawScenery(ctx, b.kind, b.x * TILE - 8, b.y * TILE - 40, b.w * TILE + 16, b.h * TILE + 40)) { drawHouseDefault(ctx, b, labels); return; }
  if (!labels) return;
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#345c52'; ctx.fillText(b.name, (b.x + b.w / 2) * TILE, (b.y + b.h) * TILE + 14);
}
export function drawHouseDefault(ctx, b, labels = true) {
  const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
  rect(ctx, x + 7, y + 48, w - 14, h - 48, '#e9dfbd'); rect(ctx, x - 5, y + 12, w + 10, 45, b.color); rect(ctx, x + 16, y - 6, w - 32, 12, b.color);
  rect(ctx, x + w / 2 - 15, y + h - 47, 30, 47, '#375a60');
  if (labels) { ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#345c52'; ctx.fillText(b.name, x + w / 2, y + h + 14); }
}

// Inside a building (focus = the room): a room smaller than the screen sits in the middle,
// a bigger one scrolls but never shows more than a tile of darkness beyond its walls.
export function cameraFor(view, width = 768, height = 480, focus = null, dims = { w: W, h: H }) {
  const axis = (p, size, lo, len, total) => {
    if (!focus) return Math.max(0, Math.min(total - size, p * TILE - size / 2 + 16));
    const a = lo * TILE, span = len * TILE;
    if (span + 2 * TILE <= size) return a + span / 2 - size / 2;
    return Math.max(a - TILE, Math.min(a + span + TILE - size, p * TILE - size / 2 + 16));
  };
  return {
    x: Math.floor(axis(view.x, width, focus?.x, focus?.w, dims.w * TILE)),
    y: Math.floor(axis(view.y, height, focus?.y, focus?.h, dims.h * TILE))
  };
}

export function drawWorld(ctx, map, state, view, time, target = null, motion = { walking: false, distance: 0 }, viewport = { width: 768, height: 480, labels: true }, people = npcs(map, state.progress[state.zone], state.flags)) {
  const z = ZONES[state.zone], { width, height } = viewport, room = map.kind === 'room', { x: camX, y: camY } = cameraFor(view, width, height, room ? map.focus : null, { w: map[0].length, h: map.length });
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = room ? '#0e1418' : seasonColor(z.color); ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(-camX, -camY);
  if (room) drawInterior(ctx, map, time, { x: camX, y: camY, width, height });
  else { drawTerrain(ctx, map, time, { x: camX, y: camY, width, height, seabed: viewport.seabed || false }); for (const g of map.ground || []) drawGround(ctx, g, time); }
  if (target) { ctx.fillStyle = '#fff1b440'; ctx.fillRect(target.x * 32, target.y * 32, 32, 32); ctx.strokeStyle = '#f6d37d'; ctx.lineWidth = 2; ctx.strokeRect(target.x * 32 + 3, target.y * 32 + 3, 26, 26); }
  if (viewport.actors !== false) drawActors(ctx, state, view, time, motion, people, map);
  if (viewport.labels) for (const n of people) if (n.actor) drawNPCNameplate(ctx, n.name, (n.drawX ?? n.x) * 32 + 16, (n.drawY ?? n.y) * 32 + 35, camX, camY);
  ctx.restore(); return { x: camX, y: camY };
}

export function drawNPCNameplate(ctx, name, cx, y, camX = 0, camY = 0) {
  if (cx < camX || cx > camX + 768) return;
  ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const width = Math.ceil(ctx.measureText(name)?.width || name.length * 12) + 18, height = 24;
  const x = Math.round(Math.max(camX + 3, Math.min(camX + 768 - width - 3, cx - width / 2))); y = Math.round(y);
  if (y + height < camY || y > camY + 480) { ctx.restore(); return; }
  rect(ctx, x + 2, y, width - 4, height, '#213e48'); rect(ctx, x, y + 2, width, height - 4, '#213e48');
  ctx.fillStyle = '#fff5d7'; ctx.fillText(name, x + width / 2, y + height / 2); ctx.restore();
}

// What the yellow quest marker points at in a town.
export function wantedRole(p) { return !p.met ? 'history' : p.studied < 2 ? 'board' : !p.enemy ? 'enemy' : !p.boss ? 'boss' : null; }

// 사나워짐: wild 우산몬 on the map are wrapped in drifting dark energy.
function darkWisps(ctx, x, y, time) {
  const cx = x * 32 + 16, cy = y * 32 + 18;
  ctx.save(); ctx.globalAlpha = .28 + .1 * Math.sin(time / 300); ctx.fillStyle = '#3b1d5c'; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 6; i++) { const age = (time / 30 + i * 23) % 60; ctx.globalAlpha = Math.max(0, .55 - age / 110); ctx.fillStyle = i % 2 ? '#4a1f7a' : '#1a0f2e'; ctx.fillRect(Math.round(cx - 14 + i * 5 + Math.sin(time / 400 + i) * 3), Math.round(cy + 8 - age * .7), 3, 3); }
  ctx.restore();
}
// v0.51 걸어 다니는 우산몬의 발밑 그림자(뛰어오르면 작고 옅어져요)
function groundShadow(ctx, cx, cy, rx, hop = 0) {
  const k = 1 - Math.min(.35, hop / 10);
  ctx.save(); ctx.globalAlpha = .26 * k; ctx.fillStyle = '#1b2a1c';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * k, rx * .32 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
// 전설의 기운: 발밑의 금빛 원과 위로 떠오르는 반짝이
function legendGlow(ctx, x, y, time) {
  const cx = x * 32 + 16, cy = y * 32 + 26;
  ctx.save(); ctx.globalAlpha = .35 + .15 * Math.sin(time / 260); ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.ellipse(cx, cy, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 8; i++) { const age = (time / 14 + i * 47) % 100; ctx.globalAlpha = .8 * (1 - age / 100); rect(ctx, cx - 14 + (i * 37) % 28, cy - age * .5, 2, 2, i % 2 ? '#fff6c8' : '#ffd86a'); }
  ctx.restore();
}
function marker(ctx, x, y, time, color = '#fbdf86') {
  const top = y * 32 + 28 - CHARACTER_SIZE - 22 + Math.sin(time / 250) * 2;
  rect(ctx, x * 32 + 8, top, 16, 18, color); rect(ctx, x * 32 + 14, top + 3, 3, 7, '#5f4a2e'); rect(ctx, x * 32 + 14, top + 12, 3, 2, '#5f4a2e');
}

// One depth pass for houses, scenery, props and people, ordered by their feet.
// project(입체 시점, view3d.js): 땅 위의 점 (wx, wy) → { x, y, k } 화면 위치와 크기. 주면 하나하나를 발밑 기준으로 세워서 그려요.
export function drawActors(ctx, state, view, time, motion = { walking: false, distance: 0 }, people = null, map = null, project = null) {
  map ||= createMap(state.map || state.zone);
  people ||= npcs(map, state.progress[state.zone], state.flags);
  const wanted = map.kind === 'town' ? wantedRole(state.progress[state.zone] || {}) : null;
  const base = project && typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  const seen = d => project?.seen ? project.seen(d) : d; // 3D 보기에서는 카메라에서 보이는 쪽 모습으로
  const env = { map, state, time, motion, wanted, seen };
  let order = sceneDrawOrder(people, view, map);
  if (map?.diving) order = order.filter(n => n.player || ((n.kind === 'wild' || n.kind === 'friend') && map[Math.round(n.y)]?.[Math.round(n.x)] === 0)); // v0.92 2D 바닷속: 물 위의 배·난간·건물·나무·안내판은 그리지 않아요(물속 야생 우산몬만)
  if (!base) { for (const n of order) drawOne(n); }
  else {
    // 3D 보기(v0.62): 먼 것부터 가까운 것 순서로 세워 그려요. 카메라와 내 캐릭터 사이에 있는 것은 비쳐 보이게 해요.
    const list = [];
    for (const n of order) {
      if (n.scenery === 'boat' || n.scenery === 'ferry') continue; // v0.68: 배는 위에서 본 그림이라 3D에서는 물 위에 눕혀 그려요(drawFlatDecor)
      const slabKind = project.slab && (n.kind === 'board' ? 'board' : PROP_KINDS.includes(n.kind) ? n.kind : n.scenery); // v0.71 납작한 물건은 앞·뒤·옆이 있는 판으로
      if (project.slab && project.slab.has(slabKind) && !n.player) { const fx = n.x * TILE + (n.w ? n.w * 16 : 16), fy = n.depth, p = project(fx, fy); if (p && p.k > 0 && !(project.fadeZ && p.z < project.fadeZ * .85)) list.push({ n, fx, fy, p, slab: slabKind }); continue; }
      if (n.building && project.box) { const z = project.box.depth(n.building); if (z != null) { list.push({ n, box: true, p: { z } }); continue; } } // v0.68: 입체 건물(box3d.js)
      const fx = n.building ? (n.building.x + n.building.w / 2) * TILE : n.x * TILE + (n.w ? n.w * 16 : 16), fy = n.depth, p = project(fx, fy);
      if (!p || p.k <= 0) continue;
      if (!n.player && project.fadeZ && p.z < project.fadeZ * .7) continue; // 카메라 바로 앞을 가리는 것은 그리지 않아요
      list.push({ n, fx, fy, p });
    }
    for (const w of project.walls || []) list.push({ wall: w, p: { z: w.z } }); // v0.70 언덕 둘레 바위벽
    // v0.73 그리는 순서 바로잡기: 건물·벽처럼 큰 것은 ‘가장 가까운 점’ 거리만으로는 사람과 앞뒤가 틀려요(문 앞에 선 사람이 건물에 가려졌어요).
    //   카메라 → 사람 발끝 선이 건물 바닥(또는 벽)을 지나면 사람은 그 뒤 → 먼저 그리고, 안 지나고 건물 먼 쪽보다 가까우면 앞 → 나중에 그려요.
    const cam = project.cam;
    if (cam) {
      const segSeg = (ax, ay, bx, by, cx, cy, dx, dy) => { const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (Math.abs(d) < 1e-9) return false; const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d; return t > 0 && t < 1 && u >= 0 && u <= 1; };
      const zOf = (x, y) => (x - cam.x) * cam.fx + (y - cam.y) * cam.fy;
      const occ = [];
      for (const it of list) {
        if (it.box) { const r = project.box.box(it.n.building); if (!r) continue; const e = [[r.x0, r.yB, r.x1, r.yB], [r.x1, r.yB, r.x1, r.yF], [r.x1, r.yF, r.x0, r.yF], [r.x0, r.yF, r.x0, r.yB]]; occ.push({ it, hit: (x, y) => e.some(s => segSeg(cam.x, cam.y, x, y, ...s)), far: Math.max(zOf(r.x0, r.yB), zOf(r.x1, r.yB), zOf(r.x0, r.yF), zOf(r.x1, r.yF)) }); }
        else if (it.wall) { const w = it.wall; occ.push({ it, hit: (x, y) => segSeg(cam.x, cam.y, x, y, w.x0, w.y0, w.x1, w.y1), far: Math.max(zOf(w.x0, w.y0), zOf(w.x1, w.y1)) }); }
      }
      for (const it of list) {
        if (it.box || it.wall || it.fx == null) continue; let k = it.p.z;
        for (const o of occ) { const oz = o.it.p.z; if (o.hit(it.fx, it.fy)) k = Math.max(k, oz + 1); else if (k > oz && it.p.z < o.far) k = Math.min(k, oz - 1); }
        it.key = k;
      }
    }
    list.sort((a, b) => (b.key ?? b.p.z ?? 0) - (a.key ?? a.p.z ?? 0));
    for (const { n, fx, fy, p, box, wall, slab } of list) { const fa = project.fog && !n?.player ? 1 - project.fog(p.z ?? 0) : 1; if (fa < .04) continue; ctx.save(); ctx.globalAlpha *= fa; drawItem(); ctx.restore(); function drawItem() { if (slab) { ctx.save(); ctx.setTransform(base); if (project.fadeZ && p.z < project.fadeZ) ctx.globalAlpha *= .3; project.slab.draw(ctx, n, slab, fx, fy, g => { const keep = ctx; ctx = g; drawOne(slab === 'railv' ? { ...n, scenery: 'rail', w: 1 } : n); ctx = keep; }); ctx.restore(); return; } if (wall) { ctx.save(); ctx.setTransform(base); project.drawWall(ctx, wall); ctx.restore(); return; } if (box) { ctx.save(); ctx.setTransform(base); project.box.draw(ctx, n.building); ctx.restore(); return; } ctx.save(); if (!n.player && project.fadeZ && p.z < project.fadeZ) ctx.globalAlpha *= .22; ctx.setTransform(base.a * p.k, 0, 0, base.d * p.k, base.a * (p.x - fx * p.k), base.d * (p.y - fy * p.k)); drawOne(n); ctx.restore(); } } // v0.71 바닷속 안개: 멀수록 흐리게
  }
  function drawOne(n) { paintActor(ctx, n, env); }
}

// v0.77 물건·사람 하나를 2D로 그려요(2D 화면, 예전 3D, 새 3D(WebGL)의 그림 칸이 모두 함께 써요)
// env: { map, state, time, motion, wanted, seen }
export function paintActor(ctx, n, env) {
  const { map, state, time, motion, wanted, seen } = env;
  if (n.scenery) { drawDecor(ctx, n, map, time); return; }
  const fx = n.x * 32 + (32 - CHARACTER_SIZE) / 2, fy = n.y * 32 + 28 - CHARACTER_SIZE;
  if (n.furniture) drawFurniture(ctx, n.furniture, n.x, n.y, time, { open: n.used, glow: n.kind === 'rest', map });
  else if (n.kind === 'board') drawIslandArt(ctx, 'record-board', n.x * 32 - 8, n.y * 32 - 16, 48, 54);
  else if (n.kind === 'wild' || n.kind === 'friend') { // 걸어 다니는 우산몬: 가는 쪽을 보고, 걸을 때 통통 튀어요 (사나워진 우산몬만 검은 기운)
    if (n.kind === 'wild') darkWisps(ctx, n.x, n.y, time);
    const f = facing(n.species), nd = seen(n.dir), flip = (nd === 'right' && f === 'left') || (nd === 'left' && f === 'right'), hop = n.walking ? Math.abs(Math.sin(time / 70)) * 3 : 0;
    if (map?.diving && SURFACE_BIRDS.has(Number(n.species))) return; // v0.72 물 위의 새는 잠수했을 때 안 보여요(머리 위 물낯에 떠 있어요)
    const swim = map?.[Math.round(n.y)]?.[Math.round(n.x)] === 0 && (!map.diving || SURFACE_BIRDS.has(Number(n.species))); // v0.70 물속 우산몬: 물결 위로 몸 위쪽만 보이고 둥실 떠요(v0.71 잠수하면 온몸이 보여요)
    if (swim) {
      const bob = Math.sin(time / 420 + n.x * 1.7) * 2, line = n.y * 32 + 20;
      ctx.save(); ctx.beginPath(); ctx.rect(n.x * 32 - 24, n.y * 32 - 60, 80, line - (n.y * 32 - 60)); ctx.clip();
      if (flip) { ctx.translate(n.x * 32 * 2 + 32, 0); ctx.scale(-1, 1); }
      drawMonsterField(ctx, n.species, n.x * 32 - 6, n.y * 32 - 8 + bob, 44, time / 1000); ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5; const w = 14 + Math.sin(time / 300 + n.x) * 2;
      ctx.beginPath(); ctx.ellipse(n.x * 32 + 16, line, w, 4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = .45; ctx.beginPath(); ctx.ellipse(n.x * 32 + 16, line + 1, w + 6, 6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    } else {
    groundShadow(ctx, n.x * 32 + 16, n.y * 32 + 29, 13, hop); // 발밑 그림자: 통통 튈 때는 조금 작아져요
    ctx.save(); if (flip) { ctx.translate(n.x * 32 * 2 + 32, 0); ctx.scale(-1, 1); }
    drawMonsterField(ctx, n.species, n.x * 32 - 6, n.y * 32 - 12 - hop, 44, time / 1000); ctx.restore();
    }
  }
  else if (n.kind === 'legend') { legendGlow(ctx, n.x, n.y, time); drawMonsterField(ctx, n.species, n.x * 32 - 10, n.y * 32 - 22 + Math.round(Math.sin(time / 300) * 2), 52, time / 1000); if (!n.used) marker(ctx, n.x, n.y, time, '#ffe9a0'); }
  else if (PROP_KINDS.includes(n.kind)) drawProp(ctx, n.kind, n.x, n.y, { open: n.used, art: n.art, name: n.name, region: n.region, rock: n.rock, time, water: map[n.y]?.[n.x] === 0 });
  else if (n.player) {
    const tx = Math.round(n.x), ty = Math.round(n.y), wet = map?.[ty]?.[tx] === 0 && !map.diving, deep = wet && !map.shallow?.has(`${tx},${ty}`); // v0.71 얕은 물: 무릎까지 · v0.82 깊은 물: 가슴까지 잠겨 헤엄쳐요(둥실 떠요)
    const bob = deep ? Math.round(Math.sin(time / 380) * 1.5) : 0, sink = deep ? 4 : 0, line = n.y * 32 + (deep ? 10 + bob : 22);
    if (wet) { ctx.save(); ctx.beginPath(); ctx.rect(n.x * 32 - 40, n.y * 32 - 90, 112, line - (n.y * 32 - 90)); ctx.clip(); }
    if (!drawExplorer(ctx, state.avatar, fx, fy + sink + bob, CHARACTER_SIZE, seen(state.dir), motion.walking, motion.distance || 0)) drawHuman(ctx, fx, fy + sink + bob, '#418e91', state.dir, 0, 'normal', null, CHARACTER_SIZE);
    if (wet) { ctx.restore(); ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; const w = 12 + Math.sin(time / 260) * 2; ctx.beginPath(); ctx.ellipse(n.x * 32 + 16, line, w, 4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = .4; ctx.beginPath(); ctx.ellipse(n.x * 32 + 16, line + 1, w + 7, 6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
  else if (n.actor && drawResident(ctx, n.actor, fx, fy, CHARACTER_SIZE, time, seen(n.dir || 'down'), n.walking || false, n.walkDistance || 0)) { /* drawn */ }
  else drawHuman(ctx, fx, fy, n.color || '#a88668', 'down', 0, n.kind, n.sprite, CHARACTER_SIZE);
  if (!n.player && wanted && n.id === wanted) marker(ctx, n.x, n.y, time);
  if (n.kind === 'trainer' && !n.used) marker(ctx, n.x, n.y, time, '#f0a07a');
}

// v0.68 들꽃: 줄기 위에 다섯 점 꽃. 한 칸에 두세 송이가 같은 땅선(칸 위에서 22)에 서서 바람에 살짝 흔들려요.
// 꽃 색은 계절(season.js)을 따라요.
function wildFlowers(ctx, tx, ty, time, common = true) {
  const h = (i, s) => { let v = Math.imul(tx * 73 + ty * 151 + i * 29 + s, 2654435761) >>> 0; v ^= v >>> 15; return ((v >>> 0) % 1000) / 1000; };
  const pal = seasonFlowers(), spring = pal && seasonName() === 'spring'; if (!pal || (!common && !spring)) return; // v0.70: 봄엔 꽃이 만개(자리도 송이도 많아요)
  const n = (spring ? 4 : 2) + Math.floor(h(0, 1) * 2);
  for (let i = 0; i < n; i++) {
    const x = Math.round(tx * 32 + 5 + h(i, 2) * 22), base = ty * 32 + 22, tall = 4 + Math.floor(h(i, 3) * 4), sway = Math.round(Math.sin(time / 700 + tx + i) * .8), c = pal[Math.floor(h(i, 4) * pal.length)];
    ctx.fillStyle = '#4f8f3a'; ctx.fillRect(x, base - tall, 1, tall); ctx.fillRect(x + 1, base - 2, 1, 1);
    const fx = x + sway, fy = base - tall - 1;
    ctx.fillStyle = c[0]; ctx.fillRect(fx, fy - 1, 1, 1); ctx.fillRect(fx - 1, fy, 3, 1); ctx.fillStyle = c[1]; ctx.fillRect(fx, fy + 1, 1, 1); ctx.fillRect(fx + 1, fy, 1, 1); ctx.fillStyle = c[2]; ctx.fillRect(fx, fy, 1, 1);
  }
}
// v0.68 3D 보기: 위에서 내려다본 그림(배)은 세우지 않고 땅 그림 위에 눕혀 그려요. 물결 따라 살짝 흔들려요.
export function drawFlatDecor(ctx, map, time) {
  for (const d of map.decor) if (d.kind === 'boat' || d.kind === 'ferry') { const bob = Math.round(Math.sin(time / 650 + d.x) * 1.5); ctx.save(); ctx.translate(0, bob); drawDecor(ctx, { scenery: d.kind, x: d.x, y: d.y }, map, time); ctx.restore(); }
}
function drawDecor(ctx, n, map, time) {
  if (n.building) return house(ctx, n.building, false, map);
  if (n.scenery in FURNITURE_DEPTH) return drawFurniture(ctx, n.scenery, n.x, n.y, time, { map });
  switch (n.scenery) {
    case 'tree': return tree(ctx, n.x * 32, n.y * 32, map, time);
    case 'flower': return wildFlowers(ctx, n.x, n.y, time, n.common);
    case 'fence': return drawIslandArt(ctx, ulleung(map) ? 'wall-stone' : 'rail-wood', n.x * 32, n.y * 32 - 6, 64, 36, n.w * 32);
    case 'rail': return drawIslandArt(ctx, 'rail-steel', n.x * 32, n.y * 32 - 6, 64, 36, n.w * 32); // v0.74 쇠 난간(해안산책로·보행교·선착장)
    case 'railv': return drawIslandArt(ctx, 'rail-steel-v', n.x * 32, n.y * 32 - 8, 32, 44);
    case 'tetrapods': return drawIslandArt(ctx, 'tetrapods', n.x * 32 - 4, n.y * 32 - 6, 40, 40); // v0.74 소파블록
    case 'planter': return propArt(ctx, 'planter', n.x * 32 + 16, n.y * 32 + 29) || drawScenery(ctx, 'planter', n.x * 32 - 4, n.y * 32 + 3, 40, 28);
    case 'monument': { // 두 섬 조형물: 돌 받침대 위의 도트 독도(v0.39)
      const pics = assetImage(CUTSCENE_ATLAS.key), f = CUTSCENE_ATLAS.frames['dokdo-224'];
      if (pics && f && propArt(ctx, 'pedestal', n.x * 32 + 48, (n.y + 1) * 32 - 2)) { const w = 84, h = Math.round(w * f[3] / f[2]); ctx.drawImage(pics, f[0], f[1], f[2], f[3], n.x * 32 + 6, (n.y + 1) * 32 - 16 - h, w, h); return; }
      return drawScenery(ctx, 'monument', n.x * 32, (n.y + 1) * 32 - 80, 96, 80);
    }
    case 'boat': return drawScenery(ctx, 'boat', n.x * 32 - 16, n.y * 32 - 30, 64, 100);
    case 'ferry': return drawIslandArt(ctx, 'ferry', n.x * 32 - 30, n.y * 32 - 16, 92, 208); // v0.74 여객선(위에서 본 모습, 3D에서도 물 위에 눕혀요)
    case 'rock': return drawV2(ctx, 'dd_small_boulder', n.x * 32, n.y * 32) || drawProp(ctx, 'rock', n.x, n.y, { water: map[n.y]?.[n.x] === 0, time }); // v0.67: 타일셋 v2 바위
    case 'crag': return drawProp(ctx, 'crag', n.x, n.y, { w: n.w, h: n.h });
    case 'beacon': return drawProp(ctx, 'beacon', n.x, n.y, { time });
    case 'barrier': return drawProp(ctx, 'barrier', n.x, n.y);
  }
}

// Whole objects and people share one foot-point depth order.
export function sceneDrawOrder(people, view, map = createMap(0)) {
  const items = people.map(n => ({ ...n, x: n.drawX ?? n.x, y: n.drawY ?? n.y, depth: (n.drawY ?? n.y) * TILE + 28, player: false }));
  items.push({ x: view.x, y: view.y, depth: view.y * TILE + 28, player: true });
  for (const b of map.buildings) items.push({ scenery: b.kind, building: b, depth: (b.y + b.h) * TILE });
  for (const b of map.structures || []) items.push({ scenery: b.kind, building: b, depth: (b.y + b.h) * TILE }); // v0.74 터미널·시가지 집
  for (const d of map.decor) {
    if (d.kind === 'fence' || d.kind === 'rail') { for (let i = 0; i < d.len; i += 2) items.push({ scenery: d.kind, x: d.x + i, y: d.y, w: Math.min(2, d.len - i), depth: d.y * TILE + 27 }); continue; }
    const depth = { flower: 22, tree: 24, beacon: 28, barrier: 27, planter: 29, monument: 32, boat: 70, ferry: -40, rock: 26, crag: 30, tetrapods: 26, railv: 28, ...FURNITURE_DEPTH }[d.kind] ?? 24;
    items.push({ scenery: d.kind, x: d.x, y: d.y, w: d.w, h: d.h, common: d.common, depth: d.y * TILE + depth });
  }
  return items.sort((a, b) => a.depth - b.depth);
}

export function mapLabel(id) { return getMapDef(id).name; }
