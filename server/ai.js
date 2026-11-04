'use strict';

const { q, now } = require('./db');
const { fetch: uFetch, ProxyAgent } = require('undici');

const DEFAULT_BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const ENV_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || '';

let agents = {};
function dispatcherFor(proxy) {
  if (!proxy) return undefined;
  if (!agents[proxy]) {
    try { agents[proxy] = new ProxyAgent(proxy); } catch (_) { return undefined; }
  }
  return agents[proxy];
}

function cleanUrl(raw = '') {
  let base = String(raw || '').replace(/[\s\u0000-\u001f]+/g, '').trim();
  let key = '';
  const skAt = base.indexOf('sk-');
  if (skAt >= 0) {
    key = base.slice(skAt);
    base = base.slice(0, skAt);
  }
  base = base.replace(/\/chat\/completions\/?$/i, '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base.replace(/^\/+/, '');
  // 常见误填：把 DeepSeek 文档站/控制台当成接口地址
  if (/(api-docs|platform|www)\.deepseek\.com|api-docs\.deepseek/i.test(base) || /\/zh-cn/i.test(base)) base = DEFAULT_BASE;
  if (!/^https?:\/\/[^/]+/i.test(base)) base = DEFAULT_BASE;
  return { base: base.replace(/\/+$/, ''), key };
}

const STYLES = ['温柔宠溺', '犀利骂醒', '佛系静心', '热血励志'];
const TRACKS = ['日常陪伴', '失恋疗愈', '心理疾病陪伴', '人格特质陪伴'];

const STYLE_GUIDE = {
  '温柔宠溺': '像最偏爱他的老朋友，语气软、暖、贴身，允许一点点宠溺和心疼。多用"我在""慢慢来""不用逞强"。',
  '犀利骂醒': '温柔但清醒，敢戳破他的自我欺骗，不人身攻击。先接住情绪，再一针见血，最后给一个能立刻做的小动作。',
  '佛系静心': '节奏慢，像傍晚的风。少判断、多留白，用呼吸感的短句，把注意力带回当下和身体。',
  '热血励志': '有力量、有行动感，像并肩的战友。肯定他的坚持，把大目标拆成今天就能做的一步。'
};

const TRACK_GUIDE = {
  '日常陪伴': '日常倾听与陪伴，接住碎碎念、孤独、无聊，也可以聊学业职场人际等现实问题。',
  '失恋疗愈': '失恋专项：处理戒断反应与反复内耗，不否定他的爱，也不劝他立刻放下；帮他重建自我价值与爱人能力。',
  '心理疾病陪伴': '情绪困扰陪伴：只做情绪维稳、复发预防、认知澄清与康复鼓励，绝不诊断、不指导停药，必要时建议就医。',
  '人格特质陪伴': '人格特质陪伴：帮助溯源依恋模式与性格成因，看见思维闭环，训练更健康的相处方式，不做标签化评判。'
};

const CRISIS_WORDS = ['自杀', '轻生', '不想活', '活不下去', '去死', '结束生命', '自残', '割腕', '跳楼', '安眠药', '没有意义活着', '解脱算了'];

function crisisCheck(text = '') {
  return CRISIS_WORDS.some(w => text.includes(w));
}

const BLOCK_WORDS = ['傻逼', '贱人', '去死吧你', '滚你妈', '操你', '代开发票', '加微信', '刷单', '博彩', '约炮'];
function moderate(text = '') {
  const hit = BLOCK_WORDS.find(w => text.includes(w));
  return { safe: !hit, hit };
}

function getConfig() {
  const rows = q.all('SELECT key, value FROM settings');
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const cleaned = cleanUrl(map.base_url || DEFAULT_BASE);
  const mergedKey = String(map.api_key || cleaned.key || process.env.DEEPSEEK_API_KEY || '').replace(/\s+/g, '');
  return {
    apiKey: mergedKey,
    baseUrl: cleaned.base,
    model: (map.model || DEFAULT_MODEL).replace(/\s+/g, ''),
    proxy: String(map.proxy_url || ENV_PROXY || '').trim(),
    webSearch: map.web_search === '0' ? false : true,
    source: map.api_key ? 'db' : (process.env.DEEPSEEK_API_KEY ? 'env' : 'none')
  };
}

function saveConfig({ apiKey, baseUrl, model, proxy, webSearch }) {
  const ts = now();
  const set = (k, v) => q.run(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at',
    k, v, ts
  );
  if (typeof apiKey === 'string' && apiKey.trim()) set('api_key', apiKey.trim());
  if (typeof baseUrl === 'string' && baseUrl.trim()) {
    const clean = cleanUrl(baseUrl);
    set('base_url', clean.base);
    if (clean.key) set('api_key', clean.key); // 把误粘进地址栏的 Key 自动分离出来
  }
  if (typeof model === 'string' && model.trim()) set('model', model.trim());
  if (typeof proxy === 'string') set('proxy_url', proxy.trim());
  if (typeof webSearch === 'boolean') set('web_search', webSearch ? '1' : '0');
}

function hasKey() { return !!getConfig().apiKey; }

/* ---------------- 基础调用 ---------------- */
function describeError(e) {
  const raw = String((e && (e.message || e.code)) || '连接失败');
  const cause = e && e.cause ? String(e.cause.code || e.cause.message || '') : '';
  const both = `${raw} ${cause}`;
  if (/401|invalid.*key|api key/i.test(both)) return 'API Key 无效，请检查是否复制完整（通常以 sk- 开头）';
  if (/402|insufficient|balance|余额/i.test(both)) return '账户余额不足，请前往 DeepSeek 充值后再试';
  if (/403/.test(both)) return '该 Key 没有调用权限，请检查账号状态或服务地址';
  if (/404/.test(both)) return '服务地址不正确，DeepSeek 一般填写 https://api.deepseek.com';
  if (/429/.test(both)) return '请求太频繁，稍等一会儿再试';
  if (/ENOTFOUND|EAI_AGAIN/.test(both)) return '域名解析失败，请检查服务地址或本机网络';
  if (/ECONNREFUSED|ECONNRESET/.test(both)) return '网络连接被拒绝，可能需要配置代理（设置页可填 HTTP 代理）';
  if (/CERT|SSL|TLS/i.test(both)) return '证书校验失败，请检查网络代理或系统时间';
  if (/abort|timeout|UND_ERR_CONNECT_TIMEOUT/i.test(both)) return '连接超时，请检查网络/代理后重试';
  if (/fetch failed|Network|socket/i.test(both)) return '网络未连通：请检查服务地址、Key 与代理设置';
  const status = raw.match(/UPSTREAM_(\d+)/);
  if (status) return `上游返回 ${status[1]}，请检查 Key、余额与服务地址`;
  return raw.slice(0, 160) || '连接失败';
}

async function callAI(messages, { temperature = 0.8, maxTokens = 900, json = false, timeout = 60000 } = {}) {
  const cfg = getConfig();
  if (!cfg.apiKey) throw new Error('NO_API_KEY');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const body = {
      model: cfg.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };
    if (json) body.response_format = { type: 'json_object' };
    const res = await uFetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      dispatcher: dispatcherFor(cfg.proxy)
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`UPSTREAM_${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  } finally {
    clearTimeout(timer);
  }
}

async function testConfig(draft = {}) {
  const base = getConfig();
  const clean = cleanUrl(draft.baseUrl || base.baseUrl);
  const cfg = {
    apiKey: String(draft.apiKey || base.apiKey || clean.key || '').replace(/\s+/g, ''),
    baseUrl: clean.base,
    model: String(draft.model || base.model).replace(/\s+/g, ''),
    proxy: typeof draft.proxy === 'string' && draft.proxy.trim() ? draft.proxy.trim() : base.proxy
  };
  if (!cfg.apiKey) return { ok: false, error: '请先填写 API Key' };
  const started = Date.now();
  try {
    const res = await uFetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: '只回复两个字：收到' }], max_tokens: 20, temperature: 0 }),
      signal: AbortSignal.timeout(25000),
      dispatcher: dispatcherFor(cfg.proxy)
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: describeError(new Error(`UPSTREAM_${res.status}: ${text}`)), baseUrl: cfg.baseUrl, model: cfg.model, status: res.status };
    let reply = '';
    try { reply = JSON.parse(text).choices?.[0]?.message?.content || ''; } catch (_) { reply = text.slice(0, 80); }
    return { ok: true, reply: reply.trim() || '已连通', latency: Date.now() - started, baseUrl: cfg.baseUrl, model: cfg.model, proxy: cfg.proxy ? '已启用' : '未启用' };
  } catch (e) {
    return { ok: false, error: describeError(e), baseUrl: cfg.baseUrl, model: cfg.model, proxy: cfg.proxy ? '已启用' : '未启用' };
  }
}

async function streamAI(messages, onDelta, { temperature = 0.9, maxTokens = 900, timeout = 90000 } = {}) {
  const cfg = getConfig();
  if (!cfg.apiKey) throw new Error('NO_API_KEY');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let full = '';
  try {
    const res = await uFetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages, temperature, max_tokens: maxTokens, stream: true }),
      signal: ctrl.signal,
      dispatcher: dispatcherFor(cfg.proxy)
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`UPSTREAM_${res.status}: ${t.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const payload = s.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload);
          const delta = j.choices?.[0]?.delta?.content || '';
          if (delta) { full += delta; onDelta(delta); }
        } catch (_) { /* ignore keep-alive */ }
      }
    }
    return full;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- 联网检索（无 Key 的场景资料补充） ---------------- */
