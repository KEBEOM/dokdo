// ─────────────────────────────────────────────────────────────────────────────
// 배경음악 악보 (v0.55) — 모두 이 게임을 위해 새로 지은 곡이에요(외부 음원·샘플 없음, 저작권 걱정 없음).
// 소리는 audio.js가 브라우저의 Web Audio로 그 자리에서 만들어요(파일이 없어서 오프라인 판도 가벼워요).
//
// 우리 음악 느낌: 5음 음계(평조 = 솔라도레미, 계면조 = 라도레미솔)와 장단을 썼어요.
//   세마치(한 마디 9칸: 3박 × 3) · 굿거리/자진모리(12칸: 4박 × 3) · 휘모리(16칸: 빠른 4박)
//   악기: flute(대금 느낌: 부드러운 시작과 떨림) · gayageum(가야금 느낌: 뜯는 소리) · piri(피리 느낌: 또렷한 소리)
//         pulse(옛날 게임기 소리) · bass(낮은 소리) · pad(길게 깔리는 화음)
//   장구·북: D 덩(쿵+덕) · K 쿵 · T 덕 · R 더러러 · h 작은 찰 소리 · . 쉼
//
// 고치는 법
//   lead.notes  '음이름:칸수'를 띄어 쓰고, 마디마다 | 로 나눠요. r 은 쉼표. 예) 'D5:3 E5:2 r:1 | ...'
//               한 마디의 칸수 합은 bar와 같아야 해요(tests/audio.test.mjs가 검사해요).
//   chords      마디마다 화음 하나(예: 'G', 'Em', 'F#m', 'Bb'). 반주는 이 화음으로 만들어요.
//   bass/pluck/pad  한 마디 길이의 무늬: R 으뜸음 · 3 셋째음 · 5 다섯째음 · 8 한 옥타브 위 으뜸음 · P 화음 전체(pad) · . 쉼
//   drums       한 마디 길이의 장구 무늬(마디마다 같은 무늬를 되풀이), fills: 마지막 마디에만 쓰는 무늬
//   speed       1초에 몇 칸 지나가는지 · vol 곡 전체 크기(0~1)
// ─────────────────────────────────────────────────────────────────────────────

