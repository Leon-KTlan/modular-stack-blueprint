(() => {
  'use strict';
  const theme = document.body.dataset.theme;
  const embedded = new URLSearchParams(location.search).has('embed');
  if (embedded) document.body.classList.add('embedded');
  const themes = {
    forest: { key: 'A', name: '林间小门', file: 'a.html', eyebrow: 'A LITTLE ROOM FOR YOU', title: '有些话，<br>可以说给风听。', lead: '开心也好，低落也好。<br>进来坐坐，不必整理好心情。', enter: '推开这扇小门', feed: '林间的声音', feedSub: '偶然遇见的文字，也可以轻轻接住。', symbol: '✳', mine: '我留在林间的话', summary: '将“进入”变成一次轻轻推门。留白、木纹和舒展的叶子，让匿名空间更亲近。', emphasis: '入口有记忆点，帖子保持清楚易读。最适合接回现有小程序的自然色系。', slogans: ['不必每一天都很棒', '今天，也可以慢慢来', '把心事放下，把善意留下'] },
    night: { key: 'B', name: '午夜电台', file: 'b.html', eyebrow: 'ON AIR · JUST BETWEEN US', title: '世界很吵，<br>这里听你慢慢说。', lead: '留一盏灯，给还没说出口的话。<br>此刻的你，不需要一个真实姓名。', enter: '走进这片夜色', feed: '夜色里的回声', feedSub: '一段文字，一次不署名的相遇。', symbol: '<svg width="44" height="34" viewBox="0 0 44 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 14v6m7-11v16m7-21v26m7-18v10m7-15v20m7-14v8"/></svg>', mine: '我留下的回声', summary: '把树洞想象成深夜亮着灯的小电台。深蓝、微光与细线，营造更私密的倾诉氛围。', emphasis: '更适合深夜阅读。正文采用平铺分隔，弱化卡片，让每句话拥有自己的停顿。', slogans: ['不开心也可以来', '这里不急着给答案', '今夜，听见彼此'] },
    paper: { key: 'C', name: '心事邮局', file: 'c.html', eyebrow: '心 事 邮 局 · 今日营业', title: '寄存一点心事，<br>不必留下姓名。', lead: '有的快乐想分享，有的烦恼想放下。<br>这里收下每一个认真生活的你。', enter: '走进心事邮局', feed: '今天的匿名来信', feedSub: '信会到期，收到的善意可以留久一点。', symbol: '阅', mine: '我寄出的心事', summary: '把匿名文字变成一封短暂的来信。奶油纸、朱红邮戳和投信口，更轻松、更有校园感。', emphasis: '入口与帖子共用纸张语言。把“到期”变成来信的期限，避免做成沉重的情绪档案。', slogans: ['不署名，也被认真读到', '快乐烦恼，都可以投递', '此处收下，所有小小心事'] }
  };
  const t = themes[theme];
  const iconPaths = {
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', back: '<path d="m14 5-7 7 7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    heart: '<path d="M20.5 5.8c-2-2.1-5.1-1.8-8.5 1.5-3.4-3.3-6.5-3.6-8.5-1.5-4.2 4.4 2.8 10 8.5 14.2 5.7-4.2 12.7-9.8 8.5-14.2Z"/>',
    comment: '<path d="M20 11a8 8 0 0 1-8 8H4l1.4-4A8 8 0 1 1 20 11Z"/>', more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    leaf: '<path d="M19 4C8 2 2 9 6 15s15 4 13-11Z"/><path d="M5 21 16 8"/>', home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>', check: '<path d="m5 12 4 4L19 6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>', moon: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>'
  };
  const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.leaf}</svg>`;
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const state = {
    view: 'landing', scenario: 'normal', tab: 'posts', selected: 'p1', replyTarget: null, returnView: 'feed', appealSent: false,
    draft: '', draftTtl: '24', nextId: 1,
    posts: [
      { id: 'p1', name: '一颗慢慢发芽的种子', time: '12 分钟前', expires: '还剩 23 小时', content: '今天终于鼓起勇气，一个人去吃了火锅。\n原来好好陪自己，也是一件很厉害的事。', likes: 28, liked: false, comments: [
        { id: 'r1', name: '路过的晚风', content: '一个人的快乐也很具体！下次想试试一个人去看海。', op: false },
        { id: 'r2', name: '一颗慢慢发芽的种子', content: '是的，慢慢把想做的事情都做一遍。', op: true }
      ] },
      { id: 'p2', name: '口袋里的一片云', time: '28 分钟前', expires: '还剩 5 小时', content: '好像大家都有很清晰的计划，只有我还在找方向。\n可以先允许自己，走得慢一点吗？', likes: 42, liked: false, comments: [{ id: 'r3', name: '一只纸飞机', content: '可以的。我也还在找，我们都不用急着交卷。', op: false }] },
      { id: 'p3', name: '山坡上的月亮', time: '1 小时前', expires: '还剩 11 小时', content: '今天的风很舒服，在操场多走了两圈。\n没有什么大事发生，也算是不错的一天。', likes: 16, liked: false, comments: [] }
    ],
    mine: [
      { id: 'm1', content: '傍晚绕了远路回宿舍，刚好看见很漂亮的晚霞。', status: 'published', ttl: '24', expires: '还剩 7 小时', note: '公开中 · 仅自己可管理' },
      { id: 'm2', content: '最近总是在想，慢一点是不是也没有关系。', status: 'pending', ttl: '6', note: '等待审核 · 暂未公开' }
    ],
    myComments: [{ id: 'mc1', content: '慢慢找也没关系，我也在路上。', status: 'published', note: '所属帖子还剩 5 小时' }]
  };
  const scenarioOptions = '<option value="normal">正常体验</option><option value="empty">空内容状态</option><option value="restricted">受限与申诉</option>';
  document.getElementById('prototype').innerHTML = `
    <div class="mobile-prototype-bar"><a href="index.html">← 三版比较 · ${t.key}</a><span>交互样板 / 未接入后端</span><select aria-label="手机演示状态" data-scenario>${scenarioOptions}</select></div>
    <div class="prototype-layout">
      <aside class="design-rail"><div class="eyebrow">CANGQIONG / TREEHOLE</div><h1>${t.name}</h1><p>${t.summary}</p><nav class="version-links" aria-label="切换设计方向">${Object.values(themes).map(v => `<a class="${v.key === t.key ? 'current' : ''}" href="${v.file}" aria-label="${v.key} ${v.name}">${v.key}</a>`).join('')}</nav><p>点击入口开始。可浏览帖子、点赞、评论、提交投稿，以及管理自己的内容。</p><div class="stage-controls"><label for="scenario">演示状态（不属于正式界面）</label><select id="scenario" data-scenario>${scenarioOptions}</select><div class="view-switch"><button data-go="landing">入口</button><button data-go="feed">帖子</button><button data-go="mine">我的</button></div></div><a class="back-link" href="index.html">← 返回三版并排比较</a></aside>
      <main class="phone ${theme}" aria-label="${t.name}小程序界面样板"><div class="statusbar" aria-hidden="true"><span>9:41</span><span class="status-icons">▴▴▴ ◔ <i class="battery"></i></span></div><div id="mini-nav" class="mini-nav"></div><div class="scene-badge">界面样板 · 内容及操作均为本地演示</div><div id="screen" class="screen"></div><div id="dock"></div><div class="home-indicator" aria-hidden="true"></div><div id="modal-root"></div><div id="toast-root" role="status" aria-live="polite"></div></main>
      <aside class="design-aside"><div class="number">0${{ A: 1, B: 2, C: 3 }[t.key]}</div><h3>先走进来，再说点什么</h3><p>${t.emphasis}</p><hr><h3>“我的”是管理入口</h3><p>只保留尚未消失的内容和审核状态。过期内容不归档，不形成匿名个人主页。</p><hr><p>三版交互相同，视觉不同。<br>纯文字 / 同帖固定昵称<br>到期消失 / 允许负面情绪</p></aside>
    </div>`;
  const screen = document.getElementById('screen');
  const phone = document.querySelector('.phone');
  const modalRoot = document.getElementById('modal-root');
  let modalOpener = null;
  let toastTimer;
  const selectedPost = () => state.posts.find(p => p.id === state.selected) || state.posts[0];
  function art() {
    if (theme === 'forest') return `<svg class="portal-art" viewBox="0 0 240 300" aria-hidden="true"><ellipse cx="122" cy="279" rx="95" ry="8" fill="#dce3ca"/><path d="M39 266V115a82 82 0 0 1 164 0v151" fill="#dde5ce" stroke="#c5d1b3"/><path d="M50 267V115a71 71 0 0 1 142 0v152" fill="#c0cda9"/><path d="M62 267V117a59 59 0 0 1 118 0v150" fill="#8fa581"/><path d="M74 267V119a47 47 0 0 1 94 0v148" fill="#4d7050"/><path d="M85 267V120a36 36 0 0 1 72 0v147" fill="#234733"/><path d="M105 267V135q0-27 20-35v167" fill="#efdfab"/><path d="m125 100 27 16v151h-27Z" fill="#a9b989"/><circle cx="144" cy="191" r="2.5" fill="#f5edcb"/><path d="M106 267 73 287h116l-37-20" fill="#e9e3c7"/><path d="M45 265C37 217 12 205 5 169c26 0 51 20 40 96Z" fill="#638363"/><path d="M45 265C62 226 65 200 58 181c-26 16-33 49-13 84Z" fill="#9aaf83"/><path d="M192 266c7-31 25-48 42-56 4 29-20 49-42 56Z" fill="#7c986a"/><path d="M193 266c-13-29-12-48-2-67 18 14 20 36 2 67Z" fill="#b5c19a"/><path d="M24 90h12m-6-6v12M194 48h14m-7-7v14" stroke="#bb9b58" stroke-width="1.5"/><circle cx="211" cy="161" r="2" fill="#b1be96"/></svg>`;
    if (theme === 'night') return `<svg class="portal-art" viewBox="0 0 240 300" aria-hidden="true"><circle cx="120" cy="145" r="106" fill="none" stroke="#37464b"/><circle cx="120" cy="145" r="87" fill="none" stroke="#37464b" stroke-dasharray="2 8"/><path d="m112 54 27-33" stroke="#adbdbe" stroke-width="2"/><circle cx="140" cy="20" r="3" fill="#e8d097"/><rect x="50" y="53" width="140" height="213" rx="48" fill="#2d4047" stroke="#55686b"/><rect x="63" y="66" width="114" height="187" rx="37" fill="#15232a" stroke="#627374"/><path d="M76 242V124a44 44 0 0 1 88 0v118" fill="#d8c69b"/><path d="M88 242V127a32 32 0 0 1 64 0v115" fill="#f1dfac"/><path d="M108 242V135a21 21 0 0 1 27-21v128" fill="#b69f6d"/><path d="m135 114 17 14v114h-17" fill="#7c7e64"/><circle cx="144" cy="191" r="2" fill="#f3dfac"/><path d="m90 254-28 31h116l-28-31" fill="#d4c08c" opacity=".12"/><rect x="92" y="66" width="57" height="15" rx="7" fill="#17272d"/><circle cx="102" cy="73" r="2" fill="#e4c582"/><text x="112" y="76" fill="#dcccaa" font-size="6" letter-spacing="1">ON AIR</text><path d="M15 139h5m-2.5-2.5v5M208 81h8m-4-4v8M196 253h6m-3-3v6" stroke="#d9c38b"/><circle cx="34" cy="42" r="1.7" fill="#a5b8b9"/><circle cx="212" cy="191" r="1.4" fill="#a5b8b9"/></svg>`;
    return `<svg class="portal-art" viewBox="0 0 240 300" aria-hidden="true"><ellipse cx="125" cy="280" rx="93" ry="6" fill="#d7c9ac" opacity=".5"/><g transform="rotate(-5 120 160)"><rect x="48" y="71" width="150" height="196" rx="4" fill="#b7533a"/><rect x="57" y="80" width="132" height="178" rx="2" fill="#bf644b" stroke="#e8a785"/><path d="M66 101h114" stroke="#e49b7a"/><text x="123" y="130" text-anchor="middle" font-size="21" font-family="serif" fill="#ffedcf" letter-spacing="5">心事邮局</text><rect x="69" y="153" width="109" height="15" rx="6" fill="#723e31"/><path d="M73 157h100" stroke="#572f27" stroke-width="2"/><rect x="89" y="189" width="70" height="47" rx="3" fill="#ab4934" stroke="#dc8c6a"/><text x="124" y="207" text-anchor="middle" fill="#ffe4c1" font-size="8" letter-spacing="1">不必署名</text><text x="124" y="222" text-anchor="middle" fill="#efbd97" font-size="7">每一封都值得被读到</text></g><g transform="rotate(9 127 112)"><path d="M78 96h99v59H78Z" fill="#fff7df" stroke="#d4b894"/><path d="m78 97 50 35 49-35M78 155l32-30m67 30-32-30" fill="none" stroke="#d4b894"/><rect x="151" y="102" width="17" height="20" fill="#d5dcc0"/><path d="m155 116 4-9 5 9" stroke="#7c936b" fill="none"/></g><g transform="rotate(-14 36 51)" fill="none" stroke="#b65a3d"><circle cx="36" cy="51" r="24"/><circle cx="36" cy="51" r="20" stroke-dasharray="1 3"/><path d="M23 50h26M25 55h22"/></g><path d="M204 192h16m-8-8v16" stroke="#bba47d"/><path d="M25 217h8m-4-4v8" stroke="#bba47d"/></svg>`;
  }
  function header() {
    const isLanding = state.view === 'landing';
    document.getElementById('mini-nav').innerHTML = `<div class="mini-brand">${isLanding ? icon(theme === 'night' ? 'moon' : theme === 'paper' ? 'mail' : 'leaf') : '<button class="back" data-action="back" aria-label="返回">' + icon('back') + '</button>'}<span>${({ landing: '树洞', feed: '树洞', detail: '一段心事', mine: '我的树洞', penalties: '处罚与申诉', restricted: '树洞' })[state.view]}</span></div><div class="capsule" aria-hidden="true"><span>•••</span><span>◉</span></div>`;
  }
  function footer() {
    const dock = document.getElementById('dock');
    phone.querySelector('.floating-tools')?.remove();
    if (state.view === 'landing') dock.innerHTML = `<nav class="app-nav" aria-label="小程序主导航"><button data-action="outside">${icon('home')}<span>首页</span></button><button class="active" data-go="landing" aria-current="page">${icon('leaf')}<span>树洞</span></button><button data-action="outside">${icon('comment')}<span>消息</span></button><button data-go="mine">${icon('person')}<span>我的</span></button></nav>`;
    else if (state.view === 'detail') dock.innerHTML = `<div class="reply-dock"><button data-action="comment">${icon('comment')}　留一句善意的回应…</button></div>`;
    else if (state.view === 'feed') dock.innerHTML = `<div class="feed-dock"><span>慢慢说，认真听。<small>文字短暂，善意长留。</small></span><div class="floating-tools"><button data-go="mine" aria-label="我的树洞">${icon('person')}<span>我的</span></button><button class="compose-fab" data-action="compose" aria-label="发布自己的帖子">${icon('plus')}</button></div></div>`;
    else dock.innerHTML = '';
  }
  function landing() {
    return `<section class="landing"><div class="intro-label">${t.eyebrow}</div><h1>${t.title}</h1><p class="lead">${t.lead}</p><div class="portal-stage"><span class="slogan s1">${t.slogans[0]}</span><span class="slogan s2">${t.slogans[1]}</span><button class="portal-button" data-go="feed" aria-label="进入树洞">${art()}</button><span class="slogan s3">${t.slogans[2]}</span></div><button class="enter-button" data-go="feed">${t.enter}${icon('arrow')}</button><div class="landing-foot"><span>对彼此匿名</span><span>最长 24 小时后消失</span></div><button class="quiet-link" data-action="rules">进门前的小约定</button></section>`;
  }
  function postCard(p, detail = false) {
    return `<article class="post"><div class="post-head"><span class="anon-dot" aria-hidden="true"></span><span class="post-name">${esc(p.name)}</span><span class="post-expiry">${icon('clock')}${p.expires}</span></div>${detail ? '<p class="post-body">' : `<button class="post-body" data-action="detail" data-id="${p.id}" aria-label="阅读${esc(p.name)}的帖子">`}${esc(p.content)}${detail ? '</p>' : '</button>'}<div class="post-divider"></div><div class="post-actions"><button class="${p.liked ? 'liked' : ''}" data-action="like" data-id="${p.id}" aria-label="${p.liked ? '取消点赞' : '点赞'}" aria-pressed="${p.liked}">${icon('heart')}<span>${p.likes}</span></button><button data-action="detail" data-id="${p.id}" aria-label="查看评论">${icon('comment')}<span>${p.comments.length} 条回应</span></button><button class="report" data-action="report" data-id="${p.id}" aria-label="举报此帖">${icon('more')}</button></div></article>`;
  }
  function empty(title, copy, action = '') { return `<div class="empty">${icon('leaf')}<h2>${title}</h2><p>${copy}</p>${action}</div>`; }
  function feed() {
    return `<section class="feed-top"><div class="eyebrow">${theme === 'paper' ? 'LETTERS WITHOUT A NAME' : theme === 'night' ? 'TUNE IN TO A QUIETER WORLD' : 'SOME WORDS, SOME COMPANY'}</div><div class="feed-title-row"><h1>${t.feed}</h1><span class="feed-symbol" aria-hidden="true">${t.symbol}</span></div><p>${t.feedSub}</p></section><div class="feed-sort"><strong>最新心事</strong><span>按发布时间 · 到期即消失</span></div>${state.scenario === 'empty' ? empty('此刻，林间很安静', '还没有正在展示的心事。<br>你可以留下今天的第一句话。', '<button class="enter-button" data-action="compose">写下一点心事</button>') : `<div class="post-list">${state.posts.map(p => postCard(p)).join('')}<p class="end-note">读到这里，就歇一会儿吧。<br>每一段心事，都有自己的停留时间。</p></div>`}`;
  }
  function detail() {
    const p = selectedPost();
    return `<section class="detail-head">${postCard(p, true)}<p class="end-note">${p.time}发布 · 同一帖子内昵称固定</p></section><section class="comments"><div class="section-label"><strong>回应 ${p.comments.length}</strong><span class="muted">善意，比答案更重要</span></div>${p.comments.map(c => `<article class="comment"><div class="post-head"><span class="anon-dot"></span><span class="post-name">${esc(c.name)}</span>${c.op ? '<span class="op-label">楼主</span>' : ''}</div><p>${esc(c.content)}</p><button class="reply-button" data-action="reply" data-id="${c.id}">回复</button></article>`).join('') || '<p class="end-note">还没有回应，留下一句善意的话吧。</p>'}</section>`;
  }
  function mine() {
    const records = state.scenario === 'normal' ? state.tab === 'posts' ? state.mine : state.myComments : [];
    return `<section class="mine-intro"><div class="eyebrow">ONLY YOU CAN SEE THIS</div><h1>${t.mine}</h1><p>管理仍在这里的文字。<br>到期或删除后，这里也不会留下记录。</p><span class="private-tag">${icon('lock')}仅自己可见 · 不是公开主页</span></section><div class="mine-tabs" role="tablist" aria-label="本人内容类型"><button role="tab" aria-selected="${state.tab === 'posts'}" class="${state.tab === 'posts' ? 'active' : ''}" data-tab="posts">我的帖子</button><button role="tab" aria-selected="${state.tab === 'comments'}" class="${state.tab === 'comments' ? 'active' : ''}" data-tab="comments">我的评论</button></div><div class="mine-list" role="tabpanel">${records.map(m => `<article class="mine-card"><div class="mine-status"><span class="${m.status === 'pending' ? 'pending' : ''}">${m.status === 'pending' ? '待审核' : '公开中'}</span><span>${m.expires || (state.tab === 'comments' ? '随原帖到期' : m.status === 'pending' ? '通过后展示 ' + m.ttl + ' 小时' : '随原帖到期')}</span></div><p>${esc(m.content)}</p><footer><span>${m.note}</span><button data-action="delete" data-id="${m.id}">${m.status === 'pending' ? '取消投稿' : '删除'}</button></footer></article>`).join('') || empty('这里暂时没有内容', state.scenario === 'restricted' ? '受限后，既有帖子和评论已隐藏。<br>正常解封不会恢复旧内容。' : '已过期的心事不会留在这里。<br>想说的话，可以重新开始。')}</div><button class="account-link" data-go="penalties">${icon('shield')}<span>树洞处罚与申诉<small>${state.scenario === 'restricted' ? '有一项限制 · 查看原因和申诉' : '查看处理通知、原因及申诉进度'}</small></span>${icon('arrow')}</button><p class="end-note">这一入口也保留在小程序个人中心。<br>树洞受限时，仍可查看处罚并申诉。</p>`;
  }
  function restrictionInfo() {
    return `<div class="notice-card"><h3>树洞使用限制 · 示例</h3><dl><dt>原因</dt><dd>在评论中对其他用户进行明确辱骂</dd><dt>受限能力</dt><dd>进入、浏览和使用整个树洞</dd><dt>结束时间</dt><dd>2026 年 10 月 25 日 09:41</dd><dt>申诉截止</dt><dd>2026 年 11 月 23 日 09:41</dd></dl></div>`;
  }
  function restricted() { return `<section class="restriction">${icon('lock')}<h1>暂时不能<br>进入树洞。</h1><p>你的树洞使用权限正在限制中。<br>其他社区功能不受影响。</p>${restrictionInfo()}<button class="enter-button" data-go="penalties">查看处罚与申诉${icon('arrow')}</button><button class="quiet-link" data-go="mine">前往我的内容管理</button></section>`; }
  function penalties() {
    if (state.scenario !== 'restricted') return `<section class="mine-intro"><div class="eyebrow">NOTICES & APPEALS</div><h1>处罚与申诉</h1><p>有处理结果时，我们会在这里说明原因。</p></section>${empty('目前没有处罚记录', '友善表达，也允许不同的心情。<br>这里不会展示内部违规分数。')}`;
    return `<section class="restriction"><h1>处罚与申诉</h1><p>如认为处理有误，可以说明情况。<br>申诉期间，原限制仍然生效。</p>${restrictionInfo()}<div class="notice-card"><h3>${state.appealSent ? '申诉已提交 · 待处理' : '关于这次处理'}</h3><p>${state.appealSent ? '管理员目标在 72 小时内处理。处理结果会显示在这里，请稍后回来查看。' : '仅展示与本人处罚有关的必要信息，不提供已隐藏原帖的浏览入口。'}</p></div><button class="enter-button" data-action="appeal" ${state.appealSent ? 'disabled' : ''}>${state.appealSent ? '正在等待处理' : '提交申诉'}</button></section>`;
  }
  function render(keepScroll = false) {
    const top = screen.scrollTop;
    header();
    screen.innerHTML = ({ landing, feed, detail, mine, penalties, restricted })[state.view]();
    footer();
    screen.scrollTop = keepScroll ? top : 0;
  }
  function go(view) {
    if (state.scenario === 'restricted' && ['feed', 'detail'].includes(view)) view = 'restricted';
    if (view === 'mine') state.returnView = ['feed', 'detail'].includes(state.view) ? 'feed' : 'landing';
    closeModal(false);
    state.view = view;
    render();
  }
  function toast(message) {
    clearTimeout(toastTimer);
    document.getElementById('toast-root').innerHTML = `<div class="toast">${esc(message)}</div>`;
    toastTimer = setTimeout(() => document.getElementById('toast-root').replaceChildren(), 3000);
  }
  function openModal(title, content) {
    modalOpener = document.activeElement;
    modalRoot.innerHTML = `<div class="overlay"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1"><div class="sheet-header"><h2 id="sheet-title">${title}</h2><button data-action="close" aria-label="关闭弹窗">×</button></div>${content}</section></div>`;
    screen.inert = true;
    document.getElementById('mini-nav').inert = true;
    document.getElementById('dock').inert = true;
    phone.querySelector('.floating-tools')?.setAttribute('inert', '');
    modalRoot.querySelector('.sheet').focus();
  }
  function closeModal(restore = true) {
    modalRoot.replaceChildren();
    screen.inert = false;
    document.getElementById('mini-nav').inert = false;
    document.getElementById('dock').inert = false;
    phone.querySelector('.floating-tools')?.removeAttribute('inert');
    if (restore && modalOpener?.isConnected) modalOpener.focus();
  }
  function compose(isComment = false) {
    if (state.scenario === 'restricted') return go('restricted');
    const max = isComment ? 500 : 1000;
    const reply = isComment && state.replyTarget ? selectedPost().comments.find(c => c.id === state.replyTarget) : null;
    openModal(isComment ? '留下一句回应' : '留下一点心事', `<form id="compose-form" data-kind="${isComment ? 'comment' : 'post'}"><p>${reply ? '回复「' + esc(reply.name) + '」' : '对其他用户匿名，平台按规则审核。'}<br>${isComment ? '你的昵称在这篇帖子内保持不变。' : '每篇帖子使用独立昵称，不展示真实资料。'}</p><textarea id="draft" aria-label="${isComment ? '评论内容' : '帖子内容'}" placeholder="${isComment ? '说一句善意的话，不急着替对方下结论。' : '不用想好开场白。\n就从此刻的心情开始吧。'}">${isComment ? '' : esc(state.draft)}</textarea><div class="counter"><span>仅限文字 · 请勿透露他人隐私</span><span id="count">${isComment ? 0 : [...state.draft.trim()].length} / ${max}</span></div>${isComment ? '<p class="footnote">回应随原帖到期消失。需要审核时，暂不公开。</p>' : `<label class="ttl-label">通过审核后，想让它停留多久？</label><div class="ttl-options" role="group" aria-label="帖子展示时长">${[1, 6, 12, 24].map(h => `<label><input type="radio" name="ttl" value="${h}" ${String(h) === state.draftTtl ? 'checked' : ''}><span>${h} 小时</span></label>`).join('')}</div><p class="footnote">从首次公开开始计时，到期后也会从“我的”消失。公开后不支持编辑，可以主动删除。</p>`}<div class="form-error" id="form-error" role="alert"></div><button type="submit" class="enter-button">${isComment ? '提交回应' : '匿名提交'}${icon('arrow')}</button><p class="footnote">本样板演示“待审核”分支；文字只留在本页面，刷新即重置。</p></form>`);
    const input = document.getElementById('draft');
    input.addEventListener('input', () => {
      const length = [...input.value.trim()].length;
      document.getElementById('count').textContent = `${length} / ${max}`;
      document.getElementById('form-error').textContent = length > max ? `请将正文控制在 ${max} 字以内。` : '';
      if (!isComment) state.draft = input.value;
    });
    modalRoot.querySelectorAll('input[name=ttl]').forEach(r => r.addEventListener('change', () => state.draftTtl = r.value));
  }
  function submitComposition(form) {
    const isComment = form.dataset.kind === 'comment';
    const content = form.querySelector('textarea').value.trim();
    const length = [...content].length;
    if (!length || length > (isComment ? 500 : 1000)) { document.getElementById('form-error').textContent = length ? '字数超过限制，请精简后再提交。' : '先写下一点想说的话吧。'; return; }
    const entry = { id: `local-${state.nextId++}`, content, status: 'pending', note: '等待审核 · 暂未公开', ttl: state.draftTtl };
    if (isComment) { entry.note = '等待审核 · 随原帖到期'; state.myComments.unshift(entry); }
    else { state.mine.unshift(entry); state.draft = ''; state.draftTtl = '24'; }
    state.scenario = 'normal';
    syncScenario();
    closeModal(false);
    openModal('投稿回执', `<div class="success-copy"><div class="success-mark">${icon('check')}</div><h2>已收下，正在审核。</h2><p>现在只有你能看到这段文字。<br>通过后才会公开${isComment ? '，并随原帖到期消失' : '，再开始计算展示时间'}。</p><button class="enter-button" data-action="receipt-mine" data-kind="${isComment ? 'comments' : 'posts'}">去“我的”查看</button><button class="enter-button secondary" data-action="close">继续逛逛</button><p class="footnote">未公开投稿超过 24 小时仍未通过，会关闭。<br>演示状态不会自动变为审核通过。</p></div>`);
  }
  function syncScenario() { document.querySelectorAll('[data-scenario]').forEach(el => el.value = state.scenario); }
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-scenario]')) return;
    state.scenario = event.target.value;
    syncScenario();
    go(state.scenario === 'restricted' ? 'restricted' : 'feed');
  });
  document.addEventListener('click', event => {
    if (event.target.classList.contains('overlay')) { closeModal(); return; }
    const el = event.target.closest('button');
    if (!el || el.disabled) return;
    if (el.dataset.go) { go(el.dataset.go); return; }
    if (el.dataset.tab) { state.tab = el.dataset.tab; render(); return; }
    const { action, id } = el.dataset;
    if (action === 'back') go(state.view === 'detail' ? 'feed' : state.view === 'penalties' ? 'mine' : state.view === 'mine' ? state.returnView : 'landing');
    if (action === 'outside') toast('这里仅演示树洞流程；其他页面保留现有设计。');
    if (action === 'close') closeModal();
    if (action === 'detail') { state.selected = id; go('detail'); }
    if (action === 'like') {
      const p = state.posts.find(post => post.id === id);
      p.liked = !p.liked; p.likes += p.liked ? 1 : -1;
      el.classList.toggle('liked', p.liked); el.setAttribute('aria-pressed', String(p.liked));
      el.setAttribute('aria-label', p.liked ? '取消点赞' : '点赞'); el.querySelector('span').textContent = p.likes;
    }
    if (action === 'compose') compose();
    if (action === 'comment' || action === 'reply') { state.replyTarget = action === 'reply' ? id : null; compose(true); }
    if (action === 'receipt-mine') { state.tab = el.dataset.kind; go('mine'); }
    if (action === 'rules') openModal('进门前的小约定', `<p>这里欢迎分享，也接得住不开心。</p><ul class="rules-list"><li>对其他用户匿名，同帖昵称固定，跨帖独立。平台仍保存账号关联以执行治理。</li><li>允许倾诉、抱怨和合理批评。请勿辱骂、威胁、骚扰或泄露他人隐私。</li><li>只发文字。帖子最长公开 24 小时，到期后本人也无法继续查看。</li><li>提交不一定立即公开；需要审核的内容可在“我的”查看状态。</li></ul><button class="enter-button" data-go="feed">知道了，进去看看${icon('arrow')}</button>`);
    if (action === 'delete') openModal('让这段文字离开？', `<p>删除后不再展示，也不会保留在“我的”里。<br>此操作不返还投稿次数。</p><button class="enter-button" data-action="confirm-delete" data-id="${id}">确认删除</button><button class="enter-button secondary" data-action="close">再想一下</button>`);
    if (action === 'confirm-delete') { state.mine = state.mine.filter(m => m.id !== id); state.myComments = state.myComments.filter(m => m.id !== id); closeModal(false); render(true); toast('已从本地演示内容中移除'); }
    if (action === 'report') openModal('举报这段内容', `<form id="report-form"><p>举报会交给审核处理，不会按举报人数直接认定违规。</p><label for="report-reason" class="ttl-label" style="margin-top:18px">举报原因</label><select id="report-reason" required><option value="">请选择原因</option><option>辱骂或人身攻击</option><option>骚扰</option><option>泄露隐私</option><option>威胁</option><option>有争议的事实指控</option><option>其他</option></select><textarea aria-label="举报补充说明" placeholder="补充说明（选填，最多 500 字；其他原因必填）" maxlength="500"></textarea><div class="form-error" id="report-error" role="alert"></div><button type="submit" class="enter-button">提交举报</button></form>`);
    if (action === 'appeal') openModal('说明你的情况', `<form id="appeal-form"><p>请说明认为处理有误的原因。<br>不需要再次附上他人的身份或隐私信息。</p><textarea aria-label="申诉说明" placeholder="写下需要管理员重新考虑的事实…" maxlength="1000"></textarea><div class="form-error" id="appeal-error" role="alert"></div><button type="submit" class="enter-button">提交申诉</button><p class="footnote">管理员目标在 72 小时内处理；申诉期间限制继续生效。</p></form>`);
  });
  document.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    if (form.id === 'compose-form') submitComposition(form);
    if (form.id === 'report-form') {
      if (form.querySelector('select').value === '其他' && !form.querySelector('textarea').value.trim()) { document.getElementById('report-error').textContent = '选择“其他”时，请补充原因。'; return; }
      closeModal(); toast('举报已记录（本地演示），不会直接对作者扣分');
    }
    if (form.id === 'appeal-form') {
      if (!form.querySelector('textarea').value.trim()) { document.getElementById('appeal-error').textContent = '请先说明申诉原因。'; return; }
      state.appealSent = true; closeModal(false); render(); toast('申诉已提交（本地演示）');
    }
  });
  document.addEventListener('keydown', event => {
    if (!modalRoot.firstChild) return;
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
    if (event.key === 'Tab') {
      const nodes = [...modalRoot.querySelectorAll('button:not(:disabled),input,textarea,select,a[href]')];
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement.classList.contains('sheet'))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  render();
})();
