// ─────────────────────────────────────────────────────────────────────────────
// 전설의 우산몬 = 천연기념물 (v0.41)
//
// 천연기념물은 나라가 법으로 정해 보호하는 자연유산이에요. 몽땅랜드의 지우개 기계가 기록을 읽을 때,
// 천연기념물 생물의 기록은 아주 오래되고 단단해서 ‘전설의 우산몬’이 되었어요(게임 속 설정).
// 전설의 우산몬은 자연을 아끼는 탐험대 앞에만 나타나요. 조건을 채우면 김박사가 무전으로 알려 주고,
// 지도 위 정해진 자리에 금빛 기운이 생겨요. 다가가 말을 걸면 만남 장면 → 정화 결투 → 동료가 돼요.
//
//   need.type  badge: 그 장 독도 지킴이 인증 · observe/trainer/trash/stone: 지도 위에서 해낸 일의 수 · seen: 도감 발견 수
//   x, y       전설의 기운이 나타나는 칸 (걸어서 닿을 수 있는 빈칸, tests/legends.test.mjs가 확인해요)
// 사철나무(18)는 대한봉에서 백무 사장을 막으면 풀려나 천장굴 길로 돌아가요(need.type story).
// 전설의 우산몬은 정화해도 저절로 동료가 되지 않아요. 결투에서 ‘동료 만들기’를 눌러 10% 확률로 동료가 돼요.
// 실제 생물 정보는 국립생물자원관 「독도의 생물다양성」(2017)과 국가유산청 자료를 바탕으로 짧게 줄였어요.
// 지정 번호는 2021년부터 공식적으로 쓰지 않지만 흔히 함께 적어요.
// ─────────────────────────────────────────────────────────────────────────────
import { MAPS } from './maps.js';
import { josa } from './text.js';

const TYPE_FLAGS = {};
for (const m of MAPS) for (const [k, o] of Object.entries(m.objects || {})) (TYPE_FLAGS[o.type] ||= []).push(`${m.id}:${k}`);
export const countDone = (state, type) => (TYPE_FLAGS[type] || []).filter(f => state.flags?.[f]).length;

