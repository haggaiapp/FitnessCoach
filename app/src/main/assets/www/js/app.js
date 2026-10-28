/* מסכי האפליקציה */
(function () {
  'use strict';
  const { Figure } = window.FigureEngine;
  const { EX, byId, CAT } = window.EXDB;
  const PG = window.Program;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- זיהוי טלוויזיה ----------
  if (/[?&]tv=1/.test(location.search)) window.__IS_TV__ = true;
  const ua = navigator.userAgent || '';
  const isTV = /Android TV|AFT|BRAVIA|SMART-TV|SmartTV|GoogleTV|Tizen|Web0S|CrKey|MiTV|TV Build/i.test(ua) || window.__IS_TV__ === true;
  if (isTV) document.documentElement.classList.add('tv');

  // ---------- UI כללי ----------
  const UI = {
    stack: [],
    modal(html, opts) {
      opts = opts || {};
      const m = document.createElement('div');
      m.className = 'modal open';
      m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
      $('#modals').appendChild(m);
      const close = () => { if (!m.parentNode) return; (m._figs || []).forEach((f) => f.stop()); m.remove(); this.stack = this.stack.filter((x) => x !== close); if (opts.onClose) opts.onClose(); if (this._lastFocus && document.contains(this._lastFocus)) this._lastFocus.focus(); };
      this._lastFocus = document.activeElement;
      m.addEventListener('click', (e) => { if (e.target === m) close(); });
      $$('[data-close]', m).forEach((b) => b.onclick = close);
      this.stack.push(close);
      setTimeout(() => { const f = m.querySelector('[data-autofocus]') || m.querySelector('button'); if (f) f.focus(); }, 30);
      m.close = close; m._figs = [];
      return m;
    },
    closeTop() { const c = this.stack[this.stack.length - 1]; if (c) { c(); return true; } return false; },
    confirm(title, text, okTxt, onOk, onCancel) {
      const m = this.modal(`<div class="hd"><h2>${esc(title)}</h2></div>${text ? `<p class="muted">${esc(text)}</p>` : ''}
        <div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn" id="cfn" data-autofocus>ביטול</button><button type="button" class="btn danger" id="cfy">${esc(okTxt || 'אישור')}</button></div>`, { onClose: () => { if (!m._ok && onCancel) onCancel(); } });
      $('#cfn', m).onclick = () => m.close();
      $('#cfy', m).onclick = () => { m._ok = true; m.close(); onOk && onOk(); };
    },
    toast(t, ms) {
      const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d);
      setTimeout(() => d.remove(), ms || 2200);
    }
  };
  window.UI = UI;

  function thumb(container, ex, play) {
    const f = new Figure(container); f.setExercise(ex); if (play) f.play(); return f;
  }
  const amtTxt = (ex, a) => ex.type === 'time' ? `${a} שנ׳` : `${a}${ex.side ? ' לצד' : ''}`;

  // ---------- ניווט טאבים ----------
  let tab = 'home', libCat = 'all', libQ = '';
  let liveFigs = [];
  function stopFigs() { liveFigs.forEach((f) => f.stop()); liveFigs = []; }
  function show(t) {
    tab = t; stopFigs();
    $$('.nav-b').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    const v = $('#view');
    ({ home: renderHome, library: renderLibrary, progress: renderProgress, settings: renderSettings })[t](v);
    v.scrollTop = 0;
  }
  $$('.nav-b').forEach((b) => b.onclick = () => show(b.dataset.tab));

  // ---------- בית ----------
  function renderHome(v) {
    const S = PG.state, lvl = S.level, L = PG.LEVELS[lvl - 1];
    const ni = PG.nextIndex(lvl);
    const w = PG.buildWorkout(lvl, ni);
    const done = S.done[lvl] || [];
    const totalMin = S.history.reduce((a, h) => a + (h.dur || 0), 0);
    const firstEx = byId[w.main[0]];
    v.innerHTML = `
      <div class="top"><div><div class="muted small">שלום! מוכנים להתאמן?</div><h1>מאמן הכושר שלך</h1></div><span class="chip acc">רמה ${lvl} · ${L.n}</span></div>
      <div class="hero">
        <div class="fig" id="herofig"></div>
        <div class="info">
          <div class="k">האימון הבא · ${PG.WEEKS[w.wk].n} · יום ${ni + 1} מתוך 16</div>
          <h2>${w.icon} ${w.title}</h2>
          <div class="muted">${w.sub}</div>
          <div class="row"><span class="chip">⏱ כ-${w.est} דק׳</span><span class="chip">🏋️ ${w.main.length} תרגילים</span><span class="chip">🔁 ${L.sets} סטים</span><span class="chip">🔥 חימום + שחרור</span></div>
          <div class="row" style="margin-top:.4rem">
            <button type="button" class="btn pri big" id="startbtn">התחל אימון ▶</button>
            <button type="button" class="btn ghost" id="prevbtn">תצוגה מקדימה</button>
          </div>
        </div>
      </div>
      <div class="sec-t"><h2>רמות</h2><span class="muted small">${L.desc}</span></div>
      <div class="levels">${PG.LEVELS.map((x, k) => {
        const n = k + 1, lock = n > S.unlocked, d = (S.done[n] || []).length;
        return `<button type="button" class="lv ${n === lvl ? 'on' : ''} ${lock ? 'lock' : ''}" data-lv="${n}">${lock ? '<span class="lk">🔒</span>' : ''}<b>${n}</b><span>${x.n}</span><div class="lvbar"><i style="width:${d / 16 * 100}%"></i></div></button>`;
      }).join('')}</div>
      <div class="sec-t"><h2>תוכנית רמה ${lvl}</h2><span class="muted small">${done.length}/16 אימונים הושלמו</span></div>
      <div class="weeks">${PG.WEEKS.map((wk, wi) => `<div class="week"><h4>שבוע ${wi + 1} · ${wk.n}</h4><div class="days">${[0, 1, 2, 3].map((d) => {
        const idx = wi * 4 + d, t = PG.dayType(idx), info = PG.DAYINFO[t === 'D' && !S.settings.machine ? 'D0' : t];
        return `<button type="button" class="day ${done.indexOf(idx) >= 0 ? 'done' : ''} ${idx === ni ? 'next' : ''}" data-day="${idx}"><div class="di">${info.icon}</div><div class="dn">${idx + 1}</div><div class="dt">${info.n.split(' ')[0]} ${info.n.split(' ')[1] || ''}</div></button>`;
      }).join('')}</div></div>`).join('')}</div>
      <div class="sec-t"><h2>הסטטיסטיקה שלך</h2></div>
      <div class="stats"><div class="stat"><b>${S.history.length}</b><span>אימונים</span></div><div class="stat"><b>${PG.streak()}</b><span>רצף ימים</span></div><div class="stat"><b>${totalMin}</b><span>דקות אימון</span></div></div>
      <div class="sec-t"><h2>טיפ המאמן</h2></div>
      <div class="note">${pickTip()}</div>`;
    liveFigs.push(thumb($('#herofig'), firstEx, true));
    $('#startbtn').onclick = () => window.Player.start(w);
    $('#prevbtn').onclick = () => previewWorkout(lvl, ni);
    $$('.lv', v).forEach((b) => b.onclick = () => {
      const n = +b.dataset.lv;
      if (n > S.unlocked) {
        UI.confirm(`לפתוח את רמה ${n}?`, `מומלץ להשלים לפחות 12 אימונים ברמה הנוכחית לפני מעבר. בטוחים שאתם מוכנים?`, 'פתיחת הרמה', () => { S.unlocked = n; S.level = n; PG.save(); show('home'); });
        return;
      }
      S.level = n; PG.save(); show('home');
    });
    $$('.day', v).forEach((b) => b.onclick = () => previewWorkout(lvl, +b.dataset.day));
    if (document.documentElement.classList.contains('tv')) setTimeout(() => $('#startbtn').focus(), 50);
  }
  const TIPS = [
    'התחילו תמיד בחימום – הוא מעלה את הדופק ומפחית סיכון לפציעה.',
    'איכות לפני כמות: חזרה נקייה שווה יותר משתי חזרות מרושלות.',
    'נשיפה במאמץ, שאיפה בחזרה – כך תשמרו על לחץ בטני נכון.',
    'שתו מים לפני, במהלך ואחרי האימון.',
    'שינה של 7–9 שעות היא חלק מהאימון – שם השרירים נבנים.',
    'אם תרגיל כואב (לא "שורף" אלא כואב) – עצרו והחליפו לגרסה קלה יותר.',
    'בשבוע ההתאוששות הנפח יורד בכוונה – זה הזמן שבו הגוף מתחזק.',
    'משקל נכון: 2 החזרות האחרונות צריכות להיות מאתגרות אבל בטכניקה מלאה.'
  ];
  const pickTip = () => TIPS[(new Date().getDate()) % TIPS.length];

  function previewWorkout(lvl, idx) {
    const w = PG.buildWorkout(lvl, idx);
    const L = PG.LEVELS[lvl - 1];
    const row = (id, phase) => {
      const ex = byId[id];
      const a = phase === 'main' ? PG.amount(ex, lvl, w.wk, PG.state.adapt[w.type], 'main') : (ex.type === 'time' ? (phase === 'cool' ? 30 : L.wu) : PG.amount(ex, lvl, w.wk, 1, 'warmup'));
      const wt = phase === 'main' && (ex.eq === 'db' || ex.eq === 'machine') ? ` · ${PG.suggestWeight(ex, lvl)} ק״ג` : '';
      return `<button type="button" class="li" data-ex="${id}"><div class="mini" data-mini="${id}"></div><div><div class="nm">${ex.n}</div><div class="muted small">${ex.mus}${wt}</div></div><div class="am">${phase === 'main' ? L.sets + '×' : ''}${amtTxt(ex, a)}</div></button>`;
    };
    const m = UI.modal(`<div class="hd"><h2>${w.icon} יום ${idx + 1}: ${w.title}</h2><button type="button" class="x" data-close aria-label="סגירה">✕</button></div>
      <div class="row"><span class="chip acc">${PG.WEEKS[w.wk].n}</span><span class="chip">⏱ כ-${w.est} דק׳</span><span class="chip">מנוחה ${L.rest} שנ׳ בין סטים</span></div>
      <div class="ph">🔥 חימום</div><div class="list">${w.warm.map((id) => row(id, 'warmup')).join('')}</div>
      <div class="ph">💪 אימון עיקרי</div><div class="list">${w.main.map((id) => row(id, 'main')).join('')}</div>
      <div class="ph">🧘 שחרור</div><div class="list">${w.cool.map((id) => row(id, 'cool')).join('')}</div>
      <div class="row" style="margin-top:1.2rem;justify-content:center"><button type="button" class="btn pri big" id="pvstart" data-autofocus>התחל אימון ▶</button></div>`);
    $$('[data-mini]', m).forEach((d) => thumb(d, byId[d.dataset.mini]));
    $$('[data-ex]', m).forEach((b) => b.onclick = () => exDetail(byId[b.dataset.ex]));
    $('#pvstart', m).onclick = () => { m.close(); window.Player.start(w); };
  }

  // ---------- ספריית תרגילים ----------
  function renderLibrary(v) {
    const cats = [['all', 'הכול']].concat(Object.keys(CAT).map((k) => [k, CAT[k].icon + ' ' + CAT[k].n]));
    v.innerHTML = `<div class="top"><h1>ספריית תרגילים</h1><span class="chip">${EX.length} תרגילים</span></div>
      <input class="search" id="q" type="search" placeholder="חיפוש תרגיל או שריר..." value="${esc(libQ)}">
      <div class="tabs">${cats.map(([k, n]) => `<button type="button" class="tab ${k === libCat ? 'on' : ''}" data-c="${k}">${n}</button>`).join('')}</div>
      <div class="grid" id="exgrid"></div>`;
    const draw = () => {
      const q = libQ.trim();
      const list = EX.filter((e) => (libCat === 'all' || e.cat === libCat) && (!q || e.n.includes(q) || e.mus.includes(q) || (e.en || '').toLowerCase().includes(q.toLowerCase())));
      $('#exgrid').innerHTML = list.map((e) => `<button type="button" class="ex-card" data-ex="${e.id}">${e.src ? '<span class="badge-src">★ מהאפליקציה</span>' : ''}<div class="thumb" data-th="${e.id}"></div><div class="t"><h3>${e.n}</h3><p>${CAT[e.cat].n} · ${e.mus}</p></div></button>`).join('') || '<p class="muted">לא נמצאו תרגילים</p>';
      $$('[data-th]', v).forEach((d) => thumb(d, byId[d.dataset.th]));
      $$('[data-ex]', v).forEach((b) => b.onclick = () => exDetail(byId[b.dataset.ex]));
    };
    $$('.tab', v).forEach((b) => b.onclick = () => { libCat = b.dataset.c; $$('.tab', v).forEach((x) => x.classList.toggle('on', x === b)); draw(); });
    $('#q').oninput = (e) => { libQ = e.target.value; draw(); };
    draw();
  }
  function exDetail(ex) {
    const eqn = { none: 'ללא ציוד', db: 'משקולות יד', machine: 'מכשיר', chair: 'כיסא יציב' }[ex.eq];
    const lvl = PG.state.level;
    const a = PG.amount(ex, lvl, 0, 1, 'main');
    const m = UI.modal(`<div class="hd"><h2>${ex.n}${ex.en ? ` <span class="muted small">(${ex.en})</span>` : ''}</h2><button type="button" class="x" data-close aria-label="סגירה">✕</button></div>
      <div class="ex-detail">
        <div><div class="stage-s" id="dfig"></div>
          <div class="row" style="margin-top:.6rem"><span class="chip acc">${CAT[ex.cat].icon} ${CAT[ex.cat].n}</span><span class="chip">${eqn}</span><span class="chip teal">${ex.mus}</span>${ex.src ? `<span class="chip">★ ${ex.src === 'abs' ? 'Impossible Abs' : 'Impossible Upper Body'}</span>` : ''}</div>
        </div>
        <div>
          <h3>איך מבצעים</h3><ol class="steps">${ex.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
          <h3 style="margin-top:.6rem">דגשים</h3><ul class="tips">${ex.tips.map((s) => `<li>${s}</li>`).join('')}</ul>
          <h3 style="margin-top:.6rem;color:var(--bad)">טעות נפוצה</h3><ul class="tips">${ex.mist.map((s) => `<li>${s}</li>`).join('')}</ul>
          <p class="muted small">ברמה ${lvl}: ${PG.LEVELS[lvl - 1].sets} סטים × ${amtTxt(ex, a)}</p>
          <button type="button" class="btn pri" id="trybtn" data-autofocus>▶ תרגול חופשי</button>
        </div>
      </div>`);
    const f = thumb($('#dfig', m), ex, true); m._figs.push(f);
    $('#trybtn', m).onclick = () => {
      m.close(); while (UI.closeTop());
      const steps = [{ kind: 'ready', phase: 'main', secs: 5, next: ex.id }, { kind: 'ex', phase: 'main', id: ex.id, set: 1, sets: 1, amt: a, type: ex.type }, { kind: 'done' }];
      window.Player.start({ lvl, idx: 0, type: 'A', title: ex.n, main: [ex.id], warm: [], cool: [], steps }, { single: true });
    };
  }

  // ---------- התקדמות ----------
  function renderProgress(v) {
    const S = PG.state;
    const totalMin = S.history.reduce((a, h) => a + (h.dur || 0), 0);
    const totalReps = S.history.reduce((a, h) => a + (h.reps || 0), 0);
    const fbIc = { easy: '😎', ok: '💪', hard: '🥵' };
    const wts = Object.keys(S.weights).filter((k) => byId[k]);
    v.innerHTML = `<div class="top"><h1>ההתקדמות שלי</h1></div>
      <div class="stats"><div class="stat"><b>${S.history.length}</b><span>אימונים</span></div><div class="stat"><b>${totalMin}</b><span>דקות</span></div><div class="stat"><b>${totalReps}</b><span>חזרות</span></div></div>
      <div class="sec-t"><h2>התקדמות ברמות</h2></div>
      <div class="list">${PG.LEVELS.map((L, k) => { const d = (S.done[k + 1] || []).length; return `<div class="li" style="padding:.8rem 1rem"><div class="grow"><div class="nm">רמה ${k + 1} · ${L.n} ${k + 1 > S.unlocked ? '🔒' : ''}</div><div class="lvbar"><i style="width:${d / 16 * 100}%"></i></div></div><div class="am">${d}/16</div></div>`; }).join('')}</div>
      <div class="sec-t"><h2>התאמה אישית של המאמן</h2></div>
      <div class="note">המאמן מתאים את העומס לפי המשוב שלכם בסוף כל אימון:<br>${['A', 'B', 'C', 'D'].map((t) => `${PG.DAYINFO[t].icon} ${PG.DAYINFO[t].n}: <b>${Math.round((S.adapt[t] || 1) * 100)}%</b>`).join(' · ')}</div>
      ${wts.length ? `<div class="sec-t"><h2>משקלים אחרונים</h2></div><div class="card"><table class="w"><tr><th>תרגיל</th><th>משקל</th></tr>${wts.map((k) => `<tr><td>${byId[k].n}</td><td>${S.weights[k]} ק״ג</td></tr>`).join('')}</table></div>` : ''}
      <div class="sec-t"><h2>היסטוריית אימונים</h2></div>
      <div class="list">${S.history.length ? S.history.slice(0, 60).map((h) => { const d = new Date(h.date); return `<div class="li hist" style="padding:.7rem"><div class="ic">${PG.DAYINFO[h.type] ? PG.DAYINFO[h.type].icon : '🏋️'}</div><div class="grow"><div class="nm">${esc(h.title)}</div><div class="muted small">${d.toLocaleDateString('he-IL')} · רמה ${h.lvl} · יום ${h.idx + 1} · ${h.dur} דק׳ · ${h.sets} סטים</div></div><div style="font-size:1.4rem">${fbIc[h.feedback] || ''}</div></div>`; }).join('') : '<p class="muted">עדיין אין אימונים. הזמן להתחיל! 💪</p>'}</div>`;
  }

  // ---------- הגדרות ----------
  function renderSettings(v) {
    const S = PG.state, st = S.settings;
    const T = (k, label, sub) => `<div class="set-row"><div class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</div><button type="button" class="tgl ${st[k] ? 'on' : ''}" data-t="${k}" role="switch" aria-checked="${!!st[k]}" aria-label="${label}"></button></div>`;
    const seg = (k, label, opts) => `<div class="set-row"><div class="lbl">${label}</div><div class="seg">${opts.map(([val, n]) => `<button type="button" data-s="${k}" data-v="${val}" class="${st[k] == val ? 'on' : ''}">${n}</button>`).join('')}</div></div>`;
    const ALLW = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];
    v.innerHTML = `<div class="top"><h1>הגדרות</h1></div>
      <div class="sec-t"><h2>מאמן קולי וצלילים</h2></div>
      ${T('voice', 'הנחיות קוליות בעברית', 'הכרזה על תרגילים, מנוחות וספירה לאחור')}
      ${T('count', 'ספירת חזרות בקול')}
      ${T('coach', 'משפטי עידוד של המאמן')}
      ${T('beeps', 'צלילי התראה')}
      <div class="set-row"><div class="lbl">בדיקת קול</div><button type="button" class="btn" id="vtest">🔊 נסה</button></div>
      <div class="sec-t"><h2>אימון</h2></div>
      ${T('auto', 'מעבר אוטומטי בסיום החזרות', 'כבוי = יש ללחוץ "סיימתי" בסוף כל סט')}
      ${seg('speed', 'קצב ההדמיה והספירה', [[0.8, 'איטי'], [1, 'רגיל'], [1.2, 'מהיר']])}
      ${seg('restMul', 'אורך מנוחות', [[0.75, 'קצר'], [1, 'רגיל'], [1.3, 'ארוך']])}
      ${T('machine', 'יש לי את המכשיר', 'כבוי = יום 4 יוחלף במעגל גוף מלא עם משקולות')}
      <div class="sec-t"><h2>משקולות היד שברשותי (ק״ג)</h2></div>
      <div class="card"><div class="wchips">${ALLW.map((w) => `<button type="button" class="wchip ${st.dbs.indexOf(w) >= 0 ? 'on' : ''}" data-w="${w}">${w}</button>`).join('')}</div><p class="muted small">המאמן ימליץ רק על משקלים שבחרתם.</p></div>
      <div class="sec-t"><h2>תצוגה</h2></div>
      ${seg('scale', 'גודל טקסט', [[0.9, 'קטן'], [1, 'רגיל'], [1.15, 'גדול'], [1.3, 'ענק']])}
      <div class="set-row"><div class="lbl">מצב טלוויזיה<small>גופנים גדולים וניווט בשלט</small></div><button type="button" class="tgl ${document.documentElement.classList.contains('tv') ? 'on' : ''}" id="tvt" role="switch" aria-label="מצב טלוויזיה"></button></div>
      <div class="sec-t"><h2>כללי</h2></div>
      <div class="set-row"><div class="lbl">מבחן כושר מחדש<small>לקביעת רמה מתאימה</small></div><button type="button" class="btn" id="retest">התחל</button></div>
      <div class="set-row"><div class="lbl">איפוס כל הנתונים</div><button type="button" class="btn danger" id="reset">איפוס</button></div>
      <div class="note" style="margin-top:1rem">⚠️ לפני תחילת תוכנית אימונים מומלץ להתייעץ עם רופא, במיוחד במקרה של מחלה, פציעה, הריון או כאב. הפסיקו מיד אם מופיע כאב חד, סחרחורת או קוצר נשימה חריג.</div>`;
    $$('[data-t]', v).forEach((b) => b.onclick = () => { const k = b.dataset.t; st[k] = !st[k]; b.classList.toggle('on', st[k]); b.setAttribute('aria-checked', st[k]); PG.save(); });
    $$('[data-s]', v).forEach((b) => b.onclick = () => { st[b.dataset.s] = +b.dataset.v; $$(`[data-s="${b.dataset.s}"]`, v).forEach((x) => x.classList.toggle('on', x === b)); PG.save(); applyScale(); });
    $$('[data-w]', v).forEach((b) => b.onclick = () => { const w = +b.dataset.w; const i = st.dbs.indexOf(w); if (i >= 0) { if (st.dbs.length > 1) st.dbs.splice(i, 1); } else st.dbs.push(w); st.dbs.sort((a, c) => a - c); b.classList.toggle('on', st.dbs.indexOf(w) >= 0); PG.save(); });
    $('#vtest').onclick = () => { window.Voice.enabled = true; window.Voice.speak('שלום! אני המאמן האישי שלך. בואו נתחיל להתאמן.'); window.Sound.enabled = true; window.Sound.go(); };
    $('#tvt').onclick = (e) => { document.documentElement.classList.toggle('tv'); e.currentTarget.classList.toggle('on'); localStorage.setItem('fitcoach.tv', document.documentElement.classList.contains('tv') ? '1' : '0'); };
    $('#retest').onclick = () => onboarding(true);
    $('#reset').onclick = () => UI.confirm('לאפס את כל הנתונים?', 'ההיסטוריה, ההתקדמות וההגדרות יימחקו.', 'איפוס', () => { PG.reset(); applyScale(); onboarding(); });
  }
  function applyScale() { document.documentElement.style.setProperty('--s', PG.state.settings.scale || 1); }

  // ---------- היכרות ומבחן כושר ----------
  function onboarding(retest) {
    stopFigs();
    const v = $('#view');
    const Q = [
      { k: 'push', t: 'כמה שכיבות סמיכה מלאות אתם מצליחים לבצע ברצף?', o: ['0–2', '3–10', '11–20', '21–35', '36+'] },
      { k: 'plank', t: 'כמה זמן אתם מחזיקים פלאנק אמות?', o: ['פחות מ-20 שנ׳', '20–45 שנ׳', '45–90 שנ׳', '1.5–2 דק׳', 'יותר מ-2 דק׳'] },
      { k: 'freq', t: 'כמה פעמים בשבוע התאמנתם בחודשים האחרונים?', o: ['בכלל לא', '1–2', '3', '4–5', '6+'] }
    ];
    const ans = { push: 0, plank: 0, freq: 0 };
    let machine = PG.state.settings.machine;
    v.innerHTML = `<div class="onb">
      <div class="onb hero-fig" id="onbfig"></div>
      <h1>ברוכים הבאים למאמן הכושר האישי 👋</h1>
      <p class="muted">תוכנית מקצועית בהדרגה: 5 רמות × 4 שבועות, 4 אימונים בשבוע – חימום, אימון כוח עם משקל גוף, משקולות יד ומכשיר, ושחרור. ענו על 3 שאלות קצרות כדי שנקבע את רמת הפתיחה.</p>
      ${Q.map((q) => `<div class="q"><h3>${q.t}</h3><div class="opts">${q.o.map((o, k) => `<button type="button" class="opt" data-q="${q.k}" data-v="${k}">${o}</button>`).join('')}</div></div>`).join('')}
      <div class="q"><h3>האם יש לכם את המכשיר (תחנת כבלים/מולטי-ג׳ים)?</h3><div class="opts"><button type="button" class="opt ${machine ? 'on' : ''}" data-m="1">כן</button><button type="button" class="opt ${!machine ? 'on' : ''}" data-m="0">לא כרגע</button></div></div>
      <div class="note">⚠️ מומלץ להתייעץ עם רופא לפני תחילת תוכנית אימונים. התחילו בזהירות והקשיבו לגוף.</div>
      <div class="row" style="margin:1.2rem 0 2rem"><button type="button" class="btn pri big" id="onbgo">בנו לי תוכנית ▶</button>${retest ? '<button type="button" class="btn ghost" id="onbx">ביטול</button>' : ''}</div>
    </div>`;
    const f = thumb($('#onbfig'), byId.pushup, true); liveFigs.push(f);
    $$('[data-q]', v).forEach((b) => b.onclick = () => { ans[b.dataset.q] = +b.dataset.v; $$(`[data-q="${b.dataset.q}"]`, v).forEach((x) => x.classList.toggle('on', x === b)); });
    $$('[data-m]', v).forEach((b) => b.onclick = () => { machine = b.dataset.m === '1'; $$('[data-m]', v).forEach((x) => x.classList.toggle('on', x === b)); });
    if (retest) $('#onbx').onclick = () => show('settings');
    $('#onbgo').onclick = () => {
      const score = (ans.push * 1.2 + ans.plank + ans.freq * 0.8) / 3;
      const lvl = Math.max(1, Math.min(5, Math.round(score) + 1));
      const S = PG.state; S.level = lvl; S.unlocked = Math.max(S.unlocked, lvl); S.onboarded = true; S.settings.machine = machine; PG.save();
      UI.toast(`הרמה המומלצת עבורכם: ${lvl} – ${PG.LEVELS[lvl - 1].n}`, 3000);
      show('home');
    };
    $$('.nav-b').forEach((b) => b.classList.remove('on'));
    setTimeout(() => { const b = v.querySelector('.opt'); if (b && document.documentElement.classList.contains('tv')) b.focus(); }, 50);
  }

  // ---------- חזרה (כפתור Back באנדרואיד) ----------
  window.appBack = function () {
    if (UI.closeTop()) return true;
    if ($('#player').classList.contains('open')) { if ($('.done-v')) window.Player.close(); else window.Player.askExit(); return true; }
    if (tab !== 'home') { show('home'); return true; }
    return false;
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') { if (window.appBack()) e.preventDefault(); }
    if ((e.key === 'MediaPlayPause' || e.key === ' ' && e.target === document.body) && $('#player').classList.contains('open') && !$('.done-v')) { e.preventDefault(); window.Player.togglePause(); }
  });

  window.App = { refresh() { if (PG.state.onboarded) show(tab); }, show };

  // ---------- אתחול ----------
  PG.load();
  if (localStorage.getItem('fitcoach.tv') === '1') document.documentElement.classList.add('tv');
  if (localStorage.getItem('fitcoach.tv') === '0' && !window.__IS_TV__) document.documentElement.classList.remove('tv');
  applyScale();
  if (!PG.state.onboarded) onboarding(); else show('home');
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
