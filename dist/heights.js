// ─────────────────────────────────────────────────────────────────────────────
// 언덕과 절벽 (v0.70) — maps.js applyHeights()가 만든 map.level · map.cliff 를 그려요.
//   2D: 땅 그림을 만들 때 한 번 그려 둬요(계절 색도 함께 바뀌어요).
//       언덕 위는 조금 밝게 · 남쪽 절벽 면은 풀 턱 + 바위벽 + 아래 그늘 · 북·동·서 바위 턱 · 계단 · 사다리
//   3D: 언덕 둘레를 세운 바위벽으로(계단·사다리 자리만 열려 있어요), 언덕 위 땅은 한 층 높이에 그려요(game.js).
// ─────────────────────────────────────────────────────────────────────────────
import { V2_TERRAIN, v2TileRect } from './tileset-v2.js';
import { tintCanvas, currentSeason } from './season.js';

export const LEVEL_H = 32; // 한 층의 높이(지도 픽셀)
const T = 32, V = V2_TERRAIN.ids;
const hash = (x, y, s) => { let h = Math.imul(x * 73856093 ^ y * 19349663 ^ s * 83492791, 2654435761) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

// 그 칸의 높이(언덕 1 · 계단·사다리 0.5 · 나머지 0). 칸 사이(자유 걷기)는 가까운 칸을 따라요.
export function levelAt(map, x, y) { return map?.level?.get(`${Math.round(x)},${Math.round(y)}`) || 0; }

function tile(ctx, img, id, x, y) { if (!img || id == null) return false; const [sx, sy] = v2TileRect(id); ctx.drawImage(img, sx, sy, T, T, x * T, y * T, T, T); return true; }

export function paintCliffs(ctx, map, img) {
  const c = map.cliff; if (!c) return;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  // 언덕 위: 햇빛을 더 받아 살짝 밝게
  ctx.fillStyle = 'rgba(255,248,200,.16)'; for (const k of c.region) { const [x, y] = k.split(',').map(Number); if (!c.rim.has(k) || c.stairs.has(k)) ctx.fillRect(x * T, y * T, T, T); }
  // 바위 턱(북·동·서): 칸 바깥쪽 10도트만 바위 턱(안쪽은 풀 그대로), 맨 바깥은 어두운 선, 언덕 아래 땅에 그늘
  const lip = (x, y, w, h, side) => { // 밝은 바위 턱 + 바깥 어두운 선
    ctx.fillStyle = '#a3a8ae'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#c9ccd0'; if (side === 'n') ctx.fillRect(x, y + 2, w, 2); else ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = '#3a3f4a'; if (side === 'n') ctx.fillRect(x, y, w, 2); if (side === 'w') ctx.fillRect(x, y, 2, h); if (side === 'e') ctx.fillRect(x + w - 2, y, 2, h);
  };
  const sideFace = (x, y) => { // 동·서쪽: 언덕 바깥 칸에 세로 바위벽 띠(높은 땅의 옆면)
    const [sx, sy] = v2TileRect(V.rockface_1); if (img) ctx.drawImage(img, sx, sy, 8, T, x, y, 8, T); else { ctx.fillStyle = '#4c5260'; ctx.fillRect(x, y, 8, T); }
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y, 8, T);
  };
  for (const [k, sides] of c.rim) {
    if (c.stairs.has(k)) continue; const [x, y] = k.split(',').map(Number), px = x * T, py = y * T;
    if (sides.includes('n')) lip(px, py, T, 6, 'n');
    if (sides.includes('w')) { lip(px, py, 6, T, 'w'); sideFace(px - 8, py + 6); }
    if (sides.includes('e')) { lip(px + T - 6, py, 6, T, 'e'); sideFace(px + T, py + 6); }
    // 턱 안쪽에 작은 돌 두어 개(지나갈 수 없는 칸이라는 표시)
    ctx.fillStyle = '#8d949c'; const a = Math.floor(hash(x, y, 7) * 14) + 9, b2 = Math.floor(hash(x, y, 9) * 12) + 12; ctx.fillRect(px + a, py + b2, 5, 4); ctx.fillStyle = '#4b515c'; ctx.fillRect(px + a, py + b2 + 4, 5, 1);
  }
  // 남쪽 절벽 면: 위에 풀 턱, 아래로 바위벽, 발치에 그늘
  for (const k of c.face) {
    const [x, y] = k.split(',').map(Number);
    if (c.stairs.has(k)) continue;
    if (!tile(ctx, img, V.cliff_top, x, y)) { ctx.fillStyle = '#4c5260'; ctx.fillRect(x * T, y * T, T, T); ctx.fillStyle = '#7cbf4a'; ctx.fillRect(x * T, y * T, T, 6); }
    const sh = ctx.createLinearGradient(0, y * T + 6, 0, (y + 1) * T); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.3)'); ctx.fillStyle = sh; ctx.fillRect(x * T, y * T + 6, T, T - 6);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x * T, y * T + 6, T, 1);
    const g = ctx.createLinearGradient(0, (y + 1) * T, 0, (y + 1) * T + 12); g.addColorStop(0, 'rgba(10,20,10,.4)'); g.addColorStop(1, 'rgba(10,20,10,0)'); ctx.fillStyle = g; ctx.fillRect(x * T, (y + 1) * T, T, 12);
    if (c.ladders.has(k)) ladder(ctx, x, y);
  }
  // 계단: 절벽 면은 앞으로 내려가는 돌계단, 바위 턱은 옆으로 내려가는 돌계단
  for (const k of c.stairs) {
    const [x, y] = k.split(',').map(Number), sides = c.rim.get(k) || '';
    ctx.save();
    if (sides.includes('w') || sides.includes('e')) { ctx.translate((x + .5) * T, (y + .5) * T); ctx.rotate(Math.PI / 2); ctx.translate(-(x + .5) * T, -(y + .5) * T); }
    steps(ctx, x, y); ctx.restore();
  }
  ctx.restore();
}
function steps(ctx, x, y) { // 위가 밝고 아래로 갈수록 어두운 네 칸 돌계단
  const px = x * T, py = y * T;
  for (let i = 0; i < 4; i++) { const v = 196 - i * 20; ctx.fillStyle = `rgb(${v},${v - 6},${v - 18})`; ctx.fillRect(px + 2, py + i * 8, T - 4, 6); ctx.fillStyle = `rgb(${v - 70},${v - 76},${v - 84})`; ctx.fillRect(px + 2, py + i * 8 + 6, T - 4, 2); }
  ctx.fillStyle = '#5c5f66'; ctx.fillRect(px, py, 2, T); ctx.fillRect(px + T - 2, py, 2, T);
}
function ladder(ctx, x, y) { // 바위벽에 기댄 나무 사다리
  const px = x * T, py = y * T;
  ctx.fillStyle = '#6b4424'; ctx.fillRect(px + 8, py - 2, 3, T + 2); ctx.fillRect(px + 21, py - 2, 3, T + 2);
  ctx.fillStyle = '#a8743f'; for (let i = 0; i < 4; i++) ctx.fillRect(px + 9, py + 3 + i * 8, 14, 2);
  ctx.fillStyle = '#d29a5a'; ctx.fillRect(px + 9, py - 2, 1, T + 2); ctx.fillRect(px + 22, py - 2, 1, T + 2);
}

