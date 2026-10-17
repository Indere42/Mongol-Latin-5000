// 用词典自带例句统计回鹘蒙文词频，作为"常用度"排序依据
import fs from 'node:fs';

const ROOT = 'D:/DeepSeek Harness/Work/Latin Mongol';
const data = JSON.parse(fs.readFileSync(`${ROOT}/data/src/mn-zh.json`, 'utf8'));

// 1. 把所有例句拼起来，切词统计
let corpus = '';
for (const e of data) corpus += ' ' + (e.d || '') + ' ' + (e.dx || '') + ' ' + (e.df || '');
const PUNCT = /[\s᠂᠃᠉᠁.。,，;；:：!！?？()（）〔〕〈〉《》「」『』\[\]{}"“”'‘’、…—－·0-9a-zA-Z]/;
const tokens = corpus.split(PUNCT).filter(t => t.length > 1 && /[\u1800-\u18AF]/.test(t));
const freq = new Map();
for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);

console.log('corpus chars=', corpus.length, 'tokens=', tokens.length, 'unique=', freq.size);

const byM = new Map();
for (const e of data) {
  if (!e.m) continue;
  const f = freq.get(e.m) || 0;
  byM.set(e.c, Math.max(byM.get(e.c) || 0, f));
}

const top = [...byM.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
console.log('--- top by example frequency ---');
for (const [c, f] of top) {
  const e = data.find(x => x.c === c);
  console.log(String(f).padStart(4), c.padEnd(14), (e.d || '').slice(0, 40));
}

fs.writeFileSync(`${ROOT}/data/src/freq.json`, JSON.stringify(Object.fromEntries(byM)), 'utf8');
