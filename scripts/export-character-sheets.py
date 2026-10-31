# ─────────────────────────────────────────────────────────────────────────────
# 캐릭터 도트 시트 만들기 (v0.54) — Aseprite에서 고칠 수 있는 원본 PNG
#
#   python3 scripts/export-character-sheets.py            # 아직 없는 시트만 만들어요(고친 그림은 건드리지 않아요)
#   python3 scripts/export-character-sheets.py --force    # 모든 시트를 옛 그림에서 다시 만들어요(고친 그림이 지워져요!)
#
# 게임은 v0.54부터 주인공(남학생·여학생)과 김박사를 dist/assets/characters/sheets/*.png 에서 그대로 그려요.
# 이 스크립트는 그 시트를 처음 만들 때(옛 큰 그림 → 도트 칸) 한 번 쓴 도구예요. 평소에는 Aseprite에서 시트를 직접 고치면 돼요.
# 자세한 방법: art/ASEPRITE-가이드.md
#
# 시트 규칙(dist/character-sheets.js의 SHEET와 같아요)
#   한 칸 32×40 도트 · 가로 5칸(정지, 걷기1~4) × 세로 3줄(아래·오른쪽·위) = 160×120 PNG
#   발끝은 각 칸의 39번째 줄 바로 위(맨 아래 한 줄은 비워요) · 몸의 가운데는 16번째 칸 경계
#   지도 한 칸 = 32도트. 왼쪽 걷기는 오른쪽 줄을 뒤집어 그려요.
# 옛 걷기 그림은 크고 살짝 흐린 그림(한 도트가 8~11 픽셀)이라, 칸마다 가장 많이 나온 색으로 32도트에 맞춰 줄였어요.
# 큰 그림(캐릭터 고르기·컷신): 512×512 그림(4픽셀 = 1도트) → 128×128 도트 PNG (*-portrait.png)
# ─────────────────────────────────────────────────────────────────────────────
import json, os, sys
from collections import Counter
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHAR = os.path.join(ROOT, 'dist', 'assets', 'characters')
OUT = os.path.join(CHAR, 'sheets')
W, H, COLS, ROWS, FOOT_X, FOOT_Y, DOTS = 32, 40, 5, 3, 16, 39, 32
COLORS = 28  # 캐릭터 하나에 쓰는 색 수(옛 그림을 줄일 때)

PICTURE = 128  # 큰 그림 도트 크기
WALKERS = ('boy', 'girl', 'professor')
PICTURES = {'boy': 'explorer-boy-portrait-v33', 'girl': 'explorer-girl-portrait-v33', 'professor': 'professor-portrait-v33'}


def load(path, name):
    s = open(os.path.join(ROOT, 'dist', path), encoding='utf-8').read()
    s = s[s.index(name + '=') + len(name) + 1:].rstrip().rstrip(';')
    return json.loads(s)


def sources():
    """id → (atlas png, unit, [[frame×5]×3 rows])"""
    E = load('explorer-atlas.js', 'EXPLORER_ATLAS')
    out = {}
    for who in ('boy', 'girl'):
        r = E['rows'][who]
        out[who] = (E['key'], E['unit'], [E['frames'][r[d]] for d in ('down', 'right', 'up')])
    a = load('npc-atlases.js', 'NPC_ATLASES')['professor']
    out['professor'] = (a['key'], a['unit'], [a['frames'][a['rows'][d]] for d in ('down', 'right', 'up')])
    return out


def palette_for(img, frames):
    """옛 그림의 불투명한 픽셀에서 캐릭터 색 COLORS개를 골라요."""
    picks = []
    for row in frames:
        for f in row:
            x, y, w, h = f['rect']
            picks.append(img.crop((x, y, x + w, y + h)))
    strip = Image.new('RGBA', (sum(p.width for p in picks), max(p.height for p in picks)), (0, 0, 0, 0))
    ox = 0
    for p in picks: strip.paste(p, (ox, 0)); ox += p.width
    px = [c[:3] for c in (strip.get_flattened_data() if hasattr(strip, 'get_flattened_data') else strip.getdata()) if c[3] >= 128]
    sample = Image.new('RGB', (len(px), 1)); sample.putdata(px)
    pal = sample.quantize(COLORS, method=Image.Quantize.MEDIANCUT)
    return pal


def luma(pal, k):
    r, g, b = pal[k * 3:k * 3 + 3]
    return .299 * r + .587 * g + .114 * b


