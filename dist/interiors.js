// ─────────────────────────────────────────────────────────────────────────────
// 건물 안 (v0.35) — 마을마다 연구소·수호관·쉼터·집에 들어갈 수 있고, 계단으로 위아래 층을 오갑니다.
//
// 층 그림 글자 (가로 14칸 안팎, 벽 포함)
//   벽·바닥  w 벽   y 창문이 있는 벽   _ 나무 바닥   , 돌 바닥   m 깔개(걸을 수 있음)
//   이동     D 문(밟으면 밖으로)   U 위층 계단   N 아래층 계단   a 문으로 들어왔을 때 서는 자리
//   가구     c 계산대  k 책장  t 탁자  s 소파  e 침대  x 책상·모니터  q 화분  o 상자 더미  g 수련 기둥  v 트로피 받침
//   숫자     그 층의 objects에 적은 것(사람·책·창밖 풍경·보관함·도감·쉼 침대·상자·복습 책상 …)
//
// 층마다 내용은 마을(지역)에 따라 바뀝니다: 책장의 책은 그 지역 문제의 해설(출처가 있는 사실),
// 창밖 풍경은 그 지역 이야기, 수조의 생물은 그 지역에 사는 생물이에요. 마을·건물 모습은 게임 속 창작입니다.
// ─────────────────────────────────────────────────────────────────────────────
import { ZONES, TYPES, MONSTERS, isUnique } from './data.js';
import { QUESTIONS, CONCEPTS, SOURCES } from './learning.js';

export const ROOM_W = 42, ROOM_H = 30; // rooms sit in the middle of a normal-size map
export const BUILDING_ROOMS = { lab: '연구소', gym: '수호관', shop: '쉼터', home: '집' };

const TOWN_ISLAND = ['울릉도', '동도', '동도', '서도', '서도', '서도', '서도', '서도']; // 1장(도동항)은 울릉도
const sourceTitle = url => SOURCES.find(s => s.url === url)?.title || '학습 자료';
const books = zone => QUESTIONS.filter(q => q.zone === zone);
function book(zone, i) {
  const list = books(zone).length ? books(zone) : QUESTIONS, q = list[i % list.length];
  const c = CONCEPTS.find(c => c.id === q.concept);
  return [`『${c?.title || '독도 이야기'}』 책을 펼쳤어요.`, q.explanation, `책 끝에 적힌 출처: ${sourceTitle(q.source)}`];
}
const localSpecies = zone => (MONSTERS.find(m => m.zone === zone && !isUnique(m) && m.stage === 1) || MONSTERS.find(m => !isUnique(m))).id;

