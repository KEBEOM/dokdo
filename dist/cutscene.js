// Reusable story cutscenes: pixel scene + Pokémon-style dialogue box with typing, ▼, fades, choices and skip.
// Scripts live in story.js. Usage: const result = await cutscenes.play(OPENING, { vars, avatar });
import { createTypewriter } from './typewriter.js';
import { fillJosa } from './text.js';
import { assetImage } from './assets.js';
import { TERRAIN_ATLAS } from './terrain-atlas.js';
import { SCENERY_ATLAS } from './scenery-atlas.js';
import { terrainSample } from './terrain.js';
import { drawExplorer, drawResident } from './characters.js';
import { drawMonster } from './sprites.js';
import { preloadMonsters } from './assets.js';

const SW = 320, SH = 180, FADE = 380;
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
    const k = Math.min(r.width / SW, r.height / SH), sw = SW * k, sh = SH * k;
    const boxH = box.offsetHeight || 150;
    const oy = Math.max(0, Math.min((r.height - sh) / 2, r.height - boxH - 24 - sh * .8));
    view = { k, ox: (r.width - sw) / 2, oy, dpr, sw, sh };
    Object.assign(overlay.style, { left: view.ox + 'px', top: view.oy + 'px', width: sw + 'px', height: sh + 'px' });
    // Tall screens (portrait tablets): keep the dialogue box right under the picture.
    box.style.bottom = Math.max(16, r.height - (oy + sh) - boxH - 22) + 'px';
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
    const sheet = assetImage(SCENERY_ATLAS.monument.key); if (!sheet) return;
    const [sx, sy, sw, sh] = crop, h = width * sh / sw;
    ctx.drawImage(sheet, sx, sy, sw, sh, x, bottom - h, width, h);
  }
  function person(c, t) {
    const size = c.size || 52, hop = c.hopAt ? Math.max(0, Math.sin(Math.min(1, (t - c.hopAt) / 450) * Math.PI)) * 10 : 0;
    const x = c.x - size / 2, y = c.y - size * .9375 - hop;
    if (c.who === 'player') drawExplorer(ctx, c.avatar, x, y, size, c.dir, !!c.walking, c.dist || 0);
    else if (c.who.startsWith('actor:')) drawResident(ctx, c.who.slice(6), x, y, size, t, c.dir, !!c.walking, c.dist || 0);
    else if (c.who.startsWith('monster:')) {
      const bob = Math.sin(t / 260) * 1.5;
      drawMonster(ctx, Number(c.who.slice(8)), c.x - size / 2, c.y - size - hop + bob, size, t / 1000);
    }
  }
  function bubble(x, y, t0, t) {
    if (!t0 || t - t0 > 1400) return;
    const by = y - 6 - Math.min(4, (t - t0) / 40);
    R(x - 6, by - 14, 12, 14, '#fff8e1'); R(x - 7, by - 13, 14, 12, '#fff8e1'); R(x - 1, by - 11, 3, 6, '#c0392b'); R(x - 1, by - 4, 3, 2, '#c0392b');
  }

  // ── backgrounds ──
  const PAINT = {
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
      peaks(196, 92, 104);
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
    dock(t) {
      R(0, 0, SW, 56, '#a6dbe6'); R(0, 0, SW, 22, '#8fcfdf');
      R(0, 56, SW, 40, '#2f7f95'); for (let y = 58; y < 96; y += 6) for (let x = ((y * 7 + Math.floor(t / 110)) % 20) - 20; x < SW; x += 20) R(x, y, 7, 1, '#7cc0cc');
      peaks(-10, 96, 150); peaks(200, 92, 90, [110, 185, 590, 575]);
      tiles('sand', 0, 96, SW, 112); tiles('dock', 0, 112, SW, SH);
      R(0, 110, SW, 2, '#674d38');
      for (let x = 20; x < SW; x += 90) { R(x, 104, 6, 14, '#4a2c1a'); R(x - 1, 102, 8, 3, '#6a4126'); }
    },
    field(t, s) {
      R(0, 0, SW, 48, '#a6dbe6'); peaks(180, 52, 120);
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
      if (panel === 'sea') { R(0, 0, SW, 60, '#6c8ea0'); R(0, 60, SW, 120, '#24566a'); for (let y = 64; y < SH; y += 7) for (let x = ((y * 11 + Math.floor(t / 80)) % 26) - 26; x < SW; x += 26) R(x, y, 9, 1, '#5e93a3'); peaks(110, 72, 110); }
      if (panel === 'rock') { R(0, 0, SW, SH, '#7b8f99'); peaks(-20, 182, 360); }
      if (panel === 'grass') { R(0, 0, SW, 50, '#7f9fb0'); tiles('grass', 0, 50, SW, SH); tiles('tall', 40, 90, 280, 150); }
      const mon = { sea: 34, rock: 55, grass: 9 }[panel];
      const aura = s.cues.aura ? 1 : .55;
      // dark aura blobs
      ctx.globalAlpha = .45 * aura; R(0, 0, SW, SH, '#1a1030'); ctx.globalAlpha = 1;
      for (let i = 0; i < 26; i++) {
        const x = 160 + Math.sin(i * 1.7 + t / 500) * (40 + (i % 5) * 9), y = 126 - ((t / 22 + i * 17) % 80);
        ctx.globalAlpha = (.25 + (i % 3) * .1) * aura; R(x, y, 6 + (i % 3) * 2, 6 + (i % 3) * 2, i % 2 ? '#3b1d5c' : '#120b1f');
      }
      ctx.globalAlpha = 1;
      drawMonster(ctx, mon, 132, 70 + Math.sin(t / 120) * (s.cues.aura ? 2 : .8), 56, t / 1000);
      ctx.globalAlpha = .6 + .3 * Math.sin(t / 150); R(149, 92, 4, 3, '#ff5a5a'); R(167, 92, 4, 3, '#ff5a5a'); ctx.globalAlpha = 1;
      if (s.panelAt && t - s.panelAt < 160) { ctx.globalAlpha = 1 - (t - s.panelAt) / 160; R(0, 0, SW, SH, '#ffffff'); ctx.globalAlpha = 1; }
    },
    title(t, s) {
      R(0, 0, SW, SH, '#123d52');
      for (let y = 100; y < SH; y += 6) for (let x = ((y * 9 + Math.floor(t / 100)) % 30) - 30; x < SW; x += 30) R(x, y, 12, 1, '#2f6f85');
      peaks(100, 100, 120);
      R(0, 98, SW, 3, '#2f6f85');
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
    if (s.def.bg === 'sea' && s.cast.get('gangchi') && !s.cast.get('gangchi').hidden) { R(170, 128, 90, 6, '#2f7f95'); }
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
    const ids = [...cast.values()].map(c => c.who).filter(w => w.startsWith('monster:')).map(w => Number(w.slice(8)));
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
