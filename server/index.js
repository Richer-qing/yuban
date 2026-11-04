'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { q, now, EVENTS } = require('./db');
const ai = require('./ai');
const fb = require('./fallback');
const { SCALES, TAROT, ZEN_CARDS, DRAWS, RESOURCES, COUNSELORS, PLACE_TYPES, CITY_COORDS } = require('./content');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const SAFETY = {
  hotline: '400-161-9995',
  emergency: '120',
  text: '如果你现在有伤害自己的念头，请先不要一个人扛。可以拨打全国心理援助热线 400-161-9995（24 小时），紧急情况请拨打 120。你值得被帮助，也值得被好好对待。'
};

/* ---------------- 基础工具 ---------------- */
const uid = () => crypto.randomBytes(24).toString('hex');
const dayKey = (d = new Date()) => {
  const t = d instanceof Date ? d : new Date(d);
  if (isNaN(t)) return '';
  return new Date(t.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
};
const dayKeyNow = () => dayKey(new Date());
const todayStartISO = () => new Date(`${dayKeyNow()}T00:00:00+08:00`).toISOString();
const maskId = id => id.replace(/(\d{3})\d{4,}(\d{4})/, '$1****$2');

function json(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function fail(res, status, message, code = '') { json(res, status, { ok: false, error: message, code }); }
function ok(res, data) { json(res, 200, { ok: true, data }); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = '';
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 1024 * 1024) { reject(Object.assign(new Error('内容过长'), { status: 413 })); req.destroy(); return; }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (_) { reject(Object.assign(new Error('请求格式错误'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function setSessionCookie(res, token) {
  const maxAge = 30 * 24 * 3600;
  res.setHeader('Set-Cookie', `yb_token=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'yb_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function validIdentifier(id) {
  if (typeof id !== 'string') return false;
  const s = id.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return true;
  return /^1[3-9]\d{9}$/.test(s) || /^\d{6,15}$/.test(s);
}

function isoDaysAgo(days) { return new Date(Date.now() - days * 86400000).toISOString(); }

/* ---------------- 用户与档案 ---------------- */
function getProfile(userId) {
  let p = q.get('SELECT * FROM profiles WHERE user_id = ?', userId);
  if (!p) {
    q.run('INSERT INTO profiles (user_id, updated_at) VALUES (?, ?)', userId, now());
    p = q.get('SELECT * FROM profiles WHERE user_id = ?', userId);
  }
  return p;
}
function shapeProfile(p) {
  return {
    nickname: p.nickname,
    gender: p.gender,
    birthday: p.birthday,
    city: p.city,
    tags: JSON.parse(p.tags || '[]'),
    psych: p.psych,
    style: p.style,
    petName: p.pet_name,
    petType: p.pet_type || 'nuomi',
    updatedAt: p.updated_at
  };
}

function findUserBySession(token) {
  if (!token) return null;
  const s = q.get('SELECT * FROM sessions WHERE token = ?', token);
  if (!s) return null;
  if (new Date(s.expires_at) < new Date()) { q.run('DELETE FROM sessions WHERE token = ?', token); return null; }
  const u = q.get('SELECT * FROM users WHERE id = ?', s.user_id);
  return u || null;
}

function topMemories(userId, limit = 40) {
  return q.all('SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, id DESC LIMIT ?', userId, limit)
    .filter(m => m.content && !m.content.includes('还没有讲述自己的故事'))
    .map(m => ({ ...m }));
}

function addMemories(userId, items) {
  let added = 0;
  for (const it of items) {
    if (!it || !it.content) continue;
    const exists = q.get('SELECT id FROM memories WHERE user_id = ? AND content = ?', userId, it.content);
    if (exists) continue;
    q.run('INSERT INTO memories (user_id, kind, content, importance, created_at) VALUES (?, ?, ?, ?, ?)',
      userId, String(it.kind || '经历').slice(0, 12), String(it.content).slice(0, 120), Number(it.importance) || 3, now());
    added++;
  }
  return added;
}

function messageHistory(userId, limit = 14) {
  return q.all('SELECT role, content, created_at FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?', userId, limit).reverse();
}

function saveMessage(userId, role, content, track = '', style = '') {
  q.run('INSERT INTO messages (user_id, role, content, track, style, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    userId, role, String(content).slice(0, 4000), track, style, now());
}

/* ---------------- 统计 ---------------- */
function statsBundle(userId, days = 30) {
  const since = isoDaysAgo(days);
  const emotions = q.all('SELECT * FROM emotions WHERE user_id = ? AND created_at >= ? ORDER BY created_at ASC', userId, since)
    .map(e => ({ ...e, tags: JSON.parse(e.tags || '[]') }));
  const byDay = new Map();
  for (const e of emotions) {
    const k = dayKey(e.created_at);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e.score);
  }
  const curve = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, arr]) => ({ date, score: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 }));
  const avgMood = curve.length ? Math.round(curve.reduce((a, c) => a + c.score, 0) / curve.length * 10) / 10 : null;
  const half = Math.floor(curve.length / 2);
  const first = curve.slice(0, half);
  const second = curve.slice(half);
  const avg = arr => arr.length ? arr.reduce((a, c) => a + c.score, 0) / arr.length : 0;
  const trend = curve.length >= 4 ? Math.round((avg(second) - avg(first)) * 10) / 10 : 0;
  const tagCount = {};
  for (const e of emotions) for (const t of e.tags) tagCount[t] = (tagCount[t] || 0) + 1;
  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const lateNight = emotions.filter(e => { const h = new Date(e.created_at).getHours() + 8 >= 24 ? (new Date(e.created_at).getHours() + 8) - 24 : new Date(e.created_at).getHours() + 8; return h >= 22 || h < 4; }).length;
  const messages = q.all('SELECT role FROM messages WHERE user_id = ? AND created_at >= ?', userId, since);
  const chats = messages.filter(m => m.role === 'user').length;
  const dreams = q.get('SELECT COUNT(*) AS c FROM dreams WHERE user_id = ? AND created_at >= ?', userId, since).c;
  const assessments = q.all('SELECT * FROM assessments WHERE user_id = ? AND created_at >= ? ORDER BY id ASC', userId, since)
    .map(a => ({ ...a, answers: JSON.parse(a.answers || '[]') }));
  const sleepLogs = q.all('SELECT * FROM sleep_logs WHERE user_id = ? AND created_at >= ? ORDER BY id ASC', userId, since);
  const diaries = q.get('SELECT COUNT(*) AS c FROM diaries WHERE user_id = ? AND created_at >= ?', userId, since).c;
  const avgSleep = sleepLogs.length ? Math.round(sleepLogs.reduce((a, s) => a + s.hours, 0) / sleepLogs.length * 10) / 10 : null;
  return {
    days, emotions, curve, avgMood, trend, topTag,
    checkins: emotions.length, lateNightRatio: emotions.length ? Math.round(lateNight / emotions.length * 100) / 100 : 0,
    chats, dreams, assessments, sleepLogs, diaries, avgSleep
  };
}

function recordStreak(userId) {
  const rows = q.all('SELECT created_at FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 300', userId);
  const diary = q.all('SELECT created_at FROM diaries WHERE user_id = ? ORDER BY id DESC LIMIT 300', userId);
  const set = new Set([...rows, ...diary].map(r => dayKey(r.created_at)));
  let streak = 0;
  const cursor = new Date();
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(dayKey(cursor)) && streak < 400) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const BADGE_DEFS = [
  { code: 'first_note', name: '初次记录', icon: 'sprout', desc: '写下第一种心情，开始看见自己' },
  { code: 'streak3', name: '三日不断', icon: 'flame', desc: '连续 3 天记录情绪或日记' },
  { code: 'streak7', name: '七日微光', icon: 'sun', desc: '连续 7 天照顾自己的感受' },
  { code: 'night_walk', name: '夜行守灯', icon: 'moon', desc: '深夜倾诉或记录，也有人在' },
  { code: 'sleep_guardian', name: '安睡守护', icon: 'cloud', desc: '连续记录睡眠，认真照顾身体的底盘' },
  { code: 'calm_mind', name: '情绪稳定', icon: 'wave', desc: '近 7 天情绪均值不低于 6 分' },
  { code: 'no_rumination', name: '戒断内耗', icon: 'leaf', desc: '内耗自评分数出现下降' },
  { code: 'self_heal', name: '自愈者', icon: 'heart', desc: '和愈伴累计对话 60 轮以上' },
  { code: 'growth', name: '成长复盘', icon: 'book', desc: '完成第一份成长报告' },
  { code: 'true_memory', name: '被记住的人', icon: 'star', desc: '长期记忆累计 10 条以上' }
];

function badges(userId) {
  const streak = recordStreak(userId);
  const emo = q.get('SELECT COUNT(*) AS c FROM emotions WHERE user_id = ?', userId).c;
  const diary = q.get('SELECT COUNT(*) AS c FROM diaries WHERE user_id = ?', userId).c;
  const chats = q.get('SELECT COUNT(*) AS c FROM messages WHERE user_id = ? AND role = ?', userId, 'user').c;
  const sleepLogs = q.get('SELECT COUNT(*) AS c FROM sleep_logs WHERE user_id = ?', userId).c;
  const sleepQ = q.get('SELECT AVG(quality) AS q FROM sleep_logs WHERE user_id = ?', userId).q || 0;
  const dreams = q.get('SELECT COUNT(*) AS c FROM dreams WHERE user_id = ?', userId).c;
  const reports = q.get('SELECT COUNT(*) AS c FROM reports WHERE user_id = ?', userId).c;
  const mems = q.get('SELECT COUNT(*) AS c FROM memories WHERE user_id = ?', userId).c;
  const last7 = statsBundle(userId, 7);
  const rum = q.all("SELECT score FROM assessments WHERE user_id = ? AND scale = 'rumination' ORDER BY id DESC LIMIT 2", userId);
  const earlySleep = q.all("SELECT hours, created_at FROM sleep_logs WHERE user_id = ?", userId).filter(s => s.hours >= 7).length;
  const state = {
    first_note: emo + diary > 0,
    streak3: streak >= 3,
    streak7: streak >= 7,
    night_walk: emo > 0 || q.get("SELECT COUNT(*) AS c FROM messages WHERE user_id = ? AND substr(created_at,12,2) IN ('22','23','00','01','02','03')", userId).c > 0,
    sleep_guardian: sleepLogs >= 3 && sleepQ >= 6 && earlySleep >= 2,
    calm_mind: last7.checkins >= 4 && last7.avgMood !== null && last7.avgMood >= 6,
    no_rumination: rum.length === 2 && rum[0].score < rum[1].score,
    self_heal: chats >= 60,
    growth: reports >= 1,
    true_memory: mems >= 10
  };
  const unlockedRows = q.all('SELECT code, unlocked_at FROM badge_unlocks WHERE user_id = ?', userId);
  const unlockedMap = Object.fromEntries(unlockedRows.map(r => [r.code, r.unlocked_at]));
  const newly = [];
  const list = BADGE_DEFS.map(b => {
    const isOn = !!state[b.code];
    if (isOn && !unlockedMap[b.code]) {
      q.run('INSERT OR IGNORE INTO badge_unlocks (user_id, code, unlocked_at) VALUES (?, ?, ?)', userId, b.code, now());
      newly.push(b.code);
    }
    return {
      ...b,
      unlocked: isOn || !!unlockedMap[b.code],
      unlockedAt: unlockedMap[b.code] || (isOn ? now() : null)
    };
  });
  return { badges: list, unlocked: list.filter(b => b.unlocked).length, total: list.length, newly, streak, counts: { chats, memories: mems, dreams } };
}

/* ---------------- SSE ---------------- */
function sseInit(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('\n');
}
function sseSend(res, obj) {
  try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch (_) { /* closed */ }
}

/* ---------------- 各功能：无 Key 兜底组合 ---------------- */
function prescriptionFallback(stress, moodScore) {
  const high = stress >= 7;
  return {
    title: high ? '高压日 · 最小恢复处方' : '今日 · 温柔续航处方',
    intro: high ? '今天不建议再逼自己高效。目标是把神经系统从警报状态里带出来。' : '状态还行，用小剂量的照顾把能量续上。',
    items: [
      { name: '4-2-6 呼吸', why: '快速降低身体紧张水平', duration: '3 分钟' },
      { name: high ? '靠墙静站或慢走' : '户外散步', why: '让身体先动起来，情绪会跟着松一点', duration: high ? '5 分钟' : '15 分钟' },
      { name: '离开屏幕的一次热水澡', why: '用体感把注意力从脑子带回身体', duration: '15 分钟' },
      { name: '写下一个"今天不做"的决定', why: '减少内耗，把边界画出来', duration: '2 分钟' }
    ],
    food: high ? '今天吃点热的、软的，别空腹喝咖啡。' : '规律吃一顿有蛋白质的饭，别用零食代替正餐。',
    movement: high ? '只做低强度活动，心跳上来就停。' : '20 分钟轻运动，微微出汗即可。',
    rest: '午后给自己 10 分钟闭眼休息，不刷手机。',
    note: '如果持续两周以上处于高压状态，建议寻求专业评估。'
  };
}

function assessmentInsightFallback(scale, level, score, max) {
  const pct = Math.round(score / max * 100);
  const base = {
    mood: ['你在这段时间里承受了不少情绪重量。', '情绪有波动，但还没有完全压垮你。', '你的情绪总体在可控范围内。'],
    anxiety: ['焦虑正在明显占据你的注意力。', '焦虑时不时冒头，已经在消耗你。', '焦虑水平较低，偶有紧张。'],
    rumination: ['内耗和你走得很近，需要主动打断循环。', '你会反复想事情，但还留有余地。', '你的内耗程度较轻。'],
    sleep: ['睡眠问题已经影响到白天。', '睡眠有些不稳，值得认真调整。', '睡眠整体还可以。']
  }[scale] || ['这份量表已经记录下你的状态。'];
  const idx = pct >= 70 ? 0 : pct >= 40 ? 1 : 2;
  const tips = {
    mood: '先保证吃、睡、出门三件事；情绪低到 3 分以下时不做重大决定。',
    anxiety: '每天两次 4-2-6 呼吸，把担忧写下来，限定 15 分钟"担心时间"。',
    rumination: '给反刍设一个时间盒；当发现自己复盘时，用"这不能改变过去"打断它。',
    sleep: '固定起床时间比固定入睡时间更重要；睡前 1 小时远离手机。'
  }[scale] || '保持记录，观察变化。';
  return { insight: `${base[idx]}（本次得分 ${score}/${max}，${level}）`, suggestions: [tips, '把这份结果作为观察自己的起点，而不是给自己贴标签。'], note: '本测评为自我觉察工具，不构成医学诊断。' };
}

/* ---------------- 路由 ---------------- */
const routes = [];
const add = (method, pattern, handler, isPublic = false) => routes.push({ method, re: new RegExp(`^${pattern}$`), handler, isPublic });

/* 认证 */
add('POST', '/api/auth/register', async (req, res) => {
  const { identifier, password, nickname } = await readBody(req);
  if (!validIdentifier(identifier)) return fail(res, 400, '请输入正确的手机号或邮箱');
  if (typeof password !== 'string' || password.length < 6) return fail(res, 400, '密码至少 6 位');
  if (password.length > 64) return fail(res, 400, '密码过长');
  const idf = identifier.trim().toLowerCase();
  const exist = q.get('SELECT id FROM users WHERE identifier = ?', idf);
  if (exist) return fail(res, 409, '该账号已注册，请直接登录');
  const { hash, salt } = hashPassword(password);
  const ts = now();
  const isEmail = idf.includes('@');
  const r = q.run('INSERT INTO users (identifier, phone, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    idf, isEmail ? null : idf, isEmail ? idf : null, hash, salt, ts);
  const userId = Number(r.lastInsertRowid);
  q.run('INSERT INTO profiles (user_id, nickname, city, style, pet_name, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    userId, (nickname || '').slice(0, 20) || '愈伴朋友', '', '温柔宠溺', '糯米', ts);
  const token = uid();
  q.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, new Date(Date.now() + 30 * 86400000).toISOString());
  setSessionCookie(res, token);
  saveMessage(userId, 'assistant', '你好呀，我是糯米。从今天起，你说过的话我都会记得。不用急着介绍自己，我们可以从今天的心情开始聊。', '日常陪伴', '温柔宠溺');
  const user = q.get('SELECT * FROM users WHERE id = ?', userId);
  ok(res, { user: { id: user.id, identifier: user.identifier }, profile: shapeProfile(getProfile(userId)) });
}, true);

add('POST', '/api/auth/login', async (req, res) => {
  const { identifier, password } = await readBody(req);
  if (!identifier || !password) return fail(res, 400, '请输入账号和密码');
  const user = q.get('SELECT * FROM users WHERE identifier = ?', String(identifier).trim().toLowerCase());
  if (!user) return fail(res, 401, '账号或密码不正确');
  const { hash } = hashPassword(String(password), user.password_salt);
  if (hash !== user.password_hash) return fail(res, 401, '账号或密码不正确');
  const token = uid();
  q.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, user.id, new Date(Date.now() + 30 * 86400000).toISOString());
  setSessionCookie(res, token);
  ok(res, { user: { id: user.id, identifier: user.identifier }, profile: shapeProfile(getProfile(user.id)) });
}, true);

add('POST', '/api/auth/logout', async (req, res, ctx) => {
  if (ctx.token) q.run('DELETE FROM sessions WHERE token = ?', ctx.token);
  clearSessionCookie(res);
  ok(res, { loggedOut: true });
}, true);

add('GET', '/api/auth/me', async (req, res, ctx) => {
  if (!ctx.user) return fail(res, 401, '未登录');
  ok(res, {
    user: { id: ctx.user.id, identifier: ctx.user.identifier, createdAt: ctx.user.created_at },
    profile: shapeProfile(ctx.profile)
  });
}, true);

add('POST', '/api/auth/reset/request', async (req, res) => {
  const { identifier } = await readBody(req);
  if (!validIdentifier(identifier)) return fail(res, 400, '请输入正确的手机号或邮箱');
  const idf = String(identifier).trim().toLowerCase();
  const user = q.get('SELECT id FROM users WHERE identifier = ?', idf);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  if (user) {
    q.run('DELETE FROM password_resets WHERE identifier = ?', idf);
    q.run('INSERT INTO password_resets (identifier, code, expires_at) VALUES (?, ?, ?)', idf, code, new Date(Date.now() + 10 * 60000).toISOString());
  }
  ok(res, {
    sent: true,
    hint: '演示环境：短信/邮件通道未接入，验证码直接返回并由页面展示。',
    devCode: user ? code : null
  });
}, true);

add('POST', '/api/auth/reset/confirm', async (req, res) => {
  const { identifier, code, password } = await readBody(req);
  if (!validIdentifier(identifier) || !code || !password) return fail(res, 400, '参数不完整');
  if (String(password).length < 6) return fail(res, 400, '密码至少 6 位');
  const idf = String(identifier).trim().toLowerCase();
  const rec = q.get('SELECT * FROM password_resets WHERE identifier = ? AND code = ? ORDER BY id DESC LIMIT 1', idf, String(code));
  if (!rec || new Date(rec.expires_at) < new Date()) return fail(res, 400, '验证码无效或已过期');
  const user = q.get('SELECT * FROM users WHERE identifier = ?', idf);
  if (!user) return fail(res, 404, '账号不存在');
  const { hash, salt } = hashPassword(password);
  q.run('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?', hash, salt, user.id);
  q.run('DELETE FROM password_resets WHERE identifier = ?', idf);
  q.run('DELETE FROM sessions WHERE user_id = ?', user.id);
  ok(res, { reset: true });
}, true);

/* 档案 */
add('GET', '/api/profile', async (req, res, ctx) => ok(res, shapeProfile(ctx.profile)));

add('PUT', '/api/profile', async (req, res, ctx) => {
  const b = await readBody(req);
  const p = ctx.profile;
  const nickname = typeof b.nickname === 'string' ? b.nickname.trim().slice(0, 20) : p.nickname;
  const gender = ['', '女', '男', '其他', '不透露'].includes(b.gender) ? b.gender : p.gender;
  const birthday = typeof b.birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.birthday) ? b.birthday : p.birthday;
  const city = typeof b.city === 'string' ? b.city.trim().slice(0, 20) : p.city;
  const tags = Array.isArray(b.tags) ? b.tags.filter(t => typeof t === 'string').slice(0, 8).map(t => t.slice(0, 12)) : JSON.parse(p.tags || '[]');
  const psych = typeof b.psych === 'string' ? b.psych.trim().slice(0, 1200) : p.psych;
  const style = ai.STYLES.includes(b.style) ? b.style : p.style;
  const petName = typeof b.petName === 'string' && b.petName.trim() ? b.petName.trim().slice(0, 12) : p.pet_name;
  const petType = ['nuomi', 'acong', 'xiaohuo', 'xiaoci'].includes(b.petType) ? b.petType : (p.pet_type || 'nuomi');
  q.run('UPDATE profiles SET nickname=?, gender=?, birthday=?, city=?, tags=?, psych=?, style=?, pet_name=?, pet_type=?, updated_at=? WHERE user_id=?',
    nickname || '愈伴朋友', gender, birthday, city, JSON.stringify(tags), psych, style, petName, petType, now(), ctx.user.id);
  const updated = shapeProfile(getProfile(ctx.user.id));
  if (psych && psych.length > 8) {
    const exists = q.get("SELECT id FROM memories WHERE user_id = ? AND kind = '自我描述'", ctx.user.id);
    if (!exists) q.run('INSERT INTO memories (user_id, kind, content, importance, created_at) VALUES (?, ?, ?, ?, ?)',
      ctx.user.id, '自我描述', `用户这样描述自己：${psych.slice(0, 80)}`, 4, now());
  }
  ok(res, updated);
});

/* 认识你 · 初次个性化 + 7 天疗愈计划 */
function planPayload(row) {
  if (!row) return null;
  let days = [];
  let progress = [];
  try { days = JSON.parse(row.days || '[]'); } catch (_) { days = []; }
  try { progress = JSON.parse(row.progress || '[]'); } catch (_) { progress = []; }
  days = days.map(d => ({ ...d, done: progress.includes(d.day) }));
  const today = days.find(d => !d.done) || null;
  return { id: row.id, title: row.title, focus: row.focus, days, progress, today, createdAt: row.created_at };
}

function currentPlan(userId) {
  return planPayload(q.get('SELECT * FROM plans WHERE user_id = ? ORDER BY id DESC LIMIT 1', userId));
}

async function createPlan(userId, profile, focusHint = '') {
  let plan = null;
  if (ai.hasKey()) {
    try {
      const raw = await ai.generateJSON({ id: userId }, profile, topMemories(userId, 10),
        `请为一位正在寻求心理疗愈的中文用户设计一份 7 天个性化疗愈计划。
用户档案：${JSON.stringify(profile)}
最近困扰：${focusHint || profile.psych || '未明确'}
要求：温和、具体、可执行，每天只安排一个小任务（10~30 分钟）；不许诊断、不许承诺治愈、不涉及吉凶命理。语气像一位训练有素的陪伴者。
只输出 JSON：{"title":"计划名","focus":"主题","days":[{"day":1,"title":"小标题","why":"为什么做","action":"今天具体做什么","duration":"10 分钟"}]}，必须正好 7 天。`,
        { temperature: 0.7, maxTokens: 900 }
      );
      if (raw && Array.isArray(raw.days) && raw.days.length >= 6) {
        plan = {
          title: String(raw.title || '我的 7 天疗愈计划').slice(0, 40),
          focus: String(raw.focus || '').slice(0, 20),
          days: raw.days.slice(0, 7).map((d, i) => ({
            day: i + 1,
            title: String(d.title || `第 ${i + 1} 天`).slice(0, 30),
            why: String(d.why || '').slice(0, 100),
            action: String(d.action || '').slice(0, 160),
            duration: String(d.duration || '15 分钟').slice(0, 12)
          }))
        };
      }
    } catch (e) { console.warn('[plan] AI 生成失败，使用本地计划', e.message); }
  }
  if (!plan) plan = fb.healingPlan(profile, focusHint);
  q.run('DELETE FROM plans WHERE user_id = ?', userId);
  q.run('INSERT INTO plans (user_id, title, focus, days, progress, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    userId, plan.title, plan.focus, JSON.stringify(plan.days.map(d => ({ ...d, done: undefined }))), '[]', now(), now());
  return currentPlan(userId);
}

add('GET', '/api/plan', async (req, res, ctx) => ok(res, { plan: currentPlan(ctx.user.id) }));

add('POST', '/api/plan/generate', async (req, res, ctx) => {
  const b = await readBody(req);
  const plan = await createPlan(ctx.user.id, shapeProfile(ctx.profile), typeof b.focus === 'string' ? b.focus.slice(0, 120) : '');
  ok(res, { plan });
});

add('POST', '/api/plan/complete', async (req, res, ctx) => {
  const b = await readBody(req);
  const day = Number(b.day);
  const row = q.get('SELECT * FROM plans WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  if (!row) return fail(res, 404, '还没有疗愈计划');
  if (!day || day < 1 || day > 7) return fail(res, 400, '天数不正确');
  let progress = [];
  try { progress = JSON.parse(row.progress || '[]'); } catch (_) { progress = []; }
  const done = typeof b.done === 'boolean' ? b.done : true;
  progress = done ? Array.from(new Set([...progress, day])) : progress.filter(d => d !== day);
  q.run('UPDATE plans SET progress = ?, updated_at = ? WHERE id = ?', JSON.stringify(progress), now(), row.id);
  ok(res, { plan: currentPlan(ctx.user.id) });
});

add('POST', '/api/onboarding', async (req, res, ctx) => {
  const b = await readBody(req);
  const p = ctx.profile;
  const nickname = typeof b.nickname === 'string' && b.nickname.trim() ? b.nickname.trim().slice(0, 20) : p.nickname;
  const city = typeof b.city === 'string' ? b.city.trim().slice(0, 20) : p.city;
  const style = ai.STYLES.includes(b.style) ? b.style : p.style;
  const struggle = typeof b.struggle === 'string' ? b.struggle.trim().slice(0, 200) : '';
  const avoid = typeof b.avoid === 'string' ? b.avoid.trim().slice(0, 120) : '';
  const sleep = typeof b.sleep === 'string' ? b.sleep.trim().slice(0, 60) : '';
  const psych = [struggle, avoid ? `不希望被这样对待：${avoid}` : '', sleep ? `睡眠状态：${sleep}` : ''].filter(Boolean).join('；').slice(0, 1200);
  q.run('UPDATE profiles SET nickname=?, city=?, style=?, psych=?, updated_at=? WHERE user_id=?',
    nickname || '愈伴朋友', city, style, psych, now(), ctx.user.id);
  addMemories(ctx.user.id, [
    struggle ? { kind: '近况', content: `最近最困扰他的是：${struggle}`, importance: 5 } : null,
    avoid ? { kind: '禁忌', content: `不希望被这样对待：${avoid}`, importance: 4 } : null,
    sleep ? { kind: '身体', content: `睡眠状态：${sleep}`, importance: 3 } : null
  ].filter(Boolean));
  const plan = await createPlan(ctx.user.id, shapeProfile(getProfile(ctx.user.id)), struggle);
  ok(res, { profile: shapeProfile(getProfile(ctx.user.id)), plan, memoriesAdded: Math.min(3, [struggle, avoid, sleep].filter(Boolean).length) });
});

/* 记忆库 */
add('GET', '/api/memories', async (req, res, ctx) => {
  const list = q.all('SELECT id, kind, content, importance, created_at FROM memories WHERE user_id = ? ORDER BY importance DESC, id DESC LIMIT 120', ctx.user.id);
  ok(res, { memories: list, count: q.get('SELECT COUNT(*) AS c FROM memories WHERE user_id = ?', ctx.user.id).c });
});

add('POST', '/api/memories', async (req, res, ctx) => {
  const b = await readBody(req);
  if (!b.content || String(b.content).trim().length < 2) return fail(res, 400, '内容太短');
  q.run('INSERT INTO memories (user_id, kind, content, importance, created_at) VALUES (?, ?, ?, ?, ?)',
    ctx.user.id, String(b.kind || '经历').slice(0, 12), String(b.content).trim().slice(0, 120), Number(b.importance) || 3, now());
  ok(res, { added: true });
});

add('DELETE', '/api/memories/(\\d+)', async (req, res, ctx, m) => {
  const r = q.run('DELETE FROM memories WHERE id = ? AND user_id = ?', Number(m[1]), ctx.user.id);
  if (!r.changes) return fail(res, 404, '记忆不存在');
  ok(res, { deleted: true });
});

/* 对话 */
function chatState(userId) {
  const emotions = q.all('SELECT mood, score, tags, note, created_at FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 3', userId);
  const lastAssessment = q.get('SELECT scale, score, level, created_at FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT 1', userId);
  const parts = [];
  if (emotions.length) {
    parts.push('最近情绪记录：' + emotions.map(e => `${e.mood || '未标注'}${e.score}/10${e.note ? `（${String(e.note).slice(0, 30)}）` : ''}`).join('；'));
  }
  if (lastAssessment) parts.push(`最近一次${lastAssessment.scale}自评：${lastAssessment.score} 分，${lastAssessment.level || ''}`);
  const streak = q.get('SELECT COUNT(*) AS c FROM emotions WHERE user_id = ? AND created_at >= ?', userId, isoDaysAgo(7)).c;
  parts.push(`近 7 天有 ${streak} 次情绪打卡`);
  return parts.join('。');
}

function prepareChat(ctx, b) {
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (!message) return { error: '说点什么吧' };
  if (message.length > 2000) return { error: '一次最多 2000 字，可以分几次说' };
  const style = ai.STYLES.includes(b.style) ? b.style : ctx.profile.style;
  const track = ai.TRACKS.includes(b.track) ? b.track : '日常陪伴';
  const lastEmotion = q.get('SELECT * FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id) || null;
  return {
    message, style, track,
    memories: topMemories(ctx.user.id), history: messageHistory(ctx.user.id, 14),
    crisis: ai.crisisCheck(message), lastEmotion, stateText: chatState(ctx.user.id)
  };
}

add('POST', '/api/chat', async (req, res, ctx) => {
  const b = await readBody(req);
  const c = prepareChat(ctx, b);
  if (c.error) return fail(res, 400, c.error);
  saveMessage(ctx.user.id, 'user', c.message, c.track, c.style);
  let reply = '';
  let demo = false;
  let web = null;
  let demoReason = '';
  try {
    if (ai.shouldSearch(c.message)) {
      web = await ai.webSearch(ai.searchQuery(c.message));
    }
    reply = await ai.callAI(ai.chatMessages(ctx.user, ctx.profile, c.memories, c.history, c.message, c.style, c.track, web?.results || [], c.stateText), { temperature: 0.85, maxTokens: 900 });
    if (!reply) throw new Error('EMPTY');
  } catch (e) {
    demo = true;
    demoReason = ai.hasKey() ? ai.describeError(e) : '未配置大模型 Key，当前为本地陪伴模式';
    reply = ai.fallbackReply(c.message, c.style, ctx.profile, c.memories, c.lastEmotion, web?.results || []);
  }
  saveMessage(ctx.user.id, 'assistant', reply, c.track, c.style);
  const added = await ai.extractMemories(c.message, reply, ctx.profile);
  addMemories(ctx.user.id, added);
  ok(res, { reply, demo, crisis: c.crisis, safety: c.crisis ? SAFETY : null, web: web?.results || [], demoReason });
});

add('POST', '/api/chat/stream', async (req, res, ctx) => {
  const b = await readBody(req);
  const c = prepareChat(ctx, b);
  if (c.error) return fail(res, 400, c.error);
  saveMessage(ctx.user.id, 'user', c.message, c.track, c.style);
  sseInit(res);
  sseSend(res, { type: 'start', demo: !ai.hasKey() });
  let web = null;
  if (ai.shouldSearch(c.message)) {
    sseSend(res, { type: 'searching' });
    try {
      web = await ai.webSearch(ai.searchQuery(c.message));
      if (web.results.length) sseSend(res, { type: 'web', results: web.results });
    } catch (_) { /* 检索失败不打断对话 */ }
  }
  let full = '';
  try {
    full = await ai.streamAI(
      ai.chatMessages(ctx.user, ctx.profile, c.memories, c.history, c.message, c.style, c.track, web?.results || [], c.stateText),
      delta => sseSend(res, { type: 'delta', text: delta }),
      { temperature: 0.85, maxTokens: 900 }
    );
    if (!full) throw new Error('EMPTY');
  } catch (e) {
    const reason = ai.hasKey() ? ai.describeError(e) : '未配置大模型 Key，当前为本地陪伴模式';
    sseSend(res, { type: 'fallback', reason });
    full = ai.fallbackReply(c.message, c.style, ctx.profile, c.memories, c.lastEmotion, web?.results || []);
    for (const chunk of full.match(/.{1,24}/gs) || [full]) {
      sseSend(res, { type: 'delta', text: chunk });
      await new Promise(r => setTimeout(r, 70));
    }
  }
  saveMessage(ctx.user.id, 'assistant', full, c.track, c.style);
  let memoryItems = [];
  try {
    const items = await ai.extractMemories(c.message, full, ctx.profile);
    const added = addMemories(ctx.user.id, items);
    if (added) memoryItems = items.slice(0, added);
  } catch (_) { /* ignore */ }
  if (c.crisis) sseSend(res, { type: 'safety', data: SAFETY });
  sseSend(res, { type: 'done', full, memory: memoryItems, crisis: c.crisis, memoryCount: q.get('SELECT COUNT(*) AS c FROM memories WHERE user_id = ?', ctx.user.id).c });
  res.end();
});

add('GET', '/api/chat/history', async (req, res, ctx, m, url) => {
  const limit = Math.min(100, Number(url.searchParams.get('limit')) || 60);
  const list = q.all('SELECT id, role, content, track, style, created_at FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?', ctx.user.id, limit).reverse();
  ok(res, { messages: list });
});

add('GET', '/api/companion/greeting', async (req, res, ctx) => {
  const key = `greeting:${ctx.user.id}:${dayKeyNow()}`;
  const cached = q.get('SELECT value FROM settings WHERE key = ?', key);
  if (cached) return ok(res, { text: cached.value, cached: true });
  const last = q.get('SELECT * FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  let text = '';
  if (ai.hasKey()) {
    try {
      text = await ai.generate(ctx.user, ctx.profile, topMemories(ctx.user.id, 20), `请以陪伴萌宠「${ctx.profile.pet_name || '糯米'}」的口吻，写一段主动问候（80~140 字）。
当前时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}。
用户最近一次情绪记录：${last ? `${last.mood}，强度 ${last.score}/10，备注：${last.note || '无'}` : '暂无'}。
要求：自然、不模板化、不追问隐私；如果最近情绪偏低，先安抚、不催振作；最后最多问一个轻问题。只输出问候语本身。`, { temperature: 0.9, maxTokens: 300 });
    } catch (_) { text = ''; }
  }
  if (!text) text = fb.greeting(ctx.profile, last, (new Date().getUTCHours() + 8) % 24);
  q.run('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at', key, text, now());
  ok(res, { text, cached: false, lastEmotion: last || null });
});

/* 情绪与日记 */
add('POST', '/api/emotions', async (req, res, ctx) => {
  const b = await readBody(req);
  const score = Number(b.score);
  if (!Number.isFinite(score) || score < 1 || score > 10) return fail(res, 400, '情绪强度需在 1-10 之间');
  const tags = Array.isArray(b.tags) ? b.tags.filter(t => typeof t === 'string').slice(0, 5).map(t => t.slice(0, 10)) : [];
  q.run('INSERT INTO emotions (user_id, score, mood, tags, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ctx.user.id, Math.round(score), String(b.mood || '').slice(0, 20), JSON.stringify(tags), String(b.note || '').slice(0, 500), now());
  const streak = recordStreak(ctx.user.id);
  ok(res, { saved: true, streak });
});

add('GET', '/api/emotions', async (req, res, ctx, m, url) => {
  const days = Math.min(180, Number(url.searchParams.get('days')) || 30);
  const list = q.all('SELECT * FROM emotions WHERE user_id = ? AND created_at >= ? ORDER BY id DESC LIMIT 200', ctx.user.id, isoDaysAgo(days))
    .map(e => ({ ...e, tags: JSON.parse(e.tags || '[]') }));
  ok(res, { emotions: list });
});

add('GET', '/api/emotions/stats', async (req, res, ctx, m, url) => {
  const days = Math.min(90, Number(url.searchParams.get('days')) || 30);
  const s = statsBundle(ctx.user.id, days);
  ok(res, { curve: s.curve, avgMood: s.avgMood, topTag: s.topTag, checkins: s.checkins, trend: s.trend, lateNightRatio: s.lateNightRatio, streak: recordStreak(ctx.user.id) });
});

add('GET', '/api/diaries', async (req, res, ctx) => {
  ok(res, { diaries: q.all('SELECT * FROM diaries WHERE user_id = ? ORDER BY id DESC LIMIT 100', ctx.user.id) });
});

add('POST', '/api/diaries', async (req, res, ctx) => {
  const b = await readBody(req);
  const content = String(b.content || '').trim();
  if (content.length < 2) return fail(res, 400, '写点什么吧');
  if (content.length > 2000) return fail(res, 400, '日记最多 2000 字');
  q.run('INSERT INTO diaries (user_id, title, content, mood, created_at) VALUES (?, ?, ?, ?, ?)',
    ctx.user.id, String(b.title || '').slice(0, 40), content, String(b.mood || '').slice(0, 20), now());
  ok(res, { saved: true, strength: recordStreak(ctx.user.id) });
});

add('DELETE', '/api/diaries/(\\d+)', async (req, res, ctx, m) => {
  const r = q.run('DELETE FROM diaries WHERE id = ? AND user_id = ?', Number(m[1]), ctx.user.id);
  if (!r.changes) return fail(res, 404, '日记不存在');
  ok(res, { deleted: true });
});

add('GET', '/api/badges', async (req, res, ctx) => ok(res, badges(ctx.user.id)));

/* 树洞 */
const ALIAS_WORDS = ['夜航的鲸', '无声的海', '拾光的人', '慢慢走', '柚子味的云', '晚风里的灯', '一颗青柠', '无名花', '榕树下', '守夜人', '北纬的风', '安静的树'];
function aliasFor(userId, salt = '') {
  const n = Math.abs(userId + salt.length);
  return ALIAS_WORDS[n % ALIAS_WORDS.length];
}

add('GET', '/api/treehole', async (req, res, ctx, m, url) => {
  const limit = Math.min(60, Number(url.searchParams.get('limit')) || 30);
  const posts = q.all('SELECT * FROM posts ORDER BY id DESC LIMIT ?', limit);
  const ids = posts.map(p => p.id);
  let replies = [];
  if (ids.length) replies = q.all(`SELECT * FROM replies WHERE post_id IN (${ids.map(() => '?').join(',')}) ORDER BY id ASC`, ...ids);
  ok(res, {
    posts: posts.map(p => ({
      id: p.id, alias: p.alias, content: p.content, createdAt: p.created_at, seed: !!p.seed, mine: p.user_id === ctx.user.id,
      replies: replies.filter(r => r.post_id === p.id).map(r => ({ id: r.id, alias: r.alias, content: r.content, createdAt: r.created_at, mine: r.user_id === ctx.user.id }))
    }))
  });
});

add('POST', '/api/treehole', async (req, res, ctx) => {
  const b = await readBody(req);
  const content = String(b.content || '').trim();
  if (content.length < 5) return fail(res, 400, '至少写 5 个字');
  if (content.length > 500) return fail(res, 400, '树洞最多 500 字');
  const mod = ai.moderate(content);
  if (!mod.safe) return fail(res, 400, '这段话包含攻击性内容，树洞只接收真实的感受，不接收伤害他人的话');
  const crisis = ai.crisisCheck(content);
  const alias = String(b.alias || '').slice(0, 12) || aliasFor(ctx.user.id, dayKeyNow());
  q.run('INSERT INTO posts (user_id, alias, content, seed, created_at) VALUES (?, ?, ?, 0, ?)', ctx.user.id, alias, content, now());
  ok(res, { posted: true, crisis, safety: crisis ? SAFETY : null });
});

add('POST', '/api/treehole/(\\d+)/reply', async (req, res, ctx, m) => {
  const b = await readBody(req);
  const content = String(b.content || '').trim();
  if (content.length < 2) return fail(res, 400, '留言太短');
  if (content.length > 300) return fail(res, 400, '留言最多 300 字');
  const mod = ai.moderate(content);
  if (!mod.safe) return fail(res, 400, '请用温柔的方式留言');
  const post = q.get('SELECT id FROM posts WHERE id = ?', Number(m[1]));
  if (!post) return fail(res, 404, '树洞不存在');
  const alias = String(b.alias || '').slice(0, 12) || aliasFor(ctx.user.id, String(Date.now()));
  q.run('INSERT INTO replies (post_id, user_id, alias, content, seed, created_at) VALUES (?, ?, ?, ?, 0, ?)', Number(m[1]), ctx.user.id, alias, content, now());
  ok(res, { replied: true });
});

/* 助眠 */
add('GET', '/api/sleep/overview', async (req, res, ctx) => {
  const plans = q.all('SELECT id, stress, plan, created_at FROM sleep_plans WHERE user_id = ? ORDER BY id DESC LIMIT 5', ctx.user.id)
    .map(p => ({ id: p.id, stress: p.stress, createdAt: p.created_at, plan: JSON.parse(p.plan) }));
  const logs = q.all('SELECT * FROM sleep_logs WHERE user_id = ? ORDER BY id DESC LIMIT 14', ctx.user.id);
  const avgHours = logs.length ? Math.round(logs.reduce((a, l) => a + l.hours, 0) / logs.length * 10) / 10 : null;
  const avgQuality = logs.length ? Math.round(logs.reduce((a, l) => a + l.quality, 0) / logs.length * 10) / 10 : null;
  const avgWake = logs.length ? Math.round(logs.reduce((a, l) => a + l.wake, 0) / logs.length * 10) / 10 : null;
  const lastEmotion = q.get('SELECT * FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  ok(res, { plans, logs, avgHours, avgQuality, avgWake, lastEmotion: lastEmotion || null });
});

add('POST', '/api/sleep/plan', async (req, res, ctx) => {
  const b = await readBody(req);
  const stress = Math.min(10, Math.max(1, Number(b.stress) || 5));
  const last = q.get('SELECT * FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  let plan = fb.sleepPlan(ctx.profile, stress, last?.mood || '');
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 20),
        `请为用户生成一份今晚的个性化入睡方案。用户自评压力值 ${stress}/10，最近情绪：${last ? `${last.mood} ${last.score}/10，${last.note || ''}` : '暂无'}。
输出 JSON：{"title":"标题","intro":"60字内说明","steps":[{"time":"睡前XX分钟","title":"动作名","detail":"40字内具体做法"}],"sound":"rain|stream|night","note":"一句温和提醒"}。
要求：4 个步骤，从环境、身体、情绪、呼吸四个角度，具体可执行，不要说教。`,
        { temperature: 0.7, maxTokens: 700, fallback: plan });
      if (gen && Array.isArray(gen.steps) && gen.steps.length) plan = gen;
    } catch (_) { /* use fallback */ }
  }
  const r = q.run('INSERT INTO sleep_plans (user_id, stress, plan, created_at) VALUES (?, ?, ?, ?)', ctx.user.id, stress, JSON.stringify(plan), now());
  ok(res, { id: Number(r.lastInsertRowid), plan, demo: !ai.hasKey() });
});

add('POST', '/api/sleep/log', async (req, res, ctx) => {
  const b = await readBody(req);
  const hours = Math.min(16, Math.max(0, Number(b.hours) || 0));
  const quality = Math.min(10, Math.max(1, Number(b.quality) || 5));
  const wake = Math.min(20, Math.max(0, Number(b.wake) || 0));
  q.run('INSERT INTO sleep_logs (user_id, hours, quality, wake, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ctx.user.id, hours, quality, wake, String(b.note || '').slice(0, 200), now());
  ok(res, { saved: true });
});

/* 解梦 */
add('GET', '/api/dreams', async (req, res, ctx) => {
  const list = q.all('SELECT * FROM dreams WHERE user_id = ? ORDER BY id DESC LIMIT 50', ctx.user.id)
    .map(d => ({ ...d, analysis: d.analysis ? JSON.parse(d.analysis) : null, symbols: JSON.parse(d.symbols || '[]') }));
  const recent = list.filter(d => new Date(d.created_at) >= new Date(Date.now() - 30 * 86400000));
  const symbolCount = {};
  for (const d of recent) for (const s of d.symbols) symbolCount[s.name || s] = (symbolCount[s.name || s] || 0) + 1;
  ok(res, { dreams: list, summary: { total: recent.length, symbols: Object.entries(symbolCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })) } });
});

add('POST', '/api/dreams', async (req, res, ctx) => {
  const b = await readBody(req);
  const content = String(b.content || '').trim();
  if (content.length < 5) return fail(res, 400, '梦的内容太短');
  if (content.length > 1500) return fail(res, 400, '梦境最多 1500 字');
  let analysis = fb.dreamAnalysis(content, ctx.profile);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 20),
        `请对用户的梦境做潜意识心理分析（不是解梦预测，不涉吉凶）。
梦境内容：${content}
输出 JSON：{"title":"标题（10字内）","symbols":[{"name":"意象","meaning":"心理学角度的含义，40字内"}],"hidden":"可能隐藏的情绪或未释怀的心结，80字内","comfort":"安抚性解读，60字内","suggestion":"今晚可做的一件小事","note":"合规声明"}。
要求：结合用户性格与近期状态；2~3 个意象；温柔、具体、不诊断。`,
        { temperature: 0.6, maxTokens: 900, fallback: analysis });
      if (gen && Array.isArray(gen.symbols)) analysis = gen;
    } catch (_) { /* fallback */ }
  }
  const r = q.run('INSERT INTO dreams (user_id, content, analysis, symbols, created_at) VALUES (?, ?, ?, ?, ?)',
    ctx.user.id, content, JSON.stringify(analysis), JSON.stringify(analysis.symbols || []), now());
  const dream = q.get('SELECT * FROM dreams WHERE id = ?', Number(r.lastInsertRowid));
  ok(res, { dream: { ...dream, analysis, symbols: analysis.symbols || [] }, demo: !ai.hasKey() });
});

add('POST', '/api/dreams/(\\d+)/analyze', async (req, res, ctx, m) => {
  const d = q.get('SELECT * FROM dreams WHERE id = ? AND user_id = ?', Number(m[1]), ctx.user.id);
  if (!d) return fail(res, 404, '梦境不存在');
  const analysis = fb.dreamAnalysis(d.content, ctx.profile);
  q.run('UPDATE dreams SET analysis = ?, symbols = ? WHERE id = ?', JSON.stringify(analysis), JSON.stringify(analysis.symbols || []), d.id);
  ok(res, { analysis, demo: true });
});

/* 测评 */
add('GET', '/api/scales', async (req, res) => ok(res, { scales: SCALES }));

add('POST', '/api/assessments', async (req, res, ctx) => {
  const b = await readBody(req);
  const scale = SCALES.find(s => s.id === b.scale);
  if (!scale) return fail(res, 400, '未知量表');
  const answers = Array.isArray(b.answers) ? b.answers.map(Number) : [];
  if (answers.length !== scale.items.length || answers.some(a => !Number.isFinite(a) || a < 0 || a > 3)) return fail(res, 400, '请完成所有题目');
  const score = answers.reduce((a, c) => a + c, 0);
  const levelObj = scale.levels.find(l => score <= l.max) || scale.levels[scale.levels.length - 1];
  const insight = assessmentInsightFallback(scale.id, levelObj.level, score, scale.max);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 15),
        `用户完成了「${scale.name}」，得分 ${score}/${scale.max}，水平：${levelObj.level}。
输出 JSON：{"insight":"80字内个性化解读，结合用户情况，不使用诊断语言","suggestions":["3条具体可执行的建议"],"note":"合规声明"}。
要求：温和、具体、不安慰式空话，不贴病理标签。`,
        { temperature: 0.6, maxTokens: 600, fallback: insight });
      if (gen && gen.insight) {
        const merged = { ...insight, ...gen };
        const r = q.run('INSERT INTO assessments (user_id, scale, score, max_score, level, insight, answers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          ctx.user.id, scale.id, score, scale.max, levelObj.level, JSON.stringify(merged), JSON.stringify(answers), now());
        return ok(res, { assessment: { id: Number(r.lastInsertRowid), scale: scale.id, score, max: scale.max, level: levelObj.level, insight: merged, createdAt: now() }, demo: false });
      }
    } catch (_) { /* fallback */ }
  }
  const r = q.run('INSERT INTO assessments (user_id, scale, score, max_score, level, insight, answers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ctx.user.id, scale.id, score, scale.max, levelObj.level, JSON.stringify(insight), JSON.stringify(answers), now());
  ok(res, { assessment: { id: Number(r.lastInsertRowid), scale: scale.id, score, max: scale.max, level: levelObj.level, insight, createdAt: now() }, demo: !ai.hasKey() });
});

add('GET', '/api/assessments', async (req, res, ctx) => {
  const list = q.all('SELECT * FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT 40', ctx.user.id)
    .map(a => ({ ...a, insight: a.insight ? JSON.parse(a.insight) : null, answers: JSON.parse(a.answers || '[]') }));
  ok(res, { assessments: list });
});

/* 报告 */
function parseReport(r) {
  let content = {};
  try { content = JSON.parse(r.content); } catch (_) { content = { summary: r.content }; }
  return { id: r.id, days: r.days, title: r.title, createdAt: r.created_at, content };
}

add('GET', '/api/reports', async (req, res, ctx) => {
  const list = q.all('SELECT id, days, title, created_at FROM reports WHERE user_id = ? ORDER BY id DESC LIMIT 30', ctx.user.id);
  ok(res, { reports: list });
});

add('POST', '/api/reports/generate', async (req, res, ctx) => {
  const b = await readBody(req);
  const days = [7, 15, 30].includes(Number(b.days)) ? Number(b.days) : 7;
  const s = statsBundle(ctx.user.id, days);
  let content = fb.report(ctx.profile, s, days);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 20),
        `请基于以下真实数据，为用户写一份 ${days} 天成长复盘报告。
情绪曲线：${JSON.stringify(s.curve)}；情绪均值：${s.avgMood}/10；情绪记录 ${s.checkins} 次；高频情绪标签：${s.topTag || '无'}；深夜记录占比：${Math.round(s.lateNightRatio * 100)}%；
对话轮数：${s.chats}；记录的梦境：${s.dreams} 个；完成测评：${s.assessments.length} 次；睡眠记录：${s.sleepLogs.length} 次（平均 ${s.avgSleep ?? '未知'} 小时）；日记：${s.diaries} 篇。
输出 JSON：{"summary":"120字内的整体回顾","wins":["3条肉眼可见的进步，必须基于数据"],"gaps":["2条当前短板/内耗点"],"plan":["3条下一阶段可执行方案"],"quote":"一句专属短句","closing":"一句结束语"}。
要求：具体、不空泛、不吹捧、不诊断；先肯定真实进步，再指出问题；语气温柔而清醒。`,
        { temperature: 0.8, maxTokens: 1000, fallback: content });
      if (gen && gen.summary) content = { ...content, ...gen };
    } catch (_) { /* fallback */ }
  }
  content.curve = s.curve;
  const title = content.title || `${days} 天成长复盘`;
  const r = q.run('INSERT INTO reports (user_id, days, title, content, created_at) VALUES (?, ?, ?, ?, ?)',
    ctx.user.id, days, title, JSON.stringify(content), now());
  ok(res, { report: { id: Number(r.lastInsertRowid), days, title, createdAt: now(), content }, demo: !ai.hasKey() });
});

add('GET', '/api/reports/(\\d+)', async (req, res, ctx, m) => {
  const r = q.get('SELECT * FROM reports WHERE id = ? AND user_id = ?', Number(m[1]), ctx.user.id);
  if (!r) return fail(res, 404, '报告不存在');
  ok(res, parseReport(r));
});

/* 命理人格（合规） */
add('POST', '/api/mystic/personality', async (req, res, ctx) => {
  const b = await readBody(req);
  const birthday = /^\d{4}-\d{2}-\d{2}$/.test(b.birthday || '') ? b.birthday : ctx.profile.birthday;
  if (!birthday) return fail(res, 400, '请先在个人档案填写生日');
  const input = { birthday, time: String(b.time || '').slice(0, 10), city: String(b.city || ctx.profile.city || '').slice(0, 20), focus: String(b.focus || '').slice(0, 60) };
  let result = fb.baziReading(ctx.profile, input);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 20),
        `请做一份「先天人格底色 + 后天经历」的深度人格解读（不排盘、不算命、不测吉凶、不涉迷信，只做心理探索）。
生日：${birthday}；出生时间：${input.time || '未知'}；城市：${input.city || '未知'}；当前关注：${input.focus || '整体自我理解'}。
输出 JSON：{"title":"标题","meta":["3个意象标签"],"nature":"先天性格底色，100字内","origin":"结合用户经历的人格成因，100字内","gifts":["3条天赋优势"],"shadows":["2条需要留意的模式"],"lifestyle":"适合的活法与节奏，80字内","relations":"关系模式与建议，80字内","healing":"专属疗愈方式，80字内","note":"合规声明"}。
要求：所有内容围绕心理学与自我成长，绝不出现吉凶、运势、命定、预测。`,
        { temperature: 0.7, maxTokens: 1100, fallback: result });
      if (gen && gen.nature) result = { ...result, ...gen };
    } catch (_) { /* fallback */ }
  }
  q.run('INSERT INTO mystic_readings (user_id, kind, input, cards, result, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ctx.user.id, 'personality', JSON.stringify(input), '[]', JSON.stringify(result), now());
  ok(res, { result, demo: !ai.hasKey() });
});

add('POST', '/api/mystic/tarot', async (req, res, ctx) => {
  const b = await readBody(req);
  const question = String(b.question || '').slice(0, 80);
  const count = Math.min(3, Math.max(1, Number(b.count) || 3));
  const deck = [...TAROT].sort(() => Math.random() - 0.5).slice(0, count);
  let result = fb.tarotReading(question, deck, ctx.profile);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 20),
        `用户带着问题来抽情绪疗愈塔罗：「${question || '没有具体问题，只想看看当下状态'}」。
抽到的牌：${deck.map(c => `${c.name}（${c.keyword}）`).join('、')}。
输出 JSON：{"headline":"一句直指内心的话","cards":[{"name":"牌名","line":"这张牌对用户此刻的解读，50字内"}],"reading":"整体解读 100字内","action":"今天可以做的一件小事","note":"合规声明"}。
要求：只做心理投射与疗愈，不预测吉凶、不断言结果、不替用户做决定；温柔、有洞察。`,
        { temperature: 0.8, maxTokens: 900, fallback: result });
      if (gen && Array.isArray(gen.cards)) result = { ...result, ...gen };
    } catch (_) { /* fallback */ }
  }
  q.run('INSERT INTO mystic_readings (user_id, kind, input, cards, result, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ctx.user.id, 'tarot', JSON.stringify({ question }), JSON.stringify(deck), JSON.stringify(result), now());
  ok(res, { result, cards: deck, demo: !ai.hasKey() });
});

function drawHandler(res, rawType) {
  const type = Object.keys(DRAWS).includes(rawType) ? rawType : '心境签';
  const text = DRAWS[type][Math.floor(Math.random() * DRAWS[type].length)];
  ok(res, { result: fb.drawReading(type, text), demo: true });
}
add('GET', '/api/mystic/draw', (req, res, ctx, m, url) => drawHandler(res, url.searchParams.get('type')));
add('POST', '/api/mystic/draw', async (req, res) => {
  const b = await readBody(req);
  drawHandler(res, b.type);
});

add('GET', '/api/mystic/zen', async (req, res, ctx) => {
  const card = ZEN_CARDS[Math.floor(Math.random() * ZEN_CARDS.length)];
  let result = fb.zenReading(card, ctx.profile);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 15),
        `用户抽到潜意识禅卡「${card.name}：${card.text}」。
输出 JSON：{"name":"卡名","text":"卡片原文","prompt":"结合用户近况的一段觉察引导，80字内","note":"合规声明"}。
要求：把它当作心理投射，不涉宗教宣传、不预测吉凶。`,
        { temperature: 0.7, maxTokens: 500, fallback: result });
      if (gen && gen.prompt) result = { ...result, ...gen };
    } catch (_) { /* fallback */ }
  }
  q.run('INSERT INTO mystic_readings (user_id, kind, input, cards, result, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ctx.user.id, 'zen', card.name, JSON.stringify([card]), JSON.stringify(result), now());
  ok(res, { result, demo: !ai.hasKey() });
});

add('GET', '/api/mystic/history', async (req, res, ctx) => {
  const list = q.all('SELECT id, kind, input, cards, result, created_at FROM mystic_readings WHERE user_id = ? ORDER BY id DESC LIMIT 30', ctx.user.id)
    .map(x => ({ id: x.id, kind: x.kind, input: JSON.parse(x.input || '{}'), cards: JSON.parse(x.cards || '[]'), result: JSON.parse(x.result || '{}'), createdAt: x.created_at }));
  ok(res, { readings: list });
});

/* 同城 */
async function placesHandler(res, ctx, rawCity) {
  const city = rawCity || ctx.profile.city || '';
  const last = q.get('SELECT score FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  let result = fb.places(city, ctx.profile, last?.score ?? null);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 15),
        `为用户推荐 5 个「城市治愈地点类型」。城市：${city || '未填写'}；最近情绪：${last?.score ?? '未知'}/10。
输出 JSON：{"intro":"60字内推荐说明","places":[{"name":"地点类型名（不要编造具体店名）","type":"类型","why":"为什么适合此刻的他，40字内","tip":"到达后的一个具体做法","search":"地图搜索关键词"}],"note":"安全与信息提示"}。
要求：只给可搜索的类型与区域特征，不虚构具体地址；优先人少、低社交压力、可随时离开的场所。`,
        { temperature: 0.7, maxTokens: 800, fallback: result });
      if (gen && Array.isArray(gen.places)) result = { ...result, ...gen };
    } catch (_) { /* fallback */ }
  }
  ok(res, { result, demo: !ai.hasKey() });
}
add('GET', '/api/life/places', (req, res, ctx, m, url) => placesHandler(res, ctx, url.searchParams.get('city')));
add('POST', '/api/life/places', async (req, res, ctx) => {
  const b = await readBody(req);
  await placesHandler(res, ctx, typeof b.city === 'string' ? b.city.trim().slice(0, 20) : '');
});

/* 同城地图：城市中心 + 治愈点位（无高德 Key 时给示意点位，不虚构具体店名） */
const CITY_ALIAS = Object.keys(CITY_COORDS);
function normCity(raw = '') {
  return String(raw).replace(/[省市县区]/g, '').replace(/\s+/g, '').trim();
}
function findCity(raw = '') {
  const n = normCity(raw);
  if (!n) return null;
  if (CITY_COORDS[n]) return { name: n, lat: CITY_COORDS[n][0], lng: CITY_COORDS[n][1] };
  const hit = CITY_ALIAS.find(k => k === n || k.includes(n) || n.includes(k));
  if (!hit) return null;
  return { name: hit, lat: CITY_COORDS[hit][0], lng: CITY_COORDS[hit][1] };
}
function nearestCity(lat, lng) {
  let best = '北京', bd = Infinity;
  for (const k of CITY_ALIAS) {
    const d = (CITY_COORDS[k][0] - lat) ** 2 + (CITY_COORDS[k][1] - lng) ** 2;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}
function hashStr(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function demoMapPois(center, city, seed) {
  const picked = [];
  const offset = seed % PLACE_TYPES.length;
  for (let i = 0; i < 6; i++) picked.push(PLACE_TYPES[(offset + i * 3) % PLACE_TYPES.length]);
  return picked.map((t, i) => {
    const angle = ((seed + i * 67) % 360) * Math.PI / 180;
    const km = 0.25 + ((seed + i * 13) % 9) / 10;
    const lat = center.lat + (km / 110.57) * Math.cos(angle);
    const lng = center.lng + (km / (111.32 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(angle);
    return {
      id: `demo-${i}`,
      name: t.name,
      type: t.type,
      why: t.why,
      tip: t.tip,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      distance: Math.round(km * 1000),
      source: 'demo',
      nav: `https://uri.amap.com/marker?position=${lng.toFixed(6)},${lat.toFixed(6)}&name=${encodeURIComponent(t.name)}&src=yuban&coordinate=gaode&callnative=1`
    };
  });
}
async function amapPois(center, key) {
  const url = `https://restapi.amap.com/v3/place/around?key=${encodeURIComponent(key)}&location=${center.lng.toFixed(6)},${center.lat.toFixed(6)}&radius=3500&keywords=${encodeURIComponent('公园|图书馆|书店|咖啡馆|步道|展览')}&offset=8&page=1&extensions=base`;
  const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error(`amap ${r.status}`);
  const data = await r.json();
  if (data.status !== '1' || !Array.isArray(data.pois) || !data.pois.length) throw new Error('amap empty');
  return data.pois.filter(p => p.location).slice(0, 6).map((p, i) => {
    const [lng, lat] = p.location.split(',').map(Number);
    const type = String(p.type || '治愈地点').split(';').pop();
    return {
      id: `amap-${p.id || i}`,
      name: String(p.name || '附近地点'),
      type,
      why: `距你约 ${Math.round((Number(p.distance) || 0) / 100) / 10 || '?'} 公里，${p.address || '可导航前往'}。到之后先做一件低压力的小事。`,
      tip: '到了先找个角落坐五分钟，不急着社交，随时可以离开。',
      lat, lng,
      distance: Number(p.distance) || 0,
      source: 'amap',
      nav: `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(String(p.name || '目的地'))}&src=yuban&coordinate=gaode&callnative=1`
    };
  });
}
async function mapHandler(res, ctx, body = {}) {
  let city = typeof body.city === 'string' ? body.city.trim().slice(0, 20) : (ctx.profile.city || '');
  const lat = Number(body.lat), lng = Number(body.lng);
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng) && lat > 3 && lat < 54 && lng > 73 && lng < 136;
  let center = null, resolved = city;
  if (hasGeo) {
    center = { lat, lng };
    if (!resolved) resolved = nearestCity(lat, lng);
  } else {
    const found = findCity(city);
    if (!found) {
      return ok(res, {
        needCity: true, city: city || '',
        center: null, pois: [], hasAmap: false,
        note: '先填写你所在的城市，愈伴再帮你找附近可以松一口气的地方。'
      });
    }
    resolved = found.name;
    center = { lat: found.lat, lng: found.lng };
  }
  const key = String(process.env.AMAP_KEY || q.get("SELECT value FROM settings WHERE key = 'amap_key'")?.value || '').trim();
  let pois = [], source = 'demo';
  if (key) {
    try { pois = await amapPois(center, key); source = 'amap'; } catch (_) { pois = []; }
  }
  if (!pois.length) pois = demoMapPois(center, resolved, hashStr(resolved + (ctx.profile.style || '') + (hasGeo ? 'geo' : 'city')));
  ok(res, {
    needCity: false,
    city: resolved,
    center,
    hasGeo,
    hasAmap: source === 'amap',
    source,
    pois,
    note: source === 'amap'
      ? '点位来自高德地图实时检索，点击导航可直接唤起地图 App。'
      : '当前为示意点位（不代表真实店铺），用于帮你认识「附近有哪些类型的治愈空间」。需要真实店铺请配置高德 Key。'
  });
}
add('GET', '/api/life/map', async (req, res, ctx, m, url) => {
  const b = { city: url.searchParams.get('city') || '', lat: url.searchParams.get('lat'), lng: url.searchParams.get('lng') };
  await mapHandler(res, ctx, b);
});
add('POST', '/api/life/map', async (req, res, ctx) => {
  await mapHandler(res, ctx, await readBody(req));
});

add('GET', '/api/life/prescription', async (req, res, ctx, m, url) => {
  const stress = Math.min(10, Math.max(1, Number(url.searchParams.get('stress')) || 5));
  const last = q.get('SELECT score, mood FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  let result = prescriptionFallback(stress, last?.score ?? null);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 15),
        `为用户开一份「今日私人解压处方」。压力自评：${stress}/10；最近情绪：${last ? `${last.mood} ${last.score}/10` : '未知'}。
输出 JSON：{"title":"处方标题","intro":"50字内","items":[{"name":"项目","why":"为什么","duration":"时长"}],"food":"饮食一句","movement":"运动一句","rest":"休息一句","note":"温和提醒"}。
要求：4 个项目全部今天可执行，优先低成本、低社交压力；不要医疗建议。`,
        { temperature: 0.7, maxTokens: 800, fallback: result });
      if (gen && Array.isArray(gen.items)) result = { ...result, ...gen };
    } catch (_) { /* fallback */ }
  }
  ok(res, { result, demo: !ai.hasKey() });
});

