/* All people, conversations and notifications below are design samples. No backend calls. */
window.MessageSamples = {
  conversations: [
    { id: 'zhou', name: '周子昂', initial: '周', tone: 'blue', kind: 'person', time: '10:42', unread: 2,
      preview: '周六下午球场见？', context: '来自「运动搭子圈」',
      messages: [
        { side: 'them', text: '看到你在圈子里找篮球搭子，我也在学校！', time: '10:38' },
        { side: 'me', text: '好呀，我周六下午有空。', time: '10:40' },
        { side: 'them', text: '那我们三点在东区球场碰头？', time: '10:41' },
        { side: 'them', text: '周六下午球场见？', time: '10:42' }
      ] },
    { id: 'su', name: '苏晚晴', initial: '苏', tone: 'orange', kind: 'person', time: '昨天', unread: 0,
      preview: '餐桌链接发你啦～', context: '来自「校园生活圈」',
      messages: [{ side: 'them', text: '你上次问的折叠餐桌我找到啦。', time: '昨天 18:20' }, { side: 'them', text: '餐桌链接发你啦～', time: '昨天 18:21' }] },
    { id: 'ali', name: '阿力', initial: '阿', tone: 'mint', kind: 'person', time: '周四', unread: 0,
      preview: '那本考研英语还在吗？', context: '来自「闲置交换圈」',
      messages: [{ side: 'them', text: '你好，看到你的闲置书帖子。', time: '周四 16:09' }, { side: 'them', text: '那本考研英语还在吗？', time: '周四 16:10' }] },
    { id: 'running', name: '运动搭子圈', initial: '动', tone: 'green', kind: 'circle', time: '周三', unread: 1,
      preview: '周六晨跑集合点改到东门啦', context: '圈子会话 · 仅设计演示',
      messages: [{ side: 'them', text: '小林：周六晨跑集合点改到东门啦，7:30 不见不散。', time: '周三 20:30' }, { side: 'them', text: '阿杰：收到，我带水！', time: '周三 20:32' }] },
    { id: 'assistant', name: '开耍小助手', initial: '开', tone: 'official', kind: 'official', time: '周二', unread: 1,
      preview: '欢迎来到开耍，先去圈子逛逛吧', context: '开耍官方 · 校园生活连接站',
      messages: [{ side: 'them', text: '欢迎来到开耍。找个搭子，交换闲置，把校园生活过得热闹一点。', time: '周二 09:00' }, { side: 'them', text: '先去圈子逛逛吧，你的下一个同频朋友可能就在那里。', time: '周二 09:01' }] }
  ],
  activities: {
    likes: [
      { id: 'l1', name: '小满、林可等 3 位同学', initial: '满', tone: 'orange', text: '赞了你的帖子', source: '周末想去江边骑行，有一起的吗？', time: '10 分钟前', count: 3, unread: true },
      { id: 'l2', name: '陈以安', initial: '陈', tone: 'blue', text: '赞了你的评论', source: '东区食堂二楼的面真的很好吃。', time: '昨天', count: 1, unread: false }
    ],
    comments: [
      { id: 'c1', name: '林可', initial: '林', tone: 'mint', text: '评论了你的帖子', source: '我也想去！周日下午可以吗？', time: '28 分钟前', count: 1, unread: true },
      { id: 'c2', name: '小满', initial: '满', tone: 'orange', text: '回复了你的评论', source: '就在图书馆旁边那家，下次一起！', time: '1 小时前', count: 1, unread: true },
      { id: 'c3', name: '周子昂', initial: '周', tone: 'blue', text: '评论了你的帖子', source: '篮球算我一个！', time: '昨天', count: 1, unread: false }
    ],
    notices: [
      { id: 'n1', name: '开耍小助手', initial: '开', tone: 'official', text: '你的校园生活，从这里开始', source: '完善个人介绍，让同频的朋友更快发现你。', time: '今天 09:00', count: 1, unread: true },
      { id: 'n2', name: '社区通知', initial: '知', tone: 'green', text: '友好交流，一起维护校园社区', source: '请保护个人隐私，线下见面优先选择校园公共场所。', time: '昨天', count: 1, unread: false }
    ]
  }
};
