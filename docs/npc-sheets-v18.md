# NPC 애니메이션 시트 · v0.18

첨부한 NPC 디자인 5종을 참고하여 내장 이미지 생성 기능(imagegen)으로 새 시트를 제작했습니다. 원본 파일은 보존했습니다. 모든 사람 NPC에 아래 디자인을 배정했고, 인물 이름·학습 대사·보스 역할은 유지했습니다. 위인 캐릭터의 그림은 게임용 표현이며 실제 초상 재현이 아닙니다.

| 파일 | 디자인 |
|---|---|
| child-boy-atlas-v18.png | 갈색 머리, 연두색 셔츠, 파란 멜빵바지 남자아이 |
| child-girl-atlas-v18.png | 양갈래 머리, 빨강·노랑 상의, 청록 치마 여자아이 |
| child-girl-ribbon-atlas-v18.png | 빨간 리본, 긴 갈색 머리, 흰 앞치마와 빨간 원피스 여자아이 |
| man-atlas-v18.png | 회갈색 머리와 수염, 베이지 셔츠 아저씨 |
| woman-atlas-v18.png | 올림머리, 노랑 무늬 빨간 앞치마 아줌마 |

실제 파일 위치는 모두 `dist/assets/characters/`입니다. 각 PNG는 투명 배경 1536×1024, 5열×3행, 15프레임입니다. 총 75프레임입니다.

| 행 | 방향 |
|---|---|
| 1 | 정면 |
| 2 | 오른쪽 (왼쪽은 프레임 전체 반전) |
| 3 | 뒷모습 |

1열은 정지, 2~5열은 발 내딛기 → 발 교차 → 반대 발 내딛기 → 반대 발 교차입니다. 기존 주인공처럼 프레임 전체를 재생하며 팔·다리를 따로 늘이거나 회전하지 않습니다.

## 크기와 교체

`dist/npc-atlases.js`에 프레임별 자르기 영역(rect), 몸통·발바닥 기준점(anchor), 시트별 고정 배율 기준(unit)이 있습니다. 주인공과 같은 논리 표시 크기 48을 사용합니다. 시트의 실제 행 간격에 맞춘 좌표이므로 단순히 5×3등분해서 자르지 마세요. PNG를 같은 위치·배치로 교체하면 바로 사용할 수 있으며, 프레임 위치가 바뀌면 이 좌표도 수정해야 합니다. 단일 HTML 파일에는 PNG가 포함되므로 HTML을 다시 빌드해야 합니다.

`dist/world.js`의 NPC actor 필드가 역할과 그림을 연결합니다. 주민 외에도 위인·관장·악당·쉼터지기·선장·연구 안내원이 같은 다섯 디자인을 사용합니다. 이름표와 대화 초상화도 같은 NPC를 따릅니다.

## 작은 행동 반경

- 원래 자리에서 상하좌우 한 칸(32px) 이내. 대각선 두 칸으로 벗어나지 않습니다.
- 한 칸에 560ms, 이동 사이 2.4~5.6초 쉬기.
- 플레이어가 두 칸 이내로 다가오면 새 이동을 시작하지 않습니다.
- 대화·메뉴·전투·브라우저 숨김 상태에서는 이동을 멈춥니다.
- 자동 안내 중 대상 NPC는 다른 곳으로 가지 않습니다.
- 물·건물·장식물·출입구와 플레이어·다른 NPC의 이동 칸을 피합니다.
- 이동 출발점과 도착점을 함께 충돌 검사해 몸이 겹치거나 서로 통과하지 않게 합니다.
- 지역을 다시 방문하면 원래 자리에서 시작합니다. NPC 위치는 학생 학습 저장 데이터에 추가하지 않습니다.

설정: `dist/npc-motion.js`의 NPC_RADIUS, NPC_MOVE_MS, delay. 검증: `tests/npc-motion.test.mjs`, `tests/flow.test.mjs`. 실제 게임 렌더러로 만든 `docs/npc-playback-v18.gif`도 함께 제공합니다.

## 생성 방식과 프롬프트

내장 imagegen의 참고 이미지 기반 생성 모드, 투명 배경. 각 첫 번째 입력은 해당 NPC 원본 시트, 두 번째 입력은 주인공 시트(그림체 참고용)입니다. 생성 PNG 바이트는 수정하지 않았으며, 게임에서는 잘라 읽을 좌표와 기준점만 적용했습니다.

## child-boy

