// 用词典池校验词表，自动生成拉丁转写 / 音节 / 元音和谐 / 回鹘蒙文
import fs from 'node:fs';
import { SRC } from './words.src.js';
import { EXTRA } from './words.extra.js';
import { EXTRA2 } from './words.extra2.js';
import { EXTRA3 } from './words.extra3.js';
import { EXTRA4 } from './words.extra4.js';
import crypto from 'node:crypto';
import { convertText } from './khudam/package/dist/index.js';

const ROOT = 'D:/DeepSeek Harness/Work/Latin Mongol';
const POOL = JSON.parse(fs.readFileSync(`${ROOT}/data/pool.json`, 'utf8'));
const byCyr = new Map(POOL.map(p => [p.cyr, p]));

const VOW = { а: 'a', о: 'o', у: 'u', ы: 'y', э: 'e', ө: 'ö', ү: 'ü', и: 'i' };
const CONS = {
  б: 'b', в: 'v', г: 'g', д: 'd', ж: 'j', з: 'z', й: 'i', к: 'k', л: 'l', м: 'm',
  н: 'n', п: 'p', р: 'r', с: 's', т: 't', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ь: "'",
};
const SOFT = { е: 'ye', ё: 'yo', ю: 'yu', я: 'ya' };

function romanize(cyr) {
  let out = '';
  for (let i = 0; i < cyr.length; i++) {
    const c = cyr[i];
    if (c === ' ') { out += ' '; continue; }
    if (VOW[c]) { out += VOW[c]; continue; }
    if (SOFT[c]) { out += SOFT[c]; continue; }
    // 软音符号：在辅音前插入 i（амьтан → amitan），在词尾保留 '（морь → mor'）
    if (c === 'ь') {
      const nx = cyr[i + 1];
      out += (nx && !isV(nx) && nx !== ' ') ? 'i' : "'";
      continue;
    }
    if (CONS[c] !== undefined) { out += CONS[c]; continue; }
    out += c;
  }
  return out;
}

const isV = c => 'аоуыэөүи'.includes(c);

function syllables(cyr) {
  const breaks = [];
  let lastVowel = -1;
  for (let i = 0; i < cyr.length; i++) {
    const c = cyr[i];
    // я/е/ё/ю 前面是元音时，视作新音节的开头（ба·яр）
    if (SOFT[c] && i > 0 && isV(cyr[i - 1])) { breaks.push(i); lastVowel = i; continue; }
    if (!isV(c)) continue;
    if (lastVowel >= 0 && i > lastVowel + 1 && !isV(cyr[i - 1])) breaks.push(i - 1);
    lastVowel = i;
  }
  if (!breaks.length) return [cyr];
  const parts = [];
  let s = 0;
  for (const b of breaks) { parts.push(cyr.slice(s, b)); s = b; }
  parts.push(cyr.slice(s));
  return parts.filter(Boolean);
}

function sylLatin(cyr) {
  const parts = syllables(cyr);
  return parts.map((p, i) => {
    if (p.endsWith('ь') && i < parts.length - 1) return romanize(p.slice(0, -1)) + 'i';
    return romanize(p);
  }).join('·');
}

function harmony(cyr) {
  for (const c of cyr) {
    if ('аоуы'.includes(c)) return 'A';
    if ('эөү'.includes(c)) return 'B';
  }
  return 'B';
}

function tradFallback(cyr) {
  if (cyr.includes(' ')) {
    const parts = cyr.split(' ').map(w => {
      const r = convertText(w, { mode: 'word' });
      return r?.[0]?.candidates?.[0]?.traditional || '';
    });
    return parts.every(Boolean) ? parts.join(' ') : '';
  }
  const r = convertText(cyr, { mode: 'word' });
  return r?.[0]?.candidates?.[0]?.traditional || '';
}

function cleanTrad(t) {
  return String(t || '').replace(/\s*\([^)]*\)\s*$/g, '').replace(/[᠂᠃᠉]\s*$/g, '').trim();
}

const POS = { n: '名词', v: '动词', adj: '形容词', adv: '副词', num: '数词', pron: '代词', interj: '感叹词', postp: '后置词', conj: '连词', part: '语气词' };

