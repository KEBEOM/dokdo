// turn-based battle screen: status window, framed backdrop, command window and a typed message window.
// The game logic (game.js) drives it with await ui.say(...), await ui.menu(...), await ui.quiz(...).
import { createTypewriter } from './typewriter.js';
import { portrait, battlePortrait, look } from './sprites.js';
import { assetImage, drawAsset } from './assets.js';
import { TERRAIN_ATLAS } from './terrain-atlas.js';
import { SCENERY_ATLAS } from './scenery-atlas.js';
import { CUTSCENE_ATLAS } from './cutscene-atlas.js';
import { islandFrame } from './island-pictures.js';
import { terrainSample } from './terrain.js';
import { drawResident, drawExplorer } from './characters.js';
import { recordCells } from './records.js';
import { directionAngle, orderItems, orderChoice } from './battle-quiz.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createBattleUI(root, { onBlip = null, onSelect = null } = {}) {
  let writer = null, waiting = null, menuState = null, quizState = null, els = {};

  let trainer = null, portraitKey = null, portraitTimer = 0, explorer = null;
  // foePortrait: the 몽땅랜드 member's large picture (assets key). It shows while they appear and fades out
  // when their 우산몬 comes out. Without it, the small walking sprite stands at the side instead.
  function mount({ backdrop = 'field', sky = '#7fb7c4', aura = false, label = '', foeTrainer = null, foePortrait = null, island = '', avatar = null }) {
    explorer = avatar; trainer = foePortrait ? null : foeTrainer; portraitKey = foePortrait; clearTimeout(portraitTimer);
    root.classList.add('dq');
    root.innerHTML = `
      <div class="dq-top">
        <div class="dq-window dq-status" id="dqStatus"></div>
        <div class="dq-window dq-foe dq-scroll" id="dqFoe"></div>
      </div>
      <div class="dq-stage ${trainer ? 'has-trainer' : ''}">
        <canvas class="dq-backdrop" width="320" height="140" aria-hidden="true"></canvas>
        ${trainer ? '<canvas class="dq-trainer" width="144" height="144" aria-hidden="true"></canvas>' : ''}
        ${foePortrait ? '<div class="dq-portrait" aria-hidden="true"><canvas width="384" height="384"></canvas></div>' : ''}
        <div class="dq-enemy ${aura ? 'aura' : ''}"><canvas class="dq-pad" width="96" height="26" aria-hidden="true"></canvas><i class="dq-shadow" aria-hidden="true"></i><canvas id="enemySprite" class="battle-mon enemy" width="160" height="160" aria-label="상대 우산몬"></canvas><span class="dq-dmg" aria-hidden="true"></span></div>
        ${avatar ? '<canvas class="dq-explorer" width="96" height="120" aria-hidden="true"></canvas>' : ''}
        <div class="dq-mine"><canvas class="dq-pad" width="96" height="26" aria-hidden="true"></canvas><i class="dq-shadow" aria-hidden="true"></i><canvas id="allySprite" class="dq-ally-mon" width="160" height="160" aria-label="내 우산몬"></canvas></div>
        <span class="dq-label">${esc(label)}</span>
      </div>
      <div class="dq-coach" hidden><canvas width="64" height="64" aria-hidden="true"></canvas><p></p><button type="button" class="dq-coach-skip" hidden>연습 건너뛰기</button></div>
      <div class="dq-bottom">
        <div class="dq-window dq-command" id="dqCommand" hidden></div>
        <div class="dq-window dq-message" id="dqMessage" role="status" aria-live="polite">
          <div class="dq-text"></div><div class="dq-extra"></div>
          <button type="button" id="dqNext" class="dq-next" aria-label="계속" hidden>▼</button>
        </div>
      </div>`;
    els = {
      status: root.querySelector('#dqStatus'), foe: root.querySelector('#dqFoe'), command: root.querySelector('#dqCommand'),
      message: root.querySelector('#dqMessage'), text: root.querySelector('.dq-text'), extra: root.querySelector('.dq-extra'),
      next: root.querySelector('#dqNext'), enemy: root.querySelector('#enemySprite'), enemyWrap: root.querySelector('.dq-enemy'),
      dmg: root.querySelector('.dq-dmg'), backdrop: root.querySelector('.dq-backdrop'),
      ally: root.querySelector('#allySprite'), allyWrap: root.querySelector('.dq-mine'), portrait: root.querySelector('.dq-portrait'),
      coach: root.querySelector('.dq-coach')
    };
    writer = createTypewriter(els.text, { speed: 22, onChar: onBlip });
    els.message.addEventListener('click', e => { if (e.target.closest('a,button:not(#dqNext):not(.locked)')) return; confirm(); });
    els.next.addEventListener('click', e => { e.stopPropagation(); confirm(); });
    paintBackdrop(backdrop, sky, island);
  }

  function paintBackdrop(kind, sky, island = '') {
    const c = els.backdrop.getContext('2d'), sheet = assetImage(TERRAIN_ATLAS.key), monument = assetImage(SCENERY_ATLAS.monument.key);
    c.imageSmoothingEnabled = false;
    // v0.38 (선명한 외곽선 도트 느낌): 도트 하늘·먼 섬·바다·원근감 있는 바닥 + 우산몬이 서는 둥근 받침대
    const pics = assetImage(CUTSCENE_ATLAS.key), F = CUTSCENE_ATLAS.frames;
    if (pics) {
      const ground = kind === 'shore' ? 'sand' : kind === 'town' ? 'path' : 'grass', blit = (k, x, y, crop) => { const f = F[k]; c.drawImage(pics, f[0], f[1], f[2], crop || f[3], x, y, f[2], crop || f[3]); };
      c.clearRect(0, 0, 320, 140); blit('sky-day', 0, 0, 66);
      const isl = islandFrame(island === '울릉도' ? 'ulleung' : 'dokdo', island === '울릉도' ? 104 : 96);
      if (isl) c.drawImage(pics, isl[0], isl[1], isl[2], isl[3], 196, 66 - isl[3], isl[2], isl[3]);
      blit('sea', 0, 64, 18); blit(`bground-${ground}`, 0, 82);
      for (const pc of root.querySelectorAll('.dq-pad')) { const g = pc.getContext('2d'), f = F[`pad-${ground}`]; g.imageSmoothingEnabled = false; g.clearRect(0, 0, pc.width, pc.height); g.drawImage(pics, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]); }
      root.classList.add('has-pads'); return;
    }
    const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    R(0, 0, 320, 140, sky); R(0, 0, 320, 26, shade(sky, -18)); R(0, 26, 320, 22, shade(sky, -8));
    // far island on the horizon: 울릉도 in chapter 1, 독도 elsewhere (2D pixel pictures, v0.38)
    if (monument) c.drawImage(monument, 110, 185, 1130, 575, 196, 34, 96, 49);
    R(0, 64, 320, 18, '#2f7f95'); for (let x = 0; x < 320; x += 22) R(x + 4, 70, 9, 1, '#7cc0cc');
    const ground = kind === 'shore' ? 'sand' : kind === 'town' ? 'path' : 'grass';
    for (let y = 82, ty = 0; y < 140; y += 16, ty++) for (let x = 0, tx = 0; x < 320; x += 16, tx++) {
      if (!sheet) { R(x, y, 16, 16, ground === 'sand' ? '#efd099' : ground === 'path' ? '#c9a572' : '#a0af65'); continue; }
      const f = terrainSample(ground, tx, ty);
      c.save(); c.translate(x + (f.flipX ? 16 : 0), y + (f.flipY ? 16 : 0)); c.scale(f.flipX ? -1 : 1, f.flipY ? -1 : 1); c.drawImage(sheet, ...f.rect, 0, 0, 16.5, 16.5); c.restore();
    }
    if (kind === 'field' && sheet) for (let x = 0, tx = 0; x < 320; x += 16, tx++) { const f = terrainSample('tall', tx, 0); c.drawImage(sheet, ...f.rect, x, 124, 16.5, 16.5); }
  }
  function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, v + amt)); return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join(''); }

  function bar(cur, max, tag = 'HP') { const r = Math.max(0, cur / max); return `<div class="dq-barrow"><b class="dq-tag">${tag}</b><div class="dq-bar"><i style="width:${r * 100}%;background:${r < .3 ? '#e8503a' : r < .6 ? '#f2c230' : '#3fd16b'}"></i></div></div>`; }
  function setStatus(m, info, party) {
    els.status.innerHTML = `<div class="dq-status-row"><canvas class="dq-ally" width="48" height="48" aria-hidden="true"></canvas><div><strong>${esc(info.name)}</strong><span class="dq-lv">Lv ${m.level}</span>
      <div class="dq-hp">체력 <b>${m.hp}</b> / ${m.maxHp}</div>${bar(m.hp, m.maxHp, '체력')}</div></div>
      <div class="dq-party" aria-label="동료 상태">${party.map(p => `<i class="${p.hp <= 0 ? 'down' : p.active ? 'on' : ''}" title="${esc(p.name)}"></i>`).join('')}</div>`;
    portrait(els.status.querySelector('.dq-ally'), look(m));
    battlePortrait(els.ally, look(m), true); // my 우산몬 looks right, toward the foe
    paintExplorer();
    els.allyWrap.classList.toggle('tired', m.hp <= 0);
  }
  // 탐험대원이 내 우산몬 뒤에 함께 서요(기록 되찾기 결투, v0.58)
  function paintExplorer() {
    const c = root.querySelector('.dq-explorer'); if (!c || !explorer) return;
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    drawExplorer(g, explorer, 0, c.height - c.width, c.width, 'right', false, 0, false);
  }
  // 상대의 두루마리: 검은 기운이 지운 기록 한 줄. 기운이 줄어든 만큼 빈칸이 채워져요.
  function setFoe(e, info, extra = '') {
    const r = Math.max(0, e.hp / e.maxHp), cells = recordCells(info.record || '독도의 기록', 1 - r);
    const left = cells.filter(c => !c.space && !c.shown).length, total = cells.filter(c => !c.space).length;
    const paper = cells.map(c => c.space ? '<i class="sp"></i>' : `<i class="${c.shown ? 'on' : ''}">${c.shown ? esc(c.char) : ''}</i>`).join('');
    els.foe.classList.toggle('dark', !!info.dark);
    els.foe.innerHTML = `<div class="scroll-head"><strong>${info.dark && e.hp > 0 ? '<span class="dq-berserk">사나워짐</span> ' : ''}${esc(info.name)}</strong><span class="dq-lv">Lv ${e.level} · ${esc(info.type)}</span></div>
      <div class="scroll-paper" aria-label="${esc(info.title || '지워진 기록')}: ${total - left} / ${total} 글자"><span class="scroll-title">${esc(info.title || '지워진 기록')}</span><p class="scroll-record">${paper}</p></div>
      <div class="dq-gauge-label">${esc(info.gauge || '기운')} <b>${Math.ceil(Math.max(0, e.hp))}</b> / ${e.maxHp}${extra ? ` · ${esc(extra)}` : ''}</div>`;
    battlePortrait(els.enemy, look(e)); paintTrainer(); paintPortrait(); // the foe looks left
  }
  function paintPortrait() {
    const c = els.portrait?.querySelector('canvas'); if (!c || !portraitKey) return;
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
    drawAsset(g, portraitKey, 0, 0, c.width, c.height);
  }
  // The 몽땅랜드 member steps in (their 우산몬 waits off stage) …
  function portraitIn() {
    const p = els.portrait; if (!p) return false;
    clearTimeout(portraitTimer); paintPortrait();
    els.enemyWrap.classList.add('waiting'); els.enemyWrap.classList.remove('enter');
    p.classList.remove('leave'); void p.offsetWidth; p.classList.add('show'); root.classList.add('intro'); return true;
  }
  // … and fades away as the 우산몬 comes out.
  function portraitOut() {
    const p = els.portrait; if (!p) { enemyEnter(); return; }
    clearTimeout(portraitTimer); p.classList.remove('show'); void p.offsetWidth; p.classList.add('leave'); root.classList.remove('intro');
    portraitTimer = setTimeout(() => { if (els.enemyWrap) { els.enemyWrap.classList.remove('waiting'); enemyEnter(); } }, 380);
  }
  // Sending out the next 우산몬: the member shows up for a moment, then fades again.
  function portraitFlash() {
    if (!portraitIn()) { enemyEnter(); return; }
    portraitTimer = setTimeout(portraitOut, 900);
  }
  // The 몽땅랜드 member who started the fight stands at the side of the field.
  function paintTrainer() {
    const c = root.querySelector('.dq-trainer'); if (!c || !trainer) return;
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
    drawResident(g, trainer, 0, 0, c.width, 0, 'left', false, 0);
  }
  function hideCommand() { els.command.hidden = true; els.command.innerHTML = ''; menuState = null; root.classList.remove('menu-open'); }

  // Shows text, then waits for a click / Enter. `extraHTML` adds an explanation and a source link.
  function say(text, { extraHTML = '', tone = '' } = {}) {
    hideCommand(); quizState = null; root.classList.remove('quiz-open');
    els.message.className = `dq-window dq-message ${tone}`;
    els.extra.innerHTML = ''; els.next.hidden = true;
    return writer.type(text).then(() => {
      els.extra.innerHTML = extraHTML; els.next.hidden = false;
      els.next.focus({ preventScroll: true });
      return new Promise(r => { waiting = r; });
    });
  }
  function confirm() {
    if (writer?.typing) { writer.finish(); return; }
    if (!waiting) return;
    const fn = waiting; waiting = null; els.next.hidden = true; onSelect?.(); fn();
  }

  // A DQ command window. items: [{label, value, sub, disabled}]. Resolves to value, or null on cancel.
  function menu(items, { title = '', prompt = '', cancel = false, layout = '' } = {}) {
    quizState = null; root.classList.remove('quiz-open'); root.classList.add('menu-open');
    els.message.className = 'dq-window dq-message'; els.extra.innerHTML = ''; els.next.hidden = true;
    if (prompt) writer.type(prompt); else writer.clear();
    const all = cancel ? [...items, { label: '돌아가기', value: null, back: true }] : items;
    els.command.hidden = false; els.command.classList.toggle('cards', layout === 'cards'); // 버튼이 많을 때: 긴 이름은 줄바꿈, 마지막 버튼도 한 칸만
    els.command.innerHTML = `${title ? `<div class="dq-command-title">${esc(title)}</div>` : ''}<div class="dq-options">${all.map((it, i) => `<button type="button" class="dq-option ${it.back ? 'back' : ''}" data-index="${i}" ${it.value ? `data-cmd="${esc(it.value)}"` : ''} ${it.disabled ? 'disabled' : ''}><span class="dq-cursor">▶</span><span>${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('')}</div>`;
    all.forEach((it, i) => { if (it.hint) els.command.querySelectorAll('.dq-option')[i].classList.add('coach-pick'); });
    return new Promise(resolve => {
      const buttons = [...els.command.querySelectorAll('.dq-option')];
      const choose = i => { if (all[i].disabled) return; const v = all[i].value; hideCommand(); onSelect?.(); resolve(v); };
      buttons.forEach((b, i) => { b.onclick = () => choose(i); b.onmouseenter = () => focus(i); b.onfocus = () => mark(i); });
      const first = all.findIndex(it => !it.disabled);
      menuState = { buttons, index: first, choose, cancel: cancel ? () => choose(all.length - 1) : null, shownAt: performance.now() };
      focus(first);
    });
  }
  function mark(i) { if (!menuState) return; menuState.index = i; menuState.buttons.forEach((b, j) => b.classList.toggle('current', j === i)); }
  function focus(i) { if (!menuState || i < 0) return; mark(i); menuState.buttons[i].focus({ preventScroll: true }); }

  // Quiz window: header, question, three choices (shuffled order), hint. Resolves {choice, assisted}.
  // format: choice 고르기 · cards 근거 카드 · compass 나침반 · order 순서 놓기 · ox 빠른 판단 (battle-quiz.js quizFormat)
  function quiz({ q, order, phase, header, rule, concept, format = 'choice', shown = null }) {
    hideCommand(); root.classList.add('quiz-open'); els.next.hidden = true;
    els.message.className = `dq-window dq-message dq-quiz ${phase} fmt-${format}`;
    writer.clear();
    const kind = { choice: '', cards: '근거 카드', compass: '나침반', order: '순서 놓기', ox: '빠른 판단' }[format];
    els.text.innerHTML = `<div class="dq-quiz-head"><span class="phase-chip">${esc(header)}</span><span>${kind ? `${esc(kind)} · ` : ''}${esc(concept)}</span></div><p class="quiz-rule">${esc(rule)}</p><h3 id="battleQuestionTitle">${esc(q.prompt)}</h3>`;
    const answerBtn = (idx, inner, cls = '') => `<button type="button" class="dq-option dq-answer ${cls}" data-battle-answer="${idx}">${inner}</button>`;
    let body;
    if (format === 'compass') {
      body = `<div class="dq-compass"><span class="compass-rose" aria-hidden="true">✦<small>북</small></span>${order.map(idx => { const a = directionAngle(q.options[idx]) * Math.PI / 180; return answerBtn(idx, `<span>${esc(q.options[idx])}</span>`, 'compass-pt').replace('<button', `<button style="--cx:${Math.sin(a).toFixed(3)};--cy:${(-Math.cos(a)).toFixed(3)}"`); }).join('')}</div>`;
    } else if (format === 'order') {
      const items = orderItems(q.options[q.answer]); let mixed = items.map((_, i) => i).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(i => items[i]); if (mixed.join() === items.join()) mixed = [...mixed.slice(1), mixed[0]]; // 처음부터 정답 순서로 놓이지 않게
      body = `<ol class="dq-slots">${items.map((_, i) => `<li><button type="button" class="dq-option dq-slot" data-slot="${i}" disabled><b>${i + 1}</b><span>여기에</span></button></li>`).join('')}</ol>
        <div class="dq-chips">${mixed.map((t, i) => `<button type="button" class="dq-option dq-chip" data-chip="${i}">${esc(t)}</button>`).join('')}</div>
        <button type="button" class="dq-option dq-order-ok" id="orderOk" disabled>이 순서로 정하기</button>`;
    } else if (format === 'ox') {
      const other = shown === q.answer ? (q.answer + 1) % q.options.length : q.answer;
      body = `<p class="dq-claim"><small>이 답이 맞을까?</small><b>${esc(q.options[shown])}</b></p>
        <div class="dq-answers dq-ox">${answerBtn(shown, '<i>○</i><span>맞아</span>', 'ox-o')}${answerBtn(other, '<i>×</i><span>아니야</span>', 'ox-x')}</div>`;
    } else {
      body = `<div class="dq-answers${format === 'cards' ? ' dq-cards' : ''}">${order.map((idx, pos) => answerBtn(idx, `<span class="dq-cursor">▶</span><b>${pos + 1}</b><span>${esc(q.options[idx])}</span>`)).join('')}</div>`;
    }
    els.extra.innerHTML = `${body}
      <div class="dq-hint-row"><button type="button" id="battleHint" class="text-button">✎ 기록 힌트 보기</button></div><div class="dq-hint" hidden></div>`;
    return new Promise(resolve => {
      let assisted = false, answered = false, buttons;
      const lock = () => els.extra.querySelectorAll('.dq-option').forEach(b => { b.classList.add('locked'); b.setAttribute('aria-disabled', 'true'); });
      const finish = choice => { if (answered) return; answered = true; lock(); quizState = null; onSelect?.(); resolve({ choice, assisted }); };
      if (format === 'order') {
        const items = orderItems(q.options[q.answer]), seq = [], slots = [...els.extra.querySelectorAll('.dq-slot')], chips = [...els.extra.querySelectorAll('.dq-chip')], ok = els.extra.querySelector('#orderOk');
        const paint = () => {
          slots.forEach((b, i) => { const t = seq[i]; b.disabled = t === undefined; b.classList.toggle('filled', t !== undefined); b.querySelector('span').textContent = t ?? '여기에'; });
          chips.forEach(c => { c.disabled = seq.includes(c.textContent); });
          ok.disabled = seq.length !== items.length;
        };
        chips.forEach(c => { c.onclick = () => { if (answered || seq.includes(c.textContent)) return; seq.push(c.textContent); onSelect?.(); paint(); if (seq.length === items.length) ok.focus({ preventScroll: true }); }; });
        slots.forEach((b, i) => { b.onclick = () => { if (answered || seq[i] === undefined) return; seq.splice(i, 1); paint(); }; });
        ok.onclick = () => { if (seq.length !== items.length || answered) return; const choice = orderChoice(q, seq); els.extra.dataset.orderChoice = choice; finish(choice); };
        buttons = [...chips, ok];
        buttons.forEach((b, i) => { b.onmouseenter = () => qfocus(i); b.onfocus = () => qmark(i); });
        quizState = { buttons, index: 0, choose: i => buttons[i].click(), shownAt: performance.now() };
      } else {
        buttons = [...els.extra.querySelectorAll('.dq-answer')];
        buttons.forEach((b, i) => { b.onclick = () => finish(Number(b.dataset.battleAnswer)); b.onmouseenter = () => qfocus(i); b.onfocus = () => qmark(i); });
        quizState = { buttons, index: 0, choose: i => buttons[i].click(), shownAt: performance.now() };
      }
      const hint = els.extra.querySelector('#battleHint');
      hint.onclick = () => { if (answered || assisted) return; assisted = true; hint.disabled = true; hint.textContent = '힌트 사용 중 · 도움받은 답변으로 기록돼요'; const box = els.extra.querySelector('.dq-hint'); box.hidden = false; box.textContent = q.explanation; buttons[quizState?.index || 0]?.focus({ preventScroll: true }); };
      qfocus(0);
    });
  }
  function qmark(i) { if (!quizState) return; quizState.index = i; quizState.buttons.forEach((b, j) => b.classList.toggle('current', j === i)); }
  function qfocus(i) { if (!quizState) return; qmark(i); quizState.buttons[i]?.focus({ preventScroll: true }); }
  // After answering: mark the right/wrong buttons in place, then type the result below.
  function reveal(q, choice) {
    for (const b of els.extra.querySelectorAll('.dq-answer')) {
      const idx = Number(b.dataset.battleAnswer);
      if (idx === q.answer) { b.classList.add('correct'); b.insertAdjacentHTML('beforeend', '<strong>✓ 정답</strong>'); }
      else if (idx === choice) b.classList.add('wrong');
    }
    // 순서 놓기·빠른 판단: 바른 답을 글로 보여 줘요
    const slots = els.extra.querySelector('.dq-slots');
    if (slots) { slots.classList.add(choice === q.answer ? 'correct' : 'wrong'); els.extra.querySelector('.dq-chips')?.remove(); els.extra.querySelector('#orderOk')?.remove(); }
    if (slots || els.extra.querySelector('.dq-ox')) els.extra.querySelector('.dq-hint-row')?.insertAdjacentHTML('beforebegin', `<p class="dq-right"><b>바른 답</b> ${esc(q.options[q.answer])}</p>`);
  }

  // Result of an answer, typed under the marked choices, with the explanation and source.
  function explain(text, html = '', tone = '') {
    els.extra.querySelector('.dq-hint-row')?.remove();
    const box = document.createElement('div'); box.className = `dq-result ${tone}`;
    box.innerHTML = `<p class="dq-result-text"></p><div class="dq-result-more" hidden>${html}</div>`;
    els.extra.append(box);
    const prev = writer; writer = createTypewriter(box.querySelector('p'), { speed: 22, onChar: onBlip });
    return writer.type(text).then(() => {
      box.querySelector('.dq-result-more').hidden = false; els.next.hidden = false;
      box.scrollIntoView?.({ block: 'nearest' }); els.next.focus({ preventScroll: true });
      return new Promise(r => { waiting = () => { writer = prev; r(); }; });
    });
  }

  function flashEnemy() { els.enemyWrap.classList.remove('hit'); void els.enemyWrap.offsetWidth; els.enemyWrap.classList.add('hit'); }
  function damage(n, target = 'enemy') {
    if (target === 'enemy') { els.dmg.textContent = n; els.dmg.classList.remove('show'); void els.dmg.offsetWidth; els.dmg.classList.add('show'); flashEnemy(); }
    else { root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); allyAct('hit'); }
  }
  // My 우산몬's small motions: 'lunge' (uses a skill), 'hit', 'enter' (sent out), 'tired'.
  function allyAct(kind) {
    const w = els.allyWrap; if (!w) return;
    w.classList.remove('lunge', 'hit', 'enter'); if (kind !== 'tired') w.classList.remove('tired');
    void w.offsetWidth; w.classList.add(kind);
  }
  // 연습 대결: 김박사's tip between the field and the windows (its own row, so it is never cut off on small screens). text null hides it; onSkip shows the skip button.
  function coach(text, { onSkip = null } = {}) {
    const c = els.coach; if (!c) return;
    if (!text) { c.hidden = true; return; }
    c.hidden = false; c.querySelector('p').textContent = text;
    const g = c.querySelector('canvas').getContext('2d'); g.clearRect(0, 0, 64, 64); g.imageSmoothingEnabled = false; drawResident(g, 'professor', 0, 0, 64);
    const skip = c.querySelector('.dq-coach-skip'); skip.hidden = !onSkip; skip.onclick = onSkip ? e => { e.stopPropagation(); onSkip(); } : null;
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  }
  function enemyDefeated() { els.enemyWrap.classList.add('gone'); }
  function enemyEnter() { els.enemyWrap.classList.remove('gone', 'hit', 'calm'); els.enemyWrap.classList.add('enter'); setTimeout(() => els.enemyWrap?.classList.remove('enter'), 600); }
  // Aura strength follows the remaining dark energy (0 = calm).
  function setAura(level) { const v = typeof level === 'number' ? level : level ? 1 : 0; els.enemyWrap.classList.toggle('aura', v > 0); els.enemyWrap.style.setProperty('--aura', String(v)); if (v > 0) els.enemyWrap.classList.remove('calm'); }
  // 전설의 우산몬 형태변환: 빛에 감싸였다가 새 모습으로 (side: 'ally' | 'enemy')
  function morph(side = 'ally') { const w = side === 'ally' ? els.allyWrap : els.enemyWrap; if (!w) return; w.classList.remove('morph'); void w.offsetWidth; w.classList.add('morph'); setTimeout(() => w.classList.remove('morph'), 1100); }
  function enemyCalmed() { setAura(0); els.enemyWrap.classList.remove('hit'); void els.enemyWrap.offsetWidth; els.enemyWrap.classList.add('calm'); }

  function handleKey(e) {
    const up = ['ArrowUp', 'w', 'W'].includes(e.key), down = ['ArrowDown', 's', 'S'].includes(e.key), ok = ['Enter', ' ', 'e', 'E'].includes(e.key);
    const st = menuState || quizState;
    if (st && (up || down)) {
      const n = st.buttons.length; let i = st.index;
      for (let k = 0; k < n; k++) { i = (i + (up ? -1 : 1) + n) % n; if (!st.buttons[i].disabled) break; }
      (menuState ? focus : qfocus)(i); e.preventDefault(); return true;
    }
    if (st && ok) {
      // A quick second press after a message must not pick an answer by accident.
      if (e.repeat || performance.now() - st.shownAt < (quizState ? 600 : 250)) { e.preventDefault(); return true; }
      if (document.activeElement?.closest?.('.dq-option')) return false;
      st.choose(st.index); e.preventDefault(); return true;
    }
    if (menuState && (e.key === 'Escape' || e.key === 'Backspace') && menuState.cancel) { menuState.cancel(); e.preventDefault(); return true; }
    if (ok && (waiting || writer?.typing)) { if (document.activeElement?.tagName === 'A') return false; confirm(); e.preventDefault(); return true; }
    return false;
  }
  function destroy() { clearTimeout(portraitTimer); writer?.clear(); waiting = null; menuState = null; quizState = null; root.innerHTML = ''; root.classList.remove('dq', 'menu-open', 'quiz-open', 'shake', 'intro'); }
  return { morph, mount, setStatus, setFoe, say, menu, quiz, reveal, explain, confirm, damage, enemyDefeated, enemyCalmed, enemyEnter, setAura, allyAct, portraitIn, portraitOut, portraitFlash, coach, handleKey, destroy, get waiting() { return !!waiting; } };
}
