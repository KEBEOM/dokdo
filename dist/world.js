import { ZONES, EXTRA_NPCS, getSpecies } from './data.js';
import { drawHuman, drawMonster } from './sprites.js';
import { drawScenery, drawIslandArt } from './scenery.js';
import { drawTerrain } from './terrain.js';
import { drawExplorer, drawResident, CHARACTER_SIZE } from './characters.js';
import { parseMap, getMapDef, MAP_W, MAP_H } from './maps.js';
import { drawProp, drawGround, propArt } from './props.js';
import { CUTSCENE_ATLAS } from './cutscene-atlas.js';
import { assetImage } from './assets.js';
import { drawInterior, drawFurniture, FURNITURE_DEPTH } from './interior-art.js';
import { legendSpots } from './legends.js';

export const TILE = 32, W = MAP_W, H = MAP_H;
export const PROP_KINDS = ['sign', 'landmark', 'box', 'trash', 'observe', 'stone', 'legend'];

// A tile grid (rows of tile codes) carrying the parsed map: buildings, decor, exits, spawns.
export function createMap(ref = 0) {
  const parsed = parseMap(ref), def = parsed.def;
  const grid = parsed.grid.map(row => row.slice());
  const keepClear = new Set([...parsed.exits.keys(), ...Object.values(parsed.spawns).map(p => `${p.x},${p.y}`)]);
  for (const b of parsed.buildings) keepClear.add(`${b.x + Math.floor(b.w / 2)},${b.y + b.h}`);
  return Object.assign(grid, {
    id: def.id, def, zone: def.zone, kind: def.kind, name: def.name,
    solid: parsed.solid, exits: parsed.exits, spawns: parsed.spawns,
    buildings: parsed.buildings, decor: parsed.decor, ground: parsed.ground || [], rockTiles: parsed.rockTiles, keepClear, parsed,
    doors: parsed.doors || [], stairs: parsed.stairs || [], focus: parsed.focus || null
  });
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
    { key: '5', actor: 'woman', name: '미소 아줌마', lines: [...(ul ? ['울릉도에 온 걸 환영해! 요즘 공사 소리 때문에 우산몬들이 잠을 못 잔대.'] : []), '반가워! 탐험하다 지치면 쉼터지기에게 가 보렴.', '동료 체력을 회복하고, 수첩에서 헷갈린 개념을 천천히 다시 읽어 봐.'] }
  ];
}

