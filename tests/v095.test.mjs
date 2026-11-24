// v0.95 독도 지식 사전: 생물 사전 100종 · 문제 308개의 오답 설명 · 독도 지명 26곳의 뜻 — 모두 게임 안 글로(바깥 링크 없음)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const read = f => readFileSync(new URL(f, dist), 'utf8');
const game = read('game.js'), kbText = read('knowledge.js');
const { SPECIES, WRONG, PLACES, KB_SOURCES, wrongNote } = await import('../dist/knowledge.js');
const { QUESTIONS } = await import('../dist/learning.js');
const { MONSTERS } = await import('../dist/data.js');

// 1) 생물 사전: 우산몬 100종 모두, 필수 칸이 차 있어요
assert.equal(Object.keys(SPECIES).length, 100);
for (const m of MONSTERS) {
  const k = SPECIES[m.id]; assert.ok(k, `#${m.id} 사전 항목`);
  for (const f of ['group', 'look', 'home', 'dokdo']) assert.ok(k[f] && k[f].length >= 2, `#${m.id} ${f}`);
  if (k.sci) assert.ok(/^[A-Z][a-z]+ [a-z]/.test(k.sci), `#${m.id} 학명 모양 ${k.sci}`);
  assert.ok(k.nibr || k.check, `#${m.id} 목록집에 없으면 확인할 점을 적어요`);
}
assert.equal(SPECIES[100].sci, 'Zalophus japonicus'); assert.match(SPECIES[100].protect, /절멸/);
assert.match(SPECIES[71].protect, /Ⅰ급/); assert.ok(SPECIES[66].check, '독도새우는 여러 종의 이름');

// 2) 오답 설명: 문제마다 틀린 보기 셋 모두, 정답에는 없음
for (const q of QUESTIONS) {
  const w = WRONG[q.id]; assert.ok(w, `${q.id} 오답 설명`);
  const want = q.options.map((_, i) => i).filter(i => i !== q.answer).map(String).sort();
  assert.deepEqual(Object.keys(w).sort(), want, `${q.id} 틀린 보기마다 하나씩`);
  assert.equal(wrongNote(q, q.answer), ''); assert.equal(wrongNote(q, null), '');
  assert.ok(wrongNote(q, Number(want[0])).length > 5);
}

// 3) 지명: 지도에 쓴 지명 26곳 모두 뜻이 있어요
const names = [...game.match(/const DOKDO_NAMES = \[([\s\S]*?)\];/)[1].matchAll(/\['([^']+)'/g)].map(m => m[1]);
assert.equal(names.length, 26); for (const n of names) assert.ok(PLACES[n]?.origin, `${n} 뜻`);

// 4) 게임에 이어 붙였어요: 결투·문제 해설에 오답 설명, 도감에 생물 사전, 수첩에 지식 사전, 세계 지도 지명 누르기
assert.ok(/function explanationHTML\(q, choice = null\) \{ return `\$\{wrongHTML\(q, choice\)\}/.test(game));
assert.ok(!/explanationHTML\(r\.q\)/.test(game) && /explanationHTML\(r\.q, r\.choice\)/.test(game));
assert.ok(/return \{ q, correct, choice: said \};/.test(game) && /format === 'ox' \? \(res\.choice === shown/.test(game), '빠른 판단은 보여 준 답을 ‘맞아’라고 했을 때만');
assert.ok(/\$\{correct \? '' : wrongHTML\(q, answer\)\}/.test(game), '조사 문제 풀이에도');
assert.ok(/\$\{speciesHTML\(m\)\}/.test(game) && /function showDictionary\(/.test(game) && /\['dict', '지식 사전'\]/.test(game));
assert.ok(/data-wmplace=/.test(game) && /showDictionary\('place', n\)/.test(game));
assert.ok(KB_SOURCES.length >= 6 && KB_SOURCES.every(s => s.length === 3));

// 5) 바깥 링크 없음: 화면에 그리는 파일에 <a href=…>도, 지식 사전에 주소도 없어요
assert.ok(!/https?:\/\//.test(kbText), '지식 사전에 주소 없음');
for (const f of readdirSync(dist).filter(f => f.endsWith('.js') || f.endsWith('.html')))
  assert.ok(!/<a [^>]*href=["']https?:/i.test(read(f)), `${f}: 바깥 링크 없음`);
assert.ok(/const sourceCite = url => SOURCES\.find\(s => s\.url === url\)\?\.cite/.test(game), '출처는 기관·자료 이름 글로');

// 6) 목록집에 실린 종은 기록 확인 상태가 올라갔어요
const up = MONSTERS.filter(m => m.recordStatus === '국가 생물종 목록에 독도 기록');
assert.ok(up.length >= 60, `올라간 종 ${up.length}`); assert.ok(up.every(m => SPECIES[m.id].nibr));
console.log(`PASS v0.95 지식 사전 · 생물 ${Object.keys(SPECIES).length} · 오답 설명 ${QUESTIONS.length}문제 · 지명 ${names.length}`);
