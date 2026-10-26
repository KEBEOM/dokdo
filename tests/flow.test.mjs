// Real-browser playthrough (Playwright + Chromium): opening cutscene, starter, walking between maps,
// route objects, Dragon Quest–style quiz battles, all 8 chapters, legend, ending, saves and legacy saves.
// Setup once: npm install && npx playwright install chromium
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { QUESTIONS } from '../dist/learning.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.csv': 'text/csv' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/dist/?test`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const G = fn => page.evaluate(fn);
const until = (fn, ms = 60000, arg = null) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 });
const answerOf = prompt => QUESTIONS.find(q => q.prompt === prompt).answer;

async function dismiss() { for (let i = 0; i < 30; i++) { if (!(await page.$('#dialogue:not(.hidden) #nextTalk'))) return; await page.click('#nextTalk'); } }
async function npc(id) { await dismiss(); await until(() => !window.__dokdo.busy, 15000); const ok = await page.evaluate(id => { const d = window.__dokdo, n = d.npcs().find(n => n.id === id); if (n) d.interact(n); return !!n; }, id); assert.ok(ok, `no ${id} here`); await dismiss(); }
async function answerStudy(makeMistake = false) {
  let first = true;
  for (let i = 0; i < 12 && await page.$('[data-answer]'); i++) {
    const a = answerOf(await page.textContent('.question-title'));
    if (first && makeMistake) { await page.click(`[data-answer="${(a + 1) % 3}"]`); assert.match(await page.textContent('#nextQuestion'), /다시/); await page.click('#nextQuestion'); }
    await page.click(`[data-answer="${answerOf(await page.textContent('.question-title'))}"]`); await page.click('#nextQuestion'); first = false;
  }
}
async function battleState() { return G(() => { const b = window.__dokdo.battle; if (!b) return 'none'; if (document.querySelector('#dqCommand:not([hidden]) .dq-option')) return 'cmd'; if (document.querySelector('.dq-answer:not(.locked)')) return 'quiz'; return 'msg'; }); }
async function toMenu() { for (let i = 0; i < 40; i++) { const s = await battleState(); if (s === 'cmd' || s === 'quiz' || s === 'none') return s; await page.click('#dqMessage'); } throw new Error('no menu'); }
async function answer(correct) { const a = await G(() => window.__dokdo.battle.quiz.q.answer); await page.click(`[data-battle-answer="${correct ? a : (a + 1) % 3}"]`); await until(() => !!document.querySelector('.dq-result')); }
// 정화하기 → the first attack skill that still has uses (or '있는 힘껏').
async function purifyAttack() {
  await page.click('[data-cmd="purify"]');
  const pick = await G(() => ['skill-0', 'skill-1', 'skill-last'].find(c => { const b = document.querySelector(`#dqCommand [data-cmd="${c}"]`); return b && !b.disabled; }));
  await page.click(`#dqCommand [data-cmd="${pick}"]`);
}
async function fight() {
  let turns = 0;
  for (let i = 0; i < 600; i++) {
    const s = await battleState();
    if (s === 'none') { await dismiss(); return turns; }
    if (s === 'cmd') { await purifyAttack(); turns++; }
    else if (s === 'quiz') await answer(true);
    else await page.click('#dqMessage');
  }
  throw new Error('battle did not finish');
}
async function skipCutscene() { await until(() => !!window.__dokdo.cutscene(), 15000); const id = await G(() => window.__dokdo.cutscene()); for (let i = 0; i < 60 && await G(() => !!window.__dokdo.cutscene()) && await page.evaluate(id => window.__dokdo.cutscene() === id, id); i++) { await page.click('.cs-skip').catch(() => { }); await page.waitForTimeout(250); } }
async function walkTo(target) {
  // guide() walks to the next exit (or quest person); keep going until the map changes.
  const from = await G(() => window.__dokdo.map.id);
  for (let tries = 0; tries < 6; tries++) {
    await G(() => window.__dokdo.guide());
    await until(id => window.__dokdo.map.id !== id || !!window.__dokdo.battle, 60000, from).catch(() => { });
    if (await G(() => !!window.__dokdo.battle)) { await fight(); continue; }
    const now = await G(() => window.__dokdo.map.id);
    if (now !== from) break;
  }
  await until(t => window.__dokdo.map.id === t, 5000, target).catch(() => { });
  await until(() => !window.__dokdo.transition, 5000);
  assert.equal(await G(() => window.__dokdo.map.id), target, `walked from ${from} to ${target}`);
}