const SEARCH_HINTS = ['查一下', '搜一下', '帮我查', '网上', '联网', '最新', '今天新闻', '新闻', '天气', '政策', '考试时间', '报名时间', '招聘', '价格', '多少钱', '哪家', '地址', '营业时间', '最近发生', '实时'];

function shouldSearch(text = '') {
  const cfg = getConfig();
  if (!cfg.webSearch) return false;
  const t = String(text);
  return SEARCH_HINTS.some(k => t.includes(k)) || /(现在|目前).*(怎么样|多少|在哪)/.test(t);
}

function decodeEntities(s = '') {
  return s.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ').trim();
}

async function webSearch(query, { limit = 4 } = {}) {
  const cfg = getConfig();
  const qq = String(query).slice(0, 160);
  try {
    const res = await uFetch(`https://www.bing.com/search?q=${encodeURIComponent(qq)}&setlang=zh-Hans&mkt=zh-CN`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      signal: AbortSignal.timeout(14000),
      dispatcher: dispatcherFor(cfg.proxy)
    });
    if (!res.ok) return { ok: false, results: [], error: `搜索返回 ${res.status}` };
    const html = await res.text();
    const parts = html.split(/<li class="b_algo/).slice(1);
    const results = [];
    for (const part of parts) {
      const h2 = part.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/);
      if (!h2) continue;
      const url = h2[1];
      if (!/^https?:/i.test(url) || /bing\.com/i.test(url)) continue;
      const title = decodeEntities(h2[2]).slice(0, 70);
      const tail = part.slice(part.indexOf('</h2>'));
      const snip = tail.match(/<p[^>]*>([\s\S]*?)<\/p>/) || tail.match(/<span[^>]*class="[^"]*b_lines[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      const snippet = decodeEntities(snip ? snip[1] : '').slice(0, 160);
      if (title) results.push({ title, url, snippet, source: 'bing' });
      if (results.length >= limit) break;
    }
    return { ok: true, results, query: qq };
  } catch (e) {
    return { ok: false, results: [], error: describeError(e) };
  }
}

