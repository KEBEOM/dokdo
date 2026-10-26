// ─────────────────────────────────────────────────────────────────────────────
// 컷신 대본 (v0.22) — 대사와 장면을 여기에서 고치면 게임에 바로 반영됩니다.
//
// 장면(scene)
//   bg       배경 이름: stage(시상식) sea(배 위) dock(선착장) field(풀밭) crisis(위기) title(지역 소개) summit(대한봉 정상)
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
//            summit 전용: machine(장치 가동) blueprint(설계도) dark(암흑 에너지) machine-off(장치 정지) records(기록 복구)
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
        { who: '김박사', text: '독도 곳곳이 훼손되고, 독도에 관한 잘못된 정보까지 퍼지고 있어요.', cue: 'panel:rock' },
        { who: '김박사', text: '그 무렵부터 일부 독도몬이 검은 기운, 암흑 에너지에 휩싸여 광포화되기 시작했어요.', cue: 'aura' },
        { who: '김박사', text: '왜 그렇게 되었는지는 아직 아무도 몰라요.' },
        { who: '김박사', text: '수상한 무리, 백무단이 광포화된 독도몬을 모으고 다닌다는 소문도 있고요.', cue: 'panel:grass' },
        { who: '@player', text: '그럼 독도몬과 독도 모두 위험한 거잖아요!' },
        { who: '김박사', text: '맞아요. 하지만 방법이 있어요. 결투로 마음을 맞대면 암흑 에너지를 걷어 낼 수 있거든요.' },
        { who: '김박사', text: '그래서 독도에 관해 잘 알고, 독도를 사랑하는 여러분의 도움이 필요합니다.' }
      ]
    },
    {
      bg: 'dock', caption: '모험의 시작',
      cast: [
        { id: 'player', who: 'player', x: 128, y: 140, dir: 'right' },
        { id: 'kim', who: 'actor:professor', x: 196, y: 140, dir: 'left' }
      ],
      lines: [
        { who: '김박사', text: '독도의 자연과 역사를 조사하고, 독도몬이 광포화된 원인을 밝혀 주세요.' },
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
        { who: '김박사', text: '광포화된 독도몬을 만나면 ‘정화하기’에서 기술을 골라 문제를 풀어요.' },
        { who: '김박사', text: '정답이 암흑 에너지를 걷어 내 줘요. 처음엔 기술이 두 가지지만, 자라면서 새 기술을 배워요.' },
        { who: '김박사', text: '암흑 에너지가 모두 사라지면 독도몬은 평온을 되찾는답니다.' },
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
      { who: null, text: '멈춘 공백 장치에서 풀려난 기록 조각들이 푸른빛이 되어 바다 위로 모여든다.', cue: 'glint' },
      { who: null, text: '흩어졌던 강치의 기록이 하나로 이어진다…', cue: 'rise' },
      { who: '김박사', text: '탐사 장치가 강치의 기억을 보여 주고 있어요. 실제 강치는 남획으로 사라졌다는 것, 잊지 말아요.' }
    ]
  }]
};

// ─────────────────────────────────────────────────────────────────────────────
// 백무단 이야기 (v0.24)
// 광포화의 원인은 처음엔 아무도 모릅니다. 장마다 백무단의 말 속에 단서가 쌓이고,
// 대한봉 정상에서 진실이 밝혀집니다: 백무가 공백 장치로 독도몬을 만들었고,
// 테마파크로 돈을 벌려고 장치를 무리하게 돌리다 암흑 에너지가 새어 나와 독도몬이 광포화된 것.
// ─────────────────────────────────────────────────────────────────────────────

