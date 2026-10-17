// 合并 khudam 词典 + Wiktionary → 构建可查询的索引
import fs from 'node:fs';

const ROOT = 'D:/DeepSeek Harness/Work/Latin Mongol/data';
const LEX = JSON.parse(fs.readFileSync(`${ROOT}/khudam-lex.json`, 'utf8'));
const WIK = JSON.parse(fs.readFileSync(`${ROOT}/dict.json`, 'utf8'));

/** 统一结构： cyr -> { cyr, trad, latin, en:Set, src } */
const pool = new Map();

function add(cyr, { trad = '', latin = '', senses = [], src = '' }) {
  if (!cyr) return;
  let e = pool.get(cyr);
  if (!e) {
    e = { cyr, trad, latin, en: [], src };
    pool.set(cyr, e);
  }
  if (!e.trad && trad) e.trad = trad;
  if (!e.latin && latin) e.latin = latin;
  for (const s of senses) {
    for (const t of String(s).split(/[,;]/)) {
      const w = t.trim().toLowerCase().replace(/^to\s+/, '').replace(/^a\s+|^an\s+|^the\s+/, '');
      if (w && w.length < 30 && !e.en.includes(w)) e.en.push(w);
    }
  }
}

for (const [cyr, arr] of Object.entries(LEX)) {
  for (const [trad, latin, sense] of arr) {
    add(cyr, { trad, latin, senses: sense ? [sense] : [], src: 'khudam' });
  }
}
for (const w of WIK) {
  add(w.w, { latin: w.r, senses: w.g, src: 'wikt' });
}

// en -> cyr 倒排
const enIndex = new Map();
for (const e of pool.values()) {
  for (const t of e.en) {
    if (!enIndex.has(t)) enIndex.set(t, []);
    enIndex.get(t).push(e.cyr);
  }
}

const out = [...pool.values()];
fs.writeFileSync(`${ROOT}/pool.json`, JSON.stringify(out), 'utf8');
const idx = {};
for (const [k, v] of enIndex) idx[k] = v.slice(0, 8);
fs.writeFileSync(`${ROOT}/en-index.json`, JSON.stringify(idx), 'utf8');

console.log(`pool=${out.length} withTrad=${out.filter(x => x.trad).length} withEn=${out.filter(x => x.en.length).length}`);
console.log(`en terms=${enIndex.size}`);
for (const q of ['water', 'horse', 'book', 'river', 'teacher', 'blue', 'eat', 'three', 'sky', 'sheep']) {
  const c = enIndex.get(q) || [];
  console.log(q.padEnd(8), c.slice(0, 5).join(', '));
}
