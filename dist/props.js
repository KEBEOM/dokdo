// Small map props drawn as pixel bitmaps (2 world-pixels per dot, matching the village atlas).
// Edit a bitmap below to change a prop. '.' is transparent.
import { assetImage } from './assets.js';
import { SCENERY_ATLAS } from './scenery-atlas.js';
import { PROPS_ATLAS } from './props-atlas.js';
import { CUTSCENE_ATLAS } from './cutscene-atlas.js';
import { islandFrame } from './island-pictures.js';
import { FURN_ATLAS, REGION_ATLAS } from './furniture-atlas.js';

// v0.88 바깥 안내판: 「가구·표지판·해안 벽 확장팩」의 빈 판(글자 없음 — 이름은 게임의 이름표로 따로 띄워요)
export function signSprite(name = '') {
  if (/길 안내|오르막|갈림길|이정표/.test(name)) return 'sign_direction';
  if (/주의|위험|조심|갯바위|가림막/.test(name)) return 'sign_warning';
  if (/항 안내|부두|선착장|항구/.test(name)) return 'sign_harbor';
  return 'sign_information';
}
const SIGN_SCALE = { sign_direction: .64, sign_warning: .7, sign_harbor: .6, sign_information: .52 }; // 안내판 키는 사람(48px)보다 크지 않게
function packSign(ctx, name, cx, bottom) {
  const img = assetImage(FURN_ATLAS.key), id = signSprite(name), f = FURN_ATLAS.frames[id]; if (!img || !f) return false;
  const s = SIGN_SCALE[id], w = Math.round(f[2] * s), h = Math.round(f[3] * s);
  shadow(ctx, cx, bottom, w * .7); ctx.imageSmoothingEnabled = true; ctx.drawImage(img, f[0], f[1], f[2], f[3], Math.round(cx - w / 2), Math.round(bottom + 2 - h), w, h); ctx.imageSmoothingEnabled = false; return true;
}

const PALETTE = {
  o: '#232634', O: '#3a3f52',
  w: '#8f5d35', W: '#c07f45', d: '#6a4126', y: '#e0a965',
  p: '#f1e4c2', P: '#d6c49a', t: '#7a6448',
  T: '#3f8189', g: '#e2b84f', G: '#a37a26', k: '#2a1c18',
  s: '#77727e', S: '#a29daa', l: '#cdc9d2', m: '#7f9a4a', M: '#a7bd61',
  c: '#7fe3ea', C: '#c8fbff',
  b: '#9fd0e6', B: '#5e9fbe', L: '#e7ebe9', r: '#c75b4a', R: '#e9a08f',
  n: '#3f5f73', N: '#6f97ad', f: '#e9f3ee'
};