await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();

// ── 1. New game: avatar → opening (read line by line) → choice → starter → guide ──
await page.click('#startBtn'); assert.equal(await page.locator('[data-avatar]').count(), 2); assert.ok(await page.isDisabled('#avatarConfirm'));
await page.click('[data-avatar="girl"]'); await page.click('#avatarConfirm');
await until(() => window.__dokdo.cutscene() === 'opening');
assert.ok(await page.isHidden('#titleScreen')); assert.equal(await G(() => window.__dokdo.state.started), false, 'the world stays locked during the opening');
let lines = 0, choiceSeen = false, prev = '';
for (let i = 0; i < 400 && await G(() => !!window.__dokdo.cutscene()); i++) {
  if (await page.$('.cs-choice')) {
    choiceSeen = true; assert.equal(await page.locator('.cs-choice').count(), 2);
    await page.waitForTimeout(500); await page.click('.cs-choice[data-choice="1"]');
    await until(() => !document.querySelector('.cs-choice'));
    await page.click('.cs-box'); assert.match(await page.textContent('.cs-text'), /직접 함께 다니며/, 'the reply of the chosen answer is shown'); continue;
  }
  const text = await page.textContent('.cs-text');
  if (text && text !== prev) { lines++; prev = text; }
  await page.click('.cs-box').catch(() => { });
}
assert.ok(choiceSeen, 'the mission choice appeared'); assert.ok(lines >= 30, `opening lines read: ${lines}`);
await page.waitForSelector('[data-start]');
await page.click('[data-start="1"]');
await until(() => window.__dokdo.cutscene() === 'guide');
await until(() => (document.querySelector('.cs-text')?.textContent || '').length > 3); await page.click('.cs-box'); assert.match(await page.textContent('.cs-text'), /해국과 함께라면/);
await page.click('.cs-skip'); await until(() => !window.__dokdo.cutscene());
let st = await G(() => ({ started: window.__dokdo.state.started, party: window.__dokdo.state.party.map(m => m.id), map: window.__dokdo.map.id, avatar: window.__dokdo.state.avatar }));
assert.deepEqual(st, { started: true, party: [1], map: 'town0', avatar: 'girl' });
assert.equal(await page.textContent('#questTitle'), '독도몬의 비밀을 찾아서');
assert.equal(await page.textContent('#locationName'), '동도 선착장');

// ── 1b. Tutorial: a practice duel with 김박사's tips, then the walking guide ──
await until(() => window.__dokdo.battle?.kind === 'tutorial', 10000);
assert.equal(await toMenu(), 'cmd'); assert.ok(await page.isVisible('.dq-coach')); assert.match(await page.textContent('.dq-coach p'), /정화하기/);
assert.deepEqual(await page.$$eval('#dqCommand .dq-option:not([disabled])', b => b.map(x => x.dataset.cmd)), ['purify'], 'only 정화하기 on the first turn');
assert.ok(await page.$('#dqCommand .coach-pick[data-cmd="purify"]'), '정화하기 is highlighted');
await fight(); assert.equal(await G(() => window.__dokdo.state.tutorial.battle), true, 'practice duel done');
await until(() => !!document.querySelector('#coachPanel'), 5000); assert.match(await page.textContent('#coachPanel'), /1 \/ 4/);
for (const k of ['ArrowUp', 'ArrowDown', 'ArrowUp']) { await page.keyboard.down(k); await page.waitForTimeout(120); await page.keyboard.up(k); await page.waitForTimeout(380); }
assert.equal(await G(() => window.__dokdo.state.tutorial.walk), 1, 'three steps walked'); assert.match(await page.textContent('#coachPanel'), /말 걸기/);

