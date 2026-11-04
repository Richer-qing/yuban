/* 愈伴 · 个性化热血成长 MV：滚动字幕 + 实时合成音乐 + 可导出视频 */
(function () {
  const YB = window.YB;
  if (!YB) return;

  const W = 720, H = 1280;
  const PALETTES = {
    verse: ['#171a2e', '#2b2144', '#4a2f4f'],
    chorus: ['#40202c', '#8c3f3c', '#c97551'],
    punch: ['#25161b', '#6b2d2a', '#b98146'],
    outro: ['#20222f', '#4c4a5d', '#b9a18a']
  };

  function fmtTime(t) { return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }

  function wrapText(ctx, text, maxW) {
    const lines = [];
    let line = '';
    for (const ch of Array.from(String(text || ''))) {
      if (ch === '\n') { lines.push(line); line = ''; continue; }
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = ch; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawBlock(ctx, text, cx, y, maxW, lh, font, color, maxLines = 3) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, text, maxW).slice(0, maxLines);
    lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
    return y + lines.length * lh;
  }

  function drawKaraoke(ctx, text, cx, y, maxW, lh, font, base, active, ratio, maxLines = 2) {
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, text, maxW).slice(0, maxLines);
    const total = lines.reduce((n, l) => n + Array.from(l).length, 0) || 1;
    let shown = Math.floor(total * Math.min(1, Math.max(0, ratio)));
    lines.forEach((line, i) => {
      const ly = y + i * lh;
      const lw = ctx.measureText(line).width;
      ctx.fillStyle = base; ctx.fillText(line, cx, ly);
      if (shown > 0) {
        const chars = Array.from(line);
        const take = Math.min(chars.length, shown);
        const part = chars.slice(0, take).join('');
        const pw = ctx.measureText(part).width;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - lw / 2 - 4, ly - lh / 2, pw + 4, lh);
        ctx.clip();
        ctx.fillStyle = active; ctx.fillText(line, cx, ly);
        ctx.restore();
        shown -= take;
      }
    });
    return y + lines.length * lh;
  }

  function currentLine(mv, time) {
    const lines = mv.lines || [];
    let idx = -1;
    for (let i = 0; i < lines.length; i++) if (time >= lines[i].t) idx = i;
    return { idx, line: lines[idx] || null };
  }

  function drawFrame(ctx, mv, time, W, H) {
    const duration = mv.duration || 40;
    const { idx, line } = currentLine(mv, time);
    const kind = line ? line.kind : 'verse';
    const pal = PALETTES[kind] || PALETTES.verse;
    const g = ctx.createLinearGradient(0, 0, W * 0.9, H);
    g.addColorStop(0, pal[0]); g.addColorStop(.55, pal[1]); g.addColorStop(1, pal[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 光束与速度线
    ctx.save();
    const t = time;
    for (let i = 0; i < 7; i++) {
      const x = W * ((i * .17 + t * .015) % 1.25) - W * .1;
      const grad = ctx.createLinearGradient(x, 0, x + 90, H);
      grad.addColorStop(0, 'rgba(255,220,180,0)');
      grad.addColorStop(.5, `rgba(255,214,170,${kind === 'chorus' || kind === 'punch' ? .10 : .04})`);
      grad.addColorStop(1, 'rgba(255,220,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 90, 0); ctx.lineTo(x + 210, H); ctx.lineTo(x + 120, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // 粒子
    for (let i = 0; i < 44; i++) {
      const px = ((i * 79 + t * (6 + i % 7)) % W);
      const py = ((i * 131 + Math.sin(t * .6 + i) * 40 + t * 12) % H);
      const r = 1 + (i % 4) * .8;
      ctx.fillStyle = `rgba(255,240,220,${.18 + (i % 5) * .06})`;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }

    // 顶部品牌/进度
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.48)'; ctx.font = '500 19px "Songti SC", serif';
    ctx.fillText('愈伴 · 成长 MV', 42, 54);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '400 17px "PingFang SC", sans-serif';
    ctx.fillText(`${fmtTime(time)} / ${fmtTime(duration)}`, W - 42, 54);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(42, 76, W - 84, 4);
    ctx.fillStyle = 'rgba(255,210,160,.85)'; ctx.fillRect(42, 76, (W - 84) * Math.min(1, time / duration), 4);

    // 统计
    const st = mv.stats || {};
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '400 16px "PingFang SC", sans-serif';
    ctx.fillText(`第 ${st.days || 1} 天 · ${st.checkins || 0} 次情绪记录 · ${st.planDone || 0}/${st.planTotal || 7} 次打卡`, 42, 110);

    if (time < 3.8) {
      const a = Math.min(1, time / .6);
      ctx.globalAlpha = a;
      drawBlock(ctx, mv.title || '你的成长史', W / 2, H * .42, W - 150, 66, '600 44px "Songti SC", serif', '#fff8ee', 2);
      drawBlock(ctx, mv.subtitle || '一段只写给你的成长史', W / 2, H * .53, W - 170, 34, '400 22px "Songti SC", serif', 'rgba(255,244,230,.72)', 2);
      drawBlock(ctx, '这不是鸡汤，是你真实走过的痕迹', W / 2, H * .62, W - 200, 30, '400 18px "PingFang SC", sans-serif', 'rgba(255,244,230,.55)', 1);
      ctx.globalAlpha = 1;
    } else if (line) {
      const local = time - line.t;
      const ratio = Math.min(1, local / (line.d * .72));
      const fade = local < .18 ? local / .18 : 1;
      ctx.globalAlpha = Math.max(0, fade);
      const isBig = line.kind === 'chorus' || line.kind === 'punch';
      const size = isBig ? 50 : 38;
      const color = line.kind === 'punch' ? '#ffe3a6' : line.kind === 'chorus' ? '#ffd2ad' : '#fff4e8';
      // 背景大字装饰
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.font = `700 150px "Songti SC", serif`;
      ctx.fillText(String(idx + 1).padStart(2, '0'), W / 2, H * .24);
      // 主字幕（逐字高亮）
      drawKaraoke(ctx, line.text, W / 2, H * .45, W - 140, size * 1.55, `600 ${size}px "Songti SC", "Noto Serif SC", serif`,
        'rgba(255,255,255,.32)', color, ratio, 3);
      ctx.globalAlpha = 1;

      // 底部滚动字幕带：上一句 / 当前 / 下一句
      const boxY = H - 250;
      const prev = mv.lines[idx - 1];
      const next = mv.lines[idx + 1];
      const drift = (local / line.d) * 26;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, boxY - 46, W, 190); ctx.clip();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if (prev) {
        ctx.fillStyle = 'rgba(255,255,255,.24)'; ctx.font = '400 19px "PingFang SC", sans-serif';
        ctx.fillText(prev.text.slice(0, 30), 58, boxY - 44 + drift);
      }
      ctx.fillStyle = line.kind === 'punch' ? '#ffe3a6' : 'rgba(255,255,255,.96)';
      ctx.font = '600 26px "Songti SC", serif';
      ctx.fillText(line.text.slice(0, 26), 58, boxY + drift);
      if (next) {
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.font = '400 19px "PingFang SC", sans-serif';
        ctx.fillText(next.text.slice(0, 30), 58, boxY + 50 + drift);
      }
      ctx.restore();
      // 滚动字幕左侧高亮条
      ctx.fillStyle = 'rgba(255,203,148,.8)'; ctx.fillRect(38, boxY - 16 + drift, 5, 34);
    } else {
      // 收尾
      const a = Math.min(1, (time - (mv.lines[mv.lines.length - 1].t + mv.lines[mv.lines.length - 1].d)) / .5);
      ctx.globalAlpha = Math.max(0, a);
      drawBlock(ctx, '你，大有所为', W / 2, H * .42, W - 120, 92, '700 78px "Songti SC", serif', '#ffe1a8', 1);
      drawBlock(ctx, `${mv.stats?.days || 1} 天没有白走，接下来的路也别急着证明给谁看。`, W / 2, H * .53, W - 150, 40, '400 24px "Songti SC", serif', 'rgba(255,244,230,.8)', 2);
      drawBlock(ctx, '愈伴 · 只写给你的成长史', W / 2, H * .64, W - 180, 26, '400 17px "PingFang SC", sans-serif', 'rgba(255,244,230,.5)', 1);
      ctx.globalAlpha = 1;
    }

    // 底部水印
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.26)'; ctx.font = '400 15px "PingFang SC", sans-serif';
    ctx.fillText('愈伴 YUBAN', W - 42, H - 44);
  }

  /* ---------------- 实时合成配乐 ---------------- */
  function makeAudio(mv, destination) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.62;
    master.connect(destination || ctx.destination);
    const bpm = Math.min(128, Math.max(88, mv.bpm || 104));
    const beat = 60 / bpm;
    const duration = mv.duration || 40;
    const now = ctx.currentTime + 0.08;
    const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .25), ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    const tone = (type, freq, start, dur, gain = .1, endFreq) => {
      const o = ctx.createOscillator(); const gn = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, start);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + dur);
      gn.gain.setValueAtTime(0, start);
      gn.gain.linearRampToValueAtTime(gain, start + Math.min(.05, dur * .3));
      gn.gain.exponentialRampToValueAtTime(.001, start + dur);
      o.connect(gn); gn.connect(master);
      o.start(start); o.stop(start + dur + .02);
    };
    const kick = (s) => tone('sine', 128, s, .22, .28, 44);
    const snare = (s) => {
      const src = ctx.createBufferSource(); src.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = .8;
      const gn = ctx.createGain(); gn.gain.setValueAtTime(.16, s); gn.gain.exponentialRampToValueAtTime(.001, s + .16);
      src.connect(bp); bp.connect(gn); gn.connect(master); src.start(s); src.stop(s + .2);
    };
    const hat = (s) => {
      const src = ctx.createBufferSource(); src.buffer = noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const gn = ctx.createGain(); gn.gain.setValueAtTime(.05, s); gn.gain.exponentialRampToValueAtTime(.001, s + .06);
      src.connect(hp); hp.connect(gn); gn.connect(master); src.start(s); src.stop(s + .08);
    };
    // 和弦进行：Am - F - C - G，热血流行常用走向
    const chords = [
      [220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 164.8, 196], [196, 246.9, 293.7]
    ];
    const roots = [110, 87.3, 65.4, 98];
    const beats = Math.floor(duration / beat);
    for (let b = 0; b < beats; b++) {
      const s = now + b * beat;
      const section = Math.floor((s - now) / Math.max(1, duration / 12));
      kick(s);
      if (b % 4 === 1 || b % 4 === 3) snare(s);
      hat(s + beat * .5);
      const ch = chords[Math.floor(b / 4) % 4];
      if (b % 4 === 0) {
        ch.forEach(f => tone('triangle', f, s, beat * 3.7, .045));
        tone('sawtooth', roots[Math.floor(b / 4) % 4], s, beat * 1.8, .08, roots[Math.floor(b / 4) % 4] * .98);
      }
      // 副歌加入上行琶音
      if (section >= 5) {
        const notes = [440, 523.2, 659.2, 783.9];
        notes.forEach((f, i) => tone('sine', f, s + beat * i / 4, beat / 3, .035));
      }
    }
    return {
      ctx,
      startAt: now,
      stop() { try { ctx.close(); } catch (_) {} }
    };
  }

  /* ---------------- 播放器 ---------------- */
  YB.openMV = function (mv) {
    let canvas, ctx, audio = null, raf = 0, exportTimer = 0;
    const modal = YB.modal({
      title: '我的成长 MV',
      cls: 'cinema-modal mv-modal-wrap',
      body: `
        <div class="mv-modal">
          <canvas id="mv-canvas" width="${W}" height="${H}"></canvas>
          <div class="mv-now" id="mv-now"></div>
        </div>`,
      actions: `<button class="btn ghost" data-close>关闭</button><button class="btn ghost" id="mv-restart">重新播放</button><button class="btn primary" id="mv-export">导出视频</button>`,
      onMount(w) {
        canvas = w.querySelector('#mv-canvas');
        ctx = canvas.getContext('2d');
        const now = w.querySelector('#mv-now');
        const paint = (time) => {
          drawFrame(ctx, mv, time, W, H);
          const { idx, line } = currentLine(mv, time);
          now.textContent = line ? `${String(idx + 1).padStart(2, '0')} / ${String(mv.lines.length).padStart(2, '0')} · ${line.kind === 'chorus' ? '副歌' : line.kind === 'punch' ? '重音' : line.kind === 'outro' ? '收束' : '主歌'}` : '你，大有所为';
        };
        const stopPlay = () => {
          cancelAnimationFrame(raf); raf = 0;
          if (audio) { audio.stop(); audio = null; }
        };
        const play = () => {
          stopPlay();
          drawFrame(ctx, mv, 0, W, H); paint(0);
          audio = makeAudio(mv);
          const base = performance.now();
          startedAt = base;
          const loop = () => {
            const time = (performance.now() - base) / 1000;
            if (time >= (mv.duration || 40)) {
              paint(mv.duration || 40);
              raf = 0;
              if (audio) { audio.stop(); audio = null; }
              return;
            }
            drawFrame(ctx, mv, time, W, H);
            paint(time);
            raf = requestAnimationFrame(loop);
          };
          raf = requestAnimationFrame(loop);
        };
        play();
        w.addEventListener('pointerdown', () => {
          if (audio && audio.ctx && audio.ctx.state === 'suspended') { try { audio.ctx.resume(); } catch (_) {} }
        });
        w.querySelector('#mv-restart').onclick = () => { if (!exportTimer) play(); };

        w.querySelector('#mv-export').onclick = async (e) => {
          if (exportTimer) return;
          const btn = e.currentTarget;
          stopPlay();
          btn.disabled = true;
          const total = mv.duration || 40;
          const started = performance.now();
          const label = w.querySelector('#mv-now');
          try {
            btn.textContent = '正在合成 0%';
            if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
              throw new Error('当前浏览器不支持视频导出，请使用 Chrome / Edge / 新版 Safari');
            }
            const videoStream = canvas.captureStream(30);
            const dest = audioCtxDest();
            let audioStream = null;
            if (dest) {
              audio = makeAudio(mv, dest.node);
              audioStream = dest.stream;
            }
            const tracks = [...videoStream.getVideoTracks(), ...(audioStream ? audioStream.getAudioTracks() : [])];
            const stream = new MediaStream(tracks);
            const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
              .find(t => MediaRecorder.isTypeSupported(t)) || '';
            const chunks = [];
            const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2600000 } : {});
            const done = new Promise((resolve, reject) => { rec.onstop = resolve; rec.onerror = reject; });
            rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
            rec.start(100);
            const loop = () => {
              const time = (performance.now() - started) / 1000;
              const pct = Math.min(100, Math.round(time / total * 100));
              btn.textContent = `正在合成 ${pct}%`;
              if (time >= total) {
                drawFrame(ctx, mv, total, W, H);
                rec.stop();
                try { videoStream.getTracks().forEach(t => t.stop()); } catch (_) {}
                if (audio) { audio.stop(); audio = null; }
                return;
              }
              drawFrame(ctx, mv, time, W, H);
              label.textContent = pct < 100 ? `正在合成 ${pct}% · 请保持页面打开` : '完成';
              exportTimer = requestAnimationFrame(loop);
            };
            exportTimer = requestAnimationFrame(loop);
            await done;
            cancelAnimationFrame(exportTimer); exportTimer = 0;
            const blob = new Blob(chunks, { type: 'video/webm' });
            if (!blob.size) throw new Error('合成失败');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${(mv.title || '我的成长MV').replace(/[\\/:*?"<>|]/g, '-')}.webm`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1500);
            YB.toast('成长 MV 已导出，带着音乐一起保存到本地');
            btn.disabled = false; btn.textContent = '导出视频';
            label.textContent = '导出完成，可以再看一遍';
            play();
          } catch (err) {
            cancelAnimationFrame(exportTimer); exportTimer = 0;
            if (audio) { audio.stop(); audio = null; }
            btn.disabled = false; btn.textContent = '导出视频';
            YB.toast(err.message || '导出失败，请用 Chrome 打开', 'error');
          }
        };
        const cleanup = () => { stopPlay(); cancelAnimationFrame(exportTimer); exportTimer = 0; };
        w.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', cleanup));
        const bd = w.querySelector('.modal-backdrop');
        if (bd) bd.addEventListener('click', cleanup);
        const x = w.querySelector('.modal-close');
        if (x) x.addEventListener('click', cleanup);
      }
    });
    return modal;
  };

  let sharedCtx = null;
  function audioCtxDest() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx) sharedCtx = new Ctx();
    const stream = sharedCtx.createMediaStreamDestination();
    try { sharedCtx.resume(); } catch (_) {}
    return { node: stream, stream };
  }
})();
