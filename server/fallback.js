'use strict';

const { PLACE_TYPES, BUDDY_SEEDS } = require('./content');

const MOOD_WORDS = [
  { k: ['难过', '想哭', '低落', '崩溃'], w: '低落' },
  { k: ['焦虑', '慌', '紧张', '怕'], w: '焦虑' },
  { k: ['累', '疲惫', '撑不住', '没力气'], w: '疲惫' },
  { k: ['孤独', '一个人', '没人'], w: '孤独' }
];

function pick(arr, seed = 0) { return arr[Math.abs(seed) % arr.length]; }

function zodiacOf(year) {
  const animals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  if (!year) return '';
  return animals[(Number(year) - 4) % 12];
}

function sunSign(birthday) {
  if (!birthday) return '';
  const d = new Date(birthday);
  if (isNaN(d)) return '';
  const m = d.getMonth() + 1, day = d.getDate();
  const signs = [
    [1, 20, '摩羯座'], [2, 19, '水瓶座'], [3, 21, '双鱼座'], [4, 20, '白羊座'],
    [5, 21, '金牛座'], [6, 22, '双子座'], [7, 23, '巨蟹座'], [8, 23, '狮子座'],
    [9, 23, '处女座'], [10, 24, '天秤座'], [11, 23, '天蝎座'], [12, 22, '射手座']
  ];
  let sign = '摩羯座';
  for (const [sm, sd, name] of signs) {
    if (m > sm || (m === sm && day >= sd)) sign = name;
    else break;
  }
  return sign;
}

function seasonOf(birthday) {
  if (!birthday) return '';
  const m = new Date(birthday).getMonth() + 1;
  if ([3, 4, 5].includes(m)) return '春';
  if ([6, 7, 8].includes(m)) return '夏';
  if ([9, 10, 11].includes(m)) return '秋';
  return '冬';
}

/* ---------------- 助眠 ---------------- */
function sleepPlan(profile, stress = 5, mood = '') {
  const level = stress >= 8 ? 'high' : stress >= 5 ? 'mid' : 'low';
  const hour = new Date().getHours();
  const titles = { high: '高压夜晚 · 先把警报关掉', mid: '中压夜晚 · 一点点松开', low: '平静夜晚 · 温柔收尾' };
  const intro = level === 'high'
    ? `今天的压力值偏高${mood ? `（${mood}）` : ''}。今晚不要试图"解决所有事"，目标只有一个：让身体先安全下来。`
    : level === 'mid'
      ? '今天有些累，但还不至于垮掉。我们把节奏调慢一点，给大脑一个结束今天的信号。'
      : '今天整体还好。可以借着这个状态，把睡眠质量再往上抬一点。';
  const steps = level === 'high' ? [
    { time: '睡前 60 分钟', title: '降噪', detail: '关掉工作群提醒，把手机调成灰度或放到够不着的地方。' },
    { time: '睡前 40 分钟', title: '温水 + 慢呼吸', detail: '洗漱用温水，做 4-2-6 呼吸 12 轮：吸 4 秒、停 2 秒、呼 6 秒。' },
    { time: '睡前 20 分钟', title: '情绪卸货', detail: '在便签里写下明天再处理的三件事，告诉大脑"已经记下了"。' },
    { time: '床上', title: '身体扫描', detail: '从脚趾到肩膀逐段放松，走神了就回到呼吸，不用批评自己。' }
  ] : level === 'mid' ? [
    { time: '睡前 45 分钟', title: '结束今天', detail: '写下今天做过的一件小事，哪怕只是吃了饭。' },
    { time: '睡前 30 分钟', title: '白噪音', detail: '选雨声或溪流，音量调到刚好盖住环境音。' },
    { time: '睡前 15 分钟', title: '反刍暂停', detail: '给脑子里的念头起名"这是复盘，不是解决"，然后回到呼吸。' },
    { time: '床上', title: '4-2-6 呼吸', detail: '做 8 轮，不强求入睡，只负责放松。' }
  ] : [
    { time: '睡前 30 分钟', title: '调暗灯光', detail: '把主灯换成暖色小灯，让身体知道夜晚来了。' },
    { time: '睡前 20 分钟', title: '轻柔拉伸', detail: '做 5 分钟肩颈与腰背拉伸，配合长呼气。' },
    { time: '睡前 10 分钟', title: '感恩一件小事', detail: '想起今天一个不坏的瞬间，停留 10 秒。' },
    { time: '床上', title: '自然入睡', detail: '不盯着时间，睡不着就做呼吸，不和自己较劲。' }
  ];
  return {
    title: titles[level],
    stressLevel: stress,
    intro,
    steps,
    sound: stress >= 7 ? 'rain' : stress >= 4 ? 'stream' : 'night',
    note: '如果连续两周入睡困难或夜醒明显，建议到睡眠/心理门诊做进一步评估。'
  };
}

