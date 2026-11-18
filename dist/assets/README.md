# 독도 탐험대 그림 파일 (v0.71 정리)

게임이 실제로 쓰는 그림만 남겨 두었어요(v0.71에서 쓰지 않는 그림 189개를 지웠어요).

그림을 바꾼 뒤에는 `node scripts/build-offline.mjs`로 한 파일짜리 게임을 다시 만드세요(오프라인 판에는 그림이 들어 있어요).

## 우산몬
- `monsters/001.png`~`100.png`: 우산몬 그림(512×512 투명 PNG, 발끝은 아래에서 12칸 위). 도감·결투·지도에 모두 이 한 장을 써요.
- `monsters/068-2.png` 등: 전설의 우산몬 변환폼(68 소쩍새, 70 뿔쇠오리, 71 매, 72 황조롱이, 75 고니, 76 흑두루미).
- 새로 찍은 도트는 `python scripts/import-dots.py <폴더>`로 넣어요(한 도트 10×10 원본, 이름 `NNN.png` · `NNN-1.png` · `NNN-2.png`). 원본은 프로젝트의 `art/monsters-original/`에 보관해요(게임에는 들어가지 않아요).
- 결투에서 바라보는 쪽은 `dist/sprites.js`의 `FACES_RIGHT`(오른쪽) · `FACES_FRONT`(정면)에 적어요. 나머지는 왼쪽을 보는 그림이에요.

## 실제 사진 (도감 ‘실제 사진 보기’)
- `photos/001.jpg`~`100.jpg`: 실제 생물 사진. 원본을 자르거나 고치지 않고 크기만 줄였어요(긴 변 640px).
- 출처와 이용 조건은 `dist/photo-credits.js`에 있고, 도감에서 사진 아래에 보여요. 공공누리 제3·4유형 사진은 고치면 안 돼요(변경금지).

## 사람
- 주인공·김박사(v0.72): 캐릭터마다 걷기 시트 1장 + 큰 그림 1장. 고치는 법: `art/ASEPRITE-가이드.md`.
- 걷기 그림: `characters/explorers-v2-64x72.png`(주인공 5장 걷기), `characters/professor-atlas-v33.png`, 큰 그림 `characters/*-portrait-v33.png`. 
- 마을 사람: `characters/{child-boy,child-girl,child-girl-ribbon,man,woman}-atlas-v18.png` (좌표: `dist/npc-atlases.js`).
- 몽땅랜드: `characters/villain-*-v25.png` (좌표: `dist/villain-atlases.js`), 결투 등장 그림 `characters/baekmudan-{grunt,exec,boss}-portrait.png`.

## 배경
- `scenery/terrain-bw-v39.png`(지형 타일), `scenery/props-bw-v39.png`(지도 소품), `scenery/island-art-v36.png`(건물·나무), `scenery/cutscene-art-v47.png`(컷신 배경) 등.
- 각 그림은 `scripts/draw-*.py`로 다시 만들 수 있고, 자리 좌표는 `dist/*-atlas.js`에 있어요.
