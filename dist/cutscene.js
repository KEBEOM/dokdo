// Reusable story cutscenes: pixel scene + Pokémon-style dialogue box with typing, ▼, fades, choices and skip.
// Scripts live in story.js. Usage: const result = await cutscenes.play(OPENING, { vars, avatar });
import { createTypewriter } from './typewriter.js';
import { cutsceneLayout } from './layout.js';
import { fillJosa } from './text.js';
import { assetImage } from './assets.js';
import { TERRAIN_ATLAS } from './terrain-atlas.js';
import { SCENERY_ATLAS } from './scenery-atlas.js';
import { CUTSCENE_ATLAS } from './cutscene-atlas.js';
import { islandFrame } from './island-pictures.js';
import { terrainSample } from './terrain.js';
import { drawExplorer, drawResident, PROFESSOR_PICTURE } from './characters.js';
import { drawMonster } from './sprites.js';
import { preloadMonsters } from './assets.js';

const SW = 320, SH = 180, FADE = 380;
// Large pictures that slide in beside the scene (cue 'picture:professor', then 'picture-off').
const PICTURES = { professor: { key: PROFESSOR_PICTURE, name: '김박사', role: '독도 생물 연구자' } };
const wait = ms => new Promise(r => setTimeout(r, ms));

export function createCutscenePlayer(root, { onBlip = null, onAdvance = null } = {}) {
  root.innerHTML = `
    <canvas class="cs-canvas" aria-hidden="true"></canvas>
    <div class="cs-overlay" aria-hidden="true"><div class="cs-caption"></div><div class="cs-title"></div></div>
    <div class="cs-fade"></div>
    <button class="cs-skip" type="button" aria-label="이야기 건너뛰기">건너뛰기 ▸▸</button>
    <div class="cs-box" role="group" aria-live="polite">
      <div class="cs-name"></div>
      <p class="cs-text"></p>
      <div class="cs-choices"></div>
      <button class="cs-next" type="button" aria-label="다음 대사">▼</button>
    </div>`;
  const canvas = root.querySelector('.cs-canvas'), ctx = canvas.getContext('2d');
  const fade = root.querySelector('.cs-fade'), box = root.querySelector('.cs-box');
  const nameEl = root.querySelector('.cs-name'), textEl = root.querySelector('.cs-text');
  const choicesEl = root.querySelector('.cs-choices'), nextEl = root.querySelector('.cs-next');
  const captionEl = root.querySelector('.cs-caption'), titleEl = root.querySelector('.cs-title'), overlay = root.querySelector('.cs-overlay');
  const writer = createTypewriter(textEl, { speed: 30, onChar: onBlip });
  let running = null, scene = null, raf = 0, view = { k: 1, ox: 0, oy: 0, dpr: 1 }, advance = null, skipRequested = false, choiceIndex = 0;

  function resize() {
    const r = root.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
    const boxH = box.offsetHeight || 150, L = cutsceneLayout(r.width, r.height, boxH);
    const { k, oy } = L, sw = L.pw, sh = L.ph;
    view = { k, ox: L.ox, oy, dpr, sw, sh };
    Object.assign(overlay.style, { left: view.ox + 'px', top: view.oy + 'px', width: sw + 'px', height: sh + 'px' });
    // The dialogue box sits right under the picture whenever the screen has room (tablets, monitors).
    box.style.bottom = L.boxBottom + 'px';
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (running) resize(); }).observe(root);

  // ── drawing helpers in 320×180 scene units ──
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function tiles(kind, x0, y0, x1, y1, size = 16) {
    const sheet = assetImage(TERRAIN_ATLAS.key);
    for (let y = y0, ty = 0; y < y1; y += size, ty++) for (let x = x0, tx = 0; x < x1; x += size, tx++) {
      if (!sheet) { R(x, y, size, size, { water: '#39818d', grass: '#a0af65', tall: '#899a50', path: '#c9a572', sand: '#efd099', dock: '#a1744f' }[kind]); continue; }
      const f = terrainSample(kind, tx, ty);
      ctx.save(); ctx.translate(x + (f.flipX ? size : 0), y + (f.flipY ? size : 0)); ctx.scale(f.flipX ? -1 : 1, f.flipY ? -1 : 1);
      ctx.drawImage(sheet, ...f.rect, 0, 0, size + .5, size + .5); ctx.restore();
    }
  }
  function peaks(x, bottom, width, crop = [110, 185, 1130, 575]) {
    // v0.38: 2D 도트로 그린 독도(서도·동도). crop이 한 봉우리(590)면 서도만.
    const pic = assetImage(CUTSCENE_ATLAS.key), f = islandFrame(crop[2] === 590 ? 'seodo' : 'dokdo', width);
    if (pic && f) { const h = Math.round(width * f[3] / f[2]); ctx.drawImage(pic, f[0], f[1], f[2], f[3], Math.round(x), Math.round(bottom - h), width, h); return; }
    const sheet = assetImage(SCENERY_ATLAS.monument.key); if (!sheet) return;
    const [sx, sy, sw, sh] = crop, h = width * sh / sw;
    ctx.drawImage(sheet, sx, sy, sw, sh, x, bottom - h, width, h);
  }
  // v0.38 도트 배경 그림(scripts/draw-cutscene-art.py). 그림이 아직 안 불러와졌으면 false → 예전 그리기로 대신해요.
  function art(key, x, y, w = null, h = null, cropH = null) {
    const sheet = assetImage(CUTSCENE_ATLAS.key), f = CUTSCENE_ATLAS.frames[key]; if (!sheet || !f) return false;
    const [sx, sy, sw, sh0] = f, sh = cropH ? Math.min(cropH, sh0) : sh0;
    ctx.drawImage(sheet, sx, sy, sw, sh, Math.round(x), Math.round(y), w ?? sw, h ?? sh); return true;
  }
  const hasArt = () => !!assetImage(CUTSCENE_ATLAS.key);
  // 맑은 하늘(높이 h까지) + 흘러가는 구름 + 해
  function skyDay(t, h, sun = true) {
    art('sky-day', 0, 0, null, null, h);
    if (sun) art('sun', 252, 2);
    const drift = [['cloud-3', 0, 10, 140], ['cloud-1', 150, 22, 100], ['cloud-2', 260, 6, 120]];
    for (const [k, x0, y, speed] of drift) { const [, , w] = CUTSCENE_ATLAS.frames[k]; const x = ((x0 + t / speed) % (SW + w + 40)) - w - 20; if (y < h - 6) art(k, x, y, null, null, Math.max(1, h - y)); }
  }
  // 바다 띠(y부터 h줄) + 반짝이는 물결
  function seaStrip(y, h, t, key = 'sea') {
    art(key, 0, y, null, null, h);
    for (let i = 0; i < 18; i++) {
      const yy = y + 3 + ((i * 7) % Math.max(4, h - 4)), x = (i * 53 + t / (60 + (i % 4) * 25)) % (SW + 20) - 10, on = Math.sin(t / 300 + i * 1.7) > .55;
      if (on) { R(x, yy, 2 + (yy - y) / 14, 1, '#effcff'); }
    }
  }
  // 울릉도: 가파른 초록 산(성인봉 쪽)과 바닷가 절벽. 장면에 island: 'ulleung'을 적으면 독도 바위 대신 그려요.
  function hills(x, bottom, width) {
    const sizes = [220, 196, 190, 160, 150, 120, 104], best = sizes.reduce((a, b) => Math.abs(b - width) < Math.abs(a - width) ? b : a);
    const f = CUTSCENE_ATLAS.frames[`ulleung-${best}`];
    if (f && art(`ulleung-${best}`, x, bottom - Math.round(f[3] * width / f[2]), width, Math.round(f[3] * width / f[2]))) return;
    oldHills(x, bottom, width);
  }
  function oldHills(x, bottom, width) {
    const h = width * .5, peak = x + width * .45;
    ctx.fillStyle = '#2f5a3c'; ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x + width * .12, bottom - h * .55); ctx.lineTo(peak - width * .12, bottom - h * .88); ctx.lineTo(peak, bottom - h);
    ctx.lineTo(peak + width * .16, bottom - h * .8); ctx.lineTo(x + width * .86, bottom - h * .5); ctx.lineTo(x + width, bottom); ctx.fill();
    ctx.fillStyle = '#3f7a4a'; ctx.beginPath(); ctx.moveTo(x + width * .05, bottom); ctx.lineTo(x + width * .2, bottom - h * .45); ctx.lineTo(peak - width * .02, bottom - h * .8); ctx.lineTo(x + width * .62, bottom - h * .55); ctx.lineTo(x + width * .8, bottom); ctx.fill();
    for (let i = 0; i < 9; i++) R(x + width * (.1 + i * .09), bottom - h * (.25 + (i % 3) * .1), 4, 3, '#5f9a5f');
    R(x, bottom - 6, width, 6, '#8a8276'); for (let i = 0; i < width; i += 9) R(x + i, bottom - 6, 5, 2, '#a9a196');
  }
  const backdrop = (s, x, bottom, width, crop) => s.def.island === 'ulleung' ? hills(x, bottom, width) : peaks(x, bottom, width, crop);
  function person(c, t) {
    const size = c.size || 52, hop = c.hopAt ? Math.max(0, Math.sin(Math.min(1, (t - c.hopAt) / 450) * Math.PI)) * 10 : 0;
    const x = c.x - size / 2, y = c.y - size * .9375 - hop;
    if (c.who === 'player') drawExplorer(ctx, c.avatar, x, y, size, c.dir, !!c.walking, c.dist || 0);
    else if (c.who.startsWith('actor:')) drawResident(ctx, c.who.slice(6), x, y, size, t, c.dir, !!c.walking, c.dist || 0);
    else if (c.who.startsWith('monster:')) {
      const bob = Math.sin(t / 260) * 1.5, skip = c.walking ? Math.abs(Math.sin(t / 110)) * 5 : 0;
      const shown = c.showAt ? Math.min(1, (t - c.showAt) / 650) : 1;
      if (c.showAt && t - c.showAt < 900) { // a column of light where it appears
        const k = Math.max(0, 1 - (t - c.showAt) / 900); ctx.globalAlpha = .55 * k;
        R(c.x - size * .32, 0, size * .64, c.y, '#c8fbff'); R(c.x - size * .16, 0, size * .32, c.y, '#ffffff'); ctx.globalAlpha = 1;
      }
      if (c.aura && !c.calmAt) auraAround(c, size, t);
      ctx.globalAlpha = shown;
      drawMonster(ctx, c.who.slice(8), c.x - size / 2, c.y - size - hop + bob - skip - (1 - shown) * 10, size, t / 1000);
      ctx.globalAlpha = 1;
      if (c.calmAt && t - c.calmAt < 1300) { const a = (t - c.calmAt) / 1300; for (let i = 0; i < 12; i++) { ctx.globalAlpha = 1 - a; R(c.x + Math.cos(i * .52) * a * size * .9, c.y - size / 2 + Math.sin(i * .52) * a * size * .7, 3, 3, '#ffe9a6'); } ctx.globalAlpha = 1; }
    }
  }
  function auraAround(c, size, t) { // dark energy swirling around a cast member (cast option aura: true, cue calm:<id>)
    for (let i = 0; i < 24; i++) {
      const age = (t / 16 + i * 29) % 90, x = c.x + Math.sin(i * 2.3 + t / 380) * size * .5, y = c.y - age * size / 90;
      ctx.globalAlpha = .62 * (1 - age / 90); R(x - 3, y - 3, 7, 7, i % 2 ? '#3b1d5c' : '#120b1f');
    }
    ctx.globalAlpha = 1;
  }
  function picture(t, s) {
    const p = s.picture, info = p && PICTURES[p.id], img = info && assetImage(info.key); if (!img) return;
    const inP = Math.min(1, (t - p.at) / 450), outP = p.offAt ? Math.min(1, (t - p.offAt) / 350) : 0, a = inP * (1 - outP);
    if (a <= 0) return;
    const e = 1 - Math.pow(1 - inP, 3), dx = (1 - e) * 46;
    ctx.save(); ctx.globalAlpha = a * .42; R(0, 0, SW, SH, '#08121c');
    ctx.globalAlpha = a; ctx.fillStyle = '#1f5f6e'; ctx.beginPath(); ctx.moveTo(204 + dx, 0); ctx.lineTo(SW, 0); ctx.lineTo(SW, SH); ctx.lineTo(160 + dx, SH); ctx.fill();
    ctx.fillStyle = '#7fe3ea'; ctx.beginPath(); ctx.moveTo(200 + dx, 0); ctx.lineTo(204 + dx, 0); ctx.lineTo(160 + dx, SH); ctx.lineTo(156 + dx, SH); ctx.fill();
    const h = 178; ctx.imageSmoothingEnabled = true; ctx.drawImage(img, 248 - h / 2 + dx, SH - h + 4, h, h); ctx.imageSmoothingEnabled = false;
    R(14 + dx / 2, 30, 104, 30, '#10202b'); R(15 + dx / 2, 31, 102, 28, '#fff8e1'); R(15 + dx / 2, 31, 4, 28, '#e07a3a');
    ctx.fillStyle = '#10202b'; ctx.textBaseline = 'alphabetic'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(info.name, 25 + dx / 2, 46);
    ctx.fillStyle = '#3d6b63'; ctx.font = '7px sans-serif'; ctx.fillText(info.role, 25 + dx / 2, 55);
    ctx.restore();
  }
  function bubble(x, y, t0, t) {
    if (!t0 || t - t0 > 1400) return;
    const by = y - 6 - Math.min(4, (t - t0) / 40);
    R(x - 6, by - 14, 12, 14, '#fff8e1'); R(x - 7, by - 13, 14, 12, '#fff8e1'); R(x - 1, by - 11, 3, 6, '#c0392b'); R(x - 1, by - 4, 3, 2, '#c0392b');
  }

  // ── backgrounds ──
  const LEGACY = {
    stage(t, s) {
      for (let y = 0; y < 120; y += 4) R(0, y, SW, 4, y % 8 ? '#1d2b4f' : '#22345e');
      // spotlight cones
      const glow = s.cues.spot ? .22 + .08 * Math.sin(t / 200) : .12;
      ctx.globalAlpha = glow; ctx.fillStyle = '#ffe9a6';
      ctx.beginPath(); ctx.moveTo(120, 0); ctx.lineTo(176, 0); ctx.lineTo(196, 150); ctx.lineTo(100, 150); ctx.fill(); ctx.globalAlpha = 1;
      // curtains + valance
      for (let i = 0; i < 6; i++) { R(i * 7, 0, 7, 152, i % 2 ? '#9b2d3a' : '#b8404d'); R(SW - (i + 1) * 7, 0, 7, 152, i % 2 ? '#9b2d3a' : '#b8404d'); }
      R(0, 0, SW, 14, '#8a2633'); for (let x = 0; x < SW; x += 8) R(x, 14, 4, 4, '#e2b84f');
      // banner board
      R(86, 22, 148, 26, '#2b2f3a'); R(88, 24, 144, 22, '#f1e4c2'); R(88, 44, 144, 2, '#d6c49a');
      ctx.fillStyle = '#7a2230'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('독도 사랑 대회 시상식', 160, 35); ctx.textAlign = 'left';
      // stage floor
      R(0, 120, SW, 34, '#8a5a34'); for (let y = 124; y < 152; y += 7) R(0, y, SW, 1, '#6a4126');
      for (let x = 10; x < SW; x += 37) R(x, 120, 1, 32, '#6a4126'); R(0, 150, SW, 4, '#4a2c1a');
      // trophy on a stand
      R(254, 112, 18, 22, '#6a4126'); R(256, 98, 14, 4, '#e2b84f'); R(258, 102, 10, 7, '#e2b84f'); R(261, 109, 4, 3, '#a37a26'); R(259, 94, 8, 4, '#f3d27a');
    },
    stageFront(t, s) {
      // audience heads (backs) bobbing as they clap
      const heads = ['child-boy', 'woman', 'child-girl', 'man', 'child-girl-ribbon', 'child-boy', 'woman'];
      heads.forEach((id, i) => {
        const clap = s.cues.confetti && t - s.cues.confetti < 4200 ? Math.abs(Math.sin(t / 140 + i)) * 3 : 0;
        drawResident(ctx, id, 6 + i * 45, 146 - clap, 58, t, 'up', false, 0);
      });
      R(0, 170, SW, 10, '#111827');
      if (s.cues.confetti) {
        const age = t - s.cues.confetti;
        if (age < 5200) for (let i = 0; i < 70; i++) {
          const x = (i * 53 + Math.sin(i + age / 300) * 12) % SW, y = ((i * 37) % 60) - 40 + age / (9 + (i % 5));
          if (y < 172) R(x, y, 3, 2, ['#e2b84f', '#c75b4a', '#7fe3ea', '#f1e4c2', '#91b86b'][i % 5]);
        }
      }
    },
    sea(t, s) {
      const night = !!s.cues.night;
      const sky = night ? ['#0d1b2e', '#132842', '#1a3554'] : ['#7cc6dc', '#98d4e4', '#b7e3ec'];
      sky.forEach((c, i) => R(0, i * 30, SW, 30, c));
      if (!night) { R(262, 14, 18, 18, '#fff3c4'); R(265, 11, 12, 24, '#fff3c4'); for (let i = 0; i < 3; i++) { const cx = (i * 120 + t / 90) % 380 - 50; R(cx, 18 + i * 12, 34, 6, '#ffffff'); R(cx + 8, 14 + i * 12, 18, 6, '#ffffff'); } }
      else for (let i = 0; i < 40; i++) R((i * 71) % SW, (i * 23) % 80, 1, 1, '#e7f4ff');
      backdrop(s, 196, 92, 104);
      R(0, 90, SW, 90, night ? '#123049' : '#2f7f95');
      for (let y = 92; y < 180; y += 6) for (let x = ((y * 13 + Math.floor(t / 90)) % 24) - 24; x < SW; x += 24) R(x, y, 8, 1, night ? '#2a5a7a' : '#7cc0cc');
      if (s.cues.glint) {
        const age = t - s.cues.glint;
        if (age < 1800) { const a = Math.max(0, 1 - age / 1800); ctx.globalAlpha = a; ctx.strokeStyle = '#8ff6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(232, 104, 8 + age / 30, 3 + age / 90, 0, 0, Math.PI * 2); ctx.stroke(); R(229, 98, 6, 6, '#c8fbff'); R(231, 92, 2, 18, '#c8fbff'); R(222, 100, 20, 2, '#c8fbff'); ctx.globalAlpha = 1; }
      }
      if (!s.noBoat) {
        const bob = Math.round(Math.sin(t / 420) * 1.5);
        // ferry, side view: hull with a raised bow, cabin, railing and a pennant
        const y0 = 118 + bob;
        for (let i = 0; i < 14; i++) R(40 + i, y0 + 2 + i, 200 - i * 2 + Math.min(i, 8) * 3, 1, i < 9 ? '#f2f4f2' : i < 12 ? '#2c5e8a' : '#1f3f5c');
        R(226, y0 - 6, 18, 8, '#f2f4f2'); R(236, y0 - 10, 10, 6, '#f2f4f2');
        R(40, y0, 200, 3, '#c9d1cf'); for (let x = 44; x < 238; x += 8) R(x, y0 - 7, 1, 7, '#9aa3a8'); R(42, y0 - 8, 196, 1, '#9aa3a8');
        R(56, y0 - 26, 74, 26, '#e7ebe9'); for (let x = 62; x < 126; x += 13) R(x, y0 - 21, 8, 7, '#5e9fbe'); R(66, y0 - 34, 50, 8, '#d9dfdc'); R(70, y0 - 32, 10, 4, '#5e9fbe');
        R(118, y0 - 58, 2, 32, '#6b7280'); R(120, y0 - 58, 14, 7, '#3f8189'); R(120, y0 - 51, 8, 3, '#3f8189');
        R(46, y0 + 6, 3, 3, '#e2b84f'); R(186, y0 + 6, 18, 2, '#2c5e8a');
      }
    },
    dock(t, s) {
      R(0, 0, SW, 56, '#a6dbe6'); R(0, 0, SW, 22, '#8fcfdf');
      R(0, 56, SW, 40, '#2f7f95'); for (let y = 58; y < 96; y += 6) for (let x = ((y * 7 + Math.floor(t / 110)) % 20) - 20; x < SW; x += 20) R(x, y, 7, 1, '#7cc0cc');
      if (s.def.island === 'ulleung') { hills(-30, 98, 160); hills(150, 98, 190); }
      else { peaks(-10, 96, 150); peaks(200, 92, 90, [110, 185, 590, 575]); }
      tiles('sand', 0, 96, SW, 112); tiles('dock', 0, 112, SW, SH);
      R(0, 110, SW, 2, '#674d38');
      for (let x = 20; x < SW; x += 90) { R(x, 104, 6, 14, '#4a2c1a'); R(x - 1, 102, 8, 3, '#6a4126'); }
    },
    camp(t, s) {
      // 김박사의 연구 기지: a tent and three round platforms on the dock, the islands behind
      R(0, 0, SW, 60, '#a6dbe6'); R(0, 0, SW, 24, '#8fcfdf');
      for (let i = 0; i < 2; i++) { const cx = (i * 170 + t / 110) % 380 - 50; R(cx, 12 + i * 14, 30, 5, '#ffffff'); R(cx + 7, 9 + i * 14, 16, 5, '#ffffff'); }
      R(0, 60, SW, 40, '#2f7f95'); for (let y = 62; y < 100; y += 6) for (let x = ((y * 7 + Math.floor(t / 110)) % 20) - 20; x < SW; x += 20) R(x, y, 7, 1, '#7cc0cc');
      backdrop(s, 150, 100, 150); tiles('sand', 0, 100, SW, 116); tiles('dock', 0, 116, SW, SH); R(0, 114, SW, 2, '#674d38');
      // tent
      for (let i = 0; i < 46; i++) { const w = 20 + i * 1.6; R(52 - w / 2, 66 + i, w, 1, i % 9 < 1 ? '#c9d8c0' : '#e9efe2'); }
      R(20, 112, 64, 4, '#9aa79a'); R(45, 84, 14, 28, '#3d5a52'); R(47, 86, 10, 26, '#5d7d74');
      R(51, 52, 2, 16, '#6b7280'); R(53, 52, 12, 7, '#e07a3a');
      // sign board
      R(90, 92, 2, 24, '#5a4030'); R(130, 92, 2, 24, '#5a4030'); R(82, 84, 58, 14, '#5a4030'); R(83, 85, 56, 12, '#f1e4c2');
      ctx.fillStyle = '#5a4030'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('우산몬 연구 기지', 111, 91); ctx.textAlign = 'left';
      // table with a monitor and jars
      R(138, 104, 34, 4, '#8a5a34'); R(140, 108, 2, 10, '#6a4126'); R(168, 108, 2, 10, '#6a4126');
      R(142, 92, 14, 11, '#232634'); R(143, 93, 12, 8, s.cues.device ? (Math.sin(t / 160) > 0 ? '#7fe3ea' : '#3f8189') : '#3f8189'); R(148, 103, 2, 2, '#232634');
      R(159, 97, 4, 7, '#9fd6c9'); R(164, 99, 4, 5, '#e2b84f');
      // three platforms
      const glow = s.cues.glow ? .6 + .4 * Math.sin(t / 180) : s.cues.device ? .35 : .15;
      for (const x of [196, 244, 292]) {
        R(x - 19, 148, 38, 6, '#4a505e'); R(x - 18, 144, 36, 5, '#7a8192'); R(x - 16, 143, 32, 2, '#9aa3b4');
        ctx.globalAlpha = glow; R(x - 15, 144, 30, 2, '#7fe3ea'); ctx.globalAlpha = 1;
      }
    },
    field(t, s) {
      R(0, 0, SW, 48, '#a6dbe6'); backdrop(s, 180, 52, 120);
      R(0, 44, SW, 10, '#2f7f95');
      tiles('grass', 0, 54, SW, SH);
      tiles('path', 60, 128, 220, 160);
      const shake = s.cues.rustle && !s.cues.pop ? Math.sin(t / 50) * 1.5 : s.cues.pop && t - s.cues.pop < 400 ? Math.sin(t / 30) * 2.5 : 0;
      ctx.save(); ctx.translate(shake, 0); tiles('tall', 232, 108, 296, 146); ctx.restore();
    },
    fieldFront(t, s) {
      // grass blades in front of the monster so it pops out of the bush
      const sheet = assetImage(TERRAIN_ATLAS.key);
      if (sheet && !(s.cues.pop && t - s.cues.pop > 300)) { ctx.save(); ctx.globalAlpha = .95; tiles('tall', 236, 124, 292, 146); ctx.restore(); }
    },
    crisis(t, s) {
      const panel = s.panel || 'sea';
      if (hasArt() && panel === 'sea') { skyDay(t, 60, false); seaStrip(60, 120, t); peaks(110, 72, 110); }
      else if (hasArt() && panel === 'rock') { skyDay(t, 120, false); peaks(-20, 182, 360); }
      else if (hasArt() && panel === 'grass') { skyDay(t, 50, false); art('meadow', 0, 50); tiles('tall', 40, 90, 280, 150); }
      else if (panel === 'sea') { R(0, 0, SW, 60, '#6c8ea0'); R(0, 60, SW, 120, '#24566a'); for (let y = 64; y < SH; y += 7) for (let x = ((y * 11 + Math.floor(t / 80)) % 26) - 26; x < SW; x += 26) R(x, y, 9, 1, '#5e93a3'); peaks(110, 72, 110); }
      else if (panel === 'rock') { R(0, 0, SW, SH, '#7b8f99'); peaks(-20, 182, 360); }
      else if (panel === 'grass') { R(0, 0, SW, 50, '#7f9fb0'); tiles('grass', 0, 50, SW, SH); tiles('tall', 40, 90, 280, 150); }
      if (panel === 'dig') { // 울릉도 공사 현장: 파헤친 초록 산, 가림막, 안내판
        if (hasArt()) skyDay(t, 150, false); else R(0, 0, SW, SH, '#8fb6c4');
        hills(-24, 150, 220); hills(150, 150, 196);
        ctx.fillStyle = '#9a7048'; ctx.beginPath(); ctx.moveTo(34, 150); ctx.lineTo(62, 108); ctx.lineTo(112, 100); ctx.lineTo(138, 150); ctx.fill();
        for (let i = 0; i < 6; i++) R(52 + i * 13, 118 + (i % 2) * 9, 7, 2, '#7a5536');
        R(0, 150, SW, 30, '#b9a27a');
        for (let x = 4; x < SW; x += 22) R(x, 132, 2, 22, '#55585c');
        R(0, 136, SW, 10, '#e8c64a'); for (let x = 0; x < SW; x += 16) R(x, 136, 8, 10, '#33343a');
        R(236, 108, 64, 22, '#f4efe2'); R(236, 108, 64, 3, '#c8463c'); R(266, 130, 3, 8, '#55585c');
        ctx.fillStyle = '#3a2f2a'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('몽땅랜드 공사 중', 268, 121); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      const mon = { sea: 34, rock: 55, grass: 9, dig: 3 }[panel];
      const aura = s.cues.aura ? 1 : .55;
      // dark aura blobs
      ctx.globalAlpha = .45 * aura; R(0, 0, SW, SH, '#1a1030'); ctx.globalAlpha = 1;
      for (let i = 0; i < 26; i++) {
        const x = 160 + Math.sin(i * 1.7 + t / 500) * (40 + (i % 5) * 9), y = 126 - ((t / 22 + i * 17) % 80);
        ctx.globalAlpha = (.25 + (i % 3) * .1) * aura; R(x, y, 6 + (i % 3) * 2, 6 + (i % 3) * 2, i % 2 ? '#3b1d5c' : '#120b1f');
      }
      ctx.globalAlpha = 1;
      drawMonster(ctx, mon, 132, 70 + Math.sin(t / 120) * (s.cues.aura ? 2 : .8), 56, t / 1000);
      // 몽땅랜드 members appear from the second panel on; the leader looms behind when the aura spreads.
      if (s.cues.aura) { ctx.globalAlpha = .55 + .15 * Math.sin(t / 300); drawResident(ctx, 'villain-leader', 128, 2, 64, t, 'down', false, 0); ctx.globalAlpha = 1; }
      if (panel !== 'sea') drawResident(ctx, 'villain-grunt-m', 58, 82, 58, t, 'right', false, 0);
      if (panel === 'grass' || s.cues.aura) drawResident(ctx, 'villain-grunt-f', 206, 82, 58, t, 'left', false, 0);
      ctx.globalAlpha = .6 + .3 * Math.sin(t / 150); R(149, 92, 4, 3, '#ff5a5a'); R(167, 92, 4, 3, '#ff5a5a'); ctx.globalAlpha = 1;
      if (s.panelAt && t - s.panelAt < 160) { ctx.globalAlpha = 1 - (t - s.panelAt) / 160; R(0, 0, SW, SH, '#ffffff'); ctx.globalAlpha = 1; }
    },
    summit(t, s) {
      // dusk sky over the summit of 대한봉
      if (hasArt()) {
        art('sky-dusk', 0, 0, null, null, 72); R(40, 52, 22, 22, '#ffd59a'); R(36, 56, 30, 14, '#ffd59a'); R(38, 54, 26, 18, '#ffe6b8');
        seaStrip(72, 22, t, 'sea-dusk'); art('rocky-top', 0, 94);
        peaks(-40, 112, 120, [110, 185, 590, 575]); peaks(250, 106, 100, [110, 185, 590, 575]);
      } else {
        ['#f0b27a', '#d98f7e', '#a3779a', '#6c5a8a'].forEach((c, i) => R(0, i * 18, SW, 18, c));
        R(40, 52, 22, 22, '#ffd59a'); R(36, 56, 30, 14, '#ffd59a');
        R(0, 72, SW, 22, '#47507a'); for (let y = 74; y < 94; y += 5) for (let x = ((y * 9 + Math.floor(t / 120)) % 26) - 26; x < SW; x += 26) R(x, y, 9, 1, '#6c76a0');
        tiles('grass', 0, 94, SW, SH); peaks(-40, 112, 120, [110, 185, 590, 575]); peaks(250, 106, 100, [110, 185, 590, 575]);
        tiles('path', 40, 140, 320, SH);
      }
      const on = s.cues.machine && !s.cues['machine-off'], off = s.cues['machine-off'], pulse = .5 + .5 * Math.sin(t / 140);
      // the blank machine (지우개 기계)
      const mx = 232, my = 50, shake = off && t - off < 900 ? Math.round(Math.sin(t / 25) * 1.5) : 0;
      ctx.save(); ctx.translate(shake, 0);
      R(mx + 4, my + 66, 58, 6, '#2b2f3a'); R(mx, my + 20, 66, 48, '#5a6070'); R(mx + 2, my + 22, 62, 4, '#7a8192'); R(mx, my + 60, 66, 8, '#444a58');
      R(mx + 14, my, 38, 24, '#4a505e'); R(mx + 30, my - 18, 4, 18, '#7a8192'); R(mx + 26, my - 22, 12, 5, on ? '#c48cff' : '#555b68');
      R(mx + 17, my + 3, 32, 18, '#1d1f28'); R(mx + 19, my + 5, 28, 14, on ? (pulse > .5 ? '#8b4fd1' : '#5e2fa0') : '#2a2d38');
      if (on) { R(mx + 27, my + 8, 12, 8, '#d7b8ff'); R(mx + 31, my + 6, 4, 12, '#d7b8ff'); }
      for (let i = 0; i < 4; i++) R(mx + 8 + i * 14, my + 34, 8, 8, on ? ['#e2b84f', '#7fe3ea', '#c75b4a', '#91b86b'][i] : '#3a3f4b');
      R(mx - 20, my + 64, 22, 3, '#2b2f3a'); R(mx - 22, my + 58, 4, 9, '#2b2f3a');
      ctx.restore();
      if (on) for (let i = 0; i < 14; i++) { // purple smoke = dark energy leaking
        const age = (t / 18 + i * 37) % 120, x = mx + 30 + Math.sin(i * 2.1 + t / 400) * (6 + age / 5), y = my - 18 - age * .6;
        ctx.globalAlpha = Math.max(0, .5 - age / 260); R(x, y, 7 + age / 30, 6 + age / 30, i % 2 ? '#3b1d5c' : '#5a2f86');
      }
      ctx.globalAlpha = 1;
      if (off && t - off < 1200) for (let i = 0; i < 10; i++) { const a = (t - off) / 1200, x = mx + 33 + Math.cos(i) * a * 40, y = my + 10 + Math.sin(i * 1.7) * a * 30; R(x, y, 2, 2, '#ffe9a6'); }
      // the theme-park blueprint on an easel
      const bx = 126, by = 62, glow = s.cues.blueprint ? .5 + .5 * Math.sin(t / 200) : 0;
      R(bx + 8, by + 44, 3, 20, '#5a4030'); R(bx + 48, by + 44, 3, 20, '#5a4030'); R(bx + 28, by + 44, 3, 16, '#5a4030');
      if (glow) { ctx.globalAlpha = .35 * glow; R(bx - 4, by - 4, 66, 54, '#fff1b4'); ctx.globalAlpha = 1; }
      R(bx, by, 58, 46, '#2b3a6b'); R(bx + 1, by + 1, 56, 44, '#355094');
      ctx.strokeStyle = '#d9e6ff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bx + 16, by + 26, 9, 0, Math.PI * 2); ctx.stroke(); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(bx + 16, by + 26); ctx.lineTo(bx + 16 + Math.cos(i) * 9, by + 26 + Math.sin(i) * 9); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(bx + 28, by + 38); ctx.bezierCurveTo(bx + 34, by + 14, bx + 42, by + 40, bx + 54, by + 18); ctx.stroke();
      R(bx + 30, by + 38, 24, 1, '#d9e6ff');
      ctx.fillStyle = '#ffe9a6'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('우산몬 테마파크', bx + 29, by + 8); ctx.textAlign = 'left';
    },
    summitFront(t, s) {
      const dark = s.cues.dark && !s.cues['machine-off'];
      if (dark) { // dark energy swirling around the 몽땅랜드 side
        for (let i = 0; i < 22; i++) { const x = 200 + Math.sin(i * 1.3 + t / 500) * 60, y = 150 - ((t / 20 + i * 23) % 90); ctx.globalAlpha = .28; R(x, y, 6, 6, i % 2 ? '#3b1d5c' : '#120b1f'); }
        ctx.globalAlpha = 1;
      }
      if (s.cues.records) { const age = t - s.cues.records; for (let i = 0; i < 16; i++) { const x = 230 + Math.sin(i * 2.3) * 70 - age / 30 * (i % 3), y = 130 - age / (6 + i % 4) - i * 3; if (y > -10) { R(x, y, 7, 9, '#fbf8ee'); R(x + 1, y + 2, 5, 1, '#9aa3a8'); R(x + 1, y + 5, 4, 1, '#9aa3a8'); } } }
    },
    title(t, s) {
      if (hasArt()) { // 장 제목: 노을 하늘과 바다 위의 독도, 글자가 잘 보이게 살짝 어둡게
        art('sky-dusk', 0, 0, null, null, 100); seaStrip(100, 80, t, 'sea-dusk'); peaks(120, 103, 80);
        ctx.globalAlpha = .28; R(0, 0, SW, SH, '#0b1630'); ctx.globalAlpha = 1; return;
      }
      R(0, 0, SW, SH, '#123d52');
      for (let y = 100; y < SH; y += 6) for (let x = ((y * 9 + Math.floor(t / 100)) % 30) - 30; x < SW; x += 30) R(x, y, 12, 1, '#2f6f85');
      peaks(100, 100, 120);
      R(0, 98, SW, 3, '#2f6f85');
    }
  };

  // v0.38: 도트 그림으로 다시 그린 배경. 그림이 아직 없으면 예전 배경(LEGACY)을 그려요.
  const PAINT = {
    ...LEGACY,
    stage(t, s) {
      if (!art('stage-hall', 0, 0)) return LEGACY.stage(t, s);
      const glow = s.cues.spot ? .2 + .08 * Math.sin(t / 200) : .1;
      ctx.globalAlpha = glow; ctx.fillStyle = '#ffe9a6';
      ctx.beginPath(); ctx.moveTo(124, 0); ctx.lineTo(172, 0); ctx.lineTo(200, 150); ctx.lineTo(96, 150); ctx.fill();
      ctx.globalAlpha = glow * 1.4; ctx.beginPath(); ctx.ellipse(148, 140, 54, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#7a2230'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('독도 사랑 대회 시상식', 160, 42); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    },
    sea(t, s) {
      if (!hasArt()) return LEGACY.sea(t, s);
      if (s.cues.night) { // 밤바다(강치의 기억): 별과 달, 어두운 물결
        art('sky-night', 0, 0, null, null, 90);
        for (let i = 0; i < 46; i++) { const on = Math.sin(t / 400 + i * 2.1) > -.3; if (on) R((i * 71) % SW, (i * 23) % 84, i % 5 ? 1 : 2, i % 5 ? 1 : 2, '#e7f4ff'); }
        R(258, 14, 14, 14, '#fff3c4'); R(256, 17, 18, 8, '#fff3c4'); R(262, 14, 10, 8, '#ffe9a6');
        backdrop(s, 196, 92, 104); seaStrip(90, 90, t, 'sea-night');
        if (s.cues.glint) { const age = t - s.cues.glint; if (age < 1800) { const a = Math.max(0, 1 - age / 1800); ctx.globalAlpha = a; ctx.strokeStyle = '#8ff6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(232, 104, 8 + age / 30, 3 + age / 90, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; } }
        return;
      }
      skyDay(t, 90); backdrop(s, 196, 92, 104); seaStrip(90, 90, t);
      if (s.cues.glint) {
        const age = t - s.cues.glint;
        if (age < 1800) { const a = Math.max(0, 1 - age / 1800); ctx.globalAlpha = a; ctx.strokeStyle = '#8ff6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(232, 104, 8 + age / 30, 3 + age / 90, 0, 0, Math.PI * 2); ctx.stroke(); R(229, 98, 6, 6, '#c8fbff'); R(231, 92, 2, 18, '#c8fbff'); R(222, 100, 20, 2, '#c8fbff'); ctx.globalAlpha = 1; }
      }
      if (!s.noBoat && !s.def.noBoat) art('ferry', 30, 70 + Math.round(Math.sin(t / 420) * 1.5));
    },
    dock(t, s) {
      if (!hasArt()) return LEGACY.dock(t, s);
      skyDay(t, 56); seaStrip(56, 42, t);
      if (s.def.island === 'ulleung') { hills(-30, 98, 160); hills(150, 98, 190); }
      else { peaks(-10, 96, 150); peaks(200, 92, 90, [110, 185, 590, 575]); }
      art('sand', 0, 96); art('deck', 0, 112);
      for (let x = 20; x < SW; x += 90) art('bollard', x - 2, 100);
    },
    camp(t, s) {
      if (!hasArt()) return LEGACY.camp(t, s);
      skyDay(t, 60); seaStrip(60, 40, t); backdrop(s, 150, 100, 150);
      art('sand', 0, 100); art('deck', 0, 116);
      art('tent', 14, 52); art('antenna', 212, 76); art('crates', 178, 98);
      art('signboard', 82, 84);
      ctx.fillStyle = '#5a4030'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('우산몬 연구 기지', 114, 92); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      art('desk', 136, 90);
      R(144, 93, 12, 8, s.cues.device ? (Math.sin(t / 160) > 0 ? '#7fe3ea' : '#3f8189') : '#3f8189'); R(145, 94, 4, 1, '#bff6f8');
      const glow = s.cues.glow ? .6 + .4 * Math.sin(t / 180) : s.cues.device ? .35 : .15;
      for (const x of [196, 244, 292]) {
        art('pedestal', x - 20, 140);
        ctx.globalAlpha = glow; R(x - 13, 143, 26, 2, '#7fe3ea'); R(x - 9, 142, 18, 1, '#d8fdff');
        if (s.cues.glow) { ctx.globalAlpha = glow * .35; R(x - 12, 104, 24, 40, '#7fe3ea'); }
        ctx.globalAlpha = 1;
      }
    },
    field(t, s) {
      if (!hasArt()) return LEGACY.field(t, s);
      skyDay(t, 48, false); seaStrip(44, 10, t); backdrop(s, 180, 52, 120); art('meadow', 0, 54);
      const shake = s.cues.rustle && !s.cues.pop ? Math.sin(t / 50) * 1.5 : s.cues.pop && t - s.cues.pop < 400 ? Math.sin(t / 30) * 2.5 : 0;
      ctx.save(); ctx.translate(shake, 0); tiles('tall', 232, 108, 296, 146); ctx.restore();
    }
  };

  function paint(t) {
    const { k, ox, oy, dpr } = view;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05080d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!scene) return;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy); ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, SW, SH); ctx.clip();
    const s = scene;
    PAINT[s.def.bg]?.(t, s);
    const cast = [...s.cast.values()].filter(c => !c.hidden).sort((a, b) => a.y - b.y);
    for (const c of cast) {
      if (c.walk) {
        const p = Math.min(1, (t - c.walk.start) / c.walk.ms);
        c.x = c.walk.fx + (c.walk.tx - c.walk.fx) * p; c.y = c.walk.fy + (c.walk.ty - c.walk.fy) * p;
        c.walking = p < 1; c.dist = p * Math.hypot(c.walk.tx - c.walk.fx, c.walk.ty - c.walk.fy) * 1.6;
        if (p >= 1) { c.walk = null; c.walking = false; }
      }
      if (c.popAt) { const p = Math.min(1, (t - c.popAt) / 520); c.y = c.baseY - Math.sin(p * Math.PI) * 26 + (1 - p) * 0; c.x = c.baseX - p * 8; if (p >= 1) c.popAt = 0; }
      if (c.riseAt) { const p = Math.min(1, (t - c.riseAt) / 1400); c.y = c.baseY + (1 - p) * 40; }
      person(c, t);
    }
    if (s.def.bg === 'stage') PAINT.stageFront(t, s);
    if (s.def.bg === 'field') PAINT.fieldFront(t, s);
    if (s.def.bg === 'summit') PAINT.summitFront(t, s);
    if (s.def.bg === 'sea' && s.cast.get('gangchi') && !s.cast.get('gangchi').hidden) { R(170, 128, 90, 6, '#2f7f95'); }
    picture(t, s);
    const player = s.cast.get('player');
    if (player && !player.hidden) bubble(player.x, player.y - (player.size || 52), s.cues.surprise, t);
    const kim = s.cast.get('kim');
    if (kim && s.cues.device) {
      const g = .5 + .5 * Math.sin(t / 160), x = kim.x - 18, y = kim.y - 34;
      ctx.globalAlpha = .35 * g; R(x - 8, y - 8, 22, 20, '#8ff6ff'); ctx.globalAlpha = 1;
      R(x - 2, y - 2, 10, 8, '#232634'); R(x - 1, y - 1, 8, 6, '#3f8189'); R(x, y, 6, 4, g > .5 ? '#c8fbff' : '#7fe3ea');
    }
    ctx.restore();
  }
  function loop(t) { paint(t); raf = requestAnimationFrame(loop); }

  function cue(name, t = performance.now()) {
    if (!scene) return;
    const s = scene;
    s.cues[name] = t;
    if (name.startsWith('panel:')) { s.panel = name.slice(6); s.panelAt = t; }
    if (name === 'jump') { const p = s.cast.get('player'); if (p) p.hopAt = t; }
    if (name === 'pop') { const m = s.cast.get('mon'); if (m) { m.hidden = false; m.baseX = m.x; m.baseY = m.y; m.popAt = t; } const p = s.cast.get('player'); if (p) s.cues.surprise = t; }
    if (name === 'kim-turn') { const k = s.cast.get('kim'); if (k) k.dir = 'right'; }
    // morph:<id> 전설의 우산몬이 morphTo 그림으로 바뀌어요 · show:<id> appear in a column of light · hop:<id> a little jump · come:<id> walk to comeTo · calm:<id> the dark aura clears
    const [verb, arg] = name.split(':'), who = arg && s.cast.get(arg);
    if (verb === 'show' && who) { who.hidden = false; who.showAt = t; }
    if (verb === 'hop' && who) who.hopAt = t;
    if (verb === 'come' && who?.comeTo) who.walk = { fx: who.x, fy: who.y, tx: who.comeTo[0], ty: who.comeTo[1], start: t, ms: who.walkMs || 900 };
    if (verb === 'calm' && who) who.calmAt = t;
    if (verb === 'morph' && who?.morphTo) { who.who = who.morphTo; who.showAt = t; who.hidden = false; } // 전설의 우산몬 형태변환: 빛기둥 속에서 변환폼으로
    if (verb === 'picture' && PICTURES[arg]) { s.picture = { id: arg, at: t }; assetImage(PICTURES[arg].key); }
    if (name === 'picture-off' && s.picture) s.picture.offAt = t;
    if (name === 'machine-quiet') { s.cues.machine = t - 1e4; s.cues['machine-off'] = t - 1e4; } // already stopped, no sparks
    if (name === 'rise') { const m = s.cast.get('gangchi'); if (m) { m.hidden = false; m.baseY = m.y; m.riseAt = t; } }
  }

  function setScene(def, vars) {
    const t = performance.now();
    const cast = new Map();
    for (const c of def.cast || []) {
      const who = fillJosa(c.who, vars), entry = { ...c, who, avatar: vars.avatar, dir: c.dir || 'down' };
      if (c.walkTo) entry.walk = { fx: c.x, fy: c.y, tx: c.walkTo[0], ty: c.walkTo[1], start: t + 250, ms: c.walkMs || 1500 };
      cast.set(c.id, entry);
    }
    scene = { def, cast, cues: {}, panel: null };
    captionEl.textContent = def.caption || ''; captionEl.classList.toggle('show', !!def.caption);
    titleEl.innerHTML = def.title ? `<small>${esc(def.title.kicker)}</small><strong>${esc(def.title.name)}</strong><span>${esc(def.title.sub || '')}</span>` : '';
    titleEl.classList.toggle('show', !!def.title);
    for (const c of def.start || []) cue(c, t);
    for (const line of def.lines || []) { const m = /^picture:(\w+)/.exec(line.cue || ''); if (m && PICTURES[m[1]]) assetImage(PICTURES[m[1]].key); }
    const ids = [...cast.values()].map(c => c.who).filter(w => w.startsWith('monster:')).map(w => w.slice(8)); // '68-2' = 변환폼
    if (ids.length) preloadMonsters(ids);
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function waitAdvance() { return new Promise(r => { advance = r; }); }
  function press() {
    if (!running) return;
    if (writer.typing) { writer.finish(); return; }
    if (choicesEl.childElementCount) return;
    const fn = advance; advance = null; fn?.(); onAdvance?.();
  }
  async function showLine(line, vars) {
    const speaker = line.who === '@player' ? '나' : line.who;
    nameEl.textContent = speaker || ''; nameEl.hidden = !speaker; box.classList.toggle('narration', !speaker);
    choicesEl.replaceChildren(); nextEl.hidden = true;
    if (line.cue) cue(line.cue);
    await writer.type(fillJosa(line.text, vars));
    if (skipRequested) return null;
    if (line.choice) {
      const picked = await new Promise(resolve => {
        line.choice.forEach((c, i) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'cs-choice'; b.dataset.choice = i;
          b.textContent = c.label; b.onclick = e => { e.stopPropagation(); resolve(i); }; choicesEl.append(b);
        });
        choiceIndex = 0; choicesShownAt = performance.now(); choicesEl.firstChild?.focus({ preventScroll: true });
        advance = () => {};
        skipWaiters.push(() => resolve(0));
      });
      choicesEl.replaceChildren();
      return picked;
    }
    nextEl.hidden = false;
    await waitAdvance();
    return null;
  }
  let skipWaiters = [], choicesShownAt = 0;

  async function play(script, { vars = {}, skippable = true } = {}) {
    if (running) return { skipped: true };
    running = script.id || 'scene'; skipRequested = false; skipWaiters = [];
    root.classList.remove('hidden'); root.classList.toggle('no-skip', !skippable);
    resize(); fade.classList.add('on'); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    const choices = {};
    try {
      for (let si = 0; si < script.scenes.length && !skipRequested; si++) {
        const def = script.scenes[si];
        setScene(def, vars); box.classList.add('hidden-box');
        await wait(30); fade.classList.remove('on'); await wait(FADE);
        box.classList.remove('hidden-box'); resize();
        for (let li = 0; li < def.lines.length && !skipRequested; li++) {
          const line = def.lines[li];
          const picked = await showLine(line, vars);
          if (picked !== null && line.choice) {
            choices[`${si}:${li}`] = picked;
            for (const reply of line.choice[picked].reply || []) { if (skipRequested) break; await showLine(reply, vars); }
          }
        }
        fade.classList.add('on'); await wait(FADE);
      }
    } finally {
      cancelAnimationFrame(raf); writer.clear(); advance = null; scene = null;
      root.classList.add('hidden'); fade.classList.remove('on'); captionEl.classList.remove('show'); titleEl.classList.remove('show');
      const id = running; running = null;
      void id;
    }
    return { skipped: skipRequested, choices };
  }
  function skip() {
    if (!running) return;
    skipRequested = true; writer.finish();
    const fn = advance; advance = null; fn?.();
    for (const w of skipWaiters.splice(0)) w();
  }
  root.querySelector('.cs-skip').onclick = e => { e.stopPropagation(); skip(); };
  box.addEventListener('click', press);
  canvas.addEventListener('click', press);
  nextEl.addEventListener('click', e => { e.stopPropagation(); press(); });

  function handleKey(e) {
    if (!running) return false;
    const choiceButtons = [...choicesEl.querySelectorAll('button')];
    if (choiceButtons.length && ['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(e.key)) {
      choiceIndex = (choiceIndex + (['ArrowUp', 'w', 'W'].includes(e.key) ? -1 : 1) + choiceButtons.length) % choiceButtons.length;
      choiceButtons[choiceIndex].focus({ preventScroll: true }); e.preventDefault(); return true;
    }
    if (['Enter', ' ', 'e', 'E'].includes(e.key)) {
      if (choiceButtons.length && (e.repeat || performance.now() - choicesShownAt < 450)) { e.preventDefault(); return true; }
      if (choiceButtons.length) { if (document.activeElement?.classList.contains('cs-choice')) return false; choiceButtons[choiceIndex]?.click(); }
      else press();
      e.preventDefault(); return true;
    }
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'Tab'].includes(e.key) ? (e.key !== 'Tab' && e.preventDefault(), e.key !== 'Tab') : false;
  }
  return { play, skip, press, handleKey, active: () => !!running, get current() { return running; } };
}
