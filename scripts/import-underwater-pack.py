#!/usr/bin/env python3
"""「독도 탐험대 바닷속 HD-2D 에셋 v1」을 게임 그림으로 가져와요 (v0.87).

  python3 scripts/import-underwater-pack.py <압축 푼 팩 폴더(manifest.json 이 있는 곳)>
  → dist/assets/scenery/uw-floor.png   해저 바닥 32×32 타일 12장(가로 한 줄). 시안 타일이라 테두리 1px을 잘라 30→32로 늘리고 알파를 채워요 · v0.90 이음매 없게(scripts/seamless_tex.py)
    dist/assets/scenery/uw-atlas.png   바다풀·바위·생물·물고기 그림(게임 크기로 줄이고 색 수를 줄여요)
    dist/uw-atlas.js                   자리 표(UW_ATLAS · UW_FLOOR)

팩 그림은 게임 크기보다 2~3배 커요. 종류마다 정한 게임 크기로 미리 곱한 알파로 줄이고(LANCZOS) → 색 수 줄이기(무늬 섞기 없음) → 알파 0/255.
팩에 이미 진한 외곽선이 있어서 테두리를 더 붙이지 않아요. 원본 팩은 바꾸지 않아요.
"""
import importlib.util, json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = sys.argv[1] if len(sys.argv) > 1 else ''
# 게임 크기(가로 px, 지도 1칸 = 32px, 캐릭터 키 48px)
# v0.90 바닥 타일 깊이 무리(띠): 얕은 모래 → 자갈·해조 → 빛무늬 → 깊은 바닥
FLOOR_BANDS = [('sand_shallow',), ('sand_rocks', 'sand_seaweed'), ('sand_sunlight',), ('sand_deep',)]
SIZE = {
  'kelp_tall_01': 54, 'kelp_tall_02': 52, 'kelp_medium_01': 42, 'kelp_medium_02': 40, 'kelp_short_01': 34, 'kelp_short_02': 30,
  'pink_soft_coral': 34, 'green_algae_on_rocks': 42, 'soft_coral_on_rocks_01': 58, 'soft_coral_on_rocks_02': 56,
  'basalt_formation_large': 124, 'basalt_formation_small': 60, 'basalt_boulder': 54, 'basalt_hex_columns': 60, 'basalt_low_ledge': 76,
  'basalt_natural_arch': 132, 'basalt_sea_cave': 136, 'basalt_tall_pillars': 66,
  'abalone_open_01': 26, 'abalone_open_02': 24, 'sea_urchin_large': 22, 'sea_urchin_small': 15, 'crab_green': 28, 'crab_red': 28, 'octopus': 46,
  'whelk_shell': 19, 'whelk_shell_hollow': 18, 'scallop_shell': 17, 'snail_shell': 15, 'basalt_pebbles': 42, 'air_bubbles': 14,
  'fish_school_01': 92, 'fish_school_02': 92, 'rockfish_large': 54, 'rockfish_small': 38, 'yellowtail_large': 80,
}
for i in range(1, 13): SIZE[f'basalt_cliff_edge_{i:02d}'] = 34

