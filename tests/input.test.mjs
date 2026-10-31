// 방향키 조작감: 나중에 누른 방향 우선, 짧게 친 방향 기억(한 칸 걷는 도중에 친 것도), 오래된 입력은 버려요.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectionInput, BUFFER_MS } from '../dist/input.js';

test('the newest held direction wins, and letting go falls back to the older one', () => {
  const k = createDirectionInput();
  k.press('ArrowRight', 0); assert.deepEqual(k.next(10), [1, 0]);
  k.press('ArrowUp', 100); assert.deepEqual(k.next(120), [0, -1], 'pressing ↑ while holding → turns up at once');
  k.release('ArrowUp'); assert.deepEqual(k.next(400), [1, 0], 'back to → while it is still held');
  k.release('ArrowRight'); assert.equal(k.next(500), null);
});
test('a short tap is remembered for the next step, even in the middle of walking', () => {
  const k = createDirectionInput();
  k.press('ArrowRight', 0); k.next(0);
  k.press('ArrowDown', 110); k.release('ArrowDown');      // tapped and let go before the step ended
  assert.deepEqual(k.next(220), [0, 1], 'the ↓ tap becomes the next step');
  assert.deepEqual(k.next(440), [1, 0], 'then walking → continues');
  k.release('ArrowRight');
  k.press('ArrowLeft', 1000); k.release('ArrowLeft');
  assert.deepEqual(k.next(1016), [-1, 0], 'a tap from standing is one step');
  assert.equal(k.next(1032), null, 'only one step per tap');
  k.press('ArrowUp', 2000); k.release('ArrowUp');
  assert.equal(k.next(2000 + BUFFER_MS + 50), null, 'an old tap is forgotten');
});
test('W and ↑ count as the same direction, and clear() forgets everything', () => {
  const k = createDirectionInput();
  k.press('w', 0); k.press('ArrowUp', 10); k.release('w'); assert.deepEqual(k.next(20), [0, -1]);
  k.clear(); assert.equal(k.next(30), null); assert.equal(k.size, 0);
  assert.equal(k.press('q', 0), false, 'other keys are ignored');
});
console.log('PASS: newest direction wins, short taps (also mid-step) become one step, stale taps are dropped, W/↑ are one direction.');