// ── 2. Movement by key, and the bridge stays closed before the badge ──
const y0 = await G(() => window.__dokdo.state.y);
await page.keyboard.down('ArrowUp'); await page.waitForTimeout(120); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(400);
assert.equal(await G(() => window.__dokdo.state.y), y0 - 1, 'one step north along the pier');
await G(() => { const d = window.__dokdo, ex = [...d.map.exits].find(([, v]) => v === 'next')[0].split(',').map(Number); d.state.x = ex[0] - 1; d.state.y = ex[1]; });
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
assert.equal(await G(() => window.__dokdo.map.id), 'town0'); assert.match(await page.textContent('#toast'), /인증/);
await G(() => { const d = window.__dokdo, s = d.map.spawns.a; d.state.x = s.x; d.state.y = s.y; });

// ── 3. Guide walks to 김박사 ──
await G(() => window.__dokdo.guide()); await until(() => !!window.__dokdo.talk, 30000); assert.equal(await G(() => window.__dokdo.talk.name), '김박사');
await dismiss(); assert.equal(await G(() => window.__dokdo.state.progress[0].met), true);
assert.equal(await G(() => window.__dokdo.state.tutorial.walk), 2, 'talked to someone');
await page.click('#questBtn'); assert.equal(await G(() => window.__dokdo.state.tutorial.walk), 3, 'opened the notebook');
await page.click('#guideBtn'); assert.equal(await G(() => window.__dokdo.state.tutorial.walk), 4, 'used the destination guide'); assert.equal(await page.$('#coachPanel'), null, 'tutorial finished');
await G(() => { const d = window.__dokdo, s = d.map.spawns.a; d.state.x = s.x; d.state.y = s.y; });

