// ─────────────────────────────────────────────────────────────────────────────
// 3D 보기의 입체 건물 (v0.68)
//
// 2D 그림(지붕 + 앞벽)을 세운 판자 대신, 바닥 넓이가 있는 상자 + 박공지붕으로 그려요.
// 그래서 건물 뒤로 돌아가면 뒷벽이, 옆으로 가면 옆벽이 보여요.
//   앞벽  : 2D 그림의 앞벽 부분 그대로(문 포함)
//   뒷벽  : 앞벽에서 문 자리를 벽으로 메운 그림
//   옆벽  : 뒷벽 가운데를 잘라 쓰고, 위는 박공(세모)
//   지붕  : 2D 그림의 지붕 부분을 앞·뒤 경사면에 펴서 붙여요
// 그리는 법: 면(평면 다각형)을 화면의 세로줄 하나씩 잘라, 그 줄에 걸리는 면의 위·아래 끝을 찾아
//           그림의 한 줄을 늘여 붙여요. 세로선은 화면에서도 세로라서 이렇게 하면 원근이 맞아요.
//           카메라를 등진 면은 그리지 않아요(볼록한 상자라 보이는 면끼리 겹치지 않아요).
// ─────────────────────────────────────────────────────────────────────────────
import { ISLAND_ATLAS } from './island-atlas.js';
import { assetImage, assetTintTag } from './assets.js';
import { EYE, NEAR_Z, BACK } from './view3d.js';

// 그림 맨 위에서 앞벽이 시작하는 줄(처마) — 그림마다 직접 재었어요
export const EAVE = { 'ulleung-home': 100, 'ulleung-shop': 66, 'ulleung-lab': 70, 'ulleung-gym': 110, 'dokdo-lab': 78, 'dokdo-gym': 82, 'dokdo-shop': 50, 'dokdo-home': 98 };
const TILE = 32;
const SHADE = { front: 1, back: .86, west: .78, east: .72, roofFront: 1, roofBack: .8 };

const cache = new Map();
function canvas(w, h) { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); return c; }
function shaded(src, k) {
  if (k === 1) return src;
  const c = canvas(src.width, src.height), g = c.getContext('2d'); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data; for (let i = 0; i < a.length; i += 4) { a[i] *= k; a[i + 1] *= k; a[i + 2] *= k; }
  g.putImageData(d, 0, 0); return c;
}