const SPRITES = {
  sign: [
    '..oooooooooo..',
    '.oWWWWWWWWWWo.',
    '.oWppppppppWo.',
    '.oWpttttttpWo.',
    '.oWppppppppWo.',
    '.oWptttttPpWo.',
    '.oWppppppppWo.',
    '.owwwwwwwwwwo.',
    '..ooooowwooo..',
    '.....owwdo....',
    '.....owwdo....',
    '.....owwdo....',
    '.....owwdo....',
    '....oowwdoo...'
  ],
  box: [
    '..oooooooooo..',
    '.oyWWWWWWWWyo.',
    '.oWwwwwwwwwWo.',
    'ooTTTTggTTTToo',
    'owTTTogGoTTTwo',
    'owwwwwggwwwwwo',
    'owwwwwwwwwwwwo',
    'odddddddddddddo'.slice(0, 14),
    '.oooooooooooo.'
  ],
  boxOpen: [
    '.oyWWWWWWWWyo.',
    '.oWwwwwwwwwWo.',
    '.oTTTTTTTTTTo.',
    '..oooooooooo..',
    'oookkkkkkkkooo',
    'owTkkkkkkkkTwo',
    'owwwwwwwwwwwwo',
    'owwwwwwwwwwwwo',
    'oddddddddddddo',
    '.oooooooooooo.'
  ],
  trash: [
    '.......oo.....',
    '......obbo....',
    '...oo.oBBo.oo.',
    '..oLLoobbooRRo',
    '.oLLLLobbborro',
    'oLLPLLobbborRo',
    'oLLLLLobbborro',
    '.oLLLooBBoorro',
    '..ooo..oo..oo.'
  ],
  observe: [
    '.oooo..oooo...',
    'oNNNNooNNNNo..',
    'onnnnNNnnnno..',
    'onfnnoonfnno..',
    'onnnnoonnnno..',
    '.oooo..oooo...',
    '.....oo.......',
    '....owdo......',
    '....owdo......',
    '....owdo......',
    '...owwddo.....',
    '..ow.oo.do....',
    '.ow..oo..do...',
    'oo...oo...oo..'
  ],
  stone: [
    '...oooooo...',
    '..oSSSSSSo..',
    '.oSllllllSo.',
    '.oSlccccsSo.',
    '.oSllcclsSo.',
    '.oSsccccssSo'.slice(0, 12),
    '.oSlllcclSo.',
    '.oSlccccsSo.',
    '.oSlllllsSo.',
    '.oSsssssssSo'.slice(0, 12),
    'ooSSSSSSSSoo',
    'osssmmmssssO'.slice(0, 12),
    'oooooooooooo'
  ],
  rock: [
    '....oooo......',
    '..ooSlllo.....',
    '.oSSllllSoooo.',
    '.oSlllSSSlllSo',
    'oSSSSSssSSllSo',
    'oSssSSsssSSSso',
    'osmmsssssssmso',
    '.ossssmmssssso',
    '..oooooooooooo'
  ],
  pillar: [
    '....oooo....',
    '...oSlMMo...',
    '...oSllSo...',
    '..oSSlSSso..',
    '..oSllSsso..',
    '..oSSlSsso..',
    '..oSllssso..',
    '..oSSlSsso..',
    '..oSlSSsso..',
    '..oSSlSsso..',
    '.ooSllssssoo',
    '.oSSSlSsssSo',
    'oSSlllSssssO'.slice(0, 12),
    'osssmmsssmso',
    'oooooooooooo'
  ],
  arch: [
    '.......oooooo...........',
    '.....ooSlMMMSoo.........',
    '....oSSlllllSSSoooo.....',
    '...oSSllllSSSSSSlMMoo...',
    '..oSSllSSSSssSSSllllSo..',
    '..oSllSSSoooooossSSlSSo.',
    '.oSSlSSoo......oosSSlSo.',
    '.oSllSo..........osSSSo.',
    '.oSlSSo...........osSSo.',
    'oSSlSo.............osSo.',
    'oSlSSo.............osso.',
    'oSSSso.............osso.',
    'oSlSso..............oso.',
    'oSSsso..............oso.',
    'osmsmo..............omo.',
    'oooooo..............ooo.'
  ]
};
// Pad rows so every bitmap is rectangular.
for (const rows of Object.values(SPRITES)) { const w = Math.max(...rows.map(r => r.length)); rows.forEach((r, i) => { rows[i] = r.padEnd(w, '.'); }); }

const cache = new Map();
function bitmap(name, dot = 2) {
  const key = name + dot;
  if (cache.has(key)) return cache.get(key);
  const rows = SPRITES[name];
  let canvas = null;
  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas'); canvas.width = rows[0].length * dot; canvas.height = rows.length * dot;
    const c = canvas.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.' && PALETTE[ch]) { c.fillStyle = PALETTE[ch]; c.fillRect(x * dot, y * dot, dot, dot); } }));
  }
  const out = { canvas, w: rows[0].length * dot, h: rows.length * dot };
  cache.set(key, out); return out;
}
export function spriteSize(name, dot = 2) { const rows = SPRITES[name]; return { w: rows[0].length * dot, h: rows.length * dot }; }