export const TRACKS = {
  // 타이틀 — 굿거리 12칸, 평조(D). 씩씩하게 떠나는 노래
  title: {
    name: '독도 탐험대', bar: 12, speed: 4.4, vol: .9,
    chords: ['D', 'D', 'Bm', 'A', 'Bm', 'A', 'G', 'D', 'G', 'D', 'Em', 'A', 'Bm', 'G', 'A', 'D'],
    lead: { inst: 'flute', notes: 'D5:3 A4:3 D5:3 E5:3 | F#5:6 E5:3 D5:3 | E5:3 F#5:3 A5:3 B5:3 | A5:9 r:3 | B5:3 A5:3 F#5:3 A5:3 | E5:6 D5:3 E5:3 | F#5:3 E5:2 D5:1 B4:3 E5:3 | D5:9 r:3 | B4:3 D5:3 E5:3 G5:3 | F#5:6 A5:3 F#5:3 | E5:3 G5:2 E5:1 D5:3 B4:3 | A4:6 B4:3 D5:3 | F#5:3 A5:3 B5:3 D6:3 | B5:6 A5:3 F#5:3 | E5:3 F#5:2 E5:1 D5:3 E5:3 | D5:9 r:3' },
    bass: { pattern: 'R.....5.....', oct: 2 },
    pluck: { pattern: '..5..8..5..3', oct: 4 },
    drums: 'D..T.TK..T..', fills: 'D..T.TK.TRTT'
  },
  // 울릉도 도동항 — 세마치 9칸, 평조(G). 항구 마을의 포근한 노래
  town: {
    name: '도동항의 아침', bar: 9, speed: 4.5, vol: .85,
    chords: ['G', 'D', 'C', 'G', 'G', 'C', 'D', 'G', 'Em', 'C', 'C', 'D', 'C', 'Em', 'D', 'G'],
    lead: { inst: 'flute', notes: 'D5:3 E5:2 D5:1 B4:3 | A4:3 B4:3 D5:3 | E5:3 G5:2 E5:1 D5:3 | B4:6 r:3 | D5:3 E5:2 G5:1 A5:3 | G5:3 E5:2 D5:1 E5:3 | D5:2 B4:1 A4:3 B4:3 | G4:6 r:3 | B4:3 D5:3 E5:3 | G5:5 A5:1 G5:3 | E5:3 D5:2 E5:1 G5:3 | D5:6 r:3 | E5:3 D5:2 B4:1 A4:3 | B4:3 D5:2 B4:1 A4:3 | G4:2 A4:1 B4:3 A4:3 | G4:6 r:3' },
    bass: { pattern: 'R..5..R..', oct: 2 },
    pluck: { pattern: '.35.58.35', oct: 4 },
    drums: 'D..D.TKT.', fills: 'D..D.TRTT'
  },
  // 나리분지 초원 — 느린 세마치, 평조(F). 우산몬들이 쉬는 들판
  meadow: {
    name: '나리분지의 바람', bar: 9, speed: 3, vol: .8,
    chords: ['F', 'Bb', 'F', 'F', 'Dm', 'Gm', 'Dm', 'C'],
    lead: { inst: 'flute', notes: 'C5:6 D5:3 | F5:6 D5:3 | C5:3 A4:3 G4:3 | F4:9 | A4:3 C5:3 D5:3 | F5:3 G5:3 F5:3 | D5:6 C5:3 | C5:9' },
    bass: { pattern: 'R........', oct: 2 },
    pluck: { pattern: 'R.5.8.3.5', oct: 4 },
    drums: 'K........'
  },
  // 동도·서도 마을 — 자진모리 느낌 12칸, 계면조(E). 바다 위 바위섬의 넓은 노래
  dokdo: {
    name: '동해의 두 섬', bar: 12, speed: 3.6, vol: .85,
    chords: ['Em', 'Em', 'Am', 'Em', 'G', 'Em', 'Am', 'Em'],
    lead: { inst: 'flute', notes: 'E5:6 G5:3 A5:3 | B5:6 A5:3 G5:3 | A5:3 G5:3 E5:3 D5:3 | E5:12 | G5:3 A5:3 B5:3 D6:3 | E6:6 D6:3 B5:3 | A5:3 B5:2 A5:1 G5:3 E5:3 | E5:9 r:3' },
    bass: { pattern: 'R.....5.....', oct: 2 },
    pluck: { pattern: 'R..5..8..5..', oct: 4 },
    pad: { pattern: 'P...........', oct: 3 },
    drums: 'D.....K..T..', fills: 'D.....K.TRTT'
  },
  // 길(바닷길·숲길) — 자진모리 12칸, 평조(D). 신나게 걷는 노래
  route: {
    name: '바위길 탐험', bar: 12, speed: 6, vol: .85,
    chords: ['D', 'D', 'G', 'A', 'D', 'Bm', 'G', 'D', 'G', 'D', 'Bm', 'A', 'G', 'A', 'Bm', 'D'],
    lead: { inst: 'piri', notes: 'A4:3 D5:2 E5:1 F#5:3 A5:3 | B5:2 A5:1 F#5:3 E5:3 D5:3 | E5:3 F#5:2 A5:1 B5:3 A5:3 | F#5:6 E5:3 r:3 | D5:2 E5:1 F#5:3 A5:2 B5:1 D6:3 | B5:2 A5:1 F#5:2 E5:1 D5:3 E5:3 | F#5:3 E5:2 D5:1 B4:3 A4:3 | D5:9 r:3 | B5:3 A5:2 B5:1 D6:3 B5:3 | A5:6 F#5:3 A5:3 | F#5:3 E5:2 F#5:1 A5:3 F#5:3 | E5:9 r:3 | B4:3 D5:3 E5:3 F#5:3 | A5:3 B5:2 A5:1 F#5:3 E5:3 | D5:2 E5:1 F#5:3 E5:2 D5:1 B4:3 | D5:9 r:3' },
    bass: { pattern: 'R..5..R..5..', oct: 2 },
    pluck: { pattern: '.35.35.35.35', oct: 4 },
    drums: 'D..T..K.TT..', fills: 'D..T..K.TRTT'
  },
  // 밤 마을·초원 (v0.69) — 느린 세마치 9칸, 계면조(A). 별을 세며 쉬는 밤
  night: {
    name: '별 헤는 밤', bar: 9, speed: 2.6, vol: .7,
    chords: ['Am', 'Am', 'Dm', 'Am', 'C', 'G', 'Am', 'Am'],
    lead: { inst: 'gayageum', notes: 'E5:3 A5:3 C6:3 | B5:6 A5:3 | G5:3 E5:3 D5:3 | E5:9 | C5:3 D5:3 E5:3 | G5:6 E5:3 | D5:3 C5:3 A4:3 | A4:9' },
    bass: { pattern: 'R........', oct: 2 },
    pluck: { pattern: '....5....', oct: 4 },
    pad: { pattern: 'P........', oct: 3 }
  },
  // 밤 바닷길·독도 (v0.69) — 느린 12칸, 계면조(E). 달빛이 내려앉은 밤바다
  nightsea: {
    name: '달빛 밤바다', bar: 12, speed: 2.8, vol: .72,
    chords: ['Em', 'C', 'D', 'Em', 'Am', 'Em', 'D', 'Em'],
    lead: { inst: 'flute', vib: 1.6, notes: 'B4:6 E5:6 | G5:6 E5:3 D5:3 | A5:9 G5:3 | E5:12 | D5:3 E5:3 G5:6 | A5:6 B5:3 A5:3 | G5:3 E5:3 D5:6 | E5:12' },
    bass: { pattern: 'R...........', oct: 2 },
    pad: { pattern: 'P...........', oct: 3 },
    drums: 'K...........'
  },
  // 건물 안 — 조용한 세마치, 평조(C)
  room: {
    name: '쉼터의 오후', bar: 9, speed: 3.6, vol: .7,
    chords: ['Am', 'C', 'G', 'C', 'Am', 'C', 'F', 'C'],
    lead: { inst: 'gayageum', notes: 'E5:3 G5:3 A5:3 | G5:6 E5:3 | D5:3 E5:3 G5:3 | C5:9 | A4:3 C5:3 D5:3 | E5:6 D5:3 | C5:3 A4:3 G4:3 | C5:9' },
    bass: { pattern: 'R..5..5..', oct: 2 },
    pluck: { pattern: '...3..5..', oct: 4 }
  },
  // 사나워진 우산몬과의 결투 — 휘모리 16칸, 계면조(D)
  battle: {
    name: '검은 기운을 걷어 내자', bar: 16, speed: 10, vol: .8,
    chords: ['Dm', 'Dm', 'C', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'F', 'C', 'C', 'Dm', 'Bb', 'C', 'A', 'Dm'],
    lead: { inst: 'piri', notes: 'D5:2 r:1 D5:1 F5:2 G5:2 A5:4 G5:2 F5:2 | G5:2 F5:2 D5:4 C5:2 D5:2 F5:4 | C5:2 r:1 C5:1 D5:2 F5:2 G5:4 F5:2 D5:2 | D5:6 C5:2 A4:8 | A5:2 r:1 A5:1 C6:2 A5:2 G5:4 F5:2 G5:2 | A5:4 G5:2 F5:2 D5:4 F5:4 | G5:2 A5:2 G5:2 F5:2 D5:2 C5:2 D5:4 | D5:12 r:4 | F5:4 G5:2 A5:2 C6:4 A5:4 | G5:2 A5:2 G5:2 F5:2 G5:8 | C5:4 D5:2 F5:2 G5:4 A5:4 | G5:6 F5:2 D5:8 | D6:4 C6:2 A5:2 G5:4 F5:4 | G5:4 A5:4 C6:8 | A5:2 A5:2 G5:2 F5:2 G5:2 F5:2 D5:2 C5:2 | D5:4 r:2 A4:2 D5:8' },
    bass: { pattern: 'R.R.8.R.R.8.5.8.', oct: 2 },
    pluck: { inst: 'pulse', pattern: 'R.5.8.5.R.5.8.5.', oct: 4 },
    drums: 'K.h.T.h.K.K.T.hh', fills: 'K.h.T.h.K.TRTRTT'
  },
  // 몽땅랜드 대원과의 결투 — 살금살금 얄미운 노래(E)
  villain: {
    name: '몽땅랜드가 나타났다', bar: 16, speed: 8.8, vol: .8,
    chords: ['Em', 'Em', 'Em', 'Em', 'C', 'G', 'Em', 'B', 'C', 'C', 'Em', 'Em', 'C', 'D', 'B', 'B'],
    lead: { inst: 'pulse', notes: 'E4:2 r:2 E4:1 r:1 G4:2 A4:2 A#4:2 B4:4 | D5:2 B4:2 A4:2 G4:2 E4:8 | E4:2 r:2 E4:1 r:1 G4:2 A4:2 A#4:2 B4:4 | E5:2 D5:2 B4:2 A4:2 B4:8 | G5:4 E5:2 D5:2 E5:4 B4:4 | D5:4 B4:2 A4:2 G4:4 A4:4 | B4:2 B4:2 A4:2 G4:2 A4:2 G4:2 E4:4 | E5:4 r:4 B4:4 r:4 | C5:2 r:2 C5:1 r:1 E5:2 G5:2 A5:2 G5:4 | E5:2 D5:2 C5:2 A4:2 C5:8 | E5:2 r:2 E5:1 r:1 G5:2 A5:2 A#5:2 B5:4 | A5:2 G5:2 E5:2 D5:2 E5:8 | G5:2 G5:2 E5:2 G5:2 A5:4 G5:4 | F#5:4 D5:2 E5:2 F#5:8 | B4:2 D#5:2 F#5:2 A5:2 B5:4 A5:4 | F#5:4 D#5:4 B4:8' },
    bass: { pattern: 'R.R.R.R.5.5.8.R.', oct: 2 },
    drums: 'K..TK.T.K..TK.TT', fills: 'K..TK.T.TRTRTTTT'
  },
  // 독도 지킴이·백무 사장·전설의 우산몬 결투 — 빠르고 힘찬 노래(A 계면조)
  boss: {
    name: '독도 지킴이의 시험', bar: 16, speed: 11, vol: .85,
    chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E', 'F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'],
    lead: { inst: 'piri', notes: 'A4:4 C5:2 D5:2 E5:6 G5:2 | A5:4 G5:2 E5:2 D5:4 E5:4 | C5:4 D5:2 E5:2 G5:4 E5:2 D5:2 | E5:8 D5:4 B4:4 | A5:2 A5:2 G5:2 A5:2 C6:4 A5:4 | G5:4 E5:2 G5:2 A5:8 | E5:2 G5:2 A5:2 G5:2 E5:2 D5:2 C5:4 | B4:8 E5:8 | C6:4 A5:2 G5:2 A5:4 C6:4 | D6:6 C6:2 B5:8 | A5:2 G5:2 E5:2 G5:2 A5:8 | E5:2 G5:2 A5:2 C6:2 A5:8 | C6:2 C6:2 A5:2 C6:2 D6:4 C6:4 | D6:2 D6:2 B5:2 D6:2 E6:8 | E6:4 D6:2 C6:2 B5:4 G#5:4 | A5:4 E5:4 B4:4 E5:4' },
    bass: { pattern: 'R.R8R.R8R.R8R.58', oct: 2 },
    pluck: { inst: 'pulse', pattern: '8.5.3.5.8.5.3.5.', oct: 4 },
    pad: { pattern: 'P.......P.......', oct: 3 },
    drums: 'D.hTK.TRD.hTK.TT', fills: 'D.TRTRTRD.TRTRTT'
  },
  // 전설의 우산몬이 깨어날 때 — 느리고 신비로운 노래(A 계면조)
  legend: {
    name: '천연기념물의 숨결', bar: 8, speed: 2.4, vol: .85,
    chords: ['Am', 'Am', 'C', 'Am', 'F', 'Am', 'G', 'Em'],
    lead: { inst: 'flute', vib: 1.8, notes: 'E5:4 A5:4 | G5:3 E5:1 D5:4 | C5:2 D5:2 E5:4 | A4:8 | C6:4 A5:2 G5:2 | A5:6 E5:2 | D5:3 E5:1 G5:2 E5:2 | E5:8' },
    pad: { pattern: 'P.......', oct: 3 },
    pluck: { pattern: 'R...5...', oct: 3 },
    drums: 'K.......'
  }
};

