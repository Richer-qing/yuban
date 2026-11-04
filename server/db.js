'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'yuban.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT UNIQUE NOT NULL,
  phone TEXT,
  email TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT DEFAULT '愈伴朋友',
  gender TEXT DEFAULT '',
  birthday TEXT DEFAULT '',
  city TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  psych TEXT DEFAULT '',
  style TEXT DEFAULT '温柔宠溺',
  pet_name TEXT DEFAULT '糯米',
  pet_type TEXT DEFAULT 'nuomi',
  updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT DEFAULT '经历',
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 3,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT DEFAULT '',
  focus TEXT DEFAULT '',
  days TEXT NOT NULL,
  progress TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  track TEXT DEFAULT '日常陪伴',
  style TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  mood TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT DEFAULT '',
  content TEXT NOT NULL,
  mood TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  alias TEXT NOT NULL,
  content TEXT NOT NULL,
  seed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER,
  alias TEXT NOT NULL,
  content TEXT NOT NULL,
  seed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dreams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  analysis TEXT DEFAULT '',
  symbols TEXT DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  scale TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  level TEXT DEFAULT '',
  insight TEXT DEFAULT '',
  answers TEXT DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  days INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS encouragements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  style TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sleep_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  stress INTEGER DEFAULT 5,
  plan TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sleep_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  hours REAL DEFAULT 0,
  quality INTEGER DEFAULT 5,
  wake INTEGER DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mystic_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  input TEXT DEFAULT '',
  cards TEXT DEFAULT '[]',
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buddy_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  city TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  reason TEXT DEFAULT '',
  icebreaker TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, event_id)
);

CREATE TABLE IF NOT EXISTS buddy_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  reply TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, alias)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consult_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  counselor_id TEXT DEFAULT '',
  service TEXT DEFAULT '',
  mode TEXT DEFAULT '',
  name TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  note TEXT DEFAULT '',
  urgency TEXT DEFAULT '',
  status TEXT DEFAULT '待受理',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS badge_unlocks (
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, code)
);

CREATE TABLE IF NOT EXISTS documentaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  script TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, id);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, id);
CREATE INDEX IF NOT EXISTS idx_emotions_user ON emotions(user_id, id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id, id);
`);
try { db.exec("ALTER TABLE profiles ADD COLUMN pet_type TEXT DEFAULT 'nuomi'"); } catch (_) {}

const now = () => new Date().toISOString();

/* ---------------- 种子内容：树洞社区 & 同城团建 ---------------- */
function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
  if (existing === 0) {
    const posts = [
      ['夜航的鲸', '今天在地铁上突然想哭，忍住了。回到出租屋，把灯调暗，听了一会儿雨声。好像也没那么糟，明天还要上班，先睡吧。', '2025-10-28T22:40:00.000Z'],
      ['拾光', '和相恋三年的人分开了，第七天。今天第一次好好吃了一顿饭，虽然是一个人。想告诉未来的自己：你熬过来了。', '2025-10-30T13:20:00.000Z'],
      ['小满', '原生家庭的事，我花了很久才明白：那不是我的错。今天给妈妈打电话，第一次没有吵起来，只是平静地说"我需要一点空间"。', '2025-11-01T20:05:00.000Z'],
      ['一颗青柠', '半夜心悸，以为自己要完了。跟着深呼吸了四分钟，慢慢好了。原来我真的可以照顾好自己。', '2025-11-02T02:10:00.000Z'],
      ['无声的海', '备考第三个月，很累，但不想放弃。来这里说一句：今天也坚持下来了，很了不起。', '2025-11-03T23:15:00.000Z'],
      ['慢慢', '第一次早睡，十一点就躺下了。虽然还是翻了会儿手机，但比昨天好。小小的一步也算数。', '2025-11-03T23:50:00.000Z']
    ];
    const insertPost = db.prepare('INSERT INTO posts (user_id, alias, content, seed, created_at) VALUES (NULL, ?, ?, 1, ?)');
    const insertReply = db.prepare('INSERT INTO replies (post_id, alias, content, seed, created_at) VALUES (?, ?, ?, 1, ?)');
    for (const p of posts) {
      const r = insertPost.run(p[0], p[1], p[2]);
      const postId = Number(r.lastInsertRowid);
      if (p[1].includes('分开了')) {
        insertReply.run(postId, '晚风', '你已经在往前走了，哪怕一步都很珍贵。我在这里陪你。', '2025-10-30T14:02:00.000Z');
        insertReply.run(postId, '榕树下', '第七天能好好吃饭，真的很勇敢。慢一点也没关系。', '2025-10-30T16:31:00.000Z');
      } else if (p[1].includes('原生家庭')) {
        insertReply.run(postId, '柚子', '边界不是不孝，是让自己活下去的方式。为你高兴。', '2025-11-01T21:12:00.000Z');
      } else if (p[1].includes('心悸')) {
        insertReply.run(postId, '守夜人', '恭喜你把自己接住了。下次难受时，记得还有这条呼吸的路。', '2025-11-02T07:45:00.000Z');
      } else if (p[1].includes('早睡')) {
        insertReply.run(postId, '米粒', '小小的一步也算数，这句话我也记下了。', '2025-11-04T00:02:00.000Z');
      }
    }
  }
}
seed();

/* ---------------- 通用查询 ---------------- */
const q = {
  get(sql, ...args) { return db.prepare(sql).get(...args); },
  all(sql, ...args) { return db.prepare(sql).all(...args); },
  run(sql, ...args) { return db.prepare(sql).run(...args); }
};

const EVENTS = [
  { id: 'walk-01', title: '城市慢走 · 日落散步', type: '静心散步', duration: '90 分钟', size: '6-10 人', desc: '沿着河岸慢走，不说话也可以。走到日落结束，各回各家。', baseCount: 37 },
  { id: 'read-02', title: '无声读书会', type: '读书疗愈', duration: '120 分钟', size: '8 人', desc: '带一本想读的书，安静读 90 分钟，最后 30 分钟自由分享。', baseCount: 26 },
  { id: 'hike-03', title: '轻徒步 · 山野呼吸', type: '轻户外', duration: '半天', size: '10 人', desc: '低强度路线，全程可随时退出。重点不是到达，是走在路上。', baseCount: 18 },
  { id: 'tea-04', title: '一盏茶 · 静心夜谈', type: '解压陪伴', duration: '100 分钟', size: '6 人', desc: '围坐喝茶，聊最近的生活。没有建议，只有倾听。', baseCount: 42 },
  { id: 'photo-05', title: '城市光影 · 随手拍', type: '创作疗愈', duration: '120 分钟', size: '8 人', desc: '用手机拍下今天让你停下来的十个瞬间。', baseCount: 23 },
  { id: 'sunrise-06', title: '清晨计划 · 看一次日出', type: '晨间疗愈', duration: '80 分钟', size: '6 人', desc: '一起看日出，然后吃一顿热乎的早餐，再各自去生活。', baseCount: 31 }
];

module.exports = { db, q, now, EVENTS };