/* ---------------- 解梦 ---------------- */
const SYMBOLS = [
  { k: ['水', '海', '河', '雨', '溺水'], name: '水', meaning: '水常与情绪流动有关。水的状态，可能映照你近期被情绪淹没或正在释放的程度。' },
  { k: ['坠落', '掉下', '悬崖'], name: '坠落', meaning: '坠落常出现在失控感或安全感不足的时候，也可能与最近的失控事件有关。' },
  { k: ['被追', '追我', '逃'], name: '被追赶', meaning: '被追赶往往对应现实里一直想回避的压力或冲突，你的身体在替你表达"我想逃"。' },
  { k: ['考试', '考场', '迟到', '找不到'], name: '考试/迟到', meaning: '与评价焦虑、害怕来不及、害怕被看见不够好有关。' },
  { k: ['前任', '分手', '他', '她'], name: '旧关系', meaning: '旧人入梦多数不是预兆，而是未完成情绪在夜间回放。' },
  { k: ['家人', '妈妈', '爸爸', '父母'], name: '原生家庭', meaning: '家庭场景常承载早年的情绪模式，梦里的冲突可能是旧感受的重演。' },
  { k: ['死', '葬礼', '结束'], name: '结束', meaning: '梦中的死亡很少指向现实，更常象征一个阶段、关系或身份的结束与转化。' },
  { k: ['迷路', '找不到路', '陌生'], name: '迷路', meaning: '与现实中的方向感、选择困难或不确定感有关。' },
  { k: ['房子', '家', '房间'], name: '房子', meaning: '房子常象征内在空间。房间的状态，可能是你对自己内心状态的投射。' },
  { k: ['蛇', '虫', '老鼠'], name: '隐忧', meaning: '这类意象常与潜藏的担忧、厌恶或难以言说的压力有关。' },
  { k: ['飞', '飞翔'], name: '飞翔', meaning: '飞翔多与想要自由、逃离束缚或短暂解脱感有关。' },
  { k: ['血', '受伤', '伤口'], name: '伤口', meaning: '可能指向情绪耗竭、被伤害的感受，或正在愈合的旧伤。' },
  { k: ['黑暗', '恐怖', '鬼'], name: '黑暗', meaning: '黑暗常是未知与压抑情绪的容器，尤其在你近期缺乏安全感时出现。' }
];

function dreamAnalysis(content, profile) {
  const hits = SYMBOLS.filter(s => s.k.some(k => content.includes(k))).slice(0, 3);
  const symbols = hits.length ? hits.map(h => ({ name: h.name, meaning: h.meaning })) : [
    { name: '梦境隐喻', meaning: '这段梦境没有明显的常见意象，但梦里的情绪强度本身，就是值得被听见的部分。' }
  ];
  const hidden = content.includes('被追') || content.includes('坠落')
    ? '梦里那股"逃不掉"的紧张，可能对应现实里一件你一直搁置、却持续消耗你的事。'
    : content.includes('前任') || content.includes('他') || content.includes('她')
      ? '梦里反复出现的人，可能承载着一段未完成的关系情绪，而不是现实中的征兆。'
      : '这段梦更像是潜意识在整理近期积压的感受，白天没来得及处理的情绪，在夜里找你要一个位置。';
  const comfort = '先把梦当成一封来自内心的信，而不是判决书。它不预示吉凶，只在提醒你：有些感受需要被照顾。';
  const suggestion = '今晚睡前做 6 轮慢呼吸，并把梦里最强烈的那个画面写下来，问自己一句：它让我想起现实里的什么？';
  return { title: '潜意识的一封信', symbols, hidden, comfort, suggestion, note: '解梦为心理投射与自我觉察参考，不涉及吉凶预兆。' };
}

