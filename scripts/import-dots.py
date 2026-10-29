"""우산몬 도트 그림 가져오기 (v0.41)

    python scripts/import-dots.py                  # dist/assets/monsters-original/ 의 원본으로 모두 다시 만들기
    python scripts/import-dots.py <그림 폴더>        # 새로 찍은 그림 넣기 (Pillow 필요)

그림 파일 이름: 'NNN.png' (예: 024.png). 전설의 우산몬은 'NNN-1.png'(노멀폼), 'NNN-2.png'(변환폼).
원본은 배경이 투명하고 한 도트가 10×10 픽셀이어야 해요.

  1. 도트마다 가운데 색을 읽어 원래 도트 크기로 줄여요(번짐 없음).
  2. 정수배로만 키워 512×512 칸에 넣어요. 가로 400·세로 470 안에서 가장 크게, 발끝은 아래에서 12칸 위(500).
  3. dist/assets/monsters/NNN.png (노멀폼) · NNN-2.png (변환폼)으로 저장해요.
     새 폴더에서 가져오면 원본을 dist/assets/monsters-original/ 에도 복사해 둬요.

그림이 바라보는 쪽(오른쪽·정면·왼쪽)은 dist/sprites.js 의 FACES_RIGHT · FACES_FRONT 에 맞춰 주세요.
"""
import os, re, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'dist', 'assets', 'monsters-original')
OUT = os.path.join(ROOT, 'dist', 'assets', 'monsters')
DOT = 10


def native(im):
    """Read the centre of every 10×10 dot → the picture at its own dot size (cropped to the drawing)."""
    im = im.convert('RGBA'); w, h = im.size[0] // DOT, im.size[1] // DOT
    small = Image.new('RGBA', (w, h)); sp, ip = small.load(), im.load()
    for y in range(h):
        for x in range(w):
            p = ip[x * DOT + DOT // 2, y * DOT + DOT // 2]
            sp[x, y] = p[:3] + (255,) if p[3] >= 128 else (0, 0, 0, 0)
    return small.crop(small.getchannel('A').getbbox())


def place(small):
    w, h = small.size; s = max(1, min(400 // w, 470 // h, 20))
    big = small.resize((w * s, h * s), Image.NEAREST)
    out = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); out.alpha_composite(big, ((512 - big.width) // 2, 500 - big.height))
    return out


def main(folder=SRC):
    os.makedirs(OUT, exist_ok=True); done = []
    for f in sorted(os.listdir(folder)):
        m = re.fullmatch(r'(\d{3})(?:-([12]))?\.png', f)
        if not m: continue
        num, form = m.group(1), m.group(2)
        key = num + ('-2' if form == '2' else '')
        place(native(Image.open(os.path.join(folder, f)))).save(os.path.join(OUT, key + '.png'))
        if os.path.abspath(folder) != os.path.abspath(SRC):
            os.makedirs(SRC, exist_ok=True); shutil.copy(os.path.join(folder, f), os.path.join(SRC, f))
        done.append(key)
    print(f'{len(done)}개 그림을 만들었어요:', ' '.join(done))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else SRC)
