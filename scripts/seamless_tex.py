"""이음매 없는 반복 재질 만들기(v0.90) — import-underwater-pack.py · import-furniture-pack.py가 같이 써요.

seamless(a): 그림을 반 칸 밀어 둔 그림과 섞어요. 가운데는 원래 그림, 가장자리는 밀어 둔 그림(가장자리끼리 이어져 있어요)이라
같은 그림을 이어 붙여도 이음매가 없어요. axes: 0 세로 · 1 가로.
match_border(a, base, ring): 가장자리 ring px를 기준 그림(base)과 같게 맞춰요. 같은 기준을 쓰는 타일끼리는 어떤 순서로 붙여도 이어져요.
"""
import numpy as np

def _ramp(n, inner=.35):
    x = np.abs(np.arange(n) - (n - 1) / 2) / ((n - 1) / 2)
    w = np.clip((x - inner) / (1 - inner), 0, 1)
    return w * w * (3 - 2 * w)

def seamless(a, axes=(0, 1), inner=.35):
    out = a.astype(np.float32).copy()
    if 1 in axes:
        o = np.roll(out, out.shape[1] // 2, axis=1); w = _ramp(out.shape[1], inner)[None, :, None]
        out = out * (1 - w) + o * w
    if 0 in axes:
        o = np.roll(out, out.shape[0] // 2, axis=0); w = _ramp(out.shape[0], inner)[:, None, None]
        out = out * (1 - w) + o * w
    return out

def match_border(a, base, ring=3):
    H, W = a.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
    r = np.minimum(np.minimum(xx, W - 1 - xx), np.minimum(yy, H - 1 - yy)).astype(np.float32)
    w = np.clip(1 - r / ring, 0, 1)[..., None]
    return a * (1 - w) + base * w

def seam_error(a, axes=(0, 1)):
    """이어 붙였을 때 맞닿는 두 줄의 색 차이(평균) — 검사용"""
    e = []
    if 1 in axes: e.append(np.abs(a[:, 0].astype(float) - a[:, -1].astype(float)).mean())
    if 0 in axes: e.append(np.abs(a[0].astype(float) - a[-1].astype(float)).mean())
    return max(e)
