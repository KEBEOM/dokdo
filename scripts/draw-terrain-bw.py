"""지형 타일 도트 그림 (v0.39, (선명한 외곽선 도트 느낌)

    python scripts/draw-terrain-bw.py

  dist/assets/scenery/terrain-bw-v39.png   타일 모음
  dist/terrain-atlas.js                    종류마다 자리 (가로 2칸 × 세로 4칸, 한 칸 = 32×32)

한 칸은 게임 속 한 칸(32×32)과 같은 크기라서 1도트 = 게임 1픽셀로 또렷하게 그려져요.
바탕은 한 가지 색으로 평평하게 칠하고(그래야 칸과 칸이 이음매 없이 이어져요), 그 위에 풀포기·자갈·물결 같은 작은 무늬를 얹어요.
칸과 칸 사이 경계(풀 가장자리, 물가 거품)는 terrain.js가 그려요.
"""
import json, os, random
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PNG = os.path.join(ROOT, 'dist', 'assets', 'scenery', 'terrain-bw-v39.png')
OUT_JS = os.path.join(ROOT, 'dist', 'terrain-atlas.js')
T = 32

def hexc(s):
    s = s.lstrip('#'); return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)

class Cell:
    def __init__(s, base): s.im = Image.new('RGBA', (T, T), hexc(base)); s.px = s.im.load()
    def p(s, x, y, c):
        s.px[x % T, y % T] = hexc(c)     # wrap so marks crossing an edge continue on the other side (seamless)
    def r(s, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w): s.p(xx, yy, c)

def grass(seed, flowers=False):
    rr = random.Random(seed); c = Cell('#8fd16a')
    for _ in range(rr.randrange(3, 5)):   # grass tufts: a small dark "w" with light tips
        x, y = rr.randrange(T), rr.randrange(T)
        for dx, dy in [(0, 0), (1, 1), (2, 0), (3, 1), (4, 0)]: c.p(x + dx, y + dy, '#6cb350')
        c.p(x, y - 1, '#b4e68c'); c.p(x + 2, y - 1, '#b4e68c'); c.p(x + 4, y - 1, '#b4e68c')
    for _ in range(rr.randrange(4, 8)):   # single blades
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, '#78bd57'); c.p(x, y - 1, '#a6de7e')
    if flowers:
        for _ in range(2):
            x, y = rr.randrange(T), rr.randrange(T); col = rr.choice(['#ffffff', '#f6d44c', '#c8a6f0'])
            c.p(x, y - 1, col); c.p(x - 1, y, col); c.p(x + 1, y, col); c.p(x, y + 1, col); c.p(x, y, '#f29a3a')
    return c

def tall(seed):
    """Encounter grass: four clumps of pointed blades with a dark outline, like the tall grass in the Unova games."""
    rr = random.Random(seed); c = Cell('#4d9a43')
    for (ox, oy) in [(0, 0), (16, 0), (0, 16), (16, 16)]:
        ox += rr.randrange(-1, 2); oy += rr.randrange(-1, 2)
        for (bx, h) in [(2, 9), (6, 12), (10, 10), (13, 7)]:
            x = ox + bx; top = oy + 14 - h
            for y in range(top, oy + 15):
                k = y - top
                c.p(x, y, '#2f6a34'); c.p(x + 1, y, '#5fb04d' if k > 1 else '#9fdc72'); c.p(x + 2, y, '#4a9a3f' if k > 2 else '#2f6a34')
            c.p(x + 1, top - 1, '#2f6a34')
        c.r(ox + 1, oy + 15, 15, 1, '#2f6a34')
    return c

