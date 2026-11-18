"""울릉도·독도 건물과 식물 도트 그림 (v0.36)

    python scripts/draw-island-art.py        # Pillow 필요

  dist/assets/scenery/island-art-v67.png   그림 모음
  dist/island-atlas.js                     그림마다 자리(rect)

건물은 게임 속 크기 그대로(한 칸 = 32×32 도트, 1도트 = 게임 1픽셀) 위에서 비스듬히 내려다본 3/4 시점으로 그립니다. 건물 칸(가로 5칸 또는 7칸)의 가운데 칸 위에 문이 오도록 해서
문 아래 칸에 서면 주인공이 문 한가운데에 맞습니다.

참고한 실제 모습(모양과 색은 게임용으로 단순하게 바꿨어요)
  울릉도: 통나무 귀틀벽에 억새 지붕을 얹고, 처마 끝부터 땅까지 우데기를 두른 투막집 · 너와 지붕 · 도동항 여객선 터미널 · 후박나무와 동백나무
  독도:   동도의 하얀 등대와 경비대 숙소 · 서도 바위에 기대어 선 주민숙소 · 키 큰 나무 없이 사철나무 같은 떨기나무와 해국
"""
import json, math, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PNG = os.path.join(ROOT, 'dist', 'assets', 'scenery', 'island-art-v67.png')
OUT_JS = os.path.join(ROOT, 'dist', 'island-atlas.js')
INK = (42, 36, 34, 255)

def hexc(s, a=255): s = s.lstrip('#'); return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)
class Pic:
    def __init__(s, w, h): s.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); s.d = ImageDraw.Draw(s.im); s.w, s.h = w, h
    def r(s, x, y, w, h, c):
        if w > 0 and h > 0: s.d.rectangle([x, y, x + w - 1, y + h - 1], fill=hexc(c) if isinstance(c, str) else c)
    def box(s, x, y, w, h, c, line=INK, t=2):  # filled box with a dark outline
        s.r(x, y, w, h, line); s.r(x + t, y + t, w - 2 * t, h - 2 * t, c)
    def poly(s, pts, c, line=None):
        s.d.polygon(pts, fill=hexc(c) if isinstance(c, str) else c)
        if line: s.d.line(pts + [pts[0]], fill=line, width=2)
    def px(s, x, y, c): s.r(x, y, 1, 1, c)

# ───────────────────────── 3/4 시점 도구 ─────────────────────────
# 한 칸 = 32×32 도트(게임 1픽셀 = 도트 1개). 빛은 왼쪽 위에서 와요: 왼쪽·위는 밝게, 오른쪽·아래는 어둡게.
# 건물 그림 = 땅 칸(가로 w칸) + 양옆 8도트 처마. 앞벽은 땅 칸 너비, 오른쪽 옆벽은 오른쪽 8도트에 비스듬히 보여요.
# 문은 언제나 가운데 칸 한가운데(그림 가운데)에 와요.
SIDE, RISE = 8, 5          # how much of the right side wall shows, and how much it climbs (perspective)
SHADOW = (24, 40, 30, 70)  # ground shadow colour (see-through)

def rgb(c): return hexc(c) if isinstance(c, str) else c
def tone(c, f):  # lighter (>1) or darker (<1)
    r, g, b, a = rgb(c); return (max(0, min(255, round(r * f))), max(0, min(255, round(g * f))), max(0, min(255, round(b * f))), a)

