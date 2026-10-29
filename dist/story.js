// ─────────────────────────────────────────────────────────────────────────────
// 컷신 대본 (v0.37: 울릉도에서 시작, 우산몬) — 대사와 장면을 여기에서 고치면 게임에 바로 반영됩니다.
//
// 장면(scene)
//   bg       배경 이름: stage(시상식) sea(배 위) dock(선착장) field(풀밭) crisis(위기: panel:dig 울릉도 공사·sea·rock·grass) title(지역 소개) summit(대한봉 정상) camp(김박사 연구 기지)
//   island   'ulleung'이면 뒤쪽 풍경이 독도 바위 대신 울릉도의 초록 산이에요(1장은 울릉도 도동항).
//   caption  화면 왼쪽 위에 잠깐 보이는 장면 제목
//   cast     등장인물. who: 'player'(주인공) | 'actor:professor' 같은 인물 그림 | 'monster:67' 같은 우산몬
//            x, y는 320×180 장면 안의 발 위치, dir은 down·left·right·up, size는 키(기본 52)
//            hidden: true면 처음엔 숨기고, cue로 등장시킵니다. walkTo:[x,y], walkMs로 걸어 들어옵니다.
//            comeTo:[x,y]는 'come:아이디' 연출 때 걸어갈 곳, aura: true면 검은 기운이 감돕니다('calm:아이디'로 걷힘).
//   start    장면이 시작될 때 실행할 연출(cue) 목록
//   lines    대사 목록
//
// 대사(line)
//   who      화자 이름. '@player'는 주인공('나'), null은 해설
//   text     대사. {starter}처럼 쓰면 고른 우산몬 이름이 들어갑니다. {starter}와(과)처럼 조사도 맞춰 줍니다.
//   cue      대사가 시작될 때 연출: confetti spot jump glint rustle pop surprise aura device panel:sea …
//            summit 전용: machine(장치 가동) blueprint(설계도) dark(검은 기운) machine-off(장치 정지) records(기록 복구)
//            인물 연출: show:아이디(빛기둥과 함께 등장) hop:아이디(폴짝) come:아이디(comeTo로 이동) calm:아이디(검은 기운 걷힘)
//            큰 그림: picture:professor(김박사 그림이 옆에서 들어옴) picture-off(사라짐) · camp 전용: glow(받침대 빛)
//   choice   선택지 [{ label, reply: [대사…] }] — 고른 뒤 reply를 보여 주고 다음 대사로 이어집니다.
//
// 역사 인물과의 만남은 김박사의 탐사 장치가 보여 주는 ‘기억의 세계’로 표현합니다(실제 시간 여행이 아님).
// ─────────────────────────────────────────────────────────────────────────────

