// ─────────────────────────────────────────────────────────────────────────────
// 배경음악과 효과음 (v0.55)
//
// 소리 파일 없이 Web Audio로 그 자리에서 만들어요(악보: music-data.js). 그래서 저작권 걱정이 없고
// 오프라인 한 파일 판에도 그대로 들어가요.
//   music(id)   배경음악 바꾸기(같은 곡이면 그대로 이어요, null이면 조용히) — 곡을 바꿀 때 살짝 겹쳐 넘어가요
//   sfx(name)   효과음 (SFX 아래 목록)
//   jingle(id)  짧은 알림 노래(승리·레벨 업·동료·도장 …). 그동안 배경음악을 작게 줄여요
//   setOn / setVolume  켜기·끄기와 배경음·효과음 크기(이 기기에 기억해요: localStorage 'dokdo-audio')
// 브라우저는 사용자가 한 번 누르거나 키를 쳐야 소리를 낼 수 있어요(unlock).
// ─────────────────────────────────────────────────────────────────────────────
import { TRACKS, JINGLES, compileTrack, freq } from './music-data.js';

const PREF_KEY = 'dokdo-audio';
const prefs = { on: true, music: .7, sfx: .8 };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch { /* 저장소를 못 쓰면 기본값 */ }
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* 무시 */ } };

let ctx = null, master = null, musicBus = null, duckBus = null, sfxBus = null, noise = null, pulseWave = null;
let wanted = null, playing = null, timer = 0, duckUntil = 0, woke = false;
const compiled = {};
const track = id => (compiled[id] ??= compileTrack(TRACKS[id]));

export const audioPrefs = () => ({ ...prefs });
export const currentMusic = () => playing?.id || null;
export const wantedMusic = () => wanted;

function ensure() {
  if (ctx || typeof window === 'undefined') return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  return build(new AC());
}
function build(context) {
  ctx = context;
  master = ctx.createGain(); master.gain.value = prefs.on ? 1 : 0;
  // 귀를 보호하는 마지막 단계: 너무 큰 소리를 눌러 줘요
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
  master.connect(comp); comp.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = prefs.music * .4;
  duckBus = ctx.createGain(); duckBus.gain.value = 1; musicBus.connect(duckBus); duckBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx * .9; sfxBus.connect(master);
  const len = ctx.sampleRate; noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  // 25% 펄스(옛날 게임기 소리): 푸리에 계수로 만들어요
  const n = 24, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = 2 * Math.sin(Math.PI * k * .25) / (Math.PI * k);
  pulseWave = ctx.createPeriodicWave(re, im);
  return ctx;
}
// 검사용: 곡이나 알림 노래를 소리 없이 seconds초 만들어 파형(Float32Array)을 돌려줘요(tests/audio-render).
export async function renderOffline(id, seconds = 12, rate = 22050) {
  const keep = { ctx, master, musicBus, duckBus, sfxBus, noise, pulseWave };
  build(new OfflineAudioContext(1, Math.ceil(rate * seconds), rate));
  try {
    const t = TRACKS[id] ? track(id) : compileTrack(JINGLES[id]), step = 1 / t.speed, loopLen = t.length * step, out = ctx.createGain();
    out.gain.value = t.vol; out.connect(TRACKS[id] ? musicBus : sfxBus);
    for (let loop = 0; loop * loopLen < seconds && (TRACKS[id] || loop === 0); loop++)
      for (const part of t.parts) for (const ev of part.events) { const at = loop * loopLen + ev.at * step; if (at < seconds) play(part, ev, at, step, out); }
    return (await ctx.startRendering()).getChannelData(0);
  } finally { ({ ctx, master, musicBus, duckBus, sfxBus, noise, pulseWave } = keep); }
}
export async function renderSfx(name, seconds = 1.5, rate = 22050) {
  const keep = { ctx, master, musicBus, duckBus, sfxBus, noise, pulseWave };
  build(new OfflineAudioContext(1, Math.ceil(rate * seconds), rate));
  try { SFX[name](); return (await ctx.startRendering()).getChannelData(0); } finally { ({ ctx, master, musicBus, duckBus, sfxBus, noise, pulseWave } = keep); }
}
// 처음 누르거나 키를 칠 때 소리를 깨워요
export function unlock() {
  woke = true; if (!ensure()) return;
  if (ctx.state === 'suspended' && prefs.on && !document.hidden) ctx.resume().catch(() => {});
  if (wanted && !playing && prefs.on) startMusic(wanted);
}
export function setOn(on) {
  prefs.on = !!on; savePrefs();
  if (!ensure()) return;
  master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(prefs.on ? 1 : 0, ctx.currentTime, .05);
  if (prefs.on) unlock(); else stopMusic(.2);
}
export function setVolume(kind, v) {
  prefs[kind] = Math.max(0, Math.min(1, Number(v))); savePrefs();
  if (!ensure()) return;
  if (kind === 'music') musicBus.gain.setTargetAtTime(prefs.music * .4, ctx.currentTime, .05);
  if (kind === 'sfx') sfxBus.gain.setTargetAtTime(prefs.sfx * .9, ctx.currentTime, .05);
}
export const isOn = () => prefs.on;
if (typeof document !== 'undefined') {
  const wake = () => unlock();
  for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else if (prefs.on) ctx.resume().catch(() => {}); });
}

