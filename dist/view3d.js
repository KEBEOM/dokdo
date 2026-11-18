// ─────────────────────────────────────────────────────────────────────────────
// 3D 보기 (v0.62) — 내 캐릭터를 조금 뒤, 조금 위에서 따라가며 보는 시점
//
// 카메라는 내 캐릭터 뒤 BACK 거리, 높이 EYE 에 있어요. 보는 방향은 마음대로 돌릴 수 있어요.
//   yaw   좌우로 보는 각도(위쪽 0 · 오른쪽 90° · 아래쪽 180° · 왼쪽 −90°, 라디안)
//   pitch 위아래로 보는 정도(−1 땅 쪽 … 0 보통 … +1 하늘 쪽). 지평선(hz)을 위아래로 옮겨서 나타내요.
//   project(cam, wx, wy)   지도 위의 점 → 화면 위치 x, y(발이 닿는 곳), 크기 k, 거리 z (카메라 뒤면 null)
//   unproject(cam, sx, sy) 화면의 점 → 지도 위의 점(누른 곳 찾기). 하늘이나 너무 먼 곳이면 null
//   rowDepth(cam, y)       화면의 가로줄 y 에 보이는 땅까지의 거리
// 조작: W A S D 는 ‘보는 방향’을 기준으로 앞·왼쪽·뒤·오른쪽 칸으로 걸어요(cameraStep).
//       마우스(또는 오른쪽 조이스틱, 방향키)로 둘러봐요.
// ─────────────────────────────────────────────────────────────────────────────
export const EYE = 64;        // 카메라 높이(지도 픽셀). 한 칸은 32, 캐릭터 키는 48쯤이에요
export const BACK = 128;      // 카메라가 내 캐릭터보다 뒤로 물러난 거리(4칸)
export const DEPTH = 512;     // 또렷하게 그리는 가까운 땅의 거리(16칸)
export const FAR = 1728;      // 멀리 보이는 땅의 끝(54칸 — 지도 끝에서 끝까지). 먼 땅은 FAR_SCALE 로 줄인 그림으로 그려요
export const FAR_SCALE = .25;
export const NEAR_Z = 20;     // 이보다 가까운 것은 그리지 않아요
export const HORIZON = .36;   // 보통 때 지평선의 높이(화면 높이의 비율)
export const DIR_ANGLE = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
export const DIR_VEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const ORDER = ['up', 'right', 'down', 'left'];
const quarter = yaw => ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;   // 보는 방향에 가장 가까운 네 방향(0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽)

export const clampPitch = p => Math.max(-1, Math.min(1, p));
// 누른 방향(화면 기준 [dx, dy]: ↑ = [0, −1])을 보는 방향 기준의 지도 방향으로 바꿔요
export function cameraStep(yaw, [dx, dy]) {
  let x = dx, y = dy; for (let i = quarter(yaw); i > 0; i--) [x, y] = [-y, x];
  return [x || 0, y || 0];
}
// 지도에서 dir 쪽을 보는 캐릭터가 카메라에는 어느 쪽 모습으로 보이는지(뒤에서 보면 뒷모습 'up')
export function seenDir(yaw, dir) { const i = ORDER.indexOf(dir); return i < 0 ? dir : ORDER[(i - quarter(yaw) + 4) % 4]; }

export function makeChase(W, H) {
  const f = Math.min(Math.max(W, H) * .5, H * .9), halfW = Math.ceil(DEPTH * (W / 2) / f);
  return {
    W, H, f, RW: halfW * 2, RH: DEPTH, radius: Math.ceil(Math.hypot(DEPTH, halfW)),
    FW: Math.ceil(FAR * (W / 2) / f * FAR_SCALE) * 2, FH: Math.ceil(FAR * FAR_SCALE), far: FAR, farScale: FAR_SCALE,
    camera(px, py, yaw, pitch = 0, lift = 0) { // lift(v0.70): 언덕 위에 서 있으면 카메라도 그만큼 높아요
      const s = Math.sin(yaw), c = Math.cos(yaw), p = clampPitch(pitch);
      return { x: px - s * BACK, y: py + c * BACK, fx: s, fy: -c, rx: c, ry: s, yaw, pitch: p, eye: EYE + lift, hz: H * (HORIZON + p * (p > 0 ? .8 : .55)) };
    },
    project(cam, wx, wy) {
      const dx = wx - cam.x, dy = wy - cam.y, z = dx * cam.fx + dy * cam.fy; if (z < NEAR_Z) return null;
      const k = f / z; return { x: W / 2 + (dx * cam.rx + dy * cam.ry) * k, y: cam.hz + (cam.eye ?? EYE) * k, k, z };
    },
    unproject(cam, sx, sy) {
      if (sy <= cam.hz + 1) return null; const z = (cam.eye ?? EYE) * f / (sy - cam.hz); if (z > FAR) return null;
      const l = (sx - W / 2) * z / f; return { x: cam.x + cam.fx * z + cam.rx * l, y: cam.y + cam.fy * z + cam.ry * l };
    },
    rowDepth(cam, y, h = 0) { return y <= cam.hz ? Infinity : ((cam.eye ?? EYE) - h) * f / (y - cam.hz); } // h: 그 높이의 땅(언덕 위)
  };
}
