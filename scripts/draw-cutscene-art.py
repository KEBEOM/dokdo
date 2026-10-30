"""컷신 배경 도트 그림 (v0.38)

    python scripts/draw-cutscene-art.py        # Pillow 필요

  dist/assets/scenery/cutscene-art-v47.png   그림 모음
  dist/cutscene-atlas.js                     그림마다 자리(rect)

컷신 화면은 320×180 도트예요. 여기 그림은 그 크기 그대로(1도트 = 화면 1도트) 그립니다.
하늘·바다는 색 띠 사이를 체크무늬(디더링)로 섞고, 산·천막·배는 왼쪽 위에서 오는 빛으로 밝은 면과 그늘을 나눠 칠해요.
움직이는 것(구름 흐름, 물결 반짝임, 받침대 빛, 화면 글자)은 cutscene.js가 이 그림 위에 그려요.
"""
import json, math, os, random
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PNG = os.path.join(ROOT, 'dist', 'assets', 'scenery', 'cutscene-art-v47.png')
OUT_JS = os.path.join(ROOT, 'dist', 'cutscene-atlas.js')

def hexc(s, a=255):
    s = s.lstrip('#'); return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)
def rgb(c): return hexc(c) if isinstance(c, str) else c
def mix(a, b, t):
    a, b = rgb(a), rgb(b); return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(4))
def tone(c, f):
    r, g, b, a = rgb(c); return (max(0, min(255, round(r * f))), max(0, min(255, round(g * f))), max(0, min(255, round(b * f))), a)

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
def dith(x, y, t):  # True if this pixel should take the second colour (ordered dithering)
    return (BAYER[y % 4][x % 4] + .5) / 16 < t

