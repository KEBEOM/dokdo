#!/usr/bin/env python3
"""HD-2D 땅 재질·나무 그림을 만들어요 (v0.79).

에셋팩 ‘바닥 타일’·‘식생’ 참고표(05_스타일_캐릭터_참고용, 게임에는 넣지 않음)의 색감과 붓 터치를 따라
이음매 없는 128×128 땅 재질 8가지와 소나무·활엽수 그림을 그려요(1픽셀 = 지도 1픽셀, 바깥 1픽셀 진한 테두리).

  python3 scripts/make-hd2d-nature.py
  → dist/assets/scenery/hd2d-ground.png  (512×512: 4×4칸, 칸마다 128 재질 · 이어 붙여도 이음매 없음)
    dist/assets/scenery/hd2d-noise.png   (128×128 부드러운 잡음: 재질 경계를 자연스럽게)
    dist/assets/scenery/hd2d-trees.png   (나무 그림 모음)
    dist/hd2d-nature.js                  (자리 표)
같은 씨앗이면 늘 같은 그림이 나와요.
"""
import json, math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'assets', 'scenery')
N = 128

def hexc(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)

def pnoise(n, freq, rng):
    """주기적인(이어 붙여도 이음매 없는) 부드러운 잡음 0~1"""
    g = rng.random((freq, freq)).astype(np.float32)
    big = np.tile(g, (3, 3)); im = Image.fromarray((big * 255).astype(np.uint8)).resize((3 * n, 3 * n), Image.BICUBIC)
    a = np.asarray(im, dtype=np.float32)[n:2 * n, n:2 * n] / 255.0
    return a

def fbm(n, freq, rng, oct=4):
    a = np.zeros((n, n), np.float32); w = 1.0; tot = 0
    for i in range(oct):
        f = freq * 2 ** i
        if f > n: break
        a += pnoise(n, f, rng) * w; tot += w; w *= .5
    a /= tot; a = (a - a.min()) / (a.max() - a.min() + 1e-6); return a

def ramp(v, cols):
    """0~1 값을 색 띠로"""
    cols = [hexc(c) for c in cols]; k = len(cols) - 1
    t = np.clip(v, 0, 1) * k; i = np.minimum(np.floor(t).astype(int), k - 1); f = (t - i)[..., None]
    A = np.stack(cols)[i]; B = np.stack(cols)[i + 1]; return A * (1 - f) + B * f

def put(img, x, y, c):
    img[y % N, x % N] = c

def quant(img, colors=28, alpha=None):
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')
    q = im.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    if alpha is None: return q
    q = q.convert('RGBA'); q.putalpha(Image.fromarray(alpha.astype(np.uint8))); return q

def voronoi(n, cells, rng, jitter=.8):
    """주기적인 보로노이: (가장 가까운 점 번호, d1, d2, 점 자리)"""
    s = n / cells; pts = []
    for j in range(cells):
        for i in range(cells):
            pts.append(((i + .5 + (rng.random() - .5) * jitter) * s, (j + .5 + (rng.random() - .5) * jitter) * s))
    pts = np.array(pts, np.float32)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) + .5
    d1 = np.full((n, n), 1e9, np.float32); d2 = np.full((n, n), 1e9, np.float32); idx = np.zeros((n, n), int)
    for k, (px, py) in enumerate(pts):
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                d = np.hypot(xx - px - ox, yy - py - oy)
                closer = d < d1
                d2 = np.where(closer, d1, np.minimum(d2, d)); idx = np.where(closer, k, idx); d1 = np.where(closer, d, d1)
    return idx, d1, d2, pts