function blit(ctx, name, cx, bottom, dot = 2) {
  const b = bitmap(name, dot);
  if (b.canvas) ctx.drawImage(b.canvas, Math.round(cx - b.w / 2), Math.round(bottom - b.h));
  else ctx.fillRect(Math.round(cx - b.w / 2), Math.round(bottom - b.h), b.w, b.h); // node tests
}
// v0.39 선명한 외곽선 도트 느낌 소품 그림(scripts/draw-props-bw.py). 아래 가운데를 발 위치에 맞춰 그려요. 아직 없으면 false.
export function propArt(ctx, name, cx, bottom) {
  const sheet = assetImage(PROPS_ATLAS.key), f = PROPS_ATLAS.frames[name]; if (!sheet || !f) return false;
  ctx.drawImage(sheet, f[0], f[1], f[2], f[3], Math.round(cx - f[2] / 2), Math.round(bottom + 2 - f[3]), f[2], f[3]); return true;
}
function shadow(ctx, cx, bottom, w) { ctx.fillStyle = '#1d3a3a33'; ctx.fillRect(Math.round(cx - w / 2), Math.round(bottom - 3), Math.round(w), 4); }

// Crops of the two-islands artwork, used for real-place landmarks.
const PEAKS = { peaks: [110, 185, 1130, 575], peak: [110, 185, 590, 575] };
function drawPeaks(ctx, kind, cx, bottom, width) {
  const pics = assetImage(CUTSCENE_ATLAS.key), f = pics && islandFrame(kind === 'peak' ? 'seodo' : 'dokdo', kind === 'peak' ? 120 : 224);
  if (f) { const h = Math.round(width * f[3] / f[2]); ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(pics, f[0], f[1], f[2], f[3], Math.round(cx - width / 2), Math.round(bottom - h), width, h); ctx.restore(); return; }
  const sheet = assetImage(SCENERY_ATLAS.monument.key), [sx, sy, sw, sh] = PEAKS[kind];
  const h = Math.round(width * sh / sw);
  if (!sheet) { blit(ctx, 'rock', cx, bottom, 4); return; }
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, sx, sy, sw, sh, Math.round(cx - width / 2), Math.round(bottom - h), width, h); ctx.restore();
}

