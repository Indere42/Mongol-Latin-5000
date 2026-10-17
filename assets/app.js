/* Mongol · 拉丁蒙古文千词库 */
(function () {
  'use strict';

  const WORDS = window.WORDS || [];
  const THEMES = window.THEMES || {};
  const RULES = window.RULES || [];
  const app = document.getElementById('app');
  const DAY = 86400000;

  /* ---------- 存储 ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  let srs = store.get('lm.srs', {});          // id -> {e,i,n,due}
  let settings = Object.assign({ goal: 20, auto: true, scope: 'core' }, store.get('lm.settings', {}));
  let today = store.get('lm.today', { date: '', n: 0 });
  let streak = store.get('lm.streak', { last: '', n: 0 });
  const todayStr = () => new Date().toISOString().slice(0, 10);
  if (today.date !== todayStr()) today = { date: todayStr(), n: 0 };

  const saveSrs = () => store.set('lm.srs', srs);
  const saveToday = () => store.set('lm.today', today);
  const saveSettings = () => store.set('lm.settings', settings);

  function touchStreak() {
    const d = todayStr();
    if (streak.last === d) return;
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streak = { last: d, n: streak.last === y ? streak.n + 1 : 1 };
    store.set('lm.streak', streak);
  }

  const learnedCount = () => Object.keys(srs).length;
  const inScope = w => settings.scope === 'all' || w.tier === 1;
  const dueList = () => WORDS.filter(w => inScope(w) && srs[w.id] && srs[w.id].due <= Date.now());
  const newList = () => WORDS.filter(w => inScope(w) && !srs[w.id]);

  /* ---------- 状态 ---------- */
  const state = {
    view: 'home',
    idx: 0,
    queue: [],
    card: null,
    quiz: null,
    quizResult: null,
    sheet: null,
    filter: '',
    theme: null,
    ruleId: null,
  };

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  }
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800);
  }
  const sylOf = w => (w.syl === w.latin ? '' : w.syl);

  let voiceTried = false, mnVoice = null;
  function pickVoice() {
    if (voiceTried) return mnVoice;
    voiceTried = true;
    try { mnVoice = (speechSynthesis.getVoices() || []).find(v => /^mn/i.test(v.lang)) || null; } catch (e) { mnVoice = null; }
    return mnVoice;
  }
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voiceTried = false; pickVoice(); };

  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('当前浏览器不支持语音'); return; }
    const v = pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'mn-MN'; if (v) u.voice = v; u.rate = 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    if (!v) toast('本机没有蒙古语语音');
  }

  /* ---------- 间隔重复（SM-2） ---------- */
  function grade(id, g) {
    const c = srs[id] || { e: 2.5, i: 0, n: 0 };
    if (g < 3) {
      c.n = 0; c.i = 1;
      c.due = Date.now() + 10 * 60000;         // 10 分钟后重来
    } else {
      c.n += 1;
      c.i = c.n === 1 ? 1 : c.n === 2 ? 6 : Math.round(Math.max(c.i, 1) * c.e);
      c.e = Math.max(1.3, c.e + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)));
      c.due = Date.now() + Math.max(1, c.i) * DAY;
    }
    srs[id] = c;
    today.n += 1;
    touchStreak();
    saveSrs(); saveToday();
  }

  /* ---------- 渲染 ---------- */
  function header() {
    if (state.view === 'home') {
      return `<header class="h-home"><div class="brand">Mongol<small>蒙古语千词</small></div>
        <div class="hright"><span class="right">🔥 ${streak.n}</span>
        <button class="ico" id="go-settings" title="设置">⚙</button></div></header>`;
    }
    const t = {
      learn: '学习', review: '复习', quiz: '测一测', themes: '词库',
      list: state.theme ? (THEMES[state.theme] || state.theme) : '词库',
      done: '结果', rules: '规则', rule: '规则', settings: '设置',
    }[state.view] || '';
    const r = state.view === 'learn' ? `<span class="right">${state.idx + 1} / ${state.queue.length}</span>`
      : state.view === 'review' ? `<span class="right">剩 ${state.queue.length}</span>` : '';
    return `<header><button class="back" id="back">← ${t}</button>${r}</header>`;
  }

  /* ---------- 桌面侧栏 ---------- */
  function renderSide() {
    const el = document.getElementById('side');
    if (!el) return;
    const due = dueList().length;
    const n = learnedCount();
    const cur = state.view === 'rule' ? 'rules'
      : state.view === 'list' ? 'themes'
      : state.view === 'done' ? 'quiz' : state.view;
    const items = [
      ['home', '首页', ''],
      ['learn', '学习', ''],
      ['review', '复习', due ? String(due) : ''],
      ['quiz', '测一测', ''],
      ['rules', '规则', RULES.length],
      ['themes', '词库', WORDS.length],
      ['settings', '设置', ''],
    ];
    el.innerHTML = `
      <div class="s-brand">Mongol<small>拉丁蒙古文 · 蒙古语</small></div>
      <div class="s-nav">${items.map(([k, label, badge]) => `
        <button class="s-item ${cur === k ? 'on' : ''}" data-nav="${k}">
          <span>${label}</span>${badge ? `<span class="b">${badge}</span>` : ''}
        </button>`).join('')}
      </div>
      <div class="s-foot">🔥 连续 <b>${streak.n}</b> 天<br>已学 <b>${n}</b> / ${WORDS.length}</div>`;
    el.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
      const k = b.dataset.nav;
      state.sheet = null;
      if (k === 'home') { state.view = 'home'; render(); return; }
      if (k === 'learn') { startLearn(); return; }
      if (k === 'review') { startReview(); return; }
      if (k === 'quiz') { state.quiz = null; state.view = 'quiz'; render(); return; }
      state.view = k; render();
    });
  }

  function render() {
    let body = '';
    switch (state.view) {
      case 'home': body = viewHome(); break;
      case 'learn': body = viewLearn(); break;
      case 'review': body = viewReview(); break;
      case 'quiz': body = state.quiz
        ? (state.quiz.type === 'read' ? viewQuizRead() : state.quiz.type === 'listen' ? viewQuizListen() : viewQuizSpell())
        : viewQuizMenu(); break;
      case 'themes': body = viewThemes(); break;
      case 'list': body = viewList(); break;
      case 'rules': body = viewRules(); break;
      case 'rule': body = viewRule(); break;
      case 'settings': body = viewSettings(); break;
      case 'done': body = viewDone(); break;
    }
    app.innerHTML = header() + body + (state.sheet ? sheetHTML() : '');
    renderSide();
    bind();
  }

  /* ---------- 首页 ---------- */
  function viewHome() {
    const n = learnedCount(), due = dueList().length, pct = Math.round(n / WORDS.length * 100);
    const goalLeft = Math.max(0, settings.goal - today.n);
    const core = WORDS.filter(w => w.tier === 1).length;
    return `
    <div class="hero">
      <div><span class="num">${WORDS.length}</span><span class="unit">词</span></div>
      <div class="cap">已学 <b>${n}</b> · ${pct}%　<span class="scope">${settings.scope === 'core' ? `核心 ${core}` : '全部词库'}</span></div>
      <div class="pb"><i style="width:${pct}%"></i></div>
      <div class="kpis">
        <div class="kpi"><b>${due}</b><span>待复习</span></div>
        <div class="kpi"><b>${today.n}</b><span>今日已学</span></div>
        <div class="kpi"><b>${goalLeft}</b><span>今日剩余</span></div>
      </div>
    </div>
    <div class="actions">
      <button class="btn primary" id="go-learn">
        <span>开始学习</span><span class="hint">${newList().length} 个新词</span></button>
      <button class="btn" id="go-review" ${due ? '' : 'disabled style="opacity:.45"'}>
        <span>复习</span><span class="hint">${due ? due + ' 个到期' : '暂无到期'}</span></button>
      <button class="btn" id="go-quiz"><span>测一测</span><span class="hint">认读 · 听音 · 拼写</span></button>
      <button class="btn" id="go-rules"><span>规则</span><span class="hint">${RULES.length} 条语法</span></button>
      <button class="btn" id="go-themes"><span>词库</span><span class="hint">${Object.keys(THEMES).length} 个主题</span></button>
    </div>`;
  }

  /* ---------- 学习 ---------- */
  function startLearn() {
    const pool = newList().slice(0, Math.max(10, settings.goal));
    if (!pool.length) { toast('新词都学完了，去复习吧'); return; }
    state.queue = pool; state.idx = 0; state.view = 'learn'; render();
  }

  function viewLearn() {
    const w = state.queue[state.idx];
    if (!w) { state.view = 'home'; render(); return ''; }
    state.card = w;
    return `
    <div class="stage"><div class="card">
      <div class="head">
        <div>
          <div class="word">${esc(w.latin)}</div>
          ${sylOf(w) ? `<div class="syl">${esc(sylOf(w))}</div>` : ''}
          <div class="pos">${esc(w.pos)} · ${w.h === 'A' ? '后元音' : '前元音'}</div>
        </div>
        <div class="mong">${esc(w.trad)}</div>
      </div>
      <div class="mean">
        <div class="zh">${esc(w.zh)}</div>
        ${w.en ? `<div class="en">${esc(w.en)}</div>` : ""}
        <div class="cyr"><em>西里尔</em>${esc(w.cyr)}</div>
      </div>
    </div></div>
    <div class="pager">
      <button class="btn" id="prev" ${state.idx === 0 ? 'disabled' : ''}>上一个</button>
      <button class="btn primary" id="speak">发音</button>
      <button class="btn" id="next">${state.idx === state.queue.length - 1 ? '完成' : '下一个'}</button>
    </div>`;
  }

  function learnNext() {
    const w = state.queue[state.idx];
    if (w && !srs[w.id]) {
      srs[w.id] = { e: 2.5, i: 0, n: 0, due: Date.now() + DAY };
      today.n += 1;
      touchStreak();
      saveSrs(); saveToday();
    }
    if (state.idx < state.queue.length - 1) { state.idx++; render(); }
    else { state.view = 'home'; render(); }
  }

  /* ---------- 复习 ---------- */
  function startReview() {
    const list = dueList();
    if (!list.length) { toast('没有到期的词'); return; }
    state.queue = list.slice(0, 30); state.idx = 0; state.revealed = false; state.view = 'review'; render();
  }

  function viewReview() {
    const w = state.queue[0];
    if (!w) { state.view = 'home'; render(); return ''; }
    state.card = w;
    return `
    <div class="stage"><div class="card hidden-mean" id="rcard">
      <div class="head">
        <div>
          <div class="word">${esc(w.latin)}</div>
          ${sylOf(w) ? `<div class="syl">${esc(sylOf(w))}</div>` : ''}
        </div>
        <div class="mong">${esc(w.trad)}</div>
      </div>
      <div class="mean">
        <div class="zh">${esc(w.zh)}</div>
        ${w.en ? `<div class="en">${esc(w.en)}</div>` : ""}
        <div class="cyr"><em>西里尔</em>${esc(w.cyr)}</div>
      </div>
    </div></div>
    <div class="tap-hint" id="hint">轻点卡片翻开</div>
    <div class="grades" id="grades" style="display:none">
      <button class="grade g1" data-g="1">忘记<small>10 分钟后</small></button>
      <button class="grade g2" data-g="3">模糊<small>1 天后</small></button>
      <button class="grade g3" data-g="4">记得<small>看情况</small></button>
      <button class="grade g4" data-g="5">简单<small>拉长间隔</small></button>
    </div>`;
  }

  function revealReview() {
    const c = document.getElementById('rcard');
    if (!c) return;
    c.classList.remove('hidden-mean');
    const h = document.getElementById('hint'); if (h) h.style.display = 'none';
    const g = document.getElementById('grades'); if (g) g.style.display = 'grid';
  }

  function reviewGrade(g) {
    const w = state.queue[0];
    if (!w) return;
    grade(w.id, g);
    state.queue.shift();
    if (!state.queue.length) { state.view = 'home'; render(); }
    else render();
  }

  /* ---------- 测验 ---------- */
  function startQuiz(type) {
    const pool = WORDS.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    state.view = 'quiz';
    state.quiz = { type, list: pool.slice(0, 10), i: 0, right: 0, wrong: 0, picked: null, options: null };
    if (type === 'read') buildOptions('zh');
    else if (type === 'listen') buildOptions('latin');
    render();
  }

  function buildOptions(kind) {
    const q = state.quiz, d = q.list[q.i];
    const isLatin = kind === 'latin';
    const target = isLatin ? d.latin : d.zh;
    q.answer = target;
    const others = WORDS.filter(x => x.id !== d.id && (isLatin ? x.latin !== d.latin : x.zh !== d.zh));
    const same = others.filter(x => x.pos === d.pos && x.theme === d.theme);
    const src = same.length >= 3 ? same : others;
    const seen = new Set([target]);
    const opts = [target];
    let guard = 0;
    while (opts.length < 4 && guard++ < 300 && src.length) {
      const c = src[Math.floor(Math.random() * src.length)];
      const v = isLatin ? c.latin : c.zh;
      if (!seen.has(v)) { seen.add(v); opts.push(v); }
    }
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    q.options = opts; q.picked = null;
  }

  function viewQuizMenu() {
    return `<div class="actions" style="margin-top:8px">
      <button class="btn" id="q-read"><span>认读</span><span class="hint">看词选义</span></button>
      <button class="btn" id="q-listen"><span>听音</span><span class="hint">听发音选词</span></button>
      <button class="btn" id="q-spell"><span>拼写</span><span class="hint">看义拼词</span></button>
    </div>`;
  }

  function viewQuizRead() {
    const q = state.quiz, d = q.list[q.i];
    return `
    <div class="q-head"><span>${q.i + 1} / ${q.list.length}</span><span>${q.right} 对 · ${q.wrong} 错</span></div>
    <div class="q-word">${esc(d.latin)}</div>
    ${sylOf(d) ? `<div class="q-syl">${esc(sylOf(d))}</div>` : ''}
    <div class="q-mong"><div class="mong">${esc(d.trad)}</div></div>
    <div class="q-ask">选择意思</div>
    <div class="opts">${q.options.map((o, k) => {
      let cls = 'opt';
      if (q.picked !== null) {
        if (o === q.answer) cls += ' ok'; else if (k === q.picked) cls += ' bad'; else cls += ' dim';
      }
      return `<button class="${cls}" data-opt="${k}">${esc(o)}</button>`;
    }).join('')}</div>`;
  }

  function viewQuizListen() {
    const q = state.quiz, d = q.list[q.i];
    return `
    <div class="q-head"><span>${q.i + 1} / ${q.list.length}</span><span>${q.right} 对 · ${q.wrong} 错</span></div>
    <div class="listen-wrap">
      <button class="listen-btn" id="play"><span class="spk">🔊</span><span>再听一遍</span></button>
    </div>
    <div class="q-ask">选出你听到的词</div>
    <div class="opts">${q.options.map((o, k) => {
      let cls = 'opt latin';
      if (q.picked !== null) {
        if (o === q.answer) cls += ' ok'; else if (k === q.picked) cls += ' bad'; else cls += ' dim';
      }
      return `<button class="${cls}" data-opt="${k}">${esc(o)}</button>`;
    }).join('')}</div>
    ${q.picked !== null ? `<div class="listen-zh">${esc(d.zh)} · ${esc(d.cyr)}</div>` : ''}`;
  }

  function answerRead(k) {
    const q = state.quiz; if (q.picked !== null) return;
    q.picked = k;
    const ok = q.options[k] === q.answer;
    if (ok) q.right++; else q.wrong++;
    render();
    setTimeout(() => {
      if (q.i >= q.list.length - 1) { finishQuiz(); return; }
      q.i++; buildOptions(q.type === 'listen' ? 'latin' : 'zh'); render();
    }, ok ? 620 : 1150);
  }

  function viewQuizSpell() {
    const q = state.quiz, d = q.list[q.i];
    return `
    <div class="q-head"><span>${q.i + 1} / ${q.list.length}</span><span>${q.right} 对 · ${q.wrong} 错</span></div>
    <div class="spellwrap">
      <div class="spell-box">
        <div class="zh">${esc(d.zh)}</div>
        <div class="q-mong"><div class="mong">${esc(d.trad)}</div></div>
        <input class="spell" id="spell" autocomplete="off" autocapitalize="off" spellcheck="false">
      </div>
      <div class="feedback ${q.picked === null ? '' : (q.picked ? 'ok' : 'bad')}" id="fb">${
        q.picked === null ? '' : (q.picked ? '✓' : `答案：${esc(d.latin)}`)
      }</div>
      <div class="spell-foot">
        <button class="btn" id="hint-btn">提示</button>
        <button class="btn primary" id="check">检查</button>
      </div>
    </div>`;
  }

  const FOLD = { 'sh': 's', 'ch': 'c', 'ts': 'c', 'kh': 'x', 'h': 'x' };
  function norm(s) {
    let x = String(s).toLowerCase().trim().replace(/[’'`ʼ]/g, '').replace(/\s+/g, '');
    x = x.replace(/sh/g, 's').replace(/ch/g, 'c').replace(/ts/g, 'c').replace(/kh/g, 'x').replace(/h/g, 'x');
    x = x.replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/ö/g, 'o').replace(/ü/g, 'u');
    return x;
  }

  function checkSpell() {
    const q = state.quiz, d = q.list[q.i];
    const el = document.getElementById('spell');
    if (!el || !el.value.trim()) { toast('先写点什么'); return; }
    const ok = norm(el.value) === norm(d.latin);
    q.picked = ok ? 1 : 0;
    if (ok) q.right++; else q.wrong++;
    render();
    setTimeout(() => {
      if (q.i >= q.list.length - 1) { finishQuiz(); return; }
      q.i++; q.picked = null; render();
    }, ok ? 700 : 1400);
  }

  function finishQuiz() {
    state.quizResult = { right: state.quiz.right, wrong: state.quiz.wrong, total: state.quiz.list.length };
    state.quiz = null; state.view = 'done'; render();
  }

  function viewDone() {
    const r = state.quizResult || { right: 0, wrong: 0, total: 0 };
    return `<div class="hero" style="padding-top:24px">
      <div><span class="num">${r.right}</span><span class="unit">/ ${r.total}</span></div>
      <div class="cap">答对 ${r.right}，答错 ${r.wrong}</div>
    </div>
    <div class="actions">
      <button class="btn primary" id="again">再来一次</button>
      <button class="btn" id="home">回到首页</button>
    </div>`;
  }

  /* ---------- 词库 ---------- */
  function viewThemes() {
    const counts = {};
    WORDS.forEach(w => counts[w.theme] = (counts[w.theme] || 0) + 1);
    return `<div class="themes">${Object.entries(THEMES).map(([k, v]) => `
      <button class="theme" data-theme="${esc(k)}"><span>${esc(v)}</span><b>${counts[k] || 0}</b></button>`).join('')}
    </div>
    <div class="actions" style="margin-top:18px">
      <button class="btn" id="export"><span>导出词表</span><span class="hint">JSON · 校对用</span></button>
    </div>`;
  }

  function viewList() {
    const q = state.filter.trim().toLowerCase();
    const now = Date.now();
    const f = state.wfilter || 'all';
    const list = WORDS.filter(w => {
      if (state.theme && w.theme !== state.theme) return false;
      if (f === 'new' && srs[w.id]) return false;
      if (f === 'learned' && !srs[w.id]) return false;
      if (f === 'due' && !(srs[w.id] && srs[w.id].due <= now)) return false;
      if (!q) return true;
      return w.latin.toLowerCase().includes(q) || w.zh.includes(q) || w.en.toLowerCase().includes(q) || w.cyr.includes(q);
    });
    const chips = [['all', '全部'], ['new', '未学'], ['learned', '已学'], ['due', '待复习']];
    return `
    <input class="search" id="search" placeholder="搜索 拉丁 / 中文 / 西里尔" value="${esc(state.filter)}">
    <div class="chips">${chips.map(([k, label]) => `<button class="chip ${f === k ? 'on' : ''}" data-wf="${k}">${label}</button>`).join('')}
      <span class="chip-n">${list.length}</span></div>
    <div class="list">
      ${list.length ? list.slice(0, 400).map(w => `
        <div class="row" data-id="${esc(w.id)}">
          <div class="l">
            <div class="w">${esc(w.latin)}</div>
            <div class="m">${esc(w.zh)}</div>
            <div class="c">${esc(w.cyr)} · ${esc(w.en)}</div>
          </div>
          <div class="mong">${esc(w.trad)}</div>
        </div>`).join('') : '<div class="empty">没有匹配的词</div>'}
    </div>`;
  }

  function sheetHTML() {
    const w = state.sheet;
    return `<div class="sheet" id="sheet"><div class="inner">
      <header><button class="back" id="closeSheet">← 返回</button><span class="right">${esc(w.cyr)}</span></header>
      <div class="card">
        <div class="head">
          <div>
            <div class="word">${esc(w.latin)}</div>
            ${sylOf(w) ? `<div class="syl">${esc(sylOf(w))}</div>` : ''}
            <div class="pos">${esc(w.pos)} · ${w.h === 'A' ? '后元音' : '前元音'}</div>
          </div>
          <div class="mong">${esc(w.trad)}</div>
        </div>
        <div class="mean">
          <div class="zh">${esc(w.zh)}</div>
          ${w.en ? `<div class="en">${esc(w.en)}</div>` : ""}
          <div class="cyr"><em>西里尔</em>${esc(w.cyr)}</div>
        </div>
      </div>
      <div class="pager"><button class="btn primary" id="sheetSpeak">发音</button></div>
    </div></div>`;
  }

  /* ---------- 规则 ---------- */
  function viewRules() {
    return `<div class="actions" style="margin-top:6px">${RULES.map(r => `
      <button class="btn rule-btn" data-rule="${esc(r.id)}">
        <span class="rl">${esc(r.title)}<em>${esc(r.sub || '')}</em></span>
      </button>`).join('')}</div>`;
  }

  function viewRule() {
    const r = RULES.find(x => x.id === state.ruleId) || RULES[0];
    if (!r) return '';
    return `<div class="rule-head"><h2>${esc(r.title)}</h2><div class="rule-sub">${esc(r.sub || '')}</div></div>
      ${r.blocks.map(renderBlock).join('')}`;
  }

  function renderBlock(b) {
    if (b.t === 'p') return `<p class="rp">${esc(b.x)}</p>`;
    if (b.t === 'note') return `<div class="rnote">${esc(b.x)}</div>`;
    if (b.t === 'ex') return `<div class="rex"><div class="mn">${esc(b.mn)}</div><div class="zh">${esc(b.zh)}</div></div>`;
    if (b.t === 'table') return `<table class="rtable"><thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return '';
  }

  /* ---------- 设置 ---------- */
  function viewSettings() {
    const n = learnedCount();
    const goals = [10, 20, 30, 50];
    return `
    <div class="set-group">
      <div class="set-label">学习范围</div>
      <div class="set-sub">核心词库是精挑的常用词；全部词库含词典扩展词</div>
      <div class="seg" style="margin-top:12px">
        <button class="seg-btn ${settings.scope === 'core' ? 'on' : ''}" data-scope="core">核心</button>
        <button class="seg-btn ${settings.scope === 'all' ? 'on' : ''}" data-scope="all">全部</button>
      </div>
    </div>
    <div class="set-group">
      <div class="set-label">每日新词</div>
      <div class="seg">${goals.map(g => `<button class="seg-btn ${settings.goal === g ? 'on' : ''}" data-goal="${g}">${g}</button>`).join('')}</div>
    </div>
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">自动发音</div><div class="set-sub">学习卡片出现时自动播放</div></div>
        <button class="sw ${settings.auto ? 'on' : ''}" id="toggle-auto"><i></i></button></div>
    </div>
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">学习进度</div><div class="set-sub">已学 ${n} / ${WORDS.length}</div></div></div>
      <button class="btn danger" id="reset">清空学习记录</button>
    </div>
    <div class="set-about">
      <p>词库 ${WORDS.length} 条 · 语音 ${WORDS.length} 条</p>
      <p>回鹘蒙文由 <b>khudam</b> 转换（词典数据 CC BY-SA 4.0）</p>
      <p>语音由 Azure 蒙古语神经语音合成，仅供学习使用</p>
      <p>Mongol v0.7</p>
    </div>`;
  }

  /* ---------- 音频 ---------- */
  let audioEl = null;
  function playWord(w, silent) {
    if (!w) return;
    try {
      if (audioEl) { audioEl.pause(); audioEl = null; }
      audioEl = new Audio('audio/' + w.au + '.mp3');
      audioEl.play().catch(() => { if (!silent) speak(w.cyr); });
    } catch (e) { if (!silent) speak(w.cyr); }
  }

  function exportWords() {
    const blob = new Blob([JSON.stringify(WORDS, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mongol-words.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('已导出 ' + WORDS.length + ' 词');
  }

  /* ---------- 事件 ---------- */
  function bind() {
    const $ = id => document.getElementById(id);

    const back = $('back');
    if (back) back.onclick = () => {
      if (state.view === 'quiz' && state.quiz) { state.quiz = null; render(); }
      else if (state.view === 'list') { state.view = 'themes'; render(); }
      else if (state.view === 'rule') { state.view = 'rules'; render(); }
      else { state.view = 'home'; render(); }
    };

    const gs = $('go-settings'); if (gs) gs.onclick = () => { state.view = 'settings'; render(); };
    document.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => {
      settings.scope = b.dataset.scope; saveSettings(); render();
    });
    document.querySelectorAll('[data-goal]').forEach(b => b.onclick = () => {
      settings.goal = Number(b.dataset.goal); saveSettings(); render();
    });
    const ta = $('toggle-auto'); if (ta) ta.onclick = () => {
      settings.auto = !settings.auto; saveSettings(); render();
    };
    const rs = $('reset'); if (rs) rs.onclick = () => {
      if (!confirm('清空所有学习记录？这个操作不能撤销。')) return;
      srs = {}; saveSrs(); today = { date: todayStr(), n: 0 }; saveToday();
      toast('已清空'); state.view = 'home'; render();
    };

    const gl = $('go-learn'); if (gl) gl.onclick = startLearn;
    const gr = $('go-review'); if (gr) gr.onclick = startReview;
    const gq = $('go-quiz'); if (gq) gq.onclick = () => { state.quiz = null; state.view = 'quiz'; render(); };
    const gt = $('go-themes'); if (gt) gt.onclick = () => { state.view = 'themes'; render(); };
    const gru = $('go-rules'); if (gru) gru.onclick = () => { state.view = 'rules'; render(); };
    document.querySelectorAll('[data-rule]').forEach(b => b.onclick = () => {
      state.ruleId = b.dataset.rule; state.view = 'rule'; render(); window.scrollTo(0, 0);
    });

    const prev = $('prev'); if (prev) prev.onclick = () => { if (state.idx > 0) { state.idx--; render(); } };
    const next = $('next'); if (next) next.onclick = learnNext;
    const sp = $('speak'); if (sp) sp.onclick = () => playWord(state.card);
    const ss = $('sheetSpeak'); if (ss) ss.onclick = () => playWord(state.sheet);

    if (state.view === 'learn' && state.card && settings.auto) playWord(state.card, true);

    const rcard = $('rcard');
    if (rcard) rcard.onclick = revealReview;
    document.querySelectorAll('[data-g]').forEach(b => b.onclick = () => reviewGrade(Number(b.dataset.g)));

    const qr = $('q-read'); if (qr) qr.onclick = () => startQuiz('read');
    const ql = $('q-listen'); if (ql) ql.onclick = () => startQuiz('listen');
    const qs = $('q-spell'); if (qs) qs.onclick = () => startQuiz('spell');
    document.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => answerRead(Number(b.dataset.opt)));

    if (state.view === 'quiz' && state.quiz && state.quiz.type === 'listen') {
      const d = state.quiz.list[state.quiz.i];
      const pb = $('play'); if (pb) pb.onclick = () => playWord(d);
      if (state.quiz.picked === null) playWord(d, true);
    }

    const check = $('check'); if (check) check.onclick = checkSpell;
    const spell = $('spell');
    if (spell) { spell.focus(); spell.onkeydown = e => { if (e.key === 'Enter') checkSpell(); }; }
    const hb = $('hint-btn');
    if (hb) hb.onclick = () => { const d = state.quiz.list[state.quiz.i]; toast('首字母 ' + d.latin[0] + ' · ' + (d.syl || d.latin)); };

    document.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => {
      state.theme = b.dataset.theme; state.filter = ''; state.view = 'list'; render();
    });

    document.querySelectorAll('[data-wf]').forEach(b => b.onclick = () => {
      state.wfilter = b.dataset.wf; render();
    });

    const search = $('search');
    if (search) search.oninput = e => {
      state.filter = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const s = $('search'); if (s) { s.focus(); s.setSelectionRange(pos, pos); }
    };

    document.querySelectorAll('[data-id]').forEach(r => r.onclick = () => {
      state.sheet = WORDS.find(w => w.id === r.dataset.id); render();
    });
    const cs = $('closeSheet'); if (cs) cs.onclick = () => { state.sheet = null; render(); };

    const ag = $('again'); if (ag) ag.onclick = () => { state.view = 'quiz'; state.quiz = null; render(); };
    const hm = $('home'); if (hm) hm.onclick = () => { state.view = 'home'; render(); };
    const ex = $('export'); if (ex) ex.onclick = exportWords;
  }

  /* ---------- 键盘 ---------- */
  document.addEventListener('keydown', e => {
    if (state.view === 'review') {
      if (e.key === ' ') { e.preventDefault(); revealReview(); }
      const map = { '1': 1, '2': 3, '3': 4, '4': 5 };
      if (map[e.key] && document.getElementById('grades').style.display !== 'none') reviewGrade(map[e.key]);
    }
  });

  /* ---------- 路由（截图 / 分享用） ---------- */
  const HASH = (location.hash || '').replace('#', '');
  if (HASH === 'learn') startLearn();
  else if (HASH === 'review') startReview();
  else if (HASH === 'themes') { state.view = 'themes'; }
  else if (HASH === 'rules') { state.view = 'rules'; }
  else if (HASH.startsWith('rule-')) { state.ruleId = HASH.slice(5); state.view = 'rule'; }
  else if (HASH === 'quiz') startQuiz('read');
  else if (HASH === 'spell') startQuiz('spell');

  render();

  /* 调试钩子（截图 / 手测用，不影响正常流程） */
  window.__app = { state, get srs() { return srs; }, grade, render, startReview, startLearn, startQuiz };
})();