/* ---------------- 每日激励 ---------------- */
function encouragement(profile, stats, style) {
  const name = profile.nickname && profile.nickname !== '愈伴朋友' ? profile.nickname : '亲爱的你';
  const avg = stats.avgMood;
  const low = avg !== null && avg <= 4;
  const track = stats.topTag || '';
  const openers = {
    '温柔宠溺': [
      `${name}，今天不用表现得很坚强。`,
      `${name}，先把手放在心口，感受一下自己还在。`
    ],
    '犀利骂醒': [
      `${name}，别再拿"我应该"来抽自己了。`,
      `${name}，你不是不够好，你是太累了。`
    ],
    '佛系静心': [
      `${name}，今天慢一点也没关系。`,
      `${name}，把呼吸放长，事情就先放在那儿。`
    ],
    '热血励志': [
      `${name}，今天先赢下最小的一仗。`,
      `${name}，你已经在路上了，别急着回头否定自己。`
    ]
  }[style] || [`${name}，今天也辛苦你了。`];
  const quote = (stats.quote || '').replace(/\s+/g, ' ').trim();
  const days = Number(stats.days) || 0;
  const proof = quote
    ? `你曾写下：“${quote.slice(0, 42)}”。那不是矫情，是你在很用力地活着。`
    : days > 1
      ? `这是你走进愈伴的第 ${days} 天，${Number(stats.checkins) || 0} 次情绪记录都还在。你没有消失，你在面对。`
      : '';
  const body = low
    ? `你最近的情绪一直在低位运行，这不是你不够努力，是电量真的快见底了。今天不要定大目标，只做一件能让自己舒服一点的小事：晒十分钟太阳、认真吃一顿饭、或者早点躺下。${proof ? '\n\n' + proof : ''}`
    : track
      ? `你最近在「${track}」这件事上花了很多力气。我看见你没有逃，哪怕走得慢，也一直在往前。今天允许自己把标准调低一点，完成比完美重要。${proof ? '\n\n' + proof : ''}`
      : `你最近的记录里，有在认真生活的痕迹。那些你以为微不足道的小事——按时吃饭、说出委屈、早点睡觉——都在一点点把你托住。${proof ? '\n\n' + proof : ''}`;
  const closing = {
    '温柔宠溺': '我就在这儿，不用你回复，也不用你坚强。',
    '犀利骂醒': '今天别想太远，先把眼前这一件事做好，就算赢。',
    '佛系静心': '不求今天更好，只求今天不那么用力。',
    '热血励志': '今天往前半步，就算数。'
  }[style] || '我陪着你。';
  return `${pick(openers, Date.now() / 86400000 | 0)}\n\n${body}\n\n${closing}`;
}

/* ---------------- 主动问候 ---------------- */
function greeting(profile, lastEmotion, hour) {
  const name = profile.nickname && profile.nickname !== '愈伴朋友' ? profile.nickname : '你';
  const timeWord = hour < 5 ? '这个点还醒着' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 19 ? '下午好' : '晚上好';
  if (lastEmotion && lastEmotion.score <= 4) {
    return `${timeWord}，${name}。\n我看到你昨天记录的心情是「${lastEmotion.mood || '低落'}」，强度 ${lastEmotion.score}/10。我没有催你振作，只是想让你知道：今天可以只完成"活着"这件事。\n要不要先跟我说一句，今天醒来时身体是什么感觉？`;
  }
  if (lastEmotion && lastEmotion.score >= 8) {
    return `${timeWord}，${name}。\n昨天你的心情是「${lastEmotion.mood || '还不错'}」，我替你开心，也想把这份好状态多留一会儿。\n今天想做点什么让它延续下去？`;
  }
  const seeds = [
    `${timeWord}，${name}。\n我在这里，不着急聊什么。今天有没有一个很小的瞬间，让你觉得还行？`,
    `${timeWord}，${name}。\n昨晚睡得怎么样？如果还没缓过来，今天允许自己慢一点。`,
    `${timeWord}，${name}。\n今天有什么还没说出口的话吗？可以从一句碎碎念开始。`
  ];
  return pick(seeds, (Date.now() / 86400000 | 0) + (profile.nickname || '').length);
}

