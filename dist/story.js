// ─────────────────────────────────────────────────────────────────────────────
// 컷신 대본 (v0.22) — 대사와 장면을 여기에서 고치면 게임에 바로 반영됩니다.
//
// 장면(scene)
//   bg       배경 이름: stage(시상식) sea(배 위) dock(선착장) field(풀밭) crisis(위기) title(지역 소개)
//   caption  화면 왼쪽 위에 잠깐 보이는 장면 제목
//   cast     등장인물. who: 'player'(주인공) | 'actor:professor' 같은 인물 그림 | 'monster:67' 같은 독도몬
//            x, y는 320×180 장면 안의 발 위치, dir은 down·left·right·up, size는 키(기본 52)
//            hidden: true면 처음엔 숨기고, cue로 등장시킵니다. walkTo:[x,y], walkMs로 걸어 들어옵니다.
//   start    장면이 시작될 때 실행할 연출(cue) 목록
//   lines    대사 목록
//
// 대사(line)
//   who      화자 이름. '@player'는 주인공('나'), null은 해설
//   text     대사. {starter}처럼 쓰면 고른 독도몬 이름이 들어갑니다. {starter}와(과)처럼 조사도 맞춰 줍니다.
//   cue      대사가 시작될 때 연출: confetti spot jump glint rustle pop surprise aura device panel:sea …
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
      bg: 'sea', caption: '독도로 향하는 배',
      cast: [{ id: 'player', who: 'player', x: 196, y: 117, dir: 'right', size: 40 }],
      lines: [
        { who: '안내 방송', text: '잠시 후 독도에 도착합니다.' },
        { who: '안내 방송', text: '독도는 동도와 서도, 그리고 주변의 여러 바위섬으로 이루어진 아름다운 섬입니다.' },
        { who: '@player', text: '드디어 독도다! 사진으로만 봤는데 정말 멋지다!' },
        { who: null, text: '그때, 바다 위에서 신비한 푸른빛이 잠깐 나타났다가 사라졌다.', cue: 'glint' },
        { who: '@player', text: '어? 방금 저 빛은 뭐였지?', cue: 'surprise' }
      ]
    },
    {
      bg: 'dock', caption: '독도 · 동도 선착장',
      cast: [
        { id: 'player', who: 'player', x: 112, y: 140, dir: 'right' },
        { id: 'kim', who: 'actor:professor', x: 340, y: 140, dir: 'left', walkTo: [206, 140], walkMs: 1700 }
      ],
      lines: [
        { who: '김박사', text: '독도에 오신 것을 환영합니다!' },
        { who: '김박사', text: '저는 독도의 자연과 생물을 연구하고 있는 김박사라고 합니다.' },
        { who: '김박사', text: '혹시 이번 독도 사랑 대회에서 우승한 학생인가요?' },
        { who: '@player', text: '네! 그런데 제가 누군지 어떻게 아세요?' },
        { who: '김박사', text: '하하! 이야기를 많이 들었거든요.' },
        { who: '김박사', text: '독도를 무척 사랑하고, 독도에 관해서도 아주 많이 알고 있는 학생이라고요.' },
        { who: '김박사', text: '사실 오늘 여러분을 기다리고 있었습니다.' }
      ]
    },
    {
      bg: 'field', caption: '선착장 옆 풀밭',
      start: ['rustle'],
      cast: [
        { id: 'player', who: 'player', x: 104, y: 140, dir: 'right' },
        { id: 'kim', who: 'actor:professor', x: 176, y: 140, dir: 'left' },
        { id: 'mon', who: 'monster:67', x: 252, y: 134, size: 46, hidden: true }
      ],
      lines: [
        { who: '@player', text: '으악! 저건 뭐예요?!', cue: 'pop' },
        { who: '김박사', text: '놀라지 마세요. 이 친구는 독도몬입니다.', cue: 'kim-turn' },
        { who: '김박사', text: '최근 독도에서는 독도에 살아가는 생물의 모습을 닮은 신비한 생명체들이 나타나고 있습니다.' },
        { who: '김박사', text: '저희는 이 친구들을 독도몬이라고 부르고 있어요.' },
        { who: '@player', text: '독도몬이요? 처음 보는 생명체인데요?' },
        { who: '김박사', text: '맞아요. 아직 어디에서 왔는지, 왜 갑자기 나타났는지 정확히 밝혀지지 않았답니다.' }
      ]
    },
    {
      bg: 'crisis', caption: '독도가 마주한 위기',
      start: ['panel:sea'],
      cast: [],
      lines: [
        { who: '김박사', text: '그런데 최근 이상한 일이 발생하고 있습니다.', cue: 'panel:sea' },
        { who: '김박사', text: '일부 사람들이 독도의 자연을 훼손하고, 독도에 관한 잘못된 정보를 퍼뜨리고 있어요.', cue: 'panel:rock' },
        { who: '김박사', text: '심지어 독도몬을 나쁜 목적으로 이용하려는 사람들까지 나타났습니다.', cue: 'panel:grass' },
        { who: '김박사', text: '그들이 나타난 곳에서는 독도몬들이 검은 기운에 휩싸여 난폭해지고 있습니다.', cue: 'aura' },
        { who: '@player', text: '그럼 독도몬과 독도 모두 위험한 거잖아요!' },
        { who: '김박사', text: '맞아요. 그래서 독도에 관해 잘 알고, 독도를 사랑하는 여러분의 도움이 필요합니다.' }
      ]
    },
    {
      bg: 'dock', caption: '모험의 시작',
      cast: [
        { id: 'player', who: 'player', x: 128, y: 140, dir: 'right' },
        { id: 'kim', who: 'actor:professor', x: 196, y: 140, dir: 'left' }
      ],
      lines: [
        { who: '김박사', text: '독도의 자연과 역사를 조사하고, 독도몬에게 일어난 이상 현상의 원인을 밝혀 주세요.' },
        { who: '김박사', text: '모험을 하다 보면 독도를 지켜 온 사람들의 이야기와 신비로운 비밀을 발견하게 될 거예요.' },
        { who: '김박사', text: '위험한 조사에는 제가 개발한 특별한 탐사 장치도 사용할 수 있습니다.', cue: 'device' },
        {
          who: '김박사', text: '저와 함께 독도의 비밀을 밝혀 보겠어요?',
          choice: [
            { label: '좋아요! 제가 도와드릴게요!', reply: [{ who: '김박사', text: '역시! 듬직한 대답이에요.' }] },
            { label: '독도몬에 관해 더 알고 싶어요!', reply: [{ who: '김박사', text: '좋아요! 직접 함께 다니며 알아 가는 게 가장 좋은 방법이죠.' }] }
          ]
        },
        { who: '김박사', text: '정말 고마워요!' },
        { who: '김박사', text: '하지만 이 모험을 혼자 떠날 수는 없겠죠?' },
        { who: '김박사', text: '여러분과 함께할 든든한 독도몬을 소개해 드릴게요!' }
      ]
    }
  ]
};