def frame_to_dots(img, q, f, unit, exact):
    """한 장면 → 32×40 도트(RGBA). q: 팔레트로 바꾼 그림(같은 크기)"""
    x, y, w, h = f['rect']; ax, ay = f['anchor']
    p = unit / DOTS
    if exact:  # 8픽셀 = 1도트: 발 기준점을 8의 배수에 맞춰요
        ax = round((ax - x) / p) * p + x; ay = round((ay - y) / p) * p + y
    cell = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    src, alpha, pal = q.load(), img.load(), q.getpalette()
    for j in range(H):
        for i in range(W):
            x0 = ax + (i - FOOT_X) * p; y0 = ay + (j - FOOT_Y) * p
            # 칸 가운데 60%에서 가장 많이 나온 색(가장자리의 번진 색은 빼요)
            m = p * .2
            xs = range(max(x, int(x0 + m)), min(x + w, int(x0 + p - m + .999)))
            ys = range(max(y, int(y0 + m)), min(y + h, int(y0 + p - m + .999)))
            votes, solid, total = Counter(), 0, 0
            for yy in ys:
                for xx in xs:
                    total += 1
                    if alpha[xx, yy][3] >= 128: solid += 1; votes[src[xx, yy]] += 1
            if total and solid * 2 > total:
                c = votes.most_common(1)[0][0]
                # 눈·외곽선처럼 작은 어두운 점은 살려요: 아주 어두운 색이 칸의 30% 이상이면 그 색
                dark = [(n, k) for k, n in votes.items() if luma(pal, k) < 60]
                if dark and luma(pal, c) >= 60:
                    n, k = max(dark)
                    if n >= .3 * solid: c = k
                cell.putpixel((i, j), tuple(pal[c * 3:c * 3 + 3]) + (255,))
    return cell


def export(cid, key, unit, rows):
    img = Image.open(os.path.join(ROOT, 'dist', 'assets', key + '.png')).convert('RGBA')
    exact = False  # 8픽셀 = 1도트처럼 딱 맞는 그림이면 True(지금 세 캐릭터는 모두 False)
    q = img.convert('RGB').quantize(palette=palette_for(img, rows), dither=Image.Dither.NONE)
    sheet = Image.new('RGBA', (W * COLS, H * ROWS), (0, 0, 0, 0))
    for r, row in enumerate(rows):
        for c, f in enumerate(row):
            sheet.paste(frame_to_dots(img, q, f, unit, exact), (c * W, r * H))
    return sheet


def main():
    force = '--force' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    made = []
    src = sources()
    for cid, (key, unit, rows) in src.items():
        path = os.path.join(OUT, cid + '.png')
        if os.path.exists(path) and not force: continue
        export(cid, key, unit, rows).save(path, optimize=True); made.append(cid)
    for cid, key in PICTURES.items():
        path = os.path.join(OUT, cid + '-portrait.png')
        if os.path.exists(path) and not force: continue
        picture(key).save(path, optimize=True); made.append(cid + '-portrait')
    guide()
    print('만든 시트:', ', '.join(made) if made else '없음(이미 모두 있어요. 다시 만들려면 --force)')


def picture(key):
    """512×512 큰 그림 → 128×128: 4×4 픽셀 묶음마다 가장 많이 나온 색"""
    img = Image.open(os.path.join(CHAR, key + '.png')).convert('RGBA'); s = img.width // PICTURE
    src = img.load(); out = Image.new('RGBA', (PICTURE, PICTURE), (0, 0, 0, 0))
    for y in range(PICTURE):
        for x in range(PICTURE):
            votes = Counter()
            for yy in range(y * s, y * s + s):
                for xx in range(x * s, x * s + s):
                    c = src[xx, yy]; votes[c[:3] + (255,) if c[3] >= 128 else (0, 0, 0, 0)] += 1
            out.putpixel((x, y), votes.most_common(1)[0][0])
    return out


def guide():
    """Aseprite 참고 레이어용 안내 그림(160×120): 칸 경계, 몸 가운데 줄, 발 놓는 줄"""
    g = Image.new('RGBA', (W * COLS, H * ROWS), (0, 0, 0, 0)); px = g.load()
    for r in range(ROWS):
        for c in range(COLS):
            ox, oy = c * W, r * H
            for k in range(W):
                px[ox + k, oy + FOOT_Y] = (230, 40, 40, 200)            # 발 아래 빨간 줄(이 줄에는 그리지 않아요)
            for k in range(H):
                px[ox + FOOT_X - 1, oy + k] = (40, 120, 230, 60) if k % 2 else (0, 0, 0, 0)  # 가운데(왼쪽 반)
                px[ox + FOOT_X, oy + k] = (40, 120, 230, 60) if k % 2 else (0, 0, 0, 0)      # 가운데(오른쪽 반)
            for k in range(W):
                px[ox + k, oy + 8] = (40, 160, 90, 70) if k % 2 == 0 else (0, 0, 0, 0)       # 초록 점선(8번째 줄): 머리 꼭대기 기준 — 이보다 위는 모자 끝·머리카락 정도만
            for k in range(H):
                px[ox, oy + k] = (120, 120, 120, 90)
    g.save(os.path.join(ROOT, 'art', 'aseprite-guide.png'))


if __name__ == '__main__':
    main()
