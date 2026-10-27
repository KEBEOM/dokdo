// 건물 안 그림: 바닥·벽·문·계단과 가구를 2픽셀 도트로 그립니다 (그림 파일 없이 코드로).
const T = 32;
const THEME = {
  shop: { wall: '#f0e2c8', trim: '#8a5a3a', rug: ['#b5533c', '#d7745a', '#f1c27d'] },
  lab: { wall: '#e1ebe8', trim: '#4d6f73', rug: ['#3f7f86', '#5fa3a8', '#d9f0ea'] },
  gym: { wall: '#e9e0d0', trim: '#6b4c3a', rug: ['#3a5f9a', '#5a82bf', '#f0d27a'] },
  home: { wall: '#f3e6cf', trim: '#94623d', rug: ['#6f8f4a', '#91b067', '#f4e1a1'] }
};
const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const floorish = t => t >= 10 && t <= 15;
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

function wood(ctx, px, py, x, y) {
  for (let i = 0; i < 4; i++) {
    const shade = (i + y) % 2 ? '#c38d5c' : '#cf9b6a';
    R(ctx, px, py + i * 8, T, 8, shade); R(ctx, px, py + i * 8 + 7, T, 1, '#a8774a');
    const joint = (hash(x, y * 4 + i) % 3) * 10 + 4; R(ctx, px + joint, py + i * 8, 2, 7, '#a8774a');
  }
}
function stone(ctx, px, py, x, y) {
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) R(ctx, px + i * 16, py + j * 16, 16, 16, (x * 2 + i + y * 2 + j) % 2 ? '#d8d1bf' : '#cbc3af');
  R(ctx, px, py + 15, T, 2, '#b3aa95'); R(ctx, px + 15, py, 2, T, '#b3aa95');
}
export function drawInterior(ctx, map, time, view) {
  const th = THEME[map.def.building] || THEME.home, f = map.parsed.focus;
  const x0 = Math.max(0, Math.floor(view.x / T) - 1), y0 = Math.max(0, Math.floor(view.y / T) - 1);
  const x1 = Math.min(map[0].length - 1, Math.ceil((view.x + view.width) / T) + 1), y1 = Math.min(map.length - 1, Math.ceil((view.y + view.height) / T) + 1);
  R(ctx, x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T, '#0e1418');
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = map[y][x], px = x * T, py = y * T;
    if (t === 8) continue;
    if (t === 9) { wall(ctx, map, th, x, y, px, py); continue; }
    if (t === 11) stone(ctx, px, py, x, y); else wood(ctx, px, py, x, y);
    if (t === 12) rug(ctx, map, th, x, y, px, py);
    if (t === 13) { // door mat with a little arrow: walk on it to go outside
      R(ctx, px + 3, py + 6, 26, 22, '#6e4527'); R(ctx, px + 5, py + 8, 22, 18, '#8d5c35');
      for (let i = 0; i < 4; i++) R(ctx, px + 7, py + 10 + i * 4, 18, 2, '#a8754a');
      const a = .55 + .45 * Math.sin(time / 300); ctx.globalAlpha = a; R(ctx, px + 13, py + 27, 6, 2, '#fff3c4'); R(ctx, px + 14, py + 29, 4, 2, '#fff3c4'); R(ctx, px + 15, py + 31, 2, 1, '#fff3c4'); ctx.globalAlpha = 1;
    }
    if (t === 14 || t === 15) stairs(ctx, t === 14, px, py, time);
  }
  // soft shadow under the back wall
  for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y; y < f.y + f.h; y++) if (map[y][x] !== 9 && map[y - 1]?.[x] === 9) { ctx.globalAlpha = .18; R(ctx, x * T, y * T, T, 6, '#2b1d12'); ctx.globalAlpha = 1; }
}
function wall(ctx, map, th, x, y, px, py) {
  if (floorish(map[y + 1]?.[x])) { // the back wall you look at: plaster with a wooden skirting
    R(ctx, px, py, T, T, th.wall); R(ctx, px, py, T, 4, th.trim); R(ctx, px, py + 4, T, 2, '#00000014');
    for (let i = 4; i < T; i += 8) R(ctx, px + i, py + 8, 1, 14, '#0000000d');
    R(ctx, px, py + 22, T, 10, th.trim); R(ctx, px, py + 22, T, 2, '#ffffff33'); R(ctx, px, py + 30, T, 2, '#00000033');
  } else { // tops of the side and front walls
    R(ctx, px, py, T, T, '#4a3a30'); R(ctx, px + 2, py + 2, T - 4, T - 4, '#5d4a3d');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1]]) if (floorish(map[y + dy]?.[x + dx])) {
      if (dx === 1) R(ctx, px + T - 4, py, 4, T, '#7a6352'); if (dx === -1) R(ctx, px, py, 4, T, '#7a6352');
      if (dy === -1) R(ctx, px, py, T, 4, '#7a6352'); if (dy === 1) R(ctx, px, py + T - 4, T, 4, '#7a6352');
    }
  }
}
function rug(ctx, map, th, x, y, px, py) {
  const [base, light, edge] = th.rug, is = (dx, dy) => map[y + dy]?.[x + dx] === 12;
  R(ctx, px, py, T, T, base);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j + x + y) % 2 === 0) R(ctx, px + i * 8 + 3, py + j * 8 + 3, 2, 2, light);
  if (!is(0, -1)) { R(ctx, px, py, T, 4, edge); R(ctx, px, py + 4, T, 2, light); }
  if (!is(0, 1)) { R(ctx, px, py + T - 4, T, 4, edge); R(ctx, px, py + T - 6, T, 2, light); }
  if (!is(-1, 0)) { R(ctx, px, py, 4, T, edge); R(ctx, px + 4, py, 2, T, light); }
  if (!is(1, 0)) { R(ctx, px + T - 4, py, 4, T, edge); R(ctx, px + T - 6, py, 2, T, light); }
}
function stairs(ctx, up, px, py, time) {
  for (let i = 0; i < 4; i++) { const c = up ? ['#e6d3b0', '#d4bd95', '#c1a67c', '#ad9066'][i] : ['#7d6248', '#6c533c', '#5b4531', '#4a3726'][i]; R(ctx, px + 2, py + i * 8, T - 4, 8, c); R(ctx, px + 2, py + i * 8 + 7, T - 4, 1, '#00000033'); }
  R(ctx, px, py, 2, T, '#6b4c3a'); R(ctx, px + T - 2, py, 2, T, '#6b4c3a');
  const a = .6 + .4 * Math.sin(time / 280); ctx.globalAlpha = a; const c = '#fff3c4';
  if (up) { R(ctx, px + 15, py + 9, 2, 2, c); R(ctx, px + 13, py + 11, 6, 2, c); R(ctx, px + 11, py + 13, 10, 2, c); R(ctx, px + 15, py + 15, 2, 8, c); }
  else { R(ctx, px + 15, py + 9, 2, 8, c); R(ctx, px + 11, py + 17, 10, 2, c); R(ctx, px + 13, py + 19, 6, 2, c); R(ctx, px + 15, py + 21, 2, 2, c); }
  ctx.globalAlpha = 1;
}

