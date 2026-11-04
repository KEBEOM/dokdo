# ─────────────────────────────────────────────────────────────────────────────
# 문제 은행 만들기 (v0.56)
#
#   python3 scripts/build-questions.py      →  dist/learning.js 를 새로 써요
#
# 문제 원본: scripts/questions/*.txt  (한 줄에 문제 하나)
#   개념|지역|자료|문제|정답|오답|오답|오답|해설
#   · 개념: G1 G2 N3 N4 E3 E4 H1 H3 H4 S3 S4 V1 (dist/learning.js CONCEPTS)
#   · 지역: 0~7 — 그 지역(장)에 도착한 뒤부터 나와요
#   · 자료: scripts/questions/sources.tsv 의 열쇠(D, AN, KG3 …). 모든 문제는 자료 하나에 근거해요.
#   · 정답은 첫 칸에 적어요. 게임은 선택지를 섞어서 보여 줘요(저장할 때는 정답 자리를 고르게 돌려요).
# 자료는 이용 조건이 분명한 곳만 써요.
#   enc   한국민족문화대백과사전 본문 — 저작권법 제24조의2(공공저작물의 자유이용), 출처 표시
#   kogl1 정책브리핑(korea.kr) 텍스트 — 공공누리 제1유형(출처표시)
# ─────────────────────────────────────────────────────────────────────────────
import glob, json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
QDIR = os.path.join(ROOT, 'scripts', 'questions')
CONCEPTS = [
    ('G1', '울릉도와 독도의 위치', '사회 [6사01-02]'),
    ('G2', '동도와 서도', '사회 [6사01-02]'),
    ('N3', '생물과 서식 환경', '사회 [6사01-02] 연계'),
    ('N4', '관찰과 추측 구별', '국어 [6국06-02] 연계'),
    ('E3', '강치와 남획', '사회 [6사01-02] 연계'),
    ('E4', '독도의 자연 보호', '사회 [6사01-02] 연계'),
    ('H1', '시대와 인물 구별', '사회 [6사01-02]'),
    ('H3', '안용복의 활동', '사회 [6사01-02]'),
    ('H4', '칙령과 보고서', '사회 [6사01-02]'),
    ('S3', '출처와 맥락 확인', '국어 [6국06-02]'),
    ('S4', '주장과 근거 연결', '국어 [6국06-02] 연계'),
    ('V1', '독도의 중요성 설명', '사회 [6사01-02]'),
]
LICENSE = {
    'enc': '저작권법 제24조의2(공공저작물의 자유이용) · 출처 표시',
    'kogl1': '공공누리 제1유형(출처표시) · 텍스트',
}
LIMITS = {'prompt': 60, 'option': 32, 'explanation': 95}


def sources():
    out = {}
    for line in open(os.path.join(QDIR, 'sources.tsv'), encoding='utf-8'):
        if not line.strip() or line.startswith('#'): continue
        key, pub, title, url, lic = line.rstrip('\n').split('\t')
        assert lic in LICENSE, (key, lic)
        cite = f'[{title}], 『한국민족문화대백과사전』' if lic == 'enc' else f'{pub}, 「{title}」'
        out[key] = {'title': f'{pub} — {title}', 'url': url, 'publisher': pub, 'license': LICENSE[lic], 'cite': cite}
    return out


