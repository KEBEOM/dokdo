// ─────────────────────────────────────────────────────────────────────────────
// 사계절 (v0.68) — 봄 · 여름 · 가을 · 겨울
//
// v0.69 게임 시계: 노는 동안 시간이 빨리 흘러요. 하루 = 2분 30초, 한 계절 = 2일(5분), 1년 = 20분.
//   기본 ‘시간 따라’: 봄 → 여름 → 가을 → 겨울이 차례로 와요(밤 12시에 바뀌어요).
//   메뉴의 ‘계절’에서 ‘달력 따라’(실제 달)나 한 계절 고정을 고를 수도 있어요. 낮·밤은 계속 흘러요(‘항상 낮’도 골라요).
//   시계는 이 기기에 기억해요(결투·컷신 중에는 멈춰요).
// 바뀌는 것
//   · 땅·나무·풀 그림의 초록색 → 계절 색 (assets.js의 그림 색 바꾸기 고리로, 지형·자연 그림에만)
//   · 세워 그린 들꽃 색 (겨울엔 들꽃이 없어요)
//   · 바람에 날리는 것: 봄 꽃잎, 여름 잎, 가을 단풍잎, 겨울 눈송이
// 사람·우산몬·건물 그림은 그대로예요.
// ─────────────────────────────────────────────────────────────────────────────
import { setAssetTint } from './assets.js';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_NAME = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
export const SEASON_ICON = { spring: '🌸', summer: '🌿', autumn: '🍁', winter: '❄' };
export const seasonOfMonth = m => (m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter'); // m: 0(1월)…11(12월)

export const DAY_MS = 150000, DAYS_PER_SEASON = 2, START_HOUR = 8;
const store = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 괜찮아요 */ } };
const load = k => { try { return localStorage.getItem(k); } catch { return null; } };
let choice = 'flow', dayMode = 'flow', clock = 0, savedClock = 0;
{ const v = load('dokdo-season'); if (v === 'flow' || v === 'auto' || SEASONS.includes(v)) choice = v; }
{ const v = load('dokdo-daynight'); if (v === 'flow' || v === 'day') dayMode = v; }
clock = Math.max(0, Number(load('dokdo-clock')) || 0); savedClock = clock;
export const seasonChoice = () => choice;
export const dayNightChoice = () => dayMode;
export const gameClock = () => clock;
export const hourOf = (ms = clock) => (START_HOUR + (ms % DAY_MS) / DAY_MS * 24) % 24;
export const dayOf = (ms = clock) => Math.floor((ms + START_HOUR / 24 * DAY_MS) / DAY_MS);
export const flowSeason = (ms = clock) => SEASONS[Math.floor(dayOf(ms) / DAYS_PER_SEASON) % 4];
export function currentSeason(now = new Date()) { return choice === 'flow' ? flowSeason() : choice === 'auto' ? seasonOfMonth(now.getMonth()) : choice; }
let shown = null;
export function setSeason(v) { choice = v === 'flow' || v === 'auto' || SEASONS.includes(v) ? v : 'flow'; store('dokdo-season', choice); shown = currentSeason(); applyTint(); return shown; }
export function setDayNight(v) { dayMode = v === 'day' ? 'day' : 'flow'; store('dokdo-daynight', dayMode); }
// 시계를 dt(밀리초)만큼 흘려요. 계절이 바뀌면 그림 색을 바꾸고 { season } 을 돌려줘요.
export function clockTick(dt) {
  clock += Math.max(0, Math.min(dt, 1000)); if (Math.abs(clock - savedClock) > 5000) { savedClock = clock; store('dokdo-clock', String(Math.round(clock))); }
  const s = currentSeason(); if (s !== shown) { const first = shown === null; shown = s; applyTint(); return first ? null : { season: s }; }
  return null;
}
export function setClock(ms) { clock = Math.max(0, ms); savedClock = clock; store('dokdo-clock', String(Math.round(clock))); return clockTick(0); }

// 하루의 빛: night 0(낮)…1(한밤), warm 0…1(새벽·노을의 주황빛)
const ramp = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
export function daylight(ms = clock) {
  if (dayMode === 'day') return { night: 0, warm: 0, hour: hourOf(ms) };
  const h = hourOf(ms), night = h >= 18 ? ramp(h, 18, 20) : h < 6 ? 1 - ramp(h, 4, 6) : 0;
  const warm = Math.max(0, 1 - Math.abs(h - 5.6) / 1.4) + Math.max(0, 1 - Math.abs(h - 18.4) / 1.6);
  return { night, warm: Math.min(1, warm), hour: h };
}
export const isNight = (ms = clock) => daylight(ms).night > .5;
// ‘오후 3시’처럼 읽는 시각
export function clockLabel(ms = clock) {
  const h = Math.floor(hourOf(ms)), p = h < 5 ? '새벽' : h < 12 ? '아침' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤', h12 = h % 12 || 12;
  return `${p} ${h12}시`;
}