def rocky(seed):
    """v0.45 바위 들판: 독도처럼 화산 응회암 땅에 금이 가 있고, 자갈·이끼와 가끔 해국(보라)·땅채송화(노랑)가 피어 있어요."""
    rr = random.Random(seed); c = Cell('#bfad8c')
    for _ in range(rr.randrange(5, 8)):   # 넓적한 바위 판: 밝은 윗면 + 어두운 아래 금
        x, y, w = rr.randrange(T), rr.randrange(T), rr.randrange(4, 8)
        c.r(x, y, w, 2, '#cdbd9c'); c.r(x, y + 2, w, 1, '#9c8768'); c.p(x + w, y + 1, '#9c8768')
    for _ in range(rr.randrange(3, 5)):   # 갈라진 금
        x, y = rr.randrange(T), rr.randrange(T)
        for i in range(rr.randrange(3, 6)): c.p(x + i, y + (i % 2), '#8a7457')
    for _ in range(rr.randrange(4, 7)):   # 자갈
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, '#e2d5b8'); c.p(x + 1, y, '#a69273'); c.p(x, y + 1, '#8f7a5e')
    for _ in range(rr.randrange(2, 4)):   # 이끼·풀 포기
        x, y = rr.randrange(T), rr.randrange(T)
        for dx, dy in [(0, 0), (1, -1), (2, 0)]: c.p(x + dx, y + dy, '#6fa54e')
        c.p(x + 1, y, '#8fcb63')
    if rr.random() < .45:                 # 해국 또는 땅채송화 한 송이
        x, y = rr.randrange(2, T - 2), rr.randrange(2, T - 2); col, mid = rr.choice([('#b48ad8', '#f2cf4a'), ('#f2cf4a', '#e09a2a')])
        c.p(x, y - 1, col); c.p(x - 1, y, col); c.p(x + 1, y, col); c.p(x, y + 1, col); c.p(x, y, mid); c.p(x + 2, y + 2, '#6fa54e')
    return c

def path(seed):
    rr = random.Random(seed); c = Cell('#e2c88f')
    for _ in range(rr.randrange(3, 6)):
        x, y = rr.randrange(T), rr.randrange(T); c.r(x, y, 2, 2, '#c9aa6d'); c.p(x, y, '#f3dfae')
    for _ in range(rr.randrange(6, 10)):
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, rr.choice(['#d4b67a', '#eed7a4']))
    return c

def sand(seed):
    rr = random.Random(seed); c = Cell('#f4e2ae')
    for _ in range(rr.randrange(8, 14)):
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, rr.choice(['#e6cd92', '#fff3d0', '#e6cd92']))
    if rr.random() < .3:
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, '#ffffff'); c.p(x + 1, y, '#f0c6b0'); c.p(x, y + 1, '#e3a98f')
    return c

def water(seed):
    rr = random.Random(seed); c = Cell('#4aa9d8')
    for _ in range(rr.randrange(2, 4)):   # little wave crests: a light arc over a darker trough
        x, y = rr.randrange(T), rr.randrange(T)
        for i in range(6): c.p(x + i, y - (1 if 1 <= i <= 4 else 0), '#a6dcf2')
        c.p(x + 2, y - 2, '#e8f8ff'); c.p(x + 3, y - 2, '#e8f8ff')
        for i in range(1, 5): c.p(x + i, y + 1, '#3d93c6')
    for _ in range(rr.randrange(2, 4)):
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, '#3d93c6'); c.p(x + 1, y, '#3d93c6')
    return c

def dock(seed):
    rr = random.Random(seed); c = Cell('#c28b54')
    for row in range(4):
        y = row * 8; c.r(0, y, T, 1, '#dca56c'); c.r(0, y + 7, T, 1, '#7a5030')
        seam = rr.randrange(4, 28); c.r(seam, y, 1, 7, '#7a5030')
        for x in (seam - 2, seam + 2): c.p(x, y + 3, '#5e3c22')
        for _ in range(2):
            gx = rr.randrange(T); c.r(gx, y + rr.randrange(2, 6), rr.randrange(3, 6), 1, '#ae7a48')
    return c

KINDS = {
    'grass': [grass(i, flowers=(i in (2, 5))) for i in range(8)],
    'tall': [tall(i + 20) for i in range(8)],
    'path': [path(i + 40) for i in range(8)],
    'sand': [sand(i + 60) for i in range(8)],
    'water': [water(i + 80) for i in range(8)],
    'dock': [dock(i + 100) for i in range(8)],
    'rocky': [rocky(i + 120) for i in range(8)],
}
rows = (len(KINDS) + 2) // 3
sheet = Image.new('RGBA', (3 * 66 + 2, rows * 130 + 2), (0, 0, 0, 0)); frames = {}
for n, (k, cells) in enumerate(KINDS.items()):
    fx, fy = 2 + (n % 3) * 66, 2 + (n // 3) * 130
    for i, cell in enumerate(cells): sheet.alpha_composite(cell.im, (fx + (i % 2) * T, fy + (i // 2) * T))
    frames[k] = [fx, fy, 2 * T, 4 * T]
os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True); sheet.save(OUT_PNG)
with open(OUT_JS, 'w') as f:
    f.write('export const TERRAIN_ATLAS=' + json.dumps({'key': 'scenery/terrain-bw-v39', 'width': sheet.width, 'height': sheet.height, 'frames': frames}) + ';\n')
print('terrain', sheet.size, frames)