export const OPENING = {
  id: 'opening',
  scenes: [
    {
      bg: 'stage', caption: '독도 사랑 대회 시상식',
      cast: [
        { id: 'player', who: 'player', x: 148, y: 134, dir: 'down' },
        { id: 'mc', who: 'actor:man', x: 222, y: 134, dir: 'left' }
      ],
      lines: [
        { who: '사회자', text: '축하합니다! 이번 독도 사랑 대회에서 대상을 수상한 학생입니다!', cue: 'confetti' },
        { who: '사회자', text: '대상 수상자에게는 특별한 선물이 주어집니다.' },
        { who: '사회자', text: '바로 우리나라의 아름다운 섬, 독도를 직접 방문할 수 있는 기회입니다!', cue: 'spot' },
        { who: '@player', text: '우와! 내가 독도에 간다고?', cue: 'jump' }
      ]
    },
    {
      bg: 'sea', caption: '울릉도로 향하는 배', island: 'ulleung',
      cast: [{ id: 'player', who: 'player', x: 196, y: 117, dir: 'right', size: 40 }],
      lines: [
        { who: '안내 방송', text: '잠시 후 울릉도 도동항에 도착합니다.' },
        { who: '안내 방송', text: '독도로 가시는 분은 도동항에서 독도행 여객선으로 갈아타시기 바랍니다.' },
        { who: '@player', text: '저기가 울릉도구나! 산이 정말 높고 푸르다!' },
        { who: null, text: '그때, 바다 위에서 신비한 푸른빛이 잠깐 나타났다가 사라졌다.', cue: 'glint' },
        { who: '@player', text: '어? 방금 저 빛은 뭐였지?', cue: 'surprise' }
      ]
    },
    {
      bg: 'dock', caption: '울릉도 · 도동항', island: 'ulleung',
      cast: [
        { id: 'player', who: 'player', x: 112, y: 140, dir: 'right' },
        { id: 'kim', who: 'actor:professor', x: 340, y: 140, dir: 'left', walkTo: [206, 140], walkMs: 1700 }
      ],
      lines: [
        { who: '김박사', text: '울릉도 도동항에 오신 것을 환영합니다!' },
        { who: '김박사', text: '저는 독도의 자연과 생물을 연구하고 있는 김박사라고 합니다.', cue: 'picture:professor' },
        { who: '김박사', text: '혹시 이번 독도 사랑 대회에서 우승한 학생인가요?' },
        { who: '@player', text: '네! 그런데 제가 누군지 어떻게 아세요?', cue: 'picture-off' },
        { who: '김박사', text: '하하! 이야기를 많이 들었거든요.' },
        { who: '김박사', text: '독도를 무척 사랑하고, 독도에 관해서도 아주 많이 알고 있는 학생이라고요.' },
        { who: '김박사', text: '사실 오늘 여러분을 기다리고 있었습니다. 독도에 가기 전에 꼭 보여 줄 것이 있거든요.' }
      ]
    },
    {
      bg: 'field', caption: '도동항 옆 풀밭', island: 'ulleung',
      start: ['rustle'],
      cast: [
        { id: 'player', who: 'player', x: 104, y: 140, dir: 'right' },
        { id: 'kim', who: 'actor:professor', x: 176, y: 140, dir: 'left' },
        { id: 'mon', who: 'monster:67', x: 252, y: 134, size: 46, hidden: true }
      ],
      lines: [
        { who: '@player', text: '으악! 저건 뭐예요?!', cue: 'pop' },
        { who: '김박사', text: '놀라지 마세요. 이 친구는 우산몬입니다.', cue: 'kim-turn' },
        { who: '김박사', text: '얼마 전부터 울릉도와 독도 곳곳에서 두 섬의 생물을 닮은 신비한 생명체들이 나타나고 있어요.' },
        { who: '김박사', text: '옛날 울릉도와 독도를 아우르던 나라, 우산국의 이름을 따서 우산몬이라고 부르기로 했답니다.' },
        { who: '@player', text: '우산국이요? 비 올 때 쓰는 그 우산이요?', cue: 'surprise' },
        { who: '김박사', text: '하하, 비를 막아 주진 않아요. 512년 신라의 이사부가 복속시킨 바로 그 나라예요.' },
        { who: '김박사', text: '이 괭이갈매기 우산몬처럼, 우산몬들은 울릉도와 독도를 모두 집으로 삼고 있어요.' },
        { who: '@player', text: '그런데 어디에서 왔는지는 알아요?' },
        { who: '김박사', text: '아직 아무도 몰라요. 왜 갑자기 나타났는지도 밝혀지지 않았답니다.' }
      ]
    },
    {
      bg: 'crisis', caption: '두 섬이 마주한 위기',
      start: ['panel:dig'],
      cast: [],
      lines: [
        { who: '김박사', text: '그런데 요즘 울릉도에서 수상한 공사가 시작됐어요.', cue: 'panel:dig' },
        { who: '김박사', text: '몽땅랜드 컴퍼니라는 회사가 숲을 파헤치고, 바닷가에 출입 금지 가림막을 세우고 있지요.' },
        { who: '김박사', text: '울릉도만이 아니에요. 몽땅랜드 배가 독도 바위 근처까지 드나든다는 소식도 들려요.', cue: 'panel:sea' },
        { who: '김박사', text: '그 무렵부터 두 섬에 관한 기록이 하얗게 지워지고, 잘못된 정보까지 퍼지고 있어요.', cue: 'panel:rock' },
        { who: '김박사', text: '그리고 일부 우산몬이 검은 기운에 휩싸여 사나워지기 시작했어요.', cue: 'aura' },
        { who: '김박사', text: '몽땅랜드가 사나워진 우산몬을 모으고 다닌다는 소문도 있고요.', cue: 'panel:grass' },
        { who: '@player', text: '그럼 울릉도도, 독도도, 우산몬도 모두 위험한 거잖아요!' },
        { who: '김박사', text: '맞아요. 하지만 방법이 있어요. 결투로 마음을 맞대면 검은 기운을 걷어 낼 수 있거든요.' },
        { who: '김박사', text: '그래서 두 섬을 잘 알고, 아끼는 여러분의 도움이 필요해요.' }
      ]
    },
    {
      bg: 'dock', caption: '모험의 시작', island: 'ulleung',
      cast: [
        { id: 'player', who: 'player', x: 128, y: 140, dir: 'right' },
        { id: 'kim', who: 'actor:professor', x: 196, y: 140, dir: 'left' }
      ],
      lines: [
        { who: '김박사', text: '먼저 여기 도동항에서 몽땅랜드가 무슨 일을 꾸미는지 살펴봐요.' },
        { who: '김박사', text: '그다음 독도행 배를 타고 건너가, 두 섬의 자연과 역사를 조사하며 우산몬이 사나워진 까닭을 밝혀 주세요.' },
        { who: '김박사', text: '모험을 하다 보면 독도를 지켜 온 사람들의 이야기와 신비로운 비밀을 발견하게 될 거예요.' },
        { who: '김박사', text: '위험한 조사에는 제가 개발한 특별한 탐사 장치도 사용할 수 있습니다.', cue: 'device' },
        {
          who: '김박사', text: '저와 함께 울릉도와 독도를 지켜 보겠어요?',
          choice: [
            { label: '좋아요! 제가 도와드릴게요!', reply: [{ who: '김박사', text: '역시! 듬직한 대답이에요.' }] },
            { label: '우산몬에 관해 더 알고 싶어요!', reply: [{ who: '김박사', text: '좋아요! 직접 함께 다니며 알아 가는 게 가장 좋은 방법이죠.' }] }
          ]
        },
        { who: '김박사', text: '정말 고마워요!' },
        { who: '김박사', text: '하지만 이 모험을 혼자 떠날 수는 없겠죠?' },
        { who: '김박사', text: '여러분과 함께할 든든한 우산몬을 소개해 드릴게요!' }
      ]
    }
  ]
};

