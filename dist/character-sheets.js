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
// v0.57: 아직 고치지 않은 시트(처음 만든 그대로)는 예전의 큰 원본 그림으로 그려요. 32도트로 줄인 시트는 얼굴 같은
// 작은 부분이 뭉개져서, 고치기 전에는 원본이 더 또렷해요. 시트를 고쳐 저장하면 그 순간부터 고친 시트를 그려요.
// BASELINE: 처음 만든 시트의 지문(가로×세로:픽셀 해시). characters.js가 그림을 읽어 비교해요.
// ─────────────────────────────────────────────────────────────────────────────

export const SHEET = { cell: [32, 40], cols: 5, rows: ['down', 'right', 'up'], foot: [16, 39], unit: 32 };
export const PICTURE_SIZE = 128;
export const BASELINE = {
  'characters/sheets/boy': '160x120:8254c020', 'characters/sheets/girl': '160x120:faa1d3c6', 'characters/sheets/professor': '160x120:86e33740',
  'characters/sheets/boy-portrait': '128x128:790beca9', 'characters/sheets/girl-portrait': '128x128:807606e8', 'characters/sheets/professor-portrait': '128x128:895e4e07'
};
// 픽셀 지문: 투명한 칸의 색은 0으로 보고 RGBA를 FNV-1a로 섞어요(scripts/export-character-sheets.py와 같은 방법).
export function pixelPrint(w, h, data) {
  let x = 0x811c9dc5;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3], r = a ? data[i] : 0, g = a ? data[i + 1] : 0, b = a ? data[i + 2] : 0;
    x = Math.imul(x ^ r, 0x01000193) >>> 0; x = Math.imul(x ^ g, 0x01000193) >>> 0; x = Math.imul(x ^ b, 0x01000193) >>> 0; x = Math.imul(x ^ a, 0x01000193) >>> 0;
  }
  return `${w}x${h}:${x.toString(16).padStart(8, '0')}`;
}

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