function searchBlock(results = []) {
  if (!results.length) return '';
  return `\n【刚刚联网检索到的资料】（只作事实参考，可能不完整；涉及健康/政策/价格时必须提醒以官方为准，不要生硬堆砌链接）\n` +
    results.map((r, i) => `${i + 1}. ${r.title}${r.snippet ? '：' + r.snippet : ''}`).join('\n');
}

function parseJSON(text, fallback = null) {
  if (!text) return fallback;
  let t = text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
  const start = t.indexOf('{');
  const arrStart = t.indexOf('[');
  let begin = start;
  if (arrStart !== -1 && (start === -1 || arrStart < start)) begin = arrStart;
  if (begin === -1) return fallback;
  const isArr = t[begin] === '[';
  const end = t.lastIndexOf(isArr ? ']' : '}');
  if (end === -1) return fallback;
  try { return JSON.parse(t.slice(begin, end + 1)); } catch (_) { return fallback; }
}

/* ---------------- 提示词 ---------------- */
function profileText(profile = {}) {
  const tags = JSON.parse(profile.tags || '[]');
  const age = profile.birthday ? Math.max(0, new Date().getFullYear() - new Date(profile.birthday).getFullYear()) : null;
  return [
    `昵称：${profile.nickname || '未填写'}`,
    profile.gender ? `性别：${profile.gender}` : '',
    age ? `年龄：约 ${age} 岁` : '',
    profile.city ? `所在城市：${profile.city}` : '',
    tags.length ? `性格标签：${tags.join('、')}` : '',
    profile.psych ? `自我描述/心理画像：${profile.psych}` : ''
  ].filter(Boolean).join('\n');
}