// 오프닝 바로 뒤, 스타팅 우산몬 세 친구를 만나는 장면. 끝나면 고르는 창이 열립니다.
export const STARTER_MEET = {
  id: 'starters',
  scenes: [
    {
      bg: 'camp', caption: '김박사의 우산몬 연구 기지 · 울릉도', island: 'ulleung',
      cast: [
        { id: 'player', who: 'player', x: 52, y: 152, dir: 'right' },
        { id: 'kim', who: 'actor:professor', x: 108, y: 152, dir: 'right' },
        { id: 's1', who: 'monster:1', x: 196, y: 144, size: 42, hidden: true },
        { id: 's2', who: 'monster:67', x: 244, y: 144, size: 42, hidden: true },
        { id: 's3', who: 'monster:66', x: 292, y: 144, size: 42, hidden: true }
      ],
      lines: [
        { who: '김박사', text: '여기는 제 연구 기지예요. 우산몬을 돌보며 관찰하는 곳이죠.' },
        { who: '@player', text: '받침대 세 개가 반짝이고 있어요!' },
        { who: '김박사', text: '이곳의 세 친구는 검은 기운에 물들지 않았어요. 한 친구씩 불러 볼게요!', cue: 'device' },
        { who: '김박사', text: '첫 번째, 해국! 바닷가 바위틈에서 보랏빛 꽃을 피우는 해국을 닮았어요.', cue: 'show:s1' },
        { who: null, text: '해국이 꽃잎을 활짝 펴며 인사했다.', cue: 'hop:s1' },
        { who: '김박사', text: '두 번째, 괭이갈매기! 울릉도와 독도 하늘을 누비는 바닷새를 닮았지요.', cue: 'show:s2' },
        { who: '@player', text: '고양이처럼 우는 그 새요? 날개가 정말 멋져요!', cue: 'hop:s2' },
        { who: '김박사', text: '세 번째, 독도새우! 울릉도와 독도 둘레의 깊고 차가운 바다에 사는 새우를 닮았어요.', cue: 'show:s3' },
        { who: '@player', text: '긴 더듬이가 쫑긋쫑긋해요. 다들 너무 귀엽다!', cue: 'hop:s3' },
        { who: '김박사', text: '세 친구 모두 두 섬을 지키고 싶어 해요. 하지만 모험은 한 친구와 먼저 떠나야 해요.', cue: 'glow' },
        { who: '김박사', text: '마음이 가는 친구를 골라 주세요. 다른 친구들은 기지에서 응원할 거예요!' }
      ]
    }
  ]
};

