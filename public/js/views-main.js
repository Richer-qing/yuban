/* 愈伴 · 首页 / 陪伴 / 日记 / 树洞 */
(function () {
  const YB = window.YB;
  const V = (YB.views = YB.views || {});

  const MOODS = ['平静', '开心', '疲惫', '焦虑', '低落', '愤怒', '孤独', '委屈', '期待', '麻木'];
  const TAGS = ['失眠', '失恋', '原生家庭', '职场', '学业', '人际', '自我否定', '容貌焦虑', '迷茫', '内耗'];

  function moodCheckinHTML(compact = false) {
    return `
      <div class="checkin" data-checkin>
        <div class="checkin-head">
          <div><h3>此刻，你感觉怎么样？</h3><p>不评判，只是记录。每一个真实的感受都值得被看见。</p></div>
          <span class="score-bubble" data-score-label>5 / 10</span>
        </div>
        <div class="score-row">
          <span class="score-end">很难熬</span>
          <input type="range" min="1" max="10" value="5" step="1" class="score-range" data-score>
          <span class="score-end">很好</span>
        </div>
        <div class="score-ticks">${Array.from({ length: 10 }, (_, i) => `<span data-tick="${i + 1}">${i + 1}</span>`).join('')}</div>
        <div class="chips mood-chips" data-moods>${MOODS.map(m => `<button type="button" class="chip" data-mood="${m}">${m}</button>`).join('')}</div>
        ${compact ? '' : `
        <div class="chips tag-chips" data-tags>${TAGS.map(t => `<button type="button" class="chip soft" data-tag="${t}">${t}</button>`).join('')}</div>
        <textarea class="input area" rows="2" data-note placeholder="想补充一点什么吗？（选填）"></textarea>`}
        <div class="checkin-foot">
          <p class="hint">所有记录仅本人可见</p>
          <button class="btn primary" data-save-mood>记下这一刻</button>
        </div>
      </div>`;
  }

  function bindCheckin(root, onSaved) {
    const box = root.querySelector('[data-checkin]');
    if (!box) return;
    const range = box.querySelector('[data-score]');
    const label = box.querySelector('[data-score-label]');
    const ticks = box.querySelectorAll('[data-tick]');
    const sync = () => {
      label.textContent = `${range.value} / 10`;
      label.className = `score-bubble ${range.value <= 3 ? 'low' : range.value >= 7 ? 'high' : ''}`;
      ticks.forEach(t => t.classList.toggle('on', Number(t.dataset.tick) <= Number(range.value)));
    };
    range.addEventListener('input', sync); sync();
    let mood = '', tags = [];
    box.querySelectorAll('[data-mood]').forEach(b => b.onclick = () => {
      box.querySelectorAll('[data-mood]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); mood = b.dataset.mood;
    });
    box.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => {
      b.classList.toggle('on');
      tags = [...box.querySelectorAll('[data-tag].on')].map(x => x.dataset.tag);
    });
    const save = box.querySelector('[data-save-mood]');
    save.onclick = async () => {
      if (save.disabled) return;
      save.disabled = true; save.textContent = '记录中…';
      try {
        await YB.api('/api/emotions', { method: 'POST', body: {
          score: Number(range.value), mood: mood || YB.moodWord(Number(range.value)),
          tags, note: box.querySelector('[data-note]')?.value || ''
        }});
        YB.toast('已经记下了，谢谢你对自己诚实');
        if (onSaved) onSaved(); else YB.routeRender(true);
      } catch (e) {
        YB.toast(e.message, 'error');
        save.disabled = false; save.textContent = '记下这一刻';
      }
    };
  }
  YB.moodCheckinHTML = moodCheckinHTML;
  YB.bindCheckin = bindCheckin;

  /* ================= 首页 ================= */
  V.home = async function () {
    const ov = await YB.api('/api/overview');
    YB.state.overview = ov; YB.state.profile = ov.profile; YB.state.aiReady = ov.aiReady;
    const [greet, daily] = await Promise.all([
      YB.api('/api/companion/greeting').catch(() => ({ text: '我在这儿。' })),
      YB.api(`/api/studio/daily?style=${YB.styleKey(ov.profile.style)}`).catch(() => ({ text: '' }))
    ]);
    const p = ov.profile;
    const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    const modules = [
      { r: 'sleep', i: 'moon', n: '助眠', d: '今晚好睡一点' },
      { r: 'dreams', i: 'cloud', n: '解梦', d: '听见潜意识' },
      { r: 'assess', i: 'brain', n: '测评报告', d: '看见变化' },
      { r: 'mystic', i: 'crystal', n: '人格镜像', d: '理解自己' },
      { r: 'life', i: 'compass', n: '同城治愈', d: '走到生活里' },
      { r: 'studio', i: 'sparkle', n: '我的影像', d: '专属短片' },
      { r: 'treehole', i: 'eye', n: '匿名树洞', d: '有人回应' },
      { r: 'library', i: 'book2', n: '疗愈资源', d: '科学 + 国风' },
      { r: 'support', i: 'shield', n: '专业支持', d: '持证咨询师' }
    ];
    return {
      html: `
      <div class="home">
        <section class="hero">
          <div class="hero-text">
            <p class="eyebrow">${dateStr}</p>
            <h2>${YB.greetingWord()}，${YB.esc(p.nickname)}</h2>
            <p class="hero-sub">${ov.streak > 0 ? `你已经连续记录 ${ov.streak} 天。` : '不着急变好，先允许自己被看见。'} ${ov.avgMood != null ? `最近情绪均值 ${ov.avgMood}/10。` : ''}</p>
            <div class="hero-actions">
              <button class="btn primary" onclick="YB.go('chat')">${YB.icon('chat', 17)} 和${YB.esc(p.petName)}聊聊</button>
              <button class="btn ghost" data-scroll-checkin>${YB.icon('heart', 17)} 记录此刻心情</button>
            </div>
            <div class="hero-stats">
              <div><b>${ov.streak}</b><span>连续记录</span></div>
              <div><b>${ov.counts.memories}</b><span>被记住的事</span></div>
              <div><b>${ov.badgesUnlocked}</b><span>成长勋章</span></div>
            </div>
          </div>
          <div class="hero-pet">
            <div class="pet-halo"></div>
            ${YB.petAvatar(p.petType || 'nuomi', 178, 'pet-bob')}
            <div class="pet-tag"><b>${YB.esc(p.petName)}</b><span>在线 · 记得你的一切</span></div>
          </div>
        </section>

        ${!ov.onboarded ? `
        <section class="card onboard-card">
          <div class="onboard-pet">${YB.petAvatar(p.petType || 'nuomi', 76, 'pet-bob')}</div>
          <div class="onboard-main">
            <p class="label">第一次见面 · 1 分钟</p>
            <h3>先让我真正认识你</h3>
            <p class="muted">你最近在为什么难受、希望被怎样对待、哪些话不能碰。告诉我，我才会真的懂你——而不是套模板。</p>
          </div>
          <button class="btn primary" onclick="YB.go('welcome')">开始认识</button>
        </section>` : ''}

        ${ov.plan ? `
        <section class="card plan-card">
          <div class="card-head">
            <div><p class="label">为你定制的 7 天计划 · ${ov.plan.focus || '疗愈'}</p><h3>${YB.esc(ov.plan.title)}</h3></div>
            <button class="text-btn" data-plan-all>全部 7 天 <span>→</span></button>
          </div>
          <div class="plan-progress">${ov.plan.days.map(d => `<span class="${d.done ? 'on' : ''}"></span>`).join('')}<b>${ov.plan.progress.length}/7</b></div>
          ${ov.plan.today ? `
          <div class="plan-today">
            <span class="plan-day">DAY ${ov.plan.today.day}</span>
            <div>
              <h4>${YB.esc(ov.plan.today.title)}</h4>
              <p class="muted">${YB.esc(ov.plan.today.why || '')}</p>
              <p class="plan-action">${YB.icon('sparkle', 15)} ${YB.esc(ov.plan.today.action)}</p>
            </div>
            <span class="plan-dur">${YB.esc(ov.plan.today.duration || '15 分钟')}</span>
          </div>
          <div class="row-between">
            <span class="hint">只做这一件小事，不用做到完美</span>
            <button class="btn soft small" data-plan-done="${ov.plan.today.day}">今天我做到了</button>
          </div>` : `<div class="plan-complete">${YB.icon('trophy', 22)} 7 天计划已完成。想继续的话，可以生成下一轮。</div>`}
        </section>` : ov.onboarded ? `
        <section class="card plan-card plan-empty">
          <div><p class="label">还没有专属计划</p><h3>把"想变好"拆成 7 件小事</h3><p class="muted">根据你的困扰与状态生成，每天只做一件。</p></div>
          <button class="btn primary small" data-plan-generate>生成我的计划</button>
        </section>` : ''}

        <section class="card greeting-card">
          <div class="greeting-head">
            <div class="mini-pet">${YB.petAvatar(p.petType || 'nuomi', 52)}</div>
            <div>
              <p class="label">${YB.esc(p.petName)}主动来找你了</p>
              <p class="greeting-time">${YB.fmtDate(new Date().toISOString(), true)} · 主动关心</p>
            </div>
          </div>
          <p class="greeting-text">${YB.nl2br(greet.text)}</p>
          <div class="row-between">
            <button class="btn soft" onclick="YB.go('chat')">${YB.icon('chat', 16)} 继续聊</button>
            <button class="text-btn" onclick="YB.go('journal')">先记一笔 <span>→</span></button>
          </div>
        </section>

        <section class="split-2">
          <div class="card daily-card">
            <div class="card-head">
              <div>
                <p class="label">只属于你的一天一句</p>
                <h3>今日专属激励</h3>
              </div>
              <button class="icon-btn" data-daily-regen title="换一句">${YB.icon('refresh', 17)}</button>
            </div>
            <div class="daily-style">${YB.styleTabs(ov.profile.style)}</div>
            <div class="daily-text" data-daily-text>${YB.nl2br(daily.text || '今天也辛苦了。')}</div>
            <div class="row-between">
              <span class="hint">根据你今天的状态生成，可朗读、可存成分享卡</span>
              <div class="daily-actions">
                <button class="text-btn" data-speak-daily>${YB.icon('wave', 14)} 朗读</button>
                <button class="text-btn" data-card-daily>${YB.icon('download', 14)} 分享卡</button>
                <button class="text-btn" data-copy-daily>复制 <span>→</span></button>
              </div>
            </div>
          </div>

          <div class="card checkin-card">
            ${moodCheckinHTML(true)}
          </div>
        </split-2>

        <section class="card">
          <div class="card-head">
            <div><p class="label">今天的你</p><h3>情绪轨迹</h3></div>
            <button class="text-btn" onclick="YB.go('journal')">全部记录 <span>→</span></button>
          </div>
          ${ov.curve.length ? YB.curveChart(ov.curve, { height: 132 }) : `
            <div class="chart-empty">
              <p>还没有情绪记录。记下第一笔，曲线就会有起点。</p>
              <button class="btn soft" data-scroll-checkin>现在记录</button>
            </div>`}
          ${ov.curve.length ? `<div class="metric-row">
            <div><b>${ov.avgMood}<span>/10</span></b><p>近期均值</p></div>
            <div><b>${ov.counts.chats}<span>轮</span></b><p>陪伴对话</p></div>
            <div><b>${ov.counts.dreams}<span>个</span></b><p>记录梦境</p></div>
          </div>` : ''}
        </section>

        <section class="section-head">
          <div><p class="label">一屏可达</p><h3>今天想做点什么</h3></div>
        </section>
        <section class="module-grid">
          ${modules.map(m => `<a class="module" href="#/${m.r}">
            <span class="module-icon">${YB.icon(m.i, 21)}</span>
            <b>${m.n}</b><span class="muted">${m.d}</span>
            <span class="module-arrow">${YB.icon('arrow', 15)}</span>
          </a>`).join('')}
        </section>

        ${ov.lastReport ? `
        <section class="card report-teaser" onclick="YB.go('assess')">
          <div>
            <p class="label">最近一次复盘</p>
            <h3>${YB.esc(ov.lastReport.title)}</h3>
            <p class="muted">${YB.fmtDate(ov.lastReport.createdAt)} · 点开看看你走过的路</p>
          </div>
          <span class="round-arrow">${YB.icon('arrow', 18)}</span>
        </section>` : `
        <section class="card report-teaser" onclick="YB.go('assess')">
          <div>
            <p class="label">还没有复盘报告</p>
            <h3>7 天，看见一次自己的变化</h3>
            <p class="muted">系统会根据你的情绪、对话与睡眠自动生成</p>
          </div>
          <span class="round-arrow">${YB.icon('arrow', 18)}</span>
        </section>`}
      </div>`,
      mount(root) {
        const markDone = async (day) => {
          try {
            await YB.api('/api/plan/complete', { method: 'POST', body: { day } });
            YB.toast('记下了，今天这一小步算数');
            setTimeout(() => YB.routeRender(true), 350);
          } catch (e) { YB.toast(e.message, 'error'); }
        };
        const doneBtn = root.querySelector('[data-plan-done]');
        if (doneBtn) doneBtn.onclick = () => markDone(Number(doneBtn.dataset.planDone));
        const genBtn = root.querySelector('[data-plan-generate]');
        if (genBtn) genBtn.onclick = async () => {
          genBtn.disabled = true; genBtn.textContent = '正在为你定制…';
          try {
            await YB.api('/api/plan/generate', { method: 'POST', body: {} });
            YB.toast('计划已生成');
            setTimeout(() => YB.routeRender(true), 350);
          } catch (e) { YB.toast(e.message, 'error'); genBtn.disabled = false; genBtn.textContent = '生成我的计划'; }
        };
        const allBtn = root.querySelector('[data-plan-all]');
        if (allBtn) allBtn.onclick = () => {
          const plan = ov.plan;
          if (!plan) return;
          const body = `<div class="plan-list">${plan.days.map(d => `
            <div class="plan-item ${d.done ? 'done' : ''}">
              <span class="plan-day">DAY ${d.day}</span>
              <div><h4>${YB.esc(d.title)}</h4><p class="muted">${YB.esc(d.action)}</p><p class="hint">${YB.esc(d.duration || '')}${d.done ? ' · 已完成' : ''}</p></div>
              ${d.done ? '<span class="plan-check">已做到</span>' : `<button class="btn ghost small" data-modal-plan="${d.day}">标记完成</button>`}
            </div>`).join('')}</div>`;
          const m = YB.modal({ title: '我的 7 天疗愈计划', body });
          document.querySelectorAll('[data-modal-plan]').forEach(b => b.onclick = async () => {
            await markDone(Number(b.dataset.modalPlan));
            m.close();
          });
        };
        root.querySelectorAll('[data-scroll-checkin]').forEach(b => b.onclick = () => {
          const c = root.querySelector('.checkin-card') || root.querySelector('[data-checkin]');
          c?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          root.querySelector('[data-checkin] [data-score]')?.focus();
        });
        bindCheckin(root, () => { YB.toast('已记录，去日记看看你的曲线'); setTimeout(() => YB.routeRender(true), 400); });

        const textEl = root.querySelector('[data-daily-text]');
        const regen = root.querySelector('[data-daily-regen]');
        let currentStyle = YB.state.profile.style;
        const loadDaily = async (style) => {
          textEl.innerHTML = YB.loading('正在为你写…');
          try {
            const d = await YB.api(`/api/studio/daily?style=${YB.styleKey(style)}`);
            textEl.innerHTML = YB.nl2br(d.text);
          } catch (e) { textEl.textContent = e.message; }
        };
        root.querySelectorAll('[data-style]').forEach(b => b.onclick = () => {
          root.querySelectorAll('[data-style]').forEach(x => x.classList.remove('on'));
          b.classList.add('on'); currentStyle = b.dataset.style; loadDaily(currentStyle);
        });
        regen.onclick = async () => {
          regen.disabled = true; textEl.innerHTML = YB.loading('换一种说法…');
          try {
            const d = await YB.api('/api/studio/daily/regenerate', { method: 'POST', body: { style: currentStyle } });
            textEl.innerHTML = YB.nl2br(d.text);
            if (d.demo) YB.toast('本地模式：配置 Key 后可获得更贴合的生成');
          } catch (e) { YB.toast(e.message, 'error'); }
          regen.disabled = false;
        };
        root.querySelector('[data-copy-daily]').onclick = () => YB.copy(textEl.textContent.trim());
        root.querySelector('[data-speak-daily]').onclick = () => YB.speak(textEl.textContent.trim());
        root.querySelector('[data-card-daily]').onclick = () => YB.dailyCard({
          text: textEl.textContent.trim(),
          nickname: ov.profile.nickname,
          date: dateStr
        });
      }
    };
  };

  /* ================= 陪伴对话 ================= */
  const PROMPTS = {
    '日常陪伴': ['今天有点累，想跟你说说', '我又开始内耗了', '能陪我安静地待会儿吗', '我不知道该从哪说起'],
    '失恋疗愈': ['我还是会想起 TA', '今天忍不住看了 TA 的动态', '我怕再也爱不上别人了', '我想知道怎么停止反复'],
    '心理疾病陪伴': ['我今晚又心悸了', '最近情绪一直很低', '我怕自己又复发', '先陪我稳下来'],
    '人格特质陪伴': ['为什么我总在讨好别人', '我好像是回避型依恋', '我该怎么建立边界', '我想看清自己的关系模式']
  };
  const TRACKS = ['日常陪伴', '失恋疗愈', '心理疾病陪伴', '人格特质陪伴'];

  V.chat = async function () {
    const hist = await YB.api('/api/chat/history?limit=80');
    const p = YB.state.profile || (await YB.api('/api/profile'));
    YB.chat = YB.chat || { style: p.style, track: '日常陪伴' };
    const petType = p.petType || 'nuomi';
    const petMeta = (YB.PETS || []).find(x => x.key === petType) || { name: '糯米' };
    const msgs = hist.messages.filter(m => !(m.role === 'assistant' && m.content.includes('从今天起，你说过的话我都会记得')));
    const renderMsg = (m) => `
      <div class="msg ${m.role === 'user' ? 'me' : 'pet'}">
        ${m.role === 'assistant' ? `<div class="msg-avatar">${YB.petAvatar(petType, 38)}</div>` : ''}
        <div class="bubble">${YB.nl2br(m.content)}</div>
      </div>`;
    return {
      html: `
      <div class="chat-page">
        <div class="chat-top card">
          <div class="chat-pet" id="chat-pet-head">${YB.petAvatar(petType, 76, 'pet-bob')}</div>
          <div class="chat-intro">
            <h2>${YB.esc(p.petName)} <span class="online-dot"></span></h2>
            <p>${p.nickname}，我记得关于你的 ${YB.state.overview?.counts?.memories ?? '很多'} 件事</p>
            <button class="mem-pill" onclick="YB.go('me')">${YB.icon('heart', 14)} 查看它记住的我</button>
          </div>
          <button class="btn ghost small" onclick="YB.sos()">${YB.icon('shield', 16)} 情绪急救</button>
        </div>

        <div class="chat-controls card">
          <div class="control-row">
            <span class="control-label">换个萌宠</span>
            <div class="pet-mini-row" data-pet-row>
              ${(YB.PETS || []).map(x => `<button class="pet-mini ${x.key === petType ? 'on' : ''}" data-pet="${x.key}" title="${YB.esc(x.desc)}">${YB.petAvatar(x.key, 30)}<span>${x.name}</span><em>${x.tag}</em></button>`).join('')}
            </div>
          </div>
          <div class="control-row">
            <span class="control-label">说话风格</span>
            <div class="chips" data-style-chips>${YB.chips(['温柔宠溺', '犀利骂醒', '佛系静心', '热血励志'], YB.chat.style, 'data-style')}</div>
          </div>
          <div class="control-row">
            <span class="control-label">陪伴赛道</span>
            <div class="chips" data-track-chips>${YB.chips(TRACKS, YB.chat.track, 'data-track')}</div>
          </div>
        </div>

        <div class="chat-stream" id="chat-stream">
          ${msgs.length ? msgs.map(renderMsg).join('') : `
            <div class="chat-welcome">
              <div class="welcome-pet">${YB.petAvatar(petType, 120, 'pet-bob')}</div>
              <h3>${YB.esc(p.petName)}在这里</h3>
              <p>${petMeta.desc || ''} 你不用重复介绍自己。你经历过的、难受过的、没说完的，它都记得。</p>
              <div class="welcome-steps">
                <div class="welcome-step"><i>1</i><div><b>先说说此刻最难受的那一点</b><p>不用组织语言，一句话、一个词都行。</p></div></div>
                <div class="welcome-step"><i>2</i><div><b>我帮你把它说清楚</b><p>不评判、不急着给建议，先接住你的感受。</p></div></div>
                <div class="welcome-step"><i>3</i><div><b>然后一起挪一小步</b><p>只做今天做得到的一件小事，做不到也没关系。</p></div></div>
              </div>
            </div>`}
        </div>

        <div class="quick-prompts" id="quick-prompts">
          ${(PROMPTS[YB.chat.track] || PROMPTS['日常陪伴']).map(t => `<button class="chip soft" data-prompt="${YB.esc(t)}">${YB.esc(t)}</button>`).join('')}
        </div>

        <div class="composer card">
          <textarea id="chat-input" rows="1" placeholder="说点什么吧，好的坏的都行…" maxlength="2000"></textarea>
          <button class="send-btn" id="chat-send" aria-label="发送">${YB.icon('send', 20)}</button>
        </div>
        <p class="chat-foot-note">愈伴提供情绪陪伴，不替代医疗诊断。危机时刻请拨打 400-161-9995。</p>
      </div>`,
      mount(root) {
        const stream = root.querySelector('#chat-stream');
        const input = root.querySelector('#chat-input');
        const sendBtn = root.querySelector('#chat-send');
        const prompts = root.querySelector('#quick-prompts');
        let sending = false;

        const scroll = () => { stream.scrollTop = stream.scrollHeight; };
        scroll();

        const restyle = () => {
          root.querySelectorAll('[data-style]').forEach(b => b.classList.toggle('on', b.dataset.style === YB.chat.style));
        };
        root.querySelectorAll('[data-pet]').forEach(b => b.onclick = async () => {
          if (b.disabled || b.dataset.pet === (p.petType || 'nuomi')) return;
          const meta = (YB.PETS || []).find(x => x.key === b.dataset.pet);
          b.disabled = true;
          try {
            await YB.api('/api/profile', { method: 'PUT', body: { petType: b.dataset.pet, petName: meta.name } });
            p.petType = b.dataset.pet; p.petName = meta.name; YB.state.profile = p;
            YB.toast(`${meta.name} 来了，从现在起由它陪你`);
            YB.routeRender(true);
          } catch (err) { YB.toast(err.message, 'error'); b.disabled = false; }
        });
        root.querySelectorAll('[data-style]').forEach(b => b.onclick = () => { YB.chat.style = b.dataset.style; restyle(); });
        root.querySelectorAll('[data-track]').forEach(b => b.onclick = () => {
          YB.chat.track = b.dataset.track;
          root.querySelectorAll('[data-track]').forEach(x => x.classList.toggle('on', x.dataset.track === YB.chat.track));
          prompts.innerHTML = PROMPTS[YB.chat.track].map(t => `<button class="chip soft" data-prompt="${YB.esc(t)}">${YB.esc(t)}</button>`).join('');
          bindPrompts();
        });
        const bindPrompts = () => prompts.querySelectorAll('[data-prompt]').forEach(b => b.onclick = () => {
          input.value = b.dataset.prompt; autoGrow(); input.focus();
        });
        bindPrompts();

        const autoGrow = () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; };
        input.addEventListener('input', autoGrow);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });

        const addBubble = (role, text) => {
          const wrap = document.createElement('div');
          wrap.className = `msg ${role === 'user' ? 'me' : 'pet'}`;
          wrap.innerHTML = `${role === 'assistant' ? `<div class="msg-avatar" data-pet-avatar>${YB.petAvatar(p.petType || petType, 38)}</div>` : ''}<div class="bubble">${YB.nl2br(text)}</div>`;
          stream.appendChild(wrap); scroll();
          return wrap.querySelector('.bubble');
        };

        async function send() {
          const text = input.value.trim();
          if (!text || sending) return;
          sending = true; sendBtn.disabled = true;
          input.value = ''; autoGrow();
          addBubble('user', text);
          const bubble = addBubble('assistant', '');
          bubble.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`;
          let acc = '';
          try {
            const res = await fetch('/api/chat/stream', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: text, style: YB.chat.style, track: YB.chat.track })
            });
            if (res.status === 401) { YB.renderAuth(); return; }
            if (!res.ok) {
              let msg = '发送失败';
              try { msg = (await res.json()).error || msg; } catch (_) {}
              throw new Error(msg);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            let first = true;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const chunks = buf.split('\n\n');
              buf = chunks.pop() || '';
              for (const chunk of chunks) {
                const line = chunk.split('\n').find(l => l.startsWith('data:'));
                if (!line) continue;
                let evt;
                try { evt = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }
                if (evt.type === 'delta') {
                  if (first) { bubble.innerHTML = ''; first = false; }
                  acc += evt.text;
                  bubble.innerHTML = YB.nl2br(acc);
                  scroll();
                } else if (evt.type === 'searching') {
                  const tip = document.createElement('div');
                  tip.className = 'web-searching';
                  tip.textContent = '正在联网帮你查资料…';
                  bubble.parentElement.appendChild(tip);
                  scroll();
                } else if (evt.type === 'web') {
                  if (evt.results && evt.results.length) {
                    const box = document.createElement('div');
                    box.className = 'web-sources';
                    box.innerHTML = `<span>${YB.icon('globe', 13)} 联网查到的资料</span>` +
                      evt.results.slice(0, 3).map(r => `<a href="${YB.esc(r.url)}" target="_blank" rel="noopener">${YB.esc(r.title)}</a>`).join('');
                    bubble.parentElement.appendChild(box);
                    const searching = bubble.parentElement.querySelector('.web-searching');
                    if (searching) searching.remove();
                    scroll();
                  }
                } else if (evt.type === 'fallback') {
                  YB.toast(evt.reason || '已切换本地模式');
                } else if (evt.type === 'safety') {
                  YB.safetyModal(evt.data);
                } else if (evt.type === 'done') {
                  if (!acc && evt.full) { acc = evt.full; bubble.innerHTML = YB.nl2br(acc); }
                  if (evt.memory && evt.memory.length) {
                    const chip = document.createElement('div');
                    chip.className = 'memory-chip';
                    chip.innerHTML = `${YB.icon('heart', 14)} 记住了：${YB.esc(evt.memory.map(m => m.content).join('；').slice(0, 60))}`;
                    bubble.parentElement.appendChild(chip);
                    scroll();
                  }
                  if (evt.crisis) YB.safetyModal();
                }
              }
            }
            if (!acc) {
              bubble.innerHTML = '刚刚卡了一下，没接上。你刚才那句话我不想草草回，愿意再多说一点吗？';
            }
          } catch (e) {
            bubble.innerHTML = `刚刚走神了：${YB.esc(e.message)} <button class="link-btn" id="retry">重试</button>`;
            bubble.querySelector('#retry')?.addEventListener('click', () => { bubble.parentElement.remove(); input.value = text; send(); });
          } finally {
            sending = false; sendBtn.disabled = false; input.focus();
          }
        }
        sendBtn.onclick = send;
      }
    };
  };

  /* ================= 日记 ================= */
  V.journal = async function () {
    const [stats, diaries, badge] = await Promise.all([
      YB.api('/api/emotions/stats?days=30'),
      YB.api('/api/diaries'),
      YB.api('/api/badges')
    ]);
    const emotions = await YB.api('/api/emotions?days=30');
    const list = emotions.emotions;
    return {
      html: `
      <div class="journal-page">
        <section class="card composer-card">
          <div class="card-head">
            <div><p class="label">情绪记录</p><h3>今天的心情，值得一笔</h3></div>
            <span class="streak-pill">${YB.icon('flame', 15)} 连续 ${stats.streak} 天</span>
          </div>
          ${moodCheckinHTML(false)}
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">近 30 天</p><h3>情绪轨迹</h3></div>
            <span class="hint">均值 ${stats.avgMood ?? '-'} / 10</span>
          </div>
          ${YB.curveChart(stats.curve, { height: 140 })}
          <div class="metric-row">
            <div><b>${stats.checkins}</b><p>记录次数</p></div>
            <div><b>${stats.topTag || '—'}</b><p>高频议题</p></div>
            <div><b>${stats.trend > 0 ? '+' : ''}${stats.trend || 0}</b><p>阶段变化</p></div>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">萌宠便签日记</p><h3>写给自己的话</h3></div>
            <span class="hint">仅本人可见</span>
          </div>
          <div class="diary-form">
            <input class="input" id="diary-title" maxlength="40" placeholder="给今天起个小标题（选填）">
            <textarea class="input area" id="diary-content" rows="4" maxlength="2000" placeholder="今天发生了什么？有什么想对未来的自己说？"></textarea>
            <div class="chips" id="diary-mood">${MOODS.map(m => `<button type="button" class="chip" data-dmood="${m}">${m}</button>`).join('')}</div>
            <div class="row-between">
              <span class="hint">记录会自动进入你的心理档案</span>
              <button class="btn primary" id="diary-save">收进便签</button>
            </div>
          </div>
          <div class="diary-list">
            ${diaries.diaries.length ? diaries.diaries.map(d => `
              <article class="diary-note">
                <div class="diary-note-head">
                  <div><b>${YB.esc(d.title || '无题')}</b><span>${YB.fmtDate(d.created_at, true)}${d.mood ? ' · ' + YB.esc(d.mood) : ''}</span></div>
                  <button class="icon-btn del" data-del-diary="${d.id}" title="删除">${YB.icon('trash', 15)}</button>
                </div>
                <p>${YB.nl2br(d.content)}</p>
              </article>`).join('') : YB.empty('还没有日记', '写下第一张便签，哪怕只有一句“今天很难”。')}
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">情绪记录</p><h3>最近的每一次如实</h3></div>
          </div>
          <div class="emotion-list">
            ${list.length ? list.map(e => `
              <div class="emotion-item">
                <span class="emotion-score ${YB.moodClass(e.score)}">${e.score}</span>
                <div class="emotion-main">
                  <div class="emotion-line"><b>${YB.esc(e.mood || YB.moodWord(e.score))}</b><span>${YB.fmtDate(e.created_at, true)}</span></div>
                  ${e.note ? `<p>${YB.esc(e.note)}</p>` : ''}
                  ${e.tags.length ? `<div class="mini-tags">${e.tags.map(t => `<span>${YB.esc(t)}</span>`).join('')}</div>` : ''}
                </div>
              </div>`).join('') : YB.empty('还没有情绪记录', '上面的刻度，选一个此刻最接近的数字。')}
          </div>
        </section>

        <section class="card badges-card">
          <div class="card-head">
            <div><p class="label">成长勋章</p><h3>${badge.unlocked} / ${badge.total} 已点亮</h3></div>
          </div>
          <div class="badge-grid">
            ${badge.badges.map(b => `
              <div class="badge ${b.unlocked ? 'on' : ''}">
                <span class="badge-icon">${YB.icon(b.icon, 24)}</span>
                <b>${YB.esc(b.name)}</b>
                <p>${YB.esc(b.desc)}</p>
              </div>`).join('')}
          </div>
          <div class="treehole-teaser" onclick="YB.go('treehole')">
            <div>${YB.icon('eye', 22)}</div>
            <div><b>有些话，想被同频的人听见</b><p>去匿名树洞，写下一句不用署名的心事</p></div>
            <span>${YB.icon('arrow', 16)}</span>
          </div>
        </section>
      </div>`,
      mount(root) {
        bindCheckin(root);
        let dmood = '';
        root.querySelectorAll('[data-dmood]').forEach(b => b.onclick = () => {
          root.querySelectorAll('[data-dmood]').forEach(x => x.classList.remove('on'));
          b.classList.add('on'); dmood = b.dataset.dmood;
        });
        const save = root.querySelector('#diary-save');
        save.onclick = async () => {
          const content = root.querySelector('#diary-content').value.trim();
          if (content.length < 2) return YB.toast('再写一点点吧', 'error');
          save.disabled = true; save.textContent = '收好中…';
          try {
            await YB.api('/api/diaries', { method: 'POST', body: {
              title: root.querySelector('#diary-title').value, content, mood: dmood
            }});
            YB.toast('便签收好了，只有你能看见');
            YB.routeRender(true);
          } catch (e) { YB.toast(e.message, 'error'); save.disabled = false; save.textContent = '收进便签'; }
        };
        root.querySelectorAll('[data-del-diary]').forEach(b => b.onclick = () => {
          const id = b.dataset.delDiary;
          YB.confirm('确定删除这篇日记吗？删除后无法恢复。', async () => {
            try { await YB.api(`/api/diaries/${id}`, { method: 'DELETE' }); YB.toast('已删除'); YB.routeRender(true); }
            catch (e) { YB.toast(e.message, 'error'); }
          }, '删除');
        });
      }
    };
  };

  /* ================= 树洞 ================= */
  V.treehole = async function () {
    const data = await YB.api('/api/treehole');
    return {
      html: `
      <div class="treehole-page">
        <section class="treehole-hero">
          <div class="th-copy">
            <p class="eyebrow">匿名 · 温柔 · 不评判</p>
            <h2>把心事放进树洞</h2>
            <p>这里没有熟人，没有评价。你可以用任何一个临时昵称，说出那些一直没敢说的话。</p>
            <div class="th-rules">
              <span>${YB.icon('shield', 15)} AI 温柔风控</span>
              <span>${YB.icon('heart', 15)} 只留善意留言</span>
              <span>${YB.icon('eye', 15)} 不显示真实身份</span>
            </div>
          </div>
          <div class="th-art">${YB.mascot(130, 'pet-bob')}</div>
        </section>

        <section class="card composer-card">
          <textarea class="input area th-input" id="th-content" rows="4" maxlength="500" placeholder="今天想对树洞说点什么？难过、委屈、秘密，都可以。"></textarea>
          <div class="row-between">
            <input class="input inline" id="th-alias" maxlength="12" placeholder="临时昵称（可留空）">
            <button class="btn primary" id="th-post">放进树洞</button>
          </div>
          <p class="fineprint">发布前会经过 AI 风控：拒绝网暴、极端与违法内容。真实情绪会被保留。</p>
        </section>

        <section class="th-feed">
          ${data.posts.length ? data.posts.map(p => `
            <article class="th-post" data-post="${p.id}">
              <div class="th-post-head">
                <span class="th-avatar">${YB.esc(p.alias.slice(0, 1))}</span>
                <div><b>${YB.esc(p.alias)}</b><span>${YB.fmtDate(p.createdAt, true)}${p.seed ? ' · 共情示例' : ''}</span></div>
              </div>
              <p class="th-text">${YB.nl2br(p.content)}</p>
              <div class="th-actions">
                <button class="text-btn" data-reply-toggle="${p.id}">${YB.icon('chat', 15)} 温柔回应 ${p.replies.length ? '· ' + p.replies.length : ''}</button>
                ${p.mine ? '<span class="hint">我发布的</span>' : ''}
              </div>
              <div class="th-replies">
                ${p.replies.map(r => `<div class="th-reply"><b>${YB.esc(r.alias)}</b><p>${YB.nl2br(r.content)}</p></div>`).join('')}
              </div>
              <div class="th-reply-box" data-reply-box="${p.id}" hidden>
                <input class="input" maxlength="300" placeholder="写一句温柔的话给它…" data-reply-input="${p.id}">
                <button class="btn soft small" data-send-reply="${p.id}">发送</button>
              </div>
            </article>`).join('') : YB.empty('树洞还很安静', '成为第一个放下心事的人。')}
        </section>
        <p class="fineprint">树洞内容由用户匿名发布，平台仅做安全风控。若你处于危机中，请立即联系 400-161-9995。</p>
      </div>`,
      mount(root) {
        root.querySelector('#th-post').onclick = async (e) => {
          const btn = e.currentTarget;
          const content = root.querySelector('#th-content').value.trim();
          if (content.length < 5) return YB.toast('至少写 5 个字', 'error');
          btn.disabled = true; btn.textContent = '放进中…';
          try {
            const r = await YB.api('/api/treehole', { method: 'POST', body: { content, alias: root.querySelector('#th-alias').value } });
            if (r.crisis) YB.safetyModal(r.safety);
            YB.toast('已经放进树洞了');
            YB.routeRender(true);
          } catch (err) { YB.toast(err.message, 'error'); btn.disabled = false; btn.textContent = '放进树洞'; }
        };
        root.querySelectorAll('[data-reply-toggle]').forEach(b => b.onclick = () => {
          const box = root.querySelector(`[data-reply-box="${b.dataset.replyToggle}"]`);
          box.hidden = !box.hidden;
          if (!box.hidden) box.querySelector('input').focus();
        });
        root.querySelectorAll('[data-send-reply]').forEach(b => b.onclick = async () => {
          const id = b.dataset.sendReply;
          const input = root.querySelector(`[data-reply-input="${id}"]`);
          const content = input.value.trim();
          if (content.length < 2) return YB.toast('再写一句吧', 'error');
          b.disabled = true;
          try {
            await YB.api(`/api/treehole/${id}/reply`, { method: 'POST', body: { content } });
            YB.toast('你的温柔已经送达');
            YB.routeRender(true);
          } catch (e) { YB.toast(e.message, 'error'); b.disabled = false; }
        });
      }
    };
  };

  /* ================= 认识你 ================= */
  V.welcome = async function () {
    const p = YB.state.profile || (await YB.api('/api/profile'));
    const styles = ['温柔宠溺', '犀利骂醒', '佛系静心', '热血励志'];
    const starters = ['失恋走不出来', '原生家庭', '长期失眠', '焦虑内耗', '职场 PUA', '学业压力', '自卑与讨好', '说不出的孤独'];
    const sleeps = ['倒头就睡', '入睡困难', '半夜容易醒', '失眠比较严重'];
    return {
      html: `
      <div class="welcome-page">
        <section class="welcome-hero">
          ${YB.mascot(96, 'pet-bob')}
          <div>
            <p class="eyebrow">让陪伴从"认识你"开始</p>
            <h2>先告诉我，你是谁</h2>
            <p class="muted">这些只用于让${YB.esc(p.petName)}更懂你，只存你自己的库里，不会公开。以后你随时可以改。</p>
          </div>
        </section>

        <section class="card intake-card">
          <div class="form-grid">
            <label class="field"><span>希望我怎么称呼你</span><input class="input" id="ob-name" value="${YB.esc(p.nickname && p.nickname !== '愈伴朋友' ? p.nickname : '')}" placeholder="比如：小林、阿May、我自己"></label>
            <label class="field"><span>你所在的城市（选填）</span><input class="input" id="ob-city" value="${YB.esc(p.city || '')}" placeholder="用于推荐附近治愈地点"></label>
          </div>

          <label class="field"><span>最近，最让你难受的是什么？</span>
            <textarea class="input area" id="ob-struggle" rows="3" placeholder="不用写得漂亮，想到哪说到哪。比如：分手两个月了，晚上还是会反复想他。"></textarea>
            <div class="chips" id="ob-starters">${starters.map(s => `<button type="button" class="chip soft" data-starter="${YB.esc(s)}">${s}</button>`).join('')}</div>
          </label>

          <div class="field"><span>希望我平时怎么陪你</span>
            <div class="choice-row" id="ob-style">
              ${styles.map((s, i) => `<button type="button" class="choice ${p.style === s || (!p.style && i === 0) ? 'on' : ''}" data-style-pick="${s}"><b>${s}</b><small>${['轻轻接住你，不评判', '该清醒时，直接点醒你', '慢下来，先安顿呼吸', '给你一点往前走的劲儿'][i]}</small></button>`).join('')}
            </div>
          </div>

          <label class="field"><span>哪些话、哪些方式会让你更难受？（选填）</span>
            <input class="input" id="ob-avoid" placeholder="比如：别跟我说'加油'，别一直追问细节">
            <div class="chips" id="ob-avoids">${['别讲大道理', '别叫我加油', '不要一直追问', '别替我下结论', '不要秒转介看医生'].map(s => `<button type="button" class="chip soft" data-avoid="${s}">${s}</button>`).join('')}</div>
          </label>

          <div class="field"><span>最近睡得怎么样</span>
            <div class="choice-row" id="ob-sleep">
              ${sleeps.map(s => `<button type="button" class="choice slim" data-sleep-pick="${s}">${s}</button>`).join('')}
            </div>
          </div>

          <div class="row-between intake-foot">
            <p class="hint">保存后，我会生成一份属于你的 7 天疗愈计划，并记住你说的这些。</p>
            <button class="btn primary" id="ob-save">开始认识我</button>
          </div>
        </section>

        <section class="card safety-note">
          <p><b>关于安全</b>：愈伴做的是心理陪伴与自我成长，不替代医疗诊断。如果你有伤害自己的念头，请立刻联系身边可信任的人，或拨打全国心理援助热线 <b>400-161-9995</b>，紧急情况拨打 <b>120</b>。${YB.icon('heart', 14)}</p>
        </section>
      </div>`,
      mount(root) {
        let style = p.style || '温柔宠溺';
        let sleep = '';
        root.querySelectorAll('[data-style-pick]').forEach(b => b.onclick = () => {
          root.querySelectorAll('[data-style-pick]').forEach(x => x.classList.remove('on'));
          b.classList.add('on'); style = b.dataset.stylePick;
        });
        root.querySelectorAll('[data-sleep-pick]').forEach(b => b.onclick = () => {
          root.querySelectorAll('[data-sleep-pick]').forEach(x => x.classList.remove('on'));
          b.classList.add('on'); sleep = b.dataset.sleepPick;
        });
        const struggleEl = root.querySelector('#ob-struggle');
        const avoidEl = root.querySelector('#ob-avoid');
        root.querySelectorAll('[data-starter]').forEach(b => b.onclick = () => {
          const v = b.dataset.starter;
          struggleEl.value = struggleEl.value ? `${struggleEl.value}；${v}` : v;
          struggleEl.focus();
        });
        root.querySelectorAll('[data-avoid]').forEach(b => b.onclick = () => {
          b.classList.toggle('on');
          const picks = [...root.querySelectorAll('[data-avoid].on')].map(x => x.dataset.avoid).join('，');
          const manual = avoidEl.value.split('；')[0];
          avoidEl.value = [manual, picks].filter(Boolean).join('；');
        });
        root.querySelector('#ob-save').onclick = async (e) => {
          const btn = e.currentTarget;
          const struggle = struggleEl.value.trim();
          if (!struggle) return YB.toast('先写一句你最近的困扰吧，不用很完整');
          btn.disabled = true; btn.textContent = '正在记住你…';
          try {
            await YB.api('/api/onboarding', { method: 'POST', body: {
              nickname: root.querySelector('#ob-name').value.trim(),
              city: root.querySelector('#ob-city').value.trim(),
              style, struggle, sleep,
              avoid: avoidEl.value.trim()
            }});
            YB.state.profile = null;
            YB.toast('记住了。接下来的陪伴，会不一样');
            YB.go('home');
          } catch (err) {
            YB.toast(err.message, 'error');
            btn.disabled = false; btn.textContent = '开始认识我';
          }
        };
      }
    };
  };
})();
