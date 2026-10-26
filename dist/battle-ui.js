// Dragon Quest–style battle screen: status window, framed backdrop, command window and a typed message window.
// The game logic (game.js) drives it with await ui.say(...), await ui.menu(...), await ui.quiz(...).
import { createTypewriter } from './typewriter.js';
import { portrait } from './sprites.js';
import { assetImage, drawAsset } from './assets.js';
import { TERRAIN_ATLAS } from './terrain-atlas.js';
import { SCENERY_ATLAS } from './scenery-atlas.js';
import { terrainSample } from './terrain.js';
import { drawResident } from './characters.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createBattleUI(root, { onBlip = null, onSelect = null } = {}) {
  let writer = null, waiting = null, menuState = null, quizState = null, els = {};

  let trainer = null, portraitKey = null, portraitTimer = 0;
  // foePortrait: the 몽땅랜드 member's large picture (assets key). It shows while they appear and fades out
  // when their 독도몬 comes out. Without it, the small walking sprite stands at the side instead.
  function mount({ backdrop = 'field', sky = '#7fb7c4', aura = false, label = '', foeTrainer = null, foePortrait = null }) {
    trainer = foePortrait ? null : foeTrainer; portraitKey = foePortrait; clearTimeout(portraitTimer);
    root.classList.add('dq');
    root.innerHTML = `
      <div class="dq-top">
        <div class="dq-window dq-status" id="dqStatus"></div>
        <div class="dq-window dq-foe" id="dqFoe"></div>
      </div>
      <div class="dq-stage ${trainer ? 'has-trainer' : ''}">
        <canvas class="dq-backdrop" width="320" height="140" aria-hidden="true"></canvas>
        ${trainer ? '<canvas class="dq-trainer" width="144" height="144" aria-hidden="true"></canvas>' : ''}
        ${foePortrait ? '<div class="dq-portrait" aria-hidden="true"><canvas width="384" height="384"></canvas></div>' : ''}
        <div class="dq-enemy ${aura ? 'aura' : ''}"><i class="dq-shadow" aria-hidden="true"></i><canvas id="enemySprite" class="battle-mon enemy" width="160" height="160" aria-label="상대 독도몬"></canvas><span class="dq-dmg" aria-hidden="true"></span></div>
        <div class="dq-mine"><i class="dq-shadow" aria-hidden="true"></i><canvas id="allySprite" class="dq-ally-mon" width="160" height="160" aria-label="내 독도몬 (뒷모습)"></canvas></div>
        <span class="dq-label">${esc(label)}</span>
        <div class="dq-coach" hidden><canvas width="64" height="64" aria-hidden="true"></canvas><p></p><button type="button" class="dq-coach-skip" hidden>연습 건너뛰기</button></div>
      </div>
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
    paintBackdrop(backdrop, sky);
  }

  function paintBackdrop(kind, sky) {
    const c = els.backdrop.getContext('2d'), sheet = assetImage(TERRAIN_ATLAS.key), monument = assetImage(SCENERY_ATLAS.monument.key);
    c.imageSmoothingEnabled = false;
    const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    R(0, 0, 320, 140, sky); R(0, 0, 320, 26, shade(sky, -18)); R(0, 26, 320, 22, shade(sky, -8));
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

  function bar(cur, max) { const r = Math.max(0, cur / max); return `<div class="dq-bar"><i style="width:${r * 100}%;background:${r < .3 ? '#e07a5f' : r < .6 ? '#e9c46a' : '#7bd88f'}"></i></div>`; }
  function setStatus(m, info, party) {
    els.status.innerHTML = `<div class="dq-status-row"><canvas class="dq-ally" width="48" height="48" aria-hidden="true"></canvas><div><strong>${esc(info.name)}</strong><span class="dq-lv">Lv ${m.level}</span>
      <div class="dq-hp">HP <b>${m.hp}</b> / ${m.maxHp}</div>${bar(m.hp, m.maxHp)}</div></div>
      <div class="dq-party" aria-label="동료 상태">${party.map(p => `<i class="${p.hp <= 0 ? 'down' : p.active ? 'on' : ''}" title="${esc(p.name)}"></i>`).join('')}</div>`;
    portrait(els.status.querySelector('.dq-ally'), m.id);
    portrait(els.ally, m.id, 0, true); // my 독도몬 is seen from behind
    els.allyWrap.classList.toggle('tired', m.hp <= 0);
  }
  function setFoe(e, info, extra = '') {
    // 사나워진 독도몬: a purple 검은 기운 gauge; 관장 duels: a plain 기운 gauge
    const r = Math.max(0, e.hp / e.maxHp);
    const gauge = info.dark ? `<div class="dq-gauge-label">${esc(info.gauge)} ${Math.ceil(r * 100)}%</div><div class="dq-bar dark"><i style="width:${r * 100}%"></i></div>` : `<div class="dq-gauge-label">${esc(info.gauge || '기운')}</div>${bar(e.hp, e.maxHp)}`;
    els.foe.innerHTML = `<strong>${info.dark && e.hp > 0 ? '<span class="dq-berserk">사나워짐</span> ' : ''}${esc(info.name)}</strong><span class="dq-lv">Lv ${e.level} · ${esc(info.type)}</span>${gauge}${extra ? `<small>${esc(extra)}</small>` : ''}`;
    portrait(els.enemy, e.id); paintTrainer(); paintPortrait();
  }
  function paintPortrait() {
    const c = els.portrait?.querySelector('canvas'); if (!c || !portraitKey) return;
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
    drawAsset(g, portraitKey, 0, 0, c.width, c.height);
  }
  // The 몽땅랜드 member steps in (their 독도몬 waits off stage) …
  function portraitIn() {
    const p = els.portrait; if (!p) return false;
    clearTimeout(portraitTimer); paintPortrait();
    els.enemyWrap.classList.add('waiting'); els.enemyWrap.classList.remove('enter');
    p.classList.remove('leave'); void p.offsetWidth; p.classList.add('show'); root.classList.add('intro'); return true;
  }
  // … and fades away as the 독도몬 comes out.
  function portraitOut() {
    const p = els.portrait; if (!p) { enemyEnter(); return; }
    clearTimeout(portraitTimer); p.classList.remove('show'); void p.offsetWidth; p.classList.add('leave'); root.classList.remove('intro');
    portraitTimer = setTimeout(() => { if (els.enemyWrap) { els.enemyWrap.classList.remove('waiting'); enemyEnter(); } }, 380);
  }
  // Sending out the next 독도몬: the member shows up for a moment, then fades again.
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
  function menu(items, { title = '', prompt = '', cancel = false } = {}) {
    quizState = null; root.classList.remove('quiz-open'); root.classList.add('menu-open');
    els.message.className = 'dq-window dq-message'; els.extra.innerHTML = ''; els.next.hidden = true;
    if (prompt) writer.type(prompt); else writer.clear();
    const all = cancel ? [...items, { label: '돌아가기', value: null, back: true }] : items;
    els.command.hidden = false;
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
  function quiz({ q, order, phase, header, rule, concept }) {
    hideCommand(); root.classList.add('quiz-open'); els.next.hidden = true;
    els.message.className = `dq-window dq-message dq-quiz ${phase}`;
    writer.clear();
    els.text.innerHTML = `<div class="dq-quiz-head"><span class="phase-chip">${esc(header)}</span><span>${esc(concept)}</span></div><p class="quiz-rule">${esc(rule)}</p><h3 id="battleQuestionTitle">${esc(q.prompt)}</h3>`;
    els.extra.innerHTML = `<div class="dq-answers">${order.map((idx, pos) => `<button type="button" class="dq-option dq-answer" data-battle-answer="${idx}"><span class="dq-cursor">▶</span><b>${pos + 1}</b><span>${esc(q.options[idx])}</span></button>`).join('')}</div>
      <div class="dq-hint-row"><button type="button" id="battleHint" class="text-button">✎ 기록 힌트 보기</button></div><div class="dq-hint" hidden></div>`;
    return new Promise(resolve => {
      const buttons = [...els.extra.querySelectorAll('.dq-answer')];
      let assisted = false, answered = false;
      const choose = i => { if (answered) return; answered = true; buttons.forEach(b => { b.classList.add('locked'); b.setAttribute('aria-disabled', 'true'); }); quizState = null; onSelect?.(); resolve({ choice: Number(buttons[i].dataset.battleAnswer), assisted }); };
      buttons.forEach((b, i) => { b.onclick = () => choose(i); b.onmouseenter = () => qfocus(i); b.onfocus = () => qmark(i); });
      const hint = els.extra.querySelector('#battleHint');
      hint.onclick = () => { if (answered || assisted) return; assisted = true; hint.disabled = true; hint.textContent = '힌트 사용 중 · 도움받은 답변으로 기록돼요'; const box = els.extra.querySelector('.dq-hint'); box.hidden = false; box.textContent = q.explanation; buttons[quizState?.index || 0]?.focus({ preventScroll: true }); };
      quizState = { buttons, index: 0, choose, shownAt: performance.now() };
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
  // My 독도몬's small motions: 'lunge' (uses a skill), 'hit', 'enter' (sent out), 'tired'.
  function allyAct(kind) {
    const w = els.allyWrap; if (!w) return;
    w.classList.remove('lunge', 'hit', 'enter'); if (kind !== 'tired') w.classList.remove('tired');
    void w.offsetWidth; w.classList.add(kind);
  }
  // 연습 대결: 김박사's tip above the field. text null hides it; onSkip shows the skip button.
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
  return { mount, setStatus, setFoe, say, menu, quiz, reveal, explain, confirm, damage, enemyDefeated, enemyCalmed, enemyEnter, setAura, allyAct, portraitIn, portraitOut, portraitFlash, coach, handleKey, destroy, get waiting() { return !!waiting; } };
}