def main():
    src = sources(); errors = []; rows = []
    for path in sorted(glob.glob(os.path.join(QDIR, '*.txt'))):
        for n, line in enumerate(open(path, encoding='utf-8'), 1):
            if not line.strip() or line.startswith('#'): continue
            parts = line.rstrip('\n').split('|')
            where = f'{os.path.basename(path)}:{n}'
            if len(parts) != 9: errors.append(f'{where}: 칸이 9개가 아니에요({len(parts)})'); continue
            c, zone, key, prompt, *opts, expl = parts
            opts = opts[:4]
            if c not in dict((x[0], 1) for x in CONCEPTS): errors.append(f'{where}: 개념 {c}')
            if key not in src: errors.append(f'{where}: 자료 {key}')
            if not zone.isdigit() or not 0 <= int(zone) <= 7: errors.append(f'{where}: 지역 {zone}')
            if len(set(opts)) != 4: errors.append(f'{where}: 선택지가 겹쳐요')
            if len(prompt) > LIMITS['prompt']: errors.append(f'{where}: 문제가 길어요({len(prompt)})')
            for o in opts:
                if len(o) > LIMITS['option']: errors.append(f'{where}: 선택지가 길어요({len(o)}) {o}')
            if len(expl) > LIMITS['explanation']: errors.append(f'{where}: 해설이 길어요({len(expl)})')
            rows.append((c, int(zone), key, prompt, opts, expl))
    prompts = [r[3] for r in rows]
    dup = {p for p in prompts if prompts.count(p) > 1}
    if dup: errors.append(f'같은 문제가 두 번: {dup}')
    if errors:
        print('\n'.join(errors)); sys.exit(1)
    # 개념마다 차례로 번호를 매기고, 정답 자리를 0~3으로 고르게 돌려요
    order = {c[0]: i for i, c in enumerate(CONCEPTS)}
    rows.sort(key=lambda r: (order[r[0]], ))
    counts, questions = {}, []
    for c, zone, key, prompt, opts, expl in rows:
        counts[c] = counts.get(c, 0) + 1; k = counts[c]
        ans = (k * 3 + order[c]) % 4
        options = opts[1:]; options.insert(ans, opts[0])
        questions.append({'id': f'{c}-{k}', 'concept': c, 'zone': zone, 'prompt': prompt, 'options': options, 'answer': ans, 'explanation': expl, 'source': src[key]['url']})
    used = []
    for key, s in src.items():
        if any(q['source'] == s['url'] for q in questions) or key in ('CU',): used.append(s)
    js = ['// ─────────────────────────────────────────────────────────────────────────────',
          '// 독도 학습 문제 은행 — scripts/build-questions.py 가 scripts/questions/*.txt 로 만든 파일이에요(직접 고치지 마세요).',
          '// 모든 문제는 이용 조건이 분명한 공공 자료 하나에 근거해요(SOURCES의 license).',
          '//   한국민족문화대백과사전(한국학중앙연구원) 본문: 저작권법 제24조의2 공공저작물 자유이용 · 출처 표시',
          '//   정책브리핑(korea.kr) 보도자료·정책뉴스 텍스트: 공공누리 제1유형(출처표시)',
          '// 문제·선택지·해설은 자료의 사실을 초등학생 눈높이로 새로 쓴 글이에요. NPC 대사와 기억의 세계 장면은 창작이에요.',
          '// ─────────────────────────────────────────────────────────────────────────────',
          'export const SOURCES = ' + json.dumps(used, ensure_ascii=False, indent=1) + ';',
          'export const CONCEPTS = ' + json.dumps([{'id': i, 'title': t, 'standard': s} for i, t, s in CONCEPTS], ensure_ascii=False) + ';',
          'export const QUESTIONS = [']
    js += ['  ' + json.dumps(q, ensure_ascii=False) + ',' for q in questions]
    js += ['];', '']
    open(os.path.join(ROOT, 'dist', 'learning.js'), 'w', encoding='utf-8').write('\n'.join(js))
    # 선생님용 목록(엑셀에서 열려요): docs/문제은행-출처.csv
    import csv
    os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
    by_url = {x['url']: x for x in used}; titles = {i: t for i, t, _ in CONCEPTS}
    with open(os.path.join(ROOT, 'docs', '문제은행-출처.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['번호', '개념', '지역(장)', '문제', '정답', '오답1', '오답2', '오답3', '해설', '출처 표기', '이용 조건', '자료 주소'])
        for q in questions:
            wrong = [o for i, o in enumerate(q['options']) if i != q['answer']]
            sr = by_url[q['source']]
            w.writerow([q['id'], titles[q['concept']], q['zone'] + 1, q['prompt'], q['options'][q['answer']], *wrong, q['explanation'], sr['cite'], sr['license'], q['source']])
    zones = {c[0]: sorted({q['zone'] for q in questions if q['concept'] == c[0]}) for c in CONCEPTS}
    print(f'문제 {len(questions)}개 · 자료 {len(used)}곳')
    for c, n in counts.items(): print(f'  {c} {n}문제 · 지역 {zones[c]}')


if __name__ == '__main__':
    main()
