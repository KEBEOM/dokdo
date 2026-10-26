# 독도 탐험대 0.17 애니메이션 시트

기존 남녀 캐릭터를 참고하여 내장 이미지 생성 기능으로 새로 그린 게임용 시트입니다. 원본 JPG를 그대로 재생하는 방식에서 완성된 PNG 프레임 재생으로 바꿨습니다.

- 파일: `dist/assets/characters/explorers-atlas-v17.png`
- 크기: 1024×1536, 투명 PNG, 5열×6행, 총 30장
- 실제 표시: 지도 논리 크기 48, 프레임 비율 유지, 픽셀 보간 끔
- 왼쪽: 오른쪽 프레임 전체를 좌우 반전
- 이동: 실제 거리 16px마다 다음 프레임. 64px에 한 주기, 기본 이동 속도에서 약 440ms
- 정지: 이동 거리와 무관하게 1열의 곧게 선 자세
- 머리·팔·다리를 따로 늘이거나 회전하지 않습니다.

| 행 | 캐릭터 | 방향 |
|---|---|---|
| 1 | 남학생 | 정면 |
| 2 | 남학생 | 오른쪽 |
| 3 | 남학생 | 뒷모습 |
| 4 | 여학생 | 정면 |
| 5 | 여학생 | 오른쪽 |
| 6 | 여학생 | 뒷모습 |

| 열 | 동작 |
|---|---|
| 1 | 정지 |
| 2 | 첫 번째 발 내딛기 |
| 3 | 발 교차 |
| 4 | 반대 발 내딛기 |
| 5 | 반대 발 교차 |

## 직접 그림을 바꾸려면

PNG의 캐릭터 위치를 유지한 채 같은 경로로 덮어쓰면 됩니다. 자동 생성 그림의 배치가 완벽한 등간격은 아니므로 단순히 이미지를 5×6등분해서 자르지 않습니다. `dist/explorer-atlas.js`가 각 그림의 정확한 영역(rect)과 몸통·발바닥 기준점(anchor)을 기록합니다. 그림 위치나 크기를 바꾸면 이 좌표도 함께 수정하세요. `unit:256`은 전체 프레임 공통 크기 기준이며 프레임별로 몸을 늘이지 않습니다.

선택창·지도·초상화 모두 같은 시트를 사용합니다. 웹 버전은 새 PNG와 JS를 배포하면 적용됩니다. 단일 HTML은 그림이 파일 안에 포함되므로 다시 생성해야 합니다. 원본 참고 JPG와 이전 버전 그림은 보존되어 있으나 현재 탐험대원 렌더러에서는 사용하지 않습니다.

`docs/sheet-playback-v17.gif`는 PNG를 실제 게임 렌더러로 재생한 확인 영상입니다. 신규 이미지 생성 모드: 내장 imagegen, 참고 이미지 기반 편집, 투명 배경. 아래는 사용한 프롬프트 전문입니다.

## 1. 시트 제작
Use case: identity-preserve. Asset type: production pixel-art animation sprite sheet for the Korean educational RPG "Dokdo Explorers".
Input 1 is the existing BOY explorer identity reference; input 2 is the existing GIRL explorer identity reference. Create one NEW, clean combined animation atlas preserving their appearance: large dark brown chibi hair, boy short hair and girl tied twin ponytails, orange explorer vest over muted blue/teal sleeves, dark loose trousers, substantial dark boots, teal backpack, warm tan skin. Preserve the bold simple square-pixel style of the references; no extra accessories, symbols or text.
The user wants proper drawn poses instead of deforming body parts in code. Give both characters naturally thick arms/sleeves and legs, elbows and knees that bend correctly, and a head balanced vertically above the torso in the IDLE pose, never jutting forward like a bent neck.