add('GET', '/api/life/buddies', async (req, res, ctx) => {
  const last = q.get('SELECT score FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  let result = fb.buddies(ctx.profile, last?.score ?? null);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 15),
        `请为用户生成 3 位「同城治愈搭子」示例匹配。城市：${ctx.profile.city || '未知'}；用户标签：${ctx.profile.tags}；最近情绪：${last?.score ?? '未知'}/10。
输出 JSON：{"intro":"匹配说明","matches":[{"alias":"温柔的匿名昵称","tags":["2-3个标签"],"reason":"为什么匹配，40字内","icebreaker":"一句低压力破冰话"}],"safety":"安全提示"}。
要求：搭子类型优先散步/夜走/自习/散心/运动；破冰话必须低压力、可拒绝；不得索取隐私。`,
        { temperature: 0.8, maxTokens: 800, fallback: result });
      if (gen && Array.isArray(gen.matches) && gen.matches.length) result = { ...result, ...gen };
    } catch (_) { /* fallback */ }
  }
  const invites = q.all('SELECT alias, reply, created_at FROM buddy_invites WHERE user_id = ?', ctx.user.id);
  const map = new Map(invites.map(i => [i.alias, i]));
  result = {
    ...result,
    matches: (result.matches || []).map((b, i) => ({
      ...b,
      id: `buddy-${i + 1}`,
      invited: map.has(b.alias),
      invitedAt: map.get(b.alias)?.created_at || null,
      reply: map.get(b.alias)?.reply || ''
    }))
  };
  ok(res, { result, demo: !ai.hasKey() });
});

