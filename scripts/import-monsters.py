"""우산몬 그림 가져오기 (v0.26)

    python scripts/import-monsters.py <그림 폴더>          # Pillow, numpy 필요 (pip install pillow numpy)

<그림 폴더> 안의 '번호 이름.jpg' 또는 '번호 이름.png' (예: '01 해국.jpg', '100 강치.png')를 읽어
  dist/assets/monsters/NNN.png       정면 (상대 우산몬, 도감)
  dist/assets/monsters/back/NNN.png  뒷모습 (전투에서 내 우산몬)
을 만듭니다. 흰 배경은 투명하게 지우고, JPG 얼룩을 줄인 뒤 512×512 칸의 같은 자리(발끝 기준)에 놓습니다.

뒷모습은 scripts/monster-backs.json 설정을 따릅니다.
  "face": [x0, y0, x1, y1]   얼굴 영역(512 칸 좌표). 눈·입·볼을 몸 색으로 덮고 좌우를 뒤집습니다.
  "side": true               옆을 보는 우산몬(새·새우 등). 좌우만 뒤집어 상대를 바라보게 합니다.
  "fill": "#rrggbb"          얼굴을 덮을 색을 직접 정할 때(예: 사람 모습이면 머리카락 색).
설정이 없으면 눈을 자동으로 찾아 덮어 봅니다. 결과가 어색하면 face 영역을 적어 다시 실행하세요.
"""
import json, os, re, sys
from collections import Counter, deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'assets', 'monsters')
SIZE, MARGIN, BASE = 512, 20, 500  # canvas, side margin, ground line