// 건물 그림 하나로 면마다 쓸 그림(텍스처)과 크기를 만들어 둬요. 그림이 아직 안 왔으면 null.
export function buildingKit(key, b) {
  const id = `${key}:${b.w}x${b.h}:${assetTintTag()}`; if (cache.has(id)) return cache.get(id);
  const frame = ISLAND_ATLAS.frames[key], sheet = assetImage(ISLAND_ATLAS.key), eave = EAVE[key];
  if (!frame || eave == null || !sheet || !(sheet.naturalWidth || sheet.width)) return null;
  const [sx, sy, sw, sh] = frame, art = canvas(sw, sh), ag = art.getContext('2d'); ag.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
  const px = ag.getImageData(0, 0, sw, sh).data, op = (x, y) => px[(y * sw + x) * 4 + 3] > 200;
  // 앞벽의 좌우 끝(불투명한 열), 지붕 맨 윗줄(가운데 열들 기준)
  let u0 = sw, u1 = 0; for (let x = 0; x < sw; x++) for (let y = eave + 4; y < sh - 6; y++) if (op(x, y)) { u0 = Math.min(u0, x); u1 = Math.max(u1, x); break; }
  let top = eave; for (let y = 0; y < eave; y++) { let hit = false; for (let x = Math.round(sw * .3); x < sw * .7; x++) if (op(x, y)) { hit = true; break; } if (hit) { top = y; break; } }
  const wallW = u1 - u0 + 1, wallH = sh - eave, depth = b.h * TILE - 16, rise = Math.max(20, Math.min(56, Math.round(depth * .34)));
  const front = canvas(wallW, wallH); front.getContext('2d').drawImage(art, u0, eave, wallW, wallH, 0, 0, wallW, wallH);
  // 뒷벽: 문과 그 위 간판(문에 이어 붙은 무늬 덩어리)을 지우고 그 자리를 ‘줄마다 가장 흔한 색’(맨벽)으로 채워요
  const fd = front.getContext('2d').getImageData(0, 0, wallW, wallH).data, at = (x, y) => (y * wallW + x) * 4;
  const mode = []; for (let y = 0; y < wallH; y++) { const n = new Map(); for (let x = 0; x < wallW; x++) { const i = at(x, y); if (fd[i + 3] < 200) continue; const c = (fd[i] << 16) | (fd[i + 1] << 8) | fd[i + 2]; n.set(c, (n.get(c) || 0) + 1); } let best = 0, c0 = 0x888888; for (const [c, k] of n) if (k > best) { best = k; c0 = c; } mode.push(c0); }
  const odd = (x, y) => { const i = at(x, y), c = mode[y]; return fd[i + 3] > 200 && Math.abs(fd[i] - (c >> 16)) + Math.abs(fd[i + 1] - ((c >> 8) & 255)) + Math.abs(fd[i + 2] - (c & 255)) > 40; };
  const mid = Math.round(wallW / 2), lim = Math.round(wallW * .3), seen = new Uint8Array(wallW * wallH), stack = [];
  for (let y = wallH - 12; y > wallH - 30 && y > 0; y--) if (odd(mid, y)) { stack.push([mid, y]); break; }
  let bx0 = mid - 12, bx1 = mid + 12, by0 = wallH - 40, by1 = wallH - 1;
  while (stack.length) { const [x, y] = stack.pop(); if (x < mid - lim || x > mid + lim || y < 0 || y >= wallH || seen[y * wallW + x] || !odd(x, y)) continue; seen[y * wallW + x] = 1; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  const back = canvas(wallW, wallH), bg = back.getContext('2d'); bg.drawImage(front, 0, 0);
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  for (let y = Math.max(0, by0 - 1); y <= by1; y++) { bg.fillStyle = hex(mode[y]); bg.fillRect(bx0 - 1, y, bx1 - bx0 + 3, 1); }
  // 옆벽: 뒷벽 가운데를 깊이만큼 잘라 아래에, 그 위 박공 세모는 맨벽 색으로 채워요
  const side = canvas(depth, wallH + rise), sg = side.getContext('2d'), cut = Math.max(0, Math.round((wallW - depth) / 2));
  sg.fillStyle = hex(mode[Math.round(wallH * .4)]); sg.fillRect(0, 0, depth, rise + 2);
  sg.drawImage(back, cut, 0, Math.min(depth, wallW), wallH, 0, rise, depth, wallH);
  sg.fillStyle = '#2a2422'; sg.fillRect(0, rise - 1, depth, 2); // 처마선
  const roof = canvas(wallW, Math.max(4, eave - top)); roof.getContext('2d').drawImage(art, u0, top, wallW, eave - top, 0, 0, wallW, eave - top);
  const kit = {
    u0, wallW, wallH, depth, rise, sw,
    tex: { front: shaded(front, SHADE.front), back: shaded(back, SHADE.back), west: shaded(side, SHADE.west), east: shaded(side, SHADE.east), roofFront: shaded(roof, SHADE.roofFront), roofBack: shaded(roof, SHADE.roofBack) }
  };
  cache.set(id, kit); return kit;
}

// 건물의 바닥 사각형과 높이(지도 픽셀). 앞벽은 2D 그림과 같은 자리(건물 칸의 아래 끝)에 서요.
export function buildingBox(b, kit) {
  const cx = (b.x + b.w / 2) * TILE, x0 = cx - kit.sw / 2 + kit.u0, x1 = x0 + kit.wallW, yF = (b.y + b.h) * TILE, yB = yF - kit.depth;
  return { x0, x1, yF, yB, yM: (yF + yB) / 2, h: kit.wallH, top: kit.wallH + kit.rise };
}

// 면 목록: 꼭짓점 [x, y, 높이, u, v] (u, v는 그 면 그림 위의 자리) + 보이는지(카메라 쪽을 향하는지)
function faces(box, kit, cam) {
  const { x0, x1, yF, yB, yM, h, top } = box, T = kit.tex, W = kit.wallW, D = kit.depth, cy = cam.y, cx = cam.x;
  const rh = T.roofFront.height, run = (yF - yB) / 2, R = top - h;
  const list = [];
  if (cy > yF) list.push({ tex: T.front, v: [[x0, yF, 0, 0, h], [x1, yF, 0, W, h], [x1, yF, h, W, 0], [x0, yF, h, 0, 0]] });
  if (cy < yB) list.push({ tex: T.back, v: [[x1, yB, 0, 0, h], [x0, yB, 0, W, h], [x0, yB, h, W, 0], [x1, yB, h, 0, 0]] });
  const gable = (x, a, b) => [[x, a, 0, 0, top], [x, b, 0, D, top], [x, b, h, D, R], [x, yM, top, D / 2, 0], [x, a, h, 0, R]];
  if (cx < x0) list.push({ tex: T.west, v: gable(x0, yB, yF) });
  if (cx > x1) list.push({ tex: T.east, v: gable(x1, yF, yB) });
  const E = cam.eye ?? EYE;
  if (R * (cy - yF) + run * (E - h) > 0) list.push({ tex: T.roofFront, v: [[x0, yF, h, 0, rh], [x1, yF, h, W, rh], [x1, yM, top, W, 0], [x0, yM, top, 0, 0]] });
  if (-R * (cy - yB) + run * (E - h) > 0) list.push({ tex: T.roofBack, v: [[x1, yB, h, 0, rh], [x0, yB, h, W, rh], [x0, yM, top, W, 0], [x1, yM, top, 0, 0]] });
  return list;
}

// 화면에서 이 건물이 얼마나 먼지(그리는 순서용): 바닥 사각형에서 카메라에 가장 가까운 점까지의 앞쪽 거리
export function boxDepth(box, cam) {
  const px = Math.max(box.x0, Math.min(box.x1, cam.x)), py = Math.max(box.yB, Math.min(box.yF, cam.y));
  return (px - cam.x) * cam.fx + (py - cam.y) * cam.fy;
}

// 면 하나를 세로줄로 잘라 그려요. P: makeChase()가 만든 투영, cam: 카메라
export function drawFace(ctx, P, cam, face) {
  const L = face.lift || 0; // v0.71: 바닷속에서 땅 위 건물·물건은 한 단 위
  const pts = face.v.map(([x, y, z, u, v]) => { const dx = x - cam.x, dy = y - cam.y; return { l: dx * cam.rx + dy * cam.ry, z: dx * cam.fx + dy * cam.fy, h: z + L, u, v }; });
  // v0.73: 카메라 바로 앞을 지나는 면은 가까운 평면(NEAR_Z)에서 잘라 내요. 예전엔 일부 세로줄을 건너뛰어 면에 구멍이 뚫려 보였어요.
  const NZ = NEAR_Z + .5; let poly = pts;
  if (pts.some(p => p.z < NZ)) {
    const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], ina = a.z >= NZ, inb = b.z >= NZ; if (ina) out.push(a); if (ina !== inb) { const t = (NZ - a.z) / (b.z - a.z); out.push({ l: a.l + t * (b.l - a.l), z: NZ, h: a.h + t * (b.h - a.h), u: a.u + t * (b.u - a.u), v: a.v + t * (b.v - a.v) }); } }
    poly = out; if (poly.length < 3) return;
  }
  let lo = Infinity, hi = -Infinity;
  for (const p of poly) { const sx = P.W / 2 + p.l * P.f / p.z; lo = Math.min(lo, sx); hi = Math.max(hi, sx); }
  lo = Math.max(0, Math.floor(lo)); hi = Math.min(P.W, Math.ceil(hi));
  const pts2 = poly, n = pts2.length, tex = face.tex, tw = tex.width, th = tex.height;
  for (let X = lo; X < hi; X++) {
    const q = (X + .5 - P.W / 2) / P.f; let a = null, b = null;
    for (let i = 0; i < n; i++) {
      const p0 = pts2[i], p1 = pts2[(i + 1) % n], den = (p1.l - p0.l) - q * (p1.z - p0.z); if (Math.abs(den) < 1e-6) continue;
      const s = (q * p0.z - p0.l) / den; if (s < -1e-4 || s > 1 + 1e-4) continue;
      const z = p0.z + s * (p1.z - p0.z); if (z < NEAR_Z - .01) continue;
      const hgt = p0.h + s * (p1.h - p0.h), y = cam.hz + ((cam.eye ?? EYE) - hgt) * P.f / z, pt = { y, u: p0.u + s * (p1.u - p0.u), v: p0.v + s * (p1.v - p0.v) };
      if (!a || y < a.y) a = pt; if (!b || y > b.y) b = pt;
    }
    if (!a || !b || b.y - a.y < .5) continue;
    const u = Math.max(0, Math.min(tw - 1, Math.floor((a.u + b.u) / 2))), v0 = Math.max(0, Math.min(a.v, b.v)), v1 = Math.min(th, Math.max(a.v, b.v));
    if (v1 - v0 <= 0) continue;
    ctx.drawImage(tex, u, v0, 1, v1 - v0, X, a.y, 1.6, b.y - a.y);
  }
}

