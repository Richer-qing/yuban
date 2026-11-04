/* 愈伴 · 启动 / 认证 / 路由 */
(function () {
  const YB = window.YB;
  const TITLES = {
    home: ['今日', '被记住的地方'],
    welcome: ['认识你', '让陪伴真的懂你'],
    chat: ['萌宠陪伴', '24 小时都在'],
    journal: ['心情日记', '看见自己，才能照顾自己'],
    treehole: ['匿名树洞', '把心事放下来'],
    heal: ['疗愈中心', '选择此刻需要的'],
    sleep: ['助眠', '先让身体安全'],
    dreams: ['解梦', '听见潜意识'],
    assess: ['测评与报告', '看见变化'],
    mystic: ['人格镜像', '照见自己，不算命'],
    library: ['疗愈资源库', '科学 + 国风'],
    life: ['同城治愈', '回到生活里'],
    studio: ['我的影像', '只属于你的故事'],
    me: ['档案与记忆', '你的数据，你做主'],
    support: ['专业支持', '关键时不孤单']
  };

  /* ---------------- 认证页 ---------------- */
  YB.renderAuth = function () {
    const app = document.getElementById('app');
    document.body.classList.remove('locked');
    app.className = 'app guest';
    app.innerHTML = `
      <div class="auth">
        <section class="auth-art">
          <div class="auth-brand"><div class="brand-mark">${YB.mascot(46)}</div><b>愈伴</b><span>YUBAN</span></div>
          <h1>一个<br>真正记得你的地方</h1>
          <p class="auth-sub">情绪兜底 · 长期陪伴 · 人格重塑 · 生活治愈</p>
          <div class="auth-pet">${YB.mascot(218, 'pet-bob')}</div>
          <div class="auth-points">
            <span>${YB.icon('heart', 16)} 终身记忆，不用重复介绍自己</span>
            <span>${YB.icon('moon', 16)} 助眠 · 解梦 · 情绪急救</span>
            <span>${YB.icon('shield', 16)} AI 轻陪伴 + 持证咨询师</span>
          </div>
          <p class="auth-foot">心理疗愈与自我成长参考 · 不替代医疗 · 不测吉凶</p>
        </section>

        <section class="auth-panel">
          <div class="auth-card card">
            <div class="auth-tabs">
              <button class="auth-tab on" data-auth-tab="login">登录</button>
              <button class="auth-tab" data-auth-tab="register">注册</button>
            </div>
            <div id="auth-form-area"></div>
          </div>
          <p class="auth-note">登录即表示你同意愈伴的隐私与合规说明。你的日记、对话仅本人可见。</p>
        </section>
      </div>`;

    const area = app.querySelector('#auth-form-area');
    const loginHTML = `
      <p class="auth-welcome">欢迎回来，它一直在等你。</p>
      <form id="login-form" autocomplete="on">
        <label class="field"><span>手机号 / 邮箱</span><input class="input" name="identifier" placeholder="输入注册时使用的账号" autocomplete="username"></label>
        <label class="field"><span>密码</span><input class="input" name="password" type="password" placeholder="至少 6 位" autocomplete="current-password"></label>
        <button class="btn primary block" type="submit" id="login-submit">进入愈伴</button>
      </form>
      <div class="auth-links"><button class="text-btn" id="forgot-link">忘记密码？</button><span class="hint">同一账号，手机 / 平板 / 电脑通用</span></div>
      <div class="auth-divider"><span>或</span></div>
      <p class="auth-tip">${YB.icon('lock', 14)} 数据加密存储 · 支持跨设备登录</p>`;
    const registerHTML = `
      <p class="auth-welcome">第一次来，慢慢来就好。</p>
      <form id="register-form" autocomplete="on">
        <label class="field"><span>手机号 / 邮箱</span><input class="input" name="identifier" placeholder="用于登录与找回密码" autocomplete="username"></label>
        <label class="field"><span>怎么称呼你</span><input class="input" name="nickname" maxlength="20" placeholder="昵称（选填）"></label>
        <label class="field"><span>密码</span><input class="input" name="password" type="password" placeholder="至少 6 位" autocomplete="new-password"></label>
        <label class="check-line"><input type="checkbox" id="agree"><span>我已阅读并同意：愈伴仅提供心理疗愈与自我成长参考，不替代医疗。</span></label>
        <button class="btn primary block" type="submit" id="register-submit">创建我的愈伴</button>
      </form>
      <p class="auth-tip">${YB.icon('heart', 14)} 注册后会获得一只记得你的萌宠</p>`;

    const show = (tab) => {
      area.innerHTML = tab === 'login' ? loginHTML : registerHTML;
      app.querySelectorAll('[data-auth-tab]').forEach(t => t.classList.toggle('on', t.dataset.authTab === tab));
      bind(tab);
    };

    const bind = (tab) => {
      if (tab === 'login') {
        const form = area.querySelector('#login-form');
        form.onsubmit = async (e) => {
          e.preventDefault();
          const btn = area.querySelector('#login-submit');
          const identifier = form.identifier.value.trim();
          const password = form.password.value;
          if (!identifier || !password) return YB.toast('请填写账号和密码', 'error');
          btn.disabled = true; btn.textContent = '正在进入…';
          try {
            const r = await YB.api('/api/auth/login', { method: 'POST', body: { identifier, password } });
            YB.state.user = r.user; YB.state.profile = r.profile;
            await startApp();
            YB.toast(`欢迎回来，${r.profile.nickname}`);
          } catch (err) {
            YB.toast(err.message, 'error');
            btn.disabled = false; btn.textContent = '进入愈伴';
          }
        };
        area.querySelector('#forgot-link').onclick = showForgot;
      } else {
        const form = area.querySelector('#register-form');
        form.onsubmit = async (e) => {
          e.preventDefault();
          const btn = area.querySelector('#register-submit');
          const identifier = form.identifier.value.trim();
          const password = form.password.value;
          const nickname = form.nickname.value.trim();
          if (!area.querySelector('#agree').checked) return YB.toast('请先阅读并勾选下方说明', 'error');
          if (password.length < 6) return YB.toast('密码至少 6 位', 'error');
          btn.disabled = true; btn.textContent = '正在创建…';
          try {
            const r = await YB.api('/api/auth/register', { method: 'POST', body: { identifier, password, nickname } });
            YB.state.user = r.user; YB.state.profile = r.profile;
            await startApp();
            location.hash = '#/welcome';
            YB.toast('从今天起，它会记得你。先花一分钟认识你');
          } catch (err) {
            YB.toast(err.message, 'error');
            btn.disabled = false; btn.textContent = '创建我的愈伴';
          }
        };
      }
    };

    function showForgot() {
      const m = YB.modal({
        title: '找回密码',
        body: `
          <p class="modal-text">输入注册时的手机号或邮箱，我们会生成一个重置验证码。</p>
          <label class="field"><span>账号</span><input class="input" id="fg-id" placeholder="手机号 / 邮箱"></label>
          <div class="code-box" id="fg-code-box" hidden>
            <p class="hint">演示环境验证码：<b id="fg-code"></b></p>
            <label class="field"><span>验证码</span><input class="input" id="fg-code-input" maxlength="6"></label>
            <label class="field"><span>新密码</span><input class="input" id="fg-pwd" type="password" placeholder="至少 6 位"></label>
          </div>
          <p class="fineprint">正式环境将通过短信/邮件发送验证码，当前为演示直出。</p>`,
        actions: `<button class="btn ghost" data-close>取消</button><button class="btn primary" id="fg-next">获取验证码</button>`,
        onMount(w) {
          let step = 1;
          w.querySelector('#fg-next').onclick = async (e) => {
            const btn = e.currentTarget;
            if (step === 1) {
              const identifier = w.querySelector('#fg-id').value.trim();
              if (!identifier) return YB.toast('请输入账号', 'error');
              btn.disabled = true; btn.textContent = '发送中…';
              try {
                const r = await YB.api('/api/auth/reset/request', { method: 'POST', body: { identifier } });
                w.querySelector('#fg-code-box').hidden = false;
                w.querySelector('#fg-code').textContent = r.devCode || '（账号不存在）';
                if (r.devCode) YB.toast('验证码已生成');
                step = 2; btn.textContent = '确认重置'; btn.disabled = false;
              } catch (err) { YB.toast(err.message, 'error'); btn.disabled = false; btn.textContent = '获取验证码'; }
            } else {
              const identifier = w.querySelector('#fg-id').value.trim();
              const code = w.querySelector('#fg-code-input').value.trim();
              const password = w.querySelector('#fg-pwd').value;
              if (!code || password.length < 6) return YB.toast('请填写验证码和至少 6 位新密码', 'error');
              btn.disabled = true; btn.textContent = '重置中…';
              try {
                await YB.api('/api/auth/reset/confirm', { method: 'POST', body: { identifier, code, password } });
                m.close();
                YB.toast('密码已重置，请重新登录');
              } catch (err) { YB.toast(err.message, 'error'); btn.disabled = false; btn.textContent = '确认重置'; }
            }
          };
        }
      });
    }

    app.querySelectorAll('[data-auth-tab]').forEach(t => t.onclick = () => show(t.dataset.authTab));
    show('login');
  };

  /* ---------------- 启动已登录 ---------------- */
  async function startApp() {
    YB.state.authChecked = true;
    if (!YB.state.profile) {
      try {
        const me = await YB.api('/api/auth/me');
        YB.state.user = me.user; YB.state.profile = me.profile;
      } catch (_) { YB.renderAuth(); return; }
    }
    try {
      const ov = await YB.api('/api/overview');
      YB.state.overview = ov; YB.state.profile = ov.profile; YB.state.aiReady = ov.aiReady;
    } catch (_) {}
    YB.renderShell();
    if (!location.hash) location.hash = '#/home';
    await renderRoute();
  }

  /* ---------------- 路由 ---------------- */
  let rendering = false;
  YB.routeRender = function (force) {
    if (force) { renderRoute(); return; }
    renderRoute();
  };

  async function renderRoute() {
    const app = document.getElementById('app');
    if (!app || !app.classList.contains('authenticated')) return;
    if (rendering) return;
    rendering = true;
    const raw = (location.hash || '#/home').replace('#/', '').split('?')[0] || 'home';
    const route = YB.views[raw] ? raw : 'home';
    YB.currentRoute = route;
    const [title, sub] = TITLES[route] || ['愈伴', ''];
    YB.setTitle(title, sub);
    YB.setActive(route);
    if (YB.stopSounds) YB.stopSounds();
    const view = document.getElementById('view');
    view.innerHTML = `<div class="view-loading"><span class="spinner"></span><p>正在准备这一页…</p></div>`;
    try {
      const result = await YB.views[route]();
      view.innerHTML = result.html;
      if (result.mount) result.mount(view);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e) {
      console.error(e);
      view.innerHTML = `
        <div class="error-card card">
          <div>${YB.mascot(90, 'pet-sleep')}</div>
          <h3>这一页暂时没打开</h3>
          <p>${YB.esc(e.message || '网络似乎有点问题')}</p>
          <button class="btn primary" onclick="YB.routeRender(true)">再试一次</button>
        </div>`;
    } finally {
      rendering = false;
    }
  }

  window.addEventListener('hashchange', () => {
    if (YB.state.user) renderRoute();
  });

  /* ---------------- 启动 ---------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const me = await YB.api('/api/auth/me');
      YB.state.user = me.user; YB.state.profile = me.profile;
      if (!location.hash) location.hash = '#/home';
      await startApp();
    } catch (_) {
      YB.state.authChecked = true;
      YB.renderAuth();
    }
  });

  YB.stopSounds = function () { if (YB.sound) YB.sound.stop(false); };
})();