/* ---------------- 成长报告 ---------------- */
function report(profile, stats, days) {
  const name = profile.nickname && profile.nickname !== '愈伴朋友' ? profile.nickname : '你';
  const curve = stats.curve || [];
  const avg = stats.avgMood;
  const has = curve.length >= 2;
  const wins = [];
  if (stats.checkins > 0) wins.push(`完成了 ${stats.checkins} 次情绪记录，你开始愿意把自己的感受当回事。`);
  if (stats.chats > 0) wins.push(`和愈伴对话 ${stats.chats} 轮，在最难的时候没有独自硬扛。`);
  if (stats.dreams > 0) wins.push(`记录了 ${stats.dreams} 个梦境，正在靠近自己的潜意识。`);
  if (stats.assessments && stats.assessments.length > 0) wins.push(`完成 ${stats.assessments.length} 次心理自评，对自己的状态更有数。`);
  if (stats.sleepLogs && stats.sleepLogs.length > 0) wins.push(`记录了 ${stats.sleepLogs.length} 次睡眠，开始照顾身体的底盘。`);
  if (!wins.length) wins.push('你愿意打开这个页面，本身就是一次对自己的靠近。');
  const gaps = [];
  if (avg !== null && avg <= 5) gaps.push('情绪长期在低位，容易陷入"什么都做不了"的循环，需要先把生活节律稳住。');
  if (stats.lateNightRatio >= 0.4) gaps.push('深夜记录占比较高，夜间情绪容易被放大，睡前反刍是当前的主要消耗点。');
  if (stats.topTag) gaps.push(`「${stats.topTag}」反复出现，是你近期最需要被照顾的议题。`);
  if (!gaps.length) gaps.push('目前没有明显的持续消耗点，可以开始把注意力放在"想要什么"上。');
  const plan = avg !== null && avg <= 5 ? [
    '每天固定一个"最低限度"：吃一顿热饭、出门走 15 分钟。',
    '情绪低到 3 分以下时，不做重大决定，只做身体安抚。',
    '每 3 天记录一次情绪，不追求连续，只追求看见。'
  ] : [
    '保持现有的记录节奏，每周回看一次自己的曲线。',
    '给"反刍"设一个时间盒：每天固定 15 分钟想它，其余时间先放下。',
    '把一件让你有能量的小事，固定进日程。'
  ];
  const summary = has
    ? `过去 ${days} 天，你的情绪均值约 ${avg}/10，${stats.trend >= 0 ? '整体比前一阶段略有回升' : '整体比前一阶段有所下滑'}。${stats.lateNightRatio >= 0.4 ? '你的记录多发生在深夜，夜里容易把情绪放大。' : '你的记录时间相对分散，自我观察在慢慢变成习惯。'}`
    : `过去 ${days} 天里，你留下了 ${stats.checkins} 条情绪记录。样本还不多，但已经足够让我看见一个开始。`;
  const quote = avg !== null && avg <= 4
    ? '你已经撑了很久。现在不需要更努力，只需要被接住。'
    : '你不是在"变好"，你是在慢慢变回自己。';
  return {
    title: `${days} 天成长复盘`,
    summary,
    curve,
    wins,
    gaps,
    plan,
    quote,
    closing: `${name}，下一次复盘时，我希望还能在这里见到你。`
  };
}

/* ---------------- 命理人格（合规） ---------------- */
function baziReading(profile, input = {}) {
  const z = zodiacOf(new Date(input.birthday || profile.birthday || '').getFullYear ? new Date(input.birthday || profile.birthday).getFullYear() : null);
  const sign = sunSign(input.birthday || profile.birthday);
  const season = seasonOf(input.birthday || profile.birthday);
  const tags = JSON.parse(profile.tags || '[]');
  const sensitive = tags.some(t => /敏感|共情|内向|讨好|焦虑/.test(t));
  const nature = season === '冬'
    ? '你的底色像冬天：安静、内敛、耐力强，习惯把情绪往里收。外表看起来稳，里面其实一直在默默承重。'
    : season === '夏'
      ? '你的底色像夏天：热度高、感受浓烈、对人真诚，情绪来得快也去得快，但容易耗尽。'
      : season === '春'
        ? '你的底色像春天：敏感、有想象力、对关系有期待，容易被打动，也容易被伤到。'
        : '你的底色像秋天：清醒、重逻辑、习惯先观察再靠近，容易想太多，不容易真正松弛。';
  const origin = sensitive
    ? '你的敏感不是缺陷，更像一套高精度雷达。它让你很早就能察觉别人的情绪，也让你更容易把别人的问题背到自己身上。'
    : '你身上的很多反应，不是性格缺陷，而是早年为了适应环境长出来的保护机制。';
  return {
    title: '先天底色 × 人生经历 · 人格镜像',
    meta: [sign && `${sign}｜太阳星座意象`, z && `${z}年｜生肖意象`, season && `${season}季出生`].filter(Boolean),
    nature,
    origin,
    gifts: '你的天赋在于：能看见别人看不见的细节，能在痛苦里长出理解力，也具备把自己重新养一遍的能力。',
    shadows: '需要留意的是：过度向内归因、把"忍"当成解决、在关系里先照顾别人再照顾自己。',
    lifestyle: '适合你的活法：减少高压社交，保留独处时间；用稳定的节律（睡眠、饮食、运动）托住情绪；选择能尊重边界的合作方式。',
    relations: '在关系里，你需要练习先表达需求，再谈体谅；先确认安全，再投入深情。',
    healing: '你的疗愈方式不是"想通"，而是"被稳定地对待"——一段稳定的关系、一个稳定的作息、一个不评判你的空间。',
    note: '本解读为心理投射与自我成长参考，不排盘、不测吉凶、不构成命运预测。'
  };
}

