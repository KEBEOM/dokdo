"""독도몬 도트 디자인 생성기 (v0.28)

    python scripts/design-monsters.py              # 디자인이 있는 독도몬을 모두 다시 그림
    python scripts/design-monsters.py 27 50 88     # 몇 마리만

사용자가 그린 그림이 없는 독도몬(20~65, 68~99번)을 64×64 도트로 그려
dist/assets/monsters/NNN.png(정면)와 back/NNN.png(뒷모습)로 저장합니다. Pillow, numpy가 필요합니다.
그림체는 사용자 그림에 맞췄습니다: 진한 외곽선, 위왼쪽에서 오는 빛, 큰 눈과 반짝임, 볼 터치.
새·물고기는 옆모습(왼쪽을 봄)이라 뒷모습은 좌우만 뒤집고, 나머지는 얼굴 없이 그린 뒤 뒤집습니다.
모습을 바꾸려면 아래 SPECIES의 색과 모양 값을 고치세요. 사용자가 그림을 주면 import-monsters.py로 덮어쓰면 됩니다.
"""
import math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'assets', 'monsters')
N = 64
INK = (22, 20, 28)

def rgb(c):
    if isinstance(c, tuple): return c
    c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
def mix(a, b, t):
    a, b = rgb(a), rgb(b); return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
def light(c, t=.3): return mix(c, (255, 252, 236), t)
def dark(c, t=.28): return mix(c, (18, 16, 30), t)

YY, XX = np.mgrid[0:N, 0:N] + .5
def shift(m, dx, dy):
    """Move a mask without wrapping around the edges."""
    out = np.zeros_like(m); h, w = m.shape
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = m[ys, xs]; return out

# ── shapes (boolean masks on the 64×64 grid) ──
def ellipse(cx, cy, rx, ry, rot=0):
    c, s = math.cos(rot), math.sin(rot); dx, dy = XX - cx, YY - cy
    u, v = dx * c + dy * s, -dx * s + dy * c
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1
def circle(cx, cy, r): return ellipse(cx, cy, r, r)
def rect(x0, y0, x1, y1): return (XX >= x0) & (XX <= x1) & (YY >= y0) & (YY <= y1)
def poly(pts):
    m = np.zeros((N, N), bool); n = len(pts)
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        cond = ((y0 > YY) != (y1 > YY)) & (XX < (x1 - x0) * (YY - y0) / ((y1 - y0) or 1e-9) + x0)
        m ^= cond
    return m
def capsule(x0, y0, x1, y1, r):
    dx, dy = x1 - x0, y1 - y0; L = dx * dx + dy * dy or 1e-9
    t = np.clip(((XX - x0) * dx + (YY - y0) * dy) / L, 0, 1)
    return (XX - (x0 + t * dx)) ** 2 + (YY - (y0 + t * dy)) ** 2 <= r * r
def curve(pts, r):
    m = np.zeros((N, N), bool)
    for a, b in zip(pts, pts[1:]): m |= capsule(*a, *b, r)
    return m