// 우산몬을 고른 뒤: 고른 친구가 다가오고, 김박사가 조작을 안내합니다. {starter}는 고른 우산몬 이름입니다.
export const GUIDE = {
  id: 'guide',
  scenes: [
    {
      bg: 'camp', caption: '첫 번째 동료', island: 'ulleung',
      start: ['glow'],
      cast: [
        { id: 'player', who: 'player', x: 52, y: 152, dir: 'right' },
        { id: 'kim', who: 'actor:professor', x: 132, y: 152, dir: 'left' },
        { id: 'buddy', who: 'monster:{starterId}', x: 244, y: 144, size: 42, comeTo: [90, 156], walkMs: 1300 }
      ],
      lines: [
        { who: '김박사', text: '좋은 선택이에요! {starter}와(과) 함께라면 든든하겠어요.', cue: 'come:buddy' },
        { who: null, text: '{starter}이(가) 기쁜 듯 폴짝 뛰어와 곁에 섰다.', cue: 'hop:buddy' },
        { who: '@player', text: '잘 부탁해, {starter}!' }
      ]
    },
    {
      bg: 'dock', caption: '모험 준비', island: 'ulleung',
      cast: [
        { id: 'player', who: 'player', x: 120, y: 140, dir: 'right' },
        { id: 'buddy', who: 'monster:{starterId}', x: 82, y: 142, size: 40 },
        { id: 'kim', who: 'actor:professor', x: 196, y: 140, dir: 'left' }
      ],
      lines: [
        { who: '김박사', text: '방향키나 화면 왼쪽 아래 조이스틱으로 움직일 수 있어요. 가고 싶은 곳을 눌러도 돼요.' },
        { who: '김박사', text: '사람들에게 말을 걸면 새로운 정보를 얻거나 임무를 받을 수 있어요.' },
        { who: '김박사', text: '사나워진 우산몬을 만나면 ‘문제 풀기’를 눌러 독도 문제를 풀어요.' },
        { who: '김박사', text: '정답이 검은 기운을 걷어 내 줘요. 속성 상성이 좋은 상대라면 1.5배로 걷어 낼 수 있어요!' },
        { who: '김박사', text: '검은 기운이 모두 사라지면 우산몬은 원래대로 돌아온답니다.' },
        { who: '김박사', text: '…어라? 방금 제가 누구한테 방향키 이야기를 한 거죠? 우리 앞에는 아무도 없는데.', cue: 'surprise' },
        { who: '@player', text: '박사님, 연구를 너무 오래 하셨나 봐요.' },
        { who: '김박사', text: '하하, 그런가 봐요. 아무튼! 도동항을 둘러보며 몽땅랜드에 관한 단서부터 찾아봅시다!' }
      ]
    }
  ]
};

// 울릉도 도동항 ↔ 독도 동도 선착장 여객선. 처음 건널 때는 FERRY, 그다음부터는 짧은 장면이에요.
export const FERRY = {
  id: 'ferry',
  scenes: [{
    bg: 'sea', caption: '독도행 여객선',
    cast: [
      { id: 'player', who: 'player', x: 182, y: 117, dir: 'right', size: 40 },
      { id: 'kim', who: 'actor:professor', x: 152, y: 117, dir: 'right', size: 40 }
    ],
    lines: [
      { who: '안내 방송', text: '독도행 여객선이 도동항을 출발합니다. 독도는 울릉도에서 동남쪽으로 약 87km 떨어져 있습니다.' },
      { who: '김박사', text: '맑은 날에는 울릉도에서도 독도가 보여요. 오늘은 바다가 잔잔해서 다행이에요.' },
      { who: '김박사', text: '도동항에서 본 몽땅랜드 배도 이쪽으로 갔대요. 독도도 노리고 있는 게 분명해요.' },
      { who: null, text: '한참을 달리자, 수평선 위로 바위섬 두 개가 솟아올랐다.', cue: 'glint' },
      { who: '@player', text: '보여요! 저기 동도와 서도!', cue: 'jump' },
      { who: '안내 방송', text: '잠시 후 독도 동도 선착장에 도착합니다. 독도는 섬 전체가 천연보호구역이니 자연을 아껴 주세요.' }
    ]
  }]
};
export const FERRY_AGAIN = to => ({
  id: 'ferry',
  scenes: [{
    bg: 'sea', caption: to === 'dokdo' ? '독도행 여객선' : '울릉도행 여객선', island: to === 'dokdo' ? undefined : 'ulleung',
    cast: [{ id: 'player', who: 'player', x: 182, y: 117, dir: 'right', size: 40 }],
    lines: [{ who: '안내 방송', text: to === 'dokdo' ? '잠시 후 독도 동도 선착장에 도착합니다.' : '잠시 후 울릉도 도동항에 도착합니다.' }]
  }]
});

