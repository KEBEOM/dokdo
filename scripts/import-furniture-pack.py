#!/usr/bin/env python3
"""「가구·표지판·해안 벽 확장팩」 + 「울릉도·독도 지상·수중 지역 상세 에셋 v2」의 그림을 게임 그림으로 가져와요 (v0.88).

  python3 -I scripts/import-furniture-pack.py <가구·표지판 팩 폴더> <지상·수중 v2 팩 폴더>
  → dist/assets/scenery/furniture-atlas.png  가구 16 · 빈 표지판 4 · 항구 소품 4 (최종 1배 크기 + 1px 테두리)
    dist/assets/scenery/region-atlas.png     지상 지역 그림 12 (관찰용 외관 · 최종 1배 크기 + 1px 테두리)
    dist/assets/scenery/uw-walls.png         바닷속 벽 재질 2장: 항구 콘크리트 안벽 앞면 · 자연 암벽 가운데 (128×128 씩, 이어 붙이기용)
    dist/furniture-atlas.js                  자리 표 · 이름 · 최종 크기

팩 원본은 최종 크기의 4배예요. import-v081-pack.py와 같은 방법(미리 곱한 알파로 LANCZOS 축소 → 색 수 줄이기 →
알파 0/255 → 1px 테두리)으로 줄여요. 팩의 GLB·배치 예시(layouts·scenes)는 게임 지도에 그대로 덮어쓰지 않아요.
"""
import importlib.util, json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_s = importlib.util.spec_from_file_location('seamless_tex', os.path.join(ROOT, 'scripts', 'seamless_tex.py')); st = importlib.util.module_from_spec(_s); _s.loader.exec_module(st)
spec = importlib.util.spec_from_file_location('v081', os.path.join(ROOT, 'scripts', 'import-v081-pack.py')); v081 = importlib.util.module_from_spec(spec); spec.loader.exec_module(v081)

def pack_sheet(pics, W):
    x = y = rowh = 0; frames = {}
    for k, p in sorted(pics.items(), key=lambda kv: (-kv[1].height, kv[0])):
        if x + p.width > W: x, y, rowh = 0, y + rowh + 2, 0
        frames[k] = [x, y, p.width, p.height]; x += p.width + 2; rowh = max(rowh, p.height)
    sheet = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for k, p in pics.items(): sheet.alpha_composite(p, tuple(frames[k][:2]))
    return sheet, frames

def wall_strip(src, box, w, h):
    """벽 그림의 앞면 한 부분을 꽉 찬 재질(알파 255)로 잘라 줄여요."""
    crop = src.convert('RGBA').crop(box); rgb = Image.new('RGB', crop.size, (60, 62, 64)); rgb.paste(crop, mask=crop.split()[3])
    t = np.asarray(v081.tile(rgb, w, h, colors=32).convert('RGB'), np.float32)
    return Image.fromarray(np.clip(st.seamless(t), 0, 255).astype(np.uint8), 'RGB').convert('RGBA') # v0.90 가로·세로 이음매 없이(scripts/seamless_tex.py)

def main():
    if len(sys.argv) < 3: sys.exit('가구·표지판 팩 폴더와 지상·수중 v2 팩 폴더를 알려 주세요.')
    fsc, luv = sys.argv[1], sys.argv[2]
    mf = json.load(open(os.path.join(fsc, 'manifest.json'), encoding='utf8')); ml = json.load(open(os.path.join(luv, 'manifest.json'), encoding='utf8'))
    pics, meta = {}, {}
    for a in mf['assets']:
        if a['category'] in ('항구 수중 벽', '자연 해안 수중 벽'): continue
        w, h = a['final_size_px']; src = Image.open(os.path.join(fsc, a['sprite'])); assert src.size == (w * 4, h * 4), (a['id'], src.size)
        pics[a['id']] = v081.sprite(src, w, h); meta[a['id']] = {'name': a['name'], 'cat': a['category'], 'size': [w, h], 'tiles': a['model_size_tiles_xyz']}
    out = os.path.join(ROOT, 'dist', 'assets', 'scenery')
    fsheet, fframes = pack_sheet(pics, 512); fsheet.save(os.path.join(out, 'furniture-atlas.png'), optimize=True)
    rp, rmeta = {}, {}
    for a in ml['assets']:
        w, h = a['final_size_px']; src = Image.open(os.path.join(luv, a['sprite'])); assert src.size == (w * 4, h * 4), (a['id'], src.size)
        rp[a['id']] = v081.sprite(src, w, h, colors=48); rmeta[a['id']] = {'name': a['name'], 'region': a['region'], 'size': [w, h], 'observe': a.get('interaction_default', '')}
    rsheet, rframes = pack_sheet(rp, 1024); rsheet.save(os.path.join(out, 'region-atlas.png'), optimize=True)
    # 바닷속 벽: 콘크리트 안벽(앞면, 위 덮개 아래) · 자연 암벽(가운데 절벽 면)
    quay = Image.open(os.path.join(fsc, 'assets', 'wall_quay_straight.png')); cliff = Image.open(os.path.join(fsc, 'assets', 'wall_natural_cliff.png'))
    walls = Image.new('RGBA', (128, 256)); walls.paste(wall_strip(quay, (76, 120, 436, 480), 128, 128), (0, 0)); walls.paste(wall_strip(cliff, (150, 200, 470, 520), 128, 128), (0, 128))
    walls.save(os.path.join(out, 'uw-walls.png'), optimize=True)
    with open(os.path.join(ROOT, 'dist', 'furniture-atlas.js'), 'w', encoding='utf8') as f:
        f.write('// v0.88 「가구·표지판·해안 벽 확장팩」·「울릉도·독도 지상·수중 v2」 그림(scripts/import-furniture-pack.py가 만들어요). 1픽셀 = 지도 1픽셀, 발 자리는 아랫변 가운데(테두리 1px 포함).\n')
        f.write('// 가구는 이야기 속 가상 건물의 실내용이에요(실제 독도 등대·경비대·주민숙소의 내부 복원이 아니에요). 지역 그림의 실제 시설은 관찰용 외관만이에요.\n')
        f.write('export const FURN_ATLAS = ' + json.dumps({'key': 'scenery/furniture-atlas', 'width': fsheet.width, 'height': fsheet.height, 'frames': fframes}) + ';\n')
        f.write('export const FURN_META = ' + json.dumps(meta, ensure_ascii=False) + ';\n')
        f.write('export const REGION_ATLAS = ' + json.dumps({'key': 'scenery/region-atlas', 'width': rsheet.width, 'height': rsheet.height, 'frames': rframes}) + ';\n')
        f.write('export const REGION_META = ' + json.dumps(rmeta, ensure_ascii=False) + ';\n')
        f.write("export const UW_WALLS = { key: 'scenery/uw-walls', width: 128, height: 256, quay: [0, 0, 128, 128], cliff: [0, 128, 128, 128] };\n")
    print('furniture', len(fframes), fsheet.size, '· region', len(rframes), rsheet.size, '· walls 2')

if __name__ == '__main__':
    main()