// ── 악기 ───────────────────────────────────────────────────────────────────────
function env(g, t, peak, a, hold, rel) {
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
  if (hold > a) g.gain.setValueAtTime(peak, t + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(hold, a) + rel);
  return t + Math.max(hold, a) + rel + .02;
}
function osc(type, f, t, end, dest, detune = 0) {
  const o = ctx.createOscillator(); if (type === 'pulse') o.setPeriodicWave(pulseWave); else o.type = type;
  o.frequency.setValueAtTime(f, t); o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o;
}
const INSTRUMENTS = {
  // 대금 느낌: 부드럽게 시작하고, 길게 끄는 음에는 떨림(농음)이 들어가요. 숨소리를 조금 섞어요.
  flute(t, f, dur, v, dest, vib = 1) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; g.connect(lp); lp.connect(dest);
    const end = env(g, t, .3 * v, .05, dur * .92, .14);
    const o1 = osc('triangle', f, t, end, g), o2 = osc('sine', f * 2, t, end, g);
    const og = ctx.createGain(); og.gain.value = .25; o2.disconnect(); o2.connect(og); og.connect(g);
    if (dur > .32) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .012 * vib, t + Math.min(.45, dur * .6)); lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency); lfo.start(t); lfo.stop(end); }
    // 숨소리
    const n = ctx.createBufferSource(), ng = ctx.createGain(), bp = ctx.createBiquadFilter(); n.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2;
    n.connect(bp); bp.connect(ng); ng.connect(dest); env(ng, t, .035 * v, .03, .06, .08); n.start(t, Math.random() * .5); n.stop(t + .2);
  },
  // 가야금 느낌: 줄을 뜯는 소리. 처음엔 밝고 빨리 어두워져요. 시작할 때 살짝 밀어 올리는 음(시김새)
  gayageum(t, f, dur, v, dest) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3; g.connect(lp); lp.connect(dest);
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t + .35);
    const len = Math.min(1.4, Math.max(.4, dur * 1.2)), end = t + len + .05;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.42 * v, t + .006); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const o = osc('sawtooth', f * .985, t, end, g); o.frequency.exponentialRampToValueAtTime(f, t + .05);
    const o2 = osc('triangle', f * 2, t, end, g, 4); o2.disconnect(); const g2 = ctx.createGain(); g2.gain.value = .3; o2.connect(g2); g2.connect(g);
  },
  // 피리 느낌: 또렷하고 힘 있는 소리(결투·길)
  piri(t, f, dur, v, dest, vib = 1) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 1.5; g.connect(lp); lp.connect(dest);
    const end = env(g, t, .2 * v, .02, dur * .85, .08);
    const o1 = osc('pulse', f, t, end, g), o2 = osc('sawtooth', f, t, end, g, 7); o2.disconnect(); const g2 = ctx.createGain(); g2.gain.value = .35; o2.connect(g2); g2.connect(g);
    if (dur > .3) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .01 * vib, t + .3); lfo.connect(lg); lg.connect(o1.frequency); lfo.start(t); lfo.stop(end); }
  },
  pulse(t, f, dur, v, dest) {
    const g = ctx.createGain(); g.connect(dest);
    const end = env(g, t, .13 * v, .005, Math.min(dur * .8, .5), .06); osc('pulse', f, t, end, g);
  },
  bass(t, f, dur, v, dest) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; g.connect(lp); lp.connect(dest);
    const end = env(g, t, .45 * v, .008, Math.min(dur * .8, .7), .1); osc('triangle', f, t, end, g); const o = osc('sine', f / 2, t, end, g); o.disconnect(); const s = ctx.createGain(); s.gain.value = .5; o.connect(s); s.connect(g);
  },
  pad(t, f, dur, v, dest) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; g.connect(lp); lp.connect(dest);
    const end = env(g, t, .12 * v, Math.min(.6, dur * .4), dur * .9, .5); osc('triangle', f, t, end, g, -6); osc('sine', f, t, end, g, 6);
  },
  // 장구·북: D 덩 · K 쿵 · T 덕 · R 더러러 · h 작은 찰 소리
  drum(t, hit, step, v, dest) {
    const kung = (at, s = 1) => { const g = ctx.createGain(); g.connect(dest); const end = env(g, at, .55 * v * s, .003, .02, .28); const o = osc('sine', 150, at, end, g); o.frequency.exponentialRampToValueAtTime(55, at + .2); };
    const deok = (at, s = 1) => { const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = 2300; bp.Q.value = 1.2; n.connect(bp); bp.connect(g); g.connect(dest); env(g, at, .32 * v * s, .001, .005, .07); n.start(at, Math.random() * .5); n.stop(at + .12);
      const g2 = ctx.createGain(); g2.connect(dest); const e2 = env(g2, at, .16 * v * s, .001, .004, .05); osc('triangle', 880, at, e2, g2); };
    const hat = at => { const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 7000; n.connect(hp); hp.connect(g); g.connect(dest); env(g, at, .12 * v, .001, .003, .03); n.start(at, Math.random() * .5); n.stop(at + .06); };
    if (hit === 'D') { kung(t); deok(t, .8); } else if (hit === 'K') kung(t); else if (hit === 'T') deok(t);
    else if (hit === 'R') { deok(t, .55); deok(t + step / 3, .7); deok(t + step * 2 / 3, .9); } else if (hit === 'h') hat(t);
  }
};
function play(part, ev, t, step, dest) {
  if (part.inst === 'drum') return INSTRUMENTS.drum(t, ev.hit, step, part.gain, dest);
  INSTRUMENTS[part.inst]?.(t, freq(ev.note), ev.len * step, part.gain, dest, part.vib ?? 1);
}

