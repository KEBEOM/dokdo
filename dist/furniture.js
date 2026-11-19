// v0.88 건물 안 가구를 「가구·표지판·해안 벽 확장팩」 그림으로 그려요(2D·HD-2D 같이).
// 방 그림 글자(c 계산대 · k 책장 · t 탁자 …)는 한 칸에 하나라서, 같은 가구가 붙어 있는 칸을 한 덩어리로 묶고
// 그림 하나의 폭(칸 수)만큼씩 나눠 한 장씩 그려요. 덩어리의 아래 줄 가운데 칸이 그림을 그리고, 나머지 칸은 비워요.
// 막힌 칸·문·계단·사람 자리는 지금 방 그대로예요(그림 외곽으로 충돌을 만들지 않아요). 그림이 아직 안 왔으면 예전 도트 가구를 그려요.
import { FURN_ATLAS } from './furniture-atlas.js';
import { assetImage } from './assets.js';

const T = 32;
export const PACK_FURNITURE = new Set(['counter', 'shelf', 'table', 'sofa', 'bed', 'desk', 'plant', 'crates', 'trophy', 'pc', 'chest', 'board']); // v0.90 조사 상자·실내 알림판도
// 방 종류: 상점(쉼터)·연구소·수호관은 그대로, 마을 집·가게 건물(house*·block*)은 집, 여객선터미널은 상점
export function roomKind(map) { const b = String(map?.def?.building || ''); return b === 'shop' || b === 'lab' || b === 'gym' ? b : b.startsWith('terminal') ? 'shop' : 'home'; }
// 가구 글자 → 팩 그림(방 종류·덩어리 폭에 따라). null이면 예전 도트 가구
export function furnitureSprite(kind, rk, g = { w: 1, h: 1, books: false }) {
  switch (kind) {
    case 'counter': return { shop: 'shop_counter', gym: 'gym_reception', lab: 'lab_desk' }[rk] || 'shop_counter';
    case 'shelf': if (rk === 'shop') return g.w === 1 ? 'shop_fridge' : 'shop_shelf'; if (g.books || rk === 'gym') return 'home_bookshelf'; return rk === 'lab' ? 'lab_cabinet' : 'home_wardrobe';
    case 'table': return 'home_table';
    case 'sofa': return rk === 'home' ? null : 'gym_bench'; // 집 소파는 팩에 없어서 예전 그림
    case 'bed': return 'home_bed';
    case 'desk': return g.w >= 2 ? 'lab_desk' : 'lab_console';
    case 'pc': return 'lab_console';
    case 'plant': return 'home_pot';
    case 'crates': return 'shop_crate';
    case 'trophy': return 'gym_display';
    case 'chest': return 'shop_crate'; // 조사 상자: 나무 상자(열면 뚜껑이 열린 모습을 덧그려요)
    case 'board': return 'sign_harbor'; // 실내 알림판: 빈 판(종이는 덧그려요)
  }
  return null;
}
// 키 상한(px): 캐릭터 키가 48px이라 가구·소품이 사람보다 거대해 보이지 않게(옷장·책장도 사람보다 조금 큰 정도)
export const CHARACTER_PX = 48;
export const MAX_H = { home_wardrobe: 60, home_bookshelf: 60, shop_shelf: 60, shop_fridge: 60, lab_cabinet: 60, gym_display: 48, lab_console: 44, home_bed: 44, lab_desk: 40,
  shop_counter: 38, gym_reception: 38, home_table: 34, home_chair: 34, home_pot: 30, shop_crate: 26, gym_bench: 22, sign_harbor: 40, prop_lamp: 72, prop_lifering: 44, prop_bin: 30, prop_bollard: 18 };
