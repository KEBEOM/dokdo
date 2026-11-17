"""지형 타일 도트 그림 (v0.66 자연 다시 그리기 — 휴대용 게임기 시절 2D RPG의 맑은 풀밭·짙은 바다 느낌)

    python scripts/draw-terrain-bw.py

  dist/assets/scenery/terrain-nature-v66.png   타일 모음
  dist/terrain-atlas.js                    종류마다 자리 (가로 2칸 × 세로 4칸, 한 칸 = 32×32)

한 칸은 게임 속 한 칸(32×32)과 같은 크기라서 1도트 = 게임 1픽셀로 또렷하게 그려져요.
바탕은 한 가지 색으로 평평하게 칠하고(그래야 칸과 칸이 이음매 없이 이어져요), 그 위에 풀포기·자갈·물결 같은 작은 무늬를 얹어요.
칸과 칸 사이 경계(풀 가장자리, 물가 거품)는 terrain.js가 그려요.
"""
import json, os, random
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PNG = os.path.join(ROOT, 'dist', 'assets', 'scenery', 'terrain-nature-v66.png')
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
    """v0.66 풀밭: 밝은 연두 바탕에 짧은 풀포기(‘ᐯ’ 모양 두 잎)와 작은 잎끝 점. 큰 빛줄기와 꽃밭은 terrain.js가 지도 전체에 그려요."""
    rr = random.Random(seed); c = Cell('#8fd16a')
    for _ in range(rr.randrange(4, 7)):   # 풀포기: 두 잎이 벌어진 V 모양(짙은 줄기 + 밝은 잎끝)
        x, y = rr.randrange(T), rr.randrange(T)
        c.p(x, y, '#5fa84a'); c.p(x - 1, y - 1, '#6cb350'); c.p(x + 1, y - 1, '#6cb350'); c.p(x - 2, y - 2, '#a9e183'); c.p(x + 2, y - 2, '#a9e183')
        if rr.random() < .5: c.p(x, y - 1, '#6cb350'); c.p(x, y - 2, '#a9e183')
    for _ in range(rr.randrange(5, 9)):   # 낱잎: 짙은 점 + 위의 밝은 점
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, '#77bd5a'); c.p(x, y - 1, '#a2db7c')
    if flowers:
        for _ in range(2):
            x, y = rr.randrange(T), rr.randrange(T); col = rr.choice(['#ffffff', '#f6d44c', '#f7c2d6'])
            c.p(x, y - 1, col); c.p(x - 1, y, col); c.p(x + 1, y, col); c.p(x, y + 1, col); c.p(x, y, '#f29a3a'); c.p(x + 1, y + 1, '#5fa84a')
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
    """v0.66 바위 들판: 독도의 응회암 땅. 넓적한 판석(밝은 윗면·짙은 테두리), 갈라진 금, 자갈, 이끼, 가끔 해국·땅채송화."""
    rr = random.Random(seed); c = Cell('#c2b08e')
    for _ in range(rr.randrange(1, 3)):   # 판석: 짙은 테두리 + 밝은 윗면 + 아래 그늘
        x, y, w, h = rr.randrange(T), rr.randrange(T), rr.randrange(5, 9), rr.randrange(2, 4)
        c.r(x + 1, y, w - 2, 1, '#a69272'); c.r(x, y + 1, 1, h, '#a69272'); c.r(x + w - 1, y + 1, 1, h, '#a08b6a'); c.r(x + 1, y + h + 1, w - 2, 1, '#8c7758')
        c.r(x + 1, y + 1, w - 2, h, '#cfbf9c'); c.r(x + 1, y + 1, w - 3, 1, '#e2d6b6'); c.r(x + 1, y + h, w - 2, 1, '#b19e7c')
    for _ in range(rr.randrange(2, 4)):   # 갈라진 금
        x, y = rr.randrange(T), rr.randrange(T)
        for i in range(rr.randrange(3, 7)): c.p(x + i, y + (i // 2) % 2, '#8a7457')
    for _ in range(rr.randrange(5, 8)):   # 자갈: 밝은 점 + 그늘
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, '#ece2c8'); c.p(x + 1, y, '#b5a383'); c.p(x, y + 1, '#8f7a5e'); c.p(x + 1, y + 1, '#8f7a5e')
    for _ in range(rr.randrange(1, 3)):   # 이끼·풀포기
        x, y = rr.randrange(T), rr.randrange(T)
        c.p(x, y, '#5f9a44'); c.p(x - 1, y - 1, '#6fa54e'); c.p(x + 1, y - 1, '#6fa54e'); c.p(x - 1, y - 2, '#9fd27a'); c.p(x + 1, y - 2, '#9fd27a')
    if rr.random() < .4:                  # 해국 또는 땅채송화 한 송이
        x, y = rr.randrange(2, T - 2), rr.randrange(2, T - 2); col, mid = rr.choice([('#b48ad8', '#f2cf4a'), ('#f2cf4a', '#e09a2a')])
        c.p(x, y - 1, col); c.p(x - 1, y, col); c.p(x + 1, y, col); c.p(x, y + 1, col); c.p(x, y, mid); c.p(x + 2, y + 2, '#6fa54e')
    return c

def path(seed):
    """v0.66 흙길: 고운 흙에 작은 자갈 무리(밝은 윗점 + 짙은 아랫점)와 발자국 같은 옅은 얼룩."""
    rr = random.Random(seed); c = Cell('#e2c88f')
    for _ in range(rr.randrange(2, 4)):   # 옅은 얼룩
        x, y = rr.randrange(T), rr.randrange(T); c.r(x, y, rr.randrange(3, 6), 1, '#dcc086'); c.r(x + 1, y + 1, rr.randrange(2, 4), 1, '#dcc086')
    for _ in range(rr.randrange(2, 4)):   # 자갈 무리
        x, y = rr.randrange(T), rr.randrange(T)
        for (dx, dy) in rr.sample([(0, 0), (3, 1), (1, 3), (4, 3)], rr.randrange(2, 4)):
            c.p(x + dx, y + dy, '#f6e6bd'); c.p(x + dx + 1, y + dy, '#c9aa6d'); c.p(x + dx, y + dy + 1, '#b8975c')
    for _ in range(rr.randrange(5, 9)):
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, rr.choice(['#d4b67a', '#eed7a4']))
    return c

