#!/usr/bin/env python3
"""v0.96: GPT 10개 요청 묶음(DOKDO_explorers_v094_ALL)에서 게임에 쓸 그림을 가져와요.

  python3 scripts/import-v096-pack.py <DOKDO_explorers_v094_ALL 폴더> [part ...]

모든 그림은 4배 최근접 확대본으로 왔어요 → 4픽셀마다 1픽셀을 골라 실제 크기로 되돌려요(검사: 되돌린 그림을 다시 4배 하면 원본과 똑같아야 해요).
part: ground (03 땅) · cliff (05 절벽) · flora (04 식생) · seabed (09 해저) · furniture (02 가구) · landmark (07 명소)
"""
import sys, os, json
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, '..', 'dist')
SCN = os.path.join(DIST, 'assets', 'scenery')


def unscale(path, k=4):
    a = np.asarray(Image.open(path).convert('RGBA'))
    b = a[::k, ::k]
    up = np.repeat(np.repeat(b, k, 0), k, 1)
    assert (up == a).all(), f'{path}: 4배 최근접이 아니에요'
    return Image.fromarray(b, 'RGBA')


sys.path.insert(0, HERE)
from seamless_tex import seamless, seam_error


def fix_ground(slot, t):
    """게임 길에 맞게 조금 다듬어요.
    dirt: 받은 그림은 양옆에 풀 띠가 있는 ‘세로 길’ 모양이라, 가로 길에 깔면 풀 줄무늬가 생겨요 → 가운데 흙 64줄만 가로로 이어 붙여요.
    gravel: 독도 길에 깔면 너무 어두워 길이 안 보여요 → 예전 길 밝기에 가깝게 감마로 올려요(색은 그대로)."""
    a = np.asarray(t).astype(np.float32)
    if slot == 'dirt':
        c = seamless(a[:, 32:96], axes=(1,))
        a = np.concatenate([c, c], axis=1)
    if slot == 'gravel':
        a = 255 * (a / 255) ** .62
    if slot in ('cobble', 'pebbles'):  # 돌 하나가 캐릭터 키의 절반(약 25px)이라 너무 커요 → 반으로 줄여 2×2로 깔아요(가장자리는 이어 붙인 그림에서 줄여 이음매 없음)
        big = Image.fromarray(np.clip(np.tile(a, (3, 3, 1)) + .5, 0, 255).astype(np.uint8), 'RGB').resize((192, 192), Image.LANCZOS)
        h = np.asarray(big).astype(np.float32)[64:128, 64:128]
        a = np.tile(h, (2, 2, 1))
    return Image.fromarray(np.clip(a + .5, 0, 255).astype(np.uint8), 'RGB')


SEASONS = ['spring', 'summer', 'autumn', 'winter']
GROUND_SLOTS = ['grass', 'tall', 'dirt', 'cobble', 'concrete', 'sand', 'pebbles', 'gravel', 'steps', 'deck']  # hd2d-nature.js slots 1..10 순서