Exact layout: FIVE columns and SIX rows, exactly 30 sprites, regular equal rectangular cells. Requested canvas 1280 by 1536, 256x256 cells. Fully transparent background with genuine alpha. No background color, no checkerboard drawn into pixels, no labels, no borders, no grid lines, no floor shadows.
Rows from top to bottom:
1 boy facing FRONT / down
2 boy strict SIDE profile facing RIGHT
3 boy facing BACK / up
4 girl facing FRONT / down
5 girl strict SIDE profile facing RIGHT
6 girl facing BACK / up
Each row columns from left to right:
1 IDLE, straight upright standing, arms lowered, both feet planted
2 WALK contact A: near leg forward, far leg behind; opposite arm forward
3 WALK passing A: legs passing under hips, rear knee bent, opposite arm swing
4 WALK contact B: reverse the physical legs and arms from column 2 (use near/far clothing shades so the swapped legs are visible)
5 WALK passing B: reverse physical legs and arms from column 3.
These four walk frames must make a coherent LOOP when played 2,3,4,5 repeatedly. Equal limb lengths, substantial filled silhouettes rather than thin sticks; hands and boots same size in every cell. Do not copy identical contact frames. Keep facing direction fixed within each row. Do NOT rotate front/back views toward the side.
Every sprite is full-body, centered at the same hip X within its cell. Same head size and body scale throughout, a little clear margin all around each cell, feet ground line at 232/256 of each cell height; approx 208px tall including hair, with no sprite bleeding into the neighboring cells. Keep head and torso steady during walking, very small vertical bob at most. Hair and backpack consistent. Real crisp pixel edges, 32-to-48px logical sprite look enlarged with nearest-neighbor pixels, limited harmonious palette, no blur or gradient shading.

## 2. 정지 자세 보정
Precise sprite-sheet edit. Keep this SAME transparent 5-column, 6-row pixel-art atlas and all 30 sprites, exact existing character identities, colors, clothing, hair and backpack designs. Preserve true alpha background, no visible background or glow; preserve current sheet dimensions and all cell locations. No labels, borders or grid.

Change ONLY the IDLE sprites in column 1 of row 2 (boy right profile) and column 1 of row 5 (girl right profile). These two must stand fully upright at rest: thick straight legs directly under the hips, knees unbent, both boots planted close together on the original baseline, thick arms hanging relaxed down, head pulled back so skull is centered vertically above shoulders and hips. No forward-jutting neck, no wide straddle, no crouch. Preserve their total height and head size and retain the full ponytail inside its cell.
All other 28 sprites, especially the four walk frames on each row, must stay unchanged in pose, placement, scale, and appearance. Keep crisp square-pixel outlines and the actual transparent background. This is a production game animation sheet.

## 3. 옆걸음 교차 자세 보정
Edit this exact transparent game sprite sheet. Keep its 1024 by 1536 canvas, five columns and six rows, both character identities, chunky pixel art style and all sprite centers. Modify ONLY eight side walking sprites: row 2 columns 2,3,4,5 (boy facing right), and row 5 columns 2,3,4,5 (girl facing right). All other 22 sprites, especially the upright side idle in column 1, must remain unchanged. The problem is that all four side walk poses currently show the same spread stride. Replace with a clearly articulated FOUR FRAME LOOP. In each of those two rows: column 2 CONTACT A with the nearer viewer-facing leg stretching forward to the RIGHT, rear leg back to the LEFT, nearer arm swung LEFT/back. Column 3 PASSING A: rear foot swings beneath hips, feet CLOSE TOGETHER under the body, one knee raised and bent, grounded support leg nearly vertical; arms near hips. Column 4 CONTACT B: nearer viewer-facing leg stretches BACK toward the LEFT, far leg forward RIGHT; nearer arm swung RIGHT/forward. Column 5 PASSING B: feet again CLOSE TOGETHER directly beneath hips, opposite knee raised and bent, opposite support leg vertical; arms near hips. The four silhouettes must be visibly distinct: spread, narrow, opposite spread, narrow. Near leg darker, far leg slightly lighter for easy tracking across frames. Maintain THICK dark trouser legs, substantial boots, thick orange-and-teal sleeves. No spindly limbs, no rubber bends. Body and head remain stable, anchored at the same x and head height through these four walk frames; only tiny natural vertical bob permitted. Same fixed body scale and ground baseline as existing frames. Exact same dark hair, orange vest, teal backpack, face and proportions. Side idle head remains aligned over hips with straight legs and arms down. No text, no grid, no shadow, genuine transparent background. This is a production sprite atlas, keep every sprite separated and fully within its existing cell.