def stone_shade(idx, d1, d2, pts, n, gap):
    """돌 하나하나: 왼쪽 위는 밝고 오른쪽 아래는 어둡게(빛 방향은 에셋과 같이 왼쪽 위)"""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) + .5
    c = pts[idx]; dx = (xx - c[..., 0] + n / 2) % n - n / 2; dy = (yy - c[..., 1] + n / 2) % n - n / 2
    edge = d2 - d1
    lit = np.clip(-(dx * .6 + dy * .8) / (np.hypot(dx, dy) + 2.5), -1, 1)
    rim = np.clip(1 - edge / (gap * 3.2), 0, 1)
    return edge, lit, rim

# ── 땅 재질 ─────────────────────────────────────────────────────────────────
def grass(rng, tall=False):
    base = fbm(N, 4, rng); fine = fbm(N, 16, rng, 2)
    pal = ['#2c5420', '#3d6b27', '#527f2e', '#6a9636', '#86ad42', '#a5c457'] if not tall else ['#203f1c', '#2c5223', '#3b6a2a', '#4f8030', '#679838', '#86b04a']
    img = ramp(base * .7 + fine * .3, pal)
    cols = [hexc(c) for c in pal]
    blades = 2600 if tall else 1700
    for _ in range(blades):  # 풀잎: 아래는 어둡고 끝은 밝게, 살짝 기울어요
        x, y = int(rng.integers(0, N)), int(rng.integers(0, N)); L = int(rng.integers(4, 8) if tall else rng.integers(2, 5))
        lean = rng.choice([-1, 0, 0, 1]); v = base[y, x]
        lo = int(np.clip(v * 3, 0, 2)); hi = min(len(cols) - 1, lo + 2 + int(rng.integers(0, 2)))
        put(img, x, y + 1, cols[max(0, lo - 1)])
        for k in range(L):
            put(img, x + (lean if k > L // 2 else 0), y - k, cols[lo] * (1 - k / L) + cols[hi] * (k / L))
    for _ in range(14 if not tall else 6):  # 작은 꽃·클로버
        x, y = int(rng.integers(0, N)), int(rng.integers(0, N)); c = hexc(rng.choice(['#f4f1e4', '#f6e27a', '#e9b8d0', '#ffffff']))
        for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 0), (0, -1))[:int(rng.integers(1, 5))]: put(img, x + dx, y + dy, c)
    if tall:
        for _ in range(60):  # 이삭
            x, y = int(rng.integers(0, N)), int(rng.integers(0, N)); put(img, x, y, hexc('#c9c27a')); put(img, x, y + 1, hexc('#9a9450'))
    return quant(img, 24)

def dirt(rng):
    base = fbm(N, 4, rng); fine = fbm(N, 32, rng, 2)
    img = ramp(base * .6 + fine * .4, ['#6e5136', '#836140', '#98744c', '#ab875a', '#bf9c6c'])
    idx, d1, d2, pts = voronoi(N, 9, rng)
    keep = rng.random(len(pts)) < .55; r = 1.6 + rng.random(len(pts)) * 2.2
    yy, xx = np.mgrid[0:N, 0:N]
    for k, (px, py) in enumerate(pts):  # 박힌 돌
        if not keep[k]: continue
        dx = (xx - px + N / 2) % N - N / 2; dy = (yy - py + N / 2) % N - N / 2; d = np.hypot(dx, dy * 1.2)
        m = d < r[k]; lit = (-(dx * .6 + dy * .8) / (d + 1)) * .5 + .5; g = 120 + rng.random() * 40
        img[m] = np.stack([lit[m] * 70 + g, lit[m] * 66 + g - 6, lit[m] * 60 + g - 14], -1)
        sh = (d >= r[k]) & (d < r[k] + 1.2) & (dx > 0) & (dy > 0); img[sh] *= .78
    gcol = [hexc('#4d7a2c'), hexc('#6f9a38'), hexc('#8db24a')]
    for _ in range(170):  # 풀 조각
        x, y = int(rng.integers(0, N)), int(rng.integers(0, N))
        if base[y, x] > .45: continue
        for k in range(int(rng.integers(2, 4))): put(img, x + int(rng.integers(-1, 2)), y - k, gcol[min(2, k)])
    return quant(img, 24)