add('POST', '/api/life/buddies/invite', async (req, res, ctx) => {
  const b = await readBody(req);
  const alias = String(b.alias || '').trim().slice(0, 20);
  const icebreaker = String(b.icebreaker || '').trim().slice(0, 160);
  if (!alias) return fail(res, 400, '缺少搭子名称');
  const reply = `收到啦。${icebreaker ? '你发的那句我看到了，' : ''}这周我也想找个人一起走一走。我们可以先从 ${ctx.profile.city || '同城'} 的公园或咖啡馆坐半小时开始，不合适也随时可以停。`;
  q.run('INSERT OR IGNORE INTO buddy_invites (user_id, alias, reply, created_at) VALUES (?, ?, ?, ?)',
    ctx.user.id, alias, reply, now());
  ok(res, { invited: true, alias, reply, status: 'accepted' });
});

add('GET', '/api/life/events', async (req, res, ctx) => {
  const joined = q.all('SELECT event_id FROM event_signups WHERE user_id = ?', ctx.user.id).map(r => r.event_id);
  ok(res, {
    events: EVENTS.map(e => ({
      ...e,
      joined: joined.includes(e.id),
      joinedCount: q.get('SELECT COUNT(*) c FROM event_signups WHERE event_id = ?', e.id).c + (e.baseCount || 0)
    })), note: '线下活动为自愿参与，报名后由城市主理人联系，可随时退出。'
  });
});

