import assert from 'node:assert/strict';
import { QUESTIONS } from '../dist/learning.js';
import { quizFormat, oxShown, orderChoice, orderItems, directionAngle } from '../dist/battle-quiz.js';
import { RECORDS, pickRecord, recordCells } from '../dist/records.js';

// 문제 형식: 막기는 늘 ○×, 공격은 내용에 따라 나침반·순서 놓기·근거 카드·고르기
const count = {};
for (const q of QUESTIONS) {
  assert.equal(quizFormat(q, 'defense'), 'ox');
  const f = quizFormat(q); count[f] = (count[f] || 0) + 1;
  if (f === 'compass') assert.ok(q.options.every(o => directionAngle(o) !== null));
  if (f === 'order') { const items = orderItems(q.options[q.answer]); assert.ok(items.length >= 3 && new Set(items).size === items.length, `${q.id}: 낱말 카드가 서로 달라요`); assert.equal(orderChoice(q, items), q.answer); assert.notEqual(orderChoice(q, [...items].reverse()), q.answer); }
  if (f === 'cards') assert.ok(['S3', 'S4', 'N4'].includes(q.concept));
}
assert.ok(count.compass >= 2 && count.order >= 8 && count.cards >= 60 && count.choice >= 150, JSON.stringify(count));
// ○×: 보여 줄 답은 절반은 정답, 절반은 오답
const q = QUESTIONS[0]; assert.equal(oxShown(q, () => .1), q.answer); assert.notEqual(oxShown(q, () => .9), q.answer); assert.equal(oxShown(q, () => .9, true), (q.answer + 1) % 4);
// 지워진 기록: 장에 맞는 줄, 두루마리에 들어갈 길이, 채워지는 글자 수
for (const r of RECORDS) { assert.ok(r.zone >= 0 && r.zone < 8); assert.ok([...r.text].length <= 20, r.text); }
for (let z = 0; z < 8; z++) for (let i = 0; i < 20; i++) { const t = pickRecord(z, Math.random); assert.ok(RECORDS.find(r => r.text === t).zone <= z); }
assert.notEqual(pickRecord(0, () => 0, [pickRecord(0, () => 0)]), pickRecord(0, () => 0));
const text = RECORDS[0].text, letters = [...text].filter(c => c !== ' ').length;
assert.equal(recordCells(text, 0).filter(c => !c.space && c.shown).length, 0);
assert.equal(recordCells(text, 1).filter(c => !c.space && c.shown).length, letters);
const half = recordCells(text, .5).filter(c => !c.space && c.shown).length; assert.ok(half > 0 && half < letters);
assert.deepEqual(recordCells(text, .5), recordCells(text, .5), '같은 글은 늘 같은 차례로 채워져요');
assert.equal(recordCells(text, 1).map(c => c.char).join(''), text);
// v0.59 수준 맞추기: 잘 맞히는 학생에게는 어려운 문제가, 많이 틀리는 학생에게는 쉬운 문제가 더 자주 나와요
{
  const { rankBattleQuestions, difficulty } = await import('../dist/battle-quiz.js'); const { newState, captureChance, createMonster } = await import('../dist/engine.js');
  const levels = QUESTIONS.map(difficulty); assert.ok(levels.filter(l => l === 3).length >= 50 && levels.filter(l => l === 1).length >= 30);
  let seed = 7; const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const avg = right => { const s = newState(); s.zone = 5; s.answerLog = Array.from({ length: 10 }, (_, i) => ({ q: 'x' + i, concept: 'none', correct: right, assisted: false })); let t = 0; for (let i = 0; i < 300; i++) t += difficulty(rankBattleQuestions(s, rng)[0]); return t / 300; };
  const good = avg(true), weak = avg(false); assert.ok(good > weak + .4, `잘 맞히면 더 어려운 문제(${good.toFixed(2)} > ${weak.toFixed(2)})`); assert.ok(good > 2.4);
  // 전설의 우산몬: 10%에서 시작해 실패할 때마다 5%씩, 최대 60%
  const legend = createMonster(100); assert.equal(captureChance(legend), .1); assert.ok(Math.abs(captureChance(legend, 4) - .3) < 1e-9); assert.equal(captureChance(legend, 99), .6);
  // 리젠: 결투가 아무리 길어도, 끝나고 몇 초 뒤면 다시 10마리가 돼요
  const { createRoamers, ROAMER_COUNT } = await import('../dist/roamers.js'); const { createMap, npcs } = await import('../dist/world.js');
  const map = createMap('route0'), people = npcs(map, {}, {}), me = map.spawns.a, r = createRoamers(rng);
  r.sync(map, people, me, 1000); r.update(map, people, me, 1000, false); assert.equal(ROAMER_COUNT, 10); assert.equal(r.count, 10);
  r.update(map, people, me, 2000, true); r.remove(r.list[0].uid, 600000);                    // 10분짜리 결투가 끝남
  for (let t = 600000; t <= 607000; t += 100) r.update(map, people, me, t, false);
  assert.equal(r.count, 10, '결투가 끝나고 7초 안에 다시 나타나요');
}
console.log(`PASS: duel formats ${JSON.stringify(count)}, ○× picks, ${RECORDS.length} record lines fill from blank to whole.`);

// 특성(v0.60): 30가지, 우산몬마다 하나씩, 고르게 나뉘어요
{
  const { TRAITS, TRAIT_KINDS, traitOf, trait } = await import('../dist/traits.js');
  const { MONSTERS } = await import('../dist/data.js').catch(() => ({}));
  assert.equal(TRAITS.length, 30); assert.equal(new Set(TRAITS.map(t => t.id)).size, 30); assert.equal(new Set(TRAITS.map(t => t.name)).size, 30);
  for (const t of TRAITS) { assert.ok(t.name && t.text && TRAIT_KINDS[t.kind], `${t.id}: 이름·설명·갈래`); assert.ok(t.text.length <= 60, `${t.id}: 설명은 짧게`); assert.equal(trait(t.id), t); }
  const ids = MONSTERS ? MONSTERS.map(m => m.id) : Array.from({ length: 100 }, (_, i) => i + 1), per = {};
  for (const id of ids) { const t = traitOf(id); assert.ok(t); per[t.id] = (per[t.id] || 0) + 1; assert.equal(traitOf(`${id}-2`).id, t.id, '형태가 바뀌어도 특성은 같아요'); }
  assert.equal(Object.keys(per).length, 30, '모든 특성이 쓰여요'); assert.ok(Math.max(...Object.values(per)) - Math.min(...Object.values(per)) <= 2);
  console.log('PASS: 특성 30가지', JSON.stringify(per));
}