// ── 배경음악 순서기: 0.3초 앞까지 미리 예약하고, 곡 끝에서 처음으로 돌아가요 ────────
function startMusic(id) {
  if (!ctx || !prefs.on) return;
  const t = track(id), out = ctx.createGain(); out.gain.value = 0; out.connect(musicBus);
  const now = ctx.currentTime + .08; out.gain.setValueAtTime(0, now); out.gain.linearRampToValueAtTime(t.vol, now + .5);
  const cursors = t.parts.map(() => 0);
  playing = { id, t, out, start: now, loop: 0, cursors };
  clearInterval(timer); timer = setInterval(pump, 60); pump();
}
function stopMusic(fade = .5) {
  if (!playing) return;
  const p = playing; playing = null; clearInterval(timer); timer = 0;
  if (ctx) { const now = ctx.currentTime; p.out.gain.cancelScheduledValues(now); p.out.gain.setValueAtTime(p.out.gain.value, now); p.out.gain.linearRampToValueAtTime(0, now + fade); setTimeout(() => p.out.disconnect(), (fade + 2) * 1000); }
}
function pump() {
  const p = playing; if (!p || !ctx || !p.t.parts.some(x => x.events.length)) return;
  const step = 1 / p.t.speed, horizon = ctx.currentTime + .3, loopLen = p.t.length * step;
  for (;;) {
    let best = -1, bestAt = Infinity;
    p.t.parts.forEach((part, i) => { const ev = part.events[p.cursors[i]]; if (ev && ev.at < bestAt) { bestAt = ev.at; best = i; } });
    if (best < 0) { p.loop++; p.cursors.fill(0); continue; }
    const at = p.start + p.loop * loopLen + bestAt * step;
    if (at > horizon) break;
    const part = p.t.parts[best], ev = part.events[p.cursors[best]++];
    if (at >= ctx.currentTime - .02) play(part, ev, at, step, p.out);
  }
}
export function music(id) {
  if (id && !TRACKS[id]) id = null;
  if (id === wanted && (playing?.id === id || !ctx)) return;
  wanted = id;
  if (!woke || !ensure()) return;                  // 아직 아무것도 누르지 않았으면, 누르는 순간 시작해요
  if (playing?.id === id) return;
  stopMusic(.6);
  if (id && prefs.on) startMusic(id);
}

// ── 알림 노래: 배경음악을 줄이고 한 번 울려요 ──────────────────────────────────
export function jingle(id) {
  const spec = JINGLES[id]; if (!spec || !prefs.on || !woke || !ensure()) return;
  const t = compileTrack(spec), step = 1 / t.speed, start = ctx.currentTime + .03, len = t.length * step;
  const out = ctx.createGain(); out.gain.value = t.vol * .9; out.connect(sfxBus);
  for (const part of t.parts) for (const ev of part.events) play(part, ev, start + ev.at * step, step, out);
  duckUntil = Math.max(duckUntil, start + len + .2);
  duckBus.gain.cancelScheduledValues(start); duckBus.gain.setTargetAtTime(.18, start, .05); duckBus.gain.setTargetAtTime(1, duckUntil, .25);
  setTimeout(() => out.disconnect(), (len + 3) * 1000);
}

