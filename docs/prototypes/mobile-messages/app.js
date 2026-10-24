(() => {
  'use strict';
  const variant = document.body.dataset.design;
  const data = structuredClone(window.MessageSamples);
  const state = { filter: 'all', mode: 'normal', selected: null, category: null, scroll: 0 };
  const icons = {
    brand: '<path d="M4 6h16M7 3v8m10-8v8M4 15h16M8 12v9m8-9v9"/>',
    heart: '<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',
    comment: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1"/>',
    home: '<path d="m3 10 9-7 9 7M5 9v12h14V9"/>',
    people: '<circle cx="10" cy="7" r="4"/><path d="M2 21v-3a8 8 0 0 1 16 0v3M17 3a4 4 0 0 1 0 8m3 3a7 7 0 0 1 2 5"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M6 5a10 10 0 0 1 0 14M18 5a10 10 0 0 0 0 14"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.comment}</svg>`;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const names = { likes: '收到的赞', comments: '评论与回复', notices: '通知' };
  const categoryUnread = key => data.activities[key].reduce((sum, row) => sum + (row.unread ? row.count : 0), 0);
  const conversationUnread = () => data.conversations.reduce((sum, row) => sum + row.unread, 0);
  const totalUnread = () => Object.keys(names).reduce((sum, key) => sum + categoryUnread(key), conversationUnread());
  console.assert(conversationUnread() === 4 && totalUnread() === 10, 'Sample unread counts must reconcile.');
  const avatar = row => `<span class="avatar" data-tone="${row.tone}" aria-hidden="true">${row.kind === 'official' || row.tone === 'official' ? icon('brand') : row.initial}</span>`;
  const badge = count => count > 0 ? `<span class="unread-badge num">${count}</span>` : '';
  document.getElementById('app').innerHTML = `
    <div class="shell">
      <div class="brand-line"><span class="brand-symbol">${icon('brand')}</span><span class="brand-name">开耍</span><span class="brand-scope">校园生活连接站</span><span class="demo-label">设计预览 · 演示数据</span></div>
      <div class="workspace">
        <main class="inbox">
          <header><div class="title-row"><h1>消息</h1><button class="text-action" data-action="read-all">${icon('check')}<span>全部已读</span></button></div><p class="subline" id="summary"></p></header>
          <nav class="category-nav" aria-label="互动消息" id="categories"></nav>
          <div class="section-heading"><h2>${variant === 'b' ? '最近来信' : '最近会话'}</h2><button class="filter-toggle" data-action="unread" aria-pressed="false">${icon('filter')}只看未读</button></div>
          <div class="tabs" aria-label="会话筛选">${[['all','全部'],['person','私信'],['circle','圈子'],['unread','未读']].map(([key,label]) => `<button class="tab" data-filter="${key}" aria-pressed="${key === 'all'}">${label}</button>`).join('')}</div>
          <div class="conversation-list" id="conversations" aria-label="会话列表"></div>
          <p class="end-note">就这些啦，去校园里遇见更多朋友</p>
          <p class="editorial-note"><span>把有趣的人，留在日常里。</span><span>开耍 · 校园来信</span></p>
        </main>
        <section class="detail" id="detail" aria-label="消息详情"></section>
      </div>
      <nav class="bottom-nav" aria-label="App 主导航">${[['home','首页'],['people','圈子'],['plus','发布'],['comment','消息'],['user','我的']].map(([key,label]) => `<button class="nav-item ${label === '消息' ? 'current' : ''}" data-nav="${label}" ${label === '消息' ? 'aria-current="page"' : ''}>${key === 'plus' ? `<span class="publish-symbol">${icon(key)}</span>` : icon(key)}<span>${label}</span>${label === '消息' ? '<span class="nav-unread" id="nav-count"></span>' : ''}</button>`).join('')}</nav>
      <footer class="state-preview"><label>预览状态<select id="preview-state"><option value="normal">正常</option><option value="empty">空会话</option><option value="loading">加载中</option><option value="error">网络错误</option></select></label><button data-action="reset">重置演示</button></footer>
    </div><div id="toast" class="toast" role="status" hidden></div>`;
  let toastTimer;
  const toast = message => {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  };
  function renderCounts() {
    const total = totalUnread();
    document.getElementById('summary').innerHTML = variant === 'b' ? `校园里的新鲜事，${total ? `有 <strong class="num">${total}</strong> 条还没读` : '今天的来信都读完了'}` : variant === 'c' ? `${data.conversations.length} 个会话 · ${total ? `<strong class="num">${total}</strong> 条未读消息` : '消息已全部读完'}` : total ? `有 <strong class="num">${total}</strong> 条新消息，等你来看看` : '消息都读完啦，去开耍吧';
    document.getElementById('categories').innerHTML = [['likes','heart','赞'],['comments','comment','评论'],['notices','bell','通知']].map(([key,symbol,label]) => `<button class="category" data-category="${key}" aria-label="${names[key]}，${categoryUnread(key)} 条未读"><span class="category-top">${icon(symbol)}<span class="count num">${categoryUnread(key)}</span></span><span class="category-label">${label}</span></button>`).join('');
    document.getElementById('nav-count').innerHTML = badge(total);
    const read = document.querySelector('[data-action="read-all"]');
    read.disabled = total === 0;
    read.querySelector('span').textContent = total ? '全部已读' : '已全部读完';
  }
  function renderList() {
    const container = document.getElementById('conversations');
    document.querySelectorAll('[data-filter]').forEach(el => el.setAttribute('aria-pressed', el.dataset.filter === state.filter));
    document.querySelector('[data-action="unread"]').setAttribute('aria-pressed', state.filter === 'unread');
    if (state.mode === 'loading') {
      container.innerHTML = `<div role="status" aria-label="正在加载会话">${Array.from({length: 5}, () => '<div class="loading-row"><span class="loading-avatar"></span><div class="loading-lines"><span></span><span></span></div></div>').join('')}<p class="end-note">正在加载会话…</p></div>`;
      return;
    }
    if (state.mode === 'error') {
      container.innerHTML = '<div class="empty-state"><h3>消息暂时没送到</h3><p>网络连接失败，请稍后重试。</p><button data-action="retry">重新加载</button></div>';
      return;
    }
    const rows = state.mode === 'empty' ? [] : data.conversations.filter(row => state.filter === 'all' || (state.filter === 'unread' ? row.unread > 0 : row.kind === state.filter));
    if (!rows.length) {
      container.innerHTML = `<div class="empty-state"><h3>${state.filter === 'unread' ? '未读都处理完啦' : '这里还没有会话'}</h3><p>${state.filter === 'unread' ? '有新消息时，会出现在这里。' : '和同频的同学聊聊，故事从这里开始。'}</p><button data-action="${state.filter === 'unread' ? 'show-all' : 'circles'}">${state.filter === 'unread' ? '查看全部会话' : '去圈子逛逛'}</button></div>`;
      return;
    }
    container.innerHTML = rows.map(row => `<button class="conversation ${row.unread ? 'unread' : ''} ${state.selected === row.id ? 'selected' : ''}" data-chat="${row.id}" aria-label="${row.name}${row.unread ? `，${row.unread} 条未读` : ''}，${escape(row.preview)}">${avatar(row)}<span class="conversation-copy"><span class="name-line"><span class="name">${row.name}</span>${row.kind !== 'person' ? `<span class="tag">${row.kind === 'circle' ? '圈子' : '官方'}</span>` : ''}</span><span class="preview">${escape(row.preview)}</span></span><span class="conversation-meta"><span class="time num">${row.time}</span>${badge(row.unread)}</span></button>`).join('');
  }
  function detailHeader(title, subtitle, person) {
    return `<header class="detail-top"><button class="back" data-action="back" aria-label="返回消息列表">${icon('back')}</button>${person ? avatar(person) : ''}<div><h2 id="detail-title">${title}</h2><p>${subtitle}</p></div></header>`;
  }
  function renderWelcome() {
    document.getElementById('detail').innerHTML = `${detailHeader('校园里，总有人和你同频', '开耍 · 消息连接每一次相遇')}<div class="detail-body detail-welcome"><div class="welcome-copy"><h2>周末的球局，<br>从一条消息开始。</h2><p>约个搭子、交换一本书，或是聊聊校园里的新鲜事。选择左侧的会话，接住朋友的来信。</p></div><div class="campus-ticket"><div class="ticket-top"><span>运动搭子圈 · 同学邀约</span>${icon('ball')}</div><h3>周六，球场见。</h3><p>东区篮球场 · 下午 3:00</p><div class="ticket-foot"><span>周子昂的邀请</span><span>等你一句「好呀」</span></div></div><p class="subline">赞、评论和通知也有各自的入口，一条都不会漏。</p></div><div class="detail-notice">交互设计预览，所有会话与未读数均为演示数据</div>`;
  }
  function renderChat() {
    const row = data.conversations.find(item => item.id === state.selected);
    if (!row) return;
    document.getElementById('detail').innerHTML = `${detailHeader(row.name, row.context, row)}<div class="detail-notice">演示会话 · 回复仅在本页暂存，不会发送给任何人</div><div class="detail-body" id="chat-body"><p class="chat-stamp">${row.time === '10:42' ? '今天' : row.time}</p>${row.messages.map(message => `<div class="bubble-row ${message.side === 'me' ? 'me' : ''}">${message.side !== 'me' ? avatar(row) : ''}<div class="bubble-group"><p class="bubble">${escape(message.text)}</p><span class="time num">${message.time}</span></div></div>`).join('')}</div>${row.kind === 'official' ? '<div class="detail-notice">官方服务消息，无需回复</div>' : '<form class="composer" id="reply-form"><label for="reply">演示回复</label><div class="composer-fields"><input id="reply" name="reply" maxlength="500" autocomplete="off" placeholder="说点什么吧…"><button class="send" type="submit" disabled>发送</button></div></form>'}`;
    const body = document.getElementById('chat-body');
    body.scrollTop = body.scrollHeight;
  }
  function openDetail() {
    if (!document.body.classList.contains('detail-open')) state.scroll = window.scrollY;
    document.body.classList.add('detail-open');
    if (matchMedia('(max-width: 760px)').matches) window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      const heading = document.getElementById('detail-title');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
  }
  function openCategory(key) {
    state.category = key;
    state.selected = null;
    const items = data.activities[key];
    const content = items.map(row => `<article class="activity ${row.unread ? 'unread' : ''}">${avatar(row)}<div class="activity-copy"><h3>${row.name}</h3><p>${row.text}</p><button class="source-post" data-source="${row.id}">${escape(row.source)}</button><span class="time num">${row.time}</span>${key === 'comments' ? `<button class="activity-action" data-comment="${row.id}">回复评论 ${icon('arrow')}</button>` : ''}</div></article>`).join('');
    document.getElementById('detail').innerHTML = `${detailHeader(names[key], '演示互动记录 · 查看后标记已读')}<div class="detail-body">${content}</div><div class="detail-notice">演示数据；真实互动通知接口尚未接入</div>`;
    items.forEach(row => { row.unread = false; });
    renderCounts(); renderList(); openDetail();
  }
  function render() { renderCounts(); renderList(); }
  document.addEventListener('click', event => {
    const control = event.target.closest('button');
    if (!control || control.disabled) return;
    if (control.dataset.chat) {
      state.selected = control.dataset.chat; state.category = null;
      data.conversations.find(row => row.id === state.selected).unread = 0;
      render(); renderChat(); openDetail(); return;
    }
    if (control.dataset.category) { openCategory(control.dataset.category); return; }
    if (control.dataset.filter) { state.filter = control.dataset.filter; renderList(); return; }
    if (control.dataset.nav) { if (control.dataset.nav !== '消息') toast(`${control.dataset.nav}页面不在本次消息原型中`); return; }
    if (control.dataset.source) { toast('此处将打开对应帖子；本次仅预览消息设计'); return; }
    if (control.dataset.comment) { toast('此处将进入对应帖子的评论回复；本次为交互示意'); return; }
    switch (control.dataset.action) {
      case 'read-all':
        data.conversations.forEach(row => { row.unread = 0; });
        Object.values(data.activities).flat().forEach(row => { row.unread = false; });
        render(); toast('演示消息已全部标记为已读'); break;
      case 'unread': state.filter = state.filter === 'unread' ? 'all' : 'unread'; renderList(); break;
      case 'show-all': state.filter = 'all'; renderList(); break;
      case 'circles': toast('此处将前往圈子；本次仅预览消息设计'); break;
      case 'back': {
        document.body.classList.remove('detail-open');
        window.scrollTo(0, state.scroll);
        const trigger = state.selected ? document.querySelector(`[data-chat="${state.selected}"]`) : document.querySelector(`[data-category="${state.category}"]`);
        (trigger || document.querySelector('h1')).focus({ preventScroll: true }); break;
      }
      case 'retry': state.mode = 'normal'; document.getElementById('preview-state').value = 'normal'; renderList(); toast('已恢复演示会话'); break;
      case 'reset': location.reload(); break;
    }
  });
  document.addEventListener('change', event => {
    if (event.target.id !== 'preview-state') return;
    state.mode = event.target.value;
    renderList();
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'reply') document.querySelector('.send').disabled = !event.target.value.trim();
  });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'reply-form') return;
    event.preventDefault();
    const input = document.getElementById('reply');
    const text = input.value.trim();
    if (!text) return;
    const row = data.conversations.find(item => item.id === state.selected);
    row.messages.push({ side: 'me', text, time: '刚刚 · 仅本地' });
    row.preview = `我：${text}`; row.time = '刚刚';
    renderList(); renderChat();
    document.getElementById('reply').focus();
    toast('已在原型中展示回复，未向外发送');
  });
  render(); renderWelcome();
})();