// ── 4. Dragon Quest battle mechanics ──
await G(() => { Math.random = () => .5; window.__dokdo.startBattle('wild', 21); });
assert.equal(await page.$('.dq-trainer'), null, 'wild battles show no 백무단 member');
await page.click('#dqMessage'); assert.match(await page.textContent('.dq-text'), /나타났다/);
assert.equal(await toMenu(), 'cmd'); assert.deepEqual(await page.$$eval('#dqCommand .dq-option', b => b.map(x => x.dataset.cmd)), ['purify', 'item', 'party', 'run'], '정화하기 replaces the plain attack');
assert.ok(await G(() => { const c = document.querySelector('#allySprite'); return !!c && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0); }), 'my 독도몬 is drawn (from behind)');
await page.click('[data-cmd="purify"]'); assert.deepEqual(await page.$$eval('#dqCommand .dq-option[data-cmd]', b => b.map(x => x.dataset.cmd)), ['skill-0', 'skill-3'], 'two skills at first');
await page.click('#dqCommand .dq-option.back');
const hp = () => G(() => ({ me: window.__dokdo.state.party[window.__dokdo.state.active].hp, foe: window.__dokdo.battle?.enemies[window.__dokdo.battle.index].hp, log: window.__dokdo.state.answerLog.length, pp: window.__dokdo.state.party[0].pp.slice() }));
let h = await hp();
await purifyAttack(); assert.equal(await G(() => window.__dokdo.battle.quiz.phase), 'attack');
const right = await G(() => window.__dokdo.battle.quiz.q.answer);
await page.click(`[data-battle-answer="${right}"]`); await page.click(`[data-battle-answer="${right}"]`, { force: true }).catch(() => { });
let h2 = await hp(); assert.ok(h2.foe < h.foe, 'correct attack answer hurts the foe'); assert.equal(h2.me, h.me); assert.equal(h2.log, h.log + 1, 'answered once'); assert.equal(h2.pp[0], h.pp[0] - 1, 'the skill used one of its uses');
await toMenu(); assert.equal(await G(() => window.__dokdo.battle.quiz.phase), 'defense', 'the foe asks next'); await answer(true); const softHit = h.me - (await hp()).me; assert.ok(softHit >= 1, 'a correct defence still takes a light hit');
await toMenu(); await purifyAttack(); h = await hp(); await answer(false); h2 = await hp(); assert.equal(h2.me, h.me, 'a wrong attack answer just misses'); assert.equal(h2.foe, h.foe);
await toMenu(); h = await hp(); await answer(false); assert.ok(h.me - (await hp()).me > softHit, 'a wrong defence hurts more than a correct one');
// hint is logged as assisted
await toMenu(); await G(() => { const b = window.__dokdo.battle; b.enemies[0].hp = b.enemies[0].maxHp; });
await purifyAttack(); await page.click('#battleHint'); assert.ok(await page.isVisible('.dq-hint')); await answer(true);
assert.equal(await G(() => window.__dokdo.state.answerLog.at(-1).assisted), true);
await toMenu(); await answer(true);
// a guard skill uses PP and asks no question; the item menu heals
await toMenu(); h = await hp(); await page.click('[data-cmd="purify"]'); await page.click('#dqCommand [data-cmd="skill-3"]');
assert.equal((await hp()).pp[3], h.pp[3] - 1); await page.click('#dqMessage').catch(() => { }); assert.match(await page.textContent('.dq-text'), /절반/); await toMenu(); await answer(true);
await toMenu(); await G(() => { window.__dokdo.state.party[0].hp = 5; }); await page.click('[data-cmd="item"]'); await page.click('[data-cmd="heal"]');
await page.click('#dqMessage'); assert.ok((await hp()).me > 5); await toMenu(); await answer(true);
// the orb befriends (first friends are guaranteed)
await toMenu(); await page.click('[data-cmd="item"]'); await page.click('[data-cmd="orb"]');
for (let i = 0; i < 10 && await G(() => !!window.__dokdo.battle); i++) await page.click('#dqMessage');
assert.equal(await G(() => window.__dokdo.state.party.length), 2); assert.ok(await page.isHidden('#battleScreen'));
// switching and running away
await G(() => window.__dokdo.startBattle('wild', 39)); await toMenu(); await page.click('[data-cmd="party"]'); await page.click('#dqCommand .dq-option[data-index="1"]');
assert.equal(await G(() => window.__dokdo.state.active), 1); await toMenu(); await answer(true);
await toMenu(); await G(() => { Math.random = () => .1; }); await page.click('[data-cmd="run"]'); await page.click('#dqMessage'); await page.click('#dqMessage');
await until(() => !window.__dokdo.battle); await G(() => { Math.random = () => .5; window.__dokdo.state.active = 0; });
// ── 5. Losing every friend: safe recovery at the shelter ──
await G(() => { window.__dokdo.startBattle('wild', 39); const s = window.__dokdo.state; s.party.forEach(m => m.hp = 0); s.party[s.active].hp = 1; });
await toMenu(); await purifyAttack(); await answer(false); await toMenu(); await answer(false);
for (let i = 0; i < 12 && await G(() => !!window.__dokdo.battle); i++) await page.click('#dqMessage');
assert.equal(await G(() => window.__dokdo.battle), null); assert.equal(await G(() => window.__dokdo.talk?.name), '쉼터지기');
await dismiss(); assert.ok(await G(() => window.__dokdo.state.party.every(m => m.hp === m.maxHp)));