const capOf = id => { const f = FURN_ATLAS.frames[id]; return Math.min(1, (MAX_H[id] || CHARACTER_PX) / f[3]); };
const cache = new WeakMap();
// 방 하나의 가구 덩어리: Map('x,y' → { draw: piece } | { skip: true })
export function furnitureGroups(map) {
  if (!map || map.kind !== 'room') return null; if (cache.has(map)) return cache.get(map);
  const rk = roomKind(map), cells = new Map();
  for (const d of map.decor || []) if (PACK_FURNITURE.has(d.kind)) cells.set(`${d.x},${d.y}`, { kind: d.kind, book: false });
  for (const o of map.parsed?.objects || []) if (PACK_FURNITURE.has(o.furniture)) cells.set(`${o.x},${o.y}`, { obj: true, kind: o.furniture === 'pc' ? 'pc' : o.furniture, book: o.type === 'sign' && o.furniture === 'shelf', rest: o.type === 'rest' });
  const H = map.length, W = map[0].length, groups = [], open = new Map();
  for (let y = 0; y < H; y++) { const now = new Map();
    for (let x = 0; x < W; x++) { const c = cells.get(`${x},${y}`); if (!c || (x > 0 && cells.get(`${x - 1},${y}`)?.kind === c.kind)) continue;
      let x1 = x; while (cells.get(`${x1 + 1},${y}`)?.kind === c.kind) x1++;
      const key = `${c.kind}|${x}|${x1}`, books = [...Array(x1 - x + 1).keys()].some(i => cells.get(`${x + i},${y}`).book), rest = [...Array(x1 - x + 1).keys()].some(i => cells.get(`${x + i},${y}`).rest);
      const up = open.get(key); // 바로 위 줄에 같은 폭의 같은 가구가 있으면 세로로 이어요(2×2 탁자, 위아래 두 칸 침대)
      if (up && c.kind !== 'shelf') { up.h++; up.books ||= books; up.rest ||= rest; now.set(key, up); } else { const g = { kind: c.kind, x0: x, y0: y, w: x1 - x + 1, h: 1, books, rest }; groups.push(g); now.set(key, g); } }
    open.clear(); for (const [k, g] of now) open.set(k, g); }
  const out = new Map();
  for (const g of groups) {
    const first = furnitureSprite(g.kind, rk, g); if (!first || !FURN_ATLAS.frames[first]) continue;
    const n = Math.max(1, Math.round(FURN_ATLAS.frames[first][2] * capOf(first) / T - .1)), pieces = Math.max(1, Math.round(g.w / n)); // 한 장의 폭(칸): 키 상한에 맞춘 크기 기준 — 긴 계산대는 늘리지 않고 여러 장
    for (let p = 0, x = g.x0; p < pieces; p++) { const w = Math.round(g.w * (p + 1) / pieces) - Math.round(g.w * p / pieces), piece = { ...g, x0: x, w }, sp = furnitureSprite(g.kind, rk, piece);
      if (!sp || !FURN_ATLAS.frames[sp]) { x += w; continue; } piece.sprite = sp;
      const ay = g.y0 + g.h - 1, mid = x + Math.floor((w - 1) / 2), order = [...Array(w).keys()].map(i => x + i).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid)), ax = order.find(i => !cells.get(`${i},${ay}`)?.obj) ?? mid; // 대표 칸: 아래 줄 가운데, 되도록 고정 가구 칸(움직이는 물건 칸은 그림 칸이 좁아요)
      for (let i = 0; i < w; i++) for (let j = 0; j < g.h; j++) out.set(`${x + i},${g.y0 + j}`, i + x === ax && g.y0 + j === ay ? { draw: piece } : { skip: true, at: [ax, ay] });
      x += w; }
  }
  cache.set(map, out); return out;
}
// 그림 한 장의 크기: 덩어리 폭에 맞추되 옆 칸으로 10px 넘게 삐져나오지 않게, 그리고 키 상한(MAX_H)을 넘지 않게
export function pieceSize(piece) {
  const f = FURN_ATLAS.frames[piece.sprite], fw = f[2], fh = f[3], bw = piece.w * T, bh = piece.h * T;
  let s = Math.max(bw / fw, bh * .85 / fh); s = Math.min(s, (bw + 20) / fw, 1.35); s = Math.min(Math.max(s, .45), (MAX_H[piece.sprite] || CHARACTER_PX) / fh); // 마지막으로 키 상한
  return { w: Math.round(fw * s), h: Math.floor(fh * s) };
}
export const furnitureImage = () => assetImage(FURN_ATLAS.key);
// 그렸거나(덩어리 대표 칸) 비워야 하면(덩어리의 다른 칸) true. 팩 그림을 못 쓰면 false(예전 도트 가구)
export function drawPackFurniture(ctx, map, kind, x, y, opts = {}) {
  if (!PACK_FURNITURE.has(kind)) return false; const G = furnitureGroups(map), c = G?.get(`${x},${y}`); if (!c) return false;
  const img = furnitureImage(); if (!img) return false;
  if (c.skip) return true;
  const p = c.draw, f = FURN_ATLAS.frames[p.sprite], { w, h } = pieceSize(p), cx = (p.x0 + p.w / 2) * T, by = (p.y0 + p.h) * T - 2;
  ctx.save(); ctx.globalAlpha *= .22; ctx.fillStyle = '#2b1d12'; ctx.beginPath(); ctx.ellipse(cx, by - 1, w * .46, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); // 바닥 그림자
  const smooth = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = Math.abs(w - f[2]) > 1; ctx.drawImage(img, f[0], f[1], f[2], f[3], Math.round(cx - w / 2), by - h, w, h); ctx.imageSmoothingEnabled = smooth;
  const X = Math.round(cx - w / 2), Y = by - h;
  if (p.kind === 'chest' && opts.open) { ctx.fillStyle = '#2b1a0e'; ctx.fillRect(X + 3, Y + 2, w - 6, Math.round(h * .28)); ctx.fillStyle = '#8a5a32'; ctx.fillRect(X + 1, Y - 5, w - 2, 5); ctx.fillStyle = '#b07a46'; ctx.fillRect(X + 1, Y - 5, w - 2, 1); } // 열린 상자: 속이 보이고 뚜껑이 뒤로
  if (p.kind === 'board') for (const [fx, fy, fw, fh, c] of [[.18, .2, .22, .3, '#fff8e6'], [.46, .16, .2, .26, '#e9f1f6'], [.7, .24, .14, .22, '#f6e3d6']]) { ctx.fillStyle = c; ctx.fillRect(Math.round(X + w * fx), Math.round(Y + h * fy), Math.max(2, Math.round(w * fw)), Math.max(2, Math.round(h * fh))); ctx.fillStyle = '#c0392b'; ctx.fillRect(Math.round(X + w * (fx + fw / 2)), Math.round(Y + h * fy), 1, 1); } // 알림판 종이(글자 없음)
  if (opts.glow || p.rest) { ctx.save(); ctx.globalAlpha *= .22 + .12 * Math.sin((opts.time || 0) / 300); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(cx, by - h * .45, w * .55, h * .5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } // 쉼 침대는 은은하게 빛나요
  return true;
}