// game.js가 3D 보기에서 drawActors에 넘겨 주는 도우미
export function boxPainter(P, cam, keyOf, liftOf = () => 0) {
  return {
    box(b) { const key = keyOf(b), kit = buildingKit(key, b); return kit ? buildingBox(b, kit) : null; },
    depth(b) { const bx = this.box(b); return bx ? boxDepth(bx, cam) : null; },
    draw(ctx, b) {
      const key = keyOf(b), kit = buildingKit(key, b); if (!kit) return false;
      const bx = buildingBox(b, kit); ctx.imageSmoothingEnabled = false;
      // 카메라와 내 캐릭터 사이를 가리면 비쳐 보이게(다른 물건과 같은 규칙)
      let hides = false; for (let i = 1; i < 12 && !hides; i++) { const t = i / 12, x = cam.x + cam.fx * BACK * t, y = cam.y + cam.fy * BACK * t; hides = x > bx.x0 && x < bx.x1 && y > bx.yB && y < bx.yF; }
      const alpha = ctx.globalAlpha; if (hides) ctx.globalAlpha = alpha * .3;
      const lift = liftOf(b); for (const f of faces(bx, kit, cam)) drawFace(ctx, P, cam, { ...f, lift });
      ctx.globalAlpha = alpha;
      return true;
    }
  };
}