// Draw a prop whose tile is (tx,ty). `state` carries open/used flags and time for glow.
export function drawProp(ctx, kind, tx, ty, opts = {}) {
  const cx = tx * 32 + 16, bottom = ty * 32 + 30, t = opts.time || 0;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  switch (kind) {
    case 'sign': if (!opts.art && packSign(ctx, opts.name, cx, bottom)) break; if (!propArt(ctx, 'sign', cx, bottom)) { shadow(ctx, cx, bottom, 20); blit(ctx, 'sign', cx, bottom); } break;
    case 'box': if (!propArt(ctx, opts.open ? 'boxOpen' : 'box', cx, bottom)) { shadow(ctx, cx, bottom, 26); blit(ctx, opts.open ? 'boxOpen' : 'box', cx, bottom); } break;
    case 'trash': if (!propArt(ctx, 'trash', cx, bottom)) blit(ctx, 'trash', cx, bottom); break;
    case 'observe': if (!propArt(ctx, 'observe', cx + 2, bottom)) { shadow(ctx, cx, bottom, 22); blit(ctx, 'observe', cx + 4, bottom); } break;
    case 'stone': {
      if (!propArt(ctx, 'stone', cx, bottom)) { shadow(ctx, cx, bottom, 22); blit(ctx, 'stone', cx, bottom); }
      if (!opts.open) { ctx.globalAlpha = .25 + .2 * Math.sin(t / 300); ctx.fillStyle = '#9ff6ff'; ctx.fillRect(cx - 7, bottom - 22, 14, 12); }
      break;
    }
    case 'rock': {
      if (opts.water) { ctx.fillStyle = '#d5e0bb'; ctx.fillRect(cx - 15, bottom - 4, 30, 2); ctx.fillRect(cx - 12, bottom - 1, 24, 2); }
      if (!propArt(ctx, 'rock', cx + ((tx * 7 + ty * 3) % 5) - 2, bottom - 2)) blit(ctx, 'rock', cx + ((tx * 7 + ty * 3) % 5) - 2, bottom - 2); break;
    }
    case 'barrier': { // 몽땅랜드 공사 가림막: 노랑·검정 줄무늬 판과 기둥
      const x0 = tx * 32, top = bottom - 30;
      ctx.fillStyle = '#1d3a3a33'; ctx.fillRect(x0, bottom - 2, 32, 4);
      ctx.fillStyle = '#e8c64a'; ctx.fillRect(x0, top + 4, 32, 20);
      ctx.fillStyle = '#2f3036'; for (let i = -20; i < 32; i += 10) for (let r = 0; r < 20; r++) { const sx = i + r; if (sx >= 0 && sx < 32) ctx.fillRect(x0 + sx, top + 4 + r, Math.min(4, 32 - sx), 1); }
      ctx.fillStyle = '#b8932f'; ctx.fillRect(x0, top + 22, 32, 2); ctx.fillStyle = '#c8463c'; ctx.fillRect(x0, top + 2, 32, 3);
      ctx.fillStyle = '#6a6c70'; ctx.fillRect(x0 + 2, top, 3, 30); ctx.fillRect(x0 + 27, top, 3, 30);
      break;
    }
    case 'beacon': { // 방파제 끝의 빨간 등대
      const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
      shadow(ctx, cx, bottom, 20);
      R(cx - 9, bottom - 6, 18, 6, '#8f8a80'); R(cx - 6, bottom - 40, 12, 34, '#c8463c'); R(cx + 3, bottom - 40, 3, 34, '#9a3029');
      R(cx - 6, bottom - 30, 12, 4, '#f3efe6'); R(cx - 6, bottom - 18, 12, 4, '#f3efe6');
      R(cx - 8, bottom - 44, 16, 4, '#3d3f44'); R(cx - 4, bottom - 50, 8, 6, '#f7e08a'); R(cx - 5, bottom - 53, 10, 3, '#3d3f44');
      ctx.globalAlpha = .25 + .25 * Math.sin(t / 300); R(cx - 12, bottom - 52, 24, 10, '#ffeaa0'); ctx.globalAlpha = 1;
      break;
    }
    case 'crag': {
      // A peak rising from a large rock outcrop (x,y = bottom-left tile of the cluster).
      const w = Math.min(opts.w, 7) * 32, left = tx * 32 + (opts.w * 32 - w) / 2, base = (ty - Math.floor(opts.h / 2) + 1) * 32 + 8;
      drawPeaks(ctx, 'peaks', left + w / 2, base, w); break;
    }
    case 'landmark': {
      if (opts.region) { const img = assetImage(REGION_ATLAS.key), f = REGION_ATLAS.frames[opts.region]; if (img && f) { const r = opts.rock, bx = r ? (r[0] + r[2] + 1) * 16 : cx, by = r ? (r[3] + 1) * 32 - 2 : bottom; shadow(ctx, bx, by, f[2] * .7); ctx.drawImage(img, f[0], f[1], f[2], f[3], Math.round(bx - f[2] / 2), Math.round(by + 2 - f[3]), f[2], f[3]); break; } } // v0.88 실제 시설 관찰용 외관(지명 자리 칸 아랫변이 바닥 · 말 거는 자리는 그 앞 칸)
      const art = opts.art || 'peak';
      if (opts.water) { ctx.fillStyle = '#d5e0bb'; ctx.fillRect(cx - 26, bottom - 3, 52, 2); }
      if (art === 'peaks') drawPeaks(ctx, 'peaks', cx, bottom + 2, 104);
      else if (art === 'peak') drawPeaks(ctx, 'peak', cx, bottom + 2, 58);
      else if (art === 'pillar') { if (!propArt(ctx, 'pillar', cx, bottom)) { shadow(ctx, cx, bottom, 22); blit(ctx, 'pillar', cx, bottom, 3); } }
      else if (art === 'arch') { if (!propArt(ctx, 'arch', cx, bottom)) { shadow(ctx, cx, bottom, 60); blit(ctx, 'arch', cx, bottom, 3); } }
      else if (art === 'spring') { // 물골 샘: 콘크리트로 둘러싼 작은 샘
        const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
        shadow(ctx, cx, bottom + 1, 44);
        R(cx - 20, bottom - 26, 40, 24, '#9c988e'); R(cx - 20, bottom - 26, 40, 4, '#d9d5ca'); R(cx + 16, bottom - 26, 4, 24, '#7d796f');
        R(cx - 16, bottom - 20, 32, 12, '#4f8fa8'); R(cx - 16, bottom - 20, 32, 2, '#2f6175');
        ctx.globalAlpha = .55 + .3 * Math.sin(t / 260); R(cx - 10 + (Math.floor(t / 400) % 3) * 6, bottom - 15, 6, 2, '#bfe9f4'); ctx.globalAlpha = 1;
        R(cx - 22, bottom - 6, 44, 6, '#857f74'); R(cx - 4, bottom - 34, 8, 8, '#6f6a61'); R(cx - 1, bottom - 26, 2, 6, '#79c3d8');
      }
      else if (!propArt(ctx, 'rock', cx, bottom)) { shadow(ctx, cx, bottom, 34); blit(ctx, 'rock', cx, bottom, 3); }
      break;
    }
  }
  ctx.restore();
}