// 合并同形词条
const merged = new Map();
const ALL = [...SRC, ...EXTRA, ...EXTRA2, ...EXTRA3, ...EXTRA4];
for (const [zh, en, cyr, pos, theme] of ALL) {
  const k = cyr;
  if (merged.has(k)) {
    const m = merged.get(k);
    if (!m.zh.includes(zh)) m.zh += '；' + zh;
    if (!m.en.includes(en)) m.en += '; ' + en;
    continue;
  }
  merged.set(k, { zh, en, cyr, pos, theme });
}

// 蒙汉词典导入（按例句词频排序），用于补到 5000 并校正回鹘蒙文
const dictPath = `${ROOT}/data/src/import-words.json`;
const dictWords = fs.existsSync(dictPath) ? JSON.parse(fs.readFileSync(dictPath, 'utf8')) : [];
const dictByCyr = new Map();
for (const w of dictWords) if (!dictByCyr.has(w.cyr)) dictByCyr.set(w.cyr, w);

const out = [];
const noTrad = [];
const notInDict = [];
for (const m of merged.values()) {
  const d = dictByCyr.get(m.cyr);
  const hit = byCyr.get(m.cyr);
  let trad = cleanTrad(d?.trad || hit?.trad || '');
  let tradAuto = false;
  if (!trad) {
    trad = tradFallback(m.cyr);
    tradAuto = !!trad;
  }
  if (!trad) noTrad.push(m.cyr);
  if (!hit && !d) notInDict.push(m.cyr);
  out.push({
    id: m.cyr,
    au: crypto.createHash('sha1').update(m.cyr).digest('hex').slice(0, 12),
    zh: m.zh,
    en: m.en,
    cyr: m.cyr,
    trad,
    tradAuto,
    latin: romanize(m.cyr),
    syl: sylLatin(m.cyr),
    pos: POS[m.pos] || m.pos,
    h: harmony(m.cyr),
    theme: m.theme,
    tier: 1,
  });
}

// 从词典补词：先按词频/义项数排序，取到总数 5000
const TARGET = 5000;
const have = new Set(out.map(w => w.id));
const ranked = dictWords
  .filter(w => w.zh && !have.has(w.cyr))
  .map((w, i) => ({ ...w, rank: i }))
  .sort((a, b) => b.f - a.f || a.cyr.length - b.cyr.length);

let added = 0;
for (const w of ranked) {
  if (out.length >= TARGET) break;
  if (have.has(w.cyr)) continue;
  have.add(w.cyr);
  out.push({
    id: w.cyr,
    au: crypto.createHash('sha1').update(w.cyr).digest('hex').slice(0, 12),
    zh: w.zh,
    en: '',
    cyr: w.cyr,
    trad: cleanTrad(w.trad) || tradFallback(w.cyr),
    tradAuto: !w.trad,
    latin: romanize(w.cyr),
    syl: sylLatin(w.cyr),
    pos: POS[w.pos] || w.pos,
    h: harmony(w.cyr),
    theme: w.theme,
    tier: w.f >= 1 ? 1 : 2,
  });
  added++;
}

// 输出为可直接 <script> 引入的模块
const js = `window.WORDS=${JSON.stringify(out)};\nwindow.THEMES=${JSON.stringify({
  people: '人 · 家庭', body: '身体', food: '食物', animal: '动物', nature: '自然',
  time: '时间', home: '居家', city: '城市', verb: '动词', adj: '形容词',
  num: '数词', pron: '代词', adv: '副词 · 其他', misc: '其他',
})};`;
fs.mkdirSync(`${ROOT}/data`, { recursive: true });
fs.writeFileSync(`${ROOT}/data/words.js`, js, 'utf8');

console.log(`total=${out.length} (src ${SRC.length}, merged ${SRC.length - out.length})`);
console.log(`no-trad=${noTrad.length}: ${noTrad.join(', ')}`);
console.log(`not-in-dict=${notInDict.length}`);
console.log(`tradAuto=${out.filter(w => w.tradAuto).length}`);
const byTheme = {};
for (const w of out) byTheme[w.theme] = (byTheme[w.theme] || 0) + 1;
console.log(byTheme);
