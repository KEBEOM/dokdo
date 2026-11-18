"""주인공·김박사 큰 그림 가져오기 (v0.33)
※ v0.72: 게임은 아래 세 파일을 큰 그림으로 그대로 써요(art/ASEPRITE-가이드.md).

    python scripts/import-heroes.py 여학생.png 남학생.png 김박사.png      # Pillow, numpy 필요

흰 배경을 지우고 그림 색을 정리한 뒤 512 칸(발끝 기준)에 맞춰
  dist/assets/characters/explorer-girl-portrait-v33.png   캐릭터 선택 창
  dist/assets/characters/explorer-boy-portrait-v33.png    캐릭터 선택 창
  dist/assets/characters/professor-portrait-v33.png       김박사를 처음 만날 때, 스타팅 우산몬 소개
로 저장합니다.
"""
import os, sys, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def load(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), os.path.join(ROOT, 'scripts', name + '.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod
im = load('image-cleanup')
from PIL import Image
import numpy as np

def trim_rim(img, passes=3):
    # peel the thin light-grey rim some pictures keep around the figure
    a = np.array(img); al = a[..., 3] > 0; rgb = a[..., :3].astype(int)
    light = (rgb.mean(2) > 190) & ((rgb.max(2) - rgb.min(2)) < 30)
    for _ in range(passes):
        out = ~al; edge = al & (np.roll(out, 1, 0) | np.roll(out, -1, 0) | np.roll(out, 1, 1) | np.roll(out, -1, 1))
        al &= ~(edge & light)
    a[..., 3] = np.where(al, 255, 0); return Image.fromarray(a, 'RGBA')

def drop_slivers(img):
    # thin white strips left where the white background shows between hair, arms and body
    from scipy import ndimage
    a = np.array(img); rgb = a[..., :3].astype(int)
    white = (a[..., 3] > 0) & (rgb.mean(2) > 205) & ((rgb.max(2) - rgb.min(2)) < 40)
    lab, n = ndimage.label(white)
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if min(h, w) <= 5 and max(h, w) >= 3 * min(h, w): a[..., 3][lab == i] = 0
    return Image.fromarray(a, 'RGBA')

if __name__ == '__main__':
    if len(sys.argv) != 4: print(__doc__); sys.exit(1)
    names = ['explorer-girl-portrait-v33', 'explorer-boy-portrait-v33', 'professor-portrait-v33']
    for name, path in zip(names, sys.argv[1:]):
        out = os.path.join(ROOT, 'dist', 'assets', 'characters', name + '.png')
        pic = im.fit(trim_rim(im.clean(Image.open(path), holes=True, halo=3)))
        if name.startswith('explorer'): pic = drop_slivers(pic)  # the 김박사 armband has white letters
        pic.save(out, optimize=True); print('saved', out)
