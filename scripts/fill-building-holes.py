#!/usr/bin/env python3
"""v0.68: 건물 그림 안쪽의 비치는 구멍(문틀 그늘, 간판 아래 그늘 줄)을 메워요.
1) 반투명 그늘 픽셀 중 위·아래와 왼쪽·오른쪽 모두에 불투명 픽셀이 있는 것(건물 안쪽)은
   같은 줄 왼쪽의 불투명 벽 색 위에 겹쳐 불투명하게 만들어요. 땅에 드리운 그늘(맨 아래 줄)은 그대로예요.
2) 그림 바깥과 이어지지 않은 완전 투명 픽셀은 옆 불투명 색 중 가장 어두운 색으로 칠해요.
구멍이 남아 있으면 2D·3D 모두 뒤의 땅이 비쳐 보여요. 여러 번 돌려도 결과가 같아요."""
import json, re, sys
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
atlas_js = (ROOT / 'dist/island-atlas.js').read_text(encoding='utf8')
A = json.loads(atlas_js[atlas_js.index('{'):atlas_js.rindex('}') + 1])
path = ROOT / 'dist/assets' / (A['key'] + '.png')
im = Image.open(path).convert('RGBA'); px = im.load(); total = 0
for key, (x0, y0, w, h) in A['frames'].items():
    if not re.match(r'(ulleung|dokdo)-', key): continue
    op = lambda x, y: px[x0 + x, y0 + y][3] == 255
    for y in range(h):
        row = [x for x in range(w) if op(x, y)]
        if not row: continue
        for x in range(row[0] + 1, row[-1]):
            r, g, b, a = px[x0 + x, y0 + y]
            if a in (0, 255) or not any(op(x, yy) for yy in range(y)) or not any(op(x, yy) for yy in range(y + 1, h)): continue
            bx = next(xx for xx in range(x - 1, -1, -1) if op(xx, y)); br, bg, bb, _ = px[x0 + bx, y0 + y]; t = a / 255
            px[x0 + x, y0 + y] = (round(r * t + br * (1 - t)), round(g * t + bg * (1 - t)), round(b * t + bb * (1 - t)), 255); total += 1
    seen = set(); q = deque()
    for x in range(w):
        for y in (0, h - 1): q.append((x, y))
    for y in range(h):
        for x in (0, w - 1): q.append((x, y))
    while q:  # 바깥 테두리에서 투명한 곳을 따라 들어가요
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h) or px[x0 + x, y0 + y][3] > 0: continue
        seen.add((x, y)); q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    holes = [(x, y) for y in range(h) for x in range(w) if px[x0 + x, y0 + y][3] == 0 and (x, y) not in seen]
    for _ in range(64):  # 가장자리부터 안쪽으로 차례로 메워요
        if not holes: break
        left = []
        for x, y in holes:
            near = [px[x0 + a, y0 + b] for a, b in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= a < w and 0 <= b < h and px[x0 + a, y0 + b][3] > 0]
            if near: px[x0 + x, y0 + y] = min(near, key=lambda c: c[0] + c[1] + c[2])[:3] + (255,); total += 1
            else: left.append((x, y))
        holes = left
    print(key, 'filled')
im.save(path); print('pixels filled', total)
