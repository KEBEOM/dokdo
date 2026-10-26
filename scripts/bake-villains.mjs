// 몽땅랜드 NPC 걷기 시트 생성기 (v0.25 · 사용자 참고 도트 반영)
// node scripts/bake-villains.mjs  →  dist/assets/characters/villain-*-v25.png + dist/villain-atlases.js
//
// 도트 원본은 scripts/villain-dots.json 에 글자 그림으로 들어 있습니다(한 칸 32×32 도트, 글자 하나 = 도트 하나).
//   grunt: 직원(참고 이미지 2)  boss: 백무 사장(참고 이미지 1)
//   sheets.down / right / up 마다 [정지, 걷기1, 걷기2, 걷기3, 걷기4]. 왼쪽은 오른쪽을 반전합니다.
// 주인공·김박사와 같은 크기: 32도트 = 지도 한 칸(unit), 몸 높이 약 26도트, 검은 1도트 외곽선.
// 아래 DESIGNS에서 색 바꾸기(recolor), 머리카락 감추기(hood), 팀장 코트(coat)를 고칠 수 있습니다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOTS = JSON.parse(fs.readFileSync(path.join(root, 'scripts/villain-dots.json'), 'utf8'));
const N = 32, SCALE = 8, COLS = 5, ROWS = 3, DIRS = ['down', 'right', 'up'];
const OUTLINE = '#080709', HEAD_MAX = 18, BELT = 23, COAT_END = 27; // rows on the 32-dot grid (feet end on row 30)

// grunt palette letters: a outline · b c d e g h j k (dark cloth, cap, mask; dark → light) · f i hair/belt browns · l m light greys · n o skin · w eye white
const GREYS = 'cdeghjk';
const ramp = (dark, light) => Object.fromEntries([...GREYS].map((ch, i) => [ch, mix(dark, light, i / (GREYS.length - 1))]));
export const DESIGNS = {
  'grunt-m': { label: '몽땅랜드 직원', base: 'grunt', hood: true },
  'grunt-f': { label: '몽땅랜드 직원', base: 'grunt', hair: { b: '#2a1d16', f: '#4a3628', i: '#6a5040' } },
  'exec-ink': { label: '먹선 팀장', base: 'grunt', hood: true, coat: { body: '#1b1c21', shade: '#121317', trim: '#7a2333', opening: '#2b2c33' }, belt: '#7a2333' },
  'exec-crimson': { label: '쇄도 팀장', base: 'grunt', hair: { b: '#2a1d16', f: '#4a3628', i: '#6a5040' }, head: ramp('#3a1118', '#8a2c3a'), coat: { body: '#1d1a1d', shade: '#131114', trim: '#8f2b3b', opening: '#341a20' }, belt: '#5c4733' },
  'exec-indigo': { label: '무음 팀장', base: 'grunt', hood: true, head: ramp('#252b3a', '#5f6a82'), coat: { body: '#222634', shade: '#171a24', trim: '#8d96a8', opening: '#323849' }, belt: '#4b4f5c' },
  leader: { label: '백무 사장', base: 'boss' }
};

function mix(a, b, t) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function hex(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }

