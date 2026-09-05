// 刷题训练台 web 端。所有计算都在服务端（复用 store.py / planner.py），
// 这里只负责取数据和渲染，所以网页和 ./sinan 看到的结论完全一致。

const CAT_COLOR = {
  basics: '#7f8ea3', array: '#4ea1ff', 'ds-basic': '#56c8d8', string: '#7dd3a0',
  'binary-search': '#a8d15a', tree: '#ffd166', search: '#ffa552', dp: '#ff7b72',
  graph: '#d792f5', greedy: '#9d8cff', math: '#6bb7ff', 'advanced-ds': '#ff8fb1',
  design: '#8fa3b8',
};
const DOMAIN_COLOR = {
  tree: '#ffd166', graph: '#d792f5', dp: '#ff7b72', math: '#6bb7ff', ds: '#56c8d8',
  string: '#7dd3a0', search: '#ffa552', greedy: '#9d8cff', list: '#8fa3b8', other: '#7f8ea3',
};
const DOMAIN_CN = {
  tree: '树', graph: '图论', dp: '动态规划', math: '数学', ds: '数据结构与技巧',
  string: '字符串', search: '搜索', greedy: '贪心', list: '链表', other: '其它',
};
const KIND_CN = { official: '力扣官方', hot: '高频榜', company: '公司榜', series: '系列题库', special: '精选' };
const PACE_CN = { depth: '重攻坚', balanced: '均衡', coverage: '重覆盖' };
const DIFFS = [['EASY', '简单'], ['MEDIUM', '中等'], ['HARD', '困难']];
const SORTS = [['id', '按题号'], ['hot', '按面试频次'], ['value', '按练习价值'],
  ['diff', '按难度'], ['ac', '按通过率（低→高）']];

// --- DOM helper --------------------------------------------------------------

