import { ZONES, EXTRA_NPCS, getSpecies } from './data.js';
import { drawHuman, drawMonster } from './sprites.js';
import { drawScenery } from './scenery.js';
import { drawTerrain } from './terrain.js';
import { drawExplorer, drawResident, CHARACTER_SIZE } from './characters.js';
import { parseMap, getMapDef, MAP_W, MAP_H } from './maps.js';
import { drawProp } from './props.js';

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
    buildings: parsed.buildings, decor: parsed.decor, rockTiles: parsed.rockTiles, keepClear, parsed
  });
}
// Buildings of the first town (kept for older code and tests).
export const BUILDINGS = parseMap('town0').buildings;

export function villageResidents(zone) {
  const z = ZONES[zone];
  return [
    { key: '1', actor: 'child-boy', name: '남자아이 준', lines: ['나는 준! 방금 배운 내용을 보지 않고 말해 보는 연습을 해.', '문제를 틀렸다면 해설을 읽고, 다음 만남에서 다시 떠올려 봐!'] },
    { key: '2', actor: 'child-girl', name: '여자아이 솔', lines: ['나는 솔이야. 이번 지역에서 기억할 내용을 함께 읽어 볼까?', z.fact, '수첩을 잠깐 닫고 네 말로 설명해 봐!'] },
    { key: '3', actor: 'child-girl-ribbon', name: '여자아이 봄', lines: ['나는 봄! 탐험 수첩에 지금까지 배운 내용을 모아 두었어.', '각 지역의 기록판을 다시 만나면 지난 개념도 함께 복습할 수 있어.'] },
    { key: '4', actor: 'man', name: '도윤 아저씨', lines: [`이번 조사 주제는 ‘${z.histTitle}’란다.`, '자료를 읽을 때 누가, 언제 만들었는지 살펴보렴. 출처도 직접 확인하면 좋겠지?', z.hint] },
    { key: '5', actor: 'woman', name: '미소 아줌마', lines: ['반가워! 탐험하다 지치면 쉼터지기에게 가 보렴.', '동료 체력을 회복하고, 수첩에서 헷갈린 개념을 천천히 다시 읽어 봐.'] }
  ];
}

// 백무단: 수집원·조사원·기록 관리자는 대원, 먹선·쇄도·무음은 간부, 마지막은 대표 백무.
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
    // 풀숲 위에 서 있는 야생 독도몬은 두지 않아요. 광포화된 독도몬은 풀숲을 걸을 때 갑자기 나타나요.
    for (const r of villageResidents(zone)) { const p = parsed.residents[r.key]; if (p) list.push({ ...r, id: 'resident', kind: 'resident', x: p.x, y: p.y }); }
  }
  for (const o of parsed.objects) {
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
  if (t === 0 || t === 5 || t === 7 || map.solid?.has(`${x},${y}`)) return true;
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
      if (!seen.has(k) && !blocked(map, nx, ny, people)) { seen.add(k); prev.set(k, key(x, y)); queue.push([nx, ny]); }
    }
  }
  return [];
}

