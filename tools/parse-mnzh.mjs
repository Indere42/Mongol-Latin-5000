// 解析 mn-zh.html 里内嵌的蒙汉词典数据
import fs from 'node:fs';

const SRC = 'D:/DeepSeek Harness/Work/Latin Mongol/data/src/mn-zh.html';
const html = fs.readFileSync(SRC, 'utf8');

const start = html.indexOf('const DATA = ');
if (start < 0) throw new Error('DATA not found');
const arrStart = html.indexOf('[', start);

// 括号扫描，跳过字符串
let depth = 0, inStr = false, esc = false, end = -1;
for (let i = arrStart; i < html.length; i++) {
  const ch = html[i];
  if (inStr) {
    if (esc) esc = false;
    else if (ch === '\\') esc = true;
    else if (ch === '"') inStr = false;
    continue;
  }
  if (ch === '"') { inStr = true; continue; }
  if (ch === '[') depth++;
  else if (ch === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
}

const json = html.slice(arrStart, end);
const data = JSON.parse(json);

fs.writeFileSync('D:/DeepSeek Harness/Work/Latin Mongol/data/src/mn-zh.json', JSON.stringify(data), 'utf8');

const keys = Object.keys(data[0]);
console.log('entries=', data.length, 'keys=', keys.join(','));
console.log('bytes=', (json.length / 1024 / 1024).toFixed(2), 'MB');

const single = data.filter(d => d.c && !d.c.includes(' ') && /^[\u0400-\u04FF-]+$/.test(d.c));
const uniq = new Map();
for (const d of single) if (!uniq.has(d.c)) uniq.set(d.c, d);
console.log('single-word entries=', single.length, 'unique=', uniq.size);

console.log('\n--- samples ---');
for (const d of data.slice(0, 3)) console.log(JSON.stringify(d).slice(0, 260));
for (const w of ['морь', 'ус', 'багш', 'хүн', 'сургууль', 'айл', 'цагаан']) {
  const d = uniq.get(w);
  console.log(w, '->', d ? JSON.stringify({ m: d.m, t: d.t, d: d.d.slice(0, 60) }) : 'NOT FOUND');
}