function tarotReading(question, cards, profile) {
  const lines = cards.map((c, i) => ({
    name: c.name,
    en: c.en,
    keyword: c.keyword,
    line: i === 0 ? `当下的你：${c.heal}` : i === 1 ? `需要看见的：${c.heal}` : `可以尝试的：${c.heal}`
  }));
  const q = question ? `关于「${question}」，` : '';
  return {
    headline: `${q}牌面没有在替你决定，它在帮你把心里的声音听清楚。`,
    cards: lines,
    reading: `${cards[0].heal}${cards[1] ? ` 同时，${cards[1].heal}` : ''} 这不是预言，而是把注意力放回你真正需要的地方。`,
    action: cards[2] ? cards[2].heal : '今天做一件让身体先放松的小事，再考虑下一步。',
    note: '塔罗为心理投射工具，不测吉凶，不替代专业建议。'
  };
}

function drawReading(type, text) {
  return { type, text, note: '抽签为今日心境提示，不测吉凶、不涉迷信。' };
}

function zenReading(card, profile) {
  return {
    name: card.name,
    text: card.text,
    prompt: `如果把这句「${card.name}」放进你现在的生活，它最想提醒你的是哪件事？`,
    note: '禅卡用于自我投射与觉察，不作预测。'
  };
}

/* ---------------- 同城 ---------------- */
function places(city, profile, moodScore) {
  const quiet = moodScore !== null && moodScore <= 4 ? 3 : 0;
  const list = [];
  const offset = (profile.nickname || '').length;
  for (let i = 0; i < 5; i++) {
    const t = PLACE_TYPES[(i + offset) % PLACE_TYPES.length];
    list.push({
      name: t.name,
      type: t.type,
      why: t.why,
      tip: t.tip,
      search: `${city || '你所在的城市'} ${t.type}`
    });
  }
  return {
    intro: `${city ? city + '的' : ''}治愈不是去远方，是找到一个让你不用表演的地方。${quiet ? '今天情绪偏低，优先选人少、可以随时离开的地方。' : '按你今天的状态，这几个类型会比较适配。'}`,
    places: list,
    note: '推荐为类型灵感，具体请以地图实时信息为准，注意出行安全。'
  };
}

function buddies(profile, moodScore) {
  const base = (profile.nickname || '').length;
  const tags = JSON.parse(profile.tags || '[]');
  const list = [];
  for (let i = 0; i < 3; i++) {
    const s = BUDDY_SEEDS[(i + base) % BUDDY_SEEDS.length];
    list.push({
      alias: s.alias,
      tags: s.tags,
      reason: `${s.reason}${tags.length ? ` 你们都在意「${tags[0]}」这件事。` : ''}`,
      icebreaker: s.ice,
      status: '匹配中'
    });
  }
  return {
    intro: `匹配维度：城市 + 心理状态 + 经历相似度 + 性格适配。${moodScore !== null && moodScore <= 4 ? '你最近状态偏低，我更建议先从"散步/自习"这类低压力搭子开始。' : '先从低压力、可随时结束的活动开始，会更舒服。'}`,
    matches: list,
    safety: '仅与实名认证用户匹配；首次见面请选择公共场所，告知可信任的人，保留随时离开的权利。'
  };
}

/* ---------------- 纪录片 ---------------- */
function documentary(profile, data) {
  const name = profile.nickname && profile.nickname !== '愈伴朋友' ? profile.nickname : '你';
  const scenes = [];
  const mems = data.memories.slice(0, 3);
  scenes.push({
    caption: '第一章 · 那些没人看见的时刻',
    visual: '夜色中的窗，一盏没有关掉的灯',
    line: mems[0] ? mems[0].content : '有些夜晚，你只是安静地撑过来了。'
  });
  scenes.push({
    caption: '第二章 · 你曾经以为过不去',
    visual: '雨后的街道，一个人慢慢走',
    line: mems[1] ? mems[1].content : '你以为会一直烂下去的日子，后来也天亮了。'
  });
  scenes.push({
    caption: '第三章 · 正在长出来的你',
    visual: '清晨的河边，风把云吹散',
    line: data.assessments.length ? `你做了 ${data.assessments.length} 次自评，开始认真地对待自己的感受。` : '你开始记录情绪，也开始愿意被看见。'
  });
  scenes.push({
    caption: '尾声 · 给自己',
    visual: '暖色的房间，一杯冒着热气的水',
    line: `致${name}：你不必变得完美，你已经值得被好好对待。`
  });
  return {
    title: `${name} · 一段正在发生的治愈`,
    subtitle: '根据你留下的记忆与情绪，自动生成的私人纪录短片',
    scenes,
    narration: `这不是一个关于"如何变好"的故事，而是关于${name}如何一次次把自己接住的故事。`,
    music: '低饱和钢琴 + 环境音（雨声/风声）',
    ending: '下一段，还在继续。',
    note: '短片由你的真实记录生成，仅本人可见。'
  };
}