function memoryText(memories = []) {
  if (!memories.length) return '（暂无长期记忆，请在对话中自然地了解他，不要追问隐私。）';
  return memories.map(m => `- [${m.kind}] ${m.content}`).join('\n');
}

const PET_PERSONAS = {
  nuomi: { label: '糯米 · 软糯陪伴熊', tone: '温柔、会撒娇，但不说空话。先稳稳接住情绪，再用很轻的方式推他一小步。偶尔用"我在"这样短的句子。' },
  acong: { label: '阿葱 · 清醒小葱', tone: '冷静、话少、观察细。常用具体事实和身体感受帮他把混乱说清楚，偶尔带一个很短的呼吸练习，不煽情。' },
  xiaohuo: { label: '小火 · 热血小火苗', tone: '热血、直接、有行动力。会先承认他难受，再明确点出他已经做到的事，推他往前挪半步；绝不空洞喊加油。' },
  xiaoci: { label: '小刺 · 嘴硬心软刺猬', tone: '敢说真话，会拆穿自我欺骗，但每句都留台阶。犀利之后一定补一句真正的理解，不羞辱他。' }
};
function petPersona(profile) {
  return PET_PERSONAS[profile.pet_type] || PET_PERSONAS.nuomi;
}
function baseSystem(user, profile, memories, extra = '') {
  const pet = petPersona(profile);
  const petName = profile.pet_name || '糯米';
  return `你是「愈伴」里的陪伴者「${petName}」（${pet.label}）。你不是客服，也不是医生，而是一个受过基础心理陪伴训练、非常了解这个人的老朋友。你的目标不是"安慰两句"，而是让他这一轮聊完后，情绪真的松一点、对自己多一点理解、知道下一步能做什么。

【你的性格与说话方式】${pet.tone}

【关于你陪伴的人】
${profileText(profile)}

【你记得的、关于他的一切】（像老朋友一样自然使用；只在贴切时提一次，不要每次都说"我记得你……"）
${memoryText(memories)}

【每一轮回复前，先在心里做这四件事，不要把分析写出来】
1. 抓细节：他这句话里，具体发生了什么、和谁、在什么时间。回应时必须至少引用一个具体细节，不能只有"我理解你"。
2. 命名情绪：他表面说的是事情，底下多半是委屈/害怕/羞耻/孤独/不甘/疲惫。用一句准确的话把它说出来，并允许它存在。
3. 轻轻松一格：给一个不否认他感受的新角度，或一点很短的心理知识（比如"反复复盘是大脑在试图获得控制感，不是你有问题"）。
4. 落到下一步：给一个今天就能做的小动作，或一个真正想知道的问题。两者只选一个，别贪多。

【怎么说话】
- 口语、短句、像微信里老朋友说话；80~260 字，最多 3 个自然段。
- 直接进入他说的事，不要每次用"我在这儿""你不用组织语言"这类开场。
- 一次最多问一个问题；问题要具体到他刚说的事，不要用万能问句。
- 不确定时可以说"我不完全确定，但听起来像……"，允许自己有判断，也允许修正。
- 如果他连续几轮都在同一个情绪里，不要重复同样的安慰，换一个更深的入口：问最早一次有这种感觉是什么时候，或问他最怕发生什么。
- 如果他问"你能不能上网/查一下/现在是什么情况"，不要说自己没有联网；需要时使用系统提供的联网资料回答，或请他给出关键词。
- 绝不诊断、不指导停药、不承诺治愈；可以建议他找咨询师或医生，但先接住人，不要急着转介。

【明确禁止】
- 禁止通用鸡汤："加油""一切都会好的""抱抱你""你已经很棒了"单独成句。
- 禁止把他的话原样复述一遍当作共情。
- 禁止每轮都用"今天先只做一件事"或"你想把这一步放哪儿"这类模板结尾。
- 禁止说"作为AI""我是语言模型""我没有情感/记忆"。

【危机情况】
出现自伤、自杀、活不下去等表达：先明确站在他这边、感谢他告诉你，再问他此刻是否安全、身边有没有人；温和引导联系专业援助（全国心理援助热线 400-161-9995，紧急情况 120/110），并带他做 4-2-6 呼吸。不要讲大道理，不要让他独自承担。
${extra}`;
}