export const LEGENDS = [
  {
    id: 68, name: '소쩍새', monument: '천연기념물 제324-6호', map: 'town0', x: 28, y: 6, place: '도동항 뒷산 숲 가장자리',
    title: '밤 숲의 소쩍 소리', need: { type: 'badge', zone: 0, n: 1, label: '도동항 물결 지킴이 해온의 인증 받기' },
    radio: ['도동항 사람들이 밤마다 뒷산 숲에서 ‘소쩍 소쩍’ 소리를 들었대요.', '공사 소음에 놀라 숨어 있던 전설의 우산몬일지도 몰라요. 수호관 오른쪽 숲 가장자리를 살펴봐 줄래요?'],
    scene: { bg: 'sea', island: 'ulleung', night: true, caption: '도동항 뒷산 · 밤' },
    meet: ['깜깜한 숲에서 ‘소쩍… 소쩍…’ 하는 소리가 들려온다.', '귀깃이 쫑긋한 작은 새가 나뭇가지 사이에서 노란 눈을 반짝인다!'],
    fact: '소쩍새는 머리에 귀깃이 솟은 작은 올빼미 무리 새예요. 여름에 우리나라를 찾아와 밤에 ‘소쩍 소쩍’ 하고 울어요. 독도에서도 관찰 기록이 있어요.'
  },
  {
    id: 72, name: '황조롱이', monument: '천연기념물 제323-8호', map: 'route1', x: 16, y: 4, place: '천장굴 길 위쪽 언덕',
    title: '하늘에 멈춘 사냥꾼', need: { type: 'observe', n: 2, label: '관찰 지점 2곳에서 생물 관찰하기' },
    radio: ['관찰 기록이 차곡차곡 쌓였네요! 꼼꼼하게 지켜보는 탐험대라는 소문이 났나 봐요.', '천장굴 길 위쪽 언덕 하늘에 날갯짓하며 한자리에 멈춰 있는 새가 보인대요. 가 볼까요?'],
    scene: { bg: 'field', caption: '천장굴 길 · 위쪽 언덕' },
    meet: ['머리 위 하늘에서 작은 매 한 마리가 날개를 빠르게 치며 한자리에 멈춰 있다.', '정지 비행! 아래를 내려다보던 새가 이쪽을 향해 내려온다!'],
    fact: '황조롱이는 공중에서 날개를 빠르게 치며 한자리에 멈춘 듯 떠 있다가(정지 비행) 먹이를 찾아 내려앉아요. 도시의 건물 틈에 둥지를 틀기도 해요.'
  },
  {
    id: 71, name: '매', monument: '천연기념물 제323-7호', map: 'town3', x: 14, y: 4, place: '탕건봉 바위 절벽 위',
    title: '바다 절벽의 번개', need: { type: 'trainer', n: 3, label: '길에서 몽땅랜드 직원 3명과 겨뤄 이기기' },
    radio: ['몽땅랜드 직원들을 셋이나 막아 냈다고요? 대단해요!', '탕건봉 절벽 위에서 번개처럼 내리꽂는 새를 봤다는 연락이 왔어요. 바위 절벽 쪽을 살펴봐요.'],
    scene: { bg: 'sea', caption: '탕건봉 · 바위 절벽' },
    meet: ['쉬익— 바람을 가르는 소리와 함께 무언가가 바다 쪽으로 내리꽂힌다!', '절벽 끝에 날카로운 눈매의 새가 내려앉아 이쪽을 지켜본다.'],
    fact: '매는 높은 하늘에서 먹이를 향해 아주 빠르게 내리꽂으며 사냥해요. 바닷가 절벽에 둥지를 틀고, 멸종위기 야생생물로도 보호받아요.'
  },
  {
    id: 70, name: '뿔쇠오리', monument: '천연기념물', map: 'route4', x: 20, y: 23, place: '보찰바위 갯바위 아래 바닷가',
    title: '파도 위의 작은 바닷새', need: { type: 'trash', n: 3, label: '바닷가 쓰레기 3곳 치우기' },
    radio: ['바닷가 쓰레기를 세 군데나 치웠군요! 바다가 한결 깨끗해졌어요.', '보찰바위 갯바위 아래 바닷가에서 머리에 검은 뿔깃이 난 작은 바닷새가 파도를 타고 있대요.'],
    scene: { bg: 'sea', caption: '보찰바위 · 바닷가' },
    meet: ['깨끗해진 물결 위로 작은 바닷새 한 마리가 동동 떠오른다.', '머리의 검은 뿔깃을 세운 새가 파도를 박차고 날아오른다!'],
    fact: '뿔쇠오리는 머리에 검은 뿔 같은 깃이 있는 작은 바닷새예요. 사람이 거의 살지 않는 섬의 바위틈에서 새끼를 기르고 대부분 바다에서 지내요. 전 세계에 수천 마리밖에 남지 않았어요.'
  },
  {
    id: 75, name: '고니', monument: '천연기념물 제201-1호', map: 'town6', x: 9, y: 23, place: '물골 샘물 옆 몽돌 해안',
    title: '물골에 내려앉은 하얀 손님', need: { type: 'seen', n: 30, label: '도감에서 우산몬 30종 발견하기' },
    radio: ['도감에 벌써 서른 종이 넘게 모였어요! 섬의 생물을 정말 잘 알게 됐네요.', '독도에서 하나뿐인 샘물, 물골 옆 몽돌 해안에 새하얀 큰 새가 내려앉았대요.'],
    scene: { bg: 'sea', caption: '물골 · 몽돌 해안' },
    meet: ['몽돌 사이로 졸졸 흐르는 샘물 옆에 새하얀 깃털이 반짝인다.', '긴 목을 우아하게 세운 새가 날개를 활짝 펼친다!'],
    fact: '고니는 온몸이 새하얀 큰 물새예요. 겨울이 되면 북쪽에서 우리나라로 날아와 호수와 바닷가에서 겨울을 나요. 독도에서도 기록된 적이 있어요.'
  },
  {
    id: 76, name: '흑두루미', monument: '천연기념물 제228호', map: 'route6', x: 22, y: 4, place: '상장군바위 오르막 꼭대기',
    title: '먼 길을 기억하는 두루미', need: { type: 'stone', n: 5, label: '기억 비석 5곳에서 복습 문제 풀기' },
    radio: ['기억 비석 다섯 곳의 문제를 모두 풀었어요! 배운 것을 오래 기억하는 탐험대네요.', '해마다 먼 길을 잊지 않고 오가는 새가 있지요. 상장군바위 오르막 꼭대기에 검은 두루미가 쉬어 간대요.'],
    scene: { bg: 'field', caption: '상장군바위 · 오르막 꼭대기' },
    meet: ['바람이 멎은 언덕 꼭대기에 키 큰 새 한 마리가 조용히 서 있다.', '하얀 목과 검은 몸의 두루미가 긴 날개를 펼치며 이쪽을 돌아본다!'],
    fact: '흑두루미는 몸이 검은 잿빛이고 목이 하얀 두루미예요. 겨울을 나러 먼 북쪽에서 날아오는 철새로, 순천만이 대표적인 쉼터예요. 독도를 지나가며 기록되기도 했어요.'
  },
  {
    id: 18, name: '사철나무', noun: '나무', monument: '천연기념물 제538호', map: 'route1', x: 10, y: 24, place: '천장굴 길 아래쪽 비탈',
    title: '천장굴 위의 오래된 나무', need: { type: 'story', n: 1, label: '대한봉에서 백무 사장의 계획 막기' },
    radio: ['백무 사장에게서 풀려난 사철나무가 천장굴 쪽으로 돌아갔어요.', '천장굴 길 아래쪽 비탈에 금빛 기운이 보인대요. 다시 만나서 동료가 되어 달라고 해 봐요!'],
    scene: { bg: 'field', caption: '천장굴 길 · 비탈' },
    meet: ['바람이 멎은 비탈에서 오래된 나무 한 그루가 잎을 사르르 흔든다.', '사철나무가 아직 남은 검은 기운을 털어 내려 애쓰고 있다!'],
    fact: '독도의 사철나무는 동도 천장굴 위쪽 비탈에서 100년 넘게 자란, 독도에서 가장 오래된 나무예요. 2012년 천연기념물 제538호로 지정되었어요.'
  }
];
export const ALL_LEGEND_IDS = LEGENDS.map(q => q.id);

