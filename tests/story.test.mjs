// Cutscene scripts and Korean particles.
import assert from 'node:assert/strict';
import { OPENING, GUIDE, LEGEND, ARRIVALS, arrivalScene } from '../dist/story.js';
import { josa, fillJosa } from '../dist/text.js';
import { MAPS } from '../dist/maps.js';
import { ZONES } from '../dist/data.js';

const BGS = new Set(['stage', 'sea', 'dock', 'field', 'crisis', 'title']);
const CUES = /^(confetti|spot|jump|glint|rustle|pop|surprise|aura|device|kim-turn|night|rise|panel:(sea|rock|grass))$/;
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
    }
    for (const l of s.lines) if (l.choice) { assert.ok(l.choice.length >= 2); l.choice.forEach(c => assert.ok(c.label && c.reply?.length)); }
  }
}
[OPENING, GUIDE, LEGEND].forEach(check);
// The opening follows the specification: contest → ship → dock → 독도몬 → crisis → mission with a choice.
assert.deepEqual(OPENING.scenes.map(s => s.bg), ['stage', 'sea', 'dock', 'field', 'crisis', 'dock']);
assert.ok(OPENING.scenes.at(-1).lines.some(l => l.choice?.length === 2));
assert.ok(OPENING.scenes.flatMap(s => s.lines).some(l => l.who === '김박사'));
assert.ok(GUIDE.scenes[0].lines.at(-1).text.includes('단서'));
for (const t of MAPS.filter(m => m.kind === 'town' && m.zone > 0)) { check(arrivalScene(t.zone, ZONES[t.zone], t)); assert.ok(ARRIVALS[t.zone]); }

for (const [w, a, b, c] of [['해국', '해국이', '해국을', '해국과'], ['괭이갈매기', '괭이갈매기가', '괭이갈매기를', '괭이갈매기와'], ['돌돔', '돌돔이', '돌돔을', '돌돔과'], ['독도새우', '독도새우가', '독도새우를', '독도새우와']]) {
  assert.equal(josa(w, '이/가'), a); assert.equal(josa(w, '을/를'), b); assert.equal(josa(w, '과/와'), c);
}
assert.equal(josa('물골', '으로/로'), '물골로'); assert.equal(josa('우산봉', '으로/로'), '우산봉으로'); assert.equal(josa('대한봉', '으로/로'), '대한봉으로');
assert.equal(fillJosa('{s}와(과) 함께, {s}을(를) 골랐다', { s: '해국' }), '해국과 함께, 해국을 골랐다');
assert.equal(fillJosa('{s}와(과) 함께', { s: '독도새우' }), '독도새우와 함께');
console.log('PASS: opening/guide/legend/arrival scripts are well-formed and follow the spec; Korean particles follow the last syllable.');
