// Real-browser playthrough (Playwright + Chromium): opening cutscene, starter, walking between maps,
// route objects, turn-based quiz battles, all 8 chapters, legend, ending, saves and legacy saves.
// Setup once: npm install && npx playwright install chromium
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
// --offline: play the one-file build (dokdo-explorers-offline.html) opened straight from disk, like a double-click
const offline = process.argv.includes('--offline');
const url = offline ? `${pathToFileURL(path.join(root, 'dokdo-explorers-offline.html')).href}?test` : `http://127.0.0.1:${server.address().port}/dist/?test`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const G = fn => page.evaluate(fn);
const until = (fn, ms = 60000, arg = null) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 });
const answerOf = prompt => QUESTIONS.find(q => q.prompt === prompt).answer;

const closeAll = async () => { await G(() => window.__dokdo.closeModal()); for (let i = 0; i < 10 && await page.$('#dialogue:not(.hidden) #nextTalk'); i++) await page.click('#nextTalk'); };
let stampsSeen = 0; // v0.47: 독도 지킴이를 이기면 모험 수첩에 도장이 찍히는 창이 열려요
async function dismiss() {
  for (let i = 0; i < 30; i++) {
    if (await page.$('#dialogue:not(.hidden) #nextTalk')) { await page.click('#nextTalk'); continue; }
    if (await page.$('#stampClose')) { assert.ok(await page.$('.stamp-slot.fresh .stamp'), 'the new stamp lands in the notebook'); stampsSeen++; await page.click('#stampClose'); continue; }
    return;
  }
}
async function npc(id) { await dismiss(); await until(() => !window.__dokdo.busy, 15000); const ok = await page.evaluate(id => { const d = window.__dokdo, n = d.npcs().find(n => n.id === id); if (n) d.interact(n); return !!n; }, id); assert.ok(ok, `no ${id} here`); await dismiss(); }
async function answerStudy(makeMistake = false) {
  let first = true;
  for (let i = 0; i < 12 && await page.$('[data-answer]'); i++) {
    const a = answerOf(await page.textContent('.question-title'));
    if (first && makeMistake) { await page.click(`[data-answer="${(a + 1) % 4}"]`); assert.match(await page.textContent('#nextQuestion'), /다시/); await page.click('#nextQuestion'); }
    await page.click(`[data-answer="${answerOf(await page.textContent('.question-title'))}"]`); await page.click('#nextQuestion'); first = false;
  }
}
async function battleState() { return G(() => { const b = window.__dokdo.battle; if (!b) return 'none'; if (document.querySelector('#dqCommand:not([hidden]) .dq-option')) return 'cmd'; if (document.querySelector('.dq-answer:not(.locked)')) return 'quiz'; return 'msg'; }); }
async function toMenu() { for (let i = 0; i < 40; i++) { const s = await battleState(); if (s === 'cmd' || s === 'quiz' || s === 'none') return s; await page.click('#dqMessage'); } throw new Error('no menu'); }
async function answer(correct) { const a = await G(() => window.__dokdo.battle.quiz.q.answer); await page.click(`[data-battle-answer="${correct ? a : (a + 1) % 4}"]`); await until(() => !!document.querySelector('.dq-result')); }
// 문제 풀기 → the question appears right away.
async function purifyAttack() {
  await page.click('[data-cmd="quiz"]');
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
let ferries = 0; // 울릉도 도동항 → 독도: the ferry scene plays at the pier
async function walkTo(target) {
  // guide() walks to the next exit (or quest person); keep going until the map changes.
  const from = await G(() => window.__dokdo.map.id);
  for (let tries = 0; tries < 6; tries++) {
    await G(() => window.__dokdo.guide());
    await until(id => window.__dokdo.map.id !== id || !!window.__dokdo.battle || window.__dokdo.cutscene() === 'ferry', 60000, from).catch(() => { });
    if (await G(() => !!window.__dokdo.battle)) { await fight(); continue; }
    if (await G(() => window.__dokdo.cutscene() === 'ferry')) { ferries++; await skipCutscene(); await until(id => window.__dokdo.map.id !== id, 15000, from); }
    const now = await G(() => window.__dokdo.map.id);
    if (now !== from) break;
  }
  await until(t => window.__dokdo.map.id === t, 5000, target).catch(() => { });
  await until(() => !window.__dokdo.transition, 5000);
  assert.equal(await G(() => window.__dokdo.map.id), target, `walked from ${from} to ${target}`);
}

await page.addInitScript(() => { window.__dokdoStarterField = () => { const ids = [1, 67, 66]; for (let i = 2; ids.length < 30; i++) if (![66, 67, 18, 68, 70, 71, 72, 75, 76, 100].includes(i)) ids.push(i); return ids; }; }); // a fixed field so the test can pick 해국
await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();

// ── 1. New game: avatar → opening (read line by line) → choice → starter → guide ──
await page.click('#startBtn'); assert.equal(await page.locator('[data-avatar]').count(), 2); assert.ok(await page.isDisabled('#avatarConfirm'));
// the explorer drawings fill the choice cards (512-px pictures, not the small walking sprite)
await until(() => [...document.querySelectorAll('canvas[data-explorer-portrait]')].every(c => { const d = c.getContext('2d').getImageData(0, 0, 512, 512).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n > 20000; }), 10000);
await page.click('[data-avatar="girl"]'); await page.click('#avatarConfirm');
await until(() => window.__dokdo.cutscene() === 'opening');
assert.ok(await page.isHidden('#titleScreen')); assert.equal(await G(() => window.__dokdo.state.started), false, 'the world stays locked during the opening');
let lines = 0, choiceSeen = false, prev = '';
for (let i = 0; i < 400 && await G(() => window.__dokdo.cutscene() === 'opening'); i++) {
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
// then 나리분지 초원: 김박사's 30 우산몬 walk around; talk to them and decide who comes along
await until(() => !window.__dokdo.cutscene() && window.__dokdo.map?.id === 'meadow0', 15000);
await page.waitForSelector('#dialogue:not(.hidden)'); assert.match(await page.textContent('#dialogue'), /나리분지/, '김박사 explains the meadow');
for (let i = 0; i < 8 && await page.$('#dialogue:not(.hidden) #nextTalk'); i++) await page.click('#nextTalk');
assert.equal(await page.textContent('#questTitle'), '함께 떠날 첫 동료 고르기');
const friends = await G(() => window.__dokdo.people().filter(p => p.kind === 'friend').map(p => p.species));
assert.equal(friends.length, 30, '30 우산몬 in the meadow'); assert.equal(new Set(friends).size, 30, 'all different');
assert.ok(!friends.some(i => [18, 68, 70, 71, 72, 75, 76, 100].includes(i)), 'no legendary or story 우산몬 in the meadow');
assert.equal(await G(() => window.__dokdo.state.party.length), 0);
await page.waitForTimeout(1200); const fp0 = await G(() => window.__dokdo.people().filter(p => p.kind === 'friend').map(p => `${p.x},${p.y}`).join('|'));
await page.waitForTimeout(2500); assert.notEqual(await G(() => window.__dokdo.people().filter(p => p.kind === 'friend').map(p => `${p.x},${p.y}`).join('|')), fp0, 'they walk around freely');
const meet = id => page.evaluate(id => window.__dokdo.interact(window.__dokdo.people().find(p => p.kind === 'friend' && p.species === id)), id);
await meet(67); await page.waitForSelector('#takeFriend');
assert.match(await page.textContent('#modal'), /괭이갈매기/); assert.match(await page.textContent('#modal'), /바람 속성/); assert.match(await page.textContent('#modal'), /첫 독도 지킴이 해온/);
assert.ok(await page.$('#modal .base-stats'), 'stats help you decide');
await page.click('#keepLooking'); assert.equal(await G(() => window.__dokdo.state.party.length), 0, 'just looking does not take it along');
assert.ok(await G(() => window.__dokdo.state.seen.includes(67)), 'talking to it fills the dex');
await meet(1); await page.waitForSelector('#takeFriend'); assert.match(await page.textContent('#modal'), /해국/);
await page.click('#takeFriend');
await until(() => window.__dokdo.cutscene() === 'guide');
await until(() => (document.querySelector('.cs-text')?.textContent || '').length > 3); await page.click('.cs-box'); assert.match(await page.textContent('.cs-text'), /해국과 함께라면/);
await page.click('.cs-skip'); await until(() => !window.__dokdo.cutscene() && window.__dokdo.map?.id === 'town0');
let st = await G(() => ({ started: window.__dokdo.state.started, party: window.__dokdo.state.party.map(m => m.id), map: window.__dokdo.map.id, avatar: window.__dokdo.state.avatar }));
assert.deepEqual(st, { started: true, party: [1], map: 'town0', avatar: 'girl' });
assert.equal(await page.textContent('#questTitle'), '우산몬의 비밀을 찾아서');
assert.equal(await page.textContent('#locationName'), '도동항', 'chapter 1 is 울릉도 도동항');

// ── 1b. Tutorial: a practice duel with 김박사's tips, then the walking guide ──
await until(() => window.__dokdo.battle?.kind === 'tutorial', 10000);
assert.equal(await toMenu(), 'cmd'); assert.ok(await page.isVisible('.dq-coach')); assert.match(await page.textContent('.dq-coach p'), /기록 찾기/);
assert.deepEqual(await page.$$eval('#dqCommand .dq-option:not([disabled])', b => b.map(x => x.dataset.cmd)), ['quiz'], 'only 문제 풀기 on the first turn');
assert.ok(await page.$('#dqCommand .coach-pick[data-cmd="quiz"]'), '문제 풀기 is highlighted');
await fight(); assert.equal(await G(() => window.__dokdo.state.tutorial.battle), true, 'practice duel done');
await until(() => !!document.querySelector('#coachPanel'), 5000); assert.match(await page.textContent('#coachPanel'), /1 \/ 4/);
for (const k of ['ArrowUp', 'ArrowDown', 'ArrowUp']) { await page.keyboard.down(k); await page.waitForTimeout(300); await page.keyboard.up(k); await page.waitForTimeout(250); } // 자유 걷기(v0.63): 0.3초면 한 칸 넘게 걸어요
assert.equal(await G(() => window.__dokdo.state.tutorial.walk), 1, 'three steps walked'); assert.match(await page.textContent('#coachPanel'), /말 걸기/);

// ── 2. Movement by key, and the bridge stays closed before the badge ──
const y0 = await G(() => { const d = window.__dokdo; d.place(d.state.x, d.state.y, 'up'); return d.state.y; });
await page.keyboard.down('ArrowUp'); await page.waitForTimeout(220); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(300);
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
// 공부 수첩: [독도 공부] 쪽을 읽으면 표시가 남고, 확인 문제로 이어져요 · [배움의 기록] 탭
await closeAll(); await page.click('#notebookBtn'); await page.waitForSelector('[data-page]'); assert.equal(await page.locator('[data-page]').count(), 8, '8 독도 공부 pages');
await page.click('[data-page="history"]'); await page.waitForSelector('.study-timeline'); assert.match(await page.textContent('.study-timeline'), /1900년[\s\S]*칙령 제41호/);
assert.ok(await G(() => window.__dokdo.state.flags['study:history']), 'reading a page marks it'); assert.equal(await page.textContent('#learningProgress'), '1 / 8');
await page.click('[data-tab="record"]'); await page.waitForSelector('#exportLearning'); await page.click('[data-tab="study"]'); await page.waitForSelector('[data-page]');
await G(() => window.__dokdo.closeModal());
await G(() => { const d = window.__dokdo, s = d.map.spawns.a; d.state.x = s.x; d.state.y = s.y; });

// ── 4. turn-based battle mechanics ──
await G(() => { Math.random = () => .5; window.__dokdo.startBattle('wild', 21); });
assert.equal(await page.$('.dq-trainer'), null, 'wild battles show no 백무단 member');
await page.click('#dqMessage'); assert.match(await page.textContent('.dq-text'), /검은 기운/);
assert.equal(await toMenu(), 'cmd'); assert.deepEqual(await page.$$eval('#dqCommand .dq-option', b => b.map(x => x.dataset.cmd)), ['quiz', 'befriend', 'item', 'party', 'run'], '문제 풀기 · 동료 만들기 · 도구 · 동료 · 물러나기');
assert.ok(await G(() => { const c = document.querySelector('#allySprite'); return !!c && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0); }), 'my 우산몬 is drawn (from behind)');
const hp = () => G(() => ({ me: window.__dokdo.state.party[window.__dokdo.state.active].hp, foe: window.__dokdo.battle?.enemies[window.__dokdo.battle.index].hp, log: window.__dokdo.state.answerLog.length, pp: window.__dokdo.state.party[0].pp.slice() }));
let h = await hp();
await purifyAttack(); assert.equal(await G(() => window.__dokdo.battle.quiz.phase), 'attack');
const right = await G(() => window.__dokdo.battle.quiz.q.answer);
await page.click(`[data-battle-answer="${right}"]`); await page.click(`[data-battle-answer="${right}"]`, { force: true }).catch(() => { });
let h2 = await hp(); assert.ok(h2.foe < h.foe, 'correct attack answer hurts the foe'); assert.equal(h2.me, h.me); assert.equal(h2.log, h.log + 1, 'answered once');
await toMenu(); assert.equal(await G(() => window.__dokdo.battle.quiz.phase), 'defense', 'the foe asks next'); await answer(true); const softHit = h.me - (await hp()).me; assert.ok(softHit >= 1, 'a correct defence still takes a light hit');
await toMenu(); await purifyAttack(); h = await hp(); await answer(false); h2 = await hp(); assert.equal(h2.me, h.me, 'a wrong attack answer just misses'); assert.equal(h2.foe, h.foe);
await toMenu(); h = await hp(); await answer(false); assert.ok(h.me - (await hp()).me > softHit, 'a wrong defence hurts more than a correct one');
// hint is logged as assisted
await toMenu(); await G(() => { const b = window.__dokdo.battle; b.enemies[0].hp = b.enemies[0].maxHp; });
await purifyAttack(); await page.click('#battleHint'); assert.ok(await page.isVisible('.dq-hint')); await answer(true);
assert.equal(await G(() => window.__dokdo.state.answerLog.at(-1).assisted), true);
await toMenu(); await answer(true);
// type advantage: against a weak foe (잎 → 빛) a wrong answer still reaches with half power
await toMenu(); await G(() => { const e = window.__dokdo.battle.enemies[0]; e.id = 28; e.hp = e.maxHp; });
await purifyAttack(); h = await hp(); await answer(false); h2 = await hp(); assert.ok(h2.foe < h.foe, 'advantage: even a wrong answer reaches with half power');
await toMenu(); await answer(true); await G(() => { window.__dokdo.battle.enemies[0].id = 21; });
await toMenu(); await G(() => { window.__dokdo.state.party[0].hp = 5; }); await page.click('[data-cmd="item"]'); await page.click('[data-cmd="heal"]');
await page.click('#dqMessage'); assert.ok((await hp()).me > 5); await toMenu(); await answer(true);
// 동료 만들기 needs no orb (first friends are guaranteed)
await toMenu(); await page.click('[data-cmd="befriend"]');
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
// 동료 주머니: with six friends, swap with one who is resting — no machine needed
await G(() => { const s = window.__dokdo.state, base = s.party[0]; while (s.party.length < 4) s.party.push({ ...base, uid: 'p' + s.party.length, id: 40 + s.party.length }); s.storage.push({ ...base, uid: 'rest1', id: 44 }); });
await page.click('#partyBtn'); assert.ok(await page.isVisible('.storage-grid .trait-chip'), 'the 동료 button opens the storage with traits'); await page.click('[data-rest-slot="0"]'); assert.ok(await page.isVisible('.swap-note'), 'asks who to swap with');
await page.click('[data-party-slot="3"]');
assert.deepEqual(await G(() => ({ p5: window.__dokdo.state.party[3].id, rest: window.__dokdo.state.storage.map(m => m.id), size: window.__dokdo.state.party.length })), { p5: 44, rest: [43], size: 4 });
await G(() => { const s = window.__dokdo.state; s.party = s.party.slice(0, 2); s.storage = []; window.__dokdo.closeModal(); });

// ── 5b. 길 위를 걸어 다니는 야생 우산몬: 마을엔 없고, 길에는 보이게 걸어 다녀요. 부딪히면 결투, 끝나면 사라져요 ──
assert.equal(await G(() => window.__dokdo.people().filter(n => n.kind === 'wild').length), 0, 'no wild 우산몬 in town');
await G(() => window.__dokdo.changeMap('route0', 'a')); await until(() => window.__dokdo.map.id === 'route0' && !window.__dokdo.transition, 15000); await dismiss();
await until(() => window.__dokdo.people().filter(n => n.kind === 'wild').length === 10, 5000);
let bumped = false;
for (let i = 0; i < 12 && !bumped; i++) {
  const ok = await G(() => { const d = window.__dokdo, r = d.people().find(n => n.kind === 'wild' && !n.walking && !d.people().some(p => p.x === n.x - 1 && p.y === n.y) && [1, 2, 3, 4].includes(d.map[n.y][n.x - 1])); if (!r) return null; d.place(r.x - 1, r.y, 'right'); return r.uid; });
  if (ok) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(200); await page.keyboard.up('ArrowRight'); bumped = await page.waitForFunction(uid => window.__dokdo.battle?.roamer === uid, ok, { timeout: 1500, polling: 50 }).then(() => true, () => false); if (!bumped && await G(() => !!window.__dokdo.battle)) { await G(() => window.__dokdo.closeBattleForTest()); } }
  if (!bumped) await page.waitForTimeout(400);
}
assert.ok(bumped, 'bumping into a walking 우산몬 starts a battle with it');
const metUid = await G(() => window.__dokdo.battle.roamer);
await toMenu(); await G(() => { Math.random = () => .1; }); await page.click('[data-cmd="run"]');
for (let i = 0; i < 6 && await G(() => !!window.__dokdo.battle); i++) await page.click('#dqMessage');
await until(() => !window.__dokdo.battle); await G(() => { Math.random = () => .5; });
assert.ok(await G(uid => !window.__dokdo.people().some(n => n.uid === uid), metUid), 'the one you met disappears (it comes back somewhere else later)');
await G(() => window.__dokdo.changeMap('town0', 'a')); await until(() => window.__dokdo.map.id === 'town0' && !window.__dokdo.transition, 15000); await dismiss();
assert.equal(await G(() => window.__dokdo.people().filter(n => n.kind === 'wild').length), 0, 'back in town: none');