add('POST', '/api/life/events/([a-z0-9-]+)/join', async (req, res, ctx, m) => {
  const ev = EVENTS.find(e => e.id === m[1]);
  if (!ev) return fail(res, 404, '活动不存在');
  q.run('INSERT OR IGNORE INTO event_signups (user_id, event_id, created_at) VALUES (?, ?, ?)', ctx.user.id, ev.id, now());
  const count = q.get('SELECT COUNT(*) c FROM event_signups WHERE event_id = ?', ev.id).c + (ev.baseCount || 0);
  ok(res, { joined: true, event: ev, joinedCount: count });
});

add('DELETE', '/api/life/events/([a-z0-9-]+)/join', async (req, res, ctx, m) => {
  q.run('DELETE FROM event_signups WHERE user_id = ? AND event_id = ?', ctx.user.id, m[1]);
  ok(res, { joined: false });
});

add('GET', '/api/life/device', async (req, res, ctx) => {
  const seed = ctx.user.id * 7 + new Date().getDate();
  const last = q.get('SELECT score, created_at FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  const sleep = q.get('SELECT hours, quality FROM sleep_logs WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  const stressBase = last ? Math.round(70 - Math.min(6, Math.max(-3, last.score - 5)) * 6) : 48;
  const heart = 64 + (seed % 14);
  const stress = Math.min(96, Math.max(18, stressBase + (seed % 9)));
  const quality = sleep ? sleep.quality : 5 + (seed % 4);
  const lowAlert = last && last.score <= 3 && (Date.now() - new Date(last.created_at).getTime()) < 48 * 3600000;
  ok(res, {
    device: { name: '愈伴守护指环 · YB-01', battery: 68 + (seed % 25), connected: true, updatedAt: now() },
    metrics: { heartRate: heart, stress, sleepHours: sleep?.hours ?? 6.2 + (seed % 15) / 10, sleepQuality: quality, hrv: 38 + (seed % 22) },
    alert: lowAlert ? { level: 'care', title: '检测到持续的低落状态', text: '过去 48 小时你的情绪记录处于低位。需要我现在陪你聊一会儿吗？' } : null,
    note: '演示数据：真实设备接入后由可穿戴设备同步心率、压力与睡眠。'
  });
});

/* 内容生成 */
function ensureDailyEncouragement(ctx) {
  const style = ctx.profile.style;
  const date = dayKeyNow();
  const existing = q.get('SELECT * FROM encouragements WHERE user_id = ? AND date = ? AND style = ? ORDER BY id DESC LIMIT 1', ctx.user.id, date, style);
  return existing;
}

const STYLE_KEY_MAP = { gentle: '温柔宠溺', sharp: '犀利骂醒', zen: '佛系静心', hype: '热血励志' };
add('GET', '/api/studio/daily', async (req, res, ctx, m, url) => {
  const raw = url.searchParams.get('style');
  const style = ai.STYLES.includes(raw) ? raw : (STYLE_KEY_MAP[raw] || ctx.profile.style);
  const date = dayKeyNow();
  let row = q.get('SELECT * FROM encouragements WHERE user_id = ? AND date = ? AND style = ? ORDER BY id DESC LIMIT 1', ctx.user.id, date, style);
  if (row) return ok(res, { text: row.text, style, date, cached: true });
  const s = statsBundle(ctx.user.id, 7);
  const mem = topMemories(ctx.user.id, 8)[0];
  const userRow = q.get('SELECT created_at FROM users WHERE id = ?', ctx.user.id);
  const daysIn = Math.max(1, Math.ceil((Date.now() - new Date(userRow?.created_at || now()).getTime()) / 86400000));
  const dailyStats = { avgMood: s.avgMood, topTag: s.topTag, checkins: s.checkins, quote: mem ? mem.content : '', days: daysIn };
  let text = fb.encouragement(ctx.profile, dailyStats, style);
  if (ai.hasKey()) {
    try {
      const plan = currentPlan(ctx.user.id);
      const gen = await ai.generate(ctx.user, ctx.profile, topMemories(ctx.user.id, 20),
        `请写一段只属于这位用户的「每日激励语」，风格：${style}。
昵称：${ctx.profile.nickname}；城市：${ctx.profile.city || '未知'}；走进愈伴第 ${daysIn} 天；近 7 天情绪均值 ${s.avgMood ?? '暂无'}/10，记录 ${s.checkins} 次，高频议题：${s.topTag || '无'}；计划打卡 ${plan ? plan.progress.length : 0}/${plan ? plan.days.length : 7}；记忆里的一句原话：${mem ? mem.content : '暂无'}；最近一次情绪：${q.get('SELECT mood, score, note FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id)?.mood || '无'}。
要求：80~140 字，禁止通用鸡汤和网络金句；必须引用至少一个具体细节（原话、天数、打卡、城市或议题），让他觉得“这句话是写给我的”；有力量但不喊口号；不提 AI。只输出正文。`,
        { temperature: 0.9, maxTokens: 350 });
      if (gen) text = gen;
    } catch (_) { /* fallback */ }
  }
  row = { text, style, date };
  q.run('INSERT INTO encouragements (user_id, date, style, text, created_at) VALUES (?, ?, ?, ?, ?)', ctx.user.id, date, style, text, now());
  ok(res, { ...row, cached: false, demo: !ai.hasKey() });
});

add('POST', '/api/studio/daily/regenerate', async (req, res, ctx) => {
  const b = await readBody(req);
  const style = ai.STYLES.includes(b.style) ? b.style : ctx.profile.style;
  const s = statsBundle(ctx.user.id, 7);
  const mem = topMemories(ctx.user.id, 8)[0];
  const userRow = q.get('SELECT created_at FROM users WHERE id = ?', ctx.user.id);
  const daysIn = Math.max(1, Math.ceil((Date.now() - new Date(userRow?.created_at || now()).getTime()) / 86400000));
  let text = fb.encouragement(ctx.profile, { avgMood: s.avgMood, topTag: s.topTag, checkins: s.checkins, quote: mem ? mem.content : '', days: daysIn }, style);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generate(ctx.user, ctx.profile, topMemories(ctx.user.id, 20),
        `重新写一段专属「每日激励语」，风格：${style}。避免上次用过的表达，不要通用鸡汤，80~140字；必须引用一个具体细节（第 ${daysIn} 天 / 情绪均值 ${s.avgMood ?? '暂无'} / 议题：${s.topTag || '无'} / 原话：${mem ? mem.content : '暂无'}），直击但不冒犯。只输出正文。`,
        { temperature: 1.0, maxTokens: 350 });
      if (gen) text = gen;
    } catch (_) { /* fallback */ }
  }
  q.run('INSERT INTO encouragements (user_id, date, style, text, created_at) VALUES (?, ?, ?, ?, ?)', ctx.user.id, dayKeyNow(), style, text, now());
  ok(res, { text, style, demo: !ai.hasKey() });
});