def ground(pack):
    """03 땅: 계절마다 4×4칸(128px) 아틀라스. grass/tall/dirt는 4계절, 나머지는 사철(allseason)·겨울(winter)."""
    src = os.path.join(pack, '03_ground', 'assets')
    out = {}
    for s in SEASONS:
        atlas = Image.new('RGB', (512, 512), (0, 0, 0))
        for i, slot in enumerate(GROUND_SLOTS):
            names = [f'{slot}_{s}', f'{slot}_winter' if s == 'winter' else f'{slot}_allseason']
            f = next(os.path.join(src, n + '.png') for n in names if os.path.exists(os.path.join(src, n + '.png')))
            t = unscale(f).convert('RGB')
            assert t.size == (128, 128)
            t = fix_ground(slot, t)
            a = np.asarray(t)
            assert seam_error(a) < 30, f'{slot}_{s} 이음매 {seam_error(a):.1f}'
            if slot == 'steps':  # 계단 칸은 비탈로 기울여 그려서 그림이 세로로 늘어나요. 받은 돌계단 그림은 늘어나면 번져 보여 예전(v0.66) 계단 그림을 그대로 써요
                t = Image.open(os.path.join(SCN, 'hd2d-ground.png')).convert('RGB').crop(((i % 4) * 128, (i // 4) * 128, (i % 4) * 128 + 128, (i // 4) * 128 + 128))
            atlas.paste(t, ((i % 4) * 128, (i // 4) * 128))
        p = os.path.join(SCN, f'hd2d-ground-{s}.png')
        atlas.save(p, optimize=True)
        out[s] = f'scenery/hd2d-ground-{s}'
    return out


def cliff(pack):
    """05 절벽: 받은 절벽 면(128)은 흐릿한 얼룩에 점만 흩어져 있어 바위로 읽히지 않아요(검수 결과 cmp96 참고) → 쓰지 않아요.
    대신 요청의 뜻(독도·울릉도마다 다른 절벽 면)은 지금 바위 그림(hd2d-tex-rock 64)에서 섬마다 색을 달리해 살려요.
      독도: 붉은 갈색 응회암 느낌(지금 그대로) · 울릉도: 회색 현무암·조면암 느낌(채도↓, 푸른 회색)
    윗 마감 띠(lip)도 받은 그림이 점무늬라 쓰지 않아요."""
    rock = np.asarray(Image.open(os.path.join(SCN, 'hd2d-tex-rock.png')).convert('RGB')).astype(np.float32)
    out = {}
    dd = rock
    g = rock.mean(axis=2, keepdims=True)
    ul = g + (rock - g) * .35                        # 채도 35%
    ul = ul * np.array([.86, .93, 1.0]) * .92 + np.array([4, 8, 10])  # 푸른 회색, 조금 어둡게
    for key, a in [('cliff-dd-face', dd), ('cliff-ul-face', ul)]:
        im = Image.fromarray(np.clip(a + .5, 0, 255).astype(np.uint8), 'RGB'); im.save(os.path.join(SCN, key + '.png'), optimize=True)
        out[key] = ['scenery/' + key, list(im.size)]
    for old in ['cliff-dd-lip', 'cliff-ul-lip', 'cliff-rock-top']:
        q = os.path.join(SCN, old + '.png')
        if os.path.exists(q): os.remove(q)
    return out


def clean_sprite(t, keep=.05):
    """배경 지운 자리에 남은 이웃 그림 조각(작은 덩어리)을 지우고, 그림 둘레 빈칸을 잘라요(발 자리 = 아랫변 가운데는 그대로)."""
    from scipy import ndimage
    a = np.asarray(t).copy(); m = a[..., 3] > 0
    lab, n = ndimage.label(m)
    if n > 1:  # 가장 큰 덩어리(본그림)를 두고, 작은 조각이나 본그림 좌우 바깥에 따로 떨어진 조각(옆 그림이 잘려 들어온 것)은 지워요
        sizes = ndimage.sum(m, lab, range(1, n + 1)); big = int(np.argmax(sizes)) + 1; sl = ndimage.find_objects(lab)
        bx0, bx1 = sl[big - 1][1].start, sl[big - 1][1].stop; mg = (bx1 - bx0) * .04
        for i, sz in enumerate(sizes, 1):
            if i == big: continue
            x0, x1 = sl[i - 1][1].start, sl[i - 1][1].stop
            if sz < sizes.max() * keep or x1 <= bx0 + mg or x0 >= bx1 - mg: a[lab == i] = 0
    ys, xs = np.nonzero(a[..., 3])
    H, W = a.shape[:2]; cx = W / 2
    half = int(np.ceil(max(cx - xs.min(), xs.max() + 1 - cx)))  # 가운데를 지키며 좌우를 같게 잘라요
    x0, x1 = int(cx - half), int(cx + half); y0 = ys.min()
    return Image.fromarray(a[y0:H, max(0, x0):min(W, x1)], 'RGBA')


def pack_atlas(items, name, width=1024, pad=2):
    """그림들을 한 장에 차례로(줄 바꿈) 놓아요 → {id: [x, y, w, h]}"""
    items = sorted(items, key=lambda kv: -kv[1].height)
    x = y = rowh = 0; pos = {}
    for k, im in items:
        if x + im.width > width: x = 0; y += rowh + pad; rowh = 0
        pos[k] = (x, y); x += im.width + pad; rowh = max(rowh, im.height)
    H = y + rowh; atlas = Image.new('RGBA', (width, H), (0, 0, 0, 0))
    for k, im in items: atlas.paste(im, pos[k])
    atlas.save(os.path.join(SCN, name + '.png'), optimize=True)
    return {'key': 'scenery/' + name, 'width': width, 'height': H, 'frames': {k: [pos[k][0], pos[k][1], im.width, im.height] for k, im in items}}


def flora(pack):
    """04 식생: 세운 그림(발 = 아랫변 가운데). 울릉도 나무 6종(계절) · 독도 사철나무·바위틈 덤불·풀포기."""
    src = os.path.join(pack, '04_flora', 'assets')
    items = [(f[:-4], clean_sprite(unscale(os.path.join(src, f)))) for f in sorted(os.listdir(src)) if f.endswith('.png')]
    return pack_atlas(items, 'flora96')


UW_BANDS = ['sand_shallow', 'sand_gravel', 'sand_light', 'sand_deep']  # 얕은 모래 → 모래+작은 자갈 → 물빛 모래 → 깊은 해저


def seabed(pack):
    """09 해저: 깊이 4단계 × 변형 3장(32px) + 단계 전환 12장(blend_12/23/34 × n·s·w·e) → uw-floor.png 한 줄.
    전환 타일은 매끈한 색 띠뿐이라 옆 타일과 질감이 달라 보여요 → 전환 색(낮은 주파수)에 바닥 타일의 잔무늬(높은 주파수)를 얹어 써요.
    벽: 항구 안벽(uw_quay_face)만 바꿔요. 자연 암벽(uw_cliff_face)은 얼룩에 점만 있어 지금 그림(v0.88 해안 벽 확장팩)을 그대로 둬요. 윗 마감(lip)도 점무늬라 안 써요."""
    from scipy import ndimage
    src = os.path.join(pack, '09_seabed', 'assets'); tiles = {}; ids = []; band = {}
    blur = lambda a: ndimage.uniform_filter(a, size=(9, 9, 1), mode='wrap')
    for b, m in enumerate(UW_BANDS):
        for v in 'abc':
            k = f'uw_{m[5:]}_{v}'; t = np.asarray(unscale(os.path.join(src, f'{m}_{v}.png')).convert('RGB')).astype(np.float32)
            assert t.shape[:2] == (32, 32); tiles[k] = t; ids.append(k); band[k] = b
    # 같은 단계의 세 변형이 서로 이어지지 않아요(맞닿는 줄 차이 ≈ 42, 타일 안 ≈ 10) → v0.90처럼 단계마다 기준 타일(평균을 이음매 없게)을 만들고
    # 타일마다 이음매 없게 한 뒤 가장자리 3px를 기준과 같게 맞춰요(같은 단계끼리는 어떤 순서로 붙여도 이어져요).
    from seamless_tex import match_border
    base = [seamless(np.mean([tiles[k] for k in ids if band[k] == b], axis=0)) for b in range(4)]
    for k in list(tiles): tiles[k] = match_border(seamless(tiles[k]), base[band[k]])
    def edge_match(t, d, deep, shallow, ring=3):
        H, W = t.shape[:2]; yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        dist = {'n': yy, 's': H - 1 - yy, 'w': xx, 'e': W - 1 - xx}; opp = {'n': 's', 's': 'n', 'w': 'e', 'e': 'w'}
        wd = np.clip(1 - dist[d] / ring, 0, 1)[..., None]; ws = np.clip(1 - dist[opp[d]] / ring, 0, 1)[..., None]
        return t * (1 - wd - ws) + deep * wd + shallow * ws
    blend = {}
    for ab in ['12', '23', '34']:
        a = int(ab[0]) - 1; detail = np.mean([tiles[k] - blur(tiles[k]) for k in ids if band[k] in (a, a + 1)], axis=0)
        for d in 'nswe':
            k = f'uw_blend_{ab}_{d}'; t = np.asarray(unscale(os.path.join(src, f'blend_{ab}_{d}.png')).convert('RGB')).astype(np.float32)
            t = seamless(blur(t) + detail, axes=(1,) if d in 'ns' else (0,))  # 전환선을 따라서는 이어지게
            tiles[k] = edge_match(t, d, base[a + 1], base[a]); ids.append(k); band[k] = None; blend.setdefault(ab, {})[d] = k
    strip = np.concatenate([np.clip(tiles[k] + .5, 0, 255) for k in ids], axis=1).astype(np.uint8)
    Image.fromarray(strip, 'RGB').save(os.path.join(SCN, 'uw-floor.png'), optimize=True)
    color = ['#%02x%02x%02x' % tuple(int(c) for c in np.mean([tiles[k] for k in ids if band[k] == b], axis=(0, 1, 2))) for b in range(4)]
    # 항구 안벽: uw-walls.png 위 칸(quay)만 바꿔요
    wp = os.path.join(SCN, 'uw-walls.png'); walls = Image.open(wp).convert('RGBA')
    q = unscale(os.path.join(src, 'uw_quay_face.png')); assert q.size == (128, 128); qa = np.asarray(q)
    assert (qa[:, 0] == qa[:, -1]).all() or seam_error(qa[..., :3]) < 30
    walls.paste(q, (0, 0)); walls.save(wp, optimize=True)
    return {'key': 'scenery/uw-floor', 'ids': ids, 'band': band, 'bandColor': color, 'blend': blend, 'seamless': True}


FURN96 = ['home_sofa', 'home_futon', 'lab_tank', 'lab_telescope', 'lectern', 'chest_closed', 'chest_open', 'board_indoor', 'gym_post', 'frame_wall']


def furniture(pack, prev):
    """02 가구: furniture-atlas.png 아래에 덧붙이고 FURN_ATLAS 자리표에 더해요(다시 돌려도 한 번만 붙게 원래 높이를 기억해요).
    그림 둘레에 투명 1px(기존 팩과 같게: 아랫줄 1px은 땅 밑으로)."""
    src = os.path.join(pack, '02_furniture', 'assets')
    jp = os.path.join(DIST, 'furniture-atlas.js'); js = open(jp).read()
    pre = 'export const FURN_ATLAS = '; i = js.index(pre) + len(pre); j = js.index(';\n', i); FA = json.loads(js[i:j])
    ap = os.path.join(SCN, 'furniture-atlas.png'); atlas = Image.open(ap).convert('RGBA')
    baseH = (prev or {}).get('baseH') or FA['height']
    for k in FURN96: FA['frames'].pop(k, None)
    atlas = atlas.crop((0, 0, FA['width'], baseH))
    ims = []
    for k in FURN96:
        t = clean_sprite(unscale(os.path.join(src, k + '.png')))
        pad = Image.new('RGBA', (t.width + 2, t.height + 2), (0, 0, 0, 0)); pad.paste(t, (1, 1)); ims.append((k, pad))
    x, y, rowh = 0, baseH + 2, 0; pos = {}
    for k, im in ims:
        if x + im.width > FA['width']: x = 0; y += rowh + 2; rowh = 0
        pos[k] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    H = y + rowh; out = Image.new('RGBA', (FA['width'], H), (0, 0, 0, 0)); out.paste(atlas, (0, 0))
    for k, im in ims: out.paste(im, pos[k]); FA['frames'][k] = [pos[k][0], pos[k][1], im.width, im.height]
    out.save(ap, optimize=True); FA['height'] = H
    js = js[:i] + json.dumps(FA, ensure_ascii=False) + js[j:]
    names = {e['id']: e['name'] for e in json.load(open(os.path.join(pack, '02_furniture', 'manifest.json')))['entries']}
    pm = 'export const FURN_META = '; i = js.index(pm) + len(pm); j = js.index(';\n', i); FM = json.loads(js[i:j])
    for k, im in ims: FM[k] = {'name': names.get(k, k), 'cat': '집' if k.startswith('home') else '연구소' if k.startswith('lab') else '수호관' if k.startswith('gym') else '공용', 'size': [im.width - 2, im.height - 2], 'src': 'v0.96 GPT 요청 묶음 02'}
    open(jp, 'w').write(js[:i] + json.dumps(FM, ensure_ascii=False) + js[j:])
    return {'baseH': baseH, 'ids': FURN96}


def landmark(pack, prev):
    """07 울릉도 명소: region-atlas.png 아래에 덧붙이고 REGION_ATLAS·REGION_META에 더해요(관찰용 외관 그림 · 문/포탈 없음).
    게임에 세우는 자리는 maps.js 지도의 landmark 칸(region · rock)이 정해요. 충돌은 원래 막힌 칸(rock 상자) 그대로."""
    src = os.path.join(pack, '07_landmarks', 'assets'); man = {e['id']: e for e in json.load(open(os.path.join(pack, '07_landmarks', 'manifest.json')))['entries']}
    jp = os.path.join(DIST, 'furniture-atlas.js'); js = open(jp).read()
    pre = 'export const REGION_ATLAS = '; i = js.index(pre) + len(pre); j = js.index(';\n', i); RA = json.loads(js[i:j])
    ap = os.path.join(SCN, 'region-atlas.png'); atlas = Image.open(ap).convert('RGBA')
    baseH = (prev or {}).get('baseH') or RA['height']; ids = sorted(man)
    for k in ids: RA['frames'].pop(k, None)
    atlas = atlas.crop((0, 0, RA['width'], baseH)); ims = []
    for k in ids:
        t = clean_sprite(unscale(os.path.join(src, k + '.png')))
        pad = Image.new('RGBA', (t.width + 2, t.height + 2), (0, 0, 0, 0)); pad.paste(t, (1, 1)); ims.append((k, pad))
    ims.sort(key=lambda kv: -kv[1].height)
    x, y, rowh = 0, baseH + 2, 0; pos = {}
    for k, im in ims:
        if x + im.width > RA['width']: x = 0; y += rowh + 2; rowh = 0
        pos[k] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    H = y + rowh; out = Image.new('RGBA', (RA['width'], H), (0, 0, 0, 0)); out.paste(atlas, (0, 0))
    for k, im in ims: out.paste(im, pos[k]); RA['frames'][k] = [pos[k][0], pos[k][1], im.width, im.height]
    out.save(ap, optimize=True); RA['height'] = H
    js = js[:i] + json.dumps(RA, ensure_ascii=False) + js[j:]
    pm = 'export const REGION_META = '; i = js.index(pm) + len(pm); j = js.index(';\n', i); RM = json.loads(js[i:j])
    for k, im in ims: RM[k] = {'name': man[k]['name'], 'region': 'ulleung', 'size': [im.width - 2, im.height - 2], 'observe': '관찰용 외관 시안(사진 미대조·실측 아님) · 문/포탈 없음 · v0.96 GPT 요청 묶음 07'}
    open(jp, 'w').write(js[:i] + json.dumps(RM, ensure_ascii=False) + js[j:])
    return {'baseH': baseH, 'ids': ids}


def write_js(res):
    """dist/pack96.js: 가져온 그림 자리를 모아 적어요(부분만 다시 돌려도 나머지는 그대로)."""
    path = os.path.join(DIST, 'pack96.js'); state = {}
    if os.path.exists(path):
        txt = open(path).read(); state = json.loads(txt[txt.index('/*JSON*/') + 8:txt.index('/*END*/')])
    state.update(res)
    js = ['// v0.96 GPT 요청 묶음에서 가져온 그림 자리 (scripts/import-v096-pack.py가 만들어요. 손으로 고치지 말아요)',
          'export const PACK96 = /*JSON*/' + json.dumps(state, ensure_ascii=False) + '/*END*/;',
          "export const CLIFF_TEX = { dokdo: { face: 'scenery/cliff-dd-face' }, ulleung: { face: 'scenery/cliff-ul-face' } };"]
    open(path, 'w').write('\n'.join(js) + '\n')


if __name__ == '__main__':
    pack = sys.argv[1]
    parts = sys.argv[2:] or ['ground']
    res = {}
    if 'ground' in parts:
        res['ground'] = ground(pack)
    if 'cliff' in parts:
        res['cliff'] = cliff(pack)
    if 'flora' in parts:
        res['flora'] = flora(pack)
    if 'seabed' in parts:
        res['seabed'] = seabed(pack)
    if 'landmark' in parts:
        t = open(os.path.join(DIST, 'pack96.js')).read(); prev = json.loads(t[t.index('/*JSON*/') + 8:t.index('/*END*/')]).get('landmark')
        res['landmark'] = landmark(pack, prev)
    if 'furniture' in parts:
        t = open(os.path.join(DIST, 'pack96.js')).read(); prev = json.loads(t[t.index('/*JSON*/') + 8:t.index('/*END*/')]).get('furniture')
        res['furniture'] = furniture(pack, prev)
    write_js(res)
    print(json.dumps(res, ensure_ascii=False)[:2000])
