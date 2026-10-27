// Cutscene scripts and Korean particles.
import assert from 'node:assert/strict';
import { OPENING, STARTER_MEET, GUIDE, LEGEND, ARRIVALS, arrivalScene, BOSS_REVEAL, BOSS_FALL, TREE_JOINS, EPILOGUE, VILLAIN_TALES, FERRY, FERRY_AGAIN } from '../dist/story.js';
import { josa, fillJosa } from '../dist/text.js';
import { MAPS } from '../dist/maps.js';
import { ZONES, STARTERS } from '../dist/data.js';

const BGS = new Set(['stage', 'sea', 'dock', 'field', 'crisis', 'title', 'summit', 'camp']);
const CUES = /^(confetti|spot|jump|glint|rustle|pop|surprise|aura|device|kim-turn|night|rise|machine|machine-off|machine-quiet|blueprint|dark|records|glow|picture:professor|picture-off|(show|hop|come|calm):[a-z0-9]+|panel:(sea|rock|grass))$/;
function check(script) {
  assert.ok(script.id && script.scenes.length);
  for (const s of script.scenes) {
    assert.ok(BGS.has(s.bg), `${script.id}: unknown background ${s.bg}`);
    for (const c of s.cast || []) assert.match(c.who, /^(player|actor:[a-z-]+|monster:(\d+|\{starterId\}))$/);
    for (const c of s.start || []) assert.match(c, CUES);
    const lines = s.lines.flatMap(l => [l, ...(l.choice || []).flatMap(c => c.reply || [])]);
    for (const l of lines) {
      assert.ok(typeof l.text === 'string' && l.text.length > 0 && l.text.length <= 70, `${script.id}: short, readable line (${l.text})`);
      if (l.cue) assert.match(l.cue, CUES);
      const target = /^(show|hop|come|calm):(.+)$/.exec(l.cue || '');
      if (target) { const c = (s.cast || []).find(c => c.id === target[2]); assert.ok(c, `${script.id}: ${l.cue} names someone in the scene`); if (target[1] === 'come') assert.ok(c.comeTo); }
    }
    for (const l of s.lines) if (l.choice) { assert.ok(l.choice.length >= 2); l.choice.forEach(c => assert.ok(c.label && c.reply?.length)); }
  }
}
[OPENING, STARTER_MEET, GUIDE, LEGEND, BOSS_REVEAL, BOSS_FALL, TREE_JOINS, EPILOGUE, FERRY, FERRY_AGAIN('dokdo'), FERRY_AGAIN('ulleung')].forEach(check);
// v0.36: the journey starts on 울릉도 (도동항) and the ferry crosses about 87km to 독도
assert.ok(OPENING.scenes.some(s => s.island === 'ulleung' && /도동항/.test(s.caption)), 'Kim meets you at 울릉도 도동항');
assert.ok(FERRY.scenes[0].lines.some(l => /87/.test(l.text)) && FERRY.scenes[0].lines.some(l => /동도 선착장/.test(l.text)));
// v0.33: 김박사's picture at the first meeting, the three starters in their own scene, 사철나무 with 백무 사장
assert.ok(OPENING.scenes.some(s => s.lines.some(l => l.cue === 'picture:professor') && s.lines.some(l => l.cue === 'picture-off')), 'the 김박사 picture comes and goes');
assert.deepEqual(STARTER_MEET.scenes[0].cast.filter(c => c.who.startsWith('monster:')).map(c => Number(c.who.slice(8))), STARTERS, 'all three starters are introduced');
assert.ok(STARTER_MEET.scenes[0].cast.filter(c => c.hidden).every(c => STARTER_MEET.scenes[0].lines.some(l => l.cue === `show:${c.id}`)), 'every starter is shown');
assert.match(fillJosa(GUIDE.scenes[0].lines[0].text, { starter: '해국' }), /해국과 함께라면/);
assert.ok(BOSS_REVEAL.scenes[0].cast.some(c => c.who === 'monster:18' && c.aura), '사철나무 stands with 백무 사장');
assert.ok(TREE_JOINS.scenes[0].lines.some(l => l.cue === 'calm:tree'));
// The 백무단 story: clues in chapters 1–7, then the truth, the excuse and the answer on 대한봉.
assert.equal(VILLAIN_TALES.length, 8); VILLAIN_TALES.slice(0, 7).forEach(v => assert.ok(v.before.length && v.after.length)); assert.equal(VILLAIN_TALES[7], null);
const reveal = BOSS_REVEAL.scenes.flatMap(s => s.lines).map(l => l.text).join(' ');
for (const key of ['독도몬을 만들어', '테마파크', '검은 기운', '독도를 위해', '천연기념물 제336호']) assert.ok(reveal.includes(key), `reveal mentions ${key}`);
assert.ok(BOSS_REVEAL.scenes[0].lines.some(l => l.choice?.length === 2));
assert.ok(OPENING.scenes.flatMap(s => s.lines).some(l => l.text.includes('아직 아무도 몰라요')), 'the cause of 광포화 is unknown at first');
// The opening follows the specification: contest → ship → dock → 독도몬 → crisis → mission with a choice.
assert.deepEqual(OPENING.scenes.map(s => s.bg), ['stage', 'sea', 'dock', 'field', 'crisis', 'dock']);
assert.ok(OPENING.scenes.at(-1).lines.some(l => l.choice?.length === 2));
assert.ok(OPENING.scenes.flatMap(s => s.lines).some(l => l.who === '김박사'));
assert.ok(GUIDE.scenes.at(-1).lines.at(-1).text.includes('단서'));
for (const t of MAPS.filter(m => m.kind === 'town' && m.zone > 0)) { check(arrivalScene(t.zone, ZONES[t.zone], t)); assert.ok(ARRIVALS[t.zone]); }

