"""백무단 전투 등장 그림 가져오기 (v0.27)

    python scripts/import-portraits.py 부하.jpg 간부.jpg 보스.jpg      # Pillow, numpy 필요

흰 배경을 지우고 JPG 얼룩을 정리해 같은 키(512 칸, 발끝 기준)로 맞춘 뒤
dist/assets/characters/baekmudan-{grunt,exec,boss}-portrait.png 로 저장합니다.
전투에서 백무단이 나타날 때 잠깐 보였다가, 우산몬을 내보내면 사라집니다.
"""
import os, sys, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('im', os.path.join(ROOT, 'scripts', 'import-monsters.py'))
im = importlib.util.module_from_spec(spec); spec.loader.exec_module(im)
from PIL import Image
import numpy as np
def trim_rim(img, passes=4):
    # some pictures have a thin white rim around the figure: peel light-grey edge pixels away
    a = np.array(img); al = a[..., 3] > 0; rgb = a[..., :3].astype(int)
    light = (rgb.mean(2) > 185) & ((rgb.max(2) - rgb.min(2)) < 40)
    for _ in range(passes):
        out = ~al; edge = al & (np.roll(out, 1, 0) | np.roll(out, -1, 0) | np.roll(out, 1, 1) | np.roll(out, -1, 1))
        al &= ~(edge & light)
    a[..., 3] = np.where(al, 255, 0); return Image.fromarray(a, 'RGBA')
if len(sys.argv) != 4: print(__doc__); sys.exit(1)
for role, path in zip(['grunt', 'exec', 'boss'], sys.argv[1:]):
    out = os.path.join(ROOT, 'dist', 'assets', 'characters', f'baekmudan-{role}-portrait.png')
    im.fit(trim_rim(im.clean(Image.open(path), holes=True, halo=3))).save(out, optimize=True); print('saved', out)
