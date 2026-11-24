"""Build dist/knowledge.js (+ data.js record upgrade) from kb/*.py and kb/wrong.json."""
import json, re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from species import S, NIBR_LISTED, NIBR_NOT_FOUND
from places import P
DIST = os.path.join(HERE, '..', '..', 'dist')

KB_SOURCES = [
    ['국립생물자원관', '「독도 생물종 목록집」(2015)', '우산몬 모티브 생물의 학명과 독도 기록 여부'],
    ['국가지명위원회', '독도 지명 결정(2012)', '독도 바위·봉우리 이름의 뜻과 유래'],
    ['동북아역사재단', '「누구나 쉽게 활용할 수 있는 독도 안내서」(2022)', '고시된 독도 지명의 자리(좌표)'],
    ['국가유산청(옛 문화재청)', '천연기념물 지정 정보', '천연기념물로 지정된 새와 독도 사철나무'],
    ['환경부', '멸종위기 야생생물 목록', '멸종위기 야생생물 Ⅰ·Ⅱ급'],
    ['해양수산부', '해양보호생물 지정(2007)', '강치(바다사자)'],
    ['국제자연보전연맹(IUCN)', '적색목록', '강치의 절멸 판정'],
    ['한국학중앙연구원·정책브리핑·외교부 독도 누리집 등', '문제 해설의 근거 자료', '퀴즈 정답·오답 설명(학습 자료 출처 목록과 같아요)'],
]
NOTE = '공공기관 자료에서 사실만 가져오고 문장은 게임에 맞게 직접 썼어요. 게임 안에는 바깥 주소(링크)를 두지 않아요.'

wrong = json.load(open(os.path.join(HERE, 'wrong.json')))
species = {}
for i, (sci, grp, look, home, dokdo, prot) in S.items():
    src = []
    if i in NIBR_LISTED: src.append('국립생물자원관 「독도 생물종 목록집」(2015)')
    if '천연기념물' in prot: src.append('국가유산청 천연기념물 정보')
    if '멸종위기' in prot: src.append('환경부 멸종위기 야생생물 목록')
    if i == 100: src += ['해양수산부 해양보호생물', 'IUCN 적색목록']
    species[i] = {'sci': sci, 'group': grp, 'look': look, 'home': home, 'dokdo': dokdo, 'protect': prot,
                  'nibr': i in NIBR_LISTED, 'check': NIBR_NOT_FOUND.get(i, ''), 'src': src}
places = {k: {'where': w, 'origin': o} for k, (w, o) in P.items()}

js = ('// ─────────────────────────────────────────────────────────────────────────────\n'
      '// 독도 지식 사전 (v0.95) — scripts/kb/build_kb.py 로 만들어요(손으로 고치지 말고 scripts/kb/*.py 를 고쳐요).\n'
      '// SPECIES: 우산몬 모티브 생물의 실제 정보 · WRONG: 문제마다 오답이 왜 틀렸는지 · PLACES: 독도 지명의 뜻\n'
      '// 공공기관 자료에서 사실만 가져와 직접 쓴 문장이에요. 출처는 기관과 자료 이름만 글로 밝혀요(바깥 링크 없음).\n'
      '// ─────────────────────────────────────────────────────────────────────────────\n'
      f'export const KB_NOTE = {json.dumps(NOTE, ensure_ascii=False)};\n'
      f'export const KB_SOURCES = {json.dumps(KB_SOURCES, ensure_ascii=False)};\n'
      f'export const SPECIES = {json.dumps(species, ensure_ascii=False)};\n'
      f'export const WRONG = {json.dumps(wrong, ensure_ascii=False)};\n'
      f'export const PLACES = {json.dumps(places, ensure_ascii=False)};\n'
      'export const wrongNote = (q, choice) => (choice == null || choice === q.answer) ? \'\' : (WRONG[q.id]?.[choice] || \'\');\n')
assert 'http' not in js
open(os.path.join(DIST, 'knowledge.js'), 'w').write(js)

# data.js: 목록집에 실린 종은 기록 확인 상태를 올려요
WEAK = {'개별 근거 미확인', '개별 근거 추가 확인', '종명 대조 필요', '추가 자료에 언급', '독도 기록 재확인'}
dp = os.path.join(DIST, 'data.js'); d = open(dp).read(); n = 0
def fix(m):
    global n
    i = int(m.group(1)); body = m.group(0)
    st = re.search(r'"recordStatus": "([^"]*)"', body).group(1)
    if i in NIBR_LISTED and st in WEAK:
        n += 1
        body = body.replace(f'"recordStatus": "{st}"', '"recordStatus": "국가 생물종 목록에 독도 기록"')
        body = re.sub(r'"recordNote": "[^"]*"', '"recordNote": "국립생물자원관 「독도 생물종 목록집」(2015)에 실려 있어요"', body)
    return body
d = re.sub(r'"id": (\d+),.*?"detail"', fix, d, flags=re.S)
open(dp, 'w').write(d)
print('knowledge.js', len(js), 'bytes; upgraded', n)