for (const [w, a, b, c] of [['해국', '해국이', '해국을', '해국과'], ['괭이갈매기', '괭이갈매기가', '괭이갈매기를', '괭이갈매기와'], ['돌돔', '돌돔이', '돌돔을', '돌돔과'], ['독도새우', '독도새우가', '독도새우를', '독도새우와']]) {
  assert.equal(josa(w, '이/가'), a); assert.equal(josa(w, '을/를'), b); assert.equal(josa(w, '과/와'), c);
}
assert.equal(josa('물골', '으로/로'), '물골로'); assert.equal(josa('우산봉', '으로/로'), '우산봉으로'); assert.equal(josa('대한봉', '으로/로'), '대한봉으로');
assert.equal(fillJosa('{s}와(과) 함께, {s}을(를) 골랐다', { s: '해국' }), '해국과 함께, 해국을 골랐다');
assert.equal(fillJosa('{s}와(과) 함께', { s: '독도새우' }), '독도새우와 함께');
console.log('PASS: opening/guide/legend/arrival scripts are well-formed and follow the spec; Korean particles follow the last syllable.');

// Easy words for grades 5–6: no 광포화 / 암흑 에너지 / 백무단 left in what players read.
for (const script of [OPENING, GUIDE, LEGEND, BOSS_REVEAL, BOSS_FALL, EPILOGUE]) for (const l of script.scenes.flatMap(s => s.lines.flatMap(l => [l, ...(l.choice || []).flatMap(c => c.reply || [])]))) assert.ok(!/광포화|암흑 에너지|백무단|공백 장치/.test(l.text + (l.who || '')), `easy words: ${l.text}`);
for (const v of VILLAIN_TALES.filter(Boolean)) for (const t of [...v.before, ...v.after]) assert.ok(!/광포화|암흑 에너지|백무단/.test(t), t);
assert.ok(OPENING.scenes.flatMap(s => s.lines).some(l => l.text.includes('몽땅랜드 컴퍼니')), 'the company is named in the opening');
