#!/usr/bin/env python3
"""「독도 탐험대 v0.81 에셋 팩」의 PNG(이야기 건물 12 · 식물 10 · 실내 20)를 게임 그림으로 가져와요 (v0.82).

  python3 scripts/import-v081-pack.py <압축 푼 팩 폴더(manifest.json 이 있는 곳)>
  → dist/assets/scenery/story-atlas.png   건물·식물 그림 판(최종 1배 크기 + 1px 테두리)
    dist/assets/scenery/interior-hd.png   실내 재질(종류마다 한 줄: 벽 민무늬·창문·게시판 32×48, 벽 윗면·바닥 32×32)
    dist/story-atlas.js                   자리 표

팩 원본은 최종 크기의 가로·세로 4배예요. 미리 곱한 알파로 줄이고(LANCZOS) → 색 수 줄이기(무늬 섞기 없음) →
알파를 0/255로 다시 자르고 → 최종 1배 크기에서만 바깥 1px 테두리를 붙여요(캔버스를 1px씩 넓히고 발 자리를 같이 옮겨요).
실내 타일은 꽉 찬 사각형(알파 255)이라 테두리 없이 줄이기만 해요. checks/·previews/ 폴더는 읽지 않아요.
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = sys.argv[1] if len(sys.argv) > 1 else ''
INK = (32, 30, 34)

def premul_resize(im, w, h):
    a = np.asarray(im.convert('RGBA'), dtype=np.float32) / 255.0
    rgb, al = a[..., :3] * a[..., 3:4], a[..., 3:4]
    out = []
    for ch in range(4):
        src = rgb[..., ch] if ch < 3 else al[..., 0]
        out.append(np.asarray(Image.fromarray((src * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS), np.float32) / 255.0)
    rgb2 = np.stack(out[:3], -1); al2 = out[3][..., None]
    rgb2 = np.where(al2 > 1e-3, rgb2 / np.maximum(al2, 1e-3), 0)
    return np.concatenate([np.clip(rgb2, 0, 1), al2], -1)

def sprite(im, w, h, colors=40):
    a = premul_resize(im, w, h); alpha = a[..., 3] >= .5; rgb = (a[..., :3] * 255).astype(np.uint8)
    if alpha.any():
        fill = rgb[alpha].mean(axis=0).astype(np.uint8); rgb2 = rgb.copy(); rgb2[~alpha] = fill
        rgb = np.asarray(Image.fromarray(rgb2).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')).copy()
    out = np.zeros((h + 2, w + 2, 4), np.uint8); out[1:-1, 1:-1, :3] = rgb; out[1:-1, 1:-1, 3] = np.where(alpha, 255, 0)
    al = out[..., 3] > 0; pad = np.pad(al, 1); edge = (~al) & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
    out[edge] = (*INK, 255)
    return Image.fromarray(out, 'RGBA')

def tile(im, w, h, colors=24):
    t = im.convert('RGB').resize((w, h), Image.LANCZOS)
    return t.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')

def main():
    if not PACK or not os.path.exists(os.path.join(PACK, 'manifest.json')): sys.exit('v0.81 에셋 팩 폴더(manifest.json 이 있는 곳)를 알려 주세요.')
    man = json.load(open(os.path.join(PACK, 'manifest.json'), encoding='utf8'))
    pics, meta = {}, {}
    for a in man['assets']:
        if a['kind'] not in ('story', 'flora'): continue
        w, h = a['final_size_px']; src = Image.open(os.path.join(PACK, a['file']))
        assert src.size == (w * 4, h * 4), (a['id'], src.size)
        pics[a['id']] = sprite(src, w, h); meta[a['id']] = {'name': a.get('name'), 'kind': a['kind'], 'status': a.get('status'), 'fictional': a.get('fictional', False), 'inference': a.get('inference', '')}
    W, x, y, rowh, frames = 1024, 0, 0, 0, {}
    for k, p in sorted(pics.items(), key=lambda kv: -kv[1].height):
        if x + p.width > W: x, y, rowh = 0, y + rowh + 2, 0
        frames[k] = [x, y, p.width, p.height]; x += p.width + 2; rowh = max(rowh, p.height)
    sheet = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for k, p in pics.items(): sheet.alpha_composite(p, tuple(frames[k][:2]))
    out = os.path.join(ROOT, 'dist', 'assets', 'scenery'); sheet.save(os.path.join(out, 'story-atlas.png'), optimize=True)
    # 실내: 종류마다 한 줄 [민무늬 · 창문 · 게시판](32×48) [벽 윗면 · 바닥](32×32)
    kinds = ['home', 'shop', 'lab', 'gym']; parts = ['wall_plain', 'wall_window', 'wall_board', 'walltop', 'floor']; inter = Image.new('RGBA', (160, 48 * 4)); irects = {}
    for r, k in enumerate(kinds):
        for c, part in enumerate(parts):
            a = next(a for a in man['assets'] if a['id'] == f'interior_{k}_{part}'); w, h = a['final_size_px']
            src = Image.open(os.path.join(PACK, a['file'])); assert src.size == (w * 4, h * 4)
            inter.paste(tile(src, w, h), (c * 32, r * 48)); irects[f'{k}_{part}'] = [c * 32, r * 48, w, h]
    inter.save(os.path.join(out, 'interior-hd.png'), optimize=True)
    with open(os.path.join(ROOT, 'dist', 'story-atlas.js'), 'w', encoding='utf8') as f:
        f.write('// 「독도 탐험대 v0.81 에셋 팩」 그림(scripts/import-v081-pack.py가 만들어요). 그림 판: 1픽셀 = 지도 1픽셀, 발 자리는 아랫변 가운데(테두리 1px 포함).\n')
        f.write('// story_*는 모두 이야기용 창작 시설이에요(실제 독도경비대·등대·주민숙소의 역할과 섞지 않아요).\n')
        f.write('export const STORY_ATLAS = ' + json.dumps({'key': 'scenery/story-atlas', 'width': W, 'height': y + rowh, 'frames': frames}) + ';\n')
        f.write('export const STORY_META = ' + json.dumps(meta, ensure_ascii=False) + ';\n')
        f.write('export const INTERIOR_HD = ' + json.dumps({'key': 'scenery/interior-hd', 'width': 160, 'height': 192, 'rects': irects}) + ';\n')
    print('story/flora', len(frames), 'atlas', W, y + rowh, '· interior', len(irects))

if __name__ == '__main__':
    main()
