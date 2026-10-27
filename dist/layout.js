// Screen-size rules shared by the walking screen and the story scenes (phones, tablets, monitors).

// Zoom of the walking screen in CSS pixels per game pixel: about 13 rows × 16 columns of tiles on tablets and
// monitors, never below 1 on phones, and never so small that the map no longer fills the screen.
// Steps of whole device pixels keep the dots crisp (1.5× on a 2× iPad, 2× on a monitor).
export function worldScale(w, h, { dpr = 1, tile = 32, mapW = 40, mapH = 30, rows = 13, cols = 16 } = {}) {
  const step = v => Math.floor(v * dpr + 1e-6) / dpr, up = v => Math.ceil(v * dpr - 1e-6) / dpr;
  return Math.max(1, step(Math.min(h / (rows * tile), w / (cols * tile))), up(w / (mapW * tile)), up(h / (mapH * tile)));
}

// Story scene (320×180 picture) and its dialogue box. On screens taller than 16:9 the box goes under the picture,
// shrinking the picture a little if needed (down to 70 %), so the box never covers the characters' feet.
// Only on very wide or short screens (phones held sideways) does the box overlap the picture's lower part.
export function cutsceneLayout(w, h, boxH, { sw = 320, sh = 180, gap = 22, edge = 16 } = {}) {
  const full = Math.min(w / sw, h / sh), below = Math.min(w / sw, (h - boxH - gap - edge) / sh);
  const k = below >= full * .7 ? below : full, pw = sw * k, ph = sh * k;
  const oy = below >= full * .7 ? Math.max(0, (h - ph - boxH - gap - edge) / 2) : Math.max(0, Math.min((h - ph) / 2, h - boxH - 24 - ph * .8));
  return { k, ox: (w - pw) / 2, oy, pw, ph, boxBottom: Math.max(edge, h - (oy + ph) - boxH - gap), overlap: below < full * .7 };
}