def sand(seed):
    """v0.66 모래: 밝은 모래에 물결 자국(옅은 곡선)과 작은 조개."""
    rr = random.Random(seed); c = Cell('#f4e2ae')
    for _ in range(rr.randrange(1, 3)):   # 바람·물결 자국
        x, y = rr.randrange(T), rr.randrange(T)
        for i in range(rr.randrange(5, 9)): c.p(x + i, y + (1 if i in (0, 1) else 0) - (1 if i > 5 else 0), '#ead398')
    for _ in range(rr.randrange(8, 13)):
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, rr.choice(['#e6cd92', '#fff6da', '#e6cd92']))
    if rr.random() < .3:
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, '#ffffff'); c.p(x + 1, y, '#f0c6b0'); c.p(x, y + 1, '#e3a98f')
    return c

def water(seed):
    """v0.66 바다: 짙은 파랑 바탕에 옆으로 긴 물결(밝은 곡선 + 아래 짙은 골)과 반짝이는 점."""
    rr = random.Random(seed); c = Cell('#3a8ad6')
    for _ in range(rr.randrange(3, 5)):
        x, y, w = rr.randrange(T), rr.randrange(T), rr.randrange(6, 11)
        for i in range(w):
            lift = 1 if 1 <= i <= w - 2 else 0
            c.p(x + i, y - lift, '#64aeea')
            if 2 <= i <= w - 3: c.p(x + i, y + 1, '#3079c4')
        c.p(x + w // 2 - 1, y - 2, '#a8dcfa'); c.p(x + w // 2, y - 2, '#a8dcfa')
    for _ in range(rr.randrange(2, 4)):   # 잔물결
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, '#4f9de2'); c.p(x + 1, y, '#4f9de2'); c.p(x + 2, y + 1, '#3079c4')
    if rr.random() < .5:
        x, y = rr.randrange(T), rr.randrange(T); c.p(x, y, '#e8f8ff')
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
    f.write('export const TERRAIN_ATLAS=' + json.dumps({'key': 'scenery/terrain-nature-v66', 'width': sheet.width, 'height': sheet.height, 'frames': frames}) + ';\n')
print('terrain', sheet.size, frames)