// 짧은 알림 노래(한 번만 울려요). 배경음악은 그동안 작게 줄어요.
export const JINGLES = {
  victory: { speed: 10, lead: { inst: 'piri', notes: 'D5:2 F#5:2 A5:2 D6:6 B5:2 D6:2 E6:8 r:2 A5:2 B5:2 D6:2 E6:2 F#6:10' }, bass: { inst: 'bass', notes: 'D3:6 D3:4 G3:6 A3:10 r:2 D3:16' }, drums: 'D.....T.T.D.....R.T.T.D...............' },
  levelup: { speed: 14, lead: { inst: 'piri', notes: 'D5:1 E5:1 F#5:1 A5:1 B5:1 D6:6' }, bass: { inst: 'gayageum', notes: 'D5:1 E5:1 F#5:1 A5:1 B5:1 D6:6' } },
  join: { speed: 9, lead: { inst: 'flute', notes: 'G5:2 B5:2 D6:2 G6:4 E6:2 G6:8' }, bass: { inst: 'gayageum', notes: 'G3:2 D4:2 G4:2 B4:4 C5:2 B4:8' } },
  item: { speed: 12, lead: { inst: 'pulse', notes: 'C6:2 E6:2 G6:2 C7:6' }, bass: { inst: 'gayageum', notes: 'C5:2 E5:2 G5:2 C6:6' } },
  heal: { speed: 14, lead: { inst: 'gayageum', notes: 'C5:1 D5:1 E5:1 G5:1 A5:1 C6:1 D6:1 E6:1 G6:6' } },
  stamp: { speed: 8, lead: { inst: 'gayageum', notes: 'r:2 G4:2 D5:2 G5:2 A5:2 B5:6' }, drums: 'D.......K.....' },
  legend: { speed: 6, lead: { inst: 'flute', vib: 2, notes: 'E6:1 B5:1 G5:1 E5:1 A5:8' }, bass: { inst: 'pad', notes: 'A3:12' } },
  start: { speed: 10, lead: { inst: 'gayageum', notes: 'D5:1 E5:1 F#5:1 A5:1 D6:6' } }
};