// ── 6. All eight chapters, walking every route ──
let totalTurns = 0;
for (let zone = 0; zone < 8; zone++) {
  if (zone > 0) { await npc('history'); }
  await npc('board'); await answerStudy(zone === 0); assert.equal(await G(() => window.__dokdo.state.progress[window.__dokdo.state.zone].studied), 2);
  await npc('shop'); await page.click('#healAll');
  await npc('enemy');
  if (zone === 7) { assert.equal(await G(() => window.__dokdo.cutscene()), 'boss-reveal', 'the truth about 백무 is revealed on 대한봉'); await skipCutscene(); }
  await until(() => !!window.__dokdo.battle, 10000);
  // the member's picture (부하 / 간부 / 대표) shows first, then fades out as the 독도몬 comes out
  const role = zone === 7 ? 'boss' : [3, 4, 6].includes(zone) ? 'exec' : 'grunt';
  assert.ok(await page.$('.dq-portrait.show'), '백무단 picture on the field'); assert.ok(await G(() => document.querySelector('.dq-enemy').classList.contains('waiting')), 'their 독도몬 waits');
  assert.ok(await G(r => window.__dokdo.battle && document.querySelector('.dq-portrait canvas').getContext('2d').getImageData(0, 0, 384, 384).data.some((v, i) => i % 4 === 3 && v), role), 'the picture is drawn');
  for (let i = 0; i < 20 && !(await page.$('.dq-portrait.leave')); i++) { await page.click('#dqMessage'); await page.waitForTimeout(120); } assert.ok(await page.$('.dq-portrait.leave'), 'the picture fades out'); await until(() => !document.querySelector('.dq-enemy').classList.contains('waiting'), 5000);
  assert.match(await page.textContent('#dqFoe'), /사나워짐/); assert.match(await page.textContent('#dqFoe'), /검은 기운/);
  totalTurns += await fight(); assert.equal(await G(() => window.__dokdo.state.progress[window.__dokdo.state.zone].enemy), true, `enemy ${zone}`);
  if (zone === 7) { assert.equal(await G(() => window.__dokdo.cutscene()), 'boss-fall'); await skipCutscene(); await skipCutscene(); await page.click('#legendOK'); await dismiss(); assert.ok(await G(() => window.__dokdo.state.legend)); }
  await npc('shop'); await page.click('#healAll');
  await npc('boss'); await answerStudy(); totalTurns += await fight(); assert.ok(await G(() => window.__dokdo.state.badges.includes(window.__dokdo.state.zone)), `badge ${zone}`);
  if (zone === 7) { assert.equal(await G(() => window.__dokdo.cutscene()), 'epilogue'); await skipCutscene(); await page.click('#endContinue'); break; }
  await walkTo(`route${zone}`);
  if (zone === 0) {
    // every kind of route object
    const before = await G(() => ({ ...window.__dokdo.state.items, coins: window.__dokdo.state.coins }));
    for (const id of ['sign', 'landmark', 'person', 'box', 'observe', 'trash']) { await npc(id); }
    const after = await G(() => ({ ...window.__dokdo.state.items, coins: window.__dokdo.state.coins }));
    assert.equal(after.heal, before.heal + 2, 'box gave two heals'); assert.ok(after.coins > before.coins, 'picking up rubbish rewards coins');
    assert.ok(await G(() => window.__dokdo.state.seen.includes(68)), 'observation records the species');
    await npc('box'); assert.equal((await G(() => window.__dokdo.state.items.heal)), after.heal, 'a box opens once');
    await npc('stone'); await answerStudy(); assert.ok(await G(() => window.__dokdo.state.flags['route0:7']));
    await npc('trainer'); totalTurns += await fight(); assert.ok(await G(() => window.__dokdo.state.flags['route0:4']), 'trainer beaten once');
  }
  if (zone === 1) {
    // the legendary 사철나무: calm it once and it joins; afterwards only the place remains
    await npc('legend'); await until(() => !!window.__dokdo.battle, 10000); assert.equal(await G(() => window.__dokdo.battle.kind), 'legend');
    totalTurns += await fight(); await until(() => !!document.querySelector('#legendTreeOK'), 10000); await page.click('#legendTreeOK');
    assert.equal(await G(() => [...window.__dokdo.state.party, ...window.__dokdo.state.storage].filter(m => m.id === 18).length), 1, 'one 사철나무 joined');
    await npc('legend'); assert.equal(await G(() => !!window.__dokdo.battle), false, 'the legend does not come back'); await dismiss();
  }
  await walkTo(`town${zone + 1}`); await skipCutscene();
  assert.ok(await G(() => window.__dokdo.state.visited.includes(window.__dokdo.state.zone)));
  if (zone === 2) {
    // fast travel only to towns already reached
    await page.click('#mapBtn'); assert.ok(await page.$('.world-map canvas#worldMapArt'), 'a picture map'); assert.equal(await page.locator('.wm-town').count(), 8); assert.ok(await page.$('.wm-town.here[data-zone="3"]'), 'you are here (just arrived in town3)'); assert.ok(await page.isDisabled('[data-zone="5"]')); await page.click('[data-zone="0"]');
    await until(() => window.__dokdo.map.id === 'town0'); await page.click('#mapBtn'); await page.click('[data-zone="3"]'); await until(() => window.__dokdo.map.id === 'town3');
  }
}
st = await G(() => { const s = window.__dokdo.state; return { ended: s.ended, badges: s.badges.length, legend: s.caught.includes(100), concepts: Object.keys(s.learning).length, revisited: Object.values(s.learning).every(r => r.correct >= 2), visited: s.visited.length }; });
assert.deepEqual(st, { ended: true, badges: 8, legend: true, concepts: 12, revisited: true, visited: 8 });
const studyLog = await G(() => window.__dokdo.state.answerLog.filter(a => a.mode === 'study'));
assert.equal(studyLog[0].correct, false); assert.equal(studyLog[1].correct, true); assert.equal(studyLog[1].assisted, true);
await page.click('#notebookBtn'); assert.equal(await page.locator('[data-review]').count(), 12); await page.keyboard.press('Escape');
await page.click('#dexBtn'); assert.equal(await page.locator('[data-dex]').count(), 100); await page.keyboard.press('Escape');