// 몽땅랜드: 수집원·조사원·기록 관리자는 대원, 먹선·쇄도·무음은 팀장, 마지막은 백무 사장.
export const VILLAIN_BY_ZONE = ['villain-grunt-m', 'villain-grunt-f', 'villain-grunt-m', 'villain-exec-ink', 'villain-exec-crimson', 'villain-grunt-f', 'villain-exec-indigo', 'villain-leader'];
const ROLE_ACTOR = zone => ({
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
      ['boss', { name: `관장 ${z.boss}` }],
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

export function blocked(map, x, y, people = [], ignorePeople = false) {
  if (x < 0 || y < 0 || x >= W || y >= H) return true;
  const t = map[y][x];
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
function tree(ctx, x, y, map) {
  const k = ((x / 32) * 7 + (y / 32) * 13) % 3, key = ulleung(map) ? (k === 0 ? 'tree-dongbaek' : 'tree-hubak') : (k === 0 ? 'shrub-haeguk' : 'shrub-saecheol');
  if (!drawIslandArt(ctx, key, x - 24, y - 56, 80, 88)) drawTreeDefault(ctx, x, y);
}
export function drawTreeDefault(ctx, x, y) {
  const r = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  r(-9, 15, 29, 8, '#375e4a22'); r(4, 0, 7, 24, '#816f50'); r(-8, -22, 30, 27, '#427e65'); r(-13, -14, 40, 20, '#427e65'); r(-3, -29, 20, 10, '#73a97a');
}
// Buildings look like the island they stand on (울릉도: 투막집·너와집·터미널 / 독도: 등대·경비대 숙소·주민숙소).
// Each picture is exactly as wide as its plot plus 8px eaves on both sides, with the door above the middle tile.
function house(ctx, b, labels = true, map = null) {
  const key = `${ulleung(map) ? 'ulleung' : 'dokdo'}-${b.kind}`;
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
export function cameraFor(view, width = 768, height = 480, focus = null) {
  const axis = (p, size, lo, len, total) => {
    if (!focus) return Math.max(0, Math.min(total - size, p * TILE - size / 2 + 16));
    const a = lo * TILE, span = len * TILE;
    if (span + 2 * TILE <= size) return a + span / 2 - size / 2;
    return Math.max(a - TILE, Math.min(a + span + TILE - size, p * TILE - size / 2 + 16));
  };
  return {
    x: Math.floor(axis(view.x, width, focus?.x, focus?.w, W * TILE)),
    y: Math.floor(axis(view.y, height, focus?.y, focus?.h, H * TILE))
  };
}

export function drawWorld(ctx, map, state, view, time, target = null, motion = { walking: false, distance: 0 }, viewport = { width: 768, height: 480, labels: true }, people = npcs(map, state.progress[state.zone], state.flags)) {
  const z = ZONES[state.zone], { width, height } = viewport, room = map.kind === 'room', { x: camX, y: camY } = cameraFor(view, width, height, room ? map.focus : null);
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = room ? '#0e1418' : z.color; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(-camX, -camY);
  if (room) drawInterior(ctx, map, time, { x: camX, y: camY, width, height });
  else { drawTerrain(ctx, map, time, { x: camX, y: camY, width, height }); for (const g of map.ground || []) drawGround(ctx, g, time); }
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
export function drawActors(ctx, state, view, time, motion = { walking: false, distance: 0 }, people = null, map = null) {
  map ||= createMap(state.map || state.zone);
  people ||= npcs(map, state.progress[state.zone], state.flags);
  const wanted = map.kind === 'town' ? wantedRole(state.progress[state.zone] || {}) : null;
  for (const n of sceneDrawOrder(people, view, map)) {
    if (n.scenery) { drawDecor(ctx, n, map, time); continue; }
    const fx = n.x * 32 + (32 - CHARACTER_SIZE) / 2, fy = n.y * 32 + 28 - CHARACTER_SIZE;
    if (n.furniture) drawFurniture(ctx, n.furniture, n.x, n.y, time, { open: n.used, glow: n.kind === 'rest' });
    else if (n.kind === 'board') drawIslandArt(ctx, 'record-board', n.x * 32 - 8, n.y * 32 - 16, 48, 54);
    else if (n.kind === 'wild') { darkWisps(ctx, n.x, n.y, time); drawMonster(ctx, n.species, n.x * 32 - 6, n.y * 32 - 12, 44, time / 1000); }
    else if (n.kind === 'legend') { legendGlow(ctx, n.x, n.y, time); drawMonster(ctx, n.species, n.x * 32 - 10, n.y * 32 - 22 + Math.round(Math.sin(time / 300) * 2), 52, time / 1000); if (!n.used) marker(ctx, n.x, n.y, time, '#ffe9a0'); }
    else if (PROP_KINDS.includes(n.kind)) drawProp(ctx, n.kind, n.x, n.y, { open: n.used, art: n.art, time, water: map[n.y]?.[n.x] === 0 });
    else if (n.player) { if (!drawExplorer(ctx, state.avatar, fx, fy, CHARACTER_SIZE, state.dir, motion.walking, motion.distance || 0)) drawHuman(ctx, fx, fy, '#418e91', state.dir, 0, 'normal', null, CHARACTER_SIZE); }
    else if (n.actor && drawResident(ctx, n.actor, fx, fy, CHARACTER_SIZE, time, n.dir || 'down', n.walking || false, n.walkDistance || 0)) { /* drawn */ }
    else drawHuman(ctx, fx, fy, n.color || '#a88668', 'down', 0, n.kind, n.sprite, CHARACTER_SIZE);
    if (!n.player && wanted && n.id === wanted) marker(ctx, n.x, n.y, time);
    if (n.kind === 'trainer' && !n.used) marker(ctx, n.x, n.y, time, '#f0a07a');
  }
}

function drawDecor(ctx, n, map, time) {
  if (n.building) return house(ctx, n.building, false, map);
  if (n.scenery in FURNITURE_DEPTH) return drawFurniture(ctx, n.scenery, n.x, n.y, time);
  switch (n.scenery) {
    case 'tree': return tree(ctx, n.x * 32, n.y * 32, map);
    case 'fence': return drawIslandArt(ctx, ulleung(map) ? 'wall-stone' : 'rail-wood', n.x * 32, n.y * 32 - 6, 64, 36, n.w * 32);
    case 'planter': return propArt(ctx, 'planter', n.x * 32 + 16, n.y * 32 + 29) || drawScenery(ctx, 'planter', n.x * 32 - 4, n.y * 32 + 3, 40, 28);
    case 'monument': { // 두 섬 조형물: 돌 받침대 위의 도트 독도(v0.39)
      const pics = assetImage(CUTSCENE_ATLAS.key), f = CUTSCENE_ATLAS.frames['dokdo-224'];
      if (pics && f && propArt(ctx, 'pedestal', n.x * 32 + 48, (n.y + 1) * 32 - 2)) { const w = 84, h = Math.round(w * f[3] / f[2]); ctx.drawImage(pics, f[0], f[1], f[2], f[3], n.x * 32 + 6, (n.y + 1) * 32 - 16 - h, w, h); return; }
      return drawScenery(ctx, 'monument', n.x * 32, (n.y + 1) * 32 - 80, 96, 80);
    }
    case 'boat': return drawScenery(ctx, 'boat', n.x * 32 - 16, n.y * 32 - 30, 64, 100);
    case 'rock': return drawProp(ctx, 'rock', n.x, n.y, { water: map[n.y]?.[n.x] === 0, time });
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
  for (const d of map.decor) {
    if (d.kind === 'fence') { for (let i = 0; i < d.len; i += 2) items.push({ scenery: 'fence', x: d.x + i, y: d.y, w: Math.min(2, d.len - i), depth: d.y * TILE + 27 }); continue; }
    const depth = { tree: 24, beacon: 28, barrier: 27, planter: 29, monument: 32, boat: 70, rock: 26, crag: 30, ...FURNITURE_DEPTH }[d.kind] ?? 24;
    items.push({ scenery: d.kind, x: d.x, y: d.y, w: d.w, h: d.h, depth: d.y * TILE + depth });
  }
  return items.sort((a, b) => a.depth - b.depth);
}

export function mapLabel(id) { return getMapDef(id).name; }