// 처음 도착한 마을에서 보여 주는 짧은 지역 소개(0번 마을은 오프닝이 대신합니다).
export const ARRIVALS = [
  null,
  '동도의 가장 높은 곳, 우산봉. 바람 속에서 오래된 이름이 들려오는 것 같다.',
  '바다를 향해 솟은 한반도바위. 오늘은 눈에 보이는 것부터 차근차근 적어 보자.',
  '다리를 건너 서도에 왔다. 탕건봉 아래 서고에서 기록을 넘기는 소리가 들린다.',
  '바다 건너 가제바위가 보인다. 예전엔 이곳에서 강치 울음소리가 들렸다고 한다.',
  '코끼리를 닮은 바위가 바다로 코를 내밀고 있다. 이곳 사람들은 오래된 문서를 지키고 있다.',
  '서도의 해안 골짜기, 물골. 이곳에서 이어진 사람들의 삶을 만나 보자.',
  '마침내 대한봉. 몽땅랜드의 백무 사장이 정상에서 기다리고 있다.'
];

export function arrivalScene(zone, zoneInfo, place) {
  return {
    id: `arrival-${zone}`,
    scenes: [{
      bg: 'title', caption: '', title: { kicker: `CHAPTER ${String(zone + 1).padStart(2, '0')} · ${place.island}`, name: place.name, sub: zoneInfo.subtitle },
      cast: [], lines: [{ who: null, text: ARRIVALS[zone] || zoneInfo.subtitle }]
    }]
  };
}

// 전설의 우산몬 강치를 만날 때.
export const LEGEND = {
  id: 'legend',
  scenes: [{
    bg: 'sea', caption: '기억의 바다', start: ['night'],
    cast: [{ id: 'gangchi', who: 'monster:100', x: 214, y: 132, size: 64, hidden: true }],
    lines: [
      { who: null, text: '멈춘 지우개 기계에서 풀려난 기록 조각들이 푸른빛이 되어 바다 위로 모여든다.', cue: 'glint' },
      { who: null, text: '흩어졌던 강치의 기록이 하나로 이어진다…', cue: 'rise' },
      { who: '김박사', text: '탐사 장치가 강치의 기억을 보여 주고 있어요. 실제 강치는 남획으로 사라졌다는 것, 잊지 말아요.' }
    ]
  }]
};

// ─────────────────────────────────────────────────────────────────────────────
// 몽땅랜드 이야기 (v0.24)
// 우산몬이 사나워진 까닭은 처음엔 아무도 모릅니다. 장마다 몽땅랜드의 말 속에 단서가 쌓이고,
// 대한봉 정상에서 진실이 밝혀집니다: 백무가 지우개 기계로 울릉도와 독도 생물의 기록을 읽어 우산몬을 만들었고
// (처음엔 울릉도 도동항 뒷산에서 시험해서 울릉도에도 우산몬이 있어요), 두 섬을 묶은 테마파크로 돈을 벌려고 장치를 무리하게 돌리다 검은 기운이 새어 나와 우산몬이 사나워진 것.
// ─────────────────────────────────────────────────────────────────────────────