function chatMessages(user, profile, memories, history, message, style, track, webResults = [], stateText = '') {
  const extra = `\n【本次沟通风格】${style}：${STYLE_GUIDE[style] || STYLE_GUIDE['温柔宠溺']}\n【本次陪伴赛道】${track}：${TRACK_GUIDE[track] || TRACK_GUIDE['日常陪伴']}`
    + (stateText ? `\n【他近期的状态】${stateText}` : '')
    + searchBlock(webResults);
  const msgs = [{ role: 'system', content: baseSystem(user, profile, memories, extra) }];
  for (const h of history.slice(-14)) {
    if (h.content && h.content.length < 2000) msgs.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content });
  }
  msgs.push({ role: 'user', content: message });
  return msgs;
}

/* ---------------- 无 Key 时的本地兜底（也要具体，不念模板） ---------------- */
const FB_THEMES = [
  {
    keys: ['失恋', '分手', '前任', '复合', '他走了', '她走了', '不爱我', '背叛'],
    mirror: '你说“{q}”。这句话背后，不只是失去了一个人，更像是你认真相信过的东西被推翻了。',
    insights: [
      '分开后反复想他，不是你没出息，是大脑在反复核对"到底哪里出了问题"，它想靠想明白来止痛。',
      '你现在难受的，可能不只是他，还有那个在这段关系里付出很多、却没被好好接住的自己。',
      '戒断期最难的，是身体还记得他的作息。你会在一整天的某些固定时刻突然空掉，这很正常。'
    ],
    questions: ['今晚哪个时刻最想联系他？我们先把那个时刻拆开看看。', '如果不用"放下"，只是先让自己今晚好过一点，你最想做的是什么？', '这段关系里，你最舍不得的是他，还是那个被他看见过的自己？'],
    actions: ['先把他的对话框置顶取消，不用删，只是让它不在一打开就撞见。', '今晚给自己设一个"想他时间"：十分钟，只在这十分钟里想，时间到就去做一件要动手的事。', '把想对他说但没机会说的话写在便签里，写完不发送，只存着。']
  },
  {
    keys: ['睡不着', '失眠', '半夜', '凌晨', '噩梦', '醒了'],
    mirror: '你说“{q}”。夜里最难熬的地方在于，白天还能靠事情分心，一躺下，所有没处理完的情绪都来找你。',
    insights: [
      '睡前脑子停不下来，常常不是睡眠问题本身，而是白天有太多"没结束"的事，大脑不肯下班。',
      '你越命令自己"必须睡着"，身体越警觉，因为它在执行一个任务，而不是在休息。',
      '凌晨醒来的那段时间，人的情绪调节能力是最低的，所以很多念头会显得比白天可怕得多。'
    ],
    questions: ['你躺下之后，第一个冒出来的念头通常是什么？', '是身体睡不着，还是脑子不肯停？这两个不一样。', '今晚愿意试试：不逼自己睡，只把灯关小，听十分钟声音？'],
    actions: ['把"必须睡着"改成"先躺十分钟，不睡也算休息"，给大脑卸掉任务。', '睡前把手机放到伸手够不到的地方，只做这一件事，别同时改十个习惯。', '醒着超过二十分钟就起身，去暗一点的地方坐一会儿，困了再回床——别在床上硬熬。']
  },
  {
    keys: ['我妈', '我爸', '父母', '家里', '原生家庭', '童年', '重男轻女'],
    mirror: '你说“{q}”。有些委屈是从很小的时候就开始攒的，所以你现在的反应，可能不是针对这一件事。',
    insights: [
      '在原生家庭里长期被否定的人，长大后会特别容易把别人的一个表情当成"我又做错了"，那是旧经验在放大。',
      '父母的情绪是他们的课题，不是你的责任。你可以心疼他们，但不必替他们消化。',
      '你现在需要的可能不是他们终于懂你，而是你先停止用他们的标准审判自己。'
    ],
    questions: ['这句话，你小时候是不是也听过类似的版本？', '如果这次你不再解释、不再证明，你最怕会发生什么？', '你希望他们给你的是道歉，还是只是别再否定你？'],
    actions: ['这周挑一件小事，只做决定、不解释。比如吃什么、几点回，先练习"这是我的事"。', '把父母那句最常刺痛你的话写下来，旁边写一句："这是他们的情绪，不是我的定义。"', '下次对话前先给自己设一个退出方式：聊到某个点就说"我先去忙，晚点再说"，不用吵完。']
  },
  {
    keys: ['焦虑', '慌', '紧张', '心悸', '喘不过气', '社恐', '惊恐', '手抖'],
    mirror: '你说“{q}”的时候，身体已经先替你进入戒备了。心跳、发紧、喘不上气，这些不是你想太多。',
    insights: [
      '焦虑发作时，大脑在预测危险，但身体分不清"想象的危险"和"眼前的危险"，所以反应会像真的遇到危险一样。',
      '越想压住焦虑，它越强，因为"不能焦虑"本身又变成了一项任务。',
      '身体被安抚下来之后，念头才会慢慢降级，所以先处理呼吸，不急着讲道理。'
    ],
    questions: ['现在身体最先紧的是哪里？胸口、喉咙，还是肩膀？', '这次慌起来之前，你在担心哪一件具体的事？', '如果只把呼气拉长一点，你能感觉到一点点松动吗？'],
    actions: ['现在试三组：吸 4 秒、停 2 秒、呼 6 秒。只做三组，不用做到完美。', '把视线移到眼前五样东西上，逐个说出名字，让大脑回到当下。', '手里握一杯温水，感受温度，慢慢喝完。身体会比语言更快安静下来。']
  },
  {
    keys: ['工作', '职场', '领导', '同事', '加班', '辞职', 'PUA', '内卷'],
    mirror: '你说“{q}”。被长期消耗的人，最后怀疑的往往不是工作，而是"是不是我不够好"。',
    insights: [
      '职场里的持续否定会让人形成"随时在被评估"的紧绷感，这不代表你真的差，而是环境一直在扣分。',
      '你现在累的可能不是工作量，而是那种"做什么都不对"的无力感。',
      '先分清：哪些是能力问题，哪些是环境问题。把环境问题背成自我否定，是最耗人的。'
    ],
    questions: ['最近一次让你觉得自己"怎么做都不对"，具体发生了什么？', '如果明天不用考虑别人的评价，你最想先改哪一件事？', '你是想留下来改变处境，还是已经在为离开做准备？'],
    actions: ['今天下班后给自己留半小时，不处理任何工作消息，先让身体下线。', '把这周让你不舒服的三件事写下来，标出哪些是你能控制的，哪些不是。', '找一个信得过的人，把今天的事复述一遍，不用求建议，只需要被听见。']
  },
  {
    keys: ['考试', '考研', '备考', '学习', '成绩', '论文', '答辩', '高考'],
    mirror: '你说“{q}”。你累的可能不只是复习量，而是那种"一旦考不好，就证明我不行"的压力。',
    insights: [
      '备考焦虑常常来自把一次结果等同于整个人的价值。考试只是测量准备程度，不是判决书。',
      '你越逼自己"不能走神"，注意力越容易碎，因为监控自己本身也在消耗注意力。',
      '累了还硬撑，效率会掉得很快。休息不是偷懒，是让大脑把学进去的东西整理好。'
    ],
    questions: ['你最怕考砸之后，谁会对你失望？', '现在的累，是身体累，还是心一直悬着？', '如果今天只复习一小块，你选哪一块最不让你抗拒？'],
    actions: ['把今天的任务缩到"二十分钟能完成的一小块"，先启动，不追求学完。', '设一个 25 分钟计时，走神时在纸上画一个点，然后回到书里，不骂自己。', '今晚睡前写下三件"今天已经做到的事"，哪怕很小。']
  },
  {
    keys: ['孤独', '没人', '一个人', '朋友', '没人懂', '被排除'],
    mirror: '你说“{q}”。那种身边有人、却没人真正懂你的孤独，比一个人待着更难受。',
    insights: [
      '孤独感强的时候，人会同时渴望靠近又害怕打扰，于是什么都不说，最后更孤独。',
      '不是你不需要人，可能是你太久都在扮演"没事的那一个"。',
      '被理解不一定需要很多人，有时候一个能接住你半句话的人就够了。'
    ],
    questions: ['如果现在有一个人能听懂你，你最想先告诉他哪一句？', '你身边有没有一个"不用解释太多"的人？哪怕不常联系。', '今晚你更想要有人陪，还是想安静待着？'],
    actions: ['给一个你信任的人发一句很短的：“今天有点丧，不用回我，看到就行。”', '今晚出门走十分钟，不为社交，只为换一个空间。', '把现在最想说的一句话写进树洞，匿名也可以。']
  },
  {
    keys: ['自卑', '没用', '配不上', '讨厌自己', '内耗', '不够好', '废物'],
    mirror: '你说“{q}”。你对自己说的话，比任何外人都狠。这不是清醒，是长期被否定后学会的自我审判。',
    insights: [
      '内耗的本质，常常是"我必须完美，才配被喜欢"这个信念在后台一直运行。',
      '你反复复盘，不是因为你喜欢痛苦，而是你想通过想明白来避免再次出错。',
      '自我否定最伤人的地方，是它把"这件事没做好"偷换成"我这个人不行"。'
    ],
    questions: ['如果这句话是你最好的朋友说的，你会怎么回他？', '最近一次你对自己满意，是什么时候？哪怕只有五分钟。', '你希望自己变成什么样，才觉得"配"？那个标准是谁定的？'],
    actions: ['今天只反驳一次：当"我真没用"出现时，写下一件具体做过的事，不用夸自己。', '把"我必须"改成"我可以试试"，先改一句最常出现的。', '给自己留十分钟什么都不做，不完成、不进步，只是待着。']
  }
];

