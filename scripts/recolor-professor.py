"""김박사 걷기 시트 색 맞추기 (v0.33)

    python scripts/recolor-professor.py        # Pillow, numpy 필요

사용자가 그린 김박사 그림(올리브색 모자, 초록 조끼)에 맞춰
dist/assets/characters/professor-atlas-v19.png 의 카키색을 바꿔
dist/assets/characters/professor-atlas-v33.png 로 저장합니다.
  - 칸마다 위쪽 40%(모자)의 카키색 → 올리브색 모자
  - 아래쪽(옷)의 카키색 → 초록 조끼, 앞·뒷모습에서는 양쪽 바깥(팔)을 주황 소매로
명암은 원래 밝기를 따라가므로 도트 모양은 그대로입니다.
"""
import json, os, re
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'dist', 'assets', 'characters', 'professor-atlas-v19.png')
OUT = os.path.join(ROOT, 'dist', 'assets', 'characters', 'professor-atlas-v33.png')
CAP, VEST, SLEEVE = np.array([118, 112, 78]), np.array([70, 98, 64]), np.array([214, 112, 52])   # colours taken from the picture
KHAKI_LUM = 160.0                                              # the sprite's main khaki brightness

def main():
    js = open(os.path.join(ROOT, 'dist', 'npc-atlases.js'), encoding='utf-8').read()
    atlas = json.loads(re.search(r'"professor":(\{.*?"frames":\[\[.*?\]\]\})', js).group(1))
    a = np.array(Image.open(SRC).convert('RGBA')).astype(float)
    rgb = a[..., :3]; mx, mn = rgb.max(2), rgb.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    hue_ok = (rgb[..., 0] >= rgb[..., 1]) & (rgb[..., 1] >= rgb[..., 2]) & (rgb[..., 0] - rgb[..., 2] < 90)
    khaki = (a[..., 3] > 0) & hue_ok & (sat > .12) & (sat < .45) & (mx > 70)
    skin = (rgb[..., 0] - rgb[..., 1] > 45)                     # faces and hands stay as they are
    khaki &= ~skin
    lum = rgb @ np.array([.299, .587, .114])
    side_row = atlas['rows']['right']
    for r, row in enumerate(atlas['frames']):
        for f in row:
            x, y, w, h = f['rect']; cut = y + int(h * .40)
            for y0, y1, colour in ((y, cut, CAP), (cut, y + h, VEST)):
                m = khaki[y0:y1, x:x + w]
                shade = np.clip(lum[y0:y1, x:x + w] / KHAKI_LUM, .35, 1.4)[..., None]
                paint = np.broadcast_to(colour, m.shape + (3,)).astype(float)
                if colour is VEST and r != side_row:  # front and back: the outer parts of each row are sleeves
                    cols = np.where(m.any(0))[0]
                    if len(cols):
                        left, right = cols[0], cols[-1]; arm = (right - left) * .22
                        xs = np.arange(m.shape[1])[None, :, None]
                        paint = np.where((xs <= left + arm) | (xs >= right - arm), SLEEVE, paint)
                rgb[y0:y1, x:x + w][m] = np.clip(paint * shade, 0, 255)[m]
    a[..., :3] = rgb
    Image.fromarray(a.round().astype(np.uint8), 'RGBA').save(OUT, optimize=True); print('saved', OUT)

if __name__ == '__main__':
    main()
