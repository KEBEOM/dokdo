"""HD-2D 에셋팩 가져오기 (v0.79)

    python3 scripts/import-hd2d.py <에셋팩 폴더>      # 폴더 안에 manifest.json 이 있어야 해요 (Pillow · numpy)

에셋팩의 투명 PNG는 고해상도 채색화라 게임의 도트(캐릭터 키 48픽셀)와 픽셀 밀도가 달라요. 그래서
  1) 게임 크기(지도 1픽셀 = 그림 1픽셀)로 줄이고(투명도를 곱한 채로 줄여 테두리 번짐 없이)
  2) 색 수를 줄이고(도트 느낌) 3) 투명도를 0/255로 자르고 4) 바깥에 1픽셀 어두운 테두리를 둘러요.
원본은 손대지 않아요. 결과:
  dist/assets/scenery/hd2d-atlas.png   세운 판(건물·소품·바위·식생) 그림 모음
  dist/assets/scenery/hd2d-tex-*.png   되풀이 무늬(절벽 바위면·깊은 바다·얕은 바다·파도 거품) 2의 거듭제곱 크기
  dist/hd2d-atlas.js                   그림 자리·용도·원본 파일·실제 그림 내용
  docs/HD2D-에셋-분류.md               분류표(이름과 그림이 다른 파일 표시)
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = sys.argv[1] if len(sys.argv) > 1 else None
INK = (42, 36, 34)

# ── 세운 판으로 쓸 그림: (게임 이름, 원본 id, 용도, 게임 속 너비(지도 픽셀), 실제 그림 내용, 메모) ──
# 너비는 건물 칸(3칸 집 = 96 + 처마) · 캐릭터 키 48 에 맞춰 정했어요.
CARDS = [
    # 울릉도 도동항
    ('ul_terminal', '03_01', 'building', 272, '도동항 여객선터미널', ''),
    ('ul_house_a', '03_04', 'building', 112, '물탱크 있는 2층 집(석축 위)', ''),
    ('ul_house_b', '03_07', 'building', 116, '파란 지붕 단층 집', ''),
    ('ul_house_c', '03_08', 'building', 112, '빨간 지붕 단층 집', ''),
    ('ul_shop_a', '03_05', 'building', 180, '2층 상가(차양 가게)', ''),
    ('ul_shop_b', '03_06', 'building', 180, '벽돌 2층 상가', ''),
    ('ul_ferry', '03_03', 'boat', 208, '대형 여객선(옆모습)', ''),
    ('ul_arch_bridge', '03_02', 'structure', 240, '아치형 보행교', '시범 배치 안 함(다리 방향이 지도와 달라요)'),
    ('ul_lamp_a', '03_09', 'prop', 40, '항구 가로등(외등)', ''),
    ('ul_lamp_b', '03_10', 'prop', 44, '항구 가로등(쌍등)', ''),
    ('ul_board', '03_18', 'prop', 60, '항구 게시판(지붕 있는)', ''),
    ('ul_board_b', '03_16', 'prop', 76, '기와 지붕 안내판', '이름은 도로_시설물'),
    ('ul_rocks_a', '03_19', 'rock', 176, '해안 암반 모음', ''),
    ('ul_rocks_b', '03_20', 'rock', 176, '해안 암반 모음', ''),
    ('ul_rocks_c', '03_21', 'rock', 176, '해안 암반 모음(낮은)', ''),
    ('ul_rail_steel', '03_13', 'rail', 96, '쇠 난간(로프)', '이름은 철재_난간'),
    ('ul_rail_pipe', '03_14', 'rail', 96, '쇠 파이프 난간', '이름은 로프_난간'),
    # 행남 해안길(이름과 그림이 다른 것은 그림 기준)
    ('hn_walk_a', '04_01', 'cliffpath', 200, '굽은 절벽 산책로(로프 난간)', ''),
    ('hn_walk_b', '04_02', 'cliffpath', 180, '굽은 절벽 산책로', ''),
    ('hn_tunnel', '04_03', 'cliffpath', 180, '해안 터널', ''),
    ('hn_passage', '04_04', 'cliffpath', 150, '바위 틈 통로', ''),
    ('hn_seacave', '04_05', 'rock', 130, '해식동굴', '이름은 석재_계단_01'),
    ('hn_cliff_a', '04_06', 'rock', 124, '절벽 바위 덩어리', '이름은 석재_계단_02'),
    ('hn_cliff_b', '04_07', 'rock', 118, '절벽 바위 덩어리', '이름은 높은_절벽_01'),
    ('hn_stairs_a', '04_08', 'stairs', 126, '로프 난간 돌계단', '이름은 절벽_아치_01'),
    ('hn_stairs_b', '04_09', 'stairs', 134, '로프 난간 돌계단', '이름은 절벽_아치_02'),
    ('hn_arch', '04_10', 'rock', 140, '아치 바위', '이름은 석재_계단_03'),
    ('hn_pillar', '04_11', 'rock', 150, '뾰족한 바위 기둥', '이름은 절벽_암반_02'),
    ('hn_pine_a', '04_12', 'plant', 150, '소나무 바위', ''),
    ('hn_pine_b', '04_13', 'plant', 124, '소나무 바위', ''),
    ('hn_rocks_a', '04_14', 'rock', 112, '바위 무더기', '이름은 풀_꽃_01'),
    ('hn_rocks_b', '04_15', 'rock', 132, '낮은 바위 무더기', '이름은 꽃_소품_01'),
    ('hn_deck', '04_16', 'structure', 180, '해안 전망 데크(망원경·벤치)', ''),
    ('hn_rail_steel', '04_17', 'rail', 96, '쇠 난간', ''),
    ('hn_rail_rope', '04_18', 'rail', 96, '로프 난간', ''),
    ('hn_flowers_a', '04_19', 'plant', 64, '수국 덤불', ''),
    ('hn_flowers_b', '04_20', 'plant', 64, '들꽃 덤불', ''),
    # 독도
    ('dd_lodge', '01_01', 'building', 176, '서도 주민숙소풍 건물', '이름은 항구_시설'),
    ('dd_lighthouse', '01_02', 'building', 200, '독도 등대(돔)·태양광', ''),
    ('dd_summit', '01_03', 'building', 240, '동도 정상 시설 단지(바위 포함)', ''),
    ('dd_stairs_long', '01_04', 'stairs', 128, '절벽 계단(긴)', ''),
    ('dd_stairs_short', '01_05', 'stairs', 104, '절벽 계단(짧은)', ''),
    ('dd_pier', '01_06', 'structure', 260, '독도 접안부두', ''),
    ('dd_solar_house', '01_07', 'building', 128, '태양광 지붕 건물', ''),
    ('dd_rock_peak', '01_08', 'rock', 112, '뾰족 바위', ''),
    ('dd_rock_flat', '01_09', 'rock', 124, '너럭바위', ''),
    ('dd_rail_wood', '01_10', 'rail', 96, '목재 난간', ''),
    ('dd_rail_rope', '01_11', 'rail', 96, '로프 난간', ''),
    ('dd_rail_steel', '01_12', 'rail', 96, '철재 난간', ''),
    ('dd_shore_rock', '01_13', 'rock', 108, '해안 바위', ''),
    ('dd_comm_tower', '01_14', 'prop', 40, '통신 탑', ''),
    ('dd_flags', '01_15', 'prop', 60, '깃대(태극기)', ''),
    ('dd_cliff_b', '01_16', 'rock', 116, '풀 덮인 절벽 덩어리', ''),
    ('dd_cliff_a', '01_17', 'rock', 112, '풀 덮인 절벽 덩어리', ''),
    ('dd_comm_pole', '01_18', 'prop', 32, '통신 기둥(확성기)', ''),
    ('dd_wall_rust', '01_19', 'wall', 96, '녹슨 방파벽', ''),
    ('dd_wall_stone', '01_20', 'wall', 72, '석조 방파벽', ''),
    ('dd_lifering', '01_21', 'prop', 24, '구명환', ''),
    ('dd_bollard_y', '01_22', 'prop', 24, '계선주(노랑)', ''),
    ('dd_bollard_b', '01_23', 'prop', 24, '계선주(갈색)', ''),
    ('dd_grass', '02_15', 'plant', 96, '초지 풀 덤불', ''),
    ('dd_wave_rock', '02_12', 'rock', 140, '파도치는 바위', ''),
    ('dd_small_rocks', '02_14', 'rock', 108, '작은 바위', ''),
    # v0.79 이야기 건물·독도 건물: 지도 건물 칸 폭에 맞춘 크기(5칸 → 176, 7칸 → 240). 원본에서 바로 줄여 도트 밀도가 같아요
    ('big_brick', '03_06', 'building', 240, '수호관(울릉도) — 벽돌 2층 상가', '이야기 건물 크기(7칸)'),
    ('big_house', '03_04', 'building', 176, '주인공 집(울릉도) — 물탱크 2층 집', '이야기 건물 크기(5칸)'),
    ('big_solar', '01_07', 'building', 176, '연구소·관측소 — 태양광 지붕 건물', '이야기 건물 크기(5칸)'),
    ('big_shop', '03_05', 'building', 176, '쉼터·상점 — 차양 2층 가게', '이야기 건물 크기(5칸)'),
    ('big_summit', '01_03', 'building', 240, '동도 수호관 — 정상 시설 단지(독도경비대풍)', '이야기 건물 크기(7칸)'),
    ('big_lighthouse', '01_02', 'building', 176, '동도 연구소 — 독도 등대', '이야기 건물 크기(5칸)'),
    ('big_bluehouse', '03_07', 'building', 176, '독도의 집 — 파란 지붕 집', '이야기 건물 크기(5칸)'),
    ('big_lodge', '01_01', 'building', 224, '서도 수호관 — 주민숙소', '이야기 건물 크기(7칸)'),
    # v0.79 꽃 칸 하나에 맞춘 덤불
    ('fl_hydrangea', '04_19', 'plant', 44, '수국 덤불(꽃 칸)', ''),
    ('fl_wild', '04_20', 'plant', 44, '들꽃 덤불(꽃 칸)', ''),
    ('fl_grass', '02_15', 'plant', 48, '초지 풀(꽃 칸)', ''),
]
# 되풀이 무늬(셰이더가 거울 반복으로 이어 붙여요): (게임 이름, 원본 id, 잘라 낼 자리(비율), 크기, 색 수)
TEXTURES = [
    ('rock', '02_01', (.12, .30, .88, .92), 64, 40),      # 높은 절벽 앞면
    ('rock_grass', '02_03', (.12, .04, .88, .40), 64, 40),  # 풀 암반 윗면(절벽 맨 위 줄)
    ('sea_deep', '02_16', (.10, .12, .90, .88), 128, 32),
    ('sea_shallow', '02_17', (.10, .12, .90, .88), 128, 32),
    ('foam', '02_18', (.0, .1, 1.0, .9), 128, 24),
]
REFERENCE_ONLY = '05_스타일_캐릭터_참고용 — 화면 스타일·캐릭터 설계 참고용(배경·글자 포함). 게임에 넣지 않아요. 캐릭터·우산몬 걷기 그림은 기존 시트를 그대로 써요.'

def premul_resize(im, w, h):
    a = np.asarray(im, dtype=np.float32) / 255.0
    rgb, al = a[..., :3] * a[..., 3:4], a[..., 3:4]
    big = np.concatenate([rgb, al], axis=2)
    out = np.stack([np.asarray(Image.fromarray((big[..., i] * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS), dtype=np.float32) / 255 for i in range(4)], axis=2)
    al2 = np.clip(out[..., 3:4], 1e-4, 1)
    return np.concatenate([np.clip(out[..., :3] / al2, 0, 1), out[..., 3:4]], axis=2)

def pixelize(im, tw, colors=40, outline=True):
    w, h = im.size; th = max(1, round(h * tw / w))
    a = premul_resize(im.convert('RGBA'), tw, th)
    alpha = a[..., 3] >= .5
    rgb = (a[..., :3] * 255).astype(np.uint8)
    # 도트 느낌: 채도 조금 올리고 색 수 줄이기(투명 칸은 색 계산에서 빼요)
    hsv = Image.fromarray(rgb).convert('HSV'); hv = np.asarray(hsv).astype(np.int32); hv[..., 1] = np.clip(hv[..., 1] * 1.12, 0, 255)
    rgb = np.asarray(Image.fromarray(hv.astype(np.uint8), 'HSV').convert('RGB'))
    if alpha.any():
        fill = rgb[alpha].mean(axis=0).astype(np.uint8); rgb2 = rgb.copy(); rgb2[~alpha] = fill
        q = Image.fromarray(rgb2).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'); rgb = np.asarray(q).copy()
    out = np.zeros((th, tw, 4), np.uint8); out[..., :3] = rgb; out[..., 3] = np.where(alpha, 255, 0)
    if outline:  # 바깥 1픽셀 어두운 테두리(4방향)
        pad = np.pad(alpha, 1); edge = (~alpha) & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
        out[edge] = (*INK, 255)
    return Image.fromarray(out, 'RGBA')

def texture(im, box, size, colors):
    w, h = im.size; c = im.convert('RGBA').crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)))
    t = pixelize(c, size, colors, outline=False).resize((size, size), Image.NEAREST)
    a = np.asarray(t).copy(); a[..., 3] = 255; return Image.fromarray(a, 'RGBA')  # 무늬는 꽉 차게

def main():
    if not PACK or not os.path.exists(os.path.join(PACK, 'manifest.json')): sys.exit('에셋팩 폴더(manifest.json 이 있는 곳)를 알려 주세요.')
    man = json.load(open(os.path.join(PACK, 'manifest.json'), encoding='utf8')); by = {a['id']: a for a in man['assets']}
    pics = {}
    for key, aid, use, tw, desc, note in CARDS:
        src = Image.open(os.path.join(PACK, by[aid]['path'])); pics[key] = pixelize(src, tw)
    W, x, y, rowh, frames = 2048, 0, 0, 0, {}
    for k, p in sorted(pics.items(), key=lambda kv: -kv[1].height):
        if x + p.width > W: x, y, rowh = 0, y + rowh + 2, 0
        frames[k] = [x, y, p.width, p.height]; x += p.width + 2; rowh = max(rowh, p.height)
    sheet = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for k, p in pics.items(): sheet.alpha_composite(p, tuple(frames[k][:2]))
    out = os.path.join(ROOT, 'dist', 'assets', 'scenery'); sheet.save(os.path.join(out, 'hd2d-atlas.png'), optimize=True)
    for key, aid, box, size, colors in TEXTURES: texture(Image.open(os.path.join(PACK, by[aid]['path'])), box, size, colors).save(os.path.join(out, f'hd2d-tex-{key}.png'), optimize=True)
    meta = {k: {'use': use, 'src': aid, 'srcName': by[aid]['name'], 'desc': desc, 'note': note} for k, aid, use, tw, desc, note in CARDS}
    with open(os.path.join(ROOT, 'dist', 'hd2d-atlas.js'), 'w', encoding='utf8') as f:
        f.write('// HD-2D 에셋팩에서 가져온 그림 자리 (scripts/import-hd2d.py가 만들어요). 1픽셀 = 지도 1픽셀, 발 자리는 그림 아랫변 가운데.\n')
        f.write('export const HD2D_ATLAS = ' + json.dumps({'key': 'scenery/hd2d-atlas', 'width': W, 'height': y + rowh, 'frames': frames}, ensure_ascii=False) + ';\n')
        f.write('export const HD2D_TEXTURES = ' + json.dumps({k: f'scenery/hd2d-tex-{k}' for k, *_ in TEXTURES}, ensure_ascii=False) + ';\n')
        f.write('export const HD2D_META = ' + json.dumps(meta, ensure_ascii=False) + ';\n')
    # 분류표
    groups = {}
    for k, aid, use, tw, desc, note in CARDS: groups.setdefault(by[aid]['category'], []).append((aid, by[aid]['name'], k, use, desc, note, frames[k][2], frames[k][3]))
    used = {aid for _, aid, *_ in CARDS} | {aid for _, aid, *_ in TEXTURES}
    lines = ['# HD-2D 에셋 분류표 (v0.79)', '', '`scripts/import-hd2d.py`가 만들어요. **실제 그림 내용 기준**으로 분류했어요(이름과 그림이 다르면 메모에 적었어요).', 'PNG는 평면 그림(2.5D)이에요. 3D 모델이 아니라서, 정면에서 본 모습으로만 써요.', '',
             '| 원본 id | 원본 이름 | 게임 이름 | 용도 | 실제 그림 | 게임 크기 | 메모 |', '|---|---|---|---|---|---|---|']
    for cat in sorted(groups):
        lines.append(f'| **{cat}** | | | | | | |')
        for aid, nm, k, use, desc, note, w, h in sorted(groups[cat]): lines.append(f'| {aid} | {nm} | `{k}` | {use} | {desc} | {w}×{h} | {note} |')
    lines += ['', '## 되풀이 무늬(셰이더)', '', '| 게임 이름 | 원본 id | 쓰는 곳 |', '|---|---|---|']
    where = {'rock': '절벽 바위벽(층마다)', 'rock_grass': '절벽 맨 위 줄', 'sea_deep': '깊은 바다 물결', 'sea_shallow': '얕은 바다 물결', 'foam': '물가 파도 거품'}
    for k, aid, *_ in TEXTURES: lines.append(f'| `hd2d-tex-{k}` | {aid} {by[aid]["name"]} | {where[k]} |')
    lines += ['', '## 쓰지 않은 그림', ''] + [f'- {a["id"]} {a["name"]} ({a["category"]})' for a in man['assets'] if a['id'] not in used] + ['', '## 참고용', '', f'- {REFERENCE_ONLY}', '- 06_원본_투명_에셋시트: 자른 그림을 맞춰 볼 때만 써요.']
    open(os.path.join(ROOT, 'docs', 'HD2D-에셋-분류.md'), 'w', encoding='utf8').write('\n'.join(lines) + '\n')
    print('atlas', W, y + rowh, len(frames), 'cards ·', len(TEXTURES), 'textures')

if __name__ == '__main__':
    main()