// One frame → a grid of colours (null = transparent).
function paint(d, rows, dir) {
  const pal = DOTS[d.base].palette;
  const g = rows.map((row, y) => [...row].map(ch => {
    if (ch === '.') return null;
    if (y <= HEAD_MAX) {
      if (d.hood && 'bfi'.includes(ch)) ch = { b: 'c', f: 'e', i: 'j' }[ch]; // hair under a full hood
      if (d.head?.[ch]) return d.head[ch];
      if (d.hair?.[ch]) return d.hair[ch];
    } else if (d.belt && y >= BELT - 1 && y <= BELT + 1 && 'fi'.includes(ch)) return d.belt;
    return pal[ch];
  }));
  if (d.coat) coat(g, rows, d.coat, dir);
  return g;
}
// 팀장: the jacket continues as a long coat over the legs (boots still show), trimmed in the design colour.
function coat(g, rows, c, dir) {
  const skin = (x, y) => 'now'.includes(rows[y][x]);
  const xs = g[BELT].map((v, x) => (v ? x : -1)).filter(x => x >= 0); if (!xs.length) return;
  const L = xs[0], R = xs.at(-1), mid = (L + R) / 2;
  for (let y = BELT + 1; y <= COAT_END + 1; y++) {
    const flare = y >= COAT_END - 1 ? 1 : 0, x0 = L - flare, x1 = R + flare;
    for (let x = x0; x <= x1; x++) {
      if (y <= COAT_END && skin(x, y)) continue;
      if (y === COAT_END + 1) { if (!g[y][x] || x === x0 || x === x1) g[y][x] = OUTLINE; continue; } // hem outline; boots still show below
      const edge = x === x0 || x === x1;
      const open = dir === 'right' ? x === x1 - 1 : Math.abs(x - mid) < 1;          // front opening (side view: the leading edge)
      const lining = dir === 'down' && Math.abs(Math.abs(x - mid) - 1.5) < .6;      // trim either side of the opening
      g[y][x] = edge ? OUTLINE : y === COAT_END || lining || (open && dir === 'right') ? c.trim : open ? c.opening : x > mid + 2 ? c.shade : c.body;
    }
  }
}

// ── tiny PNG writer (RGBA) ──
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export function bake(write = true) {
  const atlases = {}, cw = N * SCALE, W = cw * COLS, H = cw * ROWS;
  for (const [id, d] of Object.entries(DESIGNS)) {
    const rgba = Buffer.alloc(W * H * 4), frames = [];
    DIRS.forEach((dir, row) => {
      const grids = DOTS[d.base].sheets[dir].map(rows => paint(d, rows, dir));
      // one ground point per row so walking frames do not jitter: the middle of the feet, averaged over the row
      let sum = 0, n = 0;
      for (const g of grids) for (let y = 27; y <= 30; y++) g[y].forEach((v, x) => { if (v) { sum += x + .5; n++; } });
      const ax = Math.round((n ? sum / n : 16) * SCALE);
      frames.push(grids.map((g, col) => {
        let minX = N, minY = N, maxX = -1, maxY = -1;
        g.forEach((line, y) => line.forEach((c, x) => {
          if (!c) return;
          minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          const [r, gg, b] = hex(c);
          for (let yy = 0; yy < SCALE; yy++) for (let xx = 0; xx < SCALE; xx++) {
            const i = ((row * cw + y * SCALE + yy) * W + col * cw + x * SCALE + xx) * 4;
            rgba[i] = r; rgba[i + 1] = gg; rgba[i + 2] = b; rgba[i + 3] = 255;
          }
        }));
        return { rect: [col * cw + minX * SCALE, row * cw + minY * SCALE, (maxX - minX + 1) * SCALE, (maxY - minY + 1) * SCALE], anchor: [col * cw + ax, row * cw + 31 * SCALE] };
      }));
    });
    const key = `characters/villain-${id}-v25`;
    if (write) fs.writeFileSync(path.join(root, 'dist/assets', key + '.png'), png(W, H, rgba));
    atlases[`villain-${id}`] = { key, label: d.label, width: W, height: H, unit: N * SCALE, rows: { down: 0, right: 1, up: 2 }, frames };
  }
  if (write) fs.writeFileSync(path.join(root, 'dist/villain-atlases.js'), `// 몽땅랜드 걷기 시트 (scripts/bake-villains.mjs가 scripts/villain-dots.json으로 만든 파일). 정지 1 + 걷기 4, 왼쪽은 오른쪽 반전.\nexport const VILLAIN_ATLASES=${JSON.stringify(atlases)};\n`);
  return atlases;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) { const a = bake(); console.log('baked', Object.keys(a).join(', ')); }