// 마을 몽땅랜드와의 결투 전(before)·후(after) 대사. 화자는 그 장의 몽땅랜드 인물입니다.
export const VILLAIN_TALES = [
  { before: ['이 조사 상자는 우리 몽땅랜드가 접수한다!', '울릉도 뒷산엔 곧 우리 리조트가 들어설 거야. 사나워진 우산몬은 사장님께 데려가면 상금이 두둑하지!'],
    after: ['윽, 진정시켜 버리다니… 사장님 장치에 넣을 기록도 놓쳤잖아!', '독도로 먼저 건너간 팀장님들한테 혼나겠네….'] },
  { before: ['오래된 지도는 전부 가져간다. 표시가 많으면 공사하기 불편하거든!'],
    after: ['공사? 울릉도에서만 하는 줄 알았지? 아, 아무것도 아냐! 못 들은 걸로 해!'] },
  { before: ['관찰 일지? 필요 없어. 보기 좋은 이야기만 있으면 손님이 몰려온다고!'],
    after: ['손님… 아차, 또 말해 버렸네. 사장님이 비밀이라고 하셨는데.'] },
  { before: ['나는 먹선 팀장. 문장은 잘라서 보여 줘야 사람들이 원하는 대로 믿지.'],
    after: ['사장님은 모은 기록으로 우산몬을 만들어 내신다. 울릉도 생물이든 독도 생물이든.', '기록이 하얗게 지워지는 건… 그 대가일 뿐이야.'] },
  { before: ['나는 쇄도 팀장. 강치처럼 사라진 생물? 사장님 장치라면 얼마든지 새로 만들 수 있어!'],
    after: ['…요즘 장치에서 검은 연기가 새어 나와. 그 뒤로 우산몬들이 사나워지기 시작했지.', '사장님은 별일 아니라고 하셨지만… 나도 잘 모르겠어.'] },
  { before: ['칙령이든 보고서든, 필요 없는 기록은 지워 버리면 그만이야.'],
    after: ['사장님 책상에서 큰 설계도를 봤어. 울릉도엔 호텔이, 독도엔 놀이기구가 빼곡히 그려져 있었지…'] },
  { before: ['…….', '말은 필요 없다. 사장님의 계획은 이미 시작됐다.'],
    after: ['장치를 멈추지 않으면 우산몬들은 계속 사나워질 거다.', '대한봉 정상으로 가라. 사장님은… 듣지 않으시겠지만.'] },
  null // 8장은 아래 BOSS_REVEAL / BOSS_FALL 컷신
];

const SUMMIT_CAST = [
  { id: 'kim', who: 'actor:professor', x: 54, y: 150, dir: 'right' },
  { id: 'player', who: 'player', x: 90, y: 150, dir: 'right' },
  { id: 'boss', who: 'actor:villain-leader', x: 204, y: 148, dir: 'left', size: 58 },
  { id: 'g1', who: 'actor:villain-grunt-m', x: 252, y: 142, dir: 'left', size: 46 },
  { id: 'g2', who: 'actor:villain-grunt-f', x: 286, y: 144, dir: 'left', size: 46 }
];
// 백무 사장이 데리고 있는 전설의 우산몬 사철나무 (처음엔 숨어 있다가 show:tree로 등장).
const SUMMIT_TREE = { id: 'tree', who: 'monster:18', x: 150, y: 152, size: 46, hidden: true, aura: true };

