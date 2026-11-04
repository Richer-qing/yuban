/* 愈伴 · 前端核心：状态、请求、组件与工具 */
(function () {
  const YB = (window.YB = {});
  YB.state = { user: null, profile: null, overview: null, aiReady: false, authChecked: false };

  /* ---------------- 请求 ---------------- */
  YB.api = async function (path, options = {}) {
    const opts = { credentials: 'same-origin', headers: {}, ...options };
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (_) { data = { ok: false, error: '响应解析失败' }; }
    if (res.status === 401 && !path.startsWith('/api/auth')) {
      YB.state.user = null;
      YB.renderAuth();
      throw new Error('登录已过期');
    }
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || '请求失败');
      err.status = res.status;
      err.code = data.code;
      throw err;
    }
    return data.data;
  };

  /* ---------------- 工具 ---------------- */
  YB.esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  YB.nl2br = s => YB.esc(s).replace(/\n/g, '<br>');
  YB.pad = n => String(n).padStart(2, '0');
  YB.fmtDate = function (iso, withTime = false) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const base = `${d.getMonth() + 1}月${d.getDate()}日`;
    if (!withTime) return base;
    return `${base} ${YB.pad(d.getHours())}:${YB.pad(d.getMinutes())}`;
  };
  YB.dayName = function (iso) {
    const d = iso ? new Date(iso) : new Date();
    const t = new Date();
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(d, t)) return '今天';
    const y = new Date(t); y.setDate(t.getDate() - 1);
    if (same(d, y)) return '昨天';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  YB.greetingWord = function () {
    const h = new Date().getHours();
    if (h < 5) return '夜深了';
    if (h < 11) return '早安';
    if (h < 14) return '午安';
    if (h < 19) return '下午好';
    return '晚上好';
  };
  YB.moodWord = function (score) {
    if (score == null) return '未记录';
    if (score <= 2) return '很难熬';
    if (score <= 4) return '低落';
    if (score <= 6) return '平常';
    if (score <= 8) return '还不错';
    return '很好';
  };
  YB.moodClass = function (score) {
    if (score == null) return 'm-neutral';
    if (score <= 3) return 'm-low';
    if (score <= 6) return 'm-mid';
    return 'm-high';
  };
  YB.copy = async function (text) {
    try {
      await navigator.clipboard.writeText(text);
      YB.toast('已复制');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      YB.toast('已复制');
    }
  };
  YB.loading = (text = '正在整理…') => `<div class="loading"><span class="spinner"></span><span>${YB.esc(text)}</span></div>`;
  YB.speak = function (text) {
    if (!window.speechSynthesis) return YB.toast('当前浏览器不支持朗读', 'error');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text || '').slice(0, 500));
    u.lang = 'zh-CN'; u.rate = 0.92; u.pitch = 1.02;
    speechSynthesis.speak(u);
    YB.toast('正在朗读');
  };
  YB.dailyCard = function ({ text = '', nickname = '', date = '' } = {}) {
    const W = 1080, H = 1440;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#fdf4ea'); g.addColorStop(.55, '#f8eee9'); g.addColorStop(1, '#eef2ec');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(229,163,152,.12)';
    ctx.beginPath(); ctx.arc(900, 220, 240, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(155,175,155,.10)';
    ctx.beginPath(); ctx.arc(160, 1180, 280, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,130,110,.25)'; ctx.lineWidth = 2;
    ctx.strokeRect(64, 64, W - 128, H - 128);
    ctx.fillStyle = '#a08276'; ctx.font = '500 30px "Songti SC", "Noto Serif SC", serif';
    ctx.fillText('愈伴 · 今日一句', 116, 168);
    ctx.fillStyle = '#8f7a6d'; ctx.font = '400 24px "Songti SC", serif';
    ctx.fillText(date || new Date().toLocaleDateString('zh-CN'), 116, 216);
    ctx.fillStyle = '#4b3b36'; ctx.font = '600 56px "Songti SC", "Noto Serif SC", serif';
    const maxW = W - 240;
    let y = 420;
    const chars = Array.from(String(text));
    let line = '';
    for (const ch of chars) {
      if (ch === '\n') { ctx.fillText(line, 120, y); line = ''; y += 92; continue; }
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, 120, y); line = ch; y += 92; }
      else line = test;
    }
    if (line) { ctx.fillText(line, 120, y); y += 92; }
    ctx.fillStyle = '#9a8478'; ctx.font = '400 28px "Songti SC", serif';
    ctx.fillText(`${nickname ? nickname + ' · ' : ''}只写给你的这一句`, 120, H - 200);
    ctx.fillStyle = '#b58c79'; ctx.font = '400 22px "Songti SC", serif';
    ctx.fillText('愈伴 · 心理疗愈与自我成长参考', 120, H - 150);
    c.toBlob(blob => {
      if (!blob) return YB.toast('生成分享卡失败', 'error');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `愈伴-今日一句-${String(date || 'today').replace(/[\\/:*?"<>|]/g, '-')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      YB.toast('分享卡已保存到相册/下载');
    }, 'image/png');
  };
  YB.empty = (title, text, action = '') => `
    <div class="empty">
      <div class="empty-art">${YB.mascot(92, 'pet-sleep')}</div>
      <h4>${YB.esc(title)}</h4>
      <p>${YB.esc(text)}</p>
      ${action || ''}
    </div>`;

  /* ---------------- 图标 ---------------- */
  const ICONS = {
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    chat: '<path d="M21 11.5a8 8 0 0 1-8 8H8l-4 3v-6.2A8 8 0 0 1 12 4h1a8 8 0 0 1 8 7.5z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M4 5.5v13M8 7h7"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.2 6.2l2.6 2.6M15.2 15.2l2.6 2.6M17.8 6.2l-2.6 2.6M8.8 15.2l-2.6 2.6"/>',
    heart: '<path d="M12 20s-7.5-4.7-7.5-10A4.5 4.5 0 0 1 12 6.7 4.5 4.5 0 0 1 19.5 10c0 5.3-7.5 10-7.5 10z"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6 10a4 4 0 0 0 1 8z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    leaf: '<path d="M20 4C10 4 5 9 5 16c0 0 0 4 4 4 7 0 11-6 11-16z"/><path d="M4 21c2-6 6-9 11-11"/>',
    brain: '<path d="M9.5 4A3 3 0 0 0 6.8 7.5 3.4 3.4 0 0 0 5 10.4 3 3 0 0 0 6.4 13a3 3 0 0 0 3.1 4.5V4z"/><path d="M14.5 4a3 3 0 0 1 2.7 3.5 3.4 3.4 0 0 1 1.8 2.9 3 3 0 0 1-1.4 2.6 3 3 0 0 1-3.1 4.5V4z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    send: '<path d="M4 12 20 4l-4 16-5-6z"/><path d="m11 14 9-10"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 5v6h-6"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    download: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M4.5 20h15"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a8 8 0 0 0 0-2l2-1.5-2-3.4-2.3 1a8 8 0 0 0-1.7-1L15 3.5h-4L10.6 6a8 8 0 0 0-1.7 1l-2.3-1-2 3.4L6.6 11a8 8 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 1.7 1l.4 2.6h4l.4-2.6a8 8 0 0 0 1.7-1l2.3 1 2-3.4z"/>',
    arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    alert: '<path d="M12 4 2.8 20h18.4z"/><path d="M12 9v4.5M12 17h.01"/>',
    phone: '<path d="M6 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.7 2 2 0 0 1 6 3.5z"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7a2.5 2.5 0 1 1-2.5 2.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>',
    flame: '<path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-2.5 1-5.5 1-7.5z"/>',
    sprout: '<path d="M12 20v-8"/><path d="M12 12C12 7 8 6 4 6c0 5 4 7 8 6z"/><path d="M12 10c0-4 3-5 7-5 0 4-3 6-7 5z"/>',
    wave: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 9.5h16.4M3.8 14.5h16.4"/><path d="M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5z"/>',
    crystal: '<path d="m12 3 7 6-7 12L5 9z"/><path d="M5 9h14"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    shield: '<path d="M12 21s7-3.2 7-9V5.5L12 3 5 5.5V12c0 5.8 7 9 7 9z"/><path d="m9 12 2 2 4-4.5"/>',
    device: '<rect x="7" y="3" width="10" height="6" rx="3"/><rect x="3.5" y="9" width="17" height="9" rx="3"/><path d="M3.5 13.5h17"/>',
    book2: '<path d="M12 6c-2-2-5-2.5-8-2.5v13C7 16.5 10 17 12 19c2-2 5-2.5 8-2.5v-13C17 3.5 14 4 12 6z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9.5 21h5"/>',
    chevron: '<path d="m8 10 4 4 4-4"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
    edit: '<path d="M4 20h4l11-11-3-3L5 17z"/><path d="m14 6 3 3"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>'
  };
  YB.icon = function (name, size = 22, cls = '') {
    const p = ICONS[name] || ICONS.sparkle;
    return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  };

  /* ---------------- 萌宠 ---------------- */
  YB.mascot = function (size = 120, cls = '') { return YB.petAvatar('nuomi', size, cls); };

  YB.PETS = [
    { key: 'nuomi', name: '糯米', tag: '温柔兜底', desc: '你说什么它都先接住，再轻轻推你一小步。' },
    { key: 'acong', name: '阿葱', tag: '清醒观察', desc: '话不多，会帮你把混乱一点点理清。' },
    { key: 'xiaohuo', name: '小火', tag: '热血行动', desc: '会点出你已经做到的事，推你往前挪半步。' },
    { key: 'xiaoci', name: '小刺', tag: '犀利真话', desc: '敢拆穿自我欺骗，但不会羞辱你。' }
  ];
  YB.petAvatar = function (kind = 'nuomi', size = 120, cls = '') {
    const pal = {
      nuomi: { body: '#FFF6EC', ear: '#F6D8CF', inner: '#F1BEB4', line: '#B58E82', blush: '#F7C6C2', accent: '#E8A09A' },
      acong: { body: '#F4FAEB', ear: '#D7E7BC', inner: '#C2DBA2', line: '#83996F', blush: '#DCE9BE', accent: '#8FB874' },
      xiaohuo: { body: '#FFF1E3', ear: '#F8CDA2', inner: '#F4B27C', line: '#B57F5E', blush: '#F8B896', accent: '#E8834F' },
      xiaoci: { body: '#F3EEF8', ear: '#DCCFE9', inner: '#C9B8DC', line: '#8E7BA5', blush: '#E2D2EC', accent: '#9B84B8' }
    }[kind] || {};
    const p = pal.nuomi ? pal : { body: '#FFF6EC', ear: '#F6D8CF', inner: '#F1BEB4', line: '#B58E82', blush: '#F7C6C2', accent: '#E8A09A' };
    const eyes = kind === 'xiaoci'
      ? `<path d="M58 74h10M92 74h10" stroke="${p.line}" stroke-width="2.4" stroke-linecap="round"/>
         <circle cx="64" cy="78" r="1.6" fill="${p.line}"/><circle cx="98" cy="78" r="1.6" fill="${p.line}"/>`
      : `<ellipse cx="63" cy="74" rx="4.2" ry="5.2" fill="#4B3B36" class="pet-eye"/>
         <ellipse cx="97" cy="74" rx="4.2" ry="5.2" fill="#4B3B36" class="pet-eye"/>
         <circle cx="64.5" cy="72" r="1.3" fill="#fff"/><circle cx="98.5" cy="72" r="1.3" fill="#fff"/>`;
    const mouth = kind === 'xiaohuo'
      ? `<path d="M74 88c2 3 10 3 12 0" stroke="${p.line}" stroke-width="2.2" stroke-linecap="round" fill="${p.accent}" fill-opacity=".35"/>`
      : kind === 'acong'
        ? `<path d="M77 88h6" stroke="${p.line}" stroke-width="2" stroke-linecap="round"/>`
        : `<path d="M76 86c1.5 2 6.5 2 8 0" stroke="${p.line}" stroke-width="2.2" stroke-linecap="round"/>
           <path d="M80 89v3c0 1.5-1.2 2.2-2.6 2.2" stroke="${p.line}" stroke-width="1.6" stroke-linecap="round"/>`;
    const extra = kind === 'acong'
      ? `<path d="M74 34c-2-13 6-19 14-13 5 4 1 9-4 13" fill="#A8C98B"/>
         <path d="M82 32c4-11 13-12 17-5 2 4-6 8-11 6" fill="#C1DCA6"/>`
      : kind === 'xiaohuo'
        ? `<path d="M80 18c8 11 3 16-2 21-5-4-9-9-3-15 1-2 3 0 5-6z" fill="#F3A063"/>
           <path d="M80 27c4 6 2 9-1 12-3-3-5-5-1-8 1-1 2 0 2-3z" fill="#FBD08E"/>`
        : kind === 'xiaoci'
          ? `<path d="M40 52l-9-14 17 4zM120 52l9-14-17 4zM50 38l-2-15 12 9zM110 38l2-15-12 9z" fill="${p.inner}" opacity=".8"/>`
          : '';
    return `
<svg class="pet pet-${kind} ${cls}" width="${size}" height="${size}" viewBox="0 0 160 160" fill="none" aria-hidden="true">
  <ellipse cx="80" cy="132" rx="42" ry="8" fill="#E9D8C9" opacity=".5"/>
  ${extra}
  <path d="M44 60C36 42 42 30 51 30c7 0 13 8 15 18" fill="${p.ear}"/>
  <path d="M116 60c8-18 2-30-7-30-7 0-13 8-15 18" fill="${p.ear}"/>
  <path d="M44 60C36 42 42 30 51 30c5 0 10 4 13 10" fill="${p.inner}"/>
  <path d="M116 60c8-18 2-30-7-30-5 0-10 4-13 10" fill="${p.inner}"/>
  <path d="M80 42c24 0 40 18 40 42 0 26-18 42-40 42S40 110 40 84c0-24 16-42 40-42z" fill="${p.body}"/>
  <ellipse cx="80" cy="96" rx="27" ry="24" fill="#FFFDF9"/>
  ${eyes}
  <ellipse cx="53" cy="88" rx="7" ry="4.4" fill="${p.blush}" opacity=".85"/>
  <ellipse cx="107" cy="88" rx="7" ry="4.4" fill="${p.blush}" opacity=".85"/>
  ${mouth}
  <path d="M52 112c-8 4-10 12-4 14 5 2 10-2 12-8" fill="${p.body}"/>
  <path d="M108 112c8 4 10 12 4 14-5 2-10-2-12-8" fill="${p.body}"/>
  <circle cx="122" cy="50" r="3" fill="${p.accent}" opacity=".8" class="pet-spark"/>
  <circle cx="36" cy="46" r="2" fill="${p.accent}" opacity=".7" class="pet-spark"/>
</svg>`;
  };

  /* ---------------- 曲线图 ---------------- */
  YB.curveChart = function (curve = [], opts = {}) {
    const w = 100, h = opts.height || 120;
    if (!curve.length) {
      return `<div class="chart-empty">还没有情绪记录，记录一次就能看见曲线的起点</div>`;
    }
    const points = curve.map((c, i) => ({ x: curve.length === 1 ? 50 : (i / (curve.length - 1)) * 100, y: 100 - ((c.score - 1) / 9) * 92 }));
    const path = points.map((p, i) => (i ? `L${p.x.toFixed(1)},${p.y.toFixed(1)}` : `M${p.x.toFixed(1)},${p.y.toFixed(1)}`)).join(' ');
    const area = `${path} L100,100 L0,100 Z`;
    return `
      <svg class="curve" viewBox="0 0 100 100" preserveAspectRatio="none" style="height:${h}px" aria-label="情绪曲线">
        <defs>
          <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E8A09A" stop-opacity=".32"/>
            <stop offset="100%" stop-color="#E8A09A" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="curveLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#D7B9DD"/><stop offset="55%" stop-color="#E8A09A"/><stop offset="100%" stop-color="#E9B98A"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#curveFill)"/>
        <path d="${path}" fill="none" stroke="url(#curveLine)" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>
        ${points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.6" fill="#fff" stroke="#DE968D" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}
      </svg>
      <div class="curve-axis">
        <span>${YB.esc(curve[0].date.slice(5))}</span>
        <span>${YB.esc(curve[curve.length - 1].date.slice(5))}</span>
      </div>`;
  };

  /* ---------------- Toast / Modal ---------------- */
  YB.toast = function (msg, type = '') {
    let box = document.querySelector('.toast-wrap');
    if (!box) { box = document.createElement('div'); box.className = 'toast-wrap'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${type === 'error' ? YB.icon('alert', 16) : YB.icon('check', 16)}<span>${YB.esc(msg)}</span>`;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 3200);
  };

  YB.modal = function ({ title = '', body = '', actions = '', cls = '', onMount = null }) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal ${cls}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${YB.esc(title)}</h3>
          <button class="icon-btn modal-close" aria-label="关闭">${YB.icon('close', 18)}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${actions ? `<div class="modal-actions">${actions}</div>` : ''}
      </div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('locked');
    requestAnimationFrame(() => wrap.classList.add('in'));
    const close = () => {
      wrap.classList.remove('in');
      setTimeout(() => { wrap.remove(); document.body.classList.remove('locked'); }, 220);
    };
    wrap.querySelector('.modal-backdrop').onclick = close;
    wrap.querySelector('.modal-close').onclick = close;
    wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    if (onMount) onMount(wrap);
    return { close, el: wrap };
  };

  YB.confirm = function (text, onYes, yesText = '确认') {
    const m = YB.modal({
      title: '确认一下',
      body: `<p class="modal-text">${YB.esc(text)}</p>`,
      actions: `<button class="btn ghost" data-close>取消</button><button class="btn danger" id="cfm-yes">${YB.esc(yesText)}</button>`,
      onMount(w) { w.querySelector('#cfm-yes').onclick = () => { m.close(); onYes(); }; }
    });
  };

  /* ---------------- 危机干预弹窗 ---------------- */
  YB.safetyModal = async function (data) {
    let info = data;
    if (!info) {
      try { info = await YB.api('/api/crisis'); } catch (_) { info = null; }
    }
    const contacts = info?.contacts || [
      { name: '全国心理援助热线', number: '400-161-9995' },
      { name: '急救 / 紧急医疗', number: '120' }
    ];
    const steps = info?.steps || [
      { title: '先让身体安全', detail: '移开可能伤害自己的物品，坐到有支撑的地方，双脚踩实地面。' },
      { title: '把呼吸放慢', detail: '吸气 4 秒，屏息 2 秒，呼气 6 秒，重复 8 轮。' },
      { title: '联系专业帮助', detail: '拨打 400-161-9995；如有立即危险，请拨打 120。' }
    ];
    let timer = null;
    const m = YB.modal({
      title: '先别一个人扛',
      cls: 'safety',
      body: `
        <div class="safety-top">
          <div class="breath-orb"><span>吸</span></div>
          <p class="safety-note">跟着圆一起呼吸：吸气 4 秒 · 屏息 2 秒 · 呼气 6 秒</p>
        </div>
        <div class="safety-steps">
          ${steps.map((s, i) => `<div class="safety-step"><b>${i + 1}</b><div><h5>${YB.esc(s.title)}</h5><p>${YB.esc(s.detail)}</p></div></div>`).join('')}
        </div>
        <div class="safety-contacts">
          ${contacts.map(c => `<a class="contact" href="tel:${YB.esc(c.number.replace(/[^\d]/g, ''))}">${YB.icon('phone', 18)}<div><b>${YB.esc(c.number)}</b><span>${YB.esc(c.name)}</span></div></a>`).join('')}
        </div>
        <p class="fineprint">${YB.esc(info?.note || '愈伴提供陪伴与情绪支持，不能替代医疗与急救。')}</p>`,
      actions: `<button class="btn ghost" data-close>我会照顾好自己</button><button class="btn ghost" id="safety-ground">先做 3 分钟着陆</button><button class="btn primary" id="safety-breathe">开始呼吸引导</button>`,
      onMount(w) {
        const orb = w.querySelector('.breath-orb');
        const label = orb.querySelector('span');
        const phases = [['吸', 4000], ['停', 2000], ['呼', 6000]];
        let running = false, idx = 0;
        const tick = () => {
          const [word, ms] = phases[idx % 3];
          label.textContent = word;
          orb.className = `breath-orb ${word === '吸' ? 'inhale' : word === '呼' ? 'exhale' : 'hold'}`;
          idx++;
          timer = setTimeout(tick, ms);
        };
        const btn = w.querySelector('#safety-breathe');
        w.querySelector('#safety-ground').onclick = () => {
          clearTimeout(timer);
          m.close();
          setTimeout(() => YB.grounding(), 120);
        };
        btn.onclick = () => {
          running = !running;
          if (running) { btn.textContent = '暂停引导'; tick(); }
          else { btn.textContent = '继续呼吸引导'; clearTimeout(timer); }
        };
        w.dataset.timer = '1';
        const oldClose = w.querySelector('.modal-close');
        oldClose.addEventListener('click', () => clearTimeout(timer));
        w.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => clearTimeout(timer)));
        w.querySelector('.modal-backdrop').addEventListener('click', () => clearTimeout(timer));
      }
    });
    return m;
  };

  YB.sos = function () { YB.safetyModal(); };

  /* 3 分钟感官着陆：把人从情绪风暴里拉回此时此地 */
  YB.grounding = function () {
    const STEPS = [
      { n: 5, title: '看见 5 样东西', hint: '慢慢抬头，在房间里找出 5 样看得见的东西。不用评价，只要看见。' },
      { n: 4, title: '摸到 4 样东西', hint: '伸手摸 4 样有不同触感的东西：桌面、衣角、杯壁、自己的手背。' },
      { n: 3, title: '听见 3 种声音', hint: '停下来听 3 种声音，远的近的都算：空调声、脚步声、你自己的呼吸。' },
      { n: 2, title: '闻到 2 种气味', hint: '闻 2 种气味。如果闻不到，就闻自己的手背，或想象一种熟悉的味道。' },
      { n: 1, title: '尝到 1 种味道', hint: '喝一口水，或感受嘴里的味道。让注意力落在舌头和喉咙。' }
    ];
    let step = 0;
    const m = YB.modal({
      title: '3 分钟情绪着陆',
      body: `<div class="ground-wrap" id="ground-wrap"></div>`,
      actions: `<button class="btn ghost" data-close>先不做</button><button class="btn primary" id="ground-next">我做到了，下一步</button>`,
      onMount(w) {
        const wrap = w.querySelector('#ground-wrap');
        const next = w.querySelector('#ground-next');
        const render = () => {
          if (step >= STEPS.length) {
            wrap.innerHTML = `
              <div class="ground-finish">
                <p class="eyebrow">着陆完成</p>
                <h3>你还在，而且回到了此时此地。</h3>
                <p class="muted">情绪可能还在，但它不再是全部。现在给自己选一件最小的事：喝口水、洗把脸、把窗户打开，或者给一个信得过的人发条消息。</p>
                <div class="ground-finish-actions">
                  <button class="btn primary" id="ground-chat">去和愈伴聊聊</button>
                  <button class="btn ghost" id="ground-support">联系专业支持</button>
                </div>
                <p class="fineprint">如果出现伤害自己的念头，请立即联系 24 小时热线：400-161-9995 / 010-82951332。</p>
              </div>`;
            next.remove();
            w.querySelector('.modal-actions .btn.ghost') && (w.querySelector('.modal-actions .btn.ghost').textContent = '我缓过来了');
            w.querySelector('#ground-chat').onclick = () => { m.close(); YB.go('chat'); };
            w.querySelector('#ground-support').onclick = () => { m.close(); YB.go('support'); };
            return;
          }
          const s = STEPS[step];
          const dots = STEPS.map((_, i) => `<span class="${i < step ? 'done' : i === step ? 'on' : ''}"></span>`).join('');
          wrap.innerHTML = `
            <div class="ground-progress"><i style="width:${(step / STEPS.length) * 100}%"></i></div>
            <p class="ground-stepno">第 ${step + 1} / ${STEPS.length} 步</p>
            <h3>${s.title}</h3>
            <p class="ground-hint">${s.hint}</p>
            <div class="ground-dots">${dots}</div>
            <p class="hint">慢一点，没人催你。做完这一步就好。</p>`;
          next.textContent = step === STEPS.length - 1 ? '完成了，看看现在的自己' : '我做到了，下一步';
        };
        render();
        next.onclick = () => { step++; render(); };
      }
    });
    return m;
  };

  /* ---------------- 页面骨架 ---------------- */
  const NAV_GROUPS = [
    { label: '陪伴', items: [
      { route: 'home', name: '今日', icon: 'home' },
      { route: 'chat', name: '萌宠陪伴', icon: 'chat' },
      { route: 'treehole', name: '匿名树洞', icon: 'eye' }
    ]},
    { label: '疗愈', items: [
      { route: 'sleep', name: '助眠与声音', icon: 'moon' },
      { route: 'dreams', name: '解梦', icon: 'cloud' },
      { route: 'assess', name: '测评与报告', icon: 'brain' },
      { route: 'mystic', name: '人格镜像', icon: 'crystal' },
      { route: 'library', name: '疗愈资源库', icon: 'book2' }
    ]},
    { label: '生活', items: [
      { route: 'life', name: '同城治愈', icon: 'compass' },
      { route: 'studio', name: '我的影像', icon: 'sparkle' }
    ]},
    { label: '我的', items: [
      { route: 'me', name: '档案与记忆', icon: 'user' },
      { route: 'support', name: '专业支持', icon: 'shield' }
    ]}
  ];
  YB.NAV_GROUPS = NAV_GROUPS;
  const TABBAR = [
    { route: 'home', name: '首页', icon: 'home' },
    { route: 'chat', name: '陪伴', icon: 'chat' },
    { route: 'journal', name: '日记', icon: 'book' },
    { route: 'heal', name: '疗愈', icon: 'moon' },
    { route: 'life', name: '生活', icon: 'compass' },
    { route: 'me', name: '我的', icon: 'user' }
  ];
  YB.TABBAR = TABBAR;

  YB.renderShell = function () {
    const p = YB.state.profile || {};
    const app = document.getElementById('app');
    app.className = 'app authenticated';
    app.innerHTML = `
      <aside class="sidebar">
        <div class="brand" data-go="home">
          <div class="brand-mark">${YB.mascot(42)}</div>
          <div><b>愈伴</b><span>被记住的地方</span></div>
        </div>
        <nav class="side-nav">
          ${NAV_GROUPS.map(g => `
            <div class="nav-group">
              <p class="nav-label">${g.label}</p>
              ${g.items.map(i => `<a href="#/${i.route}" class="nav-item" data-route="${i.route}">${YB.icon(i.icon, 19)}<span>${i.name}</span></a>`).join('')}
            </div>`).join('')}
        </nav>
        <div class="side-foot">
          <div class="ai-state" id="ai-state"></div>
          <button class="side-sos" onclick="YB.sos()">${YB.icon('shield', 17)} 情绪急救</button>
          <p class="side-copy">愈伴 · 心理疗愈与自我成长参考<br>不替代医疗，不测吉凶</p>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="topbar-brand" data-go="home">${YB.mascot(34)}<b>愈伴</b></div>
          <div class="topbar-title"><h1 id="page-title">今日</h1><p id="page-sub"></p></div>
          <div class="topbar-right">
            <button class="sos-pill" onclick="YB.sos()">${YB.icon('shield', 15)}<span>急救</span></button>
            <button class="avatar" id="top-avatar" onclick="YB.go('me')">${YB.esc((p.nickname || '愈')[0])}</button>
          </div>
        </header>
        <main id="view" class="view"></main>
        <nav class="tabbar">
          ${TABBAR.map(t => `<a href="#/${t.route}" class="tab-item" data-route="${t.route}">${YB.icon(t.icon, 21)}<span>${t.name}</span></a>`).join('')}
        </nav>
      </div>`;
    app.querySelectorAll('[data-go]').forEach(el => el.onclick = () => YB.go(el.dataset.go));
    YB.refreshAIState();
  };

  YB.refreshAIState = async function () {
    const box = document.getElementById('ai-state');
    if (!box) return;
    const ready = YB.state.aiReady;
    box.innerHTML = ready
      ? `<span class="dot on"></span><div><b>AI 已就绪</b><span>长期记忆已开启</span></div>`
      : `<span class="dot demo"></span><div><b>本地陪伴模式</b><span>配置 Key 解锁大模型</span></div>`;
    box.onclick = () => YB.go('me', { section: 'ai' });
  };

  YB.setActive = function (route) {
    document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.route === route || (route === 'journal' && a.dataset.route === 'home')));
    document.querySelectorAll('.tab-item').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    const parent = { sleep: 'heal', dreams: 'heal', assess: 'heal', mystic: 'heal', library: 'heal', treehole: 'chat', studio: 'life', support: 'me', journal: 'journal' }[route];
    document.querySelectorAll('.tab-item').forEach(a => { if (a.dataset.route === parent) a.classList.add('active'); });
  };

  YB.setTitle = function (title, sub = '') {
    const t = document.getElementById('page-title');
    const s = document.getElementById('page-sub');
    if (t) t.textContent = title;
    if (s) s.textContent = sub;
  };

  YB.go = function (route, params) {
    YB._params = params || null;
    if (location.hash === `#/${route}`) YB.routeRender(true);
    else location.hash = `#/${route}`;
  };

  /* ---------------- 卡片/表单小件 ---------------- */
  YB.chips = function (items, active, attrs = 'data-chip') {
    return items.map(i => `<button type="button" class="chip ${i === active ? 'on' : ''}" ${attrs}="${YB.esc(i)}">${YB.esc(i)}</button>`).join('');
  };
  YB.STYLE_KEYS = { '温柔宠溺': 'gentle', '犀利骂醒': 'sharp', '佛系静心': 'zen', '热血励志': 'hype' };
  YB.styleKey = s => YB.STYLE_KEYS[s] || 'gentle';
  YB.styleTabs = function (active, idPrefix = 'style') {
    return `<div class="chips" id="${idPrefix}-chips">${YB.chips(['温柔宠溺', '犀利骂醒', '佛系静心', '热血励志'], active, 'data-style')}</div>`;
  };
  YB.demoNote = function (text = '') {
    return `<p class="demo-note">${YB.icon('sparkle', 14)} ${YB.esc(text || '当前为本地陪伴模式，配置 DeepSeek API Key 后可获得完整大模型体验。')}</p>`;
  };
  YB.disclaimer = function (text) {
    return `<p class="fineprint">${YB.esc(text)}</p>`;
  };
})();