// ── 효과음 ─────────────────────────────────────────────────────────────────────
function tone(type, f0, f1, len, vol, at = 0, dest = sfxBus) {
  const t = ctx.currentTime + at, g = ctx.createGain(); g.connect(dest);
  const end = env(g, t, vol, .004, len * .3, len * .7); const o = osc(type, f0, t, end, g);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
}
function hiss(len, vol, from, to, at = 0, type = 'bandpass') {
  const t = ctx.currentTime + at, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noise; f.type = type; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + len); f.Q.value = 1.5;
  n.connect(f); f.connect(g); g.connect(sfxBus); env(g, t, vol, .005, len * .2, len * .8); n.start(t, Math.random() * .5); n.stop(t + len + .1);
}
const N = n => freq(n);
export const SFX = {
  blip: () => tone('pulse', 1180, 0, .03, .16),                                  // 글자가 한 자씩 나올 때
  tap: () => tone('triangle', 900, 0, .05, .26),                                    // 단추 누르기
  select: () => tone('pulse', 740, 0, .045, .22),                                   // 결투 명령 고르기
  talk: () => { tone('triangle', N(74), 0, .07, .22); tone('triangle', N(81), 0, .09, .2, .05); }, // 말 걸기
  next: () => tone('triangle', 660, 0, .045, .22),                                  // 대사 넘기기
  cancel: () => { tone('triangle', 660, 0, .05, .1); tone('triangle', 494, 0, .07, .09, .05); },
  door: () => { hiss(.22, .18, 600, 2400); tone('sine', 140, 70, .16, .25, .14); },  // 문 열고 들어가기
  stairs: up => { [0, 1, 2].forEach(i => tone('triangle', N(up ? 67 + i * 5 : 79 - i * 5), 0, .07, .2, i * .06)); },
  jump: () => tone('triangle', 330, 620, .11, .16),                                  // 폴짝
  land: () => tone('sine', 150, 90, .06, .2),                                        // 착지
  bump: () => tone('sine', 140, 70, .09, .35),                                      // 벽에 부딪힘
  encounter: () => { hiss(.5, .22, 400, 6000); [0, 1, 2, 3].forEach(i => tone('pulse', N(62 + i * 3), 0, .07, .09, .05 + i * .06)); tone('sine', 160, 50, .35, .5, .3); },
  correct: () => { tone('triangle', N(88), 0, .12, .22); tone('triangle', N(93), 0, .3, .22, .09); tone('sine', N(100), 0, .3, .06, .09); },
  wrong: () => { tone('square', N(55), N(53), .16, .16); tone('square', N(50), N(48), .3, .16, .14); },
  hit: () => { hiss(.18, .35, 3000, 500); tone('sine', 220, 60, .18, .4); },
  hitStrong: () => { hiss(.26, .45, 5000, 400); tone('sine', 260, 50, .26, .55); tone('pulse', N(84), N(96), .2, .06, .02); },
  hitWeak: () => { hiss(.1, .18, 1500, 600); tone('sine', 180, 90, .1, .2); },
  hurt: () => { hiss(.2, .38, 1800, 300); tone('square', 200, 80, .2, .14); },        // 내 우산몬이 충격을 받음
  faint: () => tone('triangle', N(72), N(48), .7, .2),                              // 지침
  purify: () => { [76, 79, 83, 86, 88, 91].forEach((n, i) => tone('sine', N(n), 0, .25, .12, i * .05)); hiss(.6, .08, 8000, 3000, 0, 'highpass'); }, // 검은 기운이 걷힘
  morph: () => { tone('sawtooth', 200, 1600, .8, .08); hiss(.9, .12, 500, 9000); [88, 91, 95, 100].forEach((n, i) => tone('sine', N(n), 0, .3, .1, .55 + i * .07)); },
  run: () => { hiss(.3, .2, 3000, 800); tone('triangle', N(76), N(64), .25, .1); },
  xp: () => tone('triangle', N(84), 0, .07, .2),
  save: () => { tone('sine', N(81), 0, .12, .14); tone('sine', N(88), 0, .25, .12, .1); },
  coin: () => { tone('pulse', N(88), 0, .05, .2); tone('pulse', N(95), 0, .18, .2, .06); },
  toggle: () => { tone('triangle', N(79), 0, .06, .12); tone('triangle', N(86), 0, .12, .12, .07); },
  stampThud: () => { tone('sine', 110, 45, .35, .7); hiss(.15, .3, 1200, 300); }      // 도장 쾅
};
export function sfx(name, arg) {
  if (!prefs.on || !SFX[name] || !woke || !ensure()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  try { SFX[name](arg); } catch (e) { console.warn('sfx', name, e); }
}