function h(spec, props = {}, ...children) {
  const [tag, ...classes] = String(spec).split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = `${el.className} ${v}`.trim();
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(4)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const $ = (s) => document.querySelector(s);
const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

async function api(path, params) {
  const url = new URL(path, location.origin);
  for (const [k, v] of Object.entries(params || {})) {
    if (v === '' || v === null || v === undefined || v === false) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else url.searchParams.set(k, v === true ? '1' : v);
  }
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

// --- 状态 --------------------------------------------------------------------

const VIEWS = [
  ['overview', '总览', '◉'],
  ['problems', '题库', '▤'],
  ['topics', '标签体系', '⌗'],
  ['approaches', '题解思路', '✳'],
  ['lists', '特殊题单', '★'],
  ['plan', '学习计划', '✦'],
];

const state = {
  view: 'overview',
  q: '',
  filters: { cat: '', tag: '', approach: '', diff: new Set(), hot: false, todo: false, mine: false, source: '', paid: false, in: '', sort: 'id' },
  limit: 60,
  plan: { kind: 'route', route: 'starter', topic: 'lc:top-100-liked', mode: 'auto', pace: 'depth', all: false, paid: false },
  openSlug: null,
};
const cache = { meta: null, topics: null, approaches: null, lists: null, routes: null };

// --- 公共零件 ----------------------------------------------------------------

function goLink(p, label = '↗') {
  return h('a.goLink', {
    href: p.url, target: '_blank', rel: 'noreferrer',
    title: `在 ${p.sourceName || '平台'} 打开：${p.url}`,
    onClick: (e) => e.stopPropagation(),
  }, label);
}

function diffPill(p) {
  return h(`span.pill.pill--${p.difficulty}`, {}, p.difficultyCn);
}

function apStrip(p, limit = 3) {
  const fp = p.approach || [];
  if (!fp.length) return h('span.apGuess', {}, '—');
  const guessed = fp[0].from === 'tags';
  return h('span.apStrip', {},
    fp.slice(0, limit).map((a) => h('span.apChip', {
      style: { color: guessed ? 'var(--faint)' : (DOMAIN_COLOR[a.domain] || 'var(--muted)') },
      title: `${DOMAIN_CN[a.domain] || a.domain} · 置信 ${Math.round(a.conf * 100)}% · 区分度 ${a.w}`,
    }, a.name)),
    fp.length > limit ? h('span.apGuess', {}, `+${fp.length - limit}`) : null,
    guessed ? h('span.apGuess', {}, '(推断)') : null,
  );
}

function tagStrip(p, limit = 3) {
  const tags = p.tags || [];
  return h('span.tagStrip', {},
    tags.slice(0, limit).map((t) => h('span.tagBit', {},
      h('i.row__dot', { style: { background: CAT_COLOR[t.cat] || '#8fa3b8' } }), t.name)),
    tags.length > limit ? h('span.tagBit.tagBit--more', {}, `+${tags.length - limit}`) : null,
  );
}

function tableHead(byApproach) {
  return h('div.tableHead', {},
    h('span', {}, '题号'), h('span', {}, '标题'), h('span', {}, '难度'),
    h('span', {}, byApproach ? '题解思路' : '解法标签'),
    h('span', { style: { textAlign: 'right' } }, '高频'),
    h('span', { style: { textAlign: 'right' } }, '通过率'),
    h('span', {}, '已刷'), h('span', {}, '去做'),
  );
}

function problemRow(p, byApproach) {
  return h('div.row', {
    dataset: { done: String(p.done) },
    style: { '--catColor': CAT_COLOR[p.mainCat] || '#8fa3b8' },
    onClick: () => openProblem(p.slug),
  },
    h('span.row__id', {}, p.id),
    h('span.row__title', {},
      h('span', {}, p.title),
      p.paid ? h('span.pill.pill--paid', {}, '会员') : null,
      p.catSpan >= 3 ? h('span.pill.pill--multi', { title: `解法跨 ${p.catSpan} 个大类` }, '多解') : null,
    ),
    h('span', {}, diffPill(p)),
    byApproach ? apStrip(p) : tagStrip(p),
    h('span.row__num', { title: 'CodeTop 面试频次' }, p.freq ? `热 ${p.freq}` : '—'),
    h('span.row__num', {}, `${Math.round(p.acRate * 100)}%`),
    h('span.row__done', { title: p.mine.length ? `本地题解：${p.mine.join(', ')}` : '' },
      p.done ? (p.mine.length ? '✔' : '✓') : ''),
    goLink(p),
  );
}

function metric(label, value, sub, ratio) {
  return h('div.card.metric', {},
    h('div.metric__k', {}, label),
    h('div.metric__v', {}, String(value), sub ? h('small', {}, ` ${sub}`) : null),
    ratio === undefined ? null : h('div.metric__bar', {}, h('i', { style: { width: `${ratio}%` } })),
  );
}

function sectionHead(title, note, ...extra) {
  return h('div.sectionHead', {}, h('h2', {}, title), note ? h('p', {}, note) : null,
    h('span.spacer'), ...extra);
}

// --- 视图：总览 --------------------------------------------------------------

async function viewOverview(host) {
  const { meta, cats, progress } = cache.meta;
  const st = meta.stats;
  host.append(h('div.metrics', {},
    metric('题库', st.total, `${st.free} 道免费`),
    metric('已刷', progress.done, `/ ${progress.total}`, (progress.done / progress.total) * 100),
    metric('高频命中', progress.hotDone, `/ ${progress.hotTotal} CodeTop`,
      (progress.hotDone / Math.max(progress.hotTotal, 1)) * 100),
    metric('覆盖标签', progress.tagsTouched, `/ ${progress.tagCount}`,
      (progress.tagsTouched / progress.tagCount) * 100),
  ));

  host.append(sectionHead('知识地图', `13 个大类 · 一题多解会计入多个大类（平均 ${st.avgTags} 个标签/题）`,
    h('button.btn.btn--ghost.btn--sm', { onClick: () => go('topics') }, '看子标签 →')));
  host.append(h('div.mapGrid', {}, cats.map((c) => h('button.mapCard', {
    style: { '--catColor': CAT_COLOR[c.id] || '#8fa3b8' },
    onClick: () => { state.filters.cat = c.id; state.filters.tag = ''; go('problems'); },
  },
    h('div.mapCard__top', {}, h('span.mapCard__name', {}, c.name),
      h('span.mapCard__n', {}, `${c.done}/${c.total}`)),
    h('p.mapCard__desc', {}, c.desc),
    h('div.mapCard__subs', {}, c.subs.slice(0, 5).map((s) => h('span.mapCard__sub', {}, s.name))),
    h('div.mapCard__meter', {}, h('i', { style: { width: `${c.total ? (c.done / c.total) * 100 : 0}%` } })),
  ))));

  const two = h('div.twoCol');
  host.append(two);

  const todoCard = h('div.card', {}, h('div.empty', {}, '正在算下一步…'));
  const listCard = h('div.card', {}, h('div.empty', {}, '加载题单…'));
  two.append(todoCard, listCard);

  api('/api/next', { n: 4 }).then(({ items }) => {
    clear(todoCard).append(
      h('div.sectionHead', { style: { padding: '14px 16px 0', margin: 0 } },
        h('h2', {}, '下一步'), h('p', {}, '取自最薄弱专题的代表题')),
      h('div', { style: { padding: '4px 6px 10px' } }, items.map((it) => h('div.taskRow', {
        dataset: { done: String(it.problem.done) },
      },
        h('button.check', {
          dataset: { on: String(it.problem.done) },
          onClick: () => toggleCheckin(it.problem.slug),
        }, '✓'),
        h('span.row__id', {}, it.problem.id),
        h('span.taskRow__title', { onClick: () => openProblem(it.problem.slug) },
          it.problem.title,
          h('div.stepMeta', {}, h('span.k', {}, '思路'), it.approaches.slice(0, 4).join('、'))),
        h('span', {}, diffPill(it.problem)),
        h('span', {}, goLink(it.problem)),
      ))));
  }).catch((e) => clear(todoCard).append(h('div.empty', {}, String(e.message))));

  api('/api/lists').then(({ lists }) => {
    clear(listCard).append(
      h('div.sectionHead', { style: { padding: '14px 16px 0', margin: 0 } },
        h('h2', {}, '特殊题单'), h('p', {}, `${lists.length} 份`),
        h('span.spacer'),
        h('button.btn.btn--ghost.btn--sm', { onClick: () => go('lists') }, '全部 →')),
      h('div.weakList', {}, lists.slice(0, 7).map((l) => h('div.weakRow', {
        onClick: () => { state.plan.topic = l.id; go('plan'); },
      },
        h('div', {}, h('div.weakRow__name', {}, l.name),
          h('div.weakRow__cat', {}, `${KIND_CN[l.kind] || l.kind} · ${l.stats.resolved} 题`)),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          h('div.weakRow__meter', {}, h('i', { style: { width: `${l.total ? (l.done / l.total) * 100 : 0}%`, background: 'var(--accent)' } })),
          h('span.apNote', {}, `${l.done}/${l.total}`)),
      ))));
  }).catch((e) => clear(listCard).append(h('div.empty', {}, String(e.message))));
}

// --- 视图：题库 --------------------------------------------------------------

async function viewProblems(host) {
  const f = state.filters;
  const cats = cache.meta.cats;
  const cat = cats.find((c) => c.id === f.cat);
  if (!cache.approaches) cache.approaches = await api('/api/approaches');
  if (!cache.lists) cache.lists = await api('/api/lists');

  const chip = (label, on, onClick, title) =>
    h('button.chip', { dataset: { on: String(on) }, onClick, title: title || '' }, label);

  const label = f.approach || (f.tag && cat && cat.subs.find((s) => s.id === f.tag)?.name)
    || (cat && cat.name) || state.q || '全部题目';
  const head = sectionHead(`题库 · ${label}`, '每行右侧 ↗ 直接跳到题目所在平台');
  const controls = h('div.filters', {}, h('span.filters__label', {}, '筛选条件加载中…'));
  const body = h('div', {}, h('div.empty', {}, '查询中…'));
  host.append(head, controls, body);

  const data = await api('/api/problems', {
    q: state.q, cat: f.cat, tag: f.tag, approach: f.approach, diff: [...f.diff],
    hot: f.hot, todo: f.todo, mine: f.mine, source: f.source, paid: f.paid,
    in: f.in, sort: f.sort, limit: state.limit,
  });

  // 分面：每个选项后面的数字是「其余筛选条件下还剩多少题」，选一个别的维度它就跟着变。
  // 数字为 0 的选项直接禁用，免得点进去看到空列表。
  const fc = data.facets || {};
  const opt = (value, label, n, selected, { always = false } = {}) => {
    if (n === 0 && !selected && !always) {
      return h('option', { value, selected, disabled: true }, `${label} (0)`);
    }
    return h('option', { value, selected }, n === undefined ? label : `${label} (${n})`);
  };
  const pick = (bag, key) => (bag || {})[key] || 0;

  clear(controls).append(
    h('span.filters__label', {}, '大类'),
    h('select', { onChange: (e) => { f.cat = e.target.value; f.tag = ''; state.limit = 60; render(); } },
      h('option', { value: '', selected: !f.cat }, '全部大类'),
      cats.map((c) => opt(c.id, c.name, pick(fc.cats, c.id), f.cat === c.id))),

    h('span.filters__label', {}, '子标签'),
    h('select', { disabled: !cat, onChange: (e) => { f.tag = e.target.value; state.limit = 60; render(); } },
      h('option', { value: '', selected: !f.tag }, cat ? '全部子标签' : '先选大类'),
      (cat ? cat.subs : []).map((s) => opt(s.id, s.name, pick(fc.subs, s.id), f.tag === s.id))),

    h('span.filters__label', {}, '解法思路'),
    h('select', { onChange: (e) => { f.approach = e.target.value; state.limit = 60; render(); } },
      h('option', { value: '', selected: !f.approach }, '全部思路'),
      cache.approaches.approaches
        .map((a) => [a, pick(fc.approaches, a.name)])
        .sort((x, y) => y[1] - x[1] || x[0].name.localeCompare(y[0].name))
        .map(([a, n]) => opt(a.name, a.name, n, f.approach === a.name))),

    h('span.filters__label', {}, '题目来源'),
    h('select', { onChange: (e) => { f.source = e.target.value; state.limit = 60; render(); } },
      h('option', { value: '', selected: !f.source }, '全部来源'),
      (cache.meta.meta.sources || []).map((s) =>
        opt(s.id, s.name, pick(fc.sources, s.id), f.source === s.id))),

    h('span.filters__label', {}, '题单'),
    h('select', { onChange: (e) => { f.in = e.target.value; state.limit = 60; render(); } },
      h('option', { value: '', selected: !f.in }, '不限题单'),
      (cache.lists.lists || [])
        .map((l) => [l, pick(fc.lists, l.id)])
        .sort((x, y) => y[1] - x[1] || x[0].name.localeCompare(y[0].name))
        .map(([l, n]) => opt(l.id, l.name, n, f.in === l.id))),

    h('div.filters__group', {}, DIFFS.map(([k, label]) => chip(
      `${label}${fc.diffs ? ` ${pick(fc.diffs, k)}` : ''}`,
      f.diff.has(k),
      () => { f.diff.has(k) ? f.diff.delete(k) : f.diff.add(k); state.limit = 60; render(); },
    ))),
    h('div.filters__group', {},
      chip('面试高频', f.hot, () => { f.hot = !f.hot; state.limit = 60; render(); }, 'CodeTop 榜内'),
      chip('未刷', f.todo, () => { f.todo = !f.todo; state.limit = 60; render(); }),
      chip('我写过', f.mine, () => { f.mine = !f.mine; state.limit = 60; render(); }),
      chip('含会员题', f.paid, () => { f.paid = !f.paid; state.limit = 60; render(); }),
      (f.cat || f.tag || f.approach || f.source || f.in || f.diff.size || f.hot || f.todo || f.mine)
        ? h('button.chip', {
            onClick: () => {
              Object.assign(f, { cat: '', tag: '', approach: '', source: '', in: '' });
              f.diff = new Set(); f.hot = false; f.todo = false; f.mine = false;
              state.limit = 60; render();
            },
          }, '清空筛选')
        : null,
    ),
    h('span.spacer', { style: { marginLeft: 'auto' } }),
    h('select', { onChange: (e) => { f.sort = e.target.value; render(); } },
      SORTS.map(([k, label]) => h('option', { value: k, selected: f.sort === k }, label))),
  );

  const byApproach = Boolean(f.approach);
  clear(body).append(
    h('p', { style: { color: 'var(--faint)', fontSize: '12px', margin: '0 0 8px' } },
      `命中 ${data.total} 题，显示 ${data.items.length}`),
    tableHead(byApproach),
    h('div.rows', {}, data.items.map((p) => problemRow(p, byApproach))),
    data.total > data.items.length
      ? h('div.moreBar', {}, h('button.btn.btn--sm', {
          onClick: () => { state.limit += 60; render(); },
        }, `再加载 60 题（共 ${data.total}）`))
      : h('div.moreBar', {}, `— 共 ${data.total} 题 —`),
  );
}

// --- 视图：标签体系 ----------------------------------------------------------

async function viewTopics(host) {
  const cats = cache.meta.cats;
  host.append(sectionHead('标签体系',
    `${cats.length} 个大类 / ${cache.meta.progress.tagCount} 个子标签 · 一题多解会打多个标签`));
  for (const c of cats) {
    const color = CAT_COLOR[c.id] || '#8fa3b8';
    const subs = h('div.topicSubs', {}, c.subs.map((s) => h('div.subCard', {},
      h('div.subCard__top', {}, h('span.subCard__name', {}, s.name),
        h('span.subCard__n', {}, `${s.done}/${s.total}`)),
      h('p.subCard__desc', {}, s.desc),
      h('div.subCard__meter', {}, h('i', { style: { width: `${s.total ? (s.done / s.total) * 100 : 0}%`, background: color } })),
      h('div.subCard__acts', {},
        h('button.btn.btn--sm', {
          onClick: () => { state.filters.cat = c.id; state.filters.tag = s.id; state.filters.approach = ''; go('problems'); },
        }, `去练 ${s.count} 题`),
        h('button.btn.btn--sm.btn--ghost', {
          onClick: () => { state.plan.topic = s.id; go('plan'); },
        }, '学习计划'),
      ),
    )));
    const body = h('div', {}, subs);
    host.append(h('div.card.topicCat', { style: { '--catColor': color } },
      h('button.topicCat__head', { onClick: () => { body.hidden = !body.hidden; } },
        h('span.topicCat__bar'),
        h('span', {}, h('div.topicCat__title', {}, c.name), h('div.topicCat__desc', {}, c.desc)),
        h('span.topicCat__meta', {}, `${c.done}/${c.total} 题`, h('br'), `${c.subs.length} 个标签`)),
      body));
  }
}

// --- 视图：题解思路 ----------------------------------------------------------

async function viewApproaches(host) {
  if (!cache.approaches) cache.approaches = await api('/api/approaches');
  const st = cache.meta.meta.stats;
  const rows = cache.approaches.approaches;
  host.append(sectionHead('解法思路',
    `${rows.length} 种思路 · ${st.approachFromCode} 道题读题解代码判定、`
    + `${st.approachFromStatement} 道题读题面与数据范围推断（${st.approachCrossChecked} 道互相印证）`
    + ` · 平均 ${st.avgApproaches} 种/题`));
  const byDomain = new Map();
  for (const a of rows) {
    if (!byDomain.has(a.domain)) byDomain.set(a.domain, []);
    byDomain.get(a.domain).push(a);
  }
  for (const [domain, list] of byDomain) {
    host.append(h('div.sectionHead', { style: { marginTop: '18px' } },
      h('h2', { style: { color: DOMAIN_COLOR[domain] || 'inherit' } }, DOMAIN_CN[domain] || domain),
      h('p', {}, `${list.length} 种`)));
    host.append(h('div.apGrid', {}, list.map((a) => h('div.apCard', {
      onClick: () => { state.filters.approach = a.name; state.filters.cat = ''; state.filters.tag = ''; go('problems'); },
    },
      h('div.apCard__top', {},
        h('span.apCard__name', { style: { color: DOMAIN_COLOR[domain] } }, a.name),
        h('span.apCard__n', {}, `${a.done}/${a.total}`)),
      h('div.subCard__meter', { style: { marginTop: '6px' } },
        h('i', { style: { width: `${a.total ? (a.done / a.total) * 100 : 0}%`, background: DOMAIN_COLOR[domain] } })),
      h('div.apCard__meta', {},
        `题解实证 ${a.real} · 高频 ${a.hot} · 区分度 ${a.w}`),
    ))));
  }
}

// --- 视图：题单 --------------------------------------------------------------

async function viewLists(host) {
  const { lists } = cache.lists || (cache.lists = await api('/api/lists'));
  host.append(sectionHead('特殊题单', `${lists.length} 份 · 点进去直接生成按知识点递进的计划`));
  const groups = new Map();
  for (const l of lists) {
    if (!groups.has(l.kind)) groups.set(l.kind, []);
    groups.get(l.kind).push(l);
  }
  for (const kind of ['official', 'hot', 'company', 'series', 'special']) {
    const rows = groups.get(kind);
    if (!rows) continue;
    host.append(h('div.sectionHead', { style: { marginTop: '18px' } },
      h('h2', {}, KIND_CN[kind] || kind), h('p', {}, `${rows.length} 份`)));
    host.append(h('div.mapGrid', {}, rows.map((l) => h('button.mapCard', {
      style: { '--catColor': 'var(--accent)' },
      onClick: () => { state.plan.topic = l.id; go('plan'); },
    },
      h('div.mapCard__top', {}, h('span.mapCard__name', {}, l.name),
        h('span.mapCard__n', {}, `${l.done}/${l.total}`)),
      h('p.mapCard__desc', {}, l.desc || ''),
      h('div.mapCard__subs', {},
        h('span.mapCard__sub', {}, `${l.stats.resolved} 题`),
        h('span.mapCard__sub', {}, `易${l.stats.difficulty['简单'] || 0} 中${l.stats.difficulty['中等'] || 0} 难${l.stats.difficulty['困难'] || 0}`),
        h('span.mapCard__sub', {}, `高频 ${l.stats.hot}`),
        l.groups ? h('span.mapCard__sub', {}, `${l.groups} 个官方知识点分组`) : null),
      h('div.mapCard__meter', {}, h('i', { style: { width: `${l.total ? (l.done / l.total) * 100 : 0}%` } })),
    ))));
  }
}

// --- 视图：学习计划 ----------------------------------------------------------

// **强调** -> <strong>，顺手把中文里的破折号留原样
function richText(s) {
    const out = [];
    let last = 0;
    const re = /\*\*(.+?)\*\*/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) out.push(s.slice(last, m.index));
      out.push(h('strong', {}, m[1]));
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
}

