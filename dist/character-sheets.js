// ─────────────────────────────────────────────────────────────────────────────
// Aseprite로 고치는 캐릭터 도트 시트 (v0.54) — 주인공(남학생·여학생)과 김박사
//
// 그림 파일: dist/assets/characters/sheets/  (자세한 방법: art/ASEPRITE-가이드.md)
//   boy.png · girl.png · professor.png       걷기 시트 160×120
//       한 칸 32×40 도트 · 가로 5칸 [정지, 걷기1, 걷기2, 걷기3, 걷기4] × 세로 3줄 [아래, 오른쪽, 위]
//       왼쪽으로 걸을 때는 오른쪽 줄을 뒤집어 그려요. 지도 한 칸 = 32도트.
//       발: 각 칸 맨 아래 한 줄(40번째 줄)은 비우고, 바로 위 줄에 발끝이 닿게 · 몸 가운데: 16번째와 17번째 도트 사이
//   boy-portrait.png · girl-portrait.png · professor-portrait.png   큰 그림 128×128 (캐릭터 고르기·대화·컷신)
// PNG를 고쳐 같은 이름으로 저장하면 게임에 바로 나와요(새로고침). 칸 크기만 지켜 주세요.
// ─────────────────────────────────────────────────────────────────────────────

export const SHEET = { cell: [32, 40], cols: 5, rows: ['down', 'right', 'up'], foot: [16, 39], unit: 32 };
export const PICTURE_SIZE = 128;

// 키는 글자 그대로 적어 두어요(한 파일 오프라인 판을 만들 때 이 글자를 찾아 그림을 넣어요).
export const SHEET_KEYS = { boy: 'characters/sheets/boy', girl: 'characters/sheets/girl', professor: 'characters/sheets/professor' };
export const PICTURE_KEYS = { boy: 'characters/sheets/boy-portrait', girl: 'characters/sheets/girl-portrait', professor: 'characters/sheets/professor-portrait' };

// 시트 → 다른 캐릭터 그림과 같은 모양의 atlas {key, width, height, unit, rows, frames}
export function sheetAtlas(key, extra = {}) {
  const [w, h] = SHEET.cell, [fx, fy] = SHEET.foot;
  return {
    key, width: w * SHEET.cols, height: h * SHEET.rows.length, unit: SHEET.unit, ...extra,
    rows: Object.fromEntries(SHEET.rows.map((d, r) => [d, r])),
    frames: SHEET.rows.map((_, r) => Array.from({ length: SHEET.cols }, (_, c) => ({ rect: [c * w, r * h, w, h], anchor: [c * w + fx, r * h + fy] })))
  };
}