// Furniture and room objects (drawn in the depth pass with people). x, y in tiles.
export function drawFurniture(ctx, kind, x, y, time = 0, opts = {}) {
  const px = x * T, py = y * T, r = (a, b, w, h, c) => R(ctx, px + a, py + b, w, h, c);
  const shadow = (w = 26) => { ctx.globalAlpha = .2; r((T - w) / 2, 27, w, 4, '#2b1d12'); ctx.globalAlpha = 1; };
  switch (kind) {
    case 'window': { // on the back wall
      r(5, 5, 22, 17, '#f7f3e8'); r(7, 7, 18, 13, '#9fd6e6'); r(7, 7, 18, 4, '#c8ecf4'); r(15, 7, 2, 13, '#f7f3e8'); r(7, 13, 18, 2, '#f7f3e8');
      r(9, 15, 4, 2, '#ffffff99'); r(4, 21, 24, 3, '#d9cfb8'); return;
    }
    case 'counter': shadow(32); r(0, 6, 32, 6, '#c78a55'); r(0, 6, 32, 2, '#e0a874'); r(0, 12, 32, 16, '#8a5532'); r(0, 12, 32, 2, '#6b3f22'); r(2, 16, 28, 9, '#9b6239'); return;
    case 'shelf': {
      shadow(30); r(1, -18, 30, 46, '#6b4325'); r(3, -16, 26, 42, '#8a5a35');
      const cols = ['#c75b4a', '#3f7f86', '#e2b84f', '#6f8f4a', '#7a5fa8', '#d98a3a', '#5a7fbf'];
      for (let s = 0; s < 3; s++) { r(3, -16 + s * 14 + 12, 26, 2, '#5a3820'); for (let b = 0; b < 6; b++) { const h = 8 + (hash(x * 3 + b, y + s) % 3); r(4 + b * 4, -16 + s * 14 + 12 - h, 3, h, cols[hash(x + b, s + y) % cols.length]); } }
      return;
    }
    case 'table': shadow(28); r(3, 8, 26, 4, '#b5793f'); r(3, 12, 26, 8, '#9a6334'); r(3, 8, 26, 2, '#d39a5f'); r(5, 20, 3, 8, '#7a4c28'); r(24, 20, 3, 8, '#7a4c28'); r(12, 5, 6, 4, '#f1e4c2'); r(13, 3, 4, 2, '#7fb3c4'); return;
    case 'sofa': shadow(30); r(1, 8, 30, 12, '#5f7fa8'); r(1, 8, 30, 3, '#7f9fc8'); r(0, 12, 5, 14, '#4f6f98'); r(27, 12, 5, 14, '#4f6f98'); r(4, 18, 24, 8, '#6f8fb8'); r(4, 18, 24, 2, '#8fafd8'); return;
    case 'bed': case 'futon': {
      if (kind === 'bed') { shadow(30); r(1, -2, 30, 30, '#7a4c28'); r(3, 0, 26, 26, '#f4f0e6'); r(5, 2, 22, 7, '#ffffff'); r(3, 11, 26, 15, '#c75b4a'); r(3, 11, 26, 2, '#e07a5f'); }
      else { r(2, 6, 28, 22, '#f4f0e6'); r(4, 8, 24, 6, '#ffffff'); r(2, 15, 28, 13, '#7fa6c9'); r(2, 15, 28, 2, '#a0c3e0'); for (let i = 0; i < 3; i++) r(6 + i * 8, 20, 4, 4, '#cfe3f3'); }
      if (opts.glow) { ctx.globalAlpha = .25 + .15 * Math.sin(time / 300); r(2, 0, 28, 28, '#fff3c4'); ctx.globalAlpha = 1; }
      return;
    }
    case 'desk': shadow(30); r(1, 12, 30, 5, '#a8743f'); r(1, 17, 30, 11, '#8a5a30'); r(1, 12, 30, 2, '#c8915a'); r(7, -2, 18, 14, '#2b2f3a'); r(9, 0, 14, 9, Math.sin(time / 500 + x) > 0 ? '#5fc3c9' : '#4aa8b0'); r(14, 12, 4, 1, '#2b2f3a'); return;
    case 'plant': shadow(18); r(9, 18, 14, 10, '#b8673f'); r(9, 18, 14, 3, '#d4835a'); r(7, 4, 18, 15, '#4f8a4a'); r(5, 8, 22, 8, '#5fa055'); r(11, 1, 10, 6, '#6fb465'); r(13, 6, 3, 3, '#8fd07f'); return;
    case 'crates': shadow(28); r(2, 10, 16, 18, '#a8743f'); r(2, 10, 16, 2, '#c8915a'); r(4, 13, 12, 2, '#8a5a30'); r(16, 4, 14, 24, '#b5803f'); r(16, 4, 14, 2, '#d39a5f'); r(18, 10, 10, 2, '#8a5a30'); r(18, 18, 10, 2, '#8a5a30'); return;
    case 'post': shadow(16); r(13, -4, 6, 32, '#8a5a30'); r(9, 2, 14, 16, '#d8b56a'); r(9, 2, 14, 2, '#ecd08a'); r(11, 6, 10, 2, '#b8954a'); r(11, 12, 10, 2, '#b8954a'); return;
    case 'trophy': shadow(18); r(9, 16, 14, 12, '#6b4c3a'); r(9, 16, 14, 2, '#8a6a52'); r(11, 4, 10, 8, '#e2b84f'); r(9, 4, 2, 5, '#e2b84f'); r(21, 4, 2, 5, '#e2b84f'); r(14, 12, 4, 4, '#c79a30'); r(12, 5, 3, 3, '#fff1b0'); return;
    case 'pc': {
      shadow(26); r(4, -6, 24, 34, '#4a5262'); r(4, -6, 24, 2, '#6a7282'); r(7, -2, 18, 14, '#1d2230');
      const g = .5 + .5 * Math.sin(time / 260 + x); r(9, 0, 14, 10, g > .5 ? '#7fe3ea' : '#4fb8c4'); r(11, 3, 10, 2, '#e6fbff'); r(11, 7, 6, 1, '#e6fbff');
      r(8, 16, 16, 3, '#2b3240'); r(22, 22, 3, 3, g > .5 ? '#7bd88f' : '#2f6b3f'); return;
    }
    case 'tank': {
      shadow(30); r(1, 20, 30, 8, '#6b4c3a'); r(2, 2, 28, 19, '#bfe6ee'); r(3, 6, 26, 14, '#3f9fb5'); r(3, 6, 26, 2, '#7fd0e0');
      const fx = 6 + ((time / 40 + x * 9) % 18); r(fx, 12, 5, 3, '#f0a050'); r(fx + 5, 13, 2, 1, '#f0a050');
      for (let i = 0; i < 3; i++) { const by = 18 - ((time / 60 + i * 5) % 12); r(22 + (i % 2) * 3, by, 2, 2, '#e6fbff'); }
      r(4, 17, 8, 3, '#5f8a4a'); r(6, 13, 2, 5, '#6fa055'); return;
    }
    case 'telescope': shadow(20); r(8, 22, 2, 6, '#3a3f4b'); r(15, 18, 2, 10, '#3a3f4b'); r(22, 22, 2, 6, '#3a3f4b'); r(10, 18, 14, 4, '#4a5262'); for (let i = 0; i < 6; i++) r(10 + i * 3, 14 - i * 3, 8, 5, i === 5 ? '#c8ecf4' : '#e2b84f'); return;
    case 'board': shadow(26); r(14, 18, 4, 10, '#6b4325'); r(3, 0, 26, 20, '#8a5a35'); r(5, 2, 22, 16, '#d9b98a'); r(7, 4, 8, 6, '#fbf8ee'); r(17, 5, 8, 9, '#fff1c4'); r(8, 11, 7, 5, '#e8f4f0'); r(10, 4, 2, 2, '#c75b4a'); r(20, 5, 2, 2, '#3f7f86'); return;
    case 'lectern': shadow(20); r(13, 14, 6, 14, '#6b4325'); r(9, 26, 14, 2, '#5a3820'); r(4, 6, 24, 10, '#8a5a35'); r(6, 4, 9, 9, '#fbf8ee'); r(17, 4, 9, 9, '#f3ecd8'); r(8, 6, 5, 1, '#9aa3a8'); r(8, 9, 5, 1, '#9aa3a8'); r(19, 6, 5, 1, '#9aa3a8'); r(15, 4, 2, 9, '#c75b4a'); return;
    case 'chest': {
      shadow(26); r(4, 12, 24, 16, '#9a5f30'); r(4, 12, 24, 2, '#b8773f'); r(4, 18, 24, 2, '#e2b84f'); r(14, 16, 4, 6, '#e2b84f');
      if (opts.open) { r(4, 4, 24, 8, '#7a4a22'); r(6, 10, 20, 3, '#2b1d12'); } else { r(4, 6, 24, 7, '#b5703a'); r(4, 6, 24, 2, '#d08a4a'); }
      return;
    }
    case 'frame': shadow(22); r(6, 14, 20, 14, '#9a6334'); r(6, 14, 20, 2, '#b8793f'); r(9, 0, 14, 14, '#e2b84f'); r(11, 2, 10, 10, '#9fd6e6'); r(11, 8, 10, 4, '#e8c98a'); r(13, 5, 2, 3, '#c75b4a'); r(17, 5, 2, 3, '#3f7f86'); return;
  }
}
// Depth (feet line) of furniture inside its tile.
export const FURNITURE_DEPTH = { window: 0, shelf: 30, counter: 29, table: 29, sofa: 29, bed: 29, futon: 20, desk: 29, plant: 28, crates: 29, post: 29, trophy: 29, pc: 29, tank: 29, telescope: 29, board: 29, lectern: 29, chest: 29, frame: 29 };
