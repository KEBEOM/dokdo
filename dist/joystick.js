// Virtual joystick for touch screens (phones, iPad, Galaxy Tab). The map moves one tile at a time, so the stick
// picks one of four directions: the stronger axis wins, with a little stickiness so a thumb near a diagonal does
// not flicker between two directions. A clearly diagonal push also gives a second direction, used to slide
// along a wall when the first one is blocked.

const DEAD = .28;        // inner part of the base where nothing happens (fraction of the radius)
const STICKY = 1.25;     // the other axis must be 25 % stronger before the direction switches
const SECOND = .38;      // the weaker axis counts as a second direction above 38 % of the push

// dx, dy: thumb offset from the centre (screen pixels, y down). prev: the last result (for stickiness).
export function joystickDirection(dx, dy, radius, prev = null) {
  const d = Math.hypot(dx, dy); if (d < radius * DEAD) return null;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  let horizontal = ax >= ay;
  if (prev) { const wasH = prev.primary[0] !== 0; horizontal = wasH ? !(ay > ax * STICKY) : ax > ay * STICKY; }
  const primary = horizontal ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
  const other = horizontal ? ay : ax;
  const secondary = other > d * SECOND ? (horizontal ? [0, Math.sign(dy)] : [Math.sign(dx), 0]) : null;
  return { primary, secondary, strength: Math.min(1, d / radius) };
}

// el: the joystick element (a base with a .joy-knob inside). onChange(direction | null) runs whenever the
// direction changes; direction is the joystickDirection() result.
export function createJoystick(el, onChange) {
  const knob = el.querySelector('.joy-knob');
  let pointer = null, current = null, centre = null, radius = 1, vector = null; // vector: 민 방향과 세기(−1…1), 3D 보기의 자유 걷기에 써요
  const show = (x, y) => { knob.style.transform = `translate(${x}px, ${y}px)`; };
  const mark = dir => { for (const n of ['up', 'down', 'left', 'right']) el.classList.toggle(`go-${n}`, !!dir && dirName(dir.primary) === n); };
  function set(dir) {
    const same = dir && current && dir.primary.join() === current.primary.join() && (dir.secondary || []).join() === (current.secondary || []).join();
    current = dir; mark(dir); if (!same) onChange(dir);
  }
  function track(e) {
    const dx = e.clientX - centre.x, dy = e.clientY - centre.y, d = Math.hypot(dx, dy), k = d > radius ? radius / d : 1;
    show(dx * k, dy * k); set(joystickDirection(dx, dy, radius, current));
    const m = Math.min(1, d / radius); vector = m < DEAD ? null : { x: dx / d * m, y: dy / d * m };
  }
  function release() {
    if (pointer === null) return;
    pointer = null; vector = null; el.classList.remove('active'); knob.style.transition = 'transform .14s ease-out'; show(0, 0);
    if (current) { current = null; mark(null); onChange(null); }
  }
  el.addEventListener('pointerdown', e => {
    if (pointer !== null) return;
    e.preventDefault(); pointer = e.pointerId; el.setPointerCapture?.(e.pointerId);
    const r = el.getBoundingClientRect(); centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; radius = r.width * .36;
    el.classList.add('active'); knob.style.transition = 'none'; track(e);
  });
  el.addEventListener('pointermove', e => { if (e.pointerId === pointer) track(e); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, e => { if (e.pointerId === pointer) release(); });
  return { get direction() { return current; }, get vector() { return vector; }, reset: release };
}
const dirName = ([x, y]) => x < 0 ? 'left' : x > 0 ? 'right' : y < 0 ? 'up' : 'down';

// 둘러보기 조이스틱(v0.62, 3D 보기): 민 만큼 세기가 달라지는 아날로그 스틱. vector 는 { x, y }(−1…1, 화면 기준 y 아래쪽) 또는 null
export function createLookStick(el) {
  const knob = el.querySelector('.joy-knob');
  let pointer = null, centre = null, radius = 1, vector = null;
  const show = (x, y) => { knob.style.transform = `translate(${x}px, ${y}px)`; };
  function track(e) {
    const dx = e.clientX - centre.x, dy = e.clientY - centre.y, d = Math.hypot(dx, dy), k = d > radius ? radius / d : 1;
    show(dx * k, dy * k); const m = Math.min(1, d / radius); vector = m < .15 ? null : { x: dx / (d || 1) * m, y: dy / (d || 1) * m };
  }
  function release() { if (pointer === null) return; pointer = null; vector = null; el.classList.remove('active'); knob.style.transition = 'transform .14s ease-out'; show(0, 0); }
  el.addEventListener('pointerdown', e => {
    if (pointer !== null) return;
    e.preventDefault(); pointer = e.pointerId; el.setPointerCapture?.(e.pointerId);
    const r = el.getBoundingClientRect(); centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; radius = r.width * .36;
    el.classList.add('active'); knob.style.transition = 'none'; track(e);
  });
  el.addEventListener('pointermove', e => { if (e.pointerId === pointer) track(e); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, e => { if (e.pointerId === pointer) release(); });
  return { get vector() { return vector; }, reset: release };
}