// Each floor: art rows and the objects for its digits (built per zone).
export const ROOM_TEMPLATES = {
  shop: [
    { label: '1층 · 상점과 쉼터', art: [
      'wwwyywwwwwyyww',
      'wq_cccc0___kUw',
      'w____________w',
      'w_tt___mmm__1w',
      'w_tt_2_mmm__ew',
      'w______3_____w',
      'wq_____a____qw',
      'wwwwwwwDwwwwww'],
      objects: z => ({
        0: { type: 'shopkeeper', actor: 'woman', name: '쉼터 직원', lines: ['어서 오세요! 회복젤과 친구 구슬을 팔아요.'] },
        1: { type: 'rest', name: '푹신한 침대', furniture: 'bed' },
        2: { type: 'person', actor: 'man', name: '여행자 하람', lines: [`${ZONES[z].name}에 왔다면 ‘${ZONES[z].histTitle}’ 이야기를 꼭 들어 봐요.`, ZONES[z].hint] },
        3: { type: 'sign', name: '쉼터 알림판', furniture: 'board', lines: ['쉼터 이용 안내: 침대에서 쉬면 동료들의 기운이 돌아와요.', '2층 동료 방에서는 함께 다닐 동료를 바꿀 수 있어요.'] }
      }) },
    { label: '2층 · 동료 방', art: [
      'wwwyywwwwwyyww',
      'wkk__0___ss_Nw',
      'w____________w',
      'w__mmmmm___1_w',
      'w__mmmmm_____w',
      'wq__2____tt__w',
      'wwwwwwwwwwwwww'],
      objects: z => ({
        0: { type: 'storage', name: '동료 보관함', furniture: 'pc' },
        1: { type: 'person', actor: 'child-girl', name: '쉬러 온 아이 다솜', lines: ['보관함에서 동료를 바꿔 데려갈 수 있어.', `여기 ${ZONES[z].name}에서는 ${TYPES[ZONES[z].type].name} 속성 우산몬이 힘을 내.`] },
        2: { type: 'sign', name: '여행 사진첩', furniture: 'shelf', lines: book(z, 3) }
      }) }
  ],
  lab: [
    { label: '1층 · 연구실', art: [
      'wwyywwwwwwyyww',
      'wxx_0__kk__kUw',
      'w____________w',
      'w__1___xx_x__w',
      'w______xx____w',
      'wq_2________qw',
      'w______a_____w',
      'wwwwwwwDwwwwww'],
      objects: z => ({
        0: { type: 'dex', name: '도감 단말기', furniture: 'pc' },
        1: { type: 'observe', name: '관찰 수조', furniture: 'tank', species: localSpecies(z), lines: ['수조 속 {species}을(를) 관찰해요.', '연구원이 날마다 관찰 일지를 적고 있어요. 본 것과 짐작한 것을 나눠 적는대요.'] },
        2: { type: 'person', actor: 'woman', name: '연구원 하윤', lines: [`요즘은 ‘${ZONES[z].histTitle}’ 자료를 정리하고 있어요.`, '2층 자료실에는 출처가 적힌 책이 많아요. 3층 관측실에서는 섬을 멀리 볼 수 있고요.'] }
      }) },
    { label: '2층 · 자료실', art: [
      'wwwwwwwwwwwwww',
      'wk0kk1kk2kk_Nw',
      'w____________w',
      'w__t_t__t_t__w',
      'w____________w',
      'w__mmmmmmm_3_w',
      'wq__4______qUw',
      'wwwwwwwwwwwwww'],
      objects: z => ({
        0: { type: 'sign', name: '책장 1', furniture: 'shelf', lines: book(z, 0) },
        1: { type: 'sign', name: '책장 2', furniture: 'shelf', lines: book(z, 1) },
        2: { type: 'sign', name: '책장 3', furniture: 'shelf', lines: book(z, 2) },
        3: { type: 'stone', name: '복습 책상', furniture: 'lectern', lines: ['펼쳐진 공책에 지난 문제가 적혀 있어요. 다시 풀어 볼까요?'] },
        4: { type: 'person', actor: 'man', name: '사서 선우', lines: ['책을 읽을 때는 누가, 언제 쓴 자료인지 먼저 봐요.', '책 끝에 적힌 출처를 따라가면 원래 자료를 확인할 수 있어요.'] }
      }) },
    { label: '3층 · 관측실', art: [
      'wwyyyywwyyyyww',
      'w___0____1__Nw',
      'w____________w',
      'w__x___mmm___w',
      'w______mmm_2_w',
      'wq__3_______qw',
      'wwwwwwwwwwwwww'],
      objects: z => ({
        0: { type: 'landmark', name: '망원경', furniture: 'telescope', lines: [`망원경으로 ${ZONES[z].name} 둘레를 바라봐요.`, ZONES[z].fact] },
        1: { type: 'landmark', name: '큰 창', furniture: 'window', lines: [`창밖으로 ${TOWN_ISLAND[z]}의 바다가 펼쳐져요. 오늘 날씨는 ${ZONES[z].sky}.`, z === 0 ? '울릉도와 독도 주변은 따뜻한 바닷물과 차가운 바닷물이 만나는 곳이라 생물이 많아요.' : '독도 주변은 따뜻한 바닷물과 차가운 바닷물이 만나는 곳이라 생물이 많아요.'] },
        2: { type: 'box', name: '관측 장비 상자', furniture: 'chest', give: { orb: 3 }, lines: ['친구 구슬 3개가 들어 있어요!'] },
        3: { type: 'person', actor: 'child-boy', name: '관측 동아리 이준', lines: [z === 0 ? '맑은 날에는 여기 울릉도에서도 독도가 보여! 동남쪽 수평선을 잘 봐.' : '맑은 날에는 울릉도에서도 독도가 보인대!', '본 것을 적을 때는 날짜와 날씨도 함께 적어야 해.'] }
      }) }
  ],
  gym: [
    { label: '1층 · 로비', art: [
      'wwwyywwwwyywww',
      'wv_0_v_____vUw',
      'w,,,,,,,,,,,,w',
      'w,,,mmmmmm,1,w',
      'w,,,mmmmmm,,,w',
      'wq,,,,2,,,,,qw',
      'w,,,,,,a,,,,,w',
      'wwwwwwwDwwwwww'],
      objects: z => ({
        0: { type: 'badges', name: '인증 진열장', furniture: 'trophy' },
        1: { type: 'person', actor: 'child-boy', name: '수련생 마루', lines: [`관장 ${ZONES[z].boss}님은 수호관 앞에서 도전자를 기다리셔.`, '도전하기 전에 기록판 문제를 먼저 풀어 두면 마음이 든든해!'] },
        2: { type: 'sign', name: '수호관 안내판', furniture: 'board', lines: [`${ZONES[z].name} 수호관 · ${ZONES[z].badge} 인증`, '2층 수련장에서 복습 문제를 풀고, 3층 전망대에서 마을을 내려다볼 수 있어요.'] }
      }) },
    { label: '2층 · 수련장', art: [
      'wwwwwwwwwwwwww',
      'wg__g__g__g_Nw',
      'w,,,,,,,,,,,,w',
      'w,,mmmmmmmm,,w',
      'w,,mm0mm1mm,,w',
      'w,,mmmmmmmm,,w',
      'wo,,,,2,,,,,Uw',
      'wwwwwwwwwwwwww'],
      objects: z => ({
        0: { type: 'stone', name: '연습 문제판', furniture: 'lectern', lines: ['수련생들이 푸는 연습 문제예요. 한번 도전해 볼까요?'] },
        1: { type: 'person', actor: 'woman', name: '사범 가람', lines: [`이 수호관은 ${TYPES[ZONES[z].type].name} 속성을 잘 다뤄요.`, '상대와 잘 맞는 기술을 쓰면 마음이 크게 닿아요. 동료를 바꿔 가며 겨뤄 봐요.'] },
        2: { type: 'box', name: '수련 도구 상자', furniture: 'chest', give: { heal: 2 }, lines: ['회복젤 2개가 들어 있어요!'] }
      }) },
    { label: '3층 · 전망대', art: [
      'wyyyyyyyyyyyyw',
      'w__0____1___Nw',
      'w____________w',
      'w___mmmmmm___w',
      'wq__mmmmmm__qw',
      'wwwwwwwwwwwwww'],
      objects: z => ({
        0: { type: 'landmark', name: '전망 창', furniture: 'window', lines: [`${ZONES[z].name} 마을이 한눈에 내려다보여요.`, ZONES[z].subtitle + '.', `지명은 실제 ${z === 0 ? '울릉도' : '독도'}의 이름이지만, 마을과 건물은 게임 속 창작이에요.`] },
        1: { type: 'person', actor: 'man', name: '수호관 지기', lines: ['높은 곳에서 보면 길이 어떻게 이어지는지 잘 보여.', ZONES[z].fact] }
      }) }
  ],
  home: [
    { label: '1층 · 거실', art: [
      'wwwyywwwwyywww',
      'wkk_____o__qUw',
      'w__tt________w',
      'w__tt__mmmm0_w',
      'w______mmmm__w',
      'wq_____a_s1s_w',
      'wwwwwwwDwwwwww'],
      objects: z => ({
        0: { type: 'person', actor: 'woman', name: '할머니', lines: ['어서 오렴. 따뜻한 보리차 한 잔 마시고 가.', '울릉도 사람들은 독도를 ‘독섬’이라고도 불렀단다. 돌로 된 섬이라는 뜻이지.', `${ZONES[z].name} 이야기도 귀 기울여 들어 보렴.`] },
        1: { type: 'sign', name: '가족 사진', furniture: 'frame', lines: ['바닷가에서 찍은 가족 사진이에요. 모두 환하게 웃고 있어요.'] }
      }) },
    { label: '2층 · 방', art: [
      'wwwyywwwwwwwww',
      'we__k0k___o_Nw',
      'we__________1w',
      'w___mmmm_____w',
      'wq__mmmm_2___w',
      'wwwwwwwwwwwwww'],
      objects: z => ({
        0: { type: 'sign', name: '책꽂이', furniture: 'shelf', lines: book(z, 4) },
        1: { type: 'box', name: '장난감 상자', furniture: 'chest', give: { coins: 20 }, lines: ['반짝이는 조사 코인 20개가 들어 있어요!'] },
        2: { type: 'rest', name: '폭신한 이불', furniture: 'futon' }
      }) }
  ]
};