/* ---------------- 7 天个性化疗愈计划 ---------------- */
const PLAN_THEMES = {
  breakup: {
    title: '失恋戒断与自我重建 · 7 天',
    focus: '关系结束',
    days: [
      { title: '允许自己难过，但不做决定', why: '戒断期做出的重大决定，多半是被情绪推着走的。', action: '今天只做一件事：想哭就哭，但不发消息、不删照片、不找他。', duration: '15 分钟' },
      { title: '把身体先稳住', why: '情绪戒断会带来躯体反应，身体稳了，念头才会降级。', action: '吃一顿热的，出门走 20 分钟，回来洗个热水澡。', duration: '40 分钟' },
      { title: '写一封不寄出的信', why: '把没说出口的话写完，比反复在脑子里排练更有出口。', action: '写下你最想对他说的话，写完存起来，不发送。', duration: '20 分钟' },
      { title: '找回一个"只属于你"的事', why: '关系里被压缩的自我，需要一点点长回来。', action: '做一件和他无关、你以前喜欢的事，哪怕只有半小时。', duration: '30 分钟' },
      { title: '识别你的触发点', why: '知道什么会突然把你拉回去，才能提前设防。', action: '列出三个最容易想他的时刻，为每个时刻准备一个替代动作。', duration: '15 分钟' },
      { title: '让支持系统接住你', why: '一个人硬扛戒断期，会把它拖得更长。', action: '联系一个信得过的人，只说一句："最近不太好，能陪我聊十分钟吗？"', duration: '20 分钟' },
      { title: '复盘：我学到了什么', why: '不是复盘他，是复盘你自己在这段关系里的需要与边界。', action: '写下三条：我需要什么、我不能接受什么、下次我要早点说什么。', duration: '20 分钟' }
    ]
  },
  anxiety: {
    title: '焦虑降级与身体复位 · 7 天',
    focus: '焦虑',
    days: [
      { title: '先处理身体，再处理念头', why: '焦虑发作时，讲道理没用，呼吸才有用。', action: '今天做三组 4-2-6 呼吸，每组 8 轮。', duration: '10 分钟' },
      { title: '把担忧分成两栏', why: '大脑把所有事都当成"马上要发生"，写下来才能区分。', action: '写下今天最担心的事，左栏"能控制"，右栏"不能控制"，只处理左栏。', duration: '15 分钟' },
      { title: '减少咖啡因与深夜信息', why: '咖啡因和刷手机都会让神经系统更警觉。', action: '今天下午后不喝咖啡，睡前一小时不看手机。', duration: '全天' },
      { title: '做一次轻度运动', why: '身体消耗能帮助焦虑能量代谢掉。', action: '快走、拉伸或八段锦，20 分钟，不追求强度。', duration: '20 分钟' },
      { title: '练习一次"允许焦虑在"', why: '越压越强，允许它待着，反而会降。', action: '焦虑来时对自己说："它在，但它在变小。"然后继续手上的事。', duration: '5 分钟' },
      { title: '设一个担忧时间盒', why: '把无限担忧关进有限时间，是停止反刍的关键。', action: '每天固定 15 分钟担忧，其他时间出现就记下来，留到那个时段。', duration: '15 分钟' },
      { title: '复盘：焦虑在保护我什么', why: '焦虑常常是一个过度尽责的保护者。', action: '写下焦虑想保护你免于什么，再写一句"我现在可以慢慢来"。', duration: '15 分钟' }
    ]
  },
  sleep: {
    title: '睡眠修复与睡前断网 · 7 天',
    focus: '睡眠',
    days: [
      { title: '固定起床时间', why: '先固定起床，比强迫早睡更有效。', action: '今天无论几点睡，都在同一个时间起床。', duration: '全天' },
      { title: '睡前清空大脑', why: '躺下后反刍，多半是白天没写完的事在排队。', action: '睡前把明天要做的事写在纸上，写完合上。', duration: '10 分钟' },
      { title: '把床只留给睡觉', why: '在床上刷手机，会让大脑把床和清醒绑定。', action: '今天起不在床上玩手机，困了再回床。', duration: '全天' },
      { title: '醒着超过 20 分钟就起身', why: '硬躺会增加对失眠的恐惧。', action: '醒着超过 20 分钟，就去暗处坐一会儿，困了再回床。', duration: '按需' },
      { title: '做一次睡前放松', why: '身体先松，睡意才来。', action: '听 10 分钟白噪音或做身体扫描，从脚趾到额头逐步放松。', duration: '10 分钟' },
      { title: '白天见光与活动', why: '白天光照和活动量决定晚上的睡意。', action: '白天出门至少 15 分钟，让眼睛见到自然光。', duration: '15 分钟' },
      { title: '复盘：失眠在替你说什么', why: '失眠常常是白天压力的延续。', action: '写下这一周最影响睡眠的一件事，想一个最小的改变。', duration: '15 分钟' }
    ]
  },
  family: {
    title: '原生家庭边界与自我松绑 · 7 天',
    focus: '原生家庭',
    days: [
      { title: '看见旧模式的来源', why: '你今天过度自责，可能是小时候学会的生存方式。', action: '写下小时候最常听到的一句否定的话，标注"那是他们的语言"。', duration: '15 分钟' },
      { title: '练习一次课题分离', why: '父母的情绪是他们的课题，不是你的责任。', action: '今天遇到他们情绪不好时，只回应"我知道了"，不急着安抚或解释。', duration: '10 分钟' },
      { title: '说一次温和的边界话', why: '边界不是吵架，是告诉对方怎么和你相处。', action: '练习一句："这件事我想自己决定，你可以不认同。"', duration: '10 分钟' },
      { title: '停止替他们消化情绪', why: '长期做家庭情绪垃圾桶，会耗尽你自己。', action: '今天允许自己有一次不接电话、晚一点回。', duration: '全天' },
      { title: '给内在小孩一句回应', why: '童年缺爱的部分，需要现在的你来接住。', action: '写下："那时候的你，已经做得很好了。"', duration: '10 分钟' },
      { title: '建立支持性关系', why: '新的安全关系，能慢慢改写旧的依恋经验。', action: '和一个让你放松的人待一会儿，不用聊家里的事。', duration: '30 分钟' },
      { title: '复盘：我要把哪些还给他们', why: '把不属于你的责任还回去，内核才会稳。', action: '列出三件你一直替他们背负的事，决定先放下哪一件。', duration: '15 分钟' }
    ]
  },
  worth: {
    title: '停止内耗与自我价值重建 · 7 天',
    focus: '自我价值',
    days: [
      { title: '抓住一次自我审判', why: '先看见"我真没用"出现的瞬间，才可能打断它。', action: '今天记录三次自我否定的念头，只记录，不反驳。', duration: '10 分钟' },
      { title: '用事实回应一次', why: '自我否定是结论，事实是证据。', action: '写下今天做过的一件具体的事，以及它的真实影响。', duration: '10 分钟' },
      { title: '停止一次过度解释', why: '讨好型的人常把"解释"当成保护。', action: '今天挑一件小事，只做决定，不解释原因。', duration: '10 分钟' },
      { title: '允许一次不完美', why: '完美主义是自我否定的放大器。', action: '故意交出一个"80 分"的结果，观察天有没有塌。', duration: '全天' },
      { title: '给自己一次无条件的休息', why: '你的价值不取决于产出。', action: '今天留 20 分钟什么都不做，不学习、不进步。', duration: '20 分钟' },
      { title: '接住一次别人的善意', why: '被否定久了，会本能地推开靠近。', action: '当有人夸你时，只说"谢谢"，不反驳、不贬低自己。', duration: '全天' },
      { title: '复盘：我是谁，不由评价决定', why: '把评价和自我分开，是内核稳定的开始。', action: '写下三件与成绩无关、但你珍视的自己。', duration: '15 分钟' }
    ]
  },
  work: {
    title: '职场内耗止损与能量回收 · 7 天',
    focus: '职场',
    days: [
      { title: '分清能力问题与环境问题', why: '把环境问题背成自我否定，是最耗人的。', action: '写下这周最难受的一件事，标出哪些是你能控制、哪些不能。', duration: '15 分钟' },
      { title: '下班后真正下线', why: '持续在线会让身体一直处在工作警戒状态。', action: '下班后半小时不处理任何工作消息。', duration: '30 分钟' },
      { title: '夺回一个决定权', why: '无力感来自"什么都由别人定"。', action: '今天在一件小事上自己做决定，不征求所有人同意。', duration: '10 分钟' },
      { title: '拒绝一次不合理请求', why: '不拒绝，会持续透支自己。', action: '用一句"我今天排满了，明天可以吗"练习一次。', duration: '10 分钟' },
      { title: '恢复一个能量来源', why: '内耗的人需要主动充电，而不是等放假。', action: '做一件与工作无关、能让你回血的事。', duration: '30 分钟' },
      { title: '和一个人说真话', why: '被听见能降低职场孤立感。', action: '找一个信得过的人，吐槽十分钟，不求建议。', duration: '20 分钟' },
      { title: '复盘：我要的是什么', why: '想清楚去留，比每天内耗更省力。', action: '写下三条：我留下能得到什么、我离开会失去什么、我的底线是什么。', duration: '20 分钟' }
    ]
  },
  study: {
    title: '考试焦虑与专注力修复 · 7 天',
    focus: '学业',
    days: [
      { title: '把任务缩到能启动', why: '焦虑常常卡在"要全部做完"的想象里。', action: '选一个 20 分钟能完成的小块，先开始。', duration: '20 分钟' },
      { title: '练一次专注块', why: '专注力是练回来的，不是逼出来的。', action: '25 分钟只做一件事，走神就画点，然后回来。', duration: '25 分钟' },
      { title: '把结果和人格分开', why: '考不好≠你不行。', action: '写下"这次考试测量的是准备度，不是我的价值"。', duration: '10 分钟' },
      { title: '给身体一次恢复', why: '累到极限时，学习效率会断崖式下降。', action: '今天睡够 7 小时，或补一个 20 分钟午休。', duration: '20 分钟' },
      { title: '处理一次比较心理', why: '同辈压力会偷走注意力。', action: '今天不看别人的进度，只记录自己的一个小完成。', duration: '全天' },
      { title: '模拟一次考试场景', why: '熟悉感能降低临场焦虑。', action: '按考试时间做一小段模拟，只练节奏，不判分。', duration: '30 分钟' },
      { title: '复盘：我需要的不是完美', why: '把"必须考好"换成"尽力就好"，大脑才肯配合。', action: '写下三件这周已经做到的事。', duration: '15 分钟' }
    ]
  }
};