// 教学卡片：核心思想 / 识别信号 / 模板 / 坑 / 复杂度 / OI-Wiki
function noteCard(note, { compact = false } = {}) {
  const key = compact ? 'lc-note-sec-open' : 'lc-note-open';
  const open = localStorage.getItem(key) !== '0' && !compact;
  const card = h('div.card.noteCard', {});
  const bodyBox = h('div.noteCard__body', { style: { display: open ? 'block' : 'none' } });
  const toggle = h('button.noteCard__toggle', {}, open ? '收起' : '展开');
  toggle.onclick = () => {
    const now = bodyBox.style.display === 'none';
    bodyBox.style.display = now ? 'block' : 'none';
    toggle.textContent = now ? '收起' : '展开';
    localStorage.setItem(key, now ? '1' : '0');
  };
  card.append(h('div.noteCard__head', {},
    h('h3', {}, compact ? '这一节讲什么' : '开练前先看'),
    h('span', {}, '核心思想 · 识别信号 · 模板 · 常见坑'),
    toggle));
  card.append(bodyBox);
  if (compact) card.classList.add('noteCard--sec');

  if (note.idea) bodyBox.append(h('p.noteCard__idea', {}, ...richText(note.idea)));
  if (note.signals?.length) {
    bodyBox.append(h('div.noteBlock', {},
      h('h4', {}, '什么时候想到它', h('em', {}, '这几条也是打标时实际用的判断依据')),
      h('ul', {}, note.signals.map((s) => h('li', {}, s)))));
  }
  if (note.template) {
    bodyBox.append(h('div.noteBlock', {},
      h('h4', {}, '模板骨架'),
      h('pre.noteCode', {}, h('code', {}, note.template))));
  }
  if (note.pitfalls?.length) {
    bodyBox.append(h('div.noteBlock', {},
      h('h4', {}, '常见坑'),
      h('ul.noteBlock__warn', {}, note.pitfalls.map((s) => h('li', {}, ...richText(s))))));
  }
  if (note.complexity) {
    bodyBox.append(h('div.noteBlock', {}, h('h4', {}, '复杂度'), h('p', {}, note.complexity)));
  }
  if (note.refs?.length) {
    bodyBox.append(h('div.noteBlock', {},
      h('h4', {}, '延伸阅读', h('em', {}, 'OI-Wiki')),
      h('div.noteRefs', {}, note.refs.map((rf) =>
        h('a.noteRef', { href: rf.url, target: '_blank', rel: 'noreferrer' }, rf.title, ' ↗')))));
  }
  return card;
}