export const roomId = (zone, kind, floor) => `town${zone}/${kind}/${floor}`;
export function parseRoomId(id) { const m = /^town(\d)\/(lab|gym|shop|home)\/(\d)$/.exec(id || ''); return m ? { zone: +m[1], kind: m[2], floor: +m[3] } : null; }

// All interior map definitions (8 towns × 4 buildings × their floors), shaped like normal maps (42×30).
export const ROOM_DEFS = [];
for (let zone = 0; zone < 8; zone++) for (const [kind, floors] of Object.entries(ROOM_TEMPLATES)) floors.forEach((f, i) => {
  const w = f.art[0].length, h = f.art.length, ox = Math.floor((ROOM_W - w) / 2), oy = Math.floor((ROOM_H - h) / 2);
  const art = Array.from({ length: ROOM_H }, (_, y) => {
    const row = y >= oy && y < oy + h ? f.art[y - oy] : '';
    return (' '.repeat(ox) + row).padEnd(ROOM_W, ' ').slice(0, ROOM_W);
  });
  ROOM_DEFS.push({
    id: roomId(zone, kind, i + 1), kind: 'room', zone, building: kind, floor: i + 1, floors: floors.length,
    name: `${BUILDING_ROOMS[kind]} ${f.label}`, short: `${BUILDING_ROOMS[kind]} ${f.label.split(' · ')[0]}`, townName: ZONES[zone].name,
    island: TOWN_ISLAND[zone], town: `town${zone}`, art, focus: { x: ox, y: oy, w, h }, objects: f.objects(zone)
  });
});
