import assert from 'node:assert/strict';
import { makeChase, cameraStep, seenDir, clampPitch, DIR_ANGLE, DIR_VEC, BACK, DEPTH, EYE, HORIZON } from '../dist/view3d.js';
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
// 뒤에서 따라가는 3D 시점: 내 캐릭터는 화면 가운데 아래쪽, 가까우면 크고, 누른 곳을 되돌리면 같은 점
for (const [W, H] of [[640, 400], [390, 760], [1280, 720], [844, 340], [2560, 1300]]) {
  const P = makeChase(W, H);
  assert.ok(P.RH === DEPTH && P.RW >= 2 * DEPTH * (W / 2) / P.f - 1e-6);
  assert.ok(P.far > DEPTH * 3 && P.FH >= P.far * P.farScale && P.FW >= 2 * P.far * (W / 2) / P.f * P.farScale - 1e-6, '먼 땅은 줄인 그림으로 지도 끝까지');
  for (const dir of Object.keys(DIR_ANGLE)) {
    const cam = P.camera(500, 400, DIR_ANGLE[dir]), [fx, fy] = DIR_VEC[dir];
    assert.ok(near(cam.fx, fx) && near(cam.fy, fy), `${dir}: 보는 쪽`); assert.ok(near(cam.x, 500 - fx * BACK) && near(cam.y, 400 - fy * BACK), '카메라는 내 뒤에');
    const me = P.project(cam, 500, 400), far = P.project(cam, 500 + fx * 256, 400 + fy * 256);
    assert.ok(near(me.x, W / 2) && near(far.x, W / 2), '나와 내 앞은 화면 가운데'); assert.ok(near(me.z, BACK));
    assert.ok(me.y > H * .5 && me.y < H, '내 발은 화면 아래쪽 안에'); assert.ok(me.y - 48 * me.k > 0, '내 머리도 화면 안에');
    assert.ok(me.k > far.k && me.y > far.y && far.y > cam.hz, '가까우면 크고 화면 아래쪽, 멀면 지평선 쪽');
    assert.equal(P.project(cam, 500 - fx * 200, 400 - fy * 200), null, '카메라 뒤는 그리지 않아요');
    assert.ok(P.project(cam, 500 + fx * 96 - fy * 32, 400 + fy * 96 + fx * 32).x > W / 2, '오른쪽에 있는 것은 화면 오른쪽');
    for (const [wx, wy] of [[500 + fx * 100 + 13, 400 + fy * 100 - 9], [500 + fx * 300 - fy * 80, 400 + fy * 300 + fx * 80]]) {
      const s = P.project(cam, wx, wy), back = P.unproject(cam, s.x, s.y); assert.ok(near(back.x, wx, 1e-5) && near(back.y, wy, 1e-5), '누른 곳을 되돌리면 같은 점');
    }
    assert.equal(P.unproject(cam, W / 2, cam.hz - 5), null, '하늘을 누르면 아무 데도 아니에요');
  }
  // 위아래로 보기: 하늘을 보면 지평선이 내려가고(끝까지 보면 땅이 안 보여요), 땅을 보면 올라가요
  const mid = P.camera(0, 0, 0, 0), up = P.camera(0, 0, 0, 1), down = P.camera(0, 0, 0, -1), over = P.camera(0, 0, 0, 5);
  assert.ok(near(mid.hz, H * HORIZON) && up.hz > H && down.hz < 0 && over.hz === up.hz);
  assert.equal(P.rowDepth(up, H - 1), Infinity); let prev = Infinity; for (let y = 0; y <= H; y++) { const d = P.rowDepth(down, y); assert.ok(d < prev); prev = d; }
  assert.ok(near(P.rowDepth(mid, mid.hz + 10), EYE * P.f / 10));
}
assert.equal(clampPitch(-3), -1);
// W A S D: 보는 방향 기준으로 앞·왼쪽·뒤·오른쪽
assert.deepEqual(cameraStep(0, [0, -1]), [0, -1]); assert.deepEqual(cameraStep(Math.PI / 2, [0, -1]), [1, 0]); assert.deepEqual(cameraStep(Math.PI, [0, -1]), [0, 1]); assert.deepEqual(cameraStep(-Math.PI / 2, [0, -1]), [-1, 0]);
assert.deepEqual(cameraStep(Math.PI / 2, [1, 0]), [0, 1], '동쪽을 볼 때 D는 남쪽'); assert.deepEqual(cameraStep(Math.PI / 2 + .6, [0, 1]), [-1, 0]); assert.deepEqual(cameraStep(7 * Math.PI, [0, -1]), [0, 1]);
// 보이는 모습: 뒤에서 보면 뒷모습, 마주 보면 앞모습
assert.equal(seenDir(0, 'up'), 'up'); assert.equal(seenDir(0, 'down'), 'down'); assert.equal(seenDir(Math.PI / 2, 'right'), 'up'); assert.equal(seenDir(Math.PI / 2, 'up'), 'left'); assert.equal(seenDir(Math.PI, 'up'), 'down'); assert.equal(seenDir(-Math.PI / 2, 'up'), 'right');
console.log('PASS: chase-camera 3D view on 5 screen sizes — me centred, near is bigger, taps map back, look up/down, camera-relative WASD, seen facing.');