Use case: identity-preserve. Asset type: transparent pixel art NPC animation atlas for the Korean educational RPG Dokdo Explorers. Image 1 is the specific character identity reference; preserve that character's hair, clothing colors, face, age, accessories and silhouette. Image 2 is the EXISTING PLAYER ATLAS, a STYLE AND PIXEL DENSITY reference only, never copy its orange explorer clothing or its characters. Draw ONLY the NPC from image 1: brown tousled short hair, pale green shirt, blue overalls, brown shoes, small brown backpack. Match the player's clean chunky pixel outlines, crisp controlled color clusters and substantial arms and legs. New production sprite sheet, landscape 1536x1024, exactly FIVE columns and THREE rows, 15 sprites total. Row 1 front/down, row 2 facing right, row 3 back/up. Same NPC identity in every cell. Column 1 upright IDLE: straight legs, feet close, relaxed arms down, head vertically over hips. Columns 2-5 looping WALK: 2 contact A (near leg forward, near arm back); 3 passing A (feet near each other directly under hips, one knee raised, support leg straight); 4 opposite contact B (near leg backward, near arm forward); 5 opposite passing B (opposite knee raised). Show noticeably distinct alternating legs and opposing arm swings. SIDE WALK MUST alternate wide stride / feet close below body / opposite wide stride / feet close below body. Do not repeat the same stride in all frames. Natural ordinary slow walking, no excessive running leap, no twisted or thin rubber legs. Character height about 250 pixels within each 307x341 cell, generous transparent margins on all sides. Fixed sprite body scale, body center at middle of each cell, same ground baseline at row top plus 295px. Head held stable across four walk frames, natural tiny bob only. Keep all hair and accessories within cell boundaries, no clipping, no neighbor overlap. Transparent alpha background throughout. NO text, NO captions, NO grid, NO labels, NO ground shadow, NO floor, NO watermark, NO other characters.

## child-girl

Use case: identity-preserve. Asset type: transparent pixel art NPC animation atlas for the Korean educational RPG Dokdo Explorers. Image 1 is the specific character identity reference; preserve that character's hair, clothing colors, face, age, accessories and silhouette. Image 2 is the EXISTING PLAYER ATLAS, a STYLE AND PIXEL DENSITY reference only, never copy its orange explorer clothing or its characters. Draw ONLY the NPC from image 1: golden brown twin bunches, pale hair clips, coral red sleeveless top with broad yellow lower band, teal skirt, brown shoes, small backpack. Match the player's clean chunky pixel outlines, crisp controlled color clusters and substantial arms and legs. New production sprite sheet, landscape 1536x1024, exactly FIVE columns and THREE rows, 15 sprites total. Row 1 front/down, row 2 facing right, row 3 back/up. Same NPC identity in every cell. Column 1 upright IDLE: straight legs, feet close, relaxed arms down, head vertically over hips. Columns 2-5 looping WALK: 2 contact A (near leg forward, near arm back); 3 passing A (feet near each other directly under hips, one knee raised, support leg straight); 4 opposite contact B (near leg backward, near arm forward); 5 opposite passing B (opposite knee raised). Show noticeably distinct alternating legs and opposing arm swings. SIDE WALK MUST alternate wide stride / feet close below body / opposite wide stride / feet close below body. Do not repeat the same stride in all frames. Natural ordinary slow walking, no excessive running leap, no twisted or thin rubber legs. Character height about 250 pixels within each 307x341 cell, generous transparent margins on all sides. Fixed sprite body scale, body center at middle of each cell, same ground baseline at row top plus 295px. Head held stable across four walk frames, natural tiny bob only. Keep all hair and accessories within cell boundaries, no clipping, no neighbor overlap. Transparent alpha background throughout. NO text, NO captions, NO grid, NO labels, NO ground shadow, NO floor, NO watermark, NO other characters.

## child-girl-ribbon

Use case: identity-preserve. Asset type: transparent pixel art NPC animation atlas for the Korean educational RPG Dokdo Explorers. Image 1 is the specific character identity reference; preserve that character's hair, clothing colors, face, age, accessories and silhouette. Image 2 is the EXISTING PLAYER ATLAS, a STYLE AND PIXEL DENSITY reference only, never copy its orange explorer clothing or its characters. Draw ONLY the NPC from image 1: long brown hair with large red bow behind, red-orange dress with white apron panel, brown shoes. Match the player's clean chunky pixel outlines, crisp controlled color clusters and substantial arms and legs. New production sprite sheet, landscape 1536x1024, exactly FIVE columns and THREE rows, 15 sprites total. Row 1 front/down, row 2 facing right, row 3 back/up. Same NPC identity in every cell. Column 1 upright IDLE: straight legs, feet close, relaxed arms down, head vertically over hips. Columns 2-5 looping WALK: 2 contact A (near leg forward, near arm back); 3 passing A (feet near each other directly under hips, one knee raised, support leg straight); 4 opposite contact B (near leg backward, near arm forward); 5 opposite passing B (opposite knee raised). Show noticeably distinct alternating legs and opposing arm swings. SIDE WALK MUST alternate wide stride / feet close below body / opposite wide stride / feet close below body. Do not repeat the same stride in all frames. Natural ordinary slow walking, no excessive running leap, no twisted or thin rubber legs. Character height about 250 pixels within each 307x341 cell, generous transparent margins on all sides. Fixed sprite body scale, body center at middle of each cell, same ground baseline at row top plus 295px. Head held stable across four walk frames, natural tiny bob only. Keep all hair and accessories within cell boundaries, no clipping, no neighbor overlap. Transparent alpha background throughout. NO text, NO captions, NO grid, NO labels, NO ground shadow, NO floor, NO watermark, NO other characters.

