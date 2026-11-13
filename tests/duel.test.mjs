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
console.log(`PASS: duel formats ${JSON.stringify(count)}, ○× picks, ${RECORDS.length} record lines fill from blank to whole.`);