async function viewPlan(host) {
  const opts = state.plan;
  if (!cache.routes) cache.routes = await api('/api/routes');
  if (!cache.topics) cache.topics = await api('/api/topics');
  const topics = cache.topics.topics;

  // 学习计划 = 少数几条主线；106 个专题是练习素材的索引，放在下面当生成器用
  host.append(sectionHead('学习计划', '四条跨专题的主线路线 · 点卡片展开'));
  host.append(h('div.mapGrid', {}, cache.routes.routes.map((rt) => h('button.mapCard', {
    style: { '--catColor': (opts.kind === 'route' && opts.route === rt.id) ? 'var(--accent)' : 'var(--border-strong)' },
    onClick: () => { opts.kind = 'route'; opts.route = rt.id; render(); },
  },
    h('div.mapCard__top', {},
      h('span.mapCard__name', {}, rt.name),
      h('span.mapCard__n', {}, `${rt.done}/${rt.steps}`)),
    h('p.mapCard__desc', {}, rt.tagline),
    h('div.mapCard__subs', {},
      h('span.mapCard__sub', {}, `${rt.steps} 题`),
      h('span.mapCard__sub', {}, `${rt.sections} 个专题`),
      h('span.mapCard__sub', {}, `约 ${Math.round(rt.minutes / 60)} 小时`),
      h('span.mapCard__sub', {}, `易${rt.mix['简单'] || 0} 中${rt.mix['中等'] || 0} 难${rt.mix['困难'] || 0}`),
      rt.dynamic ? h('span.mapCard__sub', { style: { color: 'var(--accent)' } }, '按进度实时生成') : null),
    h('div.mapCard__meter', {}, h('i', { style: { width: `${rt.steps ? (rt.done / rt.steps) * 100 : 0}%` } })),
  ))));

  const groupLabel = { cat: '大类', tag: '子标签', list: '题单' };
  const grouped = { cat: [], tag: [], list: [] };
  topics.forEach((t) => grouped[t.kind]?.push(t));

  const seg = (value, options, onPick) => h('div.seg', {}, options.map(([k, label]) =>
    h('button', { 'aria-pressed': String(value === k), onClick: () => onPick(k) }, label)));

  host.append(h('div.sectionHead', { style: { marginTop: '22px' } },
    h('h2', {}, '专题练习'),
    h('p', {}, '或者挑一个知识点/题单即时生成：13 个大类 · 65 个子标签 · 28 份题单')));
  host.append(h('div.controls', {},
    h('span.controls__label', {}, '专题'),
    h('select', { onChange: (e) => { opts.kind = 'topic'; opts.topic = e.target.value; render(); } },
      Object.entries(grouped).map(([kind, list]) => h('optgroup', { label: groupLabel[kind] },
        list.map((t) => h('option', { value: t.id, selected: opts.topic === t.id }, t.name))))),
    h('button.chip', {
      dataset: { on: String(opts.kind === 'topic') },
      onClick: () => { opts.kind = 'topic'; render(); },
    }, '用这个专题'),
    h('span.controls__label', {}, '模式'),
    seg(opts.mode, [['auto', '默认'], ['minimal', '最小覆盖'], ['full', '完整']],
      (k) => { opts.mode = k; opts.kind = 'topic'; render(); }),
    h('span.controls__label', {}, '难度节奏'),
    seg(opts.pace, [['depth', '重攻坚'], ['balanced', '均衡'], ['coverage', '重覆盖']],
      (k) => { opts.pace = k; opts.kind = 'topic'; render(); }),
    h('button.chip', { dataset: { on: String(opts.all) }, onClick: () => { opts.all = !opts.all; opts.kind = 'topic'; render(); } }, '用全部题池'),
    h('button.chip', { dataset: { on: String(opts.paid) }, onClick: () => { opts.paid = !opts.paid; render(); } }, '含会员题'),
  ));

  const body = h('div', {}, h('div.empty', {}, '正在生成计划…'));
  host.append(body);

  let plan;
  try {
    plan = opts.kind === 'route'
      ? await api('/api/plan', { route: opts.route, paid: opts.paid })
      : await api('/api/plan', {
          topic: opts.topic, mode: opts.mode, pace: opts.pace, all: opts.all, paid: opts.paid,
        });
  } catch (e) {
    clear(body).append(h('div.empty', {}, String(e.message)));
    return;
  }

  const steps = plan.sections.flatMap((s) => s.steps);
  const done = steps.filter((s) => s.problem.done).length;
  const minimal = steps.length < plan.poolSize;
  const core = steps.filter((s) => s.core).length;

  clear(body).append(
    h('div.card.planHead', {},
      h('h2', {}, plan.topic.name, ' · 学习计划'),
      plan.route ? h('p', { style: { color: 'var(--accent)' } }, plan.route.tagline) : null,
      h('p', {}, plan.topic.desc || ''),
      h('div.planHead__bar', {}, h('i', { style: { width: `${steps.length ? (done / steps.length) * 100 : 0}%` } })),
      h('div.planHead__meta', {},
        h('span', {}, plan.route
          ? `${steps.length} 题 · 跨 ${plan.sections.length} 个专题`
          : (minimal
            ? `${plan.poolSize} 题池 → 挑 ${steps.length} 道代表题（覆盖 ${plan.coveragePct}%）`
            : `${steps.length} 题，按 ${plan.sections.length} 个知识点分组（其中 ${core} 道 ★ 代表题）`)),
        h('span', {}, `预计 ${(plan.minutes / 60).toFixed(1)} 小时`),
        h('span', {}, `已完成 ${done}/${steps.length}`)),
      h('div.mixBar', { style: { marginTop: '6px' } },
        h('span', {}, '难度结构 '),
        h('span', { style: { color: 'var(--easy)' } }, `简单 ${plan.mix['简单'] || 0}`),
        h('span', { style: { color: 'var(--medium)' } }, `中等 ${plan.mix['中等'] || 0}`),
        h('span', { style: { color: 'var(--hard)' } }, `困难 ${plan.mix['困难'] || 0}`),
        h('span', {}, `硬技巧 ${plan.sharp} 个`),
        h('span', {}, `节奏 ${PACE_CN[plan.pace] || plan.pace}`)),
      (!plan.route && plan.totalPool > plan.poolSize)
        ? h('p', { style: { marginTop: '8px', fontSize: '11.5px' } },
            `题池取自 ${plan.totalPool} 道同标签题里有面试频次或题单背书的 ${plan.poolSize} 道`)
        : null,
    ),
  );
  if (plan.note) body.append(noteCard(plan.note));

  let n = 0;
  for (const sec of plan.sections) {
    const secCore = sec.steps.filter((s) => s.core).length;
    body.append(h('div.card.dayCard', {},
      h('div.dayCard__head', {},
        h('span.dayCard__n', {}, sec.name),
        h('span.dayCard__focus', {}, sec.desc || ''),
        h('span.dayCard__prog', {}, `${sec.pool} 题池 → ${sec.steps.length} 步`
          + (!minimal && secCore !== sec.steps.length ? `（${secCore} 道代表题）` : ''))),
      // 主线会跨很多专题，所以讲解挂在每一节上：走到哪一节就给那一节的讲解
      (sec.note && (plan.route || plan.sections.length > 1)) ? noteCard(sec.note, { compact: true }) : null,
      sec.steps.map((step) => {
        n += 1;
        const p = step.problem;
        return h('div.stepRow', { dataset: { done: String(p.done) } },
          h('span.stepRow__n', {}, String(n)),
          h('button.check', {
            dataset: { on: String(p.done) },
            title: p.mine.length ? `本地题解：${p.mine.join(', ')}` : '标记为已完成',
            onClick: () => toggleCheckin(p.slug),
          }, '✓'),
          h('span.row__id', {}, p.id, !minimal && step.core ? h('span.stepStar', {}, ' ★') : null),
          h('span', {},
            h('div.stepRow__title', { onClick: () => openProblem(p.slug) }, p.title),
            step.approaches.length ? h('div.stepMeta', {},
              h('span.k', {}, '思路'), step.approaches.join('、'),
              step.newApproaches.length
                ? h('span', {}, ' ', h('span.k', {}, '新增'),
                    h('span.new', {}, step.newApproaches.join('、')))
                : null) : null,
            h('div.stepMeta', {}, h('span.k', {}, '知识点'), step.focus.join('、')),
            h('div.stepMeta', {}, h('span.k', {}, '为什么'), step.reasons.join(' · ')),
            step.covers.length ? h('div.stepMeta', {}, h('span.k', {}, '代表'),
              step.covers.slice(0, 3).map((q) => `#${q.id} ${q.title}`).join('、'),
              step.coversTotal > 3 ? ` 等 ${step.coversTotal} 道` : '') : null),
          h('span', {}, diffPill(p), h('div.apNote', { style: { marginTop: '4px' } }, step.stage)),
          goLink(p),
        );
      })));
  }
}