class Pic:
    def __init__(s, w, h): s.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); s.d = ImageDraw.Draw(s.im); s.w, s.h = w, h; s.px = s.im.load()
    def r(s, x, y, w, h, c):
        if w > 0 and h > 0: s.d.rectangle([x, y, x + w - 1, y + h - 1], fill=rgb(c))
    def p(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[x, y] = rgb(c)
    def get(s, x, y): return s.px[x, y] if 0 <= x < s.w and 0 <= y < s.h else (0, 0, 0, 0)
    def poly(s, pts, c): s.d.polygon(pts, fill=rgb(c))
    def ellipse(s, x0, y0, x1, y1, c): s.d.ellipse([x0, y0, x1, y1], fill=rgb(c))
    def line(s, pts, c, w=1): s.d.line(pts, fill=rgb(c), width=w)

def ramp_fill(p, x0, y0, w, h, stops):
    """Vertical gradient through palette stops, dithered between neighbouring colours."""
    n = len(stops) - 1
    for y in range(h):
        f = y / max(1, h - 1) * n; i = min(n - 1, int(f)); t = f - i
        for x in range(w): p.p(x0 + x, y0 + y, stops[i + 1] if dith(x, y, t) else stops[i])

R = random.Random(38)

# ─────────────────────────── 하늘 · 구름 · 해 ───────────────────────────
def sky(stops, w=320, h=100, streaks=None):
    p = Pic(w, h); ramp_fill(p, 0, 0, w, h, stops)
    for (x, y, l, c) in streaks or []:  # thin high cirrus
        for i in range(l):
            if dith(x + i, y, .55 + .4 * math.sin(i / l * math.pi)): p.p(x + i, y, c)
            if i % 3 and dith(x + i, y + 1, .25 * math.sin(i / l * math.pi)): p.p(x + i + 2, y + 1, c)
    return p

def cloud(w, h, blobs, top='#ffffff', mid='#eef7fa', shade='#cfe3ec', base='#b2cfdc'):
    p = Pic(w, h); mask = Image.new('L', (w, h), 0); md = ImageDraw.Draw(mask)
    for (cx, cy, r) in blobs: md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    md.rectangle([blobs[0][0] - blobs[0][2] // 2, h - 4, blobs[-1][0] + blobs[-1][2] // 2, h - 1], fill=255)
    m = mask.load()
    for y in range(h):
        for x in range(w):
            if not m[x, y]: continue
            # light from the upper left: distance from each blob centre decides the tone
            lit = max(((cx - x) * .6 + (cy - y) * 1.0) / r for (cx, cy, r) in blobs if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 2) if any((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 2 for (cx, cy, r) in blobs) else -1
            fy = y / (h - 1)
            if fy > .82: c = base if dith(x, y, .7) else shade
            elif lit > .35: c = top
            elif lit > -.1: c = mid if not dith(x, y, .2) else top
            elif fy > .6: c = shade
            else: c = mid if dith(x, y, .5) else shade
            p.p(x, y, c)
    return p

def sun(r=10, pad=6):
    s = 2 * (r + pad) + 1; p = Pic(s, s); c = r + pad
    for y in range(s):
        for x in range(s):
            d = math.hypot(x - c, y - c)
            if d <= r - 2: p.p(x, y, '#fff8d8')
            elif d <= r: p.p(x, y, '#ffeaa0')
            elif d <= r + pad and dith(x, y, .45 * (1 - (d - r) / pad)): p.p(x, y, (255, 246, 214, 150))
    return p

# ─────────────────────────── 바다 ───────────────────────────
def sea(w=320, h=90, deep=('#7fc9d9', '#3c9db5', '#2b86a0', '#22738d', '#1d6680'), night=False):
    p = Pic(w, h)
    stops = list(deep)
    ramp_fill(p, 0, 0, w, h, stops)
    p.r(0, 0, w, 1, '#d6f1f4' if not night else '#3d6a88')
    rr = random.Random(7)
    # wave strokes: short and thin near the horizon, longer and wider in front
    for y in range(2, h):
        f = y / h; gap = int(40 - 22 * f); length = int(2 + 10 * f)
        off = rr.randrange(gap)
        for x in range(-length + off, w, gap + rr.randrange(4)):
            col = mix(p.get(max(0, min(w - 1, x)), y), '#bfeaf0' if not night else '#5d8eb0', .55 + .25 * f)
            if y % (3 if f < .35 else 4) == (x // 7) % 2:
                for i in range(length):
                    if 0 <= x + i < w: p.p(x + i, y, col)
                if f > .45 and length > 6:  # darker trough under the crest
                    for i in range(1, length - 1):
                        if 0 <= x + i < w: p.p(x + i, y + 1, tone(p.get(x + i, y + 1), .86))
    return p

# ─────────────────────────── 울릉도 산 ───────────────────────────
def ulleung(w, h, seed, haze=0.0):
    """울릉도(2D 도트): 성인봉을 가운데 둔 넓고 가파른 섬. 숲 윤곽은 둥글둥글 나무 끝 모양, 봉우리 오른쪽은 그늘,
    밝은 면에는 나무 머리 무늬, 아래는 회색 현무암 절벽과 도동 마을. 멀수록 하늘빛으로 흐려요."""
    rr = random.Random(seed); p = Pic(w, h)
    cliff_h = max(5, h // 9); water = h - 1; base = water - cliff_h
    peaks = [(.50, .02, 1.0), (.32, .22, .8), (.67, .17, .85), (.18, .44, .6), (.83, .40, .6), (.07, .62, .4), (.94, .60, .4)]
    def hz(c): return mix(c, '#a7ccd2', haze) if haze else rgb(c)
    def sky_line(x):
        y = base
        for (pu, pv, k) in peaks:
            d = abs(x / w - pu)
            y = min(y, pv * h + (d ** 1.15) * h * 2.3 / k)
        return y
    top = [sky_line(x) for x in range(w)]
    for x in range(w):   # treetop scallops along the skyline
        top[x] = int(round(top[x] - (1.2 if (x // 3) % 2 == 0 else 0) - (.6 if (x // 7) % 3 == 0 else 0)))
    mask = Image.new('L', (w, h), 0); md = ImageDraw.Draw(mask)
    md.polygon([(x, top[x]) for x in range(w)] + [(w - 1, water), (0, water)], fill=255)
    m = mask.load()
    summits = []
    for (pu, pv, k) in peaks:
        x = int(pu * w); summits.append((x, top[x], 'main' if k >= .85 else 'sub'))
    flat_shade(p, m, top, w, base + 1, base, summits, ['#4f8a4a', '#2f5e3e', '#234a34', '#78ad5c', '#1d3a2c'], rr, hz, details=False, bands_on=False)
    for _ in range(int(w * h / 40)):   # treetop marks: little lit arcs on the sunny faces, dark ones in the shade
        x = rr.randrange(1, w - 3); y = rr.randrange(top[x] + 2, base - 1) if top[x] + 2 < base - 1 else None
        if y is None: continue
        c = p.get(x, y)
        if c == hz('#4f8a4a'): p.p(x, y, hz('#78ad5c')); p.p(x + 1, y - 1, hz('#78ad5c')); p.p(x + 2, y, hz('#78ad5c'))
        elif c == hz('#2f5e3e'): p.p(x, y, hz('#234a34')); p.p(x + 1, y - 1, hz('#3a6c45')); p.p(x + 2, y, hz('#234a34'))
    for x in range(w):   # sea cliffs: flat grey basalt, a lit rim, vertical joints, dark waterline and foam
        ct = base - (1 if (x // 5) % 3 == 0 else 0)
        for y in range(ct, water + 1):
            c = '#8f897f' if y < water - 2 else '#5c5751'
            if x % 6 == 0 and y > ct: c = '#6e6961'
            if y == ct: c = '#bcb4a3'
            p.p(x, y, hz(c))
        if x % 3 != 1: p.p(x, water, hz('#eef9f7'))
    vx = int(w * .58)   # 도동 village in the valley mouth
    for i in range(6):
        hx = vx - 10 + i * 4 + rr.randrange(2); hy = base - 2 - (i % 3)
        p.r(hx, hy, 3, 2, hz('#f3f1e8')); p.r(hx, hy - 1, 3, 1, hz(rr.choice(['#c8574a', '#3d77a8', '#4f8a7a', '#d98a3a'])))
    return p

# ─────────────────────────── 독도 ───────────────────────────
# 바다에서 본 독도(남쪽에서 바라본 모습을 단순하게): 왼쪽은 높고 뾰족한 서도(168.5m), 오른쪽은 낮고 넓은 동도(98.6m).
# 갈색·회색 화산암에 가로 지층, 위쪽 비탈의 풀, 물가의 해식동굴, 동도 꼭대기의 흰 등대와 건물, 서도 기슭의 주민숙소.
SEODO = [(0, 0), (0.02, 0.06), (0.05, 0.17), (0.08, 0.30), (0.11, 0.45), (0.14, 0.60), (0.17, 0.74), (0.20, 0.85), (0.225, 0.93), (0.24, 0.975),
         (0.255, 1.0), (0.27, 0.99), (0.285, 0.96), (0.30, 0.97), (0.315, 0.93), (0.33, 0.84), (0.345, 0.76), (0.37, 0.70), (0.39, 0.67), (0.41, 0.62),
         (0.43, 0.50), (0.45, 0.36), (0.475, 0.22), (0.50, 0.09), (0.515, 0)]
DONGDO = [(0.53, 0), (0.545, 0.12), (0.56, 0.28), (0.58, 0.42), (0.60, 0.51), (0.625, 0.555), (0.65, 0.54), (0.675, 0.50), (0.70, 0.53), (0.725, 0.58),
          (0.755, 0.605), (0.79, 0.615), (0.825, 0.61), (0.85, 0.58), (0.875, 0.52), (0.895, 0.46), (0.915, 0.43), (0.935, 0.34), (0.955, 0.20), (0.975, 0.08), (0.99, 0)]
SEODO_PEAKS = [(0.255, 1.0), (0.30, 0.97), (0.39, 0.67)]
DONGDO_PEAKS = [(0.625, 0.555), (0.76, 0.61), (0.84, 0.61), (0.91, 0.44)]
ROCKS = [(-0.012, 0.15, 0.03), (0.522, 0.06, 0.022), (0.997, 0.11, 0.03)]   # 촛대바위 같은 작은 바위들 (u, 높이, 너비)
ROCK_LIT = ['#6a5d56', '#7f6e5f', '#968067', '#ae977a', '#c5ae8f']
ROCK_SHD = ['#2b292d', '#373235', '#453e3f', '#554b47', '#655850']
GRASS = ['#4a663d', '#5d7a42', '#76944f', '#91ae5e']

def value_noise(seed, scale):
    rr = random.Random(seed); g = {}
    def at(ix, iy):
        if (ix, iy) not in g: g[(ix, iy)] = rr.random()
        return g[(ix, iy)]
    def n(x, y):
        x /= scale; y /= scale; ix, iy = math.floor(x), math.floor(y); fx, fy = x - ix, y - iy
        sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx; b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx
        return a + (b - a) * sy
    return n

def flat_shade(p, m, top, w, h, water, summits_px, pal, rr, hz, details=True, bands_on=True):
    """2D 도트식 명암. summits_px: (x, y, 종류) — 'main'은 봉우리에서 바다까지 계단 모양 경계를 긋고 그 오른쪽 전체를 그늘로,
    'sub'는 작은 봉우리 아래 짧은 그늘 줄. 경계 왼쪽 1도트는 밝은 능선, 그늘 아래쪽은 더 짙게, 외곽선 1도트."""
    base, shade, deep, light, line = pal
    alt = tone(base, .9)   # 층층이 쌓인 바위: 넓은 가로 띠 두세 개를 조금 어둡게(경계는 들쭉날쭉)
    bands = [(int(h * f), int(h * f) + max(2, h // 14)) for f in (.38, .6, .78)] if bands_on else []
    for x in range(w):
        wob = (x * 7 // 5) % 3 - 1
        for y in range(top[x], water + 1):
            if m[x, y]: p.p(x, y, hz(alt if any(b0 + wob <= y < b1 + wob for (b0, b1) in bands) else base))
    ridge = set(); shaded = set()
    for (sx, sy, kind) in summits_px:
        x = float(sx); step = 0; slope = .42 if kind == 'main' else .25
        last = water if kind == 'main' else min(water, sy + max(3, (water - sy) // 2))
        width = 0 if kind == 'main' else rr.randrange(2, 4)
        for y in range(sy, last + 1):
            step += 1
            if step >= rr.randrange(2, 4): x += slope * step + rr.choice([0, 0, 0, 1, -1]) * .6; step = 0
            bx = int(round(x))
            if not (0 <= bx < w) or not m[bx, y]: continue
            ridge.add((bx, y))
            xx = bx + 1
            while xx < w and m[xx, y] and (width == 0 or xx <= bx + width):
                shaded.add((xx, y)); xx += 1
    for (x, y) in shaded: p.p(x, y, hz(tone(shade, .9) if p.get(x, y) == hz(alt) else shade))
    for (x, y) in ridge:
        if (x, y) not in shaded: p.p(x, y, hz(light))
    for x in range(w):  # deeper shadow low in the shaded faces, and along the right outline
        for y in range(top[x], water + 1):
            if (x, y) in shaded and (y > water - (water - top[x]) * .28 or not (x + 2 < w and m[x + 2, y])): p.p(x, y, hz(deep))
            if m[x, y] and (x, y) not in shaded and x > 0 and not m[x - 1, y] and x + 1 < w and m[x + 1, y]: p.p(x + 1, y, hz(light))
    if details:
        for _ in range(max(3, w * h // 520)):   # a few long rock ledges: lit top, dark underside
            x = rr.randrange(w)
            if top[x] >= water - 8: continue
            y = rr.randrange(top[x] + 4, water - 4); L = rr.randrange(4, 6 + w // 25)
            for i in range(L):
                xx = x + i; yy = y + i // 6
                if xx < w and m[xx, yy] and m[xx, yy + 1]:
                    sh = (xx, yy) in shaded
                    p.p(xx, yy, hz(base if sh else light)); p.p(xx, yy + 1, hz(deep if sh else shade))
        for _ in range(max(2, w * h // 700)):   # short cracks
            x = rr.randrange(w)
            if top[x] >= water - 8: continue
            y = rr.randrange(top[x] + 3, water - 4)
            for i in range(rr.randrange(2, 5)):
                if 0 <= x < w and m[x, y + i]: p.p(x, y + i, hz(deep))
                x += rr.choice([0, 0, 1])
    for x in range(w):  # outline
        for y in range(top[x], water):
            if m[x, y] and (y == 0 or not m[x, y - 1] or x == 0 or not m[x - 1, y] or x == w - 1 or not m[x + 1, y]):
                p.p(x, y, hz(line))

def dokdo(w, which='pair', haze=0.0, seed=4):
    """바다에서 본 독도(2D 도트): 왼쪽 서도(높고 뾰족), 오른쪽 동도(낮고 넓고 위가 풀밭·등대).
    색은 바위 5색·풀 3색만 쓰고, 멀리 있는 작은 그림일수록 하늘빛으로 흐리고 세부를 줄여 원근감을 줘요."""
    rr = random.Random(seed * 1000 + w)
    if which == 'pair':
        h = round(w * .509); shapes = [SEODO, DONGDO]; peaks = SEODO_PEAKS + DONGDO_PEAKS; rocks = ROCKS; x0u, x1u = .035, .965
    else:
        k = 1 / .515; h = round(w * .975); shapes = [[(u * k, v) for (u, v) in SEODO]]; peaks = [(u * k, v) for (u, v) in SEODO_PEAKS]
        rocks = [(-0.02, 0.12, 0.05)]; x0u, x1u = .05, .95
    p = Pic(w, h); water = h - 2; H = h - 5
    def hz(c): return mix(c, '#a9c9d3', haze) if haze else rgb(c)
    def X(u): return x0u * w + u * (x1u - x0u) * w
    def Y(v): return water - v * H
    mask = Image.new('L', (w, h), 0); md = ImageDraw.Draw(mask)
    for sh in shapes:
        pts = []
        for (a, b) in zip(sh, sh[1:]):
            for kk in range(2):
                t = kk / 2; u = a[0] + (b[0] - a[0]) * t; v = a[1] + (b[1] - a[1]) * t
                pts.append((round(X(u)), round(Y(v) + (0 if v > .96 else rr.choice([0, 0, 1])))))
        pts.append((round(X(sh[-1][0])), round(Y(0)))); md.polygon(pts, fill=255)
    for (u, hh, ww) in rocks:
        cx = X(u); md.polygon([(cx - ww * w / 2, Y(0)), (cx - ww * w * .15, Y(hh)), (cx + ww * w * .2, Y(hh * .85)), (cx + ww * w / 2, Y(0))], fill=255)
        peaks = peaks + [(u, hh)]
    m = mask.load()
    top = [next((y for y in range(h) if m[x, y]), h) for x in range(w)]
    detail = w >= 110
    mains = {SEODO_PEAKS[0], DONGDO_PEAKS[1]} | set(rocks and [(r[0], r[1]) for r in rocks])
    if which != 'pair': mains = {peaks[0]} | {(r[0], r[1]) for r in rocks}
    summits = [(round(X(u)), round(Y(v)), 'main' if (u, v) in mains else 'sub') for (u, v) in peaks]
    flat_shade(p, m, top, w, h, water, summits, ['#9b7d65', '#6c5547', '#4c3d36', '#c3a283', '#33282a'], rr, hz, details=detail)
    # grass: a cap on 서도's upper slopes and 동도's flat top, with a jagged lower edge; shaded where the rock is in shadow
    for x in range(w):
        t0 = top[x]
        if t0 >= water - 3: continue
        u = (x / w - x0u) / (x1u - x0u)
        v = (water - t0) / H
        cap = 0
        if which == 'pair' and .6 < u < .9: cap = 3 + w // 60
        elif v > .45: cap = 2 + w // 90
        cap += rr.choice([0, 0, 1])
        for y in range(t0 + 1, min(water - 3, t0 + 1 + cap)):
            if not m[x, y]: continue
            c = p.get(x, y)
            g = '#5d7c3c' if c in (hz('#6c5547'), hz('#4c3d36')) else '#86a653'
            if y == t0 + 1 and g == '#86a653': g = '#a4c46c'
            p.p(x, y, hz(g))
    if detail:
        for _ in range(max(3, w // 28)):   # flat grass patches on 서도's upper sunny slope
            x0 = rr.randrange(int(X(.10)), int(X(.25))); y0 = top[x0] + rr.randrange(2, 8)
            pw, ph = rr.randrange(3, 7), rr.randrange(2, 4)
            for yy in range(y0, y0 + ph):
                for xx in range(x0 - (yy - y0), x0 + pw - (yy - y0) // 2):
                    if 0 <= xx < w and m[xx, yy] and p.get(xx, yy) not in (hz('#33282a'),):
                        p.p(xx, yy, hz('#86a653' if yy > y0 else '#a4c46c'))
        for _ in range(max(2, w // 40)):   # grassy ledges further down 서도
            x = rr.randrange(int(X(.08)), int(X(.34)))
            if top[x] + 6 >= water - 8: continue
            y = rr.randrange(top[x] + 6, water - 8)
            for i in range(rr.randrange(3, 6)):
                if m[x + i, y]: p.p(x + i, y, hz('#86a653')); p.p(x + i, y + 1, hz('#5d7c3c'))
        for _ in range(max(2, w // 30)):   # seabird droppings
            x = rr.randrange(2, w - 2); y = top[x] + rr.randrange(4, 10)
            for i in range(rr.randrange(2, 4)):
                if 0 <= y + i < water - 2 and m[x, y + i]: p.p(x, y + i, hz('#e4dfd2'))
    # waterline: dark band, sea caves, foam
    for x in range(w):
        if m[x, water - 1]: p.p(x, water, hz('#2a2427')); p.p(x, water - 1, hz('#4c3d36'))
        if (m[x, water - 1] or (x > 0 and m[x - 1, water - 1]) or (x + 1 < w and m[x + 1, water - 1])) and (x % 3 != 1): p.p(x, water + 1, hz('#eef9f9'))
    for _ in range(max(1, w // 45)):
        x = rr.randrange(3, w - 6)
        if m[x, water - 3] and m[x + 3, water - 3]:
            for i in range(4):
                for j in range(2 + (i in (1, 2))): p.p(x + i, water - 1 - j, hz('#17131a'))
    if which == 'pair' and w >= 96:
        s_ = max(1, w // 160)
        lx = int(X(.835)); ly = top[lx]
        p.r(lx - s_, ly - 4 * s_ - 1, 2 * s_ + 1, 4 * s_ + 2, hz('#33282a')); p.r(lx - s_ + 1, ly - 4 * s_, 2 * s_ - 1 if s_ > 1 else 1, 4 * s_ + 1, hz('#f6f6f0'))
        p.r(lx - s_, ly - 5 * s_ - 1, 2 * s_ + 1, s_, hz('#d0453c'))
        bx = int(X(.775)); by = top[bx]
        p.r(bx - 2 * s_, by - 2 * s_ - 1, 4 * s_ + 1, 2 * s_ + 2, hz('#33282a')); p.r(bx - 2 * s_ + 1, by - 2 * s_, 4 * s_ - 1, 2 * s_, hz('#f0f2ee')); p.r(bx - 2 * s_, by - 2 * s_ - 1, 4 * s_ + 1, 1, hz('#3d6fa8'))
        hx = int(X(.48)); hy = water - 2 - 3 * s_
        p.r(hx, hy, 3 * s_ + 1, 3 * s_, hz('#f2f2ec')); p.r(hx, hy - 1, 3 * s_ + 1, 1, hz('#3d6fa8'))
        dx0, dx1 = int(X(.535)), int(X(.585)); p.r(dx0, water - 1, dx1 - dx0, 2, hz('#b8b8b0'))
    return p

# ─────────────────────────── 땅: 모래 · 나무 데크 · 풀밭 ───────────────────────────
def sand(w=320, h=18):
    rr = random.Random(3); p = Pic(w, h)
    ramp_fill(p, 0, 0, w, h, ['#d7b98a', '#efd49d', '#f4dcaa', '#ecd09a'])
    for x in range(w):  # wet edge and a lace of foam at the waterline
        if dith(x, 0, .8): p.p(x, 0, '#f6fbf7')
        if dith(x, 1, .35): p.p(x, 1, '#ffffff')
        p.p(x, 2, '#c9ac7c') if dith(x, 2, .5) else None
    for _ in range(w * 2):
        x, y = rr.randrange(w), rr.randrange(3, h)
        p.p(x, y, rr.choice(['#d9bb86', '#fbe7bf', '#c9a978']))
    for _ in range(14):  # pebbles and shells
        x, y = rr.randrange(4, w - 4), rr.randrange(5, h - 2)
        if rr.random() < .5: p.r(x, y, 2, 1, '#9b8f80'); p.p(x, y - 1, '#c9bfb0')
        else: p.p(x, y, '#fff6ea'); p.p(x + 1, y, '#e9c9b5'); p.p(x, y + 1, '#d9a98f')
    return p

def deck(w=320, h=68):
    rr = random.Random(5); p = Pic(w, h)
    p.r(0, 0, w, 3, '#5a3a24'); p.r(0, 0, w, 1, '#8a6040')     # front beam
    ph = 7; y = 3; row = 0
    while y < h:
        f = (y - 3) / max(1, h - 3)
        base = mix('#a8774c', '#7a5133', f)
        off = (row * 37) % 60
        x = -off
        while x < w:
            l = rr.randrange(44, 78); cc = tone(base, rr.uniform(.93, 1.07))
            p.r(x, y, l, ph - 1, cc)
            p.r(x, y, l, 1, tone(cc, 1.14))                       # lit top edge
            for gx in range(x + 3, x + l - 3, rr.randrange(5, 9)):  # wood grain
                if rr.random() < .7: p.r(gx, y + 2 + rr.randrange(ph - 3), rr.randrange(2, 5), 1, tone(cc, .9))
            p.p(x + 2, y + 2, '#4a3020'); p.p(x + l - 3, y + 2, '#4a3020')   # nails
            p.r(x + l - 1, y, 1, ph - 1, '#4a301f')               # seam
            x += l
        p.r(0, y + ph - 1, w, 1, tone(base, .62))                 # gap between boards
        y += ph; row += 1
    return p

def meadow(w=320, h=126, path=None):
    rr = random.Random(11); p = Pic(w, h)
    ramp_fill(p, 0, 0, w, h, ['#8fb867', '#9cc46d', '#93bd66', '#86b05e'])
    for _ in range(w * h // 9):  # blades: a darker stroke under a light tip
        x, y = rr.randrange(w), rr.randrange(h)
        p.p(x, y, '#6f9a4e'); p.p(x, y - 1, '#b3d684' if rr.random() < .6 else '#7ea657')
    if path:
        px0, py0, pw, phh = path
        for y in range(py0, py0 + phh):
            for x in range(px0, px0 + pw):
                ex = min(x - px0, px0 + pw - 1 - x, y - py0, py0 + phh - 1 - y)
                if ex < 0: continue
                if ex == 0 and rr.random() < .5: continue
                c = '#d8b67f' if ex > 1 else '#c19a65'
                if dith(x, y, .18): c = '#e6c893'
                p.p(x, y, c)
        for _ in range(pw * phh // 40):
            x, y = rr.randrange(px0 + 2, px0 + pw - 2), rr.randrange(py0 + 2, py0 + phh - 2)
            p.r(x, y, 2, 1, '#a88a62'); p.p(x, y - 1, '#f1dcb1')
    for _ in range(46):  # flowers: 해국 purple, yellow and white
        x, y = rr.randrange(2, w - 2), rr.randrange(6, h - 2)
        if path and path[0] - 2 <= x <= path[0] + path[2] + 2 and path[1] - 2 <= y <= path[1] + path[3] + 2: continue
        c = rr.choice(['#b79be0', '#f3d35b', '#ffffff', '#b79be0'])
        p.p(x, y, c); p.p(x - 1, y, tone(c, .85)); p.p(x + 1, y, tone(c, .85)); p.p(x, y - 1, tone(c, 1.1)); p.p(x, y + 1, '#5d8a41')
    return p

def rocky_top(w=320, h=86):
    """대한봉 정상: 바위가 드러난 풀밭과 자갈길."""
    rr = random.Random(21); p = Pic(w, h)
    ramp_fill(p, 0, 0, w, h, ['#7e9a62', '#8ba86a', '#809d61', '#72905a'])
    for _ in range(w * h // 10):
        x, y = rr.randrange(w), rr.randrange(h); p.p(x, y, '#64824c'); p.p(x, y - 1, '#a7c37f')
    for _ in range(16):  # outcrops
        x, y, r = rr.randrange(w), rr.randrange(4, h - 30), rr.randrange(3, 7)
        for dy in range(-r, 1):
            for dx in range(-r - 2, r + 3):
                if dx * dx / ((r + 2) ** 2) + dy * dy / (r * r) <= 1:
                    c = '#b8b2a4' if dx < 0 and dy < -r // 2 else '#9a9385' if dx < r // 2 else '#7a7468'
                    p.p(x + dx, y + dy, c)
        p.r(x - r, y + 1, 2 * r + 2, 1, (40, 50, 30, 90))
    # gravel path along the front
    for y in range(h - 40, h):
        for x in range(40, w):
            edge = y - (h - 40)
            if edge < 2 and rr.random() < .4: continue
            c = '#cbb791' if not dith(x, y, .25) else '#b9a37b'
            p.p(x, y, c)
    for _ in range(260):
        x, y = rr.randrange(42, w), rr.randrange(h - 38, h)
        p.p(x, y, rr.choice(['#8f8170', '#ece0c4', '#a8977c']))
    return p

# ─────────────────────────── 소품 ───────────────────────────
INK = '#2b2622'
def tent(w=78, h=66):
    """김박사의 연구 천막: 두 면으로 나뉜 캔버스, 열린 입구, 지지 줄, 깃발."""
    p = Pic(w, h); cx = 38; top = 12; base = h - 4
    p.ellipse(4, base - 3, w - 4, base + 3, (30, 40, 30, 70))
    left = [(cx, top), (4, base), (cx, base)]; right = [(cx, top), (w - 6, base), (cx, base)]
    p.poly([(cx, top - 1), (2, base + 1), (w - 4, base + 1)], INK)
    p.poly(left, '#f1f0e4'); p.poly(right, '#cfd6c7')
    for y in range(top + 2, base):  # canvas seams and soft shading
        f = (y - top) / (base - top)
        xl = cx - (cx - 4) * f; xr = cx + (w - 6 - cx) * f
        for x in range(int(xl) + 1, int(xr)):
            c = p.get(x, y)
            if (y - top) % 9 == 0: p.p(x, y, tone(c, .9))
            elif x < cx and dith(x, y, .25 * f): p.p(x, y, tone(c, .95))
            elif x > cx and dith(x, y, .3 + .3 * f): p.p(x, y, tone(c, .92))
    p.r(cx - 1, top, 2, base - top, '#b8c0b0')                      # ridge seam
    # open door flap with a dark inside and a lamp glow
    door = [(cx, top + 18), (cx - 12, base), (cx + 12, base)]
    p.poly(door, '#2c3b37'); p.poly([(cx, top + 22), (cx - 8, base), (cx + 8, base)], '#3f544d')
    p.r(cx - 2, base - 12, 4, 3, '#f6d88a'); p.r(cx - 1, base - 13, 2, 1, '#fff4c8')
    p.poly([(cx, top + 18), (cx - 12, base), (cx - 16, base), (cx - 3, top + 20)], '#e2e3d2')   # rolled flap
    p.line([(cx - 13, base - 1), (cx - 4, top + 21)], '#b9b9a6')
    p.r(cx - 1, top - 10, 2, 11, '#6b6f78')                          # pole and pennant
    p.poly([(cx + 1, top - 10), (cx + 13, top - 7), (cx + 1, top - 4)], '#e07a3a'); p.line([(cx + 1, top - 7), (cx + 9, top - 7)], '#f4a46a')
    for (ax, ay, gx) in [(10, base - 12, 0), (w - 12, base - 12, w - 1)]:  # guy ropes and pegs
        p.line([(ax, ay), (gx, base + 1)], '#8f8a7a'); p.r(gx - 1 if gx else 0, base - 1, 2, 3, '#5a4030')
    p.r(4, base, w - 10, 1, '#9aa294')
    return p

def signboard(w=64, h=34):
    p = Pic(w, h)
    for x0 in (8, w - 11):
        p.r(x0, 10, 3, h - 10, '#4f3626'); p.r(x0, 10, 1, h - 10, '#6e4c34')
    p.r(0, 0, w, 16, INK); p.r(1, 1, w - 2, 14, '#7a5536'); p.r(3, 3, w - 6, 10, '#f3e7c6')
    p.r(3, 3, w - 6, 1, '#fff6dc'); p.r(3, 12, w - 6, 1, '#dccaa0')
    for (x, y) in [(2, 2), (w - 3, 2), (2, 13), (w - 3, 13)]: p.p(x, y, '#c9a25a')
    p.r(6, h - 2, w - 12, 2, (40, 40, 30, 70))
    return p

def desk(w=44, h=30):
    """책상: 노트북(화면은 코드가 칠해요), 시료병, 공책."""
    p = Pic(w, h)
    p.r(2, 14, w - 4, 4, INK); p.r(3, 14, w - 6, 3, '#9a6a40'); p.r(3, 14, w - 6, 1, '#c08a58')
    for x0 in (5, w - 8): p.r(x0, 18, 3, h - 18, '#5e3e28'); p.r(x0, 18, 1, h - 18, '#7a5236')
    p.r(4, h - 1, w - 8, 1, (40, 40, 30, 70))
    p.r(6, 1, 16, 12, INK); p.r(7, 2, 14, 10, '#2e4654')               # laptop lid (screen at 8,3 12×8)
    p.r(4, 12, 20, 2, '#596273'); p.r(4, 12, 20, 1, '#8c96a8')
    p.r(26, 6, 4, 8, '#2d3a40'); p.r(27, 7, 2, 6, '#9fe0d0'); p.r(27, 7, 2, 2, '#e3fbf4')   # sample jar
    p.r(31, 9, 4, 5, '#2d3a40'); p.r(32, 10, 2, 3, '#f0c65a')
    p.r(36, 11, 6, 3, '#e9e2cc'); p.r(36, 11, 6, 1, '#c55a4a')              # notebook
    return p

def pedestal(w=40, h=13):
    p = Pic(w, h)
    p.ellipse(0, 4, w - 1, h - 1, '#3d4250'); p.ellipse(1, 3, w - 2, h - 3, '#6c7384')
    p.ellipse(3, 2, w - 4, h - 5, '#8e96a8'); p.ellipse(7, 3, w - 8, h - 6, '#5a6070')
    p.r(9, 2, 6, 1, '#c9d0de')
    return p

def crates(w=30, h=22):
    p = Pic(w, h)
    for (x, y, s) in [(0, 8, 14), (14, 8, 14), (6, 0, 12)]:
        p.r(x, y, s, s, INK); p.r(x + 1, y + 1, s - 2, s - 2, '#b0844f'); p.r(x + 1, y + 1, s - 2, 1, '#d2a66c')
        p.line([(x + 1, y + 1), (x + s - 2, y + s - 2)], '#8a6238'); p.r(x + 1, y + s // 2, s - 2, 1, '#8a6238')
    return p

def antenna(w=18, h=44):
    p = Pic(w, h)
    p.r(8, 10, 2, h - 12, '#7c8494'); p.r(8, 10, 1, h - 12, '#aab2c0')
    p.line([(9, 14), (2, h - 2)], '#7c8494'); p.line([(9, 14), (16, h - 2)], '#7c8494')
    p.ellipse(1, 0, 16, 10, '#d9dee6'); p.ellipse(3, 2, 14, 8, '#b6bfcc'); p.r(8, 4, 2, 6, '#5a6272')
    p.r(12, 18, 5, 4, '#2f3846'); p.p(14, 19, '#7fe3ea')
    return p

def bollard(w=10, h=14):
    p = Pic(w, h)
    p.r(1, 3, 8, h - 3, INK); p.r(2, 4, 6, h - 5, '#4a3424'); p.r(2, 4, 2, h - 5, '#6a4a32')
    p.r(0, 1, 10, 3, INK); p.r(1, 1, 8, 2, '#5c412c'); p.r(1, 1, 8, 1, '#7d5a3e')
    p.r(2, 6, 6, 2, '#c9b48a'); p.r(2, 6, 6, 1, '#e7d3a8')       # rope wrap
    return p

def ferry(w=212, h=74):
    """여객선 옆모습: 흰 선체에 파란 띠, 창문 줄, 조타실, 난간, 돛대와 깃발."""
    p = Pic(w, h); wl = h - 10
    hull = [(6, wl - 18), (w - 30, wl - 18), (w - 2, wl - 26), (w - 18, wl), (14, wl)]
    p.poly([(x, y + (1 if y == wl else 0)) for x, y in hull], INK)
    p.poly([(7, wl - 17), (w - 30, wl - 17), (w - 4, wl - 25), (w - 19, wl - 1), (15, wl - 1)], '#f4f6f4')
    for y in range(wl - 17, wl):
        f = (y - (wl - 17)) / 17
        for x in range(8, w - 4):
            if p.get(x, y)[3] and p.get(x, y)[:3] != rgb(INK)[:3]:
                if f > .62: p.p(x, y, '#2b5f8c' if f < .82 else '#1d3f5e')
                elif f > .5: p.p(x, y, '#d33f3a')
                elif dith(x, y, f * .5): p.p(x, y, '#dfe5e3')
    p.r(14, wl - 15, 168, 1, '#ffffff')
    for x in range(20, 176, 9): p.r(x, wl - 13, 5, 3, '#4f88a8'); p.p(x, wl - 13, '#a9dcef')   # portholes
    # deck house and bridge
    p.r(30, wl - 40, 120, 23, INK); p.r(31, wl - 39, 118, 21, '#eef1ef'); p.r(31, wl - 39, 118, 2, '#ffffff')
    for x in range(36, 146, 11): p.r(x, wl - 34, 8, 7, '#3d6f8e'); p.r(x, wl - 34, 8, 2, '#8fd0ea')
    p.r(31, wl - 22, 118, 2, '#c9d1cf')
    p.r(56, wl - 54, 64, 15, INK); p.r(57, wl - 53, 62, 13, '#f6f7f5'); p.r(57, wl - 53, 62, 1, '#ffffff')
    for x in range(61, 116, 9): p.r(x, wl - 50, 7, 5, '#2f5d7a'); p.r(x, wl - 50, 7, 1, '#8fd0ea')
    p.r(70, wl - 58, 40, 4, '#c3cbc9')
    p.r(104, wl - 74 + 10, 2, 14, '#6b7280'); p.poly([(106, wl - 64), (122, wl - 60), (106, wl - 56)], '#2f8f9c')   # mast and flag
    p.r(80, wl - 64, 8, 6, '#d33f3a'); p.r(80, wl - 64, 8, 1, '#f07a6a')                                         # funnel
    for x in range(8, w - 30, 6): p.r(x, wl - 24, 1, 6, '#9aa3a8')                                             # railing
    p.r(8, wl - 24, w - 38, 1, '#9aa3a8')
    p.r(20, wl - 22, 6, 4, '#f08a3a'); p.r(21, wl - 21, 4, 2, '#ffd2a0')                                      # life ring
    for x in range(10, w - 12):  # water line foam
        if dith(x, wl, .55): p.p(x, wl, '#e9f8fa')
        if dith(x, wl + 1, .3): p.p(x, wl + 1, (255, 255, 255, 200))
    for y in range(wl + 1, h):  # reflection
        for x in range(16, w - 22):
            if dith(x, y, .22 * (1 - (y - wl) / (h - wl))): p.p(x, y, (240, 248, 248, 110))
    return p

# ─────────────────────────── 시상식 무대 ───────────────────────────
def stage_hall(w=320, h=154):
    rr = random.Random(9); p = Pic(w, h)
    ramp_fill(p, 0, 0, w, 122, ['#14203e', '#1b2a52', '#22355f', '#1c2c52'])
    for y in range(4, 120, 8):  # wall panels
        for x in range((y // 8 % 2) * 20, w, 40): p.r(x, y, 1, 6, '#2a3d6a')
    # curtains: deep folds with highlights
    def curtain(x0, x1, flip):
        for x in range(x0, x1):
            k = (x - x0) / (x1 - x0)
            fold = math.sin(k * math.pi * 5)
            c = mix('#6d1c2a', '#c9505e', .5 + .45 * fold)
            for y in range(0, 152):
                sway = int(2 * math.sin(y / 18 + x)) if y > 120 else 0
                cc = c if not dith(x, y, .3 * (y / 152)) else tone(c, .88)
                p.p(x + sway * (1 if flip else -1), y, cc)
    curtain(0, 46, False); curtain(w - 46, w, True)
    p.r(0, 0, w, 16, '#6d1c2a')
    for x in range(0, w, 16):  # scalloped valance with gold fringe
        p.ellipse(x - 2, 8, x + 17, 24, '#8a2633'); p.r(x + 2, 11, 12, 2, '#a83a48')
    for x in range(0, w, 2): p.r(x, 22 + (x // 2 % 3 == 0), 1, 3, '#e2b84f')
    # banner board (text is drawn by the game)
    p.r(84, 28, 152, 28, INK); p.r(86, 30, 148, 24, '#c9a25a'); p.r(88, 32, 144, 20, '#f6ecd0'); p.r(88, 32, 144, 1, '#fffbea')
    for x in (86, 232): p.r(x, 30, 2, 24, '#e8c879')
    # stage floor with perspective boards and a front lip
    for y in range(122, 150):
        f = (y - 122) / 28
        for x in range(w):
            k = (x - 160) / (60 + 120 * f)
            seam = abs((k * 4) % 1 - .5) < .04
            c = mix('#9a6436', '#7a4a28', f)
            if seam: c = tone(c, .7)
            elif dith(x, y, .2): c = tone(c, 1.08)
            p.p(x, y, c)
    p.r(0, 122, w, 1, '#c08a58'); p.r(0, 150, w, 4, '#3d2416'); p.r(0, 150, w, 1, '#6a4126')
    # trophy on a draped table
    p.r(246, 108, 32, 16, INK); p.r(247, 109, 30, 14, '#2d4a8a'); p.r(247, 109, 30, 2, '#4a6fb8')
    p.r(258, 94, 8, 3, '#b8892e'); p.r(256, 97, 12, 2, '#e2b84f')
    p.ellipse(255, 80, 268, 94, '#e2b84f'); p.ellipse(257, 81, 263, 89, '#fbe39a'); p.r(259, 94, 6, 4, '#c99a3a')
    p.r(253, 83, 3, 5, '#e2b84f'); p.r(267, 83, 3, 5, '#e2b84f'); p.r(262, 76, 2, 4, '#fff1b4')
    return p

def sky_dusk(w=320, h=96):
    p = sky(['#f6c27f', '#f0a874', '#d98a7e', '#a8779a', '#6f5f8e', '#4c4a7a'][::-1][::-1], w, h)
    return p

# ─────────────────────────── 결투 배경(선명한 외곽선 도트 느낌) ───────────────────────────
# 바닥은 앞쪽일수록 진하고 넓게(원근감), 우산몬이 서는 둥근 받침대는 윗면 밝게·테두리 어둡게.
GROUND = {
    'grass': (['#bfe08e', '#a9d27a', '#93c268', '#7fb25a', '#6ea24f'], '#5e8f44', '#d6edab'),
    'sand':  (['#fbe9be', '#f4dca7', '#ecce92', '#e2bf80', '#d6b070'], '#c39c5e', '#fff6dc'),
    'path':  (['#ecd9b0', '#e0c99c', '#d3b98a', '#c6a97b', '#b8996c'], '#a3865c', '#f7ead0'),
}
def bground(kind, w=320, h=58):
    rr = random.Random(len(kind)); stops, dark, light = GROUND[kind]; p = Pic(w, h)
    ramp_fill(p, 0, 0, w, h, stops)
    for y in range(2, h, 1):   # perspective stripes: thin and close near the horizon, wide in front
        f = y / h
        if int((f ** 1.6) * 12) != int((((y - 1) / h) ** 1.6) * 12):
            for x in range(w):
                if dith(x, y, .5): p.p(x, y, tone(p.get(x, y), 1.05))
    for _ in range(int(w * h / (26 if kind == 'grass' else 40))):
        x, y = rr.randrange(w), rr.randrange(2, h); f = y / h
        if kind == 'grass':
            L = 1 + int(f * 3)
            for i in range(L): p.p(x, y - i, dark if i == 0 else tone(stops[min(4, int(f * 5))], .85))
            p.p(x, y - L, light)
        elif kind == 'sand':
            p.r(x, y, 2 + int(f * 4), 1, tone(stops[min(4, int(f * 5))], .92)); p.p(x, y - 1, light) if rr.random() < .3 else None
        else:
            r = 1 + int(f * 2); p.r(x, y, r + 1, r, dark); p.r(x, y, r, 1, light)
    p.r(0, 0, w, 1, light)
    return p

def pad(kind, w, h):
    stops, dark, light = GROUND[kind]; p = Pic(w, h + 4)
    cx, cy, rx, ry = w / 2, h / 2, w / 2 - 1, h / 2 - 1
    for y in range(h + 4):
        for x in range(w):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            d2 = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy - 3) / ry) ** 2
            if d <= 1:
                if d > .78: c = dark                                   # rim
                elif y < cy - ry * .25 and d > .45: c = light            # lit back edge
                else: c = stops[1] if d < .35 else stops[2]
                if kind == 'grass' and d <= .78 and (x * 5 + y * 3) % 11 == 0: c = stops[0]
                p.p(x, y, c)
            elif d2 <= 1: p.p(x, y, tone(dark, .7))                     # thickness of the stand
    return p

# ─────────────────────────── 모으기 ───────────────────────────
ITEMS = {
    'sky-day': sky(['#5aaed6', '#72bfe2', '#8fcfe9', '#acdcef', '#c8e9f3', '#def3f6'], streaks=[(30, 18, 40, '#e9f7fb'), (190, 10, 56, '#e9f7fb'), (250, 30, 30, '#eaf8fb')]),
    'sky-dusk': sky(['#4c4a7a', '#6f5f8e', '#a8779a', '#d98a7e', '#f0a874', '#f6c27f'], streaks=[(40, 30, 60, '#f7c69a'), (200, 20, 70, '#e9a99a')]),
    'sky-night': sky(['#0a1430', '#0f1d40', '#162a52', '#1f3866', '#2b4a7a', '#3a5b88']),
    'sea-night': sea(deep=('#4a6a92', '#2c4c78', '#22406a', '#1b355c', '#152c50'), night=True),
    'cloud-1': cloud(54, 20, [(12, 13, 7), (24, 9, 9), (38, 11, 8), (46, 14, 5)]),
    'cloud-2': cloud(36, 14, [(9, 9, 5), (18, 6, 6), (28, 9, 5)]),
    'cloud-3': cloud(70, 24, [(12, 16, 8), (26, 11, 10), (42, 9, 11), (56, 14, 8), (64, 17, 5)]),
    'sun': sun(),
    'sea': sea(),
    'sea-dusk': sea(deep=('#c9a3a6', '#7e7aa0', '#5d6593', '#4a5584', '#3e4a78')),
    **{f'ulleung-{w}': ulleung(w, round(w * .46), w, haze=(.28 if w <= 120 else .14 if w <= 160 else .04)) for w in (220, 196, 190, 160, 150, 120, 104)},
    **{f'dokdo-{w}': dokdo(w, haze=(.3 if w <= 104 else .18 if w <= 120 else .08 if w <= 150 else 0)) for w in (96, 104, 110, 120, 150, 224, 360)},
    **{f'seodo-{w}': dokdo(w, 'one', haze=(.2 if w <= 100 else .08)) for w in (58, 90, 100, 120)},
    **{f'bground-{k}': bground(k) for k in GROUND},
    **{f'pad-{k}': pad(k, 96, 22) for k in GROUND},
    'sand': sand(),
    'deck': deck(),
    'meadow': meadow(),  # v0.47: 흙길 없이 온통 풀밭
    'rocky-top': rocky_top(),
    'tent': tent(),
    'signboard': signboard(),
    'desk': desk(),
    'pedestal': pedestal(),
    'crates': crates(),
    'antenna': antenna(),
    'bollard': bollard(),
    'ferry': ferry(),
    'stage-hall': stage_hall(),
}

def pack(items, width=1024):
    x = y = row = 0; rects = {}
    for k, pic in sorted(items.items(), key=lambda kv: -kv[1].h):
        if x + pic.w > width: x = 0; y += row + 2; row = 0
        rects[k] = [x, y, pic.w, pic.h]; x += pic.w + 2; row = max(row, pic.h)
    sheet = Image.new('RGBA', (width, y + row), (0, 0, 0, 0))
    for k, (x, y, w, h) in rects.items(): sheet.alpha_composite(items[k].im, (x, y))
    return sheet, rects

sheet, rects = pack(ITEMS)
os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
sheet.save(OUT_PNG)
with open(OUT_JS, 'w') as f:
    f.write('// 컷신 배경 도트 그림의 자리. scripts/draw-cutscene-art.py가 만들어요.\n')
    f.write('export const CUTSCENE_ATLAS=' + json.dumps({'key': 'scenery/cutscene-art-v47', 'width': sheet.width, 'height': sheet.height, 'frames': rects}, ensure_ascii=False) + ';\n')
print('cutscene art', sheet.size, len(rects), 'pictures')