add('GET', '/api/studio/documentaries', async (req, res, ctx) => {
  const list = q.all('SELECT id, title, created_at FROM documentaries WHERE user_id = ? ORDER BY id DESC LIMIT 20', ctx.user.id);
  ok(res, { documentaries: list });
});

add('GET', '/api/studio/documentaries/(\\d+)', async (req, res, ctx, m) => {
  const d = q.get('SELECT * FROM documentaries WHERE id = ? AND user_id = ?', Number(m[1]), ctx.user.id);
  if (!d) return fail(res, 404, '纪录片不存在');
  ok(res, { documentary: { id: d.id, title: d.title, createdAt: d.created_at, script: JSON.parse(d.script) } });
});

function documentaryData(ctx) {
  return {
    memories: q.all('SELECT content FROM memories WHERE user_id = ? ORDER BY importance DESC, id DESC LIMIT 10', ctx.user.id).map(x => x.content),
    emotions: q.all('SELECT mood, score, created_at FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 30', ctx.user.id),
    assessments: q.all('SELECT scale, score, level FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT 10', ctx.user.id),
    dreams: q.all('SELECT content FROM dreams WHERE user_id = ? ORDER BY id DESC LIMIT 5', ctx.user.id),
    chats: q.get("SELECT COUNT(*) AS c FROM messages WHERE user_id = ? AND role = 'user'", ctx.user.id).c,
    days: Math.max(1, Math.ceil((Date.now() - new Date(ctx.profile.updated_at || now()).getTime()) / 86400000))
  };
}

