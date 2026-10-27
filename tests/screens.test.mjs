// Screen-size check (Playwright): every screen of the game on phones, tablets and monitors.
//   node tests/screens.test.mjs            → checks; fails if a button or window is cut off
//   node tests/screens.test.mjs --shots    → also saves screenshots to screens/<device>/<screen>.png
// Sizes are the area a page really gets inside the browser (toolbars subtracted), portrait and landscape.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/dist/?test`;
const shots = process.argv.includes('--shots'), only = process.argv.find(a => a.startsWith('--only='))?.slice(7);

export const DEVICES = [
  // tablets (Safari / Chrome toolbars subtracted)
  { id: 'ipad-landscape', w: 1180, h: 740, touch: true, dpr: 2 },        // iPad 10th gen / Air
  { id: 'ipad-portrait', w: 820, h: 1100, touch: true, dpr: 2 },
  { id: 'ipad-mini-landscape', w: 1133, h: 664, touch: true, dpr: 2 },
  { id: 'ipad-mini-portrait', w: 744, h: 1053, touch: true, dpr: 2 },
  { id: 'ipad-pro-landscape', w: 1366, h: 944, touch: true, dpr: 2 },    // 12.9"
  { id: 'galaxy-tab-landscape', w: 1280, h: 720, touch: true, dpr: 2 },  // Tab S9 / S8
  { id: 'galaxy-tab-portrait', w: 800, h: 1200, touch: true, dpr: 2 },
  { id: 'galaxy-tab-a-landscape', w: 962, h: 520, touch: true, dpr: 2 }, // Tab A8 / A9+
  { id: 'galaxy-tab-a-portrait', w: 601, h: 880, touch: true, dpr: 2 },
  // phones
  { id: 'iphone-portrait', w: 390, h: 664, touch: true, mobile: true, dpr: 3 },
  { id: 'iphone-landscape', w: 844, h: 340, touch: true, mobile: true, dpr: 3 },
  { id: 'galaxy-portrait', w: 360, h: 700, touch: true, mobile: true, dpr: 3 },
  { id: 'galaxy-landscape', w: 780, h: 300, touch: true, mobile: true, dpr: 3 },
  // monitors
  { id: 'monitor-fhd', w: 1920, h: 955, dpr: 1 },
  { id: 'monitor-laptop', w: 1366, h: 657, dpr: 1 },
  { id: 'monitor-qhd', w: 2560, h: 1305, dpr: 1 }
];

// Is every button / window fully on screen? An element inside a scrolling box only has to be reachable by scrolling.
function cutOff(strict = '') {
  const out = [], vw = innerWidth, vh = innerHeight;
  const sel = 'button, .dq-window, .cs-box, .modal-panel, .dialogue, .question-title, [data-answer], .dq-answer, .cs-choice, .hud-top, .game-dock, .touch-controls .joystick, .touch-a, h2, h3, .cs-text';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || el.closest('[hidden], .hidden') || +cs.opacity === 0) continue;
    let box = { l: 0, t: 0, r: vw, b: vh }, scrolls = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (/(auto|scroll)/.test(ps.overflowY) && p.scrollHeight > p.clientHeight + 2 && !(strict && el.matches(strict))) { scrolls = true; break; }
      box = { l: Math.max(box.l, pr.left), t: Math.max(box.t, pr.top), r: Math.min(box.r, pr.right), b: Math.min(box.b, pr.bottom) };
    }
    if (scrolls) continue;
    const tol = 2, miss = Math.max(box.l - r.left, box.t - r.top, r.right - box.r, r.bottom - box.b);
    if (miss > tol) out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')} "${(el.textContent || '').trim().slice(0, 18)}" cut by ${Math.round(miss)}px`);
  }
  return out;
}