// ── 3D: 언덕 둘레의 바위벽 조각(한 칸 너비씩). 카메라 쪽을 보는 것만 box3d.drawFace 로 그려요 ──────────
// 벽: { x0, y0, x1, y1 } 바닥선(지도 픽셀), 높이 LEVEL_H, 바깥쪽 법선 n
// 언덕 칸만 하얗게 칠한 가림 그림(3D에서 언덕 위 땅만 따로 높이 그릴 때)
export function regionMask(map) {
  if (map._mask) return map._mask; const c = document.createElement('canvas'); c.width = map[0].length * T; c.height = map.length * T;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; for (const k of map.cliff?.region || []) { const [x, y] = k.split(',').map(Number); g.fillRect(x * T, y * T, T, T); }
  return (map._mask = c);
}
export function cliffWalls(map) {
  if (map._walls) return map._walls; const c = map.cliff, out = []; if (!c) return (map._walls = out);
  const R = c.region, open = k => c.stairs.has(k) || c.ladders.has(k);
  for (const k of R) {
    const [x, y] = k.split(',').map(Number), K = (a, b) => `${a},${b}`;
    if (!R.has(K(x, y + 1)) && !open(K(x, y + 1))) out.push({ x0: x * T, y0: (y + 1) * T, x1: (x + 1) * T, y1: (y + 1) * T, n: [0, 1], ladder: false });
    if (!R.has(K(x, y + 1)) && c.ladders.has(K(x, y + 1))) out.push({ x0: x * T, y0: (y + 1) * T, x1: (x + 1) * T, y1: (y + 1) * T, n: [0, 1], ladder: true });
    if (open(k)) continue; // 바위 턱 계단 자리는 열어 둬요
    if (!R.has(K(x, y - 1))) out.push({ x0: (x + 1) * T, y0: y * T, x1: x * T, y1: y * T, n: [0, -1] });
    if (!R.has(K(x - 1, y))) out.push({ x0: x * T, y0: y * T, x1: x * T, y1: (y + 1) * T, n: [-1, 0] });
    if (!R.has(K(x + 1, y))) out.push({ x0: (x + 1) * T, y0: (y + 1) * T, x1: (x + 1) * T, y1: y * T, n: [1, 0] });
  }
  return (map._walls = out);
}
// 바위벽 그림(한 칸 32×32): 절벽 면 타일, 사다리 칸은 사다리를 얹어서
let wallTex = null;
export function cliffTextures(img) {
  const season = currentSeason(); if (wallTex?.img === img && wallTex.season === season) return wallTex;
  const mk = withLadder => { const c = document.createElement('canvas'); c.width = T; c.height = T; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (!tile(g, img, V.rockface_0, 0, 0)) { g.fillStyle = '#4c5260'; g.fillRect(0, 0, T, T); }
    g.fillStyle = '#7cbf4a'; g.fillRect(0, 0, T, 3); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, T - 3, T, 3);
    if (withLadder) ladder(g, 0, 0); return tintCanvas(c, 'ground', season); };
  wallTex = { img, season, plain: mk(false), ladder: mk(true) }; return wallTex;
}

