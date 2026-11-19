// HD-2D 땅 재질·나무 그림 자리 (scripts/make-hd2d-nature.py가 만들어요)
// 땅: 4×4칸(칸마다 128, 이음매 없음) · 재질 번호 1부터. 나무: 발 자리는 그림 아랫변 가운데.
export const HD2D_GROUND = {"key": "scenery/hd2d-ground", "noise": "scenery/hd2d-noise", "cols": 4, "rows": 4, "size": 128, "slots": {"grass": 1, "tall": 2, "dirt": 3, "cobble": 4, "concrete": 5, "sand": 6, "pebbles": 7, "gravel": 8, "steps": 9, "deck": 10}};
export const HD2D_TREES = {"key": "scenery/hd2d-trees", "width": 798, "height": 100, "frames": {"broad_0": [0, 4, 88, 96], "broad_1": [90, 4, 88, 96], "broad_2": [180, 4, 88, 96], "pine_0": [270, 0, 92, 100], "pine_1": [364, 0, 92, 100], "pine_2": [458, 0, 92, 100], "camellia_0": [552, 8, 80, 92], "camellia_1": [634, 8, 80, 92], "camellia_2": [716, 8, 80, 92]}};