def ground_shadow(p, x0, x1, base, reach=12):
    sh = Image.new('RGBA', p.im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    d.polygon([(x0 + 4, base - 1), (x1 + 2, base - 1), (x1 + SIDE + reach, base - RISE - 4), (x1 + SIDE + 2, base - RISE - 10), (x0 + 10, base - 6)], fill=SHADOW)
    d.rectangle([x0 + 2, base - 3, x1 + SIDE, base - 1], fill=SHADOW)
    p.im.alpha_composite(sh)

def wall(p, x0, x1, top, bottom, c, band=2):
    """Front wall with soft top-to-bottom shading, a lit left edge and a dark outline, plus the right side wall."""
    p.r(x0, top, x1 - x0, bottom - top, INK)
    for y in range(top + 2, bottom - 2, band):
        f = 1.05 - .16 * (y - top) / max(1, bottom - top)
        p.r(x0 + 2, y, x1 - x0 - 4, min(band, bottom - 2 - y), tone(c, f))
    p.r(x0 + 2, top + 2, 2, bottom - top - 4, tone(c, 1.12))
    side = [(x1 - 1, top), (x1 + SIDE, top - RISE), (x1 + SIDE, bottom - RISE), (x1 - 1, bottom)]
    p.d.polygon(side, fill=INK)
    for y in range(top - RISE + 2, bottom - 2):
        for x in range(x1 + 1, x1 + SIDE - 1):
            yy0 = top + 2 - (x - x1) * RISE / SIDE; yy1 = bottom - 2 - (x - x1) * RISE / SIDE
            if yy0 <= y <= yy1: p.px(x, y, tone(c, .74 - .1 * (y - top) / max(1, bottom - top)))

def eave_shadow(p, x0, x1, y, h=5):
    sh = Image.new('RGBA', p.im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rectangle([x0, y, x1 + SIDE, y + h - 1], fill=(20, 18, 16, 80)); p.im.alpha_composite(sh)

def hip_roof(p, x0, x1, eave, ridge, c, rows=6, tex=None, overhang=7):
    """A hip roof seen from above at an angle: the big front slope, the darker right hip, a lit ridge and a thick eave edge."""
    L, Rr = x0 - overhang, x1 + overhang
    front = [(L, eave), (Rr, eave), (Rr - 14, ridge), (L + 18, ridge)]
    hip = [(Rr, eave), (Rr + SIDE, eave - RISE), (Rr + SIDE - 12, ridge - RISE), (Rr - 14, ridge)]
    p.d.polygon([(L - 2, eave + 2), (Rr + 2, eave + 2), (Rr + SIDE + 2, eave - RISE), (Rr + SIDE - 11, ridge - RISE - 2), (L + 17, ridge - 2)], fill=INK)
    p.d.polygon(front, fill=rgb(c)); p.d.polygon(hip, fill=tone(c, .7))
    span = eave - ridge
    for i, y in enumerate(range(ridge + 1, eave, max(3, span // rows))):  # rows: lighter near the ridge
        f = 1.18 - .32 * (y - ridge) / span
        t = (y - ridge) / span; xl = L + 18 - 18 * t; xr = Rr - 14 + 14 * t
        p.r(round(xl) + 1, y, round(xr - xl) - 1, max(3, span // rows) - 1, tone(c, f))
        p.r(round(xl) + 1, y + max(3, span // rows) - 1, round(xr - xl) - 1, 1, tone(c, f * .78))
        if tex: tex(p, round(xl) + 1, round(xr) - 1, y, max(3, span // rows) - 1, i)
    p.r(L + 18, ridge - 2, Rr - 14 - L - 18, 3, tone(c, 1.35))            # sunlit ridge cap
    p.r(L, eave - 3, Rr - L, 5, tone(c, .62)); p.r(L, eave - 3, Rr - L, 1, tone(c, 1.2))  # thick eave edge
    return L, Rr

def flat_roof(p, x0, x1, y, c, depth=12, edge=6, over=4):
    """A flat roof seen from above: the top surface going back (lighter) and the front edge of the slab."""
    L, Rr = x0 - over, x1 + over
    top = [(L, y), (Rr, y), (Rr + SIDE, y - depth), (L + SIDE, y - depth)]
    p.d.polygon([(L - 2, y + edge + 1), (Rr + 2, y + edge + 1), (Rr + SIDE + 2, y + edge - RISE), (Rr + SIDE + 2, y - depth - 2), (L + SIDE - 2, y - depth - 2), (L - 2, y)], fill=INK)
    p.d.polygon(top, fill=tone(c, 1.12))
    for k in range(1, depth, 3): p.r(L + 2 + SIDE * k // depth, y - k, Rr - L - 4, 1, tone(c, 1.0))
    p.r(L, y, Rr - L, edge, tone(c, .82)); p.r(L, y, Rr - L, 1, tone(c, 1.25))
    p.d.polygon([(Rr, y), (Rr + SIDE, y - depth), (Rr + SIDE, y - depth + edge), (Rr, y + edge)], fill=tone(c, .62))
    return L, Rr

def window3d(p, x, y, w, h, frame='#f4f1e8', glass='#6fb8cc', bars=True):
    p.r(x - 1, y - 1, w + 2, h + 2, INK); p.r(x, y, w, h, tone(frame, 1.0))
    gx, gy, gw, gh = x + 3, y + 3, w - 6, h - 6
    for yy in range(gh): p.r(gx, gy + yy, gw, 1, tone(glass, 1.15 - .35 * yy / max(1, gh)))
    p.r(gx, gy, gw, 2, tone(glass, .55)); p.r(gx, gy, 2, gh, tone(glass, .6))      # the recess casts a shadow on the glass
    for k in range(min(gw, gh) // 2): p.px(gx + 4 + k, gy + gh - 3 - k, tone(glass, 1.45))  # a diagonal glint
    if bars: p.r(x + w // 2 - 1, gy, 2, gh, tone(frame, .9))
    p.r(x - 2, y + h + 1, w + 4, 2, tone(frame, 1.15)); p.r(x - 2, y + h + 3, w + 4, 1, tone(frame, .55))  # sill

def door3d(p, cx, bottom, w=24, h=40, wood='#7a4a2a', glass=False, step='#b9b4a8'):
    x = cx - w // 2
    p.r(x - 3, bottom - h - 3, w + 6, h + 3, INK); p.r(x - 1, bottom - h - 1, w + 2, h + 1, tone(wood, .55))
    if glass:
        for yy in range(h - 2): p.r(x + 1, bottom - h + 1 + yy, w - 2, 1, tone('#6fb8cc', 1.15 - .3 * yy / h))
        p.r(cx - 1, bottom - h + 1, 2, h - 2, '#e8ecee'); p.r(x + 1, bottom - h + 1, w - 2, 3, tone('#6fb8cc', .55))
        for k in range(8): p.px(x + 4 + k, bottom - 8 - k * 2, '#e6fbff')
    else:
        for i in range(x + 1, x + w - 1, 4): p.r(i, bottom - h + 1, 3, h - 1, tone(wood, 1.0 if (i // 4) % 2 else .9))
        p.r(x + 1, bottom - h + 1, w - 2, 3, tone(wood, .5)); p.r(cx - 1, bottom - h + 1, 2, h - 1, tone(wood, .45))
        p.r(cx - 5, bottom - h // 2, 3, 3, '#e2b84f'); p.r(cx + 2, bottom - h // 2, 3, 3, '#e2b84f')
    # a stone step in front, its top face lit
    p.r(x - 6, bottom - 5, w + 12, 5, INK); p.r(x - 5, bottom - 4, w + 10, 2, tone(step, 1.15)); p.r(x - 5, bottom - 2, w + 10, 1, tone(step, .8))

def base3d(p, x0, x1, bottom, c='#b7b2a6', h=8):
    p.r(x0 - 2, bottom - h, x1 - x0 + 4, h, INK)
    for i, x in enumerate(range(x0, x1, 11)):
        w = min(10, x1 - x); p.r(x, bottom - h + 1, w, 3, tone(c, 1.15 if i % 2 else 1.05)); p.r(x, bottom - h + 4, w, h - 5, tone(c, .85 if i % 2 else .78))
    p.d.polygon([(x1 + 1, bottom - h), (x1 + SIDE, bottom - h - RISE), (x1 + SIDE, bottom - RISE), (x1 + 1, bottom)], fill=tone(c, .6))

def logs(p, x0, x1, top, bottom, c='#8a5a32'):
    for y in range(top, bottom, 7):
        p.r(x0, y, x1 - x0, 6, tone(c, 1.0 - .12 * (y - top) / max(1, bottom - top))); p.r(x0, y, x1 - x0, 1, tone(c, 1.25)); p.r(x0, y + 6, x1 - x0, 1, tone(c, .55))
        p.r(x0, y + 1, 4, 4, tone(c, 1.35)); p.r(x1 - 4, y + 1, 4, 4, tone(c, 1.2))  # log ends

# ───────────────────────── 울릉도 ─────────────────────────
def ulleung_home():  # 투막집: 억새 지붕 + 통나무 귀틀벽, 처마부터 땅까지 두른 우데기, 가운데 문
    W, H = 176, 168; p = Pic(W, H); x0, x1, cx = 8, 168, 88
    ground_shadow(p, x0, x1, H)
    wall(p, x0 + 2, x1 - 2, 98, H - 4, '#a8865a')                       # 우데기 (board screen)
    for x in range(x0 + 8, x1 - 4, 7): p.r(x, 102, 2, H - 110, tone('#a8865a', .72))
    for x in range(x0 + 11, x1 - 4, 14): p.r(x, 102, 1, H - 110, tone('#a8865a', 1.2))
    # the opening in the screen shows the log wall behind (in shadow)
    p.r(cx - 23, 104, 46, H - 108, INK); logs(p, cx - 21, cx + 21, 106, H - 4, '#7a4e2c')
    p.r(cx - 21, 106, 42, 6, (20, 14, 10, 120)); p.r(cx - 21, 106, 4, H - 110, (20, 14, 10, 90))
    door3d(p, cx, H, w=22, h=40)
    for bx in (20, 140):  # corn-stalk bundles leaning on the screen
        for i in range(5): p.r(bx + i * 3, 122 + (i % 2) * 3, 2, 42, '#e0bc5c' if i % 2 else '#c49a44')
        p.r(bx - 1, 134, 16, 3, '#6b5a3a')
    eave_shadow(p, x0 + 2, x1 - 2, 98, 6)
    straw = '#c9a35a'
    def thatch(p, xl, xr, y, h, i):
        for x in range(xl, xr, 4): p.r(x + (i % 2) * 2, y, 1, h, tone(straw, .82 if x % 8 else 1.25))
    L, Rr = hip_roof(p, x0, x1, 100, 30, straw, rows=10, tex=thatch, overhang=8)
    for k in range(-2, 9):  # vine ropes over the thatch
        for t in range(0, 70):
            for xx, yy in ((L + 20 + k * 20 + t * .6, 32 + t), (Rr - 20 - k * 20 - t * .6, 32 + t)):
                xx = round(xx)
                if 0 <= xx < W and yy < 97 and p.im.getpixel((xx, yy))[3] and p.im.getpixel((xx, yy))[:3] != INK[:3]: p.px(xx, yy, '#5f4e30')
    p.r(L, 98, Rr - L, 4, tone(straw, .55)); p.r(L, 97, Rr - L, 1, tone(straw, 1.3))   # fat thatch edge
    return p

def ulleung_shop():  # 쉼터: 도동항 여객선 터미널처럼 넓은 유리창과 파란 평지붕, 처마 그늘
    W, H = 176, 168; p = Pic(W, H); x0, x1, cx = 8, 168, 88
    ground_shadow(p, x0, x1, H)
    wall(p, x0 + 2, x1 - 2, 66, H - 6, '#e9edef')
    p.r(x0 + 4, 120, x1 - x0 - 8, 3, tone('#e9edef', .8))
    for x in (16, 50, 106, 140): window3d(p, x, 80, 26, 32)
    base3d(p, x0 + 2, x1 - 2, H)
    door3d(p, cx, H, w=30, h=42, glass=True)
    # canopy over the door (a thin slab with its own shadow)
    p.r(cx - 30, 120, 60, 3, (20, 18, 16, 80)); p.r(cx - 32, 114, 64, 6, INK); p.r(cx - 31, 115, 62, 2, '#5a8bc4'); p.r(cx - 31, 117, 62, 2, '#2f5f96')
    p.r(cx - 18, 104, 36, 9, INK); p.r(cx - 17, 105, 34, 7, '#2f6aa3'); p.r(cx - 12, 108, 24, 1, '#e8f4ff'); p.r(cx - 8, 106, 6, 1, '#e8f4ff')
    flat_roof(p, x0, x1, 58, '#3d6fa8', depth=14)
    eave_shadow(p, x0 + 2, x1 - 2, 66, 4)
    p.r(24, 136, 16, 16, INK); p.d.ellipse([25, 137, 39, 151], fill=hexc('#e07a3a')); p.d.ellipse([29, 141, 35, 147], fill=hexc('#e9edef'))  # life ring
    return p

def ulleung_lab():  # 연구소: 하얀 돌 건물(박물관·연구 센터 느낌) + 층진 평지붕 + 접시 안테나
    W, H = 176, 168; p = Pic(W, H); x0, x1, cx = 8, 168, 88
    ground_shadow(p, x0, x1, H)
    wall(p, x0 + 4, x1 - 4, 70, H - 6, '#f1ede2')
    for x in (x0 + 8, x1 - 16):  # pilasters
        p.r(x, 72, 8, H - 80, tone('#f1ede2', .92)); p.r(x, 72, 2, H - 80, tone('#f1ede2', 1.1))
    for x in (22, 132): window3d(p, x, 84, 22, 30)
    for x in (54, 102): window3d(p, x, 84, 20, 30)
    base3d(p, x0 + 4, x1 - 4, H)
    door3d(p, cx, H, w=26, h=40, glass=True)
    p.r(cx - 24, 118, 48, 7, INK); p.r(cx - 23, 119, 46, 5, '#3f7f86'); p.r(cx - 16, 121, 32, 1, '#d9f0ea')
    flat_roof(p, x0, x1, 62, '#cfc8b6', depth=12)
    flat_roof(p, 44, 124, 40, '#e1dccd', depth=10, edge=5, over=2)
    p.r(52, 44, 64, 10, INK); p.r(53, 45, 62, 8, tone('#e8e3d6', 1.0))
    for x in range(58, 112, 14): window3d(p, x, 46, 10, 6, bars=False)
    # dish antenna (bowl opening upward) on a short mast
    p.r(126, 14, 3, 18, INK); p.r(120, 30, 16, 4, INK)
    p.d.pieslice([110, -4, 146, 24], 15, 165, fill=INK); p.d.pieslice([112, -2, 144, 22], 15, 165, fill=hexc('#e6ecef'))
    p.d.pieslice([116, 2, 140, 20], 20, 160, fill=hexc('#c9d3d8')); p.r(127, 0, 2, 9, INK); p.r(126, 0, 4, 3, '#c75b4a')
    return p

def ulleung_gym():  # 수호관: 너와(나무 조각) 지붕에 돌을 얹은 큰 통나무 집 + 깃발
    W, H = 240, 200; p = Pic(W, H); x0, x1, cx = 8, 232, 120
    ground_shadow(p, x0, x1, H, reach=14)
    wall(p, x0 + 6, x1 - 6, 104, H - 6, '#8a5a32'); logs(p, x0 + 8, x1 - 8, 106, H - 8)
    for x in (x0 + 12, x1 - 34):  # 우데기 panels at the sides
        p.r(x, 110, 22, H - 118, INK)
        for i in range(x + 1, x + 21, 4): p.r(i, 111, 3, H - 120, tone('#a8865a', 1.0 if (i // 4) % 2 else .82))
    for x in (64, 150): window3d(p, x, 124, 26, 26, frame='#c8a46a', glass='#3c5a6a')
    base3d(p, x0 + 6, x1 - 6, H, h=7)
    door3d(p, cx, H, w=34, h=54)
    p.r(cx - 32, 130, 64, 11, INK); p.r(cx - 31, 131, 62, 9, '#2f5a8a'); p.r(cx - 22, 135, 44, 2, '#f0d27a')
    eave_shadow(p, x0 + 6, x1 - 6, 104, 6)
    def shingles(p, xl, xr, y, h, i):
        for x in range(xl + (i % 2) * 6, xr, 12): p.r(x, y, 1, h, tone('#7a6a58', .55)); p.r(x + 1, y, 3, 1, tone('#7a6a58', 1.3))
    L, Rr = hip_roof(p, x0, x1, 106, 30, '#7d6c5a', rows=9, tex=shingles, overhang=8)
    for (x, y) in [(56, 48), (104, 40), (156, 46), (196, 70), (80, 76), (132, 68), (40, 88), (178, 92), (120, 92)]:  # stones holding the shingles
        p.r(x - 1, y - 1, 14, 11, INK); p.r(x, y, 12, 9, '#a9a59a'); p.r(x, y, 12, 3, '#d3cfc4'); p.r(x + 9, y + 3, 3, 6, '#7f7b72')
    for fx, col in ((2, '#2f6aa3'), (234, '#c75b4a')):  # flags on poles
        p.r(fx, 30, 3, H - 34, INK); fl = fx + 3 if fx < cx else fx - 26
        p.r(fl - 1, 33, 28, 18, INK); p.r(fl, 34, 26, 16, col); p.r(fl, 34, 26, 4, tone(col, 1.3))
    return p

# ───────────────────────── 독도 ─────────────────────────
def lighthouse(p, x, base, top):  # a white tower: lit on the left, shaded on the right, lantern and red cap
    w0, w1 = 30, 20
    for y in range(top, base):
        t = (y - top) / (base - top); w = round(w1 + (w0 - w1) * t); xl = x - w // 2
        p.r(xl - 1, y, w + 2, 1, INK)
        for k in range(w): p.px(xl + k, y, tone('#f7f6f2', 1.04 - .32 * (k / w) ** 1.6))
    for y in range(top + 20, base - 20, 30): p.r(x - 4, y, 8, 10, INK); p.r(x - 3, y + 1, 6, 8, '#5f9fb0')
    p.r(x - 15, top - 8, 30, 9, INK); p.r(x - 14, top - 7, 28, 3, '#5a606b'); p.r(x - 14, top - 4, 28, 4, '#3a3f4b')   # gallery
    p.r(x - 10, top - 26, 20, 19, INK); p.r(x - 9, top - 25, 18, 17, '#ffe9a0'); p.r(x - 9, top - 25, 6, 17, '#fff6cc'); p.r(x - 1, top - 25, 2, 17, '#c8a24a')
    p.d.polygon([(x - 13, top - 26), (x, top - 38), (x + 13, top - 26)], fill=INK); p.d.polygon([(x - 10, top - 27), (x, top - 35), (x + 10, top - 27)], fill=hexc('#c75b4a'))
    p.r(x - 1, top - 40, 2, 4, INK)

def dokdo_lab():  # 연구소: 하얀 2층 관측소 + 지붕의 태양광 판 + 하얀 등대(동도 등대 느낌)
    W, H = 176, 168; p = Pic(W, H); x0, x1, cx = 8, 168, 88
    ground_shadow(p, x0, x1, H)
    wall(p, x0 + 2, 130, 78, H - 6, '#f4f2ec')
    p.r(x0 + 4, 116, 130 - x0 - 6, 5, '#3f7fb0'); p.r(x0 + 4, 116, 130 - x0 - 6, 1, '#7fb0d8')
    for x in (20, 100): window3d(p, x, 88, 22, 20); window3d(p, x, 128, 22, 22)
    base3d(p, x0 + 2, 130, H)
    door3d(p, cx, H, w=24, h=38, glass=True)
    flat_roof(p, x0, 130, 70, '#d6d2c8', depth=14)
    for i, x in enumerate(range(16, 116, 22)):  # solar panels lying on the roof (seen from above)
        p.d.polygon([(x, 66), (x + 18, 66), (x + 22, 58), (x + 4, 58)], fill=INK); p.d.polygon([(x + 1, 65), (x + 17, 65), (x + 20, 59), (x + 4, 59)], fill=hexc('#34508a'))
        p.r(x + 6, 61, 10, 1, '#7f9fd8')
    lighthouse(p, 150, H - 4, 44)
    p.r(132, H - 8, 40, 8, INK); p.r(133, H - 7, 38, 3, '#c9c4b8'); p.r(133, H - 4, 38, 3, '#9a958a')
    return p

def dokdo_gym():  # 수호관: 경비대 숙소처럼 회백색 2층 콘크리트 + 파란 지붕 + 태극기
    W, H = 240, 200; p = Pic(W, H); x0, x1, cx = 8, 232, 120
    ground_shadow(p, x0, x1, H, reach=14)
    wall(p, x0 + 8, x1 - 8, 80, H - 6, '#ecebe6')
    p.r(x0 + 10, 136, x1 - x0 - 20, 4, tone('#ecebe6', .82)); p.r(x0 + 10, 136, x1 - x0 - 20, 1, tone('#ecebe6', 1.1))
    for x in range(26, 222, 34):
        if abs(x + 12 - cx) > 32: window3d(p, x, 94, 24, 26); window3d(p, x, 150, 24, 28)
    base3d(p, x0 + 8, x1 - 8, H)
    door3d(p, cx, H, w=30, h=44, glass=True)
    p.r(cx - 30, 150, 60, 3, (20, 18, 16, 80)); p.r(cx - 34, 142, 68, 8, INK); p.r(cx - 33, 143, 66, 3, '#6f9ad0'); p.r(cx - 33, 146, 66, 3, '#2f5f96')
    flat_roof(p, x0 + 4, x1 - 4, 72, '#3a6ea8', depth=14)
    p.r(84, 38, 72, 26, INK); p.r(85, 39, 70, 24, '#e1dfd8'); window3d(p, 94, 44, 18, 14); window3d(p, 128, 44, 18, 14)
    flat_roof(p, 84, 156, 32, '#3a6ea8', depth=8, edge=4, over=2)
    p.r(104, 4, 2, 26, INK); p.r(98, 8, 14, 2, INK); p.r(98, 14, 14, 2, INK)            # antenna
    p.r(200, 0, 3, 74, INK); p.r(199, 0, 5, 2, '#e2b84f')                                # flagpole + 태극기
    # v0.67 태극기: 직접 그리지 않고 정확한 원본(art/tileset-v2/taegeukgi_exact_reference.png)을 줄여 넣어요.
    # 건(☰) 왼쪽 위 · 감(☵) 오른쪽 위 · 리(☲) 왼쪽 아래 · 곤(☷) 오른쪽 아래, 가운데 태극(위 빨강·아래 파랑).
    fx, fy, fw, fh = 204, 4, 33, 22
    p.r(fx - 1, fy - 1, fw + 2, fh + 2, INK)
    ref = Image.open(os.path.join(ROOT, 'art', 'tileset-v2', 'taegeukgi_exact_reference.png')).convert('RGB').resize((fw, fh), Image.LANCZOS)
    p.im.paste(ref.convert('RGBA'), (fx, fy))
    return p

def dokdo_shop():  # 쉼터: 서도 주민숙소처럼 바위에 기대어 선 하얀 3층 건물 + 파란 지붕 + 물탱크
    W, H = 176, 168; p = Pic(W, H); x0, x1, cx = 8, 168, 88
    # the rock it leans on (lit from the upper left)
    p.d.polygon([(0, H), (0, 40), (12, 16), (32, 8), (50, 24), (56, H)], fill=INK)
    p.d.polygon([(2, H - 2), (2, 42), (13, 19), (31, 11), (47, 26), (53, H - 2)], fill=hexc('#8f8a80'))
    p.d.polygon([(2, H - 2), (2, 42), (13, 19), (22, 16), (18, H - 2)], fill=hexc('#a8a296'))
    for (x, y, w) in [(8, 60, 18), (20, 92, 22), (6, 122, 16), (24, 140, 20), (14, 40, 12)]: p.r(x, y, w, 2, '#6f6a62'); p.r(x + 2, y - 2, w - 6, 1, '#c2bcb0')
    p.r(10, 70, 9, 6, '#4f8a44'); p.r(11, 69, 5, 2, '#7fbf6a'); p.r(30, 112, 10, 6, '#4f8a44'); p.r(31, 111, 5, 2, '#7fbf6a')
    ground_shadow(p, 40, x1, H)
    wall(p, 40, x1 - 2, 46, H - 6, '#f6f5f0')
    for y in (78, 112): p.r(42, y, x1 - 46, 3, tone('#f6f5f0', .82)); p.r(42, y, x1 - 46, 1, tone('#f6f5f0', 1.08))
    for y in (52, 86):
        for x in (48, 82, 112, 140): window3d(p, x, y, 18, 20)
    for x in (48, 112, 140): window3d(p, x, 122, 18, 20)
    base3d(p, 40, x1 - 2, H)
    door3d(p, cx, H, w=24, h=36)
    p.r(cx - 22, 116, 44, 3, (20, 18, 16, 80)); p.r(cx - 24, 110, 48, 6, INK); p.r(cx - 23, 111, 46, 2, '#5aa0d8'); p.r(cx - 23, 113, 46, 2, '#2f6aa3')
    hip_roof(p, 40, x1 - 2, 48, 22, '#2f78a8', rows=5, overhang=5)
    eave_shadow(p, 40, x1 - 2, 48, 4)
    p.r(128, 2, 24, 18, INK); p.r(129, 3, 22, 16, '#c9d1d6'); p.r(129, 3, 22, 4, '#e6ecef'); p.r(133, 9, 14, 1, '#9aa3a8')  # water tank
    return p

def dokdo_home():  # 집: 바닷가 어업인 집 — 하얀 벽, 청록 지붕, 그물과 주황 부표
    W, H = 176, 168; p = Pic(W, H); x0, x1, cx = 8, 168, 88
    ground_shadow(p, x0, x1, H)
    wall(p, x0 + 6, x1 - 6, 88, H - 6, '#f4f2ec')
    p.r(x0 + 8, 132, x1 - x0 - 16, 3, tone('#f4f2ec', .82))
    for x in (26, 126): window3d(p, x, 98, 26, 24)
    base3d(p, x0 + 6, x1 - 6, H)
    door3d(p, cx, H, w=24, h=40)
    eave_shadow(p, x0 + 6, x1 - 6, 88, 5)
    hip_roof(p, x0 + 6, x1 - 6, 90, 34, '#2e8a8a', rows=6, overhang=8)
    p.r(122, 128, 34, 26, INK)  # fishing net hung on a frame, and buoys
    for i in range(7):
        for j in range(5): p.r(123 + i * 5, 129 + j * 5, 4, 1, '#6a7a82'); p.r(123 + i * 5, 129 + j * 5, 1, 4, '#6a7a82')
    for (x, y) in [(120, 150), (134, 154), (148, 149)]:
        p.d.ellipse([x - 1, y - 1, x + 10, y + 10], fill=INK); p.d.ellipse([x, y, x + 9, y + 9], fill=hexc('#f08a3a')); p.r(x + 2, y + 2, 3, 2, '#ffd0a0')
    p.r(18, 140, 28, 22, INK); p.r(19, 141, 26, 4, '#b8956a'); p.r(19, 145, 26, 16, '#8a6a4a'); p.r(19, 152, 26, 1, '#6b4f36')  # crate
    return p

# ───────────────────────── 식물·담·기록판 ─────────────────────────
def plant_shadow(p, cx=40, base=86, rx=22):
    sh = Image.new('RGBA', p.im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse([cx - rx + 6, base - 6, cx + rx + 10, base + 1], fill=SHADOW); p.im.alpha_composite(sh)

# v0.66 식물 다시 그리기: 잎 덩어리를 여러 개 겹쳐(뒤→앞) 그리고, 덩어리마다 짙은 테두리·몸통·왼쪽 위 빛·반짝이 점을 넣어요.
# 앞 덩어리의 테두리가 뒤 덩어리 위에 겹쳐서, 잎이 층층이 쌓인 입체감이 생겨요.
def _h(*a):
    h = 0
    for v in a: h = (h * 1000003 + int(v) + 7919) & 0xffffffff
    h ^= h >> 13; h = (h * 1274126177) & 0xffffffff; return (h ^ (h >> 16)) / 4294967296

def shade_mask(p, mask, pal, light=(.33, .28), seed=0):
    """mask(흑백 그림)에 칠한 모양을 도트로 음영해요: 바깥 테두리는 짙게, 왼쪽 위는 밝게, 오른쪽 아래는 그늘, 잎 무늬 점을 흩뿌려요."""
    ink, dark, mid, light_c, shine = [hexc(c) for c in pal]
    bb = mask.getbbox()
    if not bb: return
    m = mask.load(); px = p.im.load(); x0, y0, x1, y1 = bb; w, h = max(1, x1 - x0), max(1, y1 - y0)
    inside = lambda x, y: 0 <= x < p.w and 0 <= y < p.h and m[x, y] > 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not inside(x, y): continue
            if not (inside(x - 1, y) and inside(x + 1, y) and inside(x, y - 1) and inside(x, y + 1)): px[x, y] = ink; continue
            u, v = (x - x0) / w, (y - y0) / h
            d = ((u - light[0]) ** 2 + (v - light[1]) ** 2) ** .5
            band = 3 if d < .2 else 2 if d < .44 else 1 if d < .66 else 0
            if not inside(x, y + 3) or not inside(x + 3, y + 1): band = min(band, 0 if not inside(x, y + 2) else 1)    # 아래·오른쪽 가장자리 그늘
            k = _h(x // 2, y, seed)
            if k < .09: band = max(0, band - 1)                                          # 잎 사이 짙은 틈
            elif k > .93 and band >= 1: band = min(3, band + 1)                          # 잎끝 밝은 점
            px[x, y] = (dark, mid, light_c, light_c)[band] if band < 3 else (shine if _h(x, y, seed + 1) < .18 and d < .14 else light_c)

def blob(p, shapes, pal, seed=0, light=(.33, .28)):
    m = Image.new('L', (p.w, p.h), 0); d = ImageDraw.Draw(m)
    for kind, *a in shapes:
        if kind == 'e': d.ellipse(a[0], fill=255)
        else: d.polygon(a[0], fill=255)
    shade_mask(p, m, pal, light, seed)

def leaf_clump(p, cx, cy, rx, ry, pal, seed=0):
    """잎 덩어리: 둥근 몸통 둘레에 작은 혹을 붙여 울퉁불퉁한 테두리를 만들어요."""
    shapes = [('e', [cx - rx, cy - ry, cx + rx, cy + ry])]
    n = max(5, (rx + ry) // 3)
    for i in range(n):
        a = math.pi * 2 * i / n + _h(cx, cy, i) * .5; r = max(3, min(rx, ry) // 3)
        bx, by = cx + math.cos(a) * (rx - r * .6), cy + math.sin(a) * (ry - r * .6)
        shapes.append(('e', [bx - r, by - r, bx + r, by + r]))
    blob(p, shapes, pal, seed=cx * 31 + cy + seed)

def trunk(p, x, top, base, w=8, c='#7a5634'):
    p.r(x - 1, top, w + 2, base - top, INK); p.r(x, top, w, base - top - 1, c)
    p.r(x + 1, top, 2, base - top - 2, tone(c, 1.25)); p.r(x + w - 2, top, 2, base - top - 1, tone(c, .78))
    p.r(x - 3, base - 3, w + 6, 2, INK); p.r(x - 2, base - 4, w + 4, 2, tone(c, .9))  # 뿌리

HUBAK = ('#17321f', '#235236', '#327347', '#54a263', '#b0e3a0')
DONG = ('#142a1d', '#1d4630', '#286040', '#428a59', '#9ed6a0')
PINE = ('#0f342c', '#185444', '#257a5e', '#46a882', '#a8e8c4')
BUSH = ('#1b3b23', '#2c6338', '#3f874a', '#66b464', '#c0eea2')

def tree_hubak():  # 후박나무: 둥근 수관을 잎 덩어리 여러 개로
    p = Pic(80, 88); plant_shadow(p); trunk(p, 36, 52, 87)
    for (x, y, rx, ry) in [(40, 18, 14, 11), (24, 26, 13, 11), (56, 26, 13, 11), (40, 32, 16, 12), (18, 42, 12, 10), (62, 42, 12, 10), (31, 46, 14, 11), (50, 46, 14, 11)]:
        leaf_clump(p, x, y, rx, ry, HUBAK)
    return p

def tree_dongbaek():  # 동백나무: 짙은 잎 덩어리에 빨간 꽃
    p = Pic(80, 88); plant_shadow(p, rx=18); trunk(p, 36, 58, 87, 7, '#6f5236')
    for (x, y, rx, ry) in [(40, 22, 13, 10), (26, 30, 12, 10), (54, 30, 12, 10), (40, 38, 15, 11), (22, 46, 11, 9), (58, 46, 11, 9), (40, 52, 14, 9)]:
        leaf_clump(p, x, y, rx, ry, DONG)
    for (x, y) in [(30, 22), (48, 18), (56, 32), (22, 40), (36, 36), (50, 44), (28, 50), (44, 54), (62, 48)]:  # 동백꽃: 붉은 꽃잎 다섯 점 + 노란 꽃술
        for (dx, dy) in [(1, -1), (-1, 1), (3, 1), (0, 3), (2, 3)]: p.r(x + dx, y + dy, 2, 2, '#d23a44')
        p.r(x + 1, y - 1, 1, 1, '#f07078'); p.r(x - 1, y + 1, 1, 1, '#f07078'); p.r(x + 1, y + 1, 2, 2, '#f2d24a'); p.r(x + 1, y + 4, 2, 1, '#7a1e24')
    return p

def tree_pine():  # 섬잣나무: 울릉도에 자라는 늘푸른 바늘잎나무 — 아래로 둥글게 늘어진 가지가 층층이
    p = Pic(80, 88); plant_shadow(p, rx=17); trunk(p, 37, 64, 87, 6, '#6a4a2e')
    tiers = [(72, 27), (60, 24), (48, 20), (37, 16), (27, 12), (18, 8)]   # (아래 끝 y, 반너비) — 아래층부터
    for n, (by, hw) in enumerate(tiers):
        top = by - 15 if n < len(tiers) - 1 else by - 13
        shapes = [('p', [(40, top), (40 + hw - 2, by - 6), (40 - hw + 2, by - 6)])]
        k = max(3, hw // 5)                                           # 아래 끝: 둥근 가지 끝을 나란히
        for i in range(k + 1):
            bx = 40 - hw + 4 + (2 * hw - 8) * i / k; r = 4 if hw > 10 else 3
            shapes.append(('e', [bx - r, by - 7 - r + 2, bx + r, by - 1]))
        shapes.append(('e', [40 - hw + 2, by - 11, 40 + hw - 2, by - 3]))
        blob(p, shapes, PINE, seed=n * 17, light=(.3, .2))
    return p

def shrub_saecheol():  # 사철나무 덤불: 작은 잎 덩어리를 낮게 겹쳐요
    p = Pic(80, 88); plant_shadow(p, base=88, rx=28)
    for (x, y, rx, ry) in [(40, 58, 13, 9), (24, 64, 12, 9), (56, 64, 12, 9), (16, 74, 10, 8), (64, 74, 10, 8), (32, 74, 13, 9), (48, 75, 13, 9)]:
        leaf_clump(p, x, y, rx, ry, BUSH)
    for (x, y) in [(30, 60), (52, 70), (20, 72)]: p.r(x, y, 2, 2, '#f2e27a')
    return p

def shrub_haeguk():  # 해국 덤불: 보랏빛 꽃이 덮인 낮은 덤불
    p = shrub_saecheol()
    for (x, y) in [(22, 60), (34, 52), (48, 56), (60, 64), (28, 70), (44, 68), (14, 70), (56, 76), (38, 78)]:
        for (dx, dy) in [(0, -2), (-2, 0), (2, 0), (0, 2)]: p.r(x + dx, y + dy, 2, 2, '#b998e6')
        p.r(x + 1, y + 2, 2, 1, '#8a6ac0'); p.r(x, y, 2, 2, '#f2cf4a')
    return p

def wall_stone():  # 울릉도 돌담: 기와 없이 돌을 쌓은 담 (2칸)
    p = Pic(64, 36); p.r(0, 8, 64, 28, INK)
    for row, y in enumerate(range(10, 34, 8)):
        for i, x in enumerate(range(2 - (row % 2) * 6, 62, 12)):
            x0 = max(2, x); w = min(10, 62 - x0)
            if w > 2: p.r(x0, y, w, 6, ['#a9a59a', '#bdb9ad', '#9a958a'][(i + row) % 3]); p.r(x0 + 1, y, w - 2, 1, '#d6d2c6')
    return p

def rail_wood():  # 독도 탐방로 난간: 나무 기둥과 밧줄 (2칸)
    p = Pic(64, 36)
    for x in (4, 30, 56): p.box(x, 8, 6, 28, '#8a5a32'); p.r(x + 2, 10, 1, 24, '#b07a4a')
    for y, c in ((14, '#d9c9a0'), (24, '#c9b88a')):
        for x in range(8, 58): p.r(x, y + int(2 * math.sin((x - 8) / 26 * math.pi)), 1, 2, c)
    return p

def record_board():  # 탐험 기록판: 기와 없는 나무 게시판
    p = Pic(48, 54)
    p.box(8, 34, 4, 20, '#6b4325'); p.box(36, 34, 4, 20, '#6b4325')
    p.box(2, 6, 44, 32, '#8a5a35'); p.r(5, 9, 38, 26, '#e8d6ae')
    p.r(7, 12, 14, 9, '#fbf8ee'); p.r(24, 11, 16, 12, '#fff1c4'); p.r(9, 24, 12, 8, '#e8f4f0'); p.r(26, 26, 12, 6, '#fbf8ee')
    p.r(12, 11, 3, 3, '#c75b4a'); p.r(31, 10, 3, 3, '#3f7f86')
    p.poly([(0, 8), (8, 0), (40, 0), (48, 8)], '#7a4a28', INK)
    return p

# ───────────────────────── v0.74 실사 참고(art/실사-참고표.md) ─────────────────────────
def glass_band(p, x0, x1, y0, y1, glass='#6f9fb8', mull='#d8dde0', step=14):
    p.r(x0, y0, x1 - x0, y1 - y0, INK)
    for yy in range(y0 + 2, y1 - 2): p.r(x0 + 2, yy, x1 - x0 - 4, 1, tone(glass, 1.15 - .4 * (yy - y0) / max(1, y1 - y0)))
    for i in range(x0 + 2, x1 - 2, step): p.r(i, y0 + 2, 2, y1 - y0 - 4, mull)
    for k in range(0, x1 - x0 - 30, 46):  # sky reflections running diagonally
        for j in range(min(12, y1 - y0 - 6)): p.px(x0 + 10 + k + j, y1 - 4 - j, tone(glass, 1.6))

def ulleung_terminal():  # 도동항 여객선터미널(U01·U02): 바다 쪽 유리벽 2층, 기둥 위로 들린 아래층, 지붕 전망 데크, 둥근 탑
    W, H = 240, 190; p = Pic(W, H); x0, x1, cx = 8, 232, 120
    ground_shadow(p, x0, x1, H, reach=14)
    wall(p, x0 + 2, x1 - 2, 74, H - 4, '#e3e6e8')
    glass_band(p, x0 + 8, x1 - 8, 82, 122)                                     # 위층 유리벽
    p.r(x0 + 4, 122, x1 - x0 - 8, 9, INK); p.r(x0 + 5, 123, x1 - x0 - 10, 7, '#eceef0'); p.r(x0 + 5, 129, x1 - x0 - 10, 1, '#a9adb1')   # 층 사이 띠
    p.r(x0 + 6, 131, x1 - x0 - 12, H - 6 - 131, '#3b424a')                    # 아래층: 기둥 사이 그늘
    for i in range(x0 + 10, x1 - 12, 30): p.r(i, 131, 9, H - 6 - 131, '#d6d9dc'); p.r(i, 131, 2, H - 6 - 131, '#f3f5f6'); p.r(i + 7, 131, 2, H - 6 - 131, '#9ea3a8')
    for x in (34, 186): glass_band(p, x, x + 22, 140, H - 10, step=11)
    door3d(p, cx, H, w=34, h=42, glass=True)
    p.r(cx - 30, 136, 60, 9, INK); p.r(cx - 29, 137, 58, 7, '#2f6aa3'); p.r(cx - 20, 140, 40, 1, '#e8f4ff')   # 파란 안내판(글자 없이)
    flat_roof(p, x0, x1, 66, '#a7aeb3', depth=12)
    for i in range(x0 + 2, x1 + 6, 6): p.r(i + (i - x0) * 0 , 46, 1, 10, '#6c7178')        # 전망 데크 난간
    p.r(x0 + 2, 45, x1 - x0 + 4, 2, '#6c7178'); p.r(x0 + 2, 50, x1 - x0 + 4, 1, '#9aa0a6')
    # 둥근 탑(왼쪽): 원통 + 유리 띠 + 지붕 + 철골 기둥
    tx, tw = 46, 30
    for y in range(12, 70):
        xl = tx - tw // 2; p.r(xl - 1, y, tw + 2, 1, INK)
        for k in range(tw): p.px(xl + k, y, tone('#eef0f1', 1.05 - .38 * (k / tw) ** 1.4))
    for y in range(30, 46): p.r(tx - tw // 2 + 2, y, tw - 4, 1, tone('#6f9fb8', 1.1 - .3 * (y - 30) / 16))
    for k in (-8, 0, 8): p.r(tx + k, 30, 1, 16, '#d8dde0')
    p.d.ellipse([tx - tw // 2 - 2, 6, tx + tw // 2 + 2, 18], fill=INK); p.d.ellipse([tx - tw // 2, 7, tx + tw // 2, 16], fill=hexc('#c9ced2'))
    p.r(tx + 10, 0, 2, 10, INK); p.r(tx + 6, 2, 10, 1, INK)
    # 오른쪽 끝 둥근 전망부(바다 쪽으로 내민 반원 데크)
    p.d.pieslice([x1 - 46, 52, x1 + 6, 84], 180, 360, fill=INK); p.d.pieslice([x1 - 44, 54, x1 + 4, 82], 180, 360, fill=hexc('#d9dee1'))
    for i in range(x1 - 40, x1 + 2, 5): p.r(i, 56 + abs(i - (x1 - 20)) // 4, 1, 10, '#6c7178')
    return p

def ulleung_house(roof, wallc, floors, shop=False, stripe=None, W=112, sign=None):  # 도동 시가지(U08·U03·U06): 골짜기에 촘촘한 2~5층 콘크리트 건물, 색칠한 평지붕
    top = 42; H = top + floors * 32 + 10; p = Pic(W, H); x0, x1, cx = 8, W - 8, W // 2
    ground_shadow(p, x0, x1, H)
    wall(p, x0 + 2, x1 - 2, top, H - 4, wallc)
    for f in range(floors):
        y = top + 8 + f * 32
        if f == floors - 1 and shop: break
        for x in range(16, W - 30, 28 if W > 112 else 29): window3d(p, x, y, 20, 18, bars=False)
        if f: p.r(x0 + 4, y - 7, x1 - x0 - 8, 2, tone(wallc, .82))
    if stripe: p.r(x0 + 4, top + 2, x1 - x0 - 8, 4, stripe)
    if shop:  # 1층 가게: 넓은 유리 + 차양
        y = H - 34; p.r(x0 + 8, y, x1 - x0 - 16, 26, INK)
        for yy in range(y + 2, y + 24): p.r(x0 + 10, yy, x1 - x0 - 20, 1, tone('#6fb8cc', 1.1 - .3 * (yy - y) / 24))
        p.r(x0 + 4, y - 6, x1 - x0 - 8, 6, INK); p.r(x0 + 5, y - 5, x1 - x0 - 10, 2, tone(roof, 1.25)); p.r(x0 + 5, y - 3, x1 - x0 - 10, 2, tone(roof, .9))
    else: door3d(p, cx, H, w=18, h=28)
    flat_roof(p, x0, x1, top - 8, roof, depth=14)
    eave_shadow(p, x0 + 2, x1 - 2, top, 4)
    p.r(W - 32, top - 26, 14, 12, INK); p.r(W - 31, top - 25, 12, 10, '#d7dde0'); p.r(W - 31, top - 25, 12, 3, '#eef2f4')   # 물탱크
    if sign: p.r(x0 + 10, top + 4, 14, floors * 32 - 40, INK); p.r(x0 + 11, top + 5, 12, floors * 32 - 42, sign); p.r(x0 + 13, top + 9, 8, floors * 32 - 50, tone(sign, 1.4))  # 세로 간판(글자 없이)
    return p

def tetrapods():  # 소파블록(U01·U02·U05): 다리 넷 달린 회색 콘크리트 덩어리를 쌓은 더미
    p = Pic(40, 40)
    def one(cx, cy, s):
        legs = [(0, -10), (-9, 5), (9, 5), (2, 9)]
        for dx, dy in legs: p.d.line([(cx, cy), (cx + dx * s, cy + dy * s)], fill=INK, width=round(8 * s) + 2)
        for i, (dx, dy) in enumerate(legs): p.d.line([(cx, cy), (cx + dx * s, cy + dy * s)], fill=hexc(['#d3d0c7', '#b9b6ad', '#a19e96', '#c6c3ba'][i]), width=round(8 * s))
        for dx, dy in legs[:3]: ex, ey = cx + dx * s, cy + dy * s; p.d.ellipse([ex - 3 * s, ey - 2 * s, ex + 3 * s, ey + 2 * s], fill=hexc('#e6e3da'))
        p.r(round(cx - 2), round(cy - 2), 4, 3, '#ebe8df')
    one(12, 26, .9); one(29, 27, .9); one(20, 16, 1.0)
    return p

def rail_steel():  # 해안산책로·보행교 쇠 난간(H03·H04·U06): 은색 기둥과 두 줄 난간 (2칸)
    p = Pic(64, 36)
    for x in (2, 30, 58):
        p.r(x - 1, 8, 6, 28, INK); p.r(x, 9, 4, 26, '#c3c9ce'); p.r(x, 9, 1, 26, '#eef2f4'); p.r(x + 3, 9, 1, 26, '#8b939a'); p.r(x - 1, 7, 6, 3, '#e3c25a')
    for y in (12, 22):
        p.r(0, y - 1, 64, 4, INK); p.r(0, y, 64, 2, '#b2b9bf'); p.r(0, y, 64, 1, '#e6ebee')
    return p

def rail_steel_v():  # 같은 난간이 위아래로 이어질 때(위에서 본 모습): 칸 가운데 기둥 + 위로 이어진 손잡이 줄
    p = Pic(32, 44)
    p.r(14, 0, 4, 40, INK); p.r(15, 0, 2, 40, '#c3c9ce'); p.r(15, 0, 1, 40, '#eef2f4')
    p.r(12, 14, 8, 26, INK); p.r(13, 15, 6, 24, '#c3c9ce'); p.r(13, 15, 2, 24, '#eef2f4'); p.r(12, 13, 8, 3, '#e3c25a')
    return p

def dome_lighthouse(p, x, base, top):  # 독도 등대(D30): 흰 원통 + 난간 두른 전망대 + 유리 등실 + 흰 돔과 공 모양 꼭지
    w = 26
    for y in range(top, base):
        xl = x - w // 2; p.r(xl - 1, y, w + 2, 1, INK)
        for k in range(w): p.px(xl + k, y, tone('#f7f6f2', 1.04 - .3 * (k / w) ** 1.6))
    for y in range(top + 16, base - 16, 24): p.r(x - 3, y, 6, 8, INK); p.r(x - 2, y + 1, 4, 6, '#5f9fb0')
    p.r(x - 19, top - 4, 38, 6, INK); p.r(x - 18, top - 3, 36, 3, '#eceae3'); p.r(x - 18, top, 36, 1, '#9a978e')          # 전망대 바닥
    for i in range(x - 18, x + 19, 4): p.r(i, top - 12, 1, 8, '#4f545a')                                                   # 난간 기둥
    p.r(x - 18, top - 13, 37, 1, '#4f545a'); p.r(x - 18, top - 9, 37, 1, '#8a8e94')
    p.r(x - 11, top - 25, 22, 21, INK)
    for yy in range(top - 24, top - 5): p.r(x - 10, yy, 20, 1, tone('#86b9cc', 1.12 - .32 * (yy - top + 24) / 19))
    for i in (x - 5, x, x + 5): p.r(i, top - 24, 1, 19, '#e8ecee')
    p.d.pieslice([x - 13, top - 38, x + 13, top - 12], 180, 360, fill=INK)
    p.d.pieslice([x - 11, top - 36, x + 11, top - 14], 180, 360, fill=hexc('#f4f3ee')); p.d.pieslice([x - 11, top - 36, x + 11, top - 14], 290, 360, fill=hexc('#d6d4cc'))
    p.d.ellipse([x - 4, top - 44, x + 4, top - 36], fill=INK); p.d.ellipse([x - 3, top - 43, x + 3, top - 37], fill=hexc('#f4f3ee'))

def lattice_mast(p, x, base, top, w=12):  # 쇠 격자 안테나 탑(D30·D40)
    for y in range(top, base, 2):
        t = (y - top) / max(1, base - top); half = round(w / 2 * (.5 + .5 * t))
        p.px(x - half, y, '#5a6068'); p.px(x + half, y, '#5a6068')
    for y in range(top, base - 6, 8):
        t = (y - top) / max(1, base - top); half = round(w / 2 * (.5 + .5 * t))
        p.d.line([(x - half, y), (x + half, y + 8)], fill=hexc('#7a8088')); p.d.line([(x + half, y), (x - half, y + 8)], fill=hexc('#7a8088'))
    p.r(x - 1, top - 10, 2, 10, '#5a6068'); p.r(x - 5, top - 6, 10, 1, '#5a6068')

def solar_field(p, x0, x1, y):  # 바닥에 기울여 놓은 태양광 판(D30)
    for x in range(x0, x1 - 18, 22):
        p.d.polygon([(x, y), (x + 20, y), (x + 23, y - 9), (x + 3, y - 9)], fill=INK)
        p.d.polygon([(x + 1, y - 1), (x + 19, y - 1), (x + 22, y - 8), (x + 4, y - 8)], fill=hexc('#2f4f8f'))
        for k in (6, 12): p.r(x + 2 + k, y - 8, 1, 7, '#6c88c8')
        p.r(x + 4, y - 5, 16, 1, '#6c88c8'); p.r(x + 4, y + 1, 2, 4, '#55595f'); p.r(x + 16, y + 1, 2, 4, '#55595f')

def dokdo_east_lab():  # 동도 연구소: 하얀 2층 관측소 + 돔 지붕 독도 등대 + 격자 안테나 + 태양광 판 (D30·D40)
    W, H = 176, 176; p = Pic(W, H); x0, x1, cx = 8, 168, 88
    ground_shadow(p, x0, x1, H)
    wall(p, x0 + 2, 124, 92, H - 6, '#f4f2ec')
    p.r(x0 + 4, 128, 124 - x0 - 6, 4, '#3f7fb0')
    for x in (18, 94): window3d(p, x, 100, 20, 18); window3d(p, x, 140, 20, 20)
    base3d(p, x0 + 2, 124, H)
    door3d(p, cx - 18, H, w=22, h=36, glass=True)
    flat_roof(p, x0, 124, 84, '#d6d2c8', depth=12)
    solar_field(p, 14, 116, 82)
    lattice_mast(p, 30, 72, 22, w=10)
    dome_lighthouse(p, 148, H - 4, 58)
    p.r(128, H - 8, 44, 8, INK); p.r(129, H - 7, 42, 3, '#c9c4b8'); p.r(129, H - 4, 42, 3, '#9a958a')
    return p

def dokdo_east_gym():  # 동도 수호관: 독도경비대 건물처럼 짙은 회색 돌판 벽 3층 + 파란 띠 + 철골 구조물 (D37·D40, 글자는 넣지 않아요)
    W, H = 240, 204; p = Pic(W, H); x0, x1, cx = 8, 232, 120
    ground_shadow(p, x0, x1, H, reach=14)
    stone = '#76746f'
    wall(p, x0 + 8, x1 - 8, 76, H - 6, stone)
    for y in range(80, H - 10, 14): p.r(x0 + 10, y, x1 - x0 - 20, 1, tone(stone, .8))       # 돌판 줄눈
    for i, y in enumerate(range(80, H - 10, 14)):
        for x in range(x0 + 10 + (i % 2) * 18, x1 - 10, 36): p.r(x, y, 1, 14, tone(stone, .82)); p.r(x + 1, y + 1, 16, 1, tone(stone, 1.08))
    p.r(x0 + 30, 86, 150, 14, INK); p.r(x0 + 31, 87, 148, 12, '#f1f2f4')                      # 간판 바탕(글자 대신 파란 무늬)
    for x in range(x0 + 36, x0 + 176, 9): p.r(x, 89, 6, 8, '#2346a8')
    for x in range(26, 222, 22):
        if abs(x + 6 - cx) > 22: window3d(p, x, 110, 12, 30, frame='#eef0f2', glass='#7aa6c0', bars=False); window3d(p, x, 156, 12, 30, frame='#eef0f2', glass='#7aa6c0', bars=False)
    base3d(p, x0 + 8, x1 - 8, H, c='#9a978f')
    door3d(p, cx, H, w=28, h=42, glass=True)
    flat_roof(p, x0 + 4, x1 - 4, 68, '#8c8a85', depth=12)
    for i in range(x0 + 6, x1 + 2, 6): p.r(i, 50, 1, 10, '#9a9fa6')                           # 옥상 난간
    p.r(x0 + 6, 49, x1 - x0 - 2, 2, '#9a9fa6')
    lattice_mast(p, 206, 48, 8, w=10); lattice_mast(p, 40, 48, 18, w=8)
    return p

def dokdo_east_shop():  # 동도 쉼터: 실물 대응 없는 창작 — 낮은 흰 단층 건물 + 회색 평지붕 + 태양광 판(서도 숙소와 다르게)
    W, H = 176, 168; p = Pic(W, H); x0, x1, cx = 8, 168, 88
    ground_shadow(p, x0, x1, H)
    wall(p, x0 + 6, x1 - 6, 96, H - 6, '#f2f1ec')
    p.r(x0 + 8, 100, x1 - x0 - 16, 4, '#4a8ac0')
    for x in (22, 124): window3d(p, x, 110, 28, 24)
    base3d(p, x0 + 6, x1 - 6, H)
    door3d(p, cx, H, w=26, h=40, glass=True)
    flat_roof(p, x0 + 2, x1 - 2, 88, '#b8b6ae', depth=14)
    solar_field(p, 26, 150, 86)
    return p

def dokdo_west_shop():  # 서도 쉼터: 주민숙소(D50·D51)처럼 큰 절벽 아래 짙은 회색 벽돌 3층 + 파란 지붕 + 흰 바닥 벽 + 태양광 판
    W, H = 176, 176; p = Pic(W, H); x0, x1, cx = 8, 168, 88
    p.d.polygon([(0, H), (0, 30), (14, 8), (34, 0), (52, 16), (58, H)], fill=INK)              # 기대어 선 절벽
    p.d.polygon([(2, H - 2), (2, 32), (15, 11), (33, 3), (49, 18), (55, H - 2)], fill=hexc('#7d746c'))
    p.d.polygon([(2, H - 2), (2, 34), (15, 13), (24, 9), (20, H - 2)], fill=hexc('#958c82'))
    for (x, y, w) in [(8, 50, 18), (20, 84, 22), (6, 118, 16), (14, 34, 12)]: p.r(x, y, w, 2, '#5f5850'); p.r(x + 2, y - 2, w - 6, 1, '#b9b0a4')
    ground_shadow(p, 44, x1, H)
    brick = '#4b4d53'
    wall(p, 44, x1 - 2, 54, H - 30, brick)
    for i, y in enumerate(range(58, H - 34, 5)):
        for x in range(46 + (i % 2) * 6, x1 - 4, 12): p.r(x, y, 1, 5, tone(brick, .78))
        p.r(46, y, x1 - 50, 1, tone(brick, .8))
    for y in (62, 94):
        for x in (52, 84, 116, 144): window3d(p, x, y, 16, 18, frame='#e8ecee', glass='#5fa8b0', bars=False)
    p.r(52, 62, 16, 52, INK); p.r(53, 63, 14, 50, '#3fa0b8'); p.r(53, 63, 4, 50, '#7fd0e0')            # 청록 계단실 창
    p.r(40, H - 30, x1 - 38, 26, INK); p.r(41, H - 29, x1 - 40, 24, '#ecebe6')                          # 흰 바닥 벽(방파벽)
    for x in (58, 92, 118, 150): p.r(x, H - 28, 2, 12 + x % 7, '#b5784a')                               # 녹물 자국
    door3d(p, cx + 14, H - 4, w=20, h=24)
    hip_roof(p, 44, x1 - 2, 56, 30, '#5a8fc8', rows=4, overhang=4)
    hip_roof(p, 60, 130, 32, 14, '#5a8fc8', rows=3, overhang=3)
    p.d.polygon([(70, 30), (100, 30), (104, 22), (74, 22)], fill=INK); p.d.polygon([(71, 29), (99, 29), (102, 23), (75, 23)], fill=hexc('#2f4f8f'))   # 태양광 판
    for fx in (138, 150): p.r(fx, 0, 2, 30, INK)
    return p

def dokdo_west_lab():  # 서도 연구소: 등대 없는(서도에는 등대가 없어요) 하얀 관측소 + 태양광 판 + 격자 기상 안테나 (창작)
    W, H = 176, 168; p = Pic(W, H); x0, x1, cx = 8, 168, 88
    ground_shadow(p, x0, x1, H)
    wall(p, x0 + 2, x1 - 2, 78, H - 6, '#f4f2ec')
    p.r(x0 + 4, 116, x1 - x0 - 8, 5, '#3f7fb0'); p.r(x0 + 4, 116, x1 - x0 - 8, 1, '#7fb0d8')
    for x in (20, 126): window3d(p, x, 88, 22, 20); window3d(p, x, 128, 22, 22)
    window3d(p, 62, 88, 22, 20); window3d(p, 96, 88, 22, 20)
    base3d(p, x0 + 2, x1 - 2, H)
    door3d(p, cx, H, w=24, h=38, glass=True)
    flat_roof(p, x0, x1, 70, '#d6d2c8', depth=14)
    solar_field(p, 16, 120, 66)
    lattice_mast(p, 146, 62, 8, w=12)
    return p

def ferry():  # 여객선(U01·D41·D42), 위에서 본 모습: 뱃머리가 아래(바다 쪽). 흰 쌍동선 + 파란 창 띠 + 위층 갑판
    W, H = 92, 208; p = Pic(W, H); cx = 46
    hull = [(8, 10), (84, 10), (86, 150), (74, 186), (cx, 204), (18, 186), (6, 150)]
    p.poly([(x, y) for x, y in hull], '#f4f5f6', INK)
    p.poly([(10, 12), (20, 12), (18, 186), (cx, 202), (14, 184), (8, 150)], '#d9dde0')         # 왼쪽 그늘(빛은 왼쪽 위)
    p.r(8, 10, 76, 6, '#c2453a'); p.r(8, 16, 76, 2, INK)                                          # 고물 빨간 띠
    p.r(14, 22, 64, 128, INK); p.r(16, 24, 60, 124, '#e9ecee')                                   # 객실 지붕
    for y in range(30, 146, 10): p.r(16, y, 4, 6, '#2f5f96'); p.r(72, y, 4, 6, '#2f5f96')         # 옆 창
    p.r(24, 40, 44, 70, INK); p.r(26, 42, 40, 66, '#f7f8f9'); p.r(26, 42, 40, 3, '#ffffff')      # 위층 갑판
    p.r(30, 112, 32, 22, INK); p.r(32, 114, 28, 18, '#3b6e9e'); p.r(32, 114, 28, 4, '#7fb0d8')   # 조타실 창
    for x in (34, 52): p.r(x, 52, 6, 10, '#c9ced2'); p.r(x, 52, 6, 2, '#9aa0a6')                   # 환기구
    p.r(40, 70, 12, 12, '#c2453a'); p.r(42, 72, 8, 8, '#f4f5f6')                                   # 표시
    p.r(18, 150, 56, 3, '#b8bec3'); p.r(cx - 1, 160, 2, 30, '#b8bec3')
    return p

ART = {
    'ferry': ferry,
    'ulleung-home': ulleung_home, 'ulleung-shop': ulleung_shop, 'ulleung-lab': ulleung_lab, 'ulleung-gym': ulleung_gym,
    'dokdo-lab': dokdo_lab, 'dokdo-gym': dokdo_gym, 'dokdo-shop': dokdo_shop, 'dokdo-home': dokdo_home,
    'tree-hubak': tree_hubak, 'tree-dongbaek': tree_dongbaek, 'tree-pine': tree_pine, 'shrub-saecheol': shrub_saecheol, 'shrub-haeguk': shrub_haeguk,
    'wall-stone': wall_stone, 'rail-wood': rail_wood, 'record-board': record_board,
    # v0.74
    'ulleung-terminal': ulleung_terminal,
    'ulleung-house1': lambda: ulleung_house('#3f8f5a', '#efe9dc', 3, shop=True),
    'ulleung-house2': lambda: ulleung_house('#3d6fa8', '#e8e4d8', 2),
    'ulleung-house3': lambda: ulleung_house('#b0563f', '#f2efe6', 3, stripe='#d8c39a'),
    'ulleung-house4': lambda: ulleung_house('#4a9a8a', '#dcd6c8', 2, shop=True),
    'ulleung-block1': lambda: ulleung_house('#2f6aa3', '#f1f2f0', 5, shop=True, W=176, sign='#c2453a'),
    'ulleung-block2': lambda: ulleung_house('#7a8a5a', '#e6ddcc', 4, shop=True, W=176, sign='#2f8a7a', stripe='#c9b28a'),
    'ulleung-block3': lambda: ulleung_house('#9a4a3a', '#eef0f2', 4, W=176, sign='#e0a030'),
    'tetrapods': tetrapods, 'rail-steel': rail_steel, 'rail-steel-v': rail_steel_v,
    'dokdo-east-lab': dokdo_east_lab, 'dokdo-east-gym': dokdo_east_gym, 'dokdo-east-shop': dokdo_east_shop,
    'dokdo-west-lab': dokdo_west_lab, 'dokdo-west-shop': dokdo_west_shop
}

def main():
    pics = {k: f() for k, f in ART.items()}
    # simple shelf packing
    W, x, y, rowh, frames = 1024, 0, 0, 0, {}
    for k, p in pics.items():
        if x + p.w > W: x, y, rowh = 0, y + rowh + 2, 0
        frames[k] = [x, y, p.w, p.h]; x += p.w + 2; rowh = max(rowh, p.h)
    sheet = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for k, p in pics.items(): sheet.alpha_composite(p.im, tuple(frames[k][:2]))
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True); sheet.save(OUT_PNG, optimize=True)
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('// 울릉도·독도 건물과 식물 (scripts/draw-island-art.py가 만든 그림의 자리). 1픽셀 = 게임 1픽셀.\n')
        f.write('export const ISLAND_ATLAS=' + json.dumps({'key': 'scenery/island-art-v67', 'width': W, 'height': y + rowh, 'frames': frames}, ensure_ascii=False) + ';\n')
    print('saved', OUT_PNG, len(frames), 'pictures')

if __name__ == '__main__':
    main()
