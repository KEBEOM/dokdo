# 0.9 스타팅 이미지 적용 기록

사용자가 첨부한 그림을 기준으로 이미지 편집 도구로 흰 배경을 투명하게 정리했습니다. 흰 몸통 내부는 보존하고 색·포즈·도트 느낌을 유지하도록 요청했습니다. 괭이갈매기는 마지막 첨부(20261020-010241)를 기준으로 합니다.

| 우산몬 | 정면 / 전투용 경로 | 입력 그림 |
|---|---|---|
| 해국 | assets/monsters/001.png, assets/monsters/back/001.png | image(20261020-002535).png |
| 괭이갈매기 | assets/monsters/067.png, assets/monsters/back/067.png | image(20261020-010241).png |
| 독도새우 | assets/monsters/066.png, assets/monsters/back/066.png | image(20261020-003226).png |

편집 지시 요약: remove only the white background; preserve the original sprite, pose, colors, square pixel edges and white body details; transparent PNG; do not add text, scenery, shadows, or a new pose. 괭이갈매기에는 긴 노란 부리와 빨간 끝, 흰 몸통, 회색 날개, 검은 꼬리와 노란 발의 특징 보존을 명시했습니다.

세 전투용 이미지는 정면과 같은 그림을 사용합니다. 나머지 97종은 기존 Canvas 기본 도트를 생물 형태에 맞춰 연결한 것으로, 100종의 완전한 개별 원화 제작은 아닙니다. PNG 교체 시 번호는 monster-list.csv를 참고하세요.
