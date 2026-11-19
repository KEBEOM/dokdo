#!/usr/bin/env python3
"""울릉도·독도 맵 에셋 팩 v1(GLB)에서 게임이 쓰는 입체 모델을 가져와요 (v0.81).

  python3 scripts/import-glb-pack.py <압축 푼 ulleungdo_dokdo_assets 폴더>
  → dist/glb-models.js               (모델 삼각형: 위치·법선·색·재질 — 한 파일 판에도 그대로 들어가요)
    dist/assets/scenery/glb-surf.png  (표면 무늬 5칸 64×64: 층리 절벽·응회암·콘크리트·황토 바위·풀, surface-atlas.json의 실제 픽셀 사각형에서)
    docs/GLB-적용.md                  (어떤 모델을 어디에 썼는지 · 쓰지 않은 것과 이유)

GLB는 three.js GLTFExporter r180이 만든 glTF 2.0 바이너리예요. 노드의 matrix/TRS를 곱해 한 덩어리로 펴고,
재질 색(선형)·정점 색(선형)을 곱한 뒤 sRGB로 바꿔요. 모델 단위는 제작용 상대 단위(1 = 실내 한 칸)라
게임에서 놓을 때 지도 칸에 맞춰 크기를 정해요. 충돌은 지도 칸 그대로(모델 상자를 충돌로 쓰지 않아요).
"""
import base64, json, math, os, struct, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = sys.argv[1] if len(sys.argv) > 1 else ''
PACK2 = sys.argv[2] if len(sys.argv) > 2 else ''  # v0.82: 「독도 탐험대 v0.81 에셋 팩」(바위 지명 4 · 동도 선착장)

# 게임에서 쓰는 모델: (id, 쓰는 곳)
USE = {
    'sutdol': '숫돌바위 길(route0) 숫돌바위', 'independence': '독립문바위 바닷길(route2) 독립문바위', 'candle': '촛대바위 해안(route3) 촛대바위',
    'elephant': '코끼리바위(town5) 코끼리바위', 'three_caves': '삼형제굴바위 해안(route5) 삼형제굴바위', 'tanggeon': '탕건봉(town3) 탕건봉',
    'stairs': '절벽 계단 칸 · 건물 안 오르는 계단', 'railing': '선착장·산책로 난간',
    'helipad': '우산봉(town1) 헬기장', 'tetrapod': '도동항 방파제 소파블록',
}
SKIP = {
    'terminal': '도동항 여객선터미널은 에셋팩 그림 판(더 자세함)을 그대로 써요', 'residence': '서도 주민숙소는 그림 판(사용자 선택: 집·가게는 그림 유지)',
    'guardhouse': '독도경비대풍 건물은 그림 판', 'solar': '태양광 건물은 그림 판', 'thatched_house': '나리분지엔 지금 건물 칸이 없어 놓을 자리가 없어요(새 건물 칸을 만들면 충돌·출입이 바뀌어요)',
    'ferry': '여객선은 그림 판', 'tree': '나무는 v0.79의 도트 나무(소나무·활엽수·동백)', 'beacon': '지금 지도에 등표 자리가 없어요',
    'pier': 'v0.81 팩의 동도 선착장(지도 칸에 맞춘 것)을 대신 써요',
    'lighthouse': 'v0.82부터 동도 연구소는 이야기 시설 그림(story_dd_lab). 실제 등대의 역할과 이야기 시설을 섞지 않아요',
}
# v0.82 「독도 탐험대 v0.81 에셋 팩」 모델: (id, 쓰는 곳)
USE2 = {
    'bochal': '보찰바위 갯바위(route4) — 일반 갯바위 대체 모델, 형상 추정', 'sangjanggun': '상장군바위 오르막(route6) — 임시 이름·일반 세로 바위, 형상 추정',
    'hanbando': '한반도바위(town2) — 자연 암벽·식생 사면 단순화, 뒷면·깊이 추정', 'cheonjanggul': '우산봉(town1) 천장굴 둘레 — 지도 r칸만 입체화, 굴 구조 복원 아님',
    'dongdo_pier': '숫돌바위 길(route0) 동도 선착장 — 지도 칸 그대로, 1·2 칸은 바닥만(설치물 없음), a·< 출구와 3 칸은 모델 없음',
}
ROCK = ('closed_mesh', 'arch', 'shoulder', 'cave')
CONCRETE = ('step_', 'slab', 'arm', 'berth', 'shore_link', 'quay')
# 재질 번호(셰이더): 0 단색(도트 잡음) · 1 층리 절벽 · 2 응회암 · 3 콘크리트 · 4 황토 바위 · 5 풀(v0.82)
def material_class(model, name):
    n = (name or '').lower()
    for pre, c in (('rock_', 1), ('concrete_', 3), ('metal_', 0), ('paint_', 0), ('glass_', 0), ('wood_', 0), ('grass_', 5)):  # v0.81 팩: 노드 이름 앞 재질 종류
        if n.startswith(pre): return c
    if any(k in n for k in ROCK): return 4 if model == 'sutdol' else 1  # 독도 바위는 층리 절벽 무늬, 숫돌바위는 황토 바위
    if any(n.startswith(k) or k in n for k in CONCRETE): return 3
    return 0

COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NUM = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def read_glb(path):
    b = open(path, 'rb').read(); assert b[:4] == b'glTF', path
    jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl])
    off = 20 + jl; bl = struct.unpack('<I', b[off:off + 4])[0]; binc = b[off + 8:off + 8 + bl]
    return j, binc

def accessor(j, binc, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; fmt, size = COMP[a['componentType']]; n = NUM[a['type']]
    stride = bv.get('byteStride') or size * n; base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = np.zeros((a['count'], n), np.float64)
    dt = np.dtype('<' + fmt)
    for k in range(a['count']):
        out[k] = np.frombuffer(binc, dt, n, base + k * stride)
    if a.get('normalized'):
        out /= {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}[a['componentType']]
    return out

def node_matrix(n):
    if 'matrix' in n: return np.array(n['matrix'], np.float64).reshape(4, 4).T
    t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = r
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4); M[:3, :3] = R * np.array(s); M[:3, 3] = t; return M

def lin2srgb(c): c = np.clip(c, 0, 1); return np.where(c <= .0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - .055)

def flatten(model, path, keep=None):
    j, binc = read_glb(path); P, N, C = [], [], []
    def walk(ni, M):
        n = j['nodes'][ni]; M2 = M @ node_matrix(n); name = n.get('name', '')
        if keep and ni != j['scenes'][j.get('scene', 0)]['nodes'][0] and not keep(name): return
        if 'mesh' in n:
            for pr in j['meshes'][n['mesh']]['primitives']:
                if pr.get('mode', 4) != 4: continue
                pos = accessor(j, binc, pr['attributes']['POSITION']); nrm = accessor(j, binc, pr['attributes']['NORMAL']) if 'NORMAL' in pr['attributes'] else None
                vc = accessor(j, binc, pr['attributes']['COLOR_0'])[:, :3] if 'COLOR_0' in pr['attributes'] else None
                idx = accessor(j, binc, pr['indices'])[:, 0].astype(int) if 'indices' in pr else np.arange(len(pos))
                mat = j['materials'][pr['material']] if 'material' in pr else {}
                base = np.array(mat.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[:3])
                wp = (np.c_[pos, np.ones(len(pos))] @ M2.T)[:, :3]
                Nm = np.linalg.inv(M2[:3, :3]).T
                cls = material_class(model, name)
                for t in range(0, len(idx) - 2, 3):
                    tri = idx[t:t + 3]; a, b, c = wp[tri]
                    fn = np.cross(b - a, c - a); L = np.linalg.norm(fn)
                    if L < 1e-12: continue
                    for k in tri:
                        p = wp[k]; nn = (Nm @ nrm[k]) if nrm is not None else fn / L; nn = nn / (np.linalg.norm(nn) or 1)
                        col = base * (vc[k] if vc is not None else 1)
                        P.append(p); N.append(nn); C.append([*lin2srgb(col), cls])
        for ch in n.get('children', []): walk(ch, M2)
    for r in j['scenes'][j.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    P = np.array(P, np.float32); N = np.array(N, np.float32); C = np.array(C, np.float32)
    return P, N, C

def enc(arr): return base64.b64encode(arr.tobytes()).decode('ascii')

def main():
    if not PACK or not os.path.exists(os.path.join(PACK, 'manifest.json')): sys.exit('ulleungdo_dokdo_assets 폴더(manifest.json 이 있는 곳)를 알려 주세요.')
    man = json.load(open(os.path.join(PACK, 'manifest.json'), encoding='utf8'))
    models, notes = {}, []
    for a in man['assets']:
        if a['id'] not in USE: continue
        P, N, C = flatten(a['id'], os.path.join(PACK, a['file']))
        mn, mx = P.min(0), P.max(0)
        col = np.clip(np.round(C[:, :3] * 255), 0, 255).astype(np.uint8); cls = C[:, 3:4].astype(np.uint8)
        models[a['id']] = {'n': len(P), 'min': [round(float(v), 4) for v in mn], 'max': [round(float(v), 4) for v in mx],
                           'pos': enc(P), 'nrm': enc(np.clip(np.round(N * 127), -127, 127).astype(np.int8)), 'col': enc(np.concatenate([col, cls], 1))}
        notes.append((a['id'], len(P) // 3, [round(float(v), 2) for v in mx - mn]))
    anchors = {}
    if PACK2:
        man2 = json.load(open(os.path.join(PACK2, 'manifest.json'), encoding='utf8'))
        for a in man2['assets']:
            if a['id'] not in USE2: continue
            P, N, C = flatten(a['id'], os.path.join(PACK2, a['file']))
            mn, mx = P.min(0), P.max(0)
            col = np.clip(np.round(C[:, :3] * 255), 0, 255).astype(np.uint8); cls = C[:, 3:4].astype(np.uint8)
            models[a['id']] = {'n': len(P), 'min': [round(float(v), 4) for v in mn], 'max': [round(float(v), 4) for v in mx], 'anchor': a.get('recommended_anchor_map_grid'), 'map': a.get('map'),
                               'pos': enc(P), 'nrm': enc(np.clip(np.round(N * 127), -127, 127).astype(np.int8)), 'col': enc(np.concatenate([col, cls], 1))}
            notes.append((a['id'], len(P) // 3, [round(float(v), 2) for v in mx - mn])); USE[a['id']] = USE2[a['id']]; anchors[a['id']] = (a.get('map'), a.get('recommended_anchor_map_grid'))
    # 실내 모델 10종 × 80곳: GLB 벽 자리가 지금 건물 안 벽 칸과 같은지(방 왼쪽 위 기준) 확인만 해요
    import subprocess
    ids = [i for r in man['rooms'] for i in r['instances']]
    ours = json.loads(subprocess.check_output(['node', os.path.join(ROOT, 'scripts', 'dump-room-walls.mjs'), json.dumps(ids)], cwd=ROOT))
    room_rows = []
    for r in man['rooms']:
        j, _ = read_glb(os.path.join(PACK, r['file'])); walls = set()
        def walk(ni, M):
            n = j['nodes'][ni]; M2 = M @ node_matrix(n)
            if n.get('name') == 'wall': walls.add((round(M2[0, 3] * 2), round(M2[2, 3] * 2)))  # 칸 가운데(반 칸 단위까지)
            for ch in n.get('children', []): walk(ch, M2)
        for rt in j['scenes'][j.get('scene', 0)]['nodes']: walk(rt, np.eye(4))
        xs = [w[0] for w in walls]; zs = [w[1] for w in walls]; gw = {((x - min(xs)) // 2, (z - min(zs)) // 2) for x, z in walls}
        same = 0
        for i in r['instances']:
            o = ours.get(i)
            if o and {tuple(w) for w in o['walls']} == gw: same += 1
        room_rows.append((r['id'], r['name'], len(r['instances']), same))
    # 표면 무늬: surface-atlas.json 의 실제 픽셀 사각형 → 64×64(가장 가까운 색으로 줄이고 색 수 줄이기)
    atlas = Image.open(os.path.join(PACK, 'textures', 'surface-atlas.png')).convert('RGB'); fr = json.load(open(os.path.join(PACK, 'textures', 'surface-atlas.json')))['frames']
    sheet = Image.new('RGB', (320, 64))
    for i, k in enumerate(['stratified_cliff', 'dark_tuff', 'concrete', 'ochre_rock', 'short_grass']):
        f = fr[k]; t = atlas.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])).resize((64, 64), Image.LANCZOS)
        t = t.quantize(colors=20, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'); sheet.paste(t, (i * 64, 0))
    sheet.save(os.path.join(ROOT, 'dist', 'assets', 'scenery', 'glb-surf.png'), optimize=True)
    with open(os.path.join(ROOT, 'dist', 'glb-models.js'), 'w', encoding='utf8') as f:
        f.write('// 울릉도·독도 맵 에셋 팩 v1의 GLB 모델(scripts/import-glb-pack.py가 만들어요). 단위: 제작용 상대 단위, Y 위.\n')
        f.write('// pos Float32 x,y,z · nrm Int8 x,y,z(÷127) · col Uint8 r,g,b,재질(0 단색 · 1 층리 절벽 · 2 응회암 · 3 콘크리트 · 4 황토 바위 · 5 풀)\n')
        f.write('export const GLB_SURF = "scenery/glb-surf";\n')
        f.write('export const GLB_MODELS = ' + json.dumps(models) + ';\n')
        f.write('''const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
const cache = new Map();
// 모델 하나를 풀어요(한 번만): { n, min, max, pos: Float32Array, nrm: Int8Array, col: Uint8Array }
export function glbModel(id) {
  if (cache.has(id)) return cache.get(id); const m = GLB_MODELS[id]; if (!m) return null;
  const out = { n: m.n, min: m.min, max: m.max, pos: new Float32Array(b64(m.pos)), nrm: new Int8Array(b64(m.nrm)), col: new Uint8Array(b64(m.col)) };
  cache.set(id, out); return out;
}
''')
    with open(os.path.join(ROOT, 'docs', 'GLB-적용.md'), 'w', encoding='utf8') as f:
        f.write('# 울릉도·독도 맵 에셋 팩 v1 (GLB) 적용표\n\n자동으로 만들어요: `scripts/import-glb-pack.py`. 모델은 단색 저폴리곤 초안이라, 게임에서는 셀 셰이딩 + 팩의 표면 무늬(층리 절벽·응회암·콘크리트)를 세계 좌표로 입혀요.\n\n')
        f.write('## 쓴 모델\n\n| 모델 | 쓰는 곳 | 삼각형 | 크기(단위) |\n|---|---|---|---|\n')
        for k, t, s in notes: f.write(f'| {k} | {USE[k]} | {t} | {s[0]} × {s[1]} × {s[2]} |\n')
        f.write('\n## 쓰지 않은 모델과 이유\n\n| 모델 | 이유 |\n|---|---|\n')
        for k, why in SKIP.items(): f.write(f'| {k} | {why} |\n')
        f.write('| models/maps/*.glb (16) | 팩 설명대로 구조 검토용 초안이라 지도(칸·층·출입구)를 덮어쓰지 않았어요 |\n')
        f.write('| models/rooms/*.glb (10) | 벽 자리가 지금 건물 안 칸과 같은지 시험으로 확인만 하고(tests/v081), 벽·바닥은 도트 그림 벽 그대로. 오르는 계단만 계단 모델로 |\n')
        f.write('\n## 실내 모델 확인(벽 칸 비교)\n\n| 모델 | 이름 | 쓰는 방 | 지금 건물 안 벽 칸과 같은 방 |\n|---|---|---|---|\n')
        for rid, nm, n, same in room_rows: f.write(f'| {rid} | {nm} | {n} | {same} |\n')
        f.write('\n')
        f.write('| renders/*.png | 모델 미리보기 그림이라 게임 그림으로 쓰지 않았어요(HD-2D 화면은 모델을 직접 그려요) |\n')
        f.write('| textures/building-reference.png | 배경 알파가 정리되지 않은 참고 그림이라 쓰지 않았어요 |\n')
    print('models', [(k, t) for k, t, _ in notes]); print('surface', 'glb-surf.png'); print('rooms', room_rows)

if __name__ == '__main__':
    main()