class Art:
    """Parts are painted back to front; each gets light/shadow tones and its own dark edge."""
    def __init__(self):
        self.col = np.zeros((N, N, 3), np.uint8); self.fill = np.zeros((N, N), bool)
        self.pid = np.zeros((N, N), int); self.n = 0; self.marks = []
    def part(self, mask, color, edge=True, shade=True, tone=None):
        mask = mask & True
        if not mask.any(): return mask
        self.n += 1; base = np.array(rgb(color)); lo, hi = np.array(dark(color, .22)), np.array(light(color, .26))
        col = np.broadcast_to(base, (N, N, 3)).copy()
        if shade:
            sh = lambda dx, dy: shift(mask, dx, dy)
            hi_m = mask & ~sh(2, 2); lo_m = mask & ~sh(-2, -2)
            col[lo_m] = lo; col[hi_m & ~lo_m] = hi
        if shade and mask.sum() > 120:
            rng = np.random.default_rng(int(mask.sum()) * 7 + self.n)
            speck = mask & (rng.random((N, N)) < .05) & shift(mask, 1, 1) & shift(mask, -1, -1)
            half = rng.random((N, N)) < .5
            col[speck & half] = np.array(mix(color, (255, 252, 236), .14)); col[speck & ~half] = np.array(mix(color, (18, 16, 30), .14))
        if tone is not None: col[tone & mask] = np.array(rgb(tone[1])) if isinstance(tone, tuple) else col[tone & mask]
        if edge:
            inner = mask & shift(mask, 0, 1) & shift(mask, 0, -1) & shift(mask, 1, 0) & shift(mask, -1, 0)
            border = mask & ~inner & self.fill  # only where this part sits on something drawn before
            col[border] = np.array(mix(color, INK, .72))
        self.col[mask] = col[mask]; self.fill |= mask; self.pid[mask] = self.n
        return mask
    def flat(self, mask, color):
        mask = mask & self.fill if isinstance(mask, np.ndarray) else mask
        self.col[mask] = rgb(color)
    def dot(self, pts, color):
        for x, y in pts:
            if 0 <= x < N and 0 <= y < N: self.col[y, x] = rgb(color); self.fill[y, x] = True
    def mark(self, fn): self.marks.append(fn)
    def finish(self):
        out = np.zeros((N, N, 4), np.uint8); out[..., :3] = self.col; out[..., 3] = np.where(self.fill, 255, 0)
        # outer outline: a dark line tinted by the colour it surrounds
        f = self.fill; ring = ~f & (shift(f, 0, 1) | shift(f, 0, -1) | shift(f, 1, 0) | shift(f, -1, 0))
        for y, x in zip(*np.where(ring)):
            nb = [self.col[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < N and 0 <= xx < N and f[yy, xx]]
            c = np.mean(nb, 0) if nb else INK; out[y, x, :3] = mix(tuple(int(v) for v in c), INK, .8); out[y, x, 3] = 255
        return out

# ── faces ──
def eye(a, x, y, s=4, look=0):
    """A big shiny eye with its top-left corner at (x, y). On a dark face it gets a pale rim so it still reads."""
    under = a.col[int(y):int(y) + s, int(x):int(x) + s].reshape(-1, 3)
    if len(under) and under.mean() < 75:
        a.flat(rect(x - 1, y - 1, x + s - 1, y + s) | rect(x - 1.6, y, x + s - .4, y + s - 1), '#e9e4d8')
    a.flat(rect(x, y, x + s - 2, y + s - 1) | rect(x - 0.6, y + 1, x + s - 1.4, y + s - 2), INK)
    a.dot([(int(x) + look, int(y) + 1)], (255, 255, 255))
    if s >= 4: a.dot([(int(x) + look, int(y) + 2), (int(x) + s - 2, int(y) + s - 2)], (255, 255, 255))
def blush(a, x, y, w=3): a.flat(rect(x, y, x + w - 1, y + 1), '#f29b9b')
def smile(a, x, y, w=3, col=None): a.dot([(x, y), (x + w - 1, y)] + [(x + i, y + 1) for i in range(1, w - 1)], col or INK)
def face(a, cx, y, gap=10, s=4, mouth=True, cheeks=True):
    eye(a, cx - gap // 2 - s + 2, y, s); eye(a, cx + gap // 2, y, s)
    if cheeks: blush(a, cx - gap // 2 - s, y + s + 1); blush(a, cx + gap // 2 + s - 2, y + s + 1)
    if mouth: smile(a, cx - 1, y + s + 1)

# ════════════════════════════════════════════════════════════════════
# Birds — side view, facing left
# ════════════════════════════════════════════════════════════════════
def bird(a, p, front=True):
    kind = p.get('kind', 'perch')
    body, belly = p['body'], p.get('belly', light(p['body'], .45))
    head, wing, tail = p.get('head', body), p.get('wing', dark(body, .12)), p.get('tail', p.get('wing', dark(body, .12)))
    beak, legs = p.get('beak', '#e8b04a'), p.get('legs', '#e09a48')
    if kind == 'raptor':
        hx, hy, hr = 27, 20, 11; bx, by, brx, bry = 33, 38, 13, 16
    elif kind == 'heron':
        hx, hy, hr = 19, 11, 8; bx, by, brx, bry = 37, 36, 14, 10
    elif kind == 'wader':
        hx, hy, hr = 21, 21, 9; bx, by, brx, bry = 36, 36, 15, 11
    elif kind == 'swim':
        hx, hy, hr = 18 if p.get('neck') else 20, 17 if p.get('neck') else 30, 9; bx, by, brx, bry = 36, 46, 21, 11
    else:
        hx, hy, hr = 25, 24, 12; bx, by, brx, bry = 35, 40, 16, 13
    s = p.get('scale', 1.0)
    # legs and feet (behind the body)
    if kind in ('wader', 'heron'):
        top = by + bry - 3; foot = 61
        a.part(capsule(bx - 3, top, bx - 4, foot - 1, 1.1) | capsule(bx + 3, top, bx + 4, foot - 1, 1.1), legs, edge=False)
        a.part(rect(bx - 8, foot - 1, bx - 2, foot) | rect(bx + 1, foot - 1, bx + 7, foot), legs, edge=False)
    elif kind != 'swim':
        top = by + bry - 3; foot = min(61, by + bry + 5)
        a.part(rect(bx - 5, top, bx - 3, foot) | rect(bx + 2, top, bx + 4, foot), legs, edge=False)
        a.part(rect(bx - 8, foot - 1, bx - 2, foot) | rect(bx, foot - 1, bx + 6, foot), legs, edge=False)
    # tail
    tt = p.get('tailtype', 'short'); tx = bx + brx - 4
    if tt == 'fork': tm = poly([(tx, by - 4), (tx + 20, by + 4), (tx + 12, by + 5), (tx + 22, by + 12), (tx, by + 6)])
    elif tt == 'long': tm = poly([(tx, by - 4), (tx + 22, by + 4), (tx + 22, by + 9), (tx, by + 6)])
    elif tt == 'fan': tm = poly([(tx, by - 6), (tx + 16, by - 10), (tx + 20, by + 2), (tx + 14, by + 10), (tx, by + 6)])
    elif tt == 'up': tm = poly([(tx, by - 2), (tx + 12, by - 16), (tx + 18, by - 12), (tx + 6, by + 6)])
    else: tm = poly([(tx, by - 4), (tx + 14, by + 2), (tx + 13, by + 8), (tx, by + 6)])
    a.part(tm, tail)
    # neck for long-necked birds
    if p.get('neck'):
        a.part(curve([(bx - 8, by - 4), (hx + 4, hy + 12), (hx + 2, hy + 4)], 4.2), p.get('neckcol', head))
    # body + belly
    bm = a.part(ellipse(bx, by, brx, bry, p.get('tilt', 0)), body)
    if p.get('bellyshape', True):
        a.part(ellipse(bx - brx * .35, by + bry * .3, brx * .7, bry * .65) & bm, belly, edge=False)
    if p.get('breast'): a.part(ellipse(bx - brx * .55, by - bry * .1, brx * .45, bry * .5) & bm, p['breast'], edge=False)
    if p.get('band'): a.part(rect(bx - brx, by + 1, bx + brx, by + 3) & bm, p['band'], edge=False)
    # patterns on the belly
    if p.get('bars'):
        for yy in range(int(by - bry * .2), int(by + bry), 3): a.flat(rect(bx - brx * .9, yy, bx + brx * .2, yy) & bm & ((XX.astype(int) + yy) % 4 < 2), p['bars'])
    if p.get('spots'):
        for i, (dx, dy) in enumerate([(-8, -2), (-4, 2), (-10, 4), (-6, 7), (-2, 6), (-9, -6), (-3, -3)]): a.dot([(bx + dx, by + dy), (bx + dx + 1, by + dy)], p['spots'])
    # wing
    wm = a.part(ellipse(bx + 3, by - 1, brx * .72, bry * .62, -.25), wing)
    if p.get('wingbar'): a.part(ellipse(bx + 2, by + 1, brx * .55, 1.6, -.25) & wm, p['wingbar'], edge=False)
    if p.get('wingtip'): a.part(ellipse(bx + brx * .55, by + 1, brx * .35, bry * .4, -.25) & wm, p['wingtip'], edge=False)
    if p.get('scales'):
        for yy in range(int(by - bry), int(by + bry), 3):
            for xx in range(int(bx - brx), int(bx + brx), 4): a.dot([(xx + (yy // 3) % 2 * 2, yy)], p['scales']) if bm[yy % N, xx % N] else None
    if p.get('wingstripes'):
        for k in range(4): a.flat(capsule(bx - 4 + k * 4, by - 6, bx - 1 + k * 4, by + 4, .7) & wm, p['wingstripes'])
    # head
    hm = a.part(circle(hx, hy, hr * s), head)
    if p.get('cap'): a.part(hm & (YY < hy - hr * .25), p['cap'], edge=False)
    if p.get('throat'): a.part(ellipse(hx - 2, hy + hr * .55, hr * .55, hr * .4) & hm, p['throat'], edge=False)
    if p.get('cheek'): a.part(ellipse(hx + 1, hy + 3, hr * .45, hr * .32) & hm, p['cheek'], edge=False)
    if p.get('mask'): a.part(rect(hx - hr, hy - 3, hx + hr * .9, hy + 1) & hm, p['mask'], edge=False)
    if p.get('collar'): a.part(ellipse(hx + 4, hy + hr - 1, hr * .8, 2.4) & ~hm, p['collar'], edge=False)
    # crest
    cr = p.get('crest')
    if cr == 'tuft': a.part(poly([(hx + 2, hy - hr + 2), (hx + 12, hy - hr - 6), (hx + 8, hy - hr + 4)]), p.get('crestcol', head))
    elif cr == 'fan':
        a.part(poly([(hx - 4, hy - hr + 3), (hx - 6, hy - hr - 9), (hx + 4, hy - hr - 12), (hx + 14, hy - hr - 6), (hx + 10, hy - hr + 4)]), p.get('crestcol', head))
        a.flat(poly([(hx - 7, hy - hr - 8), (hx - 5, hy - hr - 10), (hx + 4, hy - hr - 13), (hx + 15, hy - hr - 7), (hx + 13, hy - hr - 5), (hx + 4, hy - hr - 10)]), INK)
    elif cr == 'crown': a.part(ellipse(hx + 1, hy - hr + 3, hr * .55, 2.4), p.get('crestcol', '#ffd23f'), edge=False); a.flat(ellipse(hx + 1, hy - hr + 5.5, hr * .6, 1) & hm, INK)
    elif cr == 'red': a.part(ellipse(hx, hy - hr + 2.5, hr * .45, 2.2) & hm, '#e04848', edge=False)
    elif cr == 'plume': a.part(curve([(hx + 4, hy - 3), (hx + 14, hy - 2), (hx + 20, hy + 2)], 1.2), p.get('crestcol', INK), edge=False)
    # beak
    bt, L = p.get('beaktype', 'cone'), p.get('beaklen', 7)
    by0 = hy + 1
    if bt == 'cone': bk = poly([(hx - hr + 2, by0 - 3), (hx - hr - L * .6, by0 + .5), (hx - hr + 2, by0 + 3)])
    elif bt == 'spear': bk = poly([(hx - hr + 2, by0 - 2), (hx - hr - L, by0 + .5), (hx - hr + 2, by0 + 2.5)])
    elif bt == 'hook': bk = poly([(hx - hr + 3, by0 - 4), (hx - hr - 4, by0 - 2), (hx - hr - 5, by0 + 3), (hx - hr - 2, by0 + 1), (hx - hr + 3, by0 + 3)])
    elif bt == 'curve': bk = curve([(hx - hr + 2, by0), (hx - hr - L * .5, by0 + 2), (hx - hr - L, by0 + 6)], 1.1)
    elif bt == 'duck': bk = poly([(hx - hr + 3, by0 - 3), (hx - hr - L, by0 - 1), (hx - hr - L, by0 + 2.5), (hx - hr + 3, by0 + 3)])
    else: bk = poly([(hx - hr + 2, by0 - 2), (hx - hr - L, by0), (hx - hr + 2, by0 + 2)])
    a.part(bk, beak)
    if p.get('beaktip'): a.part(bk & (XX < hx - hr - L * .45), p['beaktip'], edge=False)
    if p.get('cere'): a.part(bk & (XX > hx - hr - 1), p['cere'], edge=False)
    # face
    ex, ey = int(hx - hr * .35), int(hy - 3)
    if p.get('eyering'): a.part(circle(ex + 1.5, ey + 2, 3.6) & hm, p['eyering'], edge=False)
    if p.get('stripe'): a.part(capsule(ex - 2, ey + 2, hx + hr - 1, ey + 3, 1.2) & hm, p['stripe'], edge=False)
    if p.get('brow'): a.part(capsule(ex - 2, ey - 2, hx + hr * .6, ey - 2, .9) & hm, p['brow'], edge=False)
    if p.get('moustache'): a.part(capsule(ex + 1, ey + 4, ex - 1, ey + 9, 1.3) & hm, p['moustache'], edge=False)
    if front:
        eye(a, ex, ey, 4)
        if p.get('blush', True): blush(a, ex + 3, ey + 6)
    if kind == 'swim':
        a.part(rect(4, 55, 60, 57) & ~a.fill, '#8fd0e0', edge=False, shade=False); a.part(rect(10, 58, 54, 59) & ~a.fill, '#b9e4ee', edge=False, shade=False)

# ════════════════════════════════════════════════════════════════════
# Fish — side view, facing left
# ════════════════════════════════════════════════════════════════════
def fish(a, p, front=True):
    body, belly = p['body'], p.get('belly', light(p['body'], .5)); fin = p.get('fin', dark(body, .15))
    shape = p.get('shape', 'oval')
    cx, cy, rx, ry = 31, 34, p.get('rx', 21), p.get('ry', 14)
    if shape == 'round': rx, ry = 19, 18
    if shape == 'long': rx, ry, cy = 25, 9, 34
    if shape == 'diamond': rx, ry = 18, 18
    if shape == 'torpedo': rx, ry = 25, 11
    # tail
    tx = cx + rx - 3; tt = p.get('tail', 'fork')
    if tt == 'fork': tm = poly([(tx - 2, cy - 2), (tx + 13, cy - 12), (tx + 9, cy), (tx + 13, cy + 12), (tx - 2, cy + 2)])
    elif tt == 'round': tm = ellipse(tx + 6, cy, 7, 9)
    elif tt == 'lunate': tm = poly([(tx - 2, cy - 2), (tx + 10, cy - 14), (tx + 6, cy), (tx + 10, cy + 14), (tx - 2, cy + 2)])
    else: tm = poly([(tx - 2, cy - 3), (tx + 11, cy - 9), (tx + 11, cy + 9), (tx - 2, cy + 3)])
    a.part(tm, p.get('tailcol', fin))
    # fins behind the body
    dt = p.get('dorsal', 'soft')
    if dt == 'spiny':
        pts = [(cx - rx * .55, cy - ry + 3)] + [(cx - rx * .55 + i * 4 + 2, cy - ry - 6 + (i % 2) * 3) for i in range(int(rx * .25) + 2)] + [(cx + rx * .6, cy - ry + 4)]
        a.part(poly(pts + [(cx + rx * .6, cy - ry + 6), (cx - rx * .55, cy - ry + 6)]), fin)
    elif dt == 'long': a.part(poly([(cx - rx * .7, cy - ry + 2), (cx - rx * .5, cy - ry - 5), (cx + rx * .8, cy - ry - 4), (cx + rx, cy - ry + 3)]), fin)
    elif dt == 'sail': a.part(poly([(cx - rx * .4, cy - ry + 3), (cx - rx * .1, cy - ry - 12), (cx + rx * .5, cy - ry + 3)]), fin)
    elif dt == 'spike': a.part(poly([(cx - rx * .35, cy - ry + 2), (cx - rx * .2, cy - ry - 13), (cx - rx * .05, cy - ry + 2)]), fin)
    elif dt != 'none': a.part(poly([(cx - rx * .3, cy - ry + 3), (cx + rx * .1, cy - ry - 7), (cx + rx * .55, cy - ry + 3)]), fin)
    if p.get('anal', True) and shape not in ('round',): a.part(poly([(cx + rx * .05, cy + ry - 3), (cx + rx * .35, cy + ry + 5), (cx + rx * .6, cy + ry - 3)]), fin)
    # body
    if shape == 'diamond': bm = a.part(poly([(cx - rx - 2, cy - 2), (cx - 2, cy - ry), (cx + rx, cy - 1), (cx - 2, cy + ry)]) | ellipse(cx, cy, rx * .8, ry * .85), body)
    else: bm = a.part(ellipse(cx, cy, rx, ry), body)
    if p.get('hump'): a.part(ellipse(cx - rx * .55, cy - ry * .75, rx * .38, ry * .55), p.get('humpcol', body))
    a.part(ellipse(cx - 2, cy + ry * .55, rx * .85, ry * .45) & bm, belly, edge=False)
    if p.get('back'): a.part(ellipse(cx + 2, cy - ry * .65, rx * .95, ry * .45) & bm, p['back'], edge=False)
    # patterns
    for x0, w, c in p.get('bars', []): a.flat(rect(cx - rx + x0, 0, cx - rx + x0 + w - 1, N) & bm, c)
    for y0, h, c in p.get('lines', []): a.flat(rect(0, cy + y0, N, cy + y0 + h - 1) & bm, c)
    if p.get('spots'):
        rng = np.random.default_rng(p.get('seed', 7)); c = p['spots']
        for _ in range(p.get('nspots', 16)):
            x, y = int(rng.uniform(cx - rx * .6, cx + rx * .8)), int(rng.uniform(cy - ry * .75, cy + ry * .6))
            if bm[y, x] and bm[y + 1, x + 1]: a.dot([(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)] if p.get('bigspots') else [(x, y), (x + 1, y)], c)
    if p.get('mottle'):
        rng = np.random.default_rng(3)
        for _ in range(26):
            x, y = int(rng.uniform(cx - rx, cx + rx)), int(rng.uniform(cy - ry, cy + ry * .3))
            a.flat(ellipse(x, y, rng.uniform(1.5, 3.5), rng.uniform(1.2, 2.5)) & bm, p['mottle'])
    if p.get('stripes_h'):
        for k, c in enumerate(p['stripes_h']): a.flat(capsule(cx - rx * .8, cy - ry * .45 + k * 5, cx + rx * .85, cy - ry * .45 + k * 5 + 1, .9) & bm, c)
    # pectoral fin and gill line
    a.part(ellipse(cx + rx * .02, cy + ry * .25, 4.5, 2.4, .45), p.get('pec', light(fin, .25)), edge=False)
    a.flat(curve([(cx - rx * .55, cy - ry * .55), (cx - rx * .62, cy), (cx - rx * .55, cy + ry * .5)], .5) & bm, dark(body, .35))
    # mouth / snout
    sn = p.get('snout', 'normal')
    if sn == 'long': a.part(poly([(cx - rx + 3, cy - 3), (cx - rx - 7, cy - 1), (cx - rx - 7, cy + 2), (cx - rx + 3, cy + 3)]), body)
    if sn == 'beak': a.part(ellipse(cx - rx + 1, cy + 3, 4, 3), p.get('beakcol', '#d9d2c0'))
    lips = p.get('lips', dark(body, .1))
    mx = cx - rx - (6 if sn == 'long' else 0)
    if sn == 'big': a.part(ellipse(mx + 3, cy + 3, 4, 3), lips); a.flat(rect(mx - 1, cy + 3, mx + 4, cy + 3), INK)
    else: a.dot([(int(mx) + 1, cy + 2), (int(mx) + 2, cy + 2)], INK)
    if front:
        ex, ey = int(cx - rx * .62), int(cy - ry * .45)
        if shape == 'flat': ex, ey = int(cx - rx * .5), int(cy - ry * .55)
        if p.get('eyecol'): a.flat(circle(ex + 1.5, ey + 2, 3.4), p['eyecol'])
        eye(a, ex, ey, 4 if rx < 24 else 5)
        if p.get('blush', True): blush(a, ex + 2, ey + 6)
        if shape == 'flat': eye(a, ex + 8, ey - 1, 4)

def flatfish(a, p, front=True):
    body = p['body']
    a.part(ellipse(32, 40, 28, 14), dark(body, .1))   # fin fringe
    bm = a.part(ellipse(31, 40, 23, 11), body)
    a.part(poly([(51, 38), (62, 32), (62, 48), (51, 42)]), dark(body, .1))
    rng = np.random.default_rng(5)
    for _ in range(18):
        x, y = int(rng.uniform(14, 50)), int(rng.uniform(32, 48))
        if bm[y, x]: a.flat(ellipse(x, y, 1.6, 1.2), p.get('spots', dark(body, .3)))
    for _ in range(6):
        x, y = int(rng.uniform(16, 48)), int(rng.uniform(33, 47))
        if bm[y, x]: a.flat(ellipse(x, y, 1.2, 1), light(body, .5))
    a.dot([(9, 44), (10, 44), (11, 45)], INK)
    if front: eye(a, 14, 33, 4); eye(a, 21, 31, 4); blush(a, 13, 39)

# ════════════════════════════════════════════════════════════════════
# Insects — seen from the front/top, standing
# ════════════════════════════════════════════════════════════════════
def insect(a, p, front=True):
    kind = p.get('kind', 'shield'); body, head = p['body'], p.get('head', dark(p['body'], .3)); legs = p.get('legs', dark(head, .2))
    cx = 32
    # legs
    for side in (-1, 1):
        for knee, foot, top in (((15, 30), (19, 24), 34), ((18, 42), (22, 48), 42), ((15, 52), (18, 60), 50)):
            a.part(curve([(cx + side * 7, top), (cx + side * knee[0], knee[1]), (cx + side * foot[0], foot[1])], 1.0), legs, edge=False)
    # wings (flies, psyllids) behind the body
    if kind in ('fly', 'psyllid'):
        wc = p.get('wingcol', '#d8eef5')
        a.part(ellipse(cx - 14, 30, 12, 6, -.5) | ellipse(cx + 14, 30, 12, 6, .5), wc)
        a.flat(capsule(cx - 22, 26, cx - 7, 32, .5) | capsule(cx + 7, 32, cx + 22, 26, .5), light(dark(wc, .3), .1))
    # body
    if kind == 'shield': bm = a.part(poly([(cx - 15, 28), (cx + 15, 28), (cx + 13, 44), (cx, 57), (cx - 13, 44)]) | ellipse(cx, 30, 15, 6), body)
    elif kind == 'round': bm = a.part(ellipse(cx, 42, 17, 15), body)
    elif kind == 'long': bm = a.part(ellipse(cx, 42, 11, 17), body)
    elif kind == 'ant': bm = a.part(ellipse(cx, 37, 6, 6) | ellipse(cx, 50, 11, 10), body); a.part(ellipse(cx, 37, 6, 6), p.get('thorax', head))
    elif kind == 'fly': bm = a.part(ellipse(cx, 44, 9, 15), body)
    elif kind == 'psyllid': bm = a.part(ellipse(cx, 42, 10, 13), body)
    else: bm = a.part(ellipse(cx, 42, 13, 15), body)
    if p.get('stripes'):
        for k, c in enumerate(p['stripes']):
            if c: a.flat(rect(0, 36 + k * 4, N, 37 + k * 4) & bm, c)
    if p.get('split', kind in ('round', 'long', 'beetle')): a.flat(rect(cx - .5, 28, cx + .5, 60) & bm, dark(body, .45))
    if kind == 'shield': a.part(poly([(cx - 7, 30), (cx + 7, 30), (cx, 46)]) & bm, p.get('scutellum', light(body, .15)))
    if p.get('wingpatch'): a.flat((ellipse(cx - 7, 40, 4, 6) | ellipse(cx + 7, 40, 4, 6)) & bm, p['wingpatch'])
    for x, y, r in p.get('spots', []): a.flat(circle(cx + x, y, r) & bm, p.get('spotcol', INK))
    if p.get('check'):
        for y in range(30, 58, 4):
            for x in range(cx - 16, cx + 16, 4):
                if ((x // 4 + y // 4) % 2) and bm[y, x]: a.flat(rect(x, y, x + 2, y + 2), p['check'])
    if p.get('ridges'):
        for k in (-6, -3, 3, 6): a.flat(capsule(cx + k, 30, cx + k, 55, .5) & bm, dark(body, .3))
    # head (and pronotum)
    if p.get('pronotum'): a.part(ellipse(cx, 27, 12, 5), p['pronotum'])
    # antennae
    al = p.get('antenna', 14)
    a.part(curve([(cx - 5, 9), (cx - 9, 9 - al * .5), (cx - 13, 9 - al * .8)], .9) | curve([(cx + 5, 9), (cx + 9, 9 - al * .5), (cx + 13, 9 - al * .8)], .9), dark(head, .15), edge=False)
    if p.get('clubs'): a.part(circle(cx - 13, 9 - al * .8, 1.8) | circle(cx + 13, 9 - al * .8, 1.8), dark(head, .15), edge=False)
    hm = a.part(ellipse(cx, 18, p.get('headw', 13), 11), head)
    if p.get('cheeks_white'): a.flat((ellipse(cx - 9, 21, 2.5, 2) | ellipse(cx + 9, 21, 2.5, 2)) & hm, '#f4f0e0')
    if p.get('bigeyes'): a.part(ellipse(cx - 8, 17, 4, 5) | ellipse(cx + 8, 17, 4, 5), p['bigeyes'])
    if front:
        if p.get('bigeyes'):
            eye(a, cx - 10, 15, 5); eye(a, cx + 6, 15, 5); smile(a, cx - 1, 24)
        else: face(a, cx, 14, gap=8, s=5)

# ════════════════════════════════════════════════════════════════════
# Sea creatures and seaweed — front view
# ════════════════════════════════════════════════════════════════════
def octopus(a, p, front=True):
    c = p['body']
    for k in range(8):
        x = 10 + k * 6.3; side = -1 if k < 4 else 1
        a.part(curve([(x + 2, 40), (x - side * 2, 50), (x + side * 3, 56), (x + side * 6, 54)], 2.6), dark(c, .08) if k % 2 else c)
    hm = a.part(ellipse(32, 26, 18, 19), c)
    a.part(ellipse(32, 41, 21, 7), c)
    rng = np.random.default_rng(2)
    for _ in range(14):
        x, y = int(rng.uniform(18, 46)), int(rng.uniform(10, 36))
        if hm[y, x]: a.flat(ellipse(x, y, 1.5, 1.2), light(c, .25))
    for k in range(8):
        x = 10 + k * 6.3; side = -1 if k < 4 else 1
        a.dot([(int(x + side * 3), 54), (int(x - side * 1), 50)], '#f6d4c4')
    if front: face(a, 32, 30, gap=10, s=5)

def shell_abalone(a, p, front=True):
    c = p['body']
    a.part(ellipse(32, 50, 22, 8), p.get('foot', '#d8c49a'))
    sm = a.part(ellipse(32, 36, 26, 18, -.08), c)
    for k in range(5): a.flat(ellipse(32 + 4 - k * .5, 36 + 2, 26 - k * 5, 18 - k * 3.5, -.08) & ~ellipse(32 + 4 - k * .5, 36 + 2, 24 - k * 5, 16 - k * 3.5, -.08) & sm, dark(c, .25))
    for k in range(6): a.flat(circle(12 + k * 6, 24 + k * .6 - (k > 3) * 1, 1.6) & sm, '#2a2a30')
    a.part(ellipse(30, 40, 9, 5) & sm, p.get('nacre', '#9ad0c8'), edge=False)
    if front: a.part(capsule(20, 44, 18, 38, 1) | capsule(44, 44, 46, 38, 1), '#c9b088', edge=False); eye(a, 16, 34, 3); eye(a, 45, 34, 3); smile(a, 31, 50)

def mussel(a, p, front=True):
    c = p['body']
    a.part(capsule(26, 56, 22, 61, 1) | capsule(34, 56, 38, 61, 1) | capsule(30, 56, 30, 61, 1), '#8a7550', edge=False)
    l = a.part(ellipse(20, 34, 13, 24, .18), c)
    r = a.part(ellipse(44, 34, 13, 24, -.18), dark(c, .1))
    for k in range(3): a.flat(curve([(32, 10 + k * 14), (20 - k, 30 + k * 8), (32, 56)], .5) & l, light(c, .2))
    a.part(ellipse(32, 38, 11, 13), '#f0a070')
    if front: face(a, 32, 33, gap=6, s=4)

def crab(a, p, front=True):
    c = p['body']
    for side in (-1, 1):
        for k in range(3): a.part(curve([(32 + side * 12, 44 + k * 3), (32 + side * (22 + k * 2), 48 + k * 2), (32 + side * (26 + k * 2), 58)], 1.4), dark(c, .1))
        a.part(curve([(32 + side * 14, 38), (32 + side * 22, 30)], 2.2), c)
        a.part(ellipse(32 + side * 24, 24, 7, 6, side * .4), p.get('claw', c))
        a.part(poly([(32 + side * 22, 18), (32 + side * 30, 12), (32 + side * 28, 21)]), p.get('claw', c))
    a.part(capsule(26, 30, 24, 18, 1.2) | capsule(38, 30, 40, 18, 1.2), c)
    bm = a.part(poly([(14, 34), (20, 28), (44, 28), (50, 34), (46, 50), (18, 50)]), c)
    a.flat(rect(20, 40, 44, 41) & bm, dark(c, .3))
    if front: eye(a, 22, 15, 4); eye(a, 39, 15, 4); smile(a, 31, 36); blush(a, 20, 36); blush(a, 41, 36)

def barnacle(a, p, front=True):
    c = p['body']
    for x, h in ((18, 30), (46, 30), (32, 40)):
        a.part(capsule(x, 60, x, 60 - h * .55, 6 if x == 32 else 4), p.get('stalk', '#7a5a48'))
        top = 60 - h
        cm = a.part(poly([(x - 8, top + 14), (x - 7, top + 2), (x - 2, top - 3), (x + 3, top - 3), (x + 7, top + 2), (x + 8, top + 14)]), c)
        a.flat(capsule(x, top - 2, x, top + 13, .6) & cm, dark(c, .35))
        a.flat(rect(x - 8, top + 12, x + 8, top + 13) & cm, '#d8d0b0')
    if front: eye(a, 28, 38, 4); eye(a, 34, 38, 4); smile(a, 31, 44); blush(a, 26, 43, 2); blush(a, 36, 43, 2)

def cucumber(a, p, front=True):
    c = p['body']
    bm = a.part(capsule(12, 44, 52, 40, 11) , c)
    for k in range(9):
        x = 12 + k * 5; y = 30 + (k % 2) * 2
        a.part(poly([(x - 3, y + 3), (x, y - 5), (x + 3, y + 3)]), light(c, .1))
    for k in range(7): a.flat(circle(14 + k * 6, 50, 1.4) & bm, light(c, .4))
    if front: face(a, 18, 37, gap=6, s=4)

def urchin(a, p, front=True):
    c, sp = p['body'], p.get('spine', p['body'])
    L = p.get('len', 14)
    for k in range(28):
        ang = math.pi * (k / 27) * 1.15 - math.pi * .075
        x0, y0 = 32 - math.cos(ang) * 14, 44 - math.sin(ang) * 12
        a.part(capsule(x0, y0, 32 - math.cos(ang) * (14 + L), 44 - math.sin(ang) * (12 + L), 1.1), sp if k % 2 else dark(sp, .15), edge=False)
    bm = a.part(ellipse(32, 46, 17, 13), c)
    for k in range(10): a.flat(circle(20 + k * 2.6, 40 + (k % 3), 1) & bm, light(c, .3))
    if front: face(a, 32, 44, gap=8, s=4)

def starfish(a, p, front=True):
    c = p['body']; pts = []
    for k in range(10):
        ang = -math.pi / 2 + k * math.pi / 5; r = 29 if k % 2 == 0 else 11
        pts.append((32 + math.cos(ang) * r, 34 + math.sin(ang) * r))
    bm = a.part(poly(pts), c)
    for k in range(5):
        ang = -math.pi / 2 + k * 2 * math.pi / 5
        for t in range(4, 26, 4): a.flat(circle(32 + math.cos(ang) * t, 34 + math.sin(ang) * t, 1.3) & bm, p.get('dots', light(c, .4)))
    if p.get('rim'): a.flat(bm & ~poly([(32 + (x - 32) * .82, 34 + (y - 34) * .82) for x, y in pts]), p['rim'])
    if front: face(a, 32, 30, gap=8, s=4)

def coral(a, p, front=True):
    c = p['body']
    br = [[(32, 60), (32, 40), (26, 28), (20, 14)], [(32, 44), (40, 30), (44, 16)], [(28, 34), (16, 26), (10, 18)], [(38, 36), (50, 28), (54, 18)], [(32, 40), (33, 22), (31, 8)]]
    for b in br: a.part(curve(b, 4), c)
    for b in br:
        x, y = b[-1]; a.part(circle(x, y, 4.5), light(c, .15))
        for k in range(5): a.dot([(int(x + math.cos(k) * 3), int(y + math.sin(k) * 3))], p.get('polyp', '#fff2c8'))
    a.part(ellipse(32, 47, 9, 11), c)
    a.part(ellipse(32, 60, 14, 3), '#9a8a7a')
    if front: face(a, 32, 42, gap=6, s=4)

def anemone(a, p, front=True):
    c, t = p['body'], p.get('tent', light(p['body'], .2))
    for k in range(13):
        ang = math.pi * (k / 12); x0 = 32 - math.cos(ang) * 14
        a.part(curve([(x0, 28), (32 - math.cos(ang) * 20, 28 - math.sin(ang) * 14), (32 - math.cos(ang) * 22 + (k % 3 - 1) * 2, 26 - math.sin(ang) * 22)], 2.4), t if k % 2 else dark(t, .1))
    a.part(ellipse(32, 30, 17, 6), dark(c, .1))
    bm = a.part(rect(17, 30, 47, 54) | ellipse(32, 54, 15, 5), c)
    for k in range(6): a.flat(rect(19 + k * 5, 32, 20 + k * 5, 54) & bm, dark(c, .12))
    if front: face(a, 32, 38, gap=8, s=4)

def seaweed(a, p, front=True):
    c, kind = p['body'], p.get('kind', 'frond')
    a.part(ellipse(32, 60, 12, 3), '#8a7f70')
    if kind == 'frond':   # 미역: wavy blade with a midrib and side leaflets
        for side in (-1, 1):
            for k in range(5):
                y = 14 + k * 9
                a.part(curve([(32, y + 6), (32 + side * 12, y + 2), (32 + side * 20, y + 6 + (k % 2) * 3)], 3.4), c if k % 2 else dark(c, .08))
        bm = a.part(curve([(32, 60), (31, 40), (33, 22), (31, 6)], 6), c)
        a.flat(curve([(32, 58), (31, 40), (33, 22), (31, 8)], .7) & bm, light(c, .25))
    elif kind == 'blade':   # 감태: broad wrinkled blades on a stipe
        a.part(capsule(32, 60, 32, 36, 3), dark(c, .1))
        for ang, ln in ((-.55, 26), (.55, 26), (-.15, 30), (.2, 29)):
            x1, y1 = 32 + math.sin(ang) * ln, 36 - math.cos(ang) * ln
            bm = a.part(capsule(32, 36, x1, y1, 6), c if ang < 0 else dark(c, .06))
            a.flat(capsule(32, 36, x1, y1, .6) & bm, dark(c, .3))
        bm = a.part(ellipse(32, 34, 10, 9), c)
    else:   # 대황: forked branches with thick blades
        a.part(capsule(32, 60, 32, 38, 3), dark(c, .1))
        for b in ([(32, 40), (22, 28), (14, 12)], [(32, 40), (42, 28), (50, 12)], [(32, 40), (31, 24), (34, 6)], [(22, 28), (10, 24)], [(42, 28), (55, 26)]):
            a.part(curve(b, 4.2), c)
        bm = a.part(ellipse(32, 36, 10, 9), c)
    if front: face(a, 32, 32 if kind != 'frond' else 34, gap=6, s=4)

def shrub(a, p, front=True):
    c = p['body']
    a.part(capsule(28, 60, 30, 46, 2.4) | capsule(36, 60, 34, 46, 2.4), '#7a5a40')
    for x, y, r in ((20, 28, 13), (44, 28, 13), (32, 18, 14), (32, 36, 18), (16, 40, 10), (48, 40, 10)):
        a.part(circle(x, y, r), c)
    rng = np.random.default_rng(11)
    for _ in range(40):
        x, y = int(rng.uniform(6, 58)), int(rng.uniform(8, 50))
        if a.fill[y, x]: a.flat(ellipse(x, y, 2, 1, rng.uniform(0, 3)), p.get('leaf2', light(c, .45)))
    for x, y in ((14, 44), (20, 50), (46, 46), (52, 38), (40, 52), (10, 34), (30, 52)):
        a.part(ellipse(x, y, 2.4, 3), p.get('berry', '#d8443a')); a.dot([(x - 1, y - 2)], '#ffd0c0')
    if front: face(a, 32, 32, gap=8, s=4)

GROUPS = {'bird': bird, 'fish': fish, 'flat': flatfish, 'insect': insect, 'octopus': octopus, 'abalone': shell_abalone, 'mussel': mussel,
          'crab': crab, 'barnacle': barnacle, 'cucumber': cucumber, 'urchin': urchin, 'star': starfish, 'coral': coral,
          'anemone': anemone, 'seaweed': seaweed, 'shrub': shrub}
SIDE = {'bird', 'fish', 'flat'}

SPECIES = {
    # ── plant ──
    20: ('shrub', dict(body='#7f9a72', leaf2='#d8e2cf', berry='#d8443a')),              # 보리밥나무: 은빛 잎, 붉은 열매
    # ── insects ──
    21: ('insect', dict(kind='long', body='#9bb06a', head='#6f8a48', antenna=22, legs='#5e6e40', wingpatch='#c8d79a')),     # 독도장님노린재
    22: ('insect', dict(kind='shield', body='#2e2a30', head='#26232a', scutellum='#4a4450', wingpatch='#e6e0d0', antenna=12)),  # 애꽃노린재
    23: ('insect', dict(kind='long', body='#a0704a', head='#6a4630', stripes=[None, '#7a4f32', None, '#7a4f32'], antenna=16)),     # 애긴노린재
    24: ('insect', dict(kind='long', body='#5a4434', head='#3f2f26', pronotum='#4a382c', ridges=True, antenna=10)),            # 섬땅방아벌레
    25: ('insect', dict(kind='beetle', body='#2c2a2e', head='#232126', pronotum='#2a282c', ridges=True, antenna=9, clubs=True)),  # 긴뺨모래거저리
    26: ('insect', dict(kind='beetle', body='#c7a873', head='#8a6e48', pronotum='#a8895c', spots=[(-6, 40, 1.4), (5, 46, 1.4), (-3, 52, 1.2), (7, 38, 1.2)], spotcol='#8a6e48', antenna=10)),  # 모래섶벌레
    27: ('insect', dict(kind='round', body='#e43c2f', head='#1f1c22', cheeks_white=True, spots=[(0, 30, 3), (-9, 38, 2.6), (9, 38, 2.6), (-7, 48, 2.4), (7, 48, 2.4), (-11, 44, 1.8), (11, 44, 1.8)], antenna=6, clubs=True)),  # 칠성무당벌레
    28: ('insect', dict(kind='round', body='#f08a2a', head='#2a2420', cheeks_white=True, spots=[(-8, 34, 1.6), (8, 34, 1.6), (-12, 42, 1.5), (12, 42, 1.5), (-5, 44, 1.5), (5, 44, 1.5), (-9, 51, 1.5), (9, 51, 1.5), (-3, 37, 1.3), (3, 37, 1.3), (0, 53, 1.3)], antenna=6, clubs=True)),  # 무당벌레
    29: ('insect', dict(kind='ant', body='#2a2226', head='#8a4e2e', thorax='#9a5a34', antenna=16, headw=9)),            # 배검은꼬마개미
    30: ('insect', dict(kind='fly', body='#f2c43a', head='#3a2a20', stripes=[None, '#2a2224', None, '#2a2224', None, '#2a2224'], bigeyes='#a8452c', antenna=4)),  # 쟈바꽃등에
    31: ('insect', dict(kind='fly', body='#e89a3a', head='#3a2a20', stripes=['#2a2224', None, '#2a2224', None, '#2a2224', None], bigeyes='#8a3a26', antenna=4, legs='#c88a3a')),  # 호리꽃등에
    32: ('insect', dict(kind='psyllid', body='#8ec060', head='#6e9a46', wingcol='#e4f2e0', antenna=10)),               # 명아주나무이
    33: ('insect', dict(kind='round', body='#f2d24a', head='#2a2420', check='#2a2420', antenna=6, clubs=True)),          # 꼬마남생이무당벌레
    # ── fish ──
    34: ('fish', dict(body='#e8e4d8', belly='#f6f2e6', fin='#4a4a52', bars=[(5, 3, '#2c2c34'), (12, 3, '#2c2c34'), (19, 3, '#2c2c34'), (26, 3, '#2c2c34'), (33, 3, '#2c2c34')], snout='beak', beakcol='#d4cdb8', dorsal='spiny')),  # 돌돔
    35: ('fish', dict(body='#5a5e7a', belly='#8a90a6', fin='#3e4058', rx=18, ry=13, spots='#e8eef8', nspots=1, seed=1, eyecol='#c8d8f0')),   # 자리돔
    36: ('fish', dict(body='#3e4a42', belly='#6c7a6e', fin='#2c3530', eyecol='#5ab0d8', tail='square')),                 # 벵에돔
    37: ('fish', dict(body='#8a7a6a', belly='#c8baa8', fin='#5e5248', bars=[(9, 4, '#5e5046'), (20, 4, '#5e5046'), (31, 4, '#5e5046')], dorsal='spiny', tail='round', rx=19, ry=13)),  # 볼락
    38: ('fish', dict(body='#5e5850', belly='#a49c90', fin='#3e3a34', mottle='#47423c', dorsal='spiny', tail='round', snout='big', rx=21)),  # 조피볼락
    39: ('fish', dict(body='#a8644a', belly='#e0b098', fin='#7a4636', mottle='#86503c', dorsal='spiny', tail='round', rx=19)),           # 개볼락
    40: ('flat', dict(body='#8a7a5a', spots='#5a4c36')),                                                                 # 넙치
    41: ('fish', dict(shape='long', body='#7a6a4a', belly='#c8b88a', fin='#5a4c34', mottle='#5a4c34', dorsal='long', tail='square')),  # 노래미
    42: ('fish', dict(shape='long', body='#7aa86a', belly='#e8d0a0', fin='#5a8a5a', stripes_h=['#d86a4a', '#d86a4a'], dorsal='long', tail='round')),  # 놀래기
    43: ('fish', dict(shape='long', body='#4aa0a8', belly='#d8f0e0', fin='#3a7a90', stripes_h=['#f08a3a', '#2a4a8a', '#f08a3a'], dorsal='long', tail='round')),  # 용치놀래기
    44: ('fish', dict(body='#f2d04a', belly='#fbe89a', fin='#e8b83a', ry=16, stripes_h=['#2c2c34', '#2c2c34', '#2c2c34'], dorsal='spiny')),  # 범돔
    45: ('fish', dict(body='#8a8a7a', belly='#c8c4b0', fin='#5a5a50', bars=[(6, 3, '#5a584e'), (13, 3, '#5a584e'), (20, 3, '#5a584e'), (27, 3, '#5a584e'), (34, 3, '#5a584e')], snout='big', dorsal='spiny', tail='round', rx=22)),  # 능성어
    46: ('fish', dict(body='#b45a46', belly='#e8a08a', fin='#8a3e30', spots='#f2a03a', nspots=22, seed=4, snout='big', dorsal='spiny', tail='round', rx=21)),  # 붉바리
    47: ('fish', dict(shape='round', body='#8a7a4a', belly='#f4f0e2', fin='#c8b070', spots='#f4f0e2', nspots=18, seed=9, bigspots=True, tail='round', dorsal='soft')),  # 복섬
    48: ('fish', dict(shape='diamond', body='#7a8a9a', belly='#b8c4d0', fin='#5a6a7a', snout='long', dorsal='spike', tail='square')),  # 말쥐치
    49: ('fish', dict(body='#d07a70', belly='#f4e4dc', fin='#b05a50', hump=True, humpcol='#c86a62', rx=22, ry=14, tail='square', lips='#f4e4dc')),  # 혹돔
    50: ('fish', dict(shape='torpedo', body='#5a8aa8', belly='#e0e8ec', fin='#d8b83a', tailcol='#e0c03a', lines=[(-1, 2, '#f0d050')], back='#3e6a8a', tail='lunate')),  # 방어
    51: ('fish', dict(shape='long', body='#f0c83a', belly='#fbe89a', fin='#3a7ac8', back='#3a7ac8', dorsal='long', tail='round', eyecol='#bfe0f8')),  # 청황베도라치
    # ── molluscs, crustaceans, echinoderms, cnidarians, seaweed ──
    52: ('octopus', dict(body='#c8664e')),                       # 참문어
    53: ('abalone', dict(body='#8a7a5a', nacre='#9ad0c8')),        # 왕전복
    54: ('mussel', dict(body='#2e3448')),                          # 홍합
    55: ('crab', dict(body='#5a6a4a', claw='#6a7a52')),            # 바위게
    56: ('barnacle', dict(body='#c8c0a8', stalk='#7a5a48')),       # 거북손
    57: ('cucumber', dict(body='#a8583e')),                        # 돌기해삼
    58: ('urchin', dict(body='#7a8a5a', spine='#9aaa6a', len=7)),  # 말똥성게
    59: ('urchin', dict(body='#4a2e5a', spine='#6a3e7a', len=16)), # 보라성게
    60: ('star', dict(body='#f0b23a', dots='#8a4ab0', rim='#9a5ac0')),  # 아무르불가사리
    61: ('coral', dict(body='#f08a3a', polyp='#fff2c8')),          # 유착나무돌산호
    62: ('anemone', dict(body='#e8507a', tent='#f6a0c0')),         # 보석말미잘
    63: ('seaweed', dict(kind='frond', body='#6a7a3a')),           # 미역
    64: ('seaweed', dict(kind='blade', body='#8a7a3a')),           # 감태
    65: ('seaweed', dict(kind='branch', body='#5a4a2a')),          # 대황
    # ── birds ──
    68: ('bird', dict(body='#3e3a40', belly='#4e4a50', wing='#2e2a30', wingbar='#8a8490', tailtype='fork', beak='#2a2a2a', beaktype='spear', beaklen=4, legs='#2a2a2a', blush=False)),  # 바다제비
    69: ('bird', dict(body='#7a6a58', belly='#f2eee6', head='#e8e2d6', cap='#8a7a68', wing='#6a5a48', tailtype='short', beak='#e0b8a8', beaktype='hook', legs='#e0b8a8')),  # 슴새
    70: ('bird', dict(kind='swim', body='#4a5058', belly='#f0f0ec', head='#2a2e34', throat='#f0f0ec', crest='tuft', crestcol='#2a2e34', beak='#5a6068', beaktype='spear', beaklen=4)),  # 뿔쇠오리
    71: ('bird', dict(kind='raptor', body='#5a6a7a', belly='#f2eee4', head='#3e4a58', cheek='#f2eee4', moustache='#2a3038', bars='#4a5664', wing='#4a5868', beak='#3a3e48', beaktype='hook', cere='#f0c83a', legs='#f0c83a', tailtype='short')),  # 매
    72: ('bird', dict(kind='raptor', body='#c06a3a', belly='#f4dcb4', head='#8a94a4', spots='#3a2a24', wing='#b0603a', wingtip='#3a2e2a', moustache='#3a3e48', beak='#3a3e48', beaktype='hook', cere='#f0c83a', legs='#f0c83a', tail='#8a94a4')),  # 황조롱이
    73: ('bird', dict(kind='raptor', body='#5a4a3a', belly='#f6f2ea', head='#f6f2ea', stripe='#4a3a2e', wing='#4e3e30', beak='#2a2a2e', beaktype='hook', legs='#b8c4c8', tailtype='short')),  # 물수리
    74: ('bird', dict(kind='raptor', body='#8a6440', belly='#e8d4b0', band='#6a4a30', head='#a07a50', wing='#6e5034', beak='#3a3e48', beaktype='hook', cere='#f0d070', legs='#f0d070')),  # 말똥가리
    75: ('bird', dict(kind='swim', neck=True, body='#f6f6f2', belly='#ffffff', head='#f6f6f2', wing='#e6e8e4', beak='#2a2a2e', beaktype='duck', beaklen=8, cere='#f0d050', blush=True)),  # 고니
    76: ('bird', dict(kind='heron', neck=True, body='#4a4e5a', belly='#5a5e6a', head='#f4f4f0', neckcol='#f4f4f0', crest='red', wing='#3a3e48', beak='#d8c88a', beaktype='spear', beaklen=9, legs='#3a3a3e', tailtype='fan', tail='#2e3238')),  # 흑두루미
    77: ('bird', dict(kind='heron', neck=True, body='#fbfaf4', belly='#ffffff', head='#f0b060', neckcol='#f4c07a', wing='#f2f0e8', beak='#f0c83a', beaktype='spear', beaklen=8, legs='#6a6a50')),  # 황로
    78: ('bird', dict(kind='wader', body='#5a6a74', belly='#8a9aa4', head='#5a6a74', cap='#1e2228', crest='plume', wing='#46545e', wingstripes='#c8d4c8', beak='#2a2a2e', beaktype='spear', beaklen=11, legs='#e0c040', tailtype='short')),  # 검은댕기해오라기
    79: ('bird', dict(kind='wader', body='#22262a', belly='#2e3236', head='#22262a', throat='#f0d050', cheek='#f4f2ea', wing='#3a3a34', scales='#5a5a4a', beak='#5a5a5a', beaktype='hook', legs='#22262a', tailtype='long')),  # 민물가마우지
    80: ('bird', dict(kind='wader', body='#1e2a2a', belly='#26343a', head='#1e2a2a', eyering='#d84a4a', wing='#1a2424', beak='#3a3a3a', beaktype='hook', legs='#22262a', tailtype='long', scale=.9)),  # 쇠가마우지
    81: ('bird', dict(kind='swim', neck=True, body='#4a4e52', belly='#f0f0ec', head='#9aa0a6', neckcol='#9aa0a6', throat='#b84a3a', wing='#3a3e42', scales='#d8dcd8', beak='#3a3e44', beaktype='spear', beaklen=7)),  # 아비
    82: ('bird', dict(body='#a8885a', belly='#e8d4a8', head='#8a6a44', brow='#f2e4c0', wing='#8a6a44', wingstripes='#5a4430', tailtype='short', beak='#6a5a48', beaklen=4, legs='#d8b08a', scale=1.05)),  # 메추라기
    83: ('bird', dict(kind='wader', body='#c8a040', belly='#1e1e22', head='#c8a040', throat='#1e1e22', brow='#f4f2ea', spots='#4a3a20', wing='#b88e34', scales='#f0d070', beak='#2a2a2a', beaklen=5, legs='#4a4a4a')),  # 검은가슴물떼새
    84: ('bird', dict(body='#8a6a44', belly='#efe4cc', head='#8a6a44', brow='#e8d6a8', stripe='#4a3622', wing='#6e5234', wingstripes='#e0c890', beak='#7a6448', beaktype='spear', beaklen=15, legs='#9a9a6a', tailtype='short')),  # 꺅도요
    85: ('bird', dict(kind='wader', body='#7a6a50', belly='#f6f4ee', head='#7a6a50', brow='#f0ece0', wing='#6a5a42', breast='#a89878', beak='#3e3a36', beaktype='spear', beaklen=7, legs='#a8a07a', tailtype='short')),  # 깝작도요
    86: ('bird', dict(kind='wader', body='#c86a3a', belly='#f6f4ee', head='#f4f2ea', breast='#1e1e22', mask='#1e1e22', wing='#b85a30', wingtip='#2a2a2e', beak='#2a2a2a', beaklen=5, legs='#f08a3a')),  # 꼬까도요
    87: ('bird', dict(body='#3a6ac8', belly='#e89a4a', head='#1e1e24', collar='#f6f2ea', throat='#f6f2ea', wing='#2a5ab8', wingtip='#1e1e24', beak='#e03a3a', beaktype='spear', beaklen=12, legs='#e03a3a', tailtype='short')),  # 청호반새
    88: ('bird', dict(body='#2aa8b8', belly='#f08a3a', head='#2a8aa8', throat='#f6f2ea', cheek='#f08a3a', wing='#1e8aa0', spots='#8af0f0', beak='#1e1e22', beaktype='spear', beaklen=12, legs='#e8503a', tailtype='short', scale=1.05)),  # 물총새
    89: ('bird', dict(body='#e0a070', belly='#f0c8a0', head='#e0a070', crest='fan', crestcol='#e8a060', wing='#2a2a2e', wingstripes='#f6f2ea', tail='#2a2a2e', beak='#3a3a3a', beaktype='curve', beaklen=12, legs='#6a6a6a')),  # 후투티
    90: ('bird', dict(body='#f2cc2a', belly='#f8dc5a', head='#f2cc2a', stripe='#1e1e22', wing='#2a2a2e', wingbar='#f2cc2a', tail='#2a2a2e', beak='#e88a9a', beaklen=7, legs='#6a6a6a')),  # 꾀꼬리
    91: ('bird', dict(body='#8aa060', belly='#f2f0e4', head='#1e1e24', cheek='#f6f6f2', throat='#1e1e24', band='#1e1e24', wing='#6a7a88', wingbar='#f2f0e4', tail='#5a6a78', beak='#1e1e24', beaklen=4, legs='#6a7088')),  # 박새
    92: ('bird', dict(body='#8aa05a', belly='#d8e0b8', head='#8aa05a', crest='crown', crestcol='#ffd23f', wing='#6a7e46', wingbar='#f2f0e4', beak='#2a2a2a', beaktype='spear', beaklen=4, legs='#7a6a5a', scale=.95)),  # 상모솔새
    93: ('bird', dict(body='#8a7a5a', belly='#e8dcc0', head='#8a7a5a', brow='#e8dcc0', wing='#76664a', beak='#6a5a48', beaktype='spear', beaklen=6, legs='#c8a888', tailtype='long')),  # 섬개개비
    94: ('bird', dict(body='#8ab040', belly='#e8e4c8', head='#a0c048', throat='#f2d43a', eyering='#ffffff', wing='#6e9434', beak='#3a3a3a', beaktype='spear', beaklen=5, legs='#5a5a5a', blush=True)),  # 한국동박새
    95: ('bird', dict(body='#2a3a6a', belly='#f2e4d0', head='#2a3a6a', cheek='#d8784a', spots='#a89878', wing='#1e2a52', tailtype='fork', tail='#1e2a52', beak='#2a2a2a', beaklen=3, legs='#3a3a3a')),  # 귀제비
    96: ('bird', dict(body='#3a3a40', belly='#f08a3a', head='#b8bcc4', throat='#1e1e22', cheek='#1e1e22', wing='#2a2a2e', wingbar='#f6f2ea', tail='#e87a3a', beak='#1e1e22', beaklen=4, legs='#3a3a3a')),  # 딱새
    97: ('bird', dict(body='#b89a5a', belly='#f2ead2', head='#b89a5a', scales='#2a2420', wing='#a88a4a', beak='#4a4038', beaklen=6, legs='#d8b8a0')),  # 호랑지빠귀
    98: ('bird', dict(body='#4a4038', belly='#f6f2ea', head='#3a322c', brow='#f6f2ea', spots='#1e1e22', wing='#a85a34', beak='#3a3a3a', beaklen=6, legs='#8a7a6a')),  # 개똥지빠귀
    99: ('bird', dict(body='#e8903a', belly='#f6f2ea', head='#2a2a2e', breast='#f0a04a', wing='#2a2a2e', wingbar='#f0a04a', tail='#2a2a2e', beak='#e8c88a', beaklen=4, legs='#8a7a6a')),  # 되새
}

def render(sid, front=True):
    group, p = SPECIES[sid]; a = Art(); GROUPS[group](a, p, front); return a.finish()

def to_canvas(dots, size=512, margin=20, base=500):
    al = dots[..., 3] > 0; ys, xs = np.where(al)
    crop = dots[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    k = max(1, min((size - 2 * margin) // crop.shape[1], (base - margin) // crop.shape[0]))
    img = Image.fromarray(crop, 'RGBA').resize((crop.shape[1] * k, crop.shape[0] * k), Image.NEAREST)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0)); canvas.paste(img, ((size - img.width) // 2, base - img.height), img)
    return canvas

def build(ids):
    os.makedirs(os.path.join(OUT, 'back'), exist_ok=True)
    for sid in ids:
        group = SPECIES[sid][0]
        front = to_canvas(render(sid, True))
        if group in SIDE: back = front.transpose(Image.FLIP_LEFT_RIGHT)
        else:
            back = to_canvas(render(sid, False)).transpose(Image.FLIP_LEFT_RIGHT)
            arr = np.array(back).astype(float); arr[..., :3] *= .9; back = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA')
        front.save(os.path.join(OUT, f'{sid:03d}.png'), optimize=True); back.save(os.path.join(OUT, 'back', f'{sid:03d}.png'), optimize=True)
    print('designed', len(ids))

if __name__ == '__main__':
    ids = [int(v) for v in sys.argv[1:]] or sorted(SPECIES)
    build(ids)