add('POST', '/api/studio/documentary', async (req, res, ctx) => {
  const data = documentaryData(ctx);
  let script = fb.documentary(ctx.profile, data);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 20),
        `请为用户创作一部 60 秒的「个人人生治愈纪录短片脚本」。
可用素材：记忆 ${JSON.stringify(data.memories.slice(0, 6))}；最近情绪 ${JSON.stringify(data.emotions.slice(0, 8))}；测评 ${JSON.stringify(data.assessments)}；梦境 ${JSON.stringify(data.dreams.slice(0, 2))}；对话轮数 ${data.chats}。
输出 JSON：{"title":"片名","subtitle":"副标题","scenes":[{"caption":"章节名","visual":"画面描述（可用于生成画面）","line":"旁白一句"}],"narration":"开场旁白 60字内","music":"配乐建议","ending":"结尾字幕","note":"隐私声明"}。
要求：4 个场景，按"低谷—坚持—微光—继续"推进；旁白温柔克制、有画面感；必须来自真实素材，不编造经历；不煽情过度。`,
        { temperature: 0.85, maxTokens: 1100, fallback: script });
      if (gen && Array.isArray(gen.scenes) && gen.scenes.length) {
        const fbScenes = script.scenes;
        script = { ...script, ...gen, scenes: gen.scenes.slice(0, 6).map((s, i) => ({
          caption: String(s.caption || fbScenes[i]?.caption || `第 ${i + 1} 幕`),
          visual: String(s.visual || fbScenes[i]?.visual || ''),
          line: String(s.line || fbScenes[i]?.line || '')
        })) };
      }
    } catch (_) { /* fallback */ }
  }
  const r = q.run('INSERT INTO documentaries (user_id, title, script, created_at) VALUES (?, ?, ?, ?)',
    ctx.user.id, script.title || '我的治愈纪录', JSON.stringify(script), now());
  ok(res, { documentary: { id: Number(r.lastInsertRowid), title: script.title, createdAt: now(), script }, demo: !ai.hasKey() });
});

