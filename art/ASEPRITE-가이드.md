# 캐릭터 그림 고치기 (v0.72)

캐릭터마다 **걷기 시트 1장 + 큰 그림 1장**만 써요. 같은 이름으로 저장하고 새로고침하면 바로 게임에 나와요(오프라인 한 파일 판은 `node scripts/build-offline.mjs`로 다시 만들어요).

## 주인공(남학생·여학생) — `dist/assets/characters/explorers-v2-64x72.png` (320×432)
- 한 칸 **64×72**, 가로 5칸 = 걷기 5장(0번이 서 있는 모습, 0→1→2→3→4 순서로 걸어요. 16픽셀 걸을 때마다 한 장).
- 세로 6줄: 남학생 아래·오른쪽·위(0~2줄), 여학생 아래·오른쪽·위(3~5줄). 왼쪽은 오른쪽 그림을 뒤집어 써요.
- 발끝 기준점은 칸 안의 **(32, 68)** — 발이 이 점에 닿게 그려요(지도 칸 바닥에 맞춰 서요).
- 투명 배경 PNG, 도트 1개 = 1픽셀. Aseprite: `View > Grid > Grid Settings`에서 64×72 격자를 켜면 편해요.

## 주인공 큰 그림 — `explorer-girl-portrait-v33.png` · `explorer-boy-portrait-v33.png`
- 캐릭터 고르기 창과 결투 등장 그림이에요. 크기는 그대로 두고 고쳐요.

## 김박사 — 걷기 `professor-atlas-v33.png` · 큰 그림 `professor-portrait-v33.png`
- 걷기 시트 칸 자리는 `dist/npc-atlases.js`의 `professor`에 적혀 있어요(아래·오른쪽·위 3줄, 5장).

## 다른 사람
- 마을 사람 `*-atlas-v18.png`(좌표 `dist/npc-atlases.js`), 몽땅랜드 `villain-*-v25.png`(좌표 `dist/villain-atlases.js`).