def cobble(rng):  # 돌길(마을 길): 둥근 돌을 깔고 틈엔 흙·이끼
    idx, d1, d2, pts = voronoi(N, 15, rng, .75)
    edge, lit, rim = stone_shade(idx, d1, d2, pts, N, 1.3)
    tone = rng.random(len(pts))[idx]; warm = rng.random(len(pts))[idx]; grain = fbm(N, 32, rng, 2)
    base = np.stack([150 + tone * 38 + warm * 10, 144 + tone * 36 + warm * 2, 130 + tone * 32 - warm * 6], -1)
    img = base * (1 + lit[..., None] * .22 * rim[..., None]) * (.9 + grain[..., None] * .2)
    gap = edge < 1.6
    mortar = ramp(fbm(N, 8, rng), ['#3f382d', '#51483a', '#5e5642'])
    moss = (fbm(N, 6, rng) > .62) & gap
    img = np.where(gap[..., None], mortar, img); img[moss] = hexc('#56702f')
    sh = (edge >= 1.6) & (edge < 2.8) & (lit < -.2); img[sh] *= .82
    return quant(img, 26)

def concrete(rng):  # 선착장·방파제 콘크리트: 지도 칸(32)에 맞춘 판, 이음매·얼룩·녹물
    base = fbm(N, 4, rng); fine = fbm(N, 32, rng, 2)
    img = ramp(base * .55 + fine * .45, ['#8d8b84', '#9c9a92', '#aaa89f', '#b8b6ac', '#c6c3b8'])
    sp = rng.random((N, N)); img[sp < .03] *= .86; img[sp > .985] = img[sp > .985] * .5 + 110
    yy, xx = np.mgrid[0:N, 0:N]
    seam = (xx % 32 == 0) | (yy % 32 == 0); hi = (xx % 32 == 1) | (yy % 32 == 1)
    img[seam] = img[seam] * .62; img[hi & ~seam] = img[hi & ~seam] * 1.07
    st = fbm(N, 6, rng) > .72; img[st] = img[st] * np.array([.93, .9, .84])
    return quant(img, 22)

def sand(rng):
    base = fbm(N, 4, rng); rip = np.sin((np.mgrid[0:N, 0:N][0] / N * 2 * math.pi * 9) + fbm(N, 4, rng) * 6) * .5 + .5
    img = ramp(base * .7 + rip * .3, ['#c2a77a', '#cfb487', '#dbc295', '#e6cfa4', '#efdcb6'])
    sp = rng.random((N, N)); img[sp < .05] *= .9; img[sp > .97] = img[sp > .97] * .7 + 70
    for _ in range(9):  # 조개 조각
        x, y = int(rng.integers(0, N)), int(rng.integers(0, N)); put(img, x, y, hexc('#f6efe2')); put(img, x + 1, y, hexc('#e7c9b8')); put(img, x, y + 1, hexc('#b39a7a'))
    return quant(img, 20)

def pebbles(rng, cells=12, warm=0.0):  # 해변 자갈(독도 해안): 둥근 돌, 젖은 윤기
    idx, d1, d2, pts = voronoi(N, cells, rng, .85)
    edge, lit, rim = stone_shade(idx, d1, d2, pts, N, 1.0)
    tone = rng.random(len(pts))[idx]; hue = rng.random(len(pts))[idx]
    base = np.stack([108 + tone * 62 + hue * 18 + warm * 30, 106 + tone * 60 + warm * 18, 104 + tone * 56 - hue * 10], -1)
    img = base * (1 + lit[..., None] * .3 * rim[..., None])
    gl = (lit > .55) & (rim > .3) & (rng.random((N, N)) < .5); img[gl] = img[gl] * .6 + 100
    gap = edge < 1.2; img[gap] = ramp(fbm(N, 8, rng), ['#2c2a28', '#3d3934'])[gap]
    return quant(img, 24)

