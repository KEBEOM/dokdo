#!/usr/bin/env python3
"""우산몬 그림(512×512)을 원래 도트 크기로 되돌려 한 장에 모아요 (v0.91).

  python3 -I scripts/make-monster-dots.py
  → dist/assets/monsters/dots.png   지도용 우산몬 그림: 원래 도트를 정수 배로(1도트 = 1·2·3px) — 그대로 1:1로 그려요
    dist/monster-dots.js            자리 표: id → [x, y, 가로, 세로, 도트 크기(512 그림에서 몇 px), 발 줄]

512 그림은 도트 하나를 10~20px 네모로 키운 그림이라, 지도에서 44px로 줄이면 도트가 빠지거나 굵기가 들쭉날쭉해져요.
도트 칸의 크기와 시작 자리를 찾아 칸 가운데 색만 뽑으면 원래 도트 그림이 돼요. 되돌린 그림을 다시 키워 512 그림과 비교해
98% 넘게 같을 때만 써요(아니면 그 우산몬은 목록에서 빠지고 게임이 예전처럼 줄여 그려요).
"""
import glob, json, os
from collections import Counter
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'dist', 'assets', 'monsters')
FIELD = 44  # 지도에서 512 그림을 그리던 크기(px)

def runs(key):
    out = []
    for arr in (key, key.T):
        for row in arr[::5]:
            ch = np.flatnonzero(np.diff(row)) + 1; b = np.concatenate([[0], ch, [len(row)]]); L = np.diff(b); out += [int(v) for v in L if 3 <= v <= 40]
    return out

def fit(a):
    key = (a[..., 0].astype(np.int64) << 24) | (a[..., 1].astype(np.int64) << 16) | (a[..., 2].astype(np.int64) << 8) | a[..., 3]
    al = a[..., 3] > 0; ys, xs = np.where(al); best = None
    cands = Counter(runs(key)).most_common(6)
    def tries(full):
        for d, _ in cands:
            if full:
                for ox in range(d):
                    for oy in range(d): yield d, ox, oy
            else: yield d, xs.min() % d, ys.min() % d
    for full in (False, True):
      if best and best[0] >= .98: break
      for d, ox, oy in tries(full):
        cx = np.arange(ox + d // 2, 512, d); cy = np.arange(oy + d // 2, 512, d)
        small = a[np.ix_(cy, cx)]
        up = np.repeat(np.repeat(small, d, 0), d, 1); H, W = up.shape[:2]
        ref = np.zeros_like(a); ref[oy:oy + H, ox:ox + W] = up[:512 - oy, :512 - ox]
        same = (np.all(ref == a, axis=-1) | (~al & (ref[..., 3] == 0)))[al | (ref[..., 3] > 0)].mean()
        if best is None or same > best[0]: best = (same, d, small, ox, oy)
    return best

def main():
    pics, frames = {}, {}
    for f in sorted(glob.glob(os.path.join(SRC, '[0-9][0-9][0-9]*.png'))):
        name = os.path.basename(f)[:-4]; a = np.asarray(Image.open(f).convert('RGBA'))
        same, d, small, ox, oy = fit(a)
        if same < .98: print('skip', name, round(same, 3)); continue
        al = small[..., 3] > 0; ys, xs = np.where(al); cx512, foot512 = ox + (xs.min() + xs.max() + 1) / 2 * d, oy + (ys.max() + 1) * d; small = small[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy(); small[..., 3] = np.where(small[..., 3] > 0, 255, 0)
        # 지도 크기: 예전 44px(512 그림을 44로 줄인 크기)에 가장 가깝게, 도트를 정수 배로 키우거나(굵은 도트) 칸을 건너 뽑아(아주 고운 도트) 줄여요
        t = d * FIELD / 512; up, step = (max(1, round(t)), 1) if t >= .75 else (1, max(2, round(1 / t)))
        if step > 1: small = small[step // 2::step, step // 2::step]
        img = Image.fromarray(small, 'RGBA'); img = img.resize((img.width * up, img.height * up), Image.NEAREST) if up > 1 else img
        pics[name] = (img, d, round(cx512, 1), int(foot512))
    W, x, y, rowh = 512, 0, 0, 0
    for k, (p, d, cx5, ft5) in sorted(pics.items(), key=lambda kv: (-kv[1][0].height, kv[0])):
        if x + p.width > W: x, y, rowh = 0, y + rowh + 1, 0
        frames[k] = [x, y, p.width, p.height, d, cx5, ft5]; x += p.width + 1; rowh = max(rowh, p.height)
    sheet = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for k, v in pics.items(): sheet.alpha_composite(v[0], tuple(frames[k][:2]))
    sheet.save(os.path.join(SRC, 'dots.png'), optimize=True)
    with open(os.path.join(ROOT, 'dist', 'monster-dots.js'), 'w', encoding='utf8') as fh:
        fh.write('// v0.91 지도용 우산몬 그림(scripts/make-monster-dots.py가 만들어요): 원래 도트를 정수 배로 키운 그림이라 1:1로 그리면 도트가 빠지지 않아요.\n')
        fh.write('// frames: 그림 이름 → [x, y, 가로, 세로, 512 그림의 도트 한 칸(px), 512 그림에서 몸 가운데 x, 512 그림에서 발 줄 y] · 둘레의 빈칸은 잘라 냈어요(발 = 아랫변)\n')
        fh.write('export const MONSTER_DOTS = ' + json.dumps({'key': 'monsters/dots', 'width': W, 'height': y + rowh, 'frames': frames}) + ';\n')
    print('dots', len(frames), 'sheet', W, y + rowh)

if __name__ == '__main__':
    main()