function healingPlan(profile = {}, focusHint = '') {
  const text = `${focusHint} ${profile.psych || ''} ${(profile.tags || []).join(' ')}`;
  let key = 'worth';
  if (/失恋|分手|前任|感情|离婚/.test(text)) key = 'breakup';
  else if (/失眠|睡眠|睡不着|噩梦/.test(text)) key = 'sleep';
  else if (/原生家庭|父母|童年|家庭/.test(text)) key = 'family';
  else if (/焦虑|恐慌|心悸|社恐/.test(text)) key = 'anxiety';
  else if (/工作|职场|领导|同事|辞职/.test(text)) key = 'work';
  else if (/考试|考研|学习|成绩|论文/.test(text)) key = 'study';
  const t = PLAN_THEMES[key];
  return {
    title: t.title,
    focus: t.focus,
    days: t.days.map((d, i) => ({ day: i + 1, ...d, done: false }))
  };
}

function storyMV(profile = {}, data = {}) {
  const nickname = profile.nickname || '你';
  const city = profile.city || '你所在的城市';
  const days = Math.max(1, Number(data.days) || 1);
  const checkins = Number(data.checkins) || 0;
  const planDone = Number(data.planDone) || 0;
  const planTotal = Number(data.planTotal) || 7;
  const memories = (data.memories || []).filter(Boolean);
  const emotions = data.emotions || [];
  const rawQuote = memories.find(m => String(m).length > 10) || '';
  const quote = String(rawQuote).replace(/^用户(说|描述|曾经|最近)?[:：]?/g, '').replace(/^我/g, '').slice(0, 26);
  const lowScore = emotions.length ? Math.min(...emotions.map(e => Number(e.score) || 5)) : 0;
  const lines = [
    { text: '他们只看见你笑着说“没事”', kind: 'verse' },
    { text: `没人知道，你在${city}的夜里，把多少话咽了回去`, kind: 'verse' },
    quote ? { text: `你说过：“${quote}”`, kind: 'verse' } : { text: '你说不清哪里不对，但就是很累', kind: 'verse' },
    { text: '那时候你以为，自己可能真的过不去了', kind: 'verse' },
    { text: '可你没有停在那一夜', kind: 'punch' },
    { text: `第 ${days} 天，${checkins} 次情绪记录，${planDone} / ${planTotal} 次计划打卡`, kind: 'verse' },
    { text: lowScore ? `你从 ${lowScore}/10 的低谷一路走到今天，没有谁替你走` : '每一个很小的动作，加起来就是你没有放弃的证据', kind: 'verse' },
    { text: '你不是玻璃心，你是带着裂缝还在生活的人', kind: 'chorus' },
    { text: '你受过的伤，正在长成你的底气', kind: 'chorus' },
    { text: '别急着向谁证明，你的人生才刚开场', kind: 'chorus' },
    { text: `${nickname}，你不是“还行”，你是大有所为`, kind: 'punch' },
    { text: '把接下来的日子，活成你自己的答案', kind: 'outro' }
  ];
  return {
    title: `${nickname} · 你比想象中更能扛`,
    subtitle: '一段只写给你的成长史',
    bpm: 104,
    lines,
    stats: { days, checkins, planDone, planTotal }
  };
}

module.exports = {
  sleepPlan, dreamAnalysis, encouragement, greeting, report,
  baziReading, tarotReading, drawReading, zenReading,
  places, buddies, documentary, zodiacOf, sunSign, healingPlan, storyMV
};