def gravel(rng):  # 잔자갈 길(독도 탐방로)
    base = fbm(N, 4, rng)
    img = ramp(base, ['#7d7466', '#8b8272', '#9a907e', '#a99f8b'])
    for _ in range(1300):
        x, y = int(rng.integers(0, N)), int(rng.integers(0, N)); g = 120 + rng.random() * 70
        c = np.array([g, g - 4, g - 12]); put(img, x, y, c * 1.1); put(img, x + 1, y, c); put(img, x + 1, y + 1, c * .7)
    return quant(img, 22)

def steps(rng):  # 돌계단: 8픽셀마다 한 단(앞 모서리는 어둡고 디딤면 위쪽은 밝게)
    base = fbm(N, 8, rng); img = ramp(base, ['#8a8478', '#999286', '#a8a194', '#b6afa1'])
    yy, xx = np.mgrid[0:N, 0:N]; r = yy % 8
    img[r == 7] *= .55; img[r == 6] *= .8; img[r == 0] = img[r == 0] * 1.1 + 6
    joint = (xx + (yy // 8) * 13) % 24 == 0; img[joint & (r < 6)] *= .7
    moss = (fbm(N, 6, rng) > .7) & (r >= 5); img[moss] = img[moss] * .5 + hexc('#56702f') * .5
    return quant(img, 22)

def deck(rng):  # 나무 데크: 가로 판자 8픽셀, 못·이음매
    base = fbm(N, 4, rng); grain = fbm(N, 32, rng, 2)
    yy, xx = np.mgrid[0:N, 0:N]; plank = yy // 8; tone = np.asarray([rng.random() for _ in range(N // 8)])[plank]
    img = ramp(base * .3 + grain * .3 + tone * .4, ['#7a5434', '#8d6440', '#a0764d', '#b4895c'])
    img[yy % 8 == 7] *= .55; seam = (xx + plank * 37) % 64 == 0; img[seam] *= .6
    nail = ((xx + plank * 37) % 64 == 3) & (yy % 8 == 3); img[nail] = hexc('#3b3029')
    return quant(img, 20)

# ── 나무 ───────────────────────────────────────────────────────────────────
LIGHT = np.array([-.55, -.65, .52]); LIGHT /= np.linalg.norm(LIGHT)
BROAD = ['#16301a', '#22421f', '#2f5a27', '#40732f', '#578d38', '#74a845', '#97c25a', '#bcd97a']
PINE = ['#12281c', '#1b3a26', '#264f30', '#33653a', '#467d44', '#609754', '#82b066']
INK = np.array([20, 30, 22], np.float32)

def clump_tree(rng, W, H, clumps, pal, trunk, bark):
    col = np.zeros((H, W, 3), np.float32); a = np.zeros((H, W), bool); yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # 줄기: 아래가 넓고 위로 갈수록 가늘게, 왼쪽은 밝게
    (x0, y0), (x1, y1), w0, w1 = trunk
    for t in np.linspace(0, 1, 160):
        cx = x0 + (x1 - x0) * t + math.sin(t * 3.1) * 1.5; cy = y0 + (y1 - y0) * t; w = w0 + (w1 - w0) * min(1, t * 1.6) + max(0, .12 - t) * 40  # 뿌리 쪽은 넓게
        m = (np.abs(xx - cx) <= w / 2) & (np.abs(yy - cy) <= 1)
        f = np.clip((xx - cx) / (w / 2 + .01), -1, 1)
        shade = np.where(f < -.3, 1.15, np.where(f > .35, .72, .95))
        stripe = 1 - .1 * (((yy.astype(int) // 3 + (xx.astype(int) // 2)) % 3) == 0)
        col[m] = (hexc(bark) * (shade * stripe)[..., None])[m]; a |= m
    tex = fbm(max(W, H) if max(W, H) <= 128 else 128, 16, rng, 3)
    tex = np.asarray(Image.fromarray((tex * 255).astype(np.uint8)).resize((W, H), Image.NEAREST), np.float32) / 255
    speck = rng.random((H // 2 + 1, W // 2 + 1)).repeat(2, 0).repeat(2, 1)[:H, :W]
    k = len(pal) - 1; P = np.stack([hexc(c) for c in pal])
    for (cx, cy, rx, ry, depth) in sorted(clumps, key=lambda c: c[1] + c[4] * 6):
        ang = np.arctan2((yy - cy) / ry, (xx - cx) / rx); ph = rng.random() * 6.3; fq = rng.integers(6, 10)
        rr = 1 + .1 * np.sin(ang * fq + ph) + .05 * np.sin(ang * (fq * 2 + 1) + ph * 2)
        d = np.hypot((xx - cx) / rx, (yy - cy) / ry) / rr
        m = d < 1
        nx = (xx - cx) / rx; ny = (yy - cy) / ry; nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
        lam = np.clip(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], -1, 1)
        v = .42 + lam * .42 - depth * .12 + (tex - .5) * .34 + (speck - .5) * .22 - np.clip(d - .82, 0, 1) * .9
        idx = np.clip(np.round(v * k), 0, k).astype(int)
        col[m] = P[idx][m]; a |= m
    # 바깥 1픽셀 진한 테두리(에셋과 같게)
    pad = np.pad(a, 1); edge = (~a) & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
    col[edge] = INK; a |= edge
    # 안쪽 덩어리 경계도 살짝 어둡게(덩어리가 겹친 자리)
    return col, a

def broadleaf(rng, W=88, H=96):
    cx, cy = W / 2, 46; clumps = []
    for i in range(10):
        t = i / 10 * 2 * math.pi + rng.random() * .4; r = 20 + rng.random() * 6
        clumps.append((cx + math.cos(t) * r * .95, cy + math.sin(t) * r * .78 + 4, 13 + rng.random() * 5, 12 + rng.random() * 4, .6 if math.sin(t) < 0 else 0))
    for i in range(5):
        clumps.append((cx + (rng.random() - .5) * 22, cy + (rng.random() - .5) * 18 - 6, 14 + rng.random() * 4, 13 + rng.random() * 3, .2))
    clumps.append((cx - 4, cy - 18, 15, 13, 0))
    trunk = ((cx + 1, H - 3), (cx - 1, cy + 12), 12, 7)
    return clump_tree(rng, W, H, clumps, BROAD, trunk, '#6b4a33')

CAMELLIA = ['#0f2418', '#163522', '#1f4a2c', '#2a5f36', '#3b7a44', '#57965a', '#7db374']
def camellia(rng, W=80, H=92):  # 동백나무(울릉도): 짙고 윤기 나는 잎 + 붉은 꽃
    cx, cy = W / 2, 44; clumps = []
    for i in range(9):
        t = i / 9 * 2 * math.pi + rng.random() * .5; r = 17 + rng.random() * 5
        clumps.append((cx + math.cos(t) * r, cy + math.sin(t) * r * .8 + 3, 12 + rng.random() * 4, 11 + rng.random() * 3, .5 if math.sin(t) < 0 else 0))
    for i in range(4): clumps.append((cx + (rng.random() - .5) * 18, cy + (rng.random() - .5) * 14 - 5, 13, 12, .1))
    col, a = clump_tree(rng, W, H, clumps, CAMELLIA, ((cx, H - 3), (cx, cy + 10), 10, 6), '#5a4030')
    for _ in range(26):  # 꽃: 2×2 붉은 송이 + 노란 술
        x, y = int(rng.integers(8, W - 8)), int(rng.integers(14, int(cy + 22)))
        if not a[y, x] or not a[y + 1, x + 1]: continue
        col[y:y + 2, x:x + 2] = hexc('#c8243a'); col[y, x] = hexc('#e84a5c'); col[y + 1, x + 1] = hexc('#f2c64a') if rng.random() < .5 else hexc('#9a1a2c')
    return col, a

def pine(rng, W=92, H=100):
    cx = W / 2; clumps = []
    tiers = [(28, 18, 3), (46, 30, 4), (64, 38, 5)]
    for (ty, half, n) in tiers:
        for i in range(n):
            x = cx - half + (i + .5) / n * half * 2 + (rng.random() - .5) * 6
            clumps.append((x, ty + (rng.random() - .5) * 6, 11 + rng.random() * 4, 8 + rng.random() * 3, .3 if i in (0, n - 1) else 0))
    clumps.append((cx + (rng.random() - .5) * 4, 16, 10, 9, 0))
    trunk = ((cx + 2, H - 3), (cx - 2, 22), 12, 5)
    return clump_tree(rng, W, H, clumps, PINE, trunk, '#8a4a2e')

def main():
    os.makedirs(OUT, exist_ok=True)
    rng = np.random.default_rng(79)
    mats = [('grass', grass(rng)), ('tall', grass(rng, True)), ('dirt', dirt(rng)), ('cobble', cobble(rng)),
            ('concrete', concrete(rng)), ('sand', sand(rng)), ('pebbles', pebbles(rng)), ('gravel', gravel(rng)),
            ('steps', steps(rng)), ('deck', deck(rng))]
    sheet = Image.new('RGB', (512, 512))
    for i, (_, im) in enumerate(mats): sheet.paste(im, ((i % 4) * 128, (i // 4) * 128))
    sheet.save(os.path.join(OUT, 'hd2d-ground.png'))
    noise = fbm(N, 8, np.random.default_rng(7), 3)
    Image.fromarray(np.stack([(noise * 255).astype(np.uint8), (np.roll(noise, 41, (0, 1)) * 255).astype(np.uint8), np.zeros((N, N), np.uint8)], -1), 'RGB').save(os.path.join(OUT, 'hd2d-noise.png'))
    trees = []
    for i in range(3): trees.append((f'broad_{i}', *broadleaf(np.random.default_rng(100 + i))))
    for i in range(3): trees.append((f'pine_{i}', *pine(np.random.default_rng(200 + i))))
    for i in range(3): trees.append((f'camellia_{i}', *camellia(np.random.default_rng(300 + i))))
    AW = sum(c.shape[1] + 2 for _, c, _ in trees); AH = max(c.shape[0] for _, c, _ in trees)
    atlas = Image.new('RGBA', (AW, AH)); frames = {}; x = 0
    for name, col, a in trees:
        im = quant(col, 30, a * 255); atlas.paste(im, (x, AH - im.height)); frames[name] = [x, AH - im.height, im.width, im.height]; x += im.width + 2
    atlas.save(os.path.join(OUT, 'hd2d-trees.png'))
    js = os.path.join(ROOT, 'dist', 'hd2d-nature.js')
    with open(js, 'w', encoding='utf-8') as f:
        f.write('// HD-2D 땅 재질·나무 그림 자리 (scripts/make-hd2d-nature.py가 만들어요)\n')
        f.write('// 땅: 4×4칸(칸마다 128, 이음매 없음) · 재질 번호 1부터. 나무: 발 자리는 그림 아랫변 가운데.\n')
        f.write('export const HD2D_GROUND = ' + json.dumps({'key': 'scenery/hd2d-ground', 'noise': 'scenery/hd2d-noise', 'cols': 4, 'rows': 4, 'size': 128, 'slots': {name: i + 1 for i, (name, _) in enumerate(mats)}}) + ';\n')
        f.write('export const HD2D_TREES = ' + json.dumps({'key': 'scenery/hd2d-trees', 'width': AW, 'height': AH, 'frames': frames}) + ';\n')
    print('ground', [m for m, _ in mats], 'trees', list(frames), AW, AH)

if __name__ == '__main__':
    main()
