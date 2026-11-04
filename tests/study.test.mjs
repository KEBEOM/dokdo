// 독도 공부 수첩: 모든 배움 개념을 다루고, 쪽마다 근거 자료가 있는지 확인해요.
import assert from 'node:assert/strict';
import test from 'node:test';
import { STUDY_PAGES } from '../dist/study.js';
import { CONCEPTS, QUESTIONS, SOURCES } from '../dist/learning.js';

test('every page is well formed, with sources and questions to check yourself', () => {
  assert.equal(new Set(STUDY_PAGES.map(p => p.id)).size, STUDY_PAGES.length, 'unique ids');
  for (const p of STUDY_PAGES) {
    assert.ok(p.title && p.icon && p.points.length >= 2, p.id);
    assert.ok(p.sources.length >= 1, `${p.id} names its sources`);
    for (const r of p.sources) { const s = typeof r === 'string' ? SOURCES.find(x => x.url === r) : typeof r === 'number' ? SOURCES[r] : r; assert.ok(s?.license, `${p.id}: 이용 조건이 밝혀진 자료`); assert.ok(s?.title && /^https:\/\//.test(s.url), `${p.id} source ${JSON.stringify(r)}`); }
    for (const c of p.concepts) { assert.ok(CONCEPTS.some(x => x.id === c), `${p.id}: ${c}`); assert.ok(QUESTIONS.some(q => q.concept === c), `${p.id}: questions for ${c}`); }
    for (const [y, t] of p.timeline || []) assert.ok(y && t);
  }
});
test('together the pages cover all twelve learning concepts', () => {
  const covered = new Set(STUDY_PAGES.flatMap(p => p.concepts));
  for (const c of CONCEPTS) assert.ok(covered.has(c.id), `${c.id} ${c.title}`);
});
console.log(`PASS: ${STUDY_PAGES.length} 독도 공부 pages cover all ${CONCEPTS.length} concepts, each with sources and self-check questions.`);
