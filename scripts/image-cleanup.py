"""그림 정리 도구 (import-heroes.py · import-portraits.py가 함께 써요)

흰 배경을 투명하게 지우고(remove_background·clean), JPG 얼룩을 줄인 뒤(kmeans),
512×512 칸의 같은 자리(발끝 기준)에 놓아요(fit). v0.41에서 예전 우산몬 가져오기(import-monsters.py)에서 떼어 냈어요.
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