// 밟고 지나가는 바닥 그림(v0.37): 돌계단, 헬기장(3×3칸), 몽돌 해안. 지형 바로 위, 사람보다 먼저 그려요.
export function drawGround(ctx, g, time = 0) {
  const x = g.x * 32, y = g.y * 32, R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  if (g.kind === 'steps') {
    R(x, y, 32, 32, '#a49e92');
    for (let i = 0; i < 4; i++) { R(x + 1, y + i * 8, 30, 3, '#d3cdbf'); R(x + 1, y + i * 8 + 3, 30, 3, '#b6b0a3'); R(x + 1, y + i * 8 + 6, 30, 2, '#7f796e'); }
    R(x, y, 1, 32, '#6f695f'); R(x + 31, y, 1, 32, '#6f695f');
  } else if (g.kind === 'helipad') {
    R(x, y, 96, 96, '#9ea39f'); R(x + 2, y + 2, 92, 92, '#b3b8b3');
    for (let yy = 0; yy < 96; yy += 2) for (let xx = 0; xx < 96; xx += 2) { const d = Math.hypot(xx - 47, yy - 47); if (d > 36 && d < 41) R(x + xx, y + yy, 2, 2, '#e8c64a'); }
    R(x + 34, y + 30, 6, 36, '#f6f4ee'); R(x + 56, y + 30, 6, 36, '#f6f4ee'); R(x + 40, y + 45, 16, 6, '#f6f4ee');
    for (let i = 0; i < 96; i += 8) { R(x + i, y, 4, 2, '#f6f4ee'); R(x + i, y + 94, 4, 2, '#f6f4ee'); }
  } else if (g.kind === 'pebbles') {
    R(x, y, 32, 32, '#b9b3a6');
    const tones = ['#8d877c', '#a7a196', '#d3cec3', '#76736c', '#c4bfb3'];
    for (let i = 0; i < 9; i++) {
      const h = (g.x * 73 + g.y * 151 + i * 97) % 997, px = x + 2 + (h % 26), py = y + 2 + ((h >> 3) % 26), w = 4 + (h % 4), hh = 3 + ((h >> 2) % 3);
      R(px, py + hh, w, 1, '#6d685f'); R(px, py, w, hh, tones[h % tones.length]); R(px + 1, py, w - 2, 1, '#e4e0d6');
    }
  }
}
