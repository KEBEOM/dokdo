import assert from 'node:assert/strict';
import { makeFirstPerson, turnToward, relativeStep, DIR_ANGLE, DIR_VEC, BACK, DEPTH, EYE } from '../dist/view3d.js';
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
// 1인칭 시점 계산: 바라보는 쪽이 화면 가운데, 가까우면 크고 아래쪽, 누른 곳을 되돌리면 같은 점
for (const [W, H] of [[640, 400], [390, 760], [1280, 720], [844, 340], [2560, 1300]]) {
  const P = makeFirstPerson(W, H);
  assert.ok(P.hz > H * .3 && P.hz < H * .5 && P.RH === DEPTH && P.RW >= 2 * DEPTH * (W / 2) / P.f - 1e-6);
  for (const dir of Object.keys(DIR_ANGLE)) {
    const cam = P.camera(500, 400, DIR_ANGLE[dir]), [fx, fy] = DIR_VEC[dir];
    assert.ok(near(cam.fx, fx) && near(cam.fy, fy), `${dir}: 바라보는 쪽`); assert.ok(near(cam.x, 500 - fx * BACK) && near(cam.y, 400 - fy * BACK), '카메라는 내 뒤에');
    const a = P.project(cam, 500 + fx * 64, 400 + fy * 64), b = P.project(cam, 500 + fx * 256, 400 + fy * 256);
    assert.ok(near(a.x, W / 2) && near(b.x, W / 2), '앞에 있는 것은 화면 가운데');
    assert.ok(a.k > b.k && a.y > b.y && b.y > P.hz, '가까우면 크고 화면 아래쪽, 멀면 지평선 쪽');
    assert.equal(P.project(cam, 500 - fx * 64, 400 - fy * 64), null, '뒤에 있는 것은 그리지 않아요');
    const right = P.project(cam, 500 + fx * 96 - fy * 32, 400 + fy * 96 + fx * 32); assert.ok(right.x > W / 2, '오른쪽에 있는 것은 화면 오른쪽');
    for (const [wx, wy] of [[500 + fx * 100 + 13, 400 + fy * 100 - 9], [500 + fx * 300 - fy * 80, 400 + fy * 300 + fx * 80]]) {
      const s = P.project(cam, wx, wy), back = P.unproject(cam, s.x, s.y); assert.ok(near(back.x, wx, 1e-5) && near(back.y, wy, 1e-5), '누른 곳을 되돌리면 같은 점');
    }
    assert.equal(P.unproject(cam, W / 2, P.hz - 5), null, '하늘을 누르면 아무 데도 아니에요');
  }
  let prev = Infinity; for (let y = P.hz + 1; y <= H; y++) { const d = P.rowDepth(y); assert.ok(d < prev); prev = d; }
  assert.ok(P.rowDepth(H) > 0 && P.rowDepth(H) < 96, '화면 맨 아래는 발밑 가까운 땅'); assert.ok(near(P.rowDepth(P.hz + 10), EYE * P.f / 10));
}
// 돌기: 가까운 쪽으로, 넘치지 않게
assert.ok(near(turnToward(0, Math.PI / 2, .1), .1)); assert.ok(near(turnToward(0, -Math.PI / 2, 9), -Math.PI / 2));
assert.ok(turnToward(Math.PI, -Math.PI / 2, .1) > Math.PI, '아래 → 왼쪽은 180°를 넘어가는 가까운 길로');
// 조작: ↑ 앞으로, ↓ 뒷걸음, ←→ 제자리 돌기
assert.deepEqual(relativeStep('right', [0, -1]), { move: [1, 0] }); assert.deepEqual(relativeStep('right', [0, 1]), { move: [-1, 0], keep: true });
assert.deepEqual(relativeStep('up', [-1, 0]), { turn: 'left' }); assert.deepEqual(relativeStep('up', [1, 0]), { turn: 'right' });
assert.deepEqual(relativeStep('left', [1, 0]), { turn: 'up' }); assert.deepEqual(relativeStep('down', [1, 0]), { turn: 'left' });
console.log('PASS: first-person view on 5 screen sizes — ahead is centred, near is bigger, taps map back, turning and relative steps.');