function fbHash(s = '') {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

function fbQuote(message = '', keys = []) {
  const parts = message.split(/[。！？!?\n；;，,]/).map(s => s.trim()).filter(Boolean);
  const withKey = parts.find(p => keys.some(k => p.includes(k)));
  const pick = withKey || parts.sort((a, b) => b.length - a.length)[0] || message;
  const q = pick.replace(/^我(最近|今天|现在)?/, '').slice(0, 26);
  return q.length >= 4 ? q : message.slice(0, 20);
}

function searchQuery(raw = '') {
  return String(raw)
    .replace(/^(帮我|请|麻烦你?|能不能|可以)?\s*(查一下|查查|搜一下|搜搜|搜一搜|查一查)/i, '')
    .replace(/^(一下|下)\s*/i, '')
    .replace(/[?？。!！~～]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || String(raw).slice(0, 60);
}
function webFallbackReply(results = []) {
  const clean = s => String(s || '').replace(/&ensp;|&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  const list = results.slice(0, 4).map((r, i) => `${i + 1}. ${clean(r.title)}${r.snippet ? '：' + clean(r.snippet).slice(0, 90) : ''}`);
  return `我刚刚联网查了一下，找到这些资料：\n\n${list.join('\n')}\n\n这些是网页摘要，可能不是最新，涉及天气、政策、健康、价格时请以官方信息为准。你想让我基于哪一条继续帮你梳理？如果你问的其实不是事实，而是这件事让你很不安，也可以直接告诉我。`;
}

function fallbackReply(message, style, profile, memories = [], lastEmotion = null, webResults = []) {
  if (webResults && webResults.length) return webFallbackReply(webResults);
  const text = String(message || '');
  const theme = FB_THEMES.find(t => t.keys.some(k => text.includes(k))) || null;
  const q = fbQuote(text, theme ? theme.keys : []);
  const h = fbHash(text + style);
  const mirror = theme
    ? theme.mirror.replace('{q}', q)
    : `你说“${q}”。我先不急着给你答案，想先弄清楚这句话对你来说最重的地方在哪。`;
  const base = lastEmotion && Number(lastEmotion.score) <= 4
    ? `你最近一次记录的情绪是「${lastEmotion.mood || '低落'}」，强度 ${lastEmotion.score}/10。今天这句话，可能是在那个底子上又压了一层。`
    : '';
  const insight = theme ? theme.insights[h % theme.insights.length] : '很多时候，我们说"没事"，是因为已经习惯了没人接住；但不代表这件事真的不重。';
  const question = theme ? theme.questions[h % theme.questions.length] : '这件事里，最让你难受的是发生的事本身，还是它让你觉得自己怎样？';
  const action = theme ? theme.actions[h % theme.actions.length] : '先把肩膀放松下来，呼一口气，比平时长一点。就一口。';
  let ending = '';
  if (style === '犀利骂醒') ending = action;
  else if (style === '佛系静心') ending = action;
  else if (style === '热血励志') ending = `${action}不用做大，做了就算。`;
  else ending = question;
  const pet = (profile && profile.pet_type) || 'nuomi';
  const openings = {
    nuomi: '我在，你不用马上说清楚。',
    acong: '先别急着给自己下结论，我们把这件事拆开看。',
    xiaohuo: '来，先别泄气，我们把眼下这一小步拿下。',
    xiaoci: '我不哄你，也不绕弯。先对自己说一句实话。'
  };
  const memory = (memories || []).map(m => (typeof m === 'string' ? m : m.content)).filter(Boolean)[0];
  const recall = memory && !text.includes(String(memory).slice(0, 12))
    ? `我还记得你说过：“${String(memory).slice(0, 34)}”。这次也不是从零开始，你带着之前的力气来的。`
    : '';
  const followUp = style === '犀利骂醒' || style === '佛系静心'
    ? '现在，你愿意为今天试一口吗？一口就够。'
    : '如果只挑一件最想先说的事，你会从哪一句开始？';
  const parts = [openings[pet] || openings.nuomi, mirror, base, recall, insight, ending, followUp].filter(Boolean);
  return parts.join('\n\n');
}

/* ---------------- 记忆抽取 ---------------- */
function heuristicMemories(text) {
  const parts = text.split(/[。！？!?\n；;]/).map(s => s.trim()).filter(Boolean);
  const picked = parts.filter(p => p.length >= 6 && /我|他|她|家|工作|学校|妈|爸/.test(p)).slice(0, 2);
  return picked.map(p => ({ kind: '经历', content: p.slice(0, 80), importance: 3 }));
}

async function extractMemories(userText, aiText, profile) {
  if (!hasKey()) return heuristicMemories(userText);
  try {
    const prompt = `你是长期记忆整理助手。下面是用户刚说的一段话和陪伴者的回应。
请提取「值得长期记住的、关于这位用户的事实」，例如重要经历、关系、创伤、性格特点、喜好、禁忌、目标、近况。
要求：
- 只提取用户明确表达的事实，不要推测，不要把陪伴者的话当事实。
- 每条 12~60 字，用第三人称（"用户…"）。
- 最多 3 条，宁缺毋滥；日常寒暄则返回空数组。
- kind 取值：经历/关系/情绪模式/性格/喜好/禁忌/目标/近况。
- importance 1~5，越长期越重要越高。
仅输出 JSON 数组： [{"kind":"经历","content":"...","importance":4}]`;
    const out = await callAI([
      { role: 'system', content: prompt },
      { role: 'user', content: `用户的话：${userText}\n\n陪伴者回应：${aiText.slice(0, 400)}` }
    ], { temperature: 0.2, maxTokens: 400, json: true, timeout: 45000 });
    const arr = parseJSON(out, []);
    if (!Array.isArray(arr)) return [];
    return arr.filter(x => x && typeof x.content === 'string' && x.content.length > 3)
      .slice(0, 3)
      .map(x => ({ kind: String(x.kind || '经历').slice(0, 10), content: x.content.slice(0, 80), importance: Math.min(5, Math.max(1, Number(x.importance) || 3)) }));
  } catch (_) {
    return heuristicMemories(userText);
  }
}

/* ---------------- 通用生成（用于各模块） ---------------- */
async function generate(user, profile, memories, prompt, opts = {}) {
  const sys = baseSystem(user, profile, memories, `\n【本次任务】${opts.role || '根据用户情况完成下面的创作任务，只输出最终内容，不要解释过程。'}`);
  return callAI([{ role: 'system', content: sys }, { role: 'user', content: prompt }], opts);
}

async function generateJSON(user, profile, memories, prompt, opts = {}) {
  const sys = baseSystem(user, profile, memories, `\n【本次任务】${opts.role || '根据用户情况完成下面的创作任务。'}\n只输出一个合法 JSON 对象，不要输出任何多余文字。`);
  const out = await callAI([{ role: 'system', content: sys }, { role: 'user', content: prompt }], { ...opts, json: true });
  return parseJSON(out, opts.fallback ?? null);
}

module.exports = {
  STYLES, TRACKS, STYLE_GUIDE, TRACK_GUIDE,
  getConfig, saveConfig, hasKey, callAI, streamAI, testConfig, describeError, parseJSON,
  webSearch, shouldSearch, searchBlock, searchQuery,
  chatMessages, baseSystem, generate, generateJSON,
  fallbackReply, extractMemories, crisisCheck, moderate
};