// ── 색 바꾸기 ─────────────────────────────────────────────────────────────────
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
// 초록 한 점을 계절 색으로. 초록이 아니면(물·흙·바위·벽) null(그대로).
// part: 'ground'(땅·풀) 또는 'leaf'(나무·덤불). 가을 풀은 누렇게, 단풍은 붉고 노랗게 / 겨울 땅은 눈, 나무는 눈 쌓인 상록수.
export function seasonPixel(season, r, g, b, part = 'ground') {
  const [h, s, l] = rgb2hsl(r, g, b); if (h < 62 || h > 168 || s < .16 || l < .08 || l > .94) return null;
  if (season === 'summer') return part === 'leaf' ? hsl2rgb(h + (128 - h) * .2, Math.min(1, s * 1.18), l * .9) : hsl2rgb(h + (110 - h) * .15, Math.min(1, s * 1.1), l * .96); // 짙은 녹음
  if (season === 'spring') return hsl2rgb(h - (h - 92) * .45, Math.min(1, s * 1.05), Math.min(.9, l * 1.07 + .02)); // 연둣빛
  const t = Math.min(1, Math.max(0, (l - .18) / .5));
  if (season === 'autumn') return part === 'leaf'
    ? hsl2rgb(14 + t * 30, Math.min(1, s * .95 + .08), l * .96 + .02)    // 단풍: 어두운 잎은 붉게, 밝은 잎은 금빛
    : hsl2rgb(50 + t * 14, s * .78, l * .98);                             // 누렇게 물든 풀
  if (part === 'leaf') return l > .5 ? hsl2rgb(205, .12, .8 + .18 * (l - .5) / .44) : hsl2rgb(150, s * .45, Math.max(.12, l * .82)); // 눈 쌓인 상록수
  if (l < .2) return hsl2rgb(212, .16, .58);                               // 겨울 땅: 풀포기 그늘도 옅은 눈 그늘
  return hsl2rgb(205, .14, .7 + .27 * Math.pow(l, .7));                    // 눈
}
// 자리마다 다르게 얹는 계절 무늬(2×2 도트 덩어리 단위): 봄 나무엔 꽃송이, 봄 땅엔 꽃잎, 가을 나무는 붉은 잎·노란 잎이 섞이고 땅엔 낙엽
const spot = (x, y, s) => { let v = Math.imul((x >> 1) * 73856093 ^ (y >> 1) * 19349663 ^ s, 2654435761) >>> 0; v ^= v >>> 15; return (v >>> 0) / 4294967296; };
const BLOSSOM = [[255, 183, 206], [244, 150, 186], [255, 236, 244]], PETAL = [[255, 210, 226], [255, 246, 250]], FALLEN = [[217, 84, 42], [232, 144, 44], [184, 67, 42], [204, 160, 60]];
function pattern(season, part, x, y, r, g, b, o) {
  if (season === 'spring' && part === 'leaf') { const [, , l] = rgb2hsl(r, g, b); if (l > .3 && spot(x, y, 11) < .3) return BLOSSOM[Math.floor(spot(x, y, 12) * 3)]; }
  if (season === 'spring' && part === 'ground' && spot(x, y, 13) < .012) return PETAL[Math.floor(spot(x, y, 14) * 2)];
  if (season === 'autumn' && part === 'leaf' && spot(x >> 1, y >> 1, 15) < .35) { const [h, s, l] = rgb2hsl(...o); return hsl2rgb(h < 25 ? h + 26 : h - 22, s, l); }
  if (season === 'autumn' && part === 'ground' && spot(x, y, 16) < .03) return FALLEN[Math.floor(spot(x, y, 17) * 4)];
  return o;
}
export function seasonColor(hex, season = currentSeason()) {
  const n = parseInt(hex.slice(1, 7), 16), out = seasonPixel(season, n >> 16, (n >> 8) & 255, n & 255);
  return out ? '#' + out.map(v => v.toString(16).padStart(2, '0')).join('') : hex;
}
// 나무·덤불·소품 그림은 불러올 때 바꿔요(사람·우산몬·컷신·타이틀은 그대로). 땅은 terrain.js가 다 그린 땅 그림을 한 번에 바꿔요.
export const SEASON_KEYS = /^scenery\/(tileset-v2-objects|props-bw|island-art|village-pixels)/;
export function tintCanvas(c, part = 'leaf', season = currentSeason()) {
  if (!c?.getContext) return c;
  const g = c.getContext('2d', { willReadFrequently: true }), d = g.getImageData(0, 0, c.width, c.height), a = d.data, memo = new Map(), W = c.width, pat = season !== 'summer' && season !== 'winter';
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue; const k = (a[i] << 16) | (a[i + 1] << 8) | a[i + 2];
    let o = memo.get(k); if (o === undefined) { o = seasonPixel(season, a[i], a[i + 1], a[i + 2], part); memo.set(k, o); }
    if (!o) continue; if (pat) { const p = i >> 2; o = pattern(season, part, p % W, (p / W) | 0, a[i], a[i + 1], a[i + 2], o); }
    a[i] = o[0]; a[i + 1] = o[1]; a[i + 2] = o[2];
  }
  g.putImageData(d, 0, 0); return c;
}
function tint(key, image) {
  if (!SEASON_KEYS.test(key) || typeof document === 'undefined') return image;
  const c = document.createElement('canvas'); c.width = image.naturalWidth || image.width; c.height = image.naturalHeight || image.height;
  c.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0); return tintCanvas(c, 'leaf');
}
function applyTint() { setAssetTint(tint, currentSeason()); }
applyTint();