// 마을 백무단과의 결투 전(before)·후(after) 대사. 화자는 그 장의 백무단 인물입니다.
export const VILLAIN_TALES = [
  { before: ['이 조사 상자는 우리 백무단이 접수한다!', '광포화된 독도몬이라도 상관없어. 대표님께 데려가면 상금이 두둑하거든!'],
    after: ['윽, 진정시켜 버리다니… 대표님 장치에 넣을 기록도 놓쳤잖아!'] },
  { before: ['오래된 지도는 전부 가져간다. 표시가 많으면 공사하기 불편하거든!'],
    after: ['공사? 아, 아무것도 아냐! 못 들은 걸로 해!'] },
  { before: ['관찰 일지? 필요 없어. 보기 좋은 이야기만 있으면 손님이 몰려온다고!'],
    after: ['손님… 아차, 또 말해 버렸네. 대표님이 비밀이라고 하셨는데.'] },
  { before: ['나는 간부 먹선. 문장은 잘라서 보여 줘야 사람들이 원하는 대로 믿지.'],
    after: ['대표님은 모은 기록으로 독도몬을 만들어 내신다.', '기록이 하얗게 지워지는 건… 그 대가일 뿐이야.'] },
  { before: ['나는 간부 쇄도. 강치처럼 사라진 생물? 대표님 장치라면 얼마든지 새로 만들 수 있어!'],
    after: ['…요즘 장치에서 검은 연기가 새어 나와. 그 뒤로 독도몬들이 광포화되기 시작했지.', '대표님은 별일 아니라고 하셨지만… 나도 잘 모르겠어.'] },
  { before: ['칙령이든 보고서든, 필요 없는 기록은 지워 버리면 그만이야.'],
    after: ['대표님 책상에서 큰 설계도를 봤어. 독도 곳곳에 놀이기구가 그려져 있었지…'] },
  { before: ['…….', '말은 필요 없다. 대표님의 계획은 이미 시작됐다.'],
    after: ['장치를 멈추지 않으면 광포화는 계속된다.', '대한봉 정상으로 가라. 대표님은… 듣지 않으시겠지만.'] },
  null // 8장은 아래 BOSS_REVEAL / BOSS_FALL 컷신
];

const SUMMIT_CAST = [
  { id: 'kim', who: 'actor:professor', x: 54, y: 150, dir: 'right' },
  { id: 'player', who: 'player', x: 90, y: 150, dir: 'right' },
  { id: 'boss', who: 'actor:villain-leader', x: 204, y: 148, dir: 'left', size: 58 },
  { id: 'g1', who: 'actor:villain-grunt-m', x: 252, y: 142, dir: 'left', size: 46 },
  { id: 'g2', who: 'actor:villain-grunt-f', x: 286, y: 144, dir: 'left', size: 46 }
];

// 대한봉 정상, 대표 백무와의 결투 직전.
export const BOSS_REVEAL = {
  id: 'boss-reveal',
  scenes: [{
    bg: 'summit', caption: '대한봉 정상', start: ['machine'], cast: SUMMIT_CAST,
    lines: [
      { who: null, text: '대한봉 정상. 거대한 장치가 보랏빛 연기를 뿜으며 웅웅거린다.' },
      { who: null, text: '뒤따라 올라온 김박사가 숨을 고른다.' },
      { who: '대표 백무', text: '드디어 왔군, 꼬마 탐험대원. 여기까지 올라오다니 제법이야.' },
      { who: '김박사', text: '당신이 백무단의 대표였군요. 저 장치는 대체 뭐죠?' },
      { who: '대표 백무', text: '내가 만든 공백 장치일세. 독도 생물의 기록을 읽어 독도몬을 만들어 내지.' },
      { who: '@player', text: '독도몬을… 만들었다고요?', cue: 'surprise' },
      { who: '김박사', text: '그래서 기록을 모았군요. 장치가 읽은 기록은 하얗게 지워지고….' },
      { who: '대표 백무', text: '기록 몇 장쯤이야. 이걸 보게, ‘독도몬 테마파크’ 설계도라네!', cue: 'blueprint' },
      { who: '대표 백무', text: '동도엔 회전목마, 서도엔 롤러코스터, 바닷속엔 수족관 터널! 손님이 줄을 서겠지.' },
      { who: '@player', text: '그래서 길마다 바위를 깎고 풀숲을 파헤쳤던 거예요?' },
      { who: '대표 백무', text: '공사 준비였지. 돈이 산더미처럼 쌓일 계획이었네.' },
      { who: '김박사', text: '그럼 독도몬이 광포화된 것도… 저 장치 때문인가요?' },
      { who: '대표 백무', text: '…독도몬을 서둘러 더 만들려고 장치를 무리하게 돌렸지.', cue: 'dark' },
      { who: '대표 백무', text: '그러자 검은 연기, 암흑 에너지가 새어 나오더군. 금방 가라앉을 줄 알았네.' },
      { who: '@player', text: '광포화된 독도몬들이 얼마나 괴로워했는데요!' },
      { who: '대표 백무', text: '무슨 소리! 사람들이 독도에 더 관심을 갖게 하려고 한 일이야.' },
      { who: '대표 백무', text: '나는 독도를 위해 한 거라고!' },
      { who: '김박사', text: '독도는 천연기념물 제336호예요. 섬 전체를 아껴 지키는 곳이죠.' },
      { who: '김박사', text: '그래서 방문객도 동도 선착장 근처까지만 들어갈 수 있어요.' },
      {
        who: '김박사', text: '탐험대원, 백무에게 하고 싶은 말이 있나요?',
        choice: [
          { label: '관심을 핑계로 자연을 망가뜨리면 안 돼요!', reply: [{ who: '김박사', text: '맞아요. 한번 사라진 생물은 장치로 되돌릴 수 없어요. 강치가 그랬듯이요.' }] },
          { label: '독도를 위한다면 먼저 지켜야죠!', reply: [{ who: '김박사', text: '그래요. 진짜 관심은 정확히 알고 아끼는 데서 시작돼요.' }] }
        ]
      },
      { who: '대표 백무', text: '흥, 어린 녀석이 뭘 안다고! 장치야, 더 힘을 내라!', cue: 'dark' },
      { who: null, text: '장치에서 쏟아진 암흑 에너지가 독도몬들을 감싼다. 결투로 진정시켜야 한다!' }
    ]
  }]
};

