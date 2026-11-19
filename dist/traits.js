// ─────────────────────────────────────────────────────────────────────────────
// 우산몬의 특성 (v0.60) — 우산몬마다 하나씩 가진 특별한 능력 30가지
//
// 어떤 우산몬이 어떤 특성을 갖는지는 traitOf(종 번호)가 정해요(종마다 늘 같아요).
// 결투(game.js)가 아래 값을 읽어 써요. 여기 숫자만 고치면 세기를 바꿀 수 있어요.
//   kind: attack 기록 찾기(공격) · guard 막기 · heal 회복 · help 탐험 도우미
// ─────────────────────────────────────────────────────────────────────────────
export const TRAITS = [
  // ── 기록 찾기(공격) ──
  { id: 'double', kind: 'attack', name: '연속 풀이', text: '결투마다 한 번, 문제를 맞히면 곧바로 한 문제를 더 풀어요.' },
  { id: 'opener', kind: 'attack', name: '첫걸음', text: '결투에서 처음 맞힌 문제는 1.5배로 채워요.', mult: 1.5 },
  { id: 'clutch', kind: 'attack', name: '뒷심', text: '하트가 절반 아래면 맞힌 문제가 1.3배로 채워져요.', mult: 1.3 },
  { id: 'streak', kind: 'attack', name: '연승', text: '연달아 맞힐수록 10%씩 더 채워요(30%까지).', step: .1, max: .3 },
  { id: 'grit', kind: 'attack', name: '끈기', text: '문제를 틀려도 30%는 채워져요.', rate: .3 },
  { id: 'sharp', kind: 'attack', name: '날카로움', text: '세 번째로 맞히는 문제마다 1.5배로 채워요.', every: 3, mult: 1.5 },
  { id: 'typeace', kind: 'attack', name: '상성 달인', text: '상성이 좋을 때 1.5배가 아니라 1.8배로 채워요.', mult: 1.2 },
  { id: 'underdog', kind: 'attack', name: '역경', text: '상성이 나빠도 줄어들지 않고 그대로 채워요.' },
  { id: 'finisher', kind: 'attack', name: '마무리', text: '상대의 기운이 30% 아래면 1.4배로 채워요.', below: .3, mult: 1.4 },
  { id: 'careful', kind: 'attack', name: '신중함', text: '힌트 없이 맞히면 15% 더 채워요.', mult: 1.15 },
  { id: 'comeback', kind: 'attack', name: '뒤집기', text: '바로 앞 문제를 틀렸다면, 다음에 맞힌 문제는 1.4배로 채워요.', mult: 1.4 },
  { id: 'reader', kind: 'attack', name: '기운 읽기', text: '상대가 나올 때 두루마리를 10% 먼저 채워요.', rate: .1 },
  { id: 'eliminate', kind: 'attack', name: '약점 찾기', text: '고르기 문제에서 틀린 답 하나를 지워 줘요.' },
  // ── 막기 ──
  { id: 'sturdy', kind: 'guard', name: '단단함', text: '받는 충격이 15% 줄어요.', mult: .85 },
  { id: 'shield', kind: 'guard', name: '든든한 방패', text: '○×를 맞히면 충격이 40%가 아니라 60% 줄어요.', mult: 2 / 3 },
  { id: 'endure', kind: 'guard', name: '버티기', text: '결투마다 한 번, 지칠 만한 충격에도 하트 반 개로 버텨요.' },
  { id: 'antipierce', kind: 'guard', name: '빈틈없음', text: '독도 지킴이의 ‘관통’을 막아요.' },
  { id: 'firstguard', kind: 'guard', name: '첫 방어', text: '결투에서 처음 받는 충격이 절반이 돼요.', mult: .5 },
  { id: 'counter', kind: 'guard', name: '되받기', text: '○×를 맞히면 상대의 두루마리가 5% 채워져요.', rate: .05 },
  { id: 'thorns', kind: 'guard', name: '가시', text: '충격을 받으면 그 20%만큼 상대의 기운도 줄어요.', rate: .2 },
  // ── 회복 ──
  { id: 'mend', kind: 'heal', name: '새살', text: '문제를 맞힐 때마다 하트가 조금(6%, 최소 반 개) 돌아와요.', rate: .06 },
  { id: 'rest', kind: 'heal', name: '숨 고르기', text: '차례가 끝날 때마다 하트가 조금(4%, 최소 반 개) 돌아와요.', rate: .04 },
  { id: 'cheer', kind: 'heal', name: '응원', text: '교체되어 나올 때 하트가 15% 돌아와요.', rate: .15 },
  { id: 'afterglow', kind: 'heal', name: '정화의 숨결', text: '상대의 기록을 모두 되찾으면 하트가 25% 돌아와요.', rate: .25 },
  { id: 'medic', kind: 'heal', name: '응급 처치', text: '회복젤이 45%가 아니라 70%를 채워 줘요.', rate: .7 },
  // ── 탐험 도우미 ──
  { id: 'charm', kind: 'help', name: '친화력', text: '동료 만들기 성공률이 15%p 올라요.', add: .15 },
  { id: 'swift', kind: 'help', name: '재빠름', text: '물러나기가 늘 성공해요.' },
  { id: 'learner', kind: 'help', name: '배움', text: '경험치를 20% 더 얻어요.', mult: 1.2 },
  { id: 'picker', kind: 'help', name: '줍기', text: '조사 코인을 50% 더 받아요.', mult: 1.5 },
  { id: 'share', kind: 'help', name: '나눔', text: '앞에 나와 있으면, 쉬는 동료들도 경험치를 절반이 아니라 전부 받아요.' }
];
export const TRAIT_KINDS = { attack: '기록 찾기', guard: '막기', heal: '회복', help: '탐험 도우미' };
const BY_ID = Object.fromEntries(TRAITS.map(t => [t.id, t]));
export const trait = id => BY_ID[id] || null;
// 종 번호 → 특성. 번호를 고르게 흩어서 서른 가지가 모두 쓰이게 해요(1~100번에 서너 종씩).
export function traitOf(speciesId) { const n = Number(String(speciesId).split('-')[0]) || 1; return TRAITS[(n * 7 + 5) % TRAITS.length]; }
export const hasTrait = (mon, id) => !!mon && traitOf(mon.id).id === id;