function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.floor(x), Math.floor(y), w, h); }
function tree(ctx, x, y) { if (!drawScenery(ctx, 'tree', x - 32, y - 58, 80, 88)) drawTreeDefault(ctx, x, y); }
export function drawTreeDefault(ctx, x, y) {
  const r = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  r(-9, 15, 29, 8, '#375e4a22'); r(4, 0, 7, 24, '#816f50'); r(-8, -22, 30, 27, '#427e65'); r(-13, -14, 40, 20, '#427e65'); r(-3, -29, 20, 10, '#73a97a');
}
function house(ctx, b, labels = true) {
  if (!drawScenery(ctx, b.kind, b.x * TILE - 8, b.y * TILE - 40, b.w * TILE + 16, b.h * TILE + 40)) { drawHouseDefault(ctx, b, labels); return; }
  if (!labels) return;
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#345c52'; ctx.fillText(b.name, (b.x + b.w / 2) * TILE, (b.y + b.h) * TILE + 14);
}
export function drawHouseDefault(ctx, b, labels = true) {
  const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
  rect(ctx, x + 7, y + 48, w - 14, h - 48, '#e9dfbd'); rect(ctx, x - 5, y + 12, w + 10, 45, b.color); rect(ctx, x + 16, y - 6, w - 32, 12, b.color);
  rect(ctx, x + w / 2 - 15, y + h - 47, 30, 47, '#375a60');
  if (labels) { ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#345c52'; ctx.fillText(b.name, x + w / 2, y + h + 14); }
}

export function cameraFor(view, width = 768, height = 480) {
  return {
    x: Math.floor(Math.max(0, Math.min(W * TILE - width, view.x * TILE - width / 2 + 16))),
    y: Math.floor(Math.max(0, Math.min(H * TILE - height, view.y * TILE - height / 2 + 16)))
  };
}

export function drawWorld(ctx, map, state, view, time, target = null, motion = { walking: false, distance: 0 }, viewport = { width: 768, height: 480, labels: true }, people = npcs(map, state.progress[state.zone], state.flags)) {
  const z = ZONES[state.zone], { width, height } = viewport, { x: camX, y: camY } = cameraFor(view, width, height);
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = z.color; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(-camX, -camY);
  drawTerrain(ctx, map, time, { x: camX, y: camY, width, height });
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

// 광포화: wild 독도몬 on the map are wrapped in drifting dark energy.
function darkWisps(ctx, x, y, time) {
  const cx = x * 32 + 16, cy = y * 32 + 18;
  ctx.save(); ctx.globalAlpha = .28 + .1 * Math.sin(time / 300); ctx.fillStyle = '#3b1d5c'; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 6; i++) { const age = (time / 30 + i * 23) % 60; ctx.globalAlpha = Math.max(0, .55 - age / 110); ctx.fillStyle = i % 2 ? '#4a1f7a' : '#1a0f2e'; ctx.fillRect(Math.round(cx - 14 + i * 5 + Math.sin(time / 400 + i) * 3), Math.round(cy + 8 - age * .7), 3, 3); }
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
    if (n.kind === 'board') drawScenery(ctx, 'board', n.x * 32 - 8, n.y * 32 - 16, 48, 54);
    else if (n.kind === 'wild') { darkWisps(ctx, n.x, n.y, time); drawMonster(ctx, n.species, n.x * 32 - 6, n.y * 32 - 12, 44, time / 1000); }
    else if (n.kind === 'legend') { drawProp(ctx, 'observe', n.x, n.y, { time }); if (!n.used) marker(ctx, n.x, n.y, time, '#ffe9a0'); }
    else if (PROP_KINDS.includes(n.kind)) drawProp(ctx, n.kind, n.x, n.y, { open: n.used, art: n.art, time, water: map[n.y]?.[n.x] === 0 });
    else if (n.player) { if (!drawExplorer(ctx, state.avatar, fx, fy, CHARACTER_SIZE, state.dir, motion.walking, motion.distance || 0)) drawHuman(ctx, fx, fy, '#418e91', state.dir, 0, 'normal', null, CHARACTER_SIZE); }
    else if (n.actor && drawResident(ctx, n.actor, fx, fy, CHARACTER_SIZE, time, n.dir || 'down', n.walking || false, n.walkDistance || 0)) { /* drawn */ }
    else drawHuman(ctx, fx, fy, n.color || '#a88668', 'down', 0, n.kind, n.sprite, CHARACTER_SIZE);
    if (!n.player && wanted && n.id === wanted) marker(ctx, n.x, n.y, time);
    if (n.kind === 'trainer' && !n.used) marker(ctx, n.x, n.y, time, '#f0a07a');
  }
}

function drawDecor(ctx, n, map, time) {
  if (n.building) return house(ctx, n.building, false);
  switch (n.scenery) {
    case 'tree': return tree(ctx, n.x * 32, n.y * 32);
    case 'fence': return drawScenery(ctx, 'fence', n.x * 32, n.y * 32 - 6, n.w * 32, 36);
    case 'planter': return drawScenery(ctx, 'planter', n.x * 32 - 4, n.y * 32 + 3, 40, 28);
    case 'monument': return drawScenery(ctx, 'monument', n.x * 32, (n.y + 1) * 32 - 80, 96, 80);
    case 'boat': return drawScenery(ctx, 'boat', n.x * 32 - 16, n.y * 32 - 30, 64, 100);
    case 'rock': return drawProp(ctx, 'rock', n.x, n.y, { water: map[n.y]?.[n.x] === 0, time });
    case 'crag': return drawProp(ctx, 'crag', n.x, n.y, { w: n.w, h: n.h });
  }
}

// Whole objects and people share one foot-point depth order.
export function sceneDrawOrder(people, view, map = createMap(0)) {
  const items = people.map(n => ({ ...n, x: n.drawX ?? n.x, y: n.drawY ?? n.y, depth: (n.drawY ?? n.y) * TILE + 28, player: false }));
  items.push({ x: view.x, y: view.y, depth: view.y * TILE + 28, player: true });
  for (const b of map.buildings) items.push({ scenery: b.kind, building: b, depth: (b.y + b.h) * TILE });
  for (const d of map.decor) {
    if (d.kind === 'fence') { for (let i = 0; i < d.len; i += 2) items.push({ scenery: 'fence', x: d.x + i, y: d.y, w: Math.min(2, d.len - i), depth: d.y * TILE + 27 }); continue; }
    const depth = { tree: 24, planter: 29, monument: 32, boat: 70, rock: 26, crag: 30 }[d.kind] ?? 24;
    items.push({ scenery: d.kind, x: d.x, y: d.y, w: d.w, h: d.h, depth: d.y * TILE + depth });
  }
  return items.sort((a, b) => a.depth - b.depth);
}

export function mapLabel(id) { return getMapDef(id).name; }
