// ─────────────────────────────────────────────────────────────────────────────
// 1인칭 시점 (v0.61) — ‘3D 보기’ 단추를 누르면 지도 화면을 내 눈높이에서 봐요
//
// 내 캐릭터는 보이지 않고, 바라보는 쪽의 땅이 멀리까지 펼쳐져요. 사람·우산몬·나무·건물은 도트 그림 그대로 세워서 보여요.
//   카메라: 내가 선 곳에서 BACK 만큼 뒤, 눈높이 EYE. 바라보는 각도 yaw(위 0 · 오른쪽 90° · 아래 180° · 왼쪽 −90°)
//   project(cam, wx, wy)   지도 위의 점 → 화면 위치 x, y(발이 닿는 곳), 크기 k, 거리 z (카메라 뒤면 null)
//   unproject(cam, sx, sy) 화면의 점 → 지도 위의 점(누른 곳 찾기). 지평선 위나 너무 먼 곳이면 null
//   rowDepth(y)            화면의 가로줄 y 에 보이는 땅까지의 거리
// 조작: ↑ 앞으로 · ↓ 뒤로(뒷걸음) · ← → 제자리에서 돌기 (relativeStep)
// ─────────────────────────────────────────────────────────────────────────────
export const EYE = 30;        // 눈높이(지도 픽셀). 한 칸은 32, 캐릭터 키는 48쯤이에요
export const BACK = 40;       // 카메라가 내 자리보다 뒤로 물러난 거리. 바로 앞 칸의 상대가 화면에 알맞게 들어와요
export const DEPTH = 512;     // 보이는 거리(16칸)
export const NEAR_Z = 14;     // 이보다 가까운 것은 그리지 않아요
export const DIR_ANGLE = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
export const DIR_VEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const ORDER = ['up', 'right', 'down', 'left'];

// 각도 cur 를 target 쪽으로 가까운 방향으로 maxStep 만큼 돌려요
export function turnToward(cur, target, maxStep) {
  let d = (target - cur) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep;
}
// 1인칭 조작: 누른 방향(화면 기준 [dx, dy])을 지금 바라보는 쪽 기준으로 바꿔요
//   ↑ → { move: 앞 }   ↓ → { move: 뒤, keep: true(돌지 않고 뒷걸음) }   ← → → { turn: 새로 바라볼 쪽 }
export function relativeStep(dir, [dx, dy]) {
  const [fx, fy] = DIR_VEC[dir] || DIR_VEC.down;
  if (dy < 0) return { move: [fx, fy] };
  if (dy > 0) return { move: [-fx || 0, -fy || 0], keep: true };
  return { turn: ORDER[(ORDER.indexOf(dir) + (dx > 0 ? 1 : 3)) % 4] };
}

export function makeFirstPerson(W, H) {
  const f = Math.max(W, H) * .5, hz = Math.round(H * .42), halfW = Math.ceil(DEPTH * (W / 2) / f);
  return {
    W, H, f, hz, RW: halfW * 2, RH: DEPTH, radius: Math.ceil(Math.hypot(DEPTH, halfW)),
    camera(px, py, yaw) { const s = Math.sin(yaw), c = Math.cos(yaw); return { x: px - s * BACK, y: py + c * BACK, fx: s, fy: -c, rx: c, ry: s, yaw }; },
    project(cam, wx, wy) {
      const dx = wx - cam.x, dy = wy - cam.y, z = dx * cam.fx + dy * cam.fy; if (z < NEAR_Z) return null;
      const k = f / z; return { x: W / 2 + (dx * cam.rx + dy * cam.ry) * k, y: hz + EYE * k, k, z };
    },
    unproject(cam, sx, sy) {
      if (sy <= hz + 1) return null; const z = EYE * f / (sy - hz); if (z > DEPTH) return null;
      const l = (sx - W / 2) * z / f; return { x: cam.x + cam.fx * z + cam.rx * l, y: cam.y + cam.fy * z + cam.ry * l };
    },
    rowDepth(y) { return y <= hz ? Infinity : EYE * f / (y - hz); }
  };
}
