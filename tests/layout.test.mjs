// Screen-size rules (dist/layout.js): zoom of the walking screen and the story-scene layout.
import assert from 'node:assert/strict';
import { worldScale, cutsceneLayout } from '../dist/layout.js';
import { MAP_W, MAP_H } from '../dist/maps.js';

const map = { mapW: MAP_W, mapH: MAP_H, tile: 32 };
const rows = (w, h, dpr) => h / worldScale(w, h, { ...map, dpr }) / 32;
// crisp: always a whole number of device pixels per game pixel
for (const [w, h, dpr] of [[1180, 740, 2], [820, 1100, 2], [1280, 720, 2], [390, 664, 3], [1920, 955, 1], [1366, 657, 1]]) {
  const s = worldScale(w, h, { ...map, dpr }); assert.ok(Number.isInteger(Math.round(s * dpr * 1e6) / 1e6), `${w}×${h}: ${s}× on a ${dpr}× screen`);
  assert.ok(s >= 1, 'never smaller than 1 CSS pixel per game pixel');
  assert.ok(w / s <= MAP_W * 32 + 1 && h / s <= MAP_H * 32 + 1, 'the map always fills the screen');
}
// tablets see as much as a monitor (13+ rows of tiles), instead of 11 as before
for (const [w, h] of [[1180, 740], [1133, 664], [1280, 720], [820, 1100], [800, 1200]]) assert.ok(rows(w, h, 2) >= 13, `${w}×${h}: ${rows(w, h, 2).toFixed(1)} rows`);
assert.equal(worldScale(1180, 740, { ...map, dpr: 2 }), 1.5, 'iPad landscape: 1.5× (3 device pixels per dot)');
assert.equal(worldScale(1920, 955, { ...map, dpr: 1 }), 2, 'monitor: unchanged 2×');
assert.equal(worldScale(390, 664, { ...map, dpr: 3 }), 1, 'phone: unchanged 1×');
// story scenes: on tablets and monitors the dialogue box sits under the whole picture
for (const [w, h] of [[1180, 740], [820, 1100], [1133, 664], [1280, 720], [1366, 944], [1920, 955], [390, 664]]) {
  const L = cutsceneLayout(w, h, 150);
  assert.equal(L.overlap, false, `${w}×${h}: box under the picture`);
  assert.ok(L.oy + L.ph + 150 + L.boxBottom <= h + 1 && L.oy >= 0 && L.ox >= 0, `${w}×${h}: picture and box fit`);
}
// only phones held sideways (very little height) let the box overlap the picture's lower part
assert.equal(cutsceneLayout(844, 340, 110).overlap, true);
console.log('layout: zoom and story-scene rules hold on phones, tablets and monitors');

// virtual joystick: four directions with a dead centre, stickiness near diagonals, a second direction for sliding
import { joystickDirection } from '../dist/joystick.js';
const R = 50;
assert.equal(joystickDirection(5, 5, R), null, 'small pushes do nothing');
assert.deepEqual(joystickDirection(40, 0, R).primary, [1, 0]);
assert.deepEqual(joystickDirection(0, -40, R).primary, [0, -1]);
assert.deepEqual(joystickDirection(-30, 10, R).primary, [-1, 0]);
assert.equal(joystickDirection(40, 5, R).secondary, null, 'a straight push has no second direction');
const diag = joystickDirection(30, 28, R); assert.deepEqual(diag.primary, [1, 0]); assert.deepEqual(diag.secondary, [0, 1], 'diagonal: slide down when right is blocked');
const right = joystickDirection(40, 0, R);
assert.deepEqual(joystickDirection(30, 33, R, right).primary, [1, 0], 'near a diagonal the direction does not flicker');
assert.deepEqual(joystickDirection(20, 40, R, right).primary, [0, 1], 'a clear change of direction switches');
console.log('joystick: direction rules hold');