// ── 7. Saves: reload and continue in the same place; a v0.21 save still loads ──
await G(() => window.__dokdo.save()); const where = await G(() => ({ map: window.__dokdo.map.id, flags: Object.keys(window.__dokdo.state.flags).length }));
await page.reload(); await page.click('#continueBtn');
assert.deepEqual(await G(() => ({ map: window.__dokdo.map.id, flags: Object.keys(window.__dokdo.state.flags).length })), where);
await page.evaluate(() => { window.__dokdo.state.started = false; const s = JSON.parse(localStorage.getItem('dokdomon-save-v1')); delete s.map; delete s.visited; delete s.flags; s.zone = 3; s.x = 9; s.y = 21; localStorage.setItem('dokdomon-save-v1', JSON.stringify(s)); });
await page.reload(); await page.click('#continueBtn');
st = await G(() => { const d = window.__dokdo; return { map: d.map.id, visited: d.state.visited.length, onSpawn: d.state.x === d.map.spawns.a.x && d.state.y === d.map.spawns.a.y }; });
assert.deepEqual(st, { map: 'town3', visited: 8, onSpawn: true });

assert.deepEqual(errors, [], 'no browser errors');
await browser.close(); server.close();
console.log(`PASS: 백무 사장 reveal/fall/epilogue scenes, 사나워진 독도몬 duels with 검은 기운 gauges, 몽땅랜드 designs in battle, softened hits on correct defence, opening read line by line with the mission choice, starter + guide, key walking, closed bridge, guide, DQ commands (정화하기 with two starting skills, guard skill, item, orb, switch, run), my 독도몬 drawn from behind, 백무단 pictures fading out, legendary 사철나무 once, practice duel and walking tutorial, clickable picture map, easy words (사나워진 독도몬 · 검은 기운 · 몽땅랜드 컴퍼니), quiz rules (wrong attack = miss, correct defence = light hit), hints, KO recovery, route objects, trainer, memory stone, 8 chapters walked through 7 routes, first-arrival scenes, fast travel, legend, ending, saves and a v0.21 save; ${totalTurns} battle turns.`);
