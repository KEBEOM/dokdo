// ─────────────────────────────────────────────────────────────────────────────
// 건물 안 (v0.35) — 마을마다 연구소·수호관·쉼터·집에 들어갈 수 있고, 계단으로 위아래 층을 오갑니다.
//
// 층 그림 글자 (가로 14칸 안팎, 벽 포함)
//   벽·바닥  w 벽   y 창문이 있는 벽   _ 나무 바닥   , 돌 바닥   m 깔개(걸을 수 있음)
//   이동     D 문(밟으면 밖으로)   U 위층 계단   N 아래층 계단   a 문으로 들어왔을 때 서는 자리
//   가구     c 계산대  k 책장  t 탁자  s 소파  e 침대  x 책상·모니터  q 화분  o 상자 더미  g 수련 기둥  v 트로피 받침
//   숫자     그 층의 objects에 적은 것(사람·책·창밖 풍경·도감·쉼 침대·상자·복습 책상 …)
//
// 층마다 내용은 마을(지역)에 따라 바뀝니다: 책장의 책은 그 지역 문제의 해설(출처가 있는 사실),
// 창밖 풍경은 그 지역 이야기, 수조의 생물은 그 지역에 사는 생물이에요. 마을·건물 모습은 게임 속 창작입니다.
// ─────────────────────────────────────────────────────────────────────────────
import { ZONES, TYPES, MONSTERS, isUnique, keeperName } from './data.js';
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
        0: { type: 'shopkeeper', actor: 'woman', name: '쉼터 직원', lines: ['어서 오세요! 회복젤을 팔아요. 지친 동료는 침대에서 쉬게 해 주세요.'] },
        1: { type: 'rest', name: '푹신한 침대', furniture: 'bed' },
        2: { type: 'person', actor: 'man', name: '여행자 하람', lines: [`${ZONES[z].name}에 왔다면 ‘${ZONES[z].histTitle}’ 이야기를 꼭 들어 봐요.`, ZONES[z].hint] },
        3: { type: 'sign', name: '쉼터 알림판', furniture: 'board', lines: ['쉼터 이용 안내: 침대에서 쉬면 동료들의 기운이 돌아와요.', '함께 다닐 동료는 언제든 화면 아래 ‘동료’ 단추의 동료 보관함에서 바꿀 수 있어요. 함께 다니는 동료는 4마리예요.'] }
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
        0: { type: 'sign', name: '동료 사진 액자', furniture: 'shelf', lines: ['함께 모험한 우산몬들의 사진이 걸려 있어요.', '동료는 ‘동료’ 단추의 동료 보관함에서 언제든 바꿀 수 있어요.'] },
        1: { type: 'person', actor: 'child-girl', name: '쉬러 온 아이 다솜', lines: ['동료 보관함을 열면 쉬고 있는 동료와 언제든 바꿀 수 있어. 기계는 필요 없어!', `여기 ${ZONES[z].name}에서는 ${TYPES[ZONES[z].type].name} 속성 우산몬이 힘을 내.`] },
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
        2: { type: 'box', name: '관측 장비 상자', furniture: 'chest', give: { heal: 3 }, lines: ['회복젤 3개가 들어 있어요!'] },
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
        1: { type: 'person', actor: 'child-boy', name: '수련생 마루', lines: [`${keeperName(ZONES[z])}님은 수호관 앞에서 도전자를 기다리셔.`, '도전하기 전에 기록판 문제를 먼저 풀어 두면 마음이 든든해!'] },
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
export function parseRoomId(id) { const m = /^town(\d)\/([a-z]+\d*)\/(\d)$/.exec(id || ''); return m ? { zone: +m[1], kind: m[2], floor: +m[3] } : null; }

function roomDef(zone, key, title, floors, f, i) {
  const w = f.art[0].length, h = f.art.length, ox = Math.floor((ROOM_W - w) / 2), oy = Math.floor((ROOM_H - h) / 2);
  const art = Array.from({ length: ROOM_H }, (_, y) => {
    const row = y >= oy && y < oy + h ? f.art[y - oy] : '';
    return (' '.repeat(ox) + row).padEnd(ROOM_W, ' ').slice(0, ROOM_W);
  });
  return {
    id: roomId(zone, key, i + 1), kind: 'room', zone, building: key, floor: i + 1, floors: floors.length,
    name: `${title} ${f.label}`, short: `${title} ${f.label.split(' · ')[0]}`, townName: ZONES[zone].name,
    island: TOWN_ISLAND[zone], town: `town${zone}`, art, focus: { x: ox, y: oy, w, h }, objects: f.objects(zone)
  };
}
// All interior map definitions (8 towns × 4 buildings × their floors), shaped like normal maps (42×30).
export const ROOM_DEFS = [];
for (let zone = 0; zone < 8; zone++) for (const [kind, floors] of Object.entries(ROOM_TEMPLATES)) floors.forEach((f, i) => ROOM_DEFS.push(roomDef(zone, kind, BUILDING_ROOMS[kind], floors, f, i)));

