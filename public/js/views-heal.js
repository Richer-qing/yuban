/* 愈伴 · 疗愈中心 / 助眠 / 解梦 / 测评 / 人格镜像 / 资源库 */
(function () {
  const YB = window.YB;
  const V = (YB.views = YB.views || {});

  /* ---------- 声音引擎 ---------- */
  const Sound = YB.sound = {
    ctx: null, node: null, gain: null, timer: null, current: null,
    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        }
        this.buffer = buffer;
      }
    },
    play(type = 'rain', minutes = 15) {
      this.init();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.stop(false);
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.buffer; src.loop = true;
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      if (type === 'rain') { filter.type = 'highpass'; filter.frequency.value = 900; gain.gain.value = 0.12; }
      else if (type === 'stream') { filter.type = 'bandpass'; filter.frequency.value = 520; filter.Q.value = 0.6; gain.gain.value = 0.16; }
      else { filter.type = 'lowpass'; filter.frequency.value = 300; gain.gain.value = 0.07; }
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start();
      this.node = src; this.gain = gain; this.current = type;
      this.timer = setTimeout(() => { this.stop(); YB.toast('声音已自动停止，晚安'); }, Math.min(minutes, 60) * 60000);
      return true;
    },
    stop(notify = true) {
      if (this.node) { try { this.node.stop(); } catch (_) {} this.node = null; }
      if (this.gain) { try { this.gain.disconnect(); } catch (_) {} this.gain = null; }
      clearTimeout(this.timer); this.timer = null; this.current = null;
      if (notify) YB.toast('已停止播放');
    }
  };

  /* ================= 疗愈中心 ================= */
  V.heal = async function () {
    const ov = await YB.api('/api/overview');
    YB.state.overview = ov; YB.state.profile = ov.profile;
    const links = [
      { r: 'sleep', i: 'moon', t: '助眠与声音', d: '今晚，让身体先睡', tag: '千人千面入睡方案' },
      { r: 'dreams', i: 'cloud', t: '潜意识解梦', d: '听见梦里的情绪', tag: '无吉凶 · 纯疗愈' },
      { r: 'assess', i: 'brain', t: '测评与报告', d: '看见 7/15/30 天的变化', tag: '科学量表' },
      { r: 'mystic', i: 'crystal', t: '人格镜像', d: '理解你的先天底色', tag: '合规 · 不测吉凶' },
      { r: 'library', i: 'book2', t: '疗愈资源库', d: '科学心理 + 国风修身', tag: '可执行练习' },
      { r: 'support', i: 'shield', t: '专业支持', d: '持证咨询师入驻', tag: 'AI 初筛分级' }
    ];
    return {
      html: `
      <div class="heal-page">
        <section class="soft-hero">
          <div>
            <p class="eyebrow">疗愈中心</p>
            <h2>${ov.lastEmotion ? `最近你记录的是「${YB.esc(ov.lastEmotion.mood || YB.moodWord(ov.lastEmotion.score))}」` : '从今天开始，照顾自己的内在'}</h2>
            <p>不是所有难受都需要立刻想通。有时只是需要一处安静的地方，慢慢缓过来。</p>
            <div class="hero-actions">
              <button class="btn primary" onclick="YB.sos()">${YB.icon('shield', 16)} 此刻很难受</button>
              <button class="btn ghost" onclick="YB.go('chat')">${YB.icon('chat', 16)} 找${YB.esc(ov.profile.petName)}聊聊</button>
            </div>
          </div>
          <div class="soft-art">${YB.mascot(150, 'pet-bob')}</div>
        </section>

        <section class="module-grid heal-grid">
          ${links.map(l => `<a class="module tall" href="#/${l.r}">
            <span class="module-icon">${YB.icon(l.i, 22)}</span>
            <b>${l.t}</b><span class="muted">${l.d}</span>
            <em class="mini-tag">${l.tag}</em>
          </a>`).join('')}
        </section>

        <section class="card quick-calm">
          <div class="qc-copy">
            <p class="label">90 秒 · 随时可用</p>
            <h3>把身体从警报里带出来</h3>
            <p>吸气 4 秒 · 屏息 2 秒 · 呼气 6 秒。什么都不用想，只跟着圆。</p>
          </div>
          <button class="btn soft" onclick="YB.sos()">${YB.icon('wind', 16)} 开始呼吸</button>
        </section>

        <section class="split-2">
          <div class="card mini-stat-card">
            <p class="label">当前状态</p>
            <div class="stat-line"><b>${ov.avgMood ?? '—'}<span>/10</span></b><span>近 14 天情绪均值</span></div>
            <div class="stat-line"><b>${ov.streak}<span>天</span></b><span>连续记录</span></div>
            <div class="stat-line"><b>${ov.badgesUnlocked}<span>/${ov.badgesTotal}</span></b><span>成长勋章</span></div>
          </div>
          <div class="card mini-stat-card">
            <p class="label">最近一次测评</p>
            ${ov.lastAssessment ? `
              <div class="assessment-mini">
                <b>${YB.esc(ov.lastAssessment.scale === 'mood' ? '情绪状态' : ov.lastAssessment.scale === 'anxiety' ? '焦虑水平' : ov.lastAssessment.scale === 'rumination' ? '内耗程度' : '睡眠质量')}</b>
                <p class="lvl">${YB.esc(ov.lastAssessment.level)}</p>
                <span class="hint">${YB.fmtDate(ov.lastAssessment.created_at)} · ${ov.lastAssessment.score}/${ov.lastAssessment.max_score}</span>
              </div>
              <button class="text-btn" onclick="YB.go('assess')">再做一次 <span>→</span></button>
            ` : `
              <p class="muted">还没有测评记录。用科学量表，给此刻的自己一个坐标。</p>
              <button class="btn soft small" onclick="YB.go('assess')">去测评</button>
            `}
          </div>
        </section>

        <p class="fineprint">愈伴的所有命理、解梦、心理内容仅作心理疗愈与自我成长参考，不算命、不测吉凶、不替代医疗。</p>
      </div>`,
      mount() {}
    };
  };

  /* ================= 助眠 ================= */
  V.sleep = async function () {
    const data = await YB.api('/api/sleep/overview');
    const plan = data.plans[0]?.plan;
    const p = YB.state.profile || (await YB.api('/api/profile'));
    YB.stopSounds?.();
    return {
      html: `
      <div class="sleep-page">
        <section class="night-hero">
          <div>
            <p class="eyebrow">今晚 · 专属入睡方案</p>
            <h2>先让身体安全，再谈睡着</h2>
            <p>根据你今天的状态，${YB.esc(p.petName)}为你排了一段睡前节奏。睡不着不是失败，放松才是目标。</p>
          </div>
          <div class="moon-art">${YB.mascot(142, 'pet-sleep')}<span class="moon"></span></div>
        </section>

        <section class="card stress-card">
          <div class="card-head">
            <div><p class="label">今天的压力</p><h3>你现在有多紧绷？</h3></div>
            <span class="score-bubble" id="stress-label">5 / 10</span>
          </div>
          <input type="range" min="1" max="10" value="5" class="score-range" id="stress-range">
          <div class="row-between">
            <span class="hint">1 = 很松弛 · 10 = 快撑不住</span>
            <button class="btn primary" id="gen-plan">${YB.icon('moon', 16)} 生成今晚方案</button>
          </div>
        </section>

        <section class="card plan-card" id="plan-card">
          ${plan ? renderPlan(plan) : `
            <div class="plan-empty">
              ${YB.icon('moon', 30)}
              <h3>今晚的方案还没生成</h3>
              <p>拖动上面的刻度，告诉我你今天的压力，我会为你排 4 步。</p>
            </div>`}
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">声音浴</p><h3>白噪音 · 静心 · 夜风</h3></div>
            <span class="hint" id="sound-state">点击播放</span>
          </div>
          <div class="sound-grid">
            ${[
      { id: 'rain', name: '细雨', desc: '均匀的雨声，适合反刍停不下来时', icon: 'cloud' },
      { id: 'stream', name: '溪流', desc: '缓慢水声，把呼吸带慢', icon: 'wave' },
      { id: 'night', name: '夜风', desc: '极轻的低频，适合已经有点困', icon: 'wind' }
    ].map(s => `
              <button class="sound-card" data-sound="${s.id}">
                <span class="sound-icon">${YB.icon(s.icon, 22)}</span>
                <b>${s.name}</b><p>${s.desc}</p>
                <em>播放 15 分钟</em>
              </button>`).join('')}
          </div>
          <div class="sound-bar" id="sound-bar" hidden>
            <span class="eq"><i></i><i></i><i></i><i></i><i></i></span>
            <span id="sound-name">正在播放</span>
            <button class="btn ghost small" id="sound-stop">停止</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">睡眠记录</p><h3>昨晚睡得怎么样</h3></div>
            <span class="hint">记录 3 次可点亮「安睡守护」</span>
          </div>
          <div class="sleep-form">
            <label class="field"><span>睡了多久（小时）</span><input type="number" id="sleep-hours" min="0" max="16" step="0.5" value="7" class="input"></label>
            <label class="field"><span>睡眠质量 <b id="quality-label">6</b>/10</span><input type="range" id="sleep-quality" min="1" max="10" value="6" class="score-range"></label>
            <label class="field"><span>夜里醒了几次</span><input type="number" id="sleep-wake" min="0" max="20" value="1" class="input"></label>
            <textarea class="input area" id="sleep-note" rows="2" placeholder="想补充点什么吗？（选填）"></textarea>
            <button class="btn primary" id="sleep-save">记下昨晚</button>
          </div>
          <div class="sleep-stats">
            <div><b>${data.avgHours ?? '—'}<span>h</span></b><p>平均睡眠</p></div>
            <div><b>${data.avgQuality ?? '—'}<span>/10</span></b><p>平均质量</p></div>
            <div><b>${data.avgWake ?? '—'}<span>次</span></b><p>夜醒次数</p></div>
          </div>
          ${data.logs.length ? `<div class="sleep-bars">${[...data.logs].reverse().map(l => `
            <div class="sleep-bar-item"><span>${YB.fmtDate(l.created_at).replace('月', '/').replace('日', '')}</span>
              <div class="sleep-bar"><i style="height:${Math.min(100, (l.hours / 10) * 100)}%"></i></div>
              <em>${l.hours}h</em></div>`).join('')}</div>` : ''}
        </section>

        <section class="card tips-card">
          <div class="card-head"><div><p class="label">失眠溯源</p><h3>你的失眠更像哪一种？</h3></div></div>
          <div class="tip-grid">
            <div><b>焦虑型</b><p>躺下后脑子自动开始预演明天。先做「情绪卸货」：把担心写在纸上，告诉自己已经记下了。</p></div>
            <div><b>压力型</b><p>身体很累但神经还紧。睡前 40 分钟关闭工作信息，用热水或拉伸让身体先降速。</p></div>
            <div><b>创伤型</b><p>夜里反复回到某些画面。不要逼自己入睡，先坐起来做接地练习，必要时寻求专业帮助。</p></div>
          </div>
          <p class="fineprint">若连续两周入睡困难或夜醒明显，建议到睡眠/心理门诊做进一步评估。</p>
        </section>
      </div>`,
      mount(root) {
        const range = root.querySelector('#stress-range');
        const label = root.querySelector('#stress-label');
        range.addEventListener('input', () => { label.textContent = `${range.value} / 10`; });
        root.querySelector('#gen-plan').onclick = async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true; btn.textContent = '正在排今晚的节奏…';
          try {
            const r = await YB.api('/api/sleep/plan', { method: 'POST', body: { stress: Number(range.value) } });
            root.querySelector('#plan-card').innerHTML = renderPlan(r.plan);
            if (r.demo) YB.toast('本地模式：已生成基础方案');
          } catch (err) { YB.toast(err.message, 'error'); }
          btn.disabled = false; btn.innerHTML = `${YB.icon('moon', 16)} 重新生成`;
        };

        root.querySelectorAll('[data-sound]').forEach(b => b.onclick = () => {
          const type = b.dataset.sound;
          const nameMap = { rain: '细雨声', stream: '溪流声', night: '夜风声' };
          if (Sound.current === type) { Sound.stop(); root.querySelector('#sound-bar').hidden = true; return; }
          Sound.play(type, 15);
          root.querySelector('#sound-bar').hidden = false;
          root.querySelector('#sound-name').textContent = `${nameMap[type]} · 15 分钟后自动停止`;
          root.querySelectorAll('[data-sound]').forEach(x => x.classList.toggle('on', x === b));
          root.querySelector('#sound-state').textContent = '播放中';
        });
        root.querySelector('#sound-stop').onclick = () => {
          Sound.stop();
          root.querySelector('#sound-bar').hidden = true;
          root.querySelector('#sound-state').textContent = '点击播放';
          root.querySelectorAll('[data-sound]').forEach(x => x.classList.remove('on'));
        };

        const quality = root.querySelector('#sleep-quality');
        const qLabel = root.querySelector('#quality-label');
        quality.addEventListener('input', () => qLabel.textContent = quality.value);
        root.querySelector('#sleep-save').onclick = async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          try {
            await YB.api('/api/sleep/log', { method: 'POST', body: {
              hours: Number(root.querySelector('#sleep-hours').value),
              quality: Number(quality.value),
              wake: Number(root.querySelector('#sleep-wake').value),
              note: root.querySelector('#sleep-note').value
            }});
            YB.toast('睡够了多少不重要，你有在照顾自己');
            YB.routeRender(true);
          } catch (err) { YB.toast(err.message, 'error'); btn.disabled = false; }
        };
      }
    };
  };

  function renderPlan(plan) {
    return `
      <div class="plan-head">
        <div>
          <p class="label">今晚的节奏</p>
          <h3>${YB.esc(plan.title || '今晚的方案')}</h3>
          <p class="plan-intro">${YB.esc(plan.intro || '')}</p>
        </div>
        <span class="stress-badge">压力 ${plan.stressLevel ?? '—'}/10</span>
      </div>
      <div class="plan-steps">
        ${(plan.steps || []).map((s, i) => `
          <div class="plan-step">
            <div class="step-dot"><span>${i + 1}</span></div>
            <div><b>${YB.esc(s.title || '')}</b><em>${YB.esc(s.time || '')}</em><p>${YB.esc(s.detail || '')}</p></div>
          </div>`).join('')}
      </div>
      <div class="plan-foot">
        <span>${YB.icon('wind', 15)} 推荐声音：${YB.esc({ rain: '细雨', stream: '溪流', night: '夜风' }[plan.sound] || '细雨')}</span>
        <button class="text-btn" onclick="YB.sos()">睡前呼吸引导 <span>→</span></button>
      </div>
      ${plan.note ? `<p class="fineprint">${YB.esc(plan.note)}</p>` : ''}`;
  }

  /* ================= 解梦 ================= */
  V.dreams = async function () {
    const data = await YB.api('/api/dreams');
    return {
      html: `
      <div class="dream-page">
        <section class="dream-hero">
          <div>
            <p class="eyebrow">潜意识解梦 · 纯心理视角</p>
            <h2>梦不是预兆，是内心的信</h2>
            <p>写下你还记得的碎片。${YB.esc((YB.state.profile || {}).petName || '糯米')}会结合你的性格与近期状态，读出梦里藏着的情绪。</p>
          </div>
          <div class="dream-art">${YB.mascot(128, 'pet-sleep')}<span class="zzz">z z</span></div>
        </section>

        <section class="card composer-card">
          <textarea class="input area dream-input" id="dream-text" rows="4" maxlength="1500" placeholder="我梦见……（画面、人物、情绪，记得多少写多少）"></textarea>
          <div class="row-between">
            <p class="hint">不测吉凶 · 不做预兆 · 只做情绪解读</p>
            <button class="btn primary" id="dream-analyze">${YB.icon('cloud', 16)} 解析这个梦</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">近 30 天</p><h3>梦境趋势</h3></div>
            <span class="hint">${data.summary.total} 个梦</span>
          </div>
          ${data.summary.symbols.length ? `<div class="symbol-chips">${data.summary.symbols.map(s => `<span class="chip soft">${YB.esc(s.name)} · ${s.count} 次</span>`).join('')}</div>
          <p class="muted">反复出现的意象，往往对应近期反复被触碰的情绪。不是坏事，说明它正在被看见。</p>` : '<p class="muted">还没有足够的梦境记录。记下第一个梦，趋势会慢慢浮现。</p>'}
        </section>

        <section class="dream-list">
          ${data.dreams.length ? data.dreams.map(d => `
            <article class="card dream-card">
              <div class="dream-card-head">
                <div><p class="label">${YB.fmtDate(d.created_at, true)}</p><h3>${YB.esc(d.analysis?.title || '一个梦')}</h3></div>
                <span class="symbol-count">${(d.symbols || []).length} 个意象</span>
              </div>
              <p class="dream-content">${YB.nl2br(d.content)}</p>
              ${d.analysis ? `
                <div class="dream-analysis">
                  <div class="symbol-list">
                    ${(d.analysis.symbols || []).map(s => `<div class="symbol"><b>${YB.esc(s.name)}</b><p>${YB.esc(s.meaning)}</p></div>`).join('')}
                  </div>
                  <div class="insight-block"><span>可能的隐藏情绪</span><p>${YB.esc(d.analysis.hidden || '')}</p></div>
                  <div class="insight-block comfort"><span>想对你说</span><p>${YB.esc(d.analysis.comfort || '')}</p></div>
                  <div class="insight-block"><span>今晚可以试试</span><p>${YB.esc(d.analysis.suggestion || '')}</p></div>
                  <p class="fineprint">${YB.esc(d.analysis.note || '')}</p>
                </div>` : ''}
            </article>`).join('') : YB.empty('还没有记录梦境', '梦是夜里的信，写下来，它就不会白白发生。')}
        </section>
      </div>`,
      mount(root) {
        root.querySelector('#dream-analyze').onclick = async (e) => {
          const btn = e.currentTarget;
          const content = root.querySelector('#dream-text').value.trim();
          if (content.length < 5) return YB.toast('梦的内容再写一点点', 'error');
          btn.disabled = true; btn.textContent = '正在读梦里的情绪…';
          try {
            await YB.api('/api/dreams', { method: 'POST', body: { content } });
            YB.toast('梦已经收好，解析写进记录里了');
            YB.routeRender(true);
          } catch (err) { YB.toast(err.message, 'error'); btn.disabled = false; btn.innerHTML = `${YB.icon('cloud', 16)} 解析这个梦`; }
        };
      }
    };
  };

  /* ================= 测评与报告 ================= */
  const SCALE_NAMES = { mood: '情绪状态', anxiety: '焦虑水平', rumination: '内耗程度', sleep: '睡眠质量' };
  const SCALE_SUB = { mood: '最近两周的情绪浓度', anxiety: '紧张与担忧占了多少', rumination: '精神能量被消耗在哪', sleep: '睡眠的深度与连续性' };

  V.assess = async function () {
    const [scaleData, assessData, reportData] = await Promise.all([
      YB.api('/api/scales'), YB.api('/api/assessments'), YB.api('/api/reports')
    ]);
    const latest = {};
    for (const a of assessData.assessments) if (!latest[a.scale]) latest[a.scale] = a;
    return {
      html: `
      <div class="assess-page">
        <section class="soft-hero compact">
          <div>
            <p class="eyebrow">心理测评 · 状态监测</p>
            <h2>先看见，再改变</h2>
            <p>量表不是给你贴标签，而是给此刻的情绪一个坐标。</p>
          </div>
          <div class="soft-art">${YB.mascot(116)}</div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">当前状态</p><h3>四次自查的坐标</h3></div>
            <span class="hint">最近一次结果</span>
          </div>
          <div class="scale-dashboard">
            ${scaleData.scales.map(s => {
              const a = latest[s.id];
              return `<div class="scale-snap ${a ? '' : 'empty'}">
                <span>${s.name.replace('自评', '')}</span>
                <b>${a ? a.score : '—'}<i>/${s.max}</i></b>
                <em class="${a ? levelClass(a.level) : ''}">${a ? YB.esc(a.level) : '未测评'}</em>
              </div>`;
            }).join('')}
          </div>
        </section>

        <section class="section-head">
          <div><p class="label">开始一次自查</p><h3>选一个此刻最想了解的</h3></div>
        </section>
        <div class="scale-grid">
          ${scaleData.scales.map(s => `
            <div class="scale-card card">
              <span class="scale-icon">${YB.icon(scaleIcon(s.id), 22)}</span>
              <h4>${s.name}</h4>
              <p>${s.subtitle}</p>
              <div class="scale-meta"><span>${s.items.length} 题</span><span>约 2 分钟</span></div>
              <button class="btn soft small" data-start-scale="${s.id}">开始</button>
            </div>`).join('')}
        </div>

        <section class="card">
          <div class="card-head">
            <div><p class="label">成长复盘</p><h3>让变化被看见</h3></div>
            <span class="hint">基于情绪 · 对话 · 睡眠 · 测评</span>
          </div>
          <div class="report-actions">
            ${[7, 15, 30].map(d => `<button class="btn ghost" data-gen-report="${d}">${YB.icon('sparkle', 15)} ${d} 天报告</button>`).join('')}
          </div>
          <p class="muted report-hint">报告会列出你的进步点、当前短板和下一阶段方案。生气时看一遍，容易看见自己其实走了多远。</p>
          <div class="report-list">
            ${reportData.reports.length ? reportData.reports.map(r => `
              <button class="report-row" data-open-report="${r.id}">
                <div><b>${YB.esc(r.title)}</b><span>${YB.fmtDate(r.created_at, true)}</span></div>
                ${YB.icon('arrow', 16)}
              </button>`).join('') : '<p class="muted">还没有报告，先点上面的按钮生成第一份。</p>'}
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">测评历史</p><h3>每一次如实</h3></div>
          </div>
          <div class="assess-history">
            ${assessData.assessments.length ? assessData.assessments.slice(0, 10).map(a => `
              <button class="assess-row" data-open-assess="${a.id}">
                <div class="assess-row-main"><b>${SCALE_NAMES[a.scale] || a.scale}</b><span>${YB.fmtDate(a.created_at, true)}</span></div>
                <div class="assess-row-score"><b>${a.score}<i>/${a.max_score}</i></b><em class="${levelClass(a.level)}">${YB.esc(a.level)}</em></div>
              </button>`).join('') : '<p class="muted">还没有测评记录。</p>'}
          </div>
        </section>
        <p class="fineprint">所有量表为自我觉察工具，不构成医学诊断。若结果持续偏高，建议联系专业心理/医疗机构。</p>
      </div>`,
      mount(root) {
        const scaleMap = Object.fromEntries(scaleData.scales.map(s => [s.id, s]));
        root.querySelectorAll('[data-start-scale]').forEach(b => b.onclick = () => openScale(scaleMap[b.dataset.startScale]));
        root.querySelectorAll('[data-gen-report]').forEach(b => b.onclick = async () => {
          b.disabled = true; const old = b.innerHTML; b.innerHTML = '正在复盘…';
          try {
            const r = await YB.api('/api/reports/generate', { method: 'POST', body: { days: Number(b.dataset.genReport) } });
            YB.toast('报告生成好了');
            showReport(r.report);
            setTimeout(() => YB.routeRender(true), 600);
          } catch (e) { YB.toast(e.message, 'error'); b.disabled = false; b.innerHTML = old; }
        });
        root.querySelectorAll('[data-open-report]').forEach(b => b.onclick = async () => {
          try {
            const r = await YB.api(`/api/reports/${b.dataset.openReport}`);
            showReport(r);
          } catch (e) { YB.toast(e.message, 'error'); }
        });
        root.querySelectorAll('[data-open-assess]').forEach(b => b.onclick = () => {
          const a = assessData.assessments.find(x => String(x.id) === b.dataset.openAssess);
          if (!a) return;
          YB.modal({
            title: SCALE_NAMES[a.scale] || a.scale,
            body: `
              <div class="assess-result">
                <div class="assess-score"><b>${a.score}</b><span>/${a.max_score}</span><em class="${levelClass(a.level)}">${YB.esc(a.level)}</em></div>
                <p>${YB.nl2br(a.insight?.insight || '')}</p>
                <div class="suggestion-box"><b>可以试试</b>${(a.insight?.suggestions || []).map(x => `<p>· ${YB.esc(x)}</p>`).join('')}</div>
                <p class="fineprint">${YB.esc(a.insight?.note || '自我觉察工具，不构成诊断。')}</p>
              </div>`,
            actions: '<button class="btn ghost" data-close>关闭</button>'
          });
        });

        function openScale(scale) {
          let answers = new Array(scale.items.length).fill(null);
          const m = YB.modal({
            title: scale.name,
            cls: 'scale-modal',
            body: `
              <p class="modal-text">${YB.esc(scale.subtitle)}</p>
              <p class="fineprint">${YB.esc(scale.desc)}</p>
              <div class="question-list">
                ${scale.items.map((q, i) => `
                  <div class="question" data-q="${i}">
                    <p><b>${i + 1}.</b> ${YB.esc(q)}</p>
                    <div class="q-options">
                      ${['几乎没有', '偶尔', '经常', '几乎每天'].map((o, v) => `<button class="q-opt" data-q="${i}" data-v="${v}">${o}</button>`).join('')}
                    </div>
                  </div>`).join('')}
              </div>
              <div class="q-progress"><span id="q-progress-text">已完成 0 / ${scale.items.length}</span><div class="progress"><i id="q-progress-bar"></i></div></div>`,
            actions: `<button class="btn ghost" data-close>先不做了</button><button class="btn primary" id="q-submit" disabled>提交</button>`,
            onMount(w) {
              const submit = w.querySelector('#q-submit');
              const bar = w.querySelector('#q-progress-bar');
              const text = w.querySelector('#q-progress-text');
              w.querySelectorAll('.q-opt').forEach(btn => btn.onclick = () => {
                const qi = Number(btn.dataset.q);
                answers[qi] = Number(btn.dataset.v);
                w.querySelectorAll(`.q-opt[data-q="${qi}"]`).forEach(x => x.classList.toggle('on', x === btn));
                const done = answers.filter(a => a !== null).length;
                text.textContent = `已完成 ${done} / ${scale.items.length}`;
                bar.style.width = `${(done / scale.items.length) * 100}%`;
                submit.disabled = done !== scale.items.length;
              });
              submit.onclick = async () => {
                submit.disabled = true; submit.textContent = '分析中…';
                try {
                  const r = await YB.api('/api/assessments', { method: 'POST', body: { scale: scale.id, answers } });
                  m.close();
                  const a = r.assessment;
                  YB.modal({
                    title: '测评结果 · ' + scale.name,
                    body: `
                      <div class="assess-result">
                        <div class="assess-score"><b>${a.score}</b><span>/${a.max}</span><em class="${levelClass(a.level)}">${YB.esc(a.level)}</em></div>
                        <div class="progress big"><i style="width:${(a.score / a.max) * 100}%"></i></div>
                        <p>${YB.nl2br(a.insight?.insight || '')}</p>
                        <div class="suggestion-box"><b>可以试试</b>${(a.insight?.suggestions || []).map(x => `<p>· ${YB.esc(x)}</p>`).join('')}</div>
                        <p class="fineprint">${YB.esc(a.insight?.note || '自我觉察工具，不构成诊断。')}</p>
                      </div>`,
                    actions: `<button class="btn ghost" data-close>先这样</button><button class="btn primary" id="after-assess">生成 7 天复盘</button>`,
                    onMount(w2) {
                      w2.querySelector('#after-assess').onclick = async () => {
                        try {
                          const rep = await YB.api('/api/reports/generate', { method: 'POST', body: { days: 7 } });
                          showReport(rep.report);
                        } catch (e) { YB.toast(e.message, 'error'); }
                      };
                    }
                  });
                  setTimeout(() => YB.routeRender(true), 500);
                } catch (e) {
                  YB.toast(e.message, 'error'); submit.disabled = false; submit.textContent = '提交';
                }
              };
            }
          });
        }

        function showReport(r) {
          const c = r.content || {};
          YB.modal({
            title: r.title,
            cls: 'report-modal',
            body: `
              <p class="report-date">${YB.fmtDate(r.createdAt, true)} · 仅本人可见</p>
              <p class="report-summary">${YB.nl2br(c.summary || '')}</p>
              ${c.curve && c.curve.length ? `<div class="report-chart">${YB.curveChart(c.curve, { height: 120 })}</div>` : ''}
              <div class="report-section win"><h5>${YB.icon('sprout', 16)} 肉眼可见的进步</h5>${(c.wins || []).map(x => `<p>${YB.esc(x)}</p>`).join('')}</div>
              <div class="report-section gap"><h5>${YB.icon('alert', 16)} 当前需要注意</h5>${(c.gaps || []).map(x => `<p>${YB.esc(x)}</p>`).join('')}</div>
              <div class="report-section plan"><h5>${YB.icon('leaf', 16)} 下一阶段方案</h5>${(c.plan || []).map((x, i) => `<p><b>${i + 1}.</b> ${YB.esc(x)}</p>`).join('')}</div>
              ${c.quote ? `<blockquote>${YB.esc(c.quote)}</blockquote>` : ''}
              <p class="report-closing">${YB.esc(c.closing || '')}</p>
              <p class="fineprint">报告由你的记录生成，仅作自我成长参考，不构成诊断。</p>`,
            actions: `<button class="btn ghost" data-close>收好</button><button class="btn primary" id="print-report">下载文字版</button>`,
            onMount(w) {
              w.querySelector('#print-report').onclick = () => {
                const lines = [r.title, YB.fmtDate(r.createdAt), '', c.summary, '', '进步：', ...(c.wins || []).map(x => '- ' + x), '', '注意：', ...(c.gaps || []).map(x => '- ' + x), '', '方案：', ...(c.plan || []).map((x, i) => `${i + 1}. ${x}`), '', c.quote || '', c.closing || '', '', '愈伴 · 心理成长参考，不替代医疗'];
                const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob); a.download = `${r.title}-愈伴.txt`; a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              };
            }
          });
        }
      }
    };
  };

  function scaleIcon(id) {
    return { mood: 'wave', anxiety: 'wind', rumination: 'brain', sleep: 'moon' }[id] || 'heart';
  }
  function levelClass(level) {
    if (!level) return '';
    if (/偏高|需要支持|高消耗|明显困扰/.test(level)) return 'lv-high';
    if (/中度|明显|持续|中度困扰/.test(level)) return 'lv-mid';
    if (/轻度/.test(level)) return 'lv-soft';
    return 'lv-low';
  }

  /* ================= 人格镜像 ================= */
  V.mystic = async function () {
    const p = YB.state.profile || (await YB.api('/api/profile'));
    const types = ['心境签', '成长签', '勇气签', '释怀签', '平安签'];
    return {
      html: `
      <div class="mystic-page">
        <section class="mystic-hero">
          <div>
            <p class="eyebrow">人格镜像 · 合规疗愈</p>
            <h2>不是算命，是照见自己</h2>
            <p>先天底色 + 你真实的人生经历，只用来理解性格、松开心结。不测吉凶，不预测命运。</p>
          </div>
          <div class="mystic-art">${YB.mascot(132)}<span class="orbit"></span></div>
        </section>

        <div class="seg-tabs" id="mystic-tabs">
          <button class="seg on" data-mtab="personality">人格镜像</button>
          <button class="seg" data-mtab="tarot">情绪塔罗</button>
          <button class="seg" data-mtab="draw">静心抽签</button>
          <button class="seg" data-mtab="zen">潜意识禅卡</button>
        </div>

        <section class="mystic-panel" id="panel-personality">
          <div class="card">
            <div class="card-head"><div><p class="label">生辰 × 人生经历</p><h3>你的人格是怎么长成现在这样的</h3></div></div>
            <div class="mystic-form-grid">
              <label class="field"><span>生日</span><input type="date" id="m-birthday" class="input" value="${YB.esc(p.birthday || '')}"></label>
              <label class="field"><span>出生时间（选填）</span><input type="time" id="m-time" class="input"></label>
              <label class="field"><span>出生城市（选填）</span><input class="input" id="m-city" value="${YB.esc(p.city || '')}" maxlength="20"></label>
              <label class="field span-2"><span>现在最想理解自己什么（选填）</span><input class="input" id="m-focus" maxlength="60" placeholder="例如：为什么我总在关系里讨好"></label>
            </div>
            <button class="btn primary" id="m-run">${YB.icon('crystal', 16)} 生成我的人格镜像</button>
          </div>
          <div id="m-result" class="mystic-result"></div>
        </section>

        <section class="mystic-panel" id="panel-tarot" hidden>
          <div class="card">
            <div class="card-head"><div><p class="label">情绪疗愈塔罗</p><h3>把纠结摊开来看看</h3></div></div>
            <p class="muted">不替你做决定，只把心里没被听见的部分照出来。</p>
            <textarea class="input area" id="tarot-q" rows="2" maxlength="80" placeholder="你现在最纠结的一件事…（选填）"></textarea>
            <button class="btn primary" id="tarot-run">${YB.icon('crystal', 16)} 抽三张牌</button>
          </div>
          <div id="tarot-result" class="tarot-result"></div>
        </section>

        <section class="mystic-panel" id="panel-draw" hidden>
          <div class="card">
            <div class="card-head"><div><p class="label">古风静心签</p><h3>今天，给自己一句提示</h3></div></div>
            <div class="chips" id="draw-types">${types.map((t, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-draw-type="${t}">${t}</button>`).join('')}</div>
            <button class="btn primary" id="draw-run">${YB.icon('leaf', 16)} 抽取今日签</button>
            <div id="draw-result"></div>
          </div>
        </section>

        <section class="mystic-panel" id="panel-zen" hidden>
          <div class="card zen-card">
            <div class="card-head"><div><p class="label">潜意识禅卡</p><h3>抽一张，照见未被察觉的心事</h3></div></div>
            <div class="zen-deck">
              ${['一念', '放下', '归处', '观照', '留白', '缓行'].map(n => `<span class="zen-back">${n}</span>`).join('')}
            </div>
            <button class="btn primary" id="zen-run">${YB.icon('sparkle', 16)} 抽一张禅卡</button>
            <div id="zen-result"></div>
          </div>
        </section>

        <p class="fineprint">本模块内容全为心理投射与自我成长参考，不算命、不测吉凶、不涉封建迷信，不替代任何专业意见。</p>
      </div>`,
      mount(root) {
        root.querySelectorAll('[data-mtab]').forEach(t => t.onclick = () => {
          root.querySelectorAll('[data-mtab]').forEach(x => x.classList.toggle('on', x === t));
          ['personality', 'tarot', 'draw', 'zen'].forEach(k => root.querySelector(`#panel-${k}`).hidden = k !== t.dataset.mtab);
        });

        root.querySelector('#m-run').onclick = async (e) => {
          const btn = e.currentTarget;
          const birthday = root.querySelector('#m-birthday').value;
          if (!birthday) return YB.toast('先填一下生日吧', 'error');
          btn.disabled = true; btn.textContent = '正在照见…';
          try {
            const r = await YB.api('/api/mystic/personality', { method: 'POST', body: {
              birthday, time: root.querySelector('#m-time').value,
              city: root.querySelector('#m-city').value, focus: root.querySelector('#m-focus').value
            }});
            root.querySelector('#m-result').innerHTML = renderPersonality(r.result);
            root.querySelector('#m-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (err) { YB.toast(err.message, 'error'); }
          btn.disabled = false; btn.innerHTML = `${YB.icon('crystal', 16)} 重新生成`;
        };

        root.querySelector('#tarot-run').onclick = async (e) => {
          const btn = e.currentTarget;
          const question = root.querySelector('#tarot-q').value;
          btn.disabled = true; btn.textContent = '正在洗牌…';
          try {
            const r = await YB.api('/api/mystic/tarot', { method: 'POST', body: { question, count: 3 } });
            root.querySelector('#tarot-result').innerHTML = `
              <div class="tarot-cards">
                ${r.cards.map((c, i) => `<div class="tarot-card" style="animation-delay:${i * 0.18}s"><span class="tc-num">${i + 1}</span><b>${YB.esc(c.name)}</b><em>${YB.esc(c.en)}</em><p>${YB.esc(c.keyword)}</p></div>`).join('')}
              </div>
              <div class="card tarot-reading">
                <p class="tarot-headline">${YB.nl2br(r.result.headline)}</p>
                <div class="tarot-lines">${(r.result.cards || []).map(c => `<div><b>${YB.esc(c.name)}</b><p>${YB.esc(c.line)}</p></div>`).join('')}</div>
                <p>${YB.nl2br(r.result.reading || '')}</p>
                <div class="action-line">${YB.icon('leaf', 16)} 今天可以：${YB.esc(r.result.action || '')}</div>
                <p class="fineprint">${YB.esc(r.result.note || '塔罗为心理投射工具，不测吉凶。')}</p>
              </div>`;
          } catch (err) { YB.toast(err.message, 'error'); }
          btn.disabled = false; btn.innerHTML = `${YB.icon('crystal', 16)} 重新抽牌`;
        };

        let drawType = '心境签';
        root.querySelectorAll('[data-draw-type]').forEach(b => b.onclick = () => {
          root.querySelectorAll('[data-draw-type]').forEach(x => x.classList.remove('on'));
          b.classList.add('on'); drawType = b.dataset.drawType;
        });
        root.querySelector('#draw-run').onclick = async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          try {
            const r = await YB.api('/api/mystic/draw', { method: 'POST', body: { type: drawType } });
            root.querySelector('#draw-result').innerHTML = `
              <div class="draw-slip">
                <span class="draw-seal">${YB.icon('leaf', 18)}</span>
                <p class="draw-type">${YB.esc(r.result.type)}</p>
                <p class="draw-text">${YB.nl2br(r.result.text)}</p>
                <p class="fineprint">${YB.esc(r.result.note)}</p>
              </div>`;
          } catch (err) { YB.toast(err.message, 'error'); }
          btn.disabled = false; btn.innerHTML = `${YB.icon('leaf', 16)} 再抽一签`;
        };

        root.querySelector('#zen-run').onclick = async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true; btn.textContent = '正在静心…';
          try {
            const r = await YB.api('/api/mystic/zen');
            root.querySelector('#zen-result').innerHTML = `
              <div class="zen-result">
                <span class="zen-word">${YB.esc(r.result.name)}</span>
                <p class="zen-text">${YB.esc(r.result.text)}</p>
                <div class="zen-prompt">${YB.icon('sparkle', 15)} ${YB.esc(r.result.prompt)}</div>
                <p class="fineprint">${YB.esc(r.result.note)}</p>
              </div>`;
          } catch (err) { YB.toast(err.message, 'error'); }
          btn.disabled = false; btn.innerHTML = `${YB.icon('sparkle', 16)} 再抽一张`;
        };
      }
    };
  };

  function renderPersonality(r) {
    return `
      <div class="persona-card">
        <div class="persona-head">
          <p class="label">${YB.esc(r.title || '人格镜像')}</p>
          <div class="persona-meta">${(r.meta || []).map(m => `<span class="chip soft">${YB.esc(m)}</span>`).join('')}</div>
        </div>
        <div class="persona-block"><h5>先天底色</h5><p>${YB.nl2br(r.nature || '')}</p></div>
        <div class="persona-block"><h5>你为什么会成为现在的你</h5><p>${YB.nl2br(r.origin || '')}</p></div>
        <div class="persona-two">
          <div><h5>天赋与优势</h5><p>${YB.nl2br(typeof r.gifts === 'string' ? r.gifts : (r.gifts || []).join('\n'))}</p></div>
          <div><h5>需要留意的模式</h5><p>${YB.nl2br(typeof r.shadows === 'string' ? r.shadows : (r.shadows || []).join('\n'))}</p></div>
        </div>
        <div class="persona-block"><h5>适合你的活法</h5><p>${YB.nl2br(r.lifestyle || '')}</p></div>
        <div class="persona-block"><h5>关系与边界</h5><p>${YB.nl2br(r.relations || '')}</p></div>
        <div class="persona-block accent"><h5>你的疗愈方式</h5><p>${YB.nl2br(r.healing || '')}</p></div>
        <p class="fineprint">${YB.esc(r.note || '本解读为心理投射与自我成长参考，不测吉凶。')}</p>
      </div>`;
  }

  /* ================= 资源库 ================= */
  V.library = async function () {
    const data = await YB.api('/api/library');
    return {
      html: `
      <div class="library-page">
        <section class="soft-hero compact">
          <div>
            <p class="eyebrow">双轨疗愈资源库</p>
            <h2>科学自救 + 国风修身</h2>
            <p>不讲玄学，只讲能落地练习的方法。每个练习都能在十分钟内开始。</p>
          </div>
          <div class="soft-art">${YB.mascot(112)}</div>
        </section>
        ${data.groups.map(g => `
          <section class="lib-group">
            <div class="section-head"><div><p class="label">${g.group}</p><h3>${YB.icon(g.icon, 18)} ${g.group}</h3></div></div>
            <div class="lib-grid">
              ${g.items.map(it => `
                <button class="lib-item card" data-lib="${YB.esc(it.id)}">
                  <div class="lib-top"><span class="lib-type">${YB.esc(it.type)}</span><span class="lib-time">${YB.esc(it.duration)}</span></div>
                  <b>${YB.esc(it.title)}</b>
                  <p>${YB.esc(it.desc)}</p>
                  <span class="lib-more">打开练习 ${YB.icon('arrow', 14)}</span>
                </button>`).join('')}
            </div>
          </section>`).join('')}
        <p class="fineprint">资源内容为心理调适与自我成长参考，不替代医疗治疗。国风内容去玄学化，只保留修身方法。</p>
      </div>`,
      mount(root) {
        const all = data.groups.flatMap(g => g.items);
        root.querySelectorAll('[data-lib]').forEach(b => b.onclick = () => {
          const it = all.find(x => x.id === b.dataset.lib);
          if (!it) return;
          const isFocus = it.id === 'r-focus';
          YB.modal({
            title: it.title,
            cls: 'lib-modal',
            body: `
              <div class="lib-detail-top"><span class="chip soft">${YB.esc(it.type)}</span><span class="hint">${YB.esc(it.duration)}</span></div>
              <p class="modal-text">${YB.esc(it.desc)}</p>
              <div class="steps-list">${it.steps.map((s, i) => `<div class="step-row"><span>${i + 1}</span><p>${YB.esc(s)}</p></div>`).join('')}</div>
              ${isFocus ? `<div class="focus-timer"><b id="focus-clock">25:00</b><button class="btn soft small" id="focus-btn">开始专注</button></div>` : ''}
              ${it.id === 'r-anxiety' ? `<button class="btn soft" id="lib-breathe">${YB.icon('wind', 16)} 打开呼吸引导</button>` : ''}
              <p class="fineprint">练习过程中如出现明显不适，请停止并联系专业人员。</p>`,
            actions: `<button class="btn ghost" data-close>知道了</button><button class="btn primary" id="lib-done">我练完了</button>`,
            onMount(w) {
              w.querySelector('#lib-done').onclick = async () => {
                try {
                  await YB.api('/api/emotions', { method: 'POST', body: { score: 6, mood: '平静', tags: ['练习'], note: `完成练习：${it.title}` } });
                  YB.toast('已记录一次练习，身体会记得');
                } catch (_) {}
              };
              w.querySelector('#lib-breathe')?.addEventListener('click', () => YB.safetyModal());
              if (isFocus) {
                let total = 25 * 60, left = total, timer = null;
                const clock = w.querySelector('#focus-clock');
                const btn = w.querySelector('#focus-btn');
                const render = () => { clock.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; };
                btn.onclick = () => {
                  if (timer) { clearInterval(timer); timer = null; btn.textContent = '继续专注'; return; }
                  btn.textContent = '暂停';
                  timer = setInterval(() => {
                    left--;
                    render();
                    if (left <= 0) { clearInterval(timer); timer = null; clock.textContent = '完成'; btn.textContent = '重新开始'; left = total; }
                  }, 1000);
                };
                w.querySelector('.modal-close').addEventListener('click', () => clearInterval(timer));
              }
            }
          });
        });
      }
    };
  };
})();
