// 더블클릭으로 여는 한 파일짜리 게임 만들기
//   node scripts/build-offline.mjs   →   dokdo-explorers-offline.html
//
// 브라우저는 보안 때문에 컴퓨터에 있는 HTML 파일(file://)에서 JavaScript 모듈과 그림 파일을 불러오지 못하게 막습니다.
// 그래서 dist/index.html을 더블클릭하면 게임이 열리지 않습니다. 이 스크립트는 dist/의 코드 27개 파일과
// 게임에 쓰는 그림을 한 HTML 파일 안에 모두 넣어, 인터넷이나 서버 없이 더블클릭만으로 열리게 만듭니다.
// 그림이나 코드를 고친 뒤에는 이 스크립트를 다시 실행하세요.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const OUT = path.join(root, 'dokdo-explorers-offline.html');

// ── 1. bundle the ES modules into one classic script ──
const order = [], seen = new Set(), visiting = new Set(), exported = {}, wanted = [];
function visit(file) {
  if (seen.has(file)) return;
  if (visiting.has(file)) throw new Error(`circular import: ${file}`);
  visiting.add(file);
  const src = fs.readFileSync(path.join(dist, file), 'utf8');
  for (const m of src.matchAll(/^import\s*\{[^}]*\}\s*from\s*'\.\/([^']+)';?/gm)) visit(m[1]);
  visiting.delete(file); seen.add(file); order.push(file);
}
visit('game.js');

function wrap(file) {
  let src = fs.readFileSync(path.join(dist, file), 'utf8'); const names = [];
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*'\.\/([^']+)';?/gm, (_, list, from) => (list.split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach(n => wanted.push([file, from, n])), 0) ||
    `const {${list.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/\s+as\s+/, ': ')).join(', ')}} = __mods[${JSON.stringify(from)}];`);
  src = src.replace(/^export\s+(async\s+function\s*\*?|function\s*\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)(.*)$/gm, (_, kind, name, rest) => {
    names.push(name);
    // export const A = 1, B = 2;  →  every name on a one-line declaration
    if (/^(const|let|var)$/.test(kind) && rest.trim().endsWith(';')) {
      let depth = 0, quote = null, part = '';
      for (const ch of rest) {
        if (quote) { if (ch === quote) quote = null; part += ch; continue; }
        if ('"\'`'.includes(ch)) quote = ch; else if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
        if (ch === ',' && depth === 0) { part = ''; continue; }
        part += ch; const m = part.match(/^\s*([A-Za-z_$][\w$]*)\s*=$/); if (m && depth === 0) names.push(m[1]);
      }
    }
    return `${kind} ${name}${rest}`;
  });
  exported[file] = names;
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`unsupported import/export form in ${file}`);
  return `// ── ${file} ──\n__mods[${JSON.stringify(file)}] = (() => {\n${src}\nreturn { ${names.join(', ')} };\n})();\n`;
}
const bundle = `const __mods = {};\n${order.map(wrap).join('\n')}`;
for (const [file, from, n] of wanted) if (!exported[from]?.includes(n)) throw new Error(`${file} imports ${n} from ${from}, which the bundle does not export`);

// ── 2. embed the pictures the game asks for (assets.js reads DOKDOMON_EMBEDDED_ASSETS first) ──
const assets = {}; let bytes = 0;
function add(key) {
  const file = path.join(dist, 'assets', /\.(png|jpe?g|webp)$/i.test(key) ? key : key + '.png');
  if (!fs.existsSync(file) || assets[key]) return;
  const buf = fs.readFileSync(file), type = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';
  assets[key] = `data:${type};base64,${buf.toString('base64')}`; bytes += buf.length;
}
const code = order.map(f => fs.readFileSync(path.join(dist, f), 'utf8')).join('\n');
for (const m of code.matchAll(/["'`]((?:characters|scenery|npc|player|monsters)\/[A-Za-z0-9_./-]+?)(?:\.png)?["'`]/g)) add(m[1]);
for (const m of code.matchAll(/"key"\s*:\s*"([^"]+)"/g)) add(m[1]);                       // atlas sheets
for (let id = 1; id <= 100; id++) { const n = String(id).padStart(3, '0'); add(`monsters/${n}`); add(`monsters/${n}-2`); add(`photos/${n}.jpg`); } // 변환폼 · 도감 실제 사진
for (const r of ['grunt', 'exec', 'boss']) add(`characters/baekmudan-${r}-portrait`);
for (const sub of ['npc', 'player']) {
  const walk = d => fs.readdirSync(path.join(dist, 'assets', d), { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(`${d}/${e.name}`) : /\.png$/.test(e.name) && add(`${d}/${e.name.replace(/\.png$/, '')}`));
  if (fs.existsSync(path.join(dist, 'assets', sub))) walk(sub);
}

// ── 3. one HTML file ──
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dist, 'style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`);
const script = `<script>\nwindow.DOKDOMON_EMBEDDED_ASSETS = ${JSON.stringify(assets)};\n${bundle.replace(/<\/script/gi, '<\\/script')}\n</script>`;
html = html.replace(/<script type="module" src="game\.js"><\/script>/, () => script);
if (html.includes('src="game.js"')) throw new Error('could not inline game.js');
fs.writeFileSync(OUT, html);
console.log(`dokdo-explorers-offline.html: ${order.length} code files, ${Object.keys(assets).length} pictures (${(bytes / 1048576).toFixed(1)} MB), ${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB in total`);