// ── v0.75 도동항 시가지의 집·가게·여객선터미널도 모두 들어가 볼 수 있어요 ─────────────────────────────
// 가게·집 이름과 이야기는 게임 속 창작이에요. 울릉도 먹거리·나물·눈 이야기는 일반적인 사실만 담았어요.
const PEOPLE = ['man', 'woman', 'child-girl', 'child-boy', 'child-girl-ribbon'];
const NAMES = ['다온', '해솔', '바름', '누리', '하랑', '새벽', '여울', '가온', '도담', '라온', '마루', '별하', '소담', '아름', '예솔', '윤슬', '은솔', '초롱', '한결', '나래'];
const who = i => ({ actor: PEOPLE[i % PEOPLE.length], name: NAMES[i % NAMES.length] });
const SHOPS = [
  { title: '섬마을 식당', what: '식당', lines: ['어서 와요! 울릉도에서는 따개비밥과 홍합밥을 많이 먹어요.', '바위에 붙어 사는 따개비를 넣어 지은 밥이에요. 바다가 가까운 섬이라 바다에서 나는 재료가 많지요.'] },
  { title: '호박엿 가게', what: '기념품 가게', lines: ['울릉도 호박엿 맛보고 가요! 울릉도의 이름난 먹거리예요.', '다른 지역 기념품을 사기 전에 ‘이 지역에서 난 것인지’ 살펴보면 좋아요.'] },
  { title: '산나물 가게', what: '나물 가게', lines: ['봄이면 산에서 명이나물을 뜯어요. 울릉도 산나물로 이름이 났지요.', '산나물은 다 뜯지 않고 뿌리를 남겨 둬야 이듬해에 또 나요.'] },
  { title: '바다 카페', what: '카페', lines: ['창가에 앉으면 도동항에 배가 들어오는 게 보여요.', '독도행 배는 날씨가 나쁘면 뜨지 못하는 날도 있어요. 파도를 잘 살펴야 해요.'] },
  { title: '오징어 가게', what: '건어물 가게', lines: ['울릉도는 오징어로 이름난 섬이에요. 가을이면 집집마다 오징어를 널어 말렸지요.', '요즘은 바다가 바뀌어서 예전만큼 많이 잡히지 않는대요.'] },
  { title: '섬 마트', what: '마트', lines: ['섬에서는 물건 대부분이 배로 들어와요. 바람이 세서 배가 못 오면 물건이 늦게 와요.', '그래서 섬사람들은 날씨 소식에 늘 귀를 기울여요.'] }
];
const HOME_TALK = [
  ['울릉도는 눈이 아주 많이 와. 그래서 옛 집은 처마 끝에 우데기를 둘러 눈을 막았단다.', '우데기 안쪽 길로 다니면 눈이 쌓여도 집 안팎을 오갈 수 있었지.'],
  ['울릉도에서 가장 높은 봉우리는 성인봉이야. 맑은 날 올라가면 섬 전체가 보여.', '섬이 화산으로 생겨서 산이 바다에서 곧바로 솟아 있단다. 그래서 평평한 땅이 적어.'],
  ['도동은 좁은 골짜기를 따라 집이 빼곡하게 들어선 마을이야.', '땅이 좁아서 집을 위로 높이 쌓았지. 창밖으로 보면 지붕 색이 알록달록해.'],
  ['아침마다 항구에 독도행 배가 들어오는지 창밖을 봐.', '맑은 날에는 울릉도 높은 곳에서 독도가 보이기도 한대.'],
  ['우리 할아버지는 오징어잡이 배를 타셨어. 밤바다에 집어등을 환하게 켜고 나가셨지.', '불빛을 보고 오징어가 모여든대.']
];
const home = i => [
  { label: '1층 · 거실', art: ['wwwyywwwwyywww', 'wkk___o___q_Uw', 'w__tt________w', 'w__tt__mmmm0_w', 'w______mmmm__w', 'wq_____a__1__w', 'wwwwwwwDwwwwww'],
    objects: () => ({ 0: { type: 'person', ...who(i), lines: HOME_TALK[i % HOME_TALK.length] }, 1: { type: 'sign', name: '창가 화분', furniture: 'plant', lines: ['창가에 놓인 화분에 명이나물 싹이 돋았어요.'] } }) },
  { label: '2층 · 방', art: ['wwwyywwwwwwwww', 'we__k0k_____Nw', 'we___________w', 'w___mmmm__1__w', 'wq__mmmm_____w', 'wwwwwwwwwwwwww'],
    objects: z => ({ 0: { type: 'sign', name: '책꽂이', furniture: 'shelf', lines: book(z, 5 + i) }, 1: { type: 'person', ...who(i + 7), lines: ['내 방에 온 걸 환영해! 창밖으로 골목이 다 보여.', HOME_TALK[(i + 2) % HOME_TALK.length][0]] } }) }
];
const shop = (i, upstairs) => {
  const s = SHOPS[i % SHOPS.length], f1 = { label: `1층 · ${s.what}`, art: ['wwyywwwwwwyyww', `wkk_cccc0__k${upstairs ? 'U' : 'q'}w`, 'w____________w', 'w_tt___tt__1_w', 'w_tt___tt____w', 'wq_____a____qw', 'wwwwwwwDwwwwww'],
    objects: () => ({ 0: { type: 'person', ...who(i + 3), name: `${s.what} 주인 ${NAMES[(i + 3) % NAMES.length]}`, lines: s.lines }, 1: { type: 'person', ...who(i + 11), name: `손님 ${NAMES[(i + 11) % NAMES.length]}`, lines: ['여기 단골이야. 탐험하다 배고프면 들러!', '울릉도에 오면 꼭 바닷가 산책로도 걸어 봐. 절벽 밑으로 길이 나 있어.'] } }) };
  if (!upstairs) return [f1];
  return [f1, { label: '2층 · 민박', art: ['wwwyywwwwwyyww', 'we_e_e__0___Nw', 'w____________w', 'w__mmmm___1__w', 'wq_mmmm______w', 'wwwwwwwwwwwwww'],
    objects: () => ({ 0: { type: 'rest', name: '민박 이불', furniture: 'futon' }, 1: { type: 'person', ...who(i + 5), name: `여행자 ${NAMES[(i + 5) % NAMES.length]}`, lines: ['나는 독도에 가려고 며칠째 묵고 있어. 파도가 높아서 배가 못 떴거든.', '독도는 날씨가 좋아야 배가 섬에 닿을 수 있어. 기다리는 것도 여행이야!'] } }) }];
};
const TERMINAL = [
  { label: '1층 · 대합실', art: ['wwyyyywwyyyyww', 'wccc0ccc___kUw', 'w____________w', 'w_ssss__ssss_w', 'w____________w', 'w_ssss1_ssss_w', 'wq_____a__2_qw', 'wwwwwwwDwwwwww'],
    objects: () => ({ 0: { type: 'person', actor: 'woman', name: '매표 창구 직원', lines: ['독도행 배표는 여기서 사요. 배는 동도 선착장에 닿아요.', '파도가 높으면 배가 선착장에 대지 못하고 섬 둘레만 돌아 나오기도 해요. 날씨를 꼭 확인해요.'] }, 1: { type: 'person', actor: 'man', name: '여행객 해람', lines: ['울릉도에서 독도까지는 약 87.4km래. 배로 한참 가야 해.', '배 안에서 멀미하지 않게 창밖 수평선을 보면 좋대.'] }, 2: { type: 'sign', name: '출항 안내판', furniture: 'board', lines: ['출항 안내: 배 시간은 계절과 날씨에 따라 바뀌어요.', '독도에 내릴 수 있는지는 그날 바다 사정에 따라 정해져요.'] } }) },
  { label: '2층 · 전망 데크', art: ['wyyyyyyyyyyyyw', 'w__0_____1__Nw', 'w____________w', 'w___mmmmmm___w', 'wq__mmmmmm__qw', 'wwwwwwwwwwwwww'],
    objects: () => ({ 0: { type: 'landmark', name: '바다 쪽 큰 창', furniture: 'window', lines: ['좁은 만 양쪽으로 가파른 산이 솟아 있고, 그 사이로 배가 드나들어요.', '만 입구 쪽 물가에는 파도를 막는 소파블록이 쌓여 있어요.'] }, 1: { type: 'person', actor: 'child-boy', name: '배 구경하는 아이 바다', lines: ['큰 배가 들어올 때 물결이 출렁출렁해! 소파블록이 파도를 막아 줘.', '저기 절벽 밑 산책로로 사람들이 걸어가는 게 보여.'] } }) }
];
// 건물 하나(kind·그림 번호 v·순서 i)에 들어갈 이름과 층 계획
export function structurePlan(kind, v, i) {
  if (kind === 'terminal') return { title: '도동항 여객선터미널', floors: TERMINAL };
  if (kind === 'block') { const s = SHOPS[i % SHOPS.length]; return { title: s.title, floors: shop(i, true) }; }
  if (v === 1 || v === 4) { const s = SHOPS[i % SHOPS.length]; return { title: s.title, floors: shop(i, false) }; }
  return { title: `${NAMES[i % NAMES.length]}네 집`, floors: home(i) };
}
export function structureRooms(zone, list) {
  const out = []; for (const s of list) { const p = structurePlan(s.kind, s.v, s.i); p.floors.forEach((f, k) => out.push(roomDef(zone, s.room, p.title, p.floors, f, k))); } return out;
}
