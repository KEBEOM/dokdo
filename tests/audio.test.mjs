import assert from 'node:assert/strict';
import { TRACKS, JINGLES, compileTrack, parseNotes, chordNotes, midi } from '../dist/music-data.js';
import { music, sfx, jingle, SFX, isOn } from '../dist/audio.js';

// 악보 검사: 마디마다 칸수가 맞고, 화음 수 = 마디 수, 반주·장구 무늬 길이 = 한 마디
const INSTS = new Set(['flute', 'gayageum', 'piri', 'pulse', 'bass', 'pad']);
for (const [id, t] of Object.entries(TRACKS)) {
  const { bars } = parseNotes(t.lead.notes);
  assert.ok(bars.every(b => b === t.bar), `${id}: 마디 칸수 ${bars.join(',')} ≠ ${t.bar}`);
  assert.equal(bars.length, t.chords.length, `${id}: 화음 수와 마디 수`);
  for (const k of ['bass', 'pluck', 'pad']) if (t[k]) { assert.equal(t[k].pattern.length, t.bar, `${id}.${k} 무늬 길이`); if (t[k].inst) assert.ok(INSTS.has(t[k].inst)); }
  for (const k of ['drums', 'fills']) if (t[k]) { assert.equal(t[k].length, t.bar, `${id}.${k} 길이`); assert.match(t[k], /^[DKTRh.]+$/); }
  assert.ok(INSTS.has(t.lead.inst), `${id}: 악기 ${t.lead.inst}`);
  t.chords.forEach(c => chordNotes(c));
  const c = compileTrack(t), secs = c.length / c.speed;
  assert.ok(secs >= 11 && secs <= 60, `${id}: 한 바퀴 ${secs.toFixed(1)}초`);
  for (const p of c.parts) for (const e of p.events) { if (e.note != null) assert.ok(e.note >= midi('A1') && e.note <= midi('E7'), `${id}: 너무 높거나 낮은 음 ${e.note}`); assert.ok(e.at >= 0 && e.at < c.length); }
  assert.ok(t.name, `${id}: 곡 이름`);
}
for (const [id, j] of Object.entries(JINGLES)) { const c = compileTrack(j), secs = c.length / c.speed; assert.ok(secs > .3 && secs <= 5, `${id} 알림 노래 ${secs}초`); }
assert.throws(() => parseNotes('H5:2'));
assert.equal(midi('A4'), 69); assert.deepEqual(chordNotes('Em'), { root: 4, third: 7, fifth: 11 });
// 게임에서 쓰는 곡 이름이 모두 있어요
for (const id of ['title', 'town', 'meadow', 'dokdo', 'route', 'room', 'battle', 'villain', 'boss', 'legend']) assert.ok(TRACKS[id], id);
for (const id of ['victory', 'levelup', 'join', 'item', 'heal', 'stamp', 'legend', 'start']) assert.ok(JINGLES[id], id);
for (const n of ['blip', 'tap', 'select', 'talk', 'next', 'door', 'stairs', 'bump', 'encounter', 'correct', 'wrong', 'hit', 'hitStrong', 'hitWeak', 'hurt', 'faint', 'purify', 'morph', 'run', 'xp', 'save', 'toggle', 'stampThud']) assert.ok(SFX[n], n);
// 브라우저가 아니어도(소리 장치 없음) 조용히 넘어가요
music('battle'); sfx('hit'); jingle('victory'); assert.equal(typeof isOn(), 'boolean');
console.log(`PASS: ${Object.keys(TRACKS).length} music loops (bars, chords, patterns, range), ${Object.keys(JINGLES).length} jingles, ${Object.keys(SFX).length} sound effects; silent without an audio device.`);
