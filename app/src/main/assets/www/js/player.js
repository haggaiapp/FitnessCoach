/* נגן האימון – מאמן אישי מונחה */
(function () {
  'use strict';
  const { Figure } = window.FigureEngine;
  const { byId } = window.EXDB;
  const $ = (s, r) => (r || document).querySelector(s);
  const PH = { warmup: 'חימום', main: 'אימון', cool: 'שחרור ומתיחות' };
  const PRAISE = ['מצוין!', 'כל הכבוד!', 'עבודה נהדרת!', 'יופי של סט!', 'אתם בוערים!'];
  const MOTIV = ['יופי, ממשיכים!', 'שמרו על נשימה קבועה', 'טכניקה לפני מהירות', 'אל תוותרו, אתם בדרך הנכונה!', 'הרגישו את השריר עובד'];
  const IC = {
    prev: '<svg viewBox="0 0 24 24"><path d="M18 6v12l-8.5-6zM6 6h2v12H6z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M6 6v12l8.5-6zM16 6h2v12h-2z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>'
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const unitTxt = (ex, st) => st.type === 'time' ? 'שניות' : (ex.side ? 'חזרות לכל צד' : 'חזרות');

  const P = {
    el: null, w: null, i: 0, single: false, timer: 0, paused: false, fig: null, nfig: null,
    activeMs: 0, lastTs: 0, remain: 0, count: 0, target: 0, said: {}, stats: { sets: 0, reps: 0 }, wake: null, advT: 0,

    start(workout, opts) {
      opts = opts || {};
      this.w = workout; this.single = !!opts.single; this.i = 0; this.activeMs = 0; this.paused = false;
      this.stats = { sets: 0, reps: 0 };
      this.el = $('#player'); this.el.classList.add('open'); this.el.classList.remove('paused');
      document.body.style.overflow = 'hidden';
      this.applySettings();
      this.renderShell();
      this.lastTs = performance.now();
      clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 200);
      this.requestWake();
      this.go(0);
    },
    applySettings() {
      const st = window.Program.state.settings;
      window.Voice.enabled = st.voice; window.Sound.enabled = st.beeps;
    },
    requestWake() {
      try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then((l) => { this.wake = l; }).catch(() => { }); } catch (e) { }
    },
    close() {
      clearInterval(this.timer); clearTimeout(this.advT);
      if (this.fig) this.fig.stop(); if (this.nfig) this.nfig.stop();
      window.Voice.stop();
      try { if (this.wake) this.wake.release(); } catch (e) { }
      this.el.classList.remove('open'); this.el.innerHTML = '';
      document.body.style.overflow = '';
      window.App && window.App.refresh();
    },
    askExit() {
      if (!this.paused) this.togglePause();
      window.UI.confirm('לצאת מהאימון?', this.single ? '' : 'ההתקדמות באימון הנוכחי לא תישמר.', 'יציאה', () => this.close(), () => { if (this.paused) this.togglePause(); });
    },
    renderShell() {
      this.el.innerHTML = `
      <div class="pl-top">
        <button type="button" class="x" id="plx" aria-label="יציאה">✕</button>
        <div class="ttl" id="plttl"></div>
        <div class="clock" id="plclock">0:00</div>
      </div>
      <div class="pbar" id="plbar"><i style="width:0"></i></div>
      <div class="pl-body">
        <div class="stage" id="plstage">
          <div class="figwrap" id="plfig"></div>
          <div class="panel" id="plpanel"></div>
          <div class="wt" id="plwt" hidden></div>
          <div class="ring" id="plring"></div>
          <div class="rest-v" id="plrest" hidden></div>
          <div class="pause-ov">⏸ מושהה</div>
        </div>
        <div class="side">
          <div class="tipbar"><span class="ti">💡</span><p id="pltip"></p></div>
          <div class="upnext" id="plnext"></div>
        </div>
      </div>
      <div class="pl-ctrl">
        <button type="button" class="cb" id="plprev" aria-label="הקודם">${IC.next}</button>
        <button type="button" class="cb main" id="plpause" aria-label="השהיה">${IC.pause}</button>
        <button type="button" class="cb" id="plnextb" aria-label="הבא">${IC.prev}</button>
        <button type="button" class="cb wide" id="pldone">✓ סיימתי</button>
      </div>`;
      this.fig = new Figure($('#plfig'));
      $('#plx').onclick = () => this.askExit();
      $('#plpause').onclick = () => this.togglePause();
      $('#plprev').onclick = () => this.prev();
      $('#plnextb').onclick = () => this.next();
      $('#pldone').onclick = () => this.finishSet();
    },
    step() { return this.w.steps[this.i]; },
    go(i) {
      clearTimeout(this.advT);
      this.i = Math.max(0, Math.min(this.w.steps.length - 1, i));
      const s = this.step(); this.said = {};
      if (s.kind === 'done') return this.renderDone();
      const exSteps = this.w.steps.filter((x) => x.kind === 'ex');
      const pos = this.w.steps.slice(0, this.i).filter((x) => x.kind === 'ex').length;
      $('#plbar i').style.width = (pos / exSteps.length * 100).toFixed(1) + '%';
      $('#plttl').textContent = (this.single ? 'תרגול חופשי' : this.w.title) + ' · ' + PH[s.phase];
      if (s.kind === 'ex') this.startEx(s); else this.startRest(s);
      this.renderUpNext();
      if (document.body.classList.contains('kbd') || document.documentElement.classList.contains('tv')) $('#plpause').focus();
    },
    startEx(s) {
      const ex = byId[s.id];
      $('#plrest').hidden = true;
      this.fig.setExercise(ex);
      this.fig.speed = window.Program.state.settings.speed || 1;
      this.count = 0;
      this.target = s.type === 'time' ? 0 : window.Program.loopsFor(ex, s.amt);
      this.remain = s.type === 'time' ? s.amt : 0;
      const st = window.Program.state.settings;
      $('#plpanel').innerHTML = `
        <div class="ph-l">${PH[s.phase]}</div>
        <h2>${ex.n}</h2>
        <div class="mu">${ex.mus}</div>
        ${ex.src ? `<div class="src">★ מתוך ${ex.src === 'abs' ? 'Impossible Abs' : 'Impossible Upper Body'}</div>` : ''}
        <div class="setl">${s.phase === 'main' ? `סט ${s.set} מתוך ${s.sets}` : ''}</div>`;
      $('#pltip').textContent = ex.tips[0] || ex.steps[0];
      this.tipIdx = 0;
      // משקל
      const wt = $('#plwt');
      if (s.phase === 'main' && (ex.eq === 'db' || ex.eq === 'machine')) {
        const cur = window.Program.suggestWeight(ex, this.w.lvl);
        wt.hidden = false;
        wt.innerHTML = `<button type="button" id="wtm" aria-label="הפחת משקל">−</button><b id="wtv">${cur} ק״ג</b><button type="button" id="wtp" aria-label="הוסף משקל">+</button>`;
        const set = (d) => { const S = window.Program.state; const v = window.Program.stepWeight(ex, window.Program.suggestWeight(ex, this.w.lvl), d); S.weights[ex.id] = v; window.Program.save(); $('#wtv').textContent = v + ' ק״ג'; };
        $('#wtm').onclick = () => set(-1); $('#wtp').onclick = () => set(1);
      } else { wt.hidden = true; wt.innerHTML = ''; }
      $('#pldone').style.display = s.type === 'time' ? 'none' : '';
      this.renderRing();
      // הכרזה
      let txt = ex.n + '. ';
      if (s.phase === 'main') txt += `סט ${s.set} מתוך ${s.sets}. `;
      txt += s.type === 'time' ? `${s.amt} שניות` : `${s.amt} ${ex.side ? 'חזרות לכל צד' : 'חזרות'}`;
      if (ex.eq === 'db' && s.phase === 'main' && s.set === 1) txt += `. משקל ${window.Program.suggestWeight(ex, this.w.lvl)} קילו`;
      window.Voice.speak(txt);
      window.Sound.go();
      this.fig.play(() => this.onLoop());
      if (this.paused) this.fig.pause(true);
    },
    onLoop() {
      const s = this.step(); if (!s || s.kind !== 'ex') return;
      const ex = byId[s.id];
      if (s.type !== 'reps') return;
      this.count++;
      const st = window.Program.state.settings;
      const shown = ex.side && !ex.anim.alt ? Math.ceil(this.count / 2) : this.count;
      if (this.count >= this.target) {
        this.renderRing();
        window.Sound.done(); window.Voice.speak(pick(PRAISE));
        this.fig.pause(true);
        if (st.auto) this.advT = setTimeout(() => this.finishSet(), 1300);
        return;
      }
      if (ex.side && !ex.anim.alt && this.count === this.target / 2) window.Voice.speak('החליפו צד');
      else if (this.target - this.count === 2 && this.target > 5) window.Voice.speak('עוד שתיים!');
      else if (st.count && (!ex.side || ex.anim.alt || this.count % 2 === 0)) window.Voice.speak(String(shown));
      window.Sound.tick();
      this.renderRing();
    },
    finishSet() {
      const s = this.step(); if (!s || s.kind !== 'ex') return;
      clearTimeout(this.advT);
      if (s.phase === 'main') {
        this.stats.sets++;
        const ex = byId[s.id];
        if (s.type === 'reps') this.stats.reps += ex.side && !ex.anim.alt ? Math.ceil(this.count / 2) : this.count;
      }
      this.go(this.i + 1);
    },
    startRest(s) {
      this.fig.stop();
      const nx = byId[s.next];
      this.remain = s.secs; this.count = 0; this.target = 0;
      const r = $('#plrest'); r.hidden = false;
      const nstep = this.w.steps.slice(this.i + 1).find((x) => x.kind === 'ex');
      const amtTxt = nstep ? `${nstep.amt} ${unitTxt(nx, nstep)}` : '';
      const lab = s.kind === 'ready' ? 'היכונו' : (s.label || (s.short ? 'מעבר' : 'מנוחה'));
      r.innerHTML = `<div>
        <div class="lab">${lab}</div>
        <div class="big" id="restn">${s.secs}</div>
        <div class="nx"><div class="mini" id="restfig"></div><div class="tx"><div class="muted small">${s.sameEx ? 'הסט הבא' : 'התרגיל הבא'}</div><h3>${nx.n}</h3><div class="muted small">${nstep && nstep.phase === 'main' ? `סט ${nstep.set}/${nstep.sets} · ` : ''}${amtTxt}</div></div></div>
        <div class="row"><button type="button" class="btn" id="rest20">+20 שניות</button><button type="button" class="btn pri" id="restskip">דלג ▸</button></div>
      </div>`;
      if (this.nfig) this.nfig.stop();
      this.nfig = new Figure($('#restfig')); this.nfig.setExercise(nx); this.nfig.play();
      $('#rest20').onclick = () => { this.remain += 20; this.said = {}; this.renderRing(); };
      $('#restskip').onclick = () => this.next();
      $('#pldone').style.display = 'none';
      $('#plwt').hidden = true;
      $('#plpanel').innerHTML = '';
      $('#pltip').textContent = nx.steps[0] + ' ' + (nx.tips[0] || '');
      if (s.kind === 'ready') window.Voice.speak(this.single ? `מתכוננים: ${nx.n}` : `מתחילים: ${this.w.title}. נתחיל בחימום. התרגיל הראשון: ${nx.n}`);
      else if (s.label) window.Voice.speak(`${s.label}. הבא: ${nx.n}`);
      else if (s.short) window.Voice.speak(`הבא: ${nx.n}`);
      else window.Voice.speak(s.sameEx ? `מנוחה ${s.secs} שניות` : `מנוחה ${s.secs} שניות. התרגיל הבא: ${nx.n}`);
      this.renderRing();
      if (this.paused) this.nfig.pause(true);
    },
    renderRing() {
      const s = this.step(); const ring = $('#plring'); if (!ring || !s) return;
      if (s.kind !== 'ex') { ring.style.display = 'none'; const n = $('#restn'); if (n) n.textContent = Math.ceil(this.remain); return; }
      ring.style.display = '';
      const ex = byId[s.id];
      let n, u, frac;
      if (s.type === 'time') { n = Math.ceil(this.remain); u = 'שניות'; frac = 1 - this.remain / s.amt; }
      else { n = ex.side && !ex.anim.alt ? Math.ceil(this.count / 2) : this.count; u = `מתוך ${s.amt}${ex.side ? ' לצד' : ''}`; frac = this.count / this.target; }
      const C = 2 * Math.PI * 46;
      ring.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#e3e7ec" stroke-width="7"/><circle cx="50" cy="50" r="46" fill="none" stroke="#ffd21f" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - Math.min(1, frac))).toFixed(1)}"/></svg><div class="in"><span class="n">${n}</span><span class="u">${u}</span></div>`;
    },
    renderUpNext() {
      const box = $('#plnext'); if (!box) return;
      const nexts = this.w.steps.slice(this.i + 1).filter((x) => x.kind === 'ex' && (x.set === 1)).slice(0, 3);
      box.innerHTML = nexts.length ? `<h4>בהמשך</h4><div class="list">${nexts.map((x, k) => `<div class="li"><div class="mini" data-mini="${x.id}"></div><div><div class="nm">${byId[x.id].n}</div><div class="muted small">${x.sets > 1 ? x.sets + ' סטים · ' : ''}${x.amt} ${unitTxt(byId[x.id], x)}</div></div></div>`).join('')}</div>` : '<h4>זה התרגיל האחרון 💪</h4>';
      box.querySelectorAll('[data-mini]').forEach((m) => { const f = new Figure(m); f.setExercise(byId[m.dataset.mini]); });
    },
    tick() {
      const now = performance.now(); const dt = (now - this.lastTs) / 1000; this.lastTs = now;
      if (this.paused) return;
      const s = this.step(); if (!s || s.kind === 'done') return;
      this.activeMs += dt * 1000;
      $('#plclock').textContent = fmt(this.activeMs / 1000);
      const st = window.Program.state.settings;
      if (s.kind === 'ex' && s.type !== 'time') {
        // טיפ מתחלף
        this._tipT = (this._tipT || 0) + dt;
        if (this._tipT > 7) { this._tipT = 0; const ex = byId[s.id]; const all = ex.tips.concat(ex.steps); this.tipIdx = (this.tipIdx + 1) % all.length; $('#pltip').textContent = all[this.tipIdx]; }
        return;
      }
      this.remain -= dt;
      const r = Math.ceil(this.remain);
      if (s.kind === 'ex') {
        const ex = byId[s.id];
        if (ex.side && !ex.anim.alt && !this.said.sw && this.remain <= s.amt / 2) { this.said.sw = 1; window.Voice.speak('החליפו צד'); }
        else if (!ex.side && !this.said.half && s.amt >= 20 && this.remain <= s.amt / 2) { this.said.half = 1; window.Voice.speak(st.coach ? 'חצי הדרך. ' + pick(MOTIV) : 'חצי הדרך'); }
        else if (!this.said.ten && s.amt >= 30 && r === 10) { this.said.ten = 1; window.Voice.speak('עוד עשר שניות'); }
      }
      if (r <= 3 && r >= 1 && !this.said['c' + r] && (s.kind === 'ex' || s.secs >= 5)) {
        this.said['c' + r] = 1; window.Sound.tick();
        window.Voice.speak(['', 'אחת', 'שתיים', 'שלוש'][r]);
      }
      this.renderRing();
      if (this.remain <= 0) {
        if (s.kind === 'ex') { if (s.phase === 'main') this.stats.sets++; window.Sound.done(); }
        this.go(this.i + 1);
      }
    },
    togglePause() {
      this.paused = !this.paused;
      this.el.classList.toggle('paused', this.paused);
      $('#plpause').innerHTML = this.paused ? IC.play : IC.pause;
      $('#plpause').setAttribute('aria-label', this.paused ? 'המשך' : 'השהיה');
      if (this.fig) this.fig.pause(this.paused);
      if (this.nfig) this.nfig.pause(this.paused);
      if (this.paused) { clearTimeout(this.advT); window.Voice.stop(); }
      else { this.lastTs = performance.now(); const s = this.step(); if (s && s.kind === 'ex' && s.type === 'reps' && this.count >= this.target) this.finishSet(); }
    },
    prev() {
      let j = this.i - 1;
      while (j > 0 && this.w.steps[j].kind !== 'ex') j--;
      this.go(Math.max(0, j));
    },
    next() { this.go(this.i + 1); },
    renderDone() {
      clearInterval(this.timer); if (this.fig) this.fig.stop(); if (this.nfig) this.nfig.stop();
      window.Sound.done();
      const dur = Math.round(this.activeMs / 60000);
      window.Voice.speak(this.single ? 'כל הכבוד!' : 'כל הכבוד! סיימתם את האימון. איך היה?');
      this.el.innerHTML = `<div class="done-v">
        <div class="trophy">🏆</div>
        <h1>${this.single ? 'כל הכבוד!' : 'אימון הושלם!'}</h1>
        <p class="muted">${this.w.title} · רמה ${this.w.lvl} · יום ${this.w.idx + 1}</p>
        <div class="stats" style="width:100%;max-width:36rem">
          <div class="stat"><b>${dur}</b><span>דקות</span></div>
          <div class="stat"><b>${this.stats.sets}</b><span>סטים</span></div>
          <div class="stat"><b>${this.stats.reps}</b><span>חזרות</span></div>
        </div>
        ${this.single ? '' : `<h3>איך הרגיש האימון?</h3>
        <div class="fb" id="fb">
          <button type="button" data-v="easy"><span>😎</span>קל מדי</button>
          <button type="button" data-v="ok" class="on"><span>💪</span>בדיוק</button>
          <button type="button" data-v="hard"><span>🥵</span>קשה מדי</button>
        </div>
        <p class="muted small">המאמן יתאים את מספר החזרות והמשקלים באימון הבא לפי התשובה שלכם.</p>`}
        <button type="button" class="btn pri big" id="dsave">${this.single ? 'חזרה' : 'שמירה וסיום'}</button>
      </div>`;
      let fb = 'ok';
      this.el.querySelectorAll('#fb button').forEach((b) => b.onclick = () => { fb = b.dataset.v; this.el.querySelectorAll('#fb button').forEach((x) => x.classList.toggle('on', x === b)); });
      $('#dsave').onclick = () => {
        if (!this.single) {
          const res = window.Program.complete(this.w, { feedback: fb, dur, sets: this.stats.sets, reps: this.stats.reps });
          this.close();
          if (res.unlockedNow) window.UI.toast(`🎉 רמה ${this.w.lvl + 1} נפתחה! אפשר לעבור אליה במסך הבית`, 4500);
          else window.UI.toast('האימון נשמר ✓');
        } else this.close();
      };
      setTimeout(() => { const b = $('#dsave'); if (b) b.focus(); }, 50);
    }
  };
  window.Player = P;
})();