// ── v0.71 바닷속 3D: 땅(물이 아닌 칸)은 한 단 위, 물가 둘레는 흙벽 ─────────────────────────────
export function landMask(map) {
  if (map._land) return map._land; const c = document.createElement('canvas'); c.width = map[0].length * T; c.height = map.length * T;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; for (let y = 0; y < map.length; y++) for (let x = 0; x < map[0].length; x++) if (map[y][x] !== 0) g.fillRect(x * T, y * T, T, T);
  return (map._land = c);
}
export function shoreWalls(map) {
  if (map._shore) return map._shore; const out = [], land = (x, y) => map[y]?.[x] !== undefined && map[y][x] !== 0;
  for (let y = 0; y < map.length; y++) for (let x = 0; x < map[0].length; x++) {
    if (!land(x, y)) continue; const sand = map[y][x] === 4;
    if (map[y + 1]?.[x] === 0) out.push({ x0: x * T, y0: (y + 1) * T, x1: (x + 1) * T, y1: (y + 1) * T, n: [0, 1], sand });
    if (map[y - 1]?.[x] === 0) out.push({ x0: (x + 1) * T, y0: y * T, x1: x * T, y1: y * T, n: [0, -1], sand });
    if (map[y]?.[x - 1] === 0) out.push({ x0: x * T, y0: y * T, x1: x * T, y1: (y + 1) * T, n: [-1, 0], sand });
    if (map[y]?.[x + 1] === 0) out.push({ x0: (x + 1) * T, y0: (y + 1) * T, x1: (x + 1) * T, y1: y * T, n: [1, 0], sand });
  }
  return (map._shore = out);
}
// 물속에서 본 땅 옆면(흙·모래 단면, 위는 풀 또는 모래 턱)
let shoreTex = null;
export function shoreTextures() {
  if (shoreTex) return shoreTex;
  const mk = sand => { const c = document.createElement('canvas'); c.width = T; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = sand ? '#c8b07a' : '#7a5a3a'; g.fillRect(0, 0, T, 64);
    for (let i = 0; i < 40; i++) { const x = (i * 13) % T, y = (i * 29) % 60 + 4; g.fillStyle = i % 3 ? (sand ? '#b39a66' : '#6a4c30') : (sand ? '#e0cb96' : '#8f6c48'); g.fillRect(x, y, 3, 2); }
    for (let i = 0; i < 4; i++) { g.fillStyle = '#8b8f96'; g.fillRect((i * 9 + 3) % 26, 20 + i * 11, 6, 4); g.fillStyle = '#5c6068'; g.fillRect((i * 9 + 3) % 26, 24 + i * 11, 6, 1); }
    g.fillStyle = sand ? '#e6d29e' : '#5aa543'; g.fillRect(0, 0, T, 5); g.fillStyle = sand ? '#cdb47c' : '#3f8a35'; g.fillRect(0, 5, T, 2);
    g.fillStyle = 'rgba(40,90,60,.55)'; for (let i = 0; i < 6; i++) g.fillRect(i * 6 + 1, 64 - 6 - (i % 3) * 3, 2, 6 + (i % 3) * 3); // 밑동의 해초
    return c; };
  shoreTex = { soil: mk(false), sand: mk(true) }; return shoreTex;
}