// 대표 백무의 독도몬이 모두 평온을 되찾은 뒤.
export const BOSS_FALL = {
  id: 'boss-fall',
  scenes: [{
    bg: 'summit', caption: '멈춘 장치', start: ['machine'], cast: SUMMIT_CAST,
    lines: [
      { who: null, text: '마지막 독도몬의 암흑 에너지가 걷히자, 공백 장치가 불꽃을 튀기며 멈췄다.', cue: 'machine-off' },
      { who: '대표 백무', text: '말도 안 돼… 내 장치가, 내 테마파크가….' },
      { who: '김박사', text: '보세요. 하얗게 지워졌던 기록들이 다시 돌아오고 있어요.', cue: 'records' },
      { who: '대표 백무', text: '…나는 정말로 사람들이 독도를 더 많이 찾아 주길 바랐어. 처음엔 그랬다고.' },
      { who: '@player', text: '그럼 이번엔 독도를 망가뜨리지 않는 방법으로 알려 주세요.' },
      { who: '@player', text: '우리처럼 직접 배우고, 지키면서요.' },
      { who: '김박사', text: '관심은 소중해요. 하지만 그 관심이 자연을 해친다면, 독도를 위한 일이 아니에요.' },
      { who: '대표 백무', text: '…지켜야 알릴 수 있다라. 꼬마에게 한 수 배웠군.' },
      { who: '대표 백무', text: '지운 기록을 되돌리는 일, 이제부터 내가 돕겠네. 광포화됐던 독도몬들에게도 미안하구나.' },
      { who: '김박사', text: '독도몬들은 이제 평온을 되찾았어요. 어디서 왔든, 함께 지켜 갈 친구들이에요.' },
      { who: null, text: '그때, 바다 쪽에서 푸른빛이 다시 피어올랐다….', cue: 'glint' }
    ]
  }]
};

// 대한봉 관장 인증 후, 엔딩 직전.
export const EPILOGUE = {
  id: 'epilogue',
  scenes: [{
    bg: 'dock', caption: '다시, 동도 선착장',
    cast: [
      { id: 'player', who: 'player', x: 120, y: 140, dir: 'right' },
      { id: 'kim', who: 'actor:professor', x: 196, y: 140, dir: 'left' }
    ],
    lines: [
      { who: '김박사', text: '수고했어요, 독도 수호사님!' },
      { who: '김박사', text: '백무는 지운 기록을 되찾는 일을 돕고 있대요. 테마파크 설계도는 스스로 찢어 버렸고요.' },
      { who: '김박사', text: '독도몬의 비밀은 밝혀졌지만, 진짜 독도를 지키는 일은 지금부터예요.' },
      { who: '@player', text: '오늘 배운 사실, 친구들에게 정확하게 전해 줄게요!' },
      { who: '김박사', text: '좋아요. 관심은 바르게 알고, 아끼고, 지키는 데서 시작된다는 걸 잊지 말아요.' }
    ]
  }]
};
