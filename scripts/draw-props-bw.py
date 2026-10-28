"""지도 위 소품 도트 그림 (v0.39, 포켓몬스터 블랙/화이트 느낌)

    python scripts/draw-props-bw.py

  dist/assets/scenery/props-bw-v39.png   소품 모음
  dist/props-atlas.js                    소품마다 자리

1도트 = 게임 1픽셀. 진한 외곽선 1도트, 색은 밝은·보통·어두운 세 단계, 빛은 왼쪽 위에서 와요.
그림의 아래 가운데가 소품이 서는 자리예요(props.js가 그 점을 칸의 발 위치에 맞춰 그려요).
"""
import json, os, math, random
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PNG = os.path.join(ROOT, 'dist', 'assets', 'scenery', 'props-bw-v39.png')
OUT_JS = os.path.join(ROOT, 'dist', 'props-atlas.js')
INK = '#2b2622'

def hexc(s, a=255):
    s = s.lstrip('#'); return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)
class P:
    def __init__(s, w, h): s.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); s.d = ImageDraw.Draw(s.im); s.w, s.h = w, h; s.px = s.im.load()
    def r(s, x, y, w, h, c):
        if w > 0 and h > 0: s.d.rectangle([x, y, x + w - 1, y + h - 1], fill=hexc(c) if isinstance(c, str) else c)
    def p(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[x, y] = hexc(c) if isinstance(c, str) else c
    def ell(s, x0, y0, x1, y1, c): s.d.ellipse([x0, y0, x1, y1], fill=hexc(c) if isinstance(c, str) else c)
    def poly(s, pts, c): s.d.polygon(pts, fill=hexc(c) if isinstance(c, str) else c)
    def outline(s, c=INK):
        """Add a 1-dot dark outline around everything drawn so far."""
        src = s.im.copy(); sp = src.load()
        for y in range(s.h):
            for x in range(s.w):
                if sp[x, y][3] == 0 and any(0 <= x + dx < s.w and 0 <= y + dy < s.h and sp[x + dx, y + dy][3] > 0 and sp[x + dx, y + dy] != hexc(SHADOW, 70) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    s.px[x, y] = hexc(c)
    def shadow(s, cx, by, w):
        s.ell(cx - w // 2, by - 3, cx + w // 2, by + 1, hexc(SHADOW, 70))
SHADOW = '#1d3a2a'

def sign():
    p = P(28, 30)
    p.r(12, 14, 4, 14, '#7a5236'); p.r(12, 14, 1, 14, '#9a6a46'); p.r(15, 14, 1, 14, '#5a3a24')
    p.r(2, 3, 24, 13, '#b98654'); p.r(3, 4, 22, 11, '#d9a868'); p.r(3, 4, 22, 1, '#efc386'); p.r(3, 14, 22, 1, '#a7743f')
    for y in (7, 10): p.r(6, y, 16, 1, '#8f5f34')
    p.outline(); p.shadow(14, 29, 14)
    return p

def box(open_=False):
    p = P(28, 24)
    y0 = 8
    p.r(2, y0 + 4, 24, 11, '#3f7fb0'); p.r(3, y0 + 5, 22, 9, '#5aa0d0'); p.r(3, y0 + 5, 22, 1, '#8cc8ec'); p.r(3, y0 + 13, 22, 1, '#2f6690')
    p.r(2, y0 + 8, 24, 2, '#e8c45a'); p.r(12, y0 + 6, 4, 6, '#e8c45a'); p.r(13, y0 + 7, 2, 3, '#a87d22')
    if open_:
        p.poly([(2, y0 + 4), (26, y0 + 4), (24, y0 - 6), (4, y0 - 6)], '#4f93c6'); p.r(5, y0 - 5, 18, 2, '#8cc8ec')
        p.r(4, y0 + 2, 20, 2, '#1e3d55')
    else:
        p.r(2, y0, 24, 5, '#4f93c6'); p.r(3, y0 + 1, 22, 1, '#8cc8ec'); p.r(2, y0 + 4, 24, 1, '#2f6690')
    p.outline(); p.shadow(14, 23, 26)
    return p

def trash():
    p = P(28, 16)
    p.r(3, 8, 10, 4, '#9fd6e6'); p.r(3, 8, 10, 1, '#e6f8fc'); p.r(13, 9, 2, 2, '#2f8fa8'); p.r(4, 10, 8, 1, '#6fb6cc')   # bottle
    p.poly([(14, 13), (17, 5), (24, 6), (26, 13)], '#e9eef0'); p.r(17, 7, 5, 1, '#ffffff'); p.r(19, 9, 4, 3, '#c9d2d6'); p.r(22, 4, 2, 2, '#e9eef0')  # bag
    p.outline(); p.shadow(14, 15, 24)
    return p

def observe():
    p = P(28, 32)
    for (x0, x1) in ((14, 6), (14, 22), (14, 14)):
        p.d.line([(x0, 18), (x1, 30)], fill=hexc('#5a6272'), width=2)
    p.r(13, 15, 3, 4, '#3d4452')
    p.poly([(6, 12), (20, 6), (23, 11), (9, 17)], '#d9dee6'); p.poly([(7, 12), (19, 7), (20, 9), (8, 14)], '#ffffff')
    p.poly([(19, 5), (24, 3), (26, 9), (22, 11)], '#3d4452'); p.r(23, 5, 2, 3, '#7fe3ea')
    p.outline(); p.shadow(14, 31, 20)
    return p

def stone():
    p = P(24, 30)
    p.poly([(5, 28), (4, 9), (8, 3), (16, 2), (20, 7), (20, 28)], '#8d9aa6'); p.poly([(6, 27), (6, 10), (9, 5), (12, 4), (12, 27)], '#aebbc6')
    p.r(15, 6, 4, 22, '#6f7c88')
    p.r(9, 11, 6, 1, '#7fe3ea'); p.r(11, 9, 2, 6, '#7fe3ea'); p.r(9, 17, 6, 1, '#5fc3cc'); p.r(10, 20, 4, 1, '#5fc3cc')   # glowing marks
    p.r(3, 27, 19, 2, '#6f7c88')
    p.outline(); p.shadow(12, 29, 22)
    return p

def rock():
    p = P(28, 20)
    p.ell(2, 4, 25, 18, '#8e8a86'); p.ell(4, 4, 18, 13, '#b0aca6'); p.ell(6, 5, 12, 9, '#d0ccc4'); p.ell(15, 10, 25, 18, '#6e6a66')
    p.r(10, 13, 6, 1, '#6e6a66')
    p.outline(); p.shadow(14, 19, 26)
    return p

def pillar():
    p = P(36, 48)
    p.poly([(9, 46), (11, 20), (14, 8), (19, 3), (23, 9), (26, 22), (28, 46)], '#9b7d65')
    p.poly([(11, 45), (13, 21), (15, 10), (18, 6), (19, 45)], '#b89a7c'); p.poly([(22, 10), (25, 23), (27, 45), (23, 45)], '#6c5547')
    for y in (16, 27, 37): p.r(12, y, 14, 1, '#7e644f')
    p.r(15, 8, 4, 2, '#8fd16a'); p.r(17, 6, 2, 1, '#8fd16a')
    p.outline(); p.shadow(18, 47, 26)
    return p

def arch():
    p = P(72, 48)
    p.poly([(4, 46), (8, 20), (18, 8), (36, 4), (54, 8), (64, 20), (68, 46), (52, 46), (50, 30), (44, 22), (36, 20), (28, 22), (22, 30), (20, 46)], '#9b7d65')
    p.poly([(6, 45), (10, 21), (19, 10), (34, 6), (36, 12), (24, 18), (16, 30), (16, 45)], '#b89a7c')
    p.poly([(56, 12), (63, 22), (66, 45), (56, 45), (54, 30)], '#6c5547')
    for y in (18, 30, 40): p.r(8, y, 10, 1, '#7e644f'); p.r(54, y, 10, 1, '#5a463b')
    p.r(26, 6, 18, 2, '#8fd16a'); p.r(30, 4, 8, 2, '#8fd16a')
    p.outline()
    for x in range(20, 52):   # water through the arch
        if p.px[x, 45][3] == 0: p.p(x, 45, '#a6dcf2')
    return p

def planter():
    p = P(40, 28)
    p.r(3, 14, 34, 12, '#b9744c'); p.r(4, 15, 32, 2, '#d99a6a'); p.r(4, 24, 32, 1, '#8a5232')
    rr = random.Random(5)
    for i in range(7):
        x = 6 + i * 4 + rr.randrange(-1, 2); y = 6 + rr.randrange(0, 5)
        p.r(x, y + 3, 1, 14 - y, '#4f9a43')
        col = ['#c8a6f0', '#f6d44c', '#ffffff', '#f0858a'][i % 4]
        p.r(x - 1, y, 3, 3, col); p.p(x, y + 1, '#f29a3a')
    p.ell(4, 10, 36, 18, '#6cb350'); p.ell(6, 10, 22, 15, '#8fd16a')
    for i in range(5):
        x = 7 + i * 6; col = ['#c8a6f0', '#f6d44c', '#ffffff', '#f0858a', '#c8a6f0'][i]
        p.r(x, 9 + (i % 2) * 2, 3, 3, col); p.p(x + 1, 10 + (i % 2) * 2, '#f29a3a')
    p.outline(); p.shadow(20, 27, 38)
    return p

def pedestal():
    p = P(96, 24)
    p.r(6, 8, 84, 12, '#a4a8ae'); p.r(7, 9, 82, 2, '#d3d7dc'); p.r(7, 18, 82, 1, '#7b8088')
    p.r(2, 18, 92, 5, '#8b9098'); p.r(3, 18, 90, 1, '#c3c7cc')
    p.r(36, 12, 24, 4, '#c9a25a'); p.r(37, 13, 22, 2, '#f1d48a')
    p.outline(); p.shadow(48, 23, 94)
    return p

ITEMS = {'sign': sign(), 'box': box(), 'boxOpen': box(True), 'trash': trash(), 'observe': observe(), 'stone': stone(), 'rock': rock(),
         'pillar': pillar(), 'arch': arch(), 'planter': planter(), 'pedestal': pedestal()}
x = 2; rects = {}; H = max(p.h for p in ITEMS.values()) + 4
sheet = Image.new('RGBA', (sum(p.w + 2 for p in ITEMS.values()) + 2, H), (0, 0, 0, 0))
for k, p in ITEMS.items(): sheet.alpha_composite(p.im, (x, 2)); rects[k] = [x, 2, p.w, p.h]; x += p.w + 2
os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True); sheet.save(OUT_PNG)
with open(OUT_JS, 'w') as f:
    f.write('// 지도 위 소품 도트 그림의 자리. scripts/draw-props-bw.py가 만들어요.\n')
    f.write('export const PROPS_ATLAS=' + json.dumps({'key': 'scenery/props-bw-v39', 'width': sheet.width, 'height': sheet.height, 'frames': rects}) + ';\n')
print('props', sheet.size)
