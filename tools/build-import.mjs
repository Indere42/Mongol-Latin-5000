// 用例句词频排序，挑选常用词导入
import fs from 'node:fs';

const ROOT = 'D:/DeepSeek Harness/Work/Latin Mongol';
const data = JSON.parse(fs.readFileSync(`${ROOT}/data/src/mn-zh.json`, 'utf8'));
const freq = JSON.parse(fs.readFileSync(`${ROOT}/data/src/freq.json`, 'utf8'));
const existing = new Set(JSON.parse(fs.readFileSync(`${ROOT}/data/words.ids.json`, 'utf8')));

const POS_MAP = {
  '名': 'n', '及': 'v', '不及': 'v', '形': 'adj', '副': 'adv', '代': 'pron',
  '数': 'num', '量': 'n', '感': 'interj', '语': 'part', '连': 'conj',
  '后': 'postp', '助': 'part', '时位': 'postp',
};

function pickPos(d) {
  const m = d.match(/^〔([^〕]+)〕/);
  if (!m) return '';
  const raw = m[1];
  if (raw.startsWith('名、形') || raw.startsWith('形、名')) return 'n';
  if (raw.startsWith('不及') || raw.startsWith('及')) return 'v';
  for (const k of ['名', '形', '副', '代', '数', '量', '感', '连', '后', '时位', '语', '助']) {
    if (raw.startsWith(k)) return POS_MAP[k];
  }
  return '';
}

function firstSense(d) {
  let s = d.replace(/^〔[^〕]+〕/, '').replace(/^〈[^〉]+〉/, '').trim();
  const parts = s.split(/[①②③④⑤⑥⑦⑧⑨⑩]/).filter(Boolean);
  let x = parts[0] || s;
  x = x.split('：')[0].split(':')[0];
  x = x.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').replace(/〈[^〉]*〉/g, '').replace(/〔[^〕]*〕/g, '');
  const alts = x.split(/[，,、]/).map(t => t.trim()).filter(t => t && t.length <= 8 && !/[\u1800-\u18AF＝=]/.test(t));
  x = alts.slice(0, 2).join('；') || '';
  return x.replace(/[。；;，,]$/, '').trim().slice(0, 12);
}

const THEME_KW = [
  ['animal', /马|牛|羊|骆驼|狗|猫|鸟|鱼|狼|狐|鹿|熊|鼠|蛇|兔|虎|狮|象|猴|猪|鸡|鸭|鹅|鹰|虫|蚂蚁|蜜蜂|蝴蝶|野兽|牲畜|蹄|角|羽毛|鳞/],
  ['food', /吃|喝|食|饭|茶|奶|肉|面包|盐|糖|油|蛋|蔬菜|果|米|面|汤|酒|味|餐|饮|粮|烟/],
  ['body', /头|眼|耳|鼻|嘴|牙齿|舌|手|脚|腿|臂|指|血|骨|心|肺|肝|胃|肾|皮肤|头发|颈|肩|背|胸|肚子|病|药|痛|医治/],
  ['nature', /天空|太阳|月亮|星|云|雨|雪|风|雷|山|河|湖|海|草|树|花|叶|石|沙|土壤|冰|雾|火|光|空气|森林|草原|岛|泉|天/],
  ['time', /年|月|日|时|春|夏|秋|冬|早|晚|今天|明天|昨天|期|节日|刻|秒|分钟|周|季节|代/],
  ['home', /家|屋|门|窗|桌|椅|床|灯|锅|碗|刀|衣服|裤|鞋|帽|被|枕头|柜|房间|厨房|厕所|墙|楼梯|院/],
  ['city', /城|街|道路|桥|车|站|店|市场|银行|学校|医院|图书馆|厂|局|楼|广场|票|钱|价格|工作|职业/],
  ['people', /父亲|母亲|哥哥|姐姐|弟弟|妹妹|儿子|女儿|亲戚|朋友|老师|学生|医生|士兵|国王|客人|主人|邻居|人/],
];

function pickTheme(zh, pos) {
  if (pos === 'v') return 'verb';
  if (pos === 'adj') return 'adj';
  if (pos === 'adv') return 'adv';
  if (pos === 'num') return 'num';
  if (pos === 'pron') return 'pron';
  for (const [t, re] of THEME_KW) if (re.test(zh)) return t;
  return 'misc';
}

const BLACK = new Set(['таван','арван','найман','гурван','дөрвөн','тай','ман','хэдэн','хэд','нег','хоёр','гурав','дөрөв','тав','зургаа','долоо','найм','ес','арав']);
const seen = new Set();
const out = [];
for (const e of data) {
  const c = (e.c || '').trim();
  if (!c || seen.has(c) || existing.has(c)) continue;
  if (!/^[\u0400-\u04FF-]+$/.test(c)) continue;
  if (c.length < 3) continue;
  seen.add(c);

  const d = e.d || '';
  const pos = pickPos(d);
  if (!pos) continue;
  const zh = firstSense(d);
  if (!zh) continue;
  if (/[＝=]|参见|同上|见[：:]|同[：:]|[\u1800-\u18AF]/.test(d.slice(0, 80))) continue;
  if (/^.{1,2}日；|日；.{1,4}号$|号$/.test(zh)) continue;
  if (BLACK.has(c)) continue;

  out.push({ cyr: c, trad: e.m || '', zh, pos, theme: pickTheme(zh, pos), f: freq[c] || 0 });
}

out.sort((a, b) => b.f - a.f || a.cyr.length - b.cyr.length);

console.log(`candidates=${out.length}  freq>=1: ${out.filter(w => w.f >= 1).length}  freq>=2: ${out.filter(w => w.f >= 2).length}`);
console.log('--- top 30 ---');
for (const w of out.slice(0, 30)) console.log(String(w.f).padStart(4), w.cyr.padEnd(14), w.pos.padEnd(5), w.zh, '|', w.theme);
console.log('--- around rank 3000 ---');
for (const w of out.slice(2990, 3010)) console.log(String(w.f).padStart(4), w.cyr.padEnd(14), w.pos.padEnd(5), w.zh, '|', w.theme);

fs.writeFileSync(`${ROOT}/data/src/import-words.json`, JSON.stringify(out), 'utf8');