// ── 6. All eight chapters, walking every route ──
let totalTurns = 0;
for (let zone = 0; zone < 8; zone++) {
  if (zone > 0) { await npc('history'); }
  await npc('board'); await answerStudy(zone === 0); assert.equal(await G(() => window.__dokdo.state.progress[window.__dokdo.state.zone].studied), 2);
  await npc('shop'); await page.click('#healAll');
  await npc('enemy');
  if (zone === 7) { assert.equal(await G(() => window.__dokdo.cutscene()), 'boss-reveal', 'the truth about 백무 is revealed on 대한봉'); await skipCutscene(); }
  await until(() => !!window.__dokdo.battle, 10000);
  // the member's picture (부하 / 간부 / 대표) shows first, then fades out as the 우산몬 comes out
  const role = zone === 7 ? 'boss' : [3, 4, 6].includes(zone) ? 'exec' : 'grunt';
  assert.ok(await page.$('.dq-portrait.show'), '백무단 picture on the field'); assert.ok(await G(() => document.querySelector('.dq-enemy').classList.contains('waiting')), 'their 우산몬 waits');
  assert.ok(await G(r => window.__dokdo.battle && document.querySelector('.dq-portrait canvas').getContext('2d').getImageData(0, 0, 384, 384).data.some((v, i) => i % 4 === 3 && v), role), 'the picture is drawn');
  for (let i = 0; i < 20 && !(await page.$('.dq-portrait.leave')); i++) { await page.click('#dqMessage'); await page.waitForTimeout(120); } assert.ok(await page.$('.dq-portrait.leave'), 'the picture fades out'); await until(() => !document.querySelector('.dq-enemy').classList.contains('waiting'), 5000);
  assert.match(await page.textContent('#dqFoe'), /사나워짐/); assert.match(await page.textContent('#dqFoe'), /검은 기운/);
  if (zone === 7) assert.deepEqual(await G(() => window.__dokdo.battle.enemies.map(m => m.id)), [43, 58, 18], '백무 사장 sends out 사철나무 last');
  totalTurns += await fight(); assert.equal(await G(() => window.__dokdo.state.progress[window.__dokdo.state.zone].enemy), true, `enemy ${zone}`);
  if (zone === 7) {
    // 사철나무 was in 백무 사장's team: purified, it joins (one in the whole game), then 강치
    assert.equal(await G(() => window.__dokdo.cutscene()), 'boss-fall'); await skipCutscene();
    assert.equal(await G(() => window.__dokdo.cutscene()), 'tree-joins'); await skipCutscene();
    assert.equal(await G(() => [...window.__dokdo.state.party, ...window.__dokdo.state.storage].filter(m => m.id === 18).length), 0, '사철나무 is freed and goes back to 천장굴 (caught later at 10%)');
    await skipCutscene(); await page.click('#legendOK'); await dismiss(); assert.ok(await G(() => window.__dokdo.state.legend));
  }
  await npc('shop'); await page.click('#healAll');
  await npc('boss'); await answerStudy(); totalTurns += await fight(); assert.ok(await G(() => window.__dokdo.state.badges.includes(window.__dokdo.state.zone)), `badge ${zone}`);
  await dismiss(); assert.equal(stampsSeen, zone + 1, `stamp ${zone + 1} in the 모험 수첩`);
  if (zone === 7) { await until(() => window.__dokdo.cutscene() === 'epilogue', 10000); await skipCutscene(); await page.click('#endContinue'); break; }
  if (zone === 0) {
    // buildings: walk in through the door, climb the stairs, read, review and walk back out with the guide
    const inside = async id => until(id => window.__dokdo.map.id === id && !window.__dokdo.transition, 20000, id);
    const leave = async () => { for (let i = 0; i < 6 && await G(() => window.__dokdo.map.kind === 'room'); i++) { const id = await G(() => window.__dokdo.map.id); await G(() => window.__dokdo.guide()); await until(id => window.__dokdo.map.id !== id && !window.__dokdo.transition, 20000, id); } };
    await G(() => window.__dokdo.goInside('lab')); await inside('town0/lab/1');
    assert.equal(await G(() => window.__dokdo.state.dir), 'up', 'you come in facing the room');
    await npc('dex'); assert.equal(await page.locator('[data-dex]').count(), 100, 'the dex terminal opens the dex'); await G(() => window.__dokdo.closeModal());
    const up = await G(() => window.__dokdo.map.stairs.find(s => s.dir === 'up'));
    await page.evaluate(([x, y]) => window.__dokdo.walkToTile(x, y), [up.x, up.y]); await inside('town0/lab/2');
    await npc('sign'); await npc('stone'); await answerStudy(); assert.ok(await G(() => window.__dokdo.state.flags['town0/lab/2:3']), 'the review desk in the library');
    await leave(); assert.equal(await G(() => window.__dokdo.map.id), 'town0', 'stairs down, then out of the door');
    assert.equal(await G(() => window.__dokdo.state.dir), 'down', 'you come out facing the town');
    // standing under the painted door and pressing ↑ walks in
    const front = await G(() => window.__dokdo.standAtDoor('shop')); await until(() => /쉼터 · 상점 들어가기/.test(document.querySelector('#interactionPrompt').textContent), 5000);
    await page.keyboard.down('ArrowUp'); await inside('town0/shop/1'); await page.keyboard.up('ArrowUp'); void front;
    await G(() => { window.__dokdo.state.party[0].hp = 1; }); await npc('rest'); assert.ok(await G(() => window.__dokdo.state.party.every(m => m.hp === m.maxHp)), 'a rest on the shelter bed heals');
    await leave(); assert.equal(await G(() => window.__dokdo.map.id), 'town0');
  }
  await walkTo(`route${zone}`);
  if (zone === 0) assert.equal(ferries, 1, 'the ferry takes you from 울릉도 to 독도');
  if (zone === 0) {
    // every kind of route object
    const before = await G(() => ({ ...window.__dokdo.state.items, coins: window.__dokdo.state.coins }));
    for (const id of ['sign', 'landmark', 'person', 'box', 'observe', 'trash']) { await npc(id); }
    const after = await G(() => ({ ...window.__dokdo.state.items, coins: window.__dokdo.state.coins }));
    assert.equal(after.heal, before.heal + 2, 'box gave two heals'); assert.ok(after.coins > before.coins, 'picking up rubbish rewards coins');
    assert.ok(await G(() => window.__dokdo.state.seen.includes(69)), 'observation records the species (슴새)');
    await npc('box'); assert.equal((await G(() => window.__dokdo.state.items.heal)), after.heal, 'a box opens once');
    await npc('stone'); await answerStudy(); assert.ok(await G(() => window.__dokdo.state.flags['route0:7']));
    await npc('trainer'); totalTurns += await fight(); assert.ok(await G(() => window.__dokdo.state.flags['route0:4']), 'trainer beaten once');
  }
  if (zone === 1) {
    // the real 사철나무 is only observed from afar here; its record has been taken (it waits with 백무 사장)
    await npc('observe'); assert.equal(await G(() => !!window.__dokdo.battle), false, 'no battle at the tree'); assert.ok(await G(() => window.__dokdo.state.seen.includes(18)));
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
await page.click('#notebookBtn'); await page.click('[data-tab="record"]'); await page.waitForSelector('#exportLearning'); assert.equal(await page.locator('[data-review]').count(), 12); await page.keyboard.press('Escape');
await page.click('#dexBtn'); assert.equal(await page.locator('[data-dex]').count(), 100); await page.keyboard.press('Escape');

// ── 6b. 전설의 우산몬(천연기념물): 조건을 채우면 김박사 무전 → 금빛 기운 → 만남 장면 → 정화 결투 → 동료 ──
await G(() => { window.__dokdo.legendRadio = true; });
await until(() => window.__dokdo.talk?.name === '김박사(무전)', 15000);
for (let i = 0; i < 8; i++) { await dismiss(); await page.waitForTimeout(900); if (!(await G(() => !!window.__dokdo.talk))) break; }
assert.ok(await G(() => window.__dokdo.state.flags['legend-open:68']), '소쩍새 quest opens after the 도동항 인증');
assert.ok(await G(() => window.__dokdo.state.flags['legend-open:18']), '사철나무 quest opens after 백무 사장 is stopped');
await G(() => window.__dokdo.changeMap('town0', 'a')); await until(() => window.__dokdo.map.id === 'town0' && !window.__dokdo.transition, 15000); await dismiss();
assert.ok(await G(() => window.__dokdo.npcs().some(n => n.kind === 'legend' && n.species === 68)), 'the golden spot is on the map');
await G(() => { window.__dokdo.place(27, 6, 'right'); const n = window.__dokdo.npcs().find(n => n.kind === 'legend'); window.__dokdo.interact(n); });
await until(() => window.__dokdo.cutscene() === 'legend-68', 10000); await skipCutscene();
await until(() => window.__dokdo.battle?.kind === 'legend', 10000);
// purified but not befriended: it goes back and the spot stays
await G(() => { window.__dokdo.battle.enemies[0].hp = 1; });
totalTurns += await fight();
assert.ok(await G(() => window.__dokdo.npcs().some(n => n.kind === 'legend' && n.species === 68)), 'still there after a plain win');
// 동료 만들기 at a fixed 10%: here the dice say yes
await G(() => { window.__dokdo.place(27, 6, 'right'); window.__dokdo.interact(window.__dokdo.npcs().find(n => n.kind === 'legend')); });
await until(() => window.__dokdo.cutscene() === 'legend-68', 10000); await skipCutscene(); await until(() => window.__dokdo.battle?.kind === 'legend', 10000);
assert.equal(await toMenu(), 'cmd'); assert.match(await page.textContent('#dqCommand [data-cmd="befriend"]'), /10%/);
await G(() => { Math.random = () => .05; }); await page.click('[data-cmd="befriend"]');
for (let i = 0; i < 10 && await G(() => !!window.__dokdo.battle); i++) await page.click('#dqMessage');
await G(() => { Math.random = () => .5; });
await until(() => !!document.querySelector('#legendJoinOK'), 10000);
assert.ok(await page.$('.form-pair canvas[data-portrait="68-2"]'), 'the join screen shows the 변환폼');
await page.click('#legendJoinOK'); await dismiss();
st = await G(() => { const s = window.__dokdo.state; return { owned: [...s.party, ...s.storage].filter(m => m.id === 68).length, met: !!s.flags['legend:68'], spot: window.__dokdo.npcs().some(n => n.kind === 'legend' && n.species === 68), forms: [...s.party, ...s.storage].some(m => m.form) }; });
assert.deepEqual(st, { owned: 1, met: true, spot: false, forms: false });
await page.click('#dexBtn'); await page.click('[data-dex="68"]'); await page.click('[data-view="photo"]');
await until(() => { const i = document.querySelector('.dex-photo img'); return i && i.complete && i.naturalWidth > 0; }, 10000);
assert.match(await page.locator('.dex-photo figcaption').innerText(), /국립생물자원관.*공공누리/);
await page.click('[data-view="form2"]'); assert.ok(await page.$('canvas[data-portrait="68-2"]'), 'dex shows the 변환폼'); await page.keyboard.press('Escape');

// ── 7. Saves: reload and continue in the same place; a v0.21 save still loads ──
await G(() => window.__dokdo.save()); const where = await G(() => ({ map: window.__dokdo.map.id, flags: Object.keys(window.__dokdo.state.flags).length }));
await page.reload(); await page.click('#continueBtn');
assert.deepEqual(await G(() => ({ map: window.__dokdo.map.id, flags: Object.keys(window.__dokdo.state.flags).length })), where);
await page.evaluate(() => { window.__dokdo.state.started = false; const s = JSON.parse(localStorage.getItem('dokdomon-save-v1')); delete s.map; delete s.visited; delete s.flags; s.zone = 3; s.x = 9; s.y = 21; localStorage.setItem('dokdomon-save-v1', JSON.stringify(s)); });
await page.reload(); await page.click('#continueBtn');
st = await G(() => { const d = window.__dokdo; return { map: d.map.id, visited: d.state.visited.length, onSpawn: d.state.x === d.map.spawns.a.x && d.state.y === d.map.spawns.a.y }; });
assert.deepEqual(st, { map: 'town3', visited: 8, onSpawn: true });

assert.deepEqual(errors, [], 'no browser errors');
// ── 기록 되찾기 결투의 형식 (v0.58): 두루마리, 순서 놓기, 나침반, ○× ──
if (await G(() => !!window.__dokdo.battle)) await G(() => window.__dokdo.closeBattleForTest());
await G(() => { window.__dokdo.closeModal(); window.__dokdoOrder = true; const s = window.__dokdo.state; for (const m of s.party) m.hp = m.maxHp; });
for (let i = 0; i < 8 && await page.$('#dialogue:not(.hidden) #nextTalk'); i++) await page.click('#nextTalk');
await G(() => window.__dokdo.startBattle('wild', 39)); await toMenu();
assert.ok(await page.isVisible('.dq-scroll .scroll-record'), 'the foe shows a record scroll'); assert.equal(await page.$('.dq-me'), null, 'my picture stays away from wild duels'); assert.equal(await page.$('.dq-explorer'), null);
const blanks = () => page.$$eval('.scroll-record i:not(.sp)', a => ({ all: a.length, on: a.filter(x => x.classList.contains('on')).length }));
assert.equal((await blanks()).on, 0, 'the record starts blank');
await G(() => { window.__dokdo.forceQuestion = window.__dokdo.questionById('H1-26'); const e = window.__dokdo.battle.enemies[0]; e.maxHp = e.hp = 9999; });
await page.click('[data-cmd="quiz"]'); await page.waitForSelector('.dq-chip');
assert.equal(await G(() => window.__dokdo.battle.quiz.format), 'order'); assert.ok(await page.isDisabled('#orderOk'), 'place every card first');
for (const t of ['우산국 복속', '세종실록 지리지', '칙령 제41호']) await page.click(`.dq-chip:text-is("${t}")`);
await page.click('.dq-slot[data-slot="2"]'); assert.ok(await page.isDisabled('#orderOk'), 'a placed card can be taken back'); await page.click('.dq-chip:text-is("칙령 제41호")');
await page.click('#orderOk'); await until(() => window.__dokdo.battle.quiz.answered); assert.equal(await G(() => window.__dokdo.battle.quiz.correct), true, 'the right order counts as correct');
assert.ok(await page.isVisible('.dq-slots.correct')); assert.match(await page.textContent('.dq-right'), /우산국 복속 → 세종실록 지리지 → 칙령 제41호/);
await G(() => { window.__dokdo.forceQuestion = window.__dokdo.questionById('N3-4'); }); await page.click('#dqMessage'); await page.waitForSelector('.dq-ox .dq-answer:not(.locked)');
assert.equal(await G(() => window.__dokdo.battle.quiz.format), 'ox', 'the foe turn is a quick ○× call'); assert.equal(await page.$$eval('.dq-ox .dq-answer', a => a.length), 2);
await answer(true); assert.equal(await G(() => window.__dokdo.battle.quiz.correct), true);
await G(() => { window.__dokdo.forceQuestion = window.__dokdo.questionById('G1-1'); const e = window.__dokdo.battle.enemies[0]; e.maxHp = 40; e.hp = 40; }); await toMenu(); await page.click('[data-cmd="quiz"]'); await page.waitForSelector('.dq-compass .compass-pt');
assert.equal(await G(() => window.__dokdo.battle.quiz.format), 'compass'); await answer(true);
assert.ok((await blanks()).on > 0, 'right answers fill the record');
await G(() => { window.__dokdo.forceQuestion = null; window.__dokdoOrder = false; window.__dokdo.closeBattleForTest(); });
// ── v0.60: 특성(연속 풀이)과 사람과 겨룰 때만 나오는 내 큰 그림 ──
const { traitOf } = await import('../dist/traits.js'); const dbl = Array.from({ length: 100 }, (_, i) => i + 1).find(i => traitOf(i).id === 'double');
assert.ok(dbl, 'some species has the 연속 풀이 trait');
await page.evaluate(id => { window.__dokdoTraits = true; const s = window.__dokdo.state; s.active = 0; s.party[0].id = id; for (const m of s.party) m.hp = m.maxHp; window.__dokdo.startBattle('wild', 39); }, dbl); await toMenu();
assert.ok(await page.isVisible('.dq-status .dq-trait'), 'my status shows the trait');
await G(() => { window.__dokdo.forceQuestion = window.__dokdo.questionById('G2-4'); const e = window.__dokdo.battle.enemies[0]; e.maxHp = e.hp = 9999; });
await page.click('[data-cmd="quiz"]'); await page.waitForSelector('.dq-quiz .dq-answer:not(.locked)'); const firstQ = await G(() => window.__dokdo.battle.quiz.q.id); await answer(true);
assert.equal(await toMenu(), 'quiz', 'no command menu in between');
assert.deepEqual(await G(() => ({ phase: window.__dokdo.battle.quiz.phase, open: !window.__dokdo.battle.quiz.answered })), { phase: 'attack', open: true }, '연속 풀이 gives a second attack question in the same turn');
await answer(true); await G(() => { window.__dokdoTraits = false; window.__dokdo.closeBattleForTest(); });
await G(() => { const s = window.__dokdo.state; for (const m of s.party) m.hp = m.maxHp; window.__dokdo.startBattle('rematch'); }); await page.waitForSelector('.dq-me.show');
assert.ok(await page.isVisible('.dq-me.show') && await page.isVisible('.dq-vs.show') && await page.isVisible('.dq-portrait.show'), 'my big picture, VS and the opponent come in together');
await until(() => { const c = document.querySelector('.dq-me canvas'); return [...c.getContext('2d').getImageData(0, 0, c.width, c.height).data].some((v, i) => i % 4 === 3 && v > 0); });
await toMenu(); await page.waitForTimeout(700);
assert.deepEqual(await G(() => ['.dq-me', '.dq-vs', '.dq-portrait'].map(q => getComputedStyle(document.querySelector(q)).opacity)), ['0', '0', '0'], 'they leave together, and I am not shown afterwards');
assert.ok(await page.isVisible('#allySprite'), 'my 우산몬 comes out after the VS');
await G(() => window.__dokdo.closeBattleForTest());
// ── v0.62: 3D 보기 — 뒤에서 따라가는 시점, 보는 방향 기준 W A S D, 끌어서 둘러보기, 작은 지도 ──
await G(() => window.__dokdo.closeModal()); for (let i = 0; i < 8 && await page.$('#dialogue:not(.hidden) #nextTalk'); i++) await page.click('#nextTalk');
if (await G(() => window.__dokdo.map.kind !== 'room' && !window.__dokdo.busy)) {
  await G(() => { window.__dokdo.setView3d(true); window.__dokdo.state.dir = 'up'; window.__dokdo.setLook(0, 0); });
  await page.waitForTimeout(300); assert.ok(await page.isVisible('.mini-map'), 'the mini map shows in the 3D view');
  await page.keyboard.press('a'); await page.waitForTimeout(400); assert.equal(await G(() => window.__dokdo.state.dir), 'left', 'looking north, A goes west');
  if (await G(() => !window.__dokdo.battle && !window.__dokdo.busy)) {
    await G(() => window.__dokdo.setLook(Math.PI / 2, 0)); await page.keyboard.press('w'); await page.waitForTimeout(400);
    assert.equal(await G(() => window.__dokdo.battle ? 'right' : window.__dokdo.state.dir), 'right', 'looking east, W goes east');
  }
  if (await G(() => !window.__dokdo.battle && !window.__dokdo.busy)) {
    await G(() => window.__dokdo.setLook(0, 0)); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250); await page.keyboard.up('ArrowRight'); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(250); await page.keyboard.up('ArrowUp');
    const lk = await G(() => window.__dokdo.look); assert.ok(lk.yaw > .1 && lk.pitch > .05, 'arrow keys look around (right and up)');
  }
  // v0.63 자유 걷기: 칸 사이에도 설 수 있고, 2D로 돌아오면 칸 가운데로 돌아와요
  if (await G(() => !!window.__dokdo.battle)) await G(() => window.__dokdo.closeBattleForTest());
  await G(() => window.__dokdo.changeMap('route0', 'a', { instant: true })); await page.waitForTimeout(900);
  for (let i = 0; i < 8 && await page.$('#dialogue:not(.hidden) #nextTalk'); i++) await page.click('#nextTalk');
  const f0 = await G(() => { window.__dokdo.setLook(Math.PI / 2, 0); return window.__dokdo.state.x; });
  await page.keyboard.down('w'); await page.waitForTimeout(330); await page.keyboard.up('w'); await page.waitForTimeout(120);
  const f1 = await G(() => ({ x: window.__dokdo.state.x, vx: window.__dokdo.motion().view.x, battle: !!window.__dokdo.battle, dir: window.__dokdo.state.dir }));
  if (!f1.battle) { assert.equal(f1.dir, 'right'); assert.ok(f1.vx > f0 + .5, `W walks the way the camera looks (${f0} → ${f1.vx})`); assert.ok(Math.abs(f1.vx - Math.round(f1.vx)) > .001, 'free walking can stop between tiles'); assert.equal(f1.x, Math.round(f1.vx), 'my tile is the nearest one'); }
  if (await G(() => !!window.__dokdo.battle)) await G(() => window.__dokdo.closeBattleForTest());
  await G(() => { document.exitPointerLock?.(); window.__dokdo.setView3d(false); }); await page.waitForTimeout(200); assert.ok(!(await page.isVisible('.mini-map')), 'no mini map in 2D');
  // 2D에서도 자유 걷기: 방향키 두 개를 함께 누르면 비스듬히 걸어요
  if (await G(() => !window.__dokdo.battle && !window.__dokdo.busy)) {
    const g0 = await G(() => { const d = window.__dokdo; d.place(d.state.x, d.state.y, 'right'); return d.motion().view; });
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(260); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(120);
    const g1 = await G(() => ({ v: window.__dokdo.motion().view, x: window.__dokdo.state.x, battle: !!window.__dokdo.battle }));
    if (!g1.battle) { assert.ok(g1.v.x > g0.x + .4, `→ walks right in 2D (${g0.x} → ${g1.v.x})`); assert.equal(g1.x, Math.round(g1.v.x)); }
  }
}
// ── v0.64: 점프 — 스페이스로 폴짝 뛰고 제자리에 내려와요 ──
if (await G(() => !!window.__dokdo.battle)) await G(() => window.__dokdo.closeBattleForTest());
await G(() => window.__dokdo.closeModal()); for (let i = 0; i < 8 && await page.$('#dialogue:not(.hidden) #nextTalk'); i++) await page.click('#nextTalk');
if (await G(() => !window.__dokdo.busy)) {
  const j0 = await G(() => { document.activeElement?.blur?.(); const s = window.__dokdo.state; return [s.x, s.y]; });
  await page.keyboard.press(' '); await until(() => window.__dokdo.jumpZ > 8, 3000); await until(() => window.__dokdo.jumpZ === 0, 3000);
  if (await G(() => !window.__dokdo.battle)) assert.deepEqual(await G(() => { const s = window.__dokdo.state; return [s.x, s.y]; }), j0, 'a jump on the spot lands on the same tile');
  assert.ok(await page.$('#jumpBtn'), 'touch screens get a jump button');
}
assert.deepEqual(errors, [], 'no browser errors after the v0.60–0.64 checks');
await browser.close(); server.close();
console.log(`PASS: wild 우산몬 walk on routes (none in towns, bump to battle, gone afterwards), 문제 풀기 asks right away, type advantage, 형태변환 in the menu for legends, 동료 만들기 button, 동료 보관함 swap (4 along), 전설의 우산몬 quest (radio, golden spot, meeting scene, plain win keeps the spot, 10% 동료 만들기, join with 변환폼, dex photo), 백무 사장 reveal/fall/epilogue scenes, 사나워진 우산몬 duels with 검은 기운 gauges, 몽땅랜드 designs in battle, softened hits on correct defence, opening read line by line with the mission choice, starter + guide, key walking, closed bridge, guide, DQ commands (정화하기 with two starting skills, guard skill, item, orb, switch, run), my 우산몬 drawn from behind, 백무단 pictures fading out, explorer drawings in the character choice, 울릉도 도동항 and the ferry to 독도, buildings with floors (door, stairs, dex, books, review desk, rest), 김박사 picture and starter cutscene, 사철나무 purified from 백무 사장 and joining once, practice duel and walking tutorial, clickable picture map, easy words (사나워진 우산몬 · 검은 기운 · 몽땅랜드 컴퍼니), quiz rules (wrong attack = miss, correct defence = light hit), hints, KO recovery, route objects, trainer, memory stone, 8 chapters walked through 7 routes, first-arrival scenes, fast travel, legend, ending, saves and a v0.21 save; ${totalTurns} battle turns.`);
