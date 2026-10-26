// Types text one character at a time. A second press shows the whole line at once.
export function createTypewriter(el, { speed = 28, onChar = null } = {}) {
  let timer = null, full = '', shown = 0, done = null, typing = false;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function stop() { if (timer) clearTimeout(timer); timer = null; }
  function render() { el.textContent = full.slice(0, shown); }
  function step() {
    shown = Math.min(full.length, shown + 1); render();
    if (onChar && shown % 2 === 0 && full[shown - 1] !== ' ') onChar();
    if (shown >= full.length) { finish(); return; }
    const ch = full[shown - 1];
    timer = setTimeout(step, /[.!?…,]/.test(ch) ? speed * 4 : speed);
  }
  function finish() {
    stop(); shown = full.length; render();
    if (typing) { typing = false; const fn = done; done = null; fn?.(); }
  }
  return {
    // Resolves when the whole line is visible.
    type(text) {
      stop(); full = String(text ?? ''); shown = 0; typing = true;
      const p = new Promise(r => { done = r; });
      if (reduce || !full.length) finish(); else { render(); timer = setTimeout(step, speed); }
      return p;
    },
    finish, get typing() { return typing; }, get text() { return full; },
    clear() { stop(); typing = false; done = null; full = ''; shown = 0; render(); }
  };
}