def remove_background(rgb, holes=False, halo=2):
    a = rgb.astype(int); h, w, _ = a.shape
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    bg_like = (lum > 225) & (sat < 34)
    seen = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg_like[y, x]: q.append((y, x)); seen[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            if bg_like[y, x] and not seen[y, x]: q.append((y, x)); seen[y, x] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and bg_like[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    if holes:
        # big white gaps enclosed by the figure (between legs or arms) are background too; small ones (eye whites) stay
        lab = np.zeros((h, w), int); n = 0; limit = h * w * 0.0006
        for y0 in range(h):
            for x0 in range(w):
                if bg_like[y0, x0] and not seen[y0, x0] and not lab[y0, x0]:
                    n += 1; pts = [(y0, x0)]; lab[y0, x0] = n; i = 0
                    while i < len(pts):
                        y, x = pts[i]; i += 1
                        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < h and 0 <= nx < w and bg_like[ny, nx] and not seen[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; pts.append((ny, nx))
                    if len(pts) > limit:
                        for y, x in pts: seen[y, x] = True
    alpha = ~seen
    # drop the pale JPEG halo that hugs the background
    for _ in range(halo):
        edge = alpha & (np.roll(~alpha, 1, 0) | np.roll(~alpha, -1, 0) | np.roll(~alpha, 1, 1) | np.roll(~alpha, -1, 1))
        alpha &= ~(edge & (lum > 200) & (sat < 50))
    return alpha

def kmeans(X, k, it=25, seed=3):
    rng = np.random.default_rng(seed)
    C = [X[rng.integers(len(X))]]
    for _ in range(k - 1):
        d = np.min(((X[:, None] - np.array(C)[None]) ** 2).sum(2), 1); C.append(X[rng.choice(len(X), p=d / d.sum())])
    C = np.array(C, float)
    for _ in range(it):
        l = ((X[:, None] - C[None]) ** 2).sum(2).argmin(1)
        for j in range(k):
            if (l == j).any(): C[j] = X[l == j].mean(0)
    return C

def clean(img, holes=False, halo=2):
    """Quantize to the picture's own palette and remove the JPEG ringing between dots."""
    rgb = np.array(img.convert('RGB')); alpha = remove_background(rgb, holes, halo)
    px = rgb[alpha].astype(float); sample = px[np.random.default_rng(1).choice(len(px), min(len(px), 6000), replace=False)]
    C = kmeans(sample, 28)
    idx = np.zeros(alpha.shape, np.uint8)
    flat = rgb.reshape(-1, 3).astype(float)
    for s in range(0, len(flat), 200000):
        idx.reshape(-1)[s:s + 200000] = ((flat[s:s + 200000, None] - C[None]) ** 2).sum(2).argmin(1)
    pimg = Image.fromarray(idx, 'L').filter(ImageFilter.ModeFilter(5))
    idx = np.array(pimg)
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = C[idx].round().astype(np.uint8); out[..., 3] = np.where(alpha, 255, 0)
    am = Image.fromarray(out[..., 3]).filter(ImageFilter.ModeFilter(5)); out[..., 3] = np.array(am)
    return Image.fromarray(out, 'RGBA')

def fit(img):
    bbox = img.getchannel('A').getbbox(); img = img.crop(bbox)
    s = min((SIZE - 2 * MARGIN) / img.width, (BASE - MARGIN) / img.height)
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.NEAREST)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(img, ((SIZE - img.width) // 2, BASE - img.height), img)
    return canvas

# ── back views ──
def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
def auto_face(a):
    """Find the eyes: small dark blobs fully surrounded by body colour, in pairs at the same height."""
    rgb, al = a[..., :3].astype(int), a[..., 3] > 0
    L = rgb.mean(2); dark = al & (L < 70)
    # dark pixels connected to the outside are the outline, not eyes
    h, w = al.shape; outside = np.zeros((h, w), bool); q = deque()
    for y in range(h):
        for x in range(w):
            if not al[y, x] and (y in (0, h - 1) or x in (0, w - 1)): outside[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not outside[ny, nx] and (not al[ny, nx] or dark[ny, nx]):
                outside[ny, nx] = True; q.append((ny, nx))
    inner = dark & ~outside
    lab = np.zeros((h, w), int); blobs = []
    for y in range(h):
        for x in range(w):
            if inner[y, x] and not lab[y, x]:
                pts = []; q = deque([(y, x)]); lab[y, x] = len(blobs) + 1
                while q:
                    cy, cx = q.popleft(); pts.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and inner[ny, nx] and not lab[ny, nx]: lab[ny, nx] = len(blobs) + 1; q.append((ny, nx))
                ys, xs = zip(*pts); blobs.append((min(xs), min(ys), max(xs), max(ys), len(pts)))
    cand = [b for b in blobs if 150 < b[4] < 6000 and (b[2] - b[0]) < 90 and (b[3] - b[1]) < 90]
    best = None
    for i in range(len(cand)):
        for j in range(i + 1, len(cand)):
            A, B = cand[i], cand[j]
            cyA, cyB = (A[1] + A[3]) / 2, (B[1] + B[3]) / 2; gap = abs((A[0] + A[2]) / 2 - (B[0] + B[2]) / 2)
            if abs(cyA - cyB) < 20 and 40 < gap < 260 and abs(A[4] - B[4]) < max(A[4], B[4]) * .6:
                score = A[4] + B[4]
                if not best or score > best[0]: best = (score, A, B)
    if not best: return None
    _, A, B = best
    x0, y0, x1, y1 = min(A[0], B[0]), min(A[1], B[1]), max(A[2], B[2]), max(A[3], B[3])
    eh = y1 - y0
    return [x0 - 26, y0 - 18, x1 + 26, y1 + max(48, eh)]

def feature_mask(region):
    rgb = region[..., :3].astype(int); L = rgb.mean(2); sat = rgb.max(2) - rgb.min(2)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dark = L < 80                                   # eyes, mouth
    glint = (L > 205) & (sat < 45)                  # eye highlights
    blush = (r > 180) & (r - g > 45) & ((b > 100) | ((b > 60) & (g > 80)))    # pink or coral cheeks
    return (region[..., 3] > 0) & (dark | glint | blush)

def edge_mask(a):
    al = a[..., 3] > 0; keep = al.copy()
    for d in (1, 4, 8):
        for ax in (0, 1):
            keep &= np.roll(al, d, ax) & np.roll(al, -d, ax)
    return al & ~keep

def erase_face(img, box, fill=None):
    """Paint over eyes, highlights, mouth and blush inside box with the body colour beside them (row by row)."""
    a = np.array(img).copy(); x0, y0, x1, y1 = [int(v) for v in box]
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(SIZE - 1, x1), min(SIZE - 1, y1)
    region = a[y0:y1 + 1, x0:x1 + 1]
    mask = feature_mask(region) & ~edge_mask(a)[y0:y1 + 1, x0:x1 + 1]
    if fill:
        region[mask, :3] = tuple(int(fill[i:i + 2], 16) for i in (1, 3, 5))
    else:
        h, w = mask.shape
        # only borrow from the main body colours (not from the thin edge colours around a cheek or an eye)
        cnt = Counter(tuple(region[y, x, :3]) for y in range(h) for x in range(w) if not mask[y, x] and region[y, x, 3] > 0)
        total = sum(cnt.values()) or 1
        body = {c for c, n in cnt.items() if n / total >= .06} or {c for c, _ in cnt.most_common(2)}
        isbody = lambda px: tuple(px[:3]) in body
        for y in range(h):
            row = region[y]; m = mask[y]
            good = [x for x in range(w) if not m[x] and row[x, 3] > 0 and isbody(row[x])]
            for x in range(w):
                if not m[x]: continue
                left = max([g for g in good if g < x], default=None); right = min([g for g in good if g > x], default=None)
                src = left if right is None else right if left is None else (left if x - left <= right - x else right)
                if src is None:  # nothing beside it on this row: look up and down
                    for dy in range(1, h):
                        for yy in (y - dy, y + dy):
                            if 0 <= yy < h and not mask[yy, x] and region[yy, x, 3] > 0 and isbody(region[yy, x]): src = ('v', yy); break
                        if src is not None: break
                if isinstance(src, tuple): row[x, :3] = region[src[1], x, :3]
                elif src is not None: row[x, :3] = row[src, :3]
    a[y0:y1 + 1, x0:x1 + 1] = region
    return Image.fromarray(a, 'RGBA')

def paint_solid(img, box, color):
    """Cover a whole area (for example a face seen from behind becomes hair)."""
    a = np.array(img).copy(); x0, y0, x1, y1 = [int(v) for v in box]
    region = a[y0:y1 + 1, x0:x1 + 1]; m = (region[..., 3] > 0) & ~edge_mask(a)[y0:y1 + 1, x0:x1 + 1]
    c = np.array([int(color[i:i + 2], 16) for i in (1, 3, 5)])
    shade = region[..., :3].astype(int).mean(2, keepdims=True) / 160.0  # keep a little of the original light and dark
    region[m, :3] = (c * np.clip(.75 + .35 * (shade - .6), .6, 1.15))[m].clip(0, 255).astype(np.uint8)
    a[y0:y1 + 1, x0:x1 + 1] = region
    return Image.fromarray(a, 'RGBA')

def back_view(front, cfg):
    img = front
    if cfg.get('side'):
        return img.transpose(Image.FLIP_LEFT_RIGHT)
    for box, color in cfg.get('solid', []): img = paint_solid(img, box, color)
    box = cfg.get('face') if 'face' in cfg else auto_face(np.array(img))
    if box: img = erase_face(img, box, cfg.get('fill'))
    img = img.transpose(Image.FLIP_LEFT_RIGHT)
    # the far side is a little darker
    a = np.array(img).astype(float); a[..., :3] *= .9
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')

def main(folder):
    backs_path = os.path.join(ROOT, 'scripts', 'monster-backs.json')
    backs = json.load(open(backs_path, encoding='utf-8')) if os.path.exists(backs_path) else {}
    os.makedirs(os.path.join(OUT, 'back'), exist_ok=True); done = []
    for name in sorted(os.listdir(folder)):
        m = re.match(r'\s*(\d+)\s*(.*)\.(jpe?g|png)$', name, re.I)
        if not m: continue
        num = int(m.group(1)); key = f'{num:03d}'
        src = Image.open(os.path.join(folder, name))
        front = fit(clean(src))
        front.save(os.path.join(OUT, key + '.png'), optimize=True)
        cfg = backs.get(key, {})
        back_view(front, cfg).save(os.path.join(OUT, 'back', key + '.png'), optimize=True)
        done.append(f'{key} {m.group(2).strip()}')
    print('imported', len(done)); print('\n'.join(done))

if __name__ == '__main__':
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    main(sys.argv[1])