// 독도몬을 고른 뒤 김박사의 조작 안내. {starter}는 고른 독도몬 이름입니다.
export const GUIDE = {
  id: 'guide',
  scenes: [
    {
      bg: 'dock', caption: '첫 번째 동료',
      cast: [
        { id: 'player', who: 'player', x: 120, y: 140, dir: 'right' },
        { id: 'buddy', who: 'monster:{starterId}', x: 82, y: 142, size: 40 },
        { id: 'kim', who: 'actor:professor', x: 196, y: 140, dir: 'left' }
      ],
      lines: [
        { who: '김박사', text: '이제 준비가 끝났군요! {starter}와(과) 함께라면 든든하겠어요.' },
        { who: '김박사', text: '방향키나 화면의 이동 조작으로 움직일 수 있습니다.' },
        { who: '김박사', text: '사람들에게 말을 걸면 새로운 정보를 얻거나 임무를 받을 수 있어요.' },
        { who: '김박사', text: '야생 독도몬을 만나면 ‘싸우기’를 골라 문제를 풀어요. 정답이 독도몬의 힘이 된답니다.' },
        { who: '김박사', text: '그럼 먼저 주변을 둘러보고 독도몬에 관한 단서를 찾아봅시다!' }
      ]
    }
  ]
};

// 처음 도착한 마을에서 보여 주는 짧은 지역 소개(0번 마을은 오프닝이 대신합니다).
export const ARRIVALS = [
  null,
  '동도의 가장 높은 곳, 우산봉. 바람 속에서 오래된 이름이 들려오는 것 같다.',
  '바다를 향해 솟은 한반도바위. 오늘은 눈에 보이는 것부터 차근차근 적어 보자.',
  '다리를 건너 서도에 왔다. 탕건봉 아래 서고에서 기록을 넘기는 소리가 들린다.',
  '바다 건너 가제바위가 보인다. 예전엔 이곳에서 강치 울음소리가 들렸다고 한다.',
  '코끼리를 닮은 바위가 바다로 코를 내밀고 있다. 이곳 사람들은 오래된 문서를 지키고 있다.',
  '서도의 해안 골짜기, 물골. 이곳에서 이어진 사람들의 삶을 만나 보자.',
  '마침내 대한봉. 백무단의 대표가 정상에서 기다리고 있다.'
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

// 전설의 독도몬 강치를 만날 때.
export const LEGEND = {
  id: 'legend',
  scenes: [{
    bg: 'sea', caption: '기억의 바다', start: ['night'],
    cast: [{ id: 'gangchi', who: 'monster:100', x: 214, y: 132, size: 64, hidden: true }],
    lines: [
      { who: null, text: '공백 장치가 멈추자, 파도 위로 푸른빛이 다시 피어올랐다.', cue: 'glint' },
      { who: null, text: '흩어졌던 강치의 기록이 하나로 이어진다…', cue: 'rise' },
      { who: '김박사', text: '탐사 장치가 강치의 기억을 보여 주고 있어요. 실제 강치는 남획으로 사라졌다는 것, 잊지 말아요.' }
    ]
  }]
};