/* 个性化热血成长 MV：真实数据 -> 成长史字幕 -> 前端合成带音乐的短片 */
function mvTimeline(mv) {
  const kinds = ['verse', 'chorus', 'punch', 'outro'];
  let lines = (mv.lines || []).slice(0, 14).map((l, i) => {
    const text = typeof l === 'string' ? l : String(l.text || '');
    const kind = kinds.includes(l.kind) ? l.kind : 'verse';
    return { text: text.slice(0, 48), kind, order: i };
  }).filter(l => l.text);
  let t = 3.8;
  lines = lines.map(l => {
    const d = l.kind === 'punch' ? 3.9 : l.kind === 'chorus' ? 3.3 : 2.9;
    const item = { ...l, t: Number(t.toFixed(2)), d };
    t += d;
    return item;
  });
  return {
    ...mv,
    lines,
    duration: Number((t + 2.8).toFixed(1)),
    title: String(mv.title || '你的成长史').slice(0, 40),
    subtitle: String(mv.subtitle || '一段只写给你的成长史').slice(0, 40),
    bpm: Math.min(128, Math.max(88, Number(mv.bpm) || 104))
  };
}
add('POST', '/api/studio/mv', async (req, res, ctx) => {
  const user = q.get('SELECT created_at FROM users WHERE id = ?', ctx.user.id);
  const memories = topMemories(ctx.user.id, 12).map(m => m.content);
  const emotions = q.all('SELECT score, mood, note, created_at FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 30', ctx.user.id);
  const diaries = q.all('SELECT title, content FROM diaries WHERE user_id = ? ORDER BY id DESC LIMIT 6', ctx.user.id);
  const plan = currentPlan(ctx.user.id);
  const days = Math.max(1, Math.ceil((Date.now() - new Date(user?.created_at || now()).getTime()) / 86400000));
  const data = {
    days,
    checkins: emotions.length,
    memories,
    emotions,
    diaries,
    planDone: plan ? plan.progress.length : 0,
    planTotal: plan ? plan.days.length : 7
  };
  let mv = fb.storyMV(ctx.profile, data);
  if (ai.hasKey()) {
    try {
      const gen = await ai.generateJSON(ctx.user, ctx.profile, topMemories(ctx.user.id, 20),
        `请为这位用户创作一支 40 秒左右的「热血成长 MV」歌词/字幕。
真实素材：昵称 ${ctx.profile.nickname}；城市 ${ctx.profile.city || '未知'}；初始困扰 ${ctx.profile.psych || '未填写'}；坚持天数 ${days}；情绪记录 ${emotions.length} 次；计划打卡 ${data.planDone}/${data.planTotal}；记忆片段 ${JSON.stringify(memories.slice(0, 5))}；最近情绪 ${JSON.stringify(emotions.slice(0, 6).map(e => ({ mood: e.mood, score: e.score, note: e.note })))}；日记标题 ${JSON.stringify(diaries.map(d => d.title))}。
输出 JSON：{"title":"片名","subtitle":"副标题","bpm":104,"lines":[{"text":"一句字幕","kind":"verse|chorus|punch|outro"}]}
要求：10~12 行；必须引用至少 2 个具体经历/数字/原话，不许只写通用鸡汤；叙事从"没人看见的低谷"到"我已走过"再到"我会大有所为"；像说唱歌词/旁白，短句、有节奏、可滚动上屏；verse 铺垫，chorus 爆发，punch 短而有力，outro 收束。不能诊断、不能承诺成功、不能神化；热血但不羞耻、不羞辱。只输出 JSON。`,
        { temperature: 0.85, maxTokens: 900, fallback: mv });
      if (gen && Array.isArray(gen.lines) && gen.lines.length) {
        const fbLines = mv.lines;
        mv = {
          ...mv, ...gen,
          lines: gen.lines.slice(0, 12).map((l, i) => ({
            text: String((typeof l === 'string' ? l : l.text) || fbLines[i]?.text || ''),
            kind: ['verse', 'chorus', 'punch', 'outro'].includes(l.kind) ? l.kind : (fbLines[i]?.kind || 'verse')
          })).filter(l => l.text)
        };
      }
    } catch (_) { /* fallback */ }
  }
  mv = mvTimeline(mv);
  ok(res, { mv, stats: data, demo: !ai.hasKey() });
});