// --- 详情抽屉 ----------------------------------------------------------------

async function renderDrawer(slug) {
  const host = clear($('#drawerBody'));
  host.append(h('div.empty', {}, '加载中…'));
  let p;
  try {
    p = await api('/api/problem', { slug });
  } catch (e) {
    clear(host).append(h('div.empty', {}, String(e.message)));
    return;
  }
  clear(host);

  host.append(
    h('div.dTitle', {},
      h('span.dTitle__id', {}, `#${p.id}`),
      h('h2', {}, p.title),
      h('button.dTitle__close', { 'data-close': true, title: '关闭 (Esc)' }, '✕')),
    h('div.dMeta', {},
      diffPill(p),
      p.freq ? h('span.pill.pill--hot', {}, `CodeTop 第 ${p.freqRank} 名 · 被面 ${p.freq} 次`) : null,
      p.paid ? h('span.pill.pill--paid', {}, '会员题') : null,
      h('span.chip.chip--static', {}, `通过率 ${Math.round(p.acRate * 100)}%`),
      h('span.chip.chip--static', {}, p.sourceName || p.source),
      p.lists.length ? h('span.chip.chip--static', { title: p.lists.join('、') },
        `收录于 ${p.lists.length} 个题单`) : null),
    h('div.dActions', {},
      h('a.btn.btn--primary', { href: p.url, target: '_blank', rel: 'noreferrer' },
        `去 ${p.sourceName || '平台'} 做题 ↗`),
      h('button.btn', { onClick: () => toggleCheckin(p.slug, true) },
        p.mine.length ? `本地已有 ${p.mine.length} 份题解` : (p.done ? '取消打卡' : '标记已完成')),
      h('span.btn.btn--ghost', { style: { userSelect: 'all' } }, p.url),
    ),
  );

  const fp = p.approachFull || [];
  if (fp.length) {
    const why = p.approachWhy || {};
    const bits = [];
    if (p.codeBlocks) bits.push(`读了 ${p.codeBlocks} 段题解代码`);
    if (Object.keys(why).length) bits.push('自己读了题面和数据范围');
    if (p.solutionSampled) bits.push(`参考 ${p.solutionSampled} 篇题解的说法`);
    const note = bits.length ? bits.join('，') : '没抓到题解也没有题面，只能由官方标签推断';
    const CH = { code: '代码', statement: '题面', solutions: '题解', tags: '标签' };
    const chanText = (from) => {
      const cs = (from || 'tags').split('+');
      return cs.map((c) => CH[c] || c).join('+') + (cs.length > 1 ? ' 印证' : '');
    };
    host.append(h('div.dBlock', {},
      h('div.dBlock__head', {}, h('h3', {}, '题解思路'), h('span', {}, note)),
      fp.map((a) => h('div.apRow', {},
        h('span.apName', { style: { color: DOMAIN_COLOR[a.domain] } }, a.name),
        h('span.apMeter', {}, h('i', {
          style: { width: `${Math.round(a.conf * 100)}%`, background: DOMAIN_COLOR[a.domain] },
        })),
        h('span.apNote', {}, `${Math.round(a.conf * 100)}% · `
          + chanText(a.from) + ` · 区分度 ${a.w}`)))));
    const whyRows = fp.filter((a) => why[a.id]);
    if (whyRows.length) {
      host.append(h('div.dBlock', {},
        h('div.dBlock__head', {}, h('h3', {}, '我为什么这么判'),
          h('span', {}, '读题面 + 数据范围，不看题解')),
        whyRows.slice(0, 5).map((a) => h('div.whyRow', {},
          h('span.whyName', { style: { color: DOMAIN_COLOR[a.domain] } }, a.name),
          h('ul.whyList', {}, why[a.id].map((r) => h('li', {}, r)))))));
    }
  }

  host.append(h('div.dBlock', {},
    h('div.dBlock__head', {}, h('h3', {}, '解法标签'), h('span', {}, `${p.tags.length} 个`)),
    h('div.dMeta', {}, p.tags.map((t) => h('span.chip', {
      style: { color: CAT_COLOR[t.cat] },
      onClick: () => { state.openSlug = null; state.filters.cat = ''; state.filters.tag = t.id; go('problems'); },
    }, t.name))),
    p.tagNames.length ? h('p.tagWhy', {}, `原始标签：${p.tagNames.join('、')}`) : null));

  if (p.similar.length) {
    host.append(h('div.dBlock', {},
      h('div.dBlock__head', {}, h('h3', {}, '相似题'), h('span', {}, '以题解思路为主，官方相似题为锚')),
      p.similar.map((s) => h('div.simRow', { onClick: () => openProblem(s.problem.slug) },
        h('span.row__id', {}, s.problem.id),
        h('span', {},
          h('div.simRow__title', {}, s.problem.title),
          h('div.simRow__why', {}, s.why.map((w) => h('span.chip.chip--static', {}, w)),
            s.problem.done ? h('span.chip.chip--static', { style: { color: 'var(--easy)' } }, '已刷') : null)),
        h('span', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          h('span', {}, diffPill(s.problem)),
          h('span.simRow__score', {}, `相似 ${Math.round(s.score * 100)}`),
          goLink(s.problem))))));
  }

  if (p.content) {
    host.append(h('div.dBlock', {},
      h('div.dBlock__head', {}, h('h3', {}, '题面'), h('span', {}, 'leetcode.cn')),
      h('div.statement', { html: p.content })));
  }

  if (p.files.length) {
    const pre = h('pre.codeBox', {}, p.files[0].code || '（读取失败）');
    const tabs = h('div.codeTabs', {}, p.files.map((f, i) => h('button.btn.btn--sm', {
      dataset: { on: String(i === 0) },
      onClick: (e) => {
        [...tabs.children].forEach((b) => { b.dataset.on = 'false'; });
        e.currentTarget.dataset.on = 'true';
        pre.textContent = f.code || '（读取失败）';
      },
    }, `${f.lang} · ${f.path}`)));
    host.append(h('div.dBlock', {},
      h('div.dBlock__head', {}, h('h3', {}, '我的题解'), h('span', {}, p.files.map((f) => f.path).join(' · '))),
      tabs, pre));
  }

  $('#drawerBody').scrollTo({ top: 0 });
}