// ── 들꽃과 바람에 날리는 것 ────────────────────────────────────────────────────
const FLOWERS = {
  spring: [['#ffd1e3', '#f0a8c4', '#f6d44c'], ['#fff07a', '#e8c43c', '#f08a2a'], ['#ffffff', '#e6dcef', '#f6d44c']], // 벚꽃빛·민들레
  summer: [['#ffffff', '#d9dbe6', '#f6d44c'], ['#a9c8ff', '#7d9fe0', '#fff3a0']],                                   // 들국화·달개비
  autumn: [['#c9a6f0', '#a27fd0', '#f6d44c'], ['#ff9ec4', '#e0769f', '#ffe08a'], ['#ffffff', '#d9dbe6', '#f6d44c']], // 해국·코스모스
  winter: null
};
export const seasonFlowers = () => FLOWERS[currentSeason()];
const WIND = {
  spring: { colors: ['#ffd1e3', '#f7b6cf', '#ffffff', '#ffe3ee'], speed: 1, fall: 1 },
  summer: { colors: ['#7cc56b', '#a8d86f', '#5aa35c', '#ffffff'], speed: 1, fall: 1 },
  autumn: { colors: ['#e2602f', '#f0a43a', '#c4462d', '#d98a2b', '#9b5a2e'], speed: 1.15, fall: 1.25 },
  winter: { colors: ['#ffffff', '#f2f7ff', '#e3eefb'], speed: .32, fall: 1.7, count: .6 }
};
export const seasonWind = () => WIND[currentSeason()];

// ── 날씨 (v0.70) ── 하루를 반나절 둘로 나눠, 계절마다 정한 확률로 비나 눈이 와요(봄 30% · 여름 45% 장마 · 가을 25% · 겨울 눈 55%).
//   반나절의 처음과 끝에는 서서히 오고 서서히 그쳐요. 메뉴의 ‘날씨’에서 ‘늘 맑음’도 골라요.
const RAIN = { spring: .3, summer: .45, autumn: .25 }, SNOW = .55;
let weatherMode = 'flow';
{ const v = load('dokdo-weather'); if (v === 'flow' || v === 'clear') weatherMode = v; }
export const weatherChoice = () => weatherMode;
export function setWeather(v) { weatherMode = v === 'clear' ? 'clear' : 'flow'; store('dokdo-weather', weatherMode); }
const segHash = n => { let v = Math.imul(n + 7919, 2654435761) >>> 0; v ^= v >>> 13; v = Math.imul(v, 1274126177) >>> 0; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
// { kind: 'clear' | 'rain' | 'snow', amount: 0…1 }
export function weatherNow(ms = clock, season = currentSeason()) {
  if (weatherMode === 'clear') return { kind: 'clear', amount: 0 };
  const half = DAY_MS / 2, t = ms + START_HOUR / 24 * DAY_MS, seg = Math.floor(t / half), f = (t - seg * half) / half, r = segHash(seg);
  const kind = season === 'winter' ? (r < SNOW ? 'snow' : 'clear') : (r < (RAIN[season] || 0) ? 'rain' : 'clear');
  if (kind === 'clear') return { kind, amount: 0 };
  const edge = Math.min(1, f / .1, (1 - f) / .1); return { kind, amount: Math.max(0, edge) };
}
