// ─────────────────────────────────────────────────────────────────────────────
// 방향키 입력 (v0.53 조작감)
//
// • 가장 나중에 누른 방향이 이겨요: → 를 누른 채 ↑ 를 더 누르면 바로 위로 걸어요(↑를 떼면 다시 →).
// • 짧게 톡 친 방향을 기억해요: 한 칸 걷는 도중에 잠깐 누르고 뗀 방향도 BUFFER_MS 안이면 다음 걸음으로 이어져요.
// • 같은 방향의 두 키(↑와 W)는 하나로 쳐요.
// keys: 'ArrowUp' 같은 KeyboardEvent.key 값 · next(now)는 지금 걸을 방향([dx, dy]) 또는 null
// ─────────────────────────────────────────────────────────────────────────────

export const BUFFER_MS = 250;
export const KEY_VECTORS = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };
const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

export function createDirectionInput() {
  let held = [], queued = null;               // held: 누르고 있는 키(누른 순서), queued: 짧게 친 방향 {dir, at}
  const isHeld = dir => held.some(k => same(KEY_VECTORS[k], dir));
  return {
    press(key, now) {
      const dir = KEY_VECTORS[key]; if (!dir) return false;
      held = held.filter(k => k !== key); held.push(key);
      queued = { dir, at: now };
      return true;
    },
    release(key) { held = held.filter(k => k !== key); },
    clear() { held = []; queued = null; },
    // 지금 한 걸음 내디딜 방향. 짧게 친 방향(이미 뗀 것)이 있으면 그것이 먼저, 아니면 가장 나중에 누른 키.
    next(now) {
      if (queued && !isHeld(queued.dir)) {
        const q = queued; queued = null;
        if (now - q.at <= BUFFER_MS) return q.dir;
      }
      if (held.length) { queued = null; return KEY_VECTORS[held.at(-1)]; }
      return null;
    },
    get size() { return held.length; },
    get pending() { return !!queued; }
  };
}
