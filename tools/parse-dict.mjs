// 解析 kaikki (Wiktionary) 蒙古语词条 → 精简词典
import fs from 'node:fs';
import readline from 'node:readline';

const IN = 'D:/DeepSeek Harness/Work/Latin Mongol/data/mn.jsonl';
const OUT = 'D:/DeepSeek Harness/Work/Latin Mongol/data/dict.json';

const rl = readline.createInterface({ input: fs.createReadStream(IN, 'utf8'), crlfDelay: Infinity });

const byWord = new Map();
let n = 0, kept = 0;

for await (const line of rl) {
  if (!line.trim()) continue;
  n++;
  let o;
  try { o = JSON.parse(line); } catch { continue; }
  if (o.lang_code !== 'mn') continue;
  const word = (o.word || '').trim();
  if (!word) continue;
  if (!/^[\u0400-\u04FF\u0301\s-]+$/.test(word)) continue; // 只要西里尔
  const pos = o.pos || '';
  if (!['noun', 'verb', 'adj', 'adv', 'num', 'pron', 'conj', 'postp', 'particle', 'interj', 'name', 'phrase', 'prep', 'det'].includes(pos)) continue;

  const glosses = [];
  for (const s of (o.senses || [])) {
    if (s.form_of || s.alt_of) continue;
    for (const g of (s.glosses || [])) {
      if (g && !g.startsWith('Synonym') && !glosses.includes(g)) glosses.push(g);
    }
  }
  if (!glosses.length) continue;

  const rom = (o.forms || []).find(f => (f.tags || []).includes('romanization'))?.form || '';
  const ipa = (o.sounds || []).find(s => s.ipa)?.ipa || '';

  const key = word + '|' + pos;
  if (byWord.has(key)) {
    const e = byWord.get(key);
    for (const g of glosses) if (!e.g.includes(g)) e.g.push(g);
    continue;
  }
  byWord.set(key, { w: word, p: pos, g: glosses.slice(0, 4), r: rom, i: ipa });
  kept++;
}

const out = [...byWord.values()];
fs.writeFileSync(OUT, JSON.stringify(out), 'utf8');
console.log(`lines=${n} kept=${kept} words=${new Set(out.map(x => x.w)).size}`);

// 抽样看看质量
const sample = out.filter(x => x.g.length && x.g[0].split(' ').length <= 2).slice(0, 15);
for (const s of sample) console.log(`${s.w.padEnd(14)} ${s.p.padEnd(6)} ${s.g[0].padEnd(22)} rom=${s.r}`);