## man

Use case: identity-preserve. Asset type: transparent pixel art NPC animation atlas for the Korean educational RPG Dokdo Explorers. Image 1 is the specific character identity reference; preserve that character's hair, clothing colors, face, age, accessories and silhouette. Image 2 is the EXISTING PLAYER ATLAS, a STYLE AND PIXEL DENSITY reference only, never copy its orange explorer clothing or its characters. Draw ONLY the NPC from image 1: middle aged man, short graying brown hair, gray beard, beige vertically striped shirt, dark brown trousers and shoes, small backpack. Match the player's clean chunky pixel outlines, crisp controlled color clusters and substantial arms and legs. New production sprite sheet, landscape 1536x1024, exactly FIVE columns and THREE rows, 15 sprites total. Row 1 front/down, row 2 facing right, row 3 back/up. Same NPC identity in every cell. Column 1 upright IDLE: straight legs, feet close, relaxed arms down, head vertically over hips. Columns 2-5 looping WALK: 2 contact A (near leg forward, near arm back); 3 passing A (feet near each other directly under hips, one knee raised, support leg straight); 4 opposite contact B (near leg backward, near arm forward); 5 opposite passing B (opposite knee raised). Show noticeably distinct alternating legs and opposing arm swings. SIDE WALK MUST alternate wide stride / feet close below body / opposite wide stride / feet close below body. Do not repeat the same stride in all frames. Natural ordinary slow walking, no excessive running leap, no twisted or thin rubber legs. Character height about 250 pixels within each 307x341 cell, generous transparent margins on all sides. Fixed sprite body scale, body center at middle of each cell, same ground baseline at row top plus 295px. Head held stable across four walk frames, natural tiny bob only. Keep all hair and accessories within cell boundaries, no clipping, no neighbor overlap. Transparent alpha background throughout. NO text, NO captions, NO grid, NO labels, NO ground shadow, NO floor, NO watermark, NO other characters.

## woman

Use case: identity-preserve. Asset type: transparent pixel art NPC animation atlas for the Korean educational RPG Dokdo Explorers. Image 1 is the specific character identity reference; preserve that character's hair, clothing colors, face, age, accessories and silhouette. Image 2 is the EXISTING PLAYER ATLAS, a STYLE AND PIXEL DENSITY reference only, never copy its orange explorer clothing or its characters. Draw ONLY the NPC from image 1: middle aged woman, brown hair in high bun, cream short sleeves, red apron with yellow horizontal stripe and small yellow squares, dark teal lower skirt and dark shoes. Match the player's clean chunky pixel outlines, crisp controlled color clusters and substantial arms and legs. New production sprite sheet, landscape 1536x1024, exactly FIVE columns and THREE rows, 15 sprites total. Row 1 front/down, row 2 facing right, row 3 back/up. Same NPC identity in every cell. Column 1 upright IDLE: straight legs, feet close, relaxed arms down, head vertically over hips. Columns 2-5 looping WALK: 2 contact A (near leg forward, near arm back); 3 passing A (feet near each other directly under hips, one knee raised, support leg straight); 4 opposite contact B (near leg backward, near arm forward); 5 opposite passing B (opposite knee raised). Show noticeably distinct alternating legs and opposing arm swings. SIDE WALK MUST alternate wide stride / feet close below body / opposite wide stride / feet close below body. Do not repeat the same stride in all frames. Natural ordinary slow walking, no excessive running leap, no twisted or thin rubber legs. Character height about 250 pixels within each 307x341 cell, generous transparent margins on all sides. Fixed sprite body scale, body center at middle of each cell, same ground baseline at row top plus 295px. Head held stable across four walk frames, natural tiny bob only. Keep all hair and accessories within cell boundaries, no clipping, no neighbor overlap. Transparent alpha background throughout. NO text, NO captions, NO grid, NO labels, NO ground shadow, NO floor, NO watermark, NO other characters.

