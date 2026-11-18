"""지도 설계 도우미: 산(발자국) → 고리마다 한 층씩 높아지는 계단식 절벽 + 나무/바위, 그 위에 길·건물·물건을 찍어요.
python3 scripts/design-maps.py dodong|dongdo_dock|dongdo_arch|seodo_town  → 지도 글자(art)·층(levels)을 maps.js 에 바로 써 넣어요(v0.74, art/실사-참고표.md 참고)."""
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

def dodong():
    g = Grid('~', 64, 46)
    g.rect(22, 0, 42, 7, '.'); g.rect(14, 8, 49, 20, '.'); g.rect(5, 21, 55, 28, '=')
    def left(x, y):
        if y <= 7: return x <= 21
        if y <= 20: return x <= 13
        if y <= 28: return x <= 4
        if y <= 41: return x <= 22
        if y <= 43: return x <= 9
        return x <= 8
    def right(x, y):
        if y <= 7: return x >= 43
        if y <= 20: return x >= 50
        if y <= 28: return x >= 56
        if y <= 33: return x >= 45
        if y <= 36: return x >= 52
        return False
    g.mountain(left, 6, rock=lambda x, y, L: y >= 42)
    g.mountain(right, 6)
    # 뒷산 공사장 터(1층) — 오른쪽 바위 턱 계단(골목에서)과 아래 절벽 계단(광장에서)으로 올라가요
    for y in range(10, 21):
        for x in range(4, 13): g.lv[y][x] = 1; g.a[y][x] = '.'
    g.text(5, 11, 'nnnnnnn'); g.text(5, 12, '7.E'); g.text(8, 18, '"""'); g.text(8, 19, '"""'); g.put(6, 18, 'V')
    g.put(4, 15, 'T'); g.put(11, 17, 'T'); g.put(5, 20, 'T')
    g.rect(8, 13, 12, 13, '='); g.put(13, 13, '='); g.rect(8, 14, 8, 21, '=')
    # 바다(만)
    g.rect(25, 30, 41, 45, '~'); g.rect(23, 44, 63, 45, '~'); g.rect(10, 44, 22, 45, '~'); g.rect(42, 38, 63, 43, '~')
    g.rect(25, 29, 42, 29, '#')
    # 행남 해안산책로
    g.rect(23, 29, 24, 29, '='); g.rect(23, 30, 23, 41, '='); g.rect(24, 30, 24, 41, 'k')
    g.rect(10, 42, 23, 43, '='); g.rect(10, 44, 23, 44, 'k'); g.rect(24, 42, 24, 43, 'k'); g.text(15, 42, 'rr')
    for y in range(42, 44):
        for x in range(10, 24): g.lv[y][x] = 0
    g.put(22, 28, '8')
    # 보행교 → 터미널 → 부두 끝 출구, 소파블록
    g.rect(43, 29, 44, 36, '#'); g.rect(42, 30, 42, 36, 'k')
    for y in range(29, 37): g.lv[y][43] = g.lv[y][44] = 0
    g.rect(45, 34, 51, 36, 'C')
    for y in range(34, 37):
        for x in range(45, 52): g.lv[y][x] = 0
    g.rect(42, 37, 63, 37, '#'); g.text(62, 37, 'z>'); g.rect(43, 38, 54, 38, 'k')
    g.rect(55, 38, 63, 38, 'x'); g.rect(46, 39, 57, 39, 'x'); g.rect(52, 40, 60, 40, 'x'); g.rect(58, 41, 63, 41, 'x')
    g.put(38, 31, 'F'); g.put(30, 40, 'b'); g.put(42, 27, 'a')
    # 시가지 길
    g.rect(33, 6, 34, 28, '='); g.rect(22, 6, 42, 6, '='); g.rect(14, 13, 49, 13, '='); g.rect(14, 20, 49, 20, '=')
    g.rect(20, 8, 21, 12, '='); g.rect(47, 14, 47, 19, '=')
    # 큰 건물(들어갈 수 있는 4채)
    g.rect(30, 1, 36, 5, 'Y'); g.rect(22, 9, 26, 12, 'h'); g.rect(40, 9, 44, 12, 'L'); g.rect(14, 22, 18, 25, 'O')
    # 촘촘한 시가지(들어갈 수 없는 집·상가)
    D = lambda x, y: g.rect(x, y, x + 2, y + 1, 'd'); B = lambda x, y: g.rect(x, y, x + 4, y + 2, 'D')
    for y in (0, 2, 4): D(22, y); D(25, y)
    B(37, 1); D(37, 4); D(40, 4)
    D(22, 7); D(25, 7); D(14, 8); D(17, 8); D(14, 10); D(17, 10); B(28, 8); B(35, 7); D(35, 10); D(40, 7); D(45, 8); D(45, 10)
    D(14, 14); D(17, 14); B(14, 16); B(21, 14); D(21, 17); D(24, 17); D(27, 14); D(30, 14); B(27, 16); B(35, 14); D(35, 17); D(38, 17); B(41, 14); D(41, 17); D(44, 17); D(48, 15) if False else None
    # 광장 둘레
    D(5, 22); D(8, 22); D(5, 24); B(45, 21); D(50, 21); D(53, 21); B(48, 24); D(53, 24)
    for x, y in [(28, 11), (31, 12), (20, 19), (26, 19), (40, 19), (24, 23), (40, 23), (28, 25), (12, 27)]: g.put(x, y, 'T')
    g.text(31, 24, 'MMM'); g.put(36, 25, '6')
    g.put(36, 6, 'J'); g.put(19, 24, 'S'); g.put(45, 13, 'P'); g.text(27, 27, 'G.B.H.1'); g.put(40, 25, '2'); g.put(26, 13, '3'); g.put(38, 20, '4'); g.put(20, 20, '5'); g.put(52, 27, 'W')
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
