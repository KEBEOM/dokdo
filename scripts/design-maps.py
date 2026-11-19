"""지도 설계 도우미: 산(발자국) → 고리마다 한 층씩 높아지는 계단식 절벽 + 나무/바위, 그 위에 길·건물·물건을 찍어요.
python3 gen.py dodong  → 지도 글자(art)와 층(levels)을 maps.js 에 바로 써 넣어요."""
import sys, re, json, os
W, H = 42, 30
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist', 'maps.js')

class Grid:
    def __init__(s, fill='~', w=42, h=30):
        global W, H; W, H = w, h
        s.a = [[fill] * W for _ in range(H)]; s.lv = [[0] * W for _ in range(H)]
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.a[y][x] = c
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, c)
    def text(s, x, y, t):
        for i, c in enumerate(t): s.put(x + i, y, c)
    def mountain(s, fp, maxl=4, rock=lambda x, y, d: False, edge='r', band=1):
        """fp: (x,y)->bool. 가장자리 고리(층 0)는 절벽 밑(바위), 안쪽으로 band 고리마다 한 층."""
        inside = lambda x, y: x < 0 or y < 0 or x >= W or y >= H or fp(x, y)  # 지도 밖은 산이 이어진다고 봐요
        for y in range(H):
            for x in range(W):
                if not fp(x, y): continue
                d = 0
                while d < 12 and all(inside(x + dx, y + dy) for dx in range(-d - 1, d + 2) for dy in range(-d - 1, d + 2)): d += 1
                L = min(maxl, (d + band - 1) // band) if d else 0
                s.lv[y][x] = L
                south_edge = not inside(x, y + 1)
                if L == 0: s.a[y][x] = '.' if south_edge else edge
                else: s.a[y][x] = 'r' if rock(x, y, L) else 'T'
    def faces_clear(s):
        """남쪽 절벽 면 칸(바로 위가 더 높은 칸)에는 나무·바위를 두지 않아요(절벽 그림이 보이게)."""
        for y in range(1, H):
            for x in range(W):
                if s.lv[y - 1][x] > s.lv[y][x] and s.a[y][x] in 'Tr': s.a[y][x] = '.'
    def rows(s): return [''.join(r) for r in s.a]
    def levels(s): return [''.join(str(v) if v else '.' for v in r) for r in s.lv]

def dodong():  # v0.76: 골짜기를 따라 굽은 큰길, 양쪽 비탈 1층 단(집이 비탈에 올라앉은 U08 모습), 건물 줄 사이 길+마당, 이웃 사이 골목
    g = Grid('~', 72, 58)
    g.rect(26, 0, 45, 5, '.'); g.rect(20, 6, 51, 12, '.'); g.rect(14, 13, 57, 33, '.'); g.rect(6, 34, 63, 42, '=')
    def left(x, y):
        if y <= 5: return x <= 25
        if y <= 12: return x <= 19
        if y <= 33: return x <= 20          # 왼쪽 비탈 단(x 14~20)까지 산 발자국에 넣고 아래에서 1층으로 바꿔요
        if y <= 42: return x <= 5
        if y <= 53: return x <= 28
        if y <= 55: return x <= 15
        return x <= 14
    def right(x, y):
        if y <= 5: return x >= 46
        if y <= 12: return x >= 52
        if y <= 33: return x >= 51          # 오른쪽 비탈 단(x 51~57)
        if y <= 42: return x >= 64
        if y <= 47: return x >= 51
        if y <= 50: return x >= 58
        return False
    g.mountain(left, 6, rock=lambda x, y, L: y >= 56)
    g.mountain(right, 6)
    for x0, x1 in ((14, 20), (51, 57)):      # 비탈 단(1층)
        for y in range(13, 34):
            for x in range(x0, x1 + 1): g.lv[y][x] = 1; g.a[y][x] = '.'
    # 뒷산 공사장 터(1층)
    for y in range(15, 34):
        for x in range(4, 13): g.lv[y][x] = 1; g.a[y][x] = '.'
    g.text(5, 17, 'nnnnnnn'); g.text(5, 18, '7.E'); g.text(8, 27, '"""'); g.text(8, 28, '"""'); g.put(6, 27, 'V')
    for x, y in [(4, 22), (11, 24), (5, 31), (11, 30)]: g.put(x, y, 'T')
    g.rect(8, 34, 8, 34, '='); g.rect(8, 21, 8, 33, '=')
    # 바다(만)
    g.rect(31, 44, 47, 57, '~'); g.rect(29, 56, 71, 57, '~'); g.rect(15, 56, 28, 57, '~'); g.rect(48, 52, 71, 55, '~')
    g.rect(31, 43, 48, 43, '#')
    # 행남 해안산책로
    g.rect(29, 43, 30, 43, '='); g.rect(29, 44, 29, 53, '='); g.rect(30, 44, 30, 55, 'k')
    g.rect(16, 54, 29, 55, '='); g.rect(16, 56, 29, 56, 'k'); g.text(21, 54, 'rr')
    for y in range(54, 56):
        for x in range(16, 30): g.lv[y][x] = 0
    g.put(28, 42, '8')
    # 보행교 → 터미널 → 부두 끝 출구, 소파블록
    g.rect(49, 43, 50, 50, '#'); g.rect(48, 44, 48, 50, 'k')
    for y in range(43, 51): g.lv[y][49] = g.lv[y][50] = 0
    g.rect(51, 48, 57, 50, 'C')
    for y in range(48, 51):
        for x in range(51, 58): g.lv[y][x] = 0
    g.rect(48, 51, 71, 51, '#'); g.text(70, 51, 'z>'); g.rect(49, 52, 60, 52, 'k')
    g.rect(61, 52, 71, 52, 'x'); g.rect(52, 53, 63, 53, 'x'); g.rect(58, 54, 66, 54, 'x'); g.rect(64, 55, 71, 55, 'x')
    g.put(44, 45, 'F'); g.put(36, 53, 'b'); g.put(53, 41, 'a')
    # 골짜기를 따라 굽은 큰길(블록마다 큰길 자리가 달라요) + 건물 줄 앞 가로길
    MAIN = {12: (35, 36), 19: (31, 32), 26: (38, 39), 33: (35, 36)}
    for yB, (a, b) in MAIN.items(): g.rect(a, yB - 6, b, yB + 1, '=')
    for y, x0, x1 in [(6, 20, 51), (13, 14, 57), (20, 14, 57), (27, 14, 57)]: g.rect(x0, y, x1, y, '=')
    g.rect(18, 14, 19, 33, '='); g.rect(52, 14, 52, 33, '=')   # 비탈 단 골목(위아래로 이어져요)
    for x in range(14, 21): g.a[34][x] = '='                   # 광장에서 비탈 단으로 오르는 넓은 계단
    for x in range(51, 58): g.a[34][x] = '='
    # 들어갈 수 있는 4채
    g.rect(32, 1, 38, 5, 'Y'); g.rect(22, 9, 26, 12, 'h'); g.rect(44, 9, 48, 12, 'L'); g.rect(8, 35, 12, 38, 'O')
    def row(yB, xa, xb, cycle, skip=()):
        a, b = MAIN.get(yB, (99, 99)); roads = {a, b}; x, k = xa, 0
        while x <= xb:
            if x in roads or any(p <= x <= q for p, q in skip): x += 1; continue
            c = cycle[k % len(cycle)]; w, d = (5, 4) if c == 'D' else (3, 3)
            if x + w - 1 > xb or any(xx in roads or any(p <= xx <= q for p, q in skip) for xx in range(x, x + w)):
                if c == 'D': k += 1; continue
                x += 1; continue
            sh = 1 if c == 'd' and (x * 7 + yB) % 3 == 0 else 0   # 집 몇 채는 한 줄 뒤로(앞마당) — 반듯한 줄을 깨요
            g.rect(x, yB - d + 1 - sh, x + w - 1, yB - sh, c); x += w + 1; k += 1
    row(5, 27, 45, 'dd', skip=[(31, 39)])
    row(12, 20, 51, 'Ddd', skip=[(21, 27), (43, 49)])
    for yB, cyc in ((19, 'dDdd'), (26, 'Ddd'), (33, 'ddDd')):
        row(yB, 21, 50, cyc)                                    # 골짜기 바닥
        g.rect(15, yB - 2, 17, yB, 'd'); g.rect(53, yB - 2, 55, yB, 'd')   # 비탈 단 위의 집
    for x, c in [(14, 'd'), (18, 'd'), (44, 'D'), (50, 'd'), (54, 'D'), (60, 'd')]:
        w, d = (5, 4) if c == 'D' else (3, 3); g.rect(x, 40 - d + 1, x + w - 1, 40, c)
    for x, y in [(23, 7), (48, 7), (29, 15), (43, 22), (24, 29), (47, 29), (26, 39), (31, 37), (41, 37), (63, 36), (16, 15), (54, 22)]: g.put(x, y, 'T')
    for x, y in [(30, 7), (41, 7), (26, 14), (45, 21), (33, 28)]: g.put(x, y, 'p')
    g.text(37, 38, 'MMM'); g.put(42, 39, '6')
    g.put(40, 7, 'J'); g.put(13, 37, 'S'); g.put(49, 14, 'P'); g.text(32, 41, 'G.B.H.1'); g.put(42, 41, '2'); g.put(28, 21, '3'); g.put(41, 28, '4'); g.put(24, 22, '5'); g.put(60, 41, 'W')
    g.faces_clear()
    return g

def plateau(g, fp, maxl=3, band=2, ground=lambda x, y, L: '.'):
    """절벽으로 둘러싸인 높은 땅(독도): 바닷가 고리는 바위, 고리 band개마다 한 층. 층마다 걸을 수 있는 좁은 턱이 생겨요."""
    inside = lambda x, y: x < 0 or y < 0 or x >= W or y >= H or fp(x, y)
    for y in range(H):
        for x in range(W):
            if not fp(x, y): continue
            d = 0
            while d < 12 and all(inside(x + dx, y + dy) for dx in range(-d - 1, d + 2) for dy in range(-d - 1, d + 2)): d += 1
            L = min(maxl, (d + band - 1) // band) if d else 0
            g.lv[y][x] = L
            g.a[y][x] = ('.' if not inside(x, y + 1) else 'r') if L == 0 else ground(x, y, L)

def path(g, pts, c='='):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1): g.put(x, y, c)

def seal(g, start):
    """층 땅 가운데 처음 자리에서 못 가는 칸은 바위로 막아요(시험: 언덕 위 빈칸은 모두 갈 수 있어야 해요)."""
    lv = lambda x, y: g.lv[y][x] if 0 <= x < W and 0 <= y < H else 0
    solid_c = set('TrMYLOhdDCnpflKx')
    def walk(x, y):
        if not (0 <= x < W and 0 <= y < H): return False
        c = g.a[y][x]
        if c in solid_c: return False
        L = lv(x, y); top = lv(x, y - 1); face = top > L
        rim = L > 0 and (lv(x, y - 1) < L or lv(x - 1, y) < L or lv(x + 1, y) < L) and not face
        pathy = c in '=^' or c in "0123456789<>az" and False
        if (face or rim) and c not in '=^' and (x, y) not in LAD: return False
        return True
    seen = {start}; q = [start]
    while q:
        x, y = q.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in seen and walk(*n): seen.add(n); q.append(n)
    for y in range(H):
        for x in range(W):
            if g.lv[y][x] > 0 and walk(x, y) and (x, y) not in seen and g.a[y][x] in '.":;': g.a[y][x] = 'r'
LAD = set()

def dongdo_dock():  # route0 숫돌바위 길: 동도 선착장(D40~D45)에서 지그재그 계단으로 동도 위로
    global LAD
    g = Grid('~', 52, 34)
    def isl(x, y):
        if y < 2 or y > 31: return False
        xl = 26 if y <= 5 else 20 if y <= 9 else 15 if y <= 21 else 18 if y <= 26 else 22 if y <= 29 else 30
        return x >= xl
    rocky = lambda x, y, L: '"' if (L == 3 and 30 <= x <= 47 and (7 <= y <= 11 or 17 <= y <= 22)) else '.'
    plateau(g, isl, 3, 2, rocky)
    # 선착장(L자 부두) · 몽돌 해변 · 여객선
    g.rect(3, 23, 14, 25, '#'); g.rect(3, 17, 5, 22, '#'); g.rect(0, 24, 2, 24, '#'); g.text(0, 24, '<a')
    g.rect(3, 26, 14, 26, 'k'); g.rect(6, 22, 14, 22, 'k'); g.rect(2, 17, 2, 22, 'k'); g.rect(6, 17, 6, 21, 'k')
    g.rect(15, 22, 17, 27, ';'); g.put(8, 28, 'F')
    # 바다 위 바위(선착장에서 보이는 바위섬들, 창작 배치)
    g.rect(2, 6, 3, 10, 'r'); g.rect(7, 9, 10, 12, 'r'); g.put(12, 4, 'r'); g.put(1, 13, 'r')
    # 입구길 → 지그재그 나무 계단 → 동도 위
    path(g, [(15, 24), (22, 24), (22, 20), (26, 20), (26, 16), (21, 16), (21, 12), (51, 12)])
    g.text(50, 12, 'z>')
    path(g, [(30, 12), (30, 6), (44, 6)]); path(g, [(38, 12), (38, 22), (46, 22)])
    LAD = {(40, 31)}; g.put(40, 31, '.')
    g.rect(33, 14, 35, 16, 'r'); g.put(34, 13, '0')  # 숫돌바위
    g.put(9, 24, '1'); g.put(12, 24, '2'); g.put(16, 26, '3'); g.put(40, 12, '4'); g.put(46, 9, '5'); g.put(46, 23, '6'); g.put(24, 12, '7')
    seal(g, (1, 24))
    return g, {'ladders': [[40, 31]]}

def dongdo_arch():  # route2 독립문바위 바닷길: 동도 위 → 동쪽 계단 → 작은 부두에서 서도행 배(다리 없음, D01·D12)
    global LAD
    g = Grid('~', 52, 34)
    def isl(x, y):
        if y < 3 or y > 30: return False
        xr = 30 if y <= 6 else 36 if y <= 17 else 38 if y <= 24 else 33
        return x <= xr
    rocky = lambda x, y, L: '"' if (L == 3 and ((4 <= x <= 14 and 17 <= y <= 23) or (20 <= x <= 28 and 6 <= y <= 10))) else '.'
    plateau(g, isl, 3, 2, rocky)
    path(g, [(0, 13), (30, 13), (30, 20), (34, 20), (34, 22), (51, 22)])
    g.text(0, 13, '<a'); g.rect(39, 21, 49, 23, '#'); g.text(50, 22, 'z>'); g.put(51, 21, '~'); g.put(50, 21, '#'); g.put(50, 23, '#'); g.put(51, 23, '~')
    g.rect(39, 24, 49, 24, 'k'); g.put(45, 26, 'b')
    path(g, [(10, 13), (10, 24)]); path(g, [(22, 13), (22, 7), (27, 7)])
    # 독립문바위(D12): 동도 동쪽 끝에서 바다로 내민 아치 바위
    g.rect(38, 9, 42, 12, 'r'); g.put(41, 13, '0')
    LAD = {(20, 30)}; g.put(20, 30, '.')
    g.put(36, 22, '1'); g.put(16, 13, '2'); g.put(44, 22, '3'); g.put(30, 16, '4'); g.put(24, 9, '5'); g.put(10, 25, '6'); g.put(5, 13, '7')
    seal(g, (1, 13))
    return g, {'ladders': [[20, 30]]}

def current_art(map_id):
    src = open(ROOT, encoding='utf8').read(); i = src.index(f"id: '{map_id}'"); j = src.index('art: [', i); k = src.index('],', j)
    return re.findall(r"'([^']*)'", src[j:k])

def seodo_town():  # town3 탕건봉(서도): 서도 선착장 바로 옆 주민숙소(D51), 그 뒤로 숙소보다 훨씬 높은 바위 절벽(D50)
    rows = current_art('town3'); g = Grid('~', len(rows[0]), len(rows))
    for y, r in enumerate(rows):
        for x, c in enumerate(r): g.a[y][x] = c
    # 쉼터(주민숙소)와 집 자리 바꾸기: 숙소는 선착장 바로 아래 바닷가
    for y in range(17, 21):
        for x in range(26, 31): g.a[y][x] = '.'
    for y in range(22, 26):
        for x in range(4, 9): g.a[y][x] = '.'
    g.rect(4, 22, 8, 25, 'O'); g.rect(26, 17, 30, 20, 'h'); g.put(9, 24, 'S'); g.put(32, 19, '.')
    # 바위 덩어리 → 높은 절벽(가운데일수록 높게, 최대 6층)
    R = {(x, y) for y in range(len(rows)) for x in range(len(rows[0])) if rows[y][x] == 'r'}
    fp = lambda x, y: (x, y) in R
    for (x, y) in R:
        d = 0
        while d < 8 and all(fp(x + dx, y + dy) for dx in range(-d - 1, d + 2) for dy in range(-d - 1, d + 2)): d += 1
        g.lv[y][x] = min(6, 1 + 2 * d)
    # 남쪽 절벽 면: 바위 아래 첫 칸은 절벽 면(바위를 치워요)
    for (x, y) in R:
        if (x, y + 1) not in R and g.a[y + 1][x] in '.r': g.a[y + 1][x] = '.'
    return g, {'ladders': []}

def write(map_id, g, extra=None):
    src = open(ROOT, encoding='utf8').read()
    if extra:
        a = src.index(f"id: '{map_id}'"); b = src.index('kind:', a)
        lad = f" ladders: {json.dumps(extra['ladders'])}," if extra['ladders'] else ''
        head = f"id: '{map_id}', crags: false,{lad} // v0.74 실사 참고로 다시 그린 지도(gen.py)\n    "
        src = src[:a] + head + src[b:]
    i = src.index(f"id: '{map_id}'"); j = src.index('art: [', i); k = src.index('],', j)
    art = 'art: [\n' + ',\n'.join(f"   '{r}'" for r in g.rows()) + '\n  ]'
    lv = 'levels: [\n' + ',\n'.join(f"   '{r}'" for r in g.levels()) + '\n  ]'
    # 이미 levels 가 있으면 바꾸고, 없으면 art 바로 앞에 넣어요
    head = src[i:j]
    m = re.search(r"levels: \[.*?\],\n\s*", src[i:k], re.S)
    if m: src = src[:i + m.start()] + src[i + m.end():]; i = src.index(f"id: '{map_id}'"); j = src.index('art: [', i); k = src.index('],', j)
    src = src[:j] + lv + ',\n    ' + art + src[k + 1:]
    open(ROOT, 'w', encoding='utf8').write(src)
    print('\n'.join(a + '   ' + b for a, b in zip(g.rows(), g.levels())))

if __name__ == '__main__':
    name = sys.argv[1]; r = globals()[name](); g, extra = r if isinstance(r, tuple) else (r, None)
    write({'dodong': 'town0', 'dongdo_dock': 'route0', 'dongdo_arch': 'route2', 'seodo_town': 'town3'}[name], g, extra)
