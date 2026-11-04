/* 愈伴 · 同城生活 / 影像 / 专业支持 / 我的 */
(function () {
  const YB = window.YB;
  const V = (YB.views = YB.views || {});

  /* ================= 同城治愈 ================= */
  V.life = async function () {
    const [device, eventsData] = await Promise.all([
      YB.api('/api/life/device'),
      YB.api('/api/life/events')
    ]);
    const p = YB.state.profile || (await YB.api('/api/profile'));
    YB.state.profile = p;
    const m = device.metrics;
    return {
      html: `
      <div class="life-page">
        <section class="life-hero">
          <div>
            <p class="eyebrow">同城治愈 · ${YB.esc(p.city || '未设置城市')}</p>
            <h2>治愈不只是想通，还要回到生活里</h2>
            <p>今天适合去哪里、见谁、怎么放松，都从你此刻的状态出发。</p>
            <div class="hero-actions">
              <button class="btn primary" id="life-places-quick">${YB.icon('compass', 16)} 找附近能去的地方</button>
              <button class="btn ghost" onclick="YB.go('me')">${YB.icon('edit', 15)} 设置城市</button>
            </div>
          </div>
          <div class="life-art">${YB.mascot(140, 'pet-bob')}</div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">AI 私人解压处方</p><h3>今天，给自己开一张处方</h3></div>
            <span class="score-bubble" id="rx-stress-label">5 / 10</span>
          </div>
          <div class="rx-control">
            <span class="hint">此刻的压力</span>
            <input type="range" min="1" max="10" value="5" class="score-range" id="rx-stress">
            <button class="btn primary" id="rx-run">生成处方</button>
          </div>
          <div id="rx-result"></div>
        </section>

        <section class="card map-card">
          <div class="card-head">
            <div><p class="label">同城治愈地图 · <span id="map-city-name">${YB.esc(p.city || '未设置城市')}</span></p><h3>附近可以松一口气的地方</h3></div>
            <span class="map-badge" id="map-source">示意地图</span>
          </div>
          <div class="map-tools">
            <input class="input" id="map-city" value="${YB.esc(p.city || '')}" maxlength="20" placeholder="输入城市，如 杭州">
            <button class="btn soft" id="map-go">${YB.icon('compass', 16)} 找附近</button>
            <button class="btn ghost" id="map-locate">${YB.icon('compass', 15)} 定位我</button>
          </div>
          <div id="map-wrap"><div class="loading"><span class="spinner"></span><span>正在摊开地图…</span></div></div>
          <p class="fineprint" id="map-note">先看看你附近有哪些类型的治愈空间，再决定今天去哪。</p>
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">同城治愈搭子</p><h3>先一起做件低压力的小事</h3></div>
            <button class="text-btn" id="buddy-refresh">换一批 <span>→</span></button>
          </div>
          <div id="buddies-result"><p class="muted">匹配维度：城市 + 心理状态 + 经历相似度 + 性格适配。先从散步、自习、散心这类可随时结束的活动开始。</p></div>
          <div class="safety-note">${YB.icon('shield', 15)} ${YB.esc('仅与实名认证用户匹配；首次见面请选择公共场所，告知可信任的人，保留随时离开的权利。')}</div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><p class="label">官方同城治愈团建</p><h3>线下轻社交，没有内卷</h3></div>
            <span class="hint">可随时退出</span>
          </div>
          <div class="event-list">
            ${eventsData.events.map(e => `
              <div class="event-item">
                <div class="event-main"><b>${YB.esc(e.title)}</b><p>${YB.esc(e.desc)}</p>
                  <div class="event-meta"><span>${YB.esc(e.type)}</span><span>${YB.esc(e.duration)}</span><span>${YB.esc(e.size)}</span><span>${e.joinedCount || 0} 人已报名</span></div>
                </div>
                <button class="btn ${e.joined ? 'ghost' : 'soft'} small" data-event="${e.id}" data-joined="${e.joined ? '1' : '0'}" data-title="${YB.esc(e.title)}" data-count="${e.joinedCount || 0}">${e.joined ? '已报名 · 取消' : '报名'}</button>
              </div>`).join('')}
          </div>
          <p class="fineprint">${YB.esc(eventsData.note)}</p>
        </section>

        <section class="card device-card">
          <div class="card-head">
            <div><p class="label">智能硬件守护 · 演示数据</p><h3>${YB.esc(device.device.name)}</h3></div>
            <span class="device-state"><i></i>已连接 · 电量 ${device.device.battery}%</span>
          </div>
          <div class="device-metrics">
            <div class="metric"><span class="metric-icon">${YB.icon('heart', 20)}</span><b>${m.heartRate}</b><p>心率 bpm</p></div>
            <div class="metric"><span class="metric-icon">${YB.icon('wave', 20)}</span><b>${m.stress}</b><p>身体压力</p></div>
            <div class="metric"><span class="metric-icon">${YB.icon('moon', 20)}</span><b>${m.sleepHours}<i>h</i></b><p>昨晚睡眠</p></div>
            <div class="metric"><span class="metric-icon">${YB.icon('wave', 20)}</span><b>${m.hrv}</b><p>HRV</p></div>
          </div>
          ${device.alert ? `<div class="device-alert">${YB.icon('heart', 17)}<div><b>${YB.esc(device.alert.title)}</b><p>${YB.esc(device.alert.text)}</p></div><button class="btn soft small" onclick="YB.go('chat')">现在聊聊</button></div>` : ''}
          <div class="device-actions">
            <button class="btn ghost" onclick="YB.go('chat')">${YB.icon('mic', 16)} 语音唤醒${YB.esc(p.petName)}</button>
            <button class="btn ghost" onclick="YB.sos()">${YB.icon('shield', 16)} 情绪危机求助</button>
          </div>
          <p class="fineprint">${YB.esc(device.note)}</p>
        </section>
        <p class="fineprint">同城推荐为类型灵感，具体请以地图实时信息为准。愈伴不组织任何高风险或强制消费活动。</p>
      </div>`,
      mount(root) {
        const stress = root.querySelector('#rx-stress');
        const stressLabel = root.querySelector('#rx-stress-label');
        stress.addEventListener('input', () => stressLabel.textContent = `${stress.value} / 10`);
        root.querySelector('#rx-run').onclick = async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true; btn.textContent = '正在开处方…';
          const out = root.querySelector('#rx-result');
          out.innerHTML = `<div class="loading"><span class="spinner"></span><span>根据你的状态配药中…</span></div>`;
          try {
            const r = await YB.api(`/api/life/prescription?stress=${stress.value}`);
            out.innerHTML = renderRx(r.result);
          } catch (err) { out.innerHTML = `<p class="muted">${YB.esc(err.message)}</p>`; }
          btn.disabled = false; btn.textContent = '重新开一张';
        };

        let geo = null;
        const loadMap = async (opts = {}) => {
          const wrap = root.querySelector('#map-wrap');
          const cityInput = root.querySelector('#map-city');
          wrap.innerHTML = `<div class="loading"><span class="spinner"></span><span>正在摊开地图…</span></div>`;
          try {
            const body = { city: opts.city !== undefined ? opts.city : cityInput.value.trim() };
            if (opts.lat && opts.lng) { body.lat = opts.lat; body.lng = opts.lng; }
            const r = await YB.api('/api/life/map', { method: 'POST', body });
            renderMap(r);
            if (r.city) {
              root.querySelector('#map-city-name').textContent = r.city;
              if (!cityInput.value) cityInput.value = r.city;
              if (!p.city || opts.lat) {
                p.city = r.city;
                YB.api('/api/profile', { method: 'PUT', body: { city: r.city } }).catch(() => {});
              }
            }
          } catch (err) {
            wrap.innerHTML = `<p class="muted">${YB.esc(err.message)}</p>`;
          }
        };

        const renderMap = (data) => {
          const wrap = root.querySelector('#map-wrap');
          root.querySelector('#map-note').textContent = data.note || '';
          root.querySelector('#map-source').textContent = data.hasAmap ? '高德实时点位' : '示意地图';
          if (data.needCity || !data.center) {
            wrap.innerHTML = `<div class="map-need">
              <p><b>先告诉愈伴你在哪座城市</b></p>
              <p class="muted">这样附近的人、地点和活动才能真正和你的生活有关。</p>
              <button class="btn primary" id="map-need-btn">填写城市</button>
            </div>`;
            wrap.querySelector('#map-need-btn').onclick = () => root.querySelector('#map-city').focus();
            return;
          }
          const c = data.center;
          const pois = data.pois || [];
          const cos = Math.cos(c.lat * Math.PI / 180);
          const dxkm = p => (p.lng - c.lng) * 111.32 * cos;
          const dykm = p => (p.lat - c.lat) * 110.57;
          let maxKm = 0.4;
          pois.forEach(p => { maxKm = Math.max(maxKm, Math.abs(dxkm(p)), Math.abs(dykm(p))); });
          const scale = 34 / Math.min(Math.max(maxKm, 0.35), 6);
          const pos = p => ({
            x: Math.max(7, Math.min(93, 50 + dxkm(p) * scale)),
            y: Math.max(9, Math.min(91, 50 - dykm(p) * scale))
          });
          wrap.innerHTML = `
            <div class="city-map" id="city-map">
              <svg class="map-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d="M -5 70 C 18 55, 36 86, 105 60" class="map-river"/>
                <path d="M 12 -5 L 28 105" class="map-road"/>
                <path d="M 55 -5 L 44 105" class="map-road"/>
                <path d="M -5 32 L 105 40" class="map-road"/>
                <path d="M -5 82 L 105 76" class="map-road"/>
                <circle cx="50" cy="50" r="17" class="map-ring"/>
              </svg>
              <span class="map-north">N</span>
              <span class="map-center-dot"></span>
              <span class="map-center-label">${YB.esc(data.city)} · 中心</span>
              ${pois.map((p, i) => {
                const q = pos(p);
                return `<button class="map-marker" style="left:${q.x.toFixed(2)}%;top:${q.y.toFixed(2)}%" data-poi="${YB.esc(p.id)}" title="${YB.esc(p.name)}">
                  <i>${i + 1}</i><em>${YB.esc(p.type)}</em>
                </button>`;
              }).join('')}
            </div>
            <div class="map-detail" id="map-detail"></div>
            <div class="map-poi-list">
              ${pois.map((p, i) => `<button class="map-poi-chip" data-poi="${YB.esc(p.id)}"><i>${i + 1}</i>${YB.esc(p.name)}</button>`).join('')}
            </div>`;
          const detail = wrap.querySelector('#map-detail');
          const markers = wrap.querySelectorAll('.map-marker');
          const chips = wrap.querySelectorAll('.map-poi-chip');
          const show = (id) => {
            const p = pois.find(x => x.id === id) || pois[0];
            if (!p) return;
            markers.forEach(m => m.classList.toggle('on', m.dataset.poi === p.id));
            chips.forEach(m => m.classList.toggle('on', m.dataset.poi === p.id));
            const dist = p.distance ? (p.distance < 1000 ? `${p.distance} 米` : `${(p.distance / 1000).toFixed(1)} 公里`) : '附近';
            detail.innerHTML = `
              <div class="map-detail-main">
                <span class="place-type">${YB.esc(p.type)}</span>
                <b>${YB.esc(p.name)}</b>
                <span class="map-dist">${dist} · ${p.source === 'amap' ? '实时检索' : '示意点位'}</span>
                <p>${YB.esc(p.why)}</p>
                <em>${YB.esc(p.tip)}</em>
              </div>
              <div class="map-detail-actions">
                <a class="btn primary small" href="${YB.esc(p.nav)}" target="_blank" rel="noopener">${YB.icon('compass', 15)} 去这里</a>
                <button class="btn ghost small" data-map-copy="${YB.esc(p.name)}">${YB.icon('copy', 15)} 复制名称</button>
              </div>`;
            detail.querySelector('[data-map-copy]').onclick = () => YB.copy(p.name);
          };
          markers.forEach(mk => mk.onclick = () => show(mk.dataset.poi));
          chips.forEach(ch => ch.onclick = () => show(ch.dataset.poi));
          show(pois[0]?.id);
        };

        root.querySelector('#map-go').onclick = () => loadMap();
        root.querySelector('#map-city').addEventListener('keydown', e => { if (e.key === 'Enter') loadMap(); });
        root.querySelector('#map-locate').onclick = (e) => {
          const btn = e.currentTarget;
          if (!navigator.geolocation) return YB.toast('当前浏览器不支持定位，请手动输入城市', 'error');
          btn.disabled = true; btn.textContent = '定位中…';
          navigator.geolocation.getCurrentPosition(
            pos => {
              geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              loadMap(geo).finally(() => { btn.disabled = false; btn.innerHTML = `${YB.icon('compass', 15)} 重新定位`; });
            },
            () => {
              YB.toast('定位没成功，请允许定位权限，或直接输入城市', 'error');
              btn.disabled = false; btn.innerHTML = `${YB.icon('compass', 15)} 定位我`;
            },
            { timeout: 10000, maximumAge: 60000 }
          );
        };
        root.querySelector('#life-places-quick').onclick = () => {
          root.querySelector('.map-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
          loadMap();
        };

        const loadBuddies = async () => {
          const out = root.querySelector('#buddies-result');
          out.innerHTML = `<div class="loading"><span class="spinner"></span><span>正在找同频的人…</span></div>`;
          try {
            const r = await YB.api('/api/life/buddies');
            out.innerHTML = `<p class="muted intro">${YB.esc(r.result.intro || '')}</p>
              <div class="buddy-list">
                ${(r.result.matches || []).map(b => `
                  <div class="buddy-card ${b.invited ? 'invited' : ''}">
                    <div class="buddy-head"><span class="buddy-avatar">${YB.esc(b.alias.slice(0, 1))}</span>
                      <div><b>${YB.esc(b.alias)}</b><p class="buddy-tags">${(b.tags || []).map(t => `<span>${YB.esc(t)}</span>`).join('')}</p></div></div>
                    <p>${YB.esc(b.reason)}</p>
                    <div class="icebreaker">${YB.icon('chat', 15)} <span>${YB.esc(b.icebreaker)}</span><button class="copy-mini" data-copy-ice="${YB.esc(b.icebreaker)}">复制</button></div>
                    ${b.invited ? `
                      <div class="buddy-reply"><b>${YB.icon('check', 14)} 对方已接受你的搭子邀请</b><p>${YB.esc(b.reply || '')}</p></div>
                      <button class="btn ghost small" data-chat-buddy="${YB.esc(b.alias)}">${YB.icon('chat', 15)} 聊聊怎么见面</button>` : `
                      <button class="btn soft small" data-invite-buddy="${YB.esc(b.alias)}" data-ice="${YB.esc(b.icebreaker)}">${YB.icon('heart', 15)} 发出搭子邀请</button>`}
                  </div>`).join('')}
              </div>
              <div class="safety-note">${YB.icon('shield', 15)} ${YB.esc(r.result.safety || '')}</div>`;
            out.querySelectorAll('[data-copy-ice]').forEach(b => b.onclick = () => YB.copy(b.dataset.copyIce));
            out.querySelectorAll('[data-invite-buddy]').forEach(btn => btn.onclick = async () => {
              btn.disabled = true; btn.textContent = '正在发出邀请…';
              try {
                const res = await YB.api('/api/life/buddies/invite', {
                  method: 'POST',
                  body: { alias: btn.dataset.inviteBuddy, icebreaker: btn.dataset.ice }
                });
                YB.modal({
                  title: '搭子邀请已被接受',
                  body: `<p class="modal-text">${YB.esc(res.alias)} 回复了你：</p>
                    <div class="buddy-reply big"><p>${YB.esc(res.reply)}</p></div>
                    <p class="modal-text">先去公园或咖啡馆坐半小时，不合适也随时可以停。不用勉强自己。</p>`,
                  actions: `<button class="btn ghost" data-close>知道了</button><button class="btn primary" id="buddy-chat">去和${YB.esc((YB.state.profile || {}).petName || '它')}说说</button>`,
                  onMount(w) { w.querySelector('#buddy-chat').onclick = () => { YB.go('chat'); }; }
                });
                loadBuddies();
              } catch (err) {
                YB.toast(err.message, 'error');
                btn.disabled = false; btn.textContent = '发出搭子邀请';
              }
            });
            out.querySelectorAll('[data-chat-buddy]').forEach(btn => btn.onclick = () => {
              YB.modal({
                title: `和 ${btn.dataset.chatBuddy} 怎么见面`,
                body: `<p class="modal-text">可以先发一句：</p>
                  <div class="buddy-reply big"><p>“这周末下午我在 ${YB.esc((YB.state.profile || {}).city || '附近')} 的公园走走，如果你也想出来透透气，我们可以一起坐半小时。不方便也完全没关系。”</p></div>
                  <p class="modal-text">第一次见面选公共场所、告诉可信任的人、保留随时离开的权利。</p>`,
                actions: `<button class="btn ghost" data-close>关闭</button><button class="btn primary" id="copy-meet">复制这句话</button>`,
                onMount(w) {
                  w.querySelector('#copy-meet').onclick = () => YB.copy(`这周末下午我在 ${(YB.state.profile || {}).city || '附近'} 的公园走走，如果你也想出来透透气，我们可以一起坐半小时。不方便也完全没关系。`);
                }
              });
            });
          } catch (err) { out.innerHTML = `<p class="muted">${YB.esc(err.message)}</p>`; }
        };
        root.querySelector('#buddy-refresh').onclick = loadBuddies;
        loadBuddies();
        loadMap();

        root.querySelectorAll('[data-event]').forEach(b => b.onclick = () => {
          const id = b.dataset.event;
          const joined = b.dataset.joined === '1';
          if (joined) return doJoin(b, id, true, 0);
          YB.modal({
            title: '报名前，再确认一下',
            body: `<p class="modal-text">你要报名「${YB.esc(b.dataset.title)}」。</p>
              <div class="event-confirm">
                <p>${YB.icon('shield', 15)} 自愿参与，可随时退出，不收取任何费用。</p>
                <p>${YB.icon('star', 15)} 当前已有 ${Number(b.dataset.count || 0)} 人报名，主理人会在活动前一天联系你。</p>
                <p>${YB.icon('compass', 15)} 地点在公共场所，第一次参加不用强迫自己社交，待着也可以。</p>
              </div>`,
            actions: `<button class="btn ghost" data-close>再想想</button><button class="btn primary" id="ev-yes">确认报名</button>`,
            onMount(w) {
              w.querySelector('#ev-yes').onclick = (ev) => {
                ev.currentTarget.closest('.modal-wrap').querySelector('.modal-backdrop').click();
                doJoin(b, id, false, Number(b.dataset.count || 0));
              };
            }
          });
        });
        const doJoin = async (b, id, joined, count) => {
          b.disabled = true; b.textContent = joined ? '正在取消…' : '正在报名…';
          try {
            const r = await YB.api(`/api/life/events/${id}/join`, { method: joined ? 'DELETE' : 'POST' });
            const next = joined ? Math.max(0, count - 1) : (r.joinedCount || count + 1);
            b.dataset.joined = joined ? '0' : '1';
            b.dataset.count = String(next);
            b.textContent = joined ? '报名' : '已报名 · 取消';
            b.className = `btn ${joined ? 'soft' : 'ghost'} small`;
            const meta = b.closest('.event-item').querySelector('.event-meta span:last-child');
            if (meta) meta.textContent = `${next} 人已报名`;
            YB.toast(joined ? '已取消报名，随时可以再回来' : `报名成功，当前 ${next} 人参加，主理人会联系你`);
          } catch (err) {
            YB.toast(err.message, 'error');
            b.disabled = false;
            b.textContent = joined ? '已报名 · 取消' : '报名';
          }
        };
      }
    };
  };

  function renderRx(r) {
    return `
      <div class="rx-card">
        <div class="rx-head"><h4>${YB.esc(r.title)}</h4><p>${YB.esc(r.intro)}</p></div>
        <div class="rx-items">
          ${(r.items || []).map((it, i) => `<div class="rx-item"><span class="rx-num">${i + 1}</span><div><b>${YB.esc(it.name)}</b><p>${YB.esc(it.why)}</p><em>${YB.esc(it.duration)}</em></div></div>`).join('')}
        </div>
        <div class="rx-notes">
          <div><b>饮食</b><p>${YB.esc(r.food || '')}</p></div>
          <div><b>运动</b><p>${YB.esc(r.movement || '')}</p></div>
          <div><b>休息</b><p>${YB.esc(r.rest || '')}</p></div>
        </div>
        <p class="fineprint">${YB.esc(r.note || '')}</p>
      </div>`;
  }

  /* ================= 我的影像 ================= */
  V.studio = async function () {
    const [daily, docs] = await Promise.all([
      YB.api(`/api/studio/daily?style=${YB.styleKey((YB.state.profile || {}).style || '温柔宠溺')}`),
      YB.api('/api/studio/documentaries')
    ]);
    const p = YB.state.profile || (await YB.api('/api/profile'));
    return {
      html: `
      <div class="studio-page">
        <section class="studio-hero">
          <div>
            <p class="eyebrow">只属于你的内容</p>
            <h2>没有通用鸡汤，只有你的故事</h2>
            <p>每一句激励、每一帧画面，都来自你真实经历过的低谷与坚持。</p>
          </div>
          <div class="studio-art">${YB.mascot(138, 'pet-bob')}<span class="film-strip"></span></div>
        </section>

        <section class="mv-hero">
          <div class="mv-hero-copy">
            <p class="label">只写给你的成长史</p>
            <h3>${YB.esc(p.nickname)}，你走过的每一步都算数</h3>
            <p>把你真实记录的情绪、打卡、说过的话，写成一支有滚动字幕、有配乐的热血成长 MV。不是通用鸡汤，是你自己的低谷与翻越。</p>
            <div class="mv-hero-tags"><span>真实记忆</span><span>滚动字幕</span><span>实时配乐</span><span>可导出视频</span></div>
            <button class="btn primary" id="mv-generate">${YB.icon('sparkle', 16)} 生成我的成长 MV</button>
          </div>
          <div class="mv-hero-poster">
            <span class="mv-poster-day">PERSONAL · 仅此一支</span>
            <b>你，<br>大有所为</b>
            <span>愈伴 · 个人成长 MV</span>
          </div>
        </section>

        <section class="card daily-big">
          <div class="card-head">
            <div><p class="label">${YB.fmtDate(new Date().toISOString())} · 今日专属</p><h3>给你的这一天一句</h3></div>
            <button class="icon-btn" id="st-regen" title="换一句">${YB.icon('refresh', 17)}</button>
          </div>
          <div class="chips" id="st-styles">${YB.chips(['温柔宠溺', '犀利骂醒', '佛系静心', '热血励志'], p.style, 'data-ststyle')}</div>
          <p class="daily-big-text" id="st-daily">${YB.nl2br(daily.text)}</p>
          <div class="row-between">
            <span class="hint">由你的情绪、状态与成长进度生成</span>
            <div class="daily-actions">
              <button class="text-btn" id="st-speak">${YB.icon('wave', 14)} 朗读</button>
              <button class="text-btn" id="st-card">${YB.icon('download', 14)} 分享卡</button>
              <button class="text-btn" id="st-video">${YB.icon('sparkle', 14)} 成长 MV</button>
              <button class="text-btn" id="st-copy">复制 <span>→</span></button>
            </div>
          </div>
        </section>

        <section class="card documentary-card">
          <div class="doc-head">
            <div>
              <p class="label">个人人生治愈纪录短片</p>
              <h3>${YB.esc(p.nickname)} · 一段正在发生的治愈</h3>
              <p>抓取你的记忆、情绪、测评与梦境，生成 60 秒专属短片。可在低谷时拿出来看。</p>
            </div>
            <span class="film-icon">${YB.icon('play', 26)}</span>
          </div>
          <div class="doc-actions">
            <button class="btn primary" id="doc-generate">${YB.icon('sparkle', 16)} 生成我的纪录短片</button>
            <button class="btn ghost" onclick="YB.go('journal')">${YB.icon('book', 16)} 先补充一些记忆</button>
          </div>
          <div class="doc-list">
            ${docs.documentaries.length ? docs.documentaries.map(d => `
              <button class="doc-row" data-doc="${d.id}">
                <span class="doc-play">${YB.icon('play', 16)}</span>
                <div><b>${YB.esc(d.title)}</b><span>${YB.fmtDate(d.created_at, true)}</span></div>
                ${YB.icon('arrow', 15)}
              </button>`).join('') : '<p class="muted">还没有短片。生成第一部，把你走过的路存下来。</p>'}
          </div>
        </section>

        <section class="card mini-quote-card">
          <p>“你不需要变得完美，你已经值得被好好对待。”</p>
          <span>—— 愈伴写给每一个正在撑的人</span>
        </section>
        <p class="fineprint">纪录短片由你的真实记录生成，仅本人可见。可在支持 MediaRecorder 的浏览器导出为 webm 视频，反复观看或保存。</p>
      </div>`,
      mount(root) {
        let style = p.style;
        const dailyEl = root.querySelector('#st-daily');
        const load = async (s) => {
          dailyEl.innerHTML = YB.loading('正在写…');
          try {
            const d = await YB.api(`/api/studio/daily?style=${YB.styleKey(s)}`);
            dailyEl.innerHTML = YB.nl2br(d.text);
          } catch (e) { dailyEl.textContent = e.message; }
        };
        root.querySelectorAll('[data-ststyle]').forEach(b => b.onclick = () => {
          root.querySelectorAll('[data-ststyle]').forEach(x => x.classList.remove('on'));
          b.classList.add('on'); style = b.dataset.ststyle; load(style);
        });
        root.querySelector('#st-regen').onclick = async (e) => {
          e.currentTarget.disabled = true; dailyEl.innerHTML = YB.loading('换一种说法…');
          try {
            const d = await YB.api('/api/studio/daily/regenerate', { method: 'POST', body: { style } });
            dailyEl.innerHTML = YB.nl2br(d.text);
          } catch (err) { YB.toast(err.message, 'error'); }
          root.querySelector('#st-regen').disabled = false;
        };
        root.querySelector('#st-copy').onclick = () => YB.copy(dailyEl.textContent.trim());
        root.querySelector('#st-speak').onclick = () => YB.speak(dailyEl.textContent.trim());
        root.querySelector('#st-card').onclick = () => YB.dailyCard({
          text: dailyEl.textContent.trim(), nickname: p.nickname,
          date: new Date().toLocaleDateString('zh-CN')
        });
        const makeMV = async (btn) => {
          if (!YB.openMV) return YB.toast('MV 模块未加载，请刷新页面', 'error');
          const old = btn.innerHTML;
          btn.disabled = true; btn.innerHTML = '正在把你的经历写成歌词…';
          try {
            const r = await YB.api('/api/studio/mv', { method: 'POST' });
            YB.openMV(r.mv);
            if (r.demo) YB.toast('这支 MV 已用你的真实记录生成；配置大模型后会更贴近你的经历');
          } catch (err) {
            YB.toast('生成失败：' + (err.message || '请稍后再试'), 'error');
          } finally {
            btn.disabled = false; btn.innerHTML = old;
          }
        };
        root.querySelector('#mv-generate').onclick = (e) => makeMV(e.currentTarget);
        root.querySelector('#st-video').onclick = (e) => makeMV(e.currentTarget);

        async function openDoc(id) {
          try {
            const r = await YB.api(`/api/studio/documentaries/${id}`);
            playDocumentary(r.documentary);
          } catch (e) { YB.toast(e.message, 'error'); }
        }
        root.querySelectorAll('[data-doc]').forEach(b => b.onclick = () => openDoc(b.dataset.doc));
        root.querySelector('#doc-generate').onclick = async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true; btn.textContent = '正在剪辑你的故事…';
          try {
            const r = await YB.api('/api/studio/documentary', { method: 'POST' });
            playDocumentary(r.documentary);
            setTimeout(() => YB.routeRender(true), 800);
          } catch (err) { YB.toast(err.message, 'error'); btn.disabled = false; btn.innerHTML = `${YB.icon('sparkle', 16)} 生成我的纪录短片`; }
        };
      }
    };
  };

  function playDocumentary(doc) {
    const s = doc.script || {};
    const scenes = s.scenes || [];
    let idx = 0, timer = null, playing = false;
    const tones = ['dawn', 'rain', 'night', 'warm'];
    const m = YB.modal({
      title: '',
      cls: 'cinema-modal',
      body: `
        <div class="cinema" id="cinema">
          <div class="cinema-scene tone-${tones[0]}">
            <p class="scene-chapter" id="scene-chapter">${YB.esc(scenes[0]?.caption || '开场')}</p>
            <div class="scene-visual" id="scene-visual">${YB.esc(scenes[0]?.visual || '')}</div>
            <p class="scene-line" id="scene-line">${YB.esc(scenes[0]?.line || '')}</p>
          </div>
          <div class="cinema-top"><b>${YB.esc(s.title || doc.title)}</b><span>${YB.esc(s.subtitle || '')}</span></div>
          <div class="cinema-controls">
            <button class="icon-btn" id="cin-prev">${YB.icon('arrow', 16, 'flip')}</button>
            <button class="cinema-play" id="cin-play">${YB.icon('play', 18)}</button>
            <button class="icon-btn" id="cin-next">${YB.icon('arrow', 16)}</button>
            <div class="cinema-dots" id="cin-dots">${scenes.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
          </div>
        </div>
        <div class="cinema-narration">
          <p>${YB.nl2br(s.narration || '')}</p>
          <span>配乐建议：${YB.esc(s.music || '低饱和钢琴 + 环境音')}</span>
        </div>`,
      actions: `<button class="btn ghost" data-close>关闭</button><button class="btn ghost" id="cin-download">保存文字脚本</button><button class="btn primary" id="cin-export">导出视频</button>`
    });
    const wrap = m.el;
    const scene = wrap.querySelector('.cinema-scene');
    const chapter = wrap.querySelector('#scene-chapter');
    const visual = wrap.querySelector('#scene-visual');
    const line = wrap.querySelector('#scene-line');
    const dots = wrap.querySelectorAll('#cin-dots i');
    const playBtn = wrap.querySelector('#cin-play');
    const render = () => {
      const sc = scenes[idx] || {};
      scene.className = `cinema-scene tone-${tones[idx % tones.length]}`;
      chapter.textContent = sc.caption || `第 ${idx + 1} 幕`;
      visual.textContent = sc.visual || '';
      line.textContent = sc.line || '';
      dots.forEach((d, i) => d.classList.toggle('on', i === idx));
    };
    const stop = () => { playing = false; clearInterval(timer); cone(false); };
    const cone = (on) => {
      playing = on;
      playBtn.innerHTML = YB.icon(on ? 'pause' : 'play', 18);
    };
    const tick = () => {
      if (!playing) return;
      clearInterval(timer);
      timer = setInterval(() => {
        idx++;
        if (idx >= scenes.length) { idx = 0; stop(); }
        render();
      }, 7000);
    };
    playBtn.onclick = () => {
      if (!scenes.length) return;
      cone(!playing); if (playing) tick(); else stop();
    };
    wrap.querySelector('#cin-next').onclick = () => { idx = Math.min(scenes.length - 1, idx + 1); render(); };
    wrap.querySelector('#cin-prev').onclick = () => { idx = Math.max(0, idx - 1); render(); };
    wrap.querySelector('#cin-download').onclick = () => {
      const text = [s.title || doc.title, s.subtitle || '', '', s.narration || '', '', ...scenes.map(sc => `${sc.caption}\n画面：${sc.visual}\n旁白：${sc.line}\n`), `配乐：${s.music || ''}`, s.ending || '', '', '—— 愈伴 · 私人纪录短片脚本'].join('\n');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `${s.title || '我的治愈纪录'}.txt`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    wrap.querySelector('#cin-export').onclick = (e) => {
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = '正在合成视频…';
      exportDocumentaryVideo(doc)
        .then(() => { btn.disabled = false; btn.textContent = '导出视频'; })
        .catch(err => {
          btn.disabled = false; btn.textContent = '导出视频';
          YB.toast('当前浏览器暂不支持视频导出：' + (err.message || '请用 Chrome 打开'), 'error');
        });
    };
    wrap.querySelectorAll('[data-close], .modal-close, .modal-backdrop').forEach(x => x.addEventListener('click', stop));
    if (scenes.length) { idx = 0; render(); setTimeout(() => { cone(true); tick(); }, 300); }
  }

  /* 真正可导出的短片：Canvas + MediaRecorder 合成 webm */
  function wrapCanvasText(ctx, text, x, y, maxW, lh) {
    let line = '';
    for (const ch of Array.from(String(text || ''))) {
      if (ch === '\n') { ctx.fillText(line, x, y); line = ''; y += lh; continue; }
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = ch; y += lh; }
      else line = test;
    }
    if (line) { ctx.fillText(line, x, y); y += lh; }
    return y;
  }

  function exportDocumentaryVideo(doc) {
    return new Promise((resolve, reject) => {
      const scenes = (doc.script && doc.script.scenes) || [];
      if (!scenes.length) return reject(new Error('这份短片还没有画面脚本'));
      if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
        return reject(new Error('浏览器不支持 MediaRecorder，请使用 Chrome / Edge / 新版 Safari'));
      }
      const W = 720, H = 1280;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';
      let rec;
      const stream = canvas.captureStream(30);
      try {
        rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2600000 } : {});
      } catch (e) { return reject(e); }
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = err => reject(err);
      rec.onstop = () => {
        try {
          const blob = new Blob(chunks, { type: 'video/webm' });
          if (!blob.size) return reject(new Error('视频合成失败'));
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${(doc.script && doc.script.title) || doc.title || '我的治愈纪录'}.webm`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1500);
          YB.toast('视频已导出，可保存到本地反复看');
          resolve();
        } catch (e) { reject(e); }
      };
      const per = 4200, total = per * scenes.length;
      const palettes = [
        ['#f9eee3', '#f0ddd4', '#e3e9e1'],
        ['#efebf4', '#f5e5e1', '#f7f0e7'],
        ['#e8f0f1', '#ebe6dd', '#f6e9de'],
        ['#f7ebdf', '#f1ded7', '#e6eee6'],
        ['#f4eaf4', '#f6e9df', '#e9f0e8']
      ];
      const started = performance.now();
      const draw = () => {
        const elapsed = performance.now() - started;
        if (elapsed >= total) {
          rec.stop();
          try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
          return;
        }
        const idx = Math.min(scenes.length - 1, Math.floor(elapsed / per));
        const local = (elapsed % per) / per;
        const sc = scenes[idx] || {};
        const pal = palettes[idx % palettes.length];
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, pal[0]); g.addColorStop(.55, pal[1]); g.addColorStop(1, pal[2]);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 5; i++) {
          const t = elapsed / 1000;
          const cx = W * (.15 + .7 * ((i * .23 + t * .02) % 1));
          const cy = H * (.12 + .76 * ((i * .37 + t * .015) % 1));
          ctx.fillStyle = `rgba(255,255,255,${.10 + i * .02})`;
          ctx.beginPath(); ctx.arc(cx, cy, 60 + i * 26, 0, Math.PI * 2); ctx.fill();
        }
        const alpha = local < .14 ? local / .14 : local > .86 ? (1 - local) / .14 : 1;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = 'rgba(176,140,118,.55)';
        ctx.fillRect(64, 96, 6, 92);
        ctx.fillStyle = '#8d7264';
        ctx.font = '500 24px "Songti SC", "Noto Serif SC", serif';
        ctx.fillText(`第 ${idx + 1} 幕 · ${sc.caption || ''}`, 94, 132);
        ctx.fillStyle = '#a58d7f';
        ctx.font = '400 21px "Songti SC", serif';
        wrapCanvasText(ctx, sc.visual || '', 94, 208, W - 160, 34);
        ctx.fillStyle = '#433733';
        ctx.font = '600 40px "Songti SC", "Noto Serif SC", serif';
        wrapCanvasText(ctx, sc.line || '', 94, 600, W - 170, 62);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#a58d7f';
        ctx.font = '400 22px "Songti SC", serif';
        ctx.fillText((doc.script && doc.script.title) || doc.title || '我的治愈纪录', 64, H - 150);
        ctx.fillStyle = '#b8978a';
        ctx.font = '400 19px "Songti SC", serif';
        ctx.fillText('愈伴 · 只属于你的私人纪录短片', 64, H - 112);
        for (let i = 0; i < scenes.length; i++) {
          ctx.fillStyle = i === idx ? 'rgba(176,140,118,.85)' : 'rgba(160,140,128,.28)';
          ctx.fillRect(64 + i * 26, H - 62, 18, 4);
        }
        requestAnimationFrame(draw);
      };
      rec.start(100);
      requestAnimationFrame(draw);
    });
  }

  /* ================= 专业支持 ================= */
  V.support = async function () {
    const data = await YB.api('/api/counselors');
    return {
      html: `
      <div class="support-page">
        <section class="support-hero">
          <div>
            <p class="eyebrow">专业心理师 · 双层安全兜底</p>
            <h2>AI 陪你日常，专业的人在关键时刻</h2>
            <p>轻度情绪由愈伴承接；当评估显示需要专业介入时，我们帮你连接到持证咨询师。</p>
          </div>
          <div class="support-art">${YB.mascot(124)}</div>
        </section>

        <section class="card triage-card">
          <span class="triage-icon">${YB.icon('shield', 24)}</span>
          <div>
            <p class="label">AI 初筛分级</p>
            <h3>${YB.esc(data.triage.level)}</h3>
            <p>${YB.esc(data.triage.reason)}</p>
            <em>${YB.esc(data.triage.suggestion)}</em>
          </div>
          <button class="btn ghost small" onclick="YB.go('assess')">去做测评</button>
        </section>

        <section class="card crisis-card">
          <div class="crisis-copy">
            <p class="label">此刻就在危机里？</p>
            <h3>先联系专业援助，不要一个人扛</h3>
            <p>全国心理援助热线 24 小时在线。若有立即危险，请拨打 120。</p>
          </div>
          <div class="crisis-actions">
            <a class="btn primary" href="tel:4001619995">${YB.icon('phone', 16)} 400-161-9995</a>
            <button class="btn ghost" onclick="YB.sos()">呼吸急救引导</button>
          </div>
        </section>

        <section class="section-head"><div><p class="label">入驻咨询师</p><h3>持证 · 审核 · 一对一定向</h3></div></section>
        <div class="counselor-grid">
          ${data.counselors.map(c => `
            <div class="counselor-card card">
              <div class="counselor-head">
                <span class="counselor-avatar">${YB.esc(c.name.slice(0, 1))}</span>
                <div><b>${YB.esc(c.name)}</b><p>${YB.esc(c.title)}</p></div>
              </div>
              <p class="counselor-intro">${YB.esc(c.intro)}</p>
              <div class="mini-tags">${c.tags.map(t => `<span>${YB.esc(t)}</span>`).join('')}</div>
              <div class="counselor-foot"><span>${YB.icon('chat', 14)} ${YB.esc(c.mode)}</span><button class="btn soft small" data-book="${c.id}">预约咨询</button></div>
            </div>`).join('')}
        </div>

        ${data.requests.length ? `<section class="card"><div class="card-head"><div><p class="label">我的预约</p><h3>最近的申请</h3></div></div>
          <div class="request-list">${data.requests.map(r => `<div class="request-row"><div><b>${YB.esc(r.name)} · ${YB.esc(r.service)}</b><span>${YB.esc(r.mode)} · ${YB.fmtDate(r.created_at, true)}</span></div><em>${YB.esc(r.status)}</em></div>`).join('')}</div></section>` : ''}

        <p class="fineprint">${YB.esc(data.note)} 咨询为自愿付费服务；平台不会以咨询名义索取额外费用。</p>
      </div>`,
      mount(root) {
        root.querySelectorAll('[data-book]').forEach(b => b.onclick = () => {
          const c = data.counselors.find(x => x.id === b.dataset.book);
          const m = YB.modal({
            title: `预约 ${c.name}`,
            body: `
              <p class="modal-text">${YB.esc(c.title)} · ${YB.esc(c.tags.join(' / '))}</p>
              <div class="form-stack">
                <label class="field"><span>怎么称呼你</span><input class="input" id="bk-name" value="${YB.esc((YB.state.profile || {}).nickname || '')}" maxlength="20"></label>
                <label class="field"><span>联系方式（手机 / 微信 / 邮箱）</span><input class="input" id="bk-contact" maxlength="60" placeholder="咨询师助理会通过这里联系你"></label>
                <label class="field"><span>咨询形式</span><select class="input" id="bk-mode"><option>视频</option><option>语音</option><option>文字</option></select></label>
                <label class="field"><span>紧急程度</span><select class="input" id="bk-urgent"><option>不紧急</option><option>近期需要</option><option>比较急</option></select></label>
                <textarea class="input area" id="bk-note" rows="3" maxlength="500" placeholder="想先告诉咨询师什么？（选填）"></textarea>
              </div>
              <p class="fineprint">提交即表示你了解：心理咨询不等于医疗诊断；如处于危机中请先拨打 400-161-9995。</p>`,
            actions: `<button class="btn ghost" data-close>取消</button><button class="btn primary" id="bk-submit">提交预约</button>`,
            onMount(w) {
              w.querySelector('#bk-submit').onclick = async () => {
                const contact = w.querySelector('#bk-contact').value.trim();
                if (contact.length < 3) return YB.toast('请填写联系方式', 'error');
                const btn = w.querySelector('#bk-submit');
                btn.disabled = true; btn.textContent = '提交中…';
                try {
                  const r = await YB.api('/api/consult/request', { method: 'POST', body: {
                    counselorId: c.id, contact, mode: w.querySelector('#bk-mode').value,
                    urgency: w.querySelector('#bk-urgent').value, note: w.querySelector('#bk-note').value,
                    name: w.querySelector('#bk-name').value
                  }});
                  m.close();
                  YB.modal({ title: '预约已提交', body: `<p class="modal-text">${YB.esc(r.message)}</p>`, actions: '<button class="btn primary" data-close>知道了</button>' });
                  setTimeout(() => YB.routeRender(true), 400);
                } catch (e) { YB.toast(e.message, 'error'); btn.disabled = false; btn.textContent = '提交预约'; }
              };
            }
          });
        });
      }
    };
  };

  /* ================= 我的 ================= */
  const TAG_SUGGEST = ['高敏感', '共情力强', '内向', '慢热', '讨好型', '完美主义', '焦虑', '回避型依恋', '焦虑型依恋', '缺爱', '理性', '浪漫', '嘴硬心软', '社交恐惧'];
  V.me = async function () {
    const [profile, memData, aiCfg, badge] = await Promise.all([
      YB.api('/api/profile'), YB.api('/api/memories'), YB.api('/api/settings/ai'), YB.api('/api/badges')
    ]);
    YB.state.profile = profile;
    const aiOn = aiCfg.hasKey;
    return {
      html: `
      <div class="me-page">
        <section class="profile-hero">
          <div class="profile-avatar">${YB.petAvatar(profile.petType || 'nuomi', 92, 'pet-bob')}</div>
          <div class="profile-id">
            <p class="eyebrow">${YB.esc(profile.nickname)} 的愈伴档案</p>
            <h2>${YB.esc(profile.nickname)}</h2>
            <p>${[profile.city, profile.gender, profile.birthday].filter(Boolean).map(YB.esc).join(' · ') || '还没有填写更多信息'}</p>
            <div class="profile-tags">${(profile.tags || []).map(t => `<span class="chip soft">${YB.esc(t)}</span>`).join('') || '<span class="hint">还没有性格标签</span>'}</div>
          </div>
          <div class="profile-badges"><b>${badge.unlocked}<span>/${badge.total}</span></b><p>成长勋章</p><b>${memData.count}</b><p>被记住的事</p></div>
        </section>

        <section class="card" id="section-profile">
          <div class="card-head"><div><p class="label">个人档案</p><h3>让${YB.esc(profile.petName)}更懂你</h3></div></div>
          <div class="form-grid">
            <label class="field"><span>昵称</span><input class="input" id="pf-nickname" maxlength="20" value="${YB.esc(profile.nickname)}"></label>
            <label class="field"><span>性别</span><select class="input" id="pf-gender">
              ${['', '女', '男', '其他', '不透露'].map(g => `<option value="${g}" ${g === profile.gender ? 'selected' : ''}>${g || '未选择'}</option>`).join('')}
            </select></label>
            <label class="field"><span>生日</span><input type="date" class="input" id="pf-birthday" value="${YB.esc(profile.birthday)}"></label>
            <label class="field"><span>所在城市</span><input class="input" id="pf-city" maxlength="20" value="${YB.esc(profile.city)}" placeholder="用于同城治愈推荐"></label>
            <label class="field"><span>萌宠名字</span><input class="input" id="pf-pet" maxlength="12" value="${YB.esc(profile.petName)}"></label>
            <label class="field"><span>默认沟通风格</span><select class="input" id="pf-style">
              ${['温柔宠溺', '犀利骂醒', '佛系静心', '热血励志'].map(s => `<option ${s === profile.style ? 'selected' : ''}>${s}</option>`).join('')}
            </select></label>
          </div>
          <div class="tag-block">
            <span class="field-label">陪你的萌宠形象（聊天与首页会一起换）</span>
            <div class="pet-mini-row" id="pf-pets">
              ${(YB.PETS || []).map(x => `<button type="button" class="pet-mini ${x.key === (profile.petType || 'nuomi') ? 'on' : ''}" data-pet="${x.key}">${YB.petAvatar(x.key, 34)}<span>${x.name}</span><em>${x.tag}</em></button>`).join('')}
            </div>
          </div>
          <div class="tag-block">
            <span class="field-label">性格标签</span>
            <div class="chips" id="pf-tags">${TAG_SUGGEST.map(t => `<button type="button" class="chip ${profile.tags.includes(t) ? 'on' : ''}" data-ptag="${t}">${t}</button>`).join('')}</div>
          </div>
          <label class="field"><span>想让它知道的你（自我描述 / 心理画像）</span>
            <textarea class="input area" id="pf-psych" rows="3" maxlength="1200" placeholder="例如：我很容易共情别人，但很难拒绝；我在原生家庭里习惯了自己扛……">${YB.esc(profile.psych)}</textarea>
          </label>
          <div class="row-between">
            <span class="hint">这些信息会参与每一次对话与解读</span>
            <button class="btn primary" id="pf-save">保存档案</button>
          </div>
        </section>

        <section class="card" id="section-memory">
          <div class="card-head">
            <div><p class="label">终身记忆库</p><h3>它记得的 ${memData.count} 件事</h3></div>
            <button class="text-btn" id="mem-add-btn">手动添加 <span>+</span></button>
          </div>
          <p class="muted">每次对话后，AI 会自动提取值得长期记住的事实。你可以随时补充或删除。</p>
          <div class="memory-list">
            ${memData.memories.length ? memData.memories.map(m => `
              <div class="memory-item">
                <span class="mem-kind">${YB.esc(m.kind)}</span>
                <div><p>${YB.esc(m.content)}</p><span>${YB.fmtDate(m.created_at)} · 重要度 ${m.importance}</span></div>
                <button class="icon-btn" data-del-mem="${m.id}" title="删除">${YB.icon('trash', 14)}</button>
              </div>`).join('') : '<p class="muted">还没有长期记忆。聊聊你的经历，它会自动记住。</p>'}
          </div>
          <div class="inline-form" id="mem-add" hidden>
            <input class="input" id="mem-input" maxlength="120" placeholder="想让它记住的一件事…">
            <button class="btn soft small" id="mem-save">记住</button>
          </div>
        </section>

        <section class="card" id="section-ai">
          <div class="card-head">
            <div><p class="label">大模型配置</p><h3>DeepSeek · OpenAI 兼容接口</h3></div>
            <span class="ai-status ${aiOn ? 'on' : ''}">${aiOn ? 'Key 已配置' : '本地模式'}</span>
          </div>
          <p class="muted">Key 保存在服务端，不会出现在前端代码里。未配置时，愈伴使用本地陪伴逻辑，功能流程仍完整可用。</p>
          <div class="form-grid">
            <label class="field span-2"><span>API Key ${aiOn ? `<i>当前：${YB.esc(aiCfg.keyPreview)}</i>` : ''}</span>
              <input class="input" id="ai-key" type="password" placeholder="${aiOn ? '如需更换，请输入新的 Key' : 'sk-...'}" autocomplete="off">
              <small class="field-tip">只粘贴 sk- 开头的一整串，不要粘进服务地址输入框。</small>
            </label>
            <label class="field"><span>服务地址</span><input class="input" id="ai-base" value="${YB.esc(aiCfg.baseUrl)}"><small class="field-tip">官方地址 https://api.deepseek.com，不要带 /chat/completions。<button type="button" class="link-mini" id="ai-base-preset">填入官方地址</button></small></label>
            <label class="field"><span>模型</span><input class="input" id="ai-model" value="${YB.esc(aiCfg.model)}"><small class="field-tip">通常为 deepseek-chat，也可填 deepseek-reasoner。</small></label>
          </div>
          <details class="adv-box" ${aiCfg.proxy ? 'open' : ''}>
            <summary>高级：网络代理与联网检索</summary>
            <div class="form-grid">
              <label class="field"><span>HTTP 代理（可选）</span><input class="input" id="ai-proxy" value="${YB.esc(aiCfg.proxy || '')}" placeholder="如 http://127.0.0.1:7890"></label>
              <label class="field"><span>联网补充资料</span>
                <label class="switch-line"><input type="checkbox" id="ai-web" ${aiCfg.webSearch ? 'checked' : ''}> 问到实时信息时，允许检索公开网页</label>
              </label>
            </div>
          </details>
          <div class="row-between">
            <div class="ai-test"><button class="btn ghost small" id="ai-test">用当前填写的内容测试</button><span id="ai-test-result" class="hint"></span></div>
            <button class="btn primary" id="ai-save">保存配置</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><p class="label">数据与隐私</p><h3>你的数据，你做主</h3></div></div>
          <div class="me-actions">
            <button class="me-action" id="export-data">${YB.icon('download', 19)}<div><b>导出全部数据</b><span>档案、对话、情绪、日记、报告等 JSON 文件</span></div></button>
            <button class="me-action" id="open-safety">${YB.icon('shield', 19)}<div><b>危机与安全资源</b><span>24 小时心理援助热线与呼吸引导</span></div></button>
            <button class="me-action danger" id="logout">${YB.icon('lock', 19)}<div><b>退出登录</b><span>数据仍保留在你的账号中</span></div></button>
          </div>
          <p class="fineprint">愈伴不是医疗机构。所有测评、解梦、命理解读仅作心理疗愈与自我成长参考，不构成诊断，不测吉凶。你的私密日记与对话不会对外展示；树洞内容匿名发布。</p>
        </section>

        <footer class="app-foot">
          <div class="foot-pet">${YB.mascot(58)}</div>
          <p>愈伴 · 被记住的地方</p>
          <span>v1.0 · 心理疗愈与自我成长参考</span>
        </footer>
      </div>`,
      mount(root) {
        const params = YB._params;
        if (params?.section) {
          setTimeout(() => root.querySelector(`#section-${params.section}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
          YB._params = null;
        }
        let tags = [...profile.tags];
        let petType = profile.petType || 'nuomi';
        root.querySelectorAll('[data-ptag]').forEach(b => b.onclick = () => {
          b.classList.toggle('on');
          tags = [...root.querySelectorAll('[data-ptag].on')].map(x => x.dataset.ptag);
        });
        root.querySelectorAll('#pf-pets [data-pet]').forEach(b => b.onclick = () => {
          root.querySelectorAll('#pf-pets [data-pet]').forEach(x => x.classList.remove('on'));
          b.classList.add('on'); petType = b.dataset.pet;
          const meta = (YB.PETS || []).find(x => x.key === petType);
          if (meta) root.querySelector('#pf-pet').value = meta.name;
        });
        root.querySelector('#pf-save').onclick = async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true; btn.textContent = '保存中…';
          try {
            const updated = await YB.api('/api/profile', { method: 'PUT', body: {
              nickname: root.querySelector('#pf-nickname').value,
              gender: root.querySelector('#pf-gender').value,
              birthday: root.querySelector('#pf-birthday').value,
              city: root.querySelector('#pf-city').value,
              petName: root.querySelector('#pf-pet').value,
              petType,
              style: root.querySelector('#pf-style').value,
              psych: root.querySelector('#pf-psych').value,
              tags
            }});
            YB.state.profile = updated;
            YB.toast('档案已保存，它会记住这些');
            YB.routeRender(true);
          } catch (err) { YB.toast(err.message, 'error'); btn.disabled = false; btn.textContent = '保存档案'; }
        };

        const addWrap = root.querySelector('#mem-add');
        root.querySelector('#mem-add-btn').onclick = () => { addWrap.hidden = !addWrap.hidden; if (!addWrap.hidden) root.querySelector('#mem-input').focus(); };
        root.querySelector('#mem-save').onclick = async () => {
          const content = root.querySelector('#mem-input').value.trim();
          if (content.length < 2) return YB.toast('再写具体一点', 'error');
          try {
            await YB.api('/api/memories', { method: 'POST', body: { content } });
            YB.toast('记住了'); YB.routeRender(true);
          } catch (e) { YB.toast(e.message, 'error'); }
        };
        root.querySelectorAll('[data-del-mem]').forEach(b => b.onclick = () => {
          YB.confirm('删除后，AI 将不再使用这条记忆。确定吗？', async () => {
            try { await YB.api(`/api/memories/${b.dataset.delMem}`, { method: 'DELETE' }); YB.toast('已删除'); YB.routeRender(true); }
            catch (e) { YB.toast(e.message, 'error'); }
          }, '删除');
        });

        root.querySelector('#ai-save').onclick = async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true; btn.textContent = '保存中…';
          try {
            const body = {
              baseUrl: root.querySelector('#ai-base').value,
              model: root.querySelector('#ai-model').value,
              proxy: root.querySelector('#ai-proxy').value,
              webSearch: root.querySelector('#ai-web').checked
            };
            const key = root.querySelector('#ai-key').value.trim();
            if (key) body.apiKey = key;
            const r = await YB.api('/api/settings/ai', { method: 'PUT', body });
            YB.state.aiReady = r.hasKey;
            YB.toast(r.hasKey ? '配置已保存，AI 已就绪' : '配置已保存');
            setTimeout(() => YB.routeRender(true), 400);
          } catch (err) { YB.toast(err.message, 'error'); btn.disabled = false; btn.textContent = '保存配置'; }
        };
        root.querySelector('#ai-base-preset').onclick = () => {
          root.querySelector('#ai-base').value = 'https://api.deepseek.com';
          root.querySelector('#ai-model').value = 'deepseek-chat';
          YB.toast('已填入官方地址和模型，再粘贴 Key 后测试');
        };
        root.querySelector('#ai-test').onclick = async (e) => {
          const btn = e.currentTarget;
          const out = root.querySelector('#ai-test-result');
          btn.disabled = true; out.textContent = '正在连接…'; out.className = 'hint';
          try {
            const r = await YB.api('/api/settings/ai/test', { method: 'POST', body: {
              apiKey: root.querySelector('#ai-key').value.trim(),
              baseUrl: root.querySelector('#ai-base').value,
              model: root.querySelector('#ai-model').value,
              proxy: root.querySelector('#ai-proxy').value
            }});
            out.textContent = `连接成功 · ${r.latency || 0}ms · ${r.model}`;
            out.className = 'hint ok';
            if (r.baseUrl && r.baseUrl !== root.querySelector('#ai-base').value.trim()) {
              root.querySelector('#ai-base').value = r.baseUrl;
            }
          } catch (err) { out.textContent = err.message; out.className = 'hint err'; }
          btn.disabled = false;
        };

        root.querySelector('#export-data').onclick = () => { window.location.href = '/api/export'; };
        root.querySelector('#open-safety').onclick = () => YB.sos();
        root.querySelector('#logout').onclick = () => {
          YB.confirm('确定退出登录吗？下次登录后数据还在。', async () => {
            await YB.api('/api/auth/logout', { method: 'POST' });
            YB.state.user = null;
            YB.renderAuth();
          }, '退出登录');
        };
      }
    };
  };
})();