// 대한봉 정상, 백무 사장과의 결투 직전.
export const BOSS_REVEAL = {
  id: 'boss-reveal',
  scenes: [{
    bg: 'summit', caption: '대한봉 정상', start: ['machine'], cast: [...SUMMIT_CAST, SUMMIT_TREE],
    lines: [
      { who: null, text: '대한봉 정상. 거대한 장치가 보랏빛 연기를 뿜으며 웅웅거린다.' },
      { who: null, text: '뒤따라 올라온 김박사가 숨을 고른다.' },
      { who: '백무 사장', text: '드디어 왔군, 꼬마 탐험대원. 여기까지 올라오다니 제법이야.' },
      { who: '김박사', text: '당신이 몽땅랜드 컴퍼니의 사장이었군요. 저 장치는 대체 뭐죠?' },
      { who: '백무 사장', text: '내가 만든 지우개 기계일세. 울릉도와 독도 생물의 기록을 읽어 우산몬을 만들어 내지.' },
      { who: '@player', text: '우산몬을… 만들었다고요?', cue: 'surprise' },
      { who: '백무 사장', text: '처음엔 울릉도에서 시험했지. 도동항 뒷산의 기록에서 첫 우산몬들이 태어났다네.' },
      { who: '김박사', text: '그래서 울릉도에도 우산몬이 있었군요. 장치가 읽은 기록은 하얗게 지워지고….' },
      { who: '백무 사장', text: '기록 몇 장쯤이야. 이걸 보게, ‘우산몬 테마파크’ 설계도라네!', cue: 'blueprint' },
      { who: '백무 사장', text: '울릉도엔 숲을 밀고 호텔과 케이블카, 독도엔 회전목마와 롤러코스터, 두 섬 사이 바닷속엔 수족관 터널! 손님이 줄을 서겠지.' },
      { who: '백무 사장', text: '그리고 이 녀석을 보게! 천장굴 위 사철나무의 기록으로 만든 전설의 우산몬이지.', cue: 'show:tree' },
      { who: '백무 사장', text: '백 년 넘게 바위에서 버틴 나무라니, 테마파크 입구에 세우면 딱이야!' },
      { who: '@player', text: '사철나무가 검은 기운 때문에 괴로워하고 있어요!', cue: 'surprise' },
      { who: '김박사', text: '독도의 사철나무는 천연기념물이에요. 기념품처럼 가져다 쓸 수 있는 게 아니에요!' },
      { who: '@player', text: '그래서 울릉도 숲을 파헤치고, 독도 길마다 바위를 깎았던 거예요?' },
      { who: '백무 사장', text: '공사 준비였지. 돈이 산더미처럼 쌓일 계획이었네.' },
      { who: '김박사', text: '그럼 우산몬이 사나워진 것도… 저 장치 때문인가요?' },
      { who: '백무 사장', text: '…우산몬을 서둘러 더 만들려고 장치를 무리하게 돌렸지.', cue: 'dark' },
      { who: '백무 사장', text: '그러자 검은 연기, 검은 기운이 새어 나오더군. 금방 가라앉을 줄 알았네.' },
      { who: '@player', text: '사나워진 우산몬들이 얼마나 괴로워했는데요!' },
      { who: '백무 사장', text: '무슨 소리! 사람들이 울릉도와 독도에 더 관심을 갖게 하려고 한 일이야.' },
      { who: '백무 사장', text: '나는 두 섬을 위해 한 거라고!' },
      { who: '김박사', text: '독도는 천연기념물 제336호예요. 섬 전체를 아껴 지키는 곳이죠.' },
      { who: '김박사', text: '그래서 방문객도 동도 선착장 근처까지만 들어갈 수 있어요.' },
      { who: '김박사', text: '울릉도의 숲도 마찬가지예요. 섬기린초처럼 두 섬에서만 자라는 특산식물이 그 숲과 바위에 기대어 살아요.' },
      {
        who: '김박사', text: '탐험대원, 백무에게 하고 싶은 말이 있나요?',
        choice: [
          { label: '관심을 핑계로 자연을 망가뜨리면 안 돼요!', reply: [{ who: '김박사', text: '맞아요. 한번 사라진 생물은 장치로 되돌릴 수 없어요. 강치가 그랬듯이요.' }] },
          { label: '독도를 위한다면 먼저 지켜야죠!', reply: [{ who: '김박사', text: '그래요. 진짜 관심은 정확히 알고 아끼는 데서 시작돼요.' }] }
        ]
      },
      { who: '백무 사장', text: '흥, 어린 녀석이 뭘 안다고! 장치야, 더 힘을 내라!', cue: 'dark' },
      { who: null, text: '장치에서 쏟아진 검은 기운이 사철나무와 우산몬들을 감싼다. 결투로 정화해야 한다!' }
    ]
  }]
};