/* 疗愈资源库 / 危机急救 / 专业支持 */
add('GET', '/api/library', async (req, res) => ok(res, { groups: RESOURCES }));

add('GET', '/api/crisis', async (req, res) => {
  ok(res, {
    safety: SAFETY,
    steps: [
      { title: '先让身体安全', detail: '把可能伤害自己的物品移开，坐到有支撑的地方，双脚踩实地面。' },
      { title: '把呼吸放慢', detail: '吸气 4 秒，屏息 2 秒，呼气 6 秒，重复 8 轮。只做呼吸这一件事。' },
      { title: '找到一个人', detail: '给可信任的人发一条消息："我现在很难受，能陪我一会儿吗？"' },
      { title: '联系专业帮助', detail: '拨打全国心理援助热线 400-161-9995；如有立即危险，请拨打 120 或前往急诊。' }
    ],
    contacts: [
      { name: '全国心理援助热线', number: '400-161-9995' },
      { name: '急救 / 紧急医疗', number: '120' },
      { name: '报警求助', number: '110' }
    ],
    note: '愈伴提供陪伴与情绪支持，不能替代医疗与急救。'
  });
});

add('GET', '/api/counselors', async (req, res, ctx) => {
  const lastMood = q.get("SELECT score, level FROM assessments WHERE user_id = ? AND scale = 'mood' ORDER BY id DESC LIMIT 1", ctx.user.id);
  const lastAnx = q.get("SELECT score, level FROM assessments WHERE user_id = ? AND scale = 'anxiety' ORDER BY id DESC LIMIT 1", ctx.user.id);
  let triage = { level: 'AI 轻陪伴', reason: '目前没有明显的高风险信号，可以先由愈伴陪你稳定情绪，同时持续记录。', suggestion: '保持记录，每 7 天回看一次状态；若持续两周不见好转，再考虑咨询。' };
  if ((lastMood && lastMood.score >= 13) || (lastAnx && lastAnx.score >= 11)) {
    triage = { level: '建议专业介入', reason: '最近一次自评显示情绪/焦虑已明显影响生活，单靠陪伴可能不够。', suggestion: '建议预约持证心理咨询师或精神科门诊，愈伴会继续陪你等待与恢复。' };
  }
  const requests = q.all('SELECT * FROM consult_requests WHERE user_id = ? ORDER BY id DESC LIMIT 10', ctx.user.id);
  ok(res, { counselors: COUNSELORS, triage, requests, note: '入驻咨询师均展示资质信息；咨询为自愿付费服务，平台不替代医疗诊断。' });
});

add('POST', '/api/consult/request', async (req, res, ctx) => {
  const b = await readBody(req);
  const counselor = COUNSELORS.find(c => c.id === b.counselorId);
  if (!counselor) return fail(res, 400, '请选择咨询师');
  const contact = String(b.contact || '').trim();
  if (contact.length < 3) return fail(res, 400, '请填写可联系到你的方式');
  q.run('INSERT INTO consult_requests (user_id, counselor_id, service, mode, name, contact, note, urgency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ctx.user.id, counselor.id, counselor.title, String(b.mode || counselor.mode).slice(0, 20),
    String(b.name || ctx.profile.nickname).slice(0, 20), contact.slice(0, 60),
    String(b.note || '').slice(0, 500), String(b.urgency || '不紧急').slice(0, 20), '待受理', now());
  ok(res, { submitted: true, message: '预约已提交，咨询师助理会在 24 小时内联系你。若情况紧急，请直接拨打 400-161-9995。' });
});

/* 总览 */
add('GET', '/api/overview', async (req, res, ctx) => {
  const s = statsBundle(ctx.user.id, 14);
  const b = badges(ctx.user.id);
  const lastEmotion = q.get('SELECT * FROM emotions WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  const todayEmotion = q.get('SELECT * FROM emotions WHERE user_id = ? AND created_at >= ? ORDER BY id DESC LIMIT 1', ctx.user.id, todayStartISO());
  const lastAssessment = q.get('SELECT scale, score, max_score, level, created_at FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  const lastReport = q.get('SELECT id, days, title, created_at FROM reports WHERE user_id = ? ORDER BY id DESC LIMIT 1', ctx.user.id);
  const memCount = q.get('SELECT COUNT(*) AS c FROM memories WHERE user_id = ?', ctx.user.id).c;
  ok(res, {
    profile: shapeProfile(ctx.profile),
    plan: currentPlan(ctx.user.id),
    onboarded: memCount > 0 && String(ctx.profile.psych || '').trim().length > 0,
    streak: b.streak,
    badgesUnlocked: b.unlocked,
    badgesTotal: b.total,
    counts: {
      memories: q.get('SELECT COUNT(*) AS c FROM memories WHERE user_id = ?', ctx.user.id).c,
      chats: q.get("SELECT COUNT(*) AS c FROM messages WHERE user_id = ? AND role = 'user'", ctx.user.id).c,
      diaries: q.get('SELECT COUNT(*) AS c FROM diaries WHERE user_id = ?', ctx.user.id).c,
      dreams: q.get('SELECT COUNT(*) AS c FROM dreams WHERE user_id = ?', ctx.user.id).c,
      reports: q.get('SELECT COUNT(*) AS c FROM reports WHERE user_id = ?', ctx.user.id).c
    },
    curve: s.curve,
    avgMood: s.avgMood,
    lastEmotion: lastEmotion || null,
    todayEmotion: todayEmotion || null,
    lastAssessment: lastAssessment || null,
    lastReport: lastReport || null,
    aiReady: ai.hasKey(),
    newBadges: b.newly
  });
});

/* 设置 & 导出 */
add('GET', '/api/settings/ai', async (req, res, ctx) => {
  const cfg = ai.getConfig();
  ok(res, {
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    source: cfg.source,
    proxy: cfg.proxy,
    webSearch: cfg.webSearch,
    hasKey: !!cfg.apiKey,
    keyPreview: cfg.apiKey ? `${cfg.apiKey.slice(0, 6)}••••${cfg.apiKey.slice(-4)}` : ''
  });
});

add('PUT', '/api/settings/ai', async (req, res, ctx) => {
  const b = await readBody(req);
  if (b.apiKey && String(b.apiKey).trim() && String(b.apiKey).trim().length < 10) return fail(res, 400, 'API Key 格式不正确，通常是 sk- 开头的一长串字符');
  ai.saveConfig({
    apiKey: typeof b.apiKey === 'string' ? b.apiKey : undefined,
    baseUrl: b.baseUrl,
    model: b.model,
    proxy: b.proxy,
    webSearch: typeof b.webSearch === 'boolean' ? b.webSearch : undefined
  });
  const cfg = ai.getConfig();
  ok(res, { hasKey: !!cfg.apiKey, keyPreview: cfg.apiKey ? `${cfg.apiKey.slice(0, 6)}••••${cfg.apiKey.slice(-4)}` : '', baseUrl: cfg.baseUrl, model: cfg.model, source: cfg.source, proxy: cfg.proxy, webSearch: cfg.webSearch });
});

add('POST', '/api/settings/ai/test', async (req, res, ctx) => {
  const b = await readBody(req);
  const hasDraft = (typeof b.apiKey === 'string' && b.apiKey.trim()) || (typeof b.baseUrl === 'string' && b.baseUrl.trim());
  if (!hasDraft && !ai.hasKey()) return fail(res, 400, '尚未配置 API Key，请先填写再测试');
  const result = await ai.testConfig({
    apiKey: b.apiKey, baseUrl: b.baseUrl, model: b.model, proxy: b.proxy
  });
  if (!result.ok) return fail(res, 502, result.error || '连接失败');
  ok(res, result);
});

add('GET', '/api/export', async (req, res, ctx) => {
  const uidv = ctx.user.id;
  const data = {
    exportedAt: now(),
    account: { identifier: ctx.user.identifier, createdAt: ctx.user.created_at },
    profile: shapeProfile(ctx.profile),
    memories: q.all('SELECT * FROM memories WHERE user_id = ?', uidv),
    messages: q.all('SELECT * FROM messages WHERE user_id = ?', uidv),
    emotions: q.all('SELECT * FROM emotions WHERE user_id = ?', uidv),
    diaries: q.all('SELECT * FROM diaries WHERE user_id = ?', uidv),
    dreams: q.all('SELECT * FROM dreams WHERE user_id = ?', uidv),
    assessments: q.all('SELECT * FROM assessments WHERE user_id = ?', uidv),
    reports: q.all('SELECT * FROM reports WHERE user_id = ?', uidv),
    sleepPlans: q.all('SELECT * FROM sleep_plans WHERE user_id = ?', uidv),
    sleepLogs: q.all('SELECT * FROM sleep_logs WHERE user_id = ?', uidv),
    mysticReadings: q.all('SELECT * FROM mystic_readings WHERE user_id = ?', uidv),
    documentaries: q.all('SELECT * FROM documentaries WHERE user_id = ?', uidv),
    treeholePosts: q.all('SELECT * FROM posts WHERE user_id = ?', uidv),
    treeholeReplies: q.all('SELECT * FROM replies WHERE user_id = ?', uidv)
  };
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="yuban-export-${dayKeyNow()}.json"`,
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data, null, 2));
});

add('GET', '/api/health', async (req, res) => ok(res, { status: 'ok', aiReady: ai.hasKey(), time: now() }), true);

/* ---------------- 服务入口 ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'
};

function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      file = path.join(PUBLIC_DIR, 'index.html');
    }
    fs.readFile(file, (err2, buf) => {
      if (err2) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not Found'); }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=3600'
      });
      res.end(buf);
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      return serveStatic(req, res, pathname);
    }

    const route = routes.find(r => r.method === req.method && r.re.test(pathname));
    if (!route) return fail(res, 404, '接口不存在');

    const token = parseCookies(req).yb_token || (req.headers.authorization || '').replace(/Bearer\s+/, '');
    const user = findUserBySession(token);
    if (!route.isPublic && !user) return fail(res, 401, '登录已过期，请重新登录');

    const ctx = { user, token, profile: user ? getProfile(user.id) : null };
    const match = route.re.exec(pathname);
    await route.handler(req, res, ctx, match, url);
  } catch (e) {
    console.error('[error]', e);
    if (!res.headersSent) fail(res, e.status || 500, e.status ? e.message : '服务器开小差了，请稍后再试');
    else res.end();
  }
});

q.run('DELETE FROM sessions WHERE expires_at < ?', now());

server.listen(PORT, '0.0.0.0', () => {
  const cfg = ai.getConfig();
  console.log(`\n  愈伴 YUBAN 已启动`);
  console.log(`  本地访问: http://localhost:${PORT}`);
  console.log(`  AI 状态: ${cfg.apiKey ? `已配置 (${cfg.model})` : '未配置 Key — 当前为本地陪伴模式，可在设置页配置 DeepSeek'}`);
  console.log(`  API 兼容地址: ${cfg.baseUrl}\n`);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