// ── v0.71 납작한 물건(표지판·안내판·기록판·비석·상자·울타리·가림막·화분)을 세계에 고정된 얇은 판으로 ─────────
// 세운 그림(빌보드)은 어느 쪽에서 봐도 앞모습이라, 뒤로 돌아가도 글씨 면이 보였어요.
// 이제 앞(남쪽)은 2D 그림, 뒤(북쪽)는 어둡게 칠한 뒷판, 옆은 그 두께만큼의 옆면으로 보여요. 나무·바위처럼 둥근 것은 그대로 세운 그림이에요.
export const SLAB = { sign: 4, landmark: 6, stone: 10, box: 22, board: 6, fence: 4, barrier: 6, planter: 24, monument: 40 }; // monument: 두 섬 조형물(받침대가 있는 두꺼운 판)
const slabCache = new Map();
function slabTextures(key, render, fx, fy) {
  const id = `${key}:${assetTintTag()}`; if (slabCache.has(id)) return slabCache.get(id);
  const S = 192, c = canvas(S, S), g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.save(); g.translate(S / 2 - fx, S - 24 - fy); render(g); g.restore();
  const d = g.getImageData(0, 0, S, S).data, foot = S - 24; let l = S, r = -1, t = foot;
  for (let y = 0; y < foot; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 40) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; }
  if (r < l) { slabCache.set(id, null); return null; }
  const w = r - l + 1, h = foot - t, front = canvas(w, h); front.getContext('2d').drawImage(c, l, t, w, h, 0, 0, w, h);
  const back = canvas(w, h), bg = back.getContext('2d'); bg.translate(w, 0); bg.scale(-1, 1); bg.drawImage(front, 0, 0); bg.setTransform(1, 0, 0, 1, 0, 0);
  bg.globalCompositeOperation = 'source-atop'; bg.fillStyle = 'rgba(70,52,36,.32)'; bg.fillRect(0, 0, w, h); // 뒷면: 같은 그림을 뒤집어 조금 어둡게
  const side = canvas(2, h), sg = side.getContext('2d'), fd = front.getContext('2d').getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y++) { let r = 0, g2 = 0, b = 0, n = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (fd[i + 3] > 40 && fd[i] + fd[i + 1] + fd[i + 2] > 120) { r += fd[i]; g2 += fd[i + 1]; b += fd[i + 2]; n++; } } if (n) { sg.fillStyle = `rgb(${r / n * .8 | 0},${g2 / n * .8 | 0},${b / n * .8 | 0})`; sg.fillRect(0, y, 2, 1); } } // v0.71: 옆면은 그 줄의 평균 색(검게 칠하지 않아요)
  const tex = { front, back, side, w, h, ax: l - S / 2 }; slabCache.set(id, tex); return tex;
}
// t: 두께(지도 픽셀) · lift: 언덕 위 높이
export function drawSlab(ctx, P, cam, key, fx, fy, t, render, lift = 0) {
  const T = slabTextures(key, render, fx, fy); if (!T) return false;
  const x0 = fx + T.ax, x1 = x0 + T.w, yF = fy + t / 2, yB = fy - t / 2, z0 = lift, z1 = lift + T.h, W = T.w, H = T.h;
  ctx.imageSmoothingEnabled = false;
  if (cam.y > yF) drawFace(ctx, P, cam, { tex: T.front, v: [[x0, yF, z0, 0, H], [x1, yF, z0, W, H], [x1, yF, z1, W, 0], [x0, yF, z1, 0, 0]] });
  if (cam.y < yB) drawFace(ctx, P, cam, { tex: T.back, v: [[x1, yB, z0, 0, H], [x0, yB, z0, W, H], [x0, yB, z1, W, 0], [x1, yB, z1, 0, 0]] });
  if (cam.x < x0) drawFace(ctx, P, cam, { tex: T.side, v: [[x0, yB, z0, 0, H], [x0, yF, z0, 2, H], [x0, yF, z1, 2, 0], [x0, yB, z1, 0, 0]] });
  if (cam.x > x1) drawFace(ctx, P, cam, { tex: T.side, v: [[x1, yF, z0, 0, H], [x1, yB, z0, 2, H], [x1, yB, z1, 2, 0], [x1, yF, z1, 0, 0]] });
  return true;
}