// --- 交互 --------------------------------------------------------------------

function openProblem(slug) {
  state.openSlug = slug;
  $('#drawer').hidden = false;
  renderDrawer(slug);
}

function closeDrawer() {
  state.openSlug = null;
  $('#drawer').hidden = true;
  clear($('#drawerBody'));
}

async function toggleCheckin(slug, keepDrawer) {
  await fetch('/api/checkin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  });
  cache.meta = await api('/api/meta');
  cache.lists = null;
  cache.approaches = null;
  cache.routes = null;
  await render();
  if (keepDrawer && state.openSlug) renderDrawer(state.openSlug);
}

function go(view) {
  state.view = view;
  state.limit = 60;
  location.hash = view;
  render();
}

const RENDERERS = {
  overview: viewOverview, problems: viewProblems, topics: viewTopics,
  approaches: viewApproaches, lists: viewLists, plan: viewPlan,
};

async function render() {
  const nav = clear($('#viewNav'));
  for (const [id, label, icon] of VIEWS) {
    nav.append(h('button.navItem', {
      'aria-current': String(state.view === id),
      onClick: () => go(id),
    }, h('span', {}, icon), h('span', {}, label)));
  }

  const scale = clear($('#scale'));
  for (const c of cache.meta.cats) {
    const color = CAT_COLOR[c.id] || '#8fa3b8';
    const active = state.view === 'problems' && state.filters.cat === c.id;
    scale.append(h('li.scale__row', {
      dataset: { active: String(active) },
      style: { '--catColor': color },
      title: `${c.name}：${c.subs.length} 个标签，${c.total} 题`,
      onClick: () => {
        state.filters.cat = active ? '' : c.id;
        state.filters.tag = '';
        go('problems');
      },
    },
      h('i.scale__tick'),
      h('span.scale__label', {},
        h('span.scale__name', {}, c.name),
        h('span.scale__meter', {}, h('i', { style: { width: `${c.total ? (c.done / c.total) * 100 : 0}%` } }))),
      h('span.scale__num', {}, `${c.done}/${c.total}`)));
  }

  const pr = cache.meta.progress;
  clear($('#topStats')).append(
    h('span', {}, '已刷 ', h('b', {}, String(pr.done)), ` / ${pr.total}`),
    h('span', {}, '高频 ', h('b', {}, String(pr.hotDone)), ` / ${pr.hotTotal}`),
    h('span', {}, '题库 ', h('b', {}, String(cache.meta.meta.stats.total))),
  );

  const view = clear($('#view'));
  try {
    await (RENDERERS[state.view] || viewOverview)(view);
  } catch (e) {
    view.append(h('div.empty', {}, `出错了：${e.message}`));
  }
}

function wire() {
  const search = $('#search');
  let timer = 0;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = search.value;
      state.limit = 60;
      if (state.q && state.view !== 'problems') { state.view = 'problems'; location.hash = 'problems'; }
      render();
    }, 180);
  });
  $('#drawer').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeDrawer();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.openSlug) { closeDrawer(); return; }
    if (e.key === '/' && document.activeElement !== search) {
      e.preventDefault(); search.focus(); search.select();
    }
  });
  window.addEventListener('hashchange', () => {
    const v = location.hash.replace('#', '');
    if (RENDERERS[v] && v !== state.view) { state.view = v; render(); }
  });
}

(async function start() {
  const bootText = $('#bootText');
  try {
    bootText.textContent = '正在读取题库与标签体系…';
    cache.meta = await api('/api/meta');
  } catch (e) {
    bootText.textContent = `装载失败：${e.message}。先跑 ./sinan sync 生成数据`;
    return;
  }
  const hash = location.hash.replace('#', '');
  if (RENDERERS[hash]) state.view = hash;
  state.plan.pace = cache.meta.defaultPace || 'depth';

  wire();
  $('#boot').hidden = true;
  $('#app').hidden = false;
  await render();

  clear($('#railFoot')).append(
    h('div', {}, `数据 ${cache.meta.meta.builtAt}`),
    h('div', {}, cache.meta.meta.sources.map((s) => `${s.name} ${s.count}`).join(' + ')),
    h('div', { style: { color: 'var(--faint)' } },
      (cache.meta.meta.overlays || []).map((s) => `${s.name} ${s.count}`).join(' · ')),
  );
}());