export function legendProgress(q, state) {
  const n = q.need;
  const cur = n.type === 'badge' ? (state.badges?.includes(n.zone) ? 1 : 0) : n.type === 'seen' ? (state.seen?.length || 0) : n.type === 'story' ? (state.progress?.[7]?.enemy ? 1 : 0) : countDone(state, n.type);
  return { cur: Math.min(cur, n.n), need: n.n, done: cur >= n.n };
}
export const openFlag = id => `legend-open:${id}`;
export const metFlag = id => `legend:${id}`;
export const ownsSpecies = (state, id) => [...(state.party || []), ...(state.storage || [])].some(m => m.id === id);

// 지도 위 전설의 기운 (열렸고, 아직 동료가 되지 않은 것만)
export function legendSpots(mapId, flags = {}) {
  return LEGENDS.filter(q => q.map === mapId && flags[openFlag(q.id)] && !flags[metFlag(q.id)]).map(q => ({
    key: `L${q.id}`, type: 'legend', name: '전설의 기운', species: q.id, x: q.x, y: q.y, quest: q.id,
    lines: ['금빛 기운이 일렁여요. 무언가가 이곳에 숨어 있는 것 같아요.']
  }));
}

// 만남 장면 (cutscene.js 형식)
export function legendScene(q) {
  const s = q.scene;
  return {
    id: `legend-${q.id}`,
    scenes: [{
      bg: s.bg, island: s.island, caption: s.caption, noBoat: true, start: s.night ? ['night'] : [],
      cast: [
        { id: 'player', who: 'player', x: 92, y: 150, dir: 'right' },
        { id: 'leg', who: `monster:${q.id}`, x: s.bg === 'field' ? 196 : 222, y: 146, size: 70, hidden: true, aura: true }
      ],
      lines: [
        { who: null, text: q.meet[0], cue: 'glint' },
        { who: null, text: q.meet[1], cue: 'show:leg' },
        { who: '김박사(무전)', text: `전설의 우산몬 ${josa(q.name, '이에요/예요')}! ${josa(q.monument, '으로/로')} 지정된 ${q.noun || '새'}예요.` },
        { who: '김박사(무전)', text: '그런데 몸에 검은 기운이 감겨 있어요. 기계에서 새어 나온 기운에 괴로워하나 봐요. 정화해서 구해 줘요!', cue: 'jump' }
      ]
    }]
  };
}