def premul_resize(im, w, h):
    a = np.asarray(im.convert('RGBA'), dtype=np.float32) / 255.0
    rgb, al = a[..., :3] * a[..., 3:4], a[..., 3:4]; out = []
    for ch in range(4):
        src = rgb[..., ch] if ch < 3 else al[..., 0]
        out.append(np.asarray(Image.fromarray((src * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS), np.float32) / 255.0)
    rgb2 = np.stack(out[:3], -1); al2 = out[3][..., None]
    rgb2 = np.where(al2 > 1e-3, rgb2 / np.maximum(al2, 1e-3), 0)
    return np.concatenate([np.clip(rgb2, 0, 1), al2], -1)

def sprite(im, w, colors=48):
    h = max(1, round(im.height * w / im.width)); a = premul_resize(im, w, h); alpha = a[..., 3] >= .5; rgb = (a[..., :3] * 255).astype(np.uint8)
    if alpha.any():
        fill = rgb[alpha].mean(axis=0).astype(np.uint8); rgb2 = rgb.copy(); rgb2[~alpha] = fill
        rgb = np.asarray(Image.fromarray(rgb2).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')).copy()
    out = np.zeros((h, w, 4), np.uint8); out[..., :3] = rgb; out[..., 3] = np.where(alpha, 255, 0)
    ys, xs = np.nonzero(out[..., 3]);  # 투명 여백 잘라 내기(바닥 닿는 점 = 그림 아랫변 가운데)
    return Image.fromarray(out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')

def main():
    if not PACK or not os.path.exists(os.path.join(PACK, 'manifest.json')): sys.exit('바닷속 에셋 팩 폴더(manifest.json 이 있는 곳)를 알려 주세요.')
    man = json.load(open(os.path.join(PACK, 'manifest.json'), encoding='utf8')); assets = man.get('assets') or man.get('sprites')
    out = os.path.join(ROOT, 'dist', 'assets', 'scenery')
    # 바닥 타일: 테두리 1px(밝은 이음매)을 잘라 30×30 → 32×32(최근접), 알파는 바탕 평균색으로 채워요
    floor_ids = sorted(a['id'] for a in assets if a.get('optional_32px_tile'))
    fl = Image.new('RGBA', (32 * len(floor_ids), 32))
    for i, k in enumerate(floor_ids):
        a = next(x for x in assets if x['id'] == k); t = Image.open(os.path.join(PACK, a['optional_32px_tile'])).convert('RGBA')
        arr = np.asarray(t).astype(np.float32); al = arr[..., 3:4] / 255.0; mean = (arr[..., :3] * al).sum((0, 1)) / max(al.sum(), 1)
        solid = (arr[..., :3] * al + mean * (1 - al)).astype(np.uint8); s = Image.fromarray(np.dstack([solid, np.full(solid.shape[:2], 255, np.uint8)]), 'RGBA')
        fl.paste(s.crop((1, 1, 31, 31)).resize((32, 32), Image.NEAREST), (i * 32, 0))
    # v0.90 이음매 없이: 깊이 무리(띠)마다 기준 타일(무리 평균을 이음매 없게)을 만들고, 타일마다 이음매 없게 한 뒤 가장자리 3px를 기준과 같게.
    # 같은 띠의 타일은 어떤 순서로 붙여도 이어지고, 띠가 바뀌는 곳은 게임(terrain.js)이 색을 섞어 부드럽게 넘겨요.
    spec = importlib.util.spec_from_file_location('seamless_tex', os.path.join(ROOT, 'scripts', 'seamless_tex.py')); st = importlib.util.module_from_spec(spec); spec.loader.exec_module(st)
    tiles = {k: np.asarray(fl.crop((i * 32, 0, i * 32 + 32, 32)).convert('RGB'), np.float32) for i, k in enumerate(floor_ids)}
    band_of = {k: next(b for b, pre in enumerate(FLOOR_BANDS) if any(k.startswith(p) for p in pre)) for k in floor_ids}
    bases = [st.seamless(np.mean([tiles[k] for k in floor_ids if band_of[k] == b], axis=0)) for b in range(len(FLOOR_BANDS))]
    fl = Image.new('RGBA', (32 * len(floor_ids), 32))
    for i, k in enumerate(floor_ids):
        t = st.match_border(st.seamless(tiles[k]), bases[band_of[k]]); fl.paste(Image.fromarray(np.clip(t, 0, 255).astype(np.uint8), 'RGB').convert('RGBA'), (i * 32, 0))
    band_color = ['#%02x%02x%02x' % tuple(int(v) for v in b.reshape(-1, 3).mean(0)) for b in bases]
    fl.save(os.path.join(out, 'uw-floor.png'), optimize=True)
    pics, cat = {}, {}
    for a in assets:
        if a['id'] not in SIZE: continue
        pics[a['id']] = sprite(Image.open(os.path.join(PACK, a['file'])), SIZE[a['id']]); cat[a['id']] = a['category']
    W, x, y, rowh, frames = 512, 0, 0, 0, {}
    for k, p in sorted(pics.items(), key=lambda kv: -kv[1].height):
        if x + p.width > W: x, y, rowh = 0, y + rowh + 2, 0
        frames[k] = [x, y, p.width, p.height]; x += p.width + 2; rowh = max(rowh, p.height)
    sheet = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for k, p in pics.items(): sheet.alpha_composite(p, tuple(frames[k][:2]))
    sheet.save(os.path.join(out, 'uw-atlas.png'), optimize=True)
    with open(os.path.join(ROOT, 'dist', 'uw-atlas.js'), 'w', encoding='utf8') as f:
        f.write('// 「독도 탐험대 바닷속 HD-2D 에셋 v1」 그림(scripts/import-underwater-pack.py가 만들어요). 잠수했을 때만 불러요.\n')
        f.write('// 그림 판: 1픽셀 = 지도 1픽셀, 바닥 닿는 점은 아랫변 가운데. 물고기는 오른쪽을 봐요(왼쪽은 뒤집어요).\n')
        f.write('export const UW_ATLAS = ' + json.dumps({'key': 'scenery/uw-atlas', 'width': W, 'height': y + rowh, 'frames': frames, 'cat': cat}) + ';\n')
        f.write('export const UW_FLOOR = ' + json.dumps({'key': 'scenery/uw-floor', 'ids': floor_ids, 'band': band_of, 'bandColor': band_color, 'seamless': True}) + ';\n')
    print('floor', len(floor_ids), '· sprites', len(frames), 'atlas', W, y + rowh)

if __name__ == '__main__':
    main()