// 백무 사장의 우산몬이 모두 원래대로 돌아온 뒤.
export const BOSS_FALL = {
  id: 'boss-fall',
  scenes: [{
    bg: 'summit', caption: '멈춘 장치', start: ['machine'], cast: SUMMIT_CAST,
    lines: [
      { who: null, text: '마지막 우산몬의 검은 기운이 걷히자, 지우개 기계가 불꽃을 튀기며 멈췄다.', cue: 'machine-off' },
      { who: '백무 사장', text: '말도 안 돼… 내 장치가, 내 테마파크가….' },
      { who: '김박사', text: '보세요. 하얗게 지워졌던 기록들이 다시 돌아오고 있어요.', cue: 'records' },
      { who: '백무 사장', text: '…나는 정말로 사람들이 울릉도와 독도를 더 많이 찾아 주길 바랐어. 처음엔 그랬다고.' },
      { who: '@player', text: '그럼 이번엔 두 섬을 망가뜨리지 않는 방법으로 알려 주세요.' },
      { who: '@player', text: '우리처럼 직접 배우고, 지키면서요.' },
      { who: '김박사', text: '관심은 소중해요. 하지만 그 관심이 자연을 해친다면, 두 섬을 위한 일이 아니에요.' },
      { who: '백무 사장', text: '…지켜야 알릴 수 있다라. 꼬마에게 한 수 배웠군.' },
      { who: '백무 사장', text: '울릉도 공사는 멈추겠네. 파헤친 숲에는 나무를 다시 심고, 지운 기록을 되돌리는 일도 돕겠어.' },
      { who: '백무 사장', text: '사나워졌던 우산몬들에게도 미안하구나.' },
      { who: '김박사', text: '우산몬들은 이제 원래대로 돌아왔어요. 어디서 왔든, 울릉도와 독도에서 함께 지켜 갈 친구들이에요.' },
      { who: null, text: '그때, 바다 쪽에서 푸른빛이 다시 피어올랐다….', cue: 'glint' }
    ]
  }]
};

// 백무 사장의 우산몬을 모두 정화한 뒤, 사철나무가 동료가 될 때.
export const TREE_JOINS = {
  id: 'tree-joins',
  scenes: [{
    bg: 'summit', caption: '되찾은 사철나무', start: ['machine-quiet'],
    cast: [
      { id: 'kim', who: 'actor:professor', x: 54, y: 150, dir: 'right' },
      { id: 'player', who: 'player', x: 90, y: 150, dir: 'right' },
      { id: 'tree', who: 'monster:18', x: 168, y: 146, size: 48, aura: true, comeTo: [122, 152], walkMs: 1200 },
      { id: 'boss', who: 'actor:villain-leader', x: 220, y: 148, dir: 'left', size: 58 }
    ],
    lines: [
      { who: null, text: '사철나무를 감싸던 마지막 검은 기운이 바람에 흩어졌다.', cue: 'calm:tree' },
      { who: '백무 사장', text: '그 나무는… 처음부터 내 것이 아니었지. 독도의 것이었어.' },
      { who: '김박사', text: '사철나무가 원래 살던 곳으로 돌아가려나 봐요. 동도 천장굴 위쪽 비탈이요.', cue: 'come:tree' },
      { who: null, text: '사철나무는 잎을 한 번 흔들고는, 금빛 바람을 타고 동도 쪽으로 날아갔다.', cue: 'hop:tree' },
      { who: '김박사', text: '전설의 우산몬은 쉽게 마음을 열지 않아요. 천장굴 길에서 다시 만나 ‘동료 만들기’로 함께하자고 해 봐요!' },
      { who: '김박사', text: '실제 사철나무는 동도 천장굴 위쪽 비탈에서 100년 넘게 자랐어요. 우리는 멀리서 지켜봐요.' }
    ]
  }]
};

// 대한봉 관장 인증 후, 엔딩 직전.
export const EPILOGUE = {
  id: 'epilogue',
  scenes: [{
    bg: 'dock', caption: '다시, 도동항', island: 'ulleung',
    cast: [
      { id: 'player', who: 'player', x: 120, y: 140, dir: 'right' },
      { id: 'kim', who: 'actor:professor', x: 196, y: 140, dir: 'left' }
    ],
    lines: [
      { who: '김박사', text: '수고했어요, 두 섬의 수호사님!' },
      { who: '김박사', text: '도동항 뒷산의 가림막이 걷혔어요. 몽땅랜드는 파헤친 숲에 나무를 다시 심고 있대요.' },
      { who: '김박사', text: '백무는 지운 기록을 되찾는 일을 돕고 있고요. 테마파크 설계도는 스스로 찢어 버렸답니다.' },
      { who: '김박사', text: '우산몬의 비밀은 밝혀졌지만, 진짜 울릉도와 독도를 지키는 일은 지금부터예요.' },
      { who: '@player', text: '오늘 배운 사실, 친구들에게 정확하게 전해 줄게요!' },
      { who: '김박사', text: '좋아요. 관심은 바르게 알고, 아끼고, 지키는 데서 시작된다는 걸 잊지 말아요.' }
    ]
  }]
};