// ── 악보 읽기(소리 없이 쓰는 순수 함수라 테스트에서도 써요) ─────────────────────
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name); if (!m) throw new Error(`음이름을 읽지 못했어요: ${name}`);
  return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}
export const freq = n => 440 * 2 ** ((n - 69) / 12);
export function chordNotes(name) {
  const m = /^([A-G])([#b]?)(m?)$/.exec(name); if (!m) throw new Error(`화음을 읽지 못했어요: ${name}`);
  const root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { root, third: root + (m[3] ? 3 : 4), fifth: root + 7 };
}
// 'D5:3 r:1 | ...' → [{ at, len, note|null }] (칸 단위) 와 마디별 칸수
export function parseNotes(text) {
  const out = [], bars = []; let at = 0, barStart = 0;
  for (const tok of text.trim().split(/\s+/)) {
    if (tok === '|') { bars.push(at - barStart); barStart = at; continue; }
    const [n, l] = tok.split(':'), len = Number(l || 1);
    if (!(len > 0)) throw new Error(`칸수를 읽지 못했어요: ${tok}`);
    if (n !== 'r') out.push({ at, len, note: midi(n) });
    at += len;
  }
  bars.push(at - barStart);
  return { events: out, length: at, bars };
}
// 반주 무늬 한 마디 → 이벤트 (화음과 옥타브로 음높이를 정해요)
function patternEvents(pattern, chord, oct, barAt) {
  const c = chordNotes(chord), base = (oct + 1) * 12, out = [], marks = [...pattern];
  marks.forEach((ch, i) => {
    if (ch === '.') return;
    let len = 1; while (i + len < marks.length && marks[i + len] === '.') len++;
    const pitch = { R: [c.root], 3: [c.third], 5: [c.fifth], 8: [c.root + 12], P: [c.root, c.third, c.fifth] }[ch];
    if (!pitch) throw new Error(`무늬 글자를 읽지 못했어요: ${ch}`);
    for (const p of pitch) out.push({ at: barAt + i, len, note: base + p });
  });
  return out;
}
// 곡 → 악기별 이벤트 목록과 전체 길이(칸)
export function compileTrack(t) {
  const parts = [];
  if (t.chords) {
    const lead = parseNotes(t.lead.notes), barsN = t.chords.length;
    parts.push({ inst: t.lead.inst, vib: t.lead.vib, gain: 1, events: lead.events });
    for (const [key, inst, gain] of [['bass', 'bass', .9], ['pluck', 'gayageum', .45], ['pad', 'pad', .32]]) {
      const p = t[key]; if (!p) continue;
      const ev = []; t.chords.forEach((ch, b) => ev.push(...patternEvents(p.pattern, ch, p.oct, b * t.bar)));
      parts.push({ inst: p.inst || inst, gain, events: ev });
    }
    const drums = [];
    if (t.drums) for (let b = 0; b < barsN; b++) [...(b === barsN - 1 && t.fills ? t.fills : t.drums)].forEach((ch, i) => { if (ch !== '.') drums.push({ at: b * t.bar + i, len: 1, hit: ch }); });
    if (drums.length) parts.push({ inst: 'drum', gain: .6, events: drums });
    return { parts, length: barsN * t.bar, speed: t.speed, vol: t.vol ?? 1 };
  }
  // 알림 노래: 악기마다 음을 그대로 적어요
  let length = 0;
  for (const key of ['lead', 'bass']) {
    const p = t[key]; if (!p) continue;
    const r = parseNotes(p.notes); length = Math.max(length, r.length);
    parts.push({ inst: p.inst, vib: p.vib, gain: key === 'lead' ? 1 : .6, events: r.events });
  }
  if (t.drums) { const ev = []; [...t.drums].forEach((ch, i) => { if (ch !== '.') ev.push({ at: i, len: 1, hit: ch }); }); parts.push({ inst: 'drum', gain: .8, events: ev }); length = Math.max(length, t.drums.length); }
  return { parts, length, speed: t.speed, vol: t.vol ?? 1 };
}