const report = [];
const browser = await chromium.launch();
async function runDevice(d) {
  const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.dpr, hasTouch: !!d.touch, isMobile: !!d.mobile });
  const page = await ctx.newPage(), G = fn => page.evaluate(fn), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const until = (fn, ms = 20000) => page.waitForFunction(fn, null, { timeout: ms, polling: 50 });
  const dir = path.join(root, 'screens', d.id); if (shots) fs.mkdirSync(dir, { recursive: true });
  const problems = []; let step = 'start';
  async function check(name, settle = 450, strict = '') {
    step = name;
    await page.waitForTimeout(settle);
    const bad = await page.evaluate(cutOff, strict); if (bad.length) problems.push(`${name}: ${bad.slice(0, 4).join(' | ')}`);
    if (shots) await page.screenshot({ path: path.join(dir, `${name}.png`) });
  }
  const tap = sel => page.locator(sel).first().click({ timeout: 8000 });
  try {
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(600);
  await check('01-title');
  await tap('#startBtn'); await check('02-avatar', 700);
  await tap('[data-avatar="girl"]'); await tap('#avatarConfirm');
  await until(() => window.__dokdo.cutscene() === 'opening');
  await check('03-cutscene', 900);
  await page.evaluate(() => window.__dokdo.cutscene()); await tap('.cs-skip');
  await until(() => window.__dokdo.cutscene() === 'starters'); await page.waitForTimeout(500);
  for (let i = 0; i < 5; i++) { await tap('.cs-box').catch(() => {}); await page.waitForTimeout(250); }
  await check('04-starter-scene', 1200);
  await tap('.cs-skip'); await page.waitForSelector('[data-start]'); await check('05-starter-choice', 600);
  await tap('[data-start="1"]'); await until(() => window.__dokdo.cutscene() === 'guide'); await tap('.cs-skip');
  // the practice duel: command menu, skills, quiz, result
  await until(() => !!window.__dokdo.battle, 20000);
  const state = () => G(() => document.querySelector('.dq-answer:not(.locked)') ? 'quiz' : document.querySelector('#dqCommand:not([hidden]) .dq-option') ? 'cmd' : 'msg');
  for (let i = 0; i < 30 && await state() !== 'cmd'; i++) { await tap('#dqMessage'); await page.waitForTimeout(80); }
  await check('06-battle-command');
  await tap('[data-cmd="purify"]'); await check('07-battle-skills', 300);
  await tap('#dqCommand [data-cmd="skill-0"]'); await until(() => !!document.querySelector('.dq-answer:not(.locked)')); await check('08-battle-quiz', 500, '.dq-answer'); // all four answers without scrolling
  const a = await G(() => window.__dokdo.battle.quiz.q.answer); await tap(`[data-battle-answer="${(a + 1) % 4}"]`);
  await until(() => !!document.querySelector('.dq-result')); await page.waitForTimeout(2200); await check('09-battle-result', 0);
  await G(() => document.querySelector('.dq-coach-skip')?.click()); await until(() => !window.__dokdo.battle);
  for (let i = 0; i < 10 && await page.$('#dialogue:not(.hidden) #nextTalk'); i++) await tap('#nextTalk');
  // a longer quiz: the question with the longest choices
  await G(() => window.__dokdo.startBattle('wild', 39)); await until(() => !!window.__dokdo.battle);
  for (let i = 0; i < 30 && await state() !== 'cmd'; i++) { await tap('#dqMessage'); await page.waitForTimeout(80); }
  await G(() => { const longest = window.__dokdo.longestQuestion; if (longest) window.__dokdo.forceQuestion = longest; });
  await tap('[data-cmd="purify"]'); await tap('#dqCommand [data-cmd="skill-0"]'); await until(() => !!document.querySelector('.dq-answer:not(.locked)'));
  await tap('#battleHint'); await check('10-battle-quiz-hint', 500);
  const b2 = await G(() => window.__dokdo.battle.quiz.q.answer); await tap(`[data-battle-answer="${b2}"]`);
  await until(() => !!document.querySelector('.dq-result')); await page.waitForTimeout(3500); await check('11-battle-result-long', 0);
  await G(() => { window.__dokdo.forceQuestion = null; window.__dokdo.closeBattleForTest?.(); });
  await until(() => !window.__dokdo.battle);
  for (let i = 0; i < 10 && await page.$('#dialogue:not(.hidden) #nextTalk'); i++) await tap('#nextTalk');
  // walking screen, a conversation, the study quiz, the map, the dex
  await check('12-world', 500);
  // touch screens: hold the joystick to the right and the explorer walks right
  if (d.touch) {
    const box = await page.locator('#joystick').boundingBox(); if (!box) throw new Error('no joystick on a touch screen');
    const x0 = await G(() => window.__dokdo.state.x), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + box.width * .4, cy, { steps: 4 });
    await page.waitForTimeout(900); await page.mouse.up();
    const after = await G(() => ({ x: window.__dokdo.state.x, dir: window.__dokdo.state.dir }));
    if (!(after.dir === 'right' && after.x >= x0)) problems.push(`joystick: expected to face/walk right, got ${JSON.stringify(after)} from x=${x0}`);
    await page.waitForTimeout(400);
  }
  await G(() => { const d = window.__dokdo, n = d.npcs().find(n => n.id === 'history' || n.kind === 'history') || d.npcs().find(n => n.lines); d.interact(n); });
  await check('13-dialogue', 900);
  for (let i = 0; i < 10 && await page.$('#dialogue:not(.hidden) #nextTalk'); i++) await tap('#nextTalk');
  await G(() => { const d = window.__dokdo, n = d.npcs().find(n => n.id === 'board'); d.interact(n); });
  for (let i = 0; i < 10 && !(await page.$('[data-answer]')) && await page.$('#dialogue:not(.hidden) #nextTalk'); i++) await tap('#nextTalk');
  await page.waitForSelector('[data-answer]', { timeout: 5000 }).catch(() => {}); await check('14-study', 500);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); await G(() => window.__dokdo.closeModal());
  await tap('#mapBtn'); await check('15-world-map', 600); await G(() => window.__dokdo.closeModal());
  await tap('#dexBtn'); await check('16-dex', 600); await G(() => window.__dokdo.closeModal());
  // inside a building: the room sits in the middle of the screen with its labels
  await G(() => window.__dokdo.goInside('lab')); await until(() => window.__dokdo.map.id === 'town0/lab/1' && !window.__dokdo.transition);
  await check('18-inside', 2900);
  const roomFit = await G(() => { const c = document.querySelector('#world').getBoundingClientRect(), f = window.__dokdo.map.focus; return { w: f.w * 32, h: f.h * 32, cw: c.width, ch: c.height }; });
  void roomFit;
  for (let i = 0; i < 6 && await G(() => window.__dokdo.map.kind === 'room'); i++) { const id = await G(() => window.__dokdo.map.id); await G(() => window.__dokdo.guide()); await page.waitForFunction(id => window.__dokdo.map.id !== id && !window.__dokdo.transition, id, { timeout: 20000 }); }
  await G(() => { window.__dokdo.playStory(window.__dokdo.stories.BOSS_REVEAL); }); await until(() => window.__dokdo.cutscene() === 'boss-reveal');
  for (let i = 0; i < 24; i++) { if (await page.$('.cs-choice')) break; await tap('.cs-box').catch(() => {}); await page.waitForTimeout(120); }
  await page.waitForSelector('.cs-choice', { timeout: 15000 }).catch(() => {}); await check('17-cutscene-choice', 600);
  await tap('.cs-skip');
  } catch (err) { problems.push(`stuck after ${step}: ${err.message.split('\n')[0]}`); if (shots) await page.screenshot({ path: path.join(dir, `zz-stuck.png`) }).catch(() => {}); }
  if (errors.length) problems.push('page errors: ' + errors.join(' | '));
  report.push([d.id, problems]); console.log(`${problems.length ? '✗' : '✓'} ${d.id} ${d.w}×${d.h}${problems.length ? '\n   ' + problems.join('\n   ') : ''}`);
  await ctx.close();
}
const queue = DEVICES.filter(d => !only || d.id.includes(only));
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await runDevice(queue.shift()); }));
await browser.close(); server.close();
const failed = report.filter(([, p]) => p.length);
assert.equal(failed.length, 0, `cut-off screens on ${failed.map(([id]) => id).join(', ')}`);
console.log(`PASS: ${report.length} screen sizes, 18 screens each — nothing cut off.`);
